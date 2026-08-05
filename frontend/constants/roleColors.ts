/**
 * Role-based color themes for Admin Panel
 */

export interface RoleColorTheme {
  primary: string;
  primaryDark: string;
  primaryLight: string;
  secondary: string;
  accent: string;
  accentDark: string;
}

// Admin Theme - Red/Wine colors (Ross Tax)
export const AdminColors: RoleColorTheme = {
  primary: '#6C1110',
  primaryDark: '#4A0C0B',
  primaryLight: '#8E1614',
  secondary: '#ED202D',
  accent: '#5DC1D9',
  accentDark: '#3A9FB5',
};

// Office Assistant Theme - Blue/Turquoise colors
export const AssistantColors: RoleColorTheme = {
  primary: '#3B82F6',        // Blue
  primaryDark: '#1D4ED8',    // Dark Blue
  primaryLight: '#60A5FA',   // Light Blue
  secondary: '#5DC1D9',      // Turquoise
  accent: '#0EA5E9',         // Sky Blue
  accentDark: '#0284C7',     // Dark Sky Blue
};

/**
 * Get color theme based on user role
 */
export function getRoleColors(role?: string): RoleColorTheme {
  if (role === 'office_assistant') {
    return AssistantColors;
  }
  // Default to admin colors
  return AdminColors;
}
