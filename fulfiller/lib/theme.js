/**
 * KitUm Partner — design tokens.
 * One source of truth for color, spacing, radius, type and elevation so the
 * whole app stays visually consistent. Spacing is on a 4pt grid.
 */

export const colors = {
  // Brand
  primary: '#0037B0',
  primaryDark: '#00298A',
  primarySoft: '#EAF0FF', // tinted surface / selected state
  primaryBorder: '#C9D8FF',

  // Surfaces
  bg: '#F4F6FB', // app background
  surface: '#FFFFFF', // cards
  surfaceAlt: '#F8FAFC',

  // Text
  text: '#0B1524', // primary
  textSecondary: '#475569',
  textMuted: '#94A3B8',
  onPrimary: '#FFFFFF',

  // Lines
  border: '#E6EAF2',
  borderStrong: '#D5DBE7',

  // Status
  success: '#15A34A',
  successSoft: '#E7F6EC',
  danger: '#DC2626',
  dangerSoft: '#FCEBEB',
  warning: '#D97706',
  warningSoft: '#FEF3E2',

  // Misc
  online: '#15A34A',
  offline: '#64748B',
  star: '#F59E0B',
  overlay: 'rgba(7, 17, 33, 0.55)',
};

// 4pt grid
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
};

export const type = {
  display: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5, color: colors.text },
  h1: { fontSize: 22, fontWeight: '800', letterSpacing: -0.3, color: colors.text },
  h2: { fontSize: 17, fontWeight: '700', color: colors.text },
  body: { fontSize: 15, fontWeight: '500', color: colors.text },
  bodyMuted: { fontSize: 15, fontWeight: '500', color: colors.textSecondary },
  label: { fontSize: 12, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', color: colors.textMuted },
  caption: { fontSize: 13, fontWeight: '500', color: colors.textSecondary },
};

// Soft, single-source card elevation (iOS shadow + Android elevation).
export const shadow = {
  card: {
    shadowColor: '#0B1524',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
  },
  floating: {
    shadowColor: '#0B1524',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
};

export default { colors, spacing, radius, type, shadow };
