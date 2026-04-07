'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getUserOrders } from '@/lib/api';
import { useAuthStore } from '@/lib/store';

const STATUS_BADGE = {
  pending:          { cls: 'badge-amber',  dot: 'bg-amber-400',   label: 'Pending' },
  confirmed:        { cls: 'badge-blue',   dot: 'bg-primary',     label: 'Confirmed' },
  out_for_delivery: { cls: 'badge-blue',   dot: 'bg-accent',      label: 'Out for Delivery' },
  delivered:        { cls: 'badge-green',  dot: 'bg-emerald-500', label: 'Delivered' },
  cancelled:        { cls: 'badge-red',    dot: 'bg-red-500',     label: 'Cancelled' },
};

export default function OrdersPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { router.replace('/login'); return; }
    getUserOrders()
      .then((res) => setOrders(res.data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  return (
    <main className="px-4 pt-5 pb-6">
      <h1 className="text-base font-700 text-text-main mb-5">My Orders</h1>

      {loading && (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => <div key={i} className="card h-20 animate-pulse bg-bg-card" />)}
        </div>
      )}

      {!loading && orders.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <svg width="40" height="40" fill="none" viewBox="0 0 24 24" stroke="#e2e8f0" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p className="text-sm text-text-muted">No orders yet.</p>
          <Link href="/order" className="btn-primary text-sm">Order Now</Link>
        </div>
      )}

      {!loading && orders.length > 0 && (
        <div className="flex flex-col gap-3">
          {orders.map((order) => {
            const badge = STATUS_BADGE[order.status] ?? STATUS_BADGE.pending;
            const slot = order.slotId;
            return (
              <Link key={order._id} href={`/status/${order._id}`} className="card hover:shadow-sm transition-shadow block">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-xs text-text-muted font-medium uppercase tracking-wide">
                      Order #{order._id.slice(-6).toUpperCase()}
                    </p>
                    <p className="text-sm font-700 text-text-main mt-0.5">
                      ₹{order.totalAmount}
                    </p>
                  </div>
                  <span className={`${badge.cls} flex items-center gap-1.5`}>
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${badge.dot}`} />
                    {badge.label}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs text-text-muted">
                  <span>
                    {order.items?.length} item{order.items?.length !== 1 ? 's' : ''}
                    {' · '}
                    {order.paymentMode === 'cod' ? 'Cash on Delivery' : 'Paid Online'}
                  </span>
                  {slot && (
                    <span>
                      {new Date(slot.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      {' · '}{slot.slotLabel}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
