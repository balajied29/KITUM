'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Footer from '@/components/Footer';
import { useLocationStore, useAuthStore } from '@/lib/store';
import { getProducts, getAvailability } from '@/lib/api';
import { TankerIcon } from '@/components/icons';
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
const PinIcon = ({ className = 'w-3.5 h-3.5' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 10c0 5.5-8 12-8 12s-8-6.5-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="2.6" />
  </svg>
);
const ChevDown = ({ className = 'w-3 h-3' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 9l6 6 6-6" />
  </svg>
);

const TRUST = [
  {
    label: 'Live tracking', sub: 'See your tanker move', icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0037b0" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11" /></svg>
    )
  },
  {
    label: 'UPI & cash', sub: 'Pay how you want', icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0037b0" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2.5" /><path d="M16 13h.01" /></svg>
    )
  },
  {
    label: 'On-time slots', sub: 'We respect your time', icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0037b0" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7" /></svg>
    )
  },
];

export default function HomePage() {
  const { hasSelected, openModal, locality, coords } = useLocationStore();
  const user = useAuthStore((s) => s.user);
  const freeLeft = user?.customerPerks?.freeBookingsRemaining || 0;
  const [tankers, setTankers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [avail, setAvail] = useState(null); // { total, sizes:{<litres>:count} }

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
      .catch(() => { })
      .finally(() => setLoading(false));
  }, []);

  // Live nearby availability — one cheap call (server answers from a cached snapshot).
  useEffect(() => {
    if (!tankers.length) return;
    const sizes = tankers.map(litresOf).filter(Boolean).join(',');
    const params = { sizes };
    const lat = coords?.lat;
    const lng = coords?.lon ?? coords?.lng;
    if (Number.isFinite(lat) && Number.isFinite(lng)) { params.lat = lat; params.lng = lng; }
    getAvailability(params).then((r) => setAvail(r.data.data)).catch(() => setAvail(null));
  }, [tankers, coords]);

  const total = avail?.total ?? null;

  return (
    <main className="bg-bg-page min-h-dvh">
      {/* ───────── Cobalt header zone ───────── */}
      <header
        className="relative overflow-hidden bg-primary text-white"
        style={{ paddingTop: 'calc(0.5rem + env(safe-area-inset-top, 0px))' }}
      >
        {/* water-ripple motif */}
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <span className="absolute rounded-full bg-[#00298A]" style={{ width: 230, height: 230, top: -110, right: -90 }} />
          <span className="absolute rounded-full border-[1.5px] border-white/[0.14]" style={{ width: 262, height: 262, top: -126, right: -106 }} />
          <span className="absolute rounded-full border-[1.5px] border-white/[0.08]" style={{ width: 334, height: 334, top: -162, right: -142 }} />
          <span className="absolute rounded-full border-[1.5px] border-white/[0.045]" style={{ width: 414, height: 414, top: -202, right: -182 }} />
        </div>

        {/* topbar */}
        <div className="relative z-[2] flex items-center justify-between px-5 pt-2">
          <Link href="/" className="flex items-center gap-2">
            <svg width="20" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.2} strokeLinecap="round"><path d="M12 3s6 6.3 6 10.2A6 6 0 0 1 6 13.2C6 9.3 12 3 12 3Z" /></svg>
            <span className="font-display font-extrabold text-[19px] tracking-[-0.3px]">KitUm</span>
          </Link>
          <button
            onClick={openModal}
            className="flex items-center gap-1.5 bg-white/[0.14] border border-white/20 rounded-[10px] px-3 py-2 active:scale-95 transition-transform"
          >
            <PinIcon className="w-3.5 h-3.5 text-white/80" />
            <span className="text-[12.5px] font-700 text-white/85">Delivering to</span>
            <span className="text-[12.5px] font-extrabold text-[#EAF0FF] max-w-[110px] truncate">{locality || 'Set location'}</span>
            <ChevDown className="w-3 h-3 text-white/70" />
          </button>
        </div>

        {/* hero */}
        <div className="relative z-[2] px-5 pt-5 pb-7">
          {total > 0 && (
            <span className="inline-flex items-center gap-2 bg-white/[0.14] border border-white/20 rounded-full px-3 py-1.5 mb-3">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              <span className="text-[11.5px] font-extrabold uppercase tracking-wide">
                {total} tanker{total === 1 ? '' : 's'} available now
              </span>
            </span>
          )}
          <h1 className="font-display font-extrabold text-[32px] leading-[1.05] tracking-[-1px]">
            Water at your<br />door, <span className="text-[#EAF0FF]">now.</span>
          </h1>
          <p className="text-[13.5px] font-medium text-white/[0.76] leading-snug mt-2.5 mb-5">
            Nearest tanker, live-tracked to you.<br />Pay by UPI or cash on delivery.
          </p>
          <Link
            href="/order/instant"
            className="inline-flex items-center gap-2.5 h-[52px] px-5 bg-white text-primary font-extrabold text-[15.5px] tracking-[-0.2px] rounded-[16px] shadow-lg active:scale-[0.97] transition-transform"
          >
            Order a tanker now <Arrow className="w-[18px] h-[18px]" />
          </Link>
        </div>
      </header>

      {/* Become a partner */}
      <section>
        <Link
          href="/partner"
          className="relative block overflow-hidden rounded-[20px] bg-primary text-white shadow-[0_8px_24px_-10px_rgba(0,55,176,0.5)] active:scale-[0.99] transition-transform mt-5 mx-5"
        >
          {/* water-ripple motif */}
          <span aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
            <span className="absolute rounded-full bg-[#00298A]" style={{ width: 150, height: 150, top: -70, right: -50 }} />
            <span className="absolute rounded-full border-[1.5px] border-white/[0.14]" style={{ width: 178, height: 178, top: -84, right: -64 }} />
            <span className="absolute rounded-full border-[1.5px] border-white/[0.07]" style={{ width: 230, height: 230, top: -110, right: -90 }} />
          </span>
          <div className="relative z-[2] flex items-center gap-3.5 p-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px] bg-white/[0.14] border border-white/20">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M10 17h4V5H2v12h2" /><path d="M14 9h4l4 4v4h-2" /><circle cx="7.5" cy="17.5" r="2" /><circle cx="17.5" cy="17.5" r="2" /></svg>
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[15.5px] font-extrabold tracking-[-0.3px]">Own a tanker? Drive with KitUm</p>
              <p className="text-[12.5px] font-medium text-white/[0.76] mt-0.5 leading-snug">Be your own boss. Earn on your own schedule.</p>
            </div>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-primary">
              <Arrow className="w-[18px] h-[18px]" />
            </span>
          </div>
        </Link>
      </section>

      {/* Launch offer — free bookings remaining */}
      {freeLeft > 0 && (
        <section className="px-4 pt-4">
          <div className="rounded-card border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 flex items-center gap-2.5">
            <span className="text-lg leading-none">🎉</span>
            <p className="text-xs font-medium text-emerald-800">
              You have <span className="font-700">{freeLeft} free {freeLeft === 1 ? 'delivery' : 'deliveries'}</span>, no platform fee.
            </p>
          </div>
        </section>
      )}

      {/* ───────── Body ───────── */}
      <div className="px-4 pt-5 space-y-6">
        {/* Tanker sizes — horizontal scroll */}
        <section>
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-[16px] font-extrabold text-text-main tracking-[-0.3px]">Pick a tanker size</h2>
            <Link href="/order/instant" className="text-[13px] font-700 text-primary">See all</Link>
          </div>

          {loading ? (
            <div className="flex gap-3 overflow-hidden">
              {[1, 2, 3].map((i) => <div key={i} className="shrink-0 w-[150px] h-[180px] rounded-[20px] bg-bg-card animate-pulse" />)}
            </div>
          ) : tankers.length === 0 ? (
            <Link href="/order/instant" className="card block text-center text-sm text-text-muted py-6">View available tankers →</Link>
          ) : (
            <div className="flex gap-3 overflow-x-auto -mx-4 px-4 pb-1.5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              {tankers.map((p) => {
                const litres = litresOf(p);
                const img = tankerImage(litres);
                const nearby = avail?.sizes?.[litres];
                const popular = litres === 1000;
                return (
                  <Link
                    key={p._id}
                    href={`/order/instant?product=${p._id}`}
                    className="shrink-0 w-[150px] rounded-[20px] overflow-hidden bg-white border-2 border-transparent shadow-[0_4px_18px_-8px_rgba(0,30,100,0.14)] active:scale-[0.97] transition-transform"
                  >
                    <div className="relative h-[96px] bg-bg-trust flex items-center justify-center">
                      {popular && (
                        <span className="absolute top-2.5 left-2.5 text-[9.5px] font-extrabold uppercase tracking-wide bg-primary text-white px-1.5 py-0.5 rounded-md">Popular</span>
                      )}
                      {nearby > 0 && (
                        <span className="absolute top-2.5 right-2.5 text-[10px] font-extrabold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-md">{nearby} nearby</span>
                      )}
                      {img ? (
                        <img src={img} alt={`${litres}L tanker`} className="h-[78px] w-auto object-contain" />
                      ) : (
                        <TankerIcon className="w-16 h-16 text-primary/70" />
                      )}
                    </div>
                    <div className="px-3 pt-2.5 pb-3">
                      <div className="text-[18px] font-extrabold text-text-main tracking-[-0.5px] leading-none">
                        {litres ? `${litres.toLocaleString('en-IN')} L` : p.name}
                      </div>
                      <div className="text-[11.5px] font-semibold text-text-muted mt-1 mb-2">
                        {nearby > 0 ? 'Tankers ready nearby' : 'Order or schedule'}
                      </div>
                      <div className="text-[19px] font-extrabold text-primary tracking-[-0.5px]">₹{p.price.toLocaleString('en-IN')}</div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {/* Order for later */}
        <section>
          <Link href="/order" className="block rounded-[20px] bg-white border-[1.5px] border-[#E6EAF3] shadow-[0_4px_18px_-8px_rgba(0,30,100,0.10)] overflow-hidden active:scale-[0.99] transition-transform">
            <div className="flex items-center gap-3.5 p-4">
              <span className="w-12 h-12 rounded-[14px] bg-bg-trust text-primary flex items-center justify-center shrink-0">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[16px] font-extrabold text-text-main tracking-[-0.3px]">Order for later</p>
                <p className="text-[12.5px] font-medium text-text-muted mt-0.5 leading-snug">Reserve a slot. Tankers, jars &amp; bottles delivered on schedule.</p>
              </div>
            </div>
            <span className="mx-4 mb-4 flex items-center justify-center gap-2 h-[52px] bg-primary text-white font-extrabold text-[15px] rounded-[14px]">
              Schedule a delivery <Arrow className="w-[18px] h-[18px]" />
            </span>
          </Link>
        </section>

        {/* Trust */}
        <section>
          <div className="bg-white rounded-[20px] border-[1.5px] border-[#E6EAF3] flex divide-x divide-[#E6EAF3]">
            {TRUST.map((t) => (
              <div key={t.label} className="flex-1 flex flex-col items-center text-center gap-2 px-2 py-4">
                <span className="w-9 h-9 rounded-[11px] bg-bg-trust flex items-center justify-center">{t.icon}</span>
                <span className="text-[11.5px] font-700 text-text-main leading-tight tracking-[-0.1px]">{t.label}</span>
                <span className="text-[10.5px] font-medium text-text-muted">{t.sub}</span>
              </div>
            ))}
          </div>
        </section>



        <p className="text-center text-[12.5px] font-semibold text-text-muted pb-1">
          Serving <span className="text-text-main font-700">50+ areas</span> across Shillong &amp; Meghalaya
        </p>
      </div>

      <Footer />
    </main>
  );
}
