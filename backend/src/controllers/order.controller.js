const Order = require('../models/Order.model');
const Product = require('../models/Product.model');
const SlotConfig = require('../models/SlotConfig.model');
const { sendOrderConfirmed } = require('../services/whatsapp');
const geo = require('../services/geo');
const payments = require('../services/payments');
const pricing = require('../shared/pricing');
const promotions = require('../services/promotions');
const localities = require('../shared/localities');

const createOrder = async (req, res) => {
  let feeWaived = false; // a customer free booking reserved (credited back if create fails)
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

    // Launch offer: atomically reserve a free booking (waives the platform fee).
    // Placed after all validations so an early return never leaks a reservation.
    feeWaived = await promotions.reserveFreeBooking(req.user._id);
    const q = pricing.quote(fareSubtotal, { waivePlatformFee: feeWaived });

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
      feeWaived,
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
    // The order never persisted — give the reserved free booking back.
    if (feeWaived) await promotions.creditFreeBooking(req.user._id).catch(() => {});
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

    // Atomically CLAIM the cancellation on the still-cancellable states. If a concurrent
    // admin delivery/cancel won the race, bail with NO side effects — otherwise we'd
    // release a slot, refund, or restore a free booking against an order that actually
    // completed (mirrors the guarded DeliveryRequest cancel in DispatchManager).
    const updated = await Order.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id, status: { $in: ['pending', 'confirmed'] } },
      {
        status: 'cancelled',
        $push: { statusLog: { status: 'cancelled', changedAt: new Date(), changedBy: req.user._id } },
      },
      { new: true }
    );
    if (!updated) {
      return res.status(409).json({ success: false, error: 'Order cannot be cancelled at this stage' });
    }

    // Side effects — only now that WE own the cancellation. Release the slot if this
    // order held a reservation (the atomic claim guarantees this runs at most once).
    if (updated.slotReserved) {
      await SlotConfig.findByIdAndUpdate(updated.slotId, { $inc: { currentBooked: -1 } });
    }

    // Pay-at-completion: a cancellable order is normally unpaid. If it was paid online,
    // refund in full — atomically claiming paymentStatus paid→refunded so concurrent
    // paths can never double-refund the same payment.
    if (updated.paymentStatus === 'paid' && updated.totalAmount > 0 && updated.razorpayPaymentId) {
      const claimed = await Order.findOneAndUpdate(
        { _id: updated._id, paymentStatus: 'paid' },
        { paymentStatus: 'refunded', refundedAmount: updated.totalAmount },
        { new: true }
      ).catch(() => null);
      if (claimed) {
        const ok = await payments.refund(updated.razorpayPaymentId, updated.totalAmount);
        if (ok) {
          updated.paymentStatus = 'refunded';
          updated.refundedAmount = updated.totalAmount;
        } else {
          // Gateway failed — release the claim so a later attempt can retry.
          await Order.updateOne({ _id: updated._id }, { paymentStatus: 'paid', refundedAmount: 0 }).catch(() => {});
        }
      }
    }

    // Order didn't complete — give any reserved free booking back (idempotent).
    await promotions.restoreFreeBooking(updated, 'order');
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
