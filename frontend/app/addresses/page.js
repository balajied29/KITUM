'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getAddresses, deleteAddress, updateAddress } from '@/lib/api';
import { useAuthStore } from '@/lib/store';

const ICONS = {
  home: (
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7m-9 2v8m4-8v8m-6 0h8" />
  ),
  work: (
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.93 23.93 0 0112 15c-3.18 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  ),
  other: (
    <>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </>
  ),
};

export default function AddressesPage() {
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accessToken) {
      router.replace('/login?next=/addresses');
      return;
    }
    getAddresses()
      .then((res) => setAddresses(res.data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [accessToken, router]);

  const remove = async (id) => {
    setAddresses((a) => a.filter((x) => x._id !== id)); // optimistic
    try {
      await deleteAddress(id);
      // Backend promotes the next address to default when the default is removed —
      // refetch so the DEFAULT badge reflects the new state.
      const res = await getAddresses();
      setAddresses(res.data.data);
    } catch { /* keep optimistic state on failure */ }
  };

  const makeDefault = async (id) => {
    setAddresses((a) => a.map((x) => ({ ...x, isDefault: x._id === id })));
    updateAddress(id, { isDefault: true }).catch(() => {});
  };

  return (
    <main className="bg-bg-page min-h-dvh pb-24">
      <header className="flex items-center gap-3 px-4 h-14 sticky top-0 bg-bg-page/95 backdrop-blur z-10">
        <button onClick={() => router.back()} className="text-text-main">
          <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-base font-700 text-text-main">Saved addresses</h1>
      </header>

      <div className="px-4 pt-2">
        {loading ? (
          <div className="flex flex-col gap-3">{[1, 2].map((i) => <div key={i} className="card h-20 animate-pulse bg-bg-card" />)}</div>
        ) : addresses.length === 0 ? (
          <div className="flex flex-col items-center text-center py-16 gap-2">
            <div className="w-14 h-14 rounded-full bg-bg-card flex items-center justify-center mb-1">
              <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="#64748b" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <circle cx="12" cy="11" r="3" />
              </svg>
            </div>
            <p className="text-sm font-700 text-text-main">No saved addresses yet</p>
            <p className="text-xs text-text-muted max-w-xs">Save your home, work, or any spot for one-tap delivery.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {addresses.map((a) => (
              <div key={a._id} className="card">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full bg-bg-trust flex items-center justify-center shrink-0">
                    <svg width="17" height="17" fill="none" viewBox="0 0 24 24" stroke="#0037b0" strokeWidth={1.8}>
                      {ICONS[a.type] || ICONS.other}
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-700 text-text-main">{a.label || a.type}</p>
                      {a.isDefault && <span className="text-[10px] font-700 text-primary bg-bg-trust px-2 py-0.5 rounded-chip">DEFAULT</span>}
                    </div>
                    <p className="text-xs text-text-muted mt-0.5 leading-snug">{a.address}</p>
                    {a.landmark && <p className="text-[11px] text-text-muted mt-0.5">Near {a.landmark}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border-default">
                  {!a.isDefault && (
                    <button onClick={() => makeDefault(a._id)} className="text-sm font-medium text-primary px-2 py-1.5 -ml-2 rounded-btn active:bg-bg-trust transition-colors">Set as default</button>
                  )}
                  <button onClick={() => remove(a._id)} className="text-sm font-medium text-red-600 ml-auto px-2 py-1.5 -mr-2 rounded-btn active:bg-red-50 transition-colors">Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add new */}
      <div className="cta-dock">
        <button onClick={() => router.push('/location?mode=save')} className="btn-primary w-full py-3.5 flex items-center justify-center gap-2">
          <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2.2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
          </svg>
          Add a new address
        </button>
      </div>
    </main>
  );
}
