'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAdminAuth } from '../layout';
import {
  Repeat, CreditCard, Search, RefreshCw, Zap, CheckCircle2,
  XCircle, Clock, AlertTriangle, Calendar, User, Sparkles,
  TrendingUp, Play, DollarSign, Activity,
} from 'lucide-react';

type AutopayConfig = {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  enabled: boolean;
  day_of_month: number;
  payment_method_id: string;
  last_attempt_date?: string | null;
  last_attempt_status?: string | null;
  last_attempt_error?: string | null;
  successful_charges: number;
  failed_charges: number;
  updated_at?: string | null;
};

const fmtDate = (iso?: string | null) => {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return '—'; }
};

const fmtDateTime = (iso?: string | null) => {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch { return '—'; }
};

export default function AutopagosPage() {
  const { headers } = useAdminAuth();
  const [configs, setConfigs] = useState<AutopayConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'enabled' | 'disabled' | 'failed'>('all');
  const [toast, setToast] = useState<{ msg: string; tone: 'ok' | 'err' } | null>(null);

  const showToast = (msg: string, tone: 'ok' | 'err' = 'ok') => {
    setToast({ msg, tone });
    setTimeout(() => setToast(null), 4500);
  };

  const fetchConfigs = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/autopay/configs', { headers: headers() });
      if (res.ok) {
        const d = await res.json();
        setConfigs(d.configs || []);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [headers]);

  useEffect(() => { fetchConfigs(); }, [fetchConfigs]);

  const handleRunNow = async () => {
    setRunning(true);
    try {
      const res = await fetch('/api/admin/autopay/run-now', { method: 'POST', headers: headers() });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.success) {
        const s = d.stats || {};
        showToast(`⚡ Autopago ejecutado: ${s.charged || 0} cobrado(s) · ${s.skipped || 0} omitido(s) · ${s.failed || 0} fallido(s)`);
        await fetchConfigs();
      } else {
        showToast(`❌ ${d?.detail || 'Error'}`, 'err');
      }
    } catch (e: any) {
      showToast(`❌ ${e?.message}`, 'err');
    }
    setRunning(false);
  };

  // Stats
  const enabledCount = useMemo(() => configs.filter(c => c.enabled).length, [configs]);
  const totalSuccess = useMemo(() => configs.reduce((s, c) => s + (c.successful_charges || 0), 0), [configs]);
  const totalFail = useMemo(() => configs.reduce((s, c) => s + (c.failed_charges || 0), 0), [configs]);

  const filtered = useMemo(() => {
    return configs.filter(c => {
      if (filter === 'enabled' && !c.enabled) return false;
      if (filter === 'disabled' && c.enabled) return false;
      if (filter === 'failed' && !c.last_attempt_status?.includes('fail') && (c.failed_charges || 0) === 0) return false;
      if (search) {
        const h = `${c.user_name} ${c.user_email}`.toLowerCase();
        if (!h.includes(search.toLowerCase())) return false;
      }
      return true;
    });
  }, [configs, search, filter]);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-3 border-red-500/30 border-t-red-500 rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-6 relative pb-32">
      <div className="fixed top-0 right-1/3 w-96 h-96 bg-red-500/[0.025] rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-1/4 left-1/4 w-96 h-96 bg-amber-500/[0.025] rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="relative w-12 h-12 rounded-2xl bg-gradient-to-br from-red-500/25 to-red-500/5 border border-red-500/25 flex items-center justify-center shadow-[0_0_25px_rgba(239,68,68,0.18)]">
            <Repeat className="w-6 h-6 text-red-400" />
            <Sparkles className="absolute -top-1 -right-1 w-3 h-3 text-red-300" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Autopagos de Renta</h2>
            <p className="text-sm text-gray-500">{enabledCount} activo(s) · {configs.length} total · Cron corre cada 6h</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={fetchConfigs}
            className="p-2.5 border border-white/[0.08] rounded-xl text-gray-400 hover:bg-white/[0.04] transition"
            title="Refrescar"
          ><RefreshCw className="w-4 h-4" /></button>
          <button
            onClick={handleRunNow}
            disabled={running}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl text-sm font-bold hover:opacity-90 transition shadow-[0_0_22px_rgba(239,68,68,0.35)] disabled:opacity-50"
          >
            {running ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Play className="w-4 h-4" />}
            Ejecutar Autopago Ahora
          </button>
        </div>
      </div>

      {/* Info banner */}
      <div className="rounded-2xl bg-gradient-to-br from-blue-500/[0.08] to-transparent border border-blue-500/25 p-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-500/15 ring-1 ring-blue-500/30 flex items-center justify-center shrink-0">
            <Activity className="w-5 h-5 text-blue-300" />
          </div>
          <div className="text-sm text-gray-300 space-y-1">
            <div className="font-bold text-white">¿Cómo funciona el autopago?</div>
            <p className="text-xs text-gray-400">
              El inquilino guarda una tarjeta en la app móvil, activa el autopago y elige el día del mes (1-28).
              Cada 6h, el sistema revisa todos los autopagos activos: si hoy es el día configurado, busca el pago
              pendiente del mes y cobra la tarjeta con Stripe automáticamente. El recibo se genera al instante.
            </p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={<Zap className="w-4 h-4 text-emerald-400" />} value={String(enabledCount)} label="Activos ahora" tone="emerald" />
        <StatCard icon={<TrendingUp className="w-4 h-4 text-blue-400" />} value={String(totalSuccess)} label="Cobros exitosos" tone="blue" />
        <StatCard icon={<XCircle className="w-4 h-4 text-red-400" />} value={String(totalFail)} label="Cobros fallidos" tone="red" />
        <StatCard icon={<User className="w-4 h-4 text-violet-400" />} value={String(configs.length)} label="Total inquilinos" tone="violet" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar inquilino o email..."
            className="w-full pl-10 pr-4 py-2.5 bg-[#0C1220]/60 border border-white/[0.08] rounded-xl text-sm text-white focus:border-red-500 focus:outline-none placeholder:text-gray-600"
          />
        </div>
        <FilterPill active={filter === 'all'} onClick={() => setFilter('all')}>Todos</FilterPill>
        <FilterPill active={filter === 'enabled'} onClick={() => setFilter('enabled')} tone="emerald">Activos</FilterPill>
        <FilterPill active={filter === 'disabled'} onClick={() => setFilter('disabled')}>Inactivos</FilterPill>
        <FilterPill active={filter === 'failed'} onClick={() => setFilter('failed')} tone="red">Con fallos</FilterPill>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-white/[0.02] rounded-2xl border border-white/[0.06]">
          <div className="w-16 h-16 mx-auto bg-red-500/10 rounded-2xl flex items-center justify-center mb-4 ring-1 ring-red-500/20">
            <Repeat className="w-8 h-8 text-red-400" />
          </div>
          <p className="text-gray-300 text-sm font-semibold">Sin autopagos que mostrar</p>
          <p className="text-gray-500 text-xs mt-1">Los inquilinos pueden activarlo desde su app móvil</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(c => {
            const isOk = c.enabled && (!c.last_attempt_status || ['succeeded', 'requires_capture', 'processing'].includes(c.last_attempt_status));
            const isFail = c.last_attempt_status === 'failed' || (c.failed_charges || 0) > 0;

            return (
              <div
                key={c.id}
                className={`relative overflow-hidden bg-white/[0.03] backdrop-blur-sm rounded-xl border p-4 transition group ${
                  c.enabled
                    ? 'border-emerald-500/20 hover:border-emerald-500/40 ring-1 ring-emerald-500/10'
                    : 'border-white/[0.06] hover:border-white/[0.10]'
                }`}
              >
                <div className={`absolute top-0 left-0 right-0 h-0.5 rounded-t-xl ${c.enabled ? 'bg-gradient-to-r from-emerald-500/40 to-transparent' : 'bg-transparent'}`} />
                <div className={`absolute -bottom-4 -right-4 w-24 h-24 rounded-full blur-2xl pointer-events-none ${c.enabled ? 'bg-emerald-500/[0.05]' : 'bg-white/[0.02]'}`} />

                <div className="relative z-10 grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-3 items-center">
                  {/* User */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ring-1 ${
                      c.enabled ? 'bg-emerald-500/15 ring-emerald-500/25' : 'bg-white/[0.06] ring-white/[0.08]'
                    }`}>
                      <Repeat className={`w-4 h-4 ${c.enabled ? 'text-emerald-400' : 'text-gray-500'}`} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-white truncate">{c.user_name || 'Sin nombre'}</span>
                        {c.enabled ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-500/10 text-emerald-400 flex items-center gap-1">
                            <CheckCircle2 className="w-2.5 h-2.5" /> Activo
                          </span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-gray-500/10 text-gray-400">Inactivo</span>
                        )}
                        {isFail && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-red-500/10 text-red-400 flex items-center gap-1">
                            <AlertTriangle className="w-2.5 h-2.5" /> {c.failed_charges} fallo(s)
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-gray-500 mt-0.5 truncate">{c.user_email}</div>
                    </div>
                  </div>

                  {/* Day + Card */}
                  <div className="flex items-center gap-4 text-xs">
                    <div className="flex flex-col items-center min-w-[60px]">
                      <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Día</span>
                      <span className="text-lg font-bold text-white">{c.day_of_month}</span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider flex items-center gap-1">
                        <CreditCard className="w-2.5 h-2.5" /> Tarjeta
                      </span>
                      <span className="font-mono text-[11px] text-gray-300">
                        {c.payment_method_id ? `••${c.payment_method_id.slice(-6)}` : 'Sin método'}
                      </span>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-3 text-xs">
                    <div className="flex flex-col items-center min-w-[50px]">
                      <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">OK</span>
                      <span className="text-base font-bold text-emerald-400">{c.successful_charges || 0}</span>
                    </div>
                    <div className="flex flex-col items-center min-w-[50px]">
                      <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Err</span>
                      <span className={`text-base font-bold ${(c.failed_charges || 0) > 0 ? 'text-red-400' : 'text-gray-500'}`}>{c.failed_charges || 0}</span>
                    </div>
                  </div>
                </div>

                {/* Last attempt info */}
                {c.last_attempt_date && (
                  <div className="relative z-10 mt-3 pt-3 border-t border-white/[0.06] flex items-center gap-3 flex-wrap text-[11px]">
                    <div className="flex items-center gap-1.5 text-gray-400">
                      <Clock className="w-3 h-3" />
                      <span>Último intento: <span className="text-gray-300">{fmtDateTime(c.last_attempt_date)}</span></span>
                    </div>
                    {c.last_attempt_status && (
                      <span className={`px-2 py-0.5 rounded-full font-bold ${
                        c.last_attempt_status === 'succeeded'
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : c.last_attempt_status === 'failed'
                            ? 'bg-red-500/10 text-red-400'
                            : 'bg-amber-500/10 text-amber-400'
                      }`}>{c.last_attempt_status}</span>
                    )}
                    {c.last_attempt_error && (
                      <div className="text-red-400 italic truncate flex-1 min-w-[150px]">
                        ⚠ {c.last_attempt_error}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-[60] max-w-md px-4 py-3 rounded-xl border backdrop-blur-xl shadow-2xl text-sm font-semibold ${
          toast.tone === 'ok'
            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 shadow-[0_0_24px_rgba(16,185,129,0.25)]'
            : 'bg-red-500/15 text-red-300 border-red-500/30 shadow-[0_0_24px_rgba(239,68,68,0.25)]'
        }`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

/* ─── Helpers ─────────────────────────────────────────── */

function StatCard({ icon, value, label, tone }: {
  icon: React.ReactNode;
  value: string;
  label: string;
  tone: 'emerald' | 'blue' | 'red' | 'violet';
}) {
  const palette = {
    emerald: { from: 'from-emerald-500/[0.10]', border: 'border-emerald-500/25', bar: 'from-emerald-500 to-emerald-400', glow: 'bg-emerald-500/[0.08]', chipBg: 'bg-emerald-500/15', chipRing: 'ring-emerald-500/25' },
    blue:    { from: 'from-blue-500/[0.10]',    border: 'border-blue-500/25',    bar: 'from-blue-500 to-blue-400',       glow: 'bg-blue-500/[0.08]',    chipBg: 'bg-blue-500/15',    chipRing: 'ring-blue-500/25' },
    red:     { from: 'from-red-500/[0.10]',     border: 'border-red-500/25',     bar: 'from-red-500 to-red-400',         glow: 'bg-red-500/[0.08]',     chipBg: 'bg-red-500/15',     chipRing: 'ring-red-500/25' },
    violet:  { from: 'from-violet-500/[0.10]',  border: 'border-violet-500/25',  bar: 'from-violet-500 to-violet-400',   glow: 'bg-violet-500/[0.08]',  chipBg: 'bg-violet-500/15',  chipRing: 'ring-violet-500/25' },
  }[tone];

  return (
    <div className={`relative overflow-hidden bg-gradient-to-br ${palette.from} to-transparent rounded-2xl border ${palette.border} p-4 group`}>
      <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${palette.bar} rounded-t-2xl`} />
      <div className={`absolute -bottom-6 -right-6 w-24 h-24 ${palette.glow} rounded-full blur-2xl pointer-events-none group-hover:scale-110 transition-transform`} />
      <div className="relative z-10">
        <div className={`w-9 h-9 rounded-lg ${palette.chipBg} flex items-center justify-center ring-1 ${palette.chipRing} mb-2`}>{icon}</div>
        <div className="text-xl font-bold text-white">{value}</div>
        <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">{label}</div>
      </div>
    </div>
  );
}

function FilterPill({ children, active, onClick, tone }: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
  tone?: 'emerald' | 'red';
}) {
  const activeStyles = tone === 'emerald'
    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
    : tone === 'red'
      ? 'bg-red-500/15 text-red-300 border-red-500/30'
      : 'bg-red-500/15 text-red-300 border-red-500/30';
  return (
    <button
      onClick={onClick}
      className={`px-3 py-2 rounded-xl text-xs font-bold border transition ${
        active ? activeStyles : 'bg-white/[0.03] text-gray-400 border-white/[0.08] hover:bg-white/[0.06]'
      }`}
    >{children}</button>
  );
}
