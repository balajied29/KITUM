/**
 * ESM mirror of /shared/constants.js for the Expo fulfiller app.
 * Keep in sync with the canonical CommonJS file.
 */

export const REQUEST_STATUS = {
  PENDING_PAYMENT: 'pending_payment',
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

// How long the driver must wait at the drop (after ARRIVED) before the
// "customer not responding" report unlocks. Mirrors backend DISPATCH.NO_SHOW_WAIT_MS;
// the server is authoritative — this only drives the on-screen countdown.
export const NO_SHOW_WAIT_MS = 5 * 60 * 1000;

export const EVENTS = {
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
  PAYMENT_RECEIVED: 'payment:received', // UPI paid at the door
  ERROR: 'app:error',
};

// Battery-aware location sampling (mirrors shared LOCATION_PROFILE).
export const LOCATION_PROFILE = {
  IDLE: { distanceInterval: 250, timeInterval: 45000 },
  ACTIVE: { distanceInterval: 30, timeInterval: 4000 },
};

export const COLORS = {
  primary: '#0037b0',
  primaryDark: '#002d8c',
  text: '#131b2e',
  muted: '#64748b',
  bg: '#faf8ff',
  card: '#ffffff',
  border: '#e2e8f0',
  green: '#16a34a',
  red: '#dc2626',
  amber: '#f59e0b',
};
