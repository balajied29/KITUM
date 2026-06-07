const mongoose = require('mongoose');
const { REQUEST_STATUS } = require('../shared/constants');

const STATUSES = Object.values(REQUEST_STATUS);

/** Audit trail of dispatch offers (who it was sent to and what happened). */
const offerSchema = new mongoose.Schema(
  {
    fulfillerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    round: { type: Number }, // 1 = nearest-first, 2+ = broadcast rounds
    sentAt: { type: Date, default: Date.now },
    outcome: {
      type: String,
      enum: ['offered', 'accepted', 'rejected', 'timeout', 'closed'],
      default: 'offered',
    },
  },
  { _id: false }
);

const statusLogSchema = new mongoose.Schema(
  {
    status: { type: String, enum: STATUSES, required: true },
    changedAt: { type: Date, default: Date.now },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { _id: false }
);

/**
 * An instant, on-demand water-tanker delivery (the ride-hailing flow).
 * Deliberately separate from the scheduled `Order` model.
 */
const deliveryRequestSchema = new mongoose.Schema(
  {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // Tanker size — reuses the existing Product catalogue.
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    capacityLitres: { type: Number, required: true }, // denormalised for matching
    quantity: { type: Number, default: 1, min: 1 },

    dropLocation: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], required: true }, // [lng, lat]
      address: String,
      flat: String,        // house / flat / building no. (optional)
      landmark: String,
      directions: String,  // optional free note for the driver
      name: String,
      phone: String,
    },

    status: {
      type: String,
      enum: STATUSES,
      default: REQUEST_STATUS.SEARCHING,
    },

    fulfillerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    offers: { type: [offerSchema], default: [] },

    // Money breakdown — see shared/pricing.js. `amount` is the customer's grand
    // total (fare + platformFee), collected AT COMPLETION (cash, or UPI at the door).
    pricing: {
      amount: { type: Number, required: true }, // grand total = fare + platformFee
      fare: { type: Number }, // tanker subtotal (Σ price × qty)
      platformFee: { type: Number }, // 5% surcharge (KitUm revenue)
      partnerCommission: { type: Number }, // 5% of fare, kept by KitUm
      partnerPayout: { type: Number }, // fare − commission — what the partner earns
      feeWaived: { type: Boolean, default: false }, // launch offer: platform fee waived (a free booking was reserved)
      feeWaiverRestored: { type: Boolean, default: false }, // reserved free booking given back (didn't complete)
      dryRunFee: { type: Number, default: 0 }, // driver's earning if this ends as a customer no-show
      distanceKm: { type: Number },
      etaMin: { type: Number },
    },

    paymentMode: { type: String, enum: ['upi', 'cod'], required: true },
    // Collected at completion. unpaid → paid; refunded only for a rare post-payment reversal.
    paymentStatus: { type: String, enum: ['unpaid', 'paid', 'refunded'], default: 'unpaid' },
    refundedAmount: { type: Number, default: 0 }, // rupees actually refunded (audit)
    razorpayOrderId: String,
    razorpayPaymentId: String, // the UPI-at-door payment (receipts / refunds)

    statusLog: { type: [statusLogSchema], default: [] },

    ratings: {
      customerToFulfiller: { type: Number, min: 1, max: 5 },
      fulfillerToCustomer: { type: Number, min: 1, max: 5 },
    },

    completedAt: { type: Date },

    // Set when a driver reports the customer as unreachable at the drop (terminal
    // customer_no_show). Captures the proof we gated on, for admin audit/disputes.
    noShowReport: {
      reason: { type: String, trim: true }, // no_answer | unreachable | not_at_location | refused
      at: { type: Date },
      callAttempted: { type: Boolean, default: false },
      coordinates: { type: [Number] }, // [lng, lat] — driver's position when reported
    },
  },
  { timestamps: true }
);

// Recovery sweep + admin dashboards query active requests by status frequently.
deliveryRequestSchema.index({ status: 1, createdAt: -1 });
deliveryRequestSchema.index({ customerId: 1, createdAt: -1 });
deliveryRequestSchema.index({ fulfillerId: 1, createdAt: -1 });

module.exports = mongoose.model('DeliveryRequest', deliveryRequestSchema);
