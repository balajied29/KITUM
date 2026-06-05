/**
 * Razorpay wrapper — the single place the payment provider is touched.
 *
 * The client is built lazily so the server boots fine **without** keys (the app
 * then runs cash-only and online-payment endpoints return a clean 503 rather
 * than crashing). Drop RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET into backend/.env
 * and everything below activates with no code change.
 */
const crypto = require('crypto');
const Razorpay = require('razorpay');

let _client = null;

const isConfigured = () =>
  !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);

function client() {
  if (_client) return _client;
  if (!isConfigured()) return null;
  _client = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
  return _client;
}

const keyId = () => process.env.RAZORPAY_KEY_ID;

/** Create an order. `amountInr` is rupees; Razorpay wants paise. */
async function createOrder({ amountInr, receipt, notes }) {
  const rp = client();
  if (!rp) throw new Error('Razorpay not configured');
  return rp.orders.create({
    amount: Math.round(amountInr * 100),
    currency: 'INR',
    receipt,
    notes,
  });
}

/** Refund a captured payment (full unless `amountInr` given). Fails soft → null. */
async function refund(paymentId, amountInr) {
  const rp = client();
  if (!rp || !paymentId) return null;
  try {
    return await rp.payments.refund(paymentId, amountInr ? { amount: Math.round(amountInr * 100) } : {});
  } catch {
    return null;
  }
}

/**
 * Verify a Razorpay Checkout success payload (client-reported).
 * generated = HMAC_SHA256(order_id|payment_id, key_secret) must equal signature.
 */
function verifyPaymentSignature(orderId, paymentId, signature) {
  if (!process.env.RAZORPAY_KEY_SECRET || !orderId || !paymentId || !signature) return false;
  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
  // timing-safe compare
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Verify a webhook body against RAZORPAY_WEBHOOK_SECRET. `rawBody` is a Buffer/string. */
function verifyWebhookSignature(rawBody, signature) {
  if (!process.env.RAZORPAY_WEBHOOK_SECRET || !signature) return false;
  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = {
  isConfigured,
  keyId,
  createOrder,
  refund,
  verifyPaymentSignature,
  verifyWebhookSignature,
};
