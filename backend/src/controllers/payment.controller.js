const crypto = require('crypto');
const Razorpay = require('razorpay');
const Order = require('../models/Order.model');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
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
      amount: order.totalAmount * 100, // convert to paise
      currency: 'INR',
      receipt: order._id.toString(),
    });

    await Order.findByIdAndUpdate(orderId, { razorpayOrderId: rpOrder.id });

    res.json({
      success: true,
      data: {
        razorpayOrderId: rpOrder.id,
        amount: rpOrder.amount,
        currency: rpOrder.currency,
        keyId: process.env.RAZORPAY_KEY_ID,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to create payment order' });
  }
};

// Razorpay sends raw body — must be mounted before express.json()
const handleWebhook = async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const body = req.body; // raw Buffer

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
      await Order.findOneAndUpdate(
        { razorpayOrderId: order_id },
        {
          paymentStatus: 'paid',
          razorpayPaymentId: paymentId,
          status: 'confirmed',
          $push: { statusLog: { status: 'confirmed', changedAt: new Date() } },
        }
      );
    }

    res.json({ success: true, data: null });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Webhook handling failed' });
  }
};

module.exports = { createRazorpayOrder, handleWebhook };
