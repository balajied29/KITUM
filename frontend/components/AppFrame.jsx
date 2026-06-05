'use client';
import { usePathname } from 'next/navigation';
import BottomNav from '@/components/BottomNav';
import LocationModal from '@/components/LocationModal';

/**
 * Chooses the shell per area:
 *  - /admin/*  → full-width (the admin layout provides its own sidebar shell).
 *  - everything else → the centered phone-width PWA column + bottom nav + location modal.
 * (Previously the phone column wrapped EVERYTHING, which squeezed the admin UI.)
 */
export default function AppFrame({ children }) {
  const pathname = usePathname();

  if (pathname?.startsWith('/admin')) return <>{children}</>;

  return (
    <>
      <div className="mx-auto min-h-dvh max-w-[var(--app-w)] pad-nav bg-bg-page shadow-[0_0_50px_-12px_rgba(19,27,46,0.18)]">
        {children}
      </div>
      <LocationModal />
      <BottomNav />
    </>
  );
}
