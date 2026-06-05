const mongoose = require('mongoose');

/**
 * Live operational profile for a fulfiller (tanker operator).
 * Embedded on the User to avoid an extra join on the hot dispatch path.
 */
const fulfillerProfileSchema = new mongoose.Schema(
  {
    vehicleNumber: { type: String, trim: true },
    // Litres this tanker can carry — used to match against requested size.
    capacityLitres: { type: Number, default: 0 },

    // Profile selfie captured (camera-only) at signup — private storage object key,
    // used for identity verification during admin review. View via a presigned URL.
    photoKey: { type: String },

    isOnline: { type: Boolean, default: false }, // accepting work at all
    isAvailable: { type: Boolean, default: true }, // not currently on a job

    // GeoJSON Point — note coordinates are [lng, lat] (MongoDB convention).
    // `type` default is undefined (NOT 'Point') so a fulfiller created without a
    // live location doesn't get a phantom { type:'Point' } that the 2dsphere index
    // rejects on insert. Writers always set both type + coordinates.
    currentLocation: {
      type: { type: String, enum: ['Point'], default: undefined },
      coordinates: { type: [Number], default: undefined }, // [lng, lat]
    },
    lastLocationAt: { type: Date },

    expoPushToken: { type: String }, // for background push offers

    // The request this fulfiller is actively serving (guards double-assign).
    currentRequestId: { type: mongoose.Schema.Types.ObjectId, ref: 'DeliveryRequest' },

    rating: { type: Number, default: 5 },
    ratingCount: { type: Number, default: 0 },
    // Instant-flow no-shows: accepted a job then never started it (reclaimed by the
    // dispatch watchdog). Repeat offenders can be deprioritised / reviewed.
    noShowCount: { type: Number, default: 0 },

    /* ----- Scheduled-flow service area + capacity (docs/scheduled-dispatch.md) ----- */
    // Locality ids (from shared/localities.js) this operator will serve for
    // SCHEDULED bookings. Empty ⇒ not eligible for any scheduled order yet.
    serviceLocalities: { type: [String], default: [] },
    // Subset of serviceLocalities that are this operator's home turf (full affinity).
    primaryZones: { type: [String], default: [] },
    // Max deliveries completable in one slot — DERIVED from refill+travel time, not
    // a vanity number. Defaults to SCHED.DEFAULT_TRIPS_PER_SLOT until the refill model lands.
    tripsPerSlot: { type: Number, default: 4 },
    // Optional home/base for the Phase-A proximity proxy (no live GPS at booking time).
    basePoint: {
      type: { type: String, enum: ['Point'], default: undefined },
      coordinates: { type: [Number], default: undefined }, // [lng, lat]
    },

    // Scheduled reliability counters (data source for the scorer's reliability term).
    schedOfferCount: { type: Number, default: 0 },
    schedAcceptCount: { type: Number, default: 0 },
    schedAssignedCount: { type: Number, default: 0 },
    schedNoShowCount: { type: Number, default: 0 },

    // Partner application lifecycle. Self-signups start 'pending'; admin-created
    // and seeded fulfillers are 'approved'. Admin review sets approved/rejected.
    applicationStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'approved' },
    appliedAt: { type: Date },
    reviewedAt: { type: Date },
    rejectionReason: { type: String, trim: true },

    // KYC documents (PAN + driver's licence). The image bytes live in private
    // object storage (R2/S3); we keep only the opaque object keys + the
    // admin-driven verification state here. A partner cannot go online until
    // kyc.status === 'verified' (see canGoOnline in auth.middleware).
    kyc: {
      panNumber: { type: String, trim: true, uppercase: true },
      panKey: { type: String }, // storage object key for the PAN card image
      dlNumber: { type: String, trim: true, uppercase: true },
      dlFrontKey: { type: String }, // licence front image
      dlBackKey: { type: String }, // licence back image
      status: {
        type: String,
        enum: ['not_submitted', 'pending', 'verified', 'rejected'],
        default: 'not_submitted',
      },
      submittedAt: { type: Date }, // when all three docs were last submitted for review
      reviewedAt: { type: Date },
      rejectionReason: { type: String, trim: true },
    },

    // Settlement bank details for batch payouts processed on our end. Visible to
    // the owning partner and to admins only — never returned on customer-facing
    // populates. Not required to go online; we nudge for it via a marquee.
    bank: {
      accountHolder: { type: String, trim: true },
      accountNumber: { type: String, trim: true },
      ifsc: { type: String, trim: true, uppercase: true },
      bankName: { type: String, trim: true },
      upiId: { type: String, trim: true },
      updatedAt: { type: Date },
    },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    locality: {
      type: String,
      trim: true,
    },
    role: {
      type: String,
      enum: ['customer', 'admin', 'driver', 'fulfiller'],
      default: 'customer',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    // Password reset (email link) — stores only the hash of the reset token.
    resetTokenHash: { type: String, default: null },
    resetExpiresAt: { type: Date, default: null },

    // Customer accountability (no upfront payment, so we deter abuse instead of
    // pre-charging): cancellations after a driver was assigned + no-show deliveries.
    // Past a threshold the customer is temporarily blocked from booking.
    cancelStrikes: { type: Number, default: 0 },
    bookingBlockedUntil: { type: Date, default: null },
    // Times this customer was unreachable at the drop after a driver arrived.
    customerNoShowCount: { type: Number, default: 0 },
    // Only populated for role === 'fulfiller'.
    fulfillerProfile: {
      type: fulfillerProfileSchema,
      default: undefined,
    },
  },
  { timestamps: true }
);

// Geospatial index powering the nearest-tanker ($near) query in dispatch.
userSchema.index({ 'fulfillerProfile.currentLocation': '2dsphere' });

// Scheduled-flow eligibility query: active fulfillers that serve a given locality.
userSchema.index({ role: 1, isActive: 1, 'fulfillerProfile.serviceLocalities': 1 });

module.exports = mongoose.model('User', userSchema);
