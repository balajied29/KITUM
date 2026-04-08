const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User.model');
const OtpVerification = require('../models/OtpVerification.model');
const { sendOtpEmail } = require('../services/mailer');

const generateOtp = () => String(Math.floor(100000 + Math.random() * 900000));

const sendOtp = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, error: 'Email is required' });
    }

    const otp = generateOtp();
    const otpHash = await bcrypt.hash(otp, 10);

    await OtpVerification.deleteMany({ email });
    await OtpVerification.create({ email, otpHash });
    await sendOtpEmail(email, otp);

    res.json({ success: true, data: { message: 'OTP sent to ' + email } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to send OTP', detail: err.message });
  }
};

const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ success: false, error: 'Email and OTP are required' });
    }

    const record = await OtpVerification.findOne({ email });
    if (!record) {
      return res.status(400).json({ success: false, error: 'OTP expired or not found' });
    }

    const valid = await bcrypt.compare(String(otp), record.otpHash);
    if (!valid) {
      return res.status(400).json({ success: false, error: 'Invalid OTP' });
    }

    await OtpVerification.deleteMany({ email });

    // Upsert: create user on first login, return existing on subsequent logins
    const user = await User.findOneAndUpdate(
      { email },
      { $setOnInsert: { email } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    });

    res.json({ success: true, data: { token, user } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Verification failed' });
  }
};

const getMe = async (req, res) => {
  res.json({ success: true, data: req.user });
};

module.exports = { sendOtp, verifyOtp, getMe };
