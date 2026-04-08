"use client";

import Link from 'next/link';
import AppHeader from '@/components/AppHeader';
import { useEffect } from 'react';
import { useLocationStore } from '@/lib/store';

import LOCALITIES from '@/constants/localities';

const SERVICES = [
  {
    title: '2-Hour Slots',
    desc: 'Precise delivery windows',
    icon: (
      <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#1d4ed8" strokeWidth={1.8}>
        <circle cx="12" cy="12" r="9" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 3" />
      </svg>
    ),
  },
  {
    title: 'Cash & UPI',
    desc: 'Pay how you prefer',
    icon: (
      <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#1d4ed8" strokeWidth={1.8}>
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <path strokeLinecap="round" d="M2 10h20" />
      </svg>
    ),
  },
  {
    title: 'Track Live',
    desc: 'Know when we arrive',
    icon: (
      <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#1d4ed8" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

export default function HomePage() {
  const { hasSelected, openModal } = useLocationStore();

  useEffect(() => {
    // Ask for location on first visit
    if (!hasSelected) openModal();
  }, [hasSelected, openModal]);

  return (
    <main>
      <AppHeader showLocality={true} />

      {/* Hero */}
      <section className="mx-4 mt-2 bg-primary text-white rounded-card px-5 pt-6 pb-6 flex items-center gap-3 overflow-hidden">
        <div className="flex-1">
          <p className="text-[10px] font-medium uppercase tracking-widest opacity-70 mb-2">
            Clean · Reliable · On-time
          </p>
          <h1 className="text-xl font-700 leading-snug mb-2">
            Water delivered<br />to your door,<br />on your schedule.
          </h1>
          <p className="text-xs opacity-75 mb-4 leading-relaxed">
            Experience the most reliable water supply service in Shillong. Quality tested, timely delivered.
          </p>
          <Link href="/order" className="inline-block bg-white text-primary text-xs font-700 px-4 py-2 rounded-btn transition-colors hover:bg-blue-50">
            Order Now
          </Link>
        </div>
        {/* Water jug illustration */}
        <div className="flex-shrink-0 w-20 flex items-center justify-center opacity-90">
          <svg width="72" height="88" viewBox="0 0 72 88" fill="none">
            <ellipse cx="36" cy="78" rx="22" ry="8" fill="white" fillOpacity="0.15" />
            <rect x="20" y="28" width="32" height="46" rx="10" fill="white" fillOpacity="0.25" />
            <rect x="22" y="30" width="28" height="42" rx="9" fill="white" fillOpacity="0.2" />
            <path d="M30 14 C26 22 22 28 22 34" stroke="white" strokeWidth="2" strokeLinecap="round" fillOpacity="0.5" />
            <ellipse cx="36" cy="28" rx="14" ry="4" fill="white" fillOpacity="0.3" />
            <rect x="28" y="10" width="16" height="8" rx="4" fill="white" fillOpacity="0.4" />
            <path d="M30 52 Q36 58 42 52" stroke="white" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.5" />
            <circle cx="36" cy="44" r="6" fill="white" fillOpacity="0.15" />
            <path d="M36 40 C34 42 33 44 33 46 C33 47.7 34.3 49 36 49 C37.7 49 39 47.7 39 46 C39 44 38 42 36 40Z" fill="white" fillOpacity="0.5" />
          </svg>
        </div>
      </section>

      {/* Service pills */}
      <section className="px-4 mt-4 flex gap-3 overflow-x-auto pb-1 scrollbar-none">
        {SERVICES.map((s) => (
          <div key={s.title} className="flex-shrink-0 card flex flex-col items-start gap-1.5 min-w-[110px]">
            {s.icon}
            <p className="text-xs font-700 text-text-main">{s.title}</p>
            <p className="text-[11px] text-text-muted">{s.desc}</p>
          </div>
        ))}
      </section>

      {/* Our Services */}
      <section className="px-4 mt-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-700 text-text-main">Our Services</h2>
          <Link href="/order" className="text-xs text-primary font-medium hover:underline">View All</Link>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Link href="/order" className="card hover:shadow-sm transition-shadow block">
            <div className="h-24 bg-bg-card rounded mb-3 flex items-center justify-center">
              <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
                <ellipse cx="28" cy="48" rx="14" ry="5" fill="#e2e8f0" />
                <rect x="14" y="16" width="28" height="32" rx="8" fill="#dbeafe" />
                <rect x="16" y="18" width="24" height="28" rx="7" fill="#bfdbfe" />
                <rect x="20" y="8" width="16" height="10" rx="4" fill="#93c5fd" />
                <path d="M24 32 C28 38 32 32" stroke="#1d4ed8" strokeWidth="1.5" strokeLinecap="round" fill="none" />
                <circle cx="28" cy="28" r="5" fill="#dbeafe" />
                <path d="M28 24 C26.5 26 26 28 26 29.5 C26 30.9 26.9 32 28 32 C29.1 32 30 30.9 30 29.5 C30 28 29.5 26 28 24Z" fill="#1d4ed8" fillOpacity="0.6" />
              </svg>
            </div>
            <p className="text-xs font-700 text-text-main">Standard 20L Jar</p>
            <p className="text-[11px] text-text-muted mt-0.5 mb-2">Multi-stage purified water with essential minerals.</p>
            <p className="text-xs font-700 text-primary mb-3">₹40</p>
            <div className="border border-primary rounded-btn px-3 py-1.5 text-center text-xs font-medium text-primary">
              Add to Cart
            </div>
          </Link>

          <Link href="/order/tanker" className="card hover:shadow-sm transition-shadow block">
            <div className="h-24 bg-bg-card rounded mb-3 flex items-center justify-center">
              <svg width="64" height="40" viewBox="0 0 64 40" fill="none">
                <rect x="2" y="12" width="44" height="20" rx="4" fill="#bfdbfe" />
                <rect x="44" y="16" width="16" height="14" rx="3" fill="#93c5fd" />
                <circle cx="12" cy="34" r="5" fill="#64748b" />
                <circle cx="12" cy="34" r="3" fill="#94a3b8" />
                <circle cx="44" cy="34" r="5" fill="#64748b" />
                <circle cx="44" cy="34" r="3" fill="#94a3b8" />
                <rect x="6" y="16" width="32" height="12" rx="2" fill="#1d4ed8" fillOpacity="0.15" />
                <path d="M46 20 L58 20" stroke="#1d4ed8" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <p className="text-xs font-700 text-text-main">Tanker Supply</p>
            <p className="text-[11px] text-text-muted mt-0.5 mb-2">1000L–5000L high-capacity delivery for residential areas.</p>
            <p className="text-xs font-700 text-primary mb-3">From ₹800</p>
            <div className="border border-primary rounded-btn px-3 py-1.5 text-center text-xs font-medium text-primary">
              Enquire Now
            </div>
          </Link>
        </div>
      </section>

      {/* Localities */}
      <section className="px-4 mt-5 mb-6">
        <h2 className="text-sm font-700 text-text-main mb-3">Serving Your Locality</h2>
        <div className="flex flex-wrap gap-2">
          {LOCALITIES.map((loc) => (
            <span key={loc} className="text-xs border border-border-default rounded-full px-3 py-1 text-text-muted">
              {loc}
            </span>
          ))}
          <span className="text-xs border border-border-default rounded-full px-3 py-1 text-primary font-medium cursor-pointer">
            More soon…
          </span>
        </div>
      </section>
    </main>
  );
}
