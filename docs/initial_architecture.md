# KITUM — Real-Time Water Tanker Dispatch (ride-hailing model)

## Context
KITUM (brand: *Shillong Water*) currently is a **scheduled, slot-based** water-delivery PWA:
- `frontend/` — Next.js 14 App Router PWA (Serwist), Tailwind, Zustand, Axios, Razorpay.
- `backend/` — Express + Mongoose (MongoDB), JWT auth, Nodemailer, Razorpay, WhatsApp (Interakt). Deploy configs for both Railway (persistent) and Vercel (serverless).
- Models: `User` (roles `customer|admin|driver`), `Order` (already has `driverAssigned`, `statusLog`), `Product` (`unit` already supports `"1000L"`), `SlotConfig`, `OtpVerification`.

The user wants to add an **Uber-style instant dispatch** flow on top of the existing scheduled flow:
- Customer picks a tanker size (1000L, 2000L, …) and requests delivery **now**.
- Nearest available fulfiller (tanker) is offered the job → accept/reject → on reject/timeout, **broadcast to the next 5 best** fulfillers (first-to-accept wins).
- Live tanker location, heavy real-time notifications + alarms, seamless UX both sides.
- New **fulfiller mobile app** (Expo / React Native).

Goal: cost-efficient, easy-to-deploy, launchable in ~1 week.

---

## Locked decisions
1. **Both order types coexist.** Existing slot flow stays; add a parallel **"Order Now"** instant flow + new `DeliveryRequest` model. Existing `Order`/`SlotConfig`/slot UI are untouched.
2. **Hybrid maps:** **Google Places/Geocoding** for address autocomplete + text→coords (regional accuracy). **Mapbox** for all map rendering, live-tracking UI, and ETA/Directions/Matrix routing. Google coords → Mapbox components.
3. **Fulfiller app = Expo (React Native).** Same JS/TS stack → reuse Socket.IO client, axios, zustand. EAS cloud builds (no local Xcode/Android Studio). Expo Push for free push.

---

## Architecture & hosting (cost-efficient + easy deploy)
| Piece | Tech | Host | Cost |
|---|---|---|---|
| Backend (REST + **Socket.IO** + dispatch engine) | Express + `socket.io` | **Railway** (persistent Node — required for WebSockets; `railway.json` already present) | Hobby ~free/$5 |
| Database | MongoDB + Mongoose, `2dsphere` geo index | **MongoDB Atlas M0** | Free |
| Customer app | Next.js PWA (existing) + Mapbox GL JS | **Vercel** | Free |
| Fulfiller app | Expo RN, `expo-location`, `expo-notifications`, `expo-av` | **EAS Build** + **Expo Push** | Free tier |
| Maps/geo | Google Places+Geocoding, Mapbox GL + Directions/Matrix | API keys | Within free tiers for launch |

**Realtime transport = Socket.IO** (auto-reconnect, rooms, JWT handshake, fallbacks). The Vercel serverless `backend/api/index.js` **cannot** hold WebSocket connections — instant features run only on the persistent Railway server. Keep Vercel config as-is for non-realtime if desired, but point both apps' socket + API at the Railway URL.

**Dispatch/location state = in-memory on a single backend instance** for launch (cheapest, fine for one city). Code behind small seams (candidate provider / notifier / timer store) so **Upstash Redis + socket.io-redis-adapter** can be dropped in later for multi-instance scale. A startup recovery sweep re-queues any `searching` requests after a restart.

---

## Repo structure (lightweight monorepo — no Nx/Turbo)
```
KITUM/
  backend/      Express + Socket.IO + dispatch engine   → Railway
  frontend/     Next.js customer PWA (+ instant flow, Mapbox tracking) → Vercel
  fulfiller/    NEW — Expo React Native app              → EAS / Expo Push
  shared/       NEW — plain-JS contract: socket event names, status enums, tanker sizes
  package.json  root concurrently (add dev:fulfiller)
```
`shared/constants.js` keeps the socket-event names + status enums in one place; imported by backend & frontend, copied/symlinked into fulfiller (Expo) to avoid heavy workspace config.

---

## Backend changes

### Models
- **`User.model.js`** — add `'fulfiller'` to role enum + embedded `fulfillerProfile`:
  `{ vehicleNumber, capacityLitres (or [sizes]), isOnline, isAvailable, currentLocation: {type:'Point', coordinates:[lng,lat]}, lastLocationAt, expoPushToken, rating, ratingCount, currentRequestId }`.
  Add `2dsphere` index on `fulfillerProfile.currentLocation`.
- **NEW `DeliveryRequest.model.js`** (instant trip, distinct from scheduled `Order`):
  `{ customerId, productId (tanker size, reuse Product), quantity, dropLocation:{type:'Point',coordinates,address,landmark,phone}, status, fulfillerId, offers:[{fulfillerId, sentAt, outcome}], pricing:{amount,distanceKm,etaMin}, paymentMode, paymentStatus, statusLog (reuse pattern), ratings, timestamps }`.
  Status enum: `searching → driver_assigned → en_route → arrived → completed` plus `cancelled | expired | no_fulfiller`.
- **`Product`** — reuse for tanker sizes; seed 1000L/2000L/… products (`unit` field already fits). Extend `backend/src/seeds/products.js`.

### Dispatch engine — `backend/src/services/dispatch/DispatchManager.js` (the core)
Server-authoritative offer state machine, in-memory timers:
1. Customer POSTs instant request → create `DeliveryRequest{status:searching}` → hand to DispatchManager.
2. **Candidate selection:** Mongo `$near` (2dsphere) over `online && available && capacity matches`, expanding radius `5→10→15 km`; rank by distance (haversine v1). Mapbox Directions used only for the *chosen* fulfiller's ETA (saves API calls).
3. **Stage 1 — nearest-first:** offer to single best with a **~20s countdown** (Socket `offer:new` + Expo Push). Accept → assign; reject/timeout → Stage 2.
4. **Stage 2 — broadcast next 5:** offer simultaneously to next 5; **first-to-accept wins**. Losers get `offer:closed{reason:'taken'}`.
5. No takers → expand radius / repeat up to max attempts → `no_fulfiller`; notify customer with "schedule instead" fallback.
6. **Atomicity:** winner decided by `DeliveryRequest.findOneAndUpdate({_id,status:'searching'},{status:'driver_assigned',fulfillerId})`; fulfiller flipped `isAvailable:false` atomically; guard against double-offering one fulfiller.
7. Per-offer `setTimeout`s in a timer registry; restart recovery sweep.

### Socket layer — `backend/src/realtime/`
- `io.js` — Socket.IO server attached to the same HTTP server in `src/index.js`; **JWT handshake** (`socket.handshake.auth.token`) → attach user+role.
- Rooms: `user:<id>`, `fulfiller:<id>`, `request:<id>`.
- Handlers split into `customer.socket.js` / `fulfiller.socket.js`.

### REST additions — `backend/src/routes/request.routes.js` + `request.controller.js`
- `POST /api/requests` (create instant request), `GET /api/requests/:id`, `POST /api/requests/:id/cancel`, `POST /api/requests/:id/rate`.
- Geo helper `backend/src/services/geo.js`: Google Geocoding (server-side, key hidden) + Mapbox Directions/Matrix wrappers.
- Fulfiller mgmt (admin): create fulfiller accounts (extend `admin.controller.js`); fulfiller login reuses `auth.controller.js` with role check.

### Notifications — extend existing
- `services/push.js` — Expo Push (`expo-server-sdk`) for backgrounded apps; high-priority Android channel.
- `services/whatsapp.js` — add `fulfiller_assigned`, `fulfiller_arriving`, `delivery_completed` templates (reuse `sendTemplate`).
- Server emits to room **and** fires push in parallel; clients de-dupe. Offers always have a server timeout so a missed notification never deadlocks a request.

---

## Socket event contract (in `shared/constants.js`)
- **server→fulfiller:** `offer:new{requestId,size,drop,eta,distance,expiresAt}`, `offer:closed{requestId,reason}`, `job:assigned`, `job:cancelled`.
- **fulfiller→server:** `presence:set{online}`, `availability:set`, `location:update{lat,lng,heading,accuracy,speed}`, `offer:accept{requestId}`, `offer:reject{requestId}`, `job:status{requestId,status}`.
- **server→customer:** `request:status`, `request:assigned{fulfiller,vehicle,phone}`, `request:location{lat,lng,heading}`, `request:eta`, `request:completed`.
- **customer→server:** `request:cancel{requestId}`.

---

## Live-location strategy (battery + perf — fulfiller app)
State-driven sampling, sent over the **persistent socket** (never HTTP-per-ping):
- **Offline:** no updates.
- **Online + idle:** `watchPositionAsync({accuracy:Balanced, distanceInterval:250m, timeInterval:30–60s})`; emit only past threshold.
- **On active job:** `Accuracy.High, distanceInterval:25–50m, timeInterval:4–5s` via **background** `startLocationUpdatesAsync` + TaskManager + Android foreground service (keeps tracking when locked).
- **Server:** holds latest location in memory; **relays only into that request's room** (privacy + bandwidth), persists last-known to Mongo every ~15–30s for the `$near` fallback.
- **Customer map (Mapbox):** animate/interpolate marker between updates; refresh ETA via Mapbox Directions periodically (not per ping); drop low-accuracy fixes.

---

## Notifications & alarms (heavy comms — fulfiller side feels like Uber driver)
Layered, redundant:
1. **Socket (foreground, instant):** incoming `offer:new` → **full-screen takeover + looping alarm ringtone (`expo-av`) + vibration**; stops on accept/reject/timeout.
2. **Expo Push (backgrounded/killed):** high-priority dedicated Android channel w/ custom sound + `IMPORTANCE_HIGH`; iOS sound alert. Wakes a fulfiller with the app closed. Customer push for assigned/arriving/delivered.
3. **WhatsApp + email:** durable receipts/fallback (reuse Interakt + Nodemailer).

---

## Customer app (frontend) changes
- New **"Order Now"** entry on home alongside scheduled. New route `app/order/instant/page.js`: pick tanker size (reuse `getProducts` tanker filter) → confirm drop location (Google Places autocomplete; reuse `useLocationStore`) → COD/UPI → submit → live tracking screen `app/track/[id]/page.js` (Mapbox GL JS map, live tanker marker, ETA, fulfiller card, cancel).
- `lib/socket.js` — Socket.IO client (JWT auth, reconnect). `lib/maps.js` — Google Places + Mapbox GL helpers.
- Reuse: `lib/api.js`, `lib/store.js`, `AppHeader`, `BottomNav`, status patterns from `app/status/[id]/page.js`.

## Fulfiller app (`fulfiller/` — Expo)
- Screens: Login → Home (online/available toggle, today's earnings) → **Incoming Request** (full-screen alarm + accept/reject + countdown) → **Active Job** (Mapbox map, navigate, status buttons en_route→arrived→completed) → History.
- `lib/socket.js`, `lib/location.js` (state-driven sampler + background task), `lib/notifications.js` (Expo Push registration + alarm channel), `lib/api.js`, zustand store.
- EAS config + Expo Push token registration on login.

---

## Env / secrets to add
Backend `.env`: `MAPBOX_TOKEN`, `GOOGLE_MAPS_API_KEY` (server-side, restricted), `EXPO_ACCESS_TOKEN` (optional). Frontend: `NEXT_PUBLIC_API_URL`/`NEXT_PUBLIC_SOCKET_URL`, `NEXT_PUBLIC_MAPBOX_TOKEN`, `NEXT_PUBLIC_GOOGLE_MAPS_KEY`. Fulfiller: `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_SOCKET_URL`, `EXPO_PUBLIC_MAPBOX_TOKEN`. Update `backend/.env.example` + add `fulfiller/.env.example`.

---

## Build sequence (~1 week)
1. **Day 1 — Foundations:** add Socket.IO to backend (JWT handshake, rooms), `shared/constants.js`, `User.fulfillerProfile` + 2dsphere, `DeliveryRequest` model, seed tanker products, env scaffolding.
2. **Day 2 — Dispatch engine:** DispatchManager (candidate select, nearest-first→broadcast-5, atomic assign, timers), REST `request` routes, geo helpers (Google geocode + Mapbox ETA).
3. **Day 3 — Fulfiller app core:** Expo scaffold, login, socket, online/available, incoming-request alarm screen, accept/reject.
4. **Day 4 — Location + tracking:** state-driven location sampler + background task; server relay; customer live-track screen w/ Mapbox marker + ETA.
5. **Day 5 — Notifications:** Expo Push (register + send), Android alarm channel, customer/fulfiller push + WhatsApp templates; job lifecycle (en_route/arrived/completed) + ratings.
6. **Day 6 — Customer instant flow polish:** Order-Now screens, Google Places autocomplete, payment (COD + reuse Razorpay), admin fulfiller management.
7. **Day 7 — Deploy + harden:** Railway backend, Vercel frontend, EAS build; restart-recovery sweep; end-to-end test; cost/rate-limit review.

---

## Verification
- **Unit/local:** run `npm run dev` (frontend+backend); add `dev:fulfiller`. Seed tanker products + 2 fulfiller accounts.
- **Dispatch sim:** script/Postman to create a request; simulate 2–3 fulfiller sockets; assert nearest-first offer, reject→broadcast-5, first-accept-wins atomicity, timeout→next, no-taker→`no_fulfiller`.
- **Location:** fulfiller app on real device (Expo Go / dev build) moving → customer map marker + ETA update live; verify idle vs active sampling rates; background tracking with screen locked.
- **Alarms/push:** trigger offer with fulfiller app foregrounded (alarm) and backgrounded/killed (push wakes it).
- **E2E happy path:** customer Order-Now → fulfiller accepts → en_route → arrived → completed → both ratings; WhatsApp/email/push fire; record persists in Mongo.
- **Deploy smoke:** Railway URL socket handshake from deployed frontend + EAS build install.

## Notes / scale path (post-launch)
- Single backend instance + in-memory dispatch is the launch tradeoff. Scale path: Upstash Redis + `socket.io-redis-adapter` + BullMQ for offer timers; Mapbox Map-Matching for snap-to-road; surge/zone pricing; fulfiller payout ledger.
