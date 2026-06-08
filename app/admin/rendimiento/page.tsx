'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAdminAuth } from '../layout';
import {
  TrendingUp, TrendingDown, DollarSign, Home, Users, Percent,
  BarChart3, PiggyBank, Calendar, ArrowUpRight, ArrowDownRight,
  Building2, CreditCard, AlertTriangle, Target, Activity,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  AreaChart, Area, PieChart, Pie, Cell, CartesianGrid, Legend,
  LineChart, Line,
} from 'recharts';

const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n);
const COLORS = ['#06b6d4', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#3b82f6', '#ec4899', '#14b8a6'];

export default function RendimientoPage() {
  const { headers } = useAdminAuth();
  const [report, setReport] = useState<any>(null);
  const [performance, setPerformance] = useState<any>(null);
  const [expenses, setExpenses] = useState<any>(null);
  const [overdue, setOverdue] = useState<any>(null);
  const [dash, setDash] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'month' | 'quarter' | 'year'>('year');

  const fetchAll = useCallback(async () => {
    try {
      const [rptRes, perfRes, expRes, odRes, dashRes] = await Promise.all([
        fetch('/api/admin/property-report/data', { headers: headers() }),
        fetch('/api/admin/property-performance', { headers: headers() }),
        fetch('/api/admin/property-expenses', { headers: headers() }),
        fetch('/api/admin/overdue-payments', { headers: headers() }),
        fetch('/api/admin/rental-dashboard', { headers: headers() }),
      ]);
      if (rptRes.ok) { const d = await rptRes.json(); setReport(d); }
      if (perfRes.ok) { const d = await perfRes.json(); setPerformance(d); }
      if (expRes.ok) { const d = await expRes.json(); setExpenses(d); }
      if (odRes.ok) { const d = await odRes.json(); setOverdue(d); }
      if (dashRes.ok) { const d = await dashRes.json(); setDash(d.dashboard); }
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-3 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
    </div>
  );

  const r = report || {};
  const d = dash || { properties: {}, tenants: {}, contracts: {}, revenue: {}, expenses: {}, financials: {}, monthly_trend: [] };
  const perf = performance || {};
  const exp = expenses || {};
  const od = overdue || {};

  const monthlyData = (d.monthly_trend || []).map((m: any) => ({
    name: m.month?.split(' ')[0] || '',
    ingresos: m.revenue || 0,
    gastos: m.expenses || 0,
    neto: (m.revenue || 0) - (m.expenses || 0),
  }));

  const expByCategory = (exp.by_category || []).map((c: any) => ({
    name: c.category_name || c._id || 'Otro',
    value: c.total || 0,
  }));

  const propPerformance = (perf.properties || []).map((p: any) => ({
    name: (p.name || 'Prop').substring(0, 15),
    ingreso: p.total_revenue || 0,
    gasto: p.total_expenses || 0,
    roi: p.roi || 0,
  }));

  const noi = (d.revenue?.yearly || 0) - (d.expenses?.yearly || 0);
  const profitMargin = d.revenue?.yearly > 0 ? ((noi / d.revenue.yearly) * 100).toFixed(1) : '0';
  const avgRentPerProp = d.properties?.total > 0 ? (d.revenue?.expected_monthly || 0) / d.properties.total : 0;

  return (
    <div className="space-y-5 relative">
      <div className="fixed top-0 left-1/3 w-96 h-96 bg-indigo-500/[0.02] rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-indigo-500/5 border border-indigo-500/20 flex items-center justify-center">
            <TrendingUp className="w-6 h-6 text-indigo-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Rendimiento</h2>
            <p className="text-sm text-gray-500">Análisis financiero y ROI del portafolio</p>
          </div>
        </div>
        <div className="flex gap-1 bg-white/[0.03] rounded-xl p-1 border border-white/[0.06]">
          {['month', 'quarter', 'year'].map(p => (
            <button key={p} onClick={() => setPeriod(p as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${period === p ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/25' : 'text-gray-500 hover:text-gray-300'}`}>
              {p === 'month' ? 'Mes' : p === 'quarter' ? 'Trimestre' : 'Año'}
            </button>
          ))}
        </div>
      </div>

      {/* Financial KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <MiniKPI icon={CreditCard} label="Ingresos Anuales" value={fmt(d.revenue?.yearly || 0)} color="emerald" trend="+12%" up />
        <MiniKPI icon={TrendingDown} label="Gastos Anuales" value={fmt(d.expenses?.yearly || 0)} color="red" />
        <MiniKPI icon={PiggyBank} label="NOI (Neto)" value={fmt(noi)} color="blue" trend={`${profitMargin}%`} up={noi > 0} />
        <MiniKPI icon={Target} label="Cap Rate" value={`${d.financials?.cap_rate || 0}%`} color="indigo" />
        <MiniKPI icon={Percent} label="Ocupación" value={`${d.properties?.occupancy_rate || 0}%`} color="cyan" />
      </div>

      {/* Revenue vs Expenses Chart */}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white/[0.03] backdrop-blur-sm rounded-2xl border border-white/[0.06] p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-blue-400" /> Ingresos vs Gastos (Mensual)
            </h3>
          </div>
          {monthlyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={monthlyData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="name" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 12, color: '#fff' }}
                  formatter={(v: number) => [fmt(v), '']}
                />
                <Bar dataKey="ingresos" fill="#10b981" radius={[6, 6, 0, 0]} name="Ingresos" />
                <Bar dataKey="gastos" fill="#ef4444" radius={[6, 6, 0, 0]} name="Gastos" />
                <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-600">Sin datos suficientes para gráfica</div>
          )}
        </div>

        {/* Expense Breakdown Pie */}
        <div className="bg-white/[0.03] backdrop-blur-sm rounded-2xl border border-white/[0.06] p-5">
          <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-4">
            <DollarSign className="w-4 h-4 text-red-400" /> Gastos por Categoría
          </h3>
          {expByCategory.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={expByCategory} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={3} dataKey="value">
                    {expByCategory.map((_: any, i: number) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 11, color: '#fff' }}
                    formatter={(v: number) => [fmt(v), '']} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-2">
                {expByCategory.slice(0, 5).map((c: any, i: number) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="text-gray-400">{c.name}</span>
                    </div>
                    <span className="text-gray-300 font-medium">{fmt(c.value)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-600 text-sm">Sin gastos registrados</div>
          )}
        </div>
      </div>

      {/* Net Income Trend */}
      <div className="bg-white/[0.03] backdrop-blur-sm rounded-2xl border border-white/[0.06] p-5">
        <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-4">
          <Activity className="w-4 h-4 text-indigo-400" /> Flujo de Caja Neto (Mensual)
        </h3>
        {monthlyData.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={monthlyData}>
              <defs>
                <linearGradient id="netGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#818cf8" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#818cf8" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="name" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
              <Tooltip contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 12, color: '#fff' }}
                formatter={(v: number) => [fmt(v), 'Neto']} />
              <Area type="monotone" dataKey="neto" stroke="#818cf8" fill="url(#netGrad)" strokeWidth={2.5} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-48 flex items-center justify-center text-gray-600">Sin datos</div>
        )}
      </div>

      {/* Property Performance Table */}
      <div className="bg-white/[0.03] backdrop-blur-sm rounded-2xl border border-white/[0.06] p-5">
        <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-4">
          <Building2 className="w-4 h-4 text-cyan-400" /> Rendimiento por Propiedad
        </h3>
        {propPerformance.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="text-left py-3 px-3 text-xs text-gray-500 font-bold uppercase tracking-wider">Propiedad</th>
                  <th className="text-right py-3 px-3 text-xs text-gray-500 font-bold uppercase tracking-wider">Ingresos</th>
                  <th className="text-right py-3 px-3 text-xs text-gray-500 font-bold uppercase tracking-wider">Gastos</th>
                  <th className="text-right py-3 px-3 text-xs text-gray-500 font-bold uppercase tracking-wider">Neto</th>
                  <th className="text-right py-3 px-3 text-xs text-gray-500 font-bold uppercase tracking-wider">ROI</th>
                </tr>
              </thead>
              <tbody>
                {propPerformance.map((p: any, i: number) => {
                  const net = p.ingreso - p.gasto;
                  return (
                    <tr key={i} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition">
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                            <Home className="w-3.5 h-3.5 text-cyan-400" />
                          </div>
                          <span className="text-gray-300 font-medium">{p.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right text-emerald-400 font-medium">{fmt(p.ingreso)}</td>
                      <td className="py-3 px-3 text-right text-red-400">{fmt(p.gasto)}</td>
                      <td className={`py-3 px-3 text-right font-bold ${net >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmt(net)}</td>
                      <td className="py-3 px-3 text-right">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${p.roi >= 5 ? 'bg-emerald-500/10 text-emerald-400' : p.roi >= 0 ? 'bg-amber-500/10 text-amber-400' : 'bg-red-500/10 text-red-400'}`}>
                          {p.roi.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="h-32 flex items-center justify-center text-gray-600">Sin datos de propiedades</div>
        )}
      </div>

      {/* Bottom Row: Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <QuickStat label="Renta Promedio/Prop" value={fmt(avgRentPerProp)} icon={Home} />
        <QuickStat label="Tasa de Cobro" value={`${d.revenue?.collection_rate || 0}%`} icon={Target} />
        <QuickStat label="Pagos Atrasados" value={`${od.count || 0}`} icon={AlertTriangle} alert={od.count > 0} />
        <QuickStat label="Depósitos en Custodia" value={fmt(d.financials?.total_deposits_held || 0)} icon={PiggyBank} />
      </div>
    </div>
  );
}

function MiniKPI({ icon: Icon, label, value, color, trend, up }: { icon: any; label: string; value: string; color: string; trend?: string; up?: boolean }) {
  return (
    <div className={`bg-white/[0.03] backdrop-blur-sm rounded-2xl border border-white/[0.06] p-4 hover:border-${color}-500/20 transition group`}>
      <div className="flex items-center justify-between mb-2">
        <div className={`w-8 h-8 rounded-lg bg-${color}-500/10 flex items-center justify-center`}>
          <Icon className={`w-4 h-4 text-${color}-400`} />
        </div>
        {trend && (
          <span className={`flex items-center gap-0.5 text-[10px] font-bold ${up ? 'text-emerald-400' : 'text-red-400'}`}>
            {up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />} {trend}
          </span>
        )}
      </div>
      <div className="text-lg font-bold text-white">{value}</div>
      <div className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">{label}</div>
    </div>
  );
}

function QuickStat({ label, value, icon: Icon, alert }: { label: string; value: string; icon: any; alert?: boolean }) {
  return (
    <div className={`flex items-center gap-3 bg-white/[0.03] rounded-xl border border-white/[0.06] p-3 ${alert ? 'border-amber-500/20' : ''}`}>
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${alert ? 'bg-amber-500/10' : 'bg-white/[0.04]'}`}>
        <Icon className={`w-4 h-4 ${alert ? 'text-amber-400' : 'text-gray-400'}`} />
      </div>
      <div>
        <div className={`text-sm font-bold ${alert ? 'text-amber-400' : 'text-white'}`}>{value}</div>
        <div className="text-[10px] text-gray-500">{label}</div>
      </div>
    </div>
  );
}
