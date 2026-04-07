import Link from 'next/link';

export const metadata = { title: 'JalDrop Admin' };

const NAV = [
  { href: '/admin',        label: 'Dashboard' },
  { href: '/admin/slots',  label: 'Slots' },
];

export default function AdminLayout({ children }) {
  return (
    <div className="min-h-dvh bg-bg-card">
      <header className="bg-white border-b border-border-default px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-primary rounded flex items-center justify-center">
            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 2C8 8 5 12 5 15a7 7 0 0014 0c0-3-3-7-7-13z" />
            </svg>
          </div>
          <span className="text-sm font-700 text-text-main">JalDrop Admin</span>
        </div>
        <nav className="flex gap-1">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href}
              className="text-xs font-medium px-3 py-1.5 rounded-btn text-text-muted hover:text-primary hover:bg-blue-50 transition-colors">
              {n.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="p-4 max-w-5xl mx-auto">{children}</main>
    </div>
  );
}
