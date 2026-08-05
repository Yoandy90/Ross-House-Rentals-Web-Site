'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useInvestorAuth } from '../layout';
import {
  DollarSign, TrendingUp, Briefcase, Target, Activity, Calendar,
  ArrowRight, CheckCircle2, Clock, ChevronRight, Building2,
} from 'lucide-react';

const fmtMoney = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n || 0);

export default function InvestorDashboardPage() {
  const { headers, user } = useInvestorAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/investor/dashboard', { headers: headers() });
        if (res.ok) setData(await res.json());
      } catch (e) { console.error(e); }
      setLoading(false);
    };
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-3 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" /></div>;

  const s = data?.summary || {};
  const investments = data?.investments || [];
  const recentDist = data?.recent_distributions || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Hola, {user?.name?.split(' ')[0] || 'Inversionista'} 👋</h1>
        <p className="text-sm text-gray-500 mt-1">Aquí está el resumen de tu portafolio de inversiones</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Capital invertido" value={fmtMoney(s.total_invested)} icon={DollarSign} color="emerald" />
        <KpiCard label="Distribuciones recibidas" value={fmtMoney(s.total_distributions_received)} icon={TrendingUp} color="blue" />
        <KpiCard label="Deals activos" value={String(s.active_deals || 0)} icon={Briefcase} color="violet" />
        <KpiCard label="ROI total" value={`${(s.roi_percent || 0).toFixed(1)}%`} icon={Target} color={s.roi_percent >= 0 ? 'emerald' : 'red'} />
      </div>

      {/* My investments */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-white">Mis Inversiones</h2>
          <Link href="/inversor/deals" className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-bold">Ver todas <ArrowRight className="w-3 h-3" /></Link>
        </div>
        {investments.length === 0 ? (
          <div className="bg-white/[0.03] rounded-2xl border border-white/[0.06] p-12 text-center text-gray-500">
            <Briefcase className="w-12 h-12 mx-auto mb-3 text-gray-600" />
            <p>Aún no tienes inversiones activas</p>
            <p className="text-xs mt-2">Tu administrador te avisará cuando seas añadido a un deal.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {investments.slice(0, 6).map((inv: any) => (
              <Link key={inv.id} href={`/inversor/deals/${inv.deal_id}`} className="group bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 hover:border-emerald-500/30 hover:bg-white/[0.05] transition">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0"><Building2 className="w-5 h-5 text-emerald-400" /></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-bold text-white truncate group-hover:text-emerald-300 transition">{inv.deal_name}</h3>
                      <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-emerald-400 transition flex-shrink-0" />
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <div className="text-[10px] text-gray-500 uppercase tracking-wider">Mi capital</div>
                        <div className="text-white font-bold">{fmtMoney(inv.amount)}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-gray-500 uppercase tracking-wider">Equity</div>
                        <div className="text-emerald-300 font-bold">{(inv.equity_percent || 0).toFixed(2)}%</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-gray-500 uppercase tracking-wider">Recibido</div>
                        <div className="text-blue-300 font-bold">{fmtMoney(inv.total_distributions_received)}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-gray-500 uppercase tracking-wider">Estado</div>
                        <StatusPill status={inv.status} />
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Recent distributions */}
      {recentDist.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-white">Distribuciones recientes</h2>
            <Link href="/inversor/distribuciones" className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-bold">Ver todas <ArrowRight className="w-3 h-3" /></Link>
          </div>
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-white/[0.03]">
                <tr className="text-left text-[10px] text-gray-500 uppercase tracking-wider">
                  <th className="px-4 py-3">Deal</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Período</th>
                  <th className="px-4 py-3 text-right">Monto</th>
                  <th className="px-4 py-3">Estado</th>
                </tr>
              </thead>
              <tbody>
                {recentDist.slice(0, 8).map((d: any) => {
                  const myAmount = (d.per_investment || []).reduce((s: number, p: any) => s + (p.amount || 0), 0);
                  return (
                    <tr key={d.id} className="border-t border-white/[0.04]">
                      <td className="px-4 py-3 text-white font-bold">{d.deal_name}</td>
                      <td className="px-4 py-3 text-gray-300 text-xs">{d.distribution_type.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{d.period}</td>
                      <td className="px-4 py-3 text-right text-emerald-300 font-bold">{fmtMoney(myAmount)}</td>
                      <td className="px-4 py-3"><DistStatusPill status={d.status} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function KpiCard({ label, value, icon: Icon, color }: any) {
  const cmap: Record<string, { from: string; border: string; text: string }> = {
    emerald: { from: 'from-emerald-500/15', border: 'border-emerald-500/30', text: 'text-emerald-400' },
    blue: { from: 'from-blue-500/15', border: 'border-blue-500/30', text: 'text-blue-400' },
    violet: { from: 'from-violet-500/15', border: 'border-violet-500/30', text: 'text-violet-400' },
    red: { from: 'from-red-500/15', border: 'border-red-500/30', text: 'text-red-400' },
  };
  const c = cmap[color] || cmap.emerald;
  return (
    <div className={`bg-gradient-to-br ${c.from} to-transparent border ${c.border} rounded-2xl p-5`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{label}</span>
        <Icon className={`w-4 h-4 ${c.text}`} />
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    pending: { label: 'Pendiente', color: 'text-amber-300', bg: 'bg-amber-500/10' },
    active: { label: 'Activo', color: 'text-emerald-300', bg: 'bg-emerald-500/10' },
    redeemed: { label: 'Redimido', color: 'text-blue-300', bg: 'bg-blue-500/10' },
    cancelled: { label: 'Cancelado', color: 'text-gray-400', bg: 'bg-gray-500/10' },
  };
  const c = map[status] || map.pending;
  return <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${c.bg} ${c.color}`}>{c.label}</span>;
}

function DistStatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string; bg: string; Icon: any }> = {
    scheduled: { label: 'Programada', color: 'text-amber-300', bg: 'bg-amber-500/10', Icon: Clock },
    paid: { label: 'Pagada', color: 'text-emerald-300', bg: 'bg-emerald-500/10', Icon: CheckCircle2 },
    failed: { label: 'Fallida', color: 'text-red-300', bg: 'bg-red-500/10', Icon: Activity },
    cancelled: { label: 'Cancelada', color: 'text-gray-400', bg: 'bg-gray-500/10', Icon: Activity },
  };
  const c = map[status] || map.scheduled;
  const Icon = c.Icon;
  return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${c.bg} ${c.color}`}><Icon className="w-2.5 h-2.5" /> {c.label}</span>;
}
