/**
 * Nearby-fulfiller availability — a DISPLAY-ONLY signal for the customer home
 * ("3 tankers nearby", "available now"). It is NOT the dispatch matcher; real
 * matching lives in DispatchManager and stays separate/strict.
 *
 * HEAVILY OPTIMISED for read volume: every customer hits this on home load, so we
 * never run a per-request geo query. Instead we keep ONE in-memory snapshot of the
 * available fleet, refreshed at most once per TTL (single-flight), and answer each
 * request with an O(N) haversine over that small array (Shillong fleet = tens of
 * docs). DB load is therefore independent of customer traffic.
 */
const User = require('../models/User.model');
const geo = require('./geo');

const TTL_MS = Number(process.env.AVAILABILITY_TTL_MS) || 20000; // snapshot freshness window

let snapshot = []; // [{ lng, lat, cap }]
let snapAt = 0;
let refreshing = null; // in-flight refresh promise (single-flight guard)

async function refresh() {
  try {
    const docs = await User.find({
      role: 'fulfiller',
      isActive: true,
      'fulfillerProfile.isOnline': true,
      'fulfillerProfile.isAvailable': true,
      'fulfillerProfile.currentLocation.coordinates': { $exists: true },
    })
      .select('fulfillerProfile.currentLocation.coordinates fulfillerProfile.capacityLitres')
      .lean();

    snapshot = docs
      .map((d) => {
        const c = d.fulfillerProfile?.currentLocation?.coordinates;
        if (!Array.isArray(c) || c.length !== 2) return null;
        return { lng: c[0], lat: c[1], cap: d.fulfillerProfile?.capacityLitres || 0 };
      })
      .filter(Boolean);
  } catch {
    // Keep the previous snapshot on error (degrade gracefully, don't go to zero).
  }
  snapAt = Date.now(); // stamp even on error so we don't hammer Mongo on persistent failure
  return snapshot;
}

/** Fresh-or-refresh snapshot, single-flighted so concurrent requests share one query. */
async function getSnapshot() {
  if (snapAt && Date.now() - snapAt < TTL_MS) return snapshot;
  if (!refreshing) refreshing = refresh().finally(() => { refreshing = null; });
  return refreshing;
}

/**
 * Availability near a point (radius-filtered) or citywide (no point).
 * @param {{lat?:number, lng?:number, radiusKm?:number, sizes?:number[]}} opts
 * @returns {Promise<{total:number, sizes:Object<string,number>, updatedAt:number}>}
 *   total      — available fulfillers nearby (any size)
 *   sizes[s]   — available fulfillers whose tanker can carry >= s litres
 */
async function availability({ lat, lng, radiusKm = 10, sizes = [] } = {}) {
  const snap = await getSnapshot();
  const hasPoint = Number.isFinite(lat) && Number.isFinite(lng);
  const within = hasPoint
    ? snap.filter((s) => {
        const d = geo.haversineKm({ lat, lng }, { lat: s.lat, lng: s.lng });
        return d != null && d <= radiusKm;
      })
    : snap;

  const caps = within.map((s) => s.cap);
  const bySize = {};
  for (const sz of sizes) bySize[sz] = caps.filter((c) => c >= sz).length;
  return { total: within.length, sizes: bySize, updatedAt: snapAt };
}

module.exports = { availability, refresh };
