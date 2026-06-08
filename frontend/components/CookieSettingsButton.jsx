'use client';
import { useConsentStore } from '@/lib/consent';

/**
 * Reopen the cookie settings panel from anywhere (used in the footer). Lets a
 * visitor change their choice at any time, which consent law expects.
 */
export default function CookieSettingsButton({ className = '' }) {
  const openSettings = useConsentStore((s) => s.openSettings);
  return (
    <button
      type="button"
      onClick={openSettings}
      className={className || 'text-sm text-text-body hover:text-primary transition-colors text-left'}
    >
      Cookie preferences
    </button>
  );
}
