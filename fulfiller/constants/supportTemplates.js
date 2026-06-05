/**
 * Partner support templates — pre-fill a ticket's subject/body from a chosen
 * topic. `category` must be one of the backend SupportTicket enum values
 * (delivery | payment | quality | scheduling | account | other).
 */
export const SUPPORT_TEMPLATES = [
  {
    group: 'Payments & settlement',
    items: [
      { id: 'settlement-missing', category: 'payment', label: 'Settlement not received', subject: 'Settlement not received', body: 'I haven’t received my settlement for completed deliveries. Please check.' },
      { id: 'settlement-amount', category: 'payment', label: 'Wrong settlement amount', subject: 'Incorrect settlement amount', body: 'The settled amount doesn’t match my completed deliveries.\n\nDetails: ' },
      { id: 'bank-update', category: 'payment', label: 'Bank / UPI not working', subject: 'Issue with settlement details', body: 'I’m having trouble saving or using my bank/UPI details for settlement.' },
    ],
  },
  {
    group: 'Account & verification',
    items: [
      { id: 'kyc-pending', category: 'account', label: 'KYC verification pending', subject: 'KYC verification pending', body: 'My documents have been under review for a while. Please help verify my account.' },
      { id: 'kyc-rejected', category: 'account', label: 'My KYC was rejected', subject: 'KYC rejected — need help', body: 'My documents were rejected. Please tell me what to correct so I can re-upload.' },
      { id: 'cant-go-online', category: 'account', label: 'Can’t go online', subject: 'Unable to go online', body: 'I’m approved but can’t go online. Please help.' },
      { id: 'profile-update', category: 'account', label: 'Update vehicle / profile', subject: 'Update my profile', body: 'I need to update my vehicle/profile details.\n\nWhat to change: ' },
    ],
  },
  {
    group: 'Deliveries & app',
    items: [
      { id: 'job-issue', category: 'delivery', label: 'Issue with a delivery', subject: 'Issue with a delivery', body: 'I had a problem with a delivery.\n\nWhat happened: ' },
      { id: 'app-issue', category: 'other', label: 'App not working', subject: 'App technical issue', body: 'The app isn’t working as expected.\n\nWhat happens: ' },
      { id: 'other', category: 'other', label: 'Something else', subject: '', body: '' },
    ],
  },
];

export const findTemplate = (id) => {
  for (const g of SUPPORT_TEMPLATES) {
    const item = g.items.find((i) => i.id === id);
    if (item) return item;
  }
  return null;
};
