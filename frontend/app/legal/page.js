import Link from 'next/link';
import BackHeader from '@/components/BackHeader';
import Footer from '@/components/Footer';
import { BUSINESS } from '@/constants/business';

export const metadata = {
  title: 'Legal & Policies — KitUm',
  description: 'KitUm Terms & Conditions, Privacy Policy, Refund & Cancellation, Shipping & Delivery, and contact details.',
};

const DOCS = [
  { href: '/legal/terms',    title: 'Terms & Conditions',      desc: 'The rules for using KitUm and placing orders.' },
  { href: '/legal/privacy',  title: 'Privacy Policy',          desc: 'What data we collect and how we protect it.' },
  { href: '/legal/refunds',  title: 'Refund & Cancellation',   desc: 'Cancelling orders and how refunds work.' },
  { href: '/legal/shipping', title: 'Shipping & Delivery',     desc: 'Service areas, slots, timelines and charges.' },
  { href: '/contact',        title: 'Contact Us',              desc: 'Reach support and our Grievance Officer.' },
];

export default function LegalIndexPage() {
  return (
    <main className="bg-bg-page min-h-dvh">
      <BackHeader title="Legal & Policies" />

      <div className="px-4 pt-6">
        <h1 className="font-display font-extrabold text-[26px] leading-tight tracking-[-0.5px] text-text-main">
          Legal &amp; Policies
        </h1>
        <p className="text-sm text-text-body mt-2 leading-relaxed">
          Everything that governs your use of {BUSINESS.brand}. Last updated{' '}
          {BUSINESS.lastUpdated}.
        </p>

        <div className="card p-0 overflow-hidden divide-y divide-border-default mt-6">
          {DOCS.map((d) => (
            <Link key={d.href} href={d.href} className="flex items-center justify-between gap-3 px-4 py-4 hover:bg-bg-card transition-colors">
              <div className="min-w-0">
                <p className="text-sm font-700 text-text-main">{d.title}</p>
                <p className="text-xs text-text-muted mt-0.5">{d.desc}</p>
              </div>
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#64748b" strokeWidth={2} className="shrink-0">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          ))}
        </div>
      </div>

      <Footer />
    </main>
  );
}
