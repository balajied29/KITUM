import Link from 'next/link';
import BackHeader from '@/components/BackHeader';
import Footer from '@/components/Footer';
import { BUSINESS, LEGAL_LINKS } from '@/constants/business';

/**
 * Shared chrome for every legal / policy document.
 *  - sticky back header with the page title
 *  - large title + "Last updated" line
 *  - `.prose-legal` styled body (see styles/globals.css)
 *  - cross-links to the other policies
 *  - the standard site footer
 */
export default function LegalLayout({ title, intro, updated = BUSINESS.lastUpdated, children }) {
  return (
    <main className="bg-bg-page min-h-dvh">
      <BackHeader title={title} />

      <article className="px-5 pt-6">
        <h1 className="font-display font-extrabold text-[26px] leading-tight tracking-[-0.5px] text-text-main">
          {title}
        </h1>
        <p className="text-xs text-text-muted mt-2">Last updated: {updated}</p>
        {intro && <p className="text-sm text-text-body mt-4 leading-relaxed">{intro}</p>}

        <div className="prose-legal mt-6">{children}</div>

        {/* Cross-links to the other policies */}
        <nav className="mt-10 pt-6 border-t border-border-default">
          <p className="text-[11px] font-700 uppercase tracking-wide text-text-muted mb-3">More policies</p>
          <div className="flex flex-wrap gap-2">
            {LEGAL_LINKS.filter((l) => l.label !== title).map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="text-xs font-medium text-primary bg-bg-trust rounded-chip px-3 py-1.5 hover:bg-blue-100 transition-colors"
              >
                {l.label}
              </Link>
            ))}
          </div>
        </nav>
      </article>

      <Footer />
    </main>
  );
}
