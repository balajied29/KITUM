'use client';
import { useEffect, useMemo, useState } from 'react';
import LOCALITIES from '@/constants/localities';
import { useLocationStore } from '@/lib/store';

const geoSupported = typeof navigator !== 'undefined' && !!navigator.geolocation;

export default function LocationModal() {
  const { modalOpen, closeModal, setLocation, locality, address } = useLocationStore();
  const [manualLoc, setManualLoc] = useState(locality || '');
  const [status, setStatus] = useState('');
  const [finding, setFinding] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    setManualLoc(locality || '');
  }, [locality]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return q ? LOCALITIES.filter((l) => l.toLowerCase().includes(q)) : LOCALITIES;
  }, [search]);

  const requestGeo = () => {
    if (!geoSupported) {
      setStatus('Geolocation not available on this device.');
      return;
    }
    setFinding(true);
    setStatus('Detecting your location…');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const coords = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        try {
          const resp = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${coords.lat}&lon=${coords.lon}`);
          const data = await resp.json();
          const display = data?.display_name || '';
          setLocation({ locality: manualLoc || 'Shillong', coords, address: display });
          setStatus('Location set');
        } catch (err) {
          setLocation({ locality: manualLoc || 'Shillong', coords, address: null });
          setStatus('Location detected, address lookup failed.');
        } finally {
          setFinding(false);
        }
      },
      (err) => {
        setFinding(false);
        setStatus(err?.message || 'Permission denied');
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  };

  const saveManual = () => {
    if (!manualLoc.trim()) {
      setStatus('Please pick a locality.');
      return;
    }
    setLocation({ locality: manualLoc.trim(), coords: null, address: manualLoc.trim() });
    setStatus('');
  };

  const choose = (loc) => {
    setManualLoc(loc);
    setLocation({ locality: loc, coords: null, address: loc });
  };

  if (!modalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-white rounded-t-2xl p-5 pb-24 shadow-2xl animate-[slideUp_200ms_ease]">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-text-muted font-medium">Choose Delivery Area</p>
            <p className="text-sm font-700 text-text-main">We deliver across Shillong</p>
          </div>
          <button onClick={closeModal} className="text-text-muted hover:text-text-main">✕</button>
        </div>

        <div className="mb-3">
          <label className="block text-xs font-medium text-text-main mb-1">Select locality</label>
          <div className="relative">
            <input
              className="input pr-10"
              placeholder="Search or choose"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted text-xs">⌕</span>
          </div>
        </div>

        <div className="max-h-60 overflow-y-auto border border-border-default rounded-2xl bg-white shadow-sm mb-3 divide-y divide-border-default/70">
          {filtered.map((loc) => {
            const active = manualLoc === loc;
            return (
              <button
                key={loc}
                onClick={() => choose(loc)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                  active ? 'bg-blue-50/80 ring-1 ring-primary/40' : 'hover:bg-slate-50'
                }`}
              >
                <span
                  className={`w-5 h-5 inline-flex items-center justify-center rounded-full border ${
                    active ? 'border-primary bg-primary text-white' : 'border-border-default'
                  }`}
                  aria-hidden
                >
                  {active ? '✓' : ''}
                </span>
                <span className="text-sm text-text-main">{loc}</span>
              </button>
            );
          })}
          {filtered.length === 0 && (
            <div className="px-4 py-3 text-sm text-text-muted">No matches</div>
          )}
        </div>

        <div className="mt-4 bg-white rounded-xl p-3 shadow-sm flex flex-col gap-2 sticky bottom-4">
          <button onClick={saveManual} className="btn-primary w-full py-3 text-sm font-700">Save & Continue</button>
          <button
            onClick={requestGeo}
            disabled={finding}
            className="w-full border border-primary text-primary rounded-btn py-3 text-sm font-700 hover:bg-blue-50 disabled:opacity-60"
          >
            {finding ? 'Detecting…' : 'Use my location'}
          </button>
        </div>

        {address && (
          <p className="text-[11px] text-text-muted mb-1 truncate">Detected: {address}</p>
        )}
        {status && (
          <p className="text-[11px] text-primary">{status}</p>
        )}
      </div>
    </div>
  );
}
