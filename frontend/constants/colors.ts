/**
 * Ross Tax Preparation - Premium Design System
 * A world-class fintech design system combining brand colors with modern aesthetics
 */

// ============== BRAND COLORS ==============
// Core brand identity colors
export const Brand = {
  // Primary - Ross Tax Wine Red
  primary: '#6C1110',
  primaryDark: '#4A0C0B',
  primaryLight: '#8E1614',
  primaryGradient: ['#6C1110', '#4A0C0B'] as const,
  
  // Secondary - Vibrant Red for CTAs
  secondary: '#ED202D',
  secondaryLight: '#FF4D59',
  secondaryGradient: ['#ED202D', '#B81721'] as const,
  
  // Accent - Turquoise/Cyan
  accent: '#5DC1D9',
  accentDark: '#3A9FB5',
  accentGradient: ['#5DC1D9', '#3A9FB5'] as const,
};

// ============== SEMANTIC COLORS ==============
// Colors with specific meaning
export const Semantic = {
  // Success - Money, Refunds, Positive
  success: '#10B981',
  successLight: '#D1FAE5',
  successDark: '#059669',
  successGradient: ['#10B981', '#059669'] as const,
  
  // Warning - Pending, Attention needed
  warning: '#F59E0B',
  warningLight: '#FEF3C7',
  warningDark: '#D97706',
  warningGradient: ['#F59E0B', '#D97706'] as const,
  
  // Error/Danger - Errors, Rejections
  error: '#EF4444',
  errorLight: '#FEE2E2',
  errorDark: '#DC2626',
  errorGradient: ['#EF4444', '#DC2626'] as const,
  
  // Info - Information, Links, Processing
  info: '#3B82F6',
  infoLight: '#DBEAFE',
  infoDark: '#2563EB',
  infoGradient: ['#3B82F6', '#2563EB'] as const,
  
  // Purple - Special, Premium features
  purple: '#8B5CF6',
  purpleLight: '#EDE9FE',
  purpleDark: '#7C3AED',
  purpleGradient: ['#8B5CF6', '#7C3AED'] as const,
};

// ============== NEUTRAL COLORS ==============
// Grays and neutrals for UI
export const Neutral = {
  // Blacks
  black: '#000000',
  gray900: '#111827',
  gray800: '#1F2937',
  gray700: '#374151',
  gray600: '#4B5563',
  gray500: '#6B7280',
  gray400: '#9CA3AF',
  gray300: '#D1D5DB',
  gray200: '#E5E7EB',
  gray100: '#F3F4F6',
  gray50: '#F9FAFB',
  white: '#FFFFFF',
};

// ============== PREMIUM GRADIENTS ==============
// Beautiful gradients for headers, cards, buttons
export const Gradients = {
  // Primary brand gradient
  primary: ['#6C1110', '#4A0C0B'] as const,
  primaryReverse: ['#4A0C0B', '#6C1110'] as const,
  
  // Success/Money gradient
  success: ['#10B981', '#059669'] as const,
  successSoft: ['#D1FAE5', '#A7F3D0'] as const,
  
  // Premium dark gradient (for headers)
  dark: ['#1F2937', '#111827'] as const,
  darkPremium: ['#0F172A', '#1E293B'] as const,
  
  // Elegant combinations
  wineToGreen: ['#6C1110', '#10B981'] as const,
  greenToBlue: ['#10B981', '#3B82F6'] as const,
  blueToIndigo: ['#3B82F6', '#6366F1'] as const,
  purpleToRose: ['#8B5CF6', '#EC4899'] as const,
  
  // Sunrise/Sunset vibes
  warmSunset: ['#F59E0B', '#EF4444'] as const,
  coolOcean: ['#06B6D4', '#3B82F6'] as const,
  freshMint: ['#10B981', '#14B8A6'] as const,
  
  // Glass effect backgrounds
  glassLight: ['rgba(255,255,255,0.9)', 'rgba(255,255,255,0.7)'] as const,
  glassDark: ['rgba(31,41,55,0.9)', 'rgba(17,24,39,0.8)'] as const,
  
  // Card backgrounds
  cardPremium: ['#FFFFFF', '#F9FAFB'] as const,
  cardDark: ['#1F2937', '#111827'] as const,
};

// ============== SHADOWS ==============
// Consistent shadow system
export const Shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  colored: (color: string) => ({
    shadowColor: color,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  }),
};

// ============== SPACING ==============
// 8pt grid system
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  '2xl': 48,
  '3xl': 64,
};

// ============== BORDER RADIUS ==============
export const BorderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  '2xl': 24,
  full: 9999,
};

// ============== TYPOGRAPHY ==============
export const Typography = {
  sizes: {
    xs: 10,
    sm: 12,
    md: 14,
    lg: 16,
    xl: 18,
    '2xl': 20,
    '3xl': 24,
    '4xl': 30,
    '5xl': 36,
  },
  weights: {
    normal: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    extrabold: '800' as const,
  },
  lineHeights: {
    tight: 1.25,
    normal: 1.5,
    relaxed: 1.75,
  },
};

// ============== LIGHT THEME ==============
export const LightColors = {
  // Brand - Updated to use green as primary for modern fintech look
  primary: '#10B981',
  primaryDark: '#059669',
  primaryLight: '#34D399',
  secondary: Brand.primary,  // Wine red as secondary
  secondaryLight: Brand.primaryLight,
  accent: Brand.accent,
  accentDark: Brand.accentDark,
  
  // Backgrounds
  background: Neutral.white,
  backgroundGray: Neutral.gray50,
  backgroundCard: Neutral.white,
  backgroundElevated: Neutral.white,
  
  // Text
  text: Neutral.gray900,
  textSecondary: Neutral.gray600,
  textGray: Neutral.gray500,
  textLight: Neutral.gray400,
  textWhite: Neutral.white,
  textMuted: Neutral.gray400,
  
  // Semantic
  success: Semantic.success,
  successLight: Semantic.successLight,
  warning: Semantic.warning,
  warningLight: Semantic.warningLight,
  error: Semantic.error,
  errorLight: Semantic.errorLight,
  danger: Semantic.errorDark,
  info: Semantic.info,
  infoLight: Semantic.infoLight,
  purple: Semantic.purple,
  purpleLight: Semantic.purpleLight,
  
  // Borders
  border: Neutral.gray200,
  borderLight: Neutral.gray100,
  borderDark: Neutral.gray300,
  
  // Status colors
  statusPending: Semantic.warning,
  statusInProgress: Semantic.info,
  statusCompleted: Semantic.success,
  statusFiled: Semantic.purple,
  statusRejected: Semantic.error,
  
  // Misc
  shadow: 'rgba(0, 0, 0, 0.1)',
  overlay: 'rgba(0, 0, 0, 0.5)',
  skeleton: Neutral.gray200,
  
  // Component specific
  inputBackground: Neutral.white,
  inputBorder: Neutral.gray200,
  inputFocus: Semantic.success,
  buttonPrimary: Semantic.success,
  buttonSecondary: Brand.primary,
  cardBackground: Neutral.white,
  headerGradient: Gradients.dark,
  tabActive: Semantic.success,
  tabInactive: Neutral.gray400,
};

// ============== DARK THEME ==============
export const DarkColors = {
  // Brand
  primary: Brand.secondary,
  primaryDark: Brand.primaryDark,
  primaryLight: Brand.secondaryLight,
  secondary: Brand.secondary,
  secondaryLight: Brand.secondaryLight,
  accent: Brand.accent,
  accentDark: Brand.accentDark,
  
  // Backgrounds
  background: Neutral.gray900,
  backgroundGray: Neutral.gray800,
  backgroundCard: Neutral.gray800,
  backgroundElevated: Neutral.gray700,
  
  // Text
  text: Neutral.white,
  textSecondary: Neutral.gray300,
  textGray: Neutral.gray400,
  textLight: Neutral.gray500,
  textWhite: Neutral.white,
  textMuted: Neutral.gray500,
  
  // Semantic
  success: Semantic.success,
  successLight: 'rgba(16, 185, 129, 0.2)',
  warning: Semantic.warning,
  warningLight: 'rgba(245, 158, 11, 0.2)',
  error: Semantic.error,
  errorLight: 'rgba(239, 68, 68, 0.2)',
  danger: Semantic.errorDark,
  info: Semantic.info,
  infoLight: 'rgba(59, 130, 246, 0.2)',
  purple: Semantic.purple,
  purpleLight: 'rgba(139, 92, 246, 0.2)',
  
  // Borders
  border: Neutral.gray700,
  borderLight: Neutral.gray600,
  borderDark: Neutral.gray800,
  
  // Status colors
  statusPending: Semantic.warning,
  statusInProgress: Semantic.info,
  statusCompleted: Semantic.success,
  statusFiled: Semantic.purple,
  statusRejected: Semantic.error,
  
  // Misc
  shadow: 'rgba(0, 0, 0, 0.3)',
  overlay: 'rgba(0, 0, 0, 0.7)',
  skeleton: Neutral.gray700,
  
  // Component specific
  inputBackground: Neutral.gray800,
  inputBorder: Neutral.gray600,
  inputFocus: Semantic.success,
  buttonPrimary: Semantic.success,
  buttonSecondary: Brand.secondary,
  cardBackground: Neutral.gray800,
  headerGradient: Gradients.darkPremium,
  tabActive: Semantic.success,
  tabInactive: Neutral.gray500,
};

// ============== DEFAULT EXPORT ==============
export const Colors = LightColors;

// ============== THEME HOOK ==============
import { useTheme } from '../contexts/ThemeContext';

export function useThemeColors() {
  try {
    const { isDark } = useTheme();
    return isDark ? DarkColors : LightColors;
  } catch {
    return LightColors;
  }
}

// ============== DESIGN TOKENS ==============
// Commonly used design tokens for consistency
export const DesignTokens = {
  // Cards
  card: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    ...Shadows.md,
  },
  cardSmall: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    ...Shadows.sm,
  },
  
  // Buttons
  buttonLarge: {
    height: 56,
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.xl,
  },
  buttonMedium: {
    height: 48,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.lg,
  },
  buttonSmall: {
    height: 36,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
  },
  
  // Inputs
  input: {
    height: 52,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    borderWidth: 1.5,
  },
  
  // Headers
  headerGradient: {
    paddingTop: 0,
    paddingBottom: Spacing.lg,
    paddingHorizontal: Spacing.lg,
  },
  
  // Status badges
  badge: {
    paddingHorizontal: Spacing.sm + 4,
    paddingVertical: Spacing.xs + 2,
    borderRadius: BorderRadius.full,
  },
  
  // Avatar
  avatarSmall: 32,
  avatarMedium: 48,
  avatarLarge: 64,
  avatarXL: 96,
  
  // Icon sizes
  iconSmall: 16,
  iconMedium: 20,
  iconLarge: 24,
  iconXL: 32,
};

// ============== UTILITY FUNCTIONS ==============
export const colorWithOpacity = (hex: string, opacity: number): string => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

export const getStatusColor = (status: string): string => {
  const statusColors: Record<string, string> = {
    pending: Semantic.warning,
    in_progress: Semantic.info,
    processing: Semantic.info,
    completed: Semantic.success,
    accepted: Semantic.success,
    filed: Semantic.purple,
    rejected: Semantic.error,
    cancelled: Neutral.gray400,
  };
  return statusColors[status.toLowerCase()] || Neutral.gray400;
};

export const getCategoryColor = (category: string): string => {
  const categoryColors: Record<string, string> = {
    tax: Semantic.success,
    itin: Semantic.purple,
    accounting: Semantic.info,
    payroll: Semantic.warning,
    immigration: Brand.primary,
    other: Neutral.gray500,
  };
  return categoryColors[category.toLowerCase()] || Neutral.gray500;
};
