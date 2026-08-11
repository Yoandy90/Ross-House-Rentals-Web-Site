// ═══════════════════════════════════════════════════════════════════════════
// Ross Lending Solutions — Neo-Fintech Dark Theme
// Matches the web brand: Emerald + Amber + Deep Space
// ═══════════════════════════════════════════════════════════════════════════

export const Colors = {
  // Backgrounds (darkest to lightest)
  bg: '#060910',
  surface: '#0C1220',
  card: '#111827',
  elevated: '#1A2332',

  // Primary: Emerald
  primary: '#059669',
  primaryLight: '#34D399',
  primaryDark: '#047857',

  // Accent: Amber/Gold
  accent: '#F59E0B',
  accentLight: '#FBBF24',
  accentDark: '#D97706',

  // Secondary: Indigo
  secondary: '#6366F1',
  secondaryLight: '#818CF8',

  // Text
  text: '#F9FAFB',
  textSecondary: '#9CA3AF',
  textMuted: '#6B7280',
  textDim: '#4B5563',

  // Borders
  border: '#1F2937',
  borderLight: '#374151',

  // Semantic
  success: '#10B981',
  error: '#EF4444',
  warning: '#F59E0B',
  info: '#3B82F6',

  // Base
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',

  // Legacy (backwards compat)
  forest: '#059669',
  gold: '#F59E0B',
  navy: '#0C1220',
};

export const Gradients = {
  primary: ['#059669', '#34D399'] as const,
  accent: ['#F59E0B', '#FBBF24'] as const,
  hero: ['#060910', '#0C1220', '#111827'] as const,
  card: ['#111827', '#0C1220'] as const,
};

export const Shadows = {
  glow: {
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 5,
  },
};

export const Fonts = {
  heading: 'Montserrat',
  body: 'Inter',
};

// API URL (will be configured per environment)
export const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8001';
