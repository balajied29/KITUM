'use client';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useConsentStore } from '@/lib/consent';

function Toggle({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
        checked ? 'bg-primary' : 'bg-border-default'
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-[22px]' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

export default function CookieConsent() {
  const pathname = usePathname();
  const { decided, settingsOpen, acceptAll, rejectAll, savePreferences, openSettings, closeSettings, categories } =
    useConsentStore();

  // Avoid an SSR/hydration mismatch: the persisted choice is only known on the client.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Local copy of the analytics toggle while the settings panel is open.
  const [analytics, setAnalytics] = useState(false);
  useEffect(() => {
    if (settingsOpen) setAnalytics(categories.analytics);
  }, [settingsOpen, categories.analytics]);

  // The internal admin tool gets no consent UI (staff, not visitors).
  if (!mounted || pathname?.startsWith('/admin')) return null;

  const showBanner = !decided && !settingsOpen;

  return (
    <>
      {/* First-visit banner */}
      {showBanner && (
        <div className="fixed inset-x-0 bottom-0 z-[60] px-3 pb-[calc(env(safe-area-inset-bottom,0px)+12px)]">
          <div className="mx-auto max-w-[var(--app-w)] card shadow-[0_8px_40px_-8px_rgba(19,27,46,0.35)]">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-bg-trust">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0037b0" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3a9 9 0 109 9 4 4 0 01-5-5 4 4 0 01-4-4z" />
                  <circle cx="9" cy="13" r="1" fill="#0037b0" stroke="none" />
                  <circle cx="14" cy="16" r="1" fill="#0037b0" stroke="none" />
                  <circle cx="15" cy="10" r="1" fill="#0037b0" stroke="none" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-700 text-text-main">Your privacy</p>
                <p className="text-xs text-text-muted mt-1 leading-relaxed">
                  We use essential cookies to run KitUm (sign-in, cart, security). With your consent we also
                  use analytics (Microsoft Clarity, Google Analytics) to see how the app is used and improve it.{' '}
                  <Link href="/legal/privacy" className="text-primary font-medium hover:underline">
                    Privacy Policy
                  </Link>
                  .
                </p>
              </div>
            </div>

            <div className="mt-3.5 flex flex-col gap-2">
              <div className="flex gap-2">
                <button onClick={rejectAll} className="btn-ghost flex-1 border border-border-default">
                  Reject non-essential
                </button>
                <button onClick={acceptAll} className="btn-primary flex-1">
                  Accept all
                </button>
              </div>
              <button
                onClick={openSettings}
                className="text-xs text-text-muted hover:text-primary underline underline-offset-2 self-center py-1"
              >
                Customize
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings panel */}
      {settingsOpen && (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/40 p-3">
          <div className="w-full max-w-[var(--app-w)] card max-h-[88vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <p className="text-base font-700 text-text-main">Cookie preferences</p>
              <button onClick={closeSettings} aria-label="Close" className="p-1 -mr-1 text-text-muted hover:text-text-main">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            <p className="text-xs text-text-muted mt-1 leading-relaxed">
              Choose what KitUm may store on your device. You can change this any time from the footer.
            </p>

            {/* Necessary (locked on) */}
            <div className="mt-4 flex items-start justify-between gap-3 rounded-input bg-bg-card px-3 py-3">
              <div className="min-w-0">
                <p className="text-sm font-700 text-text-main">Essential</p>
                <p className="text-xs text-text-muted mt-0.5 leading-relaxed">
                  Required for sign-in, your cart and security. Always on.
                </p>
              </div>
              <span className="text-[11px] font-700 text-primary bg-bg-trust rounded-chip px-2.5 py-1 flex-shrink-0">
                Always on
              </span>
            </div>

            {/* Analytics */}
            <div className="mt-2.5 flex items-start justify-between gap-3 rounded-input border border-border-default px-3 py-3">
              <div className="min-w-0">
                <p className="text-sm font-700 text-text-main">Analytics</p>
                <p className="text-xs text-text-muted mt-0.5 leading-relaxed">
                  Microsoft Clarity and Google Analytics. Helps us understand usage and fix problems. We do
                  not sell your data.
                </p>
              </div>
              <Toggle checked={analytics} onChange={setAnalytics} label="Allow analytics cookies" />
            </div>

            <div className="mt-4 flex gap-2">
              <button onClick={rejectAll} className="btn-ghost flex-1 border border-border-default">
                Reject all
              </button>
              <button onClick={() => savePreferences({ analytics })} className="btn-primary flex-1">
                Save preferences
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
