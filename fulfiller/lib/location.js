import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import Constants from 'expo-constants';
import { getSocket } from './socket';
import { postLocation } from './api';
import { EVENTS, LOCATION_PROFILE } from './constants';

const BG_TASK = 'sw-fulfiller-location';

// Expo Go doesn't ship the "Always" location usage description / background
// modes, so requesting background location there crashes iOS natively. Skip all
// background-location calls in Expo Go (they only work in a dev/standalone build).
const IS_EXPO_GO = Constants.executionEnvironment === 'storeClient';

/** Emit a fix over the socket, or fall back to REST if the socket is down. */
function pushFix(coords) {
  const payload = {
    lat: coords.latitude,
    lng: coords.longitude,
    heading: coords.heading,
    accuracy: coords.accuracy,
    speed: coords.speed,
  };
  const s = getSocket();
  if (s && s.connected) {
    s.emit(EVENTS.LOCATION_UPDATE, payload);
  } else {
    postLocation(payload).catch(() => {});
  }
}

// Background task — registered at module scope so it survives app suspension.
TaskManager.defineTask(BG_TASK, ({ data, error }) => {
  if (error || !data) return;
  const last = data.locations?.[data.locations.length - 1];
  if (last) pushFix(last.coords);
});

let watchSub = null;

export async function requestPermissions() {
  try {
    const fg = await Location.requestForegroundPermissionsAsync();
    if (fg.status !== 'granted') return false;
    // Background permission only in real builds — requesting it in Expo Go crashes iOS.
    if (!IS_EXPO_GO) {
      try {
        await Location.requestBackgroundPermissionsAsync();
      } catch {
        /* background optional — foreground still works */
      }
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Foreground watcher. `profile` = 'IDLE' (low frequency, battery friendly while
 * waiting for offers) or 'ACTIVE' (high frequency while on a job).
 */
export async function startForegroundTracking(profile = 'IDLE') {
  try {
    await stopForegroundTracking();
    const p = LOCATION_PROFILE[profile] || LOCATION_PROFILE.IDLE;
    const accuracy = profile === 'ACTIVE' ? Location.Accuracy.High : Location.Accuracy.Balanced;
    watchSub = await Location.watchPositionAsync(
      { accuracy, distanceInterval: p.distanceInterval, timeInterval: p.timeInterval },
      (loc) => pushFix(loc.coords)
    );
    return true;
  } catch {
    return false; // never let a location hiccup crash the app
  }
}

export async function stopForegroundTracking() {
  if (watchSub) {
    watchSub.remove();
    watchSub = null;
  }
}

/** Background tracking with an Android foreground service — used during a job. */
export async function startBackgroundTracking() {
  if (IS_EXPO_GO) return; // unsupported in Expo Go; needs a dev/standalone build
  try {
    const running = await Location.hasStartedLocationUpdatesAsync(BG_TASK);
    if (running) return;
    await Location.startLocationUpdatesAsync(BG_TASK, {
      accuracy: Location.Accuracy.High,
      distanceInterval: LOCATION_PROFILE.ACTIVE.distanceInterval,
      timeInterval: LOCATION_PROFILE.ACTIVE.timeInterval,
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'KitUm Partner — delivery in progress',
        notificationBody: 'Sharing your live location with the customer.',
        notificationColor: '#263cf2',
      },
    });
  } catch {
    /* needs a dev/standalone build (not Expo Go) for background location */
  }
}

export async function stopBackgroundTracking() {
  try {
    const running = await Location.hasStartedLocationUpdatesAsync(BG_TASK);
    if (running) await Location.stopLocationUpdatesAsync(BG_TASK);
  } catch {}
}
