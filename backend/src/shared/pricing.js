/**
 * KitUm money model — single source of truth for the bill breakdown. Mirrored
 * (values) in frontend/lib/pricing.js and documented in legal/refunds + terms.
 *
 * Payment is collected AT COMPLETION (cash, or UPI at the door) — nothing is
 * charged at booking — so there is no advance and no pre-paid amount to stage-refund.
 *
 *   fare              tanker subtotal (Σ price × qty)
 *   platformFee       5% surcharge on the fare — KitUm platform revenue
 *   total             fare + platformFee — what the customer pays on delivery
 *   partnerCommission 5% of the fare, kept by KitUm
 *   partnerPayout     fare − commission — what the partner actually earns
 */

const PLATFORM_FEE_PCT = 0.05;
const PARTNER_COMMISSION_PCT = 0.05;

// Flat fee charged on a verified customer-no-show: deducted from a prepaid
// customer's refund and paid to the driver for the wasted trip. Env-tunable.
const DRY_RUN_FEE = Number(process.env.DRY_RUN_FEE_INR) || 50;

const r = (n) => Math.round(Number(n) || 0);

/** Build the bill breakdown for a fare subtotal (Σ price × qty, rupees). */
function quote(fareSubtotal) {
  const fare = r(fareSubtotal);
  const platformFee = r(fare * PLATFORM_FEE_PCT);
  const total = fare + platformFee;
  const partnerCommission = r(fare * PARTNER_COMMISSION_PCT);
  const partnerPayout = fare - partnerCommission;
  return { fare, platformFee, total, partnerCommission, partnerPayout };
}

module.exports = {
  PLATFORM_FEE_PCT,
  PARTNER_COMMISSION_PCT,
  DRY_RUN_FEE,
  quote,
};
