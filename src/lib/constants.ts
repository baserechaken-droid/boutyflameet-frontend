// ================================================================
// Boutyflameet — Constants & ICE Configuration
// ================================================================

/**
 * ICE servers for WebRTC NAT traversal.
 * STUN: helps discover public IP/port
 * TURN: relays media when direct connection fails (behind symmetric NAT)
 *
 * OpenRelay TURN is free up to 20GB/month.
 * Get your own credentials at: https://app.metered.ca/tools/openrelay
 */
export const ICE_SERVERS: RTCIceServer[] = [
  // Google STUN servers
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  // Cloudflare STUN
  { urls: 'stun:stun.cloudflare.com:3478' },
  // OpenRelay free TURN (20GB/month — replace with your own for production)
  {
    urls: 'turn:openrelay.metered.ca:80',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443?transport=tcp',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
];

export const RTC_CONFIG: RTCConfiguration = {
  iceServers: ICE_SERVERS,
  iceCandidatePoolSize: 10,
  bundlePolicy: 'max-bundle',
  rtcpMuxPolicy: 'require',
};

// Backend signaling server URL
// In production: set VITE_SIGNALING_URL env var to your deployed backend URL
export const SIGNALING_URL =
  import.meta.env.VITE_SIGNALING_URL || 'http://localhost:3001';

// Room ID prefix
export const ROOM_PREFIX = 'BOUTY';

// Max peers in a room (full-mesh scales to ~8 comfortably)
export const MAX_PEERS = 8;

// Local storage keys
export const LS_KEYS = {
  RECENT_MEETINGS: 'bfm_recent_v2',
  USER_NAME: 'bfm_username',
  SETTINGS: 'bfm_settings',
};

export const ALLOWED_REACTIONS = ['👍', '❤️', '🔥', '😂', '👏', '🎉'];
