const mongoose = require('mongoose');

/**
 * A launch-offer campaign (acquisition phase) — see docs/launch-offers-design.md.
 * Config + the ATOMIC enrollment counter. Two seeded by default:
 *   launch_driver_zero_commission — first `cap` approved drivers, 0% commission for durationDays
 *   launch_customer_no_fee        — first `cap` customers, platform fee waived for `freeBookings`
 * Admin-tunable (cap / window / active) with no redeploy.
 */
const campaignSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    audience: { type: String, enum: ['driver', 'customer'], required: true },
    benefit: {
      type: { type: String, enum: ['commission_waiver', 'platform_fee_waiver'], required: true },
      durationDays: { type: Number, default: null }, // driver: waiver length from approval
      freeBookings: { type: Number, default: null }, // customer: K free bookings (no platform fee)
      useByDays: { type: Number, default: null },     // customer: optional — free bookings expire N days after signup
    },
    cap: { type: Number, default: null }, // max enrollees (null = unlimited)
    claimed: { type: Number, default: 0 }, // ATOMIC counter — $inc'd on each enrollment
    enrollWindow: {
      start: { type: Date, default: null }, // null = open now
      end: { type: Date, default: null },   // null = no end
    },
    active: { type: Boolean, default: true },
    description: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Campaign', campaignSchema);
