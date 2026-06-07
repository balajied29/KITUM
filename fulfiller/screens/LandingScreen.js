/**
 * Partner welcome / landing screen — the first thing a new driver sees.
 * Flat, type-led cobalt design (from Claude Design handoff "KitUm Landing"):
 * solid brand cobalt, a corner water-ripple motif, an ownership headline, three
 * glanceable benefits, and the two entry paths (apply / sign in).
 */
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Svg, { Path, Circle } from 'react-native-svg';
import { colors, spacing, radius } from '../lib/theme';

/* ── benefit + CTA icons (white stroke, matching the design's line set) ── */
const IconPower = () => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
    <Path d="M12 3v9" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" />
    <Path d="M6.5 7a8 8 0 1 0 11 0" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" />
  </Svg>
);
const IconRupee = () => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
    <Path d="M7 5h10" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M7 9h10" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M7 5c5 0 6 8 0 8h1l6 6" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);
const IconPin = () => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
    <Path d="M20 10c0 5.5-8 12-8 12s-8-6.5-8-12a8 8 0 0 1 16 0Z" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    <Circle cx="12" cy="10" r="2.6" stroke="#fff" strokeWidth={2.2} />
  </Svg>
);
const Arrow = ({ color }) => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
    <Path d="M5 12h13" stroke={color} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M12 5l7 7-7 7" stroke={color} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const BENEFITS = [
  { Icon: IconPower, label: 'Be your own boss' },
  { Icon: IconRupee, label: 'Clear, upfront fares' },
  { Icon: IconPin, label: 'Jobs close to you' },
];

export default function LandingScreen({ onStart, onSignIn }) {
  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      {/* Water motif — concentric ripples radiating from a corner "drop point" */}
      <View style={styles.motif} pointerEvents="none">
        <View style={[styles.ripple, styles.r4]} />
        <View style={[styles.ripple, styles.r3]} />
        <View style={[styles.ripple, styles.r2]} />
        <View style={[styles.ripple, styles.r1]} />
        <View style={styles.disc} />
      </View>

      <SafeAreaView edges={['top', 'bottom']} style={styles.content}>
        <Text style={styles.brand}>
          KitUm<Text style={styles.brandP}> Partner</Text>
        </Text>

        <View style={styles.spacer} />

        {/* Ownership headline — "Your" lighter, the nouns heavy, "Money." in a pill */}
        <View style={styles.headline}>
          <Text style={styles.hLine} numberOfLines={1} adjustsFontSizeToFit>
            <Text style={styles.lead}>Your </Text>Tanker.
          </Text>
          <Text style={styles.hLine} numberOfLines={1} adjustsFontSizeToFit>
            <Text style={styles.lead}>Your </Text>Schedule.
          </Text>
          <View style={styles.hRow}>
            <Text style={styles.hLine}>
              <Text style={styles.lead}>Your </Text>
            </Text>
            <View style={styles.pill}>
              <Text style={styles.pillText}>Money.</Text>
            </View>
          </View>
        </View>

        <Text style={styles.sub}>
          Go online when you want, get pinged for nearby water requests, and start earning on your own terms.
        </Text>

        <View style={styles.benefits}>
          {BENEFITS.map(({ Icon, label }) => (
            <View style={styles.brow} key={label}>
              <View style={styles.ic}>
                <Icon />
              </View>
              <Text style={styles.bt}>{label}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity style={styles.cta} activeOpacity={0.85} onPress={onStart}>
          <Text style={styles.ctaText}>Start Earning Today</Text>
          <Arrow color={colors.primary} />
        </TouchableOpacity>

        <TouchableOpacity onPress={onSignIn} activeOpacity={0.7} hitSlop={{ top: 12, bottom: 12, left: 24, right: 24 }}>
          <Text style={styles.signin}>
            Already a partner? <Text style={styles.signinB}>Sign in</Text>
          </Text>
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.primary, overflow: 'hidden' },

  // Motif — corner disc + radiating rings (low-opacity white), behind content
  motif: { ...StyleSheet.absoluteFillObject, zIndex: 1 },
  disc: { position: 'absolute', top: -96, right: -90, width: 300, height: 300, borderRadius: 150, backgroundColor: colors.primaryDark },
  ripple: { position: 'absolute', borderWidth: 1.5, borderRadius: 999 },
  r1: { top: -111, right: -105, width: 330, height: 330, borderColor: 'rgba(255,255,255,0.20)' },
  r2: { top: -152, right: -146, width: 412, height: 412, borderColor: 'rgba(255,255,255,0.12)' },
  r3: { top: -198, right: -192, width: 504, height: 504, borderColor: 'rgba(255,255,255,0.07)' },
  r4: { top: -252, right: -246, width: 612, height: 612, borderColor: 'rgba(255,255,255,0.045)' },

  content: { flex: 1, zIndex: 10, paddingHorizontal: spacing.xxxl, paddingBottom: spacing.xxxl },

  brand: { color: '#fff', fontWeight: '800', fontSize: 19, letterSpacing: -0.4, marginTop: spacing.sm },
  brandP: { color: 'rgba(255,255,255,0.55)', fontWeight: '600' },

  spacer: { flex: 1 },

  headline: { marginBottom: spacing.xxl },
  hLine: { color: '#fff', fontWeight: '800', fontSize: 40, lineHeight: 46, letterSpacing: -1.4 },
  lead: { fontWeight: '500', color: 'rgba(255,255,255,0.78)' },
  hRow: { flexDirection: 'row', alignItems: 'center' },
  pill: { backgroundColor: colors.primarySoft, borderRadius: 7, paddingHorizontal: 9, paddingVertical: 1 },
  pillText: { color: colors.primary, fontWeight: '800', fontSize: 40, lineHeight: 46, letterSpacing: -1.4 },

  sub: { color: colors.primarySoft, opacity: 0.82, fontSize: 15, lineHeight: 24, fontWeight: '500', maxWidth: 312, marginBottom: spacing.xxxl + spacing.xs },

  benefits: { gap: 18, marginBottom: spacing.huge - spacing.sm },
  brow: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  ic: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  bt: { color: '#fff', fontSize: 15, fontWeight: '600', letterSpacing: -0.2 },

  cta: { width: '100%', height: 60, borderRadius: radius.lg, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  ctaText: { color: colors.primary, fontWeight: '800', fontSize: 17, letterSpacing: -0.2 },

  signin: { textAlign: 'center', color: 'rgba(255,255,255,0.72)', fontSize: 13, fontWeight: '500', marginTop: spacing.xl },
  signinB: { color: '#fff', fontWeight: '700' },
});
