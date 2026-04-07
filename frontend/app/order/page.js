'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getProducts } from '@/lib/api';
import { useCartStore, useAuthStore } from '@/lib/store';
import ProductCard from '@/components/ProductCard';
import SlotPicker from '@/components/SlotPicker';
import StepIndicator from '@/components/StepIndicator';

export default function OrderPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { slotId, totalAmount, totalItems } = useCartStore();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getProducts()
      .then((res) => setProducts(res.data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const cartTotal = totalAmount();
  const cartCount = totalItems();

  const handleNext = () => {
    if (!user) return router.push('/login');
    if (cartCount === 0) return;
    if (!slotId) return;
    router.push('/checkout');
  };

  return (
    <main className="px-4 pt-5 pb-4">
      <StepIndicator step={cartCount > 0 ? 2 : 1} />

      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => router.back()} className="text-text-muted hover:text-text-main transition-colors">
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-base font-700 text-text-main">Select Water Type</h1>
      </div>

      {/* Product grid */}
      <section className="mb-6">
        {loading ? (
          <div className="grid grid-cols-2 gap-3">
            {[1,2,3,4].map((i) => <div key={i} className="card h-40 animate-pulse bg-bg-card" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {products.map((p) => <ProductCard key={p._id} product={p} />)}
          </div>
        )}
      </section>

      {/* Tanker banner */}
      <section className="mb-6">
        <Link href="/order/tanker" className="card flex items-center justify-between hover:shadow-sm transition-shadow">
          <div>
            <p className="text-xs font-700 text-text-main">Tanker Supply</p>
            <p className="text-xs text-text-muted mt-0.5">1000L – 5000L · From ₹800</p>
          </div>
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#64748b" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </section>

      {/* Slot picker */}
      <section className="mb-24">
        <h2 className="text-sm font-700 text-text-main mb-3">When should we arrive?</h2>
        <SlotPicker />
      </section>

      {/* Sticky cart bar */}
      {cartCount > 0 && (
        <div className="fixed bottom-14 left-0 right-0 max-w-lg mx-auto px-4 pb-3">
          <button
            onClick={handleNext}
            disabled={!slotId}
            className="btn-primary w-full flex items-center justify-between px-4 py-3 text-sm disabled:opacity-50"
          >
            <span className="bg-white/20 text-white text-xs font-medium px-2 py-0.5 rounded">
              {cartCount} item{cartCount > 1 ? 's' : ''}
            </span>
            <span>Next: Pick Slot →</span>
            <span className="font-700">₹{cartTotal}</span>
          </button>
        </div>
      )}
    </main>
  );
}
