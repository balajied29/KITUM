# KITUM — Before You Go Live

Status: the instant-dispatch system is **functionally complete and E2E-verified** (nearest-first
offer → broadcast → atomic accept → live tracking → lifecycle). This doc is everything between
"works on my machine" and "safe to take real customers + money".

Effort key: **S** ≤ half day · **M** ~1–2 days · **L** ~3+ days.
Priority: **P0** = block launch · **P1** = within first weeks · **P2** = scale/growth.

---

## A. Go-live setup checklist (operational)
- [x] `npm install` in `backend/` and `frontend/`. ⬜ Still: `cd fulfiller && npx expo install`.
- [x] Env files created for **dev**: `backend/.env`, `frontend/.env.local`, `fulfiller/.env` (Atlas + Mapbox + Google wired, verified live). For **prod**, set the same vars in Railway/Vercel dashboards.
- [ ] 🔴 **Restrict + rotate the API keys.** The Atlas password, Mapbox token, and Google key were shared in chat — **rotate them before production**. Then: Google → HTTP-referrer (browser key) + IP (server key), enable only Geocoding/Places/Maps JS; Mapbox → URL-restricted token; Atlas → DB user + Network Access allowlist. Set **billing budget alerts + quotas** (the #1 way to get a surprise bill).
- [x] Seeded **Atlas** (`kitum` db) with catalogue + admin + 3 demo fulfillers. ⬜ Set real tanker prices.
- [x] `fulfiller/.env` set to LAN IP `192.168.1.4` (auto-detected) — update if your network changes.
- [ ] Add `fulfiller/assets/alarm.wav` (short, loud, looping) — used by the Android "offers" channel + in-app alarm. Without it you get default sound + vibration only.
- [ ] Create + **get approved** the Interakt WhatsApp templates: `fulfiller_assigned`, `fulfiller_arriving`, `delivery_completed` (and the existing `order_*`). Approval takes time — start early.
- [ ] Set `app.json → expo.extra.eas.projectId` (run `eas build:configure`) so push tokens work.
- [x] Razorpay test keys in `backend/.env` (verified live: UPI order + signature flow work).
- [ ] **Register the Razorpay webhook** (Dashboard → Settings → Webhooks): URL = `https://<your-railway-domain>/api/payments/webhook`, events `payment.captured` + `payment.failed`, secret = the **exact** `RAZORPAY_WEBHOOK_SECRET` in your env. (Dev uses the verify endpoint, so the webhook only matters once deployed.) Switch test→live keys for production.
- [ ] Deploy: backend → Railway (set all env vars + `CLIENT_URL`), frontend → Vercel (point at Railway URL), fulfiller → `eas build`.
- [ ] ⚠️ **Pin the Railway backend to 1 instance** (no autoscaling) until Redis is added — see P0 below.

---

## B. P0 — Must do before real customers/money

### B1. Instant payments (COD + Razorpay UPI) — ✅ DONE
> Built + verified against Razorpay's live test API. **COD** dispatches immediately, auto-marked paid on completion. **UPI** creates a `pending_payment` request + Razorpay order, and only dispatches after payment is confirmed via **both** a signature-verified `/payments/requests/verify` endpoint (instant, works without a public webhook) **and** the `payment.captured` webhook (prod backstop) — funnelled through one **idempotent atomic** transition so neither double-dispatches. **Refunds** auto-issue on `no_fulfiller` and on cancel-after-pay. Server still boots cash-only if keys are absent (lazy `services/payments.js`).
> Files: `services/payments.js`, `request.controller.js`, `payment.controller.js`, `DispatchManager.js`, `payment.routes.js`, frontend `order/instant` + `track/[id]`.
> **Still TODO:** document **who collects COD cash**, and add the **payout/commission ledger** (B2).

### B2. Fulfiller settlement ledger — **M**
There is currently no record of what each fulfiller is owed/paid.
- New `Payout`/`LedgerEntry` model: per completed request, record gross, commission %, net to fulfiller.
- Admin view to mark payouts settled. Without this you can't actually pay your drivers.

### B3. Single-instance lock (or Redis) — ✅ DONE (the S part) / L later
> Pinned `numReplicas: 1` + `healthcheckPath` in `railway.json`; loud SCALE NOTE in `DispatchManager.js`. The Redis/BullMQ rework remains for horizontal scale.

Dispatch timers, offer state, and socket rooms live **in-process**. With 2+ backend instances it breaks.
- **Now (S):** pin Railway to 1 replica; add `// SCALE NOTE` and a startup guard.
- **Later (L):** `@socket.io/redis-adapter` + Upstash Redis for rooms; move offer/timer state to Redis (or BullMQ delayed jobs) + a distributed claim lock. Already designed behind seams (`registry.js`, `emit.js`).

### B4. Input validation + rate limiting — ✅ DONE
> `helmet` + `trust proxy` in `index.js`; `authLimiter` (20/15min) on `/auth/*`, `requestLimiter` (10/min) on `POST /requests`; express-validator chains on auth + request bodies; `location:update` socket flood guard (1s floor + coord sanity). Deliberately skipped `normalizeEmail()` (mutates input, can break existing logins).

New routes trust the body and have no throttle.
- `express-validator` (already a dep) on `POST /requests`, `/auth/*`, `/fulfiller/*`.
- `express-rate-limit` on `/auth/login`, `/auth/register`, `POST /requests` (prevent request spam / brute force).
- Throttle/validate inbound socket events (`location:update` flood, malformed payloads). Add `helmet`.

### B5. Fulfiller disconnect & abandonment handling — ✅ DONE
> Built + verified live. **Idle disconnect** → grace timer → mark offline (reconnect cancels it). **On-job disconnect** → customer sees "tracking paused" (`request:tracking live:false`) → abandon timer → **auto-abandon + re-dispatch** (excluding that fulfiller) so the customer is never stranded; reconnect resumes. **Explicit abandon** (`job:abandon`, "release job" button) does the same. **Connection-aware offering**: candidates sorted connected-first (`isFulfillerConnected`) so a dead nearest app doesn't burn a round. **Backstop sweep** finalizes `searching` requests stranded by a crash and expires abandoned UPI checkouts. Fulfiller app re-asserts presence + reconciles a lost job on reconnect. All timers env-tunable.
> Files: `DispatchManager.js` (disconnect/reconnect/abandon/re-dispatch + sweep), `fulfiller.socket.js`, `emit.js` (`leaveRoom`), fulfiller `App.js` + `ActiveJob.js`, frontend `track/[id]`, constants (`JOB_ABANDON`, `REQUEST_TRACKING`).

### B6. Ops hardening — ✅ DONE
> Implemented: `/health` (DB ping), boot-time env validation, graceful SIGTERM/SIGINT shutdown, lazy Razorpay (server now boots cash-only). Still TODO: **Sentry** error tracking + structured logging.
- `/health` endpoint with a DB ping (Railway healthcheck) — separate from `/`.
- **Boot-time env validation** (fail fast if `MONGO_URI`/`JWT_SECRET` missing) instead of crashing deep in a controller (e.g. the Razorpay-key crash you'd hit today).
- **Graceful shutdown** on `SIGTERM` (Railway redeploys): stop accepting, flush sockets, close Mongo.
- Error tracking (**Sentry** on backend + both apps) and structured logging (replace `console.*`).

### B8. Auth hardening — 🟡 PARTIAL (password reset + refresh rotation done)
> Done: **short-lived access tokens (~15m) + rotating refresh tokens** with **reuse detection** (replaying a revoked token burns the family); silent refresh on 401 in both apps + socket handshake recovery; **password reset via email link** (`/forgot-password` → `/reset-password`, signs you back in, revokes all sessions); server-side logout (refresh revoke); fixed a latent `setAuth` arg-order bug in the web login. Verified live end-to-end.
> Files: `services/tokens.js`, `models/RefreshToken.model.js`, `auth.controller.js` + routes, `mailer.js`; web `lib/auth.js`/`api.js`/`socket.js`/`store.js` + forgot/reset pages; fulfiller `lib/auth.js`/`api.js`/`socket.js`/`store.js`.
> **Still ideal-but-not-done:** move web token off `localStorage` → httpOnly cookie (+ CSRF); **admin MFA**; consider **phone-OTP login** for customers (better fit for the market). Tracked as future work, not launch-blockers.

### B7. App-store + legal prerequisites — 🟡 PARTIAL (customer policies drafted)
> Done: in-app **Privacy Policy, Terms & Conditions, Refund & Cancellation, Shipping & Delivery, and Contact Us** pages — written for India (DPDP Act 2023 + IT Act/SPDI Rules 2011 + Consumer Protection (E-Commerce) Rules 2020) and structured to clear Play Store / App Store / Razorpay onboarding (named Grievance Officer, 48h ack / 1-month resolution, refund timelines, business details). Surfaced via a **Footer** on Home/Orders/Account, a `/legal` hub, the Account menu, and **consent lines** at checkout, instant-order and login. All pages prerender as static HTML (reviewers/crawlers see the text).
> Files: `frontend/constants/business.js`, `components/{Footer,LegalLayout,BackHeader,LegalConsent}.jsx`, `app/legal/{page,privacy/page,terms/page,refunds/page,shipping/page}.js`, `app/contact/page.js`.
> 🔴 **Before publishing: fill every `[bracketed]` placeholder in `frontend/constants/business.js`** (legal name, registered address, GSTIN, support email/phone, Grievance Officer). App stores + Razorpay verify these against your real registered business — placeholders/mismatches get rejected. Have a lawyer review.
- ⬜ **Driver/fulfiller agreement** (separate from these customer policies) still to draft.
- iOS background-location is heavily reviewed — justify usage clearly; for a true alarm when the
  phone is silent you need the **Critical Alerts** entitlement (Apple approval required).
- App icons, splash, store listings, screenshots.

---

## C. P1 — Soon after launch

- [ ] **Customer web push** (PWA): VAPID + service worker so customers get "assigned/arriving/delivered" without the tab open (today they get socket + WhatsApp only). **M**
- [ ] **Admin live-ops dashboard**: map of active requests + fulfiller locations, manual assign/reassign, force-complete/cancel, fulfiller online status. **L**
- [ ] **Fulfiller onboarding/KYC**: vehicle docs, verification, activate/deactivate. **M**
- [ ] **Saved addresses** for customers; one-tap reorder; address book. **S**
- [ ] **`no_fulfiller` UX**: one-tap "retry with wider radius" or "convert to scheduled". **S**
- [ ] **Better ranking**: use Mapbox **Matrix API** for true driving-ETA ranking of candidates (today: haversine for ranking, Mapbox only for the assigned ETA). Cache geocodes to cut cost. **M**
- [ ] **Automated tests + CI**: commit the dispatch E2E (the throwaway scripts I ran) + unit tests for `DispatchManager` edge cases (timeout→next round, simultaneous accept, cancel-while-searching, recovery). GitHub Actions: lint + `next build` + backend tests. **M**
- [ ] **Cancellation policy / fees**; reasons capture; abuse limits. **S**
- [ ] **Atlas automated backups** + a restore drill. **S**

---

## D. P2 — Scale & growth

- [ ] Horizontal scale: Redis adapter + BullMQ (the real fix for B3). **L**
- [ ] **Surge / zone pricing**, peak multipliers. **M**
- [ ] Map-matching / snap-to-road for buttery tracking; marker heading rotation. **M**
- [ ] Fulfiller acceptance-rate / cancellation analytics; incentives. **M**
- [ ] Multi-city support (zones, per-zone catalogue + pricing). **L**
- [ ] In-app chat (customer ↔ fulfiller) over the existing socket. **M**
- [ ] Scheduled-instant hybrid ("order for 6pm" routed through dispatch at T-30). **M**

---

## Quick wins I'd do first (highest value / lowest effort)
1. ✅ **B6** ops hardening (`/health`, env validation, graceful shutdown) — done (Sentry still TODO).
2. ✅ **B4** validation + rate limiting — done.
3. ✅ **B3 (now)** pin to 1 instance — done.
4. ✅ **B1** payments (COD + Razorpay UPI) — done.
5. ✅ **B5** disconnect/abandonment handling + sweep — done.

**Remaining P0:** **B2** (payout/commission ledger — needed to actually pay drivers) and the rest of
**B7** (fill the `business.js` placeholders + legal review, driver agreement, store assets — the
customer-facing policies themselves are now drafted). Then deploy (Section A) + restrict/rotate keys.
