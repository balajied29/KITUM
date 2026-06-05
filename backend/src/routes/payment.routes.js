const router = require('express').Router();
const {
  createRazorpayOrder,
  createRequestPayment,
  verifyOrderPayment,
  verifyRequestPayment,
  handleWebhook,
} = require('../controllers/payment.controller');
const { protect } = require('../middleware/auth.middleware');

// Webhook uses raw body (mounted before express.json() in index.js)
router.post('/webhook', handleWebhook);

// Scheduled flow — create the UPI order to pay at delivery, then confirm it
router.post('/create', protect, createRazorpayOrder);
router.post('/orders/verify', protect, verifyOrderPayment);

// Instant flow — create the UPI order to pay at the door, then confirm it
router.post('/requests/create', protect, createRequestPayment);
router.post('/requests/verify', protect, verifyRequestPayment);

module.exports = router;
