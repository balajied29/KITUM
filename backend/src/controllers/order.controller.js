const Order = require('../models/Order.model');
const Product = require('../models/Product.model');
const SlotConfig = require('../models/SlotConfig.model');
const { sendOrderConfirmed } = require('../services/whatsapp');
const geo = require('../services/geo');
const payments = require('../services/payments');
const pricing = require('../shared/pricing');
const localities = require('../shared/localities');

const createOrder = async (req, res) => {
  try {
    const { items, slotId, deliveryAddress, paymentMode, coordinates } = req.body;

    if (!slotId) {
      return res.status(400).json({ success: false, error: 'Delivery slot is required' });
    }

    // Accountability gate — repeated cancels/no-shows temporarily block new bookings.
    if (req.user.bookingBlockedUntil && req.user.bookingBlockedUntil > new Date()) {
      return res.status(403).json({ success: false, error: 'Your account is temporarily restricted from booking due to repeated cancellations. Please contact support.' });
    }

    // Nothing is charged at booking (payment is collected at completion), so every
    // order reserves its slot now — atomically, no race, regardless of method.
    const slot = await SlotConfig.findOneAndUpdate(
      { _id: slotId, blocked: false, $expr: { $lt: ['$currentBooked', '$maxCapacity'] } },
      { $inc: { currentBooked: 1 } },
      { new: true }
    );
    if (!slot) {
      return res.status(400).json({ success: false, error: 'Slot not available or fully booked' });
    }

    let fareSubtotal = 0;
    const resolvedItems = [];
    let requiredLitres = 0; // largest tanker line — the truck size this order needs

    for (const item of items) {
      const product = await Product.findById(item.productId);
      if (!product || !product.active) {
        await SlotConfig.findByIdAndUpdate(slotId, { $inc: { currentBooked: -1 } }); // release the reservation
        return res.status(400).json({ success: false, error: `Product not available: ${item.productId}` });
      }
      resolvedItems.push({ productId: product._id, quantity: item.quantity, pricePerUnit: product.price });
      fareSubtotal += product.price * item.quantity;
      if (product.tankerLitres > requiredLitres) requiredLitres = product.tankerLitres;
    }

    const q = pricing.quote(fareSubtotal);

    // Scheduled-matching fields (docs/scheduled-dispatch.md §Phase A). Cheap fields
    // are computed inline; the geocode is best-effort (geo.geocode fails soft → null).
    let localityId = localities.localityIdForText(deliveryAddress?.locality) || undefined;
    if (!localityId && deliveryAddress) {
      // No explicit locality (e.g. map pin / current location) — recover it from
      // the geocoded address line so scheduled dispatch can still match an area.
      const detected = localities.detectFromText(deliveryAddress.street);
      if (detected) {
        localityId = detected;
        if (!deliveryAddress.locality) deliveryAddress.locality = localities.byId(detected)?.name;
      }
    }
    let deliveryPoint;
    if (
      Array.isArray(coordinates) && coordinates.length === 2 &&
      typeof coordinates[0] === 'number' && typeof coordinates[1] === 'number'
    ) {
      // Precise [lng, lat] from the map pick / saved address — no geocode needed.
      deliveryPoint = { type: 'Point', coordinates: [coordinates[0], coordinates[1]] };
    } else {
      const geoQuery = [deliveryAddress?.street, deliveryAddress?.landmark, deliveryAddress?.locality, 'Shillong, Meghalaya, India']
        .filter(Boolean)
        .join(', ');
      const hit = await geo.geocode(geoQuery);
      if (hit) deliveryPoint = { type: 'Point', coordinates: [hit.lng, hit.lat] };
    }

    // Confirmed at creation for both methods — payment is collected at delivery.
    const order = await Order.create({
      userId:          req.user._id,
      items:           resolvedItems,
      slotId,
      deliveryAddress,
      localityId,
      deliveryPoint,
      requiredLitres,
      paymentMode,
      totalAmount:       q.total,
      fare:              q.fare,
      platformFee:       q.platformFee,
      partnerCommission: q.partnerCommission,
      partnerPayout:     q.partnerPayout,
      status:            'confirmed',
      paymentStatus:     'unpaid',
      slotReserved:      true,
      statusLog: [{ status: 'confirmed', changedAt: new Date(), changedBy: req.user._id }],
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

/** Parse a slot's start into epoch ms (slot.date + a "7:00 AM" startTime). Null if unparseable. */
function slotStartMs(slot) {
  if (!slot?.date) return null;
  const d = new Date(slot.date);
  const m = String(slot.startTime || '').match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!m) return d.getTime();
  let h = Number(m[1]);
  const min = Number(m[2]);
  const ap = (m[3] || '').toUpperCase();
  if (ap === 'PM' && h < 12) h += 12;
  if (ap === 'AM' && h === 12) h = 0;
  // startTime is an IST wall-clock time; slot.date is the UTC-midnight delivery day.
  // Set the clock time in UTC, then shift back by IST's +05:30 so the result is the
  // correct instant regardless of the server's timezone (production is often UTC).
  d.setUTCHours(h, min, 0, 0);
  return d.getTime() - 330 * 60 * 1000;
}

const cancelOrder = async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, userId: req.user._id });
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }
    if (!['pending', 'confirmed'].includes(order.status)) {
      return res.status(400).json({ success: false, error: 'Order cannot be cancelled at this stage' });
    }

    // Release capacity only if this order actually holds a reservation — otherwise
    // a payment that landed after the slot filled (slotReserved:false) would drive
    // currentBooked negative.
    if (order.slotReserved) {
      await SlotConfig.findByIdAndUpdate(order.slotId, { $inc: { currentBooked: -1 } });
    }

    const set = {
      status: 'cancelled',
      $push: { statusLog: { status: 'cancelled', changedAt: new Date(), changedBy: req.user._id } },
    };

    // Staged refund of what was paid online (prepaid total / COD ₹99 advance),
    // non-linear by time remaining until the slot. (KitUm-side failures refund in
    // full elsewhere; this is a customer-initiated cancellation.)
    const onlinePaid =
      order.paymentStatus === 'paid' ? order.totalAmount
      : order.paymentStatus === 'advance_paid' ? order.advance
      : 0;
    if (onlinePaid > 0 && order.razorpayPaymentId) {
      const slot = await SlotConfig.findById(order.slotId).lean().catch(() => null);
      const startMs = slotStartMs(slot);
      const hoursToSlot = startMs != null ? (startMs - Date.now()) / 3600000 : null;
      const refund = pricing.refundAmount(onlinePaid, pricing.scheduledRefundFraction(hoursToSlot));
      if (refund > 0) {
        const ok = await payments.refund(order.razorpayPaymentId, refund);
        if (ok) {
          set.paymentStatus = 'refunded';
          set.refundedAmount = refund;
        }
      }
    }

    const updated = await Order.findByIdAndUpdate(order._id, set, { new: true });
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
      .populate('driverAssigned', 'name phone fulfillerProfile.rating fulfillerProfile.ratingCount');
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }
    res.json({ success: true, data: order });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch order' });
  }
};

module.exports = { createOrder, cancelOrder, getUserOrders, getOrderById };
