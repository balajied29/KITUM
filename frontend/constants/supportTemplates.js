// Templated support topics. `category` must match the backend SupportTicket enum.
// `needsOrder` surfaces the "related order" picker. `body` pre-fills the message.
const SUPPORT_TEMPLATES = [
  {
    group: 'Delivery & fulfillment',
    items: [
      { id: 'not-delivered', category: 'delivery', label: 'Order not delivered',
        subject: 'My order was not delivered',
        body: 'My order was not delivered. What happened:\n\n', needsOrder: true },
      { id: 'driver-late', category: 'delivery', label: 'Driver late / didn’t arrive',
        subject: 'Delivery partner is late or didn’t arrive',
        body: 'My delivery partner is late / did not arrive. Details:\n\n', needsOrder: true },
      { id: 'missed-slot', category: 'scheduling', label: 'Tanker missed my slot',
        subject: 'Tanker missed my scheduled slot',
        body: 'My scheduled tanker did not arrive within the booked slot.\n\n', needsOrder: true },
      { id: 'wrong-quality', category: 'quality', label: 'Wrong quantity or water quality',
        subject: 'Issue with quantity or water quality',
        body: 'There was a problem with the quantity/quality delivered:\n\n', needsOrder: true },
      { id: 'reschedule', category: 'scheduling', label: 'Cancel or reschedule',
        subject: 'Cancel or reschedule my order',
        body: 'I’d like to cancel/reschedule my order. Details:\n\n', needsOrder: true },
    ],
  },
  {
    group: 'Payments & refunds',
    items: [
      { id: 'paid-not-confirmed', category: 'payment', label: 'Paid online but order not confirmed',
        subject: 'Paid online but my order isn’t confirmed',
        body: 'I paid online but my order is not confirmed.\nPayment time:\nUPI / Txn reference:\n', needsOrder: true },
      { id: 'money-deducted', category: 'payment', label: 'Money deducted, payment failed',
        subject: 'Money deducted but payment failed',
        body: 'Money was deducted but the payment shows as failed.\nAmount:\nTime:\nUPI / Txn reference:\n', needsOrder: false },
      { id: 'refund', category: 'payment', label: 'Refund not received',
        subject: 'Refund not received',
        body: 'I haven’t received a refund I was expecting.\nAmount:\n', needsOrder: true },
      { id: 'wrong-amount', category: 'payment', label: 'Charged the wrong amount',
        subject: 'Charged the wrong amount',
        body: 'I was charged an incorrect amount.\nExpected: ₹\nCharged: ₹\n', needsOrder: true },
    ],
  },
  {
    group: 'Account & other',
    items: [
      { id: 'account', category: 'account', label: 'Update my account details',
        subject: 'Help updating my account',
        body: 'I need help with my account details:\n\n', needsOrder: false },
      { id: 'other', category: 'other', label: 'Something else',
        subject: '', body: '', needsOrder: false },
    ],
  },
];

export const findTemplate = (id) =>
  SUPPORT_TEMPLATES.flatMap((g) => g.items).find((t) => t.id === id) || null;

export default SUPPORT_TEMPLATES;
