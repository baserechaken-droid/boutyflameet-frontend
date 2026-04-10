/**
 * useSocket — manages the Socket.io connection to the signaling server
 * Reconnects automatically, handles errors gracefully on mobile networks
 */
import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { SIGNALING_URL } from '../lib/constants';
import { ConnectionStatus } from '../types';

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    const s = io(SIGNALING_URL, {
      transports: ['websocket', 'polling'], // websocket first, fall back to polling (better for mobile)
      reconnectionAttempts: 15,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 8000,
      timeout: 20000,
    });

    socketRef.current = s;

    s.on('connect',       () => { console.log('[Socket] Connected:', s.id); setStatus('connected'); setSocket(s); });
    s.on('disconnect',    () => { console.log('[Socket] Disconnected'); setStatus('disconnected'); });
    s.on('reconnecting',  () => setStatus('reconnecting'));
    s.on('reconnect',     () => setStatus('connected'));
    s.on('connect_error', (e) => { console.error('[Socket] Error:', e.message); setStatus('error'); });

    return () => { s.disconnect(); socketRef.current = null; setSocket(null); };
  }, []);

  return { socket, status };
}
