'use client';
import { useEffect, useMemo, useState } from 'react';
import {
  adminGetFulfillers,
  adminApproveFulfiller,
  adminRejectFulfiller,
  adminUpdateFulfiller,
  adminDeleteFulfiller,
  adminCreateFulfiller,
  adminGetFulfillerKyc,
  adminVerifyFulfillerKyc,
  adminRejectFulfillerKyc,
} from '@/lib/api';

const statusOf = (f) => f.fulfillerProfile?.applicationStatus || 'approved';
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

const TABS = [
  { id: 'pending', label: 'Pending' },
  { id: 'active', label: 'Active' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'all', label: 'All' },
];

function StatusBadge({ f }) {
  const s = statusOf(f);
  if (s === 'pending') return <span className="badge-amber flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400" />Pending review</span>;
  if (s === 'rejected') return <span className="badge-red flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500" />Rejected</span>;
  return f.isActive
    ? <span className="badge-green flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" />Active</span>
    : <span className="badge-amber flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-slate-400" />Suspended</span>;
}

const KYC_CHIP = {
  not_submitted: ['Docs: none', 'bg-slate-100 text-slate-600'],
  pending: ['Docs: review', 'bg-amber-100 text-amber-700'],
  verified: ['Docs: verified', 'bg-emerald-100 text-emerald-700'],
  rejected: ['Docs: rejected', 'bg-red-100 text-red-700'],
};
function KycChip({ f }) {
  const k = f.fulfillerProfile?.kyc?.status || 'not_submitted';
  const [label, cls] = KYC_CHIP[k] || KYC_CHIP.not_submitted;
  return <span className={`text-[10px] font-700 px-1.5 py-0.5 rounded-chip ${cls}`}>{label}</span>;
}

function Field({ label, value }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-text-muted font-medium">{label}</p>
      <p className="text-sm text-text-main mt-0.5 break-words">{value || '—'}</p>
    </div>
  );
}

export default function AdminFulfillersPage() {
  const [fulfillers, setFulfillers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('pending');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);

  const [selected, setSelected] = useState(null); // detail modal
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState({});
  const [rejecting, setRejecting] = useState(null); // partner being rejected
  const [rejectReason, setRejectReason] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', email: '', password: '', phone: '', vehicleNumber: '', capacityLitres: '' });
  const [addErr, setAddErr] = useState('');

  const fetchAll = () => {
    setLoading(true);
    adminGetFulfillers()
      .then((res) => setFulfillers(res.data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(fetchAll, []);

  const counts = useMemo(() => {
    const c = { pending: 0, active: 0, rejected: 0, all: fulfillers.length };
    for (const f of fulfillers) {
      const s = statusOf(f);
      if (s === 'pending') c.pending++;
      else if (s === 'rejected') c.rejected++;
      else c.active++;
    }
    return c;
  }, [fulfillers]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return fulfillers.filter((f) => {
      const s = statusOf(f);
      const inTab = tab === 'all' || (tab === 'active' ? s === 'approved' : s === tab);
      if (!inTab) return false;
      if (!q) return true;
      return [f.name, f.email, f.phone, f.fulfillerProfile?.vehicleNumber].filter(Boolean).some((v) => v.toLowerCase().includes(q));
    });
  }, [fulfillers, tab, search]);

  // ---- actions ----
  const run = async (fn) => {
    setBusy(true);
    try {
      await fn();
      fetchAll();
    } catch {
      /* surfaced inline where relevant */
    } finally {
      setBusy(false);
    }
  };

  const approve = (id) => run(() => adminApproveFulfiller(id)).then(() => setSelected(null));
  const toggleActive = (f) => run(() => adminUpdateFulfiller(f._id, { isActive: !f.isActive })).then(() => setSelected(null));
  const remove = (id) => {
    if (!confirm('Permanently delete this partner record? This cannot be undone.')) return;
    run(() => adminDeleteFulfiller(id)).then(() => setSelected(null));
  };
  const confirmReject = () => {
    const id = rejecting._id;
    run(() => adminRejectFulfiller(id, rejectReason)).then(() => {
      setRejecting(null);
      setRejectReason('');
      setSelected(null);
    });
  };
  const openDetail = (f) => {
    setSelected(f);
    setEditMode(false);
    setForm({
      name: f.name || '',
      phone: f.phone || '',
      vehicleNumber: f.fulfillerProfile?.vehicleNumber || '',
      capacityLitres: f.fulfillerProfile?.capacityLitres || '',
    });
  };
  const saveEdit = () =>
    run(() => adminUpdateFulfiller(selected._id, form)).then(() => {
      setEditMode(false);
      setSelected(null);
    });
  const submitAdd = () => {
    setAddErr('');
    if (!addForm.name || !addForm.email || addForm.password.length < 6) {
      setAddErr('Name, email and a 6+ char password are required.');
      return;
    }
    setBusy(true);
    adminCreateFulfiller(addForm)
      .then(() => {
        setShowAdd(false);
        setAddForm({ name: '', email: '', password: '', phone: '', vehicleNumber: '', capacityLitres: '' });
        fetchAll();
      })
      .catch((e) => setAddErr(e?.response?.data?.error || 'Could not create partner.'))
      .finally(() => setBusy(false));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-lg font-700 text-text-main">Partners</h1>
          <p className="text-xs text-text-muted">Review applications, verify, and manage tanker operators.</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary text-sm px-4 py-2 flex items-center gap-1.5">
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2.2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" /></svg>
          Add partner
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`text-sm font-medium px-3.5 py-1.5 rounded-btn border transition-colors flex items-center gap-2 ${
              tab === t.id ? 'bg-primary text-white border-primary' : 'bg-white text-text-muted border-border-default hover:border-primary'
            }`}
          >
            {t.label}
            <span className={`text-[11px] font-700 px-1.5 rounded-chip ${tab === t.id ? 'bg-white/25' : t.id === 'pending' && counts.pending ? 'bg-amber-100 text-amber-700' : 'bg-bg-card text-text-muted'}`}>
              {counts[t.id]}
            </span>
          </button>
        ))}
        <input className="input max-w-[220px] ml-auto" placeholder="Search name, phone, vehicle" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {/* List */}
      {loading ? (
        <div className="flex flex-col gap-3">{[1, 2, 3].map((i) => <div key={i} className="card h-24 animate-pulse bg-bg-card" />)}</div>
      ) : visible.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-sm font-700 text-text-main">{tab === 'pending' ? 'No applications awaiting review' : 'Nothing here'}</p>
          <p className="text-xs text-text-muted mt-1">{tab === 'pending' ? 'New partner applications will appear here.' : 'Try another tab or search.'}</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {visible.map((f) => {
            const s = statusOf(f);
            const p = f.fulfillerProfile || {};
            return (
              <div key={f._id} className="card flex flex-col gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-bg-trust flex items-center justify-center text-sm font-700 text-primary shrink-0">
                    {f.name?.[0]?.toUpperCase() || 'P'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-700 text-text-main truncate">{f.name || 'Unnamed'}</p>
                      <StatusBadge f={f} />
                    </div>
                    <p className="text-xs text-text-muted truncate">{f.email}</p>
                    <p className="text-xs text-text-muted mt-1">
                      {p.vehicleNumber || 'No vehicle'} · {p.capacityLitres ? `${p.capacityLitres}L` : '—'} · ⭐ {Number(p.rating ?? 5).toFixed(1)}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-[11px] text-text-muted">
                        {s === 'pending' ? `Applied ${fmtDate(p.appliedAt || f.createdAt)}` : `Reviewed ${fmtDate(p.reviewedAt)}`}
                      </p>
                      <KycChip f={f} />
                    </div>
                  </div>
                </div>

                {/* Inline actions */}
                <div className="flex items-center gap-2 pt-1 flex-wrap">
                  {s === 'pending' && (
                    <>
                      <button disabled={busy} onClick={() => approve(f._id)} className="btn-primary text-xs px-3 py-1.5">Approve</button>
                      <button disabled={busy} onClick={() => { setRejecting(f); setRejectReason(''); }} className="text-xs font-medium px-3 py-1.5 rounded-btn border border-border-default text-red-600 hover:bg-red-50">Reject</button>
                    </>
                  )}
                  {s === 'approved' && (
                    <button disabled={busy} onClick={() => toggleActive(f)} className={`text-xs font-medium px-3 py-1.5 rounded-btn border ${f.isActive ? 'border-border-default text-amber-700 hover:bg-amber-50' : 'border-primary text-primary hover:bg-blue-50'}`}>
                      {f.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                  )}
                  {s === 'rejected' && (
                    <>
                      <button disabled={busy} onClick={() => approve(f._id)} className="btn-primary text-xs px-3 py-1.5">Re-approve</button>
                      <button disabled={busy} onClick={() => remove(f._id)} className="text-xs font-medium px-3 py-1.5 rounded-btn border border-border-default text-red-600 hover:bg-red-50">Delete</button>
                    </>
                  )}
                  <button onClick={() => openDetail(f)} className="text-xs font-medium text-primary ml-auto">Details →</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail / edit modal */}
      {selected && (
        <Modal onClose={() => setSelected(null)} title={editMode ? 'Edit partner' : 'Partner details'}>
          {editMode ? (
            <div className="flex flex-col gap-3">
              <LabeledInput label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
              <LabeledInput label="Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
              <LabeledInput label="Vehicle number" value={form.vehicleNumber} onChange={(v) => setForm({ ...form, vehicleNumber: v })} />
              <LabeledInput label="Tanker capacity (L)" type="number" value={form.capacityLitres} onChange={(v) => setForm({ ...form, capacityLitres: v })} />
              <div className="flex gap-2 mt-1">
                <button disabled={busy} onClick={saveEdit} className="btn-primary flex-1 py-2.5 text-sm">Save changes</button>
                <button onClick={() => setEditMode(false)} className="flex-1 py-2.5 text-sm font-medium rounded-btn border border-border-default text-text-muted">Cancel</button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-bg-trust flex items-center justify-center text-base font-700 text-primary">{selected.name?.[0]?.toUpperCase() || 'P'}</div>
                <div className="flex-1"><p className="text-base font-700 text-text-main">{selected.name}</p><StatusBadge f={selected} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Email" value={selected.email} />
                <Field label="Phone" value={selected.phone} />
                <Field label="Vehicle" value={selected.fulfillerProfile?.vehicleNumber} />
                <Field label="Capacity" value={selected.fulfillerProfile?.capacityLitres ? `${selected.fulfillerProfile.capacityLitres} L` : '—'} />
                <Field label="Rating" value={`${Number(selected.fulfillerProfile?.rating ?? 5).toFixed(1)} (${selected.fulfillerProfile?.ratingCount || 0})`} />
                <Field label="Online" value={selected.fulfillerProfile?.isOnline ? 'Yes' : 'No'} />
                <Field label="Applied" value={fmtDate(selected.fulfillerProfile?.appliedAt || selected.createdAt)} />
                <Field label="Reviewed" value={fmtDate(selected.fulfillerProfile?.reviewedAt)} />
              </div>
              {statusOf(selected) === 'rejected' && selected.fulfillerProfile?.rejectionReason && (
                <div className="bg-red-50 border border-red-100 rounded-btn p-3"><p className="text-[11px] uppercase tracking-wide text-red-600 font-medium">Rejection reason</p><p className="text-sm text-text-main mt-0.5">{selected.fulfillerProfile.rejectionReason}</p></div>
              )}

              {/* KYC documents + settlement */}
              <KycReview fulfiller={selected} onChanged={fetchAll} />

              <div className="flex flex-wrap gap-2 pt-1">
                {statusOf(selected) === 'pending' && (
                  <>
                    <button disabled={busy} onClick={() => approve(selected._id)} className="btn-primary text-sm px-4 py-2">Approve</button>
                    <button disabled={busy} onClick={() => { setRejecting(selected); setRejectReason(''); }} className="text-sm font-medium px-4 py-2 rounded-btn border border-border-default text-red-600 hover:bg-red-50">Reject</button>
                  </>
                )}
                {statusOf(selected) === 'approved' && (
                  <button disabled={busy} onClick={() => toggleActive(selected)} className="text-sm font-medium px-4 py-2 rounded-btn border border-border-default text-text-main hover:bg-bg-card">{selected.isActive ? 'Deactivate' : 'Activate'}</button>
                )}
                {statusOf(selected) === 'rejected' && (
                  <button disabled={busy} onClick={() => approve(selected._id)} className="btn-primary text-sm px-4 py-2">Re-approve</button>
                )}
                <button onClick={() => setEditMode(true)} className="text-sm font-medium px-4 py-2 rounded-btn border border-border-default text-text-main hover:bg-bg-card">Edit</button>
                <button disabled={busy} onClick={() => remove(selected._id)} className="text-sm font-medium px-4 py-2 rounded-btn text-red-600 hover:bg-red-50 ml-auto">Delete</button>
              </div>
            </div>
          )}
        </Modal>
      )}

      {/* Reject reason modal */}
      {rejecting && (
        <Modal onClose={() => setRejecting(null)} title={`Reject ${rejecting.name || 'application'}`}>
          <p className="text-xs text-text-muted mb-2">The applicant won't be able to sign in. A reason helps your records (and a future notification).</p>
          <textarea className="input min-h-[90px]" placeholder="Reason (e.g. vehicle docs not provided)" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
          <div className="flex gap-2 mt-3">
            <button disabled={busy} onClick={confirmReject} className="flex-1 py-2.5 text-sm font-700 rounded-btn bg-red-600 text-white disabled:opacity-50">Reject application</button>
            <button onClick={() => setRejecting(null)} className="flex-1 py-2.5 text-sm font-medium rounded-btn border border-border-default text-text-muted">Cancel</button>
          </div>
        </Modal>
      )}

      {/* Add partner modal */}
      {showAdd && (
        <Modal onClose={() => setShowAdd(false)} title="Add a partner">
          <div className="flex flex-col gap-3">
            <LabeledInput label="Name" value={addForm.name} onChange={(v) => setAddForm({ ...addForm, name: v })} />
            <LabeledInput label="Email" value={addForm.email} onChange={(v) => setAddForm({ ...addForm, email: v })} />
            <LabeledInput label="Temporary password" type="password" value={addForm.password} onChange={(v) => setAddForm({ ...addForm, password: v })} />
            <LabeledInput label="Phone" value={addForm.phone} onChange={(v) => setAddForm({ ...addForm, phone: v })} />
            <LabeledInput label="Vehicle number" value={addForm.vehicleNumber} onChange={(v) => setAddForm({ ...addForm, vehicleNumber: v })} />
            <LabeledInput label="Tanker capacity (L)" type="number" value={addForm.capacityLitres} onChange={(v) => setAddForm({ ...addForm, capacityLitres: v })} />
            {addErr && <p className="text-xs text-red-600">{addErr}</p>}
            <button disabled={busy} onClick={submitAdd} className="btn-primary py-2.5 text-sm mt-1">Create & approve partner</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-white rounded-card p-5 shadow-2xl max-h-[88vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-700 text-text-main">{title}</h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-main">
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function LabeledInput({ label, value, onChange, type = 'text' }) {
  return (
    <div>
      <label className="block text-xs font-medium text-text-main mb-1">{label}</label>
      <input type={type} className="input" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function DocThumb({ label, url }) {
  return (
    <div>
      <p className="text-[10px] text-text-muted mb-1">{label}</p>
      {url ? (
        <a href={url} target="_blank" rel="noreferrer" className="block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={label} className="w-full h-20 object-cover rounded-btn border border-border-default hover:opacity-90" />
        </a>
      ) : (
        <div className="w-full h-20 rounded-btn border border-dashed border-border-default flex items-center justify-center text-[10px] text-text-muted">Missing</div>
      )}
    </div>
  );
}

// Loads a partner's KYC docs (presigned image URLs) + settlement details and lets
// the admin verify or reject. Re-fetches itself and refreshes the parent list.
function KycReview({ fulfiller, onChanged }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [err, setErr] = useState('');

  const load = () => {
    setLoading(true);
    setErr('');
    adminGetFulfillerKyc(fulfiller._id)
      .then((res) => setData(res.data.data))
      .catch(() => setErr('Could not load documents.'))
      .finally(() => setLoading(false));
  };
  useEffect(load, [fulfiller._id]); // eslint-disable-line react-hooks/exhaustive-deps

  const verify = () => {
    setBusy(true);
    adminVerifyFulfillerKyc(fulfiller._id)
      .then(() => { load(); onChanged?.(); })
      .catch((e) => setErr(e?.response?.data?.error || 'Could not verify.'))
      .finally(() => setBusy(false));
  };
  const reject = () => {
    setBusy(true);
    adminRejectFulfillerKyc(fulfiller._id, reason)
      .then(() => { setRejecting(false); setReason(''); load(); onChanged?.(); })
      .catch((e) => setErr(e?.response?.data?.error || 'Could not reject.'))
      .finally(() => setBusy(false));
  };

  const status = data?.status || 'not_submitted';
  const allDocs = !!(data?.panUrl && data?.dlFrontUrl && data?.dlBackUrl);
  const [chipLabel, chipCls] = KYC_CHIP[status] || KYC_CHIP.not_submitted;

  return (
    <div className="border border-border-default rounded-btn p-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[11px] uppercase tracking-wide text-text-muted font-medium">Documents (KYC)</p>
        {data && <span className={`text-[10px] font-700 px-1.5 py-0.5 rounded-chip ${chipCls}`}>{chipLabel}</span>}
      </div>

      {loading ? (
        <div className="h-20 animate-pulse bg-bg-card rounded-btn" />
      ) : !data ? (
        <p className="text-xs text-text-muted">Could not load documents.</p>
      ) : data.storageConfigured === false ? (
        <p className="text-xs text-amber-700 bg-amber-50 rounded-btn p-2">Document storage isn’t configured on the server, so images can’t be shown. Set the S3/R2 env vars.</p>
      ) : status === 'not_submitted' && !allDocs ? (
        <p className="text-xs text-text-muted">No documents submitted yet.</p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2">
            <DocThumb label="PAN" url={data.panUrl} />
            <DocThumb label="DL front" url={data.dlFrontUrl} />
            <DocThumb label="DL back" url={data.dlBackUrl} />
          </div>
          <div className="grid grid-cols-2 gap-2 mt-2">
            <Field label="PAN no." value={data.panNumber} />
            <Field label="DL no." value={data.dlNumber} />
          </div>
        </>
      )}

      {data?.bank && (data.bank.accountNumber || data.bank.upiId) && (
        <div className="mt-3 pt-3 border-t border-border-default">
          <p className="text-[11px] uppercase tracking-wide text-text-muted font-medium mb-1">Settlement</p>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Account holder" value={data.bank.accountHolder} />
            <Field label="Account no." value={data.bank.accountNumber} />
            <Field label="IFSC" value={data.bank.ifsc} />
            <Field label="Bank" value={data.bank.bankName} />
            {data.bank.upiId && <Field label="UPI" value={data.bank.upiId} />}
          </div>
        </div>
      )}

      {err && <p className="text-xs text-red-600 mt-2">{err}</p>}

      {!rejecting && (status === 'pending' || (allDocs && status !== 'verified')) && (
        <div className="flex gap-2 mt-3">
          <button disabled={busy || !allDocs} onClick={verify} className="btn-primary text-xs px-3 py-1.5 disabled:opacity-50">Verify documents</button>
          <button disabled={busy} onClick={() => setRejecting(true)} className="text-xs font-medium px-3 py-1.5 rounded-btn border border-border-default text-red-600 hover:bg-red-50">Reject</button>
        </div>
      )}
      {!rejecting && status === 'verified' && (
        <button disabled={busy} onClick={() => setRejecting(true)} className="text-xs font-medium mt-3 text-red-600 hover:underline">Revoke verification</button>
      )}
      {rejecting && (
        <div className="mt-3">
          <textarea className="input min-h-[64px]" placeholder="Reason (e.g. blurry PAN, name mismatch)" value={reason} onChange={(e) => setReason(e.target.value)} />
          <div className="flex gap-2 mt-2">
            <button disabled={busy} onClick={reject} className="flex-1 py-2 text-xs font-700 rounded-btn bg-red-600 text-white disabled:opacity-50">Confirm reject</button>
            <button onClick={() => { setRejecting(false); setReason(''); }} className="flex-1 py-2 text-xs font-medium rounded-btn border border-border-default text-text-muted">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
