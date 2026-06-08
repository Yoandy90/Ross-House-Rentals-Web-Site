'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAdminAuth } from './layout';
import {
  Home, Users, FileText, CreditCard, DollarSign, TrendingUp,
  TrendingDown, Percent, Building2, AlertTriangle, ArrowUpRight,
  Clock, CheckCircle2, Wrench, BarChart3, PiggyBank,
} from 'lucide-react';

const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n);

export default function DashboardPage() {
  const { headers } = useAdminAuth();
  const [dash, setDash] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchDash = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/rental-dashboard', { headers: headers() });
      if (res.ok) {
        const data = await res.json();
        setDash(data.dashboard);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchDash(); }, [fetchDash]);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-3 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
    </div>
  );

  const d = dash || { properties: {}, tenants: {}, contracts: {}, revenue: {}, expenses: {}, financials: {}, monthly_trend: [], recent_payments: [] };

  return (
    <div className="space-y-6 relative">
      <div className="fixed top-0 left-1/4 w-96 h-96 bg-blue-500/[0.02] rounded-full blur-3xl pointer-events-none" />

      {/* KPI Row 1 - Properties & Tenants */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPI icon={Home} label="Propiedades" value={d.properties.total || 0} color="cyan" sub={`${d.properties.rented || 0} alquiladas`} />
        <KPI icon={Percent} label="Ocupación" value={`${d.properties.occupancy_rate || 0}%`} color="emerald" sub={`${d.properties.available || 0} disponibles`} />
        <KPI icon={Users} label="Inquilinos" value={d.tenants.total || 0} color="violet" sub={`${d.tenants.active || 0} activos`} />
        <KPI icon={FileText} label="Contratos" value={d.contracts.active || 0} color="blue" sub={`${d.contracts.expiring_soon || 0} por vencer`} badge={d.contracts.expiring_soon > 0} />
      </div>

      {/* KPI Row 2 - Revenue */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPI icon={CreditCard} label="Ingresos Mes" value={fmt(d.revenue.monthly || 0)} color="emerald" sub={`${d.revenue.monthly_payments || 0} pagos`} />
        <KPI icon={TrendingUp} label="Ingresos Año" value={fmt(d.revenue.yearly || 0)} color="blue" sub="Total acumulado" />
        <KPI icon={DollarSign} label="Renta Esperada" value={fmt(d.revenue.expected_monthly || 0)} color="amber" sub={`Tasa cobro: ${d.revenue.collection_rate || 0}%`} />
        <KPI icon={TrendingDown} label="Gastos Mes" value={fmt(d.expenses.monthly || 0)} color="red" sub={`Año: ${fmt(d.expenses.yearly || 0)}`} />
      </div>

      {/* KPI Row 3 - Financials */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPI icon={PiggyBank} label="NOI Anual" value={fmt(d.financials.noi_annual || 0)} color="emerald" sub="Net Operating Income" />
        <KPI icon={BarChart3} label="Cap Rate" value={`${d.financials.cap_rate || 0}%`} color="indigo" sub="Retorno estimado" />
        <KPI icon={DollarSign} label="Depósitos" value={fmt(d.financials.total_deposits_held || 0)} color="amber" sub="En custodia" />
        <KPI icon={Building2} label="Valor Portafolio" value={fmt(d.financials.estimated_portfolio_value || 0)} color="blue" sub="Estimación" />
      </div>

      {/* Charts Row */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Revenue Trend */}
        <div className="bg-white/[0.03] backdrop-blur-sm rounded-2xl border border-white/[0.06] p-5">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-t-2xl" />
          <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-blue-400" /> Tendencia de Ingresos (6 meses)
          </h3>
          {(d.monthly_trend || []).length > 0 ? (
            <div className="flex items-end gap-2 h-32">
              {d.monthly_trend.map((m: any, i: number) => {
                const max = Math.max(...d.monthly_trend.map((t: any) => t.revenue || 1));
                const pct = max > 0 ? (m.revenue / max * 100) : 0;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[9px] text-gray-500">{m.revenue > 0 ? fmt(m.revenue) : ''}</span>
                    <div className="w-full rounded-t-lg bg-gradient-to-t from-blue-600/60 to-blue-400/40 transition-all"
                      style={{ height: `${Math.max(pct, 4)}%` }} />
                    <span className="text-[9px] text-gray-600">{m.month?.split(' ')[0]}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="h-32 flex items-center justify-center text-gray-600 text-sm">Sin datos aún</div>
          )}
        </div>

        {/* Recent Payments */}
        <div className="bg-white/[0.03] backdrop-blur-sm rounded-2xl border border-white/[0.06] p-5">
          <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-4">
            <Clock className="w-4 h-4 text-emerald-400" /> Pagos Recientes
          </h3>
          {(d.recent_payments || []).length > 0 ? (
            <div className="space-y-2">
              {d.recent_payments.map((p: any, i: number) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-xs text-gray-300">{p.tenant_name || 'Inquilino'}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-emerald-400">{fmt(p.amount || 0)}</div>
                    <div className="text-[9px] text-gray-600">{p.payment_date ? new Date(p.payment_date).toLocaleDateString('es-ES') : ''}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-32 flex items-center justify-center text-gray-600 text-sm">Sin pagos registrados</div>
          )}
        </div>
      </div>

      {/* Alerts */}
      {(d.contracts?.expiring_soon > 0 || d.properties?.maintenance > 0) && (
        <div className="bg-amber-500/5 border border-amber-500/15 rounded-2xl p-4">
          <h3 className="text-xs font-bold text-amber-400 flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4" /> Alertas
          </h3>
          <div className="flex flex-wrap gap-3">
            {d.contracts?.expiring_soon > 0 && (
              <span className="text-xs text-gray-400 flex items-center gap-1.5">
                <Clock className="w-3 h-3 text-amber-400" /> {d.contracts.expiring_soon} contrato(s) vencen en 30 días
              </span>
            )}
            {d.properties?.maintenance > 0 && (
              <span className="text-xs text-gray-400 flex items-center gap-1.5">
                <Wrench className="w-3 h-3 text-amber-400" /> {d.properties.maintenance} propiedad(es) en mantenimiento
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function KPI({ icon: Icon, label, value, color, sub, badge }: { icon: any; label: string; value: any; color: string; sub?: string; badge?: boolean }) {
  return (
    <div className={`relative overflow-hidden bg-gradient-to-br from-${color}-500/[0.08] to-transparent backdrop-blur-sm rounded-2xl border border-${color}-500/20 p-4 hover:border-${color}-500/30 transition-all group`}>
      {/* Top gradient bar */}
      <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-${color}-500 to-${color}-400`} />
      {/* Corner gradient orb - premium glow */}
      <div className={`absolute -bottom-6 -right-6 w-24 h-24 bg-${color}-500/[0.08] rounded-full blur-2xl pointer-events-none group-hover:bg-${color}-500/15 transition-all`} />
      <div className={`absolute -top-4 -left-4 w-16 h-16 bg-${color}-500/[0.05] rounded-full blur-xl pointer-events-none`} />
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-2">
          <div className={`w-9 h-9 rounded-lg bg-${color}-500/15 flex items-center justify-center ring-1 ring-${color}-500/20`}>
            <Icon className={`w-4 h-4 text-${color}-400`} />
          </div>
          {badge && <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />}
        </div>
        <div className="text-xl font-bold text-white">{value}</div>
        <div className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">{label}</div>
        {sub && <div className="text-[10px] text-gray-600 mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}
