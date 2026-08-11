import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'rh-theme-mode';

// ─── Premium color tokens ─────────────────────────────────────────────────
export interface ThemeColors {
  // Backgrounds
  bg: string;              // Page background
  bgElevated: string;      // Cards
  bgOverlay: string;       // Modals
  bgMuted: string;         // Muted surface

  // Text
  text: string;            // Primary
  textSecondary: string;   // Secondary
  textMuted: string;       // Muted / disabled
  textInverse: string;

  // Borders
  border: string;
  borderStrong: string;

  // Brand
  primary: string;
  primaryDark: string;
  primaryLight: string;

  // States
  success: string;
  warning: string;
  danger: string;
  info: string;

  // Utility
  shadow: string;
  overlay: string;
  gradient: [string, string];
}

const darkColors: ThemeColors = {
  bg: '#0C0C0E',
  bgElevated: '#17171A',
  bgOverlay: '#1F1F23',
  bgMuted: 'rgba(255,255,255,0.04)',

  text: '#FFFFFF',
  textSecondary: '#D1D5DB',
  textMuted: '#9CA3AF',
  textInverse: '#0F172A',

  border: 'rgba(255,255,255,0.08)',
  borderStrong: 'rgba(255,255,255,0.16)',

  primary: '#ED1B33',
  primaryDark: '#C41428',
  primaryLight: '#FF3D52',

  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  info: '#3B82F6',

  shadow: 'rgba(0,0,0,0.4)',
  overlay: 'rgba(0,0,0,0.7)',
  gradient: ['#0F172A', '#1E1B4B'],
};

const lightColors: ThemeColors = {
  bg: '#F8FAFC',
  bgElevated: '#FFFFFF',
  bgOverlay: '#FFFFFF',
  bgMuted: 'rgba(15,23,42,0.03)',

  text: '#0F172A',
  textSecondary: '#334155',
  textMuted: '#64748B',
  textInverse: '#FFFFFF',

  border: 'rgba(15,23,42,0.08)',
  borderStrong: 'rgba(15,23,42,0.16)',

  primary: '#ED1B33',
  primaryDark: '#C41428',
  primaryLight: '#FF3D52',

  success: '#059669',
  warning: '#D97706',
  danger: '#DC2626',
  info: '#2563EB',

  shadow: 'rgba(15,23,42,0.08)',
  overlay: 'rgba(15,23,42,0.5)',
  gradient: ['#EEF2FF', '#FAF5FF'],
};

interface ThemeContextValue {
  mode: ThemeMode;
  resolved: ResolvedTheme;
  colors: ThemeColors;
  setMode: (m: ThemeMode) => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextValue>({
  mode: 'system',
  resolved: 'dark',
  colors: darkColors,
  setMode: () => {},
  isDark: true,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
      if (saved === 'light' || saved === 'dark' || saved === 'system') {
        setModeState(saved);
      }
      setHydrated(true);
    });
  }, []);

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
    AsyncStorage.setItem(STORAGE_KEY, m).catch(() => {});
  }, []);

  const resolved: ResolvedTheme = useMemo(() => {
    if (mode === 'system') return systemScheme === 'light' ? 'light' : 'dark';
    return mode;
  }, [mode, systemScheme]);

  const colors = resolved === 'dark' ? darkColors : lightColors;

  const value = useMemo<ThemeContextValue>(() => ({
    mode,
    resolved,
    colors,
    setMode,
    isDark: resolved === 'dark',
  }), [mode, resolved, colors, setMode]);

  // Avoid flash while loading persisted preference
  if (!hydrated) return null;

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

export { darkColors, lightColors };
