const Order = require('../models/Order.model');
const DeliveryRequest = require('../models/DeliveryRequest.model');
const payments = require('../services/payments');
const emit = require('../realtime/emit');
const { REQUEST_STATUS, EVENTS } = require('../shared/constants');

// Payment is collected AT THE DOOR (UPI) when the partner is on the way / has
// arrived — the order/request is already dispatched & reserved, so these flows
// only create the Razorpay order on demand and then mark the doc paid. Cash needs
// none of this (the driver collects + completes).

const ACTIVE_REQUEST = [REQUEST_STATUS.DRIVER_ASSIGNED, REQUEST_STATUS.EN_ROUTE, REQUEST_STATUS.ARRIVED];

/* ---------- Razorpay order creation (on demand, at delivery) ---------- */

/** Scheduled order — customer pays the full total by UPI at delivery. */
const createRazorpayOrder = async (req, res) => {
  try {
    if (!payments.isConfigured()) {
      return res.status(503).json({ success: false, error: 'Online payments are not configured' });
    }
    const { orderId } = req.body;
    const order = await Order.findOne({ _id: orderId, userId: req.user._id });
    if (!order) return res.status(404).json({ success: false, error: 'Order not found' });
    if (order.paymentStatus === 'paid') return res.status(400).json({ success: false, error: 'This order is already paid.' });

    const amountInr = order.totalAmount;
    if (!amountInr || amountInr <= 0) {
      return res.status(400).json({ success: false, error: 'Nothing to pay for this order.' });
    }
    const rpOrder = await payments.createOrder({
      amountInr,
      receipt: order._id.toString(),
      notes: { kind: 'order', refId: order._id.toString() },
    });
    await Order.findByIdAndUpdate(orderId, { razorpayOrderId: rpOrder.id });

    res.json({
      success: true,
      data: { razorpayOrderId: rpOrder.id, amount: rpOrder.amount, currency: rpOrder.currency, keyId: payments.keyId() },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to create payment order' });
  }
};

/** Instant request — customer pays the full total by UPI once a partner is on the way. */
const createRequestPayment = async (req, res) => {
  try {
    if (!payments.isConfigured()) {
      return res.status(503).json({ success: false, error: 'Online payments are not configured' });
    }
    const { requestId } = req.body;
    const request = await DeliveryRequest.findOne({ _id: requestId, customerId: req.user._id });
    if (!request) return res.status(404).json({ success: false, error: 'Request not found' });
    if (request.paymentStatus === 'paid') return res.status(400).json({ success: false, error: 'This delivery is already paid.' });
    if (!ACTIVE_REQUEST.includes(request.status)) {
      return res.status(400).json({ success: false, error: 'Payment opens once a partner is on the way.' });
    }
    const amountInr = request.pricing?.amount;
    if (!amountInr || amountInr <= 0) {
      return res.status(400).json({ success: false, error: 'Nothing to pay.' });
    }
    const rpOrder = await payments.createOrder({
      amountInr,
      receipt: request._id.toString(),
      notes: { kind: 'delivery_request', refId: request._id.toString() },
    });
    await DeliveryRequest.updateOne({ _id: requestId }, { razorpayOrderId: rpOrder.id });

    res.json({
      success: true,
      data: { razorpayOrderId: rpOrder.id, amount: rpOrder.amount, currency: rpOrder.currency, keyId: payments.keyId() },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to create payment' });
  }
};

/* ---------- Mark paid (idempotent; no dispatch / no re-reserve) ---------- */

/** Flip an order to paid. Idempotent via the `unpaid` guard (verify + webhook). */
async function markOrderPaid(razorpayOrderId, paymentId) {
  const order = await Order.findOneAndUpdate(
    { razorpayOrderId, paymentStatus: 'unpaid' },
    { paymentStatus: 'paid', razorpayPaymentId: paymentId },
    { new: true }
  );
  if (!order) return null;
  // Let the assigned driver know the UPI payment landed (ActiveJob → "Paid ✓").
  if (order.driverAssigned) emit.toFulfiller(String(order.driverAssigned), EVENTS.PAYMENT_RECEIVED, { orderId: String(order._id) });
  return order;
}

/** Flip a request to paid. Idempotent; the request is already dispatched. */
async function markRequestPaid(razorpayOrderId, paymentId) {
  const request = await DeliveryRequest.findOneAndUpdate(
    { razorpayOrderId, paymentStatus: 'unpaid' },
    { paymentStatus: 'paid', razorpayPaymentId: paymentId },
    { new: true }
  );
  if (!request) return null;
  if (request.fulfillerId) emit.toFulfiller(String(request.fulfillerId), EVENTS.PAYMENT_RECEIVED, { requestId: String(request._id) });
  return request;
}

/** Client-reported confirmation for a SCHEDULED order (signature-verified). */
const verifyOrderPayment = async (req, res) => {
  try {
    const { orderId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    if (!payments.verifyPaymentSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature)) {
      return res.status(400).json({ success: false, error: 'Payment verification failed' });
    }
    const owns = await Order.findOne({ _id: orderId, userId: req.user._id, razorpayOrderId: razorpay_order_id });
    if (!owns) return res.status(404).json({ success: false, error: 'Order not found' });

    const updated = await markOrderPaid(razorpay_order_id, razorpay_payment_id);
    const finalDoc = updated || (await Order.findById(orderId));
    res.json({ success: true, data: finalDoc });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Payment verification failed' });
  }
};

/** Client-reported confirmation for an INSTANT request (signature-verified). */
const verifyRequestPayment = async (req, res) => {
  try {
    const { requestId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    if (!payments.verifyPaymentSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature)) {
      return res.status(400).json({ success: false, error: 'Payment verification failed' });
    }
    const owns = await DeliveryRequest.findOne({ _id: requestId, customerId: req.user._id, razorpayOrderId: razorpay_order_id });
    if (!owns) return res.status(404).json({ success: false, error: 'Request not found' });

    const updated = await markRequestPaid(razorpay_order_id, razorpay_payment_id);
    const finalDoc = updated || (await DeliveryRequest.findById(requestId));
    res.json({ success: true, data: finalDoc });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Payment verification failed' });
  }
};

/* ---------- Webhook (handles BOTH Order and DeliveryRequest) ---------- */

const handleWebhook = async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const body = req.body; // raw Buffer (mounted before express.json())
    if (!payments.verifyWebhookSignature(body, signature)) {
      return res.status(400).json({ success: false, error: 'Invalid webhook signature' });
    }
    const event = JSON.parse(body.toString());

    if (event.event === 'payment.captured') {
      const { order_id, id: paymentId } = event.payload.payment.entity;
      // Route by the razorpay order id: instant request first, else scheduled order.
      const dr = await DeliveryRequest.findOne({ razorpayOrderId: order_id });
      if (dr) {
        await markRequestPaid(order_id, paymentId); // idempotent
      } else {
        await markOrderPaid(order_id, paymentId); // idempotent
      }
    }

    res.json({ success: true, data: null });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Webhook handling failed' });
  }
};

module.exports = {
  createRazorpayOrder,
  createRequestPayment,
  verifyOrderPayment,
  verifyRequestPayment,
  handleWebhook,
};
