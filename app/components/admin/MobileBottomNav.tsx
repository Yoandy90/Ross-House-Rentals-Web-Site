'use client';

import React from 'react';
import { LayoutDashboard, CreditCard, FileText, Home, Menu } from 'lucide-react';

const ITEMS = [
  { href: '/admin', Icon: LayoutDashboard, label: 'Inicio' },
  { href: '/admin/pagos', Icon: CreditCard, label: 'Pagos' },
  { href: '/admin/contratos', Icon: FileText, label: 'Contratos' },
  { href: '/admin/propiedades', Icon: Home, label: 'Casas' },
];

export default function MobileBottomNav({ pathname, onMenu, badgeTotal = 0 }: {
  pathname: string;
  onMenu: () => void;
  badgeTotal?: number;
}) {
  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-[#080d18]/95 backdrop-blur-xl border-t border-slate-200 dark:border-white/[0.08] pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-stretch">
        {ITEMS.map(it => {
          const active = pathname === it.href;
          return (
            <a key={it.href} href={it.href}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 min-h-[52px] transition ${
                active ? 'text-blue-500 dark:text-blue-400' : 'text-slate-400 dark:text-gray-500'
              }`}>
              <it.Icon className="w-5 h-5" />
              <span className="text-[9px] font-bold">{it.label}</span>
            </a>
          );
        })}
        <button onClick={onMenu} className="relative flex-1 flex flex-col items-center gap-0.5 py-2.5 min-h-[52px] text-slate-400 dark:text-gray-500">
          <Menu className="w-5 h-5" />
          <span className="text-[9px] font-bold">Menú</span>
          {badgeTotal > 0 && (
            <span className="absolute top-1 right-[22%] min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
              {badgeTotal > 99 ? '99+' : badgeTotal}
            </span>
          )}
        </button>
      </div>
    </nav>
  );
}
