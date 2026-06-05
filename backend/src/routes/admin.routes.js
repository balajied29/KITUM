const router = require('express').Router();
const { protect, adminOnly } = require('../middleware/auth.middleware');
const {
  getAllOrders,
  updateOrderStatus,
  getOrderCandidates,
  assignDriver,
  getSlots,
  createSlot,
  updateSlot,
  createProduct,
  updateProduct,
  createFulfiller,
  listFulfillers,
  updateFulfiller,
  approveFulfiller,
  rejectFulfiller,
  deleteFulfiller,
  getFulfillerKyc,
  verifyFulfillerKyc,
  rejectFulfillerKyc,
  getDeliveryRequests,
} = require('../controllers/admin.controller');
const {
  adminListTickets,
  adminGetTicket,
  adminReplyTicket,
  adminUpdateTicketStatus,
} = require('../controllers/support.controller');
const { adminListReviews, adminSetReviewStatus } = require('../controllers/review.controller');

router.use(protect, adminOnly);

router.get('/orders', getAllOrders);
router.get('/orders/:id/candidates', getOrderCandidates);
router.patch('/orders/:id/status', updateOrderStatus);
router.patch('/orders/:id/driver', assignDriver);

router.get('/slots', getSlots);
router.post('/slots', createSlot);
router.patch('/slots/:id', updateSlot);

router.post('/products', createProduct);
router.patch('/products/:id', updateProduct);

// Fulfillers (tanker operators / partners) + instant requests
router.get('/fulfillers', listFulfillers);
router.post('/fulfillers', createFulfiller);
router.patch('/fulfillers/:id', updateFulfiller);
router.post('/fulfillers/:id/approve', approveFulfiller);
router.post('/fulfillers/:id/reject', rejectFulfiller);
router.get('/fulfillers/:id/kyc', getFulfillerKyc);
router.post('/fulfillers/:id/kyc/verify', verifyFulfillerKyc);
router.post('/fulfillers/:id/kyc/reject', rejectFulfillerKyc);
router.delete('/fulfillers/:id', deleteFulfiller);
router.get('/requests', getDeliveryRequests);

// Support tickets
router.get('/tickets', adminListTickets);
router.get('/tickets/:id', adminGetTicket);
router.post('/tickets/:id/messages', adminReplyTicket);
router.patch('/tickets/:id/status', adminUpdateTicketStatus);

// Reviews (moderation)
router.get('/reviews', adminListReviews);
router.patch('/reviews/:id/status', adminSetReviewStatus);

module.exports = router;
