const http = require('http');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const { initSocket } = require('./realtime/io');
const dispatch = require('./services/dispatch/DispatchManager');

// ---- Fail fast: refuse to boot without the essentials ----
const REQUIRED_ENV = ['MONGO_URI', 'JWT_SECRET'];
const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`✖ Missing required env vars: ${missing.join(', ')}. Set them and restart.`);
  process.exit(1);
}

const app = express();

// Behind Railway/Vercel's proxy: trust the first hop so req.ip is the real
// client IP (needed for per-IP rate limiting).
app.set('trust proxy', 1);

app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL }));

// Raw body for Razorpay webhook — must be before express.json()
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));

app.use(express.json());

// Liveness/readiness probe (used by Railway healthcheck). Reports DB state too.
app.get('/health', (req, res) => {
  const dbUp = mongoose.connection.readyState === 1; // 1 = connected
  res.status(dbUp ? 200 : 503).json({
    success: dbUp,
    data: { status: dbUp ? 'ok' : 'degraded', db: dbUp ? 'up' : 'down', uptime: Math.round(process.uptime()) },
  });
});

// Routes
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/products', require('./routes/product.routes'));
app.use('/api/slots', require('./routes/slot.routes'));
app.use('/api/orders', require('./routes/order.routes'));
app.use('/api/requests', require('./routes/request.routes'));
app.use('/api/fulfiller', require('./routes/fulfiller.routes'));
app.use('/api/addresses', require('./routes/address.routes'));
app.use('/api/payments', require('./routes/payment.routes'));
app.use('/api/support', require('./routes/support.routes'));
app.use('/api/reviews', require('./routes/review.routes'));
app.use('/api/admin', require('./routes/admin.routes'));

app.get('/', (req, res) => {
  res.json({ success: true, data: { message: 'KIT UM API is running' } });
});

const PORT = process.env.PORT || 5000;

// Single HTTP server shared by Express + Socket.IO. Real-time dispatch needs a
// persistent connection, which is why the instant flow runs here (Railway),
// not on the Vercel serverless entrypoint (backend/api/index.js).
const server = http.createServer(app);
const io = initSocket(server);

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log('MongoDB connected');
    server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
    // Re-queue any requests left mid-search by a previous restart.
    dispatch.recover();
    // Ensure the launch-offer campaigns exist (idempotent; admin tunes them live).
    require('./services/promotions').seedCampaigns();
  })
  .catch((err) => console.error(err));

// ---- Graceful shutdown (Railway sends SIGTERM on every redeploy) ----
let shuttingDown = false;
const shutdown = async (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n${signal} received — shutting down gracefully…`);
  // Hard cap: never let shutdown hang the deploy.
  const force = setTimeout(() => {
    console.error('Shutdown timed out — forcing exit');
    process.exit(1);
  }, 10000);
  force.unref();
  try {
    await new Promise((resolve) => io.close(resolve)); // disconnect sockets + close HTTP server
    await mongoose.connection.close(false);
    console.log('Shutdown complete');
    process.exit(0);
  } catch (err) {
    console.error('Error during shutdown', err);
    process.exit(1);
  }
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
