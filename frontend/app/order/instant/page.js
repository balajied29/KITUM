'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getProducts, createRequest, getAddresses, createOrder, ensureCustomerAuth } from '@/lib/api';
import { reverseGeocode } from '@/lib/maps';
import { useAuthStore, useLocationStore, useCartStore } from '@/lib/store';
import { TankerIcon, CheckIcon } from '@/components/icons';
import { tankerImage } from '@/lib/tankerImage';
import { quote as priceQuote } from '@/lib/pricing';
import SlotPicker from '@/components/SlotPicker';
import LegalConsent from '@/components/LegalConsent';

const PICK_URL = '/location?mode=select&next=/order/instant';

// Short capacity-based descriptor for each tanker tier (keyed by litres).
const TANKER_TAGS = {
  500:  'Compact · top-ups & small homes',
  1000: 'Standard · daily household use',
  2000: 'Large · families & businesses',
};
const litresOf = (p) => {
  if (p.tankerLitres) return p.tankerLitres;
  const m = String(p.unit || '').match(/(\d[\d,]*)/);
  return m ? Number(m[1].replace(/,/g, '')) : 0;
};

export default function InstantOrderPage() {
  const router = useRouter();
  const { user, accessToken } = useAuthStore();
  const drop = useLocationStore((s) => s.drop);
  const setDrop = useLocationStore((s) => s.setDrop);
  const storeLocality = useLocationStore((s) => s.locality);
  const slot = useCartStore((s) => s.slot);
  const setSlot = useCartStore((s) => s.setSlot);

  const [when, setWhen] = useState('now'); // 'now' (instant) | 'later' (scheduled)
  const [tankers, setTankers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [addresses, setAddresses] = useState([]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [flat, setFlat] = useState('');
  const [directions, setDirections] = useState('');
  const [paymentMode, setPaymentMode] = useState('cod');
  const [submitting, setSubmitting] = useState(false);
  const [geoBusy, setGeoBusy] = useState(false);
  const [error, setError] = useState('');

  // No login gate — browse + build the order freely; we create the account at
  // place-order time from the contact details (see handlePlaceOrder).
  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setPhone(user.phone || '');
    }
  }, [user]);

  useEffect(() => {
    getProducts()
      .then((res) => {
        const list = res.data.data.filter((p) => /tanker/i.test(p.name));
        setTankers(list);
        // Preselect the size deep-linked from the home tiles (?product=<id>), else the first.
        const wanted = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('product') : null;
        const pre = (wanted && list.find((p) => p._id === wanted)) || list[0];
        if (pre) setSelected(pre._id);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    // Saved addresses only exist for a signed-in customer.
    if (useAuthStore.getState().accessToken) {
      getAddresses().then((res) => setAddresses(res.data.data)).catch(() => {});
    }
  }, []);

  const useCurrentLocation = () => {
    if (!navigator.geolocation) return;
    setGeoBusy(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        const address = (await reverseGeocode(lat, lng)) || 'Current location';
        setDrop({ address, lat, lng, landmark: '' });
        setGeoBusy(false);
      },
      () => setGeoBusy(false),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const pickSaved = (a) =>
    setDrop({
      address: a.address,
      landmark: a.landmark || '',
      lat: a.location.coordinates[1],
      lng: a.location.coordinates[0],
    });

  const selectedProduct = tankers.find((t) => t._id === selected);
  // Launch offer (display-only preview): if this customer still has free bookings,
  // the next one waives the 5% platform fee. The SERVER is authoritative at
  // creation — this just mirrors it so the breakdown is truthful before submit.
  const freeLeft = user?.customerPerks?.freeBookingsRemaining || 0;
  const willWaiveFee = freeLeft > 0;
  const bill = selectedProduct ? priceQuote(selectedProduct.price, { waivePlatformFee: willWaiveFee }) : null;
  // The regular 5% fee (struck through when waived).
  const regularFee = selectedProduct ? priceQuote(selectedProduct.price).platformFee : 0;

  const handlePlaceOrder = async () => {
    setError('');
    if (!selected) return setError('Please select a tanker size.');
    if (!drop?.lat) return setError('Please set your delivery location.');
    if (!name.trim()) return setError('Please enter your name.');
    if (!phone.trim()) return setError('Please enter a contact phone number.');
    if (when === 'later' && !slot?._id) return setError('Please choose a delivery slot.');

    setSubmitting(true);

    // Seamless auth: if not signed in, create (or resume) a guest account from the
    // contact name + phone, then continue. No login screen.
    try {
      await ensureCustomerAuth(name.trim(), phone.trim());
    } catch {
      setError('Could not start your session. Please check your phone number and try again.');
      setSubmitting(false);
      return;
    }

    // Nothing is charged now — payment is collected at delivery (cash, or UPI at
    // the door). Both flows just create the order/request and navigate.

    // ── Schedule for later → create a scheduled Order (slot-based) ──
    if (when === 'later') {
      try {
        const res = await createOrder({
          items: [{ productId: selected, quantity: 1 }],
          slotId: slot._id,
          deliveryAddress: { name, phone, flat, street: drop.address, landmark: drop.landmark || '', directions, locality: storeLocality || '' },
          coordinates: [drop.lng, drop.lat],
          paymentMode,
        });
        setSlot(null); // clear the picked slot so it doesn't leak into the cart flow
        router.replace(`/status/${res.data.data._id}`);
      } catch (e) {
        setError(e?.response?.data?.error || 'Could not schedule your order. Try again.');
        setSubmitting(false);
      }
      return;
    }

    // ── Now → instant DeliveryRequest (real-time dispatch) ──
    try {
      const res = await createRequest({
        productId: selected,
        quantity: 1,
        paymentMode,
        dropLocation: { coordinates: [drop.lng, drop.lat], address: drop.address, flat, landmark: drop.landmark, directions, name, phone },
      });
      router.push(`/track/${res.data.data._id}`);
    } catch (e) {
      setError(e.response?.data?.error || 'Could not place request. Try again.');
      setSubmitting(false);
    }
  };

  return (
    <main className="bg-bg-page min-h-dvh px-4 pt-5 pb-24">
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => router.back()} className="text-text-muted">
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h1 className="text-base font-700 text-text-main">Order a Tanker</h1>
          <p className="text-xs text-text-muted mt-0.5">Get it now, or schedule for a slot.</p>
        </div>
      </div>

      {/* Launch offer — free bookings remaining (server-authoritative perk) */}
      {freeLeft > 0 && (
        <div className="rounded-card border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 mb-5 flex items-center gap-2.5">
          <span className="text-lg leading-none">🎉</span>
          <p className="text-xs font-medium text-emerald-800">
            You have <span className="font-700">{freeLeft} free {freeLeft === 1 ? 'delivery' : 'deliveries'}</span> — no platform fee.
          </p>
        </div>
      )}

      {/* When — deliver now or schedule for later */}
      <p className="text-xs font-700 text-text-muted uppercase tracking-wide mb-2">When</p>
      <div className="flex gap-3 mb-6">
        {[{ id: 'now', label: 'Now', sub: 'ASAP · live-tracked' }, { id: 'later', label: 'Schedule', sub: 'Pick a 2-hr slot' }].map((w) => (
          <button
            key={w.id}
            onClick={() => setWhen(w.id)}
            aria-pressed={when === w.id}
            className={`flex-1 rounded-card border p-3 text-left transition-all ${when === w.id ? 'border-primary bg-bg-trust ring-1 ring-primary' : 'border-border-default bg-white hover:border-primary/40'}`}
          >
            <p className={`text-sm font-700 ${when === w.id ? 'text-primary' : 'text-text-main'}`}>{w.label}</p>
            <p className="text-[11px] text-text-muted mt-0.5">{w.sub}</p>
          </button>
        ))}
      </div>

      {when === 'later' && (
        <div className="mb-6">
          <p className="text-xs font-700 text-text-muted uppercase tracking-wide mb-2">Choose a slot</p>
          <SlotPicker />
        </div>
      )}

      {/* Tanker size — Uber-style option list */}
      <p className="text-xs font-700 text-text-muted uppercase tracking-wide mb-2">Choose your tanker</p>
      {loading ? (
        <div className="flex flex-col gap-3 mb-6">{[1, 2, 3].map((i) => <div key={i} className="h-[72px] rounded-card animate-pulse bg-bg-card" />)}</div>
      ) : tankers.length === 0 ? (
        <div className="card text-center py-8 mb-6">
          <p className="text-sm font-700 text-text-main">No tankers available right now</p>
          <p className="text-xs text-text-muted mt-1">Please try again in a moment.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3 mb-6">
          {tankers.map((p) => {
            const active = selected === p._id;
            const litres = litresOf(p);
            const img = tankerImage(litres);
            const tag = TANKER_TAGS[litres] || p.unit;
            return (
              <button
                key={p._id}
                onClick={() => setSelected(p._id)}
                aria-pressed={active}
                className={`w-full flex items-center gap-3.5 rounded-card border p-3 text-left transition-all ${
                  active ? 'border-primary bg-bg-trust ring-1 ring-primary' : 'border-border-default bg-white hover:border-primary/40'
                }`}
              >
                <div className={`w-14 h-14 rounded-xl overflow-hidden flex items-center justify-center shrink-0 transition-colors ${active ? 'bg-primary text-white' : 'bg-bg-trust text-primary'}`}>
                  {img ? (
                    <img src={img} alt={`${litres}L tanker`} className="w-full h-full object-cover" />
                  ) : (
                    <TankerIcon className="w-7 h-7" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-700 text-text-main">
                    {litres ? `${litres.toLocaleString('en-IN')} L Tanker` : p.name}
                  </p>
                  <p className="text-xs text-text-muted mt-0.5 truncate">{tag}</p>
                </div>
                <div className="flex items-center gap-2.5 shrink-0">
                  <span className="text-base font-700 text-text-main">₹{p.price}</span>
                  <span className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${active ? 'bg-primary border-primary text-white' : 'border-border-default text-transparent'}`}>
                    <CheckIcon className="w-3 h-3" />
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Delivery location */}
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-700 text-text-muted uppercase tracking-wide">Delivery Location</p>
        <Link href="/addresses" className="text-xs font-medium text-primary">Manage</Link>
      </div>

      {/* Saved addresses quick-pick */}
      {addresses.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-2 mb-2 -mx-1 px-1">
          {addresses.slice(0, 5).map((a) => {
            const active = drop?.lat === a.location.coordinates[1] && drop?.lng === a.location.coordinates[0];
            return (
              <button key={a._id} onClick={() => pickSaved(a)} className={`shrink-0 px-3 py-2 rounded-btn border text-left max-w-[160px] ${active ? 'border-primary bg-bg-trust' : 'border-border-default bg-white'}`}>
                <p className="text-xs font-700 text-text-main truncate">{a.label || a.type}</p>
                <p className="text-[10px] text-text-muted truncate">{a.address}</p>
              </button>
            );
          })}
        </div>
      )}

      {drop?.lat ? (
        <div className="card mb-6">
          <div className="flex items-start gap-3">
            <svg className="mt-0.5 shrink-0" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#0037b0" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <circle cx="12" cy="11" r="3" />
            </svg>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text-main leading-snug">{drop.address}</p>
              {drop.landmark ? <p className="text-xs text-text-muted mt-0.5">Near {drop.landmark}</p> : null}
            </div>
            <button onClick={() => router.push(PICK_URL)} className="text-xs font-700 text-primary shrink-0">Change</button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2 mb-6">
          <button onClick={() => router.push(PICK_URL)} className="card flex items-center gap-3 text-left">
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#0037b0" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            <div>
              <p className="text-sm font-700 text-text-main">Set location on map</p>
              <p className="text-xs text-text-muted">Pin your exact delivery spot</p>
            </div>
          </button>
          <button onClick={useCurrentLocation} disabled={geoBusy} className="btn-ghost flex items-center gap-2 self-start text-xs">
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8a4 4 0 100 8 4 4 0 000-8z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 2v3m0 14v3m10-10h-3M5 12H2" />
            </svg>
            {geoBusy ? 'Locating…' : 'Use my current location'}
          </button>
        </div>
      )}

      {/* Contact */}
      <p className="text-xs font-700 text-text-muted uppercase tracking-wide mb-2">Contact</p>
      <div className="card mb-6 flex flex-col gap-3">
        <input className="input" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="input" type="tel" placeholder="Phone number" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <input className="input" placeholder="Flat / House / Building (recommended)" value={flat} onChange={(e) => setFlat(e.target.value)} />
        <input className="input" placeholder="Directions for the driver (optional)" value={directions} onChange={(e) => setDirections(e.target.value)} />
      </div>

      {/* Payment */}
      <p className="text-xs font-700 text-text-muted uppercase tracking-wide mb-2">Payment</p>
      <div className="flex gap-3 mb-6">
        {[{ id: 'cod', label: 'Cash on Delivery' }, { id: 'upi', label: 'UPI on Delivery' }].map((m) => (
          <button key={m.id} onClick={() => setPaymentMode(m.id)} className={`flex-1 card text-sm font-medium ${paymentMode === m.id ? 'ring-2 ring-primary text-primary' : 'text-text-muted'}`}>
            {m.label}
          </button>
        ))}
      </div>

      {/* Price breakdown */}
      {bill && (
        <div className="card mb-4 text-sm">
          <div className="flex justify-between py-1">
            <span className="text-text-muted">Tanker fare</span>
            <span className="text-text-main">₹{bill.fare}</span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-text-muted">Platform fee (5%)</span>
            {bill.waivePlatformFee ? (
              <span className="flex items-center gap-1.5">
                <span className="text-text-muted line-through">₹{regularFee}</span>
                <span className="font-700 text-emerald-600">FREE</span>
              </span>
            ) : (
              <span className="text-text-main">₹{bill.platformFee}</span>
            )}
          </div>
          {bill.waivePlatformFee && (
            <p className="text-[11px] font-medium text-emerald-600">🎉 Launch offer — platform fee waived</p>
          )}
          <div className="flex justify-between py-1.5 border-t border-border-default mt-1 font-700 text-text-main">
            <span>Total</span>
            <span>₹{bill.total}</span>
          </div>
          <p className="text-[11px] text-text-muted mt-2">
            No payment now — pay ₹{bill.total} {paymentMode === 'cod' ? 'in cash' : 'by UPI'} when your tanker arrives.
          </p>
        </div>
      )}

      {error && <p className="text-xs text-red-600 mb-3">{error}</p>}

      <LegalConsent action="placing your order" variant="order" className="mb-2" />

      {/* Sticky CTA */}
      <div className="cta-dock">
        <button onClick={handlePlaceOrder} disabled={submitting} className="btn-primary w-full flex items-center justify-between px-4 py-3.5">
          <span className="font-700">{bill ? `₹${bill.total}` : ''}</span>
          <span>
            {submitting
              ? (when === 'later' ? 'Scheduling…' : 'Finding a tanker…')
              : (when === 'later' ? 'Schedule delivery →' : 'Find a tanker now →')}
          </span>
          <span className="opacity-0 w-12" />
        </button>
      </div>
    </main>
  );
}
