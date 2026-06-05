const mongoose = require('mongoose');
const Review = require('../models/Review.model');
const Order = require('../models/Order.model');
const DeliveryRequest = require('../models/DeliveryRequest.model');
const User = require('../models/User.model');

/** Recompute a partner's average from their PUBLISHED reviews (source of truth). */
async function recomputeFulfillerRating(fulfillerId) {
  const agg = await Review.aggregate([
    { $match: { fulfillerId: new mongoose.Types.ObjectId(String(fulfillerId)), status: 'published' } },
    { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);
  const count = agg[0]?.count || 0;
  const avg = agg[0]?.avg || 5;
  await User.updateOne(
    { _id: fulfillerId },
    {
      'fulfillerProfile.rating': count ? Math.round(avg * 10) / 10 : 5,
      'fulfillerProfile.ratingCount': count,
    }
  ).catch(() => {});
}

/** Load + validate a completed delivery owned by the customer. */
async function loadCompletedDelivery(source, id, userId) {
  if (source === 'request') {
    const r = await DeliveryRequest.findOne({ _id: id, customerId: userId }).select('status fulfillerId');
    if (!r) return { code: 404, error: 'Delivery not found.' };
    if (r.status !== 'completed') return { code: 400, error: 'You can review once the delivery is completed.' };
    if (!r.fulfillerId) return { code: 400, error: 'No delivery partner to review.' };
    return { driverId: r.fulfillerId };
  }
  if (source === 'order') {
    const o = await Order.findOne({ _id: id, userId }).select('status driverAssigned');
    if (!o) return { code: 404, error: 'Delivery not found.' };
    if (o.status !== 'delivered') return { code: 400, error: 'You can review once the delivery is completed.' };
    if (!o.driverAssigned) return { code: 400, error: 'No delivery partner to review.' };
    return { driverId: o.driverAssigned };
  }
  return { code: 400, error: 'Invalid review target.' };
}

/* ---------------- Customer ---------------- */

const createReview = async (req, res) => {
  try {
    const { source, id, rating, comment, tags } = req.body;
    const r = Number(rating);
    if (!(r >= 1 && r <= 5)) return res.status(400).json({ success: false, error: 'Rating must be between 1 and 5.' });
    if (!['order', 'request'].includes(source) || !mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, error: 'Invalid review target.' });
    }

    const del = await loadCompletedDelivery(source, id, req.user._id);
    if (del.error) return res.status(del.code).json({ success: false, error: del.error });

    const cleanTags = Array.isArray(tags) ? tags.filter((t) => Review.TAGS.includes(t)).slice(0, 6) : [];

    const review = await Review.create({
      customerId: req.user._id,
      fulfillerId: del.driverId,
      source,
      orderId: source === 'order' ? id : undefined,
      requestId: source === 'request' ? id : undefined,
      rating: r,
      comment: (comment || '').toString().trim().slice(0, 1000) || undefined,
      tags: cleanTags,
      status: 'published',
    });

    // Keep the legacy instant-flow field in sync (read elsewhere for back-compat).
    if (source === 'request') {
      await DeliveryRequest.updateOne({ _id: id }, { 'ratings.customerToFulfiller': r }).catch(() => {});
    }
    await recomputeFulfillerRating(del.driverId);

    res.status(201).json({ success: true, data: review });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, error: 'You’ve already reviewed this delivery.' });
    }
    res.status(500).json({ success: false, error: 'Could not submit your review.' });
  }
};

/** Has the customer already reviewed this delivery? (drives the form vs thank-you). */
const getMyReviewFor = async (req, res) => {
  try {
    const { source, id } = req.query;
    if (!['order', 'request'].includes(source) || !mongoose.isValidObjectId(id)) {
      return res.json({ success: true, data: null });
    }
    const filter = { customerId: req.user._id, ...(source === 'order' ? { orderId: id } : { requestId: id }) };
    const review = await Review.findOne(filter);
    res.json({ success: true, data: review });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to load review.' });
  }
};

/* ---------------- Admin ---------------- */

const adminListReviews = async (req, res) => {
  try {
    const { status, rating, fulfillerId } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (rating) filter.rating = Number(rating);
    if (fulfillerId && mongoose.isValidObjectId(fulfillerId)) filter.fulfillerId = fulfillerId;

    const reviews = await Review.find(filter)
      .populate('customerId', 'name email')
      .populate('fulfillerId', 'name fulfillerProfile.vehicleNumber fulfillerProfile.rating fulfillerProfile.ratingCount')
      .sort({ createdAt: -1 })
      .limit(200);
    res.json({ success: true, data: reviews });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to load reviews.' });
  }
};

const adminSetReviewStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!Review.STATUSES.includes(status)) return res.status(400).json({ success: false, error: 'Invalid status.' });
    const review = await Review.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!review) return res.status(404).json({ success: false, error: 'Review not found.' });
    // Hiding/publishing changes the partner's published average — recompute.
    await recomputeFulfillerRating(review.fulfillerId);
    res.json({ success: true, data: review });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update review.' });
  }
};

module.exports = { createReview, getMyReviewFor, adminListReviews, adminSetReviewStatus, recomputeFulfillerRating };
