const mongoose = require('mongoose');

/** A customer's saved delivery address (Home / Work / custom). */
const addressSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    label: { type: String, trim: true }, // "Home", "Work", "Mom's place"
    type: { type: String, enum: ['home', 'work', 'other'], default: 'other' },
    address: { type: String, required: true, trim: true }, // formatted address
    landmark: { type: String, trim: true },
    contactName: { type: String, trim: true },
    contactPhone: { type: String, trim: true },
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], required: true }, // [lng, lat]
    },
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Address', addressSchema);
