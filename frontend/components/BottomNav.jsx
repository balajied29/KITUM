'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  {
    href: '/',
    label: 'Home',
    icon: (active) => (
      <svg width="22" height="22" fill={active ? '#0037b0' : 'none'} viewBox="0 0 24 24"
        stroke={active ? '#0037b0' : '#64748b'} strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7m-9 2v8m4-8v8m-6 0h8" />
      </svg>
    ),
  },
  {
    href: '/orders',
    label: 'Orders',
    icon: (active) => (
      <svg width="22" height="22" fill="none" viewBox="0 0 24 24"
        stroke={active ? '#0037b0' : '#64748b'} strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
  },
  {
    href: '/account',
    label: 'Account',
    icon: (active) => (
      <svg width="22" height="22" fill="none" viewBox="0 0 24 24"
        stroke={active ? '#0037b0' : '#64748b'} strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
  },
];

export default function BottomNav() {
  const pathname = usePathname();
  if (pathname.startsWith('/admin')) return null;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-[var(--app-w)] bg-white border-t border-border-default shadow-[0_-2px_16px_-8px_rgba(19,27,46,0.12)]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex items-stretch h-[var(--nav-h)] px-1">
        {LINKS.map(({ href, label, icon }) => {
          const active = pathname === href || (href !== '/' && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              className="flex-1 flex flex-col items-center justify-center gap-1 active:opacity-70 transition-opacity"
            >
              <div className={`px-4 py-1 rounded-full flex items-center justify-center transition-colors ${active ? 'bg-[#dbeafe]' : ''}`}>
                {icon(active)}
              </div>
              <span className={`text-[11px] font-medium leading-none ${active ? 'text-primary' : 'text-text-muted'}`}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
