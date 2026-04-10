/**
 * ControlsBar — Floating glassmorphism controls at bottom of meeting
 * Keyboard shortcuts: M=mic, V=video, C=chat, R=reaction
 */
import { useEffect, useCallback } from 'react';
import {
  Mic, MicOff, Video, VideoOff, MonitorUp, MonitorOff,
  MessageSquare, Users, PhoneOff, Hand, Settings,
  Smile
} from 'lucide-react';
import { ALLOWED_REACTIONS } from '../lib/constants';

interface ControlsBarProps {
  micOn: boolean;
  cameraOn: boolean;
  screenSharing: boolean;
  chatOpen: boolean;
  peopleOpen: boolean;
  handRaised: boolean;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onToggleScreen: () => void;
  onToggleChat: () => void;
  onTogglePeople: () => void;
  onToggleHand: () => void;
  onLeave: () => void;
  onReaction: (emoji: string) => void;
  onSettings?: () => void;
  roomId: string;
  participantCount: number;
  showReactions: boolean;
  onToggleReactions: () => void;
}

function CtrlBtn({
  onClick, active, danger, off, tip, children, className = '',
}: {
  onClick: () => void; active?: boolean; danger?: boolean; off?: boolean;
  tip: string; children: React.ReactNode; className?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={tip}
      aria-label={tip}
      className={[
        'relative w-12 h-12 rounded-2xl flex items-center justify-center',
        'transition-all duration-200 group border',
        danger
          ? 'bg-red-500 hover:bg-red-400 border-red-400/50 text-white shadow-lg'
          : off
          ? 'bg-red-500/20 hover:bg-red-500/30 border-red-500/40 text-red-400'
          : active
          ? 'bg-flame-500 hover:bg-flame-400 border-flame-400/50 text-white shadow-flame-sm'
          : 'bg-white/[0.08] hover:bg-white/[0.16] border-white/[0.08] text-white',
        className,
      ].join(' ')}
    >
      {children}
      <span className="absolute -top-9 left-1/2 -translate-x-1/2 bg-dark-800 border border-white/10 text-white text-xs font-medium px-2.5 py-1 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
        {tip}
      </span>
    </button>
  );
}

export function ControlsBar({
  micOn, cameraOn, screenSharing, chatOpen, peopleOpen, handRaised,
  onToggleMic, onToggleCamera, onToggleScreen, onToggleChat,
  onTogglePeople, onToggleHand, onLeave, onReaction,
  onSettings, participantCount, showReactions, onToggleReactions,
}: ControlsBarProps) {

  // ── Keyboard shortcuts ───────────────────────────────────────
  const handleKey = useCallback((e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement).tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    switch (e.key.toLowerCase()) {
      case 'm': onToggleMic(); break;
      case 'v': onToggleCamera(); break;
      case 'c': onToggleChat(); break;
      case 'r':
        onReaction(ALLOWED_REACTIONS[Math.floor(Math.random() * ALLOWED_REACTIONS.length)]);
        break;
      default: break;
    }
  }, [onToggleMic, onToggleCamera, onToggleChat, onReaction]);

  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  return (
    <div className="relative">
      {/* Reaction picker */}
      {showReactions && (
        <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 glass border border-white/10 rounded-2xl px-4 py-3 flex gap-3 animate-slide-up z-20">
          {ALLOWED_REACTIONS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => { onReaction(emoji); onToggleReactions(); }}
              className="text-2xl hover:scale-125 transition-transform duration-150 cursor-pointer"
              aria-label={emoji}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* Main bar */}
      <div className="glass-dark border-t border-white/[0.06] px-4 py-3 md:px-6 md:py-4">
        <div className="flex items-center justify-between max-w-3xl mx-auto gap-2">

          {/* Left: Mic + Camera */}
          <div className="flex items-center gap-2">
            <CtrlBtn onClick={onToggleMic} off={!micOn} tip={micOn ? 'Mute (M)' : 'Unmute (M)'}>
              {micOn ? <Mic size={20} /> : <MicOff size={20} />}
            </CtrlBtn>
            <CtrlBtn onClick={onToggleCamera} off={!cameraOn} tip={cameraOn ? 'Stop video (V)' : 'Start video (V)'}>
              {cameraOn ? <Video size={20} /> : <VideoOff size={20} />}
            </CtrlBtn>
          </div>

          {/* Center: Screen share, Chat, Reactions, Raise hand, People */}
          <div className="flex items-center gap-2">
            <CtrlBtn
              onClick={() => { onToggleScreen(); }}
              active={screenSharing}
              tip={screenSharing ? 'Stop sharing' : 'Share screen'}
            >
              {screenSharing ? <MonitorOff size={20} /> : <MonitorUp size={20} />}
            </CtrlBtn>

            <CtrlBtn onClick={onToggleReactions} tip="Reactions (R)">
              <Smile size={20} />
            </CtrlBtn>

            <CtrlBtn onClick={onToggleHand} active={handRaised} tip={handRaised ? 'Lower hand' : 'Raise hand'}>
              <Hand size={20} />
            </CtrlBtn>

            <CtrlBtn onClick={onToggleChat} active={chatOpen} tip="Chat (C)">
              <MessageSquare size={20} />
            </CtrlBtn>

            <CtrlBtn onClick={onTogglePeople} active={peopleOpen} tip="Participants">
              <div className="relative">
                <Users size={20} />
                {participantCount > 1 && (
                  <span className="absolute -top-2 -right-2 w-4 h-4 rounded-full bg-flame-500 text-white text-[9px] font-bold flex items-center justify-center">
                    {participantCount}
                  </span>
                )}
              </div>
            </CtrlBtn>

            {onSettings && (
              <CtrlBtn onClick={onSettings} tip="Settings">
                <Settings size={20} />
              </CtrlBtn>
            )}
          </div>

          {/* Right: Leave */}
          <CtrlBtn onClick={onLeave} danger tip="Leave meeting">
            <PhoneOff size={20} />
          </CtrlBtn>
        </div>

        {/* Keyboard hints */}
        <p className="text-center text-white/20 text-[10px] font-medium mt-2 hidden md:block">
          M · Mic &nbsp;&nbsp; V · Video &nbsp;&nbsp; C · Chat &nbsp;&nbsp; R · Reaction
        </p>
      </div>
    </div>
  );
}
