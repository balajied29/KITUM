const router = require('express').Router();
const {
  createTicket,
  getMyTickets,
  getTicket,
  replyTicket,
  closeTicket,
} = require('../controllers/support.controller');
const { protect } = require('../middleware/auth.middleware');

router.use(protect);

router.post('/', createTicket);
router.get('/', getMyTickets);
router.get('/:id', getTicket);
router.post('/:id/messages', replyTicket);
router.patch('/:id/close', closeTicket);

module.exports = router;
