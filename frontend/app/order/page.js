'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getProducts } from '@/lib/api';
import { useCartStore, useAuthStore } from '@/lib/store';
import { isTankerProduct } from '@/lib/productImage';
import ProductCard from '@/components/ProductCard';
import SlotPicker from '@/components/SlotPicker';
import StepIndicator from '@/components/StepIndicator';
import AppHeader from '@/components/AppHeader';

const litresOf = (p) => Number(p?.tankerLitres) || 0;

const Arrow = ({ className = 'w-4 h-4' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

export default function OrderPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { slot, totalAmount, totalItems } = useCartStore();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const slotRef = useRef(null);

  useEffect(() => {
    getProducts()
      .then((res) => setProducts(res.data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const cartTotal = totalAmount();
  const cartCount = totalItems();
  const hasSlot = !!slot?._id;

  // Categorise with the SAME rule productImage() uses, so a SKU's section and its
  // photo can never disagree (e.g. a "Tanker" with tankerLitres=0).
  const tankers = products.filter(isTankerProduct).sort((a, b) => litresOf(a) - litresOf(b));
  const bottled = products.filter((p) => !isTankerProduct(p));

  const handleNext = () => {
    // No login gate — checkout creates the account from the contact details.
    if (cartCount === 0) return;
    if (!hasSlot) {
      // Items chosen but no slot yet — guide the eye to the picker instead of a dead button.
      slotRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    router.push('/checkout');
  };

  return (
    <main className="bg-bg-page min-h-dvh pb-28">
      <AppHeader showLocality={true} />

      {/* Intro */}
      <section className="px-4 pt-1 pb-3">
        <h1 className="font-display font-extrabold text-[24px] tracking-[-0.5px] text-text-main leading-tight">
          Order for later
        </h1>
        <p className="text-[13px] text-text-muted mt-1">
          Pick your water and reserve a 2-hour slot — we deliver right on time.
        </p>
      </section>

      <StepIndicator step={hasSlot ? 3 : cartCount > 0 ? 2 : 1} />

      <div className="px-4">
        {loading ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-card border border-border-default bg-white p-3">
                <div className="aspect-[5/4] rounded-xl bg-bg-card animate-pulse mb-2.5" />
                <div className="h-3.5 w-3/4 rounded bg-bg-card animate-pulse" />
                <div className="mt-3 flex items-center justify-between">
                  <div className="h-4 w-10 rounded bg-bg-card animate-pulse" />
                  <div className="h-9 w-14 rounded-btn bg-bg-card animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            {tankers.length > 0 && (
              <section className="mb-6">
                <div className="flex items-baseline justify-between mb-3">
                  <h2 className="text-[15px] font-700 text-text-main">Tankers</h2>
                  <span className="text-xs text-text-muted">500L – 2000L</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {tankers.map((p) => <ProductCard key={p._id} product={p} />)}
                </div>
              </section>
            )}

            {bottled.length > 0 && (
              <section className="mb-6">
                <div className="flex items-baseline justify-between mb-3">
                  <h2 className="text-[15px] font-700 text-text-main">Bottles &amp; Jars</h2>
                  <span className="text-xs text-text-muted">Jars · bottles · crates</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {bottled.map((p) => <ProductCard key={p._id} product={p} />)}
                </div>
              </section>
            )}
          </>
        )}

        {/* Slot */}
        <section ref={slotRef} className="scroll-mt-4 mb-2">
          <h2 className="text-[15px] font-700 text-text-main mb-3">When should we arrive?</h2>
          <SlotPicker />
        </section>
      </div>

      {/* Sticky footer CTA */}
      <div className="cta-dock">
        <button
          onClick={handleNext}
          disabled={cartCount === 0}
          className="btn-primary w-full flex items-center justify-between gap-3 px-5 py-3.5 disabled:opacity-60"
        >
          {cartCount === 0 ? (
            <span className="mx-auto text-sm font-700">Add water to get started</span>
          ) : (
            <>
              <span className="flex flex-col items-start leading-tight">
                <span className="text-[10px] font-medium uppercase tracking-wide opacity-75">
                  {cartCount} item{cartCount > 1 ? 's' : ''} · Total
                </span>
                <span className="text-base font-700">₹{cartTotal}</span>
              </span>
              <span className="inline-flex items-center gap-1.5 text-sm font-700">
                {hasSlot ? 'Review & checkout' : 'Pick a slot'}
                <Arrow className="w-4 h-4" />
              </span>
            </>
          )}
        </button>
      </div>
    </main>
  );
}
