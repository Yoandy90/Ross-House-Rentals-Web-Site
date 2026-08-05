'use client';

/**
 * Premium minimalistic world map for visitor analytics.
 *
 * Uses a hand-drawn simplified SVG of the continents (rough but recognizable)
 * with bubbles plotted via equirectangular projection.
 * No external dependencies. ~6 KB.
 */
import React, { useMemo, useState } from 'react';

// Equirectangular projection: lon/lat -> viewBox coords (1000 x 500)
function project(lat: number, lon: number): [number, number] {
  const x = ((lon + 180) / 360) * 1000;
  const y = ((90 - lat) / 180) * 500;
  return [x, y];
}

interface CityPoint {
  city?: string | null;
  country?: string | null;
  country_code?: string | null;
  lat?: number | null;
  lon?: number | null;
  sessions: number;
  leads?: number;
}

interface LiveDot {
  session_id: string;
  city?: string | null;
  country?: string | null;
  country_code?: string | null;
  lat?: number | null;
  lon?: number | null;
  current_path?: string | null;
  lead_id?: string | null;
}

export default function WorldMap({ cities, liveSessions }: { cities: CityPoint[]; liveSessions?: LiveDot[] }) {
  const [hover, setHover] = useState<CityPoint | null>(null);
  const valid = useMemo(
    () => cities.filter(c => c.lat != null && c.lon != null && c.sessions > 0),
    [cities],
  );
  const liveValid = useMemo(
    () => (liveSessions || []).filter(s => s.lat != null && s.lon != null),
    [liveSessions],
  );
  const maxSessions = useMemo(
    () => Math.max(...valid.map(c => c.sessions), 1),
    [valid],
  );

  return (
    <div className="relative w-full">
      <svg
        viewBox="0 0 1000 500"
        className="w-full h-auto rounded-xl"
        style={{
          background:
            'radial-gradient(ellipse at center, #0f172a 0%, #020617 100%)',
        }}
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Grid graticules */}
        <g stroke="#1e293b" strokeWidth="0.3" fill="none" opacity="0.6">
          {[-60, -30, 0, 30, 60].map(lat => (
            <line key={`lat-${lat}`} x1="0" y1={((90 - lat) / 180) * 500} x2="1000" y2={((90 - lat) / 180) * 500} />
          ))}
          {[-150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150].map(lon => (
            <line key={`lon-${lon}`} x1={((lon + 180) / 360) * 1000} y1="0" x2={((lon + 180) / 360) * 1000} y2="500" />
          ))}
        </g>

        {/* Continents — simplified polygons via lon/lat polygons */}
        <g fill="#1e293b" stroke="#334155" strokeWidth="0.6" opacity="0.85">
          {/* North America */}
          <path d="M 160 130 L 200 95 L 260 80 L 320 95 L 340 130 L 320 175 L 310 205 L 280 230 L 250 245 L 220 245 L 195 230 L 180 210 L 165 185 L 155 160 Z" />
          {/* Central America */}
          <path d="M 250 245 L 280 260 L 295 280 L 285 290 L 265 285 L 255 270 Z" />
          {/* South America */}
          <path d="M 305 290 L 330 285 L 355 310 L 365 350 L 360 395 L 340 425 L 320 430 L 305 410 L 300 370 L 305 330 Z" />
          {/* Greenland */}
          <path d="M 380 80 L 410 70 L 425 90 L 415 115 L 390 115 L 380 100 Z" />
          {/* Europe */}
          <path d="M 460 110 L 490 100 L 525 110 L 545 130 L 540 155 L 510 165 L 480 160 L 465 145 L 455 130 Z" />
          {/* Africa */}
          <path d="M 480 175 L 525 170 L 560 195 L 580 230 L 575 280 L 555 320 L 530 355 L 510 360 L 495 340 L 485 305 L 475 265 L 470 220 Z" />
          {/* Middle East */}
          <path d="M 560 175 L 595 175 L 605 195 L 595 215 L 575 210 L 560 195 Z" />
          {/* Asia */}
          <path d="M 545 105 L 620 90 L 700 95 L 780 115 L 810 145 L 820 180 L 800 210 L 760 220 L 720 215 L 680 220 L 640 215 L 605 195 L 585 175 L 565 155 L 550 130 Z" />
          {/* India */}
          <path d="M 660 195 L 690 200 L 705 230 L 700 260 L 680 270 L 665 255 L 655 230 Z" />
          {/* SE Asia */}
          <path d="M 760 215 L 800 220 L 825 245 L 820 270 L 795 275 L 780 260 L 770 240 Z" />
          {/* Australia */}
          <path d="M 800 320 L 855 315 L 890 340 L 895 365 L 870 380 L 830 380 L 805 365 L 795 345 Z" />
          {/* New Zealand */}
          <path d="M 900 385 L 915 380 L 920 395 L 910 405 L 895 400 Z" />
          {/* Japan */}
          <path d="M 825 145 L 840 140 L 850 155 L 845 175 L 830 175 L 822 160 Z" />
          {/* UK */}
          <path d="M 460 115 L 475 115 L 478 135 L 465 138 L 458 125 Z" />
          {/* Scandinavia */}
          <path d="M 500 75 L 525 70 L 540 95 L 525 110 L 510 100 Z" />
          {/* Russia far east */}
          <path d="M 810 90 L 880 90 L 920 105 L 945 130 L 935 150 L 905 155 L 870 145 L 830 135 L 815 115 Z" />
          {/* Indonesia/Malaysia */}
          <path d="M 770 280 L 810 280 L 830 290 L 820 300 L 780 295 Z" />
          {/* Philippines */}
          <path d="M 815 240 L 825 245 L 830 265 L 818 268 L 812 255 Z" />
          {/* Madagascar */}
          <path d="M 590 320 L 605 320 L 612 350 L 600 370 L 590 360 Z" />
          {/* Iceland */}
          <path d="M 440 100 L 455 98 L 462 110 L 450 115 L 442 108 Z" />
        </g>

        {/* Bubbles */}
        {valid.map((c, i) => {
          const [x, y] = project(c.lat as number, c.lon as number);
          const ratio = Math.max(0.18, c.sessions / maxSessions);
          const r = 4 + ratio * 14;
          const hasLeads = (c.leads || 0) > 0;
          return (
            <g
              key={`${c.city}-${i}`}
              transform={`translate(${x},${y})`}
              onMouseEnter={() => setHover(c)}
              onMouseLeave={() => setHover(null)}
              style={{ cursor: 'pointer' }}
            >
              {/* Pulsing outer ring */}
              <circle r={r + 5} fill={hasLeads ? '#fbbf24' : '#10b981'} fillOpacity="0.12">
                <animate attributeName="r" from={r + 2} to={r + 8} dur="2s" repeatCount="indefinite" />
                <animate attributeName="opacity" from="0.4" to="0" dur="2s" repeatCount="indefinite" />
              </circle>
              {/* Outer halo */}
              <circle r={r + 2} fill={hasLeads ? '#fbbf24' : '#10b981'} fillOpacity="0.25" />
              {/* Solid bubble */}
              <circle
                r={r}
                fill={hasLeads ? '#fbbf24' : '#34d399'}
                stroke="white"
                strokeWidth="1.2"
                strokeOpacity="0.9"
              />
              {/* Session count label */}
              <text
                textAnchor="middle"
                dy="0.35em"
                fontSize={Math.max(8, r * 0.85)}
                fontWeight="700"
                fill={hasLeads ? '#78350f' : '#064e3b'}
                style={{ pointerEvents: 'none' }}
              >
                {c.sessions}
              </text>
            </g>
          );
        })}

        {/* LIVE dots (visitors online right now) */}
        {liveValid.map((s, i) => {
          const [x, y] = project(s.lat as number, s.lon as number);
          return (
            <g key={`live-${s.session_id}-${i}`} transform={`translate(${x},${y})`} style={{ pointerEvents: 'none' }}>
              <circle r="14" fill="#ef4444" fillOpacity="0.18">
                <animate attributeName="r" from="6" to="18" dur="1.4s" repeatCount="indefinite" />
                <animate attributeName="opacity" from="0.55" to="0" dur="1.4s" repeatCount="indefinite" />
              </circle>
              <circle r="3.5" fill="#ef4444" stroke="white" strokeWidth="1.2" />
            </g>
          );
        })}

        {/* Tooltip */}
        {hover && hover.lat != null && hover.lon != null && (() => {
          const [tx, ty] = project(hover.lat, hover.lon);
          const text = `${hover.city || 'Desconocido'} · ${hover.country || ''}`;
          const w = Math.max(text.length * 7, 80);
          // keep tooltip inside viewbox
          const left = Math.min(Math.max(tx - w / 2, 5), 1000 - w - 5);
          const top = Math.max(ty - 50, 8);
          return (
            <g style={{ pointerEvents: 'none' }}>
              <rect x={left} y={top} width={w} height={36} rx={6} fill="#0f172a" stroke="#22d3ee" strokeWidth="0.6" opacity="0.95" />
              <text x={left + w / 2} y={top + 15} textAnchor="middle" fontSize="10" fontWeight="700" fill="white">{text}</text>
              <text x={left + w / 2} y={top + 28} textAnchor="middle" fontSize="9" fill="#67e8f9">
                {hover.sessions} sesiones{hover.leads ? ` · ${hover.leads} lead${hover.leads === 1 ? '' : 's'}` : ''}
              </text>
            </g>
          );
        })()}
      </svg>

      {/* Legend */}
      <div className="absolute bottom-2 right-2 flex items-center gap-3 bg-slate-900/60 backdrop-blur-sm rounded-lg px-2.5 py-1.5 text-[10px] text-slate-200 border border-slate-700/50">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span>Visitas</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-amber-400" />
          <span>Con leads</span>
        </div>
      </div>

      {valid.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-xs">
          Sin coordenadas para graficar todavía.
        </div>
      )}
    </div>
  );
}
