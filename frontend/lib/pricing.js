// Display mirror of backend/src/shared/pricing.js (values only). Payment is
// collected at completion (cash, or UPI at the door) — nothing upfront — so the
// breakdown is just fare + platform fee = total. The backend re-derives the
// authoritative numbers; never trust these for anything but display.
export const PLATFORM_FEE_PCT = 0.05;

const r = (n) => Math.round(Number(n) || 0);

/** Bill breakdown for a fare subtotal (Σ price × qty, rupees). */
export function quote(fareSubtotal) {
  const fare = r(fareSubtotal);
  const platformFee = r(fare * PLATFORM_FEE_PCT);
  const total = fare + platformFee;
  return { fare, platformFee, total };
}
