const mongoose = require('mongoose');

// Quick-pick feedback tags (whitelist — anything else is dropped server-side).
const TAGS = ['On time', 'Polite', 'Clean water', 'Careful handling', 'Good communication', 'Fair pricing'];
const STATUSES = ['published', 'hidden'];

/**
 * A customer's review of a delivery partner for ONE completed delivery — works
 * across both flows (instant DeliveryRequest + scheduled Order). The customer's
 * star rating feeds the partner's running average (User.fulfillerProfile.rating).
 */
const reviewSchema = new mongoose.Schema(
  {
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    fulfillerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    source: { type: String, enum: ['order', 'request'], required: true },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    requestId: { type: mongoose.Schema.Types.ObjectId, ref: 'DeliveryRequest' },

    rating: { type: Number, min: 1, max: 5, required: true },
    comment: { type: String, trim: true, maxlength: 1000 },
    tags: { type: [String], default: [] },

    status: { type: String, enum: STATUSES, default: 'published' }, // moderation
  },
  { timestamps: true }
);

// One review per delivery (each delivery has a single customer).
reviewSchema.index({ orderId: 1 }, { unique: true, sparse: true });
reviewSchema.index({ requestId: 1 }, { unique: true, sparse: true });
// Driver review lists + average recompute.
reviewSchema.index({ fulfillerId: 1, status: 1, createdAt: -1 });

const Review = mongoose.model('Review', reviewSchema);
Review.TAGS = TAGS;
Review.STATUSES = STATUSES;
module.exports = Review;
