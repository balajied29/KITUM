'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/lib/store';
import { logout as apiLogout, deleteAccount } from '@/lib/api';
import AppHeader from '@/components/AppHeader';
import Footer from '@/components/Footer';

const MENU = [
  { label: 'My Orders', href: '/orders' },
  { label: 'Delivery Addresses', href: '/addresses' },
  { label: 'Help & Support', href: '/contact' },
  { label: 'Legal & Policies', href: '/legal' },
];

export default function AccountPage() {
  const router = useRouter();
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    // Revoke the refresh token server-side (best-effort), then clear locally.
    apiLogout(useAuthStore.getState().refreshToken).catch(() => {});
    logout();
    router.replace('/');
  };

  // Account deletion — DPDP §12 right to erasure (+ Play Store requirement).
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [delErr, setDelErr] = useState('');
  const handleDelete = async () => {
    setDeleting(true);
    setDelErr('');
    try {
      await deleteAccount();
      logout();
      router.replace('/');
    } catch (e) {
      setDelErr(e?.response?.data?.error || 'Could not delete your account. Please try again.');
      setDeleting(false);
    }
  };

  if (!user) {
    return (
      <main className="flex flex-col items-center justify-center min-h-dvh px-6 gap-4">
        <p className="text-sm text-text-muted">Sign in to manage your account.</p>
        <Link href="/login" className="btn-primary text-sm px-8">Sign In</Link>
      </main>
    );
  }

  return (
    <main className="pb-6">
      <AppHeader showLocality={false} />

      {/* Profile */}
      <section className="px-4 mb-5">
        <div className="card flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-lg font-700 text-primary flex-shrink-0">
            {user.name?.[0]?.toUpperCase() ?? user.email?.[0]?.toUpperCase() ?? 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-700 text-text-main truncate">{user.name || 'Set your name'}</p>
            <p className="text-xs text-text-muted truncate">{user.email}</p>
            {user.phone && <p className="text-xs text-text-muted">{user.phone}</p>}
          </div>
          <Link href="/account/edit" className="text-xs text-primary font-medium hover:underline flex-shrink-0">Edit</Link>
        </div>
      </section>

      {/* Menu */}
      <section className="px-4 mb-5">
        <div className="card p-0 overflow-hidden divide-y divide-border-default">
          {MENU.map(({ label, href }) => (
            <Link key={label} href={href}
              className="flex items-center justify-between px-4 py-3.5 hover:bg-bg-card transition-colors">
              <span className="text-sm text-text-main">{label}</span>
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#64748b" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          ))}
        </div>
      </section>

      {/* Sign out */}
      <div className="px-4">
        <button onClick={handleLogout} className="btn-ghost w-full text-sm border border-border-default text-red-500 hover:bg-red-50">
          Sign Out
        </button>
      </div>

      {/* Delete account — DPDP §12 right to erasure */}
      <div className="px-4 mt-6">
        {!confirming ? (
          <button
            onClick={() => { setConfirming(true); setDelErr(''); }}
            className="w-full text-xs text-text-muted hover:text-red-600 underline underline-offset-2"
          >
            Delete my account
          </button>
        ) : (
          <div className="card border border-red-200 bg-red-50/50">
            <p className="text-sm font-700 text-text-main">Delete your account?</p>
            <p className="text-xs text-text-muted mt-1 leading-relaxed">
              This permanently erases your personal data — name, contact details, saved addresses and
              location. Past order records are retained only in anonymised form where the law requires
              (tax &amp; dispute resolution). This can’t be undone.
            </p>
            {delErr && <p className="text-red-600 text-xs mt-2">{delErr}</p>}
            <div className="flex gap-2 mt-3">
              <button onClick={() => setConfirming(false)} disabled={deleting}
                className="btn-ghost flex-1 text-sm border border-border-default disabled:opacity-50">
                Cancel
              </button>
              <button onClick={handleDelete} disabled={deleting}
                className="btn-primary flex-1 text-sm !bg-red-600 hover:!bg-red-700 disabled:opacity-50">
                {deleting ? 'Deleting…' : 'Delete everything'}
              </button>
            </div>
          </div>
        )}
      </div>

      <Footer />
    </main>
  );
}
