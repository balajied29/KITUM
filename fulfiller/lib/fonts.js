import React from 'react';
import { Text, TextInput, StyleSheet } from 'react-native';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from '@expo-google-fonts/inter';

// The variants to load (each fontWeight is its own font file, RN can't synthesize
// a weight from one family).
export const INTER_FONTS = {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
};

// fontWeight → matching Inter variant.
const FAMILY_FOR_WEIGHT = {
  100: 'Inter_400Regular', 200: 'Inter_400Regular', 300: 'Inter_400Regular',
  400: 'Inter_400Regular', normal: 'Inter_400Regular',
  500: 'Inter_500Medium',
  600: 'Inter_600SemiBold',
  700: 'Inter_700Bold', bold: 'Inter_700Bold',
  800: 'Inter_800ExtraBold', 900: 'Inter_800ExtraBold',
};

let installed = false;

/**
 * Make Inter the DEFAULT font app-wide, with correct weights. Patches Text/TextInput
 * render once to inject the Inter variant matching each element's resolved fontWeight,
 * then clears the numeric weight (the variant already encodes it, leaving it can
 * double-bold on Android). An explicit `fontFamily` in a style always wins.
 *
 * Idempotent + defensive: any failure leaves the system font in place, never crashes.
 */
export function installInterFont() {
  if (installed) return;
  installed = true;
  try {
    for (const Comp of [Text, TextInput]) {
      const orig = Comp.render;
      if (typeof orig !== 'function') continue;
      Comp.render = function interPatched(...args) {
        const el = orig.apply(this, args);
        if (!el || !el.props) return el;
        const flat = StyleSheet.flatten(el.props.style) || {};
        if (flat.fontFamily) return el; // caller picked a font, respect it
        const family = FAMILY_FOR_WEIGHT[flat.fontWeight || 400] || 'Inter_400Regular';
        return React.cloneElement(el, {
          style: [{ fontFamily: family }, el.props.style, { fontWeight: undefined }],
        });
      };
    }
  } catch {
    // Non-fatal, fall back to system fonts.
  }
}
