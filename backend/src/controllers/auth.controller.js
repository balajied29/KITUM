const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const User = require('../models/User.model');
const tokens = require('../services/tokens');
const storage = require('../services/storage');
const promotions = require('../services/promotions');
const { sendPasswordResetEmail } = require('../services/mailer');
const { canAuthenticate } = require('../middleware/auth.middleware');
const Address = require('../models/Address.model');
const Order = require('../models/Order.model');
const DeliveryRequest = require('../models/DeliveryRequest.model');
const SupportTicket = require('../models/SupportTicket.model');
const { REQUEST_STATUS } = require('../shared/constants');
const { scrubSensitive } = require('../services/fieldCrypto');

// multipart image mimetype → file extension (for the signup selfie).
const MIME_EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic', 'image/heif': 'heif' };

const hashToken = (raw) => crypto.createHmac('sha256', process.env.JWT_SECRET).update(raw).digest('hex');
const clientBase = () => (process.env.CLIENT_URL || 'http://localhost:3000').split(',')[0].trim();

// Never return the password hash to clients.
const sanitize = (u) => {
  const o = u?.toObject ? u.toObject() : { ...(u || {}) };
  delete o.password;
  return scrubSensitive(o);
};

const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ success: false, error: 'Name, email and password are required.' });
    if (password.length < 6)
      return res.status(400).json({ success: false, error: 'Password must be at least 6 characters.' });

    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing && existing.password)
      return res.status(409).json({ success: false, error: 'An account with this email already exists.' });

    const hashed = await bcrypt.hash(password, 10);

    let user;
    if (existing) {
      existing.password = hashed;
      if (name) existing.name = name;
      await existing.save();
      user = existing;
    } else {
      user = await User.create({ name, email, password: hashed });
    }

    // Launch offer: enroll new customers into the first-K-bookings-free perk
    // (idempotent — claimSlot no-ops if they already hold a grant or the cap is full).
    await promotions.grantCustomerPerk(user._id).catch(() => {});
    const fresh = await User.findById(user._id);

    const pair = await tokens.issuePair(user._id);
    res.status(201).json({ success: true, data: { ...pair, user: sanitize(fresh || user) } });
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
    if (!valid) return res.status(401).json({ success: false, error: 'Invalid email or password.' });
    if (!canAuthenticate(user)) {
      const rejected = user.role === 'fulfiller' && user.fulfillerProfile?.applicationStatus === 'rejected';
      return res.status(403).json({
        success: false,
        error: rejected ? 'Your partner application was not approved.' : 'This account is disabled.',
      });
    }

    const pair = await tokens.issuePair(user._id);
    res.json({ success: true, data: { ...pair, user: sanitize(user) } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Login failed. Please try again.' });
  }
};

/** Exchange a refresh token for a new access+refresh pair (rotation). */
const refresh = async (req, res) => {
  try {
    const rotated = await tokens.rotateRefreshToken(req.body.refreshToken);
    if (!rotated) return res.status(401).json({ success: false, error: 'Session expired. Please sign in again.' });

    const user = await User.findById(rotated.userId).select('-password');
    if (!user || !user.isActive) {
      await tokens.revokeAllForUser(rotated.userId);
      return res.status(401).json({ success: false, error: 'Session expired. Please sign in again.' });
    }
    res.json({
      success: true,
      data: { accessToken: rotated.accessToken, refreshToken: rotated.refreshToken, user: scrubSensitive(user.toObject()) },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Could not refresh session.' });
  }
};

/** Revoke the presented refresh token (sign out). */
const logout = async (req, res) => {
  if (req.body.refreshToken) await tokens.revokeRefreshToken(req.body.refreshToken);
  res.json({ success: true });
};

const getMe = async (req, res) => {
  const u = req.user.toObject ? req.user.toObject() : req.user;
  delete u.password;
  res.json({ success: true, data: scrubSensitive(u) });
};

/** Update the signed-in user's editable profile fields (name, phone). */
const updateMe = async (req, res) => {
  try {
    const { name, phone } = req.body;
    const set = {};
    if (name !== undefined) set.name = String(name).trim();
    if (phone !== undefined) set.phone = String(phone).trim();
    if (Object.keys(set).length === 0) {
      return res.status(400).json({ success: false, error: 'Nothing to update.' });
    }
    const user = await User.findByIdAndUpdate(req.user._id, { $set: set }, { new: true }).select('-password');
    if (!user) return res.status(404).json({ success: false, error: 'User not found.' });
    res.json({ success: true, data: user });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Could not update your profile.' });
  }
};

/**
 * Partner (fulfiller) self-application. Creates a fulfiller account with
 * applicationStatus:'pending' and isActive:false (never a dispatch candidate),
 * but issues a session so the applicant lands straight in the awaiting-approval
 * dashboard and can watch their status. An admin approves/rejects via
 * POST /admin/fulfillers/:id/approve|reject. Rejected accounts can no longer log in.
 */
const partnerSignup = async (req, res) => {
  try {
    const { name, email, password, phone, vehicleNumber, capacityLitres } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ success: false, error: 'Name, email and password are required.' });
    if (password.length < 6)
      return res.status(400).json({ success: false, error: 'Password must be at least 6 characters.' });
    // A live profile photo (camera selfie) is mandatory for identity verification.
    if (!req.file)
      return res.status(400).json({ success: false, error: 'A profile photo is required.' });

    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing)
      return res.status(409).json({ success: false, error: 'An account with this email already exists.' });

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      email,
      password: hashed,
      phone,
      role: 'fulfiller',
      isActive: false, // pending admin verification — never a dispatch candidate
      fulfillerProfile: {
        vehicleNumber,
        capacityLitres: Number(capacityLitres) || 0,
        isOnline: false,
        isAvailable: true,
        applicationStatus: 'pending',
        appliedAt: new Date(),
      },
    });

    // Store the selfie privately + record its key. Best-effort: a storage hiccup
    // (or no storage in dev) must not block the application.
    if (storage.isConfigured()) {
      try {
        const ext = MIME_EXT[req.file.mimetype] || 'jpg';
        const key = storage.photoKey(user._id, ext, Date.now());
        await storage.putObject(key, req.file.buffer, req.file.mimetype);
        user.fulfillerProfile.photoKey = key;
        await user.save();
      } catch (e) {
        console.error('signup photo upload failed:', e);
      }
    }

    // Issue a session so the applicant lands straight in the (gated) dashboard
    // and can track their approval status.
    const pair = await tokens.issuePair(user._id);
    res.status(201).json({ success: true, data: { ...pair, user: sanitize(user), pending: true } });
  } catch (err) {
    console.error('partnerSignup failed:', err);
    res.status(500).json({ success: false, error: 'Could not submit your application. Please try again.' });
  }
};

/** Start a password reset. Always 200 — never reveal whether the email exists. */
const forgotPassword = async (req, res) => {
  try {
    const email = (req.body.email || '').toLowerCase().trim();
    const user = email ? await User.findOne({ email }) : null;

    if (user && user.password) {
      const raw = crypto.randomBytes(32).toString('hex');
      user.resetTokenHash = hashToken(raw);
      user.resetExpiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      await user.save();

      const link = `${clientBase()}/reset-password?token=${raw}`;
      sendPasswordResetEmail(user.email, link).catch(() => {});
      // Dev convenience: surface the link when SMTP isn't configured.
      if (process.env.NODE_ENV !== 'production') console.log(`[password-reset] ${user.email}: ${link}`);
    }

    res.json({ success: true });
  } catch (err) {
    res.json({ success: true }); // still don't leak
  }
};

/** Complete a password reset and sign the user back in. */
const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ success: false, error: 'Token and password are required.' });
    if (password.length < 6) return res.status(400).json({ success: false, error: 'Password must be at least 6 characters.' });

    const user = await User.findOne({
      resetTokenHash: hashToken(token),
      resetExpiresAt: { $gt: new Date() },
    });
    if (!user) return res.status(400).json({ success: false, error: 'This reset link is invalid or has expired.' });

    user.password = await bcrypt.hash(password, 10);
    user.resetTokenHash = null;
    user.resetExpiresAt = null;
    await user.save();

    // Security: a password change invalidates every existing session.
    await tokens.revokeAllForUser(user._id);

    const pair = await tokens.issuePair(user._id);
    res.json({ success: true, data: { ...pair, user: sanitize(user) } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Could not reset password. Please try again.' });
  }
};

/**
 * Self-service account deletion — DPDP Act 2023 §12 (right to erasure) and the
 * Google Play account-deletion requirement. We:
 *   1. refuse while a delivery is in flight (erasure may be deferred where data is
 *      still needed for an ongoing service);
 *   2. purge sensitive documents (selfie, PAN, licence) from private storage;
 *   3. revoke every session;
 *   4. hard-delete records that exist only for this user (saved addresses);
 *   5. SCRUB personal data from records we must retain for tax/dispute reasons
 *      (orders, delivery requests, support) — keeping the financial record, removing PII;
 *   6. anonymise the User row itself (kept only as an FK target for the scrubbed
 *      records) and mark it deletedAt so it can never authenticate again.
 */
const TERMINAL_REQ = [REQUEST_STATUS.COMPLETED, REQUEST_STATUS.CANCELLED, REQUEST_STATUS.NO_FULFILLER];
const ACTIVE_ORDER = ['pending', 'confirmed', 'out_for_delivery'];

const deleteMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ success: false, error: 'User not found.' });

    const uid = user._id;
    const fp = user.fulfillerProfile || {};

    // 1) Refuse while a transaction is in flight.
    if (user.role === 'fulfiller') {
      const onJob = fp.currentRequestId || (await DeliveryRequest.exists({ fulfillerId: uid, status: { $nin: TERMINAL_REQ } }));
      if (onJob)
        return res.status(409).json({ success: false, error: 'Finish or release your active delivery before deleting your account.' });
    } else {
      const [activeOrder, activeReq] = await Promise.all([
        Order.exists({ userId: uid, status: { $in: ACTIVE_ORDER } }),
        DeliveryRequest.exists({ customerId: uid, status: { $nin: TERMINAL_REQ } }),
      ]);
      if (activeOrder || activeReq)
        return res.status(409).json({ success: false, error: 'You have a delivery in progress. Please wait until it completes before deleting your account.' });
    }

    // 2) Purge sensitive documents from private storage (best-effort; never throws).
    if (storage.isConfigured()) {
      await Promise.all(
        [fp.photoKey, fp.kyc?.panKey, fp.kyc?.dlFrontKey, fp.kyc?.dlBackKey].filter(Boolean).map((k) => storage.deleteObject(k))
      );
    }

    // 3) Revoke every session.
    await tokens.revokeAllForUser(uid);

    // 4) + 5) Delete user-only records; scrub PII from retained transactional records.
    const REDACT = '[deleted]';
    await Promise.all([
      Address.deleteMany({ userId: uid }),
      SupportTicket.updateMany({ userId: uid }, { $set: { contactPhone: null } }),
      Order.updateMany(
        { userId: uid },
        {
          $set: { 'delivery.name': REDACT, 'delivery.phone': null, 'delivery.address': REDACT, 'delivery.landmark': null, 'delivery.directions': null },
          $unset: { 'delivery.coordinates': '' },
        }
      ),
      DeliveryRequest.updateMany(
        { customerId: uid },
        { $set: { 'drop.name': REDACT, 'drop.phone': null, 'drop.address': REDACT, 'drop.landmark': null, 'drop.directions': null } }
      ),
    ]);

    // 6) Anonymise the User row. Email → unique tombstone (the unique index holds,
    //    and the address is erased); password → an unusable random hash.
    const set = {
      email: `deleted+${uid}@deleted.kitum.invalid`,
      name: 'Deleted user',
      phone: null,
      locality: null,
      password: await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 10),
      isActive: false,
      deletedAt: new Date(),
      resetTokenHash: null,
      resetExpiresAt: null,
    };
    const unset = {};
    if (user.role === 'fulfiller') {
      set['fulfillerProfile.isOnline'] = false;
      set['fulfillerProfile.isAvailable'] = false;
      Object.assign(unset, {
        'fulfillerProfile.photoKey': '',
        'fulfillerProfile.expoPushToken': '',
        'fulfillerProfile.kyc': '',
        'fulfillerProfile.bank': '',
        'fulfillerProfile.currentLocation': '',
        'fulfillerProfile.basePoint': '',
        'fulfillerProfile.currentRequestId': '',
      });
    }
    await User.updateOne({ _id: uid }, { $set: set, ...(Object.keys(unset).length ? { $unset: unset } : {}) });

    res.json({ success: true });
  } catch (err) {
    console.error('deleteMe failed:', err);
    res.status(500).json({ success: false, error: 'Could not delete your account. Please try again.' });
  }
};

module.exports = { register, login, refresh, logout, getMe, updateMe, deleteMe, forgotPassword, resetPassword, partnerSignup };
