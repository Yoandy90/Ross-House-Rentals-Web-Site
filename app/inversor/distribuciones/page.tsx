'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useInvestorAuth } from '../layout';
import { TrendingUp, ArrowLeft, CheckCircle2, Clock } from 'lucide-react';

const fmtMoney = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n || 0);

export default function MyDistributionsPage() {
  const { headers } = useInvestorAuth();
  const [dists, setDists] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/investor/distributions', { headers: headers() });
        if (res.ok) {
          const d = await res.json();
          setDists(d.distributions || []);
        }
      } catch (e) { console.error(e); }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-3 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" /></div>;

  const total = dists.filter(d => d.status === 'paid').reduce((s, d) => s + (d.per_investment || []).reduce((ss: number, p: any) => ss + (p.amount || 0), 0), 0);
  const pending = dists.filter(d => d.status === 'scheduled').reduce((s, d) => s + (d.per_investment || []).reduce((ss: number, p: any) => ss + (p.amount || 0), 0), 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/inversor/dashboard" className="p-2 bg-white/[0.03] border border-white/[0.06] rounded-xl text-gray-400 hover:text-white"><ArrowLeft className="w-4 h-4" /></Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white flex items-center gap-2"><TrendingUp className="w-6 h-6 text-blue-400" /> Mis Distribuciones</h1>
          <p className="text-sm text-gray-500">Histórico de pagos recibidos y próximas distribuciones</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="bg-gradient-to-br from-emerald-500/15 to-transparent border border-emerald-500/30 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" /><span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Total Recibido</span></div>
          <div className="text-3xl font-bold text-emerald-300">{fmtMoney(total)}</div>
        </div>
        <div className="bg-gradient-to-br from-amber-500/15 to-transparent border border-amber-500/30 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-2"><Clock className="w-4 h-4 text-amber-400" /><span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Pendientes / Programadas</span></div>
          <div className="text-3xl font-bold text-amber-300">{fmtMoney(pending)}</div>
        </div>
      </div>

      {dists.length === 0 ? (
        <div className="bg-white/[0.03] rounded-2xl border border-white/[0.06] p-12 text-center text-gray-500">Aún no tienes distribuciones registradas</div>
      ) : (
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-white/[0.03]">
              <tr className="text-left text-[10px] text-gray-500 uppercase tracking-wider">
                <th className="px-4 py-3">Deal</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Período</th>
                <th className="px-4 py-3 text-right">Mi parte</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {dists.map(d => {
                const myAmount = (d.per_investment || []).reduce((s: number, p: any) => s + (p.amount || 0), 0);
                return (
                  <tr key={d.id} className="border-t border-white/[0.04]">
                    <td className="px-4 py-3 text-white font-bold">{d.deal_name}</td>
                    <td className="px-4 py-3 text-gray-300 text-xs">{d.distribution_type.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{d.period}</td>
                    <td className="px-4 py-3 text-right text-emerald-300 font-bold">{fmtMoney(myAmount)}</td>
                    <td className="px-4 py-3">{d.status === 'paid' ? <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 font-bold"><CheckCircle2 className="w-2.5 h-2.5" /> Pagada</span> : <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 font-bold"><Clock className="w-2.5 h-2.5" /> Programada</span>}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{d.paid_date ? new Date(d.paid_date).toLocaleDateString('es-US') : (d.scheduled_date ? new Date(d.scheduled_date).toLocaleDateString('es-US') : '—')}</td>
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
