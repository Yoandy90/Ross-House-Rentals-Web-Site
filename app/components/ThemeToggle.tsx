'use client';

import React from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme, ThemeMode } from './ThemeProvider';

interface Props {
  variant?: 'segmented' | 'icon-only' | 'sidebar';
  className?: string;
}

const OPTIONS: Array<{ value: ThemeMode; icon: React.ReactNode; label: string }> = [
  { value: 'light', icon: <Sun className="w-3.5 h-3.5" />, label: 'Claro' },
  { value: 'dark', icon: <Moon className="w-3.5 h-3.5" />, label: 'Oscuro' },
  { value: 'system', icon: <Monitor className="w-3.5 h-3.5" />, label: 'Auto' },
];

export default function ThemeToggle({ variant = 'segmented', className = '' }: Props) {
  const { mode, setMode } = useTheme();

  if (variant === 'icon-only') {
    // Cycle through light → dark → system
    const nextMode: ThemeMode = mode === 'light' ? 'dark' : mode === 'dark' ? 'system' : 'light';
    const current = OPTIONS.find(o => o.value === mode);
    return (
      <button
        onClick={() => setMode(nextMode)}
        className={`p-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 transition-colors ${className}`}
        title={`Tema: ${current?.label}`}
        aria-label={`Cambiar tema. Actual: ${current?.label}`}
      >
        {current?.icon}
      </button>
    );
  }

  if (variant === 'sidebar') {
    return (
      <div className={`mx-2 mb-2 p-1 rounded-xl bg-white/5 dark:bg-white/5 border border-white/10 flex items-center gap-0.5 ${className}`}>
        {OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => setMode(opt.value)}
            className={`flex-1 flex items-center justify-center py-1.5 rounded-lg text-[10px] font-semibold transition-all ${
              mode === opt.value
                ? 'bg-gradient-to-br from-indigo-500/30 to-violet-600/20 text-indigo-200 shadow-sm'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
            title={opt.label}
            aria-label={opt.label}
            aria-pressed={mode === opt.value}
          >
            {opt.icon}
          </button>
        ))}
      </div>
    );
  }

  // Default: segmented
  return (
    <div className={`inline-flex items-center gap-0.5 p-1 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 ${className}`}>
      {OPTIONS.map(opt => (
        <button
          key={opt.value}
          onClick={() => setMode(opt.value)}
          className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 transition-all ${
            mode === opt.value
              ? 'bg-white dark:bg-white/10 text-slate-900 dark:text-white shadow-sm'
              : 'text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'
          }`}
          title={opt.label}
          aria-pressed={mode === opt.value}
        >
          {opt.icon}
          <span className="hidden sm:inline">{opt.label}</span>
        </button>
      ))}
    </div>
  );
}
