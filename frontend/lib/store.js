'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      token: null,
      setAuth: (user, token) => {
        localStorage.setItem('token', token);
        set({ user, token });
      },
      logout: () => {
        localStorage.removeItem('token');
        set({ user: null, token: null });
      },
    }),
    { name: 'auth' }
  )
);

export const useCartStore = create(
  persist(
    (set, get) => ({
      items: [],        // [{ product, quantity }]
      slotId: null,
      deliveryAddress: { street: '', landmark: '', locality: '' },

      addItem: (product) => {
        const items = get().items;
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

      setSlot: (slotId) => set({ slotId }),

      setAddress: (deliveryAddress) => set({ deliveryAddress }),

      clearCart: () => set({ items: [], slotId: null, deliveryAddress: { street: '', landmark: '', locality: '' } }),

      totalAmount: () => get().items.reduce((sum, i) => sum + i.product.price * i.quantity, 0),

      totalItems: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
    }),
    { name: 'cart' }
  )
);
