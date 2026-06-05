'use client';
import { activeAuthStore } from './store';

/**
 * Silent access-token refresh. Single-flight: concurrent 401s share one in-flight
 * refresh instead of stampeding the endpoint. Uses bare fetch (no axios
 * interceptor) to avoid recursion, and the relative `/api` path so it rides the
 * Next rewrite to the backend. Throws on failure (caller should log out).
 */
let refreshPromise = null;

export function refreshAccessToken() {
  if (refreshPromise) return refreshPromise;

  const store = activeAuthStore();
  const { refreshToken } = store.getState();
  if (!refreshToken) return Promise.reject(new Error('no refresh token'));

  refreshPromise = (async () => {
    try {
      const res = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) throw new Error('refresh failed');
      const { data } = await res.json();
      store.getState().setTokens(data.accessToken, data.refreshToken);
      if (data.user) store.setState({ user: data.user });
      return data.accessToken;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}
