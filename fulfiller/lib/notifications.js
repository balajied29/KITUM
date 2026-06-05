import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// The high-priority offer channel. Android LOCKS a channel's settings once it's
// created — changing importance/sound later is silently ignored — so the id is
// versioned. Bump the suffix whenever these settings change.
export const OFFERS_CHANNEL = 'offers-v2';

// Show offers loudly even when the app is foregrounded. (SDK 53+ replaced
// shouldShowAlert with shouldShowBanner + shouldShowList.)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function setUpAndroidChannels() {
  if (Platform.OS !== 'android') return;
  // Drop any stale earlier channel so its (quieter) cached settings don't linger.
  await Notifications.deleteNotificationChannelAsync('offers').catch(() => {});
  await Notifications.setNotificationChannelAsync(OFFERS_CHANNEL, {
    name: 'Delivery offers',
    importance: Notifications.AndroidImportance.MAX, // heads-up + sound
    sound: 'alarm.wav', // bundled via the expo-notifications "sounds" config in app.json
    audioAttributes: {
      usage: Notifications.AndroidAudioUsage.ALARM, // route through the alarm stream
      contentType: Notifications.AndroidAudioContentType.SONIFICATION,
    },
    vibrationPattern: [0, 500, 500, 500, 500],
    bypassDnd: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    enableVibrate: true,
  });
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Updates',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

/**
 * Request permission, set up the loud "offers" channel, and return the Expo push
 * token so the backend can wake a backgrounded/killed app. Returns null (and logs
 * why) if push can't be set up — push is the ONLY reliable background alert, so a
 * null here means the driver won't be alerted while the app is minimised.
 */
export async function registerForPush() {
  await setUpAndroidChannels();

  if (!Device.isDevice) {
    console.warn('[push] Not a physical device — push tokens are unavailable.');
    return null;
  }

  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') {
    // iOS: also ask for the time-sensitive/critical surface up front.
    status = (await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowSound: true, allowBadge: true, allowCriticalAlerts: true },
    })).status;
  }
  if (status !== 'granted') {
    console.warn('[push] Notification permission not granted — driver will miss backgrounded offers.');
    return null;
  }

  const projectId =
    Constants?.expoConfig?.extra?.eas?.projectId || Constants?.easConfig?.projectId;
  if (!projectId) {
    // getExpoPushTokenAsync REQUIRES a projectId on SDK 49+. Without it, no token
    // is ever issued and backgrounded offers can never ring. Run `eas init`.
    console.warn('[push] Missing EAS projectId (app.json → extra.eas.projectId). Run `eas init`. No push token will be issued.');
    return null;
  }

  try {
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    return token;
  } catch (err) {
    console.warn('[push] Failed to get Expo push token:', err?.message || err);
    return null;
  }
}
