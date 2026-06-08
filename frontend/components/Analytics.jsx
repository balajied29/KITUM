'use client';
import Script from 'next/script';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { useConsentStore } from '@/lib/consent';

// Public client ids. Each tool loads only if its id is set, so adding Google
// Analytics (or removing a tool) is purely an env change, no code change.
const CLARITY_ID = process.env.NEXT_PUBLIC_CLARITY_ID;
const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

// Best-effort removal of analytics cookies when consent is withdrawn. A full
// purge happens on the next reload; this clears the obvious ones immediately.
function clearAnalyticsCookies() {
  if (typeof document === 'undefined') return;
  const host = window.location.hostname;
  const root = '.' + host.split('.').slice(-2).join('.');
  const scopes = ['path=/', `path=/; domain=${host}`, `path=/; domain=${root}`];
  document.cookie.split(';').forEach((c) => {
    const name = c.split('=')[0].trim();
    if (/^_clck$|^_clsk$|^_ga|^_gid$|^_gat/.test(name)) {
      scopes.forEach((s) => {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; ${s}`;
      });
    }
  });
}

/**
 * Loads visitor-analytics tools, but ONLY after the user grants analytics
 * consent (so no third-party cookies are set before opt-in). Never runs on the
 * internal /admin tool, where staff sessions and customer PII are on screen.
 */
export default function Analytics() {
  const pathname = usePathname();
  const analytics = useConsentStore((s) => s.categories.analytics);
  const wasOn = useRef(false);

  // Consent withdrawn mid-session: tell the already-loaded tools to stop and
  // clear what we can. (Scripts also unmount below so they don't reload.)
  useEffect(() => {
    if (wasOn.current && !analytics) {
      try { window.clarity && window.clarity('consent', false); } catch {}
      try {
        window.gtag && window.gtag('consent', 'update', { ad_storage: 'denied', analytics_storage: 'denied' });
      } catch {}
      clearAnalyticsCookies();
    }
    wasOn.current = analytics;
  }, [analytics]);

  if (pathname?.startsWith('/admin')) return null;
  if (!analytics) return null;

  return (
    <>
      {CLARITY_ID && (
        <Script id="ms-clarity" strategy="afterInteractive">
          {`(function(c,l,a,r,i,t,y){
              c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
              t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
              y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
          })(window, document, "clarity", "script", "${CLARITY_ID}");`}
        </Script>
      )}

      {GA_ID && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
          <Script id="ga4-init" strategy="afterInteractive">
            {`window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${GA_ID}', { anonymize_ip: true });`}
          </Script>
        </>
      )}
    </>
  );
}
