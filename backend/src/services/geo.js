/**
 * Hybrid geo service.
 *  - Google Geocoding API  → address ⇄ coordinates (superior regional accuracy)
 *  - Mapbox Directions API → driving distance + ETA for tracking/dispatch
 *
 * Uses the global `fetch` (Node >= 18). All network calls fail soft — geo data
 * is best-effort and must never block the dispatch flow.
 */

const GOOGLE_KEY = process.env.GOOGLE_MAPS_API_KEY;
const MAPBOX_TOKEN = process.env.MAPBOX_TOKEN;

const R_KM = 6371;
const toRad = (d) => (d * Math.PI) / 180;

/** Strip a leading Google Plus Code (e.g. "HWFC+96, ") from a formatted address. */
const stripPlusCode = (addr) =>
  String(addr || '').replace(/^[A-Z0-9]{4,8}\+[A-Z0-9]{2,4}[\s,]+/i, '').trim();

/** Great-circle distance in km. `a`/`b` are { lat, lng }. */
function haversineKm(a, b) {
  if (!a || !b) return null;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return R_KM * 2 * Math.asin(Math.sqrt(h));
}

/** Rough ETA in minutes from straight-line distance (dispatch fallback). */
function roughEtaMin(distanceKm, avgKmh = 25) {
  if (distanceKm == null) return null;
  return Math.max(1, Math.round((distanceKm / avgKmh) * 60));
}

/** Google: address string → { lat, lng, formatted }. */
async function geocode(address) {
  if (!GOOGLE_KEY || !address) return null;
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
      address
    )}&region=in&key=${GOOGLE_KEY}`;
    const res = await fetch(url);
    const json = await res.json();
    const hit = json.results?.[0];
    if (!hit) return null;
    return {
      lat: hit.geometry.location.lat,
      lng: hit.geometry.location.lng,
      formatted: hit.formatted_address,
    };
  } catch {
    return null;
  }
}

/** Google: coordinates → formatted address. */
async function reverseGeocode(lat, lng) {
  if (!GOOGLE_KEY) return null;
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_KEY}`;
    const res = await fetch(url);
    const json = await res.json();
    const hit = json.results?.[0]?.formatted_address;
    return hit ? stripPlusCode(hit) : null;
  } catch {
    return null;
  }
}

/**
 * Mapbox: driving distance + ETA between two points.
 * `from`/`to` are { lat, lng }. Falls back to haversine if Mapbox is unset/fails.
 */
async function getEta(from, to) {
  const fallback = () => {
    const distanceKm = haversineKm(from, to);
    return { distanceKm, etaMin: roughEtaMin(distanceKm) };
  };
  if (!MAPBOX_TOKEN || !from || !to) return fallback();
  try {
    const coords = `${from.lng},${from.lat};${to.lng},${to.lat}`;
    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coords}?overview=false&access_token=${MAPBOX_TOKEN}`;
    const res = await fetch(url);
    const json = await res.json();
    const route = json.routes?.[0];
    if (!route) return fallback();
    return {
      distanceKm: route.distance / 1000,
      etaMin: Math.max(1, Math.round(route.duration / 60)),
    };
  } catch {
    return fallback();
  }
}

module.exports = { haversineKm, roughEtaMin, geocode, reverseGeocode, getEta };
