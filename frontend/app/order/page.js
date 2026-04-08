'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getProducts } from '@/lib/api';
import { useCartStore, useAuthStore } from '@/lib/store';
import ProductCard from '@/components/ProductCard';
import SlotPicker from '@/components/SlotPicker';
import StepIndicator from '@/components/StepIndicator';
import AppHeader from '@/components/AppHeader';

export default function OrderPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { slot, totalAmount, totalItems } = useCartStore();
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
    if (cartCount === 0 || !slot?._id) return;
    router.push('/checkout');
  };

  return (
    <main className="pb-32">
      <AppHeader showLocality={false} />
      <StepIndicator step={cartCount > 0 ? 2 : 1} />

      {/* Title */}
      <div className="px-4 mb-4">
        <h1 className="text-base font-700 text-text-main">Select Water Type</h1>
        <p className="text-xs text-text-muted mt-0.5">High quality water delivered to your doorstep.</p>
      </div>

      {/* Product grid */}
      <section className="px-4 mb-4">
        {loading ? (
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => <div key={i} className="card h-48 animate-pulse bg-bg-card" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {products.map((p) => <ProductCard key={p._id} product={p} />)}
          </div>
        )}
      </section>

      {/* Commitment banner */}
      <section className="px-4 mb-4">
        <div className="card border-primary/20 bg-blue-50/50">
          <p className="text-[10px] font-700 text-primary uppercase tracking-widest mb-1">Our Commitment</p>
          <p className="text-[11px] text-text-muted leading-relaxed">
            KIT UM drivers will contact you 10 minutes prior to arrival. Please ensure someone is available to receive the delivery. Unattended deliveries will be rescheduled for the next available slot.
          </p>
        </div>
      </section>

      {/* Tanker banner */}
      <section className="px-4 mb-4">
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
      <section className="px-4 mb-4">
        <h2 className="text-sm font-700 text-text-main mb-3">When should we arrive?</h2>
        <SlotPicker />
      </section>

      {/* Sticky footer */}
      <div className="fixed bottom-14 left-0 right-0 max-w-lg mx-auto px-4 pb-3">
        <button
          onClick={handleNext}
          disabled={cartCount === 0 || !slot?._id}
          className="btn-primary w-full flex items-center justify-between px-5 py-3 disabled:opacity-50"
        >
          <div className="text-left">
            <p className="text-[10px] font-medium opacity-75 uppercase tracking-wide">Total Amount</p>
            <p className="text-base font-700 leading-tight">₹{cartTotal}</p>
          </div>
          <span className="text-sm font-medium">
            {slot?._id ? 'Next: Checkout →' : 'Next: Pick Slot →'}
          </span>
        </button>
      </div>
    </main>
  );
}
