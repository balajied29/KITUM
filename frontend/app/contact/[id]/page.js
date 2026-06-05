'use client';
import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AppHeader from '@/components/AppHeader';
import { getTicket, replyTicket, closeTicket } from '@/lib/api';
import { useAuthStore } from '@/lib/store';

const BADGE = {
  open:        { cls: 'badge-amber', dot: 'bg-amber-400',   label: 'Open' },
  in_progress: { cls: 'badge-blue',  dot: 'bg-primary',     label: 'In progress' },
  resolved:    { cls: 'badge-green', dot: 'bg-emerald-500', label: 'Resolved' },
  closed:      { cls: 'badge-red',   dot: 'bg-slate-400',   label: 'Closed' },
};
const fmtTime = (d) => new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

export default function SupportThreadPage() {
  const { id } = useParams();
  const router = useRouter();
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const endRef = useRef(null);

  useEffect(() => {
    if (!useAuthStore.getState().user) { router.replace(`/login?next=/contact/${id}`); return; }
    getTicket(id).then((res) => setTicket(res.data.data)).catch(() => {}).finally(() => setLoading(false));
  }, [id, router]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [ticket?.messages?.length]);

  const send = async () => {
    if (!reply.trim()) return;
    setBusy(true);
    setError('');
    try {
      const res = await replyTicket(id, reply.trim());
      setTicket(res.data.data);
      setReply('');
    } catch (e) {
      setError(e?.response?.data?.error || 'Could not send.');
    } finally {
      setBusy(false);
    }
  };

  const markClosed = async () => {
    try {
      const res = await closeTicket(id);
      setTicket(res.data.data);
    } catch { /* ignore */ }
  };

  if (loading) return <div className="flex items-center justify-center min-h-dvh"><p className="text-sm text-text-muted">Loading…</p></div>;
  if (!ticket) return <div className="flex items-center justify-center min-h-dvh"><p className="text-sm text-red-600">Request not found.</p></div>;

  const badge = BADGE[ticket.status] ?? BADGE.open;
  const isClosed = ticket.status === 'closed';

  return (
    <main className="pb-28">
      <AppHeader showLocality={false} />
      <div className="px-4 pt-3">
        <div className="flex items-start gap-3 mb-4">
          <button onClick={() => router.push('/contact')} aria-label="Back" className="text-text-muted mt-0.5">
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h1 className="text-base font-700 text-text-main truncate">{ticket.subject}</h1>
              <span className={`${badge.cls} flex items-center gap-1.5 shrink-0`}>
                <span className={`w-2 h-2 rounded-full ${badge.dot}`} />{badge.label}
              </span>
            </div>
            <p className="text-xs text-text-muted mt-0.5">
              #{ticket._id.slice(-6).toUpperCase()}{ticket.orderRef ? ` · ${ticket.orderRef}` : ''}{ticket.topic ? ` · ${ticket.topic}` : ''}
            </p>
          </div>
        </div>

        {/* Thread */}
        <div className="flex flex-col gap-3 mb-4">
          {ticket.messages.map((m, i) => {
            const mine = m.from === 'customer';
            return (
              <div key={i} className={`max-w-[85%] ${mine ? 'self-end items-end' : 'self-start items-start'} flex flex-col`}>
                <div className={`rounded-card px-3.5 py-2.5 text-sm whitespace-pre-wrap break-words ${mine ? 'bg-primary text-white rounded-br-sm' : 'bg-white border border-border-default text-text-main rounded-bl-sm'}`}>
                  {m.body}
                </div>
                <span className="text-[10px] text-text-muted mt-1 px-1">{mine ? 'You' : 'Support'} · {fmtTime(m.at)}</span>
              </div>
            );
          })}
          <div ref={endRef} />
        </div>

        {ticket.status === 'resolved' && (
          <p className="text-xs text-text-muted mb-3">Marked resolved — reply below if you still need help.</p>
        )}
      </div>

      {/* Reply dock */}
      {!isClosed ? (
        <div className="cta-dock">
          {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
          <div className="flex items-end gap-2">
            <textarea className="input flex-1 min-h-[44px] max-h-28 resize-none py-2.5" placeholder="Type a reply…"
              value={reply} onChange={(e) => setReply(e.target.value)} rows={1} />
            <button onClick={send} disabled={busy || !reply.trim()} className="btn-primary px-4 shrink-0 disabled:opacity-50">
              {busy ? '…' : 'Send'}
            </button>
          </div>
          <button onClick={markClosed} className="text-xs text-text-muted mt-2 hover:text-red-600">Close this request</button>
        </div>
      ) : (
        <div className="cta-dock">
          <p className="text-center text-xs text-text-muted">This request is closed. Start a new one from Contact &amp; Support.</p>
        </div>
      )}
    </main>
  );
}
