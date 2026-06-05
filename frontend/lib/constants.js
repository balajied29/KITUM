/**
 * ESM mirror of /shared/constants.js for the Next.js customer app.
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
  ERROR: 'app:error',
};
