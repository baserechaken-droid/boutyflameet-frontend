import { ROOM_PREFIX } from './constants';

/** Generate a unique room ID like BOUTY-ABC123 */
export function generateRoomId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for (let i = 0; i < 6; i++) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }
  return `${ROOM_PREFIX}-${suffix}`;
}

/** Extract room ID from URL pathname /join/BOUTY-ABC123 */
export function extractRoomId(pathname: string): string | null {
  const match = pathname.match(/\/join\/([A-Z0-9-]+)/i);
  return match ? match[1].toUpperCase() : null;
}

/** Format millisecond timestamp to HH:MM */
export function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/** Format time ago for recent meetings */
export function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

/** Generate a random user name for anonymous users */
export function randomUserName(): string {
  const adjectives = ['Swift', 'Bright', 'Cool', 'Bold', 'Sharp', 'Warm', 'Quick', 'Smart'];
  const nouns = ['Fox', 'Star', 'Wave', 'Spark', 'Flame', 'Eagle', 'Tiger', 'Wolf'];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const num = Math.floor(Math.random() * 99) + 1;
  return `${adj}${noun}${num}`;
}

/** Get initials from a name */
export function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

/** Get a deterministic color for a peer based on their socket ID */
export function getPeerColor(socketId: string): string {
  const colors = [
    'linear-gradient(135deg, #7C3AED, #A855F7)',
    'linear-gradient(135deg, #059669, #10B981)',
    'linear-gradient(135deg, #DC2626, #F87171)',
    'linear-gradient(135deg, #2563EB, #60A5FA)',
    'linear-gradient(135deg, #D97706, #FBBF24)',
    'linear-gradient(135deg, #DB2777, #F472B6)',
    'linear-gradient(135deg, #0891B2, #22D3EE)',
    'linear-gradient(135deg, #65A30D, #A3E635)',
  ];
  let hash = 0;
  for (const c of socketId) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff;
  return colors[Math.abs(hash) % colors.length];
}

/** Copy text to clipboard */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for older browsers
    const el = document.createElement('textarea');
    el.value = text;
    el.style.position = 'fixed';
    el.style.opacity = '0';
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(el);
    return ok;
  }
}

/** Clamp a number between min and max */
export const clamp = (n: number, min: number, max: number) =>
  Math.min(Math.max(n, min), max);

/** Generate a unique ID */
export const uid = () => Math.random().toString(36).slice(2, 10);
