/**
 * Shared line icons (no emojis). Inherit color via `currentColor` and size via
 * the `className` (e.g. "w-6 h-6"). Stroke-based to match the app's icon style.
 */

export function TankerIcon({ className = 'w-6 h-6' }) {
  // Water tanker: cylindrical tank + cab + wheels, with a droplet to read as water.
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="1.75" y="6.5" width="12.25" height="8" rx="4" />
      <path d="M14 8.75h3.9L21.25 12v2.5H14" />
      <path d="M8 9.7c-1.1 1.45-1.7 2.35-1.7 3.05a1.7 1.7 0 0 0 3.4 0c0-.7-.6-1.6-1.7-3.05Z" />
      <circle cx="6.75" cy="17" r="1.9" />
      <circle cx="17.4" cy="17" r="1.9" />
      <path d="M8.65 17h6.85" />
    </svg>
  );
}

export function BoltIcon({ className = 'w-6 h-6' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3.75 13.5 14.25 2.25 12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" />
    </svg>
  );
}

export function CheckIcon({ className = 'w-4 h-4' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m5 12.5 4.5 4.5L19 6.5" />
    </svg>
  );
}

export function StarIcon({ className = 'w-5 h-5', filled = true }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2.75l2.85 5.78 6.38.93-4.62 4.5 1.09 6.35L12 17.77l-5.7 3 1.09-6.35-4.62-4.5 6.38-.93L12 2.75Z" />
    </svg>
  );
}

export function SunIcon({ className = 'w-5 h-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2.5M12 19.5V22M4.2 4.2l1.8 1.8M18 18l1.8 1.8M2 12h2.5M19.5 12H22M4.2 19.8 6 18M18 6l1.8-1.8" />
    </svg>
  );
}

export function CloudSunIcon({ className = 'w-5 h-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 5V3.5M4.5 6.5 3.4 5.4M11.5 6.5l1.1-1.1M3.5 10H2M5.4 12.8A3.5 3.5 0 1 1 11 9.2" />
      <path d="M17.5 12a3.5 3.5 0 0 1 .4 6.99H8.5a3 3 0 0 1-.4-5.97A4 4 0 0 1 17.5 12Z" />
    </svg>
  );
}

export function MoonIcon({ className = 'w-5 h-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20.5 14.5A8.5 8.5 0 1 1 9.5 3.5a6.5 6.5 0 0 0 11 11Z" />
    </svg>
  );
}
