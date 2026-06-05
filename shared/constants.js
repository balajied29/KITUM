/**
 * KITUM shared contract — single source of truth for the realtime protocol.
 *
 * Authored as CommonJS so the backend can `require()` it directly.
 * The frontend (Next) and fulfiller (Expo) keep ESM mirrors at
 * `frontend/lib/constants.js` and `fulfiller/lib/constants.js` — keep them in sync.
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
  SEARCHING: 'searching', // looking for a fulfiller (dispatch in progress)
  DRIVER_ASSIGNED: 'driver_assigned', // a fulfiller accepted
  EN_ROUTE: 'en_route', // fulfiller is driving to the drop point
  ARRIVED: 'arrived', // fulfiller reached the customer
  COMPLETED: 'completed', // water delivered
  CANCELLED: 'cancelled', // cancelled by customer/admin
  EXPIRED: 'expired', // customer cancelled while searching
  NO_FULFILLER: 'no_fulfiller', // dispatch exhausted, nobody accepted
  CUSTOMER_NO_SHOW: 'customer_no_show', // driver arrived, customer unreachable (terminal)
};

/** Statuses a fulfiller can push from the active-job screen. */
const JOB_STATUS_FLOW = [
  REQUEST_STATUS.EN_ROUTE,
  REQUEST_STATUS.ARRIVED,
  REQUEST_STATUS.COMPLETED,
];

/** Socket.IO event names (namespaced strings). */
const EVENTS = {
  // server -> fulfiller
  OFFER_NEW: 'offer:new',
  OFFER_CLOSED: 'offer:closed',
  JOB_ASSIGNED: 'job:assigned',
  JOB_CANCELLED: 'job:cancelled',

  // fulfiller -> server
  PRESENCE_SET: 'presence:set', // { online: boolean }
  AVAILABILITY_SET: 'availability:set', // { available: boolean }
  LOCATION_UPDATE: 'location:update', // { lat, lng, heading, accuracy, speed }
  OFFER_ACCEPT: 'offer:accept', // { requestId }
  OFFER_REJECT: 'offer:reject', // { requestId }
  JOB_STATUS: 'job:status', // { requestId, status }
  JOB_ABANDON: 'job:abandon', // { requestId } — fulfiller can't complete; release + re-dispatch

  // server -> customer
  REQUEST_STATUS: 'request:status', // { requestId, status }
  REQUEST_ASSIGNED: 'request:assigned', // { requestId, fulfiller, vehicle, phone, etaMin }
  REQUEST_LOCATION: 'request:location', // { lat, lng, heading }
  REQUEST_ETA: 'request:eta', // { etaMin, distanceKm }
  REQUEST_TRACKING: 'request:tracking', // { requestId, live: boolean } — live location paused/resumed
  REQUEST_COMPLETED: 'request:completed', // { requestId }

  // customer -> server
  REQUEST_CANCEL: 'request:cancel', // { requestId }

  // generic
  ERROR: 'app:error',
};

/** Why an offer was closed (sent to fulfillers who didn't win). */
const OFFER_CLOSED_REASON = {
  TAKEN: 'taken', // another fulfiller accepted
  TIMEOUT: 'timeout', // this fulfiller's window elapsed
  CANCELLED: 'cancelled', // customer cancelled the request
};

/** Room name helpers — used identically on every client + server. */
const rooms = {
  user: (id) => `user:${id}`,
  fulfiller: (id) => `fulfiller:${id}`,
  request: (id) => `request:${id}`,
};

/** Dispatch engine tuning. Adjust here, applies everywhere. */
const DISPATCH = {
  OFFER_TIMEOUT_MS: 20000, // per-fulfiller decision window
  STAGE1_SIZE: 1, // nearest-first: offer to the single best
  BROADCAST_SIZE: 5, // then broadcast to the next N
  SEARCH_RADII_KM: [5, 10, 15], // expanding search rings
  MAX_ROUNDS: 3, // total dispatch rounds before giving up

  // Disconnect / abandonment handling (B5)
  DISCONNECT_OFFLINE_MS: 15000, // idle fulfiller dropped → mark offline after this grace
  DISCONNECT_ABANDON_MS: 90000, // on-job fulfiller dark → auto-abandon + re-dispatch after this
  SEARCHING_TTL_MS: 300000, // sweep: searching with no live dispatch → no_fulfiller
  PENDING_PAYMENT_TTL_MS: 900000, // sweep: abandoned UPI checkout → expired
  SWEEP_INTERVAL_MS: 60000, // how often the backstop sweep runs
};

/** Battery-aware location sampling profiles for the fulfiller app. */
const LOCATION_PROFILE = {
  IDLE: { accuracy: 'balanced', distanceInterval: 250, timeInterval: 45000 },
  ACTIVE: { accuracy: 'high', distanceInterval: 30, timeInterval: 4000 },
};

/** Canonical tanker sizes — used to seed Products and as a UI fallback. */
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
  LOCATION_PROFILE,
  TANKER_SIZES,
};
