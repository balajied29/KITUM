'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getOrderById } from '@/lib/api';
import OrderStepper from '@/components/OrderStepper';
import AppHeader from '@/components/AppHeader';

const STATUS_BADGE = {
  pending:          { cls: 'badge-amber',  dot: 'bg-amber-400',   label: 'Pending' },
  confirmed:        { cls: 'badge-blue',   dot: 'bg-primary',     label: 'Confirmed' },
  out_for_delivery: { cls: 'badge-blue',   dot: 'bg-accent',      label: 'Out for Delivery' },
  delivered:        { cls: 'badge-green',  dot: 'bg-emerald-500', label: 'Delivered' },
  cancelled:        { cls: 'badge-red',    dot: 'bg-red-500',     label: 'Cancelled' },
};

export default function OrderStatusPage() {
  const { id } = useParams();
  const router = useRouter();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getOrderById(id)
      .then((res) => setOrder(res.data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div className="flex items-center justify-center min-h-dvh">
      <p className="text-sm text-text-muted">Loading order…</p>
    </div>
  );
  if (!order) return (
    <div className="flex items-center justify-center min-h-dvh">
      <p className="text-sm text-red-600">Order not found.</p>
    </div>
  );

  const badge = STATUS_BADGE[order.status] ?? STATUS_BADGE.pending;
  const shortId = order._id.slice(-6).toUpperCase();
  const isOutForDelivery = order.status === 'out_for_delivery';

  return (
    <main className="pb-6">
      <AppHeader showLocality={false} />

      {/* Order ID + status header */}
      <div className="px-4 mb-3 flex items-center justify-between">
        <div>
          <p className="text-[11px] text-text-muted font-medium uppercase tracking-wide">Order ID: WD-{shortId}</p>
        </div>
        <span className={`${badge.cls} flex items-center gap-1.5`}>
          <span className={`w-2 h-2 rounded-full ${badge.dot}`} />
          {badge.label}
        </span>
      </div>

      {/* Map / delivery visual */}
      <section className="mx-4 mb-4 rounded-card overflow-hidden border border-border-default h-36 bg-bg-card relative flex items-center justify-center">
        <div className="absolute inset-0 bg-gradient-to-b from-blue-50 to-slate-100" />
        {/* Grid lines to simulate map */}
        <svg className="absolute inset-0 w-full h-full opacity-20" viewBox="0 0 300 144">
          {[0,48,96,144].map(y => <line key={y} x1="0" y1={y} x2="300" y2={y} stroke="#94a3b8" strokeWidth="1"/>)}
          {[0,60,120,180,240,300].map(x => <line key={x} x1={x} y1="0" x2={x} y2="144" stroke="#94a3b8" strokeWidth="1"/>)}
        </svg>
        {isOutForDelivery && (
          <button className="relative z-10 bg-primary text-white text-xs font-medium px-4 py-2 rounded-btn flex items-center gap-2 shadow-sm">
            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Out for Delivery
          </button>
        )}
        {!isOutForDelivery && (
          <div className="relative z-10 flex flex-col items-center gap-1">
            <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="#1d4ed8" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <p className="text-xs text-text-muted font-medium">{order.deliveryAddress?.locality || 'Shillong'}</p>
          </div>
        )}
      </section>

      <div className="px-4 flex flex-col gap-3">
        {/* Status stepper */}
        <section className="card">
          <OrderStepper status={order.status} statusLog={order.statusLog} />
        </section>

        {/* Items */}
        <section className="card">
          <h2 className="text-xs font-700 text-text-muted uppercase tracking-wide mb-3">Items</h2>
          {order.items.map((item, i) => (
            <div key={i} className="flex justify-between text-sm py-1">
              <span className="text-text-main">{item.productId?.name ?? 'Product'} × {item.quantity}</span>
              <span className="font-medium">₹{item.pricePerUnit * item.quantity}</span>
            </div>
          ))}
          <div className="border-t border-border-default mt-2 pt-2 flex justify-between text-sm font-700">
            <span>Total</span>
            <span>₹{order.totalAmount}</span>
          </div>
        </section>

        {/* Slot + address */}
        <section className="card">
          <h2 className="text-xs font-700 text-text-muted uppercase tracking-wide mb-2">Delivery</h2>
          {order.slotId && (
            <p className="text-sm text-text-main mb-1">
              {new Date(order.slotId.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              {' · '}{order.slotId.slotLabel} ({order.slotId.startTime}–{order.slotId.endTime})
            </p>
          )}
          <p className="text-sm text-text-muted">
            {[order.deliveryAddress?.street, order.deliveryAddress?.landmark, order.deliveryAddress?.locality].filter(Boolean).join(', ')}
          </p>
        </section>

        {/* Driver */}
        {order.driverAssigned && (
          <section className="card">
            <p className="text-xs text-text-muted mb-2">Your Delivery Partner</p>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-sm font-700 text-primary">
                  {order.driverAssigned.name?.[0] ?? 'D'}
                </div>
                <div>
                  <p className="text-sm font-700 text-text-main">{order.driverAssigned.name}</p>
                  <div className="flex items-center gap-1">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="#f59e0b">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                    </svg>
                    <span className="text-xs text-text-muted">4.9</span>
                  </div>
                </div>
              </div>
              {order.driverAssigned.phone && (
                <div className="flex gap-2">
                  <a href={`tel:${order.driverAssigned.phone}`}
                    className="w-9 h-9 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#16a34a" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                  </a>
                  <a href={`https://wa.me/91${order.driverAssigned.phone}`} target="_blank" rel="noreferrer"
                    className="w-9 h-9 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="#16a34a">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                  </a>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Reorder */}
        <button
          onClick={() => router.push('/order')}
          className="btn-primary w-full py-3 text-sm flex items-center justify-center gap-2"
        >
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Reorder WD-{shortId}
        </button>
      </div>
    </main>
  );
}
