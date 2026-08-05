'use client';

/**
 * GitHub-style activity heatmap: 7 days × 24 hours.
 * Cell colors by traffic intensity. Highlights peak times.
 */
import React, { useMemo, useState } from 'react';

interface HeatmapProps {
  matrix: number[][];           // 7 x 24
  peak: number;
  labels_days?: string[];       // Lun..Dom
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);

export default function HourlyHeatmap({ matrix, peak, labels_days }: HeatmapProps) {
  const [hover, setHover] = useState<{ d: number; h: number; v: number } | null>(null);
  const days = labels_days || ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

  const intensity = (v: number) => {
    if (peak === 0 || v === 0) return 0;
    return Math.min(1, v / peak);
  };

  const cellColor = (v: number): string => {
    const t = intensity(v);
    if (t === 0) return 'rgb(241 245 249)'; // slate-100
    // gradient: slate-200 -> indigo-400 -> indigo-700
    const r1 = 226, g1 = 232, b1 = 240; // slate-200
    const r2 = 79,  g2 = 70,  b2 = 229; // indigo-600
    const r = Math.round(r1 + (r2 - r1) * t);
    const g = Math.round(g1 + (g2 - g1) * t);
    const b = Math.round(b1 + (b2 - b1) * t);
    return `rgb(${r} ${g} ${b})`;
  };

  // Find peak slot
  const peakInfo = useMemo(() => {
    let best = { d: -1, h: -1, v: 0 };
    matrix.forEach((row, d) => row.forEach((v, h) => {
      if (v > best.v) best = { d, h, v };
    }));
    return best;
  }, [matrix]);

  return (
    <div className="select-none">
      {/* Hour labels */}
      <div className="flex items-center text-[9px] text-slate-400 font-mono mb-1 pl-8">
        {HOURS.map(h => (
          <div key={h} className="flex-1 text-center">
            {h % 3 === 0 ? `${h.toString().padStart(2, '0')}h` : ''}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="space-y-0.5">
        {matrix.map((row, d) => (
          <div key={d} className="flex items-center gap-1">
            <div className="w-7 text-[10px] text-slate-500 font-semibold tabular-nums">{days[d]}</div>
            <div className="flex-1 flex gap-0.5">
              {row.map((v, h) => {
                const isPeak = peakInfo.v > 0 && d === peakInfo.d && h === peakInfo.h;
                return (
                  <div
                    key={h}
                    onMouseEnter={() => setHover({ d, h, v })}
                    onMouseLeave={() => setHover(null)}
                    className={`flex-1 aspect-square rounded-[3px] transition ${isPeak ? 'ring-2 ring-amber-500 ring-offset-1' : ''}`}
                    style={{ backgroundColor: cellColor(v), minWidth: 0 }}
                    title={`${days[d]} ${h.toString().padStart(2, '0')}:00 — ${v} pageviews`}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Footer: legend + hover info + peak badge */}
      <div className="mt-3 flex items-center justify-between gap-3 text-[10px]">
        <div className="flex items-center gap-1.5 text-slate-500">
          <span>Menos</span>
          {[0, 0.25, 0.5, 0.75, 1].map(t => (
            <span key={t} className="w-3 h-3 rounded-sm" style={{ backgroundColor: cellColor(t * peak) }} />
          ))}
          <span>Más</span>
        </div>
        {hover && (
          <div className="text-slate-700 font-medium tabular-nums">
            {days[hover.d]} {hover.h.toString().padStart(2, '0')}:00 →
            <strong className="ml-1 text-indigo-700">{hover.v}</strong> pageviews
          </div>
        )}
        {peakInfo.v > 0 && (
          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 font-bold">
            🔥 Peak: {days[peakInfo.d]} {peakInfo.h.toString().padStart(2, '0')}:00 ({peakInfo.v})
          </div>
        )}
      </div>
    </div>
  );
}
