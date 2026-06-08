import Link from 'next/link';
import { BUSINESS, LEGAL_LINKS } from '@/constants/business';

/**
 * Site footer for customer-facing content pages (Home, Orders, Account).
 * Sits at the end of scrollable content; the app shell's `pad-nav` keeps its
 * last row clear of the fixed bottom navigation.
 *
 * Surfaces the legal/policy links that Play Store, App Store and Razorpay
 * onboarding all expect to be reachable from within the app.
 */
export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-10 border-t border-border-default bg-bg-card px-5 pt-8 pb-7">
      {/* Brand */}
      <Link href="/" className="flex items-center gap-2">
        <svg width="16" height="20" fill="none" viewBox="0 0 16 20" stroke="#0037b0" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 1C5 6 2 10 2 13a6 6 0 0012 0c0-3-3-7-6-12z" />
        </svg>
        <span className="font-display font-bold text-[18px] tracking-[-0.5px] text-primary">
          {BUSINESS.brand}
        </span>
      </Link>
      <p className="text-xs text-text-muted mt-2 max-w-[280px] leading-relaxed">
        {BUSINESS.tagline} Slot-based &amp; instant water delivery for homes and
        shops across {BUSINESS.operatingCity}.
      </p>

      {/* Link columns */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-6 mt-7">
        <div>
          <p className="text-[11px] font-700 uppercase tracking-wide text-text-muted mb-3">Company</p>
          <ul className="flex flex-col gap-2.5">
            <li><Link href="/order/instant" className="text-sm text-text-body hover:text-primary transition-colors">Order a tanker</Link></li>
            <li><Link href="/orders" className="text-sm text-text-body hover:text-primary transition-colors">My orders</Link></li>
            <li><Link href="/account" className="text-sm text-text-body hover:text-primary transition-colors">My account</Link></li>
            <li><Link href="/partner" className="text-sm text-text-body hover:text-primary transition-colors">Become a Partner</Link></li>
            <li><Link href="/contact" className="text-sm text-text-body hover:text-primary transition-colors">Contact &amp; support</Link></li>
          </ul>
        </div>
        <div>
          <p className="text-[11px] font-700 uppercase tracking-wide text-text-muted mb-3">Legal</p>
          <ul className="flex flex-col gap-2.5">
            {LEGAL_LINKS.filter((l) => l.href !== '/contact').map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="text-sm text-text-body hover:text-primary transition-colors">{l.label}</Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Contact */}
      <div className="mt-8 flex flex-col gap-2">
        <a href={`mailto:${BUSINESS.supportEmail}`} className="flex items-center gap-2.5 text-sm text-text-body hover:text-primary transition-colors">
          <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} className="shrink-0 text-text-muted">
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 7l9 6 9-6" />
          </svg>
          {BUSINESS.supportEmail}
        </a>
        <a href={`tel:${BUSINESS.phone.replace(/\s/g, '')}`} className="flex items-center gap-2.5 text-sm text-text-body hover:text-primary transition-colors">
          <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} className="shrink-0 text-text-muted">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h2.5a1 1 0 01.95.68l1 3a1 1 0 01-.25 1L8 9.5a11 11 0 005.5 5.5l1.8-1.2a1 1 0 011-.25l3 1a1 1 0 01.7.95V18a2 2 0 01-2 2A14 14 0 013 6.5z" />
          </svg>
          {BUSINESS.phone}
        </a>
        <p className="flex items-start gap-2.5 text-xs text-text-muted mt-0.5 leading-relaxed">
          <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} className="shrink-0 mt-0.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <circle cx="12" cy="11" r="3" />
          </svg>
          {BUSINESS.operatingCity}, {BUSINESS.operatingState}, {BUSINESS.country}
        </p>
      </div>

      {/* Trust / payments */}
      <div className="mt-7 flex items-center gap-2 rounded-btn bg-bg-trust px-3 py-2.5">
        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#0037b0" strokeWidth={1.8} className="shrink-0">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l7 4v5c0 4.5-3 8-7 9-4-1-7-4.5-7-9V7l7-4z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.5 12l1.8 1.8 3.5-3.8" />
        </svg>
        <p className="text-[11px] text-text-body leading-snug">
          Payments secured by <span className="font-700">Razorpay</span> · {BUSINESS.paymentMethods.includes('Cash') ? 'UPI · Cards · Cash on Delivery' : 'UPI · Cards'}
        </p>
      </div>

      {/* Copyright */}
      <p className="text-[11px] text-text-muted mt-6 leading-relaxed">
        © {year} {BUSINESS.legalName}. All rights reserved.
      </p>
    </footer>
  );
}
