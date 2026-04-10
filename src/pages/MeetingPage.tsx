/**
 * MeetingPage — Full meeting room
 * Fixes: camera on immediately, invite modal with real URL,
 *        mobile-friendly layout, Android/iOS WebRTC compat
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { X, Copy, Check, Link2 } from 'lucide-react';
import { useSocket } from '../hooks/useSocket';
import { useWebRTC } from '../hooks/useWebRTC';
import { useToast } from '../hooks/useToast';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { TopBar } from '../components/TopBar';
import { VideoGrid } from '../components/VideoGrid';
import { ControlsBar } from '../components/ControlsBar';
import { ChatPanel } from '../components/ChatPanel';
import { PeoplePanel } from '../components/PeoplePanel';
import { ToastContainer, ConnectingScreen, FloatingReactions, FloatingReaction, FlameIcon } from '../components/ui';
import { ChatMessage, RecentMeeting } from '../types';
import { copyToClipboard, uid, randomUserName } from '../lib/utils';
import { LS_KEYS } from '../lib/constants';

function useTimer() {
  const [secs, setSecs] = useState(0);
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    ref.current = setInterval(() => setSecs(s => s + 1), 1000);
    return () => { if (ref.current) clearInterval(ref.current); };
  }, []);
  const h = String(Math.floor(secs / 3600)).padStart(2, '0');
  const m = String(Math.floor((secs % 3600) / 60)).padStart(2, '0');
  const s = String(secs % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

// ─── Invite Modal ─────────────────────────────────────────────
function InviteModal({ url, onClose }: { url: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const handle = async () => {
    await copyToClipboard(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };
  // Close on backdrop click
  const handleBackdrop = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4" onClick={handleBackdrop}>
      <div className="glass border border-white/10 rounded-2xl p-6 w-full max-w-md animate-slide-up">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Link2 size={16} className="text-flame-500" /> Share Meeting Link
          </h2>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors p-1">
            <X size={18} />
          </button>
        </div>
        <p className="text-white/50 text-sm mb-3">Anyone who opens this link joins instantly — on any device:</p>
        {/* Selectable URL box */}
        <div className="bg-white/[0.06] border border-white/10 rounded-xl px-3 py-3 text-xs font-mono text-cyan-accent/90 break-all mb-4 select-all cursor-text leading-relaxed">
          {url}
        </div>
        <button onClick={handle}
          className={`w-full py-3 rounded-xl font-bold text-sm transition-all duration-300 flex items-center justify-center gap-2 ${
            copied ? 'bg-green-500/20 border border-green-500/30 text-green-400'
                   : 'btn-flame text-white'}`}>
          {copied ? <><Check size={16} /> Copied!</> : <><Copy size={16} /> Copy Invite Link</>}
        </button>
        <p className="text-center text-white/25 text-xs mt-3">
          Works on Android · iPhone · PC · any browser
        </p>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────
export function MeetingPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate   = useNavigate();
  const timer      = useTimer();

  const [storedName, setStoredName] = useLocalStorage<string>(LS_KEYS.USER_NAME, '');
  const userName = storedName || randomUserName();
  const [, setRecent] = useLocalStorage<RecentMeeting[]>(LS_KEYS.RECENT_MEETINGS, []);
  const [title, setTitle]           = useState('My Meeting');
  const [chatOpen, setChatOpen]     = useState(false);
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [joined, setJoined]         = useState(false);
  const [messages, setMessages]     = useLocalStorage<ChatMessage[]>(`bfm_chat_${roomId}`, []);
  const [reactions, setReactions]   = useState<FloatingReaction[]>([]);
  const { toasts, addToast, removeToast } = useToast();

  const { socket, status: connStatus } = useSocket();
  const {
    localStream, micOn, cameraOn, screenSharing,
    peers, mySocketId,
    joinRoom, leaveRoom, toggleMic, toggleCamera,
    startScreenShare, stopScreenShare, initLocalStream,
  } = useWebRTC({
    socket, roomId: roomId ?? null, userName,
    onPeerJoined: name => addToast(`🔥 ${name} joined`, 'success'),
    onPeerLeft:   name => addToast(`👋 ${name} left`,   'info'),
  });

  // ── Start camera IMMEDIATELY on mount ────────────────────────
  useEffect(() => { initLocalStream(); }, []); // eslint-disable-line

  // ── Join room once socket is ready ───────────────────────────
  useEffect(() => {
    if (connStatus === 'connected' && roomId && !joined) {
      setJoined(true);
      joinRoom();
      setRecent(prev => [
        { roomId: roomId.toUpperCase(), title, joinedAt: Date.now() },
        ...prev.filter(r => r.roomId !== roomId.toUpperCase()),
      ].slice(0, 10));
      if (!storedName) setStoredName(userName);
    }
  }, [connStatus, roomId, joined]); // eslint-disable-line

  // ── Socket: chat + reactions ─────────────────────────────────
  useEffect(() => {
    if (!socket) return;
    const onChat = (msg: ChatMessage) => {
      setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, { ...msg, isOwn: msg.socketId === mySocketId }]);
    };
    const onReaction = ({ emoji, socketId, name }: { emoji: string; socketId: string; name: string }) => {
      const r: FloatingReaction = { id: uid(), emoji, socketId, name, x: 60 + Math.random() * (window.innerWidth - 160), y: 0 };
      setReactions(prev => [...prev, r]);
      setTimeout(() => setReactions(prev => prev.filter(x => x.id !== r.id)), 2500);
    };
    socket.on('chat-message', onChat);
    socket.on('reaction', onReaction);
    return () => { socket.off('chat-message', onChat); socket.off('reaction', onReaction); };
  }, [socket, mySocketId, setMessages]);

  const handleSendChat = useCallback((text: string) => {
    if (!socket || !roomId) return;
    const msg: ChatMessage = { id: uid(), message: text, userName, timestamp: Date.now(), socketId: mySocketId ?? 'local', isOwn: true };
    setMessages(prev => [...prev, msg]);
    socket.emit('chat-message', { roomId, message: text, userName, timestamp: msg.timestamp });
  }, [socket, roomId, userName, mySocketId, setMessages]);

  const handleReaction = useCallback((emoji: string) => {
    if (!socket || !roomId) return;
    socket.emit('reaction', { roomId, emoji });
    const r: FloatingReaction = { id: uid(), emoji, socketId: mySocketId ?? 'local', name: 'You', x: 60 + Math.random() * (window.innerWidth - 160), y: 0 };
    setReactions(prev => [...prev, r]);
    setTimeout(() => setReactions(prev => prev.filter(x => x.id !== r.id)), 2500);
  }, [socket, roomId, mySocketId]);

  const handleToggleScreen = useCallback(() => {
    if (screenSharing) { stopScreenShare(); addToast('🖥️ Screen share stopped', 'info'); }
    else startScreenShare().then(ok => { if (ok) addToast('🖥️ Screen sharing started', 'success'); else addToast('Screen share cancelled', 'warning'); });
  }, [screenSharing, startScreenShare, stopScreenShare, addToast]);

  const handleLeave = useCallback(() => { leaveRoom(); navigate('/lobby'); }, [leaveRoom, navigate]);

  const inviteUrl = `${window.location.origin}/join/${roomId?.toUpperCase()}`;
  const isAlone   = peers.size === 0;
  const peerCount = peers.size + 1;

  if (!joined && connStatus !== 'connected') {
    return <ConnectingScreen roomId={roomId ?? ''} />;
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-dark-900">
      <TopBar
        roomId={roomId?.toUpperCase() ?? ''}
        title={title}
        onTitleChange={setTitle}
        connectionStatus={connStatus}
        participantCount={peerCount}
        timer={timer}
        onInviteClick={() => setShowInvite(true)}
      />

      <div className="flex-1 flex overflow-hidden relative">
        {/* VideoGrid ALWAYS rendered — keeps camera alive */}
        <VideoGrid
          peers={peers}
          localStream={localStream}
          localName={userName}
          micOn={micOn}
          cameraOn={cameraOn}
          screenSharing={screenSharing}
          mySocketId={mySocketId}
          isAlone={isAlone}
        />

        {/* Alone overlay — floats over camera (doesn't hide it) */}
        {isAlone && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 px-4">
            <div className="glass border border-white/10 rounded-2xl p-6 md:p-8 text-center max-w-sm w-full pointer-events-auto">
              <div className="mb-4 animate-float inline-block"><FlameIcon size={52} /></div>
              <h2 className="text-lg md:text-xl font-bold text-white mb-2">You're the first one here 🔥</h2>
              <p className="text-white/50 text-sm mb-4">Share this link — anyone who opens it joins your meeting instantly on any device.</p>
              {/* URL preview */}
              <div className="bg-white/[0.05] border border-white/10 rounded-xl px-3 py-2.5 font-mono text-[11px] text-cyan-accent/80 break-all text-left mb-4 select-all cursor-text">
                {inviteUrl}
              </div>
              <button onClick={() => { copyToClipboard(inviteUrl); addToast('📋 Link copied! Share it with anyone.', 'success'); }}
                className="w-full py-3 rounded-xl font-bold text-sm btn-flame text-white flex items-center justify-center gap-2">
                <Copy size={15} /> Copy Invite Link
              </button>
              <p className="text-white/25 text-xs mt-2">Works on Android · iPhone · any browser</p>
            </div>
          </div>
        )}

        {chatOpen   && <ChatPanel messages={messages} onSend={handleSendChat} onClose={() => setChatOpen(false)} mySocketId={mySocketId} />}
        {peopleOpen && <PeoplePanel peers={peers} mySocketId={mySocketId} myName={userName} myMicOn={micOn} myCameraOn={cameraOn} onClose={() => setPeopleOpen(false)} />}
      </div>

      <ControlsBar
        micOn={micOn} cameraOn={cameraOn} screenSharing={screenSharing}
        chatOpen={chatOpen} peopleOpen={peopleOpen} handRaised={handRaised}
        showReactions={showReactions}
        onToggleMic={toggleMic} onToggleCamera={toggleCamera} onToggleScreen={handleToggleScreen}
        onToggleChat={() => { setChatOpen(o => !o); setPeopleOpen(false); }}
        onTogglePeople={() => { setPeopleOpen(o => !o); setChatOpen(false); }}
        onToggleHand={() => setHandRaised(h => { addToast(!h ? '✋ Hand raised!' : 'Hand lowered', 'info'); return !h; })}
        onToggleReactions={() => setShowReactions(s => !s)}
        onLeave={handleLeave} onReaction={handleReaction}
        roomId={roomId ?? ''} participantCount={peerCount}
      />

      {showInvite && <InviteModal url={inviteUrl} onClose={() => setShowInvite(false)} />}
      <FloatingReactions reactions={reactions} />
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
