const mongoose = require('mongoose');

const slotConfigSchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: true,
    },
    slotLabel: {
      type: String,
      required: true,
      enum: ['Morning', 'Afternoon', 'Evening'],
    },
    startTime: {
      type: String,
      required: true, // e.g. "7:00 AM"
    },
    endTime: {
      type: String,
      required: true, // e.g. "9:00 AM"
    },
    maxCapacity: {
      type: Number,
      required: true,
    },
    currentBooked: {
      type: Number,
      default: 0,
    },
    blocked: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Prevent duplicate slots for the same date + label
slotConfigSchema.index({ date: 1, slotLabel: 1 }, { unique: true });

module.exports = mongoose.model('SlotConfig', slotConfigSchema);
