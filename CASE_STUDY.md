# KITUM: Building a Water-Delivery Platform for Shillong

### From a slot-booking PWA to a three-surface, ride-hailing-style tanker network in roughly two months

*Timeline: built ~Apr 8 to Jun 9, 2026 across ~24 commits | Status: pre-launch hardening | Location: Shillong, Meghalaya, India*

## Executive Summary

KITUM is a water-delivery platform for Shillong that turns an informal, phone-and-cash tanker market into a server-authoritative software product. It ships across three surfaces: a customer Next.js 14 installable PWA, an Expo (React Native) partner app for tanker operators ("fulfillers"), and an `/admin` console embedded in the web app. It runs two distinct fulfillment modes from one catalogue: scheduled slot deliveries (the `Order` resource, booked against a 7-day x Morning/Afternoon/Evening grid) and instant, ride-hailing-style tanker dispatch (the `DeliveryRequest` resource, live-tracked over Socket.IO). The backend is a single Express 4 + Mongoose 8 + Socket.IO 4 service on MongoDB Atlas. The headline engineering themes recur at every layer: correctness anchored on atomic MongoDB claims rather than in-memory state, fail-soft external integrations paired with fail-closed security, payment collected at the door (cash or UPI) instead of upfront, and compliance with India's DPDP Act 2023 built in from the schema up.

## The Problem

Water access in Shillong is served by an informal tanker market: operators with trucks, customers who need a fill, and coordination that happens over phone calls and cash. That market works, but it is opaque. A customer cannot see who is nearby, when a tanker will arrive, or what a fair price is, and an operator has no structured way to find demand, prove reliability, or get paid predictably. The product opportunity is to put a thin, trustworthy software layer over the existing fleet: keep the cash-first, pay-on-delivery norm that the market already runs on, but add discoverability, live tracking, accountability, and a clean settlement trail. That framing drives nearly every design decision that follows, most visibly the decision to collect no money at booking.

## The Product

KITUM presents three surfaces and two fulfillment modes.

**The three surfaces:**

- **Customer PWA** (Next.js 14, App Router, installable). A single phone-width column (max-width 440px, centered on a neutral desktop frame) with a fixed three-tab bottom nav (Home / Orders / Account). It serves both booking flows from one product catalogue and is built around seamless guest auth: there is no login wall on any booking path.
- **Partner app** (Expo SDK 54 / React Native 0.81). The app a tanker operator uses to apply, pass KYC, go online, receive ride-hailing-style offers, drive an active job to completion, and track earnings.
- **Admin console** (`/admin`, mounted inside the web app). The ops surface with six sections: scheduled-order management and driver assignment, partner application review and KYC verification, slot capacity, launch-offer campaigns, review moderation, and a support inbox.

**The two fulfillment modes:**

- **Scheduled slots** (`Order`). A customer books items against a `SlotConfig` (date plus a Morning/Afternoon/Evening label) for a chosen locality. A human dispatcher, supported by a best-fit scorer, assigns a partner. This is the "Order for later" flow.
- **Instant dispatch** (`DeliveryRequest`). An Uber/Rapido-style flow: pick a tanker size, drop a pin, and the backend runs a real-time offer auction to the nearest available tankers, with live GPS tracking to the door. This is the "Now" flow.

Both modes are exposed from a single customer screen via a Now/Schedule toggle (`frontend/app/order/instant/page.js`).

## System Architecture

KITUM is developed in a monorepo (`github.com/balajied29/KITUM`) with the backend, the Next.js frontend (customer PWA + admin), and the Expo partner app side by side. The backend is deployed from a separate, code-only repo (covered in Deployment below).

```
                         EXTERNAL SERVICES
        Razorpay   Google Geocoding   Mapbox Directions
        Expo Push  Interakt WhatsApp  Nodemailer SMTP   S3 / Cloudflare R2
                 |        |        |        |        |        |
                 +--------+--------+---+----+--------+--------+
                                       |  (all lazy + fail-soft)
   Customer PWA  ----- REST /api ----->|
   (Next.js,     <==== Socket.IO =====>|   Express 4 + Socket.IO 4
    Vercel)      (direct, bypasses     |   (Node >= 18, single persistent host)
                  the /api rewrite)    |
                                       |   - REST: 11 /api resource groups
   Partner app   ----- REST /api ----->|   - DispatchManager (instant auction)
   (Expo / RN,   <==== Socket.IO =====>|   - bestFit scorer (scheduled)
    Google Play)                       |   - availability snapshot (display-only)
                                       |   - promotions / pricing (server-auth)
   Admin console ----- REST /api ----->|   - fieldCrypto (AES-256-GCM, fail-closed)
   (Next.js, in   (admin-prefixed,     |
    the web app)   protect+adminOnly)  |
                                       v
                              MongoDB Atlas
                       (cluster kitum0, db 'kitum',
                        13 models, 2dsphere geo index)
```

### Domain data model

Persistence is 13 Mongoose models. The defining choice is that the two fulfillment flows live in **separate collections by design** rather than one polymorphic model. The `DeliveryRequest` schema comment states it is "deliberately separate from the scheduled Order model," because the mechanics genuinely diverge: `DeliveryRequest` is geo-proximity `$near` nearest-tanker dispatch with live drop coordinates and an `etaMin`; `Order` is slot- and locality-bucketed with a multi-state assignment machine, slot capacity accounting, and a no-show watchdog.

Both flows share a near-identical money breakdown (`fare`, `platformFee`, `partnerCommission`, `partnerPayout`), an `offers[]` dispatch audit trail, a `statusLog[]` audit timeline, and launch-offer fee-waiver flags.

| Model | Role |
|---|---|
| `Order` | Scheduled slot delivery; dual state machines plus full driver-allocation machinery |
| `DeliveryRequest` | Instant on-demand tanker dispatch with GeoJSON drop point and no-show proof |
| `User` | Single account model for customer / admin / driver / fulfiller, embedding `fulfillerProfile` |
| `Campaign` | Launch-offer config plus an atomic `claimed` enrollment counter |
| `PromoGrant` | Per-user enrollment ledger (audit source of truth), unique `{campaignKey, user}` |
| `ConsentLog` | Append-only DPDP Act 2023 consent ledger |
| `RefreshToken` | Server-side refresh-token store (SHA-256 hash only) with rotation + reuse detection |
| `OtpVerification` | Email-OTP verification, hash-only, TTL auto-delete after 10 minutes |
| `Review` | One review per delivery across both flows (`source` enum order/request) |
| `SupportTicket` | Customer/support thread with embedded `messages[]` |
| `SlotConfig` | Scheduled-delivery slot capacity, unique `{date, slotLabel}` |
| `Address` | Saved customer delivery address with GeoJSON point |
| `Product` | Catalogue SKU (tanker sizes and bottled water), with authoritative `tankerLitres` |

A few schema decisions carry disproportionate weight:

- **`Order` has two independent state machines.** A customer-facing `status` (pending / confirmed / out_for_delivery / delivered / cancelled) and a driver-allocation `assignmentStatus` with 10 states (unassigned, reserved, searching, offered, assigned, en_route, arrived, completed, no_show, unfulfilled), both written into one shared `statusLog[]`. The customer sees a simple lifecycle while the dispatch engine runs a richer allocation flow without leaking internal churn. `Order` also distinguishes a Phase-A advisory `tentativeDriverId` (not a commitment) from the committed `driverAssigned`, and carries a `startBy` no-show watchdog deadline plus a `slotReserved` flag that guards slot-capacity accounting.
- **`DeliveryRequest` carries an 11-state status enum** sourced from a shared constant (`REQUEST_STATUS`), including the terminal-failure states `no_fulfiller`, `expired`, and `customer_no_show`, plus a pre-dispatch `pending_payment` (a UPI order created but not yet dispatchable). Its `dropLocation` embeds contact, flat, landmark, and directions, and a structured `noShowReport` (reason, `callAttempted`, driver coordinates) backs the `customer_no_show` terminal state for dispute resolution.
- **GeoJSON `type` defaults to `undefined`** on `fulfillerProfile.currentLocation`, `Order.deliveryPoint`, and `fulfillerProfile.basePoint`, but to `'Point'` on `Address.location` and `DeliveryRequest.dropLocation`. The reason is concrete: a partner created without a live GPS fix would otherwise get a phantom `{ type: 'Point' }` with no coordinates that the 2dsphere index rejects on insert. Address and drop points always have coordinates, so they default to `'Point'`. The matcher degrades gracefully when the point is absent.
- **Fee-waiver perks are denormalized onto `User`** (`fulfillerProfile.commissionWaiverUntil` for drivers, `customerPerks.freeBookingsRemaining` for customers) so the hot pricing path reads them without a join, while `PromoGrant` stays the audit source of truth.
- **`Product.tankerLitres`** provides an authoritative numeric capacity (0 for bottled jars/packs/crates), because free-text `unit` strings like `'20L'` or `'1000L'` are not machine-reliable for matching an order to a required tanker capacity. It was backfilled by migration; `Order.requiredLitres` is denormalized from items for fast matching.
- **Security and integrity are enforced by indexes.** `RefreshToken` stores only the SHA-256 hash (never the raw token) and links each row to its replacement (`replacedByHash`), with a TTL index on `expiresAt`; `OtpVerification` stores `otpHash` only and TTL-deletes after 10 minutes; `Review` enforces one review per delivery via unique sparse indexes on `orderId` and `requestId`; `SlotConfig` enforces a unique `{date, slotLabel}`; and `PromoGrant` enforces a unique `{campaignKey, user}`.

### The real-time layer

A single `http.Server` is shared by Express and Socket.IO (`src/index.js`). Fulfillers stream GPS over sockets; the handshake uses JWT auth mirroring the REST `protect` middleware; handlers are role-routed; and an in-memory registry tracks live fulfiller locations, the active request, and a persist throttle. An in-memory `DispatchManager` runs the instant offer engine. Location relay is throttled (a 1s flood floor, and a 20s Mongo-persist throttle while a driver is on a job). On reconnect, the layer cancels pending grace/abandon timers and resumes live tracking; a `presence:set` re-checks `canGoOnline` (approved application plus verified KYC) server-side so an ineligible partner cannot go online.

## Engineering Deep Dives

### Dual fulfillment engine

The instant engine, `dispatch/DispatchManager.js`, is a **multi-round, radius-widening offer auction**. Round 1 offers to the single nearest available fulfiller with roughly a 20-second window. On reject or timeout, rounds 2+ broadcast simultaneously to the next 5 best, first to accept wins. Each round widens the `$near` radius through `[5, 10, 15]` km over `MAX_ROUNDS = 3`; if no one takes it, the request is marked `no_fulfiller`. Candidate selection runs over the 2dsphere index (nearest-first), then a stable sort floats socket-connected fulfillers above disconnected ones so a backgrounded or dead app never burns a whole round while distance order is preserved within each group.

Correctness is anchored entirely on atomic Mongo claims, not in-memory state. The winner is decided by a `findOneAndUpdate` on the request (`{ status: searching }`) **and** a second guarded update on the driver (`{ fulfillerProfile.isAvailable: true }`). If a driver holds live offers for two concurrent broadcasts and taps accept on both, exactly one claim succeeds; the loser's request claim is rolled back to `searching` and re-dispatched excluding that driver. Job-status transitions (`en_route -> arrived -> completed`) are atomic and idempotent, each landing only via a `findOneAndUpdate` matching the exact expected prior status, so a replayed or double-tapped emit re-runs no side effects and an out-of-order jump is rejected (the authoritative status is pushed back so the client self-heals). A UPI job additionally cannot be marked completed unless `paymentStatus` is `'paid'` (an `$or` guard that also admits `paymentMode: 'cod'`), the data-layer safety net behind the driver-app button gate.

The scheduled engine, `scheduled/bestFit.js`, is a **pure, interpretable best-fit scorer**, used as decision-support in the admin assignment modal rather than fully automatic. It is two-phase: Phase A (booking time, no live GPS) leans on locality affinity plus the customer's previous driver, with proximity weight 0; Phase B (just-in-time, live GPS, whole-slot batch) makes proximity dominant (weight 0.30). Per-phase weights each sum to 1.0. It also classifies supply as none/thin/dense for the admin view.

Two design properties make it both correct and fast. First, components **abstain by returning `null`**, and the weighted average renormalizes over only present components, so a missing signal never silently sinks a good driver (explicitly avoiding the "null point becomes full distance cost" bug). `proximityScore()` only scores confident distances; approximate-centroid distances are dropped, not faked. Second, **all DB aggregation happens once per order** in `buildContext()`, making `scoreDriver()` a pure no-I/O function, so ranking N drivers is N cheap calls rather than N x M queries. The scoring is statistically careful: ratings use Bayesian shrinkage toward a 4.3 prior (strength 8 pseudo-counts), reliability blends accept-rate and no-show-rate with priors, a decaying new-driver boost (max +0.05, fading over the first 10 ratings) addresses cold-start, capacity is both a hard filter and a soft right-sizing score (1/(1+slack), floored at 0.1, so a big truck is not burned on a small order), and COD concentration is discouraged by halving the payment score once a driver hits `COD_MAX_PER_SLOT` (3). Ties within `TIE_EPSILON` (0.02) break deterministically on fairness, reliability, preferred, then `_id`, so repeated solves are reproducible.

Resilience is layered for the instant flow. `recover()` re-queues all `searching` requests after a restart, and an independent backstop sweeper (every 60s) finalizes stuck requests: searching beyond 5 minutes becomes `no_fulfiller` (with refund), assigned-but-not-started beyond 3 minutes becomes a no-show reclaim and re-dispatch, and abandoned UPI checkouts beyond 15 minutes become `expired`. On a fulfiller disconnect, an on-job driver gets a grace window (pausing the customer's live tracking) before auto-abandon and re-dispatch, while an idle driver is marked offline after a shorter grace. A prominent code comment pins deployment to `numReplicas: 1` until Redis and distributed timers land, noting that the atomic claim still prevents double-assignment even if timers fragment.

### Optimized nearby availability

The customer home shows a "tankers nearby / available now" signal, and every customer hits it on home load. `availability.js` keeps this **completely separate from the dispatch matcher** and serves it from one in-memory fleet snapshot, refreshed at most once per 20s TTL behind a single-flight guard (concurrent home loads share one query). Each request is answered with an O(N) haversine over a tens-of-docs array, so DB load is independent of customer traffic. On a refresh error it keeps the previous snapshot, degrading gracefully instead of dropping to zero. A display number does not need dispatch-grade strictness, and decoupling read cost from traffic is the whole point.

### The seamless-auth evolution

Auth went through three regimes. The initial commit shipped OTP email auth; the same day, `aedca78` ("Replace OTP auth with email/password") replaced it wholesale; finally, `0e83379` added a passwordless guest session for a customer's first booking. The customer surface now has **no mandatory login anywhere in the funnel**. Both `checkout/page.js` and `order/instant/page.js` call `ensureCustomerAuth(name, phone)`, which short-circuits if a token already exists and otherwise hits `POST /auth/quick` to create-or-resume a passwordless guest account keyed by phone via a reserved email of the form `g_<phone>@guest.kitum.online`, persisting the session in a zustand store. A traditional email/password login still exists for returning users and is required to view Orders and Addresses.

Under the hood, auth uses short-lived access JWTs (~15 minutes) plus rotating opaque refresh tokens (~30 days, stored HMAC-hashed, never JWTs so they cannot be replayed as access tokens). Rotation detects theft: reusing a long-revoked token burns the whole token family, but a 60-second grace window treats a just-rotated token (second tab, rapid reload, retry) as benign and re-issues instead of logging the user out. The code comment for `/auth/quick` is honest that re-auth is currently **phone-only with no OTP yet**, acceptable for low-stakes pay-at-completion accounts but flagged for hardening.

### Launch offers and pricing hardening

Launch offers (commit `8fc6409`) are config-driven, server-authoritative, and race-safe. Two campaigns are seeded: founding drivers get 0% commission (default 15 drivers / 90 days), and launch customers get their first K bookings fee-free (default 100 customers / 3 bookings). Enrollment is atomic and cap-safe: a slot is claimed via `$inc` guarded by `$expr {claimed < cap}`, and a unique `{campaignKey, user}` `PromoGrant` guarantees idempotent one-per-user enrollment, so re-approving a driver or re-registering a customer can never double-grant or push a campaign past its cap. A duplicate or failed grant rolls the counter back so `claimed` stays exact, and campaigns are seeded with `$setOnInsert` so restarts never clobber admin-tuned caps.

Pricing is authoritative on the server: `pricing.quote()` applies `{ waivePlatformFee, waiveCommission }`, and the apps render only what the server produces (`frontend/lib/pricing.js` mirrors the 5% platform fee for display only and is explicitly labeled non-authoritative). Because requests and orders are quoted with standard commission before a driver is known, the founding-partner waiver is resolved at assignment time against the actual winning driver, and the partner split is recomputed and persisted (in `DispatchManager` for instant, and in `assignDriver` for scheduled). Two self-heals guard the denormalized counters: `grantDriverWaiver` re-syncs the `User` field on re-approval, and `reserveFreeBooking` reconstructs from the `PromoGrant` ledger if the `User` counter was never written. Free-booking perks are reserved atomically at booking (the decrement is the spend) and restored idempotently via a one-way `feeWaiverRestored` flag when a booking ends without completing. The offers work also hardened cancellation: `cancelOrder` was rewritten to be atomic and status-guarded, fixing a pre-existing TOCTOU race and a latent crash on `pricing.refundAmount`.

### Payments

There is one Razorpay wrapper (`services/payments.js`): create order, refund, and timing-safe HMAC signature verification for both Checkout payloads and webhooks. **Money is collected at completion, never upfront** (cash or UPI at the door), on both flows. This removes advance and stage-refund complexity; cancellations usually have nothing to refund. UPI-at-the-door is collected via on-demand Razorpay order creation at delivery, with `markOrderPaid` / `markRequestPaid` idempotent via an `unpaid` guard shared by the client-verify endpoint and the webhook, and both emit a `PAYMENT_RECEIVED` event to the assigned driver. The webhook is mounted with a raw body before `express.json()` and routes `payment.captured` to either a `DeliveryRequest` or an `Order`. The Razorpay client is built lazily, so the server boots cash-only without keys (online endpoints return 503 instead of crashing). Refunds are race-safe: `refundOnline()` atomically flips `paymentStatus` `paid -> refunded` before hitting the gateway, so concurrent cancel / give-up / sweep paths can never double-refund; a gateway failure releases the claim for retry.

Because nobody pre-pays, abuse is deterred with accountability counters rather than charges. Cancelling after a driver commits, or a verified no-show, increments `cancelStrikes`; at 3 strikes the customer is booking-blocked for 3 days (enforced at both `Order` and `DeliveryRequest` creation) and the counter resets. A customer no-show in the instant flow is a gated terminal action: the driver must have been arrived for `NO_SHOW_WAIT_MS` (5 minutes) **and** be within roughly 150m of the drop (live GPS), with a structured `noShowReport` (reason, `callAttempted`, driver coordinates) captured for dispute resolution. A prepaid customer is refunded the fare minus a flat dry-run fee (default Rs. 50), which compensates the driver for the wasted trip.

### Privacy and compliance

Compliance is a first-class concern, not a bolt-on.

- **Consent logging.** `ConsentLog` is an append-only DPDP Act 2023 ledger: immutable, one row per event, capturing `purpose`, `action` (granted/withdrawn), `role`, `policyVersion` (`'2026-06-07'`), documents, `ageConfirmed` (18+), and nullable IP / truncated user-agent as evidence. Logging is best-effort so a hiccup never breaks signup, but failures are logged loudly for reconciliation. On account erasure, the IP and user-agent (the only PII on the row) are scrubbed.
- **Field-level encryption.** PAN, driving-licence, and bank account numbers are encrypted at rest with AES-256-GCM (random 96-bit IV per value, authenticated), stored as `enc:v1:<base64(iv|tag|ciphertext)>`. The version prefix lets legacy plaintext pass through transparently; decryption fails closed (returns `''`) on a wrong key or tamper; and the server refuses to boot without `FIELD_ENCRYPTION_KEY` so it never silently stores plaintext. A `scrubSensitive()` helper strips ciphertext from generic payloads, and decrypted identifiers surface only via dedicated KYC/bank endpoints.
- **Account deletion.** `DELETE /auth/me` implements DPDP s.12 erasure: it refuses mid-delivery, purges KYC docs from private storage, revokes sessions, deletes addresses, and scrubs PII from retained transactional `Order` / `DeliveryRequest` / ticket records while anonymizing the `User` to a tombstone email. Erasure is a soft delete: the row is retained only as an anonymised FK target and can never authenticate again. The same self-serve deletion exists on the customer Account page and in the partner app's Settings.
- **Consent-gated analytics.** On the web, `useConsentStore` persists only `{decided, categories}`. `Analytics.jsx` loads Microsoft Clarity and Google Analytics **only after** the analytics category is granted, never on `/admin`, and actively tears down and clears `_clck` / `_clsk` / `_ga*` cookies when consent is withdrawn mid-session. A first-visit `CookieConsent` banner offers Accept all / Reject non-essential / Customize.

The customer web app also carries the full legal surface (`/legal` plus Privacy, Terms, Refund & Cancellation, Shipping & Delivery, and Account & Data Deletion), with a single `constants/business.js` source of truth (GSTIN, sole-proprietorship legal entity, named Grievance Officer) built to clear DPDP, Consumer Protection (E-Commerce) Rules 2020, Play Store, and Razorpay onboarding checks.

### Real-time tracking

The customer tracking screen (`app/track/[id]/page.js` with `TrackMap.jsx`) joins a request room over a singleton Socket.IO client. Because WebSockets cannot ride the Next.js `/api` rewrite that proxies REST, the socket connects directly to `NEXT_PUBLIC_SOCKET_URL` (falling back to `NEXT_PUBLIC_API_URL`). The screen renders an immersive radar "searching" state, a Leaflet + OpenStreetMap map with a smoothly animated tanker marker (requestAnimationFrame lerp), an ETA and partner row, a UPI pay block, and dedicated full-screen end states (no-fulfiller, customer no-show with dry-run-fee refund copy, cancelled/expired, delivered receipt). The backend does not stream offer-round progress, so the "finding a tanker" wait runs a client-side 1s clock that escalates staged reassurance copy at 0/18/38/65s, resetting whenever the request re-enters searching. A "tracking paused" banner appears when the partner socket drops. Scheduled orders, which have no live GPS, render a faux SVG grid "map" on `status/[id]` instead of the real Leaflet map.

### The partner mobile app

KitUm Partner is built on Expo SDK ~54 / React Native 0.81.5 / React 19, with React Navigation v7, Socket.IO, and persisted Zustand auth. The architectural spine is a **single `DriverSessionProvider`** that owns all session state plus the entire realtime / dispatch / location / alarm / offline-journal / payment-gate engine; screens are thin `useDriverSession()` consumers. It boots on auth (loads profile, registers for push, recovers any active job, fetches history), wires all socket listeners, and exposes the actions (`toggleOnline`, `acceptOffer`/`rejectOffer`, `advance`, `abandonJob`, `reportNoShow`, `handleLogout`). Long-lived socket listeners read latest state via refs, `advance()` is re-entry-guarded by an `advancingRef` Set keyed by `requestId:status`, and `endJobLocal()` nulls `jobRef` synchronously to no-op duplicate end events in the same tick. Live-delivery screens (`ActiveJob`, `IncomingRequest`) render as absolute-fill takeovers over the tab navigator, driven by session state rather than routed, so an offer or active job seizes the whole screen regardless of the current tab.

The driver lifecycle is end-to-end in-app: a cobalt landing, a 3-step apply-to-join (camera-only selfie, details, tanker capacity, gated by an 18+ DPDP consent checkbox) or sign-in, then KYC (PAN + DL) and settlement (bank or UPI) before going online. A partner cannot go online until the application is approved and KYC is admin-verified; this is server-authoritative, mirrored client-side as a `canGoOnline` gate, with a server `not_eligible` socket error that forces offline. Once online, offers arrive over Socket.IO and seize the screen as an absolute-fill takeover (`IncomingRequest.js`) with a looping alarm (RN Vibration plus best-effort `expo-audio`) and an auto-rejecting countdown driven by `offer.expiresAt`. The driver then drives an `ActiveJob` (assigned -> en route -> arrived -> completed) with a UPI payment gate (the Complete button is disabled until a `payment:received` event arrives) and a customer-no-show flow (5-minute wait plus a required call attempt before a server-validated report). Vehicle and tanker capacity are locked after registration and changed only via a pre-filled support ticket.

Several mobile-specific engineering choices stand out:

- **Offline-durable job status.** `lib/jobSync.js` is a write-ahead journal: every transition is persisted to AsyncStorage before the UI advances, then flushed in strict oldest-first order via socket-ack-then-REST-mirror, dropping only on server-confirmed done/dead, and re-triggered on socket reconnect and app foreground. In-order flushing is required because the backend's sequence guard needs each step's exact prior state. It is purpose-built for Shillong's hilly low-signal terrain so a "Complete delivery" tap is never silently lost, with an 18s deliver deadline (above the 15s REST timeout) so the flush loop cannot wedge.
- **Battery-aware location.** `lib/location.js` uses dual profiles: IDLE (250m/45s, Balanced) while waiting, ACTIVE (30m/4s, High) during a job, plus a background TaskManager task with an Android foreground service. It detects Expo Go (`executionEnvironment === 'storeClient'`) and skips background-location calls that would crash iOS natively there.
- **Backgrounded-app alerting.** Offers ride a versioned, MAX-importance, DnD-bypassing Android notification channel (`offers-v2`, versioned because Android locks a channel's sound and importance once created) routed through the alarm audio stream, woken by an Expo push token, with a 45s TTL so a delayed push never rings after the ~20s offer window. The push token requires the EAS `projectId` or none is issued.

The app was redesigned to a glass-UI aesthetic on a `#0037B0` cobalt brand with app-wide Inter (loaded as 5 separate weight files and applied via a `Text`/`TextInput` render patch that maps `fontWeight` to the matching Inter variant, because RN cannot synthesize weights, clearing the numeric weight to avoid Android double-bolding) and skeleton loaders that mirror real content so screens never flash empty. Native modules (`expo-linear-gradient`, `react-native-svg`) are lazy-required with graceful fallbacks (gradient to solid color, SVG ring to linear bar). The shell composes `GestureHandlerRootView` -> `KeyboardProvider` -> `SafeAreaProvider` -> `DriverSessionProvider`. It ships via EAS Build (internal APK for dev/preview, AAB with autoIncrement for production) to Google Play, pointing at `api.kitum.online`.

### The admin console

The admin console (`frontend/app/admin/`) is a "use client" surface mounted inside the customer web app, sharing the same axios layer and design tokens but running on a completely separate, persisted auth session. Several pieces are load-bearing:

- **Separate auth store.** The admin session lives in its own zustand persist key (`admin-auth`), distinct from the customer `auth` key. `activeAuthStore()` routes the shared axios interceptor and silent refresh by checking whether the path starts with `/admin`, so an admin and a customer in the same browser never collide. The store comment notes this collision "previously caused refresh-token reuse -> forced logout on reload."
- **Hydration-gated guard.** `AdminLayout` waits for `useAdminAuthStore.persist.onFinishHydration` before running its role guard, fixing a bug where the null server snapshot on first client render would bounce a logged-in admin to `/admin/login`.
- **Best-fit assignment modal.** `AssignDriverModal.jsx` shows ranked suggestions with a percent match and a plain-English "why" (home zone / serves area / delivered here before / right-sized / free this slot), computed from the backend scorer's component breakdown, with a TOP PICK tag on the first result. Suggestions come from `bestFit.selectBestDriver(order, { phase: 'A' })`, plus an `allActive` manual-fallback list and a reason (`not_a_tanker_order`, `unknown_locality`) when no best-fit match exists.
- **Guarded assignment.** Assigning a partner is atomic: `Order.findOneAndUpdate` filters `status $nin ['delivered','cancelled']` and returns 409 ("Order changed, please retry") on conflict, recomputes the founding-partner commission split, and best-effort Expo-push-notifies the partner.
- **KYC review.** The reviewer loads short-lived presigned GET URLs for PAN / DL-front / DL-back from a private bucket, decrypts `panNumber` / `dlNumber` / bank `accountNumber` for settlement details, blocks verification unless all three document keys are present, and forces `fulfillerProfile.isOnline = false` on rejection. It warns when storage is unconfigured rather than showing broken images.
- **Campaigns, slots, reviews, support.** Admins tune campaign caps, windows, and benefits with no redeploy (plus a one-click idempotent seed), manually enroll or revoke grants by email, manage a 7-day x Morning/Afternoon/Evening capacity grid, moderate reviews with a publish/hide toggle, and work a support inbox rendered as a chat thread (with a "Partner" chip on fulfiller-authored tickets). The Partners nav item carries a live pending-application count badge.

### PWA and design system

The customer app is an installable PWA via `@serwist/next`: a `manifest.json` (standalone, theme `#263cf2`, "Order Water" and "My Orders" app shortcuts) and a custom `sw.js` with tuned per-route caching. Products use StaleWhileRevalidate (24h) for offline browsing, but slots use NetworkFirst (5 minute TTL, 5s network timeout) because stale slot data causes booking errors; the service worker is disabled in dev to avoid caching pain. The design system (in `tailwind.config.js`) is a cobalt-on-off-white token set: primary cobalt `#0037b0` (hover `#002d8c`), accent sky `#0ea5e9`, layered text tokens (`text-main #131b2e`, `text-body #434655`, `text-muted #64748b`), tinted backgrounds (`bg-page #faf8ff`, `bg-card #f2f3ff`, `bg-trust #eff6ff`), and named radii (card 16px, btn 12px, input 8px, chip 999px), with Inter for body and Plus Jakarta Sans for display.

Location selection is a two-step funnel: a `LocationModal` bottom sheet (GPS or a searchable list of 50+ Shillong localities) that always finishes on a full Leaflet/OSM `MapPicker` (fixed centre pin, reverse-geocoded centre, Google Places autocomplete with OSM Nominatim fallback), used in three modes (`home`, `select`, `save`). Leaflet plus raster OSM tiles were chosen for both the picker and live tracking because they are tokenless, bundled, and more robust than WebGL Mapbox GL; Google is reserved for geocoding and autocomplete where its local data matters, and Plus Codes are stripped from reverse-geocoded addresses. The axios layer (`lib/api.js`) runs against a relative `/api` base proxied by a Next rewrite, attaches the active area's token, does a single silent refresh-and-retry on 401, and (importantly) never bounces anonymous browsers to login. A single-flight refresh promise (`lib/auth.js`), shared by axios and the socket, prevents concurrent 401s from stampeding the refresh endpoint, and `lib/productImage.js` defines one `isTankerProduct` rule (positive `tankerLitres` or `/tanker/i` in the name) so categorisation and image selection can never disagree.

## The Build Journey

KITUM's git history (~24 commits, 2026-04-08 to 2026-06-09) traces three phases. The first authors were Balajied Sungoh (with Claude Sonnet 4.6); webgaurav02 (with Sonnet 4.6, then Claude Opus 4.8) drove Phase 3.

**Phase 1 (Apr 8, all in one day): foundations and rapid pivots.** The initial commit (`508233b`) scaffolded a slot-based delivery PWA under the brand "Shillong Water," with OTP auth and the `User` / `Order` / `Product` / `SlotConfig` / `OtpVerification` models. The same day brought a Vercel serverless wrapper, atomic slot booking, deferred UPI reservation, an idempotent webhook, and a "KIT UM" rename (`1b15d30`), an admin OTP login briefly added (`8587abe`) then a wholesale swap of OTP for email/password (`aedca78`), and a path for passwordless OTP accounts to set a password on signup (`8c9c4b7`).

**Phase 2 (Apr 11 to May 1): UI and brand iteration.** Two UI rebuilds in which the brand name actually oscillated: a "shg water" rebuild (`079b8fb`, 16px radius, blue `#0047AB`) and a Figma "Shillong Water" home redesign (`a1d8c2b`, Plus Jakarta Sans, brand color `#0037b0`, bottom nav trimmed to 3 tabs). The name was renamed and reverted several times (Shillong Water to KIT UM to shg water to Shillong Water) before standardizing on "KitUm" as a registered trade name at HEAD.

**Phase 3 (Jun 5 to Jun 9): the heavy lift.** The commit "So many things haha" (`2834503`) is the platform's true second birth: in one mega-commit it added the `DeliveryRequest` model, the Socket.IO realtime layer, the `DispatchManager` scaffolding, the fulfiller/review/support/address controllers, the `RefreshToken` model, rate-limit/upload/validate middleware, the scheduled-assignment migration, the GitHub Actions deploy workflow, `BEFORE_LIVE.md`, and the entire Expo partner app.

What followed was a cluster of mobile-launch firefights and hardening:

- **The APK-crash saga.** The Android APK crashed on launch because SDK-56 packages were bleeding transitively into the SDK-54 Expo app. The fix (`c874345`) was dependency surgery rather than guesswork: a `package.json` `overrides` block pinning `expo-asset` to `~12.0.13` and `expo-font` to `~14.0.12` to force SDK-54-compatible versions deterministically.
- **Edge-to-edge and keyboard work.** Two passes fixed Android edge-to-edge safe areas and keyboard-covered inputs: safe-area insets plus keyboard avoidance across ~14 screens (`179733e`), then `react-native-keyboard-controller`'s `KeyboardAwareScrollView` for a premium glide-above-keyboard feel (`13e905c`, reinforced in `56c3820`).
- **The secret-scanning incident.** A Mapbox token had been committed to `fulfiller/eas.json`. It was scrubbed from git history, not merely deleted going forward: the three token-bearing blobs and their parent commits are now dangling and unreachable from any ref (the fingerprint of a `filter-repo`/`filter-branch` rewrite, confirmed via `git fsck` and `rev-list`). The live `eas.json` carries only `api.kitum.online` env URLs and no token, and rotating the shared keys remains a tracked launch-blocker in `BEFORE_LIVE.md`.
- **The redesigns.** A premium partner glass UI with Inter, onboarding, and skeletons plus the field-encryption service and a KYC/bank encryption migration that made `index.js` require `FIELD_ENCRYPTION_KEY` (`56c3820`), and a customer home redesign with the cached availability snapshot, self-serve campaign seeding, and the `ConsentLog` model (`c5c867a`).
- **Launch offers and distribution.** The server-authoritative offers system (`8fc6409`); a `/partner` APK-download landing page ("Your Tanker. Your Schedule. Your Money.") serving the ~95 MB APK directly from the web app's `public/` (`d3f65b5`); seamless guest auth (`0e83379`); the merge of PR #1 (`10501fb`); and consent-gated Clarity/GA4 with a cookie banner (`6ebc1b8`).

## Deployment and Infrastructure

KITUM runs three deployable surfaces plus a shared MongoDB Atlas database, and the backend deployment topology has one subtlety worth stating plainly: **the backend is not deployed from the monorepo.**

```
monorepo backend/src/  --rsync (code-only, byte-identical)-->  standalone repo
(github.com/balajied29/KITUM)        diff -rq = 0 diffs        webgaurav02/kitum
                                                                      |
                                                          push to main triggers
                                                          GitHub Actions (OIDC)
                                                          azure/webapps-deploy@v3
                                                                      |
                                                                      v
   customer PWA ---> Vercel                          Azure App Service "kitum-api"
   partner app  ---> EAS Build -> Google Play         (Basic B1, Linux, single instance)
                     (com.webgaurav02.kitum)           Always On + Web Sockets + /health
                                                        api.kitum.online -> *.azurewebsites.net
                                                                      |
                                            all three surfaces -------+--> MongoDB Atlas
```

The standalone repo `webgaurav02/kitum` is a backend-only copy whose `src/` is a byte-identical rsync of the monorepo's `backend/src/` (verified, `diff -rq` reports zero differences). It deliberately omits the monorepo's `railway.json` and `ecosystem.config.js` (alternate-host artifacts), and `.env` is gitignored. Every push to its `main` branch triggers `.github/workflows/main_kitum-api.yml`, which checks out the repo, runs `setup-node` (24.x), installs and optionally builds/tests, uploads the repo as a `node-app` artifact, and runs `azure/webapps-deploy@v3` to App Service `kitum-api`, slot Production. Authentication is OIDC federated (no stored publish profile or password) using three auto-generated secrets (`AZUREAPPSERVICE_CLIENTID/TENANTID/SUBSCRIPTIONID`).

The host must be Basic B1 (~$13/mo) or higher in Central India with Always On and Web Sockets enabled, a `/health` healthcheck, and a single instance. Free F1 is explicitly rejected because it lacks Always On and WebSockets and its CPU quota would kill the in-process dispatch timers; horizontal scaling is held off until a Redis adapter replaces the in-memory dispatch state (tracked as `BEFORE_LIVE` B3). A Vercel serverless entrypoint (`backend/api/index.js`) exists but mounts the scheduled flow only; it deliberately omits `/api/requests` and `/api/fulfiller` because dispatch timers and Socket.IO cannot run serverless, and it is not the path live clients use.

Secrets are split by platform: `FIELD_ENCRYPTION_KEY`, `MONGO_URI`, `JWT_SECRET`, and the Razorpay/Mapbox/Google/Interakt/S3 keys live as Azure App Service environment variables (injected as `process.env`, no committed `.env`); `NEXT_PUBLIC_*` including `NEXT_PUBLIC_CLARITY_ID` live in the Vercel dashboard; and the backend URLs are baked into the EAS build via `eas.json` because EAS cloud builds do not see the gitignored fulfiller `.env`. `FIELD_ENCRYPTION_KEY` is one of three boot-required env vars (`REQUIRED_ENV = ['MONGO_URI','JWT_SECRET','FIELD_ENCRYPTION_KEY']`), so the app fails fast if it is missing. The partner app carries no Mapbox token at all (only `EXPO_PUBLIC_API_URL` / `EXPO_PUBLIC_SOCKET_URL`, both `https://api.kitum.online`); Mapbox Directions and ETA routing is computed server-side. Atlas must allowlist the App Service outbound IPs or the DB refuses connections.

One documentation caveat the dossier flags: the monorepo `README.md` and `docs/initial_architecture.md` still name Railway as the backend host. This is stale. The live target is Azure App Service per the standalone repo's workflow, README, and `deploy/DEPLOY.md` (the switch was made in a "Switch deploy target from VM to Azure App Service" commit).

## Engineering Lessons

- **Get the real stack trace before theorizing.** The APK crash was solved by identifying the exact SDK-56 transitive bleed and pinning two packages, not by chasing the dependency tree blind.
- **Pin transitive deps across Expo SDKs.** A `package.json` `overrides` block (`expo-asset ~12.0.13`, `expo-font ~14.0.12`) is the deterministic lever when a newer SDK leaks in transitively.
- **Make the database the safety net, not the UI.** Every state transition is an atomic, guarded `findOneAndUpdate` on the exact expected prior status, so double-assignment, double-refund, and double-complete are structurally impossible regardless of timer or client state.
- **Let scoring components abstain.** Returning `null` and renormalizing avoids the classic bug where a missing signal becomes worst-case and silently sinks a good driver.
- **Keep offers server-authoritative.** Atomic `$inc` guarded by `claimed < cap` plus a unique `{campaignKey, user}` grant makes caps un-overrun-able; apps render only what the server quotes.
- **Consent-gate analytics.** Load no third-party measurement before explicit opt-in, tear it down and clear cookies on withdrawal, and never run trackers on `/admin`.
- **Never commit secrets; use EAS secrets and scrub history.** A leaked token is not fixed by deleting it going forward; rewrite history and rotate the key.
- **Fail soft on integrations, fail closed on security.** Razorpay, maps, push, WhatsApp, email, and S3 all degrade gracefully without keys; field encryption and refresh rotation are strict and refuse to boot or decrypt on failure.
- **Isolate auth state per surface.** Separate persisted zustand stores for admin and customer (selected by URL prefix) fixed refresh-token reuse forcing logouts when both were used in one browser.
- **Write-ahead durable journals for flaky networks.** Persisting a job transition before the UI advances, then flushing in strict order, is what keeps a "Complete delivery" tap from being lost on Shillong's hilly low-signal terrain.

## Roadmap / What's Next

Only items the dossier supports:

- **Guest re-auth hardening.** The `/auth/quick` passwordless flow is phone-only with no OTP today; the code comment flags gating it behind OTP or Truecaller before holding anything sensitive at scale.
- **Scheduled driver assignment, fully realized.** The two-phase best-fit scorer exists and powers admin decision-support, but the broader scheduled auto-assignment design is noted as not yet built. The scheduled-assignment migration also deliberately does not backfill `Order.deliveryPoint` because retroactive geocoding is unreliable.
- **Horizontal scale via Redis.** Dispatch timers, offer state, and socket rooms are process-local; a code comment pins deployment to a single replica until a Redis adapter and distributed timers land. App Service is correspondingly capped at one instance (tracked as `BEFORE_LIVE` B3).
- **Launch-blockers.** `BEFORE_LIVE.md` lists rotating the Atlas/Mapbox/Google keys (shared in chat / previously committed) as a red launch-blocker.

## Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Backend runtime | Node.js >= 18, Express 4.19 | Native `fetch`; single persistent host |
| Real-time | Socket.IO 4.8 | Shared HTTP server; in-process dispatch state |
| Data | MongoDB Atlas, Mongoose 8.3 | 13 models; 2dsphere `$near`; TTL indexes |
| Auth | jsonwebtoken 9, opaque refresh tokens | ~15m access JWT; rotating HMAC-hashed refresh, theft detection |
| Security | Node `crypto` (AES-256-GCM, HMAC-SHA256, timingSafeEqual) | Field encryption fails closed; boot requires `FIELD_ENCRYPTION_KEY` |
| Payments | Razorpay 2.9 | Pay-at-door (cash/UPI); lazy client; idempotent webhook |
| Geo | Google Geocoding, Mapbox Directions | Hybrid, fail-soft; haversine fallback; server-side ETA |
| Storage | AWS SDK v3 S3 + presigner (S3 / Cloudflare R2) | Private KYC bucket; admin-only presigned GETs |
| Notifications | Expo Server SDK, Interakt WhatsApp, Nodemailer | All fail-soft; loud `offers-v2` push channel |
| Customer web | Next.js 14.2, React 18, Tailwind 3.4, zustand 4.5 | App Router PWA via `@serwist/next`; Leaflet + OSM |
| Admin | Next.js 14 (under `/admin`) | Separate persisted auth store; `protect + adminOnly` |
| Partner app | Expo SDK ~54, React Native 0.81.5, React 19 | React Navigation v7; `DriverSessionProvider`; Inter font |
| Analytics | Microsoft Clarity, optional GA4 | Consent-gated, env-driven, never on `/admin` |
| Backend host | Azure App Service B1 (Linux) | Always On + Web Sockets; single instance; `api.kitum.online` |
| Web host | Vercel | Next default build; `NEXT_PUBLIC_*` in dashboard |
| Partner distribution | EAS Build -> Google Play | `com.webgaurav02.kitum`; APK preview / AAB production |
| CI/CD | GitHub Actions, OIDC | `azure/webapps-deploy@v3` from standalone repo |

