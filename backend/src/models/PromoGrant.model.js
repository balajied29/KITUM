const mongoose = require('mongoose');

/**
 * One enrollment of a user into a launch campaign — the audit ledger (who got
 * what, when, enrollment #). The denormalized fast-path fields on User
 * (fulfillerProfile.commissionWaiverUntil, customerPerks.*) are what pricing
 * actually reads; this is the source of truth for ops/accounting/CAC.
 *
 * The unique {campaignKey, user} index makes enrollment idempotent — a user can
 * hold at most one grant per campaign, so re-approval / re-registration can never
 * double-grant or over-claim the cap.
 */
const promoGrantSchema = new mongoose.Schema(
  {
    campaignKey: { type: String, required: true },
    audience: { type: String, enum: ['driver', 'customer'], required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    enrollmentNumber: { type: Number }, // "you were the Nth"
    benefit: {
      type: { type: String },
      durationDays: Number,
      freeBookings: Number,
      useByDays: Number,
    },
    startsAt: { type: Date, default: Date.now },
    endsAt: { type: Date, default: null },
    status: { type: String, enum: ['active', 'expired', 'revoked'], default: 'active' },
    // customer-only running counters (mirror User.customerPerks for audit)
    freeBookingsTotal: { type: Number, default: null },
    freeBookingsRemaining: { type: Number, default: null },
  },
  { timestamps: true }
);

promoGrantSchema.index({ campaignKey: 1, user: 1 }, { unique: true });

module.exports = mongoose.model('PromoGrant', promoGrantSchema);
