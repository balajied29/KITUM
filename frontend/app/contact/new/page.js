'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppHeader from '@/components/AppHeader';
import { createTicket, getUserOrders, getMyRequests } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { findTemplate } from '@/constants/supportTemplates';

const shortRef = (id) => 'WD-' + String(id).slice(-6).toUpperCase();
const fmt = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

export default function NewSupportTicketPage() {
  const router = useRouter();
  const { user } = useAuthStore();

  const [tpl, setTpl] = useState(null);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [related, setRelated] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [recent, setRecent] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!useAuthStore.getState().user) {
      // Come back to this exact compose form (keeping the ?t= template) after login.
      const here = '/contact/new' + (typeof window !== 'undefined' ? window.location.search : '');
      router.replace('/login?next=' + encodeURIComponent(here));
      return;
    }
    const id = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('t') : null;
    const t = findTemplate(id);
    setTpl(t);
    setSubject(t?.subject || '');
    setMessage(t?.body || '');
    setContactPhone(user?.phone || '');

    Promise.allSettled([getUserOrders(), getMyRequests()]).then(([o, r]) => {
      const orders = (o.value?.data?.data || []).map((x) => ({
        value: `order:${x._id}`,
        label: `${shortRef(x._id)} · ₹${x.totalAmount} · ${x.slotId ? fmt(x.slotId.date) : fmt(x.createdAt)}`,
        at: x.createdAt,
      }));
      const reqs = (r.value?.data?.data || []).map((x) => ({
        value: `request:${x._id}`,
        label: `${shortRef(x._id)} · instant · ${fmt(x.createdAt)}`,
        at: x.createdAt,
      }));
      setRecent([...orders, ...reqs].sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 15));
    });
  }, [user, router]);

  const submit = async () => {
    if (!subject.trim()) { setError('Please add a subject.'); return; }
    if (!message.trim()) { setError('Please describe your issue.'); return; }
    setError('');
    setSubmitting(true);
    try {
      const res = await createTicket({
        category: tpl?.category || 'other',
        topic: tpl?.label,
        subject: subject.trim(),
        message: message.trim(),
        related: related || undefined,
        contactPhone: contactPhone.trim() || undefined,
      });
      router.replace(`/contact/${res.data.data._id}`);
    } catch (e) {
      setError(e?.response?.data?.error || 'Could not submit. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <main className="pb-6">
      <AppHeader showLocality={false} />
      <div className="px-4 pt-3">
        <div className="flex items-center gap-3 mb-5">
          <button onClick={() => router.back()} aria-label="Back" className="text-text-muted">
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-base font-700 text-text-main">{tpl?.label || 'New support request'}</h1>
            <p className="text-xs text-text-muted mt-0.5">We usually reply within a few hours.</p>
          </div>
        </div>

        <div className="card flex flex-col gap-4">
          <div>
            <label className="block text-xs font-medium text-text-main mb-1">Subject</label>
            <input className="input" placeholder="Brief summary" value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>

          {recent.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-text-main mb-1">
                Related order {tpl?.needsOrder ? '' : <span className="text-text-muted font-normal">(optional)</span>}
              </label>
              <select className="input" value={related} onChange={(e) => setRelated(e.target.value)}>
                <option value="">{tpl?.needsOrder ? 'Select the order this is about' : 'None'}</option>
                {recent.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-text-main mb-1">Details</label>
            <textarea className="input min-h-[140px] resize-none" placeholder="Tell us what happened…"
              value={message} onChange={(e) => setMessage(e.target.value)} />
          </div>

          <div>
            <label className="block text-xs font-medium text-text-main mb-1">Contact phone <span className="text-text-muted font-normal">(optional)</span></label>
            <input className="input" type="tel" placeholder="+91 98765 43210" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <button onClick={submit} disabled={submitting} className="btn-primary w-full">
            {submitting ? 'Submitting…' : 'Submit request'}
          </button>
        </div>
      </div>
    </main>
  );
}
