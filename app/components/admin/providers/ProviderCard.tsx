'use client';

import React from 'react';
import { Star, Building2, Phone, DollarSign, Shield } from 'lucide-react';
import { STATUS_CFG, SERVICE_ICONS, SERVICE_LABELS, type Provider, type Status } from './constants';

export default function ProviderCard({ provider: p, onSelect }: { provider: Provider; onSelect: (p: Provider) => void }) {
  const cfg = STATUS_CFG[p.status as Status] || STATUS_CFG.pending_review;
  return (
    <div onClick={() => onSelect(p)} className="bg-white/[0.04] hover:bg-white/[0.07] border border-white/10 hover:border-amber-500/30 rounded-2xl p-4 cursor-pointer transition group">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <div className="font-bold text-white truncate flex items-center gap-1.5">
            {p.is_featured && <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />}
            {p.name}
          </div>
          {p.company_name && <div className="text-xs text-gray-500 truncate flex items-center gap-1"><Building2 className="w-3 h-3" /> {p.company_name}</div>}
        </div>
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${cfg.color}`}>{cfg.label}</span>
      </div>

      <div className="flex flex-wrap gap-1 mb-3">
        {(p.services || []).slice(0, 4).map((s: string) => (
          <span key={s} className="px-2 py-0.5 rounded-full text-[10px] bg-white/5 border border-white/10 text-gray-300">
            {SERVICE_ICONS[s]} {SERVICE_LABELS[s] || s}
          </span>
        ))}
        {p.services?.length > 4 && <span className="text-[10px] text-gray-500">+{p.services.length - 4}</span>}
      </div>

      <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
        <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {p.phone}</span>
        {p.hourly_rate > 0 && <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" /> ${p.hourly_rate}/hr</span>}
      </div>

      <div className="flex items-center justify-between text-[10px] text-gray-500">
        <span className="flex items-center gap-1">
          <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
          {(p.rating || 0).toFixed(1)} · {p.completed_jobs || 0} jobs
        </span>
        {p.has_insurance && <span className="flex items-center gap-1 text-emerald-400"><Shield className="w-3 h-3" /> Seguro</span>}
      </div>
    </div>
  );
}
