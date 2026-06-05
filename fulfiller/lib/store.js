import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

/** Persisted auth state (short-lived access token + rotating refresh token). */
export const useAuth = create(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      setAuth: (user, accessToken, refreshToken) => set({ user, accessToken, refreshToken }),
      setTokens: (accessToken, refreshToken) => set({ accessToken, refreshToken }),
      logout: () => set({ user: null, accessToken: null, refreshToken: null }),
    }),
    {
      name: 'sw-fulfiller-auth',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

/** Read tokens synchronously (for axios + socket auth). */
export const getAccessToken = () => useAuth.getState().accessToken;
export const getRefreshToken = () => useAuth.getState().refreshToken;
