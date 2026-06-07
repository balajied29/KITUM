'use client';
import { useEffect, useState } from 'react';
import {
  adminGetCampaigns,
  adminUpdateCampaign,
  adminGetCampaignGrants,
  adminGrantCampaign,
  adminRevokeCampaign,
  adminSeedCampaigns,
} from '@/lib/api';

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
// For a <input type="date"> we need YYYY-MM-DD; treat null as empty.
const toDateInput = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');
// Days until a date (rounded up), or null if no date.
const daysLeft = (d) => {
  if (!d) return null;
  const ms = new Date(d) - Date.now();
  return ms <= 0 ? 0 : Math.ceil(ms / 86400000);
};

const AUDIENCE_LABEL = { driver: 'Drivers', customer: 'Customers' };

function StatusPill({ status }) {
  const map = {
    active: ['Active', 'bg-emerald-100 text-emerald-700'],
    expired: ['Expired', 'bg-slate-100 text-slate-600'],
    revoked: ['Revoked', 'bg-red-100 text-red-700'],
  };
  const [label, cls] = map[status] || map.active;
  return <span className={`text-[10px] font-700 px-1.5 py-0.5 rounded-chip ${cls}`}>{label}</span>;
}

export default function AdminCampaignsPage() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [seeding, setSeeding] = useState(false);

  const fetchAll = () => {
    setLoading(true);
    setError('');
    adminGetCampaigns()
      .then((res) => setCampaigns(res.data.data))
      .catch((e) =>
        setError(
          e?.response?.status === 404
            ? 'Campaigns API not found — deploy the latest backend to api.kitum.online.'
            : 'Could not load campaigns.'
        )
      )
      .finally(() => setLoading(false));
  };
  useEffect(fetchAll, []);

  const handleSeed = async () => {
    setSeeding(true);
    setError('');
    try {
      const res = await adminSeedCampaigns();
      setCampaigns(res.data.data);
    } catch (e) {
      setError(
        e?.response?.status === 404
          ? 'Seeding API not found — deploy the latest backend to api.kitum.online.'
          : 'Could not seed campaigns.'
      );
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-lg font-700 text-text-main">Launch Campaigns</h1>
        <p className="text-xs text-text-muted">
          Tune caps, windows and benefit numbers — no redeploy. Pricing reverts automatically when a campaign is off or full.
        </p>
      </div>

      {error && <p className="text-xs text-red-600 mb-3">{error}</p>}

      {loading ? (
        <div className="flex flex-col gap-4">{[1, 2].map((i) => <div key={i} className="card h-48 animate-pulse bg-bg-card" />)}</div>
      ) : campaigns.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-sm font-700 text-text-main">No campaigns found</p>
          <p className="text-xs text-text-muted mt-1 mb-4">Create the two launch campaigns (15 drivers / 90 days, 100 customers / 3 free bookings). Idempotent, safe to re-run.</p>
          <button
            onClick={handleSeed}
            disabled={seeding}
            className="inline-flex items-center justify-center gap-2 bg-primary text-white font-700 text-sm rounded-btn px-5 py-2.5 disabled:opacity-60"
          >
            {seeding ? 'Seeding…' : 'Seed campaigns'}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {campaigns.map((c) => (
            <CampaignCard key={c.key} campaign={c} onChanged={fetchAll} />
          ))}
        </div>
      )}
    </div>
  );
}

function CampaignCard({ campaign, onChanged }) {
  const isDriver = campaign.audience === 'driver';
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [showEnrollees, setShowEnrollees] = useState(false);
  const [err, setErr] = useState('');

  // Edit form — seeded from the live campaign each time we open it.
  const [form, setForm] = useState({});
  const openEdit = () => {
    setForm({
      cap: campaign.cap ?? '',
      description: campaign.description || '',
      durationDays: campaign.benefit?.durationDays ?? '',
      freeBookings: campaign.benefit?.freeBookings ?? '',
      useByDays: campaign.benefit?.useByDays ?? '',
      start: toDateInput(campaign.enrollWindow?.start),
      end: toDateInput(campaign.enrollWindow?.end),
    });
    setErr('');
    setEditing(true);
  };

  const cap = campaign.cap;
  const claimed = campaign.claimed || 0;
  const capLabel = cap == null ? '∞' : cap;
  const pct = cap ? Math.min(100, Math.round((claimed / cap) * 100)) : 0;

  const toggleActive = async () => {
    setBusy(true);
    setErr('');
    try {
      await adminUpdateCampaign(campaign.key, { active: !campaign.active });
      onChanged();
    } catch (e) {
      setErr(e?.response?.data?.error || 'Could not update.');
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    setBusy(true);
    setErr('');
    const payload = {
      cap: form.cap === '' ? null : Number(form.cap),
      description: form.description,
      enrollWindow: { start: form.start || null, end: form.end || null },
    };
    if (isDriver) {
      payload.durationDays = form.durationDays === '' ? null : Number(form.durationDays);
    } else {
      payload.freeBookings = form.freeBookings === '' ? null : Number(form.freeBookings);
      payload.useByDays = form.useByDays === '' ? null : Number(form.useByDays);
    }
    try {
      await adminUpdateCampaign(campaign.key, payload);
      setEditing(false);
      onChanged();
    } catch (e) {
      setErr(e?.response?.data?.error || 'Could not save changes.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-bg-trust flex items-center justify-center text-primary shrink-0">
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 11.25v8.25a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 109.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1114.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-700 text-text-main">
                {isDriver ? '0% Commission — Founding Drivers' : 'No Platform Fee — First Customers'}
              </p>
              <span className="text-[10px] font-700 px-1.5 py-0.5 rounded-chip bg-blue-50 text-primary">{AUDIENCE_LABEL[campaign.audience]}</span>
            </div>
            <p className="text-xs text-text-muted mt-0.5">{campaign.description || (isDriver ? '0% commission for the benefit window from approval.' : 'Platform fee waived for the first few bookings.')}</p>
            <p className="text-[11px] font-mono text-text-muted/80 mt-1">{campaign.key}</p>
          </div>
        </div>

        {/* Active toggle */}
        <button
          onClick={toggleActive}
          disabled={busy}
          role="switch"
          aria-checked={campaign.active}
          className={`relative shrink-0 w-11 h-6 rounded-full transition-colors disabled:opacity-50 ${campaign.active ? 'bg-emerald-500' : 'bg-slate-300'}`}
        >
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${campaign.active ? 'translate-x-5' : ''}`} />
        </button>
      </div>

      {/* Counter */}
      <div>
        <div className="flex items-baseline justify-between mb-1.5">
          <span className="text-xs font-700 text-text-muted uppercase tracking-wide">Claimed</span>
          <span className="text-sm font-700 text-text-main">
            {claimed} <span className="text-text-muted font-medium">/ {capLabel} {isDriver ? 'drivers' : 'customers'}</span>
          </span>
        </div>
        <div className="h-2 rounded-full bg-bg-card overflow-hidden">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${cap ? pct : 100}%`, opacity: cap ? 1 : 0.25 }} />
        </div>
      </div>

      {/* Benefit + window summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {isDriver ? (
          <Stat label="Waiver length" value={campaign.benefit?.durationDays != null ? `${campaign.benefit.durationDays} days` : '—'} />
        ) : (
          <>
            <Stat label="Free bookings" value={campaign.benefit?.freeBookings != null ? campaign.benefit.freeBookings : '—'} />
            <Stat label="Use within" value={campaign.benefit?.useByDays != null ? `${campaign.benefit.useByDays} days` : 'No expiry'} />
          </>
        )}
        <Stat label="Window opens" value={fmtDate(campaign.enrollWindow?.start)} />
        <Stat label="Window closes" value={campaign.enrollWindow?.end ? fmtDate(campaign.enrollWindow.end) : 'No end'} />
      </div>

      {err && <p className="text-xs text-red-600">{err}</p>}

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border-default">
        <button onClick={editing ? () => setEditing(false) : openEdit} className="text-xs font-medium px-3 py-1.5 rounded-btn border border-border-default text-text-main hover:bg-bg-card mt-3">
          {editing ? 'Cancel edit' : 'Edit settings'}
        </button>
        <button onClick={() => setShowEnrollees((s) => !s)} className="text-xs font-medium px-3 py-1.5 rounded-btn border border-border-default text-text-main hover:bg-bg-card mt-3">
          {showEnrollees ? 'Hide enrollees' : 'View enrollees'}
        </button>
      </div>

      {/* Edit panel */}
      {editing && (
        <div className="rounded-btn border border-border-default p-4 flex flex-col gap-3 bg-bg-card/40">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <NumberField label="Cap (max enrollees, blank = unlimited)" value={form.cap} onChange={(v) => setForm({ ...form, cap: v })} />
            {isDriver ? (
              <NumberField label="Waiver length (days)" value={form.durationDays} onChange={(v) => setForm({ ...form, durationDays: v })} />
            ) : (
              <>
                <NumberField label="Free bookings (per customer)" value={form.freeBookings} onChange={(v) => setForm({ ...form, freeBookings: v })} />
                <NumberField label="Use within (days, blank = no expiry)" value={form.useByDays} onChange={(v) => setForm({ ...form, useByDays: v })} />
              </>
            )}
            <DateField label="Enrollment opens" value={form.start} onChange={(v) => setForm({ ...form, start: v })} />
            <DateField label="Enrollment closes (blank = no end)" value={form.end} onChange={(v) => setForm({ ...form, end: v })} />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-main mb-1">Description</label>
            <textarea className="input min-h-[60px]" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Shown to ops only" />
          </div>
          <div className="flex gap-2">
            <button disabled={busy} onClick={save} className="btn-primary text-sm px-4 py-2 disabled:opacity-50">Save changes</button>
            <button onClick={() => setEditing(false)} className="text-sm font-medium px-4 py-2 rounded-btn border border-border-default text-text-muted">Cancel</button>
          </div>
        </div>
      )}

      {/* Enrollees */}
      {showEnrollees && <Enrollees campaign={campaign} onChanged={onChanged} />}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-text-muted font-medium">{label}</p>
      <p className="text-sm font-700 text-text-main mt-0.5">{value}</p>
    </div>
  );
}

function NumberField({ label, value, onChange }) {
  return (
    <div>
      <label className="block text-xs font-medium text-text-main mb-1">{label}</label>
      <input type="number" min="0" className="input" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function DateField({ label, value, onChange }) {
  return (
    <div>
      <label className="block text-xs font-medium text-text-main mb-1">{label}</label>
      <input type="date" className="input" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function Enrollees({ campaign, onChanged }) {
  const isDriver = campaign.audience === 'driver';
  const [grants, setGrants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const load = () => {
    setLoading(true);
    adminGetCampaignGrants(campaign.key)
      .then((res) => setGrants(res.data.data))
      .catch(() => setErr('Could not load enrollees.'))
      .finally(() => setLoading(false));
  };
  useEffect(load, [campaign.key]); // eslint-disable-line react-hooks/exhaustive-deps

  const grant = async () => {
    if (!email.trim()) return;
    setBusy(true);
    setErr('');
    setMsg('');
    try {
      await adminGrantCampaign(campaign.key, { email: email.trim() });
      setMsg(`Enrolled ${email.trim()}.`);
      setEmail('');
      load();
      onChanged?.();
    } catch (e) {
      setErr(e?.response?.data?.error || 'Could not enroll.');
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (userId, name) => {
    if (!confirm(`Revoke this grant${name ? ` for ${name}` : ''}? Their perk stops immediately and the slot reopens.`)) return;
    setBusy(true);
    setErr('');
    setMsg('');
    try {
      await adminRevokeCampaign(campaign.key, userId);
      load();
      onChanged?.();
    } catch (e) {
      setErr(e?.response?.data?.error || 'Could not revoke.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-btn border border-border-default p-4 flex flex-col gap-3">
      {/* Manual grant by email */}
      <div>
        <p className="text-[11px] uppercase tracking-wide text-text-muted font-medium mb-1.5">Manually enroll by email</p>
        <div className="flex gap-2">
          <input
            className="input flex-1"
            type="email"
            placeholder="user@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && grant()}
          />
          <button disabled={busy || !email.trim()} onClick={grant} className="btn-primary text-sm px-4 py-2 disabled:opacity-50">Grant</button>
        </div>
        {msg && <p className="text-xs text-emerald-600 mt-1.5">{msg}</p>}
        {err && <p className="text-xs text-red-600 mt-1.5">{err}</p>}
      </div>

      {/* Enrollee table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-border-default">
            <tr>
              {['#', 'Enrollee', isDriver ? 'Ends' : 'Free left', 'Status', ''].map((h) => (
                <th key={h} className="text-left text-xs font-700 text-text-muted px-2 py-2">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-2 py-5 text-center text-xs text-text-muted">Loading…</td></tr>
            ) : grants.length === 0 ? (
              <tr><td colSpan={5} className="px-2 py-5 text-center text-xs text-text-muted">No enrollees yet.</td></tr>
            ) : grants.map((g) => {
              const u = g.user || {};
              const dleft = daysLeft(g.endsAt);
              return (
                <tr key={g._id} className="border-b border-border-default last:border-0">
                  <td className="px-2 py-2.5 font-mono text-xs text-text-muted">{g.enrollmentNumber ?? '—'}</td>
                  <td className="px-2 py-2.5">
                    <p className="font-medium text-text-main">{u.name || '—'}</p>
                    <p className="text-xs text-text-muted">{u.email || '—'}</p>
                  </td>
                  <td className="px-2 py-2.5 text-xs text-text-muted">
                    {isDriver
                      ? (g.endsAt ? `${fmtDate(g.endsAt)}${dleft != null ? ` · ${dleft}d left` : ''}` : '—')
                      : (g.freeBookingsRemaining != null
                          ? `${g.freeBookingsRemaining}${g.freeBookingsTotal != null ? ` / ${g.freeBookingsTotal}` : ''}`
                          : '—')}
                  </td>
                  <td className="px-2 py-2.5"><StatusPill status={g.status} /></td>
                  <td className="px-2 py-2.5 text-right">
                    {g.status !== 'revoked' && (
                      <button disabled={busy} onClick={() => revoke(u._id, u.name)} className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50">
                        Revoke
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
