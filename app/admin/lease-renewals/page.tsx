'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useAdminAuth } from '../layout';
import {
  RefreshCw, Sparkles, CheckCircle2, XCircle, Edit3, DollarSign,
  Home, Calendar, Loader2, AlertTriangle, TrendingUp, ArrowUp, Ban,
} from 'lucide-react';

type Rec = 'renew' | 'raise' | 'non_renew';

interface Proposal {
  _id: string;
  lease_id: string;
  tenant_name?: string;
  tenant_email?: string;
  property_address?: string;
  current_rent: number;
  proposed_rent: number;
  lease_end_date: string;
  days_until_end: number;
  recommendation: Rec;
  confidence: 'high' | 'med' | 'low';
  rationale: string;
  highlights?: string[];
  status: 'draft' | 'approved' | 'rejected' | 'sent';
  market_signals?: any;
}

const REC_STYLE: Record<Rec, { label: string; color: string; icon: React.ReactNode }> = {
  renew:     { label: 'Renovar',    color: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30', icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  raise:     { label: 'Subir renta', color: 'bg-amber-500/15 text-amber-300 border-amber-500/30',      icon: <TrendingUp className="w-3.5 h-3.5" /> },
  non_renew: { label: 'No renovar', color: 'bg-rose-500/15 text-rose-300 border-rose-500/30',         icon: <Ban className="w-3.5 h-3.5" /> },
};

const STATUS_STYLE: Record<string, string> = {
  draft:    'bg-slate-500/15 text-slate-300 border-slate-500/30',
  approved: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  rejected: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
  sent:     'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
};

export default function LeaseRenewalsPage() {
  const { token, headers } = useAdminAuth();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const q = filter === 'all' ? '' : `?status=${filter}`;
      const res = await fetch(`/api/admin/lease-renewals/proposals${q}`, { headers: headers() });
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      setProposals(data.proposals || []);
    } catch (e: any) {
      setError(e.message || 'error');
    }
    setLoading(false);
  }, [filter, token, headers]);

  useEffect(() => { load(); }, [load]);

  const approve = async (id: string) => {
    if (!confirm('¿Aprobar propuesta? Se marca como aprobada.')) return;
    setBusy(id);
    try {
      await fetch(`/api/admin/lease-renewals/${id}/approve`, { method: 'POST', headers: headers() });
      await load();
    } catch (e: any) { alert(e.message); }
    setBusy(null);
  };

  const reject = async (id: string) => {
    const reason = prompt('Motivo de rechazo (opcional):') || '';
    setBusy(id);
    try {
      await fetch(`/api/admin/lease-renewals/${id}/reject`, {
        method: 'POST', headers: headers(),
        body: JSON.stringify({ reason }),
      });
      await load();
    } catch (e: any) { alert(e.message); }
    setBusy(null);
  };

  const refresh = async (id: string) => {
    setBusy(id);
    try {
      await fetch(`/api/admin/lease-renewals/refresh/${id}`, { method: 'POST', headers: headers() });
      await load();
    } catch (e: any) { alert(e.message); }
    setBusy(null);
  };

  const editRent = async (p: Proposal) => {
    const v = prompt(`Editar renta propuesta (actual: $${p.proposed_rent}):`, String(p.proposed_rent));
    if (!v) return;
    const num = parseFloat(v);
    if (isNaN(num) || num <= 0) { alert('Valor inválido'); return; }
    setBusy(p._id);
    try {
      await fetch(`/api/admin/lease-renewals/${p._id}`, {
        method: 'PATCH', headers: headers(),
        body: JSON.stringify({ proposed_rent: num }),
      });
      await load();
    } catch (e: any) { alert(e.message); }
    setBusy(null);
  };

  return (
    <div className="min-h-screen bg-[#060910] text-white p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
              <Home className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-black">Renovaciones de Leases <span className="text-amber-400">· IA</span></h1>
              <p className="text-xs text-slate-400">Propuestas generadas por Claude Sonnet 4.5 · ventana de 60 días</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select value={filter} onChange={e => setFilter(e.target.value)} className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm">
              <option value="all">Todos los estados</option>
              <option value="draft">Borrador</option>
              <option value="approved">Aprobados</option>
              <option value="rejected">Rechazados</option>
            </select>
            <button onClick={load} disabled={loading} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-sm disabled:opacity-50">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Actualizar
            </button>
          </div>
        </div>

        {loading && (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-slate-500" /></div>
        )}

        {!loading && error && (
          <div className="rounded-2xl p-4 bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5" />
            <div>{error}</div>
          </div>
        )}

        {!loading && !error && proposals.length === 0 && (
          <div className="rounded-3xl p-10 text-center bg-white/[0.03] border border-white/[0.06]">
            <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-400 mb-3" />
            <h3 className="text-lg font-bold">Sin propuestas pendientes</h3>
            <p className="text-sm text-slate-500 mt-2">
              No hay leases venciendo en los próximos {60} días. Cuando estén cerca, aparecerán aquí automáticamente.
            </p>
          </div>
        )}

        {!loading && !error && proposals.length > 0 && (
          <div className="grid gap-4">
            {proposals.map(p => {
              const rec = REC_STYLE[p.recommendation] || REC_STYLE.renew;
              const delta = p.proposed_rent - p.current_rent;
              const deltaPct = p.current_rent > 0 ? Math.round((delta / p.current_rent) * 100) : 0;
              return (
                <div key={p._id} className="relative rounded-2xl p-5 bg-white/[0.03] border border-white/[0.08] hover:border-white/[0.12] transition">
                  <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1.5">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded border ${rec.color}`}>
                          {rec.icon} {rec.label.toUpperCase()}
                        </span>
                        <span className={`inline-flex text-[10px] font-bold px-1.5 py-0.5 rounded border uppercase ${STATUS_STYLE[p.status] || STATUS_STYLE.draft}`}>
                          {p.status}
                        </span>
                        <span className="text-[10px] font-bold uppercase text-slate-500">
                          Confianza: {p.confidence}
                        </span>
                        <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> Vence en {p.days_until_end} días
                        </span>
                      </div>
                      <h3 className="text-base font-bold text-white truncate">{p.tenant_name || 'Inquilino'}</h3>
                      <p className="text-xs text-slate-400 truncate">{p.property_address || '—'} · {p.tenant_email}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] uppercase font-bold text-slate-500">Renta actual → propuesta</div>
                      <div className="flex items-center gap-1 justify-end">
                        <span className="text-sm text-slate-400">${p.current_rent.toFixed(0)}</span>
                        <ArrowUp className={`w-3.5 h-3.5 ${delta > 0 ? 'text-amber-400' : delta < 0 ? 'text-rose-400 rotate-180' : 'text-slate-500'}`} />
                        <span className={`text-lg font-black ${delta > 0 ? 'text-amber-400' : delta < 0 ? 'text-rose-400' : 'text-white'}`}>
                          ${p.proposed_rent.toFixed(0)}
                        </span>
                        {delta !== 0 && (
                          <span className={`text-[10px] font-bold px-1 py-0.5 rounded ${delta > 0 ? 'bg-amber-500/15 text-amber-300' : 'bg-rose-500/15 text-rose-300'}`}>
                            {delta > 0 ? '+' : ''}{deltaPct}%
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl bg-black/30 border border-white/[0.05] p-3 mb-3 flex items-start gap-2">
                    <Sparkles className="w-4 h-4 text-fuchsia-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-slate-300 leading-relaxed">{p.rationale}</p>
                  </div>

                  {p.highlights && p.highlights.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {p.highlights.map((h, i) => (
                        <span key={i} className="text-[10px] px-2 py-0.5 rounded bg-white/5 border border-white/10 text-slate-300">{h}</span>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => approve(p._id)}
                      disabled={busy === p._id || p.status !== 'draft'}
                      className="flex-1 min-w-[140px] flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-bold transition disabled:opacity-40"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Aprobar
                    </button>
                    <button
                      onClick={() => editRent(p)}
                      disabled={busy === p._id}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-xs font-bold text-slate-200 disabled:opacity-40"
                    >
                      <Edit3 className="w-3.5 h-3.5" /> Editar renta
                    </button>
                    <button
                      onClick={() => refresh(p._id)}
                      disabled={busy === p._id}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-fuchsia-500/10 border border-fuchsia-500/30 text-fuchsia-300 hover:bg-fuchsia-500/20 text-xs font-bold disabled:opacity-40"
                      title="Regenerar análisis con IA"
                    >
                      <Sparkles className={`w-3.5 h-3.5 ${busy === p._id ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                      onClick={() => reject(p._id)}
                      disabled={busy === p._id || p.status === 'rejected'}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 hover:bg-rose-500/20 text-xs font-bold disabled:opacity-40"
                    >
                      <XCircle className="w-3.5 h-3.5" /> Rechazar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
