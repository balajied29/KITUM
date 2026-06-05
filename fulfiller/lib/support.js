import { Alert, Linking } from 'react-native';

// Public support contact (keep in sync with frontend constants/business.js).
export const SUPPORT_PHONE = '+91 76300 03427';
export const SUPPORT_EMAIL = 'meghalayawater@gmail.com';

/** Prompt the partner to reach support by phone or email. */
export function contactSupport() {
  Alert.alert('Help & support', 'How would you like to reach us?', [
    { text: `Call ${SUPPORT_PHONE}`, onPress: () => Linking.openURL(`tel:${SUPPORT_PHONE.replace(/\s/g, '')}`).catch(() => {}) },
    { text: 'Email us', onPress: () => Linking.openURL(`mailto:${SUPPORT_EMAIL}`).catch(() => {}) },
    { text: 'Cancel', style: 'cancel' },
  ]);
}
