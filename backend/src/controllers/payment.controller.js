const crypto = require('crypto');
const Razorpay = require('razorpay');
const Order = require('../models/Order.model');
const SlotConfig = require('../models/SlotConfig.model');

const razorpay = new Razorpay({
  key_id:     process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const createRazorpayOrder = async (req, res) => {
  try {
    const { orderId } = req.body;
    const order = await Order.findOne({ _id: orderId, userId: req.user._id });
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    const rpOrder = await razorpay.orders.create({
      amount:  order.totalAmount * 100, // paise
      currency: 'INR',
      receipt: order._id.toString(),
    });

    await Order.findByIdAndUpdate(orderId, { razorpayOrderId: rpOrder.id });

    res.json({
      success: true,
      data: {
        razorpayOrderId: rpOrder.id,
        amount:          rpOrder.amount,
        currency:        rpOrder.currency,
        keyId:           process.env.RAZORPAY_KEY_ID,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to create payment order' });
  }
};

const handleWebhook = async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const body      = req.body; // raw Buffer

    const expected = crypto
      .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(body)
      .digest('hex');

    if (signature !== expected) {
      return res.status(400).json({ success: false, error: 'Invalid webhook signature' });
    }

    const event = JSON.parse(body.toString());

    if (event.event === 'payment.captured') {
      const { order_id, id: paymentId } = event.payload.payment.entity;

      // Idempotency: if already processed this payment, skip
      const existing = await Order.findOne({ razorpayPaymentId: paymentId });
      if (existing) {
        return res.json({ success: true, data: null });
      }

      const order = await Order.findOne({ razorpayOrderId: order_id });
      if (!order) {
        return res.status(404).json({ success: false, error: 'Order not found for this payment' });
      }

      // Atomically reserve slot capacity now that payment is confirmed
      // This is the deferred increment for UPI orders
      const slot = await SlotConfig.findOneAndUpdate(
        {
          _id:     order.slotId,
          blocked: false,
          $expr:   { $lt: ['$currentBooked', '$maxCapacity'] },
        },
        { $inc: { currentBooked: 1 } },
        { new: true }
      );

      // If slot is now full/blocked, still mark paid but flag it for admin review
      // (edge case: slot was blocked between order creation and payment)
      await Order.findByIdAndUpdate(order._id, {
        paymentStatus:    'paid',
        razorpayPaymentId: paymentId,
        status:           slot ? 'confirmed' : 'confirmed', // admin handles slot-full edge case
        $push: {
          statusLog: { status: 'confirmed', changedAt: new Date() },
        },
      });
    }

    if (event.event === 'payment.failed') {
      const { order_id } = event.payload.payment.entity;
      // Leave order as pending — customer can retry from status page
      // Slot was never reserved for UPI, so nothing to release
      await Order.findOneAndUpdate(
        { razorpayOrderId: order_id },
        { $push: { statusLog: { status: 'pending', changedAt: new Date() } } }
      );
    }

    res.json({ success: true, data: null });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Webhook handling failed' });
  }
};

module.exports = { createRazorpayOrder, handleWebhook };
