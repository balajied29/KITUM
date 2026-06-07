const router = require('express').Router();
const { body } = require('express-validator');
const {
  register,
  login,
  refresh,
  logout,
  getMe,
  updateMe,
  deleteMe,
  forgotPassword,
  resetPassword,
  partnerSignup,
} = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth.middleware');
const { authLimiter } = require('../middleware/rateLimit');
const { validate } = require('../middleware/validate');
const { upload, handleUploadErrors } = require('../middleware/upload');

router.post(
  '/register',
  authLimiter,
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('A valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  validate,
  register
);

router.post(
  '/login',
  authLimiter,
  body('email').isEmail().withMessage('A valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
  validate,
  login
);

// Rotation endpoint — not rate-limited as aggressively (a busy client refreshes often).
router.post('/refresh', body('refreshToken').notEmpty(), validate, refresh);
router.post('/logout', logout);

router.post(
  '/forgot-password',
  authLimiter,
  body('email').isEmail().withMessage('A valid email is required'),
  validate,
  forgotPassword
);

router.post(
  '/reset-password',
  authLimiter,
  body('token').notEmpty().withMessage('Reset token is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  validate,
  resetPassword
);

// Partner (fulfiller) application — creates a pending account for admin review.
// multipart: a mandatory camera selfie ('photo') + the text fields. multer runs
// first so express-validator can read req.body.
router.post(
  '/partner-signup',
  authLimiter,
  handleUploadErrors(upload.single('photo')),
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('A valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  validate,
  partnerSignup
);

router.get('/me', protect, getMe);
router.patch(
  '/me',
  protect,
  body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
  body('phone').optional().trim(),
  validate,
  updateMe
);

// Self-service account deletion (DPDP §12 erasure + Play Store requirement).
router.delete('/me', protect, deleteMe);

module.exports = router;
