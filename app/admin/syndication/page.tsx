'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAdminAuth } from '../layout';
import {
  Briefcase, Search, RefreshCw, Plus, TrendingUp, DollarSign, Users,
  Building2, ChevronRight, Target, Activity, Calendar, Eye, ArrowRight,
} from 'lucide-react';

const STATUS_CFG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  draft:   { label: 'Borrador',  color: 'text-gray-400',    bg: 'bg-gray-500/10',    border: 'border-gray-500/20' },
  open:    { label: 'Abierto',   color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
  funded:  { label: 'Financiado',color: 'text-blue-400',    bg: 'bg-blue-500/10',    border: 'border-blue-500/30' },
  closed:  { label: 'Cerrado',   color: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/20' },
  exited:  { label: 'Salido',    color: 'text-purple-400',  bg: 'bg-purple-500/10',  border: 'border-purple-500/20' },
};

const fmtMoney = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n || 0);

export default function SyndicationPage() {
  const { headers } = useAdminAuth();
  const [deals, setDeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [stats, setStats] = useState<any>({});
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const fetchDeals = useCallback(async () => {
    try {
      const qs = new URLSearchParams({ page: '1', limit: '100' });
      if (statusFilter !== 'all') qs.set('status', statusFilter);
      if (debouncedSearch) qs.set('search', debouncedSearch);
      const res = await fetch(`/api/admin/syndication/deals?${qs.toString()}`, { headers: headers() });
      if (res.ok) {
        const d = await res.json();
        setDeals(d.deals || []);
        setStats(d.stats || {});
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [headers, statusFilter, debouncedSearch]);

  useEffect(() => { fetchDeals(); }, [fetchDeals]);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-3 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
    </div>
  );

  const totalRaised = stats.total_raised_all || 0;
  const totalTarget = stats.total_target_all || 0;
  const fundingPct = totalTarget > 0 ? Math.min(100, (totalRaised / totalTarget) * 100) : 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/5 border border-emerald-500/30 flex items-center justify-center">
            <Briefcase className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Syndication / Deals</h2>
            <p className="text-sm text-gray-500">Capital raise · LP/GP cap table · Distribuciones</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchDeals} className="px-3 py-2 bg-white/[0.03] border border-white/[0.08] rounded-xl text-xs text-gray-300 hover:bg-white/[0.06] transition flex items-center gap-2">
            <RefreshCw className="w-4 h-4" /> Recargar
          </button>
          <Link href="/admin/syndication/new" className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl text-sm font-bold hover:opacity-90 transition flex items-center gap-2">
            <Plus className="w-4 h-4" /> Nuevo Deal
          </Link>
        </div>
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-gradient-to-br from-emerald-500/10 to-transparent border border-emerald-500/20 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2"><DollarSign className="w-4 h-4 text-emerald-400" /><span className="text-xs text-gray-400 font-bold uppercase tracking-wider">Capital Levantado</span></div>
          <div className="text-2xl font-bold text-white">{fmtMoney(totalRaised)}</div>
          <div className="text-[10px] text-gray-500 mt-1">de {fmtMoney(totalTarget)} target · {fundingPct.toFixed(1)}%</div>
          <div className="mt-2 h-1 bg-white/[0.05] rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-400" style={{ width: `${fundingPct}%` }} />
          </div>
        </div>
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2"><Briefcase className="w-4 h-4 text-blue-400" /><span className="text-xs text-gray-400 font-bold uppercase tracking-wider">Deals Totales</span></div>
          <div className="text-2xl font-bold text-white">{stats.total ?? 0}</div>
          <div className="text-[10px] text-gray-500 mt-1">{stats.open ?? 0} abiertos · {stats.funded ?? 0} financiados</div>
        </div>
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2"><Users className="w-4 h-4 text-violet-400" /><span className="text-xs text-gray-400 font-bold uppercase tracking-wider">Inversionistas</span></div>
          <div className="text-2xl font-bold text-white">{stats.total_investors_all ?? 0}</div>
          <div className="text-[10px] text-gray-500 mt-1">Suma cross-deal</div>
        </div>
        <Link href="/admin/inversionistas" className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 hover:border-violet-500/30 hover:bg-violet-500/5 transition group">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2"><Users className="w-4 h-4 text-amber-400" /><span className="text-xs text-gray-400 font-bold uppercase tracking-wider">Portafolio LPs</span></div>
              <div className="text-sm font-bold text-white">Ver inversionistas</div>
              <div className="text-[10px] text-gray-500 mt-1">Vista cruzada por LP</div>
            </div>
            <ArrowRight className="w-4 h-4 text-gray-500 group-hover:text-violet-400 group-hover:translate-x-1 transition" />
          </div>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white/[0.03] border border-white/[0.08] rounded-xl text-white text-sm focus:border-emerald-500 focus:outline-none"
            placeholder="Buscar por nombre, dirección, descripción..." />
        </div>
        <div className="flex gap-1 bg-white/[0.03] rounded-xl p-1 border border-white/[0.06] overflow-x-auto">
          <button onClick={() => setStatusFilter('all')} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition whitespace-nowrap ${statusFilter === 'all' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25' : 'text-gray-500 hover:text-gray-300'}`}>Todos</button>
          {Object.entries(STATUS_CFG).map(([k, c]) => (
            <button key={k} onClick={() => setStatusFilter(k)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition whitespace-nowrap ${statusFilter === k ? `${c.bg} ${c.color} border ${c.border}` : 'text-gray-500 hover:text-gray-300'}`}>{c.label}</button>
          ))}
        </div>
      </div>

      {/* Deal cards */}
      {deals.length === 0 ? (
        <div className="bg-white/[0.03] rounded-2xl border border-white/[0.06] p-12 text-center">
          <Briefcase className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500 mb-4">No hay deals todavía</p>
          <Link href="/admin/syndication/new" className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded-xl text-sm font-bold hover:bg-emerald-500/25">
            <Plus className="w-4 h-4" /> Crear primer deal
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {deals.map((d: any) => {
            const st = STATUS_CFG[d.status] || STATUS_CFG.draft;
            const raisedPct = d.target_raise > 0 ? Math.min(100, (d.total_raised / d.target_raise) * 100) : 0;
            return (
              <Link key={d.id} href={`/admin/syndication/${d.id}`} className="group bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden hover:border-emerald-500/30 hover:bg-white/[0.05] transition">
                {d.cover_image ? (
                  <div className="h-32 bg-gray-900 relative overflow-hidden">
                    <img src={d.cover_image} alt="" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0a1020] to-transparent" />
                    <span className={`absolute top-3 right-3 text-[10px] px-2.5 py-1 rounded-full font-bold ${st.bg} ${st.color} ${st.border} border backdrop-blur-md`}>{st.label}</span>
                  </div>
                ) : (
                  <div className="h-32 bg-gradient-to-br from-emerald-500/20 via-teal-500/10 to-cyan-500/5 relative flex items-center justify-center">
                    <Building2 className="w-12 h-12 text-emerald-400/30" />
                    <span className={`absolute top-3 right-3 text-[10px] px-2.5 py-1 rounded-full font-bold ${st.bg} ${st.color} ${st.border} border backdrop-blur-md`}>{st.label}</span>
                  </div>
                )}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className="text-sm font-bold text-white truncate group-hover:text-emerald-300 transition">{d.name}</h3>
                    <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-emerald-400 transition" />
                  </div>
                  <p className="text-[11px] text-gray-500 truncate mb-3">{d.property_address || 'Sin dirección'} · {d.units > 0 ? `${d.units} units` : d.property_type}</p>

                  {/* Progress */}
                  <div className="mb-3">
                    <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                      <span>Levantado</span>
                      <span className="text-white font-bold">{raisedPct.toFixed(1)}%</span>
                    </div>
                    <div className="h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-400" style={{ width: `${raisedPct}%` }} />
                    </div>
                    <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                      <span className="font-bold text-emerald-300">{fmtMoney(d.total_raised)}</span>
                      <span>de {fmtMoney(d.target_raise)}</span>
                    </div>
                  </div>

                  {/* Bottom metrics */}
                  <div className="grid grid-cols-3 gap-2 pt-3 border-t border-white/[0.04]">
                    <Metric icon={Target} label="IRR" value={`${d.projected_irr || 0}%`} />
                    <Metric icon={Users} label="LPs" value={String(d.num_investors || 0)} />
                    <Metric icon={Activity} label="Pref" value={`${d.preferred_return || 0}%`} />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5 text-[10px]">
      <Icon className="w-3 h-3 text-gray-500" />
      <div>
        <div className="text-gray-500">{label}</div>
        <div className="text-white font-bold">{value}</div>
      </div>
    </div>
  );
}
