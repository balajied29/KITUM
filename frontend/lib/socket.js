'use client';
import { io } from 'socket.io-client';
import { useAuthStore } from './store';
import { refreshAccessToken } from './auth';

let socket = null;

/**
 * Singleton socket. Connects directly to the persistent backend
 * (NEXT_PUBLIC_SOCKET_URL) — websockets can't ride the Next `/api` rewrite.
 */
export function getSocket() {
  if (socket) return socket;

  const url = process.env.NEXT_PUBLIC_SOCKET_URL || process.env.NEXT_PUBLIC_API_URL || '';
  socket = io(url, {
    auth: { token: useAuthStore.getState().accessToken },
    transports: ['websocket'],
    reconnection: true,
    reconnectionDelay: 1000,
  });

  // Handshake rejected because the access token expired → refresh once + reconnect.
  socket.on('connect_error', async (err) => {
    if (!/authoriz|token/i.test(err?.message || '') || socket._refreshing) return;
    socket._refreshing = true;
    try {
      const token = await refreshAccessToken();
      socket.auth = { token };
      socket.connect();
    } catch {
      /* refresh failed — the REST 401 path handles logout */
    } finally {
      socket._refreshing = false;
    }
  });

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
