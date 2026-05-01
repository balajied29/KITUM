"use client";

import Link from 'next/link';
import Image from 'next/image';
import AppHeader from '@/components/AppHeader';
import { useEffect } from 'react';
import { useLocationStore } from '@/lib/store';

const TRUST_BADGES = [
  {
    label: '2-Hour\nSlots',
    icon: (
      <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="#0037b0" strokeWidth={1.8}>
        <circle cx="12" cy="12" r="9" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 3" />
      </svg>
    ),
  },
  {
    label: 'Cash &\nUPI',
    icon: (
      <svg width="26" height="20" fill="none" viewBox="0 0 24 24" stroke="#0037b0" strokeWidth={1.8}>
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <path strokeLinecap="round" d="M2 10h20" />
      </svg>
    ),
  },
  {
    label: 'Track\nLive',
    icon: (
      <svg width="26" height="26" fill="none" viewBox="0 0 24 24" stroke="#0037b0" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

const SERVICES = [
  {
    href: '/order',
    name: 'Standard 20L Jar',
    price: '₹60',
    desc: 'Multi-stage purified water with essential minerals.',
    cta: 'Add to Cart',
    img: '/product-jar.jpg',
  },
  {
    href: '/order/tanker',
    name: 'Tanker Supply',
    price: 'From ₹800',
    desc: '2000L – 5000L high-capacity delivery for residential tanks.',
    cta: 'Enquire Now',
    img: '/product-tanker.jpg',
  },
];

const SHOWN_LOCALITIES = [
  'Laitumkhrah', 'Police Bazaar',
  'Lachumiere',  'Mawpat',
  'Nongthymmai', 'Rynjah',
  'Bara Bazaar',
];

export default function HomePage() {
  const { hasSelected, openModal } = useLocationStore();

  useEffect(() => {
    if (!hasSelected) openModal();
  }, [hasSelected, openModal]);

  return (
    <main className="bg-bg-page pb-28 max-w-[390px] mx-auto min-h-dvh">
      <AppHeader showLocality={true} />

      {/* Hero */}
      <section className="mx-4 mt-2 rounded-[8px] overflow-hidden relative bg-[#1d4ed8]">
        <div className="absolute inset-0 opacity-20">
          <Image src="/hero-bg.jpg" alt="" fill className="object-cover" />
        </div>
        <div className="relative px-8 py-8">
          <h1 className="font-display font-extrabold text-[36px] leading-[1.25] tracking-[-0.9px] text-white mb-4">
            Water delivered<br />to your door, on<br />your schedule.
          </h1>
          <p className="text-[18px] font-medium text-[#cad3ff] leading-[1.55] mb-8">
            Experience the most reliable water supply service in Shillong. Quality tested, timely delivered.
          </p>
          <Link
            href="/order"
            className="inline-block bg-white text-primary text-[18px] font-semibold px-8 py-4 rounded-[6px]"
          >
            Order Now
          </Link>
        </div>
      </section>

      {/* Trust Badges */}
      <section className="mx-4 mt-16 grid grid-cols-3 gap-4">
        {TRUST_BADGES.map((b) => (
          <div key={b.label} className="bg-white border border-[rgba(196,197,215,0.15)] rounded-[8px] shadow-[0px_1px_1px_rgba(0,0,0,0.05)] p-6 flex flex-col items-center gap-3">
            <div className="w-12 h-12 bg-bg-trust rounded-[12px] flex items-center justify-center">
              {b.icon}
            </div>
            <p className="text-[14px] font-semibold text-text-main text-center leading-[1.45] whitespace-pre-line">
              {b.label}
            </p>
          </div>
        ))}
      </section>

      {/* Our Services */}
      <section className="px-6 pt-16 pb-8">
        <div className="flex items-baseline justify-between mb-8">
          <h2 className="font-display font-extrabold text-[24px] tracking-[-0.6px] text-primary">
            Our Services
          </h2>
          <Link href="/order" className="text-[14px] font-semibold text-primary">
            View All
          </Link>
        </div>

        <div className="flex flex-col gap-6">
          {SERVICES.map((s) => (
            <div key={s.name} className="bg-white border border-[rgba(196,197,215,0.1)] rounded-[8px] overflow-hidden">
              <div className="h-48 relative w-full">
                <Image src={s.img} alt={s.name} fill className="object-cover" />
              </div>
              <div className="p-6 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-[20px] font-semibold text-text-main">{s.name}</span>
                  <span className="text-[18px] font-semibold text-primary">{s.price}</span>
                </div>
                <p className="text-[14px] text-text-body leading-[1.45] pb-2">{s.desc}</p>
                <Link
                  href={s.href}
                  className="w-full bg-bg-card text-primary text-[16px] font-semibold text-center py-[10px] rounded-[6px]"
                >
                  {s.cta}
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Serving Your Locality */}
      <section className="px-6 py-8">
        <h2 className="font-display font-extrabold text-[24px] tracking-[-0.6px] text-primary mb-6">
          Serving Your Locality
        </h2>
        <div className="grid grid-cols-2 gap-4">
          {SHOWN_LOCALITIES.map((loc) => (
            <div key={loc} className="bg-bg-card rounded-[8px] px-4 py-4 text-[16px] font-semibold text-text-body text-center">
              {loc}
            </div>
          ))}
          <div className="bg-[#dbeafe] rounded-[8px] px-4 py-4 text-[16px] font-semibold text-primary text-center">
            More soon...
          </div>
        </div>
      </section>
    </main>
  );
}
