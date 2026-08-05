/**
 * Rise CRM Inspired Theme Colors
 * Esquema de colores moderno y profesional para el admin panel
 */

export const RiseColors = {
  // Colores primarios
  primary: '#5B9BD5',       // Azul principal
  primaryLight: '#E3F2FD',  // Azul claro para fondos
  primaryDark: '#1E88E5',   // Azul oscuro

  // Colores secundarios
  secondary: '#E91E63',     // Rosa/Magenta
  secondaryLight: '#FCE4EC',
  secondaryDark: '#C2185B',

  // Colores de acento
  accent: '#00BCD4',        // Turquesa/Cyan
  accentLight: '#B2EBF2',
  accentDark: '#0097A7',

  // Colores adicionales
  purple: '#7B68EE',        // Morado para métricas especiales
  purpleLight: '#EDE7F6',
  purpleDark: '#5E35B1',

  orange: '#FF9800',        // Naranja para alertas
  orangeLight: '#FFF3E0',
  orangeDark: '#F57C00',

  // Colores de estado
  success: '#4CAF50',       // Verde
  successLight: '#E8F5E9',
  successDark: '#388E3C',

  warning: '#FFC107',       // Amarillo/Dorado
  warningLight: '#FFF9C4',
  warningDark: '#F57F17',

  error: '#F44336',         // Rojo
  errorLight: '#FFEBEE',
  errorDark: '#C62828',

  info: '#2196F3',          // Azul info
  infoLight: '#E3F2FD',
  infoDark: '#1976D2',

  // Colores neutros
  white: '#FFFFFF',
  background: '#F5F7FA',    // Fondo principal gris claro
  backgroundGray: '#FAFBFC',
  backgroundDark: '#E5E7EB',

  // Colores de texto
  text: '#1F2937',          // Texto principal oscuro
  textGray: '#6B7280',      // Texto secundario
  textLight: '#9CA3AF',     // Texto terciario
  textWhite: '#FFFFFF',

  // Bordes y divisores
  border: '#E5E7EB',
  borderLight: '#F3F4F6',
  borderDark: '#D1D5DB',

  // Sombras y overlays
  shadow: 'rgba(0, 0, 0, 0.08)',
  shadowDark: 'rgba(0, 0, 0, 0.12)',
  overlay: 'rgba(0, 0, 0, 0.5)',
};

/**
 * Gradientes predefinidos estilo Rise CRM
 */
export const RiseGradients = {
  primary: [RiseColors.primary, RiseColors.primaryDark],
  secondary: [RiseColors.secondary, RiseColors.secondaryDark],
  accent: [RiseColors.accent, RiseColors.accentDark],
  purple: [RiseColors.purple, RiseColors.purpleDark],
  success: [RiseColors.success, RiseColors.successDark],
  warning: [RiseColors.warning, RiseColors.warningDark],
  error: [RiseColors.error, RiseColors.errorDark],
  info: [RiseColors.info, RiseColors.infoDark],
  
  // Gradientes especiales
  sunset: ['#FF6B6B', '#FFD93D'],
  ocean: ['#667EEA', '#764BA2'],
  mint: ['#56CCF2', '#2F80ED'],
};

/**
 * Tamaños y espaciados
 */
export const RiseSpacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
};

/**
 * Radios de borde
 */
export const RiseBorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  full: 9999,
};

/**
 * Tipografía
 */
export const RiseTypography = {
  fontSize: {
    xs: 11,
    sm: 13,
    base: 15,
    lg: 17,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
    '5xl': 48,
  },
  fontWeight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    extrabold: '800',
  },
};
