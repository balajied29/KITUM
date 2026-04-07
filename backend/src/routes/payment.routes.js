const router = require('express').Router();
const { createRazorpayOrder, handleWebhook } = require('../controllers/payment.controller');
const { protect } = require('../middleware/auth.middleware');

// Webhook uses raw body (mounted before express.json() in index.js)
router.post('/webhook', handleWebhook);
router.post('/create', protect, createRazorpayOrder);

module.exports = router;
