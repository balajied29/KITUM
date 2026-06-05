'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import AppHeader from '@/components/AppHeader';
import Footer from '@/components/Footer';
import { useLocationStore } from '@/lib/store';
import { getProducts } from '@/lib/api';
import { TankerIcon, BoltIcon } from '@/components/icons';
import { tankerImage } from '@/lib/tankerImage';

const litresOf = (p) => {
  if (p.tankerLitres) return p.tankerLitres;
  const m = String(p.unit || '').match(/(\d[\d,]*)/);
  return m ? Number(m[1].replace(/,/g, '')) : 0;
};

const Arrow = ({ className = 'w-4 h-4' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);
const TRUST = [
  {
    label: 'Live\ntracking',
    icon: (
      <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#0037b0" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
        <circle cx="12" cy="11" r="3" />
      </svg>
    ),
  },
  {
    label: 'UPI &\ncash',
    icon: (
      <svg width="22" height="20" fill="none" viewBox="0 0 24 24" stroke="#0037b0" strokeWidth={1.8}>
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <path strokeLinecap="round" d="M2 10h20" />
      </svg>
    ),
  },
  {
    label: 'On-time\nslots',
    icon: (
      <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#0037b0" strokeWidth={1.8}>
        <circle cx="12" cy="12" r="9" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 3" />
      </svg>
    ),
  },
];

export default function HomePage() {
  const { hasSelected, openModal } = useLocationStore();
  const [tankers, setTankers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!hasSelected) openModal();
  }, [hasSelected, openModal]);

  useEffect(() => {
    getProducts()
      .then((res) => {
        const list = res.data.data
          .filter((p) => /tanker/i.test(p.name))
          .sort((a, b) => litresOf(a) - litresOf(b));
        setTankers(list);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="bg-bg-page min-h-dvh">
      <AppHeader showLocality={true} />

      {/* Hero — the primary funnel: order a tanker now */}
      <section className="px-4 pt-1">
        <Link
          href="/order/instant"
          className="relative block overflow-hidden rounded-[20px] bg-primary text-white p-6 active:scale-[0.99] transition-transform"
        >
          <TankerIcon className="absolute -right-5 -bottom-4 w-40 h-40 text-white/10" />
          <span className="inline-flex items-center gap-1.5 text-[11px] font-700 uppercase tracking-wide bg-white/15 rounded-full px-2.5 py-1">
            <BoltIcon className="w-3.5 h-3.5" /> Instant delivery
          </span>
          <h1 className="font-display font-extrabold text-[28px] leading-[1.12] tracking-[-0.5px] mt-3">
            Water at your<br />door, now.
          </h1>
          <p className="text-[13px] text-white/80 mt-2 mb-5 max-w-[78%]">
            Nearest tanker, live-tracked to you. Pay by UPI or cash.
          </p>
          <span className="inline-flex items-center gap-2 bg-white text-primary font-700 text-[15px] rounded-btn px-5 py-3 shadow-sm">
            Order a tanker now <Arrow />
          </span>
        </Link>
      </section>

      {/* Tanker sizes — one tap to start booking a specific size */}
      <section className="px-4 mt-6">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-[15px] font-700 text-text-main">Pick a tanker size</h2>
          <Link href="/order/instant" className="text-xs font-medium text-primary">See all</Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => <div key={i} className="h-[124px] rounded-card bg-bg-card animate-pulse" />)}
          </div>
        ) : tankers.length === 0 ? (
          <Link href="/order/instant" className="card block text-center text-sm text-text-muted py-6">
            View available tankers →
          </Link>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {tankers.map((p) => {
              const litres = litresOf(p);
              const img = tankerImage(litres);
              return (
                <Link
                  key={p._id}
                  href={`/order/instant?product=${p._id}`}
                  className="card flex flex-col items-center text-center gap-2 px-2 py-4 active:scale-[0.97] transition-transform"
                >
                  <span className="w-14 h-14 rounded-full overflow-hidden bg-bg-trust text-primary flex items-center justify-center">
                    {img ? (
                      <img src={img} alt={`${litres}L tanker`} className="w-full h-full object-cover" />
                    ) : (
                      <TankerIcon className="w-7 h-7" />
                    )}
                  </span>
                  <span className="text-sm font-700 text-text-main leading-none">
                    {litres ? `${litres.toLocaleString('en-IN')} L` : p.name}
                  </span>
                  <span className="text-xs font-700 text-primary">₹{p.price}</span>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* Secondary path — schedule for later (prominent) */}
      <section className="px-4 mt-6">
        <Link href="/order" className="block rounded-[20px] border border-primary/25 bg-bg-trust p-5 active:scale-[0.99] transition-transform">
          <div className="flex items-center gap-4">
            <span className="w-12 h-12 rounded-2xl bg-white text-primary flex items-center justify-center shrink-0 shadow-sm">
              <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <circle cx="12" cy="12" r="9" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 3" />
              </svg>
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[16px] font-700 text-text-main">Order for later</p>
              <p className="text-[13px] text-text-muted mt-0.5">Reserve a 2-hour slot — tankers, jars &amp; bottles, delivered on schedule.</p>
            </div>
          </div>
          <span className="mt-4 inline-flex items-center justify-center gap-2 w-full bg-primary text-white font-700 text-sm rounded-btn px-4 py-3">
            Schedule a delivery <Arrow />
          </span>
        </Link>
      </section>

      {/* Trust row */}
      <section className="px-4 mt-6">
        <div className="card flex items-center justify-around py-4">
          {TRUST.map((t) => (
            <div key={t.label} className="flex flex-col items-center gap-1.5 text-center">
              <div className="w-10 h-10 rounded-full bg-bg-trust flex items-center justify-center">{t.icon}</div>
              <span className="text-[11px] font-medium text-text-muted leading-tight whitespace-pre-line">{t.label}</span>
            </div>
          ))}
        </div>
      </section>

      <p className="text-center text-xs text-text-muted mt-5">Serving 50+ areas across Shillong</p>

      <Footer />
    </main>
  );
}
