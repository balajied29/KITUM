"use client";

import Link from 'next/link';
import AppHeader from '@/components/AppHeader';
import { useEffect } from 'react';
import { useLocationStore } from '@/lib/store';
import LOCALITIES from '@/constants/localities';

const FEATURES = [
  {
    label: '2-Hour Slots',
    sub: 'Precise delivery windows',
    icon: (
      <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="#0047AB" strokeWidth={1.8}>
        <circle cx="12" cy="12" r="9" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 3" />
      </svg>
    ),
  },
  {
    label: 'Cash & UPI',
    sub: 'Pay how you prefer',
    icon: (
      <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="#0047AB" strokeWidth={1.8}>
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <path strokeLinecap="round" d="M2 10h20" />
      </svg>
    ),
  },
  {
    label: 'Track Live',
    sub: 'Know when we arrive',
    icon: (
      <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="#0047AB" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

const PRODUCTS = [
  {
    href: '/order',
    name: 'Standard 20L Jar',
    desc: 'Multi-stage purified water with essential minerals.',
    price: '₹60',
    cta: 'Add to Cart',
    img: (
      <svg width="60" height="72" viewBox="0 0 60 72" fill="none">
        <ellipse cx="30" cy="64" rx="16" ry="5" fill="#dbeafe" />
        <rect x="12" y="20" width="36" height="42" rx="12" fill="#bfdbfe" />
        <rect x="14" y="22" width="32" height="38" rx="11" fill="#93c5fd" opacity="0.6" />
        <rect x="20" y="8" width="20" height="14" rx="6" fill="#60a5fa" />
        <ellipse cx="30" cy="20" rx="18" ry="4" fill="#3b82f6" opacity="0.3" />
        <path d="M24 44 Q30 52 36 44" stroke="#0047AB" strokeWidth="1.5" strokeLinecap="round" fill="none" />
        <path d="M30 32 C28 35 27 38 27 40 C27 41.7 28.3 43 30 43 C31.7 43 33 41.7 33 40 C33 38 32 35 30 32Z" fill="#0047AB" fillOpacity="0.45" />
      </svg>
    ),
  },
  {
    href: '/order/tanker',
    name: 'Tanker Supply',
    desc: '1000L–5000L capacity delivery for residential & commercial.',
    price: 'From ₹800',
    cta: 'Enquire Now',
    img: (
      <svg width="76" height="44" viewBox="0 0 76 44" fill="none">
        <rect x="2" y="10" width="50" height="24" rx="6" fill="#bfdbfe" />
        <rect x="50" y="14" width="22" height="18" rx="4" fill="#93c5fd" />
        <rect x="6" y="14" width="40" height="14" rx="3" fill="#0047AB" fillOpacity="0.12" />
        <circle cx="14" cy="36" r="6" fill="#334155" />
        <circle cx="14" cy="36" r="3.5" fill="#94a3b8" />
        <circle cx="50" cy="36" r="6" fill="#334155" />
        <circle cx="50" cy="36" r="3.5" fill="#94a3b8" />
        <circle cx="64" cy="36" r="6" fill="#334155" />
        <circle cx="64" cy="36" r="3.5" fill="#94a3b8" />
        <path d="M52 18 L70 18" stroke="#0047AB" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
];

export default function HomePage() {
  const { hasSelected, openModal } = useLocationStore();

  useEffect(() => {
    if (!hasSelected) openModal();
  }, [hasSelected, openModal]);

  return (
    <main className="pb-24 max-w-lg mx-auto">
      <AppHeader showLocality={true} />

      {/* Hero */}
      <section className="mx-4 mt-2 rounded-card overflow-hidden relative"
        style={{ background: 'linear-gradient(135deg, #0047AB 0%, #0066cc 60%, #0284c7 100%)' }}>
        {/* Water splash blobs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -right-8 -top-8 w-48 h-48 rounded-full opacity-10 bg-white" />
          <div className="absolute right-4 bottom-0 w-32 h-32 rounded-full opacity-10 bg-white" />
          <div className="absolute -left-4 bottom-4 w-24 h-24 rounded-full opacity-5 bg-white" />
        </div>
        <div className="relative px-5 pt-6 pb-6 flex items-center gap-4">
          <div className="flex-1">
            <p className="text-[10px] font-medium uppercase tracking-widest text-blue-200 mb-2">
              Clean · Reliable · On-time
            </p>
            <h1 className="text-[22px] font-700 leading-tight text-white mb-3">
              Water delivered<br />to your door,<br />on your schedule.
            </h1>
            <p className="text-xs text-blue-100 mb-5 leading-relaxed">
              Experience the most reliable water supply service in Shillong. Quality tested, timely delivered.
            </p>
            <Link
              href="/order"
              className="inline-block bg-white text-primary text-sm font-700 px-5 py-2.5 rounded-btn shadow-sm hover:bg-blue-50 transition-colors"
            >
              Order Now
            </Link>
          </div>
          {/* Jug illustration */}
          <div className="flex-shrink-0 opacity-90 pr-1">
            <svg width="72" height="90" viewBox="0 0 72 90" fill="none">
              <ellipse cx="36" cy="80" rx="22" ry="7" fill="white" fillOpacity="0.1" />
              <rect x="18" y="26" width="36" height="50" rx="12" fill="white" fillOpacity="0.2" />
              <rect x="20" y="28" width="32" height="46" rx="11" fill="white" fillOpacity="0.15" />
              <rect x="26" y="10" width="20" height="18" rx="7" fill="white" fillOpacity="0.3" />
              <ellipse cx="36" cy="26" rx="18" ry="4" fill="white" fillOpacity="0.2" />
              <path d="M28 56 Q36 64 44 56" stroke="white" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.5" />
              <path d="M36 40 C33.5 44 32 48 32 51 C32 53.2 33.8 55 36 55 C38.2 55 40 53.2 40 51 C40 48 38.5 44 36 40Z" fill="white" fillOpacity="0.5" />
            </svg>
          </div>
        </div>
      </section>

      {/* Feature row */}
      <section className="px-4 mt-4 flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
        {FEATURES.map((f) => (
          <div key={f.label} className="flex-shrink-0 bg-white border border-border-default rounded-card p-4 flex flex-col gap-2 min-w-[120px] shadow-sm">
            <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center">
              {f.icon}
            </div>
            <p className="text-xs font-700 text-text-main leading-tight">{f.label}</p>
            <p className="text-[11px] text-text-muted leading-tight">{f.sub}</p>
          </div>
        ))}
      </section>

      {/* Our Services */}
      <section className="px-4 mt-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-700 text-text-main">Our Services</h2>
          <Link href="/order" className="text-xs text-primary font-medium">View All</Link>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {PRODUCTS.map((p) => (
            <Link key={p.name} href={p.href}
              className="bg-white border border-border-default rounded-card p-4 flex flex-col shadow-sm hover:shadow-md transition-shadow">
              <div className="h-24 bg-bg-card rounded-xl mb-3 flex items-center justify-center">
                {p.img}
              </div>
              <p className="text-xs font-700 text-text-main leading-snug">{p.name}</p>
              <p className="text-[11px] text-text-muted mt-1 mb-2 leading-snug">{p.desc}</p>
              <p className="text-xs font-700 text-primary mb-3">{p.price}</p>
              <div className="mt-auto border border-primary rounded-btn px-3 py-1.5 text-center text-xs font-700 text-primary">
                {p.cta}
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Serving Your Locality */}
      <section className="px-4 mt-6 mb-4">
        <h2 className="text-sm font-700 text-text-main mb-3">Serving Your Locality</h2>
        <div className="grid grid-cols-2 gap-2">
          {LOCALITIES.slice(0, 6).map((loc) => (
            <div key={loc}
              className="bg-bg-card border border-border-default rounded-card px-3 py-2.5 text-xs text-text-muted font-medium text-center">
              {loc}
            </div>
          ))}
          <div className="bg-bg-card border border-border-default rounded-card px-3 py-2.5 text-xs text-primary font-700 text-center col-span-2">
            More soon…
          </div>
        </div>
      </section>
    </main>
  );
}
