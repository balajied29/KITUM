/**
 * Rate limiters (express-rate-limit). Each keeps a per-IP counter in a sliding
 * window and returns 429 once the cap is hit.
 *
 * NOTE: behind a proxy (Railway/Vercel) you must set `app.set('trust proxy', 1)`
 * so `req.ip` is the real client IP and not the proxy's — otherwise every client
 * shares one bucket. That's done in src/index.js.
 */
const rateLimit = require('express-rate-limit');

const deny = (msg) => (req, res) => res.status(429).json({ success: false, error: msg });

// Brute-force protection for credentials. Strict + slow window.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 attempts / IP / window
  standardHeaders: true,
  legacyHeaders: false,
  handler: deny('Too many attempts. Please try again in a few minutes.'),
});

// Anti-spam for instant request creation (one tap = one offer storm to fulfillers).
const requestLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: deny('You are creating requests too quickly. Please slow down.'),
});

module.exports = { authLimiter, requestLimiter };
