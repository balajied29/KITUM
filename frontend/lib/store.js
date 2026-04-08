'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useAuthStore = create(
  persist(
    (set) => ({
      user:  null,
      token: null,
      setAuth: (user, token) => set({ user, token }),
      logout: () => set({ user: null, token: null }),
    }),
    { name: 'auth' }
  )
);

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
      setLocation: ({ locality, coords, address }) =>
        set({ locality, coords: coords || null, address: address || null, hasSelected: true, modalOpen: false }),
      openModal: () => set({ modalOpen: true }),
      closeModal: () => set({ modalOpen: false }),
    }),
    { name: 'location' }
  )
);
