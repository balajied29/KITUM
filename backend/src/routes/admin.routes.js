const router = require('express').Router();
const { protect, adminOnly } = require('../middleware/auth.middleware');
const {
  getAllOrders,
  updateOrderStatus,
  assignDriver,
  getSlots,
  createSlot,
  updateSlot,
  createProduct,
  updateProduct,
} = require('../controllers/admin.controller');

router.use(protect, adminOnly);

router.get('/orders', getAllOrders);
router.patch('/orders/:id/status', updateOrderStatus);
router.patch('/orders/:id/driver', assignDriver);

router.get('/slots', getSlots);
router.post('/slots', createSlot);
router.patch('/slots/:id', updateSlot);

router.post('/products', createProduct);
router.patch('/products/:id', updateProduct);

module.exports = router;
