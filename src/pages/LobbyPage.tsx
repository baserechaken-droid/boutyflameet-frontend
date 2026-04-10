import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, ArrowRight, Plus, LogIn, Trash2 } from 'lucide-react';
import { Logo, Btn, Input } from '../components/ui';
import { generateRoomId, timeAgo } from '../lib/utils';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { RecentMeeting } from '../types';
import { LS_KEYS } from '../lib/constants';

export function LobbyPage() {
  const navigate = useNavigate();
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState('');
  const [creating, setCreating] = useState(false);
  const [recent, setRecent] = useLocalStorage<RecentMeeting[]>(LS_KEYS.RECENT_MEETINGS, []);

  const handleNewMeeting = async () => {
    setCreating(true);
    await new Promise(r => setTimeout(r, 300));
    navigate(`/join/${generateRoomId()}`);
  };

  const handleJoin = (e: FormEvent) => {
    e.preventDefault();
    const raw = joinCode.trim();
    if (!raw) { setJoinError('Please enter a room code or link'); return; }
    // Extract room ID from full URL if pasted
    const urlMatch = raw.match(/\/join\/([A-Z0-9-]+)/i);
    const roomId = (urlMatch ? urlMatch[1] : raw).toUpperCase().replace(/\s/g, '');
    if (!/^[A-Z0-9-]{4,20}$/.test(roomId)) {
      setJoinError('Invalid code. Example: BOUTY-ABC123');
      return;
    }
    navigate(`/join/${roomId}`);
  };

  return (
    <div className="min-h-screen bg-dark-900 flex flex-col">
      <nav className="glass-dark border-b border-white/[0.06] px-4 md:px-6 h-16 flex items-center justify-between shrink-0">
        <button onClick={() => navigate('/')} className="hover:opacity-80 transition-opacity"><Logo /></button>
        <span className="text-sm text-white/40 font-medium">Beta</span>
      </nav>

      <div className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-4xl">
          <h1 className="text-2xl md:text-4xl font-black text-white mb-2 animate-slide-up">Good to see you 👋</h1>
          <p className="text-white/50 mb-8 text-sm md:text-base">Start or join a meeting — invite link works on any device.</p>

          <div className="grid md:grid-cols-2 gap-4 mb-8">
            {/* New Meeting */}
            <div className="glass border border-white/[0.08] rounded-2xl p-6 md:p-7 hover:border-flame-500/20 transition-all">
              <div className="text-4xl mb-4 animate-float inline-block">🔥</div>
              <h2 className="text-lg md:text-xl font-bold text-white mb-2">New Meeting</h2>
              <p className="text-white/50 text-sm mb-5 leading-relaxed">
                Generate a unique room and get a shareable link that works on any device worldwide.
              </p>
              <Btn variant="flame" size="lg" className="w-full" loading={creating}
                icon={creating ? undefined : <Plus size={18} />} onClick={handleNewMeeting}>
                {creating ? 'Creating…' : 'Create meeting'}
              </Btn>
            </div>

            {/* Join Meeting */}
            <div className="glass border border-white/[0.08] rounded-2xl p-6 md:p-7 hover:border-cyan-accent/15 transition-all">
              <div className="text-4xl mb-4 inline-block">🔗</div>
              <h2 className="text-lg md:text-xl font-bold text-white mb-2">Join Meeting</h2>
              <p className="text-white/50 text-sm mb-5 leading-relaxed">
                Enter a code like <span className="font-mono text-flame-400 text-xs">BOUTY-ABC123</span> or paste a full invite link.
              </p>
              <form onSubmit={handleJoin} className="flex flex-col gap-3">
                <Input value={joinCode} onChange={e => { setJoinCode(e.target.value); setJoinError(''); }}
                  placeholder="Room code or invite link…" error={joinError} className="font-mono" />
                <Btn variant="cyan" size="md" className="w-full" icon={<LogIn size={16} />}>Join meeting</Btn>
              </form>
            </div>
          </div>

          {/* Recent Meetings */}
          {recent.length > 0 && (
            <div className="animate-fade-in">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-white/50 text-sm font-semibold">
                  <Clock size={14} /> Recent Meetings
                </div>
                <button onClick={() => setRecent([])} className="flex items-center gap-1.5 text-white/25 hover:text-red-400 text-xs transition-colors">
                  <Trash2 size={11} /> Clear
                </button>
              </div>
              <div className="flex flex-col gap-2">
                {recent.slice(0, 5).map(r => (
                  <button key={r.roomId} onClick={() => navigate(`/join/${r.roomId}`)}
                    className="glass border border-white/[0.06] hover:border-flame-500/20 rounded-xl px-4 py-3 flex items-center justify-between group transition-all text-left">
                    <div>
                      <p className="text-sm font-semibold text-white/90 group-hover:text-white transition-colors">{r.title || r.roomId}</p>
                      <p className="text-xs text-white/35 font-mono">{r.roomId} · {timeAgo(r.joinedAt)}</p>
                    </div>
                    <div className="flex items-center gap-1.5 text-flame-500 opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="text-xs font-bold">Rejoin</span>
                      <ArrowRight size={14} />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
