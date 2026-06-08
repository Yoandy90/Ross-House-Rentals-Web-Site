'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAdminAuth } from '../layout';
import {
  Wrench, Search, Clock, CheckCircle2, AlertTriangle, XCircle,
  ChevronDown, ChevronUp, Home, Users, Calendar, MessageSquare,
  RefreshCw, Filter, Phone, Mail, Camera, Star,
} from 'lucide-react';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; icon: any }> = {
  pending:     { label: 'Pendiente',   color: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/20', icon: Clock },
  in_progress: { label: 'En Progreso', color: 'text-blue-400',    bg: 'bg-blue-500/10',    border: 'border-blue-500/20',  icon: Wrench },
  completed:   { label: 'Completado',  color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', icon: CheckCircle2 },
  cancelled:   { label: 'Cancelado',   color: 'text-gray-400',    bg: 'bg-gray-500/10',    border: 'border-gray-500/20',  icon: XCircle },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  low:       { label: 'Baja',      color: 'text-gray-400',    bg: 'bg-gray-500/10' },
  medium:    { label: 'Media',     color: 'text-amber-400',   bg: 'bg-amber-500/10' },
  high:      { label: 'Alta',      color: 'text-orange-400',  bg: 'bg-orange-500/10' },
  emergency: { label: 'Emergencia', color: 'text-red-400',    bg: 'bg-red-500/10' },
};

export default function MantenimientoPage() {
  const { headers } = useAdminAuth();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/maintenance-requests', { headers: headers() });
      if (res.ok) { const d = await res.json(); setRequests(d.requests || []); }
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const updateStatus = async (id: string, status: string) => {
    setUpdating(id);
    try {
      const res = await fetch(`/api/admin/maintenance-requests/${id}`, {
        method: 'PUT', headers: headers(), body: JSON.stringify({ status }),
      });
      if (res.ok) fetchRequests();
    } catch (e) { console.error(e); }
    setUpdating(null);
  };

  const filtered = requests.filter(r => {
    const matchSearch = !search || 
      (r.title || '').toLowerCase().includes(search.toLowerCase()) ||
      (r.tenant_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (r.property_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (r.description || '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || r.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const stats = {
    total: requests.length,
    pending: requests.filter(r => r.status === 'pending').length,
    in_progress: requests.filter(r => r.status === 'in_progress').length,
    completed: requests.filter(r => r.status === 'completed').length,
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-3 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-5 relative">
      <div className="fixed top-0 left-1/3 w-96 h-96 bg-amber-500/[0.02] rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500/20 to-amber-500/5 border border-amber-500/20 flex items-center justify-center">
          <Wrench className="w-6 h-6 text-amber-400" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-white">Mantenimiento</h2>
          <p className="text-sm text-gray-500">Solicitudes de reparación y mantenimiento</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total" value={stats.total} color="gray" icon={Wrench} />
        <StatCard label="Pendientes" value={stats.pending} color="amber" icon={Clock} alert={stats.pending > 0} />
        <StatCard label="En Progreso" value={stats.in_progress} color="blue" icon={Wrench} />
        <StatCard label="Completados" value={stats.completed} color="emerald" icon={CheckCircle2} />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white/[0.03] border border-white/[0.08] rounded-xl text-white text-sm focus:border-amber-500 focus:outline-none"
            placeholder="Buscar por título, inquilino, propiedad..." />
        </div>
        <div className="flex gap-1 bg-white/[0.03] rounded-xl p-1 border border-white/[0.06]">
          {[{ key: 'all', label: 'Todos' }, ...Object.entries(STATUS_CONFIG).map(([k, v]) => ({ key: k, label: v.label }))].map(s => (
            <button key={s.key} onClick={() => setStatusFilter(s.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition whitespace-nowrap ${
                statusFilter === s.key ? 'bg-amber-500/15 text-amber-400 border border-amber-500/25' : 'text-gray-500 hover:text-gray-300'
              }`}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Requests List */}
      {filtered.length === 0 ? (
        <div className="bg-white/[0.03] rounded-2xl border border-white/[0.06] p-12 text-center">
          <Wrench className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500">{search || statusFilter !== 'all' ? 'No se encontraron solicitudes con esos filtros' : 'No hay solicitudes de mantenimiento'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(req => {
            const st = STATUS_CONFIG[req.status] || STATUS_CONFIG.pending;
            const pr = PRIORITY_CONFIG[req.priority] || PRIORITY_CONFIG.medium;
            const isExpanded = expanded === req._id;
            const StIcon = st.icon;

            return (
              <div key={req._id} className={`bg-white/[0.03] backdrop-blur-sm rounded-2xl border transition hover:border-white/[0.12] ${isExpanded ? 'border-amber-500/20' : 'border-white/[0.06]'}`}>
                {/* Main row */}
                <div className="p-4 flex items-center gap-3 cursor-pointer" onClick={() => setExpanded(isExpanded ? null : req._id)}>
                  <div className={`w-10 h-10 rounded-xl ${st.bg} ${st.border} border flex items-center justify-center flex-shrink-0`}>
                    <StIcon className={`w-5 h-5 ${st.color}`} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-bold text-white truncate">{req.title || 'Sin título'}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${pr.bg} ${pr.color}`}>{pr.label}</span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-gray-500">
                      <span className="flex items-center gap-1"><Home className="w-3 h-3" /> {req.property_name || 'N/A'}</span>
                      <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {req.tenant_name || 'N/A'}</span>
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {req.created_at ? new Date(req.created_at).toLocaleDateString('es-US') : ''}</span>
                    </div>
                  </div>

                  <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold ${st.bg} ${st.color} ${st.border} border hidden sm:block`}>{st.label}</span>
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="border-t border-white/[0.06] p-4 space-y-3">
                    {req.description && (
                      <div>
                        <p className="text-xs font-bold text-gray-400 mb-1">Descripción:</p>
                        <p className="text-sm text-gray-300 leading-relaxed">{req.description}</p>
                      </div>
                    )}

                    {(req.photos || []).length > 0 && (
                      <div>
                        <p className="text-xs font-bold text-gray-400 mb-2 flex items-center gap-1"><Camera className="w-3 h-3" /> Fotos ({req.photos.length}):</p>
                        <div className="flex gap-2 flex-wrap">
                          {req.photos.map((p: string, i: number) => (
                            <img key={i} src={p} alt="" className="w-20 h-20 object-cover rounded-lg border border-white/[0.06]" />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Contact info */}
                    <div className="flex flex-wrap gap-3">
                      {req.tenant_phone && (
                        <a href={`tel:${req.tenant_phone}`} className="flex items-center gap-1.5 text-xs text-cyan-400 bg-cyan-500/5 px-3 py-1.5 rounded-lg border border-cyan-500/15 hover:bg-cyan-500/10 transition">
                          <Phone className="w-3 h-3" /> {req.tenant_phone}
                        </a>
                      )}
                      {req.tenant_email && (
                        <a href={`mailto:${req.tenant_email}`} className="flex items-center gap-1.5 text-xs text-blue-400 bg-blue-500/5 px-3 py-1.5 rounded-lg border border-blue-500/15 hover:bg-blue-500/10 transition">
                          <Mail className="w-3 h-3" /> {req.tenant_email}
                        </a>
                      )}
                    </div>

                    {/* Status actions */}
                    <div className="flex items-center gap-2 pt-2 border-t border-white/[0.04]">
                      <span className="text-xs text-gray-500 mr-2">Cambiar estado:</span>
                      {Object.entries(STATUS_CONFIG).filter(([k]) => k !== req.status).map(([key, cfg]) => (
                        <button key={key} onClick={() => updateStatus(req._id, key)} disabled={updating === req._id}
                          className={`text-xs px-3 py-1.5 rounded-lg font-medium transition border ${cfg.bg} ${cfg.color} ${cfg.border} hover:opacity-80 disabled:opacity-30`}>
                          {updating === req._id ? '...' : cfg.label}
                        </button>
                      ))}
                    </div>

                    {req.admin_notes && (
                      <div className="mt-2">
                        <p className="text-xs font-bold text-gray-400 mb-1 flex items-center gap-1"><MessageSquare className="w-3 h-3" /> Notas Admin:</p>
                        <p className="text-sm text-gray-400 italic">{req.admin_notes}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color, icon: Icon, alert }: { label: string; value: number; color: string; icon: any; alert?: boolean }) {
  return (
    <div className={`bg-white/[0.03] rounded-xl border border-white/[0.06] p-3 flex items-center gap-3 ${alert ? 'border-amber-500/20' : ''}`}>
      <div className={`w-9 h-9 rounded-lg bg-${color}-500/10 flex items-center justify-center`}>
        <Icon className={`w-4 h-4 text-${color}-400`} />
      </div>
      <div>
        <div className={`text-lg font-bold ${alert ? 'text-amber-400' : 'text-white'}`}>{value}</div>
        <div className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">{label}</div>
      </div>
    </div>
  );
}
