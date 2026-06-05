'use client';
import { useEffect, useState } from 'react';
import { adminGetReviews, adminSetReviewStatus } from '@/lib/api';

const STATUSES = ['published', 'hidden'];
const fmt = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

const Stars = ({ value }) => (
  <span className="inline-flex gap-0.5 align-middle">
    {[1, 2, 3, 4, 5].map((n) => (
      <svg key={n} width="13" height="13" viewBox="0 0 24 24" fill={n <= value ? '#f59e0b' : '#e2e8f0'}>
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
      </svg>
    ))}
  </span>
);

export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [rating, setRating] = useState('');
  const [busy, setBusy] = useState(null);

  const fetchReviews = () => {
    setLoading(true);
    adminGetReviews({ status: status || undefined, rating: rating || undefined })
      .then((res) => setReviews(res.data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(fetchReviews, [status, rating]);

  const setReviewStatus = async (id, next) => {
    setBusy(id);
    try {
      await adminSetReviewStatus(id, next);
      fetchReviews();
    } finally {
      setBusy(null);
    }
  };

  const published = reviews.filter((r) => r.status === 'published');
  const avg = published.length
    ? (published.reduce((s, r) => s + r.rating, 0) / published.length).toFixed(2)
    : '—';

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total reviews', value: reviews.length },
          { label: 'Published', value: published.length },
          { label: 'Hidden', value: reviews.filter((r) => r.status === 'hidden').length },
          { label: 'Avg rating (shown)', value: avg },
        ].map((s) => (
          <div key={s.label} className="card"><p className="text-xs text-text-muted mb-1">{s.label}</p><p className="text-2xl font-700 text-text-main">{s.value}</p></div>
        ))}
      </div>

      <div className="flex gap-3 mb-4 flex-wrap">
        <select className="input max-w-[160px]" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="input max-w-[140px]" value={rating} onChange={(e) => setRating(e.target.value)}>
          <option value="">All ratings</option>
          {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} star{n > 1 ? 's' : ''}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="card text-center text-sm text-text-muted py-8">Loading…</div>
      ) : reviews.length === 0 ? (
        <div className="card text-center text-sm text-text-muted py-8">No reviews yet.</div>
      ) : (
        <div className="flex flex-col gap-3">
          {reviews.map((r) => (
            <div key={r._id} className={`card ${r.status === 'hidden' ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Stars value={r.rating} />
                    <span className="text-xs text-text-muted">{fmt(r.createdAt)}</span>
                    {r.status === 'hidden' && <span className="badge-red text-[10px]">hidden</span>}
                  </div>
                  <p className="text-sm text-text-main mt-1.5">
                    Partner: <span className="font-700">{r.fulfillerId?.name || '—'}</span>
                    <span className="text-text-muted"> (avg {r.fulfillerId?.fulfillerProfile?.rating ?? '—'}, {r.fulfillerId?.fulfillerProfile?.ratingCount ?? 0} reviews)</span>
                  </p>
                  <p className="text-xs text-text-muted">From: {r.customerId?.name || r.customerId?.email || '—'} · {r.source === 'order' ? 'Scheduled' : 'Instant'}</p>
                  {r.tags?.length > 0 && <p className="text-xs text-primary mt-1">{r.tags.join(' · ')}</p>}
                  {r.comment && <p className="text-sm text-text-body mt-1.5 italic">“{r.comment}”</p>}
                </div>
                <button
                  disabled={busy === r._id}
                  onClick={() => setReviewStatus(r._id, r.status === 'published' ? 'hidden' : 'published')}
                  className="text-xs font-medium px-3 py-1.5 rounded-btn border border-border-default text-text-muted hover:text-primary hover:border-primary shrink-0 disabled:opacity-50"
                >
                  {busy === r._id ? '…' : r.status === 'published' ? 'Hide' : 'Publish'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
