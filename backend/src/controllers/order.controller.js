const Order = require('../models/Order.model');
const Product = require('../models/Product.model');
const SlotConfig = require('../models/SlotConfig.model');
const { sendOrderConfirmed } = require('../services/whatsapp');

const createOrder = async (req, res) => {
  try {
    const { items, slotId, deliveryAddress, paymentMode } = req.body;

    const slot = await SlotConfig.findById(slotId);
    if (!slot || slot.blocked) {
      return res.status(400).json({ success: false, error: 'Slot not available' });
    }
    if (slot.currentBooked >= slot.maxCapacity) {
      return res.status(400).json({ success: false, error: 'Slot is full' });
    }

    let totalAmount = 0;
    const resolvedItems = [];

    for (const item of items) {
      const product = await Product.findById(item.productId);
      if (!product || !product.active) {
        return res.status(400).json({ success: false, error: `Product not available: ${item.productId}` });
      }
      resolvedItems.push({
        productId: product._id,
        quantity: item.quantity,
        pricePerUnit: product.price,
      });
      totalAmount += product.price * item.quantity;
    }

    await SlotConfig.findByIdAndUpdate(slotId, { $inc: { currentBooked: 1 } });

    const order = await Order.create({
      userId: req.user._id,
      items: resolvedItems,
      slotId,
      deliveryAddress,
      paymentMode,
      totalAmount,
      statusLog: [{ status: 'pending', changedAt: new Date(), changedBy: req.user._id }],
    });

    // WhatsApp notification — fire and forget, never awaited
    if (req.user.phone) {
      const slotLabel = `${slot.slotLabel} (${slot.startTime} – ${slot.endTime})`;
      sendOrderConfirmed(req.user.phone, order._id.toString().slice(-6).toUpperCase(), slotLabel);
    }

    res.status(201).json({ success: true, data: order });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to create order' });
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

module.exports = { createOrder, getUserOrders, getOrderById };
