'use client';
import Link from 'next/link';
import { useLocationStore } from '@/lib/store';

export default function AppHeader({ showLocality = true }) {
  const { locality, openModal } = useLocationStore();
  const displayLocality = locality || 'Laitumkhrah';

  return (
    <header className="flex items-center justify-between px-6 py-4 bg-bg-page sticky top-0 z-40">
      <Link href="/" className="flex items-center gap-2">
        <svg width="16" height="20" fill="none" viewBox="0 0 16 20" stroke="#0037b0" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 1C5 6 2 10 2 13a6 6 0 0012 0c0-3-3-7-6-12z" />
        </svg>
        <span className="font-display font-bold text-[20px] tracking-[-0.5px] text-primary">
          Shillong Water
        </span>
      </Link>

      {showLocality && (
        <button
          onClick={openModal}
          className="flex items-center gap-1.5 bg-bg-card rounded-[12px] px-3 py-1.5"
        >
          <svg width="12" height="15" fill="none" viewBox="0 0 24 24" stroke="#131b2e" strokeWidth={2.2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="text-[14px] font-semibold text-text-main">{displayLocality}</span>
          <svg width="8" height="5" fill="none" viewBox="0 0 10 6" stroke="#131b2e" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M1 1l4 4 4-4" />
          </svg>
        </button>
      )}
    </header>
  );
}
