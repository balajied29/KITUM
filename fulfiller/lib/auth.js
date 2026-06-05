import { useAuth, getRefreshToken } from './store';

const BASE = process.env.EXPO_PUBLIC_API_URL || '';

/**
 * Silent access-token refresh, single-flight. Uses bare fetch (no axios
 * interceptor) to avoid recursion. Throws on failure (caller logs out).
 */
let refreshPromise = null;

export function refreshAccessToken() {
  if (refreshPromise) return refreshPromise;

  const refreshToken = getRefreshToken();
  if (!refreshToken) return Promise.reject(new Error('no refresh token'));

  refreshPromise = (async () => {
    try {
      const res = await fetch(`${BASE}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) throw new Error('refresh failed');
      const { data } = await res.json();
      useAuth.getState().setTokens(data.accessToken, data.refreshToken);
      if (data.user) useAuth.setState({ user: data.user });
      return data.accessToken;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}
