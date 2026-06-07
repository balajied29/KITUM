/**
 * DispatchManager — the core ride-hailing offer engine.
 *
 * Lifecycle of an instant request:
 *   1. Round 1 (nearest-first): offer to the single closest available fulfiller,
 *      ~20s decision window.
 *   2. Round 2+ (broadcast): on reject/timeout, offer simultaneously to the next
 *      N best fulfillers — first to accept wins (atomic claim in Mongo).
 *   3. Each round widens the search radius. After MAX_ROUNDS with no taker the
 *      request is marked `no_fulfiller` and the customer is told to schedule.
 *
 * State (timers, per-round bookkeeping) lives in memory on this single instance.
 * `recover()` re-queues any `searching` requests after a restart. The only
 * source of truth for "who got the job" is the atomic findOneAndUpdate, so the
 * in-memory state can never cause a double assignment.
 */

const DeliveryRequest = require('../../models/DeliveryRequest.model');
const User = require('../../models/User.model');
const emit = require('../../realtime/emit');
const registry = require('../../realtime/registry');
const geo = require('../geo');
const push = require('../push');
const whatsapp = require('../whatsapp');
const payments = require('../payments');
const promotions = require('../promotions');
const { DRY_RUN_FEE, partnerSplit } = require('../../shared/pricing');

// Customer accountability — no money is taken upfront, so repeated cancellations
// after a driver commits earn a strike; past the threshold the customer is blocked
// from booking for a cooldown window.
const STRIKE_BLOCK_THRESHOLD = 3;
const STRIKE_BLOCK_MS = 3 * 24 * 60 * 60 * 1000;
const {
  EVENTS,
  REQUEST_STATUS,
  OFFER_CLOSED_REASON,
  DISPATCH,
  rooms,
} = require('../../shared/constants');

// requestId(string) -> dispatch state.
//
// ⚠️ SCALE NOTE: this Map (and the setTimeout handles it holds) is process-local.
// It is correct ONLY while the backend runs as a SINGLE instance. Running 2+
// replicas splits this state across processes — offers stop resolving and socket
// rooms fragment. Keep Railway at numReplicas:1 until this is moved to Redis +
// a distributed job/timer store (see BEFORE_LIVE.md → B3). The atomic Mongo claim
// in handleAccept still prevents double-assignment, but timers/offers would break.
const active = new Map();

// fid -> timeout: grace timer (idle) or abandon timer (on-job) for a dropped socket.
const disconnectTimers = new Map();

const shortId = (id) => String(id).slice(-6).toUpperCase();

/* ------------------------------------------------------------------ */
/* Entry point                                                        */
/* ------------------------------------------------------------------ */

/**
 * Begin dispatching a freshly-created (or recovered/re-dispatched) request.
 * `options.exclude` seeds the attempted set — used by re-dispatch so the
 * fulfiller who just bailed isn't immediately re-offered the same job.
 */
async function dispatch(request, options = {}) {
  const id = String(request._id);
  if (active.has(id)) return; // already dispatching
  if (request.status !== REQUEST_STATUS.SEARCHING) return;

  const state = {
    requestId: id,
    request,
    round: 0,
    settled: false,
    attempted: new Set((options.exclude || []).map(String)), // never offer these
    offerTimers: new Map(), // fid -> timeout handle (current round)
    pending: 0,
    resolveRound: null,
  };
  active.set(id, state);
  runDispatch(state).catch(() => cleanup(state));
}

async function runDispatch(state) {
  const { request } = state;
  while (!state.settled && state.round < DISPATCH.MAX_ROUNDS) {
    state.round += 1;
    const radiusKm =
      DISPATCH.SEARCH_RADII_KM[Math.min(state.round - 1, DISPATCH.SEARCH_RADII_KM.length - 1)];

    const candidates = await findCandidates(request, radiusKm, state.attempted);
    if (candidates.length === 0) continue; // widen the ring on the next round

    const batchSize = state.round === 1 ? DISPATCH.STAGE1_SIZE : DISPATCH.BROADCAST_SIZE;
    const batch = candidates.slice(0, batchSize);

    const outcome = await offerRound(state, batch);
    if (outcome === 'accepted') return; // settled inside handleAccept
    // 'exhausted' → loop to the next, wider round
  }
  if (!state.settled) await giveUp(state);
}

/* ------------------------------------------------------------------ */
/* Candidate selection (Mongo $near over the 2dsphere index)          */
/* ------------------------------------------------------------------ */

async function findCandidates(request, radiusKm, exclude) {
  const [lng, lat] = request.dropLocation.coordinates;
  try {
    const docs = await User.find({
      role: 'fulfiller',
      isActive: true,
      'fulfillerProfile.isOnline': true,
      'fulfillerProfile.isAvailable': true,
      'fulfillerProfile.capacityLitres': { $gte: request.capacityLitres },
      _id: { $nin: [...exclude] },
      'fulfillerProfile.currentLocation': {
        $near: {
          $geometry: { type: 'Point', coordinates: [lng, lat] },
          $maxDistance: radiusKm * 1000,
        },
      },
    })
      .limit(20)
      .lean();

    // $near gives nearest-first. Annotate live socket state and float connected
    // fulfillers up so a dead app never burns a whole offer round. V8 sort is
    // stable, so distance order is preserved within the connected/disconnected groups.
    return docs
      .map((d) => ({
        id: String(d._id),
        name: d.name,
        phone: d.phone,
        vehicle: d.fulfillerProfile?.vehicleNumber,
        pushToken: d.fulfillerProfile?.expoPushToken,
        coordinates: d.fulfillerProfile?.currentLocation?.coordinates, // [lng, lat]
        connected: emit.isFulfillerConnected(String(d._id)),
        commissionWaived: promotions.isCommissionWaived(d), // founding-partner offer → keeps 100%
      }))
      .sort((a, b) => Number(b.connected) - Number(a.connected));
  } catch {
    return [];
  }
}

/* ------------------------------------------------------------------ */
/* Offering a round                                                   */
/* ------------------------------------------------------------------ */

function offerRound(state, batch) {
  return new Promise((resolve) => {
    state.resolveRound = resolve;
    state.pending = batch.length;
    // Never carry a prior round's timer into this one — a leaked timer firing
    // against the new round's pending count would corrupt it.
    for (const [, t] of state.offerTimers) clearTimeout(t);
    state.offerTimers.clear();
    const expiresAt = Date.now() + DISPATCH.OFFER_TIMEOUT_MS;

    for (const c of batch) {
      state.attempted.add(c.id);
      sendOffer(state, c, expiresAt);
      const timer = setTimeout(() => onOfferEnd(state, c.id, 'timeout'), DISPATCH.OFFER_TIMEOUT_MS);
      state.offerTimers.set(c.id, timer);
    }
  });
}

function sendOffer(state, candidate, expiresAt) {
  const { request } = state;
  const [dLng, dLat] = request.dropLocation.coordinates;
  let distanceKm = null;
  if (candidate.coordinates) {
    distanceKm = geo.haversineKm(
      { lat: candidate.coordinates[1], lng: candidate.coordinates[0] },
      { lat: dLat, lng: dLng }
    );
  }
  const payload = {
    requestId: state.requestId,
    size: request.capacityLitres,
    quantity: request.quantity,
    amount: request.pricing?.amount, // customer grand total (back-compat)
    // Founding-partner offer keeps 100% of the fare — show THIS driver's payout.
    payout: candidate.commissionWaived ? request.pricing?.fare : request.pricing?.partnerPayout,
    collect: request.paymentMode === 'cod' ? request.pricing?.amount : 0, // CASH to collect at the door (0 if paying by UPI)
    paymentMode: request.paymentMode,
    drop: {
      address: request.dropLocation.address,
      landmark: request.dropLocation.landmark,
      coordinates: request.dropLocation.coordinates,
    },
    distanceKm,
    etaMin: geo.roughEtaMin(distanceKm),
    expiresAt,
  };

  emit.toFulfiller(candidate.id, EVENTS.OFFER_NEW, payload);
  push.sendOffer(candidate.pushToken, payload); // wakes a backgrounded app
  recordOutcome(state.requestId, candidate.id, 'offered', state.round);
}

/** A single offer ended without winning (timeout or explicit reject). */
function onOfferEnd(state, fid, reason) {
  if (state.settled) return;
  const timer = state.offerTimers.get(fid);
  // The live timer is this fid's "offer still open" flag. If it's gone the offer
  // already ended (timeout, reject, or an accept-rollback) — bail so we never
  // decrement state.pending twice (which resolves the round early, skipping still-
  // live candidates) or double-log the offer outcome.
  if (!timer) return;
  clearTimeout(timer);
  state.offerTimers.delete(fid);

  if (reason === 'timeout') {
    emit.toFulfiller(fid, EVENTS.OFFER_CLOSED, {
      requestId: state.requestId,
      reason: OFFER_CLOSED_REASON.TIMEOUT,
    });
  }
  recordOutcome(state.requestId, fid, reason);

  state.pending -= 1;
  if (state.pending <= 0 && state.resolveRound) {
    const resolve = state.resolveRound;
    state.resolveRound = null;
    resolve('exhausted');
  }
}

/* ------------------------------------------------------------------ */
/* Fulfiller actions                                                  */
/* ------------------------------------------------------------------ */

function handleReject(fid, requestId) {
  const state = active.get(String(requestId));
  if (!state || state.settled) return;
  onOfferEnd(state, String(fid), 'rejected');
}

/** Atomic claim — guarantees exactly one winner even under simultaneous taps. */
async function handleAccept(fid, requestId) {
  fid = String(fid);
  requestId = String(requestId);

  const claimed = await DeliveryRequest.findOneAndUpdate(
    { _id: requestId, status: REQUEST_STATUS.SEARCHING },
    {
      status: REQUEST_STATUS.DRIVER_ASSIGNED,
      fulfillerId: fid,
      $push: { statusLog: { status: REQUEST_STATUS.DRIVER_ASSIGNED, changedAt: new Date(), changedBy: fid } },
    },
    { new: true }
  ).catch(() => null);

  if (!claimed) {
    // Someone else already won (or the request was cancelled).
    emit.toFulfiller(fid, EVENTS.OFFER_CLOSED, { requestId, reason: OFFER_CLOSED_REASON.TAKEN });
    return;
  }

  // Atomically claim the fulfiller too. In a broadcast round the same driver can
  // hold live offers for two concurrent requests (both findCandidates saw them
  // isAvailable:true); without this guard accepting both would double-assign one
  // driver. Conditioning on isAvailable:true lets exactly one accept win.
  const claimedDriver = await User.findOneAndUpdate(
    { _id: fid, 'fulfillerProfile.isAvailable': true },
    { 'fulfillerProfile.isAvailable': false, 'fulfillerProfile.currentRequestId': claimed._id },
    { new: true }
  ).catch(() => null);

  if (!claimedDriver) {
    // Driver already committed to another job in a concurrent accept — roll the
    // request claim back to searching so this offer keeps looking elsewhere.
    await DeliveryRequest.updateOne(
      { _id: requestId, status: REQUEST_STATUS.DRIVER_ASSIGNED, fulfillerId: fid },
      {
        status: REQUEST_STATUS.SEARCHING,
        $unset: { fulfillerId: '' },
        $push: { statusLog: { status: REQUEST_STATUS.SEARCHING, changedAt: new Date() } },
      }
    ).catch(() => {});
    emit.toFulfiller(fid, EVENTS.OFFER_CLOSED, { requestId, reason: OFFER_CLOSED_REASON.TAKEN });
    // Keep the request moving: treat as a reject from this fulfiller if the round is
    // still live, else re-dispatch the reverted request excluding them.
    const st = active.get(requestId);
    if (st && !st.settled) {
      onOfferEnd(st, fid, 'rejected');
    } else {
      const fresh = await DeliveryRequest.findById(requestId).catch(() => null);
      if (fresh && fresh.status === REQUEST_STATUS.SEARCHING) dispatch(fresh, { exclude: [fid] });
    }
    return;
  }

  registry.setActiveRequest(fid, claimed._id);

  const state = active.get(requestId);
  if (state) settleAccepted(state, fid);

  recordOutcome(requestId, fid, 'accepted');
  await finalizeAssignment(claimed, fid);
}

function settleAccepted(state, winnerFid) {
  state.settled = true;
  for (const [fid, timer] of state.offerTimers) clearTimeout(timer);
  state.offerTimers.clear();
  // Tell everyone else the job is taken.
  for (const fid of state.attempted) {
    if (fid !== winnerFid) {
      emit.toFulfiller(fid, EVENTS.OFFER_CLOSED, {
        requestId: state.requestId,
        reason: OFFER_CLOSED_REASON.TAKEN,
      });
    }
  }
  if (state.resolveRound) {
    const resolve = state.resolveRound;
    state.resolveRound = null;
    resolve('accepted');
  }
  active.delete(state.requestId);
}

/** Wire up rooms, ETA, and notifications once a fulfiller has the job. */
async function finalizeAssignment(request, fid) {
  const requestId = String(request._id);
  const [fulfiller, customer] = await Promise.all([
    User.findById(fid).lean(),
    User.findById(request.customerId).lean(),
  ]);

  // Founding-partner offer: the assigned driver may keep 100%. The request was quoted
  // with standard commission before a driver was known, so resolve against THIS driver
  // and persist the split — earnings/history + the job card then read the right payout.
  if (promotions.isCommissionWaived(fulfiller)) {
    const split = partnerSplit(request.pricing?.fare, true);
    await DeliveryRequest.updateOne(
      { _id: requestId },
      { 'pricing.partnerCommission': split.partnerCommission, 'pricing.partnerPayout': split.partnerPayout }
    ).catch(() => {});
    if (request.pricing) {
      request.pricing.partnerCommission = split.partnerCommission;
      request.pricing.partnerPayout = split.partnerPayout;
    }
  }

  // Both parties join the request room for live status + location.
  emit.joinRoom(rooms.fulfiller(fid), rooms.request(requestId));
  emit.joinRoom(rooms.user(String(request.customerId)), rooms.request(requestId));

  // Accurate ETA via Mapbox (only for the assigned fulfiller — saves API calls).
  const from = fulfiller?.fulfillerProfile?.currentLocation?.coordinates;
  const [dLng, dLat] = request.dropLocation.coordinates;
  let eta = { distanceKm: null, etaMin: null };
  if (from) {
    eta = await geo.getEta({ lat: from[1], lng: from[0] }, { lat: dLat, lng: dLng });
    await DeliveryRequest.updateOne(
      { _id: requestId },
      { 'pricing.distanceKm': eta.distanceKm, 'pricing.etaMin': eta.etaMin }
    ).catch(() => {});
  }

  const vehicle = fulfiller?.fulfillerProfile?.vehicleNumber;

  // Fulfiller: full job card.
  emit.toFulfiller(fid, EVENTS.JOB_ASSIGNED, {
    requestId,
    size: request.capacityLitres,
    quantity: request.quantity,
    amount: request.pricing?.amount, // customer grand total (back-compat)
    payout: request.pricing?.partnerPayout, // partner earnings (net of commission)
    collect: request.paymentMode === 'cod' ? request.pricing?.amount : 0, // CASH to collect at the door (0 if paying by UPI)
    paymentMode: request.paymentMode,
    drop: request.dropLocation,
    customer: { name: customer?.name, phone: request.dropLocation?.phone || customer?.phone },
  });

  // Customer: assigned + status.
  emit.toUser(String(request.customerId), EVENTS.REQUEST_ASSIGNED, {
    requestId,
    fulfiller: { name: fulfiller?.name, rating: fulfiller?.fulfillerProfile?.rating },
    vehicle,
    phone: fulfiller?.phone,
    etaMin: eta.etaMin,
    distanceKm: eta.distanceKm,
  });
  emit.toRequest(requestId, EVENTS.REQUEST_STATUS, { requestId, status: REQUEST_STATUS.DRIVER_ASSIGNED });

  // Durable / fallback channels.
  const custPhone = request.dropLocation?.phone || customer?.phone;
  if (custPhone) {
    whatsapp.sendFulfillerAssigned(custPhone, shortId(requestId), fulfiller?.name || 'Your fulfiller', eta.etaMin ?? '~');
  }
}

// Legal forward edges for a fulfiller-driven transition: each target may only be
// reached from its exact prior state. Anything else is rejected (out-of-order) or
// no-ops (already there) — see handleJobStatus.
const JOB_STATUS_PRIOR = {
  [REQUEST_STATUS.EN_ROUTE]: REQUEST_STATUS.DRIVER_ASSIGNED,
  [REQUEST_STATUS.ARRIVED]: REQUEST_STATUS.EN_ROUTE,
  [REQUEST_STATUS.COMPLETED]: REQUEST_STATUS.ARRIVED,
};

/**
 * Fulfiller advances the job: en_route → arrived → completed.
 *
 * Atomic + idempotent. The write only lands via a guarded findOneAndUpdate that
 * matches the EXACT expected prior status (same pattern as handleAccept), so:
 *   • a replayed/duplicated emit (offline journal, double-tap) re-runs no side
 *     effects and can't mark COD paid twice — the guard simply won't match.
 *   • an out-of-order jump (stale client, e.g. driver_assigned→completed) is
 *     rejected, never freeing the fulfiller or marking COD paid with no trip.
 * On a non-match it pushes the authoritative status back to the fulfiller so the
 * client self-heals (App.js REQUEST_STATUS listener), then reports the outcome.
 *
 * @returns {Promise<{ok:boolean, status:?string, applied:boolean}>}
 *   ok      — request is now (or already was) at the requested status
 *   status  — current authoritative status (null if request/ownership is gone)
 *   applied — THIS call performed the transition (side effects ran)
 */
async function handleJobStatus(fid, requestId, status) {
  fid = String(fid);
  requestId = String(requestId);
  const expected = JOB_STATUS_PRIOR[status];
  if (!expected) return { ok: false, status: null, applied: false };

  const update = {
    status,
    $push: { statusLog: { status, changedAt: new Date(), changedBy: fid } },
  };
  if (status === REQUEST_STATUS.COMPLETED) update.completedAt = new Date();

  const filter = { _id: requestId, fulfillerId: fid, status: expected };
  // A UPI delivery can only be completed once it's actually paid (collected at the
  // door). COD is collected as cash on completion, so it has no payment guard. This
  // is the data-layer safety net behind the driver-app button gate — a job can never
  // finish unpaid.
  if (status === REQUEST_STATUS.COMPLETED) {
    filter.$or = [{ paymentMode: 'cod' }, { paymentStatus: 'paid' }];
  }

  const claimed = await DeliveryRequest.findOneAndUpdate(filter, update, { new: true }).catch(() => null);

  if (!claimed) {
    // Out-of-order / not ours / idempotent replay — OR a UPI completion blocked
    // because payment hasn't been collected yet.
    const current = await DeliveryRequest.findOne({ _id: requestId, fulfillerId: fid })
      .select('status paymentMode paymentStatus')
      .lean()
      .catch(() => null);
    const curStatus = current?.status || null;
    // Push the authoritative status back so the client reconciles its stepper.
    if (curStatus) emit.toFulfiller(fid, EVENTS.REQUEST_STATUS, { requestId, status: curStatus });
    const paymentPending =
      status === REQUEST_STATUS.COMPLETED &&
      curStatus === REQUEST_STATUS.ARRIVED &&
      current?.paymentMode === 'upi' &&
      current?.paymentStatus !== 'paid';
    return {
      ok: curStatus === status,
      status: curStatus,
      applied: false,
      ...(paymentPending ? { reason: 'payment_pending' } : {}),
    };
  }

  emit.toRequest(requestId, EVENTS.REQUEST_STATUS, { requestId, status });

  const customer = await User.findById(claimed.customerId).lean();
  const custPhone = claimed.dropLocation?.phone || customer?.phone;

  if (status === REQUEST_STATUS.ARRIVED && custPhone) {
    whatsapp.sendFulfillerArriving(custPhone, shortId(requestId));
  }

  if (status === REQUEST_STATUS.COMPLETED) {
    await freeFulfiller(fid);
    // CASH is now in hand → mark paid (guarded, idempotent, never clobbers a refund).
    // UPI is settled separately by the at-the-door payment flow (markRequestPaid).
    if (claimed.paymentMode === 'cod') {
      await DeliveryRequest.updateOne({ _id: requestId, paymentStatus: 'unpaid' }, { paymentStatus: 'paid' }).catch(() => {});
    }
    emit.toUser(String(claimed.customerId), EVENTS.REQUEST_COMPLETED, { requestId });
    if (custPhone) whatsapp.sendDeliveryCompleted(custPhone, shortId(requestId));
  }

  return { ok: true, status, applied: true };
}

/**
 * Driver reports the customer as unreachable at the drop. This is DISTINCT from
 * "abandon" (breakdown → re-dispatch): a no-show is TERMINAL — the next tanker
 * would just hit the same silent customer. Gated to prevent abuse:
 *   • must be ARRIVED, and have waited NO_SHOW_WAIT_MS since arriving
 *   • driver's live GPS must be within NO_SHOW_RADIUS_KM of the drop (if known)
 * Money: a prepaid customer is refunded their fare MINUS the dry-run fee; that
 * fee is the driver's earning for the wasted trip. COD/unpaid → nothing to
 * refund, driver still credited the fee. The customer gets a no-show strike.
 *
 * @returns {Promise<{ok:boolean, error?:string, status?:string, dryRunFee?:number, customerRefund?:number}>}
 */
async function handleCustomerNoShow(fid, requestId, opts = {}) {
  fid = String(fid);
  requestId = String(requestId);
  const reason = String(opts.reason || '').trim() || 'no_answer';

  const request = await DeliveryRequest.findOne({ _id: requestId, fulfillerId: fid }).catch(() => null);
  if (!request) return { ok: false, error: 'This job is no longer assigned to you.' };
  if (request.status !== REQUEST_STATUS.ARRIVED) {
    return { ok: false, error: 'You can report a no-show only after marking “I’ve arrived”.' };
  }

  // Wait gate — must have been ARRIVED for the grace window.
  const arrivedEntry = [...(request.statusLog || [])].reverse().find((e) => e.status === REQUEST_STATUS.ARRIVED);
  const arrivedAt = arrivedEntry?.changedAt ? new Date(arrivedEntry.changedAt).getTime() : null;
  if (arrivedAt) {
    const waited = Date.now() - arrivedAt;
    if (waited < DISPATCH.NO_SHOW_WAIT_MS) {
      const mins = Math.ceil((DISPATCH.NO_SHOW_WAIT_MS - waited) / 60000);
      return { ok: false, error: `Please wait at the location — you can report a no-show in about ${mins} more minute${mins === 1 ? '' : 's'}.` };
    }
  }

  // Proximity gate — the driver's live location must be at the drop (when we have it).
  const loc = registry.getLocation(fid);
  const [dLng, dLat] = request.dropLocation?.coordinates || [];
  if (loc && typeof dLat === 'number') {
    const dist = geo.haversineKm({ lat: loc.lat, lng: loc.lng }, { lat: dLat, lng: dLng });
    if (dist != null && dist > DISPATCH.NO_SHOW_RADIUS_KM) {
      return { ok: false, error: 'You need to be at the drop-off location to report a no-show.' };
    }
  }

  // Atomic, terminal transition ARRIVED → CUSTOMER_NO_SHOW (loses any race with the sweep/cancel).
  const updated = await DeliveryRequest.findOneAndUpdate(
    { _id: requestId, fulfillerId: fid, status: REQUEST_STATUS.ARRIVED },
    {
      status: REQUEST_STATUS.CUSTOMER_NO_SHOW,
      completedAt: new Date(),
      'pricing.dryRunFee': DRY_RUN_FEE,
      noShowReport: {
        reason,
        at: new Date(),
        callAttempted: !!opts.callAttempted,
        coordinates: loc ? [loc.lng, loc.lat] : undefined,
      },
      $push: { statusLog: { status: REQUEST_STATUS.CUSTOMER_NO_SHOW, changedAt: new Date(), changedBy: fid } },
    },
    { new: true }
  ).catch(() => null);
  if (!updated) return { ok: false, error: 'This job already changed — please refresh.' };

  // Prepaid customer: refund the fare minus the dry-run fee (the fee is the driver's).
  // COD/unpaid: onlinePaidInr is 0 → no refund; the driver is still credited the fee.
  const paid = onlinePaidInr(updated);
  let customerRefund = 0;
  if (paid > 0) {
    customerRefund = Math.max(0, paid - DRY_RUN_FEE);
    await refundOnline(updated, customerRefund);
  }

  await freeFulfiller(fid);
  emit.leaveRoom(rooms.fulfiller(fid), rooms.request(requestId));
  await promotions.restoreFreeBooking(updated, 'request'); // no delivery happened → give the freebie back
  // Count it for analytics AND feed the booking-block accountability — a no-show is
  // at least as serious as a late cancel, so it earns a strike toward a restriction.
  await User.updateOne({ _id: updated.customerId }, { $inc: { customerNoShowCount: 1 } }).catch(() => {});
  await addCancelStrike(updated.customerId);

  // Notify the customer (live track page reconciles; WhatsApp is a durable nudge).
  emit.toUser(String(updated.customerId), EVENTS.REQUEST_STATUS, { requestId, status: REQUEST_STATUS.CUSTOMER_NO_SHOW });
  emit.toRequest(requestId, EVENTS.REQUEST_STATUS, { requestId, status: REQUEST_STATUS.CUSTOMER_NO_SHOW });

  return { ok: true, status: REQUEST_STATUS.CUSTOMER_NO_SHOW, dryRunFee: DRY_RUN_FEE, customerRefund };
}

/* ------------------------------------------------------------------ */
/* Disconnect & abandonment (B5)                                      */
/* ------------------------------------------------------------------ */

function clearDisconnectTimer(fid) {
  const t = disconnectTimers.get(String(fid));
  if (t) {
    clearTimeout(t);
    disconnectTimers.delete(String(fid));
  }
}

/** A fulfiller's socket dropped. */
function handleFulfillerDisconnect(fid) {
  fid = String(fid);
  clearDisconnectTimer(fid);
  const activeReq = registry.getActiveRequest(fid);

  if (activeReq) {
    // Mid-delivery: pause the customer's live tracking, give them time to return,
    // then auto-abandon + re-dispatch if they stay dark.
    emit.toRequest(activeReq, EVENTS.REQUEST_TRACKING, { requestId: activeReq, live: false });
    disconnectTimers.set(
      fid,
      setTimeout(() => autoAbandon(fid, activeReq), DISPATCH.DISCONNECT_ABANDON_MS)
    );
  } else {
    // Idle: after a short grace (network blips), mark offline so we stop offering
    // to a dead app. Reconnecting cancels this first.
    disconnectTimers.set(
      fid,
      setTimeout(async () => {
        disconnectTimers.delete(fid);
        if (!emit.isFulfillerConnected(fid) && !registry.getActiveRequest(fid)) {
          await User.updateOne({ _id: fid }, { $set: { 'fulfillerProfile.isOnline': false } }).catch(() => {});
        }
      }, DISPATCH.DISCONNECT_OFFLINE_MS)
    );
  }
}

/** A fulfiller's socket (re)connected — cancel any pending grace/abandon timer. */
function handleFulfillerReconnect(fid) {
  fid = String(fid);
  clearDisconnectTimer(fid);
  const activeReq = registry.getActiveRequest(fid);
  if (activeReq) emit.toRequest(activeReq, EVENTS.REQUEST_TRACKING, { requestId: activeReq, live: true });
}

function autoAbandon(fid, requestId) {
  clearDisconnectTimer(fid);
  abandonAndRedispatch(String(fid), String(requestId), 'unreachable');
}

/** Fulfiller explicitly bails on an active job (e.g. breakdown). */
function handleJobAbandon(fid, requestId) {
  abandonAndRedispatch(String(fid), String(requestId), 'abandoned');
}

/** Release the fulfiller, return the request to searching, and re-dispatch. */
async function abandonAndRedispatch(fid, requestId, reason) {
  const request = await DeliveryRequest.findOneAndUpdate(
    {
      _id: requestId,
      fulfillerId: fid,
      status: { $in: [REQUEST_STATUS.DRIVER_ASSIGNED, REQUEST_STATUS.EN_ROUTE, REQUEST_STATUS.ARRIVED] },
    },
    {
      status: REQUEST_STATUS.SEARCHING,
      $unset: { fulfillerId: '' },
      $push: { statusLog: { status: REQUEST_STATUS.SEARCHING, changedAt: new Date() } },
    },
    { new: true }
  ).catch(() => null);
  if (!request) return; // already completed/cancelled/reassigned — nothing to do

  await freeFulfiller(fid);
  emit.leaveRoom(rooms.fulfiller(fid), rooms.request(requestId)); // stop leaking the old job to them
  emit.toFulfiller(fid, EVENTS.JOB_CANCELLED, { requestId, reason });

  // Customer: back to searching (the track page re-shows the searching UI).
  emit.toRequest(requestId, EVENTS.REQUEST_STATUS, { requestId, status: REQUEST_STATUS.SEARCHING });
  emit.toUser(String(request.customerId), EVENTS.REQUEST_STATUS, { requestId, status: REQUEST_STATUS.SEARCHING });

  // Re-dispatch, excluding the fulfiller who bailed.
  dispatch(request, { exclude: [fid] });
}

/* ------------------------------------------------------------------ */
/* Cancellation                                                       */
/* ------------------------------------------------------------------ */

async function handleCustomerCancel(customerId, requestId) {
  const request = await DeliveryRequest.findOne({ _id: requestId, customerId });
  if (!request) return;

  const state = active.get(String(requestId));

  // Unpaid UPI request abandoned before payment — just void it (nothing to refund).
  if (request.status === REQUEST_STATUS.PENDING_PAYMENT) {
    await DeliveryRequest.updateOne(
      { _id: requestId, status: REQUEST_STATUS.PENDING_PAYMENT },
      {
        status: REQUEST_STATUS.EXPIRED,
        $push: { statusLog: { status: REQUEST_STATUS.EXPIRED, changedAt: new Date(), changedBy: customerId } },
      }
    ).catch(() => {});
    emit.toRequest(String(requestId), EVENTS.REQUEST_STATUS, {
      requestId: String(requestId),
      status: REQUEST_STATUS.EXPIRED,
    });
    await promotions.restoreFreeBooking(request, 'request');
    return;
  }

  if (request.status === REQUEST_STATUS.SEARCHING) {
    if (state) cleanup(state, REQUEST_STATUS.EXPIRED);
    // Guard on SEARCHING so a request that raced into assignment isn't expired (and
    // refunded in full) out from under the driver. Only refund if WE won the claim.
    const expired = await DeliveryRequest.findOneAndUpdate(
      { _id: requestId, status: REQUEST_STATUS.SEARCHING },
      {
        status: REQUEST_STATUS.EXPIRED,
        $push: { statusLog: { status: REQUEST_STATUS.EXPIRED, changedAt: new Date(), changedBy: customerId } },
      },
      { new: true }
    ).catch(() => null);
    if (!expired) return; // raced into assignment — leave it
    await maybeRefund(expired); // no driver had committed → full refund
    await promotions.restoreFreeBooking(expired, 'request'); // never delivered → give the freebie back
    emit.toRequest(String(requestId), EVENTS.REQUEST_STATUS, { requestId: String(requestId), status: REQUEST_STATUS.EXPIRED });
    return;
  }

  if ([REQUEST_STATUS.DRIVER_ASSIGNED, REQUEST_STATUS.EN_ROUTE].includes(request.status)) {
    // Atomically claim the cancellation on the EXACT prior stage. If the driver
    // concurrently advanced (or it was reassigned/completed), bail — no cancel, no
    // refund — and crucially the refund fraction is keyed on the claimed stage, not
    // a stale in-memory read.
    const stage = request.status;
    const cancelled = await DeliveryRequest.findOneAndUpdate(
      { _id: requestId, status: stage },
      {
        status: REQUEST_STATUS.CANCELLED,
        $push: { statusLog: { status: REQUEST_STATUS.CANCELLED, changedAt: new Date(), changedBy: customerId } },
      },
      { new: true }
    ).catch(() => null);
    if (!cancelled) return;
    if (cancelled.fulfillerId) {
      await freeFulfiller(cancelled.fulfillerId);
      emit.toFulfiller(String(cancelled.fulfillerId), EVENTS.JOB_CANCELLED, { requestId: String(requestId) });
    }
    // Nothing was charged upfront, so there's normally nothing to refund (maybeRefund
    // no-ops unless a UPI-at-door payment had already landed). Cancelling after a
    // driver committed is the abuse signal → strike the customer.
    await maybeRefund(cancelled);
    await promotions.restoreFreeBooking(cancelled, 'request'); // never delivered → give the freebie back
    await addCancelStrike(customerId);
    emit.toRequest(String(requestId), EVENTS.REQUEST_STATUS, { requestId: String(requestId), status: REQUEST_STATUS.CANCELLED });
    return;
  }

  // completed/expired/cancelled/no_fulfiller — nothing to do.
}

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

async function giveUp(state) {
  cleanup(state);
  const updated = await DeliveryRequest.findOneAndUpdate(
    { _id: state.requestId, status: REQUEST_STATUS.SEARCHING },
    {
      status: REQUEST_STATUS.NO_FULFILLER,
      $push: { statusLog: { status: REQUEST_STATUS.NO_FULFILLER, changedAt: new Date() } },
    },
    { new: true }
  ).catch(() => null);
  if (updated) {
    await maybeRefund(updated); // prepaid UPI but nobody took it → refund
    await promotions.restoreFreeBooking(updated, 'request'); // never delivered → give the freebie back
    emit.toUser(String(updated.customerId), EVENTS.REQUEST_STATUS, {
      requestId: state.requestId,
      status: REQUEST_STATUS.NO_FULFILLER,
    });
  }
}

/** What the customer actually paid us ONLINE for this request (₹). */
function onlinePaidInr(request) {
  if (!request) return 0;
  if (request.paymentStatus === 'paid') return request.pricing?.amount || 0; // UPI paid at the door
  return 0;
}

/** Refund a rupee amount against the online payment + mark it. No-op if nothing was paid. */
async function refundOnline(request, amountInr) {
  const amt = Math.round(Number(amountInr) || 0);
  if (!request?.razorpayPaymentId || amt <= 0) return;
  // Atomically CLAIM the refund before hitting the gateway: only the caller that
  // flips an online-paid state to 'refunded' proceeds, so concurrent cancel / give-up
  // / sweep paths can never double-refund the same payment.
  const claimed = await DeliveryRequest.findOneAndUpdate(
    { _id: request._id, paymentStatus: 'paid' },
    { paymentStatus: 'refunded', refundedAmount: amt },
    { new: true }
  ).catch(() => null);
  if (!claimed) return; // already refunded (or nothing online to refund)
  const ok = await payments.refund(request.razorpayPaymentId, amt);
  if (!ok) {
    // Gateway failed — release the claim so a later attempt can retry the refund.
    await DeliveryRequest.updateOne(
      { _id: request._id },
      { paymentStatus: request.paymentStatus, refundedAmount: 0 }
    ).catch(() => {});
  }
}

/** Full refund — used when KitUm fails to fulfil (no_fulfiller, expiry). */
async function maybeRefund(request) {
  await refundOnline(request, onlinePaidInr(request));
}

/**
 * Strike a customer for cancelling after a driver committed. Past the threshold,
 * block new bookings for a cooldown window (and reset the counter to start fresh).
 */
async function addCancelStrike(customerId) {
  const u = await User.findByIdAndUpdate(
    customerId,
    { $inc: { cancelStrikes: 1 } },
    { new: true }
  ).catch(() => null);
  if (u && u.cancelStrikes >= STRIKE_BLOCK_THRESHOLD) {
    await User.updateOne(
      { _id: customerId },
      { bookingBlockedUntil: new Date(Date.now() + STRIKE_BLOCK_MS), cancelStrikes: 0 }
    ).catch(() => {});
  }
}

function cleanup(state, _reason) {
  state.settled = true;
  for (const [, timer] of state.offerTimers) clearTimeout(timer);
  state.offerTimers.clear();
  if (state.resolveRound) {
    const resolve = state.resolveRound;
    state.resolveRound = null;
    resolve('cancelled');
  }
  active.delete(state.requestId);
}

async function freeFulfiller(fid) {
  await User.updateOne(
    { _id: fid },
    { 'fulfillerProfile.isAvailable': true, $unset: { 'fulfillerProfile.currentRequestId': '' } }
  ).catch(() => {});
  registry.clearActiveRequest(fid);
}

function recordOutcome(requestId, fid, outcome, round) {
  DeliveryRequest.updateOne(
    { _id: requestId },
    { $push: { offers: { fulfillerId: fid, round, outcome, sentAt: new Date() } } }
  ).catch(() => {});
}

/** Re-queue any requests left mid-search by a restart, and start the backstop sweep. */
async function recover() {
  try {
    const stuck = await DeliveryRequest.find({ status: REQUEST_STATUS.SEARCHING });
    for (const req of stuck) dispatch(req);
    if (stuck.length) console.log(`Dispatch recovery: re-queued ${stuck.length} request(s)`);
  } catch (err) {
    console.error('Dispatch recovery failed', err);
  }
  startSweeper();
}

/* ------------------------------------------------------------------ */
/* Backstop sweep (B5) — independent of the in-memory offer timers     */
/* ------------------------------------------------------------------ */

let sweepTimer = null;
function startSweeper() {
  if (sweepTimer) return;
  sweepTimer = setInterval(sweep, DISPATCH.SWEEP_INTERVAL_MS);
  if (sweepTimer.unref) sweepTimer.unref();
}

async function sweep() {
  const now = Date.now();
  try {
    // Searching beyond the TTL with no live dispatch (e.g. lost to a crash) → finalize.
    const cutoff = new Date(now - DISPATCH.SEARCHING_TTL_MS);
    const stuck = await DeliveryRequest.find({ status: REQUEST_STATUS.SEARCHING, updatedAt: { $lt: cutoff } });
    for (const r of stuck) {
      if (active.has(String(r._id))) continue; // genuinely dispatching — leave it
      const updated = await DeliveryRequest.findOneAndUpdate(
        { _id: r._id, status: REQUEST_STATUS.SEARCHING },
        {
          status: REQUEST_STATUS.NO_FULFILLER,
          $push: { statusLog: { status: REQUEST_STATUS.NO_FULFILLER, changedAt: new Date() } },
        },
        { new: true }
      ).catch(() => null);
      if (updated) {
        await maybeRefund(updated);
        await promotions.restoreFreeBooking(updated, 'request'); // never delivered → give the freebie back
        emit.toUser(String(updated.customerId), EVENTS.REQUEST_STATUS, {
          requestId: String(updated._id),
          status: REQUEST_STATUS.NO_FULFILLER,
        });
      }
    }

    // No-show: accepted (driver_assigned) but never started past the TTL. The job
    // doc isn't touched while assigned (location persists to the User, not here),
    // so updatedAt is a reliable "time since assignment". Reclaim + re-dispatch,
    // excluding the no-show driver, and tally it against them.
    const assignedCutoff = new Date(now - DISPATCH.ASSIGNED_START_TTL_MS);
    const stranded = await DeliveryRequest.find({
      status: REQUEST_STATUS.DRIVER_ASSIGNED,
      updatedAt: { $lt: assignedCutoff },
    }).select('_id fulfillerId');
    for (const r of stranded) {
      if (!r.fulfillerId) continue;
      const sfid = String(r.fulfillerId);
      await abandonAndRedispatch(sfid, String(r._id), 'no_show');
      await User.updateOne({ _id: sfid }, { $inc: { 'fulfillerProfile.noShowCount': 1 } }).catch(() => {});
    }

    // Abandoned UPI checkouts → expire.
    const payCutoff = new Date(now - DISPATCH.PENDING_PAYMENT_TTL_MS);
    await DeliveryRequest.updateMany(
      { status: REQUEST_STATUS.PENDING_PAYMENT, createdAt: { $lt: payCutoff } },
      { status: REQUEST_STATUS.EXPIRED, $push: { statusLog: { status: REQUEST_STATUS.EXPIRED, changedAt: new Date() } } }
    );
  } catch {
    // best-effort
  }
}

module.exports = {
  dispatch,
  handleAccept,
  handleReject,
  handleJobStatus,
  handleCustomerNoShow,
  handleCustomerCancel,
  handleFulfillerDisconnect,
  handleFulfillerReconnect,
  handleJobAbandon,
  recover,
};
