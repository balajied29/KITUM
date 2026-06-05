/**
 * Best-fit driver scorer for SCHEDULED tanker orders.
 *
 * Pure, interpretable, two-phase. The lifecycle engine (docs/scheduled-dispatch.md)
 * owns WHEN to assign, the atomic commit, notifications, and capacity ledgers; this
 * module owns WHICH driver ranks best for one order.
 *
 *   Phase A (booking): static signals only — no live GPS exists yet. Leans on
 *                      locality affinity + the customer's previous driver.
 *   Phase B (just-in-time): live GPS + whole-slot batch — proximity/route dominate.
 *
 * Design notes that matter:
 *  - Hard FILTERS decide eligibility (binary); SCORES rank the survivors.
 *  - Capacity is a hard filter (truck must be big enough) AND a soft right-sizing
 *    score (don't burn a big truck on a small order if a tight one is free).
 *  - Components can return null (e.g. proximity with no trustworthy points); the
 *    weighted average renormalizes over present components, so a missing signal
 *    never silently drags a driver down. (This is the "null point → full distance
 *    cost" bug, avoided.)
 *  - All DB aggregations happen ONCE per order in buildContext(); scoreDriver() is
 *    pure and does no I/O, so ranking N drivers is N cheap function calls, not N×M
 *    queries. In Phase B, pass a precomputed distance `matrix` (one Mapbox matrix
 *    per slot) — never call getEta per (driver,order) pair.
 */

const Order = require('../../models/Order.model');
const User = require('../../models/User.model');
const geo = require('../geo');
const { SCHED } = require('../../shared/constants');
const localities = require('../../shared/localities');

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const COMMITTED = ['assigned', 'en_route', 'arrived'];

/* ------------------------------------------------------------------ */
/* Context — all DB reads happen here, once per order                 */
/* ------------------------------------------------------------------ */

/**
 * @param {Order} order  a hydrated/lean Order (needs localityId, requiredLitres, slotId, userId)
 * @param {object} opts  { phase: 'A'|'B', widen?: bool, matrix?, requireOnline? }
 * @returns {object} ctx consumed by scoreDriver/rankCandidates
 */
async function buildContext(order, opts = {}) {
  const phase = opts.phase === 'B' ? 'B' : 'A';
  const slotId = order.slotId;

  const [tripAgg, codAgg, preferredIds] = await Promise.all([
    // committed trips per driver in this slot → fairness load + headroom filter
    Order.aggregate([
      { $match: { slotId, assignmentStatus: { $in: COMMITTED }, driverAssigned: { $ne: null } } },
      { $group: { _id: '$driverAssigned', n: { $sum: 1 } } },
    ]),
    // COD orders per driver in this slot → COD-concentration guard
    Order.aggregate([
      { $match: { slotId, paymentMode: 'cod', assignmentStatus: { $in: COMMITTED }, driverAssigned: { $ne: null } } },
      { $group: { _id: '$driverAssigned', n: { $sum: 1 } } },
    ]),
    // drivers who previously delivered to this customer → preferred/premises knowledge
    Order.distinct('driverAssigned', { userId: order.userId, status: 'delivered', driverAssigned: { $ne: null } }),
  ]);

  const assignedTrips = new Map(tripAgg.map((r) => [String(r._id), r.n]));
  const codInSlot = new Map(codAgg.map((r) => [String(r._id), r.n]));
  const preferred = new Set(preferredIds.map(String));

  return {
    phase,
    widen: !!opts.widen,
    matrix: opts.matrix || null, // { [driverId]: { [orderId]: km } }
    assignedTrips,
    codInSlot,
    preferred,
    weights: phase === 'B' ? SCHED.WEIGHTS_B : SCHED.WEIGHTS_A,
  };
}

/* ------------------------------------------------------------------ */
/* Candidate pool — hard eligibility filters                          */
/* ------------------------------------------------------------------ */

/**
 * Active fulfillers eligible for this order. Returns lean User docs.
 * Trip-headroom is applied here using ctx.assignedTrips.
 */
async function candidatePool(order, ctx, opts = {}) {
  const requireOnline = opts.requireOnline ?? false;

  const localityIds = ctx.widen
    ? [order.localityId, ...localities.adjacentIds(order.localityId)]
    : [order.localityId];

  const query = {
    role: 'fulfiller',
    isActive: true,
    'fulfillerProfile.serviceLocalities': { $in: localityIds },
    'fulfillerProfile.capacityLitres': { $gte: order.requiredLitres },
  };
  if (requireOnline) query['fulfillerProfile.isOnline'] = true;

  const docs = await User.find(query).select('-password').lean();

  // Trip-headroom: not over their per-slot cap.
  return docs.filter((d) => {
    const cap = d.fulfillerProfile?.tripsPerSlot ?? SCHED.DEFAULT_TRIPS_PER_SLOT;
    const used = ctx.assignedTrips.get(String(d._id)) || 0;
    return used < cap;
  });
}

/* ------------------------------------------------------------------ */
/* Scoring components (each → [0,1] or null to "abstain")             */
/* ------------------------------------------------------------------ */

function localityAffinity(profile, order, ctx) {
  const lid = order.localityId;
  if (profile.primaryZones?.includes(lid)) return 1.0;
  if (profile.serviceLocalities?.includes(lid)) return 0.6;
  if (ctx.widen) return 0.25; // reached only via adjacency widening
  return 0;
}

function preferredScore(driver, ctx) {
  return ctx.preferred.has(String(driver._id)) ? 1 : 0;
}

// Resolve the best available point for a driver/order, with a confidence flag.
function orderPoint(order) {
  const c = order.deliveryPoint?.coordinates;
  if (Array.isArray(c) && c.length === 2) return { pt: { lng: c[0], lat: c[1] }, confident: true };
  const cen = localities.centerOf(order.localityId);
  if (cen) return { pt: cen, confident: localities.CENTROIDS_VERIFIED };
  return null;
}
function driverPoint(driver, ctx) {
  const profile = driver.fulfillerProfile || {};
  if (ctx.phase === 'B') {
    const c = profile.currentLocation?.coordinates;
    if (Array.isArray(c) && c.length === 2) return { pt: { lng: c[0], lat: c[1] }, confident: true };
  }
  const b = profile.basePoint?.coordinates;
  if (Array.isArray(b) && b.length === 2) return { pt: { lng: b[0], lat: b[1] }, confident: true };
  const zone = (profile.primaryZones || [])[0] || (profile.serviceLocalities || [])[0];
  const cen = zone && localities.centerOf(zone);
  if (cen) return { pt: cen, confident: localities.CENTROIDS_VERIFIED };
  return null;
}

// null = abstain (no trustworthy distance). We only score proximity when the
// distance is CONFIDENT — approximate-centroid distances are dropped, not faked.
function proximityScore(driver, order, ctx) {
  const m = ctx.matrix?.[String(driver._id)]?.[String(order._id)];
  if (typeof m === 'number') return clamp01(1 - m / SCHED.DMAX_KM);

  const o = orderPoint(order);
  const d = driverPoint(driver, ctx);
  if (!o || !d) return null;
  if (!o.confident || !d.confident) return null; // approximate-only → abstain
  const km = geo.haversineKm(d.pt, o.pt);
  if (km == null) return null;
  return clamp01(1 - km / SCHED.DMAX_KM);
}

function capacityFitScore(driver, order) {
  const cap = driver.fulfillerProfile?.capacityLitres || 0;
  const need = order.requiredLitres || 0;
  if (need <= 0 || cap <= 0) return null;
  const slack = (cap - need) / need; // ≥ 0 after the hard filter
  return Math.max(1 / (1 + slack), SCHED.CAPACITY_FIT_FLOOR);
}

function fairnessScore(driver, ctx) {
  const cap = driver.fulfillerProfile?.tripsPerSlot ?? SCHED.DEFAULT_TRIPS_PER_SLOT;
  const used = ctx.assignedTrips.get(String(driver._id)) || 0;
  const loadScore = 1 - clamp01(used / Math.max(cap, 1));

  // Optional earnings equity (money, not job count) when provided by the caller.
  if (ctx.earningsByDriver && ctx.medianEarnings != null) {
    const earn = ctx.earningsByDriver.get(String(driver._id)) || 0;
    const equity = clamp01(1 - earn / (2 * Math.max(ctx.medianEarnings, 1)));
    return 0.6 * loadScore + 0.4 * equity;
  }
  return loadScore;
}

function ratingScore(driver) {
  const r = driver.fulfillerProfile?.rating ?? 5;
  const n = driver.fulfillerProfile?.ratingCount ?? 0;
  const shrunk =
    (n * r + SCHED.RATING_PRIOR_STRENGTH * SCHED.RATING_PRIOR_MEAN) / (n + SCHED.RATING_PRIOR_STRENGTH);
  return clamp01((shrunk - 1) / 4); // 1..5 stars → 0..1
}

function paymentScore(order, driver, ctx) {
  // Prepaid (a captured UPI order is marked paid) is fully certain; anything still
  // unpaid (COD, or a UPI order that never reaches the scorer unpaid by design) = COD_CERTAINTY.
  let s = order.paymentStatus === 'paid' ? 1 : SCHED.COD_CERTAINTY;
  if (order.paymentMode === 'cod') {
    const codCount = ctx.codInSlot.get(String(driver._id)) || 0;
    if (codCount >= SCHED.COD_MAX_PER_SLOT) s *= 0.5; // discourage piling COD on one driver
  }
  return s;
}

function reliabilityScore(driver) {
  const p = driver.fulfillerProfile || {};
  const off = p.schedOfferCount || 0;
  const acc = p.schedAcceptCount || 0;
  const asg = p.schedAssignedCount || 0;
  const ns = p.schedNoShowCount || 0;
  const k = SCHED.RELIABILITY_PRIOR_STRENGTH;
  const accRate = (acc + k * SCHED.RELIABILITY_PRIOR_ACCEPT) / (off + k);
  const noShowRate = (ns + k * 0.1) / (asg + k);
  return clamp01(0.7 * accRate + 0.3 * (1 - noShowRate));
}

function newDriverBoost(driver) {
  const n = driver.fulfillerProfile?.ratingCount ?? 0;
  if (n >= SCHED.NEW_DRIVER_RATING_COUNT) return 0;
  return SCHED.NEW_DRIVER_BONUS_MAX * (1 - n / SCHED.NEW_DRIVER_RATING_COUNT);
}

/* ------------------------------------------------------------------ */
/* Score one driver (pure)                                            */
/* ------------------------------------------------------------------ */

function scoreDriver(driver, order, ctx) {
  const profile = driver.fulfillerProfile || {};
  const comps = {
    locality: localityAffinity(profile, order, ctx),
    preferred: preferredScore(driver, ctx),
    proximity: proximityScore(driver, order, ctx),
    capacityFit: capacityFitScore(driver, order),
    fairness: fairnessScore(driver, ctx),
    rating: ratingScore(driver),
    payment: paymentScore(order, driver, ctx),
    reliability: reliabilityScore(driver),
  };

  // Weighted average over PRESENT components (renormalize so a null abstains).
  const W = ctx.weights;
  let num = 0;
  let den = 0;
  for (const k of Object.keys(W)) {
    if (W[k] > 0 && comps[k] != null) {
      num += W[k] * comps[k];
      den += W[k];
    }
  }
  const base = den > 0 ? num / den : 0;
  const boost = newDriverBoost(driver);
  const score = clamp01(base + boost);

  return {
    driverId: String(driver._id),
    name: driver.name,
    score,
    boost,
    breakdown: comps, // logged for the "why driver X?" ops view
  };
}

/* ------------------------------------------------------------------ */
/* Rank + select                                                      */
/* ------------------------------------------------------------------ */

// Deterministic, non-flapping order: score desc, then (within EPSILON) fairness,
// reliability, preferred, finally _id — so repeated solves are reproducible.
function compareScored(a, b) {
  if (Math.abs(a.score - b.score) > SCHED.TIE_EPSILON) return b.score - a.score;
  const fa = a.breakdown.fairness ?? 0;
  const fb = b.breakdown.fairness ?? 0;
  if (fa !== fb) return fb - fa;
  const ra = a.breakdown.reliability ?? 0;
  const rb = b.breakdown.reliability ?? 0;
  if (ra !== rb) return rb - ra;
  const pa = a.breakdown.preferred ?? 0;
  const pb = b.breakdown.preferred ?? 0;
  if (pa !== pb) return pb - pa;
  return a.driverId < b.driverId ? -1 : 1;
}

function rankCandidates(order, drivers, ctx) {
  return drivers.map((d) => scoreDriver(d, order, ctx)).sort(compareScored);
}

/**
 * Top-level convenience: build context, fetch the eligible pool, rank it.
 * Returns { applicable, mode, localityId, ranked, count }.
 *   applicable=false → bottled-only order / unknown locality (not a tanker assignment)
 *   mode='thin'      → ≤ THIN_SUPPLY_MAX eligible drivers → hand to a human dispatcher
 *   mode='dense'     → enough supply to trust the optimizer
 *   mode='none'      → zero eligible even after widening → escalate to admin
 *
 * @param {Order} order
 * @param {object} opts { phase, widen, matrix, requireOnline }
 */
async function selectBestDriver(order, opts = {}) {
  if (!order.requiredLitres || order.requiredLitres <= 0) {
    return { applicable: false, reason: 'not_a_tanker_order', ranked: [] };
  }
  if (!order.localityId || !localities.byId(order.localityId)) {
    return { applicable: false, reason: 'unknown_locality', ranked: [] };
  }

  const ctx = await buildContext(order, opts);
  let pool = await candidatePool(order, ctx, opts);

  // If nothing serves the locality directly, widen to adjacent localities once.
  if (pool.length === 0 && !ctx.widen) {
    ctx.widen = true;
    pool = await candidatePool(order, ctx, opts);
  }

  const ranked = rankCandidates(order, pool, ctx);
  const mode = ranked.length === 0 ? 'none' : ranked.length <= SCHED.THIN_SUPPLY_MAX ? 'thin' : 'dense';

  return { applicable: true, mode, localityId: order.localityId, widened: ctx.widen, count: ranked.length, ranked };
}

module.exports = {
  buildContext,
  candidatePool,
  scoreDriver,
  rankCandidates,
  selectBestDriver,
};
