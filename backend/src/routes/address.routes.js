const router = require('express').Router();
const { listAddresses, createAddress, updateAddress, deleteAddress } = require('../controllers/address.controller');
const { protect } = require('../middleware/auth.middleware');

router.use(protect);
router.get('/', listAddresses);
router.post('/', createAddress);
router.patch('/:id', updateAddress);
router.delete('/:id', deleteAddress);

module.exports = router;
