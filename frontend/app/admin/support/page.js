'use client';
import { useEffect, useState } from 'react';
import { adminGetTickets, adminReplyTicket, adminUpdateTicketStatus } from '@/lib/api';

const STATUSES = ['open', 'in_progress', 'resolved', 'closed'];
const CATEGORIES = ['delivery', 'payment', 'quality', 'scheduling', 'account', 'other'];
const BADGE = {
  open:        'badge-amber',
  in_progress: 'badge-blue',
  resolved:    'badge-green',
  closed:      'badge-red',
};
const fmt = (d) => new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

function TicketModal({ ticket, onClose, onChanged }) {
  const [t, setT] = useState(ticket);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);

  const send = async () => {
    if (!reply.trim()) return;
    setBusy(true);
    try {
      const res = await adminReplyTicket(t._id, reply.trim());
      setT(res.data.data); setReply(''); onChanged();
    } finally { setBusy(false); }
  };
  const setStatus = async (status) => {
    const res = await adminUpdateTicketStatus(t._id, status);
    setT(res.data.data); onChanged();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-lg bg-white rounded-card max-h-[88dvh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="border-b border-border-default px-5 py-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-700 text-text-main truncate">{t.subject}</p>
            <p className="text-xs text-text-muted truncate">
              {t.userId?.name || '—'}{t.userId?.role === 'fulfiller' ? ' (Partner)' : ''} · {t.userId?.phone || t.userId?.email || ''}{t.orderRef ? ` · ${t.orderRef}` : ''} · {t.category}
            </p>
          </div>
          <select className="input py-1 text-xs max-w-[130px]" value={t.status} onChange={(e) => setStatus(e.target.value)}>
            {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
          </select>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3">
          {t.messages.map((m, i) => {
            const mine = m.from === 'support';
            return (
              <div key={i} className={`max-w-[85%] flex flex-col ${mine ? 'self-end items-end' : 'self-start items-start'}`}>
                <div className={`rounded-card px-3.5 py-2.5 text-sm whitespace-pre-wrap break-words ${mine ? 'bg-primary text-white rounded-br-sm' : 'bg-bg-card text-text-main rounded-bl-sm'}`}>{m.body}</div>
                <span className="text-[10px] text-text-muted mt-1 px-1">{mine ? 'Support' : (t.userId?.name || 'Customer')} · {fmt(m.at)}</span>
              </div>
            );
          })}
        </div>

        <div className="border-t border-border-default px-5 py-3 flex items-end gap-2">
          <textarea className="input flex-1 min-h-[44px] max-h-28 resize-none py-2.5" placeholder="Reply to the customer…" rows={1}
            value={reply} onChange={(e) => setReply(e.target.value)} />
          <button onClick={send} disabled={busy || !reply.trim()} className="btn-primary px-4 shrink-0 disabled:opacity-50">{busy ? '…' : 'Send'}</button>
        </div>
      </div>
    </div>
  );
}

export default function AdminSupportPage() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
  const [open, setOpen] = useState(null);

  const fetchTickets = () => {
    setLoading(true);
    adminGetTickets({ status: status || undefined, category: category || undefined })
      .then((res) => setTickets(res.data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(fetchTickets, [status, category]);

  const openCount = tickets.filter((t) => t.status === 'open').length;

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total tickets', value: tickets.length },
          { label: 'Open', value: openCount },
          { label: 'In progress', value: tickets.filter((t) => t.status === 'in_progress').length },
          { label: 'Resolved', value: tickets.filter((t) => t.status === 'resolved').length },
        ].map((s) => (
          <div key={s.label} className="card"><p className="text-xs text-text-muted mb-1">{s.label}</p><p className="text-2xl font-700 text-text-main">{s.value}</p></div>
        ))}
      </div>

      <div className="flex gap-3 mb-4 flex-wrap">
        <select className="input max-w-[160px]" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
        <select className="input max-w-[160px]" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All categories</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-bg-card border-b border-border-default">
              <tr>{['Subject', 'From', 'Category', 'Updated', 'Status'].map((h) => (
                <th key={h} className="text-left text-xs font-700 text-text-muted px-4 py-3">{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-xs text-text-muted">Loading…</td></tr>
              ) : tickets.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-xs text-text-muted">No tickets.</td></tr>
              ) : tickets.map((t) => (
                <tr key={t._id} onClick={() => setOpen(t)} className="border-b border-border-default last:border-0 hover:bg-bg-card transition-colors cursor-pointer">
                  <td className="px-4 py-3">
                    <p className="font-medium text-text-main truncate max-w-[200px]">{t.subject}</p>
                    <p className="text-xs text-text-muted">#{t._id.slice(-6).toUpperCase()}{t.orderRef ? ` · ${t.orderRef}` : ''}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-text-muted">
                    {t.userId?.name || '—'}
                    {t.userId?.role === 'fulfiller' && <span className="ml-1.5 text-[10px] font-700 bg-blue-50 text-primary px-1.5 py-0.5 rounded-chip align-middle">Partner</span>}
                    <br/>{t.userId?.phone || t.userId?.email}
                  </td>
                  <td className="px-4 py-3 text-xs text-text-muted">{t.category}</td>
                  <td className="px-4 py-3 text-xs text-text-muted">{fmt(t.updatedAt)}</td>
                  <td className="px-4 py-3"><span className={`${BADGE[t.status]}`}>{t.status.replace(/_/g, ' ')}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {open && <TicketModal ticket={open} onClose={() => setOpen(null)} onChanged={fetchTickets} />}
    </div>
  );
}
