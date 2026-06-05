'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getMyTickets } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import SUPPORT_TEMPLATES from '@/constants/supportTemplates';

const BADGE = {
  open:        { cls: 'badge-amber', dot: 'bg-amber-400',   label: 'Open' },
  in_progress: { cls: 'badge-blue',  dot: 'bg-primary',     label: 'In progress' },
  resolved:    { cls: 'badge-green', dot: 'bg-emerald-500', label: 'Resolved' },
  closed:      { cls: 'badge-red',   dot: 'bg-slate-400',   label: 'Closed' },
};
const fmt = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

export default function SupportTicketsPanel() {
  const { user } = useAuthStore();
  const [tickets, setTickets] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!useAuthStore.getState().user) { setLoaded(true); return; }
    getMyTickets().then((res) => setTickets(res.data.data)).catch(() => {}).finally(() => setLoaded(true));
  }, [user]);

  return (
    <section className="mt-6">
      {/* Existing requests */}
      {loaded && tickets.length > 0 && (
        <div className="mb-6">
          <p className="text-xs font-700 text-text-muted uppercase tracking-wide mb-2">Your requests</p>
          <div className="flex flex-col gap-3">
            {tickets.map((t) => {
              const badge = BADGE[t.status] ?? BADGE.open;
              return (
                <Link key={t._id} href={`/contact/${t._id}`} className="card block hover:shadow-sm transition-shadow">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="text-sm font-700 text-text-main truncate">{t.subject}</p>
                    <span className={`${badge.cls} flex items-center gap-1.5 shrink-0`}>
                      <span className={`w-2 h-2 rounded-full ${badge.dot}`} />{badge.label}
                    </span>
                  </div>
                  <p className="text-xs text-text-muted">
                    #{t._id.slice(-6).toUpperCase()}{t.orderRef ? ` · ${t.orderRef}` : ''} · {fmt(t.updatedAt)}
                  </p>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Raise a request — templated topics */}
      <p className="text-xs font-700 text-text-muted uppercase tracking-wide mb-2">Raise a request</p>
      <div className="flex flex-col gap-4">
        {SUPPORT_TEMPLATES.map((grp) => (
          <div key={grp.group}>
            <p className="text-[13px] font-700 text-text-main mb-2">{grp.group}</p>
            <div className="card p-0 overflow-hidden divide-y divide-border-default">
              {grp.items.map((item) => (
                <Link key={item.id} href={`/contact/new?t=${item.id}`}
                  className="flex items-center justify-between px-4 py-3.5 hover:bg-bg-card transition-colors">
                  <span className="text-sm text-text-main">{item.label}</span>
                  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#94a3b8" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
