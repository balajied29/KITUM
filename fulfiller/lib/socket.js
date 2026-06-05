import { io } from 'socket.io-client';
import { getAccessToken } from './store';
import { refreshAccessToken } from './auth';

const URL = process.env.EXPO_PUBLIC_SOCKET_URL || process.env.EXPO_PUBLIC_API_URL || '';

let socket = null;

function attachAuthRecovery(s) {
  // Handshake rejected for an expired access token → refresh once + reconnect.
  s.on('connect_error', async (err) => {
    if (!/authoriz|token/i.test(err?.message || '') || s._refreshing) return;
    s._refreshing = true;
    try {
      const token = await refreshAccessToken();
      s.auth = { token };
      s.connect();
    } catch {
      /* refresh failed — REST 401 path signs out */
    } finally {
      s._refreshing = false;
    }
  });
}

export function connectSocket() {
  if (socket) {
    socket.auth = { token: getAccessToken() };
    if (!socket.connected) socket.connect();
    return socket;
  }
  socket = io(URL, {
    auth: { token: getAccessToken() },
    transports: ['websocket'],
    reconnection: true,
    reconnectionDelay: 1000,
  });
  attachAuthRecovery(socket);
  return socket;
}

export function getSocket() {
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
