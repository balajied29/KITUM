/**
 * Dynamically loads the Razorpay checkout script and opens the payment modal.
 * Returns a promise that resolves with the payment response on success,
 * or rejects if the user dismisses or payment fails.
 */

function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

/**
 * @param {object} opts
 * @param {string} opts.razorpayOrderId   - from POST /api/payments/create
 * @param {number} opts.amount            - in paise (e.g. 24000 = ₹240)
 * @param {string} opts.keyId             - Razorpay key_id
 * @param {string} opts.name              - customer name
 * @param {string} opts.email             - customer email
 * @param {string} [opts.phone]           - customer phone (optional)
 * @param {string} opts.description       - order description
 * @returns {Promise<{ razorpay_payment_id, razorpay_order_id, razorpay_signature }>}
 */
export function openRazorpayCheckout(opts) {
  return new Promise(async (resolve, reject) => {
    const loaded = await loadRazorpayScript();
    if (!loaded) return reject(new Error('Failed to load Razorpay SDK'));

    const rzp = new window.Razorpay({
      key: opts.keyId,
      amount: opts.amount,
      currency: 'INR',
      order_id: opts.razorpayOrderId,
      name: 'KIT UM',
      description: opts.description || 'Water delivery order',
      prefill: {
        name: opts.name || '',
        email: opts.email || '',
        contact: opts.phone || '',
      },
      theme: { color: '#1d4ed8' },
      modal: {
        ondismiss: () => reject(new Error('Payment cancelled by user')),
      },
      handler: (response) => resolve(response),
    });

    rzp.open();
  });
}
