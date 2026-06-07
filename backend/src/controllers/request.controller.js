const DeliveryRequest = require('../models/DeliveryRequest.model');
const Product = require('../models/Product.model');
const User = require('../models/User.model');
const dispatch = require('../services/dispatch/DispatchManager');
const pricing = require('../shared/pricing');
const promotions = require('../services/promotions');
const { REQUEST_STATUS } = require('../shared/constants');

/** Pull the litre capacity out of a product's `unit` string ("1000 Litres" → 1000). */
function parseLitres(unit) {
  const m = String(unit || '').match(/(\d[\d,]*)/);
  return m ? Number(m[1].replace(/,/g, '')) : 0;
}

/** Create an instant on-demand request and kick off dispatch. */
const createRequest = async (req, res) => {
  let feeWaived = false; // a customer free booking reserved (credited back if create fails)
  try {
    const { productId, quantity = 1, dropLocation, paymentMode = 'cod' } = req.body;

    if (!productId || !dropLocation?.coordinates?.length || !paymentMode) {
      return res.status(400).json({ success: false, error: 'productId, dropLocation and paymentMode are required' });
    }
    const [lng, lat] = dropLocation.coordinates;
    if (typeof lng !== 'number' || typeof lat !== 'number') {
      return res.status(400).json({ success: false, error: 'dropLocation.coordinates must be [lng, lat] numbers' });
    }

    // Accountability gate — repeated cancels/no-shows temporarily block new bookings
    // (we collect nothing upfront, so this is how abuse is deterred).
    if (req.user.bookingBlockedUntil && req.user.bookingBlockedUntil > new Date()) {
      return res.status(403).json({ success: false, error: 'Your account is temporarily restricted from booking due to repeated cancellations. Please contact support.' });
    }

    const product = await Product.findById(productId);
    if (!product || !product.active) {
      return res.status(400).json({ success: false, error: 'Tanker not available' });
    }
    if (!/tanker/i.test(product.name)) {
      return res.status(400).json({ success: false, error: 'Instant delivery is only available for tankers' });
    }

    const capacityLitres = parseLitres(product.unit);
    const fare = product.price * quantity;
    // Launch offer: atomically reserve a free booking (waives the platform fee).
    feeWaived = await promotions.reserveFreeBooking(req.user._id);
    const q = pricing.quote(fare, { waivePlatformFee: feeWaived });

    // Nothing is charged at booking — payment is collected at completion (cash, or
    // UPI at the door). So both methods dispatch immediately.
    const request = await DeliveryRequest.create({
      customerId: req.user._id,
      productId,
      capacityLitres,
      quantity,
      dropLocation: {
        type: 'Point',
        coordinates: [lng, lat],
        address: dropLocation.address,
        flat: dropLocation.flat,
        landmark: dropLocation.landmark,
        directions: dropLocation.directions,
        name: dropLocation.name || req.user.name,
        phone: dropLocation.phone || req.user.phone,
      },
      pricing: {
        amount: q.total,
        fare: q.fare,
        platformFee: q.platformFee,
        partnerCommission: q.partnerCommission,
        partnerPayout: q.partnerPayout,
        feeWaived,
      },
      paymentMode,
      status: REQUEST_STATUS.SEARCHING,
      statusLog: [{ status: REQUEST_STATUS.SEARCHING, changedAt: new Date(), changedBy: req.user._id }],
    });

    dispatch.dispatch(request);
    res.status(201).json({ success: true, data: request });
  } catch (err) {
    // The request never persisted — give the reserved free booking back.
    if (feeWaived) await promotions.creditFreeBooking(req.user._id).catch(() => {});
    res.status(500).json({ success: false, error: 'Failed to create request' });
  }
};

const getMyRequests = async (req, res) => {
  try {
    const requests = await DeliveryRequest.find({ customerId: req.user._id })
      .populate('productId', 'name unit')
      .populate('fulfillerId', 'name phone fulfillerProfile.vehicleNumber fulfillerProfile.rating')
      .sort({ createdAt: -1 })
      .limit(50);
    res.json({ success: true, data: requests });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch requests' });
  }
};

const getRequestById = async (req, res) => {
  try {
    const request = await DeliveryRequest.findOne({ _id: req.params.id, customerId: req.user._id })
      .populate('productId', 'name unit')
      .populate('fulfillerId', 'name phone fulfillerProfile.vehicleNumber fulfillerProfile.rating');
    if (!request) return res.status(404).json({ success: false, error: 'Request not found' });
    res.json({ success: true, data: request });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch request' });
  }
};

/** REST mirror of the socket cancel — delegates to the dispatch engine. */
const cancelRequest = async (req, res) => {
  try {
    await dispatch.handleCustomerCancel(String(req.user._id), req.params.id);
    const request = await DeliveryRequest.findById(req.params.id);
    res.json({ success: true, data: request });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to cancel request' });
  }
};

const rateRequest = async (req, res) => {
  try {
    const rating = Number(req.body.rating);
    if (!(rating >= 1 && rating <= 5)) {
      return res.status(400).json({ success: false, error: 'Rating must be between 1 and 5' });
    }
    const request = await DeliveryRequest.findOne({
      _id: req.params.id,
      customerId: req.user._id,
      status: REQUEST_STATUS.COMPLETED,
    });
    if (!request) return res.status(404).json({ success: false, error: 'Completed request not found' });

    request.ratings = { ...request.ratings, customerToFulfiller: rating };
    await request.save();

    // Update the fulfiller's running average.
    const f = await User.findById(request.fulfillerId);
    if (f?.fulfillerProfile) {
      const count = (f.fulfillerProfile.ratingCount || 0) + 1;
      const avg = ((f.fulfillerProfile.rating || 5) * (f.fulfillerProfile.ratingCount || 0) + rating) / count;
      await User.updateOne(
        { _id: f._id },
        { 'fulfillerProfile.rating': Math.round(avg * 10) / 10, 'fulfillerProfile.ratingCount': count }
      );
    }

    res.json({ success: true, data: request });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to submit rating' });
  }
};

module.exports = { createRequest, getMyRequests, getRequestById, cancelRequest, rateRequest };
