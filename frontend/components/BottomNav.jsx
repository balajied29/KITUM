'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  {
    href: '/',
    label: 'Home',
    icon: (active) => (
      <svg width="20" height="20" fill={active ? '#1d4ed8' : 'none'} viewBox="0 0 24 24" stroke={active ? '#1d4ed8' : '#64748b'} strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7m-9 2v8m4-8v8m-6 0h8" />
      </svg>
    ),
  },
  {
    href: '/order',
    label: 'Order',
    icon: (active) => (
      <svg width="20" height="20" fill={active ? '#1d4ed8' : 'none'} viewBox="0 0 24 24" stroke={active ? '#1d4ed8' : '#64748b'} strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 2C8 8 5 12 5 15a7 7 0 0014 0c0-3-3-7-7-13z" />
      </svg>
    ),
  },
  {
    href: '/orders',
    label: 'Orders',
    icon: (active) => (
      <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke={active ? '#1d4ed8' : '#64748b'} strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
  },
  {
    href: '/account',
    label: 'Account',
    icon: (active) => (
      <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke={active ? '#1d4ed8' : '#64748b'} strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
  },
];

export default function BottomNav() {
  const pathname = usePathname();
  if (pathname.startsWith('/admin')) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-border-default flex justify-around items-center h-14 max-w-lg mx-auto">
      {LINKS.map(({ href, label, icon }) => {
        const active = pathname === href || (href !== '/' && pathname.startsWith(href));
        return (
          <Link key={href} href={href} className="flex flex-col items-center gap-0.5 px-4 py-1">
            {icon(active)}
            <span className={`text-[11px] font-medium ${active ? 'text-primary' : 'text-text-muted'}`}>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
