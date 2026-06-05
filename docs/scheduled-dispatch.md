# Scheduled-booking driver assignment — lifecycle spec

> Status: **design / not yet built.** This spec defines the engine that assigns a
> driver to a *scheduled* Order (a tanker booked for a future slot). It is the
> critical path — the [best-fit scorer](#relationship-to-the-scorer) is the easy
> 20% that plugs in at one step. Companion code: `shared/localities.js` (built),
> `services/scheduled/bestFit.js` (the scorer), and the schema migration.

## Why a new lifecycle (we can't "just reuse" the instant flow)

The instant flow (`DispatchManager` + `DeliveryRequest`) is a real-time offer/accept
engine: `dispatch()` runs synchronously at request creation, offers are held in a
process-local `Map` of `setTimeout`s, and the fulfiller app only ever shows the
*current* job. None of that fits a future booking:

- A scheduled Order is created hours/days early; there is **no driver to offer it to yet**.
- The fulfiller app has **no concept of an upcoming job** or a manifest of future jobs.
- `Order` has no `offers[]`, no assignment sub-states, and `admin.controller.assignDriver`
  is an unguarded `findByIdAndUpdate` (no validation, no notification) — see [admin.controller.js:66](../backend/src/controllers/admin.controller.js#L66).
- The instant socket surface (`OFFER_NEW`, `OFFER_ACCEPT`, `JOB_STATUS`, …) is
  **`requestId`-scoped** and resolves against `DeliveryRequest`. There is no
  `slotId`/`orderId`-scoped equivalent.

So we build a parallel **scheduled** lifecycle that *reuses the proven primitives*
(atomic claim, offer/timeout shape, room/push/WhatsApp fan-out) but on the `Order`
model with its own states, events, and a durable scheduler.

The one hard infra constraint to respect: the backend runs at `numReplicas: 1`
(`DispatchManager`'s in-memory timers, BEFORE_LIVE.md → B3). The scheduler below is
designed to be **safe under restart** and to *not* add a second source of in-memory
truth — the DB is authoritative.

---

## 1. Order assignment states

Today `Order.status ∈ {pending, confirmed, out_for_delivery, delivered, cancelled}`.
We keep `status` as the **customer-facing fulfilment** status and add a separate
`assignmentStatus` for the **driver-allocation** state machine, so the two concerns
don't fight (an order can be `confirmed` to the customer while its assignment is
still `searching`).

```
Order.assignmentStatus (new):
  unassigned   → not yet processed (default for every new confirmed order)
  reserved     → Phase A soft-reserved a truck-trip + earmarked a tentative driver
  searching    → Phase B is actively offering this order to drivers
  offered      → an offer is outstanding to one/more drivers (awaiting accept)
  assigned     → a driver atomically claimed it (committed)
  en_route     → driver started toward the customer  (mirrors customer status out_for_delivery)
  arrived      → driver at the door
  completed    → delivered                            (mirrors customer status delivered)
  no_show      → assigned driver failed to start by the watchdog deadline → re-dispatch
  unfulfilled  → exhausted all drivers + adjacency → escalated to admin
```

Transitions:

```
unassigned ──Phase A──▶ reserved ──Phase B start──▶ searching ──offer──▶ offered
   offered ──accept(atomic)──▶ assigned ──driver──▶ en_route ──▶ arrived ──▶ completed
   offered ──all reject/timeout──▶ searching (widen) ─… exhausted─▶ unfulfilled
  assigned ──no-show watchdog──▶ no_show ──▶ searching (exclude that driver)
       any ──customer/admin cancel──▶ (assignment cleared; Order.status=cancelled)
```

`Order.status` is advanced in lockstep at the meaningful points: `assigned`→ keep
`confirmed`; `en_route`→ `out_for_delivery`; `completed`→ `delivered`.

Every transition appends to the existing `Order.statusLog` (extend its enum to
include the assignment states) so there is one audit timeline.

## 2. `Order.offers[]` — the assignment audit trail

Mirror `DeliveryRequest.offers[]`. This is **also the only data source** for the
reliability term in the scorer (acceptance / no-show rates), so it must exist before
that term means anything.

```js
offers: [{
  driverId:  ObjectId(ref User),
  round:     Number,                 // 1 = nearest/best, 2+ = broadcast
  sentAt:    Date,
  outcome:   'offered' | 'accepted' | 'rejected' | 'timeout' | 'no_show' | 'closed',
  decidedAt: Date,
}]
```

New `Order` fields supporting the lifecycle (added by the migration):
`assignmentStatus`, `offers[]`, `driverAssigned` (exists), `assignedAt`,
`tentativeDriverId` (Phase-A earmark, advisory), `startBy` (no-show deadline =
slot start time), plus the matching fields owned by the scorer
(`requiredLitres`, `deliveryPoint`, `localityId`).

## 3. The two phases

### Phase A — booking time (guarantee, don't commit)
Runs inline in `order.controller.createOrder` (and in the Razorpay webhook for UPI,
where the order actually becomes `confirmed`).

1. Normalize `deliveryAddress.locality → localityId`; geocode → `deliveryPoint`;
   compute `requiredLitres` from the tanker line items. (See migration / scorer.)
2. **Serviceability + reservation:** confirm ≥1 active driver serves `localityId`
   with truck-trip headroom for the slot, and reserve one unit against a
   **per-(driver-or-locality, slot) truck-trip ledger** (see §6 — this replaces the
   hollow global `SlotConfig.currentBooked` guarantee). If none → the slot is shown
   *unavailable for that locality*; never accept an unfulfillable order.
3. **Earmark** the best-fit driver (`bestFit` in Phase-A mode, static signals only)
   into `tentativeDriverId`. Advisory — for the ops dashboard and as a warm-start
   prior for Phase B. **No commitment, no notification.**
4. `assignmentStatus = reserved`.

> UPI nuance: an unpaid UPI order is **not** `confirmed` and must **not** hold a
> truck-trip reservation (mirror the existing `currentBooked` rule —
> [order.controller.js:27](../backend/src/controllers/order.controller.js#L27)).
> Reserve on the `payment.captured` webhook; release on the existing
> `PENDING_PAYMENT_TTL` expiry / cancel path.

### Phase B — just-in-time (the real assignment)
Runs from the **scheduler** (§5), once per `(date, slot)` at `slotStart − LEAD`
(default `LEAD = 120 min`, env-tunable), with a re-check pass at `slotStart − 30 min`.

```
solveSlot(date, slot):
  acquire per-slot lock (§5); if already solved & no churn → no-op
  orders   = Order.find({ slotId in slot, status: 'confirmed',
                          assignmentStatus in [reserved, searching, no_show] })
  drivers  = eligibleDrivers pool for the slot (online-or-recently-seen, active)
  build ONE cached road-distance matrix (drivers × orders) via geo.getEta  // not per-pair in a loop
  order the orders MOST-CONSTRAINED-FIRST (fewest eligible drivers, then biggest litres)
  for each order:
     ranked = bestFit.rankCandidates(order, drivers, { phase: 'B', matrix, slotState })
     offer round-1 to ranked[0]; on reject/timeout broadcast to next N; widen to
       adjacent localities; first acceptor wins via the ATOMIC CLAIM (§4)
     on commit: mutate in-memory slotState (driver load + route) so the next order's
       scoring sees it  ← this is what makes route-clustering real, not per-order-blind
  any order with no taker after adjacency → assignmentStatus = unfulfilled → notify admin
```

## 4. The atomic claim (commit) — reused, extended

Exactly the `findOneAndUpdate` discipline from `DispatchManager.handleAccept`
([DispatchManager.js:224](../backend/src/services/dispatch/DispatchManager.js#L224)),
extended to also enforce the **per-driver slot cap atomically** so two concurrent
offers (or a scheduler + a manual admin assign) can't both land on the same driver:

```js
// guard: order still open AND this driver still under their slot cap
const claimed = await Order.findOneAndUpdate(
  { _id: orderId, driverAssigned: null,
    assignmentStatus: { $in: ['searching', 'offered'] } },
  { driverAssigned: driverId, assignmentStatus: 'assigned', assignedAt: new Date(),
    startBy: slotStartDate,
    $push: { statusLog: { status: 'assigned', changedAt: new Date(), changedBy: driverId },
             offers: { driverId, round, outcome: 'accepted', decidedAt: new Date() } } },
  { new: true }
);
if (!claimed) → tell this driver "taken", move on.
// slot-cap enforced separately/atomically: see §6 truck-trip ledger increment guard.
```

`admin.controller.assignDriver` is **rewritten to use this same guarded claim** (with
an admin override flag that bypasses the cap but still validates the user is an active
fulfiller and logs it) — so manual and algorithmic assignment can never corrupt each
other. This is the small, self-contained fix that unblocks everything else.

## 5. The durable scheduler (no new in-memory truth)

We have no cron/agenda/bull dependency, and adding in-memory timers repeats the
`numReplicas:1` fragility. Design for **restart-safety + idempotency** instead:

- A lightweight `setInterval` tick (reuse the existing sweep cadence, e.g. every
  60 s) — *not* a long-lived per-slot `setTimeout`.
- Each tick: `find slots where slotStart−LEAD ≤ now AND not yet solved` (a
  `slotSolveState` marker on `SlotConfig`: `unsolved | solving | solved`, with a
  `solvingSince` lease). Claim a slot by atomically flipping `unsolved→solving`
  (guarded `findOneAndUpdate`) — this **is** the per-slot lock and it survives
  restarts (a crashed `solving` lease older than N min is reclaimable).
- After `solveSlot` completes → flip `solving→solved`.
- **Recovery:** on boot, reclaim stale `solving` leases and re-run — idempotent
  because committed orders are already `assigned` and skipped by the query filter.

This keeps the DB as the single source of truth; a redeploy mid-solve just re-runs
the unsolved remainder. (When Redis/BullMQ lands per BEFORE_LIVE.md → B3, swap the
interval+lease for a real job store without touching `solveSlot`.)

## 6. Truck-trip capacity ledger (fixes the hollow guarantee)

`SlotConfig.currentBooked` is one city-wide integer — it cannot promise that a
*specific locality* can be served. Replace the scheduled-flow guarantee with capacity
counted in **truck-trips within the window**:

- `driver.tripsPerSlot` (new, derived — see scorer/migration): how many deliveries a
  driver can physically complete in the window, accounting for refill round-trips —
  **not** a self-declared flat count.
- Reservation increments a `(driverId, slotId)` or `(localityId, slotId)` trip
  counter atomically (guarded `$inc` with an `$expr` cap, like the existing COD slot
  reservation at [order.controller.js:18](../backend/src/controllers/order.controller.js#L18)).
- Release on cancel / payment-failure / no-show.
- Reconcile with the existing global `currentBooked`: `currentBooked` stays as the
  coarse city-wide cap (don't remove it — `createOrder` and the admin UI depend on
  it); the trip ledger is the finer per-locality guarantee layered on top.

## 7. Driver-side contract (the net-new app surface)

New socket events (extend `EVENTS`), `orderId`-scoped — these do **not** exist today:

```
server → driver:  schedoffer:new      { orderId, slotLabel, window, drop, litres, amount, paymentMode, expiresAt }
                  schedoffer:closed   { orderId, reason: taken|timeout|cancelled }
                  schedjob:assigned    { orderId, ...manifest card }
                  schedjob:cancelled   { orderId, reason }
driver → server:  schedoffer:accept   { orderId }
                  schedoffer:reject   { orderId }
                  schedjob:status     { orderId, status: en_route|arrived|completed }
                  schedjob:start      { orderId }   // clears the no-show watchdog
```

- **Push (Expo) + WhatsApp** mirror the instant flow: `push.sendOffer`-style wake for
  a backgrounded app; WhatsApp templated message as the durable fallback (the
  WhatsApp service is one-way — it notifies, it does **not** parse inbound accepts, so
  acceptance must come via socket/app or a manual dispatcher confirm).
- New fulfiller-app screen: **"Upcoming jobs"** — a manifest of accepted future jobs
  per slot, distinct from the single live instant job.
- **Connectivity reality:** at `T-0` many drivers will have stale/no GPS or be
  offline (hill dead-zones, cheap phones). A non-response is **not** a rejection —
  it's a timeout → reassign + log, and there is always a **dispatcher manual-confirm**
  path (phone/WhatsApp, then one-tap assign through the §4 claim).

## 8. No-show watchdog

`assigned` orders carry `startBy = slotStart`. A watchdog tick (same interval as §5):

```
find orders { assignmentStatus: 'assigned', startBy < now − GRACE, no schedjob:start seen }
  → assignmentStatus = no_show; offers[].push({driverId, outcome:'no_show'})
  → release the driver's trip-ledger unit; ding driver reliability counter
  → re-enter solveSlot for that order, excluding the no-show driver (then adjacency, then admin)
```

## 9. Cross-flow truck lock (one physical fleet)

The same `User`/truck serves both the instant `DispatchManager` and this flow. A
driver committed to the 7–9 AM scheduled slot must not be poached by a 6:50 AM
instant fare that breaks the manifest. Minimal mechanism:

- A `fulfillerProfile.scheduledHold { slotId, from, to }` (or a check against
  `assigned` scheduled orders) that the instant `findCandidates` query **excludes**
  when `now` is within `hold.from … hold.to`.
- Conversely, the scheduled pool can prefer drivers *without* an active instant job at
  solve time. Detect-and-prevent, not just detect.

## 10. Event-driven re-solve (not one-shot)

`solveSlot` is not fire-and-forget. Re-enter it (idempotently, via §5's marker) on:
`customer/admin cancel` (frees capacity, may re-balance), `late UPI confirmation`
(a `confirmed` order that landed after the initial solve — absorb it), `driver goes
offline before slot`, `no-show`, and `manual admin assign` (treat the admin's choice
as authoritative and re-balance the rest around it).

---

## Relationship to the scorer

`solveSlot` calls `bestFit.rankCandidates(order, drivers, { phase, matrix, slotState })`
(see `services/scheduled/bestFit.js`). The lifecycle owns **when** to assign, the
**commit**, notifications, watchdog, and capacity; the scorer owns **which** driver
ranks best. Phase A passes `{ phase: 'A' }` (static signals); Phase B passes
`{ phase: 'B' }` plus the live distance matrix and mutating slot state.

## Build order (recommended)

1. **Migration + safe `assignDriver`** (atomic claim) + `Order` fields/indexes — unblocks everything, low risk.
2. **Decision-support / thin-supply mode**: admin UI shows `bestFit` ranked suggestions with the "why" breakdown + one-tap assign. *This is what actually runs at 3-driver launch.* Ship here first.
3. **Scheduler + truck-trip ledger + no-show watchdog** (§5,6,8) — the durable engine.
4. **Driver-app scheduled contract** (§7) — socket/push/WhatsApp + Upcoming-jobs screen.
5. **Cross-flow lock + event-driven re-solve** (§9,10) — hardening once volume justifies it.
