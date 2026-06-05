/**
 * Backend copy of the KITUM realtime contract.
 *
 * The canonical spec lives at /shared/constants.js (repo root). This copy keeps
 * the backend self-contained so it deploys cleanly with its service root at
 * /backend (Railway) without reaching outside the folder. Keep it in sync with
 * /shared/constants.js — the frontend and fulfiller apps keep their own mirrors too.
 */

const ROLES = {
  CUSTOMER: 'customer',
  ADMIN: 'admin',
  DRIVER: 'driver', // legacy (scheduled flow)
  FULFILLER: 'fulfiller', // tanker operator (instant flow)
};

/** DeliveryRequest lifecycle. */
const REQUEST_STATUS = {
  PENDING_PAYMENT: 'pending_payment', // UPI: created, awaiting payment — NOT dispatchable yet
  SEARCHING: 'searching',
  DRIVER_ASSIGNED: 'driver_assigned',
  EN_ROUTE: 'en_route',
  ARRIVED: 'arrived',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  EXPIRED: 'expired',
  NO_FULFILLER: 'no_fulfiller',
  CUSTOMER_NO_SHOW: 'customer_no_show', // driver arrived, customer unreachable (terminal)
};

/** Statuses a fulfiller can push from the active-job screen. */
const JOB_STATUS_FLOW = [
  REQUEST_STATUS.EN_ROUTE,
  REQUEST_STATUS.ARRIVED,
  REQUEST_STATUS.COMPLETED,
];

/** Socket.IO event names. */
const EVENTS = {
  OFFER_NEW: 'offer:new',
  OFFER_CLOSED: 'offer:closed',
  JOB_ASSIGNED: 'job:assigned',
  JOB_CANCELLED: 'job:cancelled',

  PRESENCE_SET: 'presence:set',
  AVAILABILITY_SET: 'availability:set',
  LOCATION_UPDATE: 'location:update',
  OFFER_ACCEPT: 'offer:accept',
  OFFER_REJECT: 'offer:reject',
  JOB_STATUS: 'job:status',
  JOB_ABANDON: 'job:abandon',

  REQUEST_STATUS: 'request:status',
  REQUEST_ASSIGNED: 'request:assigned',
  REQUEST_LOCATION: 'request:location',
  REQUEST_ETA: 'request:eta',
  REQUEST_TRACKING: 'request:tracking',
  REQUEST_COMPLETED: 'request:completed',

  REQUEST_CANCEL: 'request:cancel',

  PAYMENT_RECEIVED: 'payment:received', // UPI paid at the door → tell the driver

  ERROR: 'app:error',
};

const OFFER_CLOSED_REASON = {
  TAKEN: 'taken',
  TIMEOUT: 'timeout',
  CANCELLED: 'cancelled',
};

const rooms = {
  user: (id) => `user:${id}`,
  fulfiller: (id) => `fulfiller:${id}`,
  request: (id) => `request:${id}`,
};

// Ops-tunable via env (so timers can be adjusted without a redeploy, and tests
// can use short values). Falls back to the documented defaults.
const num = (v, d) => (Number(v) > 0 ? Number(v) : d);

const DISPATCH = {
  OFFER_TIMEOUT_MS: num(process.env.DISPATCH_OFFER_TIMEOUT_MS, 20000),
  STAGE1_SIZE: 1,
  BROADCAST_SIZE: 5,
  SEARCH_RADII_KM: [5, 10, 15],
  MAX_ROUNDS: 3,

  // Disconnect / abandonment handling (B5)
  DISCONNECT_OFFLINE_MS: num(process.env.DISCONNECT_OFFLINE_MS, 15000),
  DISCONNECT_ABANDON_MS: num(process.env.DISCONNECT_ABANDON_MS, 90000),
  SEARCHING_TTL_MS: num(process.env.SEARCHING_TTL_MS, 300000),
  // Accepted (driver_assigned) but never started past this → no-show: reclaim + re-dispatch.
  ASSIGNED_START_TTL_MS: num(process.env.ASSIGNED_START_TTL_MS, 180000),
  PENDING_PAYMENT_TTL_MS: num(process.env.PENDING_PAYMENT_TTL_MS, 900000),
  SWEEP_INTERVAL_MS: num(process.env.SWEEP_INTERVAL_MS, 60000),

  // Customer-no-show gates: the driver must have been ARRIVED for at least
  // NO_SHOW_WAIT_MS and be physically within NO_SHOW_RADIUS_KM of the drop.
  NO_SHOW_WAIT_MS: num(process.env.NO_SHOW_WAIT_MS, 5 * 60 * 1000),
  NO_SHOW_RADIUS_KM: Number(process.env.NO_SHOW_RADIUS_KM) || 0.15, // ~150 m (allows GPS drift)
};

// Scheduled-flow (Order) best-fit driver scoring + matching. Weights per phase
// sum to 1.0 (Phase A = booking time, static signals only — no live GPS; Phase B
// = just-in-time, live GPS + whole-slot batch). See docs/scheduled-dispatch.md.
const schedNum = (v, d) => (Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : d);
const SCHED = {
  // component weights — Phase A (booking earmark, static)
  WEIGHTS_A: { locality: 0.30, preferred: 0.20, proximity: 0.0, capacityFit: 0.15, fairness: 0.15, rating: 0.10, payment: 0.10, reliability: 0.0 },
  // component weights — Phase B (JIT commit, live + batch)
  WEIGHTS_B: { locality: 0.15, preferred: 0.15, proximity: 0.30, capacityFit: 0.10, fairness: 0.15, rating: 0.05, payment: 0.05, reliability: 0.05 },

  DMAX_KM: schedNum(process.env.SCHED_DMAX_KM, 12),     // Shillong is small; beyond this proximity→0
  CAPACITY_FIT_FLOOR: 0.1,                               // a too-big-but-only truck still scores > 0
  RATING_PRIOR_MEAN: 4.3,                                // Bayesian shrink target (NOT the default 5)
  RATING_PRIOR_STRENGTH: 8,                              // pseudo-counts
  RELIABILITY_PRIOR_ACCEPT: 0.8,
  RELIABILITY_PRIOR_STRENGTH: 5,
  NEW_DRIVER_RATING_COUNT: 10,                           // < this many ratings ⇒ "new"
  NEW_DRIVER_BONUS_MAX: 0.05,                            // additive nudge, decays to 0
  COD_CERTAINTY: 0.5,                                    // prepaid = 1.0
  COD_MAX_PER_SLOT: schedNum(process.env.SCHED_COD_MAX_PER_SLOT, 3),
  TIE_EPSILON: 0.02,                                     // scores within this are "tied" → deterministic tiebreak
  THIN_SUPPLY_MAX: 1,                                    // ≤ this many eligible ⇒ decision-support / thin-supply mode
  DEFAULT_TRIPS_PER_SLOT: schedNum(process.env.SCHED_DEFAULT_TRIPS_PER_SLOT, 4), // until refill model lands
};

const LOCATION_PROFILE = {
  IDLE: { accuracy: 'balanced', distanceInterval: 250, timeInterval: 45000 },
  ACTIVE: { accuracy: 'high', distanceInterval: 30, timeInterval: 4000 },
};

const TANKER_SIZES = [
  { litres: 1000, label: '1000 L', slug: 'tanker-1000l', price: 600 },
  { litres: 2000, label: '2000 L', slug: 'tanker-2000l', price: 1100 },
  { litres: 5000, label: '5000 L', slug: 'tanker-5000l', price: 2500 },
  { litres: 10000, label: '10000 L', slug: 'tanker-10000l', price: 4500 },
];

module.exports = {
  ROLES,
  REQUEST_STATUS,
  JOB_STATUS_FLOW,
  EVENTS,
  OFFER_CLOSED_REASON,
  rooms,
  DISPATCH,
  SCHED,
  LOCATION_PROFILE,
  TANKER_SIZES,
};
