'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuthStore } from '@/lib/store';

export const metadata = { title: 'KIT UM Admin' };

const NAV = [
  { href: '/admin',       label: 'Dashboard' },
  { href: '/admin/slots', label: 'Slots' },
];

export default function AdminLayout({ children }) {
  const pathname = usePathname();
  const router   = useRouter();
  const { user, token, logout } = useAuthStore();

  const isLoginPage = pathname === '/admin/login';

  useEffect(() => {
    if (isLoginPage) return;
    if (!token || !user) { router.replace('/admin/login'); return; }
    if (user.role !== 'admin') { router.replace('/admin/login'); }
  }, [token, user, isLoginPage, router]);

  const handleLogout = () => {
    logout();
    router.replace('/admin/login');
  };

  // Render login page without the shell
  if (isLoginPage) return <>{children}</>;

  // While redirecting
  if (!token || !user || user.role !== 'admin') return null;

  return (
    <div className="min-h-dvh bg-bg-card">
      <header className="bg-white border-b border-border-default px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-primary rounded flex items-center justify-center">
            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 2C8 8 5 12 5 15a7 7 0 0014 0c0-3-3-7-7-13z" />
            </svg>
          </div>
          <span className="text-sm font-700 text-text-main">KIT UM Admin</span>
        </div>
        <div className="flex items-center gap-2">
          <nav className="flex gap-1">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href}
                className={`text-xs font-medium px-3 py-1.5 rounded-btn transition-colors ${
                  pathname === n.href
                    ? 'text-primary bg-blue-50'
                    : 'text-text-muted hover:text-primary hover:bg-blue-50'
                }`}>
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="w-px h-4 bg-border-default mx-1" />
          <span className="text-xs text-text-muted hidden sm:block">{user.email}</span>
          <button
            onClick={handleLogout}
            className="text-xs font-medium px-3 py-1.5 rounded-btn text-text-muted hover:text-red-600 hover:bg-red-50 transition-colors"
          >
            Sign out
          </button>
        </div>
      </header>
      <main className="p-4 max-w-5xl mx-auto">{children}</main>
    </div>
  );
}
