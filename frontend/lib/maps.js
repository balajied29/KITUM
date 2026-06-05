'use client';

/**
 * Hybrid map loaders (both lazy, CDN-injected so they never touch SSR / the
 * webpack bundle):
 *   - Google Maps JS + Places  → address autocomplete + geocoding
 *   - Mapbox GL JS             → live tanker tracking map
 */

let googlePromise = null;
let mapboxPromise = null;

/**
 * Strip a leading Google "Plus Code" (e.g. "HWFC+96, ") from a formatted address.
 * Plus codes show up when there's no precise street address and read like noise
 * to a customer — "HWFC+96, Umpling, Shillong…" → "Umpling, Shillong…".
 */
function stripPlusCode(addr) {
  return String(addr || '')
    .replace(/^[A-Z0-9]{4,8}\+[A-Z0-9]{2,4}[\s,]+/i, '')
    .trim();
}

/**
 * Forward-geocode a place/locality name → { lat, lng, address }.
 * Google first (better local data), OSM Nominatim fallback. Null if both fail.
 */
export async function geocodeAddress(query) {
  try {
    const google = await loadGoogleMaps();
    const geocoder = new google.maps.Geocoder();
    const { results } = await geocoder.geocode({ address: query });
    const loc = results?.[0]?.geometry?.location;
    if (loc) return { lat: loc.lat(), lng: loc.lng(), address: results[0].formatted_address };
  } catch {
    /* fall through to Nominatim */
  }
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`);
    const d = await r.json();
    if (d?.[0]) return { lat: Number(d[0].lat), lng: Number(d[0].lon), address: d[0].display_name };
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * Reverse-geocode coordinates → a formatted address.
 * Prefers Google's data; falls back to OSM Nominatim (tokenless, plain fetch —
 * no script injection) so it still works if the Google JS SDK can't load.
 */
export async function reverseGeocode(lat, lng) {
  try {
    const google = await loadGoogleMaps();
    const geocoder = new google.maps.Geocoder();
    const { results } = await geocoder.geocode({ location: { lat, lng } });
    if (results?.[0]?.formatted_address) return stripPlusCode(results[0].formatted_address);
  } catch {
    /* fall through to Nominatim */
  }
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`);
    const d = await r.json();
    return d?.display_name ? stripPlusCode(d.display_name) : null;
  } catch {
    return null;
  }
}

export function loadGoogleMaps() {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
  if (window.google?.maps?.places) return Promise.resolve(window.google);
  if (googlePromise) return googlePromise;

  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
  googlePromise = new Promise((resolve, reject) => {
    if (!key) return reject(new Error('NEXT_PUBLIC_GOOGLE_MAPS_KEY is not set'));
    const s = document.createElement('script');
    s.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places&loading=async`;
    s.async = true;
    s.onload = () => resolve(window.google);
    s.onerror = () => reject(new Error('Failed to load Google Maps'));
    document.head.appendChild(s);
  });
  return googlePromise;
}

export function loadMapbox() {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
  if (window.mapboxgl) return Promise.resolve(window.mapboxgl);
  if (mapboxPromise) return mapboxPromise;

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  mapboxPromise = new Promise((resolve, reject) => {
    if (!token) return reject(new Error('NEXT_PUBLIC_MAPBOX_TOKEN is not set'));
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = 'https://api.mapbox.com/mapbox-gl-js/v3.6.0/mapbox-gl.css';
    document.head.appendChild(css);

    const s = document.createElement('script');
    s.src = 'https://api.mapbox.com/mapbox-gl-js/v3.6.0/mapbox-gl.js';
    s.async = true;
    s.onload = () => {
      window.mapboxgl.accessToken = token;
      resolve(window.mapboxgl);
    };
    s.onerror = () => reject(new Error('Failed to load Mapbox GL'));
    document.head.appendChild(s);
  });
  return mapboxPromise;
}
