import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, radius, type, shadow } from '../lib/theme';

// expo-linear-gradient is a native module — lazy-require it so the app still runs
// (with a solid-colour fallback) before it's installed + the dev build is rebuilt.
let LinearGradient = null;
try {
  ({ LinearGradient } = require('expo-linear-gradient'));
} catch {}

/* ---------------- Gradient ---------------- */

export const BRAND_GRADIENT = [colors.primary, colors.primaryDark];

/** Linear gradient with a graceful solid fallback when the native module is absent. */
export function Gradient({ colors: gColors = BRAND_GRADIENT, start, end, style, children }) {
  if (LinearGradient) {
    return (
      <LinearGradient
        colors={gColors}
        start={start || { x: 0, y: 0 }}
        end={end || { x: 1, y: 1 }}
        style={style}
      >
        {children}
      </LinearGradient>
    );
  }
  return <View style={[{ backgroundColor: gColors[0] }, style]}>{children}</View>;
}

/** Primary CTA with the brand gradient (used for the main action). */
export function GradientButton({ label, onPress, icon, loading, disabled, style }) {
  const off = disabled || loading;
  return (
    <TouchableOpacity activeOpacity={0.9} onPress={onPress} disabled={off} style={[styles.gradBtnWrap, off && { opacity: 0.5 }, style]}>
      <Gradient style={styles.gradBtn}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <View style={styles.btnRow}>
            {icon && <Feather name={icon} size={20} color="#fff" style={{ marginRight: spacing.sm }} />}
            <Text style={[styles.btnText, { color: '#fff', fontSize: 16 }]}>{label}</Text>
          </View>
        )}
      </Gradient>
    </TouchableOpacity>
  );
}

/* ---------------- Button ---------------- */

const VARIANTS = {
  primary: { bg: colors.primary, fg: colors.onPrimary, border: null },
  secondary: { bg: colors.surface, fg: colors.primary, border: colors.borderStrong },
  ghost: { bg: 'transparent', fg: colors.primary, border: null },
  success: { bg: colors.success, fg: '#fff', border: null },
  danger: { bg: colors.dangerSoft, fg: colors.danger, border: null },
  onDark: { bg: '#FFFFFF', fg: colors.primary, border: null },
  onDarkGhost: { bg: 'rgba(255,255,255,0.14)', fg: '#FFFFFF', border: null },
};
const SIZES = {
  lg: { h: 54, font: 16, icon: 20 },
  md: { h: 46, font: 15, icon: 18 },
};

export function Button({ label, onPress, variant = 'primary', size = 'lg', icon, iconRight, loading, disabled, style }) {
  const v = VARIANTS[variant] || VARIANTS.primary;
  const s = SIZES[size] || SIZES.lg;
  const off = disabled || loading;
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      disabled={off}
      style={[
        styles.btn,
        { backgroundColor: v.bg, height: s.h, borderWidth: v.border ? 1.5 : 0, borderColor: v.border || 'transparent' },
        off && { opacity: 0.55 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <View style={styles.btnRow}>
          {icon && <Feather name={icon} size={s.icon} color={v.fg} style={{ marginRight: spacing.sm }} />}
          <Text style={[styles.btnText, { color: v.fg, fontSize: s.font }]}>{label}</Text>
          {iconRight && <Feather name={iconRight} size={s.icon} color={v.fg} style={{ marginLeft: spacing.sm }} />}
        </View>
      )}
    </TouchableOpacity>
  );
}

/* ---------------- Card ---------------- */

export function Card({ children, style, padded = true }) {
  return <View style={[styles.card, padded && { padding: spacing.xl }, style]}>{children}</View>;
}

/* ---------------- Input ---------------- */

export function Input({ label, icon, error, secureTextEntry, style, ...props }) {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(!!secureTextEntry);
  return (
    <View style={style}>
      {label && <Text style={styles.inputLabel}>{label}</Text>}
      <View style={[styles.inputWrap, focused && styles.inputFocused, error && styles.inputError]}>
        {icon && <Feather name={icon} size={18} color={focused ? colors.primary : colors.textMuted} style={{ marginRight: spacing.md }} />}
        <TextInput
          {...props}
          secureTextEntry={hidden}
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        {secureTextEntry && (
          <TouchableOpacity onPress={() => setHidden((h) => !h)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Feather name={hidden ? 'eye' : 'eye-off'} size={18} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>
      {!!error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

/* ---------------- Misc ---------------- */

export function SectionLabel({ children, style }) {
  return <Text style={[type.label, style]}>{children}</Text>;
}

export function Divider({ style }) {
  return <View style={[{ height: 1, backgroundColor: colors.border }, style]} />;
}

const TONES = {
  neutral: { bg: colors.surfaceAlt, fg: colors.textSecondary },
  primary: { bg: colors.primarySoft, fg: colors.primary },
  success: { bg: colors.successSoft, fg: colors.success },
  warning: { bg: colors.warningSoft, fg: colors.warning },
};

export function Pill({ label, tone = 'neutral', icon }) {
  const t = TONES[tone] || TONES.neutral;
  return (
    <View style={[styles.pill, { backgroundColor: t.bg }]}>
      {icon && <Feather name={icon} size={12} color={t.fg} style={{ marginRight: 5 }} />}
      <Text style={[styles.pillText, { color: t.fg }]}>{label}</Text>
    </View>
  );
}

export function Avatar({ name, size = 44 }) {
  const initials = (name || '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('') || 'P';
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.avatarText, { fontSize: size * 0.38 }]}>{initials}</Text>
    </View>
  );
}

/** Icon in a soft tinted square — used for list/detail rows. */
export function IconChip({ name, tone = 'primary', size = 40 }) {
  const t = TONES[tone] || TONES.primary;
  return (
    <View style={[styles.iconChip, { width: size, height: size, borderRadius: radius.md, backgroundColor: t.bg }]}>
      <Feather name={name} size={size * 0.45} color={t.fg} />
    </View>
  );
}

/** Sub-screen header with a back chevron + centered title. */
export function Header({ title, onBack, right }) {
  return (
    <View style={styles.header}>
      {onBack ? (
        <TouchableOpacity onPress={onBack} style={styles.headerBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Feather name="chevron-left" size={26} color={colors.text} />
        </TouchableOpacity>
      ) : (
        <View style={styles.headerBtn} />
      )}
      <Text style={styles.headerTitle}>{title}</Text>
      <View style={styles.headerBtn}>{right}</View>
    </View>
  );
}

/** A tappable list row for menus (icon + label + optional value + chevron). */
export function MenuRow({ icon, label, value, onPress, danger, last }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} disabled={!onPress} style={[styles.menuRow, !last && styles.menuDivider]}>
      <View style={[styles.menuIcon, { backgroundColor: danger ? colors.dangerSoft : colors.primarySoft }]}>
        <Feather name={icon} size={17} color={danger ? colors.danger : colors.primary} />
      </View>
      <Text style={[styles.menuLabel, danger && { color: colors.danger }]}>{label}</Text>
      {value != null && <Text style={styles.menuValue}>{value}</Text>}
      {onPress && !danger && <Feather name="chevron-right" size={20} color={colors.textMuted} />}
    </TouchableOpacity>
  );
}

/** Compact stat card for a stats row. */
export function StatTile({ icon, label, value, tone = 'primary' }) {
  const t = TONES[tone] || TONES.primary;
  return (
    <View style={styles.statTile}>
      <View style={[styles.statIcon, { backgroundColor: t.bg }]}>
        <Feather name={icon} size={15} color={t.fg} />
      </View>
      <Text style={styles.statValue} numberOfLines={1}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  btn: { borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg },
  btnRow: { flexDirection: 'row', alignItems: 'center' },
  btnText: { fontWeight: '700' },
  gradBtnWrap: { borderRadius: radius.md, overflow: 'hidden', ...shadow.card },
  gradBtn: { height: 54, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg },

  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, ...shadow.card },

  inputLabel: { ...type.label, marginBottom: spacing.sm },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    height: 52,
  },
  inputFocused: { borderColor: colors.primary, backgroundColor: '#fff' },
  inputError: { borderColor: colors.danger },
  input: { flex: 1, fontSize: 15, fontWeight: '500', color: colors.text, paddingVertical: 0 },
  errorText: { color: colors.danger, fontSize: 12.5, marginTop: spacing.xs, fontWeight: '500' },

  pill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: 5, borderRadius: radius.pill, alignSelf: 'flex-start' },
  pillText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.2 },

  avatar: { backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.primary, fontWeight: '800' },

  iconChip: { alignItems: 'center', justifyContent: 'center' },

  header: { flexDirection: 'row', alignItems: 'center', height: 52, paddingHorizontal: spacing.sm },
  headerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: colors.text },

  menuRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md },
  menuDivider: { borderBottomWidth: 1, borderBottomColor: colors.border },
  menuIcon: { width: 34, height: 34, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md },
  menuLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.text },
  menuValue: { fontSize: 14, fontWeight: '500', color: colors.textMuted, marginRight: spacing.sm },

  statTile: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  statIcon: { width: 28, height: 28, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  statValue: { fontSize: 18, fontWeight: '800', color: colors.text, letterSpacing: -0.3 },
  statLabel: { fontSize: 11.5, fontWeight: '600', color: colors.textMuted, marginTop: 1 },
});
