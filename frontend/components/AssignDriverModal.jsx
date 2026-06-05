'use client';
import { useEffect, useState } from 'react';
import { adminGetOrderCandidates, adminAssignDriver } from '@/lib/api';

const pct = (s) => Math.round((s || 0) * 100);

// Turn the scorer's component breakdown into a short, human "why".
function whyLabel(b) {
  if (!b) return 'eligible';
  const bits = [];
  if (b.locality >= 1) bits.push('home zone');
  else if (b.locality >= 0.6) bits.push('serves area');
  else if (b.locality > 0) bits.push('nearby area');
  if (b.preferred >= 1) bits.push('delivered here before');
  if (b.capacityFit >= 0.8) bits.push('right-sized');
  if (b.fairness >= 0.8) bits.push('free this slot');
  return bits.join(' · ') || 'eligible';
}

const reasonText = (reason) =>
  reason === 'not_a_tanker_order' ? '(this order has no tanker)'
  : reason === 'unknown_locality' ? '(delivery area not recognised)'
  : 'in this area';

export default function AssignDriverModal({ order, onClose, onAssigned }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    adminGetOrderCandidates(order._id)
      .then((res) => setData(res.data.data))
      .catch(() => setError('Could not load partner suggestions.'))
      .finally(() => setLoading(false));
  }, [order._id]);

  const assign = async (driverId) => {
    setBusy(String(driverId));
    setError('');
    try {
      await adminAssignDriver(order._id, driverId);
      onAssigned();
      onClose();
    } catch (e) {
      setError(e?.response?.data?.error || 'Could not assign. Try again.');
      setBusy(null);
    }
  };

  const ranked = data?.ranked || [];
  const all = data?.allActive || [];
  const rankedIds = new Set(ranked.map((r) => r.driverId));
  const others = all.filter((d) => !rankedIds.has(String(d._id)));

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 sm:p-4" onClick={onClose}>
      <div
        className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-card max-h-[88dvh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-border-default px-5 py-4 flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-sm font-700 text-text-main">Assign a partner</p>
            <p className="text-xs text-text-muted truncate">
              Order #{order._id.slice(-6).toUpperCase()} · {order.deliveryAddress?.locality || order.deliveryAddress?.street || '—'}
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="icon-btn p-2 text-text-muted hover:bg-bg-card">
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="p-5">
          {loading ? (
            <p className="text-sm text-text-muted py-8 text-center">Finding best-fit partners…</p>
          ) : (
            <>
              {ranked.length > 0 ? (
                <>
                  <p className="text-xs font-700 text-text-muted uppercase tracking-wide mb-2">Best-fit suggestions</p>
                  <div className="flex flex-col gap-2 mb-5">
                    {ranked.map((r, i) => (
                      <div key={r.driverId} className={`rounded-btn border p-3 flex items-center gap-3 ${i === 0 ? 'border-primary bg-bg-trust' : 'border-border-default'}`}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-700 text-text-main truncate">{r.driver?.name || r.name || 'Partner'}</p>
                            {i === 0 && <span className="text-[10px] font-700 text-primary bg-white rounded-chip px-1.5 py-0.5">TOP PICK</span>}
                            <span className="text-[11px] font-700 text-emerald-600">{pct(r.score)}% match</span>
                          </div>
                          <p className="text-[11px] text-text-muted truncate">
                            {(r.driver?.fulfillerProfile?.vehicleNumber || 'Tanker')} · {r.driver?.fulfillerProfile?.capacityLitres || 0}L · {whyLabel(r.breakdown)}
                          </p>
                        </div>
                        <button disabled={!!busy} onClick={() => assign(r.driverId)} className="btn-primary text-xs px-3 py-2 shrink-0">
                          {busy === r.driverId ? '…' : 'Assign'}
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="rounded-btn border border-amber-200 bg-amber-50 p-3 mb-5">
                  <p className="text-xs font-medium text-amber-800">
                    No best-fit match {reasonText(data?.reason)}. Pick a partner manually below — set their service areas in Partners to get suggestions.
                  </p>
                </div>
              )}

              <p className="text-xs font-700 text-text-muted uppercase tracking-wide mb-2">
                {ranked.length > 0 ? 'Other active partners' : 'All active partners'}
              </p>
              {others.length === 0 ? (
                <p className="text-sm text-text-muted">{ranked.length === 0 ? 'No active partners yet — approve one in Partners.' : 'No others.'}</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {others.map((d) => (
                    <div key={d._id} className="rounded-btn border border-border-default p-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text-main truncate">{d.name || 'Partner'}</p>
                        <p className="text-[11px] text-text-muted truncate">
                          {(d.fulfillerProfile?.vehicleNumber || 'Tanker')} · {d.fulfillerProfile?.capacityLitres || 0}L
                        </p>
                      </div>
                      <button disabled={!!busy} onClick={() => assign(d._id)} className="btn-ghost text-xs px-3 py-2 border border-border-default shrink-0">
                        {busy === String(d._id) ? '…' : 'Assign'}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {error && <p className="text-xs text-red-600 mt-3">{error}</p>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
