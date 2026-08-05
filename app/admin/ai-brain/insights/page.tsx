'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useAdminAuth } from '../../layout';
import {
  Sparkles, RefreshCw, TrendingUp, TrendingDown, Minus, Lightbulb,
  AlertTriangle, ChevronRight, Brain, Home, Users, DollarSign,
} from 'lucide-react';

type Verdict = 'positive' | 'neutral' | 'warning';
type Tone = 'positive' | 'warning' | 'neutral';

interface KpiCard { label: string; value: string; hint?: string; tone?: Tone }
interface Opportunity { emoji: string; title: string; detail: string; impact?: string }
interface Risk { emoji: string; title: string; detail: string }
interface Action { priority: 'high' | 'med' | 'low'; action: string; reason?: string }

interface Insights {
  headline: string;
  verdict: Verdict;
  summary: string;
  kpi_cards: KpiCard[];
  opportunities: Opportunity[];
  risks: Risk[];
  actions_recommended: Action[];
}

interface Payload {
  snapshot: any;
  insights: Insights;
  cached?: boolean;
  source?: string;
  model?: string;
  generated_at?: string;
}

const VERDICT_STYLES: Record<Verdict, { bg: string; iconBg: string; label: string; icon: React.ReactNode }> = {
  positive: { bg: 'from-emerald-500/25 via-emerald-500/10 to-transparent', iconBg: 'bg-emerald-500 text-white', label: 'SALUDABLE',       icon: <TrendingUp className="w-3.5 h-3.5" /> },
  neutral:  { bg: 'from-slate-500/15 via-slate-500/5 to-transparent',    iconBg: 'bg-slate-500 text-white',   label: 'ESTABLE',        icon: <Minus className="w-3.5 h-3.5" /> },
  warning:  { bg: 'from-rose-500/25 via-rose-500/10 to-transparent',     iconBg: 'bg-rose-500 text-white',    label: 'REQUIERE ACCIÓN', icon: <TrendingDown className="w-3.5 h-3.5" /> },
};

const TONE_STYLES: Record<Tone, string> = {
  positive: 'from-emerald-500/15 to-transparent border-emerald-500/30 text-emerald-300',
  warning:  'from-rose-500/15 to-transparent border-rose-500/30 text-rose-300',
  neutral:  'from-slate-500/10 to-transparent border-slate-500/20 text-slate-200',
};

const PRIORITY: Record<string, string> = {
  high: 'bg-rose-500/10 text-rose-300 border-rose-500/30',
  med:  'bg-amber-500/10 text-amber-300 border-amber-500/30',
  low:  'bg-slate-500/10 text-slate-300 border-slate-500/20',
};

export default function BusinessInsightsPage() {
  const { token } = useAdminAuth();
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const url = `/api/admin/ai-brain/business-insights${refresh ? '?refresh=1' : ''}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(`${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (e: any) {
      setError(e.message || 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { fetchData(false); }, [fetchData]);

  return (
    <div className="min-h-screen bg-[#060910] text-white p-4 md:p-8">
      {/* Header */}
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-violet-500 via-fuchsia-500 to-indigo-500 flex items-center justify-center shadow-lg shadow-violet-500/30">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-black">Business Insights <span className="text-fuchsia-400">· IA</span></h1>
              <p className="text-xs text-slate-400">Análisis ejecutivo generado por Claude Sonnet 4.5</p>
            </div>
          </div>
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing || loading}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} /> Regenerar
          </button>
        </div>

        {loading && (
          <div className="space-y-4">
            {[0, 1, 2].map(i => <div key={i} className="h-32 rounded-3xl bg-white/[0.03] animate-pulse" />)}
          </div>
        )}

        {error && !loading && (
          <div className="rounded-2xl p-4 bg-white/[0.03] border border-rose-500/30 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-400" />
            <div className="flex-1">
              <div className="text-sm font-bold">No pudimos generar los insights</div>
              <div className="text-xs text-slate-500">{error}</div>
            </div>
            <button onClick={() => fetchData(true)} className="text-xs px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">Reintentar</button>
          </div>
        )}

        {!loading && !error && data && (() => {
          const ins = data.insights;
          const style = VERDICT_STYLES[ins.verdict] || VERDICT_STYLES.neutral;

          return (
            <div className="space-y-5">
              {/* Hero */}
              <div className="relative rounded-3xl overflow-hidden ring-1 ring-white/10"
                style={{ background: 'linear-gradient(135deg, rgba(15,23,42,0.6), rgba(15,23,42,0.9))' }}>
                <div className={`absolute inset-0 bg-gradient-to-br ${style.bg} pointer-events-none`} />
                <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-fuchsia-500/15 blur-3xl pointer-events-none" />
                <div className="relative p-5 md:p-7">
                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Rossy · Análisis ejecutivo
                    </span>
                    <span className={`inline-flex items-center gap-1 text-[9px] font-black px-1.5 py-0.5 rounded ${style.iconBg}`}>
                      {style.icon} {style.label}
                    </span>
                    {data.cached && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-700 text-slate-300">CACHE</span>}
                  </div>
                  <h2 className="text-lg md:text-2xl font-black leading-tight mb-2">{ins.headline}</h2>
                  <p className="text-sm md:text-base text-slate-300 leading-relaxed">{ins.summary}</p>
                </div>
              </div>

              {/* KPI cards */}
              {ins.kpi_cards?.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {ins.kpi_cards.slice(0, 4).map((k, i) => (
                    <div key={i} className={`rounded-2xl p-4 bg-gradient-to-br border ${TONE_STYLES[k.tone || 'neutral']}`}>
                      <div className="text-[10px] font-bold uppercase tracking-wider opacity-80 mb-1">{k.label}</div>
                      <div className="text-2xl font-black text-white">{k.value}</div>
                      {k.hint && <div className="text-[10px] text-slate-400 mt-1">{k.hint}</div>}
                    </div>
                  ))}
                </div>
              )}

              {/* Opportunities + Risks two-column */}
              <div className="grid md:grid-cols-2 gap-4">
                {/* Opportunities */}
                <div className="rounded-2xl p-5 bg-emerald-500/[0.03] border border-emerald-500/20">
                  <div className="flex items-center gap-2 mb-3">
                    <DollarSign className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-300">Oportunidades</span>
                  </div>
                  {ins.opportunities?.length ? (
                    <div className="space-y-3">
                      {ins.opportunities.map((op, i) => (
                        <div key={i} className="flex items-start gap-2.5">
                          <span className="text-lg shrink-0">{op.emoji}</span>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-bold text-white">{op.title}
                              {op.impact && <span className="ml-1.5 text-[10px] font-black text-emerald-300 bg-emerald-500/15 px-1.5 py-0.5 rounded">{op.impact}</span>}
                            </div>
                            <div className="text-[11px] text-slate-400 leading-relaxed mt-0.5">{op.detail}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : <div className="text-xs text-slate-500 py-3 text-center">Sin oportunidades detectadas ahora</div>}
                </div>

                {/* Risks */}
                <div className="rounded-2xl p-5 bg-rose-500/[0.03] border border-rose-500/20">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                    <span className="text-xs font-bold uppercase tracking-wider text-rose-300">Riesgos</span>
                  </div>
                  {ins.risks?.length ? (
                    <div className="space-y-3">
                      {ins.risks.map((r, i) => (
                        <div key={i} className="flex items-start gap-2.5">
                          <span className="text-lg shrink-0">{r.emoji}</span>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-bold text-white">{r.title}</div>
                            <div className="text-[11px] text-slate-400 leading-relaxed mt-0.5">{r.detail}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : <div className="text-xs text-slate-500 py-3 text-center">✅ No hay riesgos críticos</div>}
                </div>
              </div>

              {/* Actions recommended */}
              {ins.actions_recommended?.length > 0 && (
                <div className="rounded-2xl p-5 bg-white/[0.03] border border-white/[0.08]">
                  <div className="flex items-center gap-2 mb-4">
                    <Lightbulb className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-300">Acciones recomendadas</span>
                  </div>
                  <div className="space-y-2.5">
                    {ins.actions_recommended.map((a, i) => (
                      <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] border border-white/[0.05] transition group">
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border uppercase shrink-0 mt-0.5 ${PRIORITY[a.priority] || PRIORITY.low}`}>
                          {a.priority}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-bold text-white flex items-center gap-1">
                            <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-emerald-400 transition" />
                            {a.action}
                          </div>
                          {a.reason && <div className="text-[11px] text-slate-500 mt-0.5 pl-4">{a.reason}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Meta footer */}
              <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
                <span className="flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  {data.source === 'claude' ? 'Generado por Claude Sonnet 4.5' : 'Análisis local (LLM no disponible)'}
                </span>
                {data.generated_at && (
                  <span>Actualizado {new Date(data.generated_at).toLocaleString('es-MX', { hour: '2-digit', minute: '2-digit' })}</span>
                )}
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
