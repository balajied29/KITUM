'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      // Set the whole session (login / register / reset).
      setAuth: (user, accessToken, refreshToken) => set({ user, accessToken, refreshToken }),
      // Update just the tokens (called after a silent refresh).
      setTokens: (accessToken, refreshToken) => set({ accessToken, refreshToken }),
      // Update just the user (profile edit / session refresh).
      setUser: (user) => set({ user }),
      logout: () => set({ user: null, accessToken: null, refreshToken: null }),
    }),
    { name: 'auth' }
  )
);

// Admin session lives in its OWN persisted key so it never collides with a
// customer session in the same browser (which previously caused refresh-token
// reuse → forced logout on reload).
export const useAdminAuthStore = create(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      setAuth: (user, accessToken, refreshToken) => set({ user, accessToken, refreshToken }),
      setTokens: (accessToken, refreshToken) => set({ accessToken, refreshToken }),
      setUser: (user) => set({ user }),
      logout: () => set({ user: null, accessToken: null, refreshToken: null }),
    }),
    { name: 'admin-auth' }
  )
);

// The auth store in effect for the current area: admin pages use the admin
// session, everything else uses the customer session. Shared axios/refresh code
// keys off this so each area uses (and rotates) its own tokens.
export const activeAuthStore = () =>
  (typeof window !== 'undefined' && window.location.pathname.startsWith('/admin'))
    ? useAdminAuthStore
    : useAuthStore;

export const useCartStore = create(
  persist(
    (set, get) => ({
      items:   [],   // [{ product, quantity }]
      slot:    null, // full slot object (not just id)

      addItem: (product) => {
        const items    = get().items;
        const existing = items.find((i) => i.product._id === product._id);
        if (existing) {
          set({ items: items.map((i) => i.product._id === product._id ? { ...i, quantity: i.quantity + 1 } : i) });
        } else {
          set({ items: [...items, { product, quantity: 1 }] });
        }
      },

      updateQty: (productId, qty) => {
        if (qty <= 0) {
          set({ items: get().items.filter((i) => i.product._id !== productId) });
        } else {
          set({ items: get().items.map((i) => i.product._id === productId ? { ...i, quantity: qty } : i) });
        }
      },

      // Store the full slot object so checkout can display it without an extra fetch
      setSlot: (slot) => set({ slot }),

      clearCart: () => set({ items: [], slot: null }),

      totalAmount: () => get().items.reduce((sum, i) => sum + i.product.price * i.quantity, 0),
      totalItems:  () => get().items.reduce((sum, i) => sum + i.quantity, 0),
    }),
    { name: 'cart' }
  )
);

export const useLocationStore = create(
  persist(
    (set) => ({
      locality: null,
      coords: null, // { lat, lon }
      address: null, // free-form reverse geocoded string
      hasSelected: false,
      modalOpen: false,
      // Active delivery drop chosen via the map picker / saved addresses:
      // { address, landmark, lat, lng, contactName, contactPhone, label }
      drop: null,
      setLocation: ({ locality, coords, address }) =>
        set({ locality, coords: coords || null, address: address || null, hasSelected: true, modalOpen: false }),
      setDrop: (drop) => set({ drop }),
      clearDrop: () => set({ drop: null }),
      openModal: () => set({ modalOpen: true }),
      closeModal: () => set({ modalOpen: false }),
    }),
    { name: 'location' }
  )
);
