# KitUm Launch Offers — Design Spec (acquisition phase)

> **Status:** design locked 2026-06-07, **not yet built**. This is the turnkey spec.
> **Decisions (locked):**
> - **Driver offer** — the first **15 _approved_** partners get **0% commission for 3 months**, clock starting at **approval**.
> - **Customer offer** — the first **N customers** get their **first K bookings with no platform fee** (the 5% surcharge waived). `N`, `K` and an optional use-by window are **config**, set at launch.
> - **Architecture** — **config-driven campaigns** (admin can tune caps/dates, extend, revoke, see live counters — no redeploy).

Design principles (the Uber/Rapido/DoorDash launch playbook):
1. **Config-driven, not magic numbers** — caps/windows/durations are data.
2. **Server-authoritative pricing** — apps render the breakdown the server returns; never compute a discount client-side.
3. **Atomic, race-safe slot claims** — "first 15 / first N" enforced with a single conditional update.
4. **Grant ledger + denormalized fast-path** — an auditable grant row, plus a cached field on the user for O(1) pricing checks.
5. **Absolute timestamps** — convert "3 months" → an absolute `endsAt` at grant time.

---

## 1. Data model

### `Campaign` (new collection — the config + atomic counter)
```js
{
  key: 'launch_driver_zero_commission' | 'launch_customer_no_fee', // unique
  audience: 'driver' | 'customer',
  benefit: {
    type: 'commission_waiver' | 'platform_fee_waiver',
    // driver: full commission waived for `durationDays`
    // customer: platform fee waived for the first `freeBookings` bookings
    durationDays: 90,        // driver only (90 = 3 months)
    freeBookings: null,      // customer only (= K)
    useByDays: null,         // customer only, optional: free bookings expire N days after signup (null = no expiry)
  },
  cap: 15,                   // max enrollees (= 15 drivers, = N customers); null = unlimited
  claimed: 0,                // ATOMIC counter — incremented on each successful enrollment
  enrollWindow: { start: Date, end: Date | null }, // when new enrollments are allowed
  active: true,
}
```
A single small collection (two docs). Reads are cheap; the only hot write is the atomic `$inc` claim.

### `PromoGrant` (new collection — audit ledger, one row per beneficiary)
```js
{
  campaignKey, audience,
  user: ObjectId,            // the driver or customer
  enrollmentNumber: 7,       // "you were the 7th"
  benefit: { type, ... },
  startsAt: Date, endsAt: Date | null,
  status: 'active' | 'expired' | 'revoked',
  // customer-only:
  freeBookingsTotal: K, freeBookingsRemaining: K,
}
```
Source of truth for ops/accounting/support and for showing "you're saving X". Idempotency: a user may hold **at most one active grant per campaign** (unique index on `{campaignKey, user}`).

### Denormalized fast-path on `User` (avoids a query at pricing time)
```js
// fulfillerProfile (driver)
commissionWaiverUntil: Date | null,   // pricing checks: now < this
commissionWaiverNo: Number,           // enrollment # (for the badge)

// customerPerks (customer) — new subdoc
customerPerks: {
  freeBookingsRemaining: Number,      // decremented atomically per free booking
  freeBookingsUntil: Date | null,     // optional use-by
  enrollmentNo: Number,
}
```
The `PromoGrant` is the ledger; these cached fields are what pricing/booking actually read (the user doc is already loaded, so the check is free).

---

## 2. Pricing engine — the only formula change

`backend/src/shared/pricing.js` — extend the single source of truth with optional waiver flags (fully backward compatible; default = current behaviour):
```js
function quote(fareSubtotal, { waivePlatformFee = false, waiveCommission = false } = {}) {
  const fare = r(fareSubtotal);
  const platformFee       = waivePlatformFee ? 0 : r(fare * PLATFORM_FEE_PCT);
  const total             = fare + platformFee;
  const partnerCommission = waiveCommission  ? 0 : r(fare * PARTNER_COMMISSION_PCT);
  const partnerPayout     = fare - partnerCommission;                 // waived → keeps 100%
  return { fare, platformFee, total, partnerCommission, partnerPayout,
           waivePlatformFee, waiveCommission };  // flags echoed so apps can render the badge
}
```
Mirror the flags (display-only) in `frontend/lib/pricing.js`.

### Resolution timing — the key subtlety
- **`waivePlatformFee` (customer)** is known **at booking** (the customer is on the request) → applied in `quote()` at creation.
- **`waiveCommission` (driver)** depends on **which driver gets the job** → the stored `partnerPayout` at creation is provisional; the **authoritative payout is (re)computed when a driver is offered/assigned/settled**, using that driver's `commissionWaiverUntil`.

Concretely:
- `request.controller.createRequest` / `order.controller.createOrder`: call `quote(fare, { waivePlatformFee: customerFeeEligible(req.user) })` and (atomically) consume a free booking — see §4.
- `services/dispatch/DispatchManager`: when building the offer/finalizing assignment ([~:185](../backend/src/services/dispatch/DispatchManager.js#L185), [~:358](../backend/src/services/dispatch/DispatchManager.js#L358)), compute `payout = driverWaived ? fare : fare − commission` for the specific fulfiller; persist the resolved `partnerCommission`/`partnerPayout` on the request at assignment. Earnings/history then auto-reflect it (they already sum `partnerPayout`).

---

## 3. Enrollment (atomic, idempotent)

Shared helper `services/promotions.js`:
```js
// Returns the grant if a slot was claimed, else null. Safe under concurrency.
async function claimSlot(campaignKey, userId) {
  const c = await Campaign.findOneAndUpdate(
    { key: campaignKey, active: true, claimed: { $lt: '$cap' /* expressed via aggregation/$expr */ },
      'enrollWindow.start': { $lte: now }, $or: [{ 'enrollWindow.end': null }, { 'enrollWindow.end': { $gte: now } }] },
    { $inc: { claimed: 1 } }, { new: true });
  if (!c) return null;                 // cap full or window closed
  // create PromoGrant + set denormalized fields; guarded by unique {campaignKey,user}
}
```
(`claimed < cap` is done with `$expr`/aggregation pipeline update, or a guarded read-modify-write in a txn; the `$inc` + unique-grant index guarantees no over-claim and no double-grant.)

### Driver hook — `admin.controller.approveFulfiller` ([:300](../backend/src/controllers/admin.controller.js#L300))
After setting `applicationStatus:'approved'`, **if the driver has no active grant**, `claimSlot('launch_driver_zero_commission', id)`. On success set `commissionWaiverUntil = approvedAt + durationDays`, `commissionWaiverNo = enrollmentNumber`. Idempotent: re-approving never re-claims (guard on existing grant).

### Customer hook — `auth.controller.register` (customer)
On successful customer registration, `claimSlot('launch_customer_no_fee', userId)`. On success set `customerPerks.freeBookingsRemaining = K`, `freeBookingsUntil = signup + useByDays` (if set).

---

## 4. Consuming the customer free-booking (first K)

At booking creation, **atomically reserve** a freebie so concurrent bookings can't double-spend and the price shown is truthful:
```js
const eligible = await User.findOneAndUpdate(
  { _id: userId, 'customerPerks.freeBookingsRemaining': { $gt: 0 },
    $or: [{ 'customerPerks.freeBookingsUntil': null }, { 'customerPerks.freeBookingsUntil': { $gte: now } }] },
  { $inc: { 'customerPerks.freeBookingsRemaining': -1 } }, { new: true });
const waivePlatformFee = !!eligible;
// tag the request/order: pricing.feeWaived = waivePlatformFee  (so we can restore on cancel)
```
- **Restore on non-fulfilment:** if the booking is cancelled / customer-no-show before completion **and** `pricing.feeWaived`, `$inc` the remaining back by 1 and decrement `PromoGrant.freeBookingsRemaining`. (A free booking should only be "spent" on a real delivery.) Decrement the grant ledger to match on completion.
- Keep `Campaign.claimed` and `PromoGrant` as the audit trail; the User field is the hot counter.

---

## 5. Admin surface (`/admin`)

- **Campaigns dashboard:** live `7 / 15 drivers`, `N_used / N customers`; toggle `active`; edit `cap`, `enrollWindow`, `durationDays`, `freeBookings`, `useByDays` (no redeploy).
- **Enrollee lists:** who's enrolled, enrollment #, `endsAt` / remaining free bookings, status.
- **Manual grant / revoke** (e.g., a recruited founding driver who registered before the campaign, or revoking abuse).
- Backend: `admin.routes` + `admin.controller` CRUD on `Campaign` + grant list/grant/revoke; reuse existing admin auth.

## 6. App surfaces (display-only — render server flags)

- **Partner app:** "⭐ Founding Partner — 0% commission, you keep 100%" badge + countdown ("89 days left") on Home (from `commissionWaiverUntil`); offers already show the (now-full) payout. Source: extend `/auth/me` / fulfiller profile to expose `commissionWaiverUntil` + `commissionWaiverNo`.
- **Customer app:** in the price breakdown show platform fee **₹0** with the 5% struck through + "Launch offer — fee waived 🎉"; a small banner "Free of platform fee — N bookings left" (from `customerPerks`). The breakdown already comes from server `quote()`; just render `waivePlatformFee` + remaining.
- **Web (`frontend/lib/pricing.js`)** mirrors the flags for instant display, but the **server value is authoritative** at checkout.

## 7. Invariants & edge cases

- **No over-claim:** atomic `$inc` + `claimed < cap` + unique `{campaignKey,user}` grant ⇒ never a 16th driver / (N+1)th customer.
- **Idempotent grants:** re-approval / re-registration never double-grants.
- **Cancelled free booking is refunded** to the customer's remaining count (only real deliveries spend a freebie).
- **Driver payout is per-assigned-driver** — a waived driver keeps 100% even on a request quoted before assignment.
- **Clean expiry:** when `commissionWaiverUntil`/`freeBookingsUntil` passes or `freeBookingsRemaining` hits 0, pricing reverts automatically — no migration. A nightly sweep flips `PromoGrant.status` to `expired` for reporting (cosmetic).
- **Settlement-ready:** because commission/payout are persisted at assignment, the (future) payout pipeline reconciles correctly for waived vs standard partners.
- **Accounting:** waived platform fee = foregone revenue; waived commission = foregone revenue. The `PromoGrant` ledger is the record of customer-acquisition cost (CAC) spend.

## 8. Config to set at launch (the only blanks)
- Customer **N** (cap) and **K** (free bookings each); optional **useByDays**.
- Driver: cap **15**, durationDays **90** (locked).
- `enrollWindow` start/end for each campaign.

## 9. Implementation map (files)
- `backend/src/shared/pricing.js` — waiver flags (above).
- `backend/src/models/Campaign.model.js`, `PromoGrant.model.js` — new.
- `backend/src/models/User.model.js` — `fulfillerProfile.commissionWaiverUntil/No`, `customerPerks`.
- `backend/src/services/promotions.js` — `claimSlot`, `customerFeeEligible`, `reserveFreeBooking`, `restoreFreeBooking`, `resolveDriverWaiver`.
- `backend/src/controllers/admin.controller.js` (+routes) — approve hook + campaign CRUD + enrollee/grant/revoke.
- `backend/src/controllers/auth.controller.js` — register hook (customer) + expose waiver fields on `/auth/me`.
- `backend/src/controllers/request.controller.js`, `order.controller.js` — pass `waivePlatformFee`, reserve/restore freebie.
- `backend/src/services/dispatch/DispatchManager.js` — per-driver payout recompute at offer/assignment.
- `frontend/lib/pricing.js` + breakdown UIs (instant/checkout/status/track) — render waiver.
- `frontend/app/admin/*` — campaigns dashboard.
- `fulfiller/` — founding-partner badge/countdown on Home; profile waiver fields.

## 10. Suggested build phasing
1. **Backend core** — models + pricing flags + `promotions.js` + the two enrollment hooks + booking reserve/restore + DispatchManager payout recompute. (Ship the money logic first, server-authoritative.)
2. **Admin** — campaign CRUD + counters + enrollee list + manual grant/revoke.
3. **App polish** — partner founding badge/countdown; customer fee-waived breakdown + banner.

Each phase is independently shippable; pricing reverts safely if a campaign is off.
