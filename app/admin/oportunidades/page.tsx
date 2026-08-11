'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAdminAuth } from '../layout';
import {
  Target, RefreshCw, ExternalLink, Loader2, Sparkles, Mail, X,
  MapPin, User, Landmark, AlertTriangle, Search, Copy, Check, Moon, Play,
  ChevronLeft, ChevronRight, Download, Send, Eye,
} from 'lucide-react';
import ContractSection from '../../components/admin/ContractSection';

// ─── Types ───────────────────────────────────────────────────
type Lead = {
  id: string;
  county: string;
  county_name: string;
  property_id: string;
  owner_name: string;
  address: string;
  legal_description: string;
  property_type: string;
  appraised_value: number;
  values: Record<string, number>;
  mailing_lines: string[];
  mailing_city: string;
  mailing_state: string;
  tax_due_total: number;
  tax_years_due: number[];
  signals: string[];
  status: string;
  notes: string;
  ai_score: number | null;
  ai_analysis: {
    veredicto: string; razones: string[]; estrategia: string;
    oferta_sugerida_pct?: number;
  } | null;
  offer_letter: { letter_en: string; letter_es: string; generated_at: string } | null;
  offer?: {
    slug: string; mode: string; amount: number; expires_at: string;
    visits: number; last_visit_at: string | null;
    response: {
      action: string; price: number; phone: string; best_time: string; message: string; at: string;
      ai_analysis?: {
        recommendation: string; suggested_counter?: number | null; max_price?: number;
        deal_score?: number; reasoning?: string; leverage_points?: string[];
        email_script?: string; generated_at?: string; analyzed_counter_price?: number;
      } | null;
    } | null;
  } | null;
  mail: { lob_id: string; status: string; expected_delivery: string; mode: string; mailed_at: string } | null;
  contract?: {
    price: number; seller_name: string; earnest_money: number; closing_days: number;
    title_company_name: string; generated_at: string;
  } | null;
  portal_url: string;
  last_synced_at: string;
};

type Scan = {
  id: string; county: string; keywords: string; status: string;
  total_found: number; total: number; processed: number;
  new_leads: number; updated: number; error: string;
};

type Stats = {
  total: number; tax_delinquent: number; absentee_owner: number;
  vacant_land: number; high_score: number; by_status: Record<string, number>;
  mail?: { month_live: number; month_test: number; month_cost: number; letter_cost: number; all_time_live: number };
};

type CronInfo = {
  config: { enabled: boolean; max_per_run: number; alert_email: string };
  state: {
    next_letter: string; coverage_pct: number; cycles: number;
    last_run: string; running: boolean;
    last_result: { processed?: number; new?: number; strong_new?: number; became_delinquent?: number; alerted?: boolean };
  };
};

type County = { key: string; name: string; active: boolean };

// ─── Constants ───────────────────────────────────────────────
const fmt = (n: number) => `$${Number(n || 0).toLocaleString('en-US')}`;

// Links externos por dirección (situs incluye ciudad + TX + zip)
const mapsUrl = (addr: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`;
const zillowUrl = (addr: string) => `https://www.zillow.com/homes/${encodeURIComponent(addr.replace(/[,#]/g, '').trim().replace(/\s+/g, '-'))}_rb/`;
const realtorUrl = (addr: string) => {
  const zip = (addr.match(/\b(\d{5})\b\s*$/) || [])[1];
  return zip ? `https://www.realtor.com/realestateandhomes-search/${zip}`
             : `https://www.realtor.com/realestateandhomes-search/Dumas_TX`;
};

const SIGNAL_LABELS: Record<string, { label: string; cls: string }> = {
  tax_delinquent:     { label: '🔴 Impuestos atrasados', cls: 'bg-red-500/15 text-red-300 border-red-500/30' },
  absentee_owner:     { label: '🏃 Dueño ausente', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  out_of_state_owner: { label: '✈️ Fuera de Texas', cls: 'bg-orange-500/15 text-orange-300 border-orange-500/30' },
  vacant_land:        { label: '🌵 Terreno baldío', cls: 'bg-lime-500/15 text-lime-300 border-lime-500/30' },
  low_improvement:    { label: '🏚️ Mejora baja', cls: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30' },
  low_value:          { label: '💲 Valor bajo', cls: 'bg-violet-500/15 text-violet-300 border-violet-500/30' },
};

const STATUS_OPTIONS: { value: string; label: string; cls: string }[] = [
  { value: 'new',         label: 'Nuevo',        cls: 'bg-blue-500/15 text-blue-300 border-blue-500/30' },
  { value: 'contacted',   label: 'Contactado',   cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  { value: 'interested',  label: 'Interesado',   cls: 'bg-violet-500/15 text-violet-300 border-violet-500/30' },
  { value: 'offer_sent',  label: 'Oferta enviada', cls: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30' },
  { value: 'negotiating', label: 'Negociando',   cls: 'bg-orange-500/15 text-orange-300 border-orange-500/30' },
  { value: 'acquired',    label: '✅ Adquirida',  cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  { value: 'discarded',   label: 'Descartada',   cls: 'bg-gray-500/15 text-gray-400 border-gray-500/30' },
];

const statusMeta = (s: string) => STATUS_OPTIONS.find(o => o.value === s) || STATUS_OPTIONS[0];

const SEARCH_TYPES = [
  { value: 'street', label: 'Calle' },
  { value: 'owner', label: 'Dueño' },
  { value: 'subdivision', label: 'Subdivisión' },
  { value: 'abstract', label: 'Abstract' },
];

// ─── Page ────────────────────────────────────────────────────
export default function OportunidadesPage() {
  const { headers } = useAdminAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [counties, setCounties] = useState<County[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [totalLeads, setTotalLeads] = useState(0);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  // scan form
  const [county, setCounty] = useState('moore');
  const [searchType, setSearchType] = useState('street');
  const [query, setQuery] = useState('');
  const [maxResults, setMaxResults] = useState(40);
  const [onlyDelinquent, setOnlyDelinquent] = useState(false);
  const [activeScan, setActiveScan] = useState<Scan | null>(null);
  const scanPoll = useRef<ReturnType<typeof setInterval> | null>(null);

  // filters
  const [fSignal, setFSignal] = useState('');
  const [fStatus, setFStatus] = useState('');
  const [fQ, setFQ] = useState('');
  const [sort, setSort] = useState('score');
  const [fCounty, setFCounty] = useState('');
  const [fCity, setFCity] = useState('');
  const [fMinTax, setFMinTax] = useState('');
  const [fMinScore, setFMinScore] = useState('');

  // drawer
  const [selected, setSelected] = useState<Lead | null>(null);

  // auto-scan cron
  const [cron, setCron] = useState<CronInfo | null>(null);
  const [cronBusy, setCronBusy] = useState(false);
  const [lob, setLob] = useState<{ configured: boolean; mode: string | null }>({ configured: false, mode: null });

  const fetchCron = useCallback(async () => {
    try {
      const r = await fetch('/api/admin/deal-finder/cron-config', { headers: headers() });
      if (r.ok) setCron(await r.json());
    } catch (e) { console.error(e); }
  }, [headers]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  const fetchStats = useCallback(async () => {
    try {
      const r = await fetch('/api/admin/deal-finder/stats', { headers: headers() });
      if (r.ok) setStats((await r.json()).stats);
    } catch (e) { console.error(e); }
  }, [headers]);

  const PAGE_SIZE = 15;
  const [page, setPage] = useState(1);

  const fetchLeads = useCallback(async () => {
    try {
      const p = new URLSearchParams();
      if (fSignal) p.set('signal', fSignal);
      if (fStatus) p.set('status', fStatus);
      if (fQ.trim()) p.set('q', fQ.trim());
      if (fCounty) p.set('county', fCounty);
      if (fCity.trim()) p.set('city', fCity.trim());
      if (fMinTax && Number(fMinTax) > 0) p.set('min_tax', fMinTax);
      if (fMinScore && Number(fMinScore) > 0) p.set('min_score', fMinScore);
      p.set('sort', sort);
      p.set('limit', String(PAGE_SIZE));
      p.set('skip', String((page - 1) * PAGE_SIZE));
      const r = await fetch(`/api/admin/deal-finder/leads?${p}`, { headers: headers() });
      if (r.ok) {
        const d = await r.json();
        setLeads(d.leads || []);
        setTotalLeads(d.total || 0);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [headers, fSignal, fStatus, fQ, sort, fCounty, fCity, fMinTax, fMinScore, page]);

  // volver a la página 1 cuando cambian los filtros
  useEffect(() => { setPage(1); }, [fSignal, fStatus, fQ, sort, fCounty, fCity, fMinTax, fMinScore]);

  useEffect(() => {
    fetchStats();
    fetchCron();
    fetch('/api/admin/deal-finder/lob-status', { headers: headers() })
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setLob({ configured: d.configured, mode: d.mode }))
      .catch(() => {});
    fetch('/api/admin/deal-finder/counties', { headers: headers() })
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setCounties(d.counties))
      .catch(() => {});
    // resume any in-flight scan
    fetch('/api/admin/deal-finder/scans', { headers: headers() })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        const running = d?.scans?.find((s: Scan) => s.status === 'searching' || s.status === 'enriching');
        if (running) startPolling(running.id);
      })
      .catch(() => {});
  }, []);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  const stopPolling = () => {
    if (scanPoll.current) { clearInterval(scanPoll.current); scanPoll.current = null; }
  };

  const startPolling = useCallback((scanId: string) => {
    stopPolling();
    const poll = async () => {
      try {
        const r = await fetch(`/api/admin/deal-finder/scan/${scanId}`, { headers: headers() });
        if (!r.ok) return;
        const s: Scan = (await r.json()).scan;
        setActiveScan(s);
        if (s.status === 'done' || s.status === 'error') {
          stopPolling();
          setActiveScan(null);
          if (s.status === 'done') {
            setToast({ msg: `Escaneo completo: ${s.new_leads} nuevas oportunidades, ${s.updated} actualizadas`, ok: true });
          } else {
            setToast({ msg: `Escaneo falló: ${s.error}`, ok: false });
          }
          fetchStats();
          fetchLeads();
        }
      } catch (e) { console.error(e); }
    };
    poll();
    scanPoll.current = setInterval(poll, 4000);
  }, [headers]);

  useEffect(() => () => stopPolling(), []);

  const startScan = async () => {
    if (!query.trim()) { setToast({ msg: 'Escribe qué buscar (ej. nombre de calle)', ok: false }); return; }
    try {
      const r = await fetch('/api/admin/deal-finder/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers() },
        body: JSON.stringify({ county, search_type: searchType, query: query.trim(), max_results: maxResults, only_delinquent: onlyDelinquent }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        setToast({ msg: `Escaneando el condado: ${d.keywords}`, ok: true });
        setActiveScan({ id: d.scan_id, county, keywords: d.keywords, status: 'searching', total_found: 0, total: 0, processed: 0, new_leads: 0, updated: 0, error: '' });
        startPolling(d.scan_id);
      } else {
        setToast({ msg: d.detail || 'Error al iniciar el escaneo', ok: false });
      }
    } catch { setToast({ msg: 'Error de conexión', ok: false }); }
  };

  const toggleCron = async (enabled: boolean) => {
    setCronBusy(true);
    try {
      const r = await fetch('/api/admin/deal-finder/cron-config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...headers() },
        body: JSON.stringify({ enabled }),
      });
      if (r.ok) {
        setToast({ msg: enabled ? 'Radar automático activado 🌙' : 'Radar automático pausado', ok: true });
        await fetchCron();
      }
    } catch { setToast({ msg: 'Error de conexión', ok: false }); }
    setCronBusy(false);
  };

  const runCronNow = async () => {
    setCronBusy(true);
    try {
      const r = await fetch('/api/admin/deal-finder/cron-run-now', { method: 'POST', headers: headers() });
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        setToast({ msg: 'Lote del radar iniciado — recibirás email si hay hallazgos 📬', ok: true });
        await fetchCron();
      } else {
        setToast({ msg: d.detail || 'No se pudo iniciar', ok: false });
      }
    } catch { setToast({ msg: 'Error de conexión', ok: false }); }
    setCronBusy(false);
  };

  const patchLead = async (id: string, body: { status?: string; notes?: string }) => {
    try {
      const r = await fetch(`/api/admin/deal-finder/leads/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...headers() },
        body: JSON.stringify(body),
      });
      if (r.ok) {
        const lead: Lead = (await r.json()).lead;
        setLeads(prev => prev.map(l => l.id === id ? lead : l));
        setSelected(prev => (prev && prev.id === id ? lead : prev));
        fetchStats();
      }
    } catch (e) { console.error(e); }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-3 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-5">
      {toast && (
        <div className={`fixed top-4 right-4 z-[60] px-4 py-3 rounded-xl border backdrop-blur-md text-sm font-medium shadow-2xl ${
          toast.ok ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300' : 'bg-red-500/15 border-red-500/30 text-red-300'
        }`}>{toast.msg}</div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500/20 to-red-500/5 border border-orange-500/20 flex items-center justify-center">
            <Target className="w-6 h-6 text-orange-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Radar de Oportunidades</h2>
            <p className="text-sm text-gray-500">Propiedades off-market · registros públicos del condado 🎯</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          {[
            { label: 'Oportunidades', value: stats.total, cls: 'text-white' },
            { label: 'Impuestos atrasados', value: stats.tax_delinquent, cls: 'text-red-300' },
            { label: 'Dueños ausentes', value: stats.absentee_owner, cls: 'text-amber-300' },
            { label: 'Terrenos baldíos', value: stats.vacant_land, cls: 'text-lime-300' },
            { label: 'Score AI ≥ 70', value: stats.high_score, cls: 'text-violet-300' },
          ].map(c => (
            <div key={c.label} className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4">
              <div className={`text-2xl font-bold ${c.cls}`}>{c.value}</div>
              <div className="text-[11px] text-gray-500 mt-0.5">{c.label}</div>
            </div>
          ))}
          <div className="bg-orange-500/[0.06] border border-orange-500/20 rounded-2xl p-4" data-testid="mail-budget-card">
            <div className="text-2xl font-bold text-orange-300">
              {stats.mail?.month_live ?? 0}
              <span className="text-sm font-bold text-orange-300/70"> · ${(stats.mail?.month_cost ?? 0).toFixed(2)}</span>
            </div>
            <div className="text-[11px] text-gray-500 mt-0.5">📮 Cartas Lob este mes · costo est.</div>
            <div className="text-[10px] text-gray-600 mt-0.5">
              {(stats.mail?.month_test ?? 0) > 0 && `${stats.mail?.month_test} de prueba · `}
              {stats.mail?.all_time_live ?? 0} enviadas en total
            </div>
          </div>
        </div>
      )}

      <CampaignPanel headers={headers} />

      {/* Scan panel */}
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 space-y-3">
        <div className="text-sm font-bold text-white flex items-center gap-2">
          <Search className="w-4 h-4 text-orange-400" /> Escanear el condado
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <select value={county} onChange={e => setCounty(e.target.value)} data-testid="scan-county"
            className="bg-black/30 border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-orange-500/40">
            {(counties.length ? counties : [{ key: 'moore', name: 'Moore County', active: true }]).map(c => (
              <option key={c.key} value={c.key} disabled={!c.active}>
                {c.name}{!c.active ? ' (próximamente)' : ''}
              </option>
            ))}
          </select>
          <select value={searchType} onChange={e => setSearchType(e.target.value)} data-testid="scan-type"
            className="bg-black/30 border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-orange-500/40">
            {SEARCH_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <input value={query} onChange={e => setQuery(e.target.value)} data-testid="scan-query"
            onKeyDown={e => e.key === 'Enter' && !activeScan && startScan()}
            placeholder={searchType === 'street' ? 'Ej: maddox, dumas ave, birge...' : searchType === 'owner' ? 'Ej: smith' : 'Ej: nombre'}
            className="flex-1 min-w-[180px] bg-black/30 border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-orange-500/40" />
          <select value={maxResults} onChange={e => setMaxResults(Number(e.target.value))}
            className="bg-black/30 border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-gray-200 focus:outline-none">
            {[20, 40, 60, 100].map(n => <option key={n} value={n}>máx {n}</option>)}
          </select>
          <label className="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer select-none">
            <input type="checkbox" checked={onlyDelinquent} onChange={e => setOnlyDelinquent(e.target.checked)}
              className="accent-orange-500" />
            Solo con impuestos atrasados
          </label>
          <button onClick={startScan} disabled={!!activeScan} data-testid="scan-start-btn"
            className="px-4 py-2 bg-orange-500/15 text-orange-400 border border-orange-500/30 rounded-xl text-xs font-bold hover:bg-orange-500/25 transition flex items-center gap-2 disabled:opacity-50">
            {activeScan ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {activeScan ? 'Escaneando...' : 'Escanear'}
          </button>
        </div>
        {activeScan && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-[11px] text-gray-400">
              <span>{activeScan.status === 'searching' ? 'Buscando en el portal del condado...' : `Analizando propiedades (dueño, valores, impuestos)... ${activeScan.processed}/${activeScan.total}`}</span>
              <span>{activeScan.total_found > 0 && `${activeScan.total_found} encontradas`}</span>
            </div>
            <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-orange-500 to-amber-400 transition-all duration-500"
                style={{ width: activeScan.total ? `${Math.round((activeScan.processed / activeScan.total) * 100)}%` : '8%' }} />
            </div>
            <div className="text-[10px] text-gray-600">El escaneo consulta el portal público del condado con pausas para no saturarlo — puede tardar 1-3 min.</div>
          </div>
        )}
      </div>

      {/* Auto-scan (cron) */}
      {cron && (
        <div className="bg-white/[0.03] border border-indigo-500/20 rounded-2xl p-4 space-y-2.5">
          <div className="flex flex-wrap items-center gap-3">
            <div className="text-sm font-bold text-white flex items-center gap-2">
              <Moon className="w-4 h-4 text-indigo-400" /> Radar automático nocturno
            </div>
            <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold border ${
              cron.state.running ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
              : cron.config.enabled ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
              : 'bg-gray-500/15 text-gray-400 border-gray-500/30'}`}>
              {cron.state.running ? '⏳ Corriendo...' : cron.config.enabled ? '● Activo' : '⏸ Pausado'}
            </span>
            <div className="flex gap-2 ml-auto">
              <button onClick={runCronNow} disabled={cronBusy || cron.state.running} data-testid="cron-run-btn"
                className="px-3 py-1.5 bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 rounded-lg text-[11px] font-bold hover:bg-indigo-500/25 transition flex items-center gap-1.5 disabled:opacity-50">
                {cron.state.running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                Correr lote ahora
              </button>
              <button onClick={() => toggleCron(!cron.config.enabled)} disabled={cronBusy} data-testid="cron-toggle-btn"
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition disabled:opacity-50 ${
                  cron.config.enabled
                    ? 'bg-white/[0.04] text-gray-300 border-white/[0.08] hover:text-white'
                    : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25'}`}>
                {cron.config.enabled ? 'Pausar' : 'Activar'}
              </button>
            </div>
          </div>
          <div className="text-[11px] text-gray-500">
            Recorre TODO el condado cada noche ({cron.config.max_per_run} propiedades/lote, calles A→Z) y te envía
            email a <b className="text-gray-300">{cron.config.alert_email}</b> cuando encuentra nuevas oportunidades
            fuertes o propiedades que se vuelven morosas.
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-gray-400">
            <span>📍 Próxima letra: <b className="text-indigo-300">{cron.state.next_letter}</b></span>
            <span>Cobertura del ciclo: <b className="text-white">{cron.state.coverage_pct}%</b></span>
            {cron.state.cycles > 0 && <span>Vueltas completas al condado: <b className="text-white">{cron.state.cycles}</b></span>}
            {cron.state.last_run && (
              <span>Último lote: {new Date(cron.state.last_run).toLocaleString('es-US', { dateStyle: 'short', timeStyle: 'short' })}
                {cron.state.last_result?.processed != null && ` · ${cron.state.last_result.processed} analizadas, ${cron.state.last_result.new || 0} nuevas`}
                {cron.state.last_result?.alerted && ' · 📬 alerta enviada'}
              </span>
            )}
          </div>
          <div className="h-1 bg-white/[0.06] rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-indigo-500 to-violet-400 transition-all duration-500"
              style={{ width: `${cron.state.coverage_pct}%` }} />
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => setFSignal('')}
            className={`text-[11px] px-3 py-1.5 rounded-full border font-medium transition ${!fSignal ? 'bg-orange-500/20 text-orange-300 border-orange-500/40' : 'bg-white/[0.03] text-gray-400 border-white/[0.08] hover:text-white'}`}>
            Todas
          </button>
          {Object.entries(SIGNAL_LABELS).map(([k, v]) => (
            <button key={k} onClick={() => setFSignal(fSignal === k ? '' : k)}
              className={`text-[11px] px-3 py-1.5 rounded-full border font-medium transition ${fSignal === k ? v.cls : 'bg-white/[0.03] text-gray-400 border-white/[0.08] hover:text-white'}`}>
              {v.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2 ml-auto">
          <input value={fQ} onChange={e => setFQ(e.target.value)} placeholder="Buscar dirección o dueño..."
            className="bg-black/30 border border-white/[0.08] rounded-xl px-3 py-1.5 text-xs text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-orange-500/40 w-48" />
          <select value={fStatus} onChange={e => setFStatus(e.target.value)}
            className="bg-black/30 border border-white/[0.08] rounded-xl px-2 py-1.5 text-xs text-gray-200 focus:outline-none">
            <option value="">Todo estado</option>
            {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <select value={sort} onChange={e => setSort(e.target.value)}
            className="bg-black/30 border border-white/[0.08] rounded-xl px-2 py-1.5 text-xs text-gray-200 focus:outline-none">
            <option value="score">Por score AI</option>
            <option value="tax_due">Por deuda fiscal</option>
            <option value="value">Por valor</option>
            <option value="recent">Recientes</option>
          </select>
        </div>
      </div>

      {/* Filtros avanzados */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-[10px] text-gray-600 uppercase tracking-wider font-bold">Afinar:</span>
        <select value={fCounty} onChange={e => setFCounty(e.target.value)}
          className="bg-black/30 border border-white/[0.08] rounded-xl px-2 py-1.5 text-xs text-gray-200 focus:outline-none">
          <option value="">Todos los condados</option>
          {counties.map(c => <option key={c.key} value={c.key}>{c.name}</option>)}
        </select>
        <input value={fCity} onChange={e => setFCity(e.target.value)} placeholder="Ciudad (ej. DUMAS)"
          className="bg-black/30 border border-white/[0.08] rounded-xl px-3 py-1.5 text-xs text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-orange-500/40 w-36" />
        <div className="flex items-center gap-1">
          <span className="text-[11px] text-gray-500">Deuda ≥</span>
          <input value={fMinTax} onChange={e => setFMinTax(e.target.value.replace(/[^\d.]/g, ''))} placeholder="$0" inputMode="numeric"
            className="bg-black/30 border border-white/[0.08] rounded-xl px-2 py-1.5 text-xs text-gray-200 placeholder:text-gray-600 focus:outline-none w-20" />
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[11px] text-gray-500">Score ≥</span>
          <input value={fMinScore} onChange={e => setFMinScore(e.target.value.replace(/[^\d]/g, ''))} placeholder="0" inputMode="numeric"
            className="bg-black/30 border border-white/[0.08] rounded-xl px-2 py-1.5 text-xs text-gray-200 placeholder:text-gray-600 focus:outline-none w-16" />
        </div>
        {(fCounty || fCity || fMinTax || fMinScore) && (
          <button onClick={() => { setFCounty(''); setFCity(''); setFMinTax(''); setFMinScore(''); }}
            className="text-[11px] text-orange-300 hover:text-orange-200 font-bold">✕ Limpiar</button>
        )}
      </div>

      {/* Leads list */}
      {leads.length === 0 ? (
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-10 text-center space-y-2">
          <Target className="w-10 h-10 text-gray-600 mx-auto" />
          <div className="text-sm text-gray-400">Aún no hay oportunidades{fSignal || fStatus || fQ ? ' con esos filtros' : ''}.</div>
          {!fSignal && !fStatus && !fQ && (
            <div className="text-xs text-gray-600">Lanza un escaneo arriba — por ejemplo busca una calle de Dumas como <b className="text-orange-400">maddox</b> o <b className="text-orange-400">birge</b>.</div>
          )}
        </div>
      ) : (
        <div className="space-y-2.5" data-testid="leads-list">
          <div className="text-[11px] text-gray-500">
            {totalLeads} oportunidad(es)
            {totalLeads > PAGE_SIZE && ` · mostrando ${(page - 1) * PAGE_SIZE + 1}-${Math.min(page * PAGE_SIZE, totalLeads)}`}
          </div>
          {leads.map(l => (
            <button key={l.id} onClick={() => setSelected(l)}
              className="w-full text-left bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 hover:border-orange-500/30 hover:bg-white/[0.05] transition group">
              <div className="flex items-start gap-3 flex-wrap">
                <div className="flex-1 min-w-[220px]">
                  <div className="text-sm font-bold text-white flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-orange-400 flex-shrink-0" />
                    {l.address || l.legal_description.slice(0, 60) || `Cuenta #${l.property_id}`}
                  </div>
                  <div className="text-[11px] text-gray-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
                    <User className="w-3 h-3" /> {l.owner_name}
                    {l.mailing_city && <span>· 📮 {l.mailing_city}{l.mailing_state && `, ${l.mailing_state}`}</span>}
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2 items-center">
                    {l.signals.map(s => SIGNAL_LABELS[s] && (
                      <span key={s} className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${SIGNAL_LABELS[s].cls}`}>
                        {SIGNAL_LABELS[s].label}
                      </span>
                    ))}
                    {l.address && (
                      <>
                        <span onClick={e => { e.stopPropagation(); window.open(mapsUrl(l.address), '_blank'); }}
                          title="Ver en Google Maps" role="link"
                          className="text-[10px] px-2 py-0.5 rounded-full border border-sky-500/30 bg-sky-500/10 text-sky-300 font-bold hover:bg-sky-500/20 cursor-pointer transition">🗺️ Maps</span>
                        <span onClick={e => { e.stopPropagation(); window.open(zillowUrl(l.address), '_blank'); }}
                          title="Ver en Zillow" role="link"
                          className="text-[10px] px-2 py-0.5 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-300 font-bold hover:bg-blue-500/20 cursor-pointer transition">🏠 Zillow</span>
                        <span onClick={e => { e.stopPropagation(); window.open(realtorUrl(l.address), '_blank'); }}
                          title="Ver zona en Realtor.com" role="link"
                          className="text-[10px] px-2 py-0.5 rounded-full border border-red-500/30 bg-red-500/10 text-red-300 font-bold hover:bg-red-500/20 cursor-pointer transition">🔴 Realtor</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <div className="flex items-center gap-2">
                    {l.ai_score != null && (
                      <span className={`text-xs px-2.5 py-1 rounded-full font-bold border ${
                        l.ai_score >= 70 ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                        : l.ai_score >= 40 ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                        : 'bg-gray-500/15 text-gray-400 border-gray-500/30'}`}>
                        ⚡ {l.ai_score}
                      </span>
                    )}
                    <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold border ${statusMeta(l.status).cls}`}>
                      {statusMeta(l.status).label}
                    </span>
                  </div>
                  <div className="text-[11px] text-gray-400">
                    Tasado: <b className="text-white">{fmt(l.appraised_value)}</b>
                    {l.tax_due_total > 0 && <span className="text-red-300 ml-2">Debe {fmt(l.tax_due_total)}</span>}
                  </div>
                </div>
              </div>
            </button>
          ))}

          {/* Paginación */}
          {totalLeads > PAGE_SIZE && (() => {
            const totalPages = Math.ceil(totalLeads / PAGE_SIZE);
            const pages: (number | '...')[] = [];
            for (let i = 1; i <= totalPages; i++) {
              if (i === 1 || i === totalPages || Math.abs(i - page) <= 1) pages.push(i);
              else if (pages[pages.length - 1] !== '...') pages.push('...');
            }
            return (
              <div className="flex items-center justify-center gap-1.5 pt-2" data-testid="pagination">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="p-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-gray-400 hover:text-white transition disabled:opacity-40">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {pages.map((p, i) => p === '...' ? (
                  <span key={`e${i}`} className="px-1.5 text-xs text-gray-600">…</span>
                ) : (
                  <button key={p} onClick={() => setPage(p)}
                    className={`min-w-[34px] px-2 py-1.5 rounded-lg text-xs font-bold border transition ${
                      p === page
                        ? 'bg-orange-500/20 text-orange-300 border-orange-500/40'
                        : 'bg-white/[0.04] text-gray-400 border-white/[0.08] hover:text-white'}`}>
                    {p}
                  </button>
                ))}
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="p-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-gray-400 hover:text-white transition disabled:opacity-40">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            );
          })()}
        </div>
      )}

      {selected && (
        <LeadDrawer lead={selected} onClose={() => setSelected(null)}
          onPatch={patchLead} headers={headers} setToast={setToast}
          lobConfigured={lob.configured} lobMode={lob.mode}
          onLeadUpdate={(lead) => {
            setLeads(prev => prev.map(x => x.id === lead.id ? lead : x));
            setSelected(lead);
            fetchStats();
          }} />
      )}
    </div>
  );
}

// ─── Detail drawer ───────────────────────────────────────────
// ─── Panel de campaña de cartas (embudo + desglose) ───────────────
const COUNTY_NAMES: Record<string, string> = { moore: 'Moore', dallam: 'Dallam', potter_randall: 'Potter-Randall', potter: 'Potter-Randall' };
const SIGNAL_NAMES: Record<string, string> = { tax_delinquent: 'Impuestos atrasados', absentee_owner: 'Dueño ausente', vacant_land: 'Terreno baldío', otro: 'Otro' };
const ACTION_NAMES: Record<string, string> = { accept: '✅ Aceptó', counter: '🔁 Contraoferta', call: '📞 Pidió llamada', reject: '❌ Rechazó' };

const MiniTable = ({ title, rows, names }: { title: string; rows: Record<string, any>; names: Record<string, string> }) => (
  <div className="flex-1 min-w-[260px]">
    <div className="text-[11px] font-bold text-gray-400 uppercase mb-1.5">{title}</div>
    <div className="space-y-1">
      {Object.entries(rows || {}).map(([k, v]: [string, any]) => (
        <div key={k} className="flex items-center justify-between text-xs bg-white/[0.03] border border-white/[0.05] rounded-lg px-3 py-2">
          <span className="text-gray-300 font-medium">{names[k] || k}</span>
          <span className="text-gray-500">
            {v.sent} env · <span className="text-violet-300">{v.scan_rate}% scan</span> · <span className="text-emerald-300">{v.response_rate}% resp</span>
          </span>
        </div>
      ))}
      {Object.keys(rows || {}).length === 0 && <div className="text-xs text-gray-600 px-1">Sin datos aún</div>}
    </div>
  </div>
);

function CampaignPanel({ headers }: { headers: () => Record<string, string> }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/deal-finder/campaign-stats', { headers: headers() });
      if (res.ok) setData(await res.json());
    } catch { /* noop */ }
    setLoading(false);
  };

  const toggle = () => { const next = !open; setOpen(next); if (next && !data) load(); };
  const f = data?.funnel;
  const stages = f ? [
    { label: '📮 Enviadas', value: f.sent, pct: 100, color: 'bg-cyan-500' },
    { label: '📬 Entregadas (est.)', value: f.delivered, pct: f.sent ? Math.round(f.delivered * 100 / f.sent) : 0, color: 'bg-blue-500' },
    { label: '📱 QR escaneados', value: f.scanned, pct: f.scan_rate, color: 'bg-violet-500' },
    { label: '💬 Respuestas', value: f.responded, pct: f.response_rate, color: 'bg-emerald-500' },
  ] : [];

  return (
    <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-hidden">
      <button onClick={toggle} data-testid="campaign-panel-toggle"
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.02] transition">
        <span className="text-sm font-bold text-white">📬 Campaña de cartas — embudo de resultados</span>
        <ChevronRight className={`w-4 h-4 text-gray-500 transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-4">
          {loading ? (
            <div className="flex justify-center py-6"><Loader2 className="w-6 h-6 text-cyan-400 animate-spin" /></div>
          ) : f ? (
            <>
              <div className="space-y-2">
                {stages.map(s => (
                  <div key={s.label} className="flex items-center gap-3">
                    <div className="w-40 text-xs text-gray-400">{s.label}</div>
                    <div className="flex-1 h-6 bg-white/[0.04] rounded-lg overflow-hidden">
                      <div className={`h-full ${s.color} transition-all`} style={{ width: `${Math.max(s.pct, s.value > 0 ? 4 : 0)}%` }} />
                    </div>
                    <div className="w-24 text-right text-xs font-bold text-white">{s.value} <span className="text-gray-500 font-normal">({s.pct}%)</span></div>
                  </div>
                ))}
              </div>
              {Object.keys(data.by_action || {}).length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {Object.entries(data.by_action).map(([k, v]: [string, any]) => (
                    <span key={k} className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/25">
                      {ACTION_NAMES[k] || k}: {v}
                    </span>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap gap-4">
                <MiniTable title="Por condado" rows={data.by_county} names={COUNTY_NAMES} />
                <MiniTable title="Por tipo de señal" rows={data.by_signal} names={SIGNAL_NAMES} />
              </div>
              <p className="text-[10px] text-gray-600">Entregadas = estimado según la fecha de entrega esperada de Lob/USPS · Escaneos = visitas a la página de oferta personalizada del QR</p>
            </>
          ) : (
            <div className="text-xs text-gray-500 py-4 text-center">Aún no has enviado cartas — el embudo aparecerá con tu primera campaña</div>
          )}
        </div>
      )}
    </div>
  );
}

function LeadDrawer({ lead, onClose, onPatch, headers, setToast, onLeadUpdate, lobConfigured, lobMode }: {
  lead: Lead;
  onClose: () => void;
  onPatch: (id: string, body: { status?: string; notes?: string }) => Promise<void>;
  headers: () => Record<string, string>;
  setToast: (t: { msg: string; ok: boolean }) => void;
  onLeadUpdate: (lead: Lead) => void;
  lobConfigured: boolean;
  lobMode: string | null;
}) {
  const [analyzing, setAnalyzing] = useState(false);
  const [writing, setWriting] = useState(false);
  const [counterAnalyzing, setCounterAnalyzing] = useState(false);

  const analyzeCounter = async () => {
    setCounterAnalyzing(true);
    try {
      const r = await fetch(`/api/admin/deal-finder/leads/${lead.id}/analyze-counter`, {
        method: 'POST', headers: headers(),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.analysis && lead.offer?.response) {
        onLeadUpdate({ ...lead, offer: { ...lead.offer, response: { ...lead.offer.response, ai_analysis: d.analysis } } });
        setToast({ msg: '🤖 Análisis de negociación listo', ok: true });
      } else setToast({ msg: d.detail || 'No se pudo analizar', ok: false });
    } catch { setToast({ msg: 'Error de conexión', ok: false }); }
    setCounterAnalyzing(false);
  };
  const [notes, setNotes] = useState(lead.notes || '');
  const [letterLang, setLetterLang] = useState<'en' | 'es'>('en');
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [mailing, setMailing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);

  const previewPdf = async () => {
    setPreviewing(true);
    try {
      const r = await fetch(`/api/admin/deal-finder/leads/${lead.id}/letter.pdf?lang=${letterLang}`, { headers: headers() });
      if (!r.ok) { setToast({ msg: 'No se pudo generar el PDF', ok: false }); setPreviewing(false); return; }
      const blob = await r.blob();
      setPreviewUrl(URL.createObjectURL(blob));
    } catch { setToast({ msg: 'Error de conexión', ok: false }); }
    setPreviewing(false);
  };

  const closePreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
  };

  const downloadPdf = async () => {
    setDownloading(true);
    try {
      const r = await fetch(`/api/admin/deal-finder/leads/${lead.id}/letter.pdf?lang=${letterLang}`, { headers: headers() });
      if (!r.ok) { setToast({ msg: 'No se pudo generar el PDF', ok: false }); setDownloading(false); return; }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `carta_${(lead.address || lead.property_id).split(',')[0].replace(/\s+/g, '_')}_${letterLang}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch { setToast({ msg: 'Error de conexión', ok: false }); }
    setDownloading(false);
  };

  const [tracking, setTracking] = useState(false);
  const [trackInfo, setTrackInfo] = useState<any>(null);

  const trackMail = async () => {
    setTracking(true);
    try {
      const r = await fetch(`/api/admin/deal-finder/leads/${lead.id}/mail-status`, { headers: headers() });
      const d = await r.json().catch(() => ({}));
      if (r.ok) setTrackInfo(d);
      else setToast({ msg: d.detail || 'No se pudo rastrear', ok: false });
    } catch { setToast({ msg: 'Error de conexión', ok: false }); }
    setTracking(false);
  };

  const mailViaLob = async () => {
    if (!lobConfigured) {
      setToast({ msg: 'Configura Lob primero (agrega tu API key) para enviar cartas físicas', ok: false });
      return;
    }
    if (!window.confirm(lobMode === 'live'
      ? '¿Enviar esta carta físicamente por correo (USPS)? Se imprimirá y despachará — esto tiene costo.'
      : 'Modo PRUEBA de Lob: se simulará el envío sin imprimir ni cobrar. ¿Continuar?')) return;
    setMailing(true);
    try {
      const r = await fetch(`/api/admin/deal-finder/leads/${lead.id}/mail`, { method: 'POST', headers: headers() });
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        onLeadUpdate({ ...lead, mail: d.mail, status: 'offer_sent' });
        setToast({ msg: d.mail?.mode === 'live' ? '📮 Carta enviada por correo — en camino' : '✅ Envío de prueba OK (Lob test)', ok: true });
      } else {
        setToast({ msg: d.detail || 'Lob rechazó el envío', ok: false });
      }
    } catch { setToast({ msg: 'Error de conexión', ok: false }); }
    setMailing(false);
  };

  const runAI = async (kind: 'analyze' | 'letter') => {
    const setBusy = kind === 'analyze' ? setAnalyzing : setWriting;
    setBusy(true);
    try {
      const r = await fetch(`/api/admin/deal-finder/leads/${lead.id}/${kind === 'analyze' ? 'analyze' : 'letter'}`, {
        method: 'POST', headers: headers(),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        const updated: Lead = kind === 'analyze'
          ? { ...lead, ai_score: d.ai_score, ai_analysis: d.ai_analysis }
          : { ...lead, offer_letter: d.offer_letter };
        onLeadUpdate(updated);
        setToast({ msg: kind === 'analyze' ? `Análisis AI listo — score ${d.ai_score}/100` : 'Carta de oferta generada ✉️', ok: true });
      } else {
        setToast({ msg: d.detail || 'Error con la AI — reintenta', ok: false });
      }
    } catch { setToast({ msg: 'Error de conexión', ok: false }); }
    setBusy(false);
  };

  const copyLetter = async () => {
    const text = letterLang === 'en' ? lead.offer_letter?.letter_en : lead.offer_letter?.letter_es;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* noop */ }
  };

  const impValues = Object.entries(lead.values || {});

  // ── Oferta personalizada (PURL + QR) ──
  const [offerMode, setOfferMode] = useState<'amount' | 'ask'>(lead.offer?.mode === 'ask' ? 'ask' : 'amount');
  const [offerAmount, setOfferAmount] = useState(lead.offer?.amount ? String(lead.offer.amount) : '');
  const [sugBusy, setSugBusy] = useState(false);
  const [offerBusy, setOfferBusy] = useState(false);
  const [reasoning, setReasoning] = useState('');

  const suggestPrice = async () => {
    setSugBusy(true);
    try {
      const r = await fetch(`/api/admin/deal-finder/leads/${lead.id}/suggest-price`, { method: 'POST', headers: headers() });
      const d = await r.json();
      if (r.ok && d.success) {
        setOfferAmount(String(d.suggested_price));
        setReasoning(`${d.reasoning} (${d.pct_of_value}% del valor tasado)`);
      } else setToast({ msg: d.detail || 'La AI no pudo sugerir precio', ok: false });
    } catch { setToast({ msg: 'Error de conexión', ok: false }); }
    setSugBusy(false);
  };

  const createOffer = async () => {
    if (offerMode === 'amount' && !(Number(offerAmount) > 0)) {
      setToast({ msg: 'Indica el monto (o usa Sugerir precio AI)', ok: false }); return;
    }
    setOfferBusy(true);
    try {
      const r = await fetch(`/api/admin/deal-finder/leads/${lead.id}/offer`, {
        method: 'POST', headers: { ...headers(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: offerMode, amount: Number(offerAmount) || 0 }),
      });
      const d = await r.json();
      if (r.ok && d.success) {
        onLeadUpdate({ ...lead, offer: d.offer });
        setToast({ msg: '🔗 Link + QR creados — se incluirán en la carta automáticamente', ok: true });
      } else setToast({ msg: d.detail || 'Error creando la oferta', ok: false });
    } catch { setToast({ msg: 'Error de conexión', ok: false }); }
    setOfferBusy(false);
  };

  const offerUrl = lead.offer?.slug ? `https://www.rosshouserentals.com/oferta/${lead.offer.slug}` : '';
  const RESP_LABEL: Record<string, string> = {
    accept: '✅ ACEPTÓ la oferta', counter: '💬 Contraoferta', call: '📞 Pide llamada', reject: '❌ No le interesa',
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-xl h-full bg-[#0d1017] border-l border-white/[0.08] overflow-y-auto p-5 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-lg font-bold text-white">{lead.address || `Cuenta #${lead.property_id}`}</div>
            <div className="text-xs text-gray-500 mt-0.5">{lead.county_name} · Cuenta #{lead.property_id} · Tipo {lead.property_type || '—'}</div>
            {lead.address && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                <a href={mapsUrl(lead.address)} target="_blank" rel="noopener noreferrer"
                  className="text-[11px] px-2.5 py-1 rounded-full border border-sky-500/30 bg-sky-500/10 text-sky-300 font-bold hover:bg-sky-500/20 transition">🗺️ Google Maps</a>
                <a href={zillowUrl(lead.address)} target="_blank" rel="noopener noreferrer"
                  className="text-[11px] px-2.5 py-1 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-300 font-bold hover:bg-blue-500/20 transition">🏠 Zillow</a>
                <a href={realtorUrl(lead.address)} target="_blank" rel="noopener noreferrer"
                  className="text-[11px] px-2.5 py-1 rounded-full border border-red-500/30 bg-red-500/10 text-red-300 font-bold hover:bg-red-500/20 transition">🔴 Realtor.com</a>
              </div>
            )}
          </div>
          <button onClick={onClose} className="p-2 rounded-xl bg-white/[0.04] text-gray-400 hover:text-white transition" data-testid="drawer-close">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Signals */}
        <div className="flex flex-wrap gap-1.5">
          {lead.signals.map(s => SIGNAL_LABELS[s] && (
            <span key={s} className={`text-[11px] px-2.5 py-1 rounded-full border font-medium ${SIGNAL_LABELS[s].cls}`}>
              {SIGNAL_LABELS[s].label}
            </span>
          ))}
          {lead.signals.length === 0 && <span className="text-xs text-gray-600">Sin señales especiales</span>}
        </div>

        {/* Owner + mailing */}
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 space-y-2">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
            <User className="w-3.5 h-3.5" /> Dueño registrado
          </div>
          <div className="text-sm font-bold text-white">{lead.owner_name}</div>
          {lead.mailing_lines.length > 0 && (
            <div className="text-xs text-gray-400">
              <div className="text-[10px] text-gray-600 uppercase mb-1">📮 Dirección postal (para enviar carta):</div>
              {lead.mailing_lines.map((ln, i) => <div key={i}>{ln}</div>)}
            </div>
          )}
        </div>

        {/* Oferta personalizada: QR + link */}
        <div className="bg-white/[0.03] border border-emerald-500/20 rounded-2xl p-4 space-y-3">
          <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider">💵 Oferta personalizada (QR + link en la carta)</div>

          {lead.offer?.response && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 text-sm">
              <div className="font-bold text-emerald-300">{RESP_LABEL[lead.offer.response.action] || lead.offer.response.action}</div>
              {lead.offer.response.price > 0 && <div className="text-white font-bold text-lg">Su precio: {fmt(lead.offer.response.price)}</div>}
              {lead.offer.response.phone && <div className="text-gray-300 text-xs mt-1">📞 {lead.offer.response.phone} {lead.offer.response.best_time && `· ${lead.offer.response.best_time}`}</div>}
              {lead.offer.response.message && <div className="text-gray-400 text-xs mt-1 italic">&ldquo;{lead.offer.response.message}&rdquo;</div>}
              <div className="text-[10px] text-gray-500 mt-1">{new Date(lead.offer.response.at).toLocaleString('es-US')}</div>
            </div>
          )}

          {/* 🤖 Análisis de negociación IA (contraofertas) */}
          {lead.offer?.response?.ai_analysis && (() => {
            const a = lead.offer!.response!.ai_analysis!;
            const REC: Record<string, { label: string; cls: string }> = {
              accept: { label: '✅ ACEPTAR', cls: 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10' },
              counter: { label: '🔁 CONTRAOFERTAR', cls: 'text-amber-400 border-amber-500/40 bg-amber-500/10' },
              reject: { label: '❌ RECHAZAR / PASAR', cls: 'text-red-400 border-red-500/40 bg-red-500/10' },
            };
            const rec = REC[a.recommendation] || { label: a.recommendation, cls: 'text-indigo-400 border-indigo-500/40 bg-indigo-500/10' };
            return (
              <div className={`border rounded-xl p-3 space-y-2 ${rec.cls.split(' ').slice(1).join(' ')}`}>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className={`text-xs font-black ${rec.cls.split(' ')[0]}`}>🤖 Recomendación IA: {rec.label}</div>
                  {a.deal_score !== undefined && <span className="text-[10px] font-bold text-gray-400">Deal score: {a.deal_score}/10</span>}
                </div>
                <div className="flex gap-3 flex-wrap text-xs">
                  {a.suggested_counter ? <span className="font-bold text-white">Sugerida: {fmt(a.suggested_counter)}</span> : null}
                  {a.max_price ? <span className="text-gray-300">Máximo: {fmt(a.max_price)}</span> : null}
                </div>
                {a.reasoning && <p className="text-xs text-gray-300 leading-relaxed">{a.reasoning}</p>}
                {(a.leverage_points || []).length > 0 && (
                  <ul className="text-[11px] text-gray-400 space-y-0.5 list-disc ml-4">
                    {a.leverage_points!.slice(0, 4).map((p, i) => <li key={i}>{p}</li>)}
                  </ul>
                )}
                {a.email_script && (
                  <div className="text-[11px] text-gray-300 bg-black/30 border border-white/[0.08] rounded-lg px-2.5 py-2 italic">
                    ✉️ &ldquo;{a.email_script}&rdquo;
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-[9px] text-gray-600">Claude · {a.generated_at ? new Date(a.generated_at).toLocaleString('es-US') : ''}</span>
                  <button onClick={analyzeCounter} disabled={counterAnalyzing}
                    className="text-[10px] font-bold text-gray-400 hover:text-white transition disabled:opacity-50">
                    {counterAnalyzing ? 'Analizando…' : '↻ Re-analizar'}
                  </button>
                </div>
              </div>
            );
          })()}
          {lead.offer?.response?.action === 'counter' && (lead.offer.response.price || 0) > 0 && !lead.offer.response.ai_analysis && (
            <button onClick={analyzeCounter} disabled={counterAnalyzing}
              className="w-full py-2 rounded-xl text-xs font-bold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500/25 transition disabled:opacity-50 flex items-center justify-center gap-1.5">
              {counterAnalyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              {counterAnalyzing ? 'Analizando contraoferta…' : 'Analizar contraoferta con IA'}
            </button>
          )}

          <div className="flex gap-2">
            <button onClick={() => setOfferMode('amount')}
              className={`flex-1 px-3 py-2 rounded-xl text-xs font-bold border transition ${offerMode === 'amount' ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40' : 'text-gray-500 border-white/[0.08]'}`}>
              💰 Con monto de oferta
            </button>
            <button onClick={() => setOfferMode('ask')}
              className={`flex-1 px-3 py-2 rounded-xl text-xs font-bold border transition ${offerMode === 'ask' ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40' : 'text-gray-500 border-white/[0.08]'}`}>
              💬 Pedir su precio
            </button>
          </div>

          {offerMode === 'amount' && (
            <div className="space-y-2">
              <div className="flex gap-2">
                <div className="flex items-center gap-1 flex-1 bg-black/30 border border-white/[0.08] rounded-xl px-3">
                  <span className="text-gray-500 font-bold">$</span>
                  <input value={offerAmount} onChange={e => setOfferAmount(e.target.value.replace(/[^\d]/g, ''))}
                    placeholder="Monto de la oferta" inputMode="numeric"
                    className="flex-1 bg-transparent py-2 text-sm text-white font-bold focus:outline-none" />
                </div>
                <button onClick={suggestPrice} disabled={sugBusy}
                  className="px-3 py-2 rounded-xl text-xs font-bold bg-violet-500/15 text-violet-300 border border-violet-500/30 hover:bg-violet-500/25 disabled:opacity-50 transition">
                  {sugBusy ? '🤖 Calculando…' : '🤖 Sugerir precio AI'}
                </button>
              </div>
              {reasoning && <p className="text-[11px] text-violet-300/80 bg-violet-500/5 border border-violet-500/15 rounded-lg p-2">{reasoning}</p>}
            </div>
          )}

          <button onClick={createOffer} disabled={offerBusy}
            className="w-full py-2.5 rounded-xl text-sm font-bold bg-gradient-to-r from-emerald-600 to-teal-600 text-white disabled:opacity-50 transition">
            {offerBusy ? 'Guardando…' : lead.offer?.slug ? '🔄 Actualizar oferta y link' : '🔗 Crear link único + QR'}
          </button>

          {offerUrl && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <code className="flex-1 text-[11px] text-emerald-300 bg-black/30 border border-white/[0.06] rounded-lg px-2.5 py-1.5 truncate">{offerUrl.replace('https://www.', '')}</code>
                <button onClick={() => { navigator.clipboard.writeText(offerUrl); setToast({ msg: 'Link copiado 📋', ok: true }); }}
                  className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold border border-white/[0.08] text-gray-400 hover:bg-white/[0.04]">Copiar</button>
                <a href={offerUrl} target="_blank" rel="noopener noreferrer"
                  className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10">Abrir</a>
              </div>
              <div className="text-[10px] text-gray-500">
                👀 Visitas: <b className="text-gray-300">{lead.offer?.visits || 0}</b>
                {lead.offer?.last_visit_at && ` · última: ${new Date(lead.offer.last_visit_at).toLocaleString('es-US')}`}
                {' '}· El QR sale automáticamente en el PDF y en la carta Lob
              </div>
            </div>
          )}
        </div>

        {/* Values + taxes */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4">
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Landmark className="w-3.5 h-3.5" /> Valores del condado
            </div>
            <div className="text-lg font-bold text-white">{fmt(lead.appraised_value)}</div>
            <div className="text-[10px] text-gray-500">Valor tasado</div>
            {impValues.length > 0 && (
              <div className="mt-2 space-y-0.5">
                {impValues.map(([k, v]) => (
                  <div key={k} className="flex justify-between text-[11px]">
                    <span className="text-gray-500">{k}</span>
                    <span className="text-gray-300">{fmt(v)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className={`rounded-2xl p-4 border ${lead.tax_due_total > 0 ? 'bg-red-500/10 border-red-500/25' : 'bg-emerald-500/10 border-emerald-500/25'}`}>
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" /> Impuestos
            </div>
            {lead.tax_due_total > 0 ? (
              <>
                <div className="text-lg font-bold text-red-300">{fmt(lead.tax_due_total)}</div>
                <div className="text-[10px] text-gray-400">Deuda con el condado{lead.tax_years_due.length > 0 && ` · años ${lead.tax_years_due.join(', ')}`}</div>
                <div className="text-[10px] text-red-300/70 mt-1.5">💡 Dueño motivado — candidato fuerte para oferta directa</div>
              </>
            ) : (
              <div className="text-sm font-bold text-emerald-300">Al día ✅</div>
            )}
          </div>
        </div>

        {lead.legal_description && (
          <div className="text-[11px] text-gray-500 bg-white/[0.02] border border-white/[0.05] rounded-xl p-3">
            <b className="text-gray-400">Descripción legal:</b> {lead.legal_description}
          </div>
        )}

        {/* AI analysis */}
        <div className="bg-white/[0.03] border border-violet-500/20 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-bold text-violet-300 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" /> Análisis AI
            </div>
            <button onClick={() => runAI('analyze')} disabled={analyzing} data-testid="ai-analyze-btn"
              className="px-3 py-1.5 bg-violet-500/15 text-violet-300 border border-violet-500/30 rounded-lg text-[11px] font-bold hover:bg-violet-500/25 transition flex items-center gap-1.5 disabled:opacity-50">
              {analyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              {analyzing ? 'Analizando...' : lead.ai_analysis ? 'Re-analizar' : 'Analizar con AI'}
            </button>
          </div>
          {lead.ai_analysis ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className={`text-sm px-3 py-1 rounded-full font-bold border ${
                  (lead.ai_score || 0) >= 70 ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                  : (lead.ai_score || 0) >= 40 ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                  : 'bg-gray-500/15 text-gray-400 border-gray-500/30'}`}>
                  ⚡ {lead.ai_score}/100
                </span>
                {lead.ai_analysis.oferta_sugerida_pct != null && (
                  <span className="text-[11px] text-gray-400">Oferta sugerida: <b className="text-white">{lead.ai_analysis.oferta_sugerida_pct}%</b> del valor ≈ <b className="text-orange-300">{fmt(lead.appraised_value * (lead.ai_analysis.oferta_sugerida_pct / 100))}</b></span>
                )}
              </div>
              <div className="text-sm text-gray-200 font-medium">{lead.ai_analysis.veredicto}</div>
              <ul className="space-y-1">
                {lead.ai_analysis.razones?.map((r, i) => (
                  <li key={i} className="text-xs text-gray-400 flex gap-1.5"><span className="text-violet-400">•</span>{r}</li>
                ))}
              </ul>
              {lead.ai_analysis.estrategia && (
                <div className="text-xs text-violet-200/80 bg-violet-500/10 border border-violet-500/20 rounded-xl p-2.5">
                  🎯 {lead.ai_analysis.estrategia}
                </div>
              )}
            </div>
          ) : (
            <div className="text-xs text-gray-600">Pide a Claude que evalúe esta oportunidad: score 0-100, razones y estrategia de compra.</div>
          )}
        </div>

        {/* Offer letter */}
        <div className="bg-white/[0.03] border border-cyan-500/20 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5" /> Carta de oferta
            </div>
            <button onClick={() => runAI('letter')} disabled={writing} data-testid="ai-letter-btn"
              className="px-3 py-1.5 bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 rounded-lg text-[11px] font-bold hover:bg-cyan-500/25 transition flex items-center gap-1.5 disabled:opacity-50">
              {writing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
              {writing ? 'Escribiendo...' : lead.offer_letter ? 'Regenerar' : 'Generar carta'}
            </button>
          </div>
          {lead.offer_letter ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex rounded-lg overflow-hidden border border-white/[0.08]">
                  {(['en', 'es'] as const).map(lng => (
                    <button key={lng} onClick={() => setLetterLang(lng)}
                      className={`px-3 py-1 text-[11px] font-bold transition ${letterLang === lng ? 'bg-cyan-500/25 text-cyan-200' : 'bg-white/[0.03] text-gray-500 hover:text-white'}`}>
                      {lng === 'en' ? 'English' : 'Español'}
                    </button>
                  ))}
                </div>
                <button onClick={copyLetter}
                  className="px-3 py-1 text-[11px] font-bold bg-white/[0.04] text-gray-300 border border-white/[0.08] rounded-lg hover:text-white transition flex items-center gap-1">
                  {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  {copied ? 'Copiada' : 'Copiar'}
                </button>
              </div>
              <pre className="text-xs text-gray-300 whitespace-pre-wrap font-sans bg-black/30 border border-white/[0.06] rounded-xl p-3 max-h-64 overflow-y-auto">
                {letterLang === 'en' ? lead.offer_letter.letter_en : lead.offer_letter.letter_es}
              </pre>

              {/* Acciones: vista previa + descargar PDF + enviar por correo */}
              <div className="flex flex-wrap gap-2 pt-1">
                <button onClick={previewPdf} disabled={previewing} data-testid="preview-pdf-btn"
                  className="px-3 py-2 bg-violet-500/15 text-violet-300 border border-violet-500/30 rounded-lg text-[11px] font-bold hover:bg-violet-500/25 transition flex items-center gap-1.5 disabled:opacity-50">
                  {previewing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />}
                  Vista previa
                </button>
                <button onClick={downloadPdf} disabled={downloading} data-testid="download-pdf-btn"
                  className="px-3 py-2 bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 rounded-lg text-[11px] font-bold hover:bg-cyan-500/25 transition flex items-center gap-1.5 disabled:opacity-50">
                  {downloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                  Descargar PDF (imprimir)
                </button>
                <button onClick={mailViaLob} disabled={mailing || !!lead.mail} data-testid="mail-lob-btn"
                  className={`px-3 py-2 rounded-lg text-[11px] font-bold border transition flex items-center gap-1.5 disabled:opacity-50 ${
                    lead.mail ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                    : lobConfigured ? 'bg-orange-500/15 text-orange-300 border-orange-500/30 hover:bg-orange-500/25'
                    : 'bg-white/[0.04] text-gray-500 border-white/[0.08]'}`}>
                  {mailing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  {lead.mail ? 'Enviada ✓' : `Enviar por correo${lobMode === 'test' ? ' (prueba)' : ''}`}
                </button>
              </div>

              {lead.mail ? (
                <div className="text-[11px] text-emerald-300/90 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2 space-y-1.5">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span>
                      📮 {lead.mail.mode === 'live' ? 'Carta despachada por USPS vía Lob' : 'Envío de prueba (Lob test — no se imprimió)'}
                      {lead.mail.expected_delivery && ` · entrega estimada ${lead.mail.expected_delivery}`}
                    </span>
                    {lead.mail.mode === 'live' && (
                      <button onClick={trackMail} disabled={tracking} data-testid="track-mail-btn"
                        className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-emerald-500/20 border border-emerald-500/40 hover:bg-emerald-500/30 transition flex items-center gap-1 disabled:opacity-50">
                        {tracking ? <Loader2 className="w-3 h-3 animate-spin" /> : '📍'} Rastrear
                      </button>
                    )}
                  </div>
                  {trackInfo && (
                    <div className="border-t border-emerald-500/20 pt-1.5 space-y-1">
                      {trackInfo.events.length === 0 ? (
                        <div className="text-gray-400">{trackInfo.note || 'USPS aún no reporta eventos de rastreo'}</div>
                      ) : trackInfo.events.map((ev: any, i: number) => (
                        <div key={i} className="flex items-center gap-2 text-[10.5px]">
                          <span>{ev.label}</span>
                          <span className="text-gray-500">{ev.time ? new Date(ev.time).toLocaleString('es-MX') : ''} {ev.location ? `· ${ev.location}` : ''}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : lobConfigured ? (
                <div className="text-[10px] text-gray-600">Lob {lobMode === 'live' ? '(producción)' : '(modo prueba)'}: imprime, ensobra y despacha la carta por ti a la dirección postal del dueño.</div>
              ) : (
                <div className="text-[10px] text-gray-600">💡 Descarga el PDF para imprimir y enviar tú mismo, o configura Lob para envío automático (imprime + ensobra + despacha).</div>
              )}
            </div>
          ) : (
            <div className="text-xs text-gray-600">Genera una carta profesional (inglés + español) para enviar por correo al dueño ofreciendo comprar la propiedad.</div>
          )}
        </div>

        {/* Contrato de compra (cash) */}
        <ContractSection
          leadId={lead.id}
          ownerName={lead.owner_name}
          address={lead.address}
          suggestedPrice={lead.offer?.response?.price || lead.offer?.amount || 0}
          contract={lead.contract || null}
          headers={headers}
          setToast={setToast}
          onGenerated={(c) => onLeadUpdate({ ...lead, contract: c })}
        />

        {/* Pipeline status */}
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 space-y-3">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Seguimiento</div>
          <div className="flex flex-wrap gap-1.5">
            {STATUS_OPTIONS.map(s => (
              <button key={s.value} onClick={() => onPatch(lead.id, { status: s.value })}
                className={`text-[11px] px-3 py-1.5 rounded-full border font-medium transition ${lead.status === s.value ? s.cls : 'bg-white/[0.03] text-gray-500 border-white/[0.08] hover:text-white'}`}>
                {s.label}
              </button>
            ))}
          </div>
          <textarea value={notes} onChange={e => setNotes(e.target.value)}
            onBlur={() => notes !== lead.notes && onPatch(lead.id, { notes })}
            placeholder="Notas: llamé al dueño, dejé carta, contestó..."
            rows={3}
            className="w-full bg-black/30 border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-orange-500/40 resize-none" />
        </div>

        {/* Portal link */}
        <a href={lead.portal_url} target="_blank" rel="noreferrer"
          className="flex items-center justify-center gap-2 text-xs px-4 py-2.5 rounded-xl font-medium bg-white/[0.04] text-gray-300 border border-white/[0.08] hover:text-white transition">
          <ExternalLink className="w-3.5 h-3.5" /> Ver ficha completa en el portal del condado
        </a>
      </div>

      {/* Modal de vista previa del PDF */}
      {previewUrl && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={closePreview} />
          <div className="relative w-full max-w-3xl h-[88vh] bg-[#0d1017] border border-white/[0.1] rounded-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.08]">
              <div className="text-sm font-bold text-white flex items-center gap-2">
                👁️ Vista previa de la carta <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 uppercase">{letterLang}</span>
              </div>
              <div className="flex items-center gap-2">
                <a href={previewUrl} target="_blank" rel="noreferrer"
                  className="px-3 py-1.5 rounded-lg text-[11px] font-bold border border-white/[0.1] text-gray-300 hover:text-white transition">Abrir en pestaña</a>
                <button onClick={downloadPdf} disabled={downloading}
                  className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/25 transition disabled:opacity-50">
                  {downloading ? 'Descargando…' : 'Descargar'}
                </button>
                <button onClick={closePreview} data-testid="preview-close"
                  className="p-1.5 rounded-lg bg-white/[0.05] text-gray-400 hover:text-white transition"><X className="w-4 h-4" /></button>
              </div>
            </div>
            <iframe src={previewUrl} title="Vista previa de la carta" className="flex-1 w-full bg-white" />
            <div className="px-4 py-2 text-[10px] text-gray-500 border-t border-white/[0.08]">
              Así se verá la carta impresa (con foto aérea y QR si están disponibles) — revísala antes de enviar por Lob.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
