# KITUM — Shillong Water

On-demand + scheduled water delivery for Shillong. Three apps + a shared contract:

```
KITUM/
├── backend/     Express + Socket.IO + MongoDB — REST API, real-time dispatch engine   → Railway
├── frontend/    Next.js 14 PWA — customer app (scheduled + instant "Order Now")        → Vercel
├── fulfiller/   Expo (React Native) — tanker operator app (offers, live location)      → EAS / stores
└── shared/      constants.js — canonical realtime protocol spec (socket events, statuses, tuning)
```

The realtime contract (event names, statuses, dispatch tuning) is specified once in
`shared/constants.js`. So each app deploys self-contained, every app keeps an in-sync copy:
`backend/src/shared/constants.js`, `frontend/lib/constants.js`, `fulfiller/lib/constants.js`.

Two delivery models coexist:
- **Scheduled** — pick products → pick a time slot → checkout (the original flow).
- **Instant (ride-hailing)** — pick a tanker size → nearest available tanker is offered the
  job → accept/reject → on reject/timeout, broadcast to the next best fulfillers
  (first-to-accept wins) → live-tracked to your door.

## How the instant flow works
1. Customer `POST /api/requests` → a `DeliveryRequest` is created (`status: searching`) and
   handed to the **DispatchManager** (`backend/src/services/dispatch/DispatchManager.js`).
2. Candidates are found with a Mongo `$near` query over the `2dsphere` index on
   `User.fulfillerProfile.currentLocation`, filtered by online/available/capacity.
3. **Round 1** offers the single nearest fulfiller (~20s window). On reject/timeout,
   **Round 2+** broadcast to the next 5, widening the radius each round. The winner is
   decided by an atomic `findOneAndUpdate({ status: 'searching' })`, so exactly one wins.
4. Realtime over **Socket.IO** (rooms: `user:<id>`, `fulfiller:<id>`, `request:<id>`).
   Push (Expo) wakes a backgrounded fulfiller app; WhatsApp/email are the durable fallback.
5. Live location flows fulfiller → socket → only that request's room. Battery-aware sampling
   (idle vs on-job). See `shared/constants.js` for all tuning.

## Local development
Prereqs: Node ≥ 18, a MongoDB (local `mongod` or a free Atlas M0 cluster).

```bash
# 1. Install
npm install                      # root (concurrently)
npm --prefix backend  install
npm --prefix frontend install
npm --prefix fulfiller install   # or: cd fulfiller && npx expo install

# 2. Env — copy and fill each .env.example
cp backend/.env.example  backend/.env
cp frontend/.env.example frontend/.env.local
cp fulfiller/.env.example fulfiller/.env

# 3. Seed catalogue + admin + demo fulfillers (around Shillong)
npm run seed                     # products + admin + fulfillers

# 4. Run backend + customer app together
npm run dev                      # backend:5000 + frontend:3000

# 5. Run the fulfiller app (separate terminal)
npm run dev:fulfiller            # expo start — scan QR with Expo Go / a dev build
```

Demo fulfiller logins: `fulfiller1@shillongwater.com` … `fulfiller3@…` / `Fulfiller@2026`.

> The phone can't reach your laptop's `localhost`. Set `EXPO_PUBLIC_API_URL` /
> `EXPO_PUBLIC_SOCKET_URL` to your machine's **LAN IP** (e.g. `http://192.168.x.x:5000`).

## Keys you'll need (all have free tiers)
| Key | Where | Used for |
|-----|-------|----------|
| `MONGO_URI` | MongoDB Atlas M0 | database |
| `MAPBOX_TOKEN` / `NEXT_PUBLIC_MAPBOX_TOKEN` | mapbox.com | map render, tracking, ETA |
| `GOOGLE_MAPS_API_KEY` / `NEXT_PUBLIC_GOOGLE_MAPS_KEY` | Google Cloud | geocoding + Places autocomplete |
| `INTERAKT_API_KEY` | interakt.ai | WhatsApp (optional) |
| `RAZORPAY_KEY_*` | razorpay.com | payments (optional; instant defaults to COD) |

Everything degrades gracefully if a key is missing (maps fall back, push/WhatsApp no-op).

## Deploy (cost-efficient)
- **Backend → Railway.** Persistent Node process (required for WebSockets). `railway.json`
  already sets `node src/index.js`. Set all `backend/.env` vars in the Railway dashboard.
  Set `CLIENT_URL` to your customer + admin origins (comma-separated) for CORS + sockets.
- **Frontend → Vercel.** Point `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_SOCKET_URL` at the
  Railway URL (sockets can't go through the Next `/api` rewrite).
- **Fulfiller → EAS.** `cd fulfiller && eas build` (see `fulfiller/README.md`).

> `backend/api/index.js` (Vercel serverless) serves the **scheduled flow only** — it can't
> hold WebSocket connections or run dispatch timers. The instant flow lives on Railway.

## Tested
`backend/` real-server E2E covered: nearest-first offer → accept → dual-sided assignment →
live location relay → en_route/arrived/completed (COD auto-paid); and reject → broadcast →
simultaneous accept yielding exactly one winner (atomic claim).

## Before you go live
See **[BEFORE_LIVE.md](BEFORE_LIVE.md)** — the operational setup checklist plus prioritized
production-readiness work (payments, settlement ledger, single-instance lock, validation/rate
limiting, disconnect handling, ops hardening, legal). Start with the "quick wins" section.
