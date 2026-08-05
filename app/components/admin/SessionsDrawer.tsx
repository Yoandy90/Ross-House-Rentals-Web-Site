'use client';

/** Sessions drill-down drawer with full event trail. */
import React, { useEffect, useState } from 'react';
import { X, Globe, Monitor, Smartphone, Tablet, MousePointer, ExternalLink, Clock, Loader2 } from 'lucide-react';

interface Event {
  ts: string;
  type: 'page' | 'event';
  path?: string;
  title?: string;
  event_name?: string;
  event_data?: any;
  duration_ms?: number;
  scroll_pct?: number;
}

interface Session {
  _id: string;
  first_seen: string;
  last_seen: string;
  country?: string;
  country_code?: string;
  city?: string;
  device?: string;
  browser?: string;
  os?: string;
  pages_count?: number;
  events_count?: number;
  referrer_host?: string;
  landing_path?: string;
  user_agent?: string;
  lead_id?: string;
}

const DEVICE_ICONS: Record<string, React.ReactNode> = {
  Desktop: <Monitor className="w-3.5 h-3.5" />,
  Mobile:  <Smartphone className="w-3.5 h-3.5" />,
  Tablet:  <Tablet className="w-3.5 h-3.5" />,
};

function flag(cc?: string | null): string {
  if (!cc || cc.length !== 2) return '🌐';
  const base = 0x1f1e6;
  return String.fromCodePoint(
    base + (cc.toUpperCase().charCodeAt(0) - 65),
    base + (cc.toUpperCase().charCodeAt(1) - 65),
  );
}

function timeAgo(iso: string): string {
  const d = new Date(iso).getTime();
  const diff = (Date.now() - d) / 1000;
  if (diff < 60) return `${Math.round(diff)}s`;
  if (diff < 3600) return `${Math.round(diff / 60)}m`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h`;
  return `${Math.round(diff / 86400)}d`;
}

export default function SessionsDrawer({
  sessionId, token, onClose,
}: {
  sessionId: string;
  token: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<{ session: Session; events: Event[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`/api/admin/analytics/sessions/${sessionId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (r.ok) setData(await r.json());
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    })();
  }, [sessionId, token]);

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md bg-white shadow-2xl overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-gradient-to-br from-slate-900 to-slate-800 text-white px-5 py-4 flex items-center justify-between">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Sesión</div>
            <div className="text-sm font-bold truncate">{sessionId}</div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10">
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="p-10 flex items-center justify-center text-slate-500">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : !data ? (
          <div className="p-10 text-center text-slate-400 text-sm">No se pudo cargar.</div>
        ) : (
          <>
            {/* Info card */}
            <div className="p-4 bg-slate-50 border-b border-slate-100 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Info label="Inicio"     value={new Date(data.session.first_seen).toLocaleString('es-MX')} />
                <Info label="Última vez" value={new Date(data.session.last_seen).toLocaleString('es-MX')} />
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <Badge>
                  <span className="text-base mr-1">{flag(data.session.country_code)}</span>
                  {data.session.city || data.session.country || 'Desconocido'}
                </Badge>
                <Badge>
                  {DEVICE_ICONS[data.session.device || ''] || <Monitor className="w-3.5 h-3.5" />}
                  <span className="ml-1">{data.session.device}</span>
                </Badge>
                <Badge>{data.session.browser}</Badge>
                <Badge>{data.session.os}</Badge>
                {data.session.lead_id && (
                  <Badge tone="amber">🎯 LEAD</Badge>
                )}
              </div>
              <div className="flex items-center gap-3 text-[11px] text-slate-600">
                <span><strong className="text-slate-900">{data.session.pages_count || 0}</strong> pageviews</span>
                <span><strong className="text-slate-900">{data.session.events_count || 0}</strong> eventos</span>
                {data.session.referrer_host && (
                  <span className="truncate">desde <strong className="text-slate-900">{data.session.referrer_host}</strong></span>
                )}
              </div>
            </div>

            {/* Event trail */}
            <div className="p-4">
              <h3 className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-3">
                Rastro de actividad ({data.events.length})
              </h3>
              {data.events.length === 0 ? (
                <p className="text-xs text-slate-400">Sin eventos registrados.</p>
              ) : (
                <ol className="space-y-2 relative border-l-2 border-slate-100 pl-4">
                  {data.events.map((e, i) => (
                    <li key={i} className="relative">
                      <span className={`absolute -left-[1.4rem] top-1 w-3 h-3 rounded-full border-2 border-white ${
                        e.type === 'page' ? 'bg-indigo-500' : 'bg-amber-500'
                      } shadow`} />
                      <div className="text-[11px] text-slate-400 flex items-center gap-1 mb-0.5">
                        <Clock className="w-2.5 h-2.5" />
                        {new Date(e.ts).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        <span className="ml-auto text-slate-300">{timeAgo(e.ts)} atrás</span>
                      </div>
                      {e.type === 'page' ? (
                        <div className="bg-slate-50 rounded-lg p-2.5 border border-slate-100">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <Globe className="w-3 h-3 text-indigo-500 shrink-0" />
                            <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider">Pageview</span>
                          </div>
                          <div className="font-mono text-[11px] text-slate-800 truncate">{e.path}</div>
                          {e.title && <div className="text-[10px] text-slate-500 truncate">{e.title}</div>}
                          {(e.duration_ms || e.scroll_pct) ? (
                            <div className="mt-1 flex gap-3 text-[10px] text-slate-500">
                              {e.duration_ms ? <span>⏱ {Math.round(e.duration_ms / 1000)}s</span> : null}
                              {e.scroll_pct ? <span>↕ scroll {e.scroll_pct}%</span> : null}
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <div className="bg-amber-50 rounded-lg p-2.5 border border-amber-100">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <MousePointer className="w-3 h-3 text-amber-600 shrink-0" />
                            <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Event · {e.event_name}</span>
                          </div>
                          {e.path && <div className="font-mono text-[11px] text-slate-700 truncate">{e.path}</div>}
                          {e.event_data && Object.keys(e.event_data).length > 0 && (
                            <pre className="mt-1 text-[10px] bg-white rounded p-1.5 text-slate-600 overflow-x-auto">{JSON.stringify(e.event_data, null, 0)}</pre>
                          )}
                        </div>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </div>

            {/* User Agent footer */}
            {data.session.user_agent && (
              <div className="px-4 pb-4">
                <details className="text-[10px]">
                  <summary className="cursor-pointer text-slate-400 hover:text-slate-600">User Agent</summary>
                  <code className="block mt-1 bg-slate-50 p-2 rounded text-slate-600 break-all">{data.session.user_agent}</code>
                </details>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">{label}</div>
      <div className="text-[11px] text-slate-800 font-medium">{value}</div>
    </div>
  );
}

function Badge({ children, tone }: { children: React.ReactNode; tone?: 'amber' }) {
  const cls = tone === 'amber'
    ? 'bg-amber-100 text-amber-700 border-amber-200'
    : 'bg-white text-slate-700 border-slate-200';
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 text-[10px] rounded-md border font-semibold ${cls}`}>
      {children}
    </span>
  );
}
