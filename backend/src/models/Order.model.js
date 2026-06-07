const mongoose = require('mongoose');

// Customer-facing fulfilment statuses + driver-allocation (assignment) statuses
// share one audit timeline. See docs/scheduled-dispatch.md §1.
const ORDER_STATUSES = ['pending', 'confirmed', 'out_for_delivery', 'delivered', 'cancelled'];
const ASSIGNMENT_STATUSES = [
  'unassigned', 'reserved', 'searching', 'offered',
  'assigned', 'en_route', 'arrived', 'completed', 'no_show', 'unfulfilled',
];

const statusLogSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      required: true,
      enum: [...ORDER_STATUSES, ...ASSIGNMENT_STATUSES],
    },
    changedAt: {
      type: Date,
      default: Date.now,
    },
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { _id: false }
);

// Audit trail of scheduled-dispatch offers (mirrors DeliveryRequest.offers[]).
// Also the data source for the scorer's reliability term.
const orderOfferSchema = new mongoose.Schema(
  {
    driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    round: { type: Number },
    sentAt: { type: Date, default: Date.now },
    outcome: {
      type: String,
      enum: ['offered', 'accepted', 'rejected', 'timeout', 'no_show', 'closed'],
    },
    decidedAt: { type: Date },
  },
  { _id: false }
);

const orderItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    pricePerUnit: {
      type: Number,
      required: true,
    },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    items: {
      type: [orderItemSchema],
      required: true,
      validate: (v) => Array.isArray(v) && v.length > 0,
    },
    slotId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SlotConfig',
      required: true,
    },
    deliveryAddress: {
      name: String,
      phone: String,
      flat: String,        // house / flat / building no. (optional but recommended)
      street: String,      // map-detected street/area line
      landmark: String,    // optional nearby landmark
      directions: String,  // optional free note for the driver
      locality: String,    // derived from the chosen area (not re-asked)
    },
    // Normalized locality id (from shared/localities.js) — the matching key for
    // scheduled driver service-area lookup. Derived from deliveryAddress.locality.
    localityId: {
      type: String,
      index: true,
    },
    // Geocoded delivery point [lng, lat] — for the Phase-B proximity/route term.
    // Best-effort; may be null if geocoding failed (scorer degrades gracefully).
    deliveryPoint: {
      type: { type: String, enum: ['Point'], default: undefined },
      coordinates: { type: [Number], default: undefined }, // [lng, lat]
    },
    // Tanker volume this order needs (max tanker line; 0 ⇒ bottled-only, not a
    // tanker delivery). Denormalized from items for fast matching.
    requiredLitres: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'out_for_delivery', 'delivered', 'cancelled'],
      default: 'pending',
    },
    paymentMode: {
      type: String,
      enum: ['upi', 'cod'],
      required: true,
    },
    // Collected at completion (cash, or UPI at the door). unpaid → paid; refunded
    // only for a rare post-payment reversal.
    paymentStatus: {
      type: String,
      enum: ['unpaid', 'paid', 'refunded'],
      default: 'unpaid',
    },
    refundedAmount: { type: Number, default: 0 }, // rupees actually refunded (audit)
    // Whether this order actually holds a slot capacity unit. True once reserved
    // (pure-cash COD at creation, or any order after its payment confirmed). Cancel
    // only releases capacity when this is true — so a payment that landed after the
    // slot filled can't drive currentBooked negative.
    slotReserved: { type: Boolean, default: false },
    razorpayOrderId: {
      type: String,
    },
    razorpayPaymentId: {
      type: String, // online payment (COD advance or prepaid full) — target for refunds
    },
    driverAssigned: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    // Driver-allocation state machine, separate from the customer-facing `status`.
    assignmentStatus: {
      type: String,
      enum: ASSIGNMENT_STATUSES,
      default: 'unassigned',
    },
    // Phase-A advisory earmark (best-fit driver at booking; NOT a commitment).
    tentativeDriverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    assignedAt: { type: Date },
    // No-show watchdog deadline (= slot start). If the driver hasn't started by
    // startBy + grace, the order is re-dispatched. See docs/scheduled-dispatch.md §8.
    startBy: { type: Date },
    offers: {
      type: [orderOfferSchema],
      default: [],
    },
    statusLog: {
      type: [statusLogSchema],
      default: [],
    },
    // Money breakdown — see shared/pricing.js. `totalAmount` is the customer's
    // grand total (fare + platformFee); components drive payments/payouts/refunds.
    totalAmount: {
      type: Number,
      required: true, // grand total = fare + platformFee
    },
    fare: { type: Number }, // tanker subtotal (Σ price × qty)
    platformFee: { type: Number }, // 5% surcharge (KitUm revenue)
    partnerCommission: { type: Number }, // 5% of fare, kept by KitUm
    partnerPayout: { type: Number }, // fare − commission — what the partner earns
    feeWaived: { type: Boolean, default: false }, // launch offer: platform fee waived (a free booking was reserved)
    feeWaiverRestored: { type: Boolean, default: false }, // reserved free booking given back (order didn't complete)
  },
  { timestamps: true }
);

// Phase-B slot solve: fetch the slot's open orders.
orderSchema.index({ slotId: 1, assignmentStatus: 1 });
// Per-driver in-slot load + no-show watchdog scans.
orderSchema.index({ driverAssigned: 1, slotId: 1 });
orderSchema.index({ assignmentStatus: 1, startBy: 1 });
// Preferred-driver lookup: this customer's past delivered orders.
orderSchema.index({ userId: 1, status: 1 });

module.exports = mongoose.model('Order', orderSchema);
module.exports.ORDER_STATUSES = ORDER_STATUSES;
module.exports.ASSIGNMENT_STATUSES = ASSIGNMENT_STATUSES;
