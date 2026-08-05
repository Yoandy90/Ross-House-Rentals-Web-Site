'use client';

/**
 * Top Movers Widget
 * =================
 * Compact grid of "biggest deltas" for pages, countries, referrers and devices.
 * Highlights new entrants and growth/decline vs previous period.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight,
  Star, FileText, Globe, MousePointer, Monitor,
} from 'lucide-react';

interface Row {
  key: string;
  current: number;
  previous: number;
  delta_pct: number | null;
  delta_abs: number;
  kind: 'new' | 'up' | 'down' | 'flat';
}

interface Response {
  range: string;
  pages: Row[];
  countries: Row[];
  referrers: Row[];
  devices: Row[];
}

interface Props {
  range: string;
  token: string;
}

const DIMENSION_META = {
  pages:     { title: 'Páginas top',   icon: <FileText className="w-4 h-4" />,     accent: 'from-blue-500/20 to-cyan-500/10',   dim: 'blue' },
  countries: { title: 'Países',        icon: <Globe className="w-4 h-4" />,        accent: 'from-emerald-500/20 to-lime-500/10', dim: 'emerald' },
  referrers: { title: 'Fuentes',       icon: <MousePointer className="w-4 h-4" />, accent: 'from-fuchsia-500/20 to-pink-500/10', dim: 'fuchsia' },
  devices:   { title: 'Dispositivos',  icon: <Monitor className="w-4 h-4" />,      accent: 'from-amber-500/20 to-orange-500/10', dim: 'amber' },
} as const;

function flagEmoji(cc?: string): string {
  if (!cc || cc.length !== 2) return '';
  const base = 0x1f1e6;
  return String.fromCodePoint(
    base + (cc.toUpperCase().charCodeAt(0) - 65),
    base + (cc.toUpperCase().charCodeAt(1) - 65),
  );
}

// Attempt a flag from country name (rough guess for common countries)
const COUNTRY_TO_CC: Record<string, string> = {
  'United States': 'US', 'Mexico': 'MX', 'Cuba': 'CU', 'Colombia': 'CO',
  'Spain': 'ES', 'Argentina': 'AR', 'Chile': 'CL', 'Peru': 'PE',
  'Venezuela': 'VE', 'Ecuador': 'EC', 'Guatemala': 'GT', 'Honduras': 'HN',
  'Costa Rica': 'CR', 'Panama': 'PA', 'Dominican Republic': 'DO',
  'Canada': 'CA', 'Brazil': 'BR', 'Uruguay': 'UY',
};

export default function TopMoversWidget({ range, token }: Props) {
  const [data, setData] = useState<Response | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/analytics/top-movers?range=${encodeURIComponent(range)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setData(await res.json());
    } catch { /* noop */ }
    setLoading(false);
  }, [range, token]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading || !data) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="rounded-2xl p-4 bg-white/[0.03] border border-white/[0.06] h-40 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
      {(['pages', 'countries', 'referrers', 'devices'] as const).map((dim) => (
        <MoverCard
          key={dim}
          dim={dim}
          rows={data[dim] || []}
        />
      ))}
    </div>
  );
}

function MoverCard({ dim, rows }: { dim: keyof typeof DIMENSION_META; rows: Row[] }) {
  const meta = DIMENSION_META[dim];
  const hasData = rows.length > 0;

  return (
    <div className={`relative rounded-2xl p-4 bg-white/[0.03] border border-white/[0.06] overflow-hidden group hover:border-white/[0.12] transition`}>
      <div className={`absolute inset-0 bg-gradient-to-br ${meta.accent} opacity-40 pointer-events-none`} />
      <div className="relative">
        <div className="flex items-center gap-2 mb-3">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center bg-white/[0.06] text-slate-200`}>
            {meta.icon}
          </div>
          <span className="text-[11px] font-black uppercase tracking-wider text-slate-300">{meta.title}</span>
        </div>

        {!hasData && (
          <div className="text-[11px] text-slate-500 py-4 text-center">
            Sin cambios significativos
          </div>
        )}

        <div className="space-y-2">
          {rows.slice(0, 4).map((r, i) => {
            const label = dim === 'countries'
              ? `${flagEmoji(COUNTRY_TO_CC[r.key]) || '🌐'} ${r.key || '—'}`
              : (r.key || '—');
            return (
              <div key={i} className="flex items-center justify-between gap-2 group/row">
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  {r.kind === 'new' && <Star className="w-3 h-3 text-amber-400 shrink-0" fill="currentColor" />}
                  <span className="text-[11px] font-semibold text-slate-100 truncate">{label}</span>
                </div>
                <DeltaBadge row={r} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function DeltaBadge({ row }: { row: Row }) {
  if (row.kind === 'new') {
    return (
      <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-500 text-amber-950 uppercase whitespace-nowrap">
        Nuevo · {row.current}
      </span>
    );
  }
  if (row.delta_pct == null) {
    return <span className="text-[10px] text-slate-500">—</span>;
  }
  const up = (row.delta_abs || 0) > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap ${
      up ? 'text-emerald-400 bg-emerald-500/10' : 'text-rose-400 bg-rose-500/10'
    }`}>
      {up ? <ArrowUpRight className="w-2.5 h-2.5" /> : <ArrowDownRight className="w-2.5 h-2.5" />}
      {up ? '+' : ''}{row.delta_pct}%
    </span>
  );
}
