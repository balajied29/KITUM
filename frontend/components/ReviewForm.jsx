'use client';
import { useEffect, useState } from 'react';
import { createReview, getReviewForDelivery } from '@/lib/api';
import { StarIcon } from '@/components/icons';
import REVIEW_TAGS from '@/constants/reviewTags';

/**
 * Self-contained review widget for a completed delivery (instant or scheduled).
 * Fetches any existing review → shows a thank-you, else the rating form.
 *
 * Props: source ('order' | 'request'), id (delivery id), partnerName?
 */
export default function ReviewForm({ source, id, partnerName }) {
  const [existing, setExisting] = useState(undefined); // undefined=loading · null=none · object=reviewed
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState('');
  const [tags, setTags] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let on = true;
    getReviewForDelivery(source, id)
      .then((res) => on && setExisting(res.data.data))
      .catch(() => on && setExisting(null));
    return () => { on = false; };
  }, [source, id]);

  const toggleTag = (t) => setTags((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));

  const submit = async () => {
    if (!rating) { setError('Please pick a star rating.'); return; }
    setBusy(true);
    setError('');
    try {
      const res = await createReview({ source, id, rating, comment: comment.trim() || undefined, tags });
      setExisting(res.data.data);
    } catch (e) {
      setError(e?.response?.data?.error || 'Could not submit your review.');
    } finally {
      setBusy(false);
    }
  };

  if (existing === undefined) return null; // loading — render nothing

  if (existing) {
    return (
      <section className="card text-center">
        <p className="text-sm font-700 text-text-main mb-2">Thanks for your feedback!</p>
        <div className="flex justify-center gap-0.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <span key={n} className={n <= existing.rating ? 'text-amber-400' : 'text-border-default'}>
              <StarIcon className="w-5 h-5" filled={n <= existing.rating} />
            </span>
          ))}
        </div>
        {existing.tags?.length > 0 && (
          <p className="text-[11px] text-text-muted mt-2">{existing.tags.join(' · ')}</p>
        )}
        {existing.comment && <p className="text-xs text-text-muted mt-2 italic">“{existing.comment}”</p>}
      </section>
    );
  }

  return (
    <section className="card">
      <p className="text-sm font-700 text-text-main text-center">Rate {partnerName || 'your delivery'}</p>
      <p className="text-xs text-text-muted text-center mb-3">How was your delivery experience?</p>

      <div className="flex justify-center gap-1.5 mb-4" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            onClick={() => setRating(n)}
            onMouseEnter={() => setHover(n)}
            aria-label={`Rate ${n} star${n > 1 ? 's' : ''}`}
            className={`p-1 transition-colors ${n <= (hover || rating) ? 'text-amber-400' : 'text-border-default'}`}
          >
            <StarIcon className="w-8 h-8" filled={n <= (hover || rating)} />
          </button>
        ))}
      </div>

      <div className="flex flex-wrap justify-center gap-2 mb-3">
        {REVIEW_TAGS.map((t) => (
          <button
            key={t}
            onClick={() => toggleTag(t)}
            className={`text-xs px-3 py-1.5 rounded-chip border transition-colors ${
              tags.includes(t) ? 'bg-bg-trust border-primary text-primary' : 'border-border-default text-text-muted'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <textarea
        className="input min-h-[80px] resize-none mb-3"
        placeholder="Add a comment (optional)"
        value={comment}
        maxLength={1000}
        onChange={(e) => setComment(e.target.value)}
      />

      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}

      <button onClick={submit} disabled={busy} className="btn-primary w-full disabled:opacity-50">
        {busy ? 'Submitting…' : 'Submit review'}
      </button>
    </section>
  );
}
