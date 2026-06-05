const mongoose = require('mongoose');

const CATEGORIES = ['delivery', 'payment', 'quality', 'scheduling', 'account', 'other'];
const STATUSES = ['open', 'in_progress', 'resolved', 'closed'];

// One message in a ticket thread (customer ↔ support).
const ticketMessageSchema = new mongoose.Schema(
  {
    from: { type: String, enum: ['customer', 'support'], required: true },
    body: { type: String, required: true, trim: true },
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const supportTicketSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    category: { type: String, enum: CATEGORIES, required: true },
    topic: { type: String, trim: true },     // the chosen template label, e.g. "Refund not received"
    subject: { type: String, required: true, trim: true },
    status: { type: String, enum: STATUSES, default: 'open' },

    // Optional links to what the ticket is about.
    orderRef: { type: String, trim: true },  // what the customer typed/selected, e.g. "WD-AB12CD"
    relatedOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    relatedRequestId: { type: mongoose.Schema.Types.ObjectId, ref: 'DeliveryRequest' },
    contactPhone: { type: String, trim: true },

    messages: { type: [ticketMessageSchema], default: [] },
    lastReplyBy: { type: String, enum: ['customer', 'support'], default: 'customer' },
  },
  { timestamps: true }
);

supportTicketSchema.index({ userId: 1, createdAt: -1 });
supportTicketSchema.index({ status: 1, createdAt: -1 });

const SupportTicket = mongoose.model('SupportTicket', supportTicketSchema);
SupportTicket.CATEGORIES = CATEGORIES;
SupportTicket.STATUSES = STATUSES;
module.exports = SupportTicket;
