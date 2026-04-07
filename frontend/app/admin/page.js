'use client';
import { useEffect, useState } from 'react';
import { adminGetOrders, adminUpdateStatus, adminAssignDriver } from '@/lib/api';

const STATUSES = ['pending','confirmed','out_for_delivery','delivered','cancelled'];

const STATUS_BADGE = {
  pending:          'badge-amber',
  confirmed:        'badge-blue',
  out_for_delivery: 'badge-blue',
  delivered:        'badge-green',
  cancelled:        'badge-red',
};

const STATUS_DOT = {
  pending: 'bg-amber-400', confirmed: 'bg-primary',
  out_for_delivery: 'bg-accent', delivered: 'bg-emerald-500', cancelled: 'bg-red-500',
};

export default function AdminDashboard() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  const fetchOrders = () => {
    setLoading(true);
    adminGetOrders({ status: filter || undefined, date: dateFilter || undefined })
      .then((res) => setOrders(res.data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(fetchOrders, [filter, dateFilter]);

  const today = orders.filter((o) => {
    const d = new Date(o.createdAt);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  });

  const revenue = today.filter((o) => o.paymentStatus === 'paid').reduce((s, o) => s + o.totalAmount, 0);

  const handleStatus = async (id, status) => {
    await adminUpdateStatus(id, status);
    fetchOrders();
  };

  return (
    <div>
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Today's Orders", value: today.length },
          { label: 'Revenue (₹)',    value: revenue.toLocaleString('en-IN') },
          { label: 'Pending',        value: orders.filter((o) => o.status === 'pending').length },
          { label: 'Out for Delivery', value: orders.filter((o) => o.status === 'out_for_delivery').length },
        ].map((s) => (
          <div key={s.label} className="card">
            <p className="text-xs text-text-muted mb-1">{s.label}</p>
            <p className="text-2xl font-700 text-text-main">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <input type="date" className="input max-w-[160px]" value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)} />
        <select className="input max-w-[160px]" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}
        </select>
      </div>

      {/* Orders table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-bg-card border-b border-border-default">
              <tr>
                {['Order ID','Customer','Slot','Items','Total','Status','Action'].map((h) => (
                  <th key={h} className="text-left text-xs font-700 text-text-muted px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-6 text-center text-xs text-text-muted">Loading…</td></tr>
              ) : orders.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-6 text-center text-xs text-text-muted">No orders found.</td></tr>
              ) : orders.map((o) => (
                <tr key={o._id} className="border-b border-border-default last:border-0 hover:bg-bg-card transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-text-muted">{o._id.slice(-6).toUpperCase()}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-text-main">{o.userId?.name ?? '—'}</p>
                    <p className="text-xs text-text-muted">{o.userId?.email}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-text-muted">
                    {o.slotId ? `${o.slotId.slotLabel} · ${new Date(o.slotId.date).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-text-muted">{o.items?.length} item(s)</td>
                  <td className="px-4 py-3 font-medium text-text-main">₹{o.totalAmount}</td>
                  <td className="px-4 py-3">
                    <span className={`${STATUS_BADGE[o.status]} flex items-center gap-1.5`}>
                      <span className={`w-2 h-2 rounded-full ${STATUS_DOT[o.status]}`} />
                      {o.status.replace(/_/g,' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <select className="input py-1 text-xs max-w-[150px]" value={o.status}
                      onChange={(e) => handleStatus(o._id, e.target.value)}>
                      {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
