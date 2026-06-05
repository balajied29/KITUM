'use client';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import MapPicker from '@/components/MapPicker';
import { useLocationStore } from '@/lib/store';
import { createAddress } from '@/lib/api';

const TYPES = [
  { id: 'home', label: 'Home' },
  { id: 'work', label: 'Work' },
  { id: 'other', label: 'Other' },
];
const labelFor = (t) => ({ home: 'Home', work: 'Work', other: 'Other' }[t] || 'Other');

function LocationPicker() {
  const router = useRouter();
  const params = useSearchParams();
  const mode = params.get('mode') || 'select'; // 'select' | 'save' | 'home'
  const next = params.get('next') || (mode === 'home' ? '/' : '/order/instant');
  const setDrop = useLocationStore((s) => s.setDrop);
  const setLocation = useLocationStore((s) => s.setLocation);

  // Optional seed coords (e.g. from a chosen locality) — centre the map there
  // (no address ⇒ the picker reverse-geocodes the centre for a precise spot).
  const seedLat = Number(params.get('lat'));
  const seedLng = Number(params.get('lng'));
  const initial = Number.isFinite(seedLat) && seedLat !== 0 && Number.isFinite(seedLng) && seedLng !== 0
    ? { lat: seedLat, lng: seedLng }
    : undefined;

  const [landmark, setLandmark] = useState('');
  const [label, setLabel] = useState('');
  const [type, setType] = useState('home');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const confirm = async ({ lat, lng, address }) => {
    if (mode === 'save') {
      setSaving(true);
      setErr('');
      try {
        await createAddress({ label: label.trim() || labelFor(type), type, address, landmark, coordinates: [lng, lat] });
        router.replace('/addresses');
      } catch (e) {
        setErr(e?.response?.data?.error || 'Could not save address.');
        setSaving(false);
      }
    } else if (mode === 'home') {
      // Set the app-wide delivery location shown in the header, and pre-fill the order drop.
      const locality = address?.split(',')[0]?.trim() || 'Shillong';
      setLocation({ locality, coords: { lat, lon: lng }, address });
      setDrop({ address, landmark, lat, lng });
      router.replace(next);
    } else {
      setDrop({ address, landmark, lat, lng });
      router.replace(next);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-white flex flex-col max-w-[var(--app-w)] mx-auto">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 h-14 border-b border-border-default shrink-0">
        <button onClick={() => router.back()} className="text-text-main">
          <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-base font-700 text-text-main">
          {mode === 'save' ? 'Add address' : mode === 'home' ? 'Set your location' : 'Set delivery location'}
        </h1>
      </header>

      <MapPicker initial={initial} onConfirm={confirm} confirmLabel={mode === 'save' ? 'Save address' : 'Confirm location'} busy={saving}>
        {mode === 'save' && (
          <>
            <div className="flex gap-2 mb-3">
              {TYPES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setType(t.id)}
                  className={`flex-1 text-xs font-medium py-2 rounded-btn border transition-colors ${
                    type === t.id ? 'bg-primary text-white border-primary' : 'bg-white text-text-muted border-border-default'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <input className="input mb-2" placeholder="Label (optional, e.g. Mom's place)" value={label} onChange={(e) => setLabel(e.target.value)} />
          </>
        )}
        <input
          className="input"
          placeholder="Landmark / flat no. / floor (optional)"
          value={landmark}
          onChange={(e) => setLandmark(e.target.value)}
        />
        {err && <p className="text-xs text-red-600 mt-2">{err}</p>}
      </MapPicker>
    </div>
  );
}

export default function LocationPage() {
  return (
    <Suspense fallback={null}>
      <LocationPicker />
    </Suspense>
  );
}
