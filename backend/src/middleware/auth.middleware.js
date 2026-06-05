const jwt = require('jsonwebtoken');
const User = require('../models/User.model');

/**
 * Whether a user is allowed to authenticate (hold a session).
 * A pending fulfiller may sign in to TRACK their application even though
 * isActive is false — they remain un-dispatchable everywhere because every
 * candidate query filters on isActive: true.
 */
const canAuthenticate = (user) =>
  !!user &&
  (user.isActive || (user.role === 'fulfiller' && user.fulfillerProfile?.applicationStatus === 'pending'));

/**
 * Whether a fulfiller is allowed to go ONLINE (and thus be a dispatch candidate).
 * Gated on: active account + approved application + verified KYC documents.
 * Bank details are deliberately NOT a gate — they're nudged for separately.
 */
const canGoOnline = (user) => {
  if (!user || user.role !== 'fulfiller' || !user.isActive) return false;
  const p = user.fulfillerProfile || {};
  return (p.applicationStatus || 'approved') === 'approved' && p.kyc?.status === 'verified';
};

const protect = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Not authorized, no token' });
  }
  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id);
    if (!canAuthenticate(req.user)) {
      return res.status(401).json({ success: false, error: 'User not found or inactive' });
    }
    next();
  } catch {
    res.status(401).json({ success: false, error: 'Not authorized, token failed' });
  }
};

const adminOnly = (req, res, next) => {
  if (req.user && req.user.role === 'admin') return next();
  res.status(403).json({ success: false, error: 'Access denied: Admins only' });
};

/** Restrict a route to one or more roles, e.g. restrictTo('fulfiller'). */
const restrictTo =
  (...roles) =>
  (req, res, next) => {
    if (req.user && roles.includes(req.user.role)) return next();
    res.status(403).json({ success: false, error: 'Access denied' });
  };

module.exports = { protect, adminOnly, restrictTo, canAuthenticate, canGoOnline };
