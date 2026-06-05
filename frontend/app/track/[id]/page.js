'use client';
import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getRequestById, cancelRequest, createRequestPayment, verifyRequestPayment } from '@/lib/api';
import { openRazorpayCheckout } from '@/lib/razorpay';
import { getSocket } from '@/lib/socket';
import { useAuthStore } from '@/lib/store';
import { EVENTS, REQUEST_STATUS } from '@/lib/constants';
import TrackMap from '@/components/TrackMap';
import ReviewForm from '@/components/ReviewForm';
import { StarIcon, TankerIcon, CheckIcon } from '@/components/icons';

const STEPS = [
  { key: REQUEST_STATUS.SEARCHING, label: 'Finding tanker' },
  { key: REQUEST_STATUS.DRIVER_ASSIGNED, label: 'Assigned' },
  { key: REQUEST_STATUS.EN_ROUTE, label: 'On the way' },
  { key: REQUEST_STATUS.ARRIVED, label: 'Arrived' },
  { key: REQUEST_STATUS.COMPLETED, label: 'Delivered' },
];
const JOURNEY = STEPS.slice(1); // assigned → delivered (the visible nodes)

// Reassurance while the dispatcher works through its offer rounds (nearest →
// broadcast → wider radius, ~20s each, up to 3 rounds before it gives up). The
// backend doesn't stream round progress to the customer, so we escalate the copy
// purely on elapsed search time to make a silent wait feel like real progress.
const SEARCH_STAGES = [
  { title: 'Finding your tanker', sub: 'Reaching out to partners closest to you…' },
  { title: 'Still searching',     sub: 'Checking with more partners nearby…' },
  { title: 'Widening the search', sub: 'Looking a little farther out for you…' },
  { title: 'Hang tight',          sub: 'Still working on it — this can take a moment longer.' },
];
const SEARCH_STAGE_AT = [0, 18, 38, 65]; // seconds at which each stage begins

/* ----------------------------- small pieces ----------------------------- */

function PhoneGlyph() {
  return (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#16a34a" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
    </svg>
  );
}

/** Connected journey rail — current step pulses (live), all-done with times (delivered). */
function Journey({ activeIdx, timeFor }) {
  return (
    <div className="flex items-start">
      {JOURNEY.map((s, i) => {
        const idx = i + 1; // index into STEPS
        const done = activeIdx >= idx;
        const current = activeIdx === idx;
        const t = timeFor(s.key);
        return (
          <div key={s.key} className="flex-1 flex flex-col items-center relative">
            {i > 0 && (
              <span className="absolute top-[11px] right-1/2 left-[-50%] h-[3px] rounded-full" style={{ background: done ? '#0037b0' : '#e2e8f0' }} />
            )}
            <span className={`relative z-10 w-[22px] h-[22px] rounded-full flex items-center justify-center ${done ? 'bg-primary text-white' : 'bg-white border-2 border-border-default'} ${current ? 'ring-4 ring-primary/15' : ''}`}>
              {done ? <CheckIcon className="w-3 h-3" /> : <span className="w-2 h-2 rounded-full bg-border-default" />}
            </span>
            <span className={`text-[10px] mt-1.5 text-center leading-tight ${done ? 'text-text-main font-medium' : 'text-text-muted'}`}>{s.label}</span>
            {t && <span className="text-[10px] text-text-muted/80 mt-0.5">{t}</span>}
          </div>
        );
      })}
    </div>
  );
}

function PartnerRow({ fulfiller, completed }) {
  if (!fulfiller) return null;
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-base font-700 text-primary">
          {fulfiller.name?.[0]?.toUpperCase() ?? 'P'}
        </div>
        <div>
          <p className="text-[11px] text-text-muted">{completed ? 'Delivered by' : 'Your delivery partner'}</p>
          <p className="text-sm font-700 text-text-main leading-tight">{fulfiller.name || 'Delivery Partner'}</p>
          <p className="text-xs text-text-muted flex items-center gap-1 mt-0.5">
            {fulfiller.vehicle || 'Tanker'} ·
            <StarIcon className="w-3 h-3 text-amber-400" />
            {Number(fulfiller.rating ?? 5).toFixed(1)}
          </p>
        </div>
      </div>
      {fulfiller.phone && !completed && (
        <a href={`tel:${fulfiller.phone}`} aria-label="Call partner" className="w-11 h-11 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center active:scale-95 transition-transform">
          <PhoneGlyph />
        </a>
      )}
    </div>
  );
}

/* -------------------------------- page --------------------------------- */

export default function TrackPage() {
  const { id } = useParams();
  const router = useRouter();

  const [request, setRequest] = useState(null);
  const [status, setStatus] = useState(null);
  const [fulfiller, setFulfiller] = useState(null);
  const [eta, setEta] = useState(null);
  const [tanker, setTanker] = useState(null);
  const [trackingLive, setTrackingLive] = useState(true);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState('');
  const [paidLocal, setPaidLocal] = useState(false); // optimistic after a successful UPI pay
  const [searchElapsed, setSearchElapsed] = useState(0); // seconds spent in the SEARCHING state
  const user = useAuthStore((s) => s.user);
  const socketRef = useRef(null);

  // Initial load
  useEffect(() => {
    getRequestById(id)
      .then((res) => {
        const r = res.data.data;
        setRequest(r);
        setStatus(r.status);
        if (r.fulfillerId) {
          setFulfiller({
            name: r.fulfillerId.name,
            phone: r.fulfillerId.phone,
            vehicle: r.fulfillerId.fulfillerProfile?.vehicleNumber,
            rating: r.fulfillerId.fulfillerProfile?.rating,
          });
        }
        if (r.pricing?.etaMin) setEta(r.pricing.etaMin);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  // Realtime
  useEffect(() => {
    const socket = getSocket();
    socketRef.current = socket;
    const join = () => socket.emit('request:join', { requestId: id });
    join();
    socket.on('connect', join);

    const onStatus = (p) => {
      if (p.requestId !== id) return;
      setStatus(p.status);
      if (p.status === REQUEST_STATUS.SEARCHING) {
        setTanker(null);
        setTrackingLive(true);
      }
    };
    const onAssigned = (p) => {
      if (p.requestId !== id) return;
      setStatus(REQUEST_STATUS.DRIVER_ASSIGNED);
      setFulfiller({ name: p.fulfiller?.name, phone: p.phone, vehicle: p.vehicle, rating: p.fulfiller?.rating });
      setTrackingLive(true);
      if (p.etaMin) setEta(p.etaMin);
    };
    const onLocation = (p) => setTanker({ lat: p.lat, lng: p.lng });
    const onEta = (p) => p.etaMin && setEta(p.etaMin);
    const onTracking = (p) => p.requestId === id && setTrackingLive(p.live);
    const onCompleted = (p) => p.requestId === id && setStatus(REQUEST_STATUS.COMPLETED);

    socket.on(EVENTS.REQUEST_STATUS, onStatus);
    socket.on(EVENTS.REQUEST_ASSIGNED, onAssigned);
    socket.on(EVENTS.REQUEST_LOCATION, onLocation);
    socket.on(EVENTS.REQUEST_ETA, onEta);
    socket.on(EVENTS.REQUEST_TRACKING, onTracking);
    socket.on(EVENTS.REQUEST_COMPLETED, onCompleted);

    return () => {
      socket.off('connect', join);
      socket.off(EVENTS.REQUEST_STATUS, onStatus);
      socket.off(EVENTS.REQUEST_ASSIGNED, onAssigned);
      socket.off(EVENTS.REQUEST_LOCATION, onLocation);
      socket.off(EVENTS.REQUEST_ETA, onEta);
      socket.off(EVENTS.REQUEST_TRACKING, onTracking);
      socket.off(EVENTS.REQUEST_COMPLETED, onCompleted);
    };
  }, [id]);

  // Tick a 1s clock only while searching — drives the staged reassurance copy.
  // Resets to 0 whenever we (re-)enter SEARCHING, e.g. after a driver abandons.
  useEffect(() => {
    if (status !== REQUEST_STATUS.SEARCHING) {
      setSearchElapsed(0);
      return;
    }
    setSearchElapsed(0);
    const start = Date.now();
    const t = setInterval(() => setSearchElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(t);
  }, [status]);

  const handleCancel = async () => {
    if (!confirm('Cancel this request?')) return;
    await cancelRequest(id).catch(() => {});
    router.push('/orders');
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-dvh"><p className="text-sm text-text-muted">Loading…</p></div>;
  }
  if (!request) {
    return <div className="flex items-center justify-center min-h-dvh"><p className="text-sm text-red-600">Request not found.</p></div>;
  }

  const coords = request.dropLocation?.coordinates || [];
  const drop = coords.length ? { lng: coords[0], lat: coords[1] } : null;
  const shortId = request._id.slice(-6).toUpperCase();
  const isPendingPayment = status === REQUEST_STATUS.PENDING_PAYMENT;
  const isSearching = status === REQUEST_STATUS.SEARCHING;
  const isActive = [REQUEST_STATUS.DRIVER_ASSIGNED, REQUEST_STATUS.EN_ROUTE, REQUEST_STATUS.ARRIVED].includes(status);
  const isArrived = status === REQUEST_STATUS.ARRIVED;
  const isCompleted = status === REQUEST_STATUS.COMPLETED;
  const isFailed = [REQUEST_STATUS.NO_FULFILLER, REQUEST_STATUS.CANCELLED, REQUEST_STATUS.EXPIRED, REQUEST_STATUS.CUSTOMER_NO_SHOW].includes(status);
  const isNoShow = status === REQUEST_STATUS.CUSTOMER_NO_SHOW;
  const refunded = request.refundedAmount || 0;
  const dryRunFee = request.pricing?.dryRunFee || 0;
  const activeIdx = STEPS.findIndex((s) => s.key === status);
  const isPaid = request.paymentStatus === 'paid' || paidLocal;
  // UPI is paid at the door once a partner is on the way (or any time after).
  const canPayUpi = request.paymentMode === 'upi' && !isPaid && isActive;

  // Timeline timestamps from the status log → a "real journey" recap.
  const fmtClock = (d) => (d ? new Date(d).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }) : null);
  const timeFor = (key) => fmtClock((request.statusLog || []).find((x) => x.status === key)?.changedAt);
  const completedAt = request.completedAt || (request.statusLog || []).find((x) => x.status === REQUEST_STATUS.COMPLETED)?.changedAt;
  const assignedAt = (request.statusLog || []).find((x) => x.status === REQUEST_STATUS.DRIVER_ASSIGNED)?.changedAt;
  const durationMin = completedAt && assignedAt ? Math.max(1, Math.round((new Date(completedAt) - new Date(assignedAt)) / 60000)) : null;

  const litres = request.capacityLitres ? `${Number(request.capacityLitres).toLocaleString('en-IN')} L` : null;
  const itemName = request.productId?.name || (litres ? `${litres} tanker` : 'Tanker');
  const address = [request.dropLocation?.flat, request.dropLocation?.address].filter(Boolean).join(', ');
  const payLabel = request.paymentMode === 'cod' ? 'Cash on delivery' : isPaid ? 'Paid by UPI' : 'UPI on delivery';

  const reorder = () => router.push('/order/instant');
  const getHelp = () => router.push('/contact');
  const printReceipt = () => { if (typeof window !== 'undefined') window.print(); };

  const payByUpi = async () => {
    setPayError('');
    setPaying(true);
    try {
      const payRes = await createRequestPayment(id);
      const { razorpayOrderId, amount, keyId } = payRes.data.data;
      if (!keyId) {
        setPayError('Online payment is unavailable right now. You can pay cash on delivery.');
        setPaying(false);
        return;
      }
      const pay = await openRazorpayCheckout({
        razorpayOrderId, amount, keyId,
        name: request.dropLocation?.name || user?.name || '',
        email: user?.email || '',
        phone: request.dropLocation?.phone || user?.phone || '',
        description: `Tanker delivery WD-${shortId}`,
      });
      await verifyRequestPayment({
        requestId: id,
        razorpay_order_id: pay.razorpay_order_id,
        razorpay_payment_id: pay.razorpay_payment_id,
        razorpay_signature: pay.razorpay_signature,
      });
      setPaidLocal(true);
    } catch (e) {
      if (e?.message !== 'Payment cancelled by user') {
        setPayError(e?.response?.data?.error || 'Payment could not be completed.');
      }
    } finally {
      setPaying(false);
    }
  };

  const PayBlock = canPayUpi ? (
    <section className="card border-primary/30 bg-bg-trust/40">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-700 text-text-main">Pay ₹{request.pricing?.amount} by UPI</p>
          <p className="text-xs text-text-muted mt-0.5">Pay now, or hand cash to the partner.</p>
        </div>
        <span className="text-primary"><TankerIcon className="w-6 h-6" /></span>
      </div>
      {payError && <p className="text-xs text-red-600 mt-2">{payError}</p>}
      <button onClick={payByUpi} disabled={paying} className="btn-primary w-full py-3 mt-3 disabled:opacity-50">
        {paying ? 'Opening payment…' : `Pay ₹${request.pricing?.amount}`}
      </button>
    </section>
  ) : isPaid && request.paymentMode === 'upi' && !isCompleted ? (
    <div className="rounded-card border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-center text-xs font-medium text-emerald-800">
      Payment received — thank you!
    </div>
  ) : null;

  const TopBar = (
    <header className="flex items-center justify-between px-4 pb-2" style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top, 0px))' }}>
      <button onClick={() => router.push('/orders')} aria-label="Back to orders" className="icon-btn w-10 h-10 bg-white border border-border-default shadow-sm">
        <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#131b2e" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
      </button>
      <span className="text-[11px] font-medium text-text-muted">Order WD-{shortId}</span>
      <span className="w-10" />
    </header>
  );

  /* ---------- FAILED / CANCELLED / NO-SHOW: immersive full-screen end state ---------- */
  if (isFailed) {
    const isNoFulfiller = status === REQUEST_STATUS.NO_FULFILLER;
    const fail = isNoShow
      ? {
          glow: 'rgba(217,119,6,0.14)',
          ringBg: 'bg-amber-50',
          stroke: '#d97706',
          icon: 'M12 9v4m0 4h.01M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.7 3.86a2 2 0 0 0-3.42 0z',
          title: 'Driver couldn’t reach you',
          sub:
            refunded > 0
              ? `The partner waited at your drop-off but couldn’t reach you. We’ve refunded ₹${refunded}${dryRunFee ? ` — a ₹${dryRunFee} dry-run fee was kept for the trip` : ''}.`
              : 'The partner waited at your drop-off but couldn’t reach you. Please keep your phone reachable next time.',
        }
      : isNoFulfiller
      ? {
          glow: 'rgba(220,38,38,0.12)',
          ringBg: 'bg-red-50',
          stroke: '#dc2626',
          icon: 'M21 21l-4.2-4.2M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14zM8 11h6',
          title: 'No tanker available right now',
          sub: 'All our tankers are busy at the moment. Try again in a bit, or schedule a delivery for later.',
        }
      : {
          glow: 'rgba(100,116,139,0.14)',
          ringBg: 'bg-slate-100',
          stroke: '#64748b',
          icon: 'M18 6 6 18M6 6l12 12',
          title: status === REQUEST_STATUS.EXPIRED ? 'Request expired' : 'Request cancelled',
          sub: 'This request is no longer active.',
        };

    return (
      <main
        className="relative flex flex-col text-center"
        style={{
          minHeight: 'calc(100dvh - var(--nav-h) - env(safe-area-inset-bottom, 0px))',
          background: `radial-gradient(125% 78% at 50% 20%, ${fail.glow}, rgba(250,248,255,0) 68%), linear-gradient(180deg, #f6f7fb 0%, #faf8ff 56%)`,
        }}
      >
        {/* Floating controls */}
        <div className="flex items-center justify-between px-4" style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top, 0px))' }}>
          <button onClick={() => router.push('/orders')} aria-label="Back to orders" className="icon-btn w-10 h-10 bg-white/80 backdrop-blur border border-white/60 shadow-sm">
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#131b2e" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          </button>
          <span className="text-[11px] font-medium text-text-muted bg-white/70 backdrop-blur px-2.5 py-1 rounded-full">WD-{shortId}</span>
          <span className="w-10" />
        </div>

        {/* Centered hero */}
        <div className="flex-1 flex flex-col items-center justify-center px-6">
          <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 animate-pop ${fail.ringBg}`}>
            <svg width="34" height="34" fill="none" viewBox="0 0 24 24" stroke={fail.stroke} strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d={fail.icon} />
            </svg>
          </div>
          <h1 className="font-display text-[26px] leading-tight font-extrabold text-text-main">{fail.title}</h1>
          <p className="text-sm text-text-muted mt-2 max-w-[300px] mx-auto">{fail.sub}</p>

          {/* Actions */}
          <div className="w-full max-w-[300px] mt-9 flex flex-col gap-2.5">
            <button onClick={reorder} className="btn-primary w-full py-3.5 flex items-center justify-center gap-2">
              <TankerIcon className="w-5 h-5" /> Order again
            </button>
            {isNoFulfiller && (
              <button onClick={() => router.push('/order')} className="w-full py-3 rounded-btn border border-border-default bg-white text-text-main font-700 text-sm active:scale-[0.98] transition-transform">
                Schedule for later
              </button>
            )}
          </div>
        </div>

        {/* Help */}
        <div className="flex justify-center px-6 pb-6">
          <button onClick={getHelp} className="text-sm text-text-muted font-medium py-2 px-4 active:scale-95 transition-transform">
            Get help with this order
          </button>
        </div>
      </main>
    );
  }

  /* ---------- SEARCHING: immersive full-screen radar with staged copy ---------- */
  if (isSearching) {
    const stageIdx = SEARCH_STAGE_AT.reduce((acc, t, i) => (searchElapsed >= t ? i : acc), 0);
    const stage = SEARCH_STAGES[stageIdx];
    const round = Math.min(stageIdx, 2); // 3 offer rounds → 3 progress pills

    return (
      <main
        className="relative flex flex-col text-center"
        style={{
          minHeight: 'calc(100dvh - var(--nav-h) - env(safe-area-inset-bottom, 0px))',
          background:
            'radial-gradient(125% 78% at 50% 20%, rgba(0,55,176,0.16), rgba(0,55,176,0.045) 45%, rgba(250,248,255,0) 72%), linear-gradient(180deg, #eef4ff 0%, #faf8ff 58%)',
        }}
      >
        {/* Floating controls */}
        <div className="flex items-center justify-between px-4" style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top, 0px))' }}>
          <button onClick={() => router.push('/orders')} aria-label="Back to orders" className="icon-btn w-10 h-10 bg-white/80 backdrop-blur border border-white/60 shadow-sm">
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#131b2e" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          </button>
          <span className="text-[11px] font-medium text-text-muted bg-white/70 backdrop-blur px-2.5 py-1 rounded-full">WD-{shortId}</span>
          <span className="w-10" />
        </div>

        {/* Centered hero */}
        <div className="flex-1 flex flex-col items-center justify-center px-6">
          {/* Radar */}
          <div className="relative w-36 h-36 flex items-center justify-center mb-9">
            <span className="absolute inset-0 rounded-full bg-primary/15 radar-ring" />
            <span className="absolute inset-0 rounded-full bg-primary/15 radar-ring" style={{ animationDelay: '0.7s' }} />
            <span className="absolute inset-0 rounded-full bg-primary/15 radar-ring" style={{ animationDelay: '1.4s' }} />
            <div className="relative w-[88px] h-[88px] rounded-full bg-gradient-to-br from-primary to-primary-hover flex items-center justify-center text-white shadow-xl shadow-primary/30 animate-bob">
              <TankerIcon className="w-11 h-11" />
            </div>
          </div>

          {/* Stage copy — re-mounts (and replays the rise) on each stage change */}
          <div key={stageIdx} className="animate-rise">
            <h1 className="font-display text-[26px] leading-tight font-extrabold text-text-main">{stage.title}</h1>
            <p className="text-sm text-text-muted mt-2 max-w-[300px] mx-auto">{stage.sub}</p>
          </div>

          {/* Stage progress pills (one per offer round) */}
          <div className="flex items-center gap-2 mt-6">
            {[0, 1, 2].map((i) => {
              const filled = round >= i;
              const active = round === i;
              return (
                <span
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-500 ${
                    active ? 'w-8 bg-primary animate-pulse' : filled ? 'w-5 bg-primary' : 'w-5 bg-primary/20'
                  }`}
                />
              );
            })}
          </div>

          {/* Order summary — plain text, no card */}
          <div className="mt-10">
            <p className="text-sm font-700 text-text-main">{itemName} · ₹{request.pricing?.amount}</p>
            {address && <p className="text-xs text-text-muted mt-1 max-w-[300px] mx-auto">{address}</p>}
          </div>
        </div>

        {/* Cancel */}
        <div className="flex justify-center px-6 pb-6">
          <button onClick={handleCancel} className="text-sm text-red-600 font-medium py-2 px-4 active:scale-95 transition-transform">
            Cancel request
          </button>
        </div>
      </main>
    );
  }

  /* ---------- LIVE (assigned / en route / arrived): map + rising sheet ---------- */
  if (isActive) {
    const heroLabel = isArrived ? 'Status' : 'Arriving in';
    const heroValue = isArrived ? 'At your door' : eta != null ? `~${eta} min` : status === REQUEST_STATUS.DRIVER_ASSIGNED ? 'Getting ready' : 'On the way';
    return (
      <main className="bg-bg-page min-h-dvh pb-24">
        <section className="h-[56dvh] relative">
          {drop ? <TrackMap drop={drop} tanker={tanker} /> : <div className="w-full h-full bg-gradient-to-b from-blue-50 to-slate-100" />}
          {/* Gradient overlays — top tint for control contrast, bottom fade blends the map into the rising sheet. pointer-events-none keeps the map interactive. */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-28 z-[450] bg-gradient-to-b from-primary/25 to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-44 z-[450] bg-gradient-to-t from-[#faf8ff] via-[#faf8ff]/80 to-transparent" />
          <button onClick={() => router.push('/orders')} aria-label="Back to orders" className="icon-btn absolute left-4 w-11 h-11 bg-white shadow" style={{ top: 'calc(1rem + env(safe-area-inset-top, 0px))' }}>
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#131b2e" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          </button>
          <span className="absolute right-4 text-[11px] font-medium bg-white/90 px-2.5 py-1 rounded-full shadow text-text-muted" style={{ top: 'calc(1rem + env(safe-area-inset-top, 0px))' }}>WD-{shortId}</span>
        </section>

        {/* Rising sheet over the map */}
        <div className="relative z-10 mt-5 rounded-t-3xl bg-bg-page px-4 pt-5 flex flex-col gap-3">
          <section className="card animate-rise">
            <div className="flex items-end justify-between mb-4">
              <div>
                <p className="text-[11px] font-medium text-text-muted uppercase tracking-wide">{heroLabel}</p>
                <p className="font-display text-[26px] leading-none font-extrabold text-text-main mt-1">{heroValue}</p>
              </div>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-primary bg-bg-trust px-2.5 py-1 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" /> Live
              </span>
            </div>
            <Journey activeIdx={activeIdx} timeFor={timeFor} />
            {!trackingLive && (
              <div className="mt-4 rounded-btn border border-amber-200 bg-amber-50 px-3 py-2 text-center">
                <p className="text-[11px] font-medium text-amber-800">Live tracking paused — your partner is reconnecting…</p>
              </div>
            )}
          </section>

          {PayBlock}

          {fulfiller && <section className="card"><PartnerRow fulfiller={fulfiller} /></section>}

          {/* Compact order line */}
          <section className="card">
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-main">{itemName}</span>
              <span className="text-sm font-700 text-text-main">₹{request.pricing?.amount}</span>
            </div>
            {address && <p className="text-xs text-text-muted mt-1">{address}</p>}
            <p className="text-[11px] text-text-muted mt-0.5">Payment: {payLabel}</p>
          </section>

          {!isArrived && (
            <button onClick={handleCancel} className="text-xs text-red-600 font-medium py-2">Cancel request</button>
          )}
        </div>
      </main>
    );
  }

  /* ----------------------------- non-map states ----------------------------- */
  return (
    <main className="bg-bg-page min-h-dvh pb-24">
      {TopBar}
      <div className="px-4 pt-2 flex flex-col gap-3">

        {/* Confirming payment */}
        {isPendingPayment && (
          <section className="card text-center py-10">
            <div className="mx-auto w-12 h-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin mb-3" />
            <p className="text-sm font-700 text-text-main">Confirming your payment…</p>
            <p className="text-xs text-text-muted mt-1">We'll start finding a tanker as soon as it clears.</p>
          </section>
        )}

        {/* Delivered — success hero + receipt + reorder */}
        {isCompleted && (
          <>
            <section className="card overflow-hidden text-center pt-9 pb-7 bg-gradient-to-b from-emerald-50/70 to-white border-emerald-100">
              <div className="relative mx-auto w-20 h-20 mb-4 animate-pop">
                <span className="absolute inset-0 rounded-full bg-emerald-400/30 ripple-ring" />
                <span className="absolute inset-0 rounded-full bg-emerald-400/20 ripple-ring" style={{ animationDelay: '.7s' }} />
                <div className="relative w-20 h-20 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                  <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                    <path className="check-draw" d="m5 12.5 4.5 4.5L19 6.5" />
                  </svg>
                </div>
              </div>
              <h1 className="font-display text-2xl font-extrabold text-text-main">Delivered</h1>
              <p className="text-xs text-text-muted mt-1">
                {[fmtClock(completedAt), litres, durationMin ? `${durationMin} min door-to-door` : null].filter(Boolean).join(' · ')}
              </p>
            </section>

            {/* Journey recap with timestamps */}
            <section className="card"><Journey activeIdx={4} timeFor={timeFor} /></section>

            {fulfiller && <section className="card"><PartnerRow fulfiller={fulfiller} completed /></section>}

            {/* Rate */}
            <ReviewForm source="request" id={id} partnerName={fulfiller?.name} />

            {/* Receipt — total is the hero */}
            <section className="card">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-700 text-text-muted uppercase tracking-wide">Receipt</h2>
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                  <CheckIcon className="w-3 h-3" /> Paid · {request.paymentMode?.toUpperCase()}
                </span>
              </div>
              <div className="flex justify-between text-sm py-0.5">
                <span className="text-text-main">{itemName}</span>
                <span className="font-medium tabular-nums">₹{request.pricing?.fare ?? request.pricing?.amount}</span>
              </div>
              {request.pricing?.platformFee != null && (
                <div className="flex justify-between text-xs text-text-muted py-0.5">
                  <span>Platform fee (5%)</span>
                  <span className="tabular-nums">₹{request.pricing.platformFee}</span>
                </div>
              )}
              <div className="border-t border-dashed border-border-default my-2" />
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-700 text-text-main">Total paid</span>
                <span className="font-display text-2xl font-extrabold text-text-main tabular-nums">₹{request.pricing?.amount}</span>
              </div>
              {address && <p className="text-xs text-text-muted mt-3">{address}</p>}
              {request.dropLocation?.directions && <p className="text-[11px] text-text-muted mt-0.5">Directions: {request.dropLocation.directions}</p>}
              <button onClick={printReceipt} className="text-xs font-medium text-primary mt-3">Download receipt</button>
            </section>

            {/* Primary actions */}
            <button onClick={reorder} className="btn-primary w-full py-3.5 flex items-center justify-center gap-2">
              <TankerIcon className="w-5 h-5" /> Order again
            </button>
            <button onClick={getHelp} className="btn-ghost w-full py-2.5 -mt-1">Get help with this order</button>
          </>
        )}
      </div>
    </main>
  );
}
