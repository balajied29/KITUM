/**
 * In-memory live state for the realtime layer.
 *
 * This is the launch-time store (single backend instance). It is intentionally
 * tiny and behind a clear interface so it can be swapped for Redis later
 * without touching call sites.
 */

// fulfillerId -> { lat, lng, heading, accuracy, speed, at }
const locations = new Map();
// fulfillerId -> requestId currently being served (drives location relay)
const activeRequest = new Map();
// fulfillerId -> last Mongo-persist timestamp (throttles writes)
const lastPersist = new Map();

const key = (id) => String(id);

const setLocation = (id, loc) => locations.set(key(id), { ...loc, at: Date.now() });
const getLocation = (id) => locations.get(key(id));

const setActiveRequest = (id, requestId) => activeRequest.set(key(id), String(requestId));
const getActiveRequest = (id) => activeRequest.get(key(id));
const clearActiveRequest = (id) => activeRequest.delete(key(id));

const getLastPersist = (id) => lastPersist.get(key(id)) || 0;
const setLastPersist = (id, ts) => lastPersist.set(key(id), ts);

const forget = (id) => {
  locations.delete(key(id));
  activeRequest.delete(key(id));
  lastPersist.delete(key(id));
};

module.exports = {
  setLocation,
  getLocation,
  setActiveRequest,
  getActiveRequest,
  clearActiveRequest,
  getLastPersist,
  setLastPersist,
  forget,
};
