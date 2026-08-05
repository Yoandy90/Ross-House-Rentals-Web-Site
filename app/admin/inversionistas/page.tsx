'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAdminAuth } from '../layout';
import {
  Users, Search, RefreshCw, Mail, Phone, DollarSign, TrendingUp,
  Briefcase, ArrowRight, Calendar, Key,
} from 'lucide-react';

const fmtMoney = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n || 0);

export default function InvestorsPage() {
  const { headers } = useAdminAuth();
  const [investors, setInvestors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const fetchInvestors = useCallback(async () => {
    try {
      const qs = new URLSearchParams({ page: '1', limit: '200' });
      if (debouncedSearch) qs.set('search', debouncedSearch);
      const res = await fetch(`/api/admin/syndication/investors?${qs.toString()}`, { headers: headers() });
      if (res.ok) {
        const d = await res.json();
        setInvestors(d.investors || []);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [headers, debouncedSearch]);

  useEffect(() => { fetchInvestors(); }, [fetchInvestors]);

  const resetPassword = async (id: string, name: string) => {
    if (!confirm(`¿Resetear el password de ${name}? Se generará una nueva contraseña temporal.`)) return;
    const res = await fetch(`/api/admin/syndication/investors/${id}/reset-password`, { method: 'POST', headers: headers() });
    if (res.ok) {
      const d = await res.json();
      setToast({ msg: `Nueva contraseña para ${d.email}: ${d.temp_password}`, ok: true });
    }
  };

  const totalInvested = investors.reduce((s, i) => s + (i.total_invested || 0), 0);
  const totalDistributed = investors.reduce((s, i) => s + (i.total_distributions_received || 0), 0);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-3 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-5">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl border backdrop-blur-md text-sm font-medium shadow-2xl max-w-md ${toast.ok ? 'bg-violet-500/15 border-violet-500/30 text-violet-200' : 'bg-red-500/15 border-red-500/30 text-red-300'}`}>{toast.msg}</div>
      )}

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/5 border border-violet-500/30 flex items-center justify-center"><Users className="w-6 h-6 text-violet-400" /></div>
          <div>
            <h2 className="text-2xl font-bold text-white">Inversionistas (LPs)</h2>
            <p className="text-sm text-gray-500">Vista cross-deal de todos los Limited Partners</p>
          </div>
        </div>
        <button onClick={fetchInvestors} className="px-3 py-2 bg-white/[0.03] border border-white/[0.08] rounded-xl text-xs text-gray-300 hover:bg-white/[0.06] transition flex items-center gap-2"><RefreshCw className="w-4 h-4" /> Recargar</button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KpiCard label="Total LPs" value={String(investors.length)} icon={Users} color="violet" />
        <KpiCard label="Capital agregado" value={fmtMoney(totalInvested)} icon={DollarSign} color="emerald" />
        <KpiCard label="Distribuido a LPs" value={fmtMoney(totalDistributed)} icon={TrendingUp} color="blue" />
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-white/[0.03] border border-white/[0.08] rounded-xl text-white text-sm focus:border-violet-500 focus:outline-none" placeholder="Buscar por nombre, email, teléfono..." />
      </div>

      {investors.length === 0 ? (
        <div className="bg-white/[0.03] rounded-2xl border border-white/[0.06] p-12 text-center text-gray-500">
          <Users className="w-12 h-12 mx-auto mb-3 text-gray-600" />
          <p>No hay inversionistas aún. Agrega LPs desde el detalle de un deal.</p>
          <Link href="/admin/syndication" className="inline-flex items-center gap-2 mt-3 text-violet-400 text-sm font-bold hover:text-violet-300">Ver deals <ArrowRight className="w-4 h-4" /></Link>
        </div>
      ) : (
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-white/[0.03]">
              <tr className="text-left text-[10px] text-gray-500 uppercase tracking-wider">
                <th className="px-4 py-3">Inversionista</th>
                <th className="px-4 py-3">Contacto</th>
                <th className="px-4 py-3 text-center">Deals</th>
                <th className="px-4 py-3 text-right">Invertido</th>
                <th className="px-4 py-3 text-right">Distribuido</th>
                <th className="px-4 py-3 text-right">ROI</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {investors.map(inv => {
                const roi = inv.total_invested > 0 ? (inv.total_distributions_received / inv.total_invested * 100) : 0;
                return (
                  <tr key={inv.id} className="border-t border-white/[0.04] hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <div className="font-bold text-white">{inv.name || '(Sin nombre)'}</div>
                      <div className="text-[10px] text-gray-500">{inv.last_login ? `Último login: ${new Date(inv.last_login).toLocaleDateString('es-US')}` : 'Nunca ha iniciado sesión'}</div>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {inv.email && <div className="flex items-center gap-1 text-blue-300"><Mail className="w-3 h-3" /> {inv.email}</div>}
                      {inv.phone && <div className="flex items-center gap-1 text-gray-400"><Phone className="w-3 h-3" /> {inv.phone}</div>}
                    </td>
                    <td className="px-4 py-3 text-center"><span className="inline-block px-2 py-0.5 bg-violet-500/10 text-violet-300 rounded-full text-xs font-bold">{inv.active_deals || 0}</span></td>
                    <td className="px-4 py-3 text-right text-white font-bold">{fmtMoney(inv.total_invested)}</td>
                    <td className="px-4 py-3 text-right text-emerald-300 font-bold">{fmtMoney(inv.total_distributions_received)}</td>
                    <td className="px-4 py-3 text-right"><span className={`font-bold ${roi >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{roi.toFixed(1)}%</span></td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => resetPassword(inv.id, inv.name)} title="Resetear contraseña" className="p-1.5 text-amber-400 hover:bg-amber-500/10 rounded-lg"><Key className="w-3.5 h-3.5" /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function KpiCard({ label, value, icon: Icon, color }: any) {
  const cmap: Record<string, string> = { violet: 'from-violet-500/15 border-violet-500/30 text-violet-400', emerald: 'from-emerald-500/15 border-emerald-500/30 text-emerald-400', blue: 'from-blue-500/15 border-blue-500/30 text-blue-400' };
  return (
    <div className={`bg-gradient-to-br ${cmap[color]} to-transparent border rounded-2xl p-4 flex items-center gap-4`}>
      <div className="w-10 h-10 rounded-xl bg-white/[0.04] flex items-center justify-center"><Icon className={`w-5 h-5 ${cmap[color].split(' ').pop()}`} /></div>
      <div>
        <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{label}</div>
        <div className="text-2xl font-bold text-white">{value}</div>
      </div>
    </div>
  );
}
