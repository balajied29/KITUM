'use client';
import Link from 'next/link';
import { useAuthStore, useLocationStore } from '@/lib/store';

function DropIcon() {
  return (
    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 2C8 8 5 12 5 15a7 7 0 0014 0c0-3-3-7-7-13z" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

export default function AppHeader({ locality: localityProp = 'Laitumkhrah', showLocality = true }) {
  const { user } = useAuthStore();
  const { locality, openModal } = useLocationStore();
  const displayLocality = locality || localityProp;

  return (
    <header className="flex items-center justify-between px-4 pt-4 pb-3">
      <Link href="/" className="flex items-center gap-2">
        <div className="w-7 h-7 bg-primary rounded flex items-center justify-center flex-shrink-0">
          <DropIcon />
        </div>
        <span className="font-700 text-text-main text-sm">KIT UM</span>
      </Link>

      {showLocality ? (
        <button
          onClick={openModal}
          className="flex items-center gap-1 text-xs font-medium text-text-muted border border-border-default rounded-full px-2.5 py-1.5 hover:border-primary transition-colors"
        >
          <PinIcon />
          <span>{displayLocality}</span>
          <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      ) : (
        <button className="text-text-muted hover:text-text-main transition-colors">
          <PinIcon />
        </button>
      )}
    </header>
  );
}
