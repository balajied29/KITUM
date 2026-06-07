/**
 * Launch-offer promotions — config-driven campaigns for the acquisition phase.
 * See docs/launch-offers-design.md.
 *
 *   Driver  : first N APPROVED partners → 0% commission for `durationDays` from approval.
 *   Customer: first N customers → first `freeBookings` bookings with the platform fee waived.
 *
 * Server-authoritative: the apps only render what these helpers + pricing.quote()
 * produce. Slot caps are enforced with an atomic $inc guarded by claimed<cap, and a
 * unique {campaignKey,user} grant guarantees idempotent (no double) enrollment.
 */
const Campaign = require('../models/Campaign.model');
const PromoGrant = require('../models/PromoGrant.model');
const User = require('../models/User.model');
const DeliveryRequest = require('../models/DeliveryRequest.model');
const Order = require('../models/Order.model');

const DRIVER_KEY = 'launch_driver_zero_commission';
const CUSTOMER_KEY = 'launch_customer_no_fee';
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Idempotently create the two launch campaigns. $setOnInsert ⇒ a restart never
 * clobbers admin-tuned caps/windows/active. Defaults: 15 drivers / 90 days,
 * 100 customers / 3 free bookings. Tune live from the admin panel.
 */
async function seedCampaigns() {
  try {
    await Campaign.updateOne(
      { key: DRIVER_KEY },
      {
        $setOnInsert: {
          key: DRIVER_KEY,
          audience: 'driver',
          benefit: { type: 'commission_waiver', durationDays: 90 },
          cap: 15,
          claimed: 0,
          active: true,
          enrollWindow: { start: null, end: null },
          description: 'Founding partners — 0% commission for 3 months from approval.',
        },
      },
      { upsert: true }
    );
    await Campaign.updateOne(
      { key: CUSTOMER_KEY },
      {
        $setOnInsert: {
          key: CUSTOMER_KEY,
          audience: 'customer',
          benefit: { type: 'platform_fee_waiver', freeBookings: 3, useByDays: null },
          cap: 100,
          claimed: 0,
          active: true,
          enrollWindow: { start: null, end: null },
          description: 'Launch customers — first 3 bookings with no platform fee.',
        },
      },
      { upsert: true }
    );
  } catch (e) {
    console.error('seedCampaigns failed', e);
  }
}

/** Active + inside the (optional) enrollment window. */
function windowFilter(now) {
  return {
    active: true,
    $and: [
      { $or: [{ 'enrollWindow.start': null }, { 'enrollWindow.start': { $lte: now } }] },
      { $or: [{ 'enrollWindow.end': null }, { 'enrollWindow.end': { $gte: now } }] },
    ],
  };
}

/**
 * Atomically claim a campaign slot. Returns the created PromoGrant, or null
 * (cap full / inactive / window closed / already enrolled). Race- & replay-safe:
 *   • $inc guarded by claimed<cap (or unlimited cap) ⇒ never over-claims.
 *   • unique {campaignKey,user} ⇒ at most one grant per user; a duplicate claim
 *     rolls the counter back so `claimed` stays exact.
 */
async function claimSlot(campaignKey, userId, makeGrant) {
  const now = new Date();
  // Fast path — already enrolled.
  const existing = await PromoGrant.findOne({ campaignKey, user: userId }).catch(() => null);
  if (existing) return null;

  const camp = await Campaign.findOneAndUpdate(
    {
      key: campaignKey,
      ...windowFilter(now),
      $or: [{ cap: null }, { $expr: { $lt: ['$claimed', '$cap'] } }],
    },
    { $inc: { claimed: 1 } },
    { new: true }
  ).catch(() => null);
  if (!camp) return null; // cap full / inactive / window closed

  try {
    return await PromoGrant.create(makeGrant(camp));
  } catch (e) {
    // Duplicate (concurrent claim for the same user) or write error — give the slot back.
    await Campaign.updateOne({ key: campaignKey }, { $inc: { claimed: -1 } }).catch(() => {});
    return null;
  }
}

/** Enroll a newly-APPROVED driver into the 0%-commission offer (idempotent). */
async function grantDriverWaiver(userId, approvedAt = new Date()) {
  let grant = await claimSlot(DRIVER_KEY, userId, (camp) => {
    const days = camp.benefit?.durationDays || 90;
    return {
      campaignKey: DRIVER_KEY,
      audience: 'driver',
      user: userId,
      enrollmentNumber: camp.claimed,
      benefit: camp.benefit,
      startsAt: approvedAt,
      endsAt: new Date(approvedAt.getTime() + days * DAY_MS),
      status: 'active',
    };
  });
  // claimSlot returns null when ALREADY enrolled (idempotent re-approval) OR cap/window
  // blocked. Fetch the existing grant so a previously-failed denormalized write self-heals
  // on this pass; if there's genuinely no grant, there's nothing to sync.
  if (!grant) {
    grant = await PromoGrant.findOne({ campaignKey: DRIVER_KEY, user: userId }).catch(() => null);
    if (!grant) return null;
  }
  // Idempotent mirror onto the fast-path field pricing reads (a date — never drifts).
  await User.updateOne(
    { _id: userId },
    {
      'fulfillerProfile.commissionWaiverUntil': grant.endsAt,
      'fulfillerProfile.commissionWaiverNo': grant.enrollmentNumber,
    }
  ).catch(() => {});
  return grant;
}

/** Enroll a new customer into the first-K-bookings-free offer (idempotent). */
async function grantCustomerPerk(userId, signupAt = new Date()) {
  const grant = await claimSlot(CUSTOMER_KEY, userId, (camp) => {
    const K = camp.benefit?.freeBookings || 0;
    const useByDays = camp.benefit?.useByDays || null;
    return {
      campaignKey: CUSTOMER_KEY,
      audience: 'customer',
      user: userId,
      enrollmentNumber: camp.claimed,
      benefit: camp.benefit,
      startsAt: signupAt,
      endsAt: useByDays ? new Date(signupAt.getTime() + useByDays * DAY_MS) : null,
      status: 'active',
      freeBookingsTotal: K,
      freeBookingsRemaining: K,
    };
  });
  if (!grant) return null;
  await User.updateOne(
    { _id: userId },
    {
      'customerPerks.freeBookingsRemaining': grant.freeBookingsRemaining,
      'customerPerks.freeBookingsUntil': grant.endsAt,
      'customerPerks.enrollmentNo': grant.enrollmentNumber,
    }
  ).catch(() => {});
  return grant;
}

/** Is this fulfiller's commission currently waived? (founding-partner offer) */
function isCommissionWaived(fulfiller) {
  const until = fulfiller?.fulfillerProfile?.commissionWaiverUntil;
  return !!(until && new Date(until) > new Date());
}

/**
 * Atomically RESERVE one free booking for a customer at booking time. Returns true
 * iff the platform fee should be waived for this booking. The decrement IS the
 * "spend"; restoreFreeBooking() gives it back if the booking never completes.
 */
async function reserveFreeBooking(userId) {
  const now = new Date();
  const updated = await User.findOneAndUpdate(
    {
      _id: userId,
      'customerPerks.freeBookingsRemaining': { $gt: 0 },
      $or: [
        { 'customerPerks.freeBookingsUntil': null },
        { 'customerPerks.freeBookingsUntil': { $gte: now } },
      ],
    },
    { $inc: { 'customerPerks.freeBookingsRemaining': -1 } },
    { new: true }
  ).catch(() => null);

  if (!updated) {
    // Self-heal: the grant ledger (source of truth) may hold free bookings the
    // denormalized User counter never received (e.g. the best-effort sync at grant time
    // failed). Spend from the grant atomically, then re-sync User so the hot path works.
    const grant = await PromoGrant.findOneAndUpdate(
      {
        campaignKey: CUSTOMER_KEY, user: userId, status: 'active',
        freeBookingsRemaining: { $gt: 0 },
        $or: [{ endsAt: null }, { endsAt: { $gte: now } }],
      },
      { $inc: { freeBookingsRemaining: -1 } },
      { new: true }
    ).catch(() => null);
    if (!grant) return false;
    await User.updateOne(
      { _id: userId },
      {
        'customerPerks.freeBookingsRemaining': grant.freeBookingsRemaining,
        'customerPerks.freeBookingsUntil': grant.endsAt,
        'customerPerks.enrollmentNo': grant.enrollmentNumber,
      }
    ).catch(() => {});
    return true;
  }

  // Mirror the spend to the grant ledger (best-effort audit).
  await PromoGrant.updateOne(
    { campaignKey: CUSTOMER_KEY, user: userId, freeBookingsRemaining: { $gt: 0 } },
    { $inc: { freeBookingsRemaining: -1 } }
  ).catch(() => {});
  return true;
}

/**
 * Give a reserved free booking back when a booking ends WITHOUT completing.
 * Idempotent: flips a one-way `feeWaiverRestored` flag on the booking under an
 * atomic guard, so concurrent terminal paths (cancel/sweep/no-show) restore once.
 */
async function restoreFreeBooking(doc, kind) {
  if (!doc?._id) return;
  if (kind === 'request') {
    if (!doc.pricing?.feeWaived) return;
    const claimed = await DeliveryRequest.findOneAndUpdate(
      { _id: doc._id, 'pricing.feeWaived': true, 'pricing.feeWaiverRestored': { $ne: true } },
      { 'pricing.feeWaiverRestored': true },
      { new: true }
    ).catch(() => null);
    if (claimed) await creditFreeBooking(claimed.customerId);
  } else if (kind === 'order') {
    if (!doc.feeWaived) return;
    const claimed = await Order.findOneAndUpdate(
      { _id: doc._id, feeWaived: true, feeWaiverRestored: { $ne: true } },
      { feeWaiverRestored: true },
      { new: true }
    ).catch(() => null);
    if (claimed) await creditFreeBooking(claimed.userId);
  }
}

/** Credit one free booking back to a customer (restore + create-failure rollback). */
async function creditFreeBooking(userId) {
  if (!userId) return;
  await User.updateOne(
    { _id: userId },
    { $inc: { 'customerPerks.freeBookingsRemaining': 1 } }
  ).catch(() => {});
  await PromoGrant.updateOne(
    { campaignKey: CUSTOMER_KEY, user: userId },
    { $inc: { freeBookingsRemaining: 1 } }
  ).catch(() => {});
}

module.exports = {
  DRIVER_KEY,
  CUSTOMER_KEY,
  seedCampaigns,
  grantDriverWaiver,
  grantCustomerPerk,
  isCommissionWaived,
  reserveFreeBooking,
  restoreFreeBooking,
  creditFreeBooking,
};
