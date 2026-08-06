'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Bell, ClipboardList, Wrench, PenLine, CreditCard, Landmark, CheckCircle2 } from 'lucide-react';

export type NavSummary = {
  total: number;
  new_applications: number;
  open_maintenance: number;
  pending_signatures: number;
  late_payments: number;
  bank_unmatched?: number;
  delinquent_taxes: { count: number; total_due: number };
};

export default function NavBell({ summary }: { summary: NavSummary | null }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const total = summary?.total || 0;
  const rows = summary ? [
    { count: summary.new_applications, label: 'Aplicaciones nuevas', desc: 'Prospectos sin revisar', href: '/admin/aplicaciones', Icon: ClipboardList, color: 'text-blue-400' },
    { count: summary.open_maintenance, label: 'Mantenimiento abierto', desc: 'Solicitudes sin completar', href: '/admin/mantenimiento', Icon: Wrench, color: 'text-amber-400' },
    { count: summary.pending_signatures, label: 'Firmas pendientes', desc: 'Contratos por firmar', href: '/admin/contratos', Icon: PenLine, color: 'text-violet-400' },
    { count: summary.late_payments, label: 'Pagos atrasados', desc: 'Rentas vencidas sin cobrar', href: '/admin/pagos', Icon: CreditCard, color: 'text-red-400' },
    { count: summary.delinquent_taxes.count, label: 'Impuestos vencidos', desc: `Deuda con el condado: $${summary.delinquent_taxes.total_due.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, href: '/admin/impuestos', Icon: Landmark, color: 'text-orange-400' },
    { count: summary.bank_unmatched || 0, label: 'Banco sin conciliar', desc: 'Movimientos bancarios sin cruzar', href: '/admin/banco', Icon: Landmark, color: 'text-emerald-400' },
  ].filter(r => r.count > 0) : [];

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="relative p-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 transition-colors"
        title="Pendientes"
        data-testid="nav-bell"
      >
        <Bell className="w-3.5 h-3.5" />
        {total > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center shadow-lg shadow-red-500/40">
            {total > 99 ? '99+' : total}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#0b1220] shadow-2xl overflow-hidden z-50">
          <div className="px-4 py-3 border-b border-slate-100 dark:border-white/[0.06] flex items-center justify-between">
            <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">Pendientes</span>
            <span className="text-[10px] text-slate-400 dark:text-gray-500">{total} en total</span>
          </div>
          {rows.length === 0 ? (
            <div className="px-4 py-6 text-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
              <div className="text-xs text-slate-500 dark:text-gray-400 font-medium">Todo al día — nada pendiente 🎉</div>
            </div>
          ) : rows.map(r => (
            <a key={r.href} href={r.href} onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-white/[0.04] transition border-b border-slate-50 dark:border-white/[0.03] last:border-0">
              <r.Icon className={`w-4 h-4 flex-shrink-0 ${r.color}`} />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-slate-800 dark:text-gray-200">{r.label}</div>
                <div className="text-[10px] text-slate-400 dark:text-gray-500 truncate">{r.desc}</div>
              </div>
              <span className="min-w-[22px] h-[22px] px-1.5 rounded-full bg-red-500/10 text-red-500 dark:text-red-400 border border-red-500/20 text-[11px] font-bold flex items-center justify-center">
                {r.count}
              </span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
