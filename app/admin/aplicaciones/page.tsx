'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAdminAuth } from '../layout';
import {
  ClipboardList, Search, RefreshCw, Phone, Mail, Briefcase, DollarSign,
  MessageSquare, Trash2, Save, X, CheckCircle2, XCircle, Eye,
  ChevronDown, ChevronUp, Home, Calendar, AlertCircle, Archive,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
} from 'lucide-react';
import ScreeningPanel, { ScreeningBadge, type Screening } from '../../components/admin/ScreeningPanel';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; icon: any }> = {
  new:       { label: 'Nueva',      color: 'text-blue-400',    bg: 'bg-blue-500/10',    border: 'border-blue-500/20',    icon: AlertCircle },
  reviewing: { label: 'Revisando',  color: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/20',   icon: Eye },
  approved:  { label: 'Aprobada',   color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', icon: CheckCircle2 },
  rejected:  { label: 'Rechazada',  color: 'text-red-400',     bg: 'bg-red-500/10',     border: 'border-red-500/20',     icon: XCircle },
  archived:  { label: 'Archivada',  color: 'text-gray-400',    bg: 'bg-gray-500/10',    border: 'border-gray-500/20',    icon: Archive },
};

type Application = {
  id: string;
  name: string;
  email: string;
  phone: string;
  property_interest: string;
  employment: string;
  monthly_income: string;
  message: string;
  status: string;
  admin_notes: string;
  source: string;
  created_at: string;
  updated_at: string;
  reviewed_by?: string;
  screening?: Screening | null;
};

export default function AplicacionesPage() {
  const { headers } = useAdminAuth();
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [serverStats, setServerStats] = useState<Record<string, number>>({});
  const [editingNotes, setEditingNotes] = useState<{ id: string; value: string } | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { setPage(1); }, [debouncedSearch, statusFilter, pageSize]);

  // Toast auto-dismiss
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const fetchApps = useCallback(async () => {
    try {
      const qs = new URLSearchParams({
        page: String(page),
        limit: String(pageSize),
      });
      if (statusFilter !== 'all') qs.set('status', statusFilter);
      if (debouncedSearch) qs.set('search', debouncedSearch);
      const res = await fetch(`/api/admin/rental-applications?${qs.toString()}`, { headers: headers() });
      if (res.ok) {
        const d = await res.json();
        setApps(d.applications || []);
        setTotalPages(d.total_pages || 1);
        setTotalCount(d.total ?? 0);
        setServerStats(d.stats || {});
        if (d.page && d.page !== page) setPage(d.page);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [headers, page, pageSize, statusFilter, debouncedSearch]);

  useEffect(() => { fetchApps(); }, [fetchApps]);

  const updateStatus = async (id: string, status: string) => {
    setUpdating(id);
    try {
      const res = await fetch(`/api/admin/rental-applications/${id}`, {
        method: 'PATCH', headers: headers(), body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setToast({ msg: `Estado actualizado a "${STATUS_CONFIG[status]?.label || status}"`, ok: true });
        await fetchApps();
      } else {
        const err = await res.json().catch(() => ({}));
        setToast({ msg: `Error: ${err.detail || 'No se pudo actualizar'}`, ok: false });
      }
    } catch (e) {
      console.error(e);
      setToast({ msg: 'Error de conexión', ok: false });
    }
    setUpdating(null);
  };

  const saveNotes = async (id: string, notes: string) => {
    setUpdating(id);
    try {
      const res = await fetch(`/api/admin/rental-applications/${id}`, {
        method: 'PATCH', headers: headers(), body: JSON.stringify({ admin_notes: notes }),
      });
      if (res.ok) {
        setToast({ msg: 'Notas guardadas', ok: true });
        setEditingNotes(null);
        await fetchApps();
      } else {
        const err = await res.json().catch(() => ({}));
        setToast({ msg: `Error: ${err.detail || 'No se pudo guardar'}`, ok: false });
      }
    } catch (e) {
      setToast({ msg: 'Error de conexión', ok: false });
    }
    setUpdating(null);
  };

  const deleteApp = async (id: string, name: string) => {
    if (!confirm(`¿Eliminar la aplicación de "${name}"? Esta acción no se puede deshacer.`)) return;
    setUpdating(id);
    try {
      const res = await fetch(`/api/admin/rental-applications/${id}`, {
        method: 'DELETE', headers: headers(),
      });
      if (res.ok) {
        setToast({ msg: 'Aplicación eliminada', ok: true });
        await fetchApps();
      } else {
        setToast({ msg: 'No se pudo eliminar', ok: false });
      }
    } catch (e) {
      setToast({ msg: 'Error de conexión', ok: false });
    }
    setUpdating(null);
  };

  const stats = {
    total: totalCount,
    new: serverStats.new ?? 0,
    reviewing: serverStats.reviewing ?? 0,
    approved: serverStats.approved ?? 0,
    rejected: serverStats.rejected ?? 0,
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-3 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-5 relative">
      <div className="fixed top-0 left-1/3 w-96 h-96 bg-blue-500/[0.02] rounded-full blur-3xl pointer-events-none" />

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl border backdrop-blur-md text-sm font-medium shadow-2xl ${
          toast.ok ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300' : 'bg-red-500/15 border-red-500/30 text-red-300'
        }`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500/20 to-cyan-500/5 border border-blue-500/20 flex items-center justify-center">
            <ClipboardList className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Aplicaciones de Renta</h2>
            <p className="text-sm text-gray-500">Prospectos del formulario público (rosshouserentals.com)</p>
          </div>
        </div>
        <button onClick={fetchApps} className="px-3 py-2 bg-white/[0.03] border border-white/[0.08] rounded-xl text-xs text-gray-300 hover:text-white hover:bg-white/[0.06] transition flex items-center gap-2">
          <RefreshCw className="w-4 h-4" /> Recargar
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <StatCard label="Total" value={stats.total} color="gray" icon={ClipboardList} />
        <StatCard label="🆕 Nuevas" value={stats.new} color="blue" icon={AlertCircle} alert={stats.new > 0} />
        <StatCard label="Revisando" value={stats.reviewing} color="amber" icon={Eye} />
        <StatCard label="Aprobadas" value={stats.approved} color="emerald" icon={CheckCircle2} />
        <StatCard label="Rechazadas" value={stats.rejected} color="red" icon={XCircle} />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white/[0.03] border border-white/[0.08] rounded-xl text-white text-sm focus:border-blue-500 focus:outline-none"
            placeholder="Buscar por nombre, email, teléfono, propiedad, mensaje..." />
        </div>
        <div className="flex gap-1 bg-white/[0.03] rounded-xl p-1 border border-white/[0.06] overflow-x-auto">
          <span className="px-2 py-1.5 text-xs text-gray-500 whitespace-nowrap self-center">Estado:</span>
          {[{ key: 'all', label: 'Todas' }, ...Object.entries(STATUS_CONFIG).map(([k, v]) => ({ key: k, label: v.label }))].map(s => (
            <button key={s.key} onClick={() => setStatusFilter(s.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition whitespace-nowrap ${
                statusFilter === s.key ? 'bg-blue-500/15 text-blue-400 border border-blue-500/25' : 'text-gray-500 hover:text-gray-300'
              }`}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {apps.length === 0 ? (
        <div className="bg-white/[0.03] rounded-2xl border border-white/[0.06] p-12 text-center">
          <ClipboardList className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500">
            {search || statusFilter !== 'all'
              ? 'No se encontraron aplicaciones con esos filtros'
              : 'Aún no se han recibido aplicaciones del sitio web'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {apps.map(app => {
            const st = STATUS_CONFIG[app.status] || STATUS_CONFIG.new;
            const isExpanded = expanded === app.id;
            const StIcon = st.icon;
            const created = app.created_at ? new Date(app.created_at) : null;
            const daysSince = created ? Math.floor((Date.now() - created.getTime()) / 86400000) : 0;
            const isUrgent = app.status === 'new' && daysSince >= 2;

            return (
              <div key={app.id} className={`bg-white/[0.03] backdrop-blur-sm rounded-2xl border transition hover:border-white/[0.12] ${
                isExpanded ? 'border-blue-500/20' : isUrgent ? 'border-amber-500/20' : 'border-white/[0.06]'
              }`}>
                {/* Main row */}
                <div className="p-4 flex items-center gap-3 cursor-pointer" onClick={() => setExpanded(isExpanded ? null : app.id)}>
                  <div className={`w-10 h-10 rounded-xl ${st.bg} ${st.border} border flex items-center justify-center flex-shrink-0`}>
                    <StIcon className={`w-5 h-5 ${st.color}`} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className="text-sm font-bold text-white truncate">{app.name || '(Sin nombre)'}</span>
                      {isUrgent && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 font-bold tracking-wide">
                          ⏰ {daysSince}d esperando
                        </span>
                      )}
                      <ScreeningBadge screening={app.screening || null} />
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-gray-500 flex-wrap">
                      {app.property_interest && (
                        <span className="flex items-center gap-1"><Home className="w-3 h-3" /> {app.property_interest}</span>
                      )}
                      {app.email && (
                        <span className="flex items-center gap-1 truncate max-w-[180px]"><Mail className="w-3 h-3" /> {app.email}</span>
                      )}
                      {app.phone && (
                        <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {app.phone}</span>
                      )}
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {created ? created.toLocaleDateString('es-US') : ''}</span>
                    </div>
                  </div>

                  <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold ${st.bg} ${st.color} ${st.border} border hidden sm:block`}>{st.label}</span>
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="border-t border-white/[0.06] p-4 space-y-4">
                    {/* Contact + info grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <InfoRow icon={Mail} label="Email" value={app.email || '—'} link={app.email ? `mailto:${app.email}` : undefined} />
                      <InfoRow icon={Phone} label="Teléfono" value={app.phone || '—'} link={app.phone ? `tel:${app.phone}` : undefined} />
                      <InfoRow icon={Home} label="Propiedad de interés" value={app.property_interest || '—'} />
                      <InfoRow icon={Briefcase} label="Empleo" value={app.employment || '—'} />
                      <InfoRow icon={DollarSign} label="Ingreso mensual" value={app.monthly_income || '—'} />
                      <InfoRow icon={Calendar} label="Recibida" value={created ? created.toLocaleString('es-US', { dateStyle: 'medium', timeStyle: 'short' }) : '—'} />
                    </div>

                    {/* Message */}
                    {app.message && (
                      <div>
                        <div className="text-xs font-bold text-gray-400 mb-1 flex items-center gap-1.5"><MessageSquare className="w-3 h-3" /> Mensaje del aplicante:</div>
                        <div className="bg-white/[0.02] rounded-xl p-3 text-sm text-gray-300 leading-relaxed border border-white/[0.04] whitespace-pre-wrap">
                          {app.message}
                        </div>
                      </div>
                    )}

                    {/* Screening de crédito */}
                    <ScreeningPanel
                      appId={app.id}
                      screening={app.screening || null}
                      headers={headers}
                      onChanged={fetchApps}
                      notify={(msg, ok) => setToast({ msg, ok })}
                    />

                    {/* Admin notes */}
                    <div>
                      <div className="text-xs font-bold text-gray-400 mb-1 flex items-center gap-1.5">
                        <MessageSquare className="w-3 h-3" /> Notas internas {app.reviewed_by && (
                          <span className="text-[10px] text-gray-600 ml-2">· última edición: {app.reviewed_by}</span>
                        )}
                      </div>
                      {editingNotes?.id === app.id ? (
                        <div className="space-y-2">
                          <textarea
                            value={editingNotes.value}
                            onChange={e => setEditingNotes({ id: app.id, value: e.target.value })}
                            placeholder="Anota observaciones internas (no se envían al aplicante)..."
                            rows={3}
                            className="w-full px-3 py-2 bg-[#0a1020]/60 border border-white/[0.08] rounded-xl text-sm text-white focus:border-blue-500 focus:outline-none resize-y"
                          />
                          <div className="flex gap-2">
                            <button onClick={() => saveNotes(app.id, editingNotes.value)} disabled={updating === app.id}
                              className="px-3 py-1.5 bg-blue-500/15 text-blue-400 border border-blue-500/30 rounded-lg text-xs font-bold hover:bg-blue-500/25 transition flex items-center gap-1.5 disabled:opacity-50">
                              <Save className="w-3.5 h-3.5" /> Guardar
                            </button>
                            <button onClick={() => setEditingNotes(null)}
                              className="px-3 py-1.5 bg-white/[0.04] text-gray-400 border border-white/[0.08] rounded-lg text-xs font-bold hover:bg-white/[0.08] transition flex items-center gap-1.5">
                              <X className="w-3.5 h-3.5" /> Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div
                          onClick={() => setEditingNotes({ id: app.id, value: app.admin_notes || '' })}
                          className="bg-white/[0.02] rounded-xl p-3 text-sm text-gray-300 leading-relaxed border border-white/[0.04] cursor-pointer hover:border-blue-500/20 transition min-h-[44px]"
                        >
                          {app.admin_notes ? (
                            <span className="whitespace-pre-wrap">{app.admin_notes}</span>
                          ) : (
                            <span className="text-gray-600 italic">Click para añadir notas internas...</span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Status actions */}
                    <div className="flex items-center gap-2 pt-3 border-t border-white/[0.04] flex-wrap">
                      <span className="text-xs text-gray-500 mr-2">Cambiar estado:</span>
                      {Object.entries(STATUS_CONFIG).filter(([k]) => k !== app.status).map(([key, cfg]) => (
                        <button key={key} onClick={() => updateStatus(app.id, key)} disabled={updating === app.id}
                          className={`text-xs px-3 py-1.5 rounded-lg font-medium transition border ${cfg.bg} ${cfg.color} ${cfg.border} hover:opacity-80 disabled:opacity-30`}>
                          {updating === app.id ? '...' : cfg.label}
                        </button>
                      ))}
                      <div className="flex-1" />
                      <button onClick={() => deleteApp(app.id, app.name)} disabled={updating === app.id}
                        className="text-xs px-3 py-1.5 rounded-lg font-medium transition border bg-red-500/5 text-red-400 border-red-500/15 hover:bg-red-500/10 flex items-center gap-1.5 disabled:opacity-30">
                        <Trash2 className="w-3.5 h-3.5" /> Eliminar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {(totalPages > 1 || totalCount > 10) && (
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 pb-4 px-1">
          <div className="text-xs text-gray-500">
            Mostrando <span className="text-gray-300 font-bold">{apps.length}</span> de{' '}
            <span className="text-gray-300 font-bold">{totalCount}</span> aplicaci{totalCount === 1 ? 'ón' : 'ones'}
            {totalPages > 1 && (
              <> · página <span className="text-blue-400 font-bold">{page}</span> de {totalPages}</>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={pageSize}
              onChange={e => setPageSize(parseInt(e.target.value, 10) || 50)}
              className="px-2 py-1.5 bg-[#0C1220]/60 border border-white/[0.08] rounded-lg text-xs text-white focus:border-blue-500 focus:outline-none cursor-pointer"
            >
              <option value="25">25 / página</option>
              <option value="50">50 / página</option>
              <option value="100">100 / página</option>
            </select>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(1)} disabled={page === 1}
                  className="p-1.5 border border-white/[0.08] rounded-lg text-gray-400 hover:bg-white/[0.04] hover:text-white transition disabled:opacity-30 disabled:cursor-not-allowed">
                  <ChevronsLeft className="w-4 h-4" />
                </button>
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="p-1.5 border border-white/[0.08] rounded-lg text-gray-400 hover:bg-white/[0.04] hover:text-white transition disabled:opacity-30 disabled:cursor-not-allowed">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="px-3 py-1.5 bg-blue-500/10 border border-blue-500/30 rounded-lg text-xs font-bold text-blue-300 min-w-[60px] text-center">
                  {page} / {totalPages}
                </div>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                  className="p-1.5 border border-white/[0.08] rounded-lg text-gray-400 hover:bg-white/[0.04] hover:text-white transition disabled:opacity-30 disabled:cursor-not-allowed">
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button onClick={() => setPage(totalPages)} disabled={page >= totalPages}
                  className="p-1.5 border border-white/[0.08] rounded-lg text-gray-400 hover:bg-white/[0.04] hover:text-white transition disabled:opacity-30 disabled:cursor-not-allowed">
                  <ChevronsRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function InfoRow({ icon: Icon, label, value, link }: { icon: any; label: string; value: string; link?: string }) {
  const inner = (
    <div className="flex items-start gap-2.5 bg-white/[0.02] border border-white/[0.04] rounded-xl p-2.5">
      <div className="w-7 h-7 rounded-lg bg-white/[0.04] flex items-center justify-center flex-shrink-0 mt-0.5">
        <Icon className="w-3.5 h-3.5 text-gray-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">{label}</div>
        <div className={`text-sm truncate ${link ? 'text-blue-300' : 'text-gray-200'}`}>{value}</div>
      </div>
    </div>
  );
  if (link) {
    return <a href={link} className="block hover:opacity-80 transition">{inner}</a>;
  }
  return inner;
}

function StatCard({ label, value, color, icon: Icon, alert }: { label: string; value: number; color: string; icon: any; alert?: boolean }) {
  const COLOR_BG: Record<string, string> = {
    gray: 'bg-gray-500/10', blue: 'bg-blue-500/10', amber: 'bg-amber-500/10',
    emerald: 'bg-emerald-500/10', red: 'bg-red-500/10',
  };
  const COLOR_TEXT: Record<string, string> = {
    gray: 'text-gray-400', blue: 'text-blue-400', amber: 'text-amber-400',
    emerald: 'text-emerald-400', red: 'text-red-400',
  };
  return (
    <div className={`bg-white/[0.03] rounded-xl border border-white/[0.06] p-3 flex items-center gap-3 ${alert ? 'border-blue-500/20' : ''}`}>
      <div className={`w-9 h-9 rounded-lg ${COLOR_BG[color]} flex items-center justify-center`}>
        <Icon className={`w-4 h-4 ${COLOR_TEXT[color]}`} />
      </div>
      <div>
        <div className={`text-lg font-bold ${alert ? 'text-blue-400' : 'text-white'}`}>{value}</div>
        <div className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">{label}</div>
      </div>
    </div>
  );
}
