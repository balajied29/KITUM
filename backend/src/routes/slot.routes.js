const router = require('express').Router();
const { getSlotsByDate } = require('../controllers/slot.controller');

router.get('/', getSlotsByDate);

module.exports = router;
