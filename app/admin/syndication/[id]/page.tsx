'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAdminAuth } from '../../layout';
import {
  ChevronLeft, Edit3, Trash2, Save, X, Plus, Users, FileText, TrendingUp,
  Building2, DollarSign, Target, Calendar, Briefcase, CheckCircle2,
  Clock, AlertCircle, Download, Upload, Mail, Phone, Eye, MoreVertical,
  Activity, ArrowUpRight, Calculator, Sigma,
} from 'lucide-react';

const STATUS_CFG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  draft:   { label: 'Borrador',   color: 'text-gray-400',    bg: 'bg-gray-500/10',    border: 'border-gray-500/20' },
  open:    { label: 'Abierto',    color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
  funded:  { label: 'Financiado', color: 'text-blue-400',    bg: 'bg-blue-500/10',    border: 'border-blue-500/30' },
  closed:  { label: 'Cerrado',    color: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/20' },
  exited:  { label: 'Salido',     color: 'text-purple-400',  bg: 'bg-purple-500/10',  border: 'border-purple-500/20' },
};
const INV_STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  pending:   { label: 'Pendiente', color: 'text-amber-300', bg: 'bg-amber-500/10' },
  active:    { label: 'Activo',    color: 'text-emerald-300', bg: 'bg-emerald-500/10' },
  redeemed:  { label: 'Redimido',  color: 'text-blue-300', bg: 'bg-blue-500/10' },
  cancelled: { label: 'Cancelado', color: 'text-gray-400', bg: 'bg-gray-500/10' },
};
const DIST_STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  scheduled: { label: 'Programada', color: 'text-amber-300', bg: 'bg-amber-500/10' },
  paid:      { label: 'Pagada',     color: 'text-emerald-300', bg: 'bg-emerald-500/10' },
  failed:    { label: 'Fallida',    color: 'text-red-300', bg: 'bg-red-500/10' },
  cancelled: { label: 'Cancelada',  color: 'text-gray-400', bg: 'bg-gray-500/10' },
};

const fmtMoney = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n || 0);

export default function DealDetailPage() {
  const params = useParams() as { id: string };
  const router = useRouter();
  const { headers } = useAdminAuth();
  const [deal, setDeal] = useState<any>(null);
  const [investments, setInvestments] = useState<any[]>([]);
  const [distributions, setDistributions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'info' | 'cap' | 'dist' | 'docs' | 'waterfall'>('info');
  const [showAddInv, setShowAddInv] = useState(false);
  const [showAddDist, setShowAddDist] = useState(false);
  const [showAddDoc, setShowAddDoc] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const fetchDeal = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/syndication/deals/${params.id}`, { headers: headers() });
      if (res.ok) {
        const d = await res.json();
        setDeal(d.deal);
        setInvestments(d.investments || []);
        setDistributions(d.distributions || []);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [headers, params.id]);

  useEffect(() => { fetchDeal(); }, [fetchDeal]);

  const updateStatus = async (newStatus: string) => {
    try {
      const res = await fetch(`/api/admin/syndication/deals/${params.id}`, {
        method: 'PATCH', headers: headers(), body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) { setToast({ msg: 'Status actualizado', ok: true }); fetchDeal(); }
    } catch (e) { console.error(e); }
  };

  const deleteDeal = async () => {
    if (!confirm('¿Eliminar este deal? Solo se permite si no tiene inversionistas.')) return;
    try {
      const res = await fetch(`/api/admin/syndication/deals/${params.id}`, { method: 'DELETE', headers: headers() });
      if (res.ok) router.push('/admin/syndication');
      else {
        const e = await res.json();
        setToast({ msg: e.detail || 'Error', ok: false });
      }
    } catch (e) { console.error(e); }
  };

  const deleteInv = async (invId: string) => {
    if (!confirm('¿Eliminar esta inversión del cap table?')) return;
    await fetch(`/api/admin/syndication/investments/${invId}`, { method: 'DELETE', headers: headers() });
    setToast({ msg: 'Inversión eliminada', ok: true });
    fetchDeal();
  };

  const updateInvStatus = async (invId: string, status: string) => {
    await fetch(`/api/admin/syndication/investments/${invId}`, {
      method: 'PATCH', headers: headers(), body: JSON.stringify({ status }),
    });
    fetchDeal();
  };

  const markDistPaid = async (distId: string) => {
    if (!confirm('¿Marcar como pagada? Se enviarán emails automáticos a los LPs.')) return;
    const res = await fetch(`/api/admin/syndication/distributions/${distId}`, {
      method: 'PATCH', headers: headers(), body: JSON.stringify({ status: 'paid' }),
    });
    if (res.ok) { setToast({ msg: 'Marcada como pagada · LPs notificados', ok: true }); fetchDeal(); }
  };

  const deleteDist = async (distId: string) => {
    if (!confirm('¿Eliminar distribución?')) return;
    const res = await fetch(`/api/admin/syndication/distributions/${distId}`, { method: 'DELETE', headers: headers() });
    if (res.ok) { setToast({ msg: 'Distribución eliminada', ok: true }); fetchDeal(); }
    else { const e = await res.json(); setToast({ msg: e.detail || 'Error', ok: false }); }
  };

  const deleteDoc = async (docId: string) => {
    if (!confirm('¿Eliminar documento?')) return;
    await fetch(`/api/admin/syndication/deals/${params.id}/documents/${docId}`, { method: 'DELETE', headers: headers() });
    setToast({ msg: 'Documento eliminado', ok: true });
    fetchDeal();
  };

  const downloadCapTablePdf = async () => {
    setToast({ msg: 'Generando PDF...', ok: true });
    try {
      const res = await fetch(`/api/admin/syndication/deals/${params.id}/cap-table.pdf`, { headers: headers() });
      if (!res.ok) { setToast({ msg: 'Error generando PDF', ok: false }); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cap-table-${deal?.slug || 'deal'}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      setToast({ msg: 'PDF descargado ✓', ok: true });
    } catch (e: any) {
      setToast({ msg: e.message || 'Error', ok: false });
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-3 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" /></div>;
  if (!deal) return <div className="text-gray-500 p-8">Deal no encontrado</div>;

  const st = STATUS_CFG[deal.status] || STATUS_CFG.draft;
  const raisedPct = deal.target_raise > 0 ? Math.min(100, (deal.total_raised / deal.target_raise) * 100) : 0;
  const totalDistributed = distributions.filter(d => d.status === 'paid').reduce((s, d) => s + (d.total_amount || 0), 0);

  return (
    <div className="space-y-5">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl border backdrop-blur-md text-sm font-medium shadow-2xl ${toast.ok ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300' : 'bg-red-500/15 border-red-500/30 text-red-300'}`}>{toast.msg}</div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <Link href="/admin/syndication" className="p-2 bg-white/[0.03] border border-white/[0.06] rounded-xl text-gray-400 hover:text-white transition"><ChevronLeft className="w-4 h-4" /></Link>
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl font-bold text-white truncate">{deal.name}</h2>
          <p className="text-sm text-gray-500 truncate">{deal.property_address || 'Sin dirección'}{deal.units > 0 ? ` · ${deal.units} unidades` : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={deal.status} onChange={e => updateStatus(e.target.value)} className={`text-xs px-3 py-2 rounded-xl font-bold ${st.bg} ${st.color} ${st.border} border cursor-pointer focus:outline-none`}>
            {Object.entries(STATUS_CFG).map(([k, c]) => <option key={k} value={k} style={{ background: '#0a1020' }}>{c.label}</option>)}
          </select>
          <button onClick={deleteDeal} className="p-2 bg-red-500/5 border border-red-500/15 rounded-xl text-red-400 hover:bg-red-500/10"><Trash2 className="w-4 h-4" /></button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Capital levantado" value={fmtMoney(deal.total_raised)} subtitle={`${raisedPct.toFixed(1)}% de ${fmtMoney(deal.target_raise)}`} color="emerald" progress={raisedPct} />
        <KpiCard label="Inversionistas" value={String(deal.num_investors || 0)} subtitle={`Inv. mín ${fmtMoney(deal.min_investment)}`} color="violet" />
        <KpiCard label="IRR proyectado" value={`${deal.projected_irr || 0}%`} subtitle={`Cash-on-cash ${deal.projected_cash_on_cash || 0}%`} color="blue" />
        <KpiCard label="Distribuido" value={fmtMoney(totalDistributed)} subtitle={`Pref ${deal.preferred_return}% · LP ${deal.equity_split?.lp_percent || 80}%`} color="amber" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white/[0.03] rounded-xl p-1 border border-white/[0.06] overflow-x-auto">
        {[{ k: 'info', l: 'Información', i: Briefcase }, { k: 'cap', l: `Cap Table (${investments.length})`, i: Users }, { k: 'dist', l: `Distribuciones (${distributions.length})`, i: TrendingUp }, { k: 'waterfall', l: 'Waterfall', i: Sigma }, { k: 'docs', l: `Documentos (${deal.documents?.length || 0})`, i: FileText }].map(t => {
          const Icon = t.i;
          return (
            <button key={t.k} onClick={() => setTab(t.k as any)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition ${tab === t.k ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25' : 'text-gray-400 hover:text-gray-200'}`}>
              <Icon className="w-3.5 h-3.5" /> {t.l}
            </button>
          );
        })}
      </div>

      {tab === 'info' && (
        <div className="space-y-4">
          {deal.cover_image && (
            <div className="rounded-2xl overflow-hidden border border-white/[0.06] max-h-80">
              <img src={deal.cover_image} alt="" className="w-full object-cover" />
            </div>
          )}
          {deal.description && (
            <Section title="DESCRIPCIÓN">
              <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">{deal.description}</p>
            </Section>
          )}
          {deal.highlights?.length > 0 && (
            <Section title="HIGHLIGHTS">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {deal.highlights.map((h: string, i: number) => (
                  <div key={i} className="flex items-start gap-2 p-3 bg-white/[0.02] border border-white/[0.04] rounded-xl text-sm text-gray-300"><CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />{h}</div>
                ))}
              </div>
            </Section>
          )}
          <Section title="ESTRUCTURA">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <Stat label="Target raise" value={fmtMoney(deal.target_raise)} />
              <Stat label="Min. inversión" value={fmtMoney(deal.min_investment)} />
              <Stat label="Máx. inversión" value={deal.max_investment > 0 ? fmtMoney(deal.max_investment) : '—'} />
              <Stat label="Hold (meses)" value={String(deal.hold_period_months || 0)} />
              <Stat label="Preferred Return" value={`${deal.preferred_return}%`} />
              <Stat label="IRR proyectado" value={`${deal.projected_irr}%`} />
              <Stat label="LP %" value={`${deal.equity_split?.lp_percent || 80}%`} />
              <Stat label="GP %" value={`${deal.equity_split?.gp_percent || 20}%`} />
            </div>
          </Section>
        </div>
      )}

      {tab === 'cap' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="text-sm text-gray-400">Cap table del deal · <span className="text-white font-bold">{investments.length}</span> inversiones</div>
            <div className="flex items-center gap-2">
              <button onClick={() => downloadCapTablePdf()} disabled={investments.length === 0} className="px-3 py-2 bg-blue-500/15 text-blue-400 border border-blue-500/30 rounded-xl text-sm font-bold hover:bg-blue-500/25 flex items-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed"><Download className="w-4 h-4" /> Exportar PDF</button>
              <button onClick={() => setShowAddInv(true)} className="px-3 py-2 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded-xl text-sm font-bold hover:bg-emerald-500/25 flex items-center gap-2"><Plus className="w-4 h-4" /> Agregar inversionista</button>
            </div>
          </div>
          {investments.length === 0 ? (
            <div className="bg-white/[0.03] rounded-2xl border border-white/[0.06] p-12 text-center text-gray-500">No hay inversionistas en este deal todavía</div>
          ) : (
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-white/[0.03]">
                  <tr className="text-left text-[10px] text-gray-500 uppercase tracking-wider">
                    <th className="px-4 py-3">Inversionista</th>
                    <th className="px-4 py-3 text-right">Monto</th>
                    <th className="px-4 py-3 text-right">Equity %</th>
                    <th className="px-4 py-3 text-right">Distribuido</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {investments.map(inv => {
                    const ist = INV_STATUS_CFG[inv.status] || INV_STATUS_CFG.pending;
                    return (
                      <tr key={inv.id} className="border-t border-white/[0.04] hover:bg-white/[0.02]">
                        <td className="px-4 py-3">
                          <div className="font-bold text-white">{inv.investor_name}</div>
                          <div className="text-[10px] text-gray-500">{inv.investor_email || inv.investor_phone}</div>
                        </td>
                        <td className="px-4 py-3 text-right text-white font-bold">{fmtMoney(inv.amount)}</td>
                        <td className="px-4 py-3 text-right text-emerald-300">{(inv.equity_percent || 0).toFixed(2)}%</td>
                        <td className="px-4 py-3 text-right text-blue-300">{fmtMoney(inv.total_distributions_received)}</td>
                        <td className="px-4 py-3">
                          <select value={inv.status} onChange={e => updateInvStatus(inv.id, e.target.value)} className={`text-[10px] px-2 py-1 rounded-lg font-bold ${ist.bg} ${ist.color} border border-white/[0.05] cursor-pointer focus:outline-none`}>
                            {Object.entries(INV_STATUS_CFG).map(([k, c]) => <option key={k} value={k} style={{ background: '#0a1020' }}>{c.label}</option>)}
                          </select>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => deleteInv(inv.id)} className="p-1.5 text-red-400 hover:bg-red-500/10 rounded-lg"><Trash2 className="w-3.5 h-3.5" /></button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'dist' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-400">{distributions.length} distribuciones · Total pagado: <span className="text-emerald-300 font-bold">{fmtMoney(totalDistributed)}</span></div>
            <button onClick={() => setShowAddDist(true)} disabled={investments.filter(i => i.status === 'active' || i.status === 'pending').length === 0} className="px-3 py-2 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded-xl text-sm font-bold hover:bg-emerald-500/25 flex items-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed"><Plus className="w-4 h-4" /> Nueva distribución</button>
          </div>
          {distributions.length === 0 ? (
            <div className="bg-white/[0.03] rounded-2xl border border-white/[0.06] p-12 text-center text-gray-500">Aún no se han realizado distribuciones</div>
          ) : (
            <div className="space-y-2">
              {distributions.map(d => {
                const dst = DIST_STATUS_CFG[d.status] || DIST_STATUS_CFG.scheduled;
                return (
                  <div key={d.id} className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-4">
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-white">{d.distribution_type.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}</span>
                          <span className="text-xs text-gray-500">· {d.period}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${dst.bg} ${dst.color}`}>{dst.label}</span>
                        </div>
                        <div className="text-[11px] text-gray-500 mt-0.5">{d.per_investment?.length || 0} LPs · {d.notes || (d.status === 'paid' ? `Pagada ${new Date(d.paid_date).toLocaleDateString('es-US')}` : 'Programada')}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-emerald-300">{fmtMoney(d.total_amount)}</div>
                      </div>
                      <div className="flex items-center gap-1">
                        {d.status !== 'paid' && <button onClick={() => markDistPaid(d.id)} className="px-3 py-1.5 bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 rounded-lg text-xs font-bold hover:bg-emerald-500/25">Marcar pagada</button>}
                        {d.status !== 'paid' && <button onClick={() => deleteDist(d.id)} className="p-1.5 text-red-400 hover:bg-red-500/10 rounded-lg"><Trash2 className="w-3.5 h-3.5" /></button>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'waterfall' && <WaterfallTab dealId={params.id} headers={headers} totalRaised={deal.total_raised} dealName={deal.name} />}

      {tab === 'docs' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-400">{deal.documents?.length || 0} documentos del deal</div>
            <button onClick={() => setShowAddDoc(true)} className="px-3 py-2 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded-xl text-sm font-bold hover:bg-emerald-500/25 flex items-center gap-2"><Upload className="w-4 h-4" /> Subir documento</button>
          </div>
          {(deal.documents || []).length === 0 ? (
            <div className="bg-white/[0.03] rounded-2xl border border-white/[0.06] p-12 text-center text-gray-500">No hay documentos subidos</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {deal.documents.map((doc: any) => (
                <div key={doc.id} className="flex items-center gap-3 p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl">
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center"><FileText className="w-5 h-5 text-emerald-400" /></div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-white truncate">{doc.name}</div>
                    <div className="text-[10px] text-gray-500">{doc.doc_type.toUpperCase()} · {doc.size_kb || 0} KB{doc.investor_id ? ' · PRIVADO' : ''}</div>
                  </div>
                  <button onClick={() => deleteDoc(doc.id)} className="p-1.5 text-red-400 hover:bg-red-500/10 rounded-lg"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showAddInv && <AddInvestmentModal dealId={params.id} headers={headers} onClose={() => setShowAddInv(false)} onSaved={() => { setShowAddInv(false); setToast({ msg: 'Inversionista agregado', ok: true }); fetchDeal(); }} />}
      {showAddDist && <AddDistributionModal dealId={params.id} headers={headers} onClose={() => setShowAddDist(false)} onSaved={() => { setShowAddDist(false); setToast({ msg: 'Distribución creada', ok: true }); fetchDeal(); }} />}
      {showAddDoc && <AddDocumentModal dealId={params.id} headers={headers} investments={investments} onClose={() => setShowAddDoc(false)} onSaved={() => { setShowAddDoc(false); setToast({ msg: 'Documento subido', ok: true }); fetchDeal(); }} />}
    </div>
  );
}

function KpiCard({ label, value, subtitle, color, progress }: any) {
  const cmap: Record<string, string> = { emerald: 'from-emerald-500/15 to-transparent border-emerald-500/30', violet: 'from-violet-500/15 to-transparent border-violet-500/20', blue: 'from-blue-500/15 to-transparent border-blue-500/20', amber: 'from-amber-500/15 to-transparent border-amber-500/20' };
  return (
    <div className={`bg-gradient-to-br ${cmap[color]} border rounded-2xl p-4`}>
      <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-2">{label}</div>
      <div className="text-2xl font-bold text-white">{value}</div>
      <div className="text-[10px] text-gray-500 mt-1">{subtitle}</div>
      {progress !== undefined && (
        <div className="mt-2 h-1 bg-white/[0.05] rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-400" style={{ width: `${progress}%` }} />
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: any) {
  return (
    <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5">
      <div className="text-[10px] font-bold text-gray-400 tracking-wider mb-3">{title}</div>
      {children}
    </div>
  );
}

function Stat({ label, value }: any) {
  return (
    <div>
      <div className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</div>
      <div className="text-white font-bold">{value}</div>
    </div>
  );
}

function AddInvestmentModal({ dealId, headers, onClose, onSaved }: any) {
  const [form, setForm] = useState({ investor_name: '', investor_email: '', investor_phone: '', amount: 0, status: 'pending', notes: '' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const submit = async () => {
    if (!form.investor_name.trim() || (!form.investor_email && !form.investor_phone) || form.amount <= 0) { setErr('Nombre, contacto y monto requeridos'); return; }
    setSaving(true); setErr('');
    const res = await fetch(`/api/admin/syndication/deals/${dealId}/investments`, { method: 'POST', headers: headers(), body: JSON.stringify(form) });
    if (res.ok) onSaved();
    else { const e = await res.json(); setErr(e.detail || 'Error'); }
    setSaving(false);
  };

  return (
    <Modal title="Agregar inversionista" onClose={onClose}>
      <div className="space-y-3">
        {err && <div className="bg-red-500/15 border border-red-500/30 rounded-lg px-3 py-2 text-xs text-red-300">{err}</div>}
        <ModalField label="Nombre *"><input value={form.investor_name} onChange={e => setForm({ ...form, investor_name: e.target.value })} className="modal-input" /></ModalField>
        <div className="grid grid-cols-2 gap-2">
          <ModalField label="Email"><input type="email" value={form.investor_email} onChange={e => setForm({ ...form, investor_email: e.target.value })} className="modal-input" /></ModalField>
          <ModalField label="Teléfono"><input value={form.investor_phone} onChange={e => setForm({ ...form, investor_phone: e.target.value })} className="modal-input" /></ModalField>
        </div>
        <ModalField label="Monto $ *"><input type="number" min="0" step="1000" value={form.amount} onChange={e => setForm({ ...form, amount: parseFloat(e.target.value || '0') })} className="modal-input" /></ModalField>
        <ModalField label="Estado">
          <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className="modal-input">
            <option value="pending">Pendiente</option><option value="active">Activo</option>
          </select>
        </ModalField>
        <ModalField label="Notas"><textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} className="modal-input resize-y" /></ModalField>
      </div>
      <div className="flex items-center gap-2 mt-5">
        <button onClick={onClose} className="px-4 py-2 bg-white/[0.03] border border-white/[0.08] rounded-xl text-sm text-gray-400 hover:text-white">Cancelar</button>
        <div className="flex-1" />
        <button onClick={submit} disabled={saving} className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl text-sm font-bold disabled:opacity-50">{saving ? 'Guardando...' : 'Agregar'}</button>
      </div>
      <style>{`.modal-input { width: 100%; padding: 9px 12px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; color: #fff; font-size: 13px; outline: none; } .modal-input:focus { border-color: rgb(16, 185, 129); }`}</style>
    </Modal>
  );
}

function AddDistributionModal({ dealId, headers, onClose, onSaved }: any) {
  const [form, setForm] = useState({ distribution_type: 'profit', period: '', total_amount: 0, status: 'scheduled', notes: '' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const submit = async () => {
    if (!form.total_amount || form.total_amount <= 0) { setErr('Monto requerido'); return; }
    setSaving(true); setErr('');
    const res = await fetch(`/api/admin/syndication/deals/${dealId}/distributions`, { method: 'POST', headers: headers(), body: JSON.stringify(form) });
    if (res.ok) onSaved();
    else { const e = await res.json(); setErr(e.detail || 'Error'); }
    setSaving(false);
  };
  return (
    <Modal title="Nueva distribución" onClose={onClose}>
      <div className="space-y-3">
        {err && <div className="bg-red-500/15 border border-red-500/30 rounded-lg px-3 py-2 text-xs text-red-300">{err}</div>}
        <ModalField label="Tipo">
          <select value={form.distribution_type} onChange={e => setForm({ ...form, distribution_type: e.target.value })} className="modal-input">
            <option value="profit">Profit (utilidades)</option>
            <option value="pref_return">Preferred Return</option>
            <option value="return_of_capital">Return of Capital</option>
            <option value="refund">Refund</option>
            <option value="other">Otro</option>
          </select>
        </ModalField>
        <div className="grid grid-cols-2 gap-2">
          <ModalField label="Período (YYYY-MM o YYYY-Q1)"><input value={form.period} onChange={e => setForm({ ...form, period: e.target.value })} className="modal-input" placeholder="2026-Q1" /></ModalField>
          <ModalField label="Monto total $ *"><input type="number" min="0" step="100" value={form.total_amount} onChange={e => setForm({ ...form, total_amount: parseFloat(e.target.value || '0') })} className="modal-input" /></ModalField>
        </div>
        <ModalField label="Estado">
          <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className="modal-input">
            <option value="scheduled">Programada</option><option value="paid">Marcar pagada y notificar LPs</option>
          </select>
        </ModalField>
        <ModalField label="Notas"><textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} className="modal-input resize-y" placeholder="Detalle de la distribución..." /></ModalField>
        <div className="text-[11px] text-gray-500 bg-white/[0.02] rounded-lg p-2"><Activity className="w-3 h-3 inline mr-1" /> El monto se reparte pro-rata entre LPs activos según su equity %</div>
      </div>
      <div className="flex items-center gap-2 mt-5">
        <button onClick={onClose} className="px-4 py-2 bg-white/[0.03] border border-white/[0.08] rounded-xl text-sm text-gray-400">Cancelar</button>
        <div className="flex-1" />
        <button onClick={submit} disabled={saving} className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl text-sm font-bold disabled:opacity-50">{saving ? 'Guardando...' : 'Crear'}</button>
      </div>
    </Modal>
  );
}

function AddDocumentModal({ dealId, headers, investments, onClose, onSaved }: any) {
  const [form, setForm] = useState<any>({ name: '', doc_type: 'ppm', investor_id: '', data: '', mime_type: 'application/pdf' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) { setErr('Archivo demasiado grande (máx 10MB)'); return; }
    const reader = new FileReader();
    reader.onload = () => setForm((p: any) => ({ ...p, data: reader.result as string, mime_type: f.type, name: p.name || f.name }));
    reader.readAsDataURL(f);
  };
  const submit = async () => {
    if (!form.name || !form.data) { setErr('Nombre y archivo requeridos'); return; }
    setSaving(true); setErr('');
    const res = await fetch(`/api/admin/syndication/deals/${dealId}/documents`, { method: 'POST', headers: headers(), body: JSON.stringify(form) });
    if (res.ok) onSaved();
    else { const e = await res.json(); setErr(e.detail || 'Error'); }
    setSaving(false);
  };
  return (
    <Modal title="Subir documento" onClose={onClose}>
      <div className="space-y-3">
        {err && <div className="bg-red-500/15 border border-red-500/30 rounded-lg px-3 py-2 text-xs text-red-300">{err}</div>}
        <ModalField label="Tipo">
          <select value={form.doc_type} onChange={e => setForm({ ...form, doc_type: e.target.value })} className="modal-input">
            <option value="ppm">PPM (Private Placement Memo)</option>
            <option value="subscription_agreement">Subscription Agreement</option>
            <option value="operating_agreement">Operating Agreement</option>
            <option value="k1">K-1 Tax Form</option>
            <option value="financial_report">Reporte financiero</option>
            <option value="exit_summary">Exit Summary</option>
            <option value="other">Otro</option>
          </select>
        </ModalField>
        <ModalField label="Nombre *"><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="modal-input" placeholder="Ej: Jasmine_Apartments_PPM_v2.pdf" /></ModalField>
        <ModalField label="Visible para">
          <select value={form.investor_id} onChange={e => setForm({ ...form, investor_id: e.target.value })} className="modal-input">
            <option value="">Todos los LPs del deal</option>
            {investments.filter((i: any) => i.investor_id).map((i: any) => <option key={i.investor_id} value={i.investor_id}>Sólo para: {i.investor_name}</option>)}
          </select>
        </ModalField>
        <label className="flex flex-col items-center justify-center gap-2 p-6 bg-white/[0.02] border-2 border-dashed border-white/[0.08] rounded-xl cursor-pointer hover:border-emerald-500/30 transition">
          <Upload className="w-6 h-6 text-gray-500" />
          <span className="text-xs text-gray-400">{form.data ? 'Archivo seleccionado ✓' : 'Click para seleccionar archivo (PDF, max 10MB)'}</span>
          <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,image/*" className="hidden" onChange={handleFile} />
        </label>
      </div>
      <div className="flex items-center gap-2 mt-5">
        <button onClick={onClose} className="px-4 py-2 bg-white/[0.03] border border-white/[0.08] rounded-xl text-sm text-gray-400">Cancelar</button>
        <div className="flex-1" />
        <button onClick={submit} disabled={saving} className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl text-sm font-bold disabled:opacity-50">{saving ? 'Subiendo...' : 'Subir'}</button>
      </div>
    </Modal>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-[#0a1020] border border-white/[0.08] rounded-2xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white">{title}</h3>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ModalField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-bold text-gray-400 mb-1">{label}</label>
      {children}
    </div>
  );
}


function WaterfallTab({ dealId, headers, totalRaised, dealName }: { dealId: string; headers: () => HeadersInit; totalRaised: number; dealName: string }) {
  const [exitValue, setExitValue] = useState<number>(Math.max(totalRaised * 2, 500000));
  const [monthsElapsed, setMonthsElapsed] = useState<number>(60);
  const [catchUpPct, setCatchUpPct] = useState<number>(100);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const calculate = async () => {
    if (totalRaised <= 0) { setError('El deal no tiene capital LP. Agrega inversionistas primero.'); return; }
    if (exitValue <= 0) { setError('Exit value debe ser > 0'); return; }
    setError(''); setLoading(true);
    try {
      const res = await fetch(`/api/admin/syndication/deals/${dealId}/waterfall`, {
        method: 'POST', headers: headers(),
        body: JSON.stringify({ exit_value: exitValue, months_elapsed: monthsElapsed, catch_up_pct: catchUpPct }),
      });
      const d = await res.json();
      if (res.ok) setResult(d.waterfall);
      else setError(d.detail || 'Error');
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  };

  return (
    <div className="space-y-4">
      <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Calculator className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-bold text-white">Simulador de Waterfall</h3>
          <span className="text-[10px] text-gray-500 ml-auto">{dealName}</span>
        </div>
        <p className="text-xs text-gray-500 mb-4">American waterfall de 4 niveles: Return of Capital → Pref Return → GP Catch-up → Promote Split. Modifica el exit value para ver cómo cambian los retornos.</p>

        {error && <div className="bg-red-500/15 border border-red-500/30 rounded-lg px-3 py-2 text-xs text-red-300 mb-3">{error}</div>}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Exit Value ($)</label>
            <input type="number" min="0" step="50000" value={exitValue} onChange={e => setExitValue(parseFloat(e.target.value || '0'))} className="w-full px-3 py-2 bg-[#0a1020]/60 border border-white/[0.08] rounded-xl text-white text-sm focus:border-emerald-500 focus:outline-none" />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Meses Hold</label>
            <input type="number" min="1" value={monthsElapsed} onChange={e => setMonthsElapsed(parseInt(e.target.value || '0'))} className="w-full px-3 py-2 bg-[#0a1020]/60 border border-white/[0.08] rounded-xl text-white text-sm focus:border-emerald-500 focus:outline-none" />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">GP Catch-up %</label>
            <input type="number" min="0" max="100" step="5" value={catchUpPct} onChange={e => setCatchUpPct(parseFloat(e.target.value || '0'))} className="w-full px-3 py-2 bg-[#0a1020]/60 border border-white/[0.08] rounded-xl text-white text-sm focus:border-emerald-500 focus:outline-none" />
          </div>
        </div>
        <button onClick={calculate} disabled={loading} className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2"><Calculator className="w-4 h-4" /> {loading ? 'Calculando...' : 'Calcular Waterfall'}</button>
      </div>

      {result && (
        <>
          {/* Totals KPI */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-gradient-to-br from-emerald-500/15 to-transparent border border-emerald-500/30 rounded-2xl p-4">
              <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">LP Total</div>
              <div className="text-2xl font-bold text-white">${result.totals.lp_total.toLocaleString()}</div>
              <div className="text-[11px] text-emerald-300 mt-1">Profit ${result.lp_metrics.lp_total_profit.toLocaleString()}</div>
            </div>
            <div className="bg-gradient-to-br from-violet-500/15 to-transparent border border-violet-500/30 rounded-2xl p-4">
              <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">GP Total (Promote)</div>
              <div className="text-2xl font-bold text-white">${result.totals.gp_total.toLocaleString()}</div>
              <div className="text-[11px] text-violet-300 mt-1">{((result.totals.gp_total / result.totals.total_distributed) * 100).toFixed(1)}% del exit</div>
            </div>
            <div className="bg-gradient-to-br from-blue-500/15 to-transparent border border-blue-500/30 rounded-2xl p-4">
              <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">LP IRR / Multiple</div>
              <div className="text-2xl font-bold text-blue-300">{result.lp_metrics.lp_irr_pct}%</div>
              <div className="text-[11px] text-gray-400 mt-1">{result.lp_metrics.lp_multiple}x equity multiple</div>
            </div>
          </div>

          {/* Tier breakdown */}
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5">
            <div className="text-[10px] font-bold text-gray-400 tracking-wider mb-3">DESGLOSE POR NIVEL (TIER)</div>
            <div className="space-y-2">
              {result.tiers.map((t: any, i: number) => {
                const total = t.lp + t.gp;
                const lpPct = total > 0 ? (t.lp / total) * 100 : 0;
                return (
                  <div key={i} className="bg-white/[0.02] border border-white/[0.04] rounded-xl p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm font-bold text-white">Tier {t.tier}: {t.label}</div>
                      <div className="text-sm font-bold text-emerald-300">${total.toLocaleString()}</div>
                    </div>
                    <div className="flex h-2 bg-white/[0.04] rounded-full overflow-hidden mb-1">
                      {t.lp > 0 && <div className="bg-emerald-500" style={{ width: `${lpPct}%` }} />}
                      {t.gp > 0 && <div className="bg-violet-500" style={{ width: `${100 - lpPct}%` }} />}
                    </div>
                    <div className="flex justify-between text-[10px] text-gray-500">
                      <span>LP: <span className="text-emerald-300 font-bold">${t.lp.toLocaleString()}</span></span>
                      <span>GP: <span className="text-violet-300 font-bold">${t.gp.toLocaleString()}</span></span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Per-LP allocation */}
          {result.per_lp_allocation?.length > 0 && (
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-white/[0.06] text-[10px] font-bold text-gray-400 tracking-wider">PAYOUT ESTIMADO POR INVERSIONISTA</div>
              <table className="w-full text-sm">
                <thead className="bg-white/[0.02]">
                  <tr className="text-left text-[10px] text-gray-500 uppercase tracking-wider">
                    <th className="px-4 py-2">Inversionista</th>
                    <th className="px-4 py-2 text-right">Invertido</th>
                    <th className="px-4 py-2 text-right">Payout</th>
                    <th className="px-4 py-2 text-right">Profit</th>
                    <th className="px-4 py-2 text-right">Multiple</th>
                  </tr>
                </thead>
                <tbody>
                  {result.per_lp_allocation.map((a: any, i: number) => (
                    <tr key={i} className="border-t border-white/[0.04]">
                      <td className="px-4 py-2"><div className="text-white font-bold">{a.investor_name}</div><div className="text-[10px] text-gray-500">{a.equity_percent.toFixed(2)}% equity</div></td>
                      <td className="px-4 py-2 text-right text-gray-300">${a.capital_invested.toLocaleString()}</td>
                      <td className="px-4 py-2 text-right text-emerald-300 font-bold">${a.estimated_payout.toLocaleString()}</td>
                      <td className="px-4 py-2 text-right text-blue-300">${a.estimated_profit.toLocaleString()}</td>
                      <td className="px-4 py-2 text-right text-violet-300 font-bold">{a.estimated_multiple}x</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
