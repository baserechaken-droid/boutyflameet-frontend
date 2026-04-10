/**
 * useWebRTC — Full-mesh WebRTC hook
 *
 * Android/iOS compatibility fixes:
 *  - getUserMedia with specific constraints that work on mobile
 *  - offerToReceiveAudio/Video flags for older browsers
 *  - Proper track replacement for screen share
 *  - ICE restart on failure
 */
import { useRef, useState, useCallback, useEffect } from 'react';
import { Socket } from 'socket.io-client';
import { RTC_CONFIG } from '../lib/constants';
import { PeerData, RoomJoinedPayload, UserJoinedPayload, UserLeftPayload, OfferPayload, AnswerPayload, IceCandidatePayload, PeerMuteStatePayload } from '../types';

interface Opts {
  socket: Socket | null;
  roomId: string | null;
  userName: string;
  onPeerJoined?: (name: string) => void;
  onPeerLeft?:   (name: string) => void;
}

export function useWebRTC({ socket, roomId, userName, onPeerJoined, onPeerLeft }: Opts) {
  const [localStream,   setLocalStream]   = useState<MediaStream | null>(null);
  const [screenStream,  setScreenStream]  = useState<MediaStream | null>(null);
  const [micOn,         setMicOn]         = useState(true);
  const [cameraOn,      setCameraOn]      = useState(true);
  const [screenSharing, setScreenSharing] = useState(false);
  const [peers,         setPeers]         = useState<Map<string, PeerData>>(new Map());
  const [mySocketId,    setMySocketId]    = useState<string | null>(null);

  const localStreamRef  = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const peersRef        = useRef<Map<string, PeerData>>(new Map());
  const socketRef       = useRef<Socket | null>(null);
  const micOnRef        = useRef(true);
  const cameraOnRef     = useRef(true);

  useEffect(() => { socketRef.current = socket; },   [socket]);
  useEffect(() => { micOnRef.current    = micOn; },   [micOn]);
  useEffect(() => { cameraOnRef.current = cameraOn; }, [cameraOn]);

  const updatePeer = useCallback((id: string, update: Partial<PeerData>) => {
    const cur = peersRef.current.get(id);
    if (!cur) return;
    peersRef.current.set(id, { ...cur, ...update });
    setPeers(new Map(peersRef.current));
  }, []);

  const removePeer = useCallback((id: string) => {
    const p = peersRef.current.get(id);
    if (p) { try { p.connection.close(); } catch {} peersRef.current.delete(id); setPeers(new Map(peersRef.current)); }
  }, []);

  const createPC = useCallback((remotePeerId: string, remoteName: string): RTCPeerConnection => {
    console.log(`[WebRTC] Creating PC → ${remoteName}`);
    const pc = new RTCPeerConnection(RTC_CONFIG);

    // Add local tracks to the connection
    localStreamRef.current?.getTracks().forEach(t => pc.addTrack(t, localStreamRef.current!));

    pc.onicecandidate = e => {
      if (e.candidate) socketRef.current?.emit('ice-candidate', { to: remotePeerId, candidate: e.candidate.toJSON() });
    };

    pc.ontrack = e => {
      console.log(`[WebRTC] Track from ${remoteName}:`, e.track.kind);
      // Use the first stream attached to the track
      const stream = e.streams[0] || new MediaStream([e.track]);
      updatePeer(remotePeerId, { stream });
    };

    pc.onconnectionstatechange = () => {
      const s = pc.connectionState;
      console.log(`[WebRTC] ${remoteName}: ${s}`);
      updatePeer(remotePeerId, { connectionState: s });
      if (s === 'failed') { console.warn('[WebRTC] Restarting ICE'); pc.restartIce(); }
    };

    peersRef.current.set(remotePeerId, {
      socketId: remotePeerId, name: remoteName, stream: null,
      connection: pc, micMuted: false, videoMuted: false,
      isScreenSharing: false, connectionState: 'new',
    });
    setPeers(new Map(peersRef.current));
    return pc;
  }, [updatePeer]);

  const initiateCall = useCallback(async (peerId: string, name: string) => {
    const pc = createPC(peerId, name);
    try {
      const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
      await pc.setLocalDescription(offer);
      socketRef.current?.emit('offer', { to: peerId, sdp: pc.localDescription });
      console.log(`[WebRTC] Offer → ${name}`);
    } catch (e) { console.error('[WebRTC] initiateCall error:', e); }
  }, [createPC]);

  const handleOffer = useCallback(async ({ from, sdp }: OfferPayload) => {
    let pc = peersRef.current.get(from)?.connection;
    if (!pc) pc = createPC(from, `Peer-${from.slice(0, 4)}`);
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socketRef.current?.emit('answer', { to: from, sdp: pc.localDescription });
      console.log(`[WebRTC] Answer → ${from}`);
    } catch (e) { console.error('[WebRTC] handleOffer error:', e); }
  }, [createPC]);

  const handleAnswer = useCallback(async ({ from, sdp }: AnswerPayload) => {
    const pc = peersRef.current.get(from)?.connection;
    if (!pc) return;
    try { if (pc.signalingState !== 'stable') await pc.setRemoteDescription(new RTCSessionDescription(sdp)); }
    catch (e) { console.error('[WebRTC] handleAnswer error:', e); }
  }, []);

  const handleICE = useCallback(async ({ from, candidate }: IceCandidatePayload) => {
    const pc = peersRef.current.get(from)?.connection;
    if (!pc) return;
    try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); }
    catch (e) { console.warn('[WebRTC] addIceCandidate (benign):', e); }
  }, []);

  // ── Get user media — mobile-compatible constraints ───────────
  const initLocalStream = useCallback(async (): Promise<MediaStream | null> => {
    if (localStreamRef.current) return localStreamRef.current; // already have it
    try {
      console.log('[Media] Requesting camera + mic...');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      localStreamRef.current = stream;
      setLocalStream(stream);
      console.log('[Media] Got stream:', stream.getTracks().map(t => t.kind));
      return stream;
    } catch (e) {
      console.warn('[Media] Video+audio failed, trying audio only:', e);
      try {
        const audio = await navigator.mediaDevices.getUserMedia({ audio: true });
        localStreamRef.current = audio;
        setLocalStream(audio);
        setCameraOn(false);
        return audio;
      } catch (e2) {
        console.error('[Media] All getUserMedia failed:', e2);
        return null;
      }
    }
  }, []);

  const joinRoom = useCallback(async () => {
    if (!socket || !roomId) return;
    if (!localStreamRef.current) await initLocalStream();
    socket.emit('join-room', { roomId, userName });
    console.log(`[WebRTC] Joining room: ${roomId}`);
  }, [socket, roomId, userName, initLocalStream]);

  const leaveRoom = useCallback(() => {
    peersRef.current.forEach(p => { try { p.connection.close(); } catch {} });
    peersRef.current.clear(); setPeers(new Map());
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    screenStreamRef.current?.getTracks().forEach(t => t.stop());
    localStreamRef.current = null; screenStreamRef.current = null;
    setLocalStream(null); setScreenStream(null); setScreenSharing(false);
    socket?.emit('leave-room');
  }, [socket]);

  const toggleMic = useCallback(() => {
    const s = localStreamRef.current;
    if (!s) return;
    const next = !micOnRef.current;
    s.getAudioTracks().forEach(t => { t.enabled = next; });
    setMicOn(next);
    socketRef.current?.emit('mute-state', { micMuted: !next, videoMuted: !cameraOnRef.current });
    console.log(`[Media] Mic: ${next}`);
  }, []);

  const toggleCamera = useCallback(() => {
    const s = localStreamRef.current;
    if (!s) return;
    const next = !cameraOnRef.current;
    s.getVideoTracks().forEach(t => { t.enabled = next; });
    setCameraOn(next);
    socketRef.current?.emit('mute-state', { micMuted: !micOnRef.current, videoMuted: !next });
    console.log(`[Media] Camera: ${next}`);
  }, []);

  const startScreenShare = useCallback(async (): Promise<boolean> => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      screenStreamRef.current = stream;
      setScreenStream(stream); setScreenSharing(true);
      const track = stream.getVideoTracks()[0];
      peersRef.current.forEach(p => {
        const sender = p.connection.getSenders().find(s => s.track?.kind === 'video');
        sender?.replaceTrack(track).catch(console.warn);
      });
      track.onended = () => stopScreenShare();
      socketRef.current?.emit('screen-share-started');
      return true;
    } catch { return false; }
  }, []); // eslint-disable-line

  const stopScreenShare = useCallback(() => {
    screenStreamRef.current?.getTracks().forEach(t => t.stop());
    screenStreamRef.current = null;
    setScreenStream(null); setScreenSharing(false);
    const cam = localStreamRef.current?.getVideoTracks()[0];
    if (cam) {
      peersRef.current.forEach(p => {
        const sender = p.connection.getSenders().find(s => s.track?.kind === 'video');
        sender?.replaceTrack(cam).catch(console.warn);
      });
    }
    socketRef.current?.emit('screen-share-stopped');
  }, []);

  // ── Socket event listeners ────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    const onRoomJoined = ({ socketId, existingPeers }: RoomJoinedPayload) => {
      setMySocketId(socketId);
      console.log(`[Socket] Room joined. Existing peers: ${existingPeers.length}`);
      existingPeers.forEach(({ socketId: pid, name }) => initiateCall(pid, name));
    };
    const onUserJoined = ({ socketId: pid, name }: UserJoinedPayload) => {
      console.log(`[Socket] User joined: ${name}`);
      onPeerJoined?.(name);
    };
    const onUserLeft   = ({ socketId: pid }: UserLeftPayload) => {
      const name = peersRef.current.get(pid)?.name ?? 'Someone';
      removePeer(pid);
      onPeerLeft?.(name);
    };
    const onPeerMute   = ({ socketId: pid, micMuted, videoMuted }: PeerMuteStatePayload) =>
      updatePeer(pid, { micMuted, videoMuted });
    const onSSOn  = ({ socketId: pid }: { socketId: string }) => updatePeer(pid, { isScreenSharing: true });
    const onSSOff = ({ socketId: pid }: { socketId: string }) => updatePeer(pid, { isScreenSharing: false });

    socket.on('room-joined',                onRoomJoined);
    socket.on('user-joined',               onUserJoined);
    socket.on('user-left',                 onUserLeft);
    socket.on('offer',                     handleOffer);
    socket.on('answer',                    handleAnswer);
    socket.on('ice-candidate',             handleICE);
    socket.on('peer-mute-state',           onPeerMute);
    socket.on('peer-screen-share-started', onSSOn);
    socket.on('peer-screen-share-stopped', onSSOff);

    return () => {
      socket.off('room-joined',                onRoomJoined);
      socket.off('user-joined',               onUserJoined);
      socket.off('user-left',                 onUserLeft);
      socket.off('offer',                     handleOffer);
      socket.off('answer',                    handleAnswer);
      socket.off('ice-candidate',             handleICE);
      socket.off('peer-mute-state',           onPeerMute);
      socket.off('peer-screen-share-started', onSSOn);
      socket.off('peer-screen-share-stopped', onSSOff);
    };
  }, [socket, initiateCall, handleOffer, handleAnswer, handleICE, updatePeer, removePeer, onPeerJoined, onPeerLeft]);

  return {
    localStream, screenStream, micOn, cameraOn, screenSharing,
    peers, mySocketId,
    joinRoom, leaveRoom, toggleMic, toggleCamera,
    startScreenShare, stopScreenShare, initLocalStream,
  };
}
