'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useInvestorAuth } from '../layout';
import { Briefcase, Building2, ChevronRight, Target, Users, Activity, ArrowLeft } from 'lucide-react';

const fmtMoney = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n || 0);

export default function MyDealsPage() {
  const { headers } = useInvestorAuth();
  const [deals, setDeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/investor/deals', { headers: headers() });
        if (res.ok) {
          const d = await res.json();
          setDeals(d.deals || []);
        }
      } catch (e) { console.error(e); }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-3 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/inversor/dashboard" className="p-2 bg-white/[0.03] border border-white/[0.06] rounded-xl text-gray-400 hover:text-white"><ArrowLeft className="w-4 h-4" /></Link>
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2"><Briefcase className="w-6 h-6 text-emerald-400" /> Mis Deals</h1>
          <p className="text-sm text-gray-500">Todas las inversiones donde participas</p>
        </div>
      </div>
      {deals.length === 0 ? (
        <div className="bg-white/[0.03] rounded-2xl border border-white/[0.06] p-12 text-center text-gray-500">Aún no tienes inversiones</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {deals.map((d: any) => (
            <Link key={d.id} href={`/inversor/deals/${d.id}`} className="group bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden hover:border-emerald-500/30 transition">
              {d.cover_image ? (
                <div className="h-32 bg-gray-900 relative overflow-hidden"><img src={d.cover_image} alt="" className="w-full h-full object-cover" /></div>
              ) : (
                <div className="h-32 bg-gradient-to-br from-emerald-500/20 via-teal-500/10 to-cyan-500/5 flex items-center justify-center"><Building2 className="w-12 h-12 text-emerald-400/30" /></div>
              )}
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-bold text-white truncate group-hover:text-emerald-300">{d.name}</h3>
                  <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-emerald-400 transition" />
                </div>
                <p className="text-[11px] text-gray-500 truncate mb-3">{d.property_address}</p>
                <div className="grid grid-cols-3 gap-2 pt-3 border-t border-white/[0.04] text-[10px]">
                  <div><div className="text-gray-500">IRR</div><div className="text-white font-bold">{d.projected_irr || 0}%</div></div>
                  <div><div className="text-gray-500">LPs</div><div className="text-white font-bold">{d.num_investors || 0}</div></div>
                  <div><div className="text-gray-500">Pref</div><div className="text-white font-bold">{d.preferred_return || 0}%</div></div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
