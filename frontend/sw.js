import { defaultCache } from '@serwist/next/worker';
import { installSerwist } from '@serwist/sw';

installSerwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // Cache product list for offline browsing
    {
      matcher: ({ url }) => url.pathname === '/api/products',
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'products-cache',
        expiration: { maxEntries: 1, maxAgeSeconds: 60 * 60 * 24 }, // 24h
      },
    },
    // Cache slot availability — short TTL (stale data causes booking errors)
    {
      matcher: ({ url }) => url.pathname === '/api/slots',
      handler: 'NetworkFirst',
      options: {
        cacheName: 'slots-cache',
        expiration: { maxEntries: 10, maxAgeSeconds: 60 * 5 }, // 5 min
        networkTimeoutSeconds: 5,
      },
    },
    // Default: cache all other API responses network-first
    ...defaultCache,
  ],
});
