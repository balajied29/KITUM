const mongoose = require('mongoose');
const SupportTicket = require('../models/SupportTicket.model');
const Order = require('../models/Order.model');
const DeliveryRequest = require('../models/DeliveryRequest.model');

const shortRef = (id) => 'WD-' + String(id).slice(-6).toUpperCase();

/* ------------------------------------------------------------------ */
/* Customer                                                           */
/* ------------------------------------------------------------------ */

const createTicket = async (req, res) => {
  try {
    const { category, topic, subject, message, related, contactPhone } = req.body;

    if (!SupportTicket.CATEGORIES.includes(category)) {
      return res.status(400).json({ success: false, error: 'Please choose what your issue is about.' });
    }
    if (!subject || !subject.trim()) return res.status(400).json({ success: false, error: 'A subject is required.' });
    if (!message || !message.trim()) return res.status(400).json({ success: false, error: 'Please describe your issue.' });

    // Optional link to one of the customer's own orders/requests ("order:<id>" | "request:<id>").
    let relatedOrderId, relatedRequestId, orderRef;
    if (related && typeof related === 'string' && related.includes(':')) {
      const [kind, id] = related.split(':');
      if (mongoose.isValidObjectId(id)) {
        if (kind === 'order') {
          const o = await Order.findOne({ _id: id, userId: req.user._id }).select('_id');
          if (o) { relatedOrderId = o._id; orderRef = shortRef(o._id); }
        } else if (kind === 'request') {
          const r = await DeliveryRequest.findOne({ _id: id, customerId: req.user._id }).select('_id');
          if (r) { relatedRequestId = r._id; orderRef = shortRef(r._id); }
        }
      }
    }

    const ticket = await SupportTicket.create({
      userId: req.user._id,
      category,
      topic: (topic || '').trim() || undefined,
      subject: subject.trim(),
      orderRef,
      relatedOrderId,
      relatedRequestId,
      contactPhone: (contactPhone || req.user.phone || '').trim() || undefined,
      messages: [{ from: 'customer', body: message.trim(), authorId: req.user._id }],
      lastReplyBy: 'customer',
      status: 'open',
    });

    res.status(201).json({ success: true, data: ticket });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Could not create your support request.' });
  }
};

const getMyTickets = async (req, res) => {
  try {
    const tickets = await SupportTicket.find({ userId: req.user._id }).sort({ updatedAt: -1 }).limit(100);
    res.json({ success: true, data: tickets });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to load your requests.' });
  }
};

const getTicket = async (req, res) => {
  try {
    const ticket = await SupportTicket.findOne({ _id: req.params.id, userId: req.user._id });
    if (!ticket) return res.status(404).json({ success: false, error: 'Request not found.' });
    res.json({ success: true, data: ticket });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to load the request.' });
  }
};

const replyTicket = async (req, res) => {
  try {
    const body = (req.body.message || '').trim();
    if (!body) return res.status(400).json({ success: false, error: 'Message cannot be empty.' });

    const ticket = await SupportTicket.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      {
        $push: { messages: { from: 'customer', body, authorId: req.user._id, at: new Date() } },
        $set: { lastReplyBy: 'customer' },
      },
      { new: true }
    );
    if (!ticket) return res.status(404).json({ success: false, error: 'Request not found.' });

    // A customer reply on a resolved/closed ticket reopens it.
    if (['resolved', 'closed'].includes(ticket.status)) {
      ticket.status = 'open';
      await ticket.save();
    }
    res.json({ success: true, data: ticket });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Could not send your message.' });
  }
};

const closeTicket = async (req, res) => {
  try {
    const ticket = await SupportTicket.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { $set: { status: 'closed' } },
      { new: true }
    );
    if (!ticket) return res.status(404).json({ success: false, error: 'Request not found.' });
    res.json({ success: true, data: ticket });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Could not close the request.' });
  }
};

/* ------------------------------------------------------------------ */
/* Admin                                                              */
/* ------------------------------------------------------------------ */

const adminListTickets = async (req, res) => {
  try {
    const { status, category } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (category) filter.category = category;
    const tickets = await SupportTicket.find(filter)
      .populate('userId', 'name email phone role')
      .sort({ updatedAt: -1 })
      .limit(200);
    res.json({ success: true, data: tickets });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to load tickets.' });
  }
};

const adminGetTicket = async (req, res) => {
  try {
    const ticket = await SupportTicket.findById(req.params.id).populate('userId', 'name email phone role');
    if (!ticket) return res.status(404).json({ success: false, error: 'Ticket not found.' });
    res.json({ success: true, data: ticket });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to load the ticket.' });
  }
};

const adminReplyTicket = async (req, res) => {
  try {
    const body = (req.body.message || '').trim();
    if (!body) return res.status(400).json({ success: false, error: 'Message cannot be empty.' });
    const ticket = await SupportTicket.findByIdAndUpdate(
      req.params.id,
      {
        $push: { messages: { from: 'support', body, authorId: req.user._id, at: new Date() } },
        $set: { lastReplyBy: 'support' },
      },
      { new: true }
    ).populate('userId', 'name email phone role');
    if (!ticket) return res.status(404).json({ success: false, error: 'Ticket not found.' });
    // Engaging an open ticket moves it to in-progress (don't downgrade resolved/closed).
    if (ticket.status === 'open') { ticket.status = 'in_progress'; await ticket.save(); }
    res.json({ success: true, data: ticket });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Could not send the reply.' });
  }
};

const adminUpdateTicketStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!SupportTicket.STATUSES.includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status.' });
    }
    const ticket = await SupportTicket.findByIdAndUpdate(
      req.params.id,
      { $set: { status } },
      { new: true }
    ).populate('userId', 'name email phone role');
    if (!ticket) return res.status(404).json({ success: false, error: 'Ticket not found.' });
    res.json({ success: true, data: ticket });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Could not update the ticket.' });
  }
};

module.exports = {
  createTicket,
  getMyTickets,
  getTicket,
  replyTicket,
  closeTicket,
  adminListTickets,
  adminGetTicket,
  adminReplyTicket,
  adminUpdateTicketStatus,
};
