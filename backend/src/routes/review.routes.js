const router = require('express').Router();
const { createReview, getMyReviewFor } = require('../controllers/review.controller');
const { protect } = require('../middleware/auth.middleware');

router.use(protect);

router.post('/', createReview);
router.get('/mine', getMyReviewFor); // ?source=order|request&id=<deliveryId>

module.exports = router;
