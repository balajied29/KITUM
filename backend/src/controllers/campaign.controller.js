/**
 * Admin management of launch-offer campaigns (see docs/launch-offers-design.md).
 * Lets ops tune caps/windows/benefit numbers, watch the live counters, list
 * enrollees, and manually grant/revoke — all without a redeploy.
 */
const Campaign = require('../models/Campaign.model');
const PromoGrant = require('../models/PromoGrant.model');
const User = require('../models/User.model');
const promotions = require('../services/promotions');

const numOrNull = (v) => (v === null || v === '' ? null : Math.max(0, Number(v)));

/** GET /admin/campaigns — all campaigns with their live counters. */
const listCampaigns = async (req, res) => {
  try {
    const campaigns = await Campaign.find().sort({ audience: 1, key: 1 }).lean();
    res.json({ success: true, data: campaigns });
  } catch (e) {
    res.status(500).json({ success: false, error: 'Failed to load campaigns' });
  }
};

/** PATCH /admin/campaigns/:key — tune cap / active / window / benefit numbers. */
const updateCampaign = async (req, res) => {
  try {
    const b = req.body || {};
    const set = {};
    if (b.cap !== undefined) set.cap = numOrNull(b.cap);
    if (b.active !== undefined) set.active = !!b.active;
    if (b.description !== undefined) set.description = String(b.description);
    if (b.enrollWindow !== undefined) {
      set['enrollWindow.start'] = b.enrollWindow?.start ? new Date(b.enrollWindow.start) : null;
      set['enrollWindow.end'] = b.enrollWindow?.end ? new Date(b.enrollWindow.end) : null;
    }
    if (b.durationDays !== undefined) set['benefit.durationDays'] = numOrNull(b.durationDays);
    if (b.freeBookings !== undefined) set['benefit.freeBookings'] = numOrNull(b.freeBookings);
    if (b.useByDays !== undefined) set['benefit.useByDays'] = numOrNull(b.useByDays);
    if (Object.keys(set).length === 0) {
      return res.status(400).json({ success: false, error: 'Nothing to update' });
    }
    const camp = await Campaign.findOneAndUpdate({ key: req.params.key }, { $set: set }, { new: true });
    if (!camp) return res.status(404).json({ success: false, error: 'Campaign not found' });
    res.json({ success: true, data: camp });
  } catch (e) {
    res.status(500).json({ success: false, error: 'Failed to update campaign' });
  }
};

/** GET /admin/campaigns/:key/grants — the enrollee list (audit). */
const listGrants = async (req, res) => {
  try {
    const grants = await PromoGrant.find({ campaignKey: req.params.key })
      .populate('user', 'name email phone role')
      .sort({ enrollmentNumber: 1 })
      .limit(500)
      .lean();
    res.json({ success: true, data: grants });
  } catch (e) {
    res.status(500).json({ success: false, error: 'Failed to load enrollees' });
  }
};

/** POST /admin/campaigns/:key/grant { userId | email } — manual enroll (respects cap). */
const grantToUser = async (req, res) => {
  try {
    const camp = await Campaign.findOne({ key: req.params.key });
    if (!camp) return res.status(404).json({ success: false, error: 'Campaign not found' });
    let userId = req.body.userId;
    if (!userId && req.body.email) {
      const u = await User.findOne({ email: String(req.body.email).toLowerCase().trim() }).select('_id');
      if (!u) return res.status(404).json({ success: false, error: 'No user with that email' });
      userId = u._id;
    }
    if (!userId) return res.status(400).json({ success: false, error: 'userId or email is required' });
    const grant =
      camp.audience === 'driver'
        ? await promotions.grantDriverWaiver(userId, new Date())
        : await promotions.grantCustomerPerk(userId, new Date());
    if (!grant) {
      return res.status(409).json({ success: false, error: 'Could not enroll (already enrolled, cap reached, or window closed).' });
    }
    res.json({ success: true, data: grant });
  } catch (e) {
    res.status(500).json({ success: false, error: 'Failed to grant' });
  }
};

/** POST /admin/campaigns/:key/revoke { userId } — revoke, free the slot, clear the perk. */
const revokeGrant = async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ success: false, error: 'userId is required' });
    const grant = await PromoGrant.findOneAndUpdate(
      { campaignKey: req.params.key, user: userId, status: { $ne: 'revoked' } },
      { status: 'revoked' },
      { new: true }
    );
    if (!grant) return res.status(404).json({ success: false, error: 'Active grant not found' });
    // Reopen the slot for someone else.
    await Campaign.updateOne(
      { key: req.params.key, claimed: { $gt: 0 } },
      { $inc: { claimed: -1 } }
    ).catch(() => {});
    // Clear the denormalized perk so pricing stops applying it immediately.
    if (grant.audience === 'driver') {
      await User.updateOne(
        { _id: userId },
        { 'fulfillerProfile.commissionWaiverUntil': null, 'fulfillerProfile.commissionWaiverNo': null }
      ).catch(() => {});
    } else {
      await User.updateOne({ _id: userId }, { 'customerPerks.freeBookingsRemaining': 0 }).catch(() => {});
    }
    res.json({ success: true, data: grant });
  } catch (e) {
    res.status(500).json({ success: false, error: 'Failed to revoke' });
  }
};

module.exports = { listCampaigns, updateCampaign, listGrants, grantToUser, revokeGrant };
