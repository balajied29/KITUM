'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAdminAuthStore } from '@/lib/store';
import { adminGetFulfillers, logout as apiLogout } from '@/lib/api';

const ICONS = {
  dashboard: 'M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 8.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z',
  truck: 'M8.25 18.75a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM20.25 18.75a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM3 7.5h9v9.75H9.75M3 7.5v9.75h2.25M12 9.75h4.5l3 3v4.5h-1.5M12 17.25h3',
  calendar: 'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5',
  support: 'M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z',
  star: 'M11.48 3.5a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.562.562 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z',
};

const NAV = [
  { href: '/admin',            label: 'Dashboard', icon: 'dashboard' },
  { href: '/admin/fulfillers', label: 'Partners',  icon: 'truck' },
  { href: '/admin/slots',      label: 'Slots',     icon: 'calendar' },
  { href: '/admin/reviews',    label: 'Reviews',   icon: 'star' },
  { href: '/admin/support',    label: 'Support',   icon: 'support' },
];

const Logo = ({ size = 24 }) => (
  <span className="inline-flex items-center justify-center rounded-lg bg-primary" style={{ width: size, height: size }}>
    <svg width={size * 0.55} height={size * 0.55} fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2.4}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 2C8 8 5 12 5 15a7 7 0 0014 0c0-3-3-7-7-13z" />
    </svg>
  </span>
);

export default function AdminLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, accessToken, logout } = useAdminAuthStore();
  const [pendingCount, setPendingCount] = useState(0);
  const [navOpen, setNavOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const isLoginPage = pathname === '/admin/login';

  // Wait for the persisted admin session to rehydrate from localStorage BEFORE
  // guarding. On a refresh, zustand's useSyncExternalStore returns the server
  // snapshot (null tokens) on the first client render — without this gate the
  // guard fires immediately and bounces a logged-in admin to /admin/login.
  useEffect(() => {
    const p = useAdminAuthStore.persist;
    if (!p) { setHydrated(true); return; }
    const unsub = p.onFinishHydration(() => setHydrated(true));
    if (p.hasHydrated()) setHydrated(true);
    return unsub;
  }, []);

  useEffect(() => {
    if (isLoginPage || !hydrated) return;
    if (!accessToken || !user) { router.replace('/admin/login'); return; }
    if (user.role !== 'admin') { router.replace('/admin/login'); }
  }, [hydrated, accessToken, user, isLoginPage, router]);

  // Live count of partner applications awaiting review (refreshes on navigation).
  useEffect(() => {
    if (isLoginPage || !accessToken || user?.role !== 'admin') return;
    adminGetFulfillers()
      .then((res) => setPendingCount(res.data.data.filter((f) => (f.fulfillerProfile?.applicationStatus || 'approved') === 'pending').length))
      .catch(() => {});
  }, [isLoginPage, accessToken, user, pathname]);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => { setNavOpen(false); }, [pathname]);

  const handleLogout = () => {
    apiLogout(useAdminAuthStore.getState().refreshToken).catch(() => {}); // revoke server-side
    logout();
    router.replace('/admin/login');
  };

  // Login page renders without the admin shell.
  if (isLoginPage) return <>{children}</>;
  // Don't decide anything until the session has rehydrated.
  if (!hydrated) {
    return <div className="min-h-dvh grid place-items-center bg-bg-card"><p className="text-sm text-text-muted">Loading…</p></div>;
  }
  // While redirecting an unauthorized visitor.
  if (!accessToken || !user || user.role !== 'admin') return null;

  const SidebarBody = (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2.5 px-5 h-16 border-b border-border-default shrink-0">
        <Logo size={28} />
        <span className="text-[15px] font-700 text-text-main">KitUm Admin</span>
      </div>

      <nav className="flex-1 px-3 py-4 flex flex-col gap-1 overflow-y-auto">
        {NAV.map((n) => {
          const active = pathname === n.href;
          return (
            <Link
              key={n.href}
              href={n.href}
              className={`flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-btn text-sm font-medium transition-colors ${
                active ? 'bg-blue-50 text-primary' : 'text-text-muted hover:bg-bg-card hover:text-text-main'
              }`}
            >
              <span className="flex items-center gap-3">
                <svg width="19" height="19" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={ICONS[n.icon]} />
                </svg>
                {n.label}
              </span>
              {n.href === '/admin/fulfillers' && pendingCount > 0 && (
                <span className="text-[10px] font-700 bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-chip">{pendingCount}</span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border-default p-3 shrink-0">
        <p className="text-xs text-text-muted truncate px-2 mb-2">{user.email}</p>
        <button
          onClick={handleLogout}
          className="w-full text-left text-sm font-medium px-3 py-2 rounded-btn text-text-muted hover:text-red-600 hover:bg-red-50 transition-colors"
        >
          Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh bg-bg-card">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:flex-col fixed inset-y-0 left-0 w-60 bg-white border-r border-border-default z-30">
        {SidebarBody}
      </aside>

      {/* Mobile top bar */}
      <header className="md:hidden sticky top-0 z-30 bg-white border-b border-border-default h-14 flex items-center gap-3 px-4">
        <button onClick={() => setNavOpen(true)} aria-label="Open menu" className="icon-btn p-2 -ml-2 text-text-main hover:bg-bg-card">
          <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <div className="flex items-center gap-2">
          <Logo size={24} />
          <span className="text-sm font-700 text-text-main">KitUm Admin</span>
        </div>
        {pendingCount > 0 && (
          <span className="ml-auto text-[10px] font-700 bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-chip">{pendingCount} pending</span>
        )}
      </header>

      {/* Mobile drawer */}
      {navOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/40" onClick={() => setNavOpen(false)} />
          <aside className="relative w-64 max-w-[82%] h-full bg-white shadow-2xl animate-[slideIn_180ms_ease]">
            <button onClick={() => setNavOpen(false)} aria-label="Close menu" className="icon-btn absolute top-3 right-3 p-2 text-text-muted hover:bg-bg-card z-10">
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
            {SidebarBody}
          </aside>
        </div>
      )}

      {/* Content */}
      <div className="md:ml-60">
        <main className="p-4 md:p-6 max-w-6xl mx-auto">{children}</main>
      </div>
    </div>
  );
}
