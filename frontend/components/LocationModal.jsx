'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import LOCALITIES from '@/constants/localities';
import { useLocationStore } from '@/lib/store';
import { geocodeAddress } from '@/lib/maps';

export default function LocationModal() {
  const router = useRouter();
  const { modalOpen, closeModal } = useLocationStore();
  const [search, setSearch] = useState('');
  const [seeking, setSeeking] = useState(null); // locality currently being geocoded

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return q ? LOCALITIES.filter((l) => l.toLowerCase().includes(q)) : LOCALITIES;
  }, [search]);

  // Always finish on the map so the customer drops an exact pin.
  const openMap = (params = '') => {
    closeModal();
    router.push(`/location?mode=home&next=/${params}`);
  };

  // Locality → geocode to centre the map there → pick exact pin.
  const chooseLocality = async (loc) => {
    setSeeking(loc);
    const hit = await geocodeAddress(`${loc}, Shillong, Meghalaya, India`);
    setSeeking(null);
    openMap(hit ? `&lat=${hit.lat}&lng=${hit.lng}` : '');
  };

  if (!modalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 backdrop-blur-sm">
      <div className="w-full max-w-[var(--app-w)] bg-white rounded-t-2xl p-5 pb-8 shadow-2xl animate-[slideUp_200ms_ease]">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-text-muted font-medium">Choose delivery location</p>
            <p className="text-sm font-700 text-text-main">We deliver across Shillong</p>
          </div>
          <button onClick={closeModal} aria-label="Close" className="icon-btn p-2 -mr-1.5 text-text-muted hover:text-text-main hover:bg-bg-card">
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        {/* Primary: GPS + map */}
        <button
          onClick={() => openMap()}
          className="w-full flex items-center gap-3 bg-bg-trust border border-primary/20 rounded-btn px-4 py-3 mb-4 text-left"
        >
          <span className="w-9 h-9 rounded-full bg-white flex items-center justify-center shrink-0">
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#0037b0" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8a4 4 0 100 8 4 4 0 000-8z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 2v3m0 14v3m10-10h-3M5 12H2" />
            </svg>
          </span>
          <span className="flex-1">
            <span className="block text-sm font-700 text-primary">Use my current location</span>
            <span className="block text-[11px] text-text-muted">Opens the map at your spot — drop the exact pin</span>
          </span>
          <svg width="8" height="13" fill="none" viewBox="0 0 8 13" stroke="#0037b0" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M1 1l5 5.5L1 12" />
          </svg>
        </button>

        <div className="flex items-center gap-3 mb-3">
          <span className="h-px flex-1 bg-border-default" />
          <span className="text-[11px] text-text-muted">or pick a locality</span>
          <span className="h-px flex-1 bg-border-default" />
        </div>

        <div className="relative mb-3">
          <input
            className="input pr-10"
            placeholder="Search localities in Shillong"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.3-4.3" />
            </svg>
          </span>
        </div>

        <div className="max-h-72 overflow-y-auto border border-border-default rounded-2xl bg-white shadow-sm divide-y divide-border-default/70">
          {filtered.map((loc) => (
            <button
              key={loc}
              onClick={() => chooseLocality(loc)}
              disabled={!!seeking}
              className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 disabled:opacity-60"
            >
              <span className="w-7 h-7 rounded-full bg-bg-trust inline-flex items-center justify-center shrink-0">
                <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="#0037b0" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <circle cx="12" cy="11" r="3" />
                </svg>
              </span>
              <span className="text-sm text-text-main flex-1">{loc}</span>
              {seeking === loc ? (
                <span className="w-4 h-4 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
              ) : (
                <svg width="7" height="11" fill="none" viewBox="0 0 8 13" stroke="#94a3b8" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M1 1l5 5.5L1 12" />
                </svg>
              )}
            </button>
          ))}
          {filtered.length === 0 && <div className="px-4 py-3 text-sm text-text-muted">No matches</div>}
        </div>
      </div>
    </div>
  );
}
