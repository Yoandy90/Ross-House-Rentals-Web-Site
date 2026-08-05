'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAdminAuth } from '../../layout';
import {
  DollarSign, Users, TrendingUp, Briefcase, RefreshCw, Search,
  Mail, Phone, ChevronLeft, Award, FileText, MessageSquare, Calendar,
  Send, FileDown,
} from 'lucide-react';

const fmtMoney = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n || 0);

type LandlordRow = {
  landlord_id: string; name: string; email: string; phone: string;
  commission_rate: number; total_listings: number; approved_listings: number; pending_listings: number;
  inquiries_received: number; signed_contracts: number;
  total_monthly_rent: number; total_annualized_rent: number; commission_earned: number;
  joined_at: string;
};

export default function CommissionsPage() {
  const { headers } = useAdminAuth();
  const [data, setData] = useState<{ landlords: LandlordRow[]; totals: any } | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/marketplace-commissions', { headers: headers() });
      if (res.ok) setData(await res.json());
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [headers]);

  const [busyId, setBusyId] = useState<string | null>(null);

  const sendReport = async (l: LandlordRow) => {
    if (!confirm(`Enviar reporte PDF mensual de comisiones a ${l.name} (${l.email})?`)) return;
    setBusyId(l.landlord_id);
    try {
      const res = await fetch(`/api/admin/marketplace-commissions/${l.landlord_id}/report-pdf`, { method: 'POST', headers: headers(), body: JSON.stringify({}) });
      const d = await res.json();
      if (res.ok) alert(`✅ Reporte enviado a ${d.emailed_to?.join(', ') || '(SendGrid no configurado, PDF generado)'}`);
      else alert(`❌ ${d.detail || 'Error'}`);
    } catch (e: any) { alert(`❌ ${e.message}`); }
    setBusyId(null);
  };

  const payCommission = async (l: LandlordRow) => {
    if (l.total_monthly_rent <= 0) { alert('Este landlord no tiene renta mensual cobrada todavía'); return; }
    const grossStr = prompt(`Monto bruto de renta a procesar (USD)? Por defecto = renta mensual total ($${l.total_monthly_rent.toFixed(2)})`, String(l.total_monthly_rent));
    const gross = parseFloat(grossStr || '0');
    if (!gross || gross <= 0) return;
    const net = gross - (gross * l.commission_rate / 100);
    if (!confirm(`Transferir $${net.toFixed(2)} (neto) a ${l.name} vía Stripe Connect?\n\nBruto: $${gross.toFixed(2)}\nComisión (${l.commission_rate}%): $${(gross-net).toFixed(2)}\nNeto al landlord: $${net.toFixed(2)}`)) return;
    setBusyId(l.landlord_id);
    try {
      const res = await fetch('/api/admin/connect/process-payout', {
        method: 'POST', headers: headers(),
        body: JSON.stringify({ owner_id: l.landlord_id, amount: gross, property_address: 'Comisión mensual', tenant_name: '—', period: new Date().toISOString().slice(0,7) }),
      });
      const d = await res.json();
      if (res.ok) { alert(`✅ Transferencia creada vía Stripe (transfer_id: ${d.transfer_id || 'OK'})`); fetchData(); }
      else alert(`❌ ${d.detail || 'Error'}`);
    } catch (e: any) { alert(`❌ ${e.message}`); }
    setBusyId(null);
  };

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-3 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" /></div>;
  if (!data) return <div className="text-gray-500 p-8">Sin datos</div>;

  const filtered = data.landlords.filter(l =>
    !search || `${l.name} ${l.email} ${l.phone}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 flex-wrap">
        <Link href="/admin/marketplace" className="p-2 bg-white/[0.03] border border-white/[0.06] rounded-xl text-gray-400 hover:text-white"><ChevronLeft className="w-4 h-4" /></Link>
        <div className="flex items-center gap-3 flex-1">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-amber-500/5 border border-emerald-500/30 flex items-center justify-center">
            <Award className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Comisiones por Landlord</h2>
            <p className="text-sm text-gray-500">Dashboard de revenue · {data.totals.total_landlords} propietarios externos</p>
          </div>
        </div>
        <button onClick={fetchData} className="px-3 py-2 bg-white/[0.03] border border-white/[0.08] rounded-xl text-xs text-gray-300 hover:bg-white/[0.06] flex items-center gap-2"><RefreshCw className="w-4 h-4" /> Recargar</button>
      </div>

      {/* Grand Totals */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard icon={Users} label="Total Landlords" value={String(data.totals.total_landlords)} color="violet" />
        <KpiCard icon={DollarSign} label="Renta Mensual Total" value={fmtMoney(data.totals.total_monthly_revenue)} color="emerald" subtitle={`${fmtMoney(data.totals.total_annualized_revenue)} anualizado`} />
        <KpiCard icon={Award} label="Comisión Devengada" value={fmtMoney(data.totals.total_commission_earned)} color="amber" subtitle="Acumulada todo el tiempo" />
        <KpiCard icon={TrendingUp} label="ARR Estimado" value={fmtMoney(data.totals.total_commission_earned * 12)} color="blue" subtitle="Annual Recurring Rate" />
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-white/[0.03] border border-white/[0.08] rounded-xl text-white text-sm focus:border-emerald-500 focus:outline-none" placeholder="Buscar por nombre, email, teléfono..." />
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white/[0.03] rounded-2xl border border-white/[0.06] p-12 text-center text-gray-500">
          <Users className="w-12 h-12 mx-auto mb-3 text-gray-600" />
          <p>{data.landlords.length === 0 ? 'Aún no se han registrado landlords externos' : 'Ningún landlord coincide con la búsqueda'}</p>
        </div>
      ) : (
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-white/[0.03]">
              <tr className="text-left text-[10px] text-gray-500 uppercase tracking-wider">
                <th className="px-4 py-3">Landlord</th>
                <th className="px-4 py-3">Contacto</th>
                <th className="px-4 py-3 text-center">Listings</th>
                <th className="px-4 py-3 text-center">Inquiries</th>
                <th className="px-4 py-3 text-center">Contratos</th>
                <th className="px-4 py-3 text-right">Renta Mensual</th>
                <th className="px-4 py-3 text-right">Tasa</th>
                <th className="px-4 py-3 text-right">Comisión</th>
                <th className="px-4 py-3 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(l => (
                <tr key={l.landlord_id} className="border-t border-white/[0.04] hover:bg-white/[0.02]">
                  <td className="px-4 py-3">
                    <div className="font-bold text-white">{l.name || '(Sin nombre)'}</div>
                    <div className="text-[10px] text-gray-500">Desde {l.joined_at ? new Date(l.joined_at).toLocaleDateString('es-US') : '—'}</div>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {l.email && <div className="flex items-center gap-1 text-blue-300"><Mail className="w-3 h-3" /> {l.email}</div>}
                    {l.phone && <div className="flex items-center gap-1 text-gray-400"><Phone className="w-3 h-3" /> {l.phone}</div>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="text-white font-bold">{l.approved_listings}</div>
                    <div className="text-[10px] text-gray-500">{l.pending_listings > 0 && `${l.pending_listings} pend · `}{l.total_listings} total</div>
                  </td>
                  <td className="px-4 py-3 text-center"><span className="inline-block px-2 py-0.5 bg-blue-500/10 text-blue-300 rounded-full text-xs font-bold">{l.inquiries_received}</span></td>
                  <td className="px-4 py-3 text-center"><span className="inline-block px-2 py-0.5 bg-emerald-500/10 text-emerald-300 rounded-full text-xs font-bold">{l.signed_contracts}</span></td>
                  <td className="px-4 py-3 text-right text-white font-bold">{fmtMoney(l.total_monthly_rent)}</td>
                  <td className="px-4 py-3 text-right text-violet-300 font-bold">{l.commission_rate}%</td>
                  <td className="px-4 py-3 text-right text-emerald-300 font-bold">{fmtMoney(l.commission_earned)}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => sendReport(l)} disabled={busyId === l.landlord_id} title="Enviar reporte PDF por email" className="p-1.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-lg hover:bg-blue-500/20 disabled:opacity-30"><FileDown className="w-3.5 h-3.5" /></button>
                      <button onClick={() => payCommission(l)} disabled={busyId === l.landlord_id || l.total_monthly_rent <= 0} title="Pagar (vía Stripe Connect)" className="p-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg hover:bg-emerald-500/20 disabled:opacity-30"><Send className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-white/[0.04]">
              <tr className="border-t border-white/[0.06]">
                <td className="px-4 py-3 font-bold text-gray-400 text-xs uppercase tracking-wider" colSpan={5}>Totales</td>
                <td className="px-4 py-3 text-right text-white font-bold">{fmtMoney(filtered.reduce((s, l) => s + l.total_monthly_rent, 0))}</td>
                <td className="px-4 py-3"></td>
                <td className="px-4 py-3 text-right text-emerald-300 font-bold">{fmtMoney(filtered.reduce((s, l) => s + l.commission_earned, 0))}</td>
                <td className="px-4 py-3"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, color, subtitle }: any) {
  const cmap: Record<string, { from: string; border: string; text: string }> = {
    emerald: { from: 'from-emerald-500/15', border: 'border-emerald-500/30', text: 'text-emerald-400' },
    blue: { from: 'from-blue-500/15', border: 'border-blue-500/30', text: 'text-blue-400' },
    violet: { from: 'from-violet-500/15', border: 'border-violet-500/30', text: 'text-violet-400' },
    amber: { from: 'from-amber-500/15', border: 'border-amber-500/30', text: 'text-amber-400' },
  };
  const c = cmap[color] || cmap.emerald;
  return (
    <div className={`bg-gradient-to-br ${c.from} to-transparent border ${c.border} rounded-2xl p-4`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{label}</span>
        <Icon className={`w-4 h-4 ${c.text}`} />
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
      {subtitle && <div className="text-[10px] text-gray-500 mt-1">{subtitle}</div>}
    </div>
  );
}
