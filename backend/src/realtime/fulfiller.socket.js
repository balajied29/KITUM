/**
 * Socket handlers for a connected fulfiller (tanker operator).
 */
const User = require('../models/User.model');
const registry = require('./registry');
const emit = require('./emit');
const dispatch = require('../services/dispatch/DispatchManager');
const { canGoOnline } = require('../middleware/auth.middleware');
const { EVENTS, rooms } = require('../shared/constants');

const PERSIST_THROTTLE_MS = 20000;
// Sockets skip Express middleware, so rate-limit the firehose event here.
// Clients emit at most ~every 4s; 1s floor blocks floods with plenty of headroom.
const MIN_LOC_INTERVAL_MS = 1000;

module.exports = function registerFulfillerHandlers(io, socket) {
  const fid = String(socket.user._id);
  socket.join(rooms.fulfiller(fid));
  let lastLocAt = 0;

  // This connection may be a reconnect — cancel any pending grace/abandon timer.
  dispatch.handleFulfillerReconnect(fid);

  // Re-join the active request room on reconnect so location relay keeps working.
  const reqId = registry.getActiveRequest(fid);
  if (reqId) socket.join(rooms.request(reqId));

  socket.on(EVENTS.PRESENCE_SET, async ({ online } = {}) => {
    // Server-side gate: a partner may only go online with an approved application
    // AND verified KYC. Re-read fresh so an approval/verification mid-session counts.
    if (online) {
      const fresh = await User.findById(fid).select('role isActive fulfillerProfile').catch(() => null);
      if (!canGoOnline(fresh)) {
        socket.emit(EVENTS.ERROR, {
          code: 'not_eligible',
          message: 'Finish approval and document verification before going online.',
        });
        await User.updateOne({ _id: fid }, { $set: { 'fulfillerProfile.isOnline': false } }).catch(() => {});
        return;
      }
    }
    const set = { 'fulfillerProfile.isOnline': !!online };
    if (!online) set['fulfillerProfile.isAvailable'] = true; // reset availability when going offline
    await User.updateOne({ _id: fid }, { $set: set }).catch(() => {});
  });

  socket.on(EVENTS.AVAILABILITY_SET, async ({ available } = {}) => {
    await User.updateOne(
      { _id: fid },
      { $set: { 'fulfillerProfile.isAvailable': !!available } }
    ).catch(() => {});
  });

  socket.on(EVENTS.LOCATION_UPDATE, async (loc = {}) => {
    if (typeof loc.lat !== 'number' || typeof loc.lng !== 'number') return;
    if (loc.lat < -90 || loc.lat > 90 || loc.lng < -180 || loc.lng > 180) return;
    const now = Date.now();
    if (now - lastLocAt < MIN_LOC_INTERVAL_MS) return; // drop floods
    lastLocAt = now;
    registry.setLocation(fid, loc);

    // Relay to the customer if currently on a job.
    const activeReq = registry.getActiveRequest(fid);
    if (activeReq) {
      emit.toRequest(activeReq, EVENTS.REQUEST_LOCATION, {
        lat: loc.lat,
        lng: loc.lng,
        heading: loc.heading,
      });
    }

    // Persist to Mongo: always when idle (keeps $near fresh & cheap), throttled
    // when on a job (high-frequency updates would hammer the DB).
    const onJob = !!activeReq;
    if (!onJob || now - registry.getLastPersist(fid) > PERSIST_THROTTLE_MS) {
      registry.setLastPersist(fid, now);
      User.updateOne(
        { _id: fid },
        {
          $set: {
            'fulfillerProfile.currentLocation': { type: 'Point', coordinates: [loc.lng, loc.lat] },
            'fulfillerProfile.lastLocationAt': new Date(),
          },
        }
      ).catch(() => {});
    }
  });

  socket.on(EVENTS.OFFER_ACCEPT, ({ requestId } = {}) => {
    if (requestId) dispatch.handleAccept(fid, requestId);
  });

  socket.on(EVENTS.OFFER_REJECT, ({ requestId } = {}) => {
    if (requestId) dispatch.handleReject(fid, requestId);
  });

  socket.on(EVENTS.JOB_STATUS, async ({ requestId, status } = {}, ack) => {
    if (!requestId || !status) {
      if (typeof ack === 'function') ack({ ok: false, status: null, applied: false });
      return;
    }
    const result = await dispatch.handleJobStatus(fid, requestId, status);
    // Acknowledge so the client knows the transition was durably recorded (and can
    // clear its offline journal). Older builds emit without a callback — still fine.
    if (typeof ack === 'function') ack(result);
  });

  socket.on(EVENTS.JOB_ABANDON, ({ requestId } = {}) => {
    if (requestId) dispatch.handleJobAbandon(fid, requestId);
  });

  socket.on('disconnect', () => {
    dispatch.handleFulfillerDisconnect(fid);
  });
};
