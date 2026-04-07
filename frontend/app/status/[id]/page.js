'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getOrderById } from '@/lib/api';
import OrderStepper from '@/components/OrderStepper';

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

  if (loading) return <div className="px-4 pt-10 text-sm text-text-muted">Loading order…</div>;
  if (!order) return <div className="px-4 pt-10 text-sm text-red-600">Order not found.</div>;

  const badge = STATUS_BADGE[order.status] ?? STATUS_BADGE.pending;

  return (
    <main className="px-4 pt-5 pb-6">
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => router.push('/')} className="text-text-muted hover:text-text-main transition-colors">
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <p className="text-[11px] text-text-muted font-medium uppercase tracking-wide">Order ID: {order._id.slice(-6).toUpperCase()}</p>
          <h1 className="text-base font-700 text-text-main leading-tight">Order Status</h1>
        </div>
        <span className={`ml-auto ${badge.cls} flex items-center gap-1.5`}>
          <span className={`w-2 h-2 rounded-full ${badge.dot}`} />
          {badge.label}
        </span>
      </div>

      {/* Status stepper */}
      <section className="card mb-4">
        <OrderStepper status={order.status} statusLog={order.statusLog} />
      </section>

      {/* Order items */}
      <section className="card mb-4">
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
      <section className="card mb-4">
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
        <section className="card mb-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-bg-card border border-border-default flex items-center justify-center text-sm font-700 text-primary">
            {order.driverAssigned.name?.[0] ?? 'D'}
          </div>
          <div>
            <p className="text-xs text-text-muted">Your delivery partner</p>
            <p className="text-sm font-medium text-text-main">{order.driverAssigned.name}</p>
          </div>
        </section>
      )}

      <button onClick={() => router.push('/order')} className="btn-ghost w-full text-sm border border-primary">
        Reorder
      </button>
    </main>
  );
}
