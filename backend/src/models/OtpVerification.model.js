const mongoose = require('mongoose');

// OTP documents auto-delete after 10 minutes via TTL index
const otpVerificationSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
  },
  otpHash: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 600, // TTL: 600 seconds = 10 minutes
  },
});

module.exports = mongoose.model('OtpVerification', otpVerificationSchema);
