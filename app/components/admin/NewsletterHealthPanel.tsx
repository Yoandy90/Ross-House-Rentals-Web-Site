'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity, CheckCircle2, XCircle, UserMinus, UserPlus, TrendingDown, RefreshCw, Bot, Megaphone,
  Eye, MousePointerClick, Clock,
} from 'lucide-react';

interface Props { headers: () => HeadersInit }

export default function NewsletterHealthPanel({ headers }: Props) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/newsletter/health', { headers: headers() });
      if (res.ok) setData(await res.json());
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [headers]);

  useEffect(() => { fetchHealth(); }, [fetchHealth]);

  const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('es-US', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

  if (loading) return <div className="flex items-center justify-center h-40"><div className="w-8 h-8 border-3 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" /></div>;
  if (!data) return <p className="text-sm text-gray-500">No se pudo cargar la salud de la lista.</p>;

  const k = data.kpis || {};
  const sends = data.sends || [];
  const unsubs = data.recent_unsubscribes || [];
  const opensByHour: { hour: number; opens: number }[] = data.opens_by_hour || [];
  const recentOpens: { email: string; at: string }[] = data.recent_opens || [];
  const maxOpens = Math.max(1, ...opensByHour.map(o => o.opens));

  const kpiCards = [
    { label: 'Entregados (total)', value: k.delivered_total, color: 'text-emerald-400', Icon: CheckCircle2 },
    { label: 'Fallidos (total)', value: k.failed_total, color: 'text-red-400', Icon: XCircle },
    { label: 'Aperturas', value: k.opens_total, color: 'text-sky-400', Icon: Eye },
    { label: 'Tasa de apertura', value: `${k.open_rate ?? 0}%`, color: 'text-sky-400', Icon: Eye },
    { label: 'Clicks', value: k.clicks_total, color: 'text-fuchsia-400', Icon: MousePointerClick },
    { label: 'Rebotes', value: k.bounces_total, color: 'text-orange-400', Icon: XCircle },
    { label: 'Tasa de baja', value: `${k.unsub_rate}%`, color: 'text-amber-400', Icon: TrendingDown },
    { label: 'Nuevos (30 días)', value: k.new_30d, color: 'text-cyan-400', Icon: UserPlus },
    { label: 'Bajas (30 días)', value: k.unsub_30d, color: 'text-orange-400', Icon: UserMinus },
    { label: 'Activos', value: k.active, color: 'text-violet-400', Icon: Activity },
  ];

  return (
    <div className="space-y-6" data-testid="health-panel">
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpiCards.map(({ label, value, color, Icon }) => (
          <div key={label} className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-4">
            <div className="flex items-center gap-1.5 mb-1"><Icon className={`w-3.5 h-3.5 ${color}`} /><span className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</span></div>
            <div className={`text-xl font-bold ${color}`}>{value ?? 0}</div>
          </div>
        ))}
      </div>

      {/* Mejor horario (aperturas por hora CT) */}
      <div>
        <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
          <Clock className="w-4 h-4 text-sky-400" /> Mejor horario de apertura (hora Central TX)
          {data.best_hour_ct !== null && data.best_hour_ct !== undefined && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-300 border border-sky-500/25">
              🏆 Mejor hora: {data.best_hour_ct}:00
            </span>
          )}
        </h3>
        {opensByHour.length === 0 ? (
          <p className="text-xs text-gray-500 bg-white/[0.02] border border-white/[0.06] rounded-xl p-6 text-center">
            Aún no hay datos de aperturas — se registrarán automáticamente cuando los clientes abran los próximos emails. 📬
          </p>
        ) : (
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-4 space-y-1.5">
            {opensByHour.map(({ hour, opens }) => (
              <div key={hour} className="flex items-center gap-2">
                <span className="text-[11px] text-gray-500 w-12 text-right font-mono">{String(hour).padStart(2, '0')}:00</span>
                <div className="flex-1 h-4 bg-white/[0.03] rounded overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-sky-500 to-cyan-400 rounded" style={{ width: `${(opens / maxOpens) * 100}%` }} />
                </div>
                <span className="text-[11px] text-sky-300 w-10 font-bold">{opens}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Aperturas recientes */}
      {recentOpens.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-white mb-3">👀 Aperturas recientes (quién y cuándo)</h3>
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-left">
                  <th className="px-4 py-3 text-[11px] text-gray-500 uppercase tracking-wider">Email</th>
                  <th className="px-4 py-3 text-[11px] text-gray-500 uppercase tracking-wider">Abrió el email</th>
                </tr>
              </thead>
              <tbody>
                {recentOpens.map((o, i) => (
                  <tr key={`${o.email}-${i}`} className="border-b border-white/[0.03]">
                    <td className="px-4 py-2.5 text-gray-300">{o.email}</td>
                    <td className="px-4 py-2.5 text-gray-500 text-xs">{fmtDate(o.at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Historial de envíos */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-white">📤 Historial de envíos</h3>
          <button onClick={() => { setLoading(true); fetchHealth(); }} className="flex items-center gap-1.5 px-2.5 py-1.5 border border-white/[0.08] rounded-lg text-[11px] text-gray-400 hover:bg-white/[0.04] transition"><RefreshCw className="w-3 h-3" /> Refrescar</button>
        </div>
        {sends.length === 0 ? (
          <p className="text-xs text-gray-500 bg-white/[0.02] border border-white/[0.06] rounded-xl p-6 text-center">Aún no hay envíos — el primer drip saldrá automáticamente según la programación.</p>
        ) : (
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-left">
                  <th className="px-4 py-3 text-[11px] text-gray-500 uppercase tracking-wider">Asunto</th>
                  <th className="px-4 py-3 text-[11px] text-gray-500 uppercase tracking-wider">Tipo</th>
                  <th className="px-4 py-3 text-[11px] text-gray-500 uppercase tracking-wider text-right">Destinatarios</th>
                  <th className="px-4 py-3 text-[11px] text-gray-500 uppercase tracking-wider text-right">Entregados</th>
                  <th className="px-4 py-3 text-[11px] text-gray-500 uppercase tracking-wider text-right">Fallidos</th>
                  <th className="px-4 py-3 text-[11px] text-gray-500 uppercase tracking-wider hidden md:table-cell">Fecha</th>
                  <th className="px-4 py-3 text-[11px] text-gray-500 uppercase tracking-wider">Estado</th>
                </tr>
              </thead>
              <tbody>
                {sends.map((s: any) => (
                  <tr key={s.id} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                    <td className="px-4 py-3 text-gray-300 max-w-[280px] truncate">{s.subject}</td>
                    <td className="px-4 py-3">
                      {s.type === 'drip'
                        ? <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-300 border border-violet-500/25"><Bot className="w-3 h-3" /> Drip</span>
                        : <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-pink-500/15 text-pink-300 border border-pink-500/25"><Megaphone className="w-3 h-3" /> Manual</span>}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-400">{s.total_recipients}</td>
                    <td className="px-4 py-3 text-right text-emerald-400 font-semibold">{s.sent}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${s.failed > 0 ? 'text-red-400' : 'text-gray-600'}`}>{s.failed}</td>
                    <td className="px-4 py-3 hidden md:table-cell text-gray-500 text-xs">{fmtDate(s.created_at)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${s.status === 'sent' ? 'bg-emerald-500/15 text-emerald-300' : s.status === 'sending' ? 'bg-amber-500/15 text-amber-300' : 'bg-red-500/15 text-red-300'}`}>
                        {s.status === 'sent' ? 'Enviado' : s.status === 'sending' ? 'Enviando…' : 'Falló'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {k.failed_total > 0 && (
          <p className="text-[11px] text-amber-400/80 mt-2">⚠️ Hay envíos fallidos — revisa el límite diario de tu plan de SendGrid (plan gratuito: 100 emails/día).</p>
        )}
      </div>

      {/* Bajas recientes */}
      <div>
        <h3 className="text-sm font-bold text-white mb-3">👋 Bajas recientes</h3>
        {unsubs.length === 0 ? (
          <p className="text-xs text-gray-500 bg-white/[0.02] border border-white/[0.06] rounded-xl p-6 text-center">Sin bajas — ¡tu lista está sana! 🎉</p>
        ) : (
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-left">
                  <th className="px-4 py-3 text-[11px] text-gray-500 uppercase tracking-wider">Email</th>
                  <th className="px-4 py-3 text-[11px] text-gray-500 uppercase tracking-wider hidden sm:table-cell">Nombre</th>
                  <th className="px-4 py-3 text-[11px] text-gray-500 uppercase tracking-wider">Fecha de baja</th>
                </tr>
              </thead>
              <tbody>
                {unsubs.map((u: any) => (
                  <tr key={u.email} className="border-b border-white/[0.03]">
                    <td className="px-4 py-3 text-gray-300">{u.email}</td>
                    <td className="px-4 py-3 hidden sm:table-cell text-gray-500 text-xs">{u.name || '—'}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{fmtDate(u.unsubscribed_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
