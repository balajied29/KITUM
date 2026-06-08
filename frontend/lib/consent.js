'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Cookie / tracking consent (opt-in, DPDP-friendly).
 *
 *  - `necessary`  is always on. It covers the app's own cookies (sign-in, cart,
 *    security) and has no toggle.
 *  - `analytics`  gates ALL third-party measurement (Microsoft Clarity, Google
 *    Analytics, ...). Off until the visitor explicitly allows it.
 *  - `decided`    flips true the moment the visitor makes ANY choice, which is
 *    what hides the banner. Until then we load nothing but essentials.
 *
 * Only `decided` + `categories` are persisted; `settingsOpen` is transient UI.
 */
export const useConsentStore = create(
  persist(
    (set) => ({
      decided: false,
      categories: { necessary: true, analytics: false },
      settingsOpen: false,

      acceptAll: () =>
        set({ decided: true, settingsOpen: false, categories: { necessary: true, analytics: true } }),
      rejectAll: () =>
        set({ decided: true, settingsOpen: false, categories: { necessary: true, analytics: false } }),
      // Persist a custom selection from the settings panel.
      savePreferences: (cats) =>
        set({ decided: true, settingsOpen: false, categories: { necessary: true, analytics: !!cats.analytics } }),

      openSettings: () => set({ settingsOpen: true }),
      closeSettings: () => set({ settingsOpen: false }),
    }),
    {
      name: 'kitum-consent',
      version: 1,
      partialize: (s) => ({ decided: s.decided, categories: s.categories }),
    }
  )
);

// Non-React read for the analytics loader.
export const analyticsAllowed = () => useConsentStore.getState().categories.analytics;
