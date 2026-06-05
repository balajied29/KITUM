'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createOrder, getAddresses } from '@/lib/api';
import { useCartStore, useAuthStore, useLocationStore } from '@/lib/store';
import { quote as priceQuote } from '@/lib/pricing';
import { reverseGeocode } from '@/lib/maps';
import StepIndicator from '@/components/StepIndicator';
import AppHeader from '@/components/AppHeader';
import LegalConsent from '@/components/LegalConsent';

const PICK_URL = '/location?mode=select&next=/checkout';

export default function CheckoutPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { items, slot, clearCart, totalAmount } = useCartStore();
  const drop = useLocationStore((s) => s.drop);
  const setDrop = useLocationStore((s) => s.setDrop);
  const storeLocality = useLocationStore((s) => s.locality);

  const [name, setName]         = useState(user?.name  || '');
  const [phone, setPhone]       = useState(user?.phone || '');
  const [flat, setFlat]         = useState('');
  const [directions, setDirections] = useState('');
  const [addresses, setAddresses] = useState([]);
  const [paymentMode, setPaymentMode] = useState('upi');
  const [geoBusy, setGeoBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  // Guards: must be signed in, and must have something in the cart.
  useEffect(() => {
    if (!useAuthStore.getState().user) { router.replace('/login?next=/checkout'); return; }
    if (useCartStore.getState().items.length === 0) router.replace('/order');
  }, [router]);

  useEffect(() => { if (user) { setName(user.name || ''); setPhone(user.phone || ''); } }, [user]);
  useEffect(() => { getAddresses().then((res) => setAddresses(res.data.data)).catch(() => {}); }, []);

  const cartTotal = totalAmount();
  const slotId    = slot?._id ?? null;
  const bill      = priceQuote(cartTotal);

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

  const handlePlaceOrder = async () => {
    if (!slotId)            { setError('Please go back and select a delivery slot.'); return; }
    if (!name.trim())       { setError('Full name is required.');         return; }
    if (!phone.trim())      { setError('Phone number is required.');       return; }
    if (!drop?.lat)         { setError('Please set your delivery location.'); return; }
    setError('');
    setLoading(true);

    // Nothing is charged now — payment is collected at delivery (cash, or UPI at
    // the door). Just create the order and go to its status screen.
    try {
      const orderRes = await createOrder({
        items: items.map((i) => ({ productId: i.product._id, quantity: i.quantity })),
        slotId,
        deliveryAddress: { name, phone, flat, street: drop.address, landmark: drop.landmark || '', directions, locality: storeLocality || '' },
        coordinates: [drop.lng, drop.lat], // precise [lng, lat] from the map pick / saved address
        paymentMode,
      });
      clearCart();
      router.replace(`/status/${orderRes.data.data._id}`);
    } catch (err) {
      setError(err?.response?.data?.error || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="pb-6">
      <AppHeader showLocality={false} />
      <StepIndicator step={3} />

      <div className="px-4">
        <h1 className="text-base font-700 text-text-main mb-4">Order Summary</h1>

        {/* Items */}
        <section className="card mb-4">
          {items.map(({ product, quantity }) => (
            <div key={product._id} className="flex items-center justify-between py-2 border-b border-border-default last:border-0">
              <div>
                <p className="text-sm font-medium text-text-main">{product.name}</p>
                <p className="text-xs text-text-muted">Quantity: {quantity} × ₹{product.price}</p>
              </div>
              <p className="text-sm font-700 text-text-main">₹{product.price * quantity}</p>
            </div>
          ))}

          {/* Slot summary — real data from store */}
          <div className="flex items-start justify-between pt-3 mt-1">
            <div>
              <p className="text-xs font-medium text-text-main mb-0.5">Delivery Slot</p>
              {slot ? (
                <p className="text-xs text-text-muted">
                  {new Date(slot.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  {' · '}{slot.slotLabel} · {slot.startTime}–{slot.endTime}
                </p>
              ) : (
                <p className="text-xs text-red-500 font-medium">No slot selected — go back</p>
              )}
            </div>
            <p className="text-lg font-700 text-text-main">₹{cartTotal}</p>
          </div>
        </section>

        {/* Delivery details */}
        <section className="card mb-4">
          <h2 className="text-xs font-700 text-text-muted uppercase tracking-wide mb-3">Delivery Details</h2>

          <div className="flex flex-col gap-3">
            <div>
              <label className="block text-xs font-medium text-text-main mb-1">Full Name</label>
              <input className="input" placeholder="Rilang Tariang"
                value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-main mb-1">Phone Number</label>
              <input className="input" type="tel" placeholder="+91 98765 43210"
                value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>

          {/* Delivery location — same picker as the instant flow */}
          <div className="flex items-center justify-between mt-4 mb-2">
            <p className="text-xs font-medium text-text-main">Delivery Location</p>
            <Link href="/addresses" className="text-xs font-medium text-primary">Manage</Link>
          </div>

          {addresses.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-2 mb-2 -mx-1 px-1">
              {addresses.slice(0, 5).map((a) => {
                const active = drop?.lat === a.location.coordinates[1] && drop?.lng === a.location.coordinates[0];
                return (
                  <button key={a._id} onClick={() => pickSaved(a)}
                    className={`shrink-0 px-3 py-2 rounded-btn border text-left max-w-[160px] transition-colors ${active ? 'border-primary bg-bg-trust' : 'border-border-default bg-white'}`}>
                    <p className="text-xs font-700 text-text-main truncate">{a.label || a.type}</p>
                    <p className="text-[10px] text-text-muted truncate">{a.address}</p>
                  </button>
                );
              })}
            </div>
          )}

          {drop?.lat ? (
            <div className="rounded-btn border border-border-default p-3">
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
            <div className="flex flex-col gap-2">
              <button onClick={() => router.push(PICK_URL)} className="rounded-btn border border-border-default p-3 flex items-center gap-3 text-left">
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

          {/* Extra delivery details — help the driver find the exact spot */}
          <div className="mt-3 flex flex-col gap-3">
            <div>
              <label className="block text-xs font-medium text-text-main mb-1">
                Flat / House / Building <span className="text-text-muted font-normal">(recommended)</span>
              </label>
              <input className="input" placeholder="e.g. Flat 3B, Riverdale Apartments"
                value={flat} onChange={(e) => setFlat(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-main mb-1">
                Directions for the driver <span className="text-text-muted font-normal">(optional)</span>
              </label>
              <input className="input" placeholder="e.g. Blue gate, ring the bell twice"
                value={directions} onChange={(e) => setDirections(e.target.value)} />
            </div>
          </div>
        </section>

        {/* Payment method */}
        <section className="card mb-5">
          <h2 className="text-xs font-700 text-text-muted uppercase tracking-wide mb-3">Payment Method</h2>
          <div className="flex gap-3">
            {[
              { value: 'upi', label: 'UPI on Delivery' },
              { value: 'cod', label: 'Cash on Delivery' },
            ].map((opt) => (
              <button key={opt.value} onClick={() => setPaymentMode(opt.value)}
                className={`flex-1 text-xs font-medium py-3 rounded-btn border transition-colors ${
                  paymentMode === opt.value
                    ? 'bg-primary text-white border-primary'
                    : 'bg-white text-text-muted border-border-default hover:border-primary'
                }`}>
                {opt.label}
              </button>
            ))}
          </div>
          {paymentMode === 'upi' && (
            <p className="text-[11px] text-text-muted mt-2">
              Pay securely by UPI when your tanker is delivered — nothing is charged now.
            </p>
          )}
        </section>

        {error && <p className="text-red-600 text-xs mb-3">{error}</p>}

        <div className="card mb-3 text-sm">
          <div className="flex justify-between py-1">
            <span className="text-text-muted">Subtotal</span>
            <span className="text-text-main">₹{bill.fare}</span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-text-muted">Platform fee (5%)</span>
            <span className="text-text-main">₹{bill.platformFee}</span>
          </div>
          <div className="flex justify-between py-1.5 border-t border-border-default mt-1 font-700 text-text-main">
            <span>Total</span>
            <span>₹{bill.total}</span>
          </div>
          <p className="text-[11px] text-text-muted mt-2">
            No payment now — pay ₹{bill.total} {paymentMode === 'cod' ? 'in cash' : 'by UPI'} on delivery.
          </p>
        </div>

        <button
          onClick={handlePlaceOrder}
          disabled={loading || items.length === 0 || !slotId}
          className="btn-primary w-full text-sm disabled:opacity-50"
        >
          {loading ? 'Processing…' : `Place Order · ₹${bill.total}`}
        </button>

        <LegalConsent action="placing your order" variant="order" className="mt-3 text-center" />
      </div>
    </main>
  );
}
