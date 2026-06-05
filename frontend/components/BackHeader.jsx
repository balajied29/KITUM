'use client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

/**
 * Sticky sub-page header: a back chevron + page title, with the KitUm wordmark
 * on the right. Used by legal/policy pages reached from the footer.
 */
export default function BackHeader({ title }) {
  const router = useRouter();

  return (
    <header
      className="flex items-center gap-3 px-4 pb-3 bg-bg-page sticky top-0 z-40 border-b border-border-default"
      style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top, 0px))' }}
    >
      <button
        onClick={() => router.back()}
        aria-label="Go back"
        className="icon-btn w-9 h-9 -ml-1 text-text-main hover:bg-bg-card active:bg-bg-card"
      >
        <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <h1 className="flex-1 min-w-0 text-[15px] font-700 text-text-main truncate">{title}</h1>
      <Link href="/" aria-label="KitUm home" className="flex items-center gap-1.5">
        <svg width="13" height="16" fill="none" viewBox="0 0 16 20" stroke="#0037b0" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 1C5 6 2 10 2 13a6 6 0 0012 0c0-3-3-7-6-12z" />
        </svg>
        <span className="font-display font-bold text-[15px] tracking-[-0.5px] text-primary">KitUm</span>
      </Link>
    </header>
  );
}
