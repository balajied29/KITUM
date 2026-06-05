'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getUserOrders, getMyRequests } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import AppHeader from '@/components/AppHeader';
import Footer from '@/components/Footer';

// Scheduled Order statuses
const ORDER_BADGE = {
  pending:          { cls: 'badge-amber',  dot: 'bg-amber-400',   label: 'Pending' },
  confirmed:        { cls: 'badge-blue',   dot: 'bg-primary',     label: 'Confirmed' },
  out_for_delivery: { cls: 'badge-blue',   dot: 'bg-accent',      label: 'Out for Delivery' },
  delivered:        { cls: 'badge-green',  dot: 'bg-emerald-500', label: 'Delivered' },
  cancelled:        { cls: 'badge-red',    dot: 'bg-red-500',     label: 'Cancelled' },
};
// Instant DeliveryRequest statuses
const REQUEST_BADGE = {
  pending_payment:  { cls: 'badge-amber',  dot: 'bg-amber-400',   label: 'Payment pending' },
  searching:        { cls: 'badge-blue',   dot: 'bg-primary',     label: 'Finding tanker' },
  driver_assigned:  { cls: 'badge-blue',   dot: 'bg-primary',     label: 'Assigned' },
  en_route:         { cls: 'badge-blue',   dot: 'bg-accent',      label: 'On the way' },
  arrived:          { cls: 'badge-blue',   dot: 'bg-accent',      label: 'Arrived' },
  completed:        { cls: 'badge-green',  dot: 'bg-emerald-500', label: 'Delivered' },
  cancelled:        { cls: 'badge-red',    dot: 'bg-red-500',     label: 'Cancelled' },
  expired:          { cls: 'badge-red',    dot: 'bg-red-500',     label: 'Expired' },
  no_fulfiller:     { cls: 'badge-red',    dot: 'bg-red-500',     label: 'No tanker found' },
};

const fmtDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

export default function OrdersPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!useAuthStore.getState().user) { router.replace('/login?next=/orders'); return; }

    // Both delivery types live in one list: scheduled Orders + instant Requests.
    Promise.allSettled([getUserOrders(), getMyRequests()])
      .then(([ordersRes, requestsRes]) => {
        const orders = (ordersRes.value?.data?.data || []).map((o) => ({
          id: o._id,
          kind: 'order',
          href: `/status/${o._id}`,
          createdAt: o.createdAt,
          amount: o.totalAmount,
          badge: ORDER_BADGE[o.status] ?? ORDER_BADGE.pending,
          heading: `Order #${o._id.slice(-6).toUpperCase()}`,
          meta: `${o.items?.length || 0} item${o.items?.length !== 1 ? 's' : ''} · ${o.paymentMode === 'cod' ? 'Cash on Delivery' : 'Paid Online'}`,
          when: o.slotId ? `${fmtDate(o.slotId.date)} · ${o.slotId.slotLabel}` : null,
        }));
        const requests = (requestsRes.value?.data?.data || []).map((r) => ({
          id: r._id,
          kind: 'request',
          href: `/track/${r._id}`,
          createdAt: r.createdAt,
          amount: r.pricing?.amount,
          badge: REQUEST_BADGE[r.status] ?? REQUEST_BADGE.searching,
          heading: `Tanker #${r._id.slice(-6).toUpperCase()}`,
          meta: `${r.productId?.name || `${r.capacityLitres}L tanker`} · Instant`,
          when: 'Now',
        }));
        setItems([...orders, ...requests].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
      })
      .finally(() => setLoading(false));
  }, [user, router]);

  return (
    <main className="pb-2">
      <AppHeader showLocality={false} />
      <div className="px-4 pt-3">
      <h1 className="text-base font-700 text-text-main mb-5">My Orders</h1>

      {loading && (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => <div key={i} className="card h-20 animate-pulse bg-bg-card" />)}
        </div>
      )}

      {!loading && items.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <svg width="40" height="40" fill="none" viewBox="0 0 24 24" stroke="#e2e8f0" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p className="text-sm text-text-muted">No orders yet.</p>
          <Link href="/order" className="btn-primary text-sm">Order Now</Link>
        </div>
      )}

      {!loading && items.length > 0 && (
        <div className="flex flex-col gap-3">
          {items.map((it) => (
            <Link key={`${it.kind}-${it.id}`} href={it.href} className="card hover:shadow-sm transition-shadow block">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="text-xs text-text-muted font-medium uppercase tracking-wide">{it.heading}</p>
                  <p className="text-sm font-700 text-text-main mt-0.5">₹{it.amount}</p>
                </div>
                <span className={`${it.badge.cls} flex items-center gap-1.5`}>
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${it.badge.dot}`} />
                  {it.badge.label}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-text-muted">
                <span>{it.meta}</span>
                {it.when && <span>{it.when}</span>}
              </div>
            </Link>
          ))}
        </div>
      )}
      </div>

      <Footer />
    </main>
  );
}
