'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

interface ThemeContextValue {
  mode: ThemeMode;
  resolved: ResolvedTheme;
  setMode: (m: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  mode: 'system',
  resolved: 'dark',
  setMode: () => {},
});

const STORAGE_KEY = 'rh-theme';

function resolveTheme(mode: ThemeMode): ResolvedTheme {
  if (mode === 'system') {
    if (typeof window === 'undefined') return 'dark';
    return window.matchMedia?.('(prefers-color-scheme: dark)')?.matches ? 'dark' : 'light';
  }
  return mode;
}

function applyTheme(resolved: ResolvedTheme) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.toggle('dark', resolved === 'dark');
  root.setAttribute('data-theme', resolved);
  // Update meta theme-color for iOS Safari address bar
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', resolved === 'dark' ? '#050810' : '#F8FAFC');
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('system');
  const [resolved, setResolved] = useState<ResolvedTheme>('dark');

  useEffect(() => {
    // Hydrate mode from localStorage
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
      const initial = (saved === 'light' || saved === 'dark' || saved === 'system') ? saved : 'system';
      setModeState(initial);
      const r = resolveTheme(initial);
      setResolved(r);
      applyTheme(r);
    } catch { /* no-op */ }

    // Listen to system changes when in 'system' mode
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    const onChange = () => {
      try {
        const current = (localStorage.getItem(STORAGE_KEY) as ThemeMode) || 'system';
        if (current === 'system') {
          const r = resolveTheme('system');
          setResolved(r);
          applyTheme(r);
        }
      } catch { /* no-op */ }
    };
    mq?.addEventListener?.('change', onChange);
    return () => mq?.removeEventListener?.('change', onChange);
  }, []);

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
    try { localStorage.setItem(STORAGE_KEY, m); } catch { /* no-op */ }
    const r = resolveTheme(m);
    setResolved(r);
    applyTheme(r);
  }, []);

  return (
    <ThemeContext.Provider value={{ mode, resolved, setMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

// ── No-flash script (inject in <head> BEFORE React hydration) ─────────────
export const THEME_NO_FLASH_SCRIPT = `
(function(){
  try {
    var saved = localStorage.getItem('${STORAGE_KEY}');
    var mode = (saved === 'light' || saved === 'dark' || saved === 'system') ? saved : 'system';
    var isDark = mode === 'dark' || (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (isDark) document.documentElement.classList.add('dark');
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  } catch(e) {}
})();
`.trim();
