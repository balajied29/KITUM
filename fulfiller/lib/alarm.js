import { Vibration, Platform } from 'react-native';

/**
 * The "incoming offer" alarm. Vibration is guaranteed (core RN); the looping
 * ringtone is best-effort via expo-audio (SDK 54+) and degrades silently if
 * unavailable. Swap ALARM_URI for a bundled assets/alarm.wav in production.
 */

const PATTERN = Platform.OS === 'android' ? [0, 600, 400, 600, 400] : [0, 700, 500, 700];
// Bundled locally so the alarm rings instantly and works offline (no network fetch).
const ALARM_SOURCE = require('../assets/alarm.wav');

let player = null;

export async function startAlarm() {
  Vibration.vibrate(PATTERN, true);
  try {
    const { createAudioPlayer, setAudioModeAsync } = require('expo-audio');
    await setAudioModeAsync({ playsInSilentMode: true });
    player = createAudioPlayer(ALARM_SOURCE);
    player.loop = true;
    player.volume = 1.0;
    player.play();
  } catch {
    /* vibration only */
  }
}

export async function stopAlarm() {
  Vibration.cancel();
  try {
    player?.pause?.();
    player?.remove?.();
  } catch {}
  player = null;
}
