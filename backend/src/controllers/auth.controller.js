const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User.model');

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ success: false, error: 'Name, email and password are required.' });
    if (password.length < 6)
      return res.status(400).json({ success: false, error: 'Password must be at least 6 characters.' });

    const existing = await User.findOne({ email: email.toLowerCase().trim() });

    // Account exists with a password — block duplicate registration
    if (existing && existing.password)
      return res.status(409).json({ success: false, error: 'An account with this email already exists.' });

    const hashed = await bcrypt.hash(password, 10);

    // Account exists without a password (created via old OTP system) — set password now
    let user;
    if (existing) {
      existing.password = hashed;
      if (name) existing.name = name;
      await existing.save();
      user = existing;
    } else {
      user = await User.create({ name, email, password: hashed });
    }

    const token = signToken(user._id);
    res.status(201).json({ success: true, data: { token, user } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Registration failed. Please try again.' });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ success: false, error: 'Email and password are required.' });

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user || !user.password)
      return res.status(401).json({ success: false, error: 'Invalid email or password.' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid)
      return res.status(401).json({ success: false, error: 'Invalid email or password.' });

    const token = signToken(user._id);
    res.json({ success: true, data: { token, user } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Login failed. Please try again.' });
  }
};

const getMe = async (req, res) => {
  res.json({ success: true, data: req.user });
};

module.exports = { register, login, getMe };
