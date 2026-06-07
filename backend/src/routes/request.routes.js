const router = require('express').Router();
const { body } = require('express-validator');
const {
  createRequest,
  getMyRequests,
  getRequestById,
  cancelRequest,
  rateRequest,
  getAvailability,
} = require('../controllers/request.controller');
const { protect } = require('../middleware/auth.middleware');
const { requestLimiter } = require('../middleware/rateLimit');
const { validate } = require('../middleware/validate');

// PUBLIC: nearby-availability counts (cached snapshot, no sensitive data). Defined
// before `protect` so the home can show "tankers nearby" without an auth round-trip.
router.get('/availability', getAvailability);

router.use(protect);

router.post(
  '/',
  requestLimiter,
  body('productId').isMongoId().withMessage('Invalid tanker selected'),
  body('quantity').optional().isInt({ min: 1, max: 50 }).withMessage('Quantity must be 1–50'),
  body('paymentMode').optional().isIn(['cod', 'upi']).withMessage('Invalid payment mode'),
  body('dropLocation.coordinates').custom((v) => {
    if (!Array.isArray(v) || v.length !== 2) throw new Error('Location must be [lng, lat]');
    const [lng, lat] = v.map(Number);
    if ([lng, lat].some(Number.isNaN) || lng < -180 || lng > 180 || lat < -90 || lat > 90) {
      throw new Error('Location coordinates are out of range');
    }
    return true;
  }),
  validate,
  createRequest
);

router.get('/', getMyRequests);
router.get('/:id', getRequestById);
router.post('/:id/cancel', cancelRequest);
router.post('/:id/rate', rateRequest);

module.exports = router;
