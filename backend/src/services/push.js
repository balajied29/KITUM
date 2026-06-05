/**
 * Expo push notifications — the ONLY reliable way to alert a fulfiller when their
 * app is backgrounded or killed (a minimised app's socket + in-app audio are
 * suspended by the OS). Offers therefore ride a high-priority push on the loud
 * "offers" channel.
 *
 * Fails soft: push is redundant when the app is foregrounded (socket is primary),
 * so a failure here must never block dispatch.
 */
let Expo;
try {
  ({ Expo } = require('expo-server-sdk'));
} catch {
  Expo = null; // dependency not installed yet — degrade gracefully
}

const expo = Expo ? new Expo({ accessToken: process.env.EXPO_ACCESS_TOKEN }) : null;

// Apple's Critical Alerts entitlement (requested + approved via the developer
// portal) lets a push ring at full volume even on silent/DND. Until then we use
// time-sensitive, which breaks through Focus without any special entitlement.
const CRITICAL = process.env.EXPO_CRITICAL_ALERTS === '1' || process.env.EXPO_CRITICAL_ALERTS === 'true';

async function send(token, { title, body, data, sound, channelId, priority, interruptionLevel, ttl }) {
  if (!expo || !token || !Expo.isExpoPushToken(token)) return;
  try {
    const message = {
      to: token,
      title,
      body,
      data,
      sound: sound || 'default',
      priority: priority || 'high',
      channelId: channelId || 'default',
    };
    if (interruptionLevel) message.interruptionLevel = interruptionLevel; // iOS 15+
    if (typeof ttl === 'number') message.ttl = ttl;
    await expo.sendPushNotificationsAsync([message]);
  } catch {
    // swallow — never let a push failure break dispatch
  }
}

/** High-priority incoming-job offer (loud "offers" channel + iOS interruption). */
function sendOffer(token, offer) {
  const km = typeof offer.distanceKm === 'number' ? `${offer.distanceKm.toFixed(1)} km away` : '';
  return send(token, {
    title: '🚚 New delivery request',
    body: `${offer.size}L tanker • ${km}`.trim(),
    data: { type: 'offer', ...offer },
    // Android pulls the sound from the channel; iOS uses this. Critical = ring on
    // silent/DND (needs the entitlement); otherwise the bundled alarm + time-sensitive.
    sound: CRITICAL ? { critical: true, name: 'alarm.wav', volume: 1 } : 'alarm.wav',
    channelId: 'offers-v2', // must match OFFERS_CHANNEL in fulfiller/lib/notifications.js
    priority: 'high',
    interruptionLevel: CRITICAL ? 'critical' : 'timeSensitive',
    ttl: 45, // an offer expires in ~20s — don't let a delayed push ring late
  });
}

/** Generic job/customer update. */
function notify(token, title, body, data = {}) {
  return send(token, { title, body, data, channelId: 'default' });
}

module.exports = { send, sendOffer, notify };
