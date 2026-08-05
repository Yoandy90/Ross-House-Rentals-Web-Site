'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAdminAuth } from '../layout';
import {
  Globe, Users, Activity, Eye, Loader2, RefreshCw,
  TrendingUp, TrendingDown, MapPin, Clock, BarChart3, Zap, Wifi,
  Monitor, Smartphone, Tablet, MousePointer, Flame, Download, List, Filter,
  Radio, LayoutGrid, Map as MapIcon,
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip,
  CartesianGrid, PieChart, Pie, Cell,
} from 'recharts';
import WorldMap from '../../components/admin/WorldMap';
import HourlyHeatmap from '../../components/admin/HourlyHeatmap';
import SessionsDrawer from '../../components/admin/SessionsDrawer';
import AnalyticsInsightsHero from '../../components/admin/AnalyticsInsightsHero';
import TopMoversWidget from '../../components/admin/TopMoversWidget';

// ─── Helpers ───────────────────────────────────────────────────────────────
function flagEmoji(cc?: string | null): string {
  if (!cc || cc.length !== 2) return '🌐';
  const base = 0x1f1e6;
  return String.fromCodePoint(
    base + (cc.toUpperCase().charCodeAt(0) - 65),
    base + (cc.toUpperCase().charCodeAt(1) - 65),
  );
}

const fmt = (n: number | null | undefined): string => {
  if (n == null) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
};

const secFmt = (s: number): string => {
  if (!s) return '0s';
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rs = s % 60;
  return `${m}m ${rs}s`;
};

// ─── Animated counter ─────────────────────────────────────────────────────
function useCountUp(value: number, duration = 900): number {
  const [n, setN] = useState(0);
  const prev = useRef(0);
  useEffect(() => {
    const from = prev.current;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setN(Math.round(from + (value - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    prev.current = value;
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return n;
}

const RANGES = [
  { key: '24h', label: '24h',   long: 'Últimas 24h' },
  { key: '7d',  label: '7d',    long: 'Últimos 7 días' },
  { key: '30d', label: '30d',   long: 'Últimos 30 días' },
  { key: '90d', label: '90d',   long: 'Últimos 90 días' },
];

const DEVICE_ICONS: Record<string, React.ReactNode> = {
  Desktop: <Monitor className="w-3.5 h-3.5" />,
  Mobile:  <Smartphone className="w-3.5 h-3.5" />,
  Tablet:  <Tablet className="w-3.5 h-3.5" />,
};

const COLOR_DEVICES: Record<string, string> = {
  Desktop: '#818cf8', Mobile: '#fbbf24', Tablet: '#34d399', Unknown: '#94a3b8',
};

const JUMP_SECTIONS: { id: string; label: string; Icon: any }[] = [
  { id: 'live',     label: 'Live',     Icon: Radio },
  { id: 'kpis',     label: 'Métricas', Icon: BarChart3 },
  { id: 'timeline', label: 'Tráfico',  Icon: TrendingUp },
  { id: 'map',      label: 'Mapa',     Icon: Globe },
  { id: 'sessions', label: 'Sesiones', Icon: List },
];

interface LiveSession {
  session_id: string;
  country?: string | null;
  country_code?: string | null;
  city?: string | null;
  device?: string | null;
  browser?: string | null;
  current_path?: string | null;
  pages_count?: number;
  last_seen?: string;
  referrer_host?: string | null;
  lead_id?: string | null;
}

// ═════════════════════════════════════════════════════════════════════════
export default function AnalyticsPage() {
  const { token } = useAdminAuth();
  const [range, setRange] = useState('7d');
  const [loading, setLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [live, setLive] = useState<{ online_now: number; sessions: LiveSession[] } | null>(null);
  const [overview, setOverview] = useState<any>(null);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [topPages, setTopPages] = useState<any[]>([]);
  const [sources, setSources] = useState<{ referrers: any[]; utm_campaigns: any[] } | null>(null);
  const [geo, setGeo] = useState<{ countries: any[]; cities: any[] } | null>(null);
  const [devices, setDevices] = useState<{ devices: any[]; browsers: any[]; os: any[] } | null>(null);
  const [funnel, setFunnel] = useState<{ steps: { name: string; value: number }[] } | null>(null);
  const [heatmap, setHeatmap] = useState<{ matrix: number[][]; peak: number; labels_days: string[] } | null>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [sessionsTotal, setSessionsTotal] = useState(0);
  const [openSessionId, setOpenSessionId] = useState<string | null>(null);
  const [filterCountry, setFilterCountry] = useState<string>('');
  const [filterDevice, setFilterDevice] = useState<string>('');
  const [filterLead, setFilterLead] = useState<'' | 'true' | 'false'>('');
  const [exporting, setExporting] = useState(false);
  const [previousTl, setPreviousTl] = useState<any[]>([]);
  const [goals, setGoals] = useState<any[]>([]);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [mapView, setMapView] = useState<'map' | 'list'>('map');
  const [activeSection, setActiveSection] = useState('live');
  const [dataQuality, setDataQuality] = useState<{ real_sessions: number; bot_sessions_excluded: number; spam_referrer_sessions: number } | null>(null);

  const authHdr = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const loadAll = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    const r = range;
    const gran = r === '24h' ? 'hour' : 'day';
    const sessionsParams = new URLSearchParams({ range: r, limit: '25' });
    if (filterCountry) sessionsParams.set('country', filterCountry);
    if (filterDevice)  sessionsParams.set('device', filterDevice);
    if (filterLead)    sessionsParams.set('has_lead', filterLead);
    const f = filterCountry ? `&country=${filterCountry}` : '';
    const fd = filterDevice  ? `&device=${filterDevice}`  : '';

    // Resilient fetch: 8s timeout + never throws (returns null on error)
    const safeFetch = async (path: string): Promise<any | null> => {
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 8000);
        const res = await fetch(path, { headers: authHdr, signal: ctrl.signal });
        clearTimeout(timer);
        if (!res.ok) return null;
        return await res.json();
      } catch {
        return null;
      }
    };

    // ── FAST PATH: endpoint combinado (1 request, agregado + cacheado en el
    //    servidor). Si aún no está desplegado (404), cae al modo de 11 requests.
    const dashParams = new URLSearchParams({ range: r, granularity: gran, compare: '1', limit: '25' });
    if (filterCountry) dashParams.set('country', filterCountry);
    if (filterDevice)  dashParams.set('device', filterDevice);
    if (filterLead)    dashParams.set('has_lead', filterLead);
    const dash = await safeFetch(`/api/admin/analytics/dashboard?${dashParams}`);
    if (dash && dash.overview) {
      if (dash.live)      setLive(dash.live);
      setOverview(dash.overview);
      setTimeline(dash.timeline?.timeline || []);
      setPreviousTl(dash.timeline?.previous || []);
      setTopPages(dash.top_pages?.top_pages || []);
      if (dash.sources)   setSources(dash.sources);
      if (dash.geo)       setGeo(dash.geo);
      if (dash.devices)   setDevices(dash.devices);
      if (dash.funnel)    setFunnel(dash.funnel);
      if (dash.heatmap)   setHeatmap(dash.heatmap);
      if (dash.sessions)  { setSessions(dash.sessions.sessions || []); setSessionsTotal(dash.sessions.total || 0); }
      setGoals(dash.goals?.goals || []);
      setDataQuality(dash.data_quality || null);
      setLoading(false);
      setInitialLoad(false);
      return;
    }

    // Fire all 11 in parallel — each one independent (Promise.allSettled semantics)
    const [liveR, ovR, tlR, tpR, srcR, geoR, devR, fnR, hmR, sessR, glR] = await Promise.all([
      safeFetch('/api/admin/analytics/live'),
      safeFetch(`/api/admin/analytics/overview?range=${r}${f}${fd}`),
      safeFetch(`/api/admin/analytics/timeline?range=${r}&granularity=${gran}&compare=1${f}${fd}`),
      safeFetch(`/api/admin/analytics/top-pages?range=${r}&limit=10${f}${fd}`),
      safeFetch(`/api/admin/analytics/sources?range=${r}&limit=10`),
      safeFetch(`/api/admin/analytics/geo?range=${r}`),
      safeFetch(`/api/admin/analytics/devices?range=${r}`),
      safeFetch(`/api/admin/analytics/funnel?range=${r}${f}${fd}`),
      safeFetch(`/api/admin/analytics/heatmap?range=${r}${f}${fd}`),
      safeFetch(`/api/admin/analytics/sessions?${sessionsParams}`),
      safeFetch(`/api/admin/analytics/goals?range=${r}${f}${fd}`),
    ]);

    // Only update state for endpoints that succeeded (keep last-good otherwise)
    if (liveR)  setLive(liveR);
    if (ovR)    setOverview(ovR);
    if (tlR)    { setTimeline(tlR?.timeline || []); setPreviousTl(tlR?.previous || []); }
    if (tpR)    setTopPages(tpR?.top_pages || []);
    if (srcR)   setSources(srcR);
    if (geoR)   setGeo(geoR);
    if (devR)   setDevices(devR);
    if (fnR)    setFunnel(fnR);
    if (hmR)    setHeatmap(hmR);
    if (sessR)  { setSessions(sessR?.sessions || []); setSessionsTotal(sessR?.total || 0); }
    if (glR)    setGoals(glR?.goals || []);

    setLoading(false);
    setInitialLoad(false);
  }, [token, range, authHdr, filterCountry, filterDevice, filterLead]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Live counter polling (every 12s)
  useEffect(() => {
    if (!token) return;
    const id = setInterval(async () => {
      try {
        const r = await fetch('/api/admin/analytics/live', { headers: authHdr }).then(x => x.json());
        setLive(r);
      } catch (_) {
        // ignore polling errors
      }
    }, 12000);
    return () => clearInterval(id);
  }, [token, authHdr]);

  // Scroll-spy for section chips
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setActiveSection(e.target.id);
        });
      },
      { rootMargin: '-30% 0px -60% 0px', threshold: 0 }
    );
    JUMP_SECTIONS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, [initialLoad]);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      const y = el.getBoundingClientRect().top + window.pageYOffset - 120;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  const cur = overview?.current || {};
  const dl = overview?.deltas || {};
  const spark = (key: string) => timeline.map(t => ({ v: t[key] || 0 }));

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-16 relative overflow-x-hidden">
      {/* Mesh gradient background */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute -top-40 -left-40 w-[520px] h-[520px] rounded-full bg-violet-600/10 blur-[120px]" />
        <div className="absolute top-1/3 -right-40 w-[520px] h-[520px] rounded-full bg-cyan-600/10 blur-[120px]" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[320px] rounded-full bg-indigo-600/10 blur-[140px]" />
        <div className="absolute inset-0 opacity-[0.04]"
          style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '32px 32px' }} />
      </div>

      {/* ─── Header ──────────────────────────────────────────────────────── */}
      <div className="sticky top-14 z-20 backdrop-blur-2xl bg-slate-950/75 border-b border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-3 lg:px-6 py-2.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="relative shrink-0">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 via-indigo-500 to-blue-500 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                <Globe className="w-4 h-4 text-white" />
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-slate-950 animate-pulse" />
            </div>
            <div className="min-w-0 hidden sm:block">
              <h1 className="text-sm lg:text-base font-bold text-white leading-tight flex items-center gap-2">
                Visitor Intelligence
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300 font-bold border border-violet-500/30">BETA</span>
              </h1>
              <p className="text-[10px] text-slate-400 leading-tight">Analytics propias · 100% privacidad</p>
            </div>
            <div className="sm:hidden min-w-0">
              <h1 className="text-sm font-bold text-white leading-tight truncate">Analytics</h1>
              <p className="text-[10px] text-slate-400 leading-tight">Visitor Intelligence</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => setMobileFiltersOpen(true)}
              className="lg:hidden p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 relative transition"
              aria-label="Filtros"
            >
              <Filter className="w-4 h-4 text-slate-300" />
              {(filterCountry || filterDevice || filterLead) && (
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-rose-500 border border-slate-950" />
              )}
            </button>

            <div className="hidden lg:flex items-center gap-1.5">
              <select
                value={filterCountry}
                onChange={(e) => setFilterCountry(e.target.value)}
                className="text-[11px] border border-white/10 bg-white/5 text-slate-200 rounded-md px-2 py-1.5 font-medium hover:bg-white/10 transition"
                aria-label="Filtrar país"
              >
                <option value="" className="bg-slate-900">🌍 Todos los países</option>
                {(geo?.countries || []).map((c: any) => (
                  <option key={c.country_code} value={c.country_code} className="bg-slate-900">{c.country}</option>
                ))}
              </select>
              <select
                value={filterDevice}
                onChange={(e) => setFilterDevice(e.target.value)}
                className="text-[11px] border border-white/10 bg-white/5 text-slate-200 rounded-md px-2 py-1.5 font-medium hover:bg-white/10 transition"
                aria-label="Filtrar device"
              >
                <option value="" className="bg-slate-900">📱 Todo device</option>
                <option value="Desktop" className="bg-slate-900">Desktop</option>
                <option value="Mobile" className="bg-slate-900">Mobile</option>
                <option value="Tablet" className="bg-slate-900">Tablet</option>
              </select>
              {(filterCountry || filterDevice) && (
                <button
                  onClick={() => { setFilterCountry(''); setFilterDevice(''); }}
                  className="text-[10px] px-2 py-1 rounded-md bg-rose-500/15 text-rose-300 border border-rose-500/30 hover:bg-rose-500/25"
                >✕</button>
              )}
              <div className="w-px h-6 bg-white/10 mx-1" />
            </div>

            <div className="flex items-center bg-white/5 border border-white/10 rounded-lg p-0.5">
              {RANGES.map(r => (
                <button
                  key={r.key}
                  onClick={() => setRange(r.key)}
                  className={`px-2 lg:px-3 py-1 lg:py-1.5 rounded-md text-[11px] lg:text-xs font-semibold transition ${
                    range === r.key
                      ? 'bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/30'
                      : 'text-slate-400 hover:text-slate-100'
                  }`}
                >{r.label}</button>
              ))}
            </div>
            <button
              onClick={loadAll}
              disabled={loading}
              className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 disabled:opacity-50 transition"
              aria-label="Refrescar"
            >
              {loading
                ? <Loader2 className="w-4 h-4 animate-spin text-slate-300" />
                : <RefreshCw className="w-4 h-4 text-slate-300" />}
            </button>
          </div>
        </div>

        {/* Jump-nav chips (mobile + desktop) */}
        <div className="max-w-7xl mx-auto px-3 lg:px-6 pb-2 -mt-0.5">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {JUMP_SECTIONS.map(({ id, label, Icon }) => {
              const active = activeSection === id;
              return (
                <button
                  key={id}
                  onClick={() => scrollToSection(id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap transition shrink-0 ${
                    active
                      ? 'bg-white/10 text-white border border-white/20 shadow-inner'
                      : 'bg-transparent text-slate-400 border border-white/[0.06] hover:bg-white/5'
                  }`}
                >
                  <Icon className="w-3 h-3" />
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Mobile filter sheet */}
      {mobileFiltersOpen && (
        <MobileFilterSheet
          onClose={() => setMobileFiltersOpen(false)}
          filterCountry={filterCountry}
          setFilterCountry={setFilterCountry}
          filterDevice={filterDevice}
          setFilterDevice={setFilterDevice}
          filterLead={filterLead}
          setFilterLead={setFilterLead}
          countries={geo?.countries || []}
        />
      )}

      <div className="relative max-w-7xl mx-auto px-3 lg:px-6 pt-5 space-y-5">

        {/* ─── LIVE banner ───────────────────────────────────────────────── */}
        <section id="live" className="scroll-mt-32 animate-fadeIn" style={{ animationDelay: '0ms' }}>
          {initialLoad ? <SkeletonBlock height={140} /> : <LiveBanner live={live} />}
        </section>

        {/* ─── Data quality: solo datos reales, bots excluidos ───────────── */}
        {dataQuality && (
          <div className="flex flex-wrap items-center gap-2 -mt-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-[11px] font-semibold text-emerald-400">
              <Wifi className="w-3 h-3" />
              {dataQuality.real_sessions} sesiones reales
            </span>
            {dataQuality.bot_sessions_excluded > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/25 text-[11px] font-semibold text-amber-400">
                🤖 {dataQuality.bot_sessions_excluded} bots excluidos
                {dataQuality.spam_referrer_sessions > 0 && ` (${dataQuality.spam_referrer_sessions} spam)`}
              </span>
            )}
            <span className="text-[10px] text-slate-500">Bots y referrers de spam (polymeta, searchezee, simmani…) no cuentan en las métricas</span>
          </div>
        )}

        {/* ─── AI Spotlight ─────────────────────────────────────────────── */}
        <section id="ai" className="relative -mx-3 lg:-mx-0 px-3 lg:px-6 py-5 lg:py-6 bg-gradient-to-br from-slate-900/70 via-indigo-950/40 to-fuchsia-950/30 rounded-3xl border border-white/[0.06] overflow-hidden backdrop-blur-xl animate-fadeIn" style={{ animationDelay: '60ms' }}>
          <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-fuchsia-500/10 blur-[100px] pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-72 h-72 rounded-full bg-cyan-500/10 blur-[100px] pointer-events-none" />
          <div className="relative">
            <AnalyticsInsightsHero range={range} token={token} />
            <TopMoversWidget range={range} token={token} />
          </div>
        </section>

        {/* ─── KPI Grid ──────────────────────────────────────────────────── */}
        <section id="kpis" className="scroll-mt-32 animate-fadeIn" style={{ animationDelay: '120ms' }}>
          {initialLoad ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[0, 1, 2, 3].map(i => <SkeletonBlock key={i} height={116} />)}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <KpiCard icon={<Users className="w-4 h-4" />}    label="Visitantes"  value={cur.visitors ?? 0}  delta={dl.visitors} accent="cyan"    sparkData={spark('visitors')} />
                <KpiCard icon={<Activity className="w-4 h-4" />} label="Sesiones"    value={cur.sessions ?? 0}  delta={dl.sessions} accent="indigo"  sparkData={spark('sessions')} />
                <KpiCard icon={<Eye className="w-4 h-4" />}      label="Pageviews"   value={cur.pages ?? 0}     delta={dl.pages}    accent="violet"  sparkData={spark('pages')} />
                <KpiCard icon={<Zap className="w-4 h-4" />}      label="Leads"       value={cur.leads ?? 0}     delta={dl.leads}    accent="emerald" sparkData={spark('pages')} />
              </div>
              <div className="grid grid-cols-3 gap-3 mt-3">
                <MiniMetric icon={<MousePointer className="w-3.5 h-3.5" />} label="Bounce rate" value={`${cur.bounce_rate ?? 0}%`} hint="1-page sessions" tone={cur.bounce_rate > 70 ? 'warn' : 'ok'} />
                <MiniMetric icon={<Clock className="w-3.5 h-3.5" />}        label="Duración"    value={secFmt(cur.avg_duration_sec ?? 0)} hint="Prom. / sesión" />
                <MiniMetric icon={<Flame className="w-3.5 h-3.5" />}        label="Eventos"     value={fmt(cur.events)} hint="Chatbot · clicks" />
              </div>
            </>
          )}
        </section>

        {/* ─── Goals ─────────────────────────────────────────────────────── */}
        <section className="animate-fadeIn" style={{ animationDelay: '180ms' }}>
          <Card title="Objetivos del período" subtitle="Conversiones clave hacia las metas" icon={<Zap className="w-4 h-4" />}>
            {initialLoad ? <SkeletonBlock height={90} /> :
              goals.length === 0
                ? <EmptyState text="Aún no hay datos de objetivos." />
                : <GoalsGrid goals={goals} />}
          </Card>
        </section>

        {/* ─── Timeline chart ────────────────────────────────────────────── */}
        <section id="timeline" className="scroll-mt-32 animate-fadeIn" style={{ animationDelay: '220ms' }}>
          <Card
            title="Tráfico en el tiempo"
            subtitle={`Granularidad: ${range === '24h' ? 'por hora' : 'por día'} · ${RANGES.find(r => r.key === range)?.long}`}
            icon={<BarChart3 className="w-4 h-4" />}
          >
            {initialLoad ? <SkeletonBlock height={260} /> :
              timeline.length === 0 ? (
                <EmptyState text="Sin tráfico en este rango. ¡Promociona tu sitio para ver datos!" />
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart
                    data={(() => {
                      const max = Math.max(timeline.length, previousTl.length);
                      return Array.from({ length: max }, (_, i) => ({
                        ts: timeline[i]?.ts || previousTl[i]?.ts || '',
                        pages: timeline[i]?.pages ?? 0,
                        visitors: timeline[i]?.visitors ?? 0,
                        previous_pages: previousTl[i]?.pages ?? 0,
                      }));
                    })()}
                    margin={{ top: 10, right: 10, left: -15, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="grad-pages" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%"   stopColor="#818cf8" stopOpacity={0.5} />
                        <stop offset="100%" stopColor="#818cf8" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="grad-visitors" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%"   stopColor="#34d399" stopOpacity={0.45} />
                        <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                    <XAxis
                      dataKey="ts"
                      tickFormatter={(v) => {
                        const d = new Date(v);
                        return range === '24h'
                          ? `${d.getHours().toString().padStart(2, '0')}:00`
                          : `${d.getMonth() + 1}/${d.getDate()}`;
                      }}
                      tick={{ fontSize: 10, fill: '#94a3b8' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip
                      labelFormatter={(v) => new Date(v).toLocaleString('es-MX')}
                      contentStyle={{ borderRadius: 12, border: '1px solid #ffffff20', fontSize: 12, background: 'rgba(15,23,42,0.95)', color: '#f1f5f9', boxShadow: '0 12px 40px rgba(0,0,0,0.5)' }}
                    />
                    <Area type="monotone" dataKey="visitors"       name="Visitantes" stroke="#34d399" fill="url(#grad-visitors)" strokeWidth={2} />
                    <Area type="monotone" dataKey="pages"          name="Pageviews"  stroke="#818cf8" fill="url(#grad-pages)" strokeWidth={2} />
                    <Area type="monotone" dataKey="previous_pages" name="Período anterior" stroke="#64748b" strokeDasharray="6 4" fill="none" strokeWidth={1.5} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
          </Card>
        </section>

        {/* ─── Funnel + Devices + Browsers ───────────────────────────────── */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4 animate-fadeIn" style={{ animationDelay: '280ms' }}>
          <Card title="Embudo de conversión" subtitle="Visit → Property → Chatbot → Lead" icon={<TrendingUp className="w-4 h-4" />}>
            {initialLoad ? <SkeletonBlock height={180} /> :
              funnel?.steps ? <FunnelView steps={funnel.steps} /> : <EmptyState text="Sin datos." />}
          </Card>
          <Card title="Dispositivos" subtitle="Sesiones por tipo" icon={<Monitor className="w-4 h-4" />}>
            {initialLoad ? <SkeletonBlock height={180} /> :
              devices?.devices ? <DevicePie data={devices.devices} /> : <EmptyState text="Sin datos." />}
          </Card>
          <Card title="Navegadores · OS" subtitle="Top" icon={<Wifi className="w-4 h-4" />}>
            {initialLoad ? <SkeletonBlock height={180} /> : (
              <div className="space-y-3">
                <SimpleBars data={devices?.browsers || []} title="Navegadores" />
                <SimpleBars data={devices?.os || []} title="Sistemas" />
              </div>
            )}
          </Card>
        </section>

        {/* ─── Hourly Heatmap ─────────────────────────────────────────────── */}
        <section className="animate-fadeIn" style={{ animationDelay: '340ms' }}>
          <Card
            title="Horas de mayor tráfico"
            subtitle="Mapa de calor: día de la semana × hora del día"
            icon={<Flame className="w-4 h-4" />}
          >
            {initialLoad ? <SkeletonBlock height={220} /> :
              heatmap && heatmap.matrix
                ? <HourlyHeatmap matrix={heatmap.matrix} peak={heatmap.peak} labels_days={heatmap.labels_days} />
                : <EmptyState text="Aún sin datos suficientes para el heatmap." />}
          </Card>
        </section>

        {/* ─── Sessions list ─────────────────────────────────────────────── */}
        <section id="sessions" className="scroll-mt-32 animate-fadeIn" style={{ animationDelay: '400ms' }}>
          <Card
            title="Sesiones recientes"
            subtitle={`${sessionsTotal} sesiones · clic para ver el rastro completo`}
            icon={<List className="w-4 h-4" />}
            actions={
              <button
                onClick={async () => {
                  if (exporting) return;
                  setExporting(true);
                  try {
                    const params = new URLSearchParams({ range });
                    if (filterCountry) params.set('country', filterCountry);
                    if (filterDevice)  params.set('device', filterDevice);
                    if (filterLead)    params.set('has_lead', filterLead);
                    const r = await fetch(`/api/admin/analytics/sessions/export.csv?${params}`, { headers: authHdr });
                    const blob = await r.blob();
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url; a.download = `visitor_sessions_${range}.csv`;
                    document.body.appendChild(a); a.click(); a.remove();
                    window.URL.revokeObjectURL(url);
                  } catch (e: any) { alert('Error: ' + e.message); }
                  setExporting(false);
                }}
                disabled={exporting}
                className="text-[11px] px-2.5 py-1.5 rounded-md bg-gradient-to-br from-indigo-500 to-violet-600 text-white hover:brightness-110 flex items-center gap-1 disabled:opacity-50 shadow-md shadow-indigo-500/20 transition"
              >
                {exporting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                CSV
              </button>
            }
          >
            {initialLoad ? <SkeletonBlock height={250} /> :
              <SessionsTable rows={sessions} onSelect={(id) => setOpenSessionId(id)} />}
          </Card>
        </section>

        {/* ─── World Map (with toggle on mobile) ─────────────────────────── */}
        <section id="map" className="scroll-mt-32 animate-fadeIn" style={{ animationDelay: '460ms' }}>
          <Card
            title="Mapa de visitantes"
            subtitle={`${geo?.cities?.length || 0} ciudades · ${geo?.countries?.length || 0} países · ${live?.online_now ?? 0} en vivo`}
            icon={<Globe className="w-4 h-4" />}
            actions={
              <div className="lg:hidden flex bg-white/5 border border-white/10 rounded-md p-0.5">
                <button
                  onClick={() => setMapView('map')}
                  className={`px-2 py-1 rounded text-[10px] font-semibold flex items-center gap-1 ${mapView === 'map' ? 'bg-white/10 text-white' : 'text-slate-400'}`}
                >
                  <MapIcon className="w-3 h-3" /> Mapa
                </button>
                <button
                  onClick={() => setMapView('list')}
                  className={`px-2 py-1 rounded text-[10px] font-semibold flex items-center gap-1 ${mapView === 'list' ? 'bg-white/10 text-white' : 'text-slate-400'}`}
                >
                  <LayoutGrid className="w-3 h-3" /> Lista
                </button>
              </div>
            }
          >
            {initialLoad ? <SkeletonBlock height={360} /> : (
              <>
                <div className={`${mapView === 'list' ? 'hidden lg:block' : 'block'}`}>
                  <WorldMap cities={geo?.cities || []} liveSessions={live?.sessions || []} />
                </div>
                <div className={`${mapView === 'map' ? 'hidden lg:hidden' : 'block lg:hidden'}`}>
                  <CityList cities={(geo?.cities || []).slice(0, 15)} />
                </div>
              </>
            )}
          </Card>
        </section>

        {/* ─── Geo: Countries + Cities ───────────────────────────────────── */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 animate-fadeIn" style={{ animationDelay: '520ms' }}>
          <Card title="Países" subtitle={`${geo?.countries?.length || 0} países activos`} icon={<MapPin className="w-4 h-4" />}>
            {initialLoad ? <SkeletonBlock height={220} /> : <CountryList countries={(geo?.countries || []).slice(0, 10)} />}
          </Card>
          <Card title="Ciudades" subtitle="Top 10" icon={<MapPin className="w-4 h-4" />}>
            {initialLoad ? <SkeletonBlock height={220} /> : <CityList cities={(geo?.cities || []).slice(0, 10)} />}
          </Card>
        </section>

        {/* ─── Top Pages ─────────────────────────────────────────────────── */}
        <section className="animate-fadeIn" style={{ animationDelay: '580ms' }}>
          <Card
            title="Páginas más vistas"
            subtitle={topPages.length ? `Top ${topPages.length} URLs` : 'Sin datos'}
            icon={<Eye className="w-4 h-4" />}
          >
            {initialLoad ? <SkeletonBlock height={260} /> :
              topPages.length === 0
                ? <EmptyState text="Aún no hay pageviews. Visita el sitio en otra pestaña para ver datos." />
                : <TopPagesTable rows={topPages} />}
          </Card>
        </section>

        {/* ─── Sources ───────────────────────────────────────────────────── */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 animate-fadeIn" style={{ animationDelay: '640ms' }}>
          <Card title="Fuentes de tráfico" subtitle="De dónde vienen tus visitantes" icon={<Globe className="w-4 h-4" />}>
            {initialLoad ? <SkeletonBlock height={200} /> : <ReferrerList rows={sources?.referrers || []} />}
          </Card>
          <Card title="Campañas UTM" subtitle="Marketing trackeable" icon={<Flame className="w-4 h-4" />}>
            {initialLoad ? <SkeletonBlock height={200} /> :
              sources?.utm_campaigns?.length
                ? <UtmList rows={sources.utm_campaigns} />
                : <EmptyState text="Aún sin campañas. Usa enlaces con ?utm_source=fb&utm_campaign=primavera para trackearlos." />}
          </Card>
        </section>
      </div>

      {openSessionId && token && (
        <SessionsDrawer
          sessionId={openSessionId}
          token={token}
          onClose={() => setOpenSessionId(null)}
        />
      )}

      {/* Global animations (App Router: raw <style>) */}
      <style dangerouslySetInnerHTML={{
        __html: `
        @keyframes analyticsFadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          opacity: 0;
          animation: analyticsFadeIn 0.5s ease-out forwards;
        }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { scrollbar-width: none; -ms-overflow-style: none; }
        `
      }} />
    </div>
  );
}

// ─── Mobile filter sheet ──────────────────────────────────────────────────
function MobileFilterSheet({
  onClose, filterCountry, setFilterCountry, filterDevice, setFilterDevice,
  filterLead, setFilterLead, countries,
}: any) {
  return (
    <div className="lg:hidden fixed inset-0 z-40 flex items-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative w-full bg-slate-900 rounded-t-3xl p-5 shadow-2xl border-t border-white/10 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-12 h-1 bg-slate-700 rounded-full mx-auto mb-4" />
        <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
          <Filter className="w-4 h-4 text-indigo-400" />
          Filtros
        </h2>

        {/* Device pills */}
        <div className="mb-4">
          <label className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block mb-2">Dispositivo</label>
          <div className="flex gap-2 flex-wrap">
            {[
              { key: '', label: 'Todos', emoji: '🌐' },
              { key: 'Desktop', label: 'Desktop', emoji: '🖥️' },
              { key: 'Mobile', label: 'Mobile', emoji: '📱' },
              { key: 'Tablet', label: 'Tablet', emoji: '💻' },
            ].map(opt => {
              const active = filterDevice === opt.key;
              return (
                <button
                  key={opt.key || 'all'}
                  onClick={() => setFilterDevice(opt.key)}
                  className={`px-3 py-2 rounded-full text-xs font-semibold border transition ${
                    active
                      ? 'bg-gradient-to-br from-indigo-500 to-violet-600 border-transparent text-white shadow-md shadow-indigo-500/30'
                      : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                  }`}
                >
                  <span className="mr-1">{opt.emoji}</span>{opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Lead pills */}
        <div className="mb-4">
          <label className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block mb-2">Lead</label>
          <div className="flex gap-2">
            {[
              { key: '', label: 'Todas' },
              { key: 'true', label: '🎯 Sólo con lead' },
              { key: 'false', label: 'Sin lead' },
            ].map(opt => {
              const active = filterLead === opt.key;
              return (
                <button
                  key={opt.key || 'all'}
                  onClick={() => setFilterLead(opt.key)}
                  className={`flex-1 py-2 rounded-full text-xs font-semibold border transition ${
                    active
                      ? 'bg-gradient-to-br from-amber-500 to-orange-600 border-transparent text-white shadow-md'
                      : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                  }`}
                >{opt.label}</button>
              );
            })}
          </div>
        </div>

        {/* Country select */}
        <div className="mb-5">
          <label className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block mb-2">País</label>
          <select
            value={filterCountry}
            onChange={(e) => setFilterCountry(e.target.value)}
            className="w-full text-sm border border-white/10 bg-white/5 text-slate-100 rounded-xl px-3 py-3"
          >
            <option value="" className="bg-slate-900">🌍 Todos los países</option>
            {countries.map((c: any) => (
              <option key={c.country_code} value={c.country_code} className="bg-slate-900">{c.country}</option>
            ))}
          </select>
        </div>

        <div className="flex gap-2">
          {(filterCountry || filterDevice || filterLead) && (
            <button
              onClick={() => { setFilterCountry(''); setFilterDevice(''); setFilterLead(''); }}
              className="flex-1 py-3 rounded-xl bg-rose-500/15 text-rose-300 border border-rose-500/30 font-semibold text-sm"
            >Limpiar</button>
          )}
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white font-semibold text-sm shadow-lg shadow-indigo-500/30"
          >Aplicar</button>
        </div>
      </div>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────
function SkeletonBlock({ height = 120 }: { height?: number }) {
  return (
    <div
      className="rounded-2xl bg-gradient-to-r from-white/[0.03] via-white/[0.06] to-white/[0.03] border border-white/[0.06] animate-pulse"
      style={{ height }}
    />
  );
}

// ─── Goals grid ───────────────────────────────────────────────────────────
function GoalsGrid({ goals }: { goals: any[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 lg:gap-3">
      {goals.map(g => {
        const pct = g.progress || 0;
        const done = pct >= 100;
        return (
          <div key={g.id} className={`rounded-xl border p-3 transition backdrop-blur-sm ${done ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-white/[0.03] border-white/[0.06]'}`}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xl">{g.emoji}</span>
              <span className={`text-[10px] font-bold ${done ? 'text-emerald-300' : 'text-slate-400'}`}>{pct}%</span>
            </div>
            <div className="text-[11px] font-semibold text-slate-200 leading-tight truncate">{g.name}</div>
            <div className="flex items-baseline gap-1 mt-1">
              <span className={`text-lg font-black tabular-nums ${done ? 'text-emerald-300' : 'text-white'}`}>{g.value}</span>
              <span className="text-[10px] text-slate-500">/ {g.target}</span>
            </div>
            <div className="mt-1.5 h-1 bg-white/5 rounded-full overflow-hidden">
              <div className={`h-full transition-all duration-700 ${done ? 'bg-gradient-to-r from-emerald-400 to-teal-500' : 'bg-gradient-to-r from-indigo-400 to-violet-500'}`}
                   style={{ width: `${Math.min(100, pct)}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Sessions table (cards on mobile, table on desktop) ──────────────────
function SessionsTable({ rows, onSelect }: { rows: any[]; onSelect: (id: string) => void }) {
  if (!rows.length) return <EmptyState text="Sin sesiones con los filtros actuales." />;
  return (
    <>
      <div className="lg:hidden space-y-2">
        {rows.map(s => (
          <button
            key={s.session_id}
            onClick={() => onSelect(s.session_id)}
            className="w-full text-left bg-white/[0.03] hover:bg-white/[0.08] active:scale-[0.99] rounded-xl border border-white/[0.06] p-3 transition"
          >
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-lg">{flagEmoji(s.country_code)}</span>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm truncate text-slate-100">{s.city || s.country || 'Desconocido'}</div>
                <div className="text-[10px] text-slate-400 truncate">
                  {new Date(s.first_seen).toLocaleString('es-MX', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
              {s.lead_id && <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">🎯 LEAD</span>}
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-400 flex-wrap">
              <span className="flex items-center gap-1">{DEVICE_ICONS[s.device] || null}{s.device || '—'}</span>
              <span className="text-slate-600">·</span>
              <span>{s.browser}</span>
              <span className="text-slate-600">·</span>
              <span className="font-semibold text-slate-300">{s.pages_count} págs</span>
            </div>
            {s.landing_path && (
              <div className="mt-1 font-mono text-[10px] text-slate-500 truncate">{s.landing_path}</div>
            )}
          </button>
        ))}
      </div>

      <div className="hidden lg:block overflow-x-auto -mx-2">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-slate-400 border-b border-white/[0.06]">
              <th className="text-left py-2 px-2 font-bold">Hora</th>
              <th className="text-left py-2 px-2 font-bold">Ubicación</th>
              <th className="text-left py-2 px-2 font-bold">Device</th>
              <th className="text-left py-2 px-2 font-bold">Entrada</th>
              <th className="text-right py-2 px-2 font-bold w-12">Pages</th>
              <th className="text-right py-2 px-2 font-bold w-12">Lead</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr
                key={s.session_id}
                onClick={() => onSelect(s.session_id)}
                className="border-b border-white/[0.04] hover:bg-white/[0.03] cursor-pointer transition"
              >
                <td className="py-2 px-2 text-[11px] text-slate-400 whitespace-nowrap">
                  {new Date(s.first_seen).toLocaleString('es-MX', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </td>
                <td className="py-2 px-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-base">{flagEmoji(s.country_code)}</span>
                    <span className="text-[11px] truncate max-w-[140px] text-slate-200">
                      {s.city || s.country || 'Desconocido'}
                    </span>
                  </div>
                </td>
                <td className="py-2 px-2">
                  <div className="flex items-center gap-1 text-[11px]">
                    {DEVICE_ICONS[s.device] || null}
                    <span className="text-slate-300">{s.device || '—'}</span>
                    <span className="text-slate-500 text-[10px]">· {s.browser}</span>
                  </div>
                </td>
                <td className="py-2 px-2 font-mono text-[10px] text-slate-500 truncate max-w-[180px]">{s.landing_path || '—'}</td>
                <td className="py-2 px-2 text-right tabular-nums font-semibold text-slate-200">{s.pages_count}</td>
                <td className="py-2 px-2 text-right">
                  {s.lead_id
                    ? <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">🎯</span>
                    : <span className="text-slate-700">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ─── LIVE banner (redesigned) ─────────────────────────────────────────────
function LiveBanner({ live }: { live: { online_now: number; sessions: LiveSession[] } | null }) {
  const count = live?.online_now ?? 0;
  const sessions = live?.sessions || [];
  const animatedCount = useCountUp(count, 600);
  return (
    <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/60 border border-white/[0.08] shadow-2xl shadow-emerald-900/20">
      <div className="absolute inset-0 opacity-30 pointer-events-none"
           style={{ backgroundImage: 'radial-gradient(circle at 15% 30%, rgba(52,211,153,.35) 0, transparent 45%), radial-gradient(circle at 85% 70%, rgba(129,140,248,.28) 0, transparent 45%)' }} />
      <div className="relative px-5 py-5 flex flex-col lg:flex-row lg:items-center gap-5">
        <div className="flex items-center gap-4 min-w-0 shrink-0">
          <div className="relative shrink-0">
            <div className={`w-16 h-16 rounded-2xl backdrop-blur flex items-center justify-center border border-white/10 ${count > 0 ? 'bg-emerald-500/25' : 'bg-white/[0.05]'}`}>
              <Radio className={`w-8 h-8 ${count > 0 ? 'text-emerald-300 animate-pulse' : 'text-slate-500'}`} />
            </div>
            {count > 0 && (
              <>
                <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-400 border-2 border-slate-900" />
                </span>
                <span className="absolute inset-0 rounded-2xl ring-2 ring-emerald-400/30 animate-pulse pointer-events-none" />
              </>
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] uppercase tracking-widest font-black text-emerald-300">{count > 0 ? 'EN VIVO' : 'EN ESPERA'}</span>
              <span className={`w-1.5 h-1.5 rounded-full ${count > 0 ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
              <span className="text-[10px] uppercase tracking-wider text-slate-400">conectados ahora</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-5xl lg:text-6xl font-black leading-none tabular-nums tracking-tight text-white">{animatedCount}</span>
              <span className="text-xs text-slate-400">
                {count === 0 ? 'visitante ahora' : count === 1 ? 'visitante activo' : 'visitantes activos'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Actualiza cada 12s · últimos 60s</p>
          </div>
        </div>

        {/* Stacked avatars + preview */}
        {sessions.length > 0 ? (
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <div className="flex -space-x-2">
                {sessions.slice(0, 6).map((s, i) => (
                  <div
                    key={s.session_id}
                    className="w-8 h-8 rounded-full bg-slate-800 border-2 border-slate-900 flex items-center justify-center text-sm shadow-md"
                    style={{ zIndex: 10 - i }}
                    title={`${s.city || s.country || ''} · ${s.device || ''}`}
                  >
                    {flagEmoji(s.country_code)}
                  </div>
                ))}
                {sessions.length > 6 && (
                  <div className="w-8 h-8 rounded-full bg-slate-800 border-2 border-slate-900 flex items-center justify-center text-[10px] text-slate-300 font-bold">
                    +{sessions.length - 6}
                  </div>
                )}
              </div>
              <span className="text-[11px] text-slate-400">Navegando ahora</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-32 overflow-y-auto pr-1 no-scrollbar">
              {sessions.slice(0, 6).map(s => (
                <div key={s.session_id} className="flex items-center gap-2 bg-white/[0.05] backdrop-blur-sm rounded-lg px-2.5 py-1.5 text-[11px] border border-white/[0.06]">
                  <span className="text-base shrink-0">{flagEmoji(s.country_code)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="truncate text-white font-medium leading-tight">
                      {s.city || s.country || 'Desconocido'}
                    </div>
                    <div className="truncate text-slate-400 text-[10px]">{s.current_path || '/'}</div>
                  </div>
                  <span className="text-slate-500 shrink-0" title={s.device || ''}>{DEVICE_ICONS[s.device || ''] || null}</span>
                  {s.lead_id && <span className="text-[9px] px-1 py-0.5 rounded bg-amber-400 text-amber-950 font-black shrink-0">LEAD</span>}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center lg:justify-end">
            <p className="text-[11px] text-slate-500 max-w-xs lg:text-right">
              Cuando alguien visite el sitio aparecerán aquí en tiempo real con su país, dispositivo y la página que ven.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── KPI Card with animated counter ───────────────────────────────────────
function KpiCard({ icon, label, value, delta, accent, sparkData }: {
  icon: React.ReactNode; label: string; value: number; delta?: number | null;
  accent: 'cyan' | 'indigo' | 'violet' | 'emerald'; sparkData?: { v: number }[];
}) {
  const accentMap: Record<string, { bg: string; glow: string; text: string; spark: string; ring: string }> = {
    cyan:    { bg: 'bg-cyan-500/10',    glow: 'shadow-cyan-500/20',    text: 'text-cyan-300',    spark: '#22d3ee', ring: 'ring-cyan-500/20' },
    indigo:  { bg: 'bg-indigo-500/10',  glow: 'shadow-indigo-500/20',  text: 'text-indigo-300',  spark: '#818cf8', ring: 'ring-indigo-500/20' },
    violet:  { bg: 'bg-violet-500/10',  glow: 'shadow-violet-500/20',  text: 'text-violet-300',  spark: '#a78bfa', ring: 'ring-violet-500/20' },
    emerald: { bg: 'bg-emerald-500/10', glow: 'shadow-emerald-500/20', text: 'text-emerald-300', spark: '#34d399', ring: 'ring-emerald-500/20' },
  };
  const c = accentMap[accent];
  const positive = (delta ?? 0) >= 0;
  const animated = useCountUp(value, 900);
  return (
    <div className={`group relative bg-white/[0.03] backdrop-blur-xl rounded-2xl p-4 border border-white/[0.06] hover:border-white/[0.12] hover:${c.glow} hover:shadow-lg transition-all duration-300 overflow-hidden`}>
      <div className={`absolute -top-8 -right-8 w-24 h-24 rounded-full ${c.bg} blur-2xl opacity-60 group-hover:opacity-100 transition-opacity`} />
      <div className="relative flex items-center justify-between mb-2">
        <div className={`w-8 h-8 rounded-lg ${c.bg} ${c.text} flex items-center justify-center ring-1 ${c.ring}`}>
          {icon}
        </div>
        {delta != null && (
          <span className={`text-[10px] font-bold flex items-center gap-0.5 px-1.5 py-0.5 rounded-full ${positive ? 'bg-emerald-500/15 text-emerald-300' : 'bg-rose-500/15 text-rose-300'}`}>
            {positive ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
            {Math.abs(delta)}%
          </span>
        )}
      </div>
      <div className="relative flex items-end justify-between gap-2">
        <div className="min-w-0">
          <div className="text-3xl lg:text-4xl font-black text-white leading-none tabular-nums">{fmt(animated)}</div>
          <div className="text-[10px] text-slate-400 uppercase tracking-wider mt-2 font-semibold">{label}</div>
        </div>
        {sparkData && sparkData.length > 1 && (
          <div className="w-20 h-10 -mb-1 opacity-90 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sparkData}>
                <defs>
                  <linearGradient id={`spark-${accent}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={c.spark} stopOpacity={0.6} />
                    <stop offset="100%" stopColor={c.spark} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="v" stroke={c.spark} fill={`url(#spark-${accent})`} strokeWidth={1.8} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Small inline metric ──────────────────────────────────────────────────
function MiniMetric({ icon, label, value, hint, tone }: {
  icon: React.ReactNode; label: string; value: string; hint?: string; tone?: 'ok' | 'warn';
}) {
  const toneClass = tone === 'warn' ? 'text-amber-300' : 'text-white';
  return (
    <div className="bg-white/[0.03] backdrop-blur-xl rounded-xl border border-white/[0.06] px-4 py-3 hover:border-white/[0.12] transition">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
        <span className="text-slate-500">{icon}</span>
        {label}
      </div>
      <div className={`text-lg font-bold ${toneClass} mt-0.5 tabular-nums`}>{value}</div>
      {hint && <div className="text-[10px] text-slate-500">{hint}</div>}
    </div>
  );
}

// ─── Card wrapper ─────────────────────────────────────────────────────────
function Card({ title, subtitle, children, icon, actions }: {
  title: string; subtitle?: string; children: React.ReactNode; icon?: React.ReactNode; actions?: React.ReactNode;
}) {
  return (
    <div className="bg-white/[0.03] backdrop-blur-xl rounded-2xl border border-white/[0.06] hover:border-white/[0.10] transition overflow-hidden">
      <div className="px-5 py-3.5 border-b border-white/[0.06] flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          {icon && <span className="w-7 h-7 rounded-lg bg-white/[0.06] text-slate-300 flex items-center justify-center shrink-0">{icon}</span>}
          <div className="min-w-0">
            <h3 className="font-bold text-white text-sm leading-tight">{title}</h3>
            {subtitle && <p className="text-[11px] text-slate-400 leading-tight">{subtitle}</p>}
          </div>
        </div>
        {actions}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="py-10 text-center">
      <div className="inline-flex w-12 h-12 rounded-2xl bg-white/[0.03] items-center justify-center mb-2 border border-white/[0.06]">
        <BarChart3 className="w-5 h-5 text-slate-500" />
      </div>
      <p className="text-xs text-slate-500 max-w-xs mx-auto">{text}</p>
    </div>
  );
}

// ─── Funnel ───────────────────────────────────────────────────────────────
function FunnelView({ steps }: { steps: { name: string; value: number }[] }) {
  const max = Math.max(...steps.map(s => s.value), 1);
  return (
    <div className="space-y-2">
      {steps.map((s, i) => {
        const pct = max > 0 ? (s.value / max) * 100 : 0;
        const conv = i > 0 && steps[i - 1].value > 0
          ? Math.round((s.value / steps[i - 1].value) * 100)
          : null;
        const isZero = s.value === 0;
        return (
          <div key={s.name}>
            <div className="flex items-center justify-between text-[11px] mb-1">
              <span className="font-semibold text-slate-300">{i + 1}. {s.name}</span>
              <span className="flex items-center gap-2">
                <strong className="text-white tabular-nums">{fmt(s.value)}</strong>
                {conv != null && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${conv >= 50 ? 'bg-emerald-500/15 text-emerald-300' : conv >= 20 ? 'bg-amber-500/15 text-amber-300' : 'bg-rose-500/15 text-rose-300'}`}>
                    {conv}%
                  </span>
                )}
              </span>
            </div>
            <div className="h-6 bg-white/[0.04] rounded-md overflow-hidden border border-white/[0.04]">
              {!isZero && (
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 via-blue-500 to-cyan-500 rounded-md flex items-center px-2 text-white text-[11px] font-bold transition-all duration-700 shadow-inner"
                  style={{ width: `${Math.max(pct, 6)}%` }}
                >
                  {fmt(s.value)}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Device pie ───────────────────────────────────────────────────────────
function DevicePie({ data }: { data: { name: string; sessions: number }[] }) {
  if (!data.length || data.every(d => d.sessions === 0)) {
    return <EmptyState text="Sin sesiones." />;
  }
  const total = data.reduce((s, d) => s + d.sessions, 0);
  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={170}>
        <PieChart>
          <Pie data={data} dataKey="sessions" nameKey="name" innerRadius={48} outerRadius={70} paddingAngle={3} strokeWidth={0}>
            {data.map((d, i) => <Cell key={i} fill={COLOR_DEVICES[d.name] || '#94a3b8'} />)}
          </Pie>
          <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #ffffff20', fontSize: 12, background: 'rgba(15,23,42,0.95)', color: '#f1f5f9' }} />
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="text-xl font-black text-white tabular-nums">{total}</span>
        <span className="text-[9px] uppercase tracking-wider text-slate-400">sesiones</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-2 justify-center">
        {data.map(d => (
          <div key={d.name} className="flex items-center gap-1 text-[10px]">
            <span className="w-2 h-2 rounded-full" style={{ background: COLOR_DEVICES[d.name] || '#94a3b8' }} />
            <span className="text-slate-300 font-medium">{d.name}</span>
            <span className="text-slate-500 tabular-nums">{d.sessions}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Simple bars ──────────────────────────────────────────────────────────
function SimpleBars({ data, title }: { data: { name: string; sessions: number }[]; title: string }) {
  if (!data.length) {
    return (
      <div>
        <div className="text-[9px] uppercase tracking-widest text-slate-500 font-bold mb-1.5">{title}</div>
        <div className="text-[11px] text-slate-500">Sin datos</div>
      </div>
    );
  }
  const total = data.reduce((s, x) => s + x.sessions, 0) || 1;
  return (
    <div>
      <div className="text-[9px] uppercase tracking-widest text-slate-500 font-bold mb-1.5">{title}</div>
      <div className="space-y-1">
        {data.slice(0, 4).map((d) => {
          const pct = (d.sessions / total) * 100;
          return (
            <div key={d.name} className="flex items-center gap-2 text-[11px]">
              <span className="w-16 truncate text-slate-300 font-medium">{d.name}</span>
              <div className="flex-1 h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-indigo-400 to-violet-500" style={{ width: `${pct}%` }} />
              </div>
              <span className="w-7 text-right tabular-nums text-slate-400 font-mono">{d.sessions}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Country list ─────────────────────────────────────────────────────────
function CountryList({ countries }: { countries: any[] }) {
  if (!countries.length) return <EmptyState text="Sin tráfico geolocalizado aún." />;
  const max = Math.max(...countries.map(c => c.sessions), 1);
  return (
    <div className="space-y-2">
      {countries.map(c => {
        const pct = (c.sessions / max) * 100;
        return (
          <div key={c.country_code || c.country} className="flex items-center gap-3 text-sm group">
            <span className="text-xl shrink-0">{flagEmoji(c.country_code)}</span>
            <span className="w-32 truncate font-medium text-slate-200 text-xs">{c.country || 'Desconocido'}</span>
            <div className="flex-1 h-2 bg-white/[0.05] rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-cyan-400 to-indigo-500 transition-all duration-700" style={{ width: `${pct}%` }} />
            </div>
            <span className="w-10 text-right tabular-nums text-white font-bold text-xs">{c.sessions}</span>
            {c.leads > 0 && <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">+{c.leads} LD</span>}
          </div>
        );
      })}
    </div>
  );
}

// ─── City list ────────────────────────────────────────────────────────────
function CityList({ cities }: { cities: any[] }) {
  if (!cities.length) return <EmptyState text="Aún sin ciudades. Espera más visitantes." />;
  return (
    <div className="space-y-1">
      {cities.map((c, i) => (
        <div key={i} className="flex items-center gap-2 text-xs px-2 py-1.5 rounded-lg hover:bg-white/[0.04] transition">
          <span className="text-base shrink-0">{flagEmoji(c.country_code)}</span>
          <div className="flex-1 truncate">
            <span className="font-semibold text-slate-200">{c.city}</span>
            <span className="text-slate-500 ml-1.5 text-[10px]">· {c.country}</span>
          </div>
          {c.leads > 0 && <span className="text-[9px] px-1 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">{c.leads} LD</span>}
          <span className="font-mono text-slate-300 text-[11px] tabular-nums">{c.sessions}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Top pages (cards on mobile, table on desktop) ───────────────────────
function TopPagesTable({ rows }: { rows: any[] }) {
  const maxViews = Math.max(...rows.map(r => r.views), 1);
  return (
    <>
      {/* Mobile cards */}
      <div className="lg:hidden space-y-2">
        {rows.map((r, i) => {
          const pct = (r.views / maxViews) * 100;
          return (
            <div key={i} className="bg-white/[0.03] rounded-xl border border-white/[0.06] p-3">
              <div className="font-mono text-[11px] text-slate-200 truncate mb-2">{r.path}</div>
              <div className="h-1 bg-white/[0.05] rounded overflow-hidden mb-2">
                <div className="h-full bg-gradient-to-r from-indigo-400 to-cyan-500" style={{ width: `${pct}%` }} />
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-400">
                <div className="flex items-center gap-3">
                  <span className="tabular-nums"><span className="text-white font-bold">{r.views}</span> views</span>
                  <span className="tabular-nums">{r.visitors} únicos</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="tabular-nums">{secFmt(Math.round(r.avg_duration_sec || 0))}</span>
                  <span className="tabular-nums">{r.avg_scroll_pct || 0}% scr</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop table */}
      <div className="hidden lg:block overflow-x-auto -mx-2">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-slate-400 border-b border-white/[0.06]">
              <th className="text-left py-2 px-2 font-bold">Path</th>
              <th className="text-right py-2 px-2 font-bold w-24">Views</th>
              <th className="text-right py-2 px-2 font-bold w-20">Únicos</th>
              <th className="text-right py-2 px-2 font-bold w-20">Tiempo</th>
              <th className="text-right py-2 px-2 font-bold w-20">Scroll</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const pct = (r.views / maxViews) * 100;
              return (
                <tr key={i} className="border-b border-white/[0.04] hover:bg-white/[0.03]">
                  <td className="py-2 px-2 max-w-xs">
                    <div className="font-mono text-[12px] text-slate-200 truncate">{r.path}</div>
                    <div className="mt-1 h-1 bg-white/[0.05] rounded overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-indigo-400 to-cyan-500" style={{ width: `${pct}%` }} />
                    </div>
                  </td>
                  <td className="py-2 px-2 text-right tabular-nums font-bold text-white">{r.views}</td>
                  <td className="py-2 px-2 text-right tabular-nums text-slate-300">{r.visitors}</td>
                  <td className="py-2 px-2 text-right tabular-nums text-slate-400 text-[11px]">{secFmt(Math.round(r.avg_duration_sec || 0))}</td>
                  <td className="py-2 px-2 text-right tabular-nums text-slate-400 text-[11px]">{r.avg_scroll_pct || 0}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ─── Referrer list ────────────────────────────────────────────────────────
function ReferrerList({ rows }: { rows: any[] }) {
  if (!rows.length) return <EmptyState text="Sin referrers todavía." />;
  const max = Math.max(...rows.map(r => r.sessions), 1);
  return (
    <div className="space-y-2">
      {rows.map((r, i) => {
        const pct = (r.sessions / max) * 100;
        const isDirect = r.source === '(direct)';
        return (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="w-7 h-7 rounded-lg bg-white/[0.05] flex items-center justify-center text-slate-300 shrink-0 text-base border border-white/[0.06]">
              {isDirect ? '⌁' : '🔗'}
            </span>
            <span className="w-32 truncate font-semibold text-slate-200 text-[11px]">
              {isDirect ? 'Directo' : r.source}
            </span>
            <div className="flex-1 h-2 bg-white/[0.05] rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-rose-400 to-fuchsia-500" style={{ width: `${pct}%` }} />
            </div>
            <span className="w-10 text-right tabular-nums text-white font-bold">{r.sessions}</span>
            {r.leads > 0 && <span className="text-[9px] px-1 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">{r.leads}LD</span>}
          </div>
        );
      })}
    </div>
  );
}

// ─── UTM list (cards on mobile) ───────────────────────────────────────────
function UtmList({ rows }: { rows: any[] }) {
  return (
    <>
      <div className="lg:hidden space-y-2">
        {rows.map((r, i) => (
          <div key={i} className="bg-white/[0.03] rounded-xl border border-white/[0.06] p-3">
            <div className="flex items-center justify-between mb-1">
              <div className="font-semibold text-slate-200 text-xs">{r.source}</div>
              <div className="flex items-center gap-2 text-[10px]">
                <span className="text-slate-300 tabular-nums">{r.sessions} ses</span>
                {r.leads > 0 && <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold tabular-nums">{r.leads} LD</span>}
              </div>
            </div>
            <div className="text-[10px] text-slate-500 flex items-center gap-2">
              <span>{r.medium || '—'}</span>
              {r.campaign && <><span>·</span><span className="truncate">{r.campaign}</span></>}
            </div>
          </div>
        ))}
      </div>

      <div className="hidden lg:block overflow-x-auto -mx-2">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-slate-400 border-b border-white/[0.06]">
              <th className="text-left py-1.5 px-2 font-bold">Source</th>
              <th className="text-left py-1.5 px-2 font-bold">Medium</th>
              <th className="text-left py-1.5 px-2 font-bold">Campaign</th>
              <th className="text-right py-1.5 px-2 font-bold">Sesiones</th>
              <th className="text-right py-1.5 px-2 font-bold">Leads</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-white/[0.04]">
                <td className="py-1.5 px-2 font-semibold text-slate-200">{r.source}</td>
                <td className="py-1.5 px-2 text-slate-400">{r.medium || '—'}</td>
                <td className="py-1.5 px-2 text-slate-400 truncate max-w-xs">{r.campaign || '—'}</td>
                <td className="py-1.5 px-2 text-right tabular-nums text-slate-200">{r.sessions}</td>
                <td className="py-1.5 px-2 text-right tabular-nums text-amber-300 font-bold">{r.leads || 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
