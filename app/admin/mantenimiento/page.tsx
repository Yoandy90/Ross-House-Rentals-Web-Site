'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAdminAuth } from '../layout';
import {
  Wrench, Search, Clock, CheckCircle2, AlertTriangle, XCircle,
  ChevronDown, ChevronUp, Home, Users, Calendar, MessageSquare,
  RefreshCw, Filter, Phone, Mail, Camera, Star,
  X as XIcon, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, Download,
  ChevronsLeft, ChevronsRight,
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
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'urgency' | 'date'>('urgency');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [assignTicket, setAssignTicket] = useState<any>(null);

  // ─── Server-side pagination (Sprint 2) ───
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [serverStats, setServerStats] = useState<{ open?: number; in_progress?: number; completed?: number; cancelled?: number; urgent?: number }>({});
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => { setPage(1); }, [debouncedSearch, statusFilter, priorityFilter, pageSize]);

  // ─── Photo Lightbox State ───
  const [lightbox, setLightbox] = useState<{ photos: string[]; index: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  const openLightbox = (photos: string[], index: number) => {
    setLightbox({ photos, index });
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };
  const closeLightbox = () => setLightbox(null);
  const nextPhoto = () => {
    if (!lightbox) return;
    setLightbox({ ...lightbox, index: (lightbox.index + 1) % lightbox.photos.length });
    setZoom(1); setPan({ x: 0, y: 0 });
  };
  const prevPhoto = () => {
    if (!lightbox) return;
    setLightbox({ ...lightbox, index: (lightbox.index - 1 + lightbox.photos.length) % lightbox.photos.length });
    setZoom(1); setPan({ x: 0, y: 0 });
  };
  const downloadPhoto = () => {
    if (!lightbox) return;
    const link = document.createElement('a');
    link.href = lightbox.photos[lightbox.index];
    link.download = `maintenance-photo-${lightbox.index + 1}.jpg`;
    link.click();
  };

  // Keyboard navigation
  useEffect(() => {
    if (!lightbox) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLightbox();
      else if (e.key === 'ArrowRight') nextPhoto();
      else if (e.key === 'ArrowLeft') prevPhoto();
      else if (e.key === '+' || e.key === '=') setZoom(z => Math.min(z + 0.5, 5));
      else if (e.key === '-') setZoom(z => Math.max(z - 0.5, 1));
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [lightbox]);

  const fetchRequests = useCallback(async () => {
    try {
      const qs = new URLSearchParams({
        page: String(page),
        limit: String(pageSize),
      });
      if (statusFilter !== 'all') qs.set('status', statusFilter);
      if (priorityFilter !== 'all') qs.set('priority', priorityFilter);
      if (debouncedSearch) qs.set('search', debouncedSearch);
      const res = await fetch(`/api/admin/maintenance-requests?${qs.toString()}`, { headers: headers() });
      if (res.ok) {
        const d = await res.json();
        setRequests(d.requests || []);
        setTotalPages(d.total_pages || 1);
        setTotalCount(d.total ?? 0);
        setServerStats(d.stats || {});
        if (d.page && d.page !== page) setPage(d.page);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [headers, page, pageSize, statusFilter, priorityFilter, debouncedSearch]);

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

  const PRIORITY_ORDER: Record<string, number> = { emergency: 0, high: 1, medium: 2, low: 3 };
  // Backend already applies search/status/priority filters — only client-side sorting remains
  const filtered = [...requests].sort((a, b) => {
    if (sortBy === 'urgency') {
      const pa = PRIORITY_ORDER[a.priority || 'low'] ?? 3;
      const pb = PRIORITY_ORDER[b.priority || 'low'] ?? 3;
      if (pa !== pb) return pa - pb;
    }
    return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
  });

  const stats = {
    total: totalCount,
    pending: serverStats.open ?? requests.filter(r => r.status === 'pending').length,
    in_progress: serverStats.in_progress ?? requests.filter(r => r.status === 'in_progress').length,
    completed: serverStats.completed ?? requests.filter(r => r.status === 'completed').length,
    emergency: serverStats.urgent ?? requests.filter(r => r.priority === 'emergency' && r.status !== 'completed' && r.status !== 'cancelled').length,
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
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <StatCard label="Total" value={stats.total} color="gray" icon={Wrench} />
        <StatCard label="🚨 Emergencias" value={stats.emergency} color="red" icon={AlertTriangle} alert={stats.emergency > 0} />
        <StatCard label="Pendientes" value={stats.pending} color="amber" icon={Clock} alert={stats.pending > 0} />
        <StatCard label="En Progreso" value={stats.in_progress} color="blue" icon={Wrench} />
        <StatCard label="Completados" value={stats.completed} color="emerald" icon={CheckCircle2} />
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white/[0.03] border border-white/[0.08] rounded-xl text-white text-sm focus:border-amber-500 focus:outline-none"
              placeholder="Buscar por título, inquilino, propiedad, descripción..." />
          </div>
          <div className="flex gap-1 bg-white/[0.03] rounded-xl p-1 border border-white/[0.06]">
            <button onClick={() => setSortBy('urgency')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${sortBy === 'urgency' ? 'bg-amber-500/15 text-amber-400 border border-amber-500/25' : 'text-gray-500 hover:text-gray-300'}`}
              title="Ordenar por urgencia">
              🚨 Urgencia
            </button>
            <button onClick={() => setSortBy('date')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${sortBy === 'date' ? 'bg-amber-500/15 text-amber-400 border border-amber-500/25' : 'text-gray-500 hover:text-gray-300'}`}
              title="Ordenar por fecha">
              📅 Fecha
            </button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex gap-1 bg-white/[0.03] rounded-xl p-1 border border-white/[0.06] overflow-x-auto">
            <span className="px-2 py-1.5 text-xs text-gray-500 whitespace-nowrap">Estado:</span>
            {[{ key: 'all', label: 'Todos' }, ...Object.entries(STATUS_CONFIG).map(([k, v]) => ({ key: k, label: v.label }))].map(s => (
              <button key={s.key} onClick={() => setStatusFilter(s.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition whitespace-nowrap ${
                  statusFilter === s.key ? 'bg-amber-500/15 text-amber-400 border border-amber-500/25' : 'text-gray-500 hover:text-gray-300'
                }`}>
                {s.label}
              </button>
            ))}
          </div>
          <div className="flex gap-1 bg-white/[0.03] rounded-xl p-1 border border-white/[0.06] overflow-x-auto">
            <span className="px-2 py-1.5 text-xs text-gray-500 whitespace-nowrap">Prioridad:</span>
            {[{ key: 'all', label: 'Todas' }, ...Object.entries(PRIORITY_CONFIG).map(([k, v]) => ({ key: k, label: v.label }))].map(p => (
              <button key={p.key} onClick={() => setPriorityFilter(p.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition whitespace-nowrap ${
                  priorityFilter === p.key ? 'bg-red-500/15 text-red-400 border border-red-500/25' : 'text-gray-500 hover:text-gray-300'
                }`}>
                {p.label}
              </button>
            ))}
          </div>
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
            const reqId: string = req.id || req._id;
            const st = STATUS_CONFIG[req.status] || STATUS_CONFIG.pending;
            const pr = PRIORITY_CONFIG[req.priority] || PRIORITY_CONFIG.medium;
            const isExpanded = expanded === reqId;
            const StIcon = st.icon;

            return (
              <div key={reqId} className={`bg-white/[0.03] backdrop-blur-sm rounded-2xl border transition hover:border-white/[0.12] ${isExpanded ? 'border-amber-500/20' : 'border-white/[0.06]'}`}>
                {/* Main row */}
                <div className="p-4 flex items-center gap-3 cursor-pointer" onClick={() => setExpanded(isExpanded ? null : reqId)}>
                  <div className={`w-10 h-10 rounded-xl ${st.bg} ${st.border} border flex items-center justify-center flex-shrink-0`}>
                    <StIcon className={`w-5 h-5 ${st.color}`} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-bold text-white truncate">{req.title || 'Sin título'}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${pr.bg} ${pr.color}`}>{pr.label}</span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-gray-500">
                      <span className="flex items-center gap-1"><Home className="w-3 h-3" /> {req.property_address || req.property_name || 'N/A'}</span>
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
                            <button
                              key={i}
                              type="button"
                              onClick={(e) => { e.stopPropagation(); openLightbox(req.photos, i); }}
                              className="group relative w-20 h-20 rounded-lg border border-white/[0.06] overflow-hidden hover:border-amber-500/50 hover:scale-105 transition cursor-zoom-in"
                              title="Click para ver en pantalla completa"
                            >
                              <img src={p} alt="" className="w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition flex items-center justify-center">
                                <ZoomIn className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition" />
                              </div>
                            </button>
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
                    <div className="flex items-center gap-2 pt-2 border-t border-white/[0.04] flex-wrap">
                      <span className="text-xs text-gray-500 mr-2">Cambiar estado:</span>
                      {Object.entries(STATUS_CONFIG).filter(([k]) => k !== req.status).map(([key, cfg]) => (
                        <button key={key} onClick={() => updateStatus(reqId, key)} disabled={updating === reqId}
                          className={`text-xs px-3 py-1.5 rounded-lg font-medium transition border ${cfg.bg} ${cfg.color} ${cfg.border} hover:opacity-80 disabled:opacity-30`}>
                          {updating === reqId ? '...' : cfg.label}
                        </button>
                      ))}
                      <button onClick={() => setAssignTicket(req)}
                        className="text-xs px-3 py-1.5 rounded-lg font-medium transition border bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20 ml-auto flex items-center gap-1.5">
                        🛠️ {req.assigned_provider_name ? `Reasignar (${req.assigned_provider_name})` : 'Asignar proveedor'}
                      </button>
                    </div>

                    {req.assigned_provider_name && (
                      <div className="mt-1 px-3 py-2 bg-amber-500/5 border border-amber-500/15 rounded-lg flex items-center justify-between gap-2 text-xs">
                        <span className="text-amber-300 flex items-center gap-1.5">
                          ✅ Asignado a <strong>{req.assigned_provider_name}</strong>
                          {req.assigned_provider_phone && <a href={`tel:${req.assigned_provider_phone}`} className="text-cyan-400 hover:underline ml-2">{req.assigned_provider_phone}</a>}
                        </span>
                      </div>
                    )}

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

      {/* ─── Pagination Controls ─── */}
      {(totalPages > 1 || totalCount > 10) && (
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 pb-4 px-1">
          <div className="text-xs text-gray-500">
            Mostrando <span className="text-gray-300 font-bold">{filtered.length}</span> de{' '}
            <span className="text-gray-300 font-bold">{totalCount}</span> solicitud{totalCount === 1 ? '' : 'es'}
            {totalPages > 1 && (
              <> · página <span className="text-amber-400 font-bold">{page}</span> de {totalPages}</>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={pageSize}
              onChange={e => setPageSize(parseInt(e.target.value, 10) || 50)}
              className="px-2 py-1.5 bg-[#0C1220]/60 border border-white/[0.08] rounded-lg text-xs text-white focus:border-amber-500 focus:outline-none cursor-pointer"
              title="Solicitudes por página"
            >
              <option value="25">25 / página</option>
              <option value="50">50 / página</option>
              <option value="100">100 / página</option>
              <option value="200">200 / página</option>
            </select>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(1)} disabled={page === 1}
                  className="p-1.5 border border-white/[0.08] rounded-lg text-gray-400 hover:bg-white/[0.04] hover:text-white transition disabled:opacity-30 disabled:cursor-not-allowed" title="Primera">
                  <ChevronsLeft className="w-4 h-4" />
                </button>
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="p-1.5 border border-white/[0.08] rounded-lg text-gray-400 hover:bg-white/[0.04] hover:text-white transition disabled:opacity-30 disabled:cursor-not-allowed">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs font-bold text-amber-300 min-w-[60px] text-center">
                  {page} / {totalPages}
                </div>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                  className="p-1.5 border border-white/[0.08] rounded-lg text-gray-400 hover:bg-white/[0.04] hover:text-white transition disabled:opacity-30 disabled:cursor-not-allowed">
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button onClick={() => setPage(totalPages)} disabled={page >= totalPages}
                  className="p-1.5 border border-white/[0.08] rounded-lg text-gray-400 hover:bg-white/[0.04] hover:text-white transition disabled:opacity-30 disabled:cursor-not-allowed" title="Última">
                  <ChevronsRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── PHOTO LIGHTBOX ─── */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md flex items-center justify-center"
          onClick={closeLightbox}
        >
          {/* Top bar */}
          <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent z-10"
               onClick={(e) => e.stopPropagation()}>
            <div className="text-white text-sm font-medium">
              <Camera className="w-4 h-4 inline mr-2" />
              {lightbox.index + 1} / {lightbox.photos.length}
              {zoom > 1 && <span className="ml-3 text-amber-400">{Math.round(zoom * 100)}%</span>}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setZoom(z => Math.max(z - 0.5, 1))}
                disabled={zoom <= 1}
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 flex items-center justify-center text-white transition"
                title="Zoom out (-)">
                <ZoomOut className="w-5 h-5" />
              </button>
              <button onClick={() => setZoom(z => Math.min(z + 0.5, 5))}
                disabled={zoom >= 5}
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 flex items-center justify-center text-white transition"
                title="Zoom in (+)">
                <ZoomIn className="w-5 h-5" />
              </button>
              <button onClick={downloadPhoto}
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition"
                title="Descargar">
                <Download className="w-5 h-5" />
              </button>
              <button onClick={closeLightbox}
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-red-500/30 flex items-center justify-center text-white transition"
                title="Cerrar (Esc)">
                <XIcon className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Prev button */}
          {lightbox.photos.length > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); prevPhoto(); }}
              className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition z-10"
              title="Anterior (←)"
            >
              <ChevronLeft className="w-7 h-7" />
            </button>
          )}

          {/* Next button */}
          {lightbox.photos.length > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); nextPhoto(); }}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition z-10"
              title="Siguiente (→)"
            >
              <ChevronRight className="w-7 h-7" />
            </button>
          )}

          {/* Image container */}
          <div
            className="relative w-full h-full flex items-center justify-center overflow-hidden cursor-zoom-in"
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={() => setZoom(z => (z === 1 ? 2.5 : 1))}
          >
            <img
              src={lightbox.photos[lightbox.index]}
              alt={`Foto ${lightbox.index + 1}`}
              draggable={false}
              className="max-w-[90vw] max-h-[85vh] object-contain transition-transform duration-200 select-none"
              style={{
                transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
                cursor: zoom > 1 ? 'grab' : 'zoom-in',
              }}
            />
          </div>

          {/* Thumbnails strip */}
          {lightbox.photos.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 bg-black/60 backdrop-blur-md p-2 rounded-2xl border border-white/10 z-10"
                 onClick={(e) => e.stopPropagation()}>
              {lightbox.photos.map((p, i) => (
                <button key={i}
                  onClick={() => { setLightbox({ ...lightbox, index: i }); setZoom(1); setPan({ x: 0, y: 0 }); }}
                  className={`w-12 h-12 rounded-lg overflow-hidden border-2 transition ${
                    i === lightbox.index ? 'border-amber-400 scale-110' : 'border-white/20 opacity-60 hover:opacity-100'
                  }`}>
                  <img src={p} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}

          {/* Hint footer */}
          <div className="absolute bottom-20 left-1/2 -translate-x-1/2 text-xs text-white/40 z-10 pointer-events-none">
            Doble click para zoom · ← → para navegar · Esc para cerrar
          </div>
        </div>
      )}
      {assignTicket && (
        <AssignProviderModal
          ticket={assignTicket}
          onClose={() => setAssignTicket(null)}
          onAssigned={() => { setAssignTicket(null); fetchRequests(); }}
          headers={headers}
        />
      )}
    </div>
  );
}

function AssignProviderModal({ ticket, onClose, onAssigned, headers }: { ticket: any; onClose: () => void; onAssigned: () => void; headers: () => any }) {
  const [loading, setLoading] = useState(true);
  const [providers, setProviders] = useState<any[]>([]);
  const [matchingServices, setMatchingServices] = useState<string[]>([]);
  const [dispatching, setDispatching] = useState<string | null>(null);
  const [extraNote, setExtraNote] = useState('');
  const [viaEmail, setViaEmail] = useState(true);
  const [viaSms, setViaSms] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const ticketId = ticket._id || ticket.id;
        const res = await fetch(`/api/admin/service-providers/match-for-maintenance/${ticketId}`, { headers: headers() });
        const data = await res.json();
        setProviders(data.matched_providers || []);
        setMatchingServices(data.matching_services || []);
      } catch (e) { console.error(e); }
      setLoading(false);
    };
    load();
  }, [ticket, headers]);

  const dispatch = async (provider: any) => {
    setDispatching(provider._id);
    try {
      const res = await fetch('/api/admin/service-providers/dispatch-maintenance', {
        method: 'POST',
        headers: { ...headers(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider_id: provider._id,
          request_id: ticket._id || ticket.id,
          extra_note: extraNote,
          via_email: viaEmail,
          via_sms: viaSms,
        }),
      });
      const data = await res.json();
      alert(`Asignado a ${provider.name}\nEmail: ${data.email_sent ? '✓' : '✗'} | SMS: ${data.sms_sent ? '✓' : '✗'}`);
      onAssigned();
    } catch (e: any) { alert('Error: ' + e.message); }
    setDispatching(null);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-[#0a1020] border border-white/10 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold flex items-center gap-2">🛠️ Asignar proveedor</h3>
            <p className="text-xs text-gray-500 mt-1">
              {ticket.title} · {ticket.property_address || '—'} · prioridad: {ticket.priority || '—'}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-lg"><XIcon className="w-5 h-5" /></button>
        </div>

        {matchingServices.length > 0 && (
          <div className="mb-4 p-3 bg-amber-500/5 border border-amber-500/15 rounded-lg text-xs">
            <span className="text-gray-400">Servicios sugeridos:</span>{' '}
            <span className="text-amber-300 font-semibold">{matchingServices.join(' · ')}</span>
          </div>
        )}

        <div className="mb-4">
          <label className="block">
            <span className="text-xs text-gray-400 mb-1.5 block">Nota adicional (opcional)</span>
            <textarea value={extraNote} onChange={e => setExtraNote(e.target.value)} rows={2} placeholder="Ej: Llamar antes de ir, código de portón 1234..." className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm" />
          </label>
          <div className="flex gap-3 mt-2 text-xs">
            <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={viaEmail} onChange={e => setViaEmail(e.target.checked)} /> Email</label>
            <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={viaSms} onChange={e => setViaSms(e.target.checked)} /> SMS</label>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-8 text-gray-500 text-sm">Cargando proveedores...</div>
        ) : providers.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-sm text-gray-400 mb-3">No hay proveedores activos que coincidan con esta categoría.</div>
            <a href="/admin/proveedores" className="inline-block text-xs px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 hover:bg-amber-500/20">
              Ver todos los proveedores →
            </a>
          </div>
        ) : (
          <div className="space-y-2 max-h-[50vh] overflow-y-auto">
            {providers.map(p => (
              <div key={p._id} className="bg-white/[0.04] border border-white/10 rounded-xl p-3 flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm flex items-center gap-1.5">
                    {p.is_featured && <Star className="w-3.5 h-3.5 text-yellow-400" />}
                    {p.name}
                    {p.company_name && <span className="text-gray-500 text-xs">— {p.company_name}</span>}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5 flex items-center gap-3 flex-wrap">
                    <span>📞 {p.phone}</span>
                    {p.rating > 0 && <span>⭐ {p.rating.toFixed(1)}</span>}
                    <span>🛠️ {(p.services || []).slice(0, 3).join(', ')}</span>
                  </div>
                </div>
                <button disabled={dispatching === p._id} onClick={() => dispatch(p)}
                  className="px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs disabled:opacity-50 whitespace-nowrap">
                  {dispatching === p._id ? 'Enviando...' : 'Asignar'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
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
