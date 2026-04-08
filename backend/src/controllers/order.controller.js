const Order = require('../models/Order.model');
const Product = require('../models/Product.model');
const SlotConfig = require('../models/SlotConfig.model');
const { sendOrderConfirmed } = require('../services/whatsapp');

const createOrder = async (req, res) => {
  try {
    const { items, slotId, deliveryAddress, paymentMode } = req.body;

    if (!slotId) {
      return res.status(400).json({ success: false, error: 'Delivery slot is required' });
    }

    // COD: atomically reserve slot now (read + increment in one operation — no race condition)
    // UPI: verify availability only; slot is reserved after payment.captured webhook
    let slot;
    if (paymentMode === 'cod') {
      slot = await SlotConfig.findOneAndUpdate(
        {
          _id: slotId,
          blocked: false,
          $expr: { $lt: ['$currentBooked', '$maxCapacity'] },
        },
        { $inc: { currentBooked: 1 } },
        { new: true }
      );
    } else {
      // UPI — check availability without booking
      slot = await SlotConfig.findOne({ _id: slotId, blocked: false });
      if (slot && slot.currentBooked >= slot.maxCapacity) slot = null;
    }

    if (!slot) {
      return res.status(400).json({ success: false, error: 'Slot not available or fully booked' });
    }

    let totalAmount = 0;
    const resolvedItems = [];

    for (const item of items) {
      const product = await Product.findById(item.productId);
      if (!product || !product.active) {
        // Roll back slot reservation for COD if product check fails
        if (paymentMode === 'cod') {
          await SlotConfig.findByIdAndUpdate(slotId, { $inc: { currentBooked: -1 } });
        }
        return res.status(400).json({ success: false, error: `Product not available: ${item.productId}` });
      }
      resolvedItems.push({ productId: product._id, quantity: item.quantity, pricePerUnit: product.price });
      totalAmount += product.price * item.quantity;
    }

    const order = await Order.create({
      userId:          req.user._id,
      items:           resolvedItems,
      slotId,
      deliveryAddress,
      paymentMode,
      totalAmount,
      // COD is confirmed at creation; UPI stays pending until webhook
      status:          paymentMode === 'cod' ? 'confirmed' : 'pending',
      paymentStatus:   paymentMode === 'cod' ? 'unpaid'    : 'unpaid',
      statusLog: [{
        status:    paymentMode === 'cod' ? 'confirmed' : 'pending',
        changedAt: new Date(),
        changedBy: req.user._id,
      }],
    });

    if (req.user.phone) {
      const slotLabel = `${slot.slotLabel} (${slot.startTime} – ${slot.endTime})`;
      sendOrderConfirmed(req.user.phone, order._id.toString().slice(-6).toUpperCase(), slotLabel);
    }

    res.status(201).json({ success: true, data: order });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to create order' });
  }
};

const cancelOrder = async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, userId: req.user._id });
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }
    if (!['pending', 'confirmed'].includes(order.status)) {
      return res.status(400).json({ success: false, error: 'Order cannot be cancelled at this stage' });
    }

    // Release slot capacity — only if it was already reserved
    const wasReserved = order.paymentMode === 'cod' || order.paymentStatus === 'paid';
    if (wasReserved) {
      await SlotConfig.findByIdAndUpdate(order.slotId, { $inc: { currentBooked: -1 } });
    }

    const updated = await Order.findByIdAndUpdate(
      order._id,
      {
        status: 'cancelled',
        $push: { statusLog: { status: 'cancelled', changedAt: new Date(), changedBy: req.user._id } },
      },
      { new: true }
    );

    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to cancel order' });
  }
};

const getUserOrders = async (req, res) => {
  try {
    const orders = await Order.find({ userId: req.user._id })
      .populate('slotId', 'date slotLabel startTime endTime')
      .populate('items.productId', 'name unit')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: orders });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch orders' });
  }
};

const getOrderById = async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, userId: req.user._id })
      .populate('slotId', 'date slotLabel startTime endTime')
      .populate('items.productId', 'name unit image')
      .populate('driverAssigned', 'name phone');
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }
    res.json({ success: true, data: order });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch order' });
  }
};

module.exports = { createOrder, cancelOrder, getUserOrders, getOrderById };
