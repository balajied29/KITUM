const Order = require('../models/Order.model');
const SlotConfig = require('../models/SlotConfig.model');
const Product = require('../models/Product.model');
const User = require('../models/User.model');
const { sendOutForDelivery, sendDelivered } = require('../services/whatsapp');

// Orders
const getAllOrders = async (req, res) => {
  try {
    const { date, status } = req.query;
    const filter = {};

    if (status) filter.status = status;

    if (date) {
      const start = new Date(date + 'T00:00:00.000Z');
      const end   = new Date(date + 'T23:59:59.999Z');
      const slots = await SlotConfig.find({ date: { $gte: start, $lte: end } }).select('_id');
      filter.slotId = { $in: slots.map((s) => s._id) };
    }

    const orders = await Order.find(filter)
      .populate('userId', 'email name phone')
      .populate('slotId', 'date slotLabel startTime endTime')
      .populate('items.productId', 'name unit')
      .populate('driverAssigned', 'name phone')
      .sort({ createdAt: -1 });

    res.json({ success: true, data: orders });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch orders' });
  }
};

const updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;

    const order = await Order.findByIdAndUpdate(
      req.params.id,
      {
        status,
        $push: { statusLog: { status, changedAt: new Date(), changedBy: req.user._id } },
      },
      { new: true }
    ).populate('userId', 'phone');

    if (!order) return res.status(404).json({ success: false, error: 'Order not found' });

    // WhatsApp — fire and forget
    const phone = order.userId?.phone;
    const shortId = order._id.toString().slice(-6).toUpperCase();
    if (phone) {
      if (status === 'out_for_delivery') sendOutForDelivery(phone, shortId);
      if (status === 'delivered') sendDelivered(phone, shortId);
    }

    res.json({ success: true, data: order });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update order status' });
  }
};

const assignDriver = async (req, res) => {
  try {
    const { driverId } = req.body;
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { driverAssigned: driverId },
      { new: true }
    ).populate('driverAssigned', 'name phone');
    if (!order) return res.status(404).json({ success: false, error: 'Order not found' });
    res.json({ success: true, data: order });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to assign driver' });
  }
};

// Slots
const getSlots = async (req, res) => {
  try {
    const slots = await SlotConfig.find().sort({ date: 1, slotLabel: 1 });
    res.json({ success: true, data: slots });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch slots' });
  }
};

// Normalize a date value to UTC midnight to prevent timezone drift
const toUtcMidnight = (dateVal) => {
  if (!dateVal) return dateVal;
  const str = typeof dateVal === 'string' ? dateVal.split('T')[0] : dateVal.toISOString().split('T')[0];
  return new Date(str + 'T00:00:00.000Z');
};

const createSlot = async (req, res) => {
  try {
    const body = { ...req.body, date: toUtcMidnight(req.body.date) };
    const slot = await SlotConfig.create(body);
    res.status(201).json({ success: true, data: slot });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ success: false, error: 'Slot already exists for this date and label' });
    }
    res.status(500).json({ success: false, error: 'Failed to create slot' });
  }
};

const updateSlot = async (req, res) => {
  try {
    const slot = await SlotConfig.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!slot) return res.status(404).json({ success: false, error: 'Slot not found' });
    res.json({ success: true, data: slot });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update slot' });
  }
};

// Products
const createProduct = async (req, res) => {
  try {
    const product = await Product.create(req.body);
    res.status(201).json({ success: true, data: product });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ success: false, error: 'Product slug already exists' });
    }
    res.status(500).json({ success: false, error: 'Failed to create product' });
  }
};

const updateProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!product) return res.status(404).json({ success: false, error: 'Product not found' });
    res.json({ success: true, data: product });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update product' });
  }
};

module.exports = {
  getAllOrders,
  updateOrderStatus,
  assignDriver,
  getSlots,
  createSlot,
  updateSlot,
  createProduct,
  updateProduct,
};
