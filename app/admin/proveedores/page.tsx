'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useAdminAuth } from '../layout';
import ProviderRecruitPanel from '../../components/admin/ProviderRecruitPanel';
import {
  Wrench, Search, Download, Settings as SettingsIcon, Eye, Loader2,
} from 'lucide-react';
import {
  STATUS_CFG, SERVICE_ICONS, SERVICE_LABELS,
  type Provider, type Status,
} from '../../components/admin/providers/constants';
import { StatCard } from '../../components/admin/providers/ui';
import ProviderCard from '../../components/admin/providers/ProviderCard';
import ProviderDetailDrawer from '../../components/admin/providers/ProviderDetailDrawer';
import SettingsModal from '../../components/admin/providers/SettingsModal';

export default function ProveedoresPage() {
  const { token, headers } = useAdminAuth();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [stats, setStats] = useState<any>({ by_status: {}, by_service: {}, total: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterService, setFilterService] = useState<string>('');
  const [selected, setSelected] = useState<Provider | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const fetchProviders = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus !== 'all') params.set('status', filterStatus);
      if (filterService) params.set('service', filterService);
      if (search) params.set('search', search);
      const res = await fetch(`/api/admin/service-providers?${params}`, { headers: headers() });
      const data = await res.json();
      setProviders(data.providers || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [filterStatus, filterService, search, token, headers]);

  const fetchStats = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/admin/service-providers/stats', { headers: headers() });
      const data = await res.json();
      setStats(data);
    } catch (e) { console.error(e); }
  }, [token, headers]);

  useEffect(() => { fetchProviders(); fetchStats(); }, [fetchProviders, fetchStats]);

  return (
    <div className="min-h-screen bg-[#070B14] text-white">
      <div className="border-b border-white/10 bg-[#0a1020]/80 backdrop-blur-xl sticky top-0 z-30">
        <div className="px-6 py-5 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
              <Wrench className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Proveedores de Servicios</h1>
              <p className="text-xs text-gray-500">Plomeros · Electricistas · HVAC · Más</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => setShowSettings(true)} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 hover:border-white/20 text-sm">
              <SettingsIcon className="w-4 h-4" /> Configuración
            </button>
            <a href="/api/admin/service-providers/export/csv" className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 hover:border-white/20 text-sm">
              <Download className="w-4 h-4" /> CSV
            </a>
            <a href="/proveedores" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 hover:bg-amber-500/20 text-sm">
              <Eye className="w-4 h-4" /> Ver formulario público
            </a>
          </div>
        </div>

        <div className="px-6 pb-5 grid grid-cols-2 md:grid-cols-5 gap-2">
          <StatCard label="Total" value={stats.total || 0} color="text-white" />
          {(['active', 'pending_review', 'paused', 'blacklisted'] as Status[]).map(s => (
            <StatCard key={s} label={STATUS_CFG[s].label} value={stats.by_status?.[s] || 0} color={STATUS_CFG[s].color.split(' ')[1]} />
          ))}
        </div>
      </div>

      {/* Recruit / share panel */}
      <div className="px-6 pt-5">
        <ProviderRecruitPanel token={token} />
      </div>

      {/* Filters */}
      <div className="px-6 py-4 border-b border-white/5 flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..." className="w-full pl-9 pr-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:border-amber-500 outline-none" />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm">
          <option value="all">Todos los estados</option>
          {Object.entries(STATUS_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={filterService} onChange={e => setFilterService(e.target.value)} className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm">
          <option value="">Todos los servicios</option>
          {Object.entries(SERVICE_LABELS).map(([k, v]) => <option key={k} value={k}>{SERVICE_ICONS[k]} {v}</option>)}
        </select>
      </div>

      <div className="p-6">
        {loading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-gray-500" /></div>
        ) : providers.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-20 h-20 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto mb-4">
              <Wrench className="w-10 h-10 text-amber-400" />
            </div>
            <h3 className="text-lg font-bold mb-2">Aún no hay proveedores</h3>
            <p className="text-gray-400 text-sm mb-6">Comparte el formulario público en redes sociales para empezar.</p>
            <a href="/proveedores" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 text-sm">
              <Eye className="w-4 h-4" /> Ver formulario público
            </a>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {providers.map(p => <ProviderCard key={p._id} provider={p} onSelect={setSelected} />)}
          </div>
        )}
      </div>

      {selected && <ProviderDetailDrawer provider={selected} onClose={() => setSelected(null)} onUpdate={fetchProviders} />}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  );
}
