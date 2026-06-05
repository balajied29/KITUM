/**
 * Vercel serverless entry — SCHEDULED FLOW ONLY.
 *
 * The instant/ride-hailing flow (real-time dispatch + Socket.IO + live location)
 * requires a persistent process and is served exclusively by the Railway server
 * (src/index.js). Point NEXT_PUBLIC_API_URL / NEXT_PUBLIC_SOCKET_URL at Railway
 * for the instant features. The `/api/requests` + `/api/fulfiller` routes are
 * deliberately NOT mounted here because dispatch timers cannot run on serverless.
 */
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

app.use(cors({ origin: process.env.CLIENT_URL || '*' }));

// Raw body for Razorpay webhook — must be before express.json()
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));

app.use(express.json());

// Routes
app.use('/api/auth',     require('../src/routes/auth.routes'));
app.use('/api/products', require('../src/routes/product.routes'));
app.use('/api/slots',    require('../src/routes/slot.routes'));
app.use('/api/orders',   require('../src/routes/order.routes'));
app.use('/api/addresses', require('../src/routes/address.routes'));
app.use('/api/payments', require('../src/routes/payment.routes'));
app.use('/api/support',  require('../src/routes/support.routes'));
app.use('/api/reviews',  require('../src/routes/review.routes'));
app.use('/api/admin',    require('../src/routes/admin.routes'));

app.get('/', (req, res) => {
  res.json({ success: true, data: { message: 'KIT UM API is running' } });
});

// Connect once and reuse across warm invocations
let isConnected = false;
const connectDB = async () => {
  if (isConnected) return;
  await mongoose.connect(process.env.MONGO_URI);
  isConnected = true;
};

module.exports = async (req, res) => {
  await connectDB();
  return app(req, res);
};
