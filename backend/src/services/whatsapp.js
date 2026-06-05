/**
 * WhatsApp notifications via Interakt API.
 * All functions fail silently — WhatsApp is non-critical and must never block order flow.
 *
 * Docs: https://developers.interakt.ai/
 * Set INTERAKT_API_KEY in .env
 */

const INTERAKT_URL = 'https://api.interakt.ai/v1/public/message/';

async function sendTemplate(phone, templateName, bodyValues = []) {
  if (!process.env.INTERAKT_API_KEY || !phone) return;

  try {
    await fetch(INTERAKT_URL, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${process.env.INTERAKT_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        countryCode: '+91',
        phoneNumber: phone,
        callbackData: templateName,
        type: 'Template',
        template: {
          name: templateName,
          languageCode: 'en',
          bodyValues,
        },
      }),
    });
  } catch {
    // Swallow — notification failure must not affect order flow
  }
}

/**
 * @param {string} phone        - customer phone e.g. "9876543210"
 * @param {string} orderId      - short order ID (last 6 chars)
 * @param {string} slotLabel    - e.g. "Morning (7:00 AM – 9:00 AM)"
 */
function sendOrderConfirmed(phone, orderId, slotLabel) {
  return sendTemplate(phone, 'order_confirmed', [orderId, slotLabel]);
}

/**
 * @param {string} phone
 * @param {string} orderId
 */
function sendOutForDelivery(phone, orderId) {
  return sendTemplate(phone, 'out_for_delivery', [orderId]);
}

/**
 * @param {string} phone
 * @param {string} orderId
 */
function sendDelivered(phone, orderId) {
  return sendTemplate(phone, 'order_delivered', [orderId]);
}

/* ---------- Instant (ride-hailing) flow templates ---------- */

/**
 * A fulfiller accepted the instant request and is on the way.
 * @param {string} phone        - customer phone
 * @param {string} requestId    - short request ID
 * @param {string} fulfillerName
 * @param {string} etaMin       - estimated minutes
 */
function sendFulfillerAssigned(phone, requestId, fulfillerName, etaMin) {
  return sendTemplate(phone, 'fulfiller_assigned', [requestId, fulfillerName, String(etaMin)]);
}

/**
 * @param {string} phone
 * @param {string} requestId
 */
function sendFulfillerArriving(phone, requestId) {
  return sendTemplate(phone, 'fulfiller_arriving', [requestId]);
}

/**
 * @param {string} phone
 * @param {string} requestId
 */
function sendDeliveryCompleted(phone, requestId) {
  return sendTemplate(phone, 'delivery_completed', [requestId]);
}

module.exports = {
  sendOrderConfirmed,
  sendOutForDelivery,
  sendDelivered,
  sendFulfillerAssigned,
  sendFulfillerArriving,
  sendDeliveryCompleted,
};
