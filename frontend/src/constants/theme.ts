/**
 * Ross House Rentals — Adaptive Theme Colors
 * Provides both DARK (glass premium) and LIGHT (clean premium) palettes
 * plus a useColors() hook that returns the active one automatically.
 */
import { useTheme } from '../theme/ThemeContext';

// ─── DARK (original glass premium) ─────────────────────────────
export const darkColors = {
  // Primary Brand
  brandRed: '#C8102E',
  brandRedLight: 'rgba(200,16,46,0.12)',
  brandRedGlow: 'rgba(200,16,46,0.25)',
  deepRed: '#9B1B30',

  // Glass System
  glass: 'rgba(255,255,255,0.03)',
  glassLight: 'rgba(255,255,255,0.06)',
  glassBorder: 'rgba(255,255,255,0.06)',
  glassBorderLight: 'rgba(255,255,255,0.10)',
  glassBorderActive: 'rgba(255,255,255,0.15)',

  // Backgrounds
  background: '#0C0C0E',
  surface: 'rgba(255,255,255,0.03)',
  surfaceElevated: 'rgba(255,255,255,0.05)',
  surfaceLight: '#1C1C20',
  overlay: 'rgba(0,0,0,0.6)',

  // Semantic
  success: '#10B981',
  successBg: 'rgba(16,185,129,0.10)',
  warning: '#F59E0B',
  warningBg: 'rgba(245,158,11,0.10)',
  error: '#EF4444',
  errorBg: 'rgba(239,68,68,0.10)',
  info: '#3B82F6',
  infoBg: 'rgba(59,130,246,0.10)',

  // Accents
  violet: '#8B5CF6',
  violetBg: 'rgba(139,92,246,0.10)',
  emerald: '#10B981',
  emeraldBg: 'rgba(16,185,129,0.10)',
  amber: '#F59E0B',
  amberBg: 'rgba(245,158,11,0.10)',
  cyan: '#06B6D4',
  cyanBg: 'rgba(6,182,212,0.10)',
  pink: '#EC4899',
  pinkBg: 'rgba(236,72,153,0.10)',
  lime: '#84CC16',
  limeBg: 'rgba(132,204,22,0.10)',

  // Text
  white: '#FFFFFF',
  textPrimary: '#F0F0F0',
  textSecondary: '#9CA3AF',
  textMuted: '#6B7280',
  textDim: '#4B5563',

  // Legacy
  charcoal: '#1A1A1E',
  warmCharcoal: '#3A3A3E',
  warmGold: '#D4A574',
  warmCream: '#FAF3E8',
  sageGreen: '#7A9E7E',
  navyBlue: '#1E3A5F',
  warmGray: '#8C8C8C',
  border: 'rgba(255,255,255,0.06)',
} as const;

// ─── LIGHT (clean premium) ─────────────────────────────────────
export const lightColors = {
  brandRed: '#C8102E',
  brandRedLight: 'rgba(200,16,46,0.08)',
  brandRedGlow: 'rgba(200,16,46,0.15)',
  deepRed: '#9B1B30',

  glass: '#FFFFFF',
  glassLight: '#F8FAFC',
  glassBorder: 'rgba(15,23,42,0.08)',
  glassBorderLight: 'rgba(15,23,42,0.12)',
  glassBorderActive: 'rgba(15,23,42,0.20)',

  background: '#F8FAFC',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  surfaceLight: '#F1F5F9',
  overlay: 'rgba(15,23,42,0.5)',

  success: '#059669',
  successBg: 'rgba(5,150,105,0.10)',
  warning: '#D97706',
  warningBg: 'rgba(217,119,6,0.10)',
  error: '#DC2626',
  errorBg: 'rgba(220,38,38,0.10)',
  info: '#2563EB',
  infoBg: 'rgba(37,99,235,0.10)',

  violet: '#7C3AED',
  violetBg: 'rgba(124,58,237,0.10)',
  emerald: '#059669',
  emeraldBg: 'rgba(5,150,105,0.10)',
  amber: '#D97706',
  amberBg: 'rgba(217,119,6,0.10)',
  cyan: '#0891B2',
  cyanBg: 'rgba(8,145,178,0.10)',
  pink: '#DB2777',
  pinkBg: 'rgba(219,39,119,0.10)',
  lime: '#65A30D',
  limeBg: 'rgba(101,163,13,0.10)',

  white: '#FFFFFF',
  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#64748B',
  textDim: '#94A3B8',

  charcoal: '#FFFFFF',
  warmCharcoal: '#F1F5F9',
  warmGold: '#B8860B',
  warmCream: '#FEFCE8',
  sageGreen: '#4D7A5F',
  navyBlue: '#1E3A5F',
  warmGray: '#64748B',
  border: 'rgba(15,23,42,0.08)',
} as const;

// ─── Default export: dark (backwards compat for existing screens) ─
export const Colors = darkColors;

// ─── Hook: returns colors based on current theme mode ──────────
export function useColors() {
  const { resolved } = useTheme();
  return resolved === 'light' ? lightColors : darkColors;
}

export const Gradients = {
  brandRed: ['#C8102E', '#9B1B30'],
  premium: ['#0C0C0E', '#1a0a0f'],
  card: ['rgba(255,255,255,0.04)', 'rgba(255,255,255,0.01)'],
  heroGlow: ['rgba(200,16,46,0.15)', 'rgba(200,16,46,0)'],
  darkFade: ['rgba(12,12,14,0)', 'rgba(12,12,14,1)'],
} as const;

export const lightGradients = {
  brandRed: ['#C8102E', '#9B1B30'],
  premium: ['#F8FAFC', '#EEF2FF'],
  card: ['#FFFFFF', '#F8FAFC'],
  heroGlow: ['rgba(200,16,46,0.08)', 'rgba(200,16,46,0)'],
  darkFade: ['rgba(248,250,252,0)', 'rgba(248,250,252,1)'],
} as const;

export function useGradients() {
  const { resolved } = useTheme();
  return resolved === 'light' ? lightGradients : Gradients;
}

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  '2xl': 32,
  '3xl': 40,
  '4xl': 48,
} as const;

export const BorderRadius = {
  sm: 8,
  md: 12,
  card: 16,
  lg: 20,
  xl: 24,
  '2xl': 28,
  full: 9999,
} as const;

export const FontSizes = {
  xs: 10,
  sm: 12,
  base: 14,
  md: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 28,
  '4xl': 36,
} as const;

export const FontWeights = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  extrabold: '800' as const,
};

export const Shadows = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 8,
  },
  glow: (color: string, opacity = 0.25) => ({
    shadowColor: color,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: opacity,
    shadowRadius: 16,
    elevation: 6,
  }),
  button: {
    shadowColor: '#C8102E',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  subtle: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
};

// Light-mode shadows (softer)
export const lightShadows = {
  card: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  subtle: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
};

export function useShadows() {
  const { resolved } = useTheme();
  return resolved === 'light' ? { ...Shadows, card: lightShadows.card, subtle: lightShadows.subtle } : Shadows;
}
