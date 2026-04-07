'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getProducts } from '@/lib/api';
import { useCartStore } from '@/lib/store';
import StepIndicator from '@/components/StepIndicator';

const TIER_LABELS = {
  default:  'STANDARD',
  first:    'RESIDENTIAL STANDARD',
  second:   'HIGH CAPACITY',
};

function getTierLabel(index) {
  if (index === 0) return TIER_LABELS.first;
  if (index === 1) return TIER_LABELS.second;
  return TIER_LABELS.default;
}

export default function TankerPage() {
  const router = useRouter();
  const { items, addItem, updateQty, totalAmount } = useCartStore();
  const [tankers, setTankers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [customVol, setCustomVol] = useState('');
  const [quoteSent, setQuoteSent] = useState(false);

  useEffect(() => {
    getProducts()
      .then((res) => {
        const all = res.data.data;
        setTankers(all.filter((p) => p.name.toLowerCase().includes('tanker')));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const getQty = (id) => items.find((i) => i.product._id === id)?.quantity ?? 0;

  const cartTotal = totalAmount();
  const hasItems = items.length > 0;

  const handleQuote = (e) => {
    e.preventDefault();
    if (!customVol) return;
    setQuoteSent(true);
  };

  return (
    <main className="px-4 pt-5 pb-28">
      <StepIndicator step={1} />

      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => router.back()} className="text-text-muted hover:text-text-main transition-colors">
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h1 className="text-base font-700 text-text-main">Select Tanker Size</h1>
          <p className="text-xs text-text-muted mt-0.5">Choose from our standard sizes or request a customised quote.</p>
        </div>
      </div>

      {/* Tanker size cards */}
      {loading ? (
        <div className="flex flex-col gap-3">
          {[1, 2].map((i) => <div key={i} className="card h-28 animate-pulse bg-bg-card" />)}
        </div>
      ) : tankers.length === 0 ? (
        <p className="text-sm text-text-muted py-8 text-center">No tanker products available right now.</p>
      ) : (
        <div className="flex flex-col gap-3 mb-6">
          {tankers.map((product, i) => {
            const qty = getQty(product._id);
            return (
              <div key={product._id} className="card">
                <p className="text-[10px] font-700 text-text-muted uppercase tracking-widest mb-1">
                  {getTierLabel(i)}
                </p>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <p className="text-sm font-700 text-text-main">{product.name}</p>
                    <p className="text-xs text-text-muted mt-0.5 leading-relaxed">
                      {product.description ?? `${product.unit} — ideal for households and commercial use.`}
                    </p>
                  </div>
                  <p className="text-base font-700 text-primary whitespace-nowrap">₹{product.price}</p>
                </div>

                <div className="mt-3 flex items-center justify-between">
                  {qty === 0 ? (
                    <button onClick={() => addItem(product)} className="btn-primary text-sm px-5">
                      Select
                    </button>
                  ) : (
                    <div className="flex items-center border border-border-default rounded-btn overflow-hidden">
                      <button
                        onClick={() => updateQty(product._id, qty - 1)}
                        className="w-9 h-9 flex items-center justify-center text-primary font-medium hover:bg-blue-50 transition-colors"
                      >
                        −
                      </button>
                      <span className="w-8 text-center text-sm font-medium text-text-main">{qty}</span>
                      <button
                        onClick={() => addItem(product)}
                        className="w-9 h-9 flex items-center justify-center text-primary font-medium hover:bg-blue-50 transition-colors"
                      >
                        +
                      </button>
                    </div>
                  )}
                  {qty > 0 && (
                    <p className="text-xs text-text-muted">₹{product.price * qty} total</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Custom volume request */}
      <div className="card border-dashed">
        <p className="text-xs font-700 text-text-main uppercase tracking-wide mb-1">Request Custom Volume</p>
        {quoteSent ? (
          <p className="text-xs text-emerald-600 font-medium py-2">
            Request received. Our logistics team will contact you within 60 minutes.
          </p>
        ) : (
          <>
            <p className="text-xs text-text-muted mb-3">
              Our logistics team will contact you within 60 minutes with a specialised quote for custom high-volume requests.
            </p>
            <form onSubmit={handleQuote} className="flex gap-2 items-end">
              <div className="flex-1">
                <label className="block text-xs font-medium text-text-main mb-1">Enter Volume</label>
                <div className="relative">
                  <input
                    type="number"
                    min={100}
                    placeholder="e.g. 5000"
                    className="input pr-14"
                    value={customVol}
                    onChange={(e) => setCustomVol(e.target.value)}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-muted font-medium">
                    LITRES
                  </span>
                </div>
              </div>
              <button type="submit" className="btn-primary text-sm whitespace-nowrap">
                Request Quote
              </button>
            </form>
          </>
        )}
      </div>

      {/* Sticky footer */}
      {hasItems && (
        <div className="fixed bottom-14 left-0 right-0 max-w-lg mx-auto px-4 pb-3">
          <button
            onClick={() => router.push('/order')}
            className="btn-primary w-full flex items-center justify-between px-4 py-3 text-sm"
          >
            <span className="font-700">₹{cartTotal}</span>
            <span>Next: Pick Slot →</span>
            <span className="opacity-0 w-12" />
          </button>
        </div>
      )}
    </main>
  );
}
