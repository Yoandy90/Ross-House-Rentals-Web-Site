'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useInvestorAuth } from '../../layout';
import {
  ArrowLeft, DollarSign, TrendingUp, Target, Users, Activity, Building2,
  CheckCircle2, Clock, FileText, Download, Calendar, PenTool, ShieldCheck,
} from 'lucide-react';

const fmtMoney = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n || 0);

export default function MyDealDetailPage() {
  const params = useParams() as { id: string };
  const { headers } = useInvestorAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchDeal = useCallback(async () => {
    try {
      const res = await fetch(`/api/investor/deals/${params.id}`, { headers: headers() });
      if (res.ok) setData(await res.json());
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [headers, params.id]);

  useEffect(() => { fetchDeal(); }, [fetchDeal]);

  const downloadDoc = async (docId: string, docName: string) => {
    const res = await fetch(`/api/investor/deals/${params.id}/documents/${docId}/download`, { headers: headers() });
    if (!res.ok) return alert('Error descargando documento');
    const d = await res.json();
    // Trigger download
    const link = document.createElement('a');
    link.href = d.data;
    link.download = d.name || docName;
    link.click();
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-3 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" /></div>;
  if (!data?.deal) return <div className="text-gray-500 p-8">Deal no encontrado</div>;

  const deal = data.deal;
  const myInvestments = data.my_investments || [];
  const myDistributions = data.my_distributions || [];
  const totalMyCapital = myInvestments.reduce((s: number, i: any) => s + (i.amount || 0), 0);
  const totalReceived = myInvestments.reduce((s: number, i: any) => s + (i.total_distributions_received || 0), 0);
  const myEquity = myInvestments.reduce((s: number, i: any) => s + (i.equity_percent || 0), 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/inversor/deals" className="p-2 bg-white/[0.03] border border-white/[0.06] rounded-xl text-gray-400 hover:text-white"><ArrowLeft className="w-4 h-4" /></Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white">{deal.name}</h1>
          <p className="text-sm text-gray-500">{deal.property_address || ''}</p>
        </div>
      </div>

      {deal.cover_image && <div className="rounded-2xl overflow-hidden border border-white/[0.06] max-h-80"><img src={deal.cover_image} className="w-full object-cover" alt="" /></div>}

      {/* My position */}
      <div className="bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent border border-emerald-500/20 rounded-2xl p-5">
        <div className="text-[10px] font-bold text-emerald-400 tracking-wider mb-3">MI POSICIÓN EN ESTE DEAL</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <div className="text-[10px] text-gray-400 uppercase">Mi capital</div>
            <div className="text-xl font-bold text-white">{fmtMoney(totalMyCapital)}</div>
          </div>
          <div>
            <div className="text-[10px] text-gray-400 uppercase">Mi equity</div>
            <div className="text-xl font-bold text-emerald-300">{myEquity.toFixed(2)}%</div>
          </div>
          <div>
            <div className="text-[10px] text-gray-400 uppercase">Distribuido</div>
            <div className="text-xl font-bold text-blue-300">{fmtMoney(totalReceived)}</div>
          </div>
          <div>
            <div className="text-[10px] text-gray-400 uppercase">ROI</div>
            <div className="text-xl font-bold text-emerald-300">{totalMyCapital > 0 ? ((totalReceived / totalMyCapital) * 100).toFixed(1) : 0}%</div>
          </div>
        </div>
      </div>

      {/* Subscription Agreement Signing */}
      {myInvestments.length > 0 && (
        <div className="space-y-3">
          {myInvestments.map((inv: any) => <SubscriptionPanel key={inv.id} investment={inv} headers={headers} onSigned={fetchDeal} />)}
        </div>
      )}

      {/* Deal info */}
      <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5">
        <div className="text-[10px] font-bold text-gray-400 tracking-wider mb-3">DETALLES DEL DEAL</div>
        {deal.description && <p className="text-sm text-gray-300 mb-4 whitespace-pre-wrap">{deal.description}</p>}
        {deal.highlights?.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
            {deal.highlights.map((h: string, i: number) => (
              <div key={i} className="flex items-start gap-2 text-sm text-gray-300"><CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />{h}</div>
            ))}
          </div>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-white/[0.04] text-xs">
          <div><div className="text-[10px] text-gray-500">IRR proyectado</div><div className="text-white font-bold">{deal.projected_irr}%</div></div>
          <div><div className="text-[10px] text-gray-500">Pref return</div><div className="text-white font-bold">{deal.preferred_return}%</div></div>
          <div><div className="text-[10px] text-gray-500">Cash-on-cash</div><div className="text-white font-bold">{deal.projected_cash_on_cash}%</div></div>
          <div><div className="text-[10px] text-gray-500">Hold period</div><div className="text-white font-bold">{deal.hold_period_months} meses</div></div>
        </div>
      </div>

      {/* My distributions */}
      {myDistributions.length > 0 && (
        <div>
          <div className="text-sm font-bold text-white mb-3">Mis Distribuciones de este Deal</div>
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-white/[0.03]">
                <tr className="text-left text-[10px] text-gray-500 uppercase tracking-wider">
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Período</th>
                  <th className="px-4 py-3 text-right">Mi parte</th>
                  <th className="px-4 py-3">Estado</th>
                </tr>
              </thead>
              <tbody>
                {myDistributions.map((d: any) => {
                  const myAmount = (d.per_investment || []).reduce((s: number, p: any) => s + (p.amount || 0), 0);
                  return (
                    <tr key={d.id} className="border-t border-white/[0.04]">
                      <td className="px-4 py-3 text-gray-300">{d.distribution_type.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}</td>
                      <td className="px-4 py-3 text-gray-400">{d.period}</td>
                      <td className="px-4 py-3 text-right text-emerald-300 font-bold">{fmtMoney(myAmount)}</td>
                      <td className="px-4 py-3">{d.status === 'paid' ? <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 font-bold">Pagada</span> : <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 font-bold">Programada</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Documents */}
      {(deal.documents || []).length > 0 && (
        <div>
          <div className="text-sm font-bold text-white mb-3 flex items-center gap-2"><FileText className="w-4 h-4" /> Documentos</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {deal.documents.map((doc: any) => (
              <button key={doc.id} onClick={() => downloadDoc(doc.id, doc.name)} className="flex items-center gap-3 p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl hover:border-emerald-500/30 hover:bg-white/[0.04] transition text-left">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center"><FileText className="w-5 h-5 text-emerald-400" /></div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-white truncate">{doc.name}</div>
                  <div className="text-[10px] text-gray-500">{doc.doc_type.toUpperCase()} · {doc.size_kb || 0} KB</div>
                </div>
                <Download className="w-4 h-4 text-gray-400" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SubscriptionPanel({ investment, headers, onSigned }: { investment: any; headers: () => HeadersInit; onSigned: () => void }) {
  const [signing, setSigning] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');

  const signNow = async () => {
    setError(''); setSigning(true);
    try {
      const res = await fetch(`/api/investor/investments/${investment.id}/sign-subscription`, {
        method: 'POST', headers: headers(),
      });
      const data = await res.json();
      if (res.ok) {
        onSigned();
      } else {
        setError(data.detail || 'Error firmando');
      }
    } catch (e: any) { setError(e.message); }
    setSigning(false);
    setConfirming(false);
  };

  if (investment.documents_signed) {
    return (
      <div className="bg-emerald-500/[0.05] border border-emerald-500/20 rounded-2xl p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center"><ShieldCheck className="w-5 h-5 text-emerald-400" /></div>
        <div className="flex-1">
          <div className="text-sm font-bold text-emerald-300">Subscription Agreement firmado ✓</div>
          <div className="text-[11px] text-gray-400">
            {investment.signed_at ? `Firmado el ${new Date(investment.signed_at).toLocaleString('es-US')}` : 'Documentos confirmados'}
            {` · Capital $${investment.amount?.toLocaleString()}`}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-amber-500/[0.05] border border-amber-500/30 rounded-2xl p-4">
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center flex-shrink-0"><PenTool className="w-5 h-5 text-amber-400" /></div>
        <div className="flex-1">
          <div className="text-sm font-bold text-white">Acción requerida: Confirmar Subscription Agreement</div>
          <div className="text-[12px] text-gray-400 mt-1">Para activar tu inversión de <span className="text-white font-bold">${investment.amount?.toLocaleString()}</span> ({investment.equity_percent?.toFixed(2)}% equity), confirma que has revisado y firmado el Subscription Agreement. Recibirás un acuse de recibo formal por email.</div>
        </div>
      </div>
      {error && <div className="bg-red-500/15 border border-red-500/30 rounded-lg px-3 py-2 text-xs text-red-300 mb-2">{error}</div>}
      {!confirming ? (
        <button onClick={() => setConfirming(true)} className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl text-sm font-bold flex items-center gap-2"><PenTool className="w-4 h-4" /> Firmar ahora</button>
      ) : (
        <div className="bg-[#0a1020]/80 border border-white/[0.08] rounded-xl p-3">
          <p className="text-xs text-gray-300 mb-3">
            Al hacer click en <strong>&ldquo;Confirmar firma&rdquo;</strong>, declaras que: (1) Has leído el Subscription Agreement, (2) Estás de acuerdo con los términos del deal, (3) Comprometes formalmente el capital de <strong className="text-white">${investment.amount?.toLocaleString()}</strong>. Esto generará un acuse de recibo digital.
          </p>
          <div className="flex gap-2">
            <button onClick={signNow} disabled={signing} className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-2 disabled:opacity-50"><CheckCircle2 className="w-3.5 h-3.5" /> {signing ? 'Firmando...' : 'Confirmar firma'}</button>
            <button onClick={() => setConfirming(false)} disabled={signing} className="px-4 py-2 bg-white/[0.05] text-gray-400 border border-white/[0.08] rounded-lg text-xs font-bold">Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}

