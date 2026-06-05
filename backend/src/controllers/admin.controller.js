const bcrypt = require('bcryptjs');
const Order = require('../models/Order.model');
const SlotConfig = require('../models/SlotConfig.model');
const Product = require('../models/Product.model');
const User = require('../models/User.model');
const DeliveryRequest = require('../models/DeliveryRequest.model');
const { sendOutForDelivery, sendDelivered } = require('../services/whatsapp');
const push = require('../services/push');
const bestFit = require('../services/scheduled/bestFit');
const storage = require('../services/storage');

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

    // On delivery, the balance (COD cash) is now in hand → mark the order paid, so
    // realized revenue reflects it. Guard so a refunded order is never flipped back.
    const isDelivered = status === 'delivered';
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      [
        {
          $set: {
            status,
            ...(isDelivered
              ? { paymentStatus: { $cond: [{ $eq: ['$paymentStatus', 'refunded'] }, '$paymentStatus', 'paid'] } }
              : {}),
            statusLog: { $concatArrays: ['$statusLog', [{ status, changedAt: '$$NOW', changedBy: req.user._id }]] },
          },
        },
      ],
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

// Ranked best-fit partner suggestions for a scheduled order (decision-support).
const getOrderCandidates = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, error: 'Order not found' });

    const result = await bestFit.selectBestDriver(order, { phase: 'A' });

    let ranked = [];
    if (result.applicable && result.ranked?.length) {
      const ids = result.ranked.map((r) => r.driverId);
      const drivers = await User.find({ _id: { $in: ids } })
        .select('name phone fulfillerProfile.vehicleNumber fulfillerProfile.capacityLitres fulfillerProfile.rating')
        .lean();
      const byId = new Map(drivers.map((d) => [String(d._id), d]));
      ranked = result.ranked.map((r) => ({ ...r, driver: byId.get(r.driverId) || null }));
    }

    // Manual fallback: every active partner the dispatcher can pick from.
    const allActive = await User.find({ role: 'fulfiller', isActive: true })
      .select('name phone fulfillerProfile.vehicleNumber fulfillerProfile.capacityLitres fulfillerProfile.serviceLocalities')
      .sort({ name: 1 })
      .lean();

    res.json({
      success: true,
      data: {
        applicable: result.applicable,
        mode: result.mode,            // 'thin' | 'dense' | 'none'
        reason: result.reason,        // when not applicable
        localityId: result.localityId,
        requiredLitres: order.requiredLitres,
        widened: result.widened,
        ranked,
        allActive,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to compute driver suggestions' });
  }
};

// Assign (or reassign) a partner to a scheduled order — validated + atomic + notified.
const assignDriver = async (req, res) => {
  try {
    const { driverId } = req.body;
    if (!driverId) return res.status(400).json({ success: false, error: 'Select a partner to assign.' });

    // Must be a real, active fulfiller.
    const driver = await User.findOne({ _id: driverId, role: 'fulfiller', isActive: true })
      .select('name phone fulfillerProfile.vehicleNumber fulfillerProfile.expoPushToken');
    if (!driver) return res.status(400).json({ success: false, error: 'That partner is not an active fulfiller.' });

    const current = await Order.findById(req.params.id).populate('slotId', 'date slotLabel startTime endTime');
    if (!current) return res.status(404).json({ success: false, error: 'Order not found' });
    if (['delivered', 'cancelled'].includes(current.status)) {
      return res.status(400).json({ success: false, error: `Order is already ${current.status}.` });
    }

    // Atomic — guarded so a just-delivered/cancelled order can't be claimed under us.
    const order = await Order.findOneAndUpdate(
      { _id: req.params.id, status: { $nin: ['delivered', 'cancelled'] } },
      {
        $set: {
          driverAssigned: driverId,
          assignmentStatus: 'assigned',
          assignedAt: new Date(),
          startBy: current.slotId?.date,
        },
        $push: { statusLog: { status: 'assigned', changedAt: new Date(), changedBy: req.user._id } },
      },
      { new: true }
    )
      .populate('driverAssigned', 'name phone fulfillerProfile.vehicleNumber')
      .populate('userId', 'name phone')
      .populate('slotId', 'date slotLabel startTime endTime');
    if (!order) return res.status(409).json({ success: false, error: 'Order changed — please retry.' });

    // Best-effort heads-up to the partner (push; the in-app scheduled job screen is WIP).
    const shortId = order._id.toString().slice(-6).toUpperCase();
    const slotTxt = order.slotId ? `${order.slotId.slotLabel} ${order.slotId.startTime}–${order.slotId.endTime}` : 'scheduled slot';
    const where = order.deliveryAddress?.locality || order.deliveryAddress?.street || '';
    if (driver.fulfillerProfile?.expoPushToken) {
      push.notify(
        driver.fulfillerProfile.expoPushToken,
        'New scheduled delivery',
        `#${shortId} · ${slotTxt}${where ? ` · ${where}` : ''}`,
        { type: 'scheduled_order', orderId: String(order._id) }
      );
    }

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

// Fulfillers (tanker operators)
const createFulfiller = async (req, res) => {
  try {
    const { name, email, password, phone, vehicleNumber, capacityLitres } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, error: 'Name, email and password are required' });
    }
    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) return res.status(409).json({ success: false, error: 'Email already in use' });

    const hashed = await bcrypt.hash(password, 10);
    const fulfiller = await User.create({
      name,
      email,
      password: hashed,
      phone,
      role: 'fulfiller',
      fulfillerProfile: {
        vehicleNumber,
        capacityLitres: Number(capacityLitres) || 0,
        isOnline: false,
        isAvailable: true,
        applicationStatus: 'approved',
        reviewedAt: new Date(),
      },
    });
    const safe = fulfiller.toObject();
    delete safe.password;
    res.status(201).json({ success: true, data: safe });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to create fulfiller' });
  }
};

const listFulfillers = async (req, res) => {
  try {
    const fulfillers = await User.find({ role: 'fulfiller' }).select('-password').sort({ createdAt: -1 });
    res.json({ success: true, data: fulfillers });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch fulfillers' });
  }
};

const updateFulfiller = async (req, res) => {
  try {
    const { name, phone, isActive, vehicleNumber, capacityLitres } = req.body;
    const set = {};
    if (name !== undefined) set.name = name;
    if (phone !== undefined) set.phone = phone;
    if (isActive !== undefined) set.isActive = isActive;
    if (vehicleNumber !== undefined) set['fulfillerProfile.vehicleNumber'] = vehicleNumber;
    if (capacityLitres !== undefined) set['fulfillerProfile.capacityLitres'] = Number(capacityLitres);
    const user = await User.findByIdAndUpdate(req.params.id, { $set: set }, { new: true }).select('-password');
    if (!user) return res.status(404).json({ success: false, error: 'Fulfiller not found' });
    res.json({ success: true, data: user });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update fulfiller' });
  }
};

// Approve a partner application → activate the account.
const approveFulfiller = async (req, res) => {
  try {
    const user = await User.findOneAndUpdate(
      { _id: req.params.id, role: 'fulfiller' },
      {
        $set: {
          isActive: true,
          'fulfillerProfile.applicationStatus': 'approved',
          'fulfillerProfile.reviewedAt': new Date(),
          'fulfillerProfile.rejectionReason': null,
        },
      },
      { new: true }
    ).select('-password');
    if (!user) return res.status(404).json({ success: false, error: 'Partner not found' });
    res.json({ success: true, data: user });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to approve partner' });
  }
};

// Reject a partner application (keeps the record + reason; login stays blocked).
const rejectFulfiller = async (req, res) => {
  try {
    const reason = (req.body.reason || '').trim();
    const user = await User.findOneAndUpdate(
      { _id: req.params.id, role: 'fulfiller' },
      {
        $set: {
          isActive: false,
          'fulfillerProfile.applicationStatus': 'rejected',
          'fulfillerProfile.reviewedAt': new Date(),
          'fulfillerProfile.rejectionReason': reason || 'Not specified',
        },
      },
      { new: true }
    ).select('-password');
    if (!user) return res.status(404).json({ success: false, error: 'Partner not found' });
    res.json({ success: true, data: user });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to reject partner' });
  }
};

// KYC documents for one partner — metadata + short-lived presigned image URLs
// (the bucket is private, so these links are the only way to view the docs) plus
// the bank/settlement details an admin needs alongside verification.
const getFulfillerKyc = async (req, res) => {
  try {
    const user = await User.findOne({ _id: req.params.id, role: 'fulfiller' }).select(
      'name email phone fulfillerProfile.kyc fulfillerProfile.bank'
    );
    if (!user) return res.status(404).json({ success: false, error: 'Partner not found' });

    const k = user.fulfillerProfile?.kyc || {};
    const sign = (key) => (storage.isConfigured() && key ? storage.signedGetUrl(key) : Promise.resolve(null));
    const [panUrl, dlFrontUrl, dlBackUrl] = await Promise.all([
      sign(k.panKey),
      sign(k.dlFrontKey),
      sign(k.dlBackKey),
    ]);

    res.json({
      success: true,
      data: {
        status: k.status || 'not_submitted',
        panNumber: k.panNumber || '',
        dlNumber: k.dlNumber || '',
        submittedAt: k.submittedAt || null,
        reviewedAt: k.reviewedAt || null,
        rejectionReason: k.rejectionReason || '',
        panUrl,
        dlFrontUrl,
        dlBackUrl,
        bank: user.fulfillerProfile?.bank || null,
        storageConfigured: storage.isConfigured(),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to load KYC documents' });
  }
};

// Mark a partner's KYC verified (all three documents must be present).
const verifyFulfillerKyc = async (req, res) => {
  try {
    const user = await User.findOne({ _id: req.params.id, role: 'fulfiller' }).select('fulfillerProfile.kyc');
    if (!user) return res.status(404).json({ success: false, error: 'Partner not found' });
    const k = user.fulfillerProfile?.kyc || {};
    if (!(k.panKey && k.dlFrontKey && k.dlBackKey)) {
      return res
        .status(400)
        .json({ success: false, error: 'PAN, licence front and licence back must all be uploaded before verifying.' });
    }
    const updated = await User.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          'fulfillerProfile.kyc.status': 'verified',
          'fulfillerProfile.kyc.reviewedAt': new Date(),
          'fulfillerProfile.kyc.rejectionReason': null,
        },
      },
      { new: true }
    ).select('-password');
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to verify documents' });
  }
};

// Reject a partner's KYC (records the reason, pulls them offline — they can't be
// online without verified docs — and lets them re-upload).
const rejectFulfillerKyc = async (req, res) => {
  try {
    const reason = (req.body.reason || '').trim();
    const user = await User.findOneAndUpdate(
      { _id: req.params.id, role: 'fulfiller' },
      {
        $set: {
          'fulfillerProfile.kyc.status': 'rejected',
          'fulfillerProfile.kyc.reviewedAt': new Date(),
          'fulfillerProfile.kyc.rejectionReason': reason || 'Documents could not be verified.',
          'fulfillerProfile.isOnline': false,
        },
      },
      { new: true }
    ).select('-password');
    if (!user) return res.status(404).json({ success: false, error: 'Partner not found' });
    res.json({ success: true, data: user });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to reject documents' });
  }
};

// Permanently remove a partner record (e.g. spam/duplicate applications).
const deleteFulfiller = async (req, res) => {
  try {
    const user = await User.findOneAndDelete({ _id: req.params.id, role: 'fulfiller' });
    if (!user) return res.status(404).json({ success: false, error: 'Partner not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to delete partner' });
  }
};

// Instant (ride-hailing) requests dashboard
const getDeliveryRequests = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = {};
    if (status) filter.status = status;
    const requests = await DeliveryRequest.find(filter)
      .populate('customerId', 'name phone email')
      .populate('fulfillerId', 'name phone fulfillerProfile.vehicleNumber')
      .populate('productId', 'name unit')
      .sort({ createdAt: -1 })
      .limit(100);
    res.json({ success: true, data: requests });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch delivery requests' });
  }
};

module.exports = {
  getAllOrders,
  updateOrderStatus,
  getOrderCandidates,
  assignDriver,
  getSlots,
  createSlot,
  updateSlot,
  createProduct,
  updateProduct,
  createFulfiller,
  listFulfillers,
  updateFulfiller,
  approveFulfiller,
  rejectFulfiller,
  deleteFulfiller,
  getFulfillerKyc,
  verifyFulfillerKyc,
  rejectFulfillerKyc,
  getDeliveryRequests,
};
