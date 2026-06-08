'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAdminAuth } from '../layout';
import {
  ClipboardCheck, Plus, Search, Clock, CheckCircle2, XCircle, Eye,
  Home, Users, Calendar, ChevronDown, ChevronUp, LogIn, LogOut,
  RefreshCw, FileText, AlertTriangle, Star, Loader2, X, Save,
} from 'lucide-react';

/* ─── Types ─────────────────────────────────────────────────── */
type InspectionType = 'move_in' | 'move_out' | 'routine';
type InspectionStatus = 'pending' | 'in_progress' | 'completed';
type Condition = 'good' | 'fair' | 'poor' | 'damaged';

interface Inspection {
  _id: string;
  property_id: string;
  property_name: string;
  tenant_name: string;
  type: InspectionType;
  status: InspectionStatus;
  scheduled_date: string;
  rooms: Record<string, { items: Record<string, { condition: Condition; notes: string }> }>;
  general_notes: string;
  inspector: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

interface Property { _id: string; name: string; address?: string; }
interface Tenant { _id: string; name: string; property_name?: string; }

/* ─── Config ────────────────────────────────────────────────── */
const TYPE_CONFIG: Record<InspectionType, { label: string; icon: any; color: string; bg: string; border: string }> = {
  move_in:  { label: 'Move-In',  icon: LogIn,       color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  move_out: { label: 'Move-Out', icon: LogOut,       color: 'text-red-400',     bg: 'bg-red-500/10',     border: 'border-red-500/20' },
  routine:  { label: 'Rutinaria', icon: RefreshCw,   color: 'text-blue-400',    bg: 'bg-blue-500/10',    border: 'border-blue-500/20' },
};

const STATUS_CONFIG: Record<InspectionStatus, { label: string; color: string; bg: string; border: string; icon: any }> = {
  pending:     { label: 'Pendiente',   color: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/20', icon: Clock },
  in_progress: { label: 'En Progreso', color: 'text-blue-400',    bg: 'bg-blue-500/10',    border: 'border-blue-500/20',  icon: Eye },
  completed:   { label: 'Completada',  color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', icon: CheckCircle2 },
};

const CONDITION_CONFIG: Record<Condition, { label: string; color: string; bg: string; emoji: string }> = {
  good:    { label: 'Bueno',  color: 'text-emerald-400', bg: 'bg-emerald-500/10', emoji: '✓' },
  fair:    { label: 'Regular', color: 'text-amber-400',  bg: 'bg-amber-500/10',   emoji: '~' },
  poor:    { label: 'Malo',    color: 'text-orange-400', bg: 'bg-orange-500/10',  emoji: '!' },
  damaged: { label: 'Dañado',  color: 'text-red-400',    bg: 'bg-red-500/10',     emoji: '✗' },
};

export default function InspeccionesPage() {
  const { headers } = useAdminAuth();

  /* ─── State ────────────────────────────────────────────── */
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [rooms, setRooms] = useState<string[]>([]);
  const [items, setItems] = useState<string[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [expanded, setExpanded] = useState<string | null>(null);

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newInsp, setNewInsp] = useState({
    property_name: '', tenant_name: '', type: 'move_in' as InspectionType,
    scheduled_date: '', general_notes: '', inspector: 'Admin',
  });

  // Checklist editing
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRooms, setEditRooms] = useState<Record<string, { items: Record<string, { condition: Condition; notes: string }> }>>({});
  const [saving, setSaving] = useState(false);

  /* ─── Fetch ────────────────────────────────────────────── */
  const fetchAll = useCallback(async () => {
    try {
      const [iRes, pRes, tRes] = await Promise.all([
        fetch('/api/admin/inspections', { headers: headers() }),
        fetch('/api/admin/properties', { headers: headers() }),
        fetch('/api/admin/tenants', { headers: headers() }),
      ]);
      if (iRes.ok) {
        const d = await iRes.json();
        setInspections(d.inspections || []);
        setRooms(d.rooms || []);
        setItems(d.items || []);
      }
      if (pRes.ok) { const d = await pRes.json(); setProperties(d.properties || []); }
      if (tRes.ok) { const d = await tRes.json(); setTenants(d.tenants || []); }
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  /* ─── Actions ──────────────────────────────────────────── */
  const createInspection = async () => {
    if (!newInsp.property_name) return;
    setCreating(true);
    try {
      const res = await fetch('/api/admin/inspections', {
        method: 'POST', headers: headers(), body: JSON.stringify(newInsp),
      });
      if (res.ok) {
        setShowCreate(false);
        setNewInsp({ property_name: '', tenant_name: '', type: 'move_in', scheduled_date: '', general_notes: '', inspector: 'Admin' });
        fetchAll();
      }
    } catch (e) { console.error(e); }
    setCreating(false);
  };

  const startChecklist = (insp: Inspection) => {
    setEditingId(insp._id);
    // Initialize rooms structure from backend defaults if not already set
    const existing = insp.rooms || {};
    const roomData: Record<string, { items: Record<string, { condition: Condition; notes: string }> }> = {};
    for (const room of rooms) {
      const existingRoom = existing[room];
      const itemData: Record<string, { condition: Condition; notes: string }> = {};
      for (const item of items) {
        itemData[item] = existingRoom?.items?.[item] || { condition: 'good', notes: '' };
      }
      roomData[room] = { items: itemData };
    }
    setEditRooms(roomData);
  };

  const saveChecklist = async (inspId: string, markComplete = false) => {
    setSaving(true);
    try {
      const body: any = { rooms: editRooms };
      if (markComplete) body.status = 'completed';
      else body.status = 'in_progress';

      await fetch(`/api/admin/inspections/${inspId}`, {
        method: 'PUT', headers: headers(), body: JSON.stringify(body),
      });
      setEditingId(null);
      fetchAll();
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  const updateStatus = async (id: string, status: InspectionStatus) => {
    try {
      await fetch(`/api/admin/inspections/${id}`, {
        method: 'PUT', headers: headers(), body: JSON.stringify({ status }),
      });
      fetchAll();
    } catch (e) { console.error(e); }
  };

  /* ─── Filters ──────────────────────────────────────────── */
  const filtered = inspections.filter(i => {
    const q = search.toLowerCase();
    const matchSearch = !search ||
      (i.property_name || '').toLowerCase().includes(q) ||
      (i.tenant_name || '').toLowerCase().includes(q) ||
      (i.inspector || '').toLowerCase().includes(q);
    const matchType = typeFilter === 'all' || i.type === typeFilter;
    const matchStatus = statusFilter === 'all' || i.status === statusFilter;
    return matchSearch && matchType && matchStatus;
  });

  const stats = {
    total: inspections.length,
    pending: inspections.filter(i => i.status === 'pending').length,
    in_progress: inspections.filter(i => i.status === 'in_progress').length,
    completed: inspections.filter(i => i.status === 'completed').length,
  };

  /* ─── Render ───────────────────────────────────────────── */
  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-3 border-lime-500/30 border-t-lime-500 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-5 relative">
      <div className="fixed top-0 left-1/3 w-96 h-96 bg-lime-500/[0.02] rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-lime-500/20 to-lime-500/5 border border-lime-500/20 flex items-center justify-center">
            <ClipboardCheck className="w-6 h-6 text-lime-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Inspecciones</h2>
            <p className="text-sm text-gray-500">Checklist de Move-In / Move-Out y rutinarias</p>
          </div>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-lime-600 to-lime-500 text-white rounded-xl text-sm font-bold hover:opacity-90 transition shadow-[0_0_20px_rgba(132,204,22,0.2)]">
          <Plus className="w-4 h-4" /> Nueva Inspección
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total" value={stats.total} color="gray" icon={ClipboardCheck} />
        <StatCard label="Pendientes" value={stats.pending} color="amber" icon={Clock} alert={stats.pending > 0} />
        <StatCard label="En Progreso" value={stats.in_progress} color="blue" icon={Eye} />
        <StatCard label="Completadas" value={stats.completed} color="emerald" icon={CheckCircle2} />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white/[0.03] border border-white/[0.08] rounded-xl text-white text-sm focus:border-lime-500 focus:outline-none"
            placeholder="Buscar por propiedad, inquilino, inspector..." />
        </div>
        <div className="flex gap-1 bg-white/[0.03] rounded-xl p-1 border border-white/[0.06]">
          {[{ key: 'all', label: 'Todos' }, ...Object.entries(TYPE_CONFIG).map(([k, v]) => ({ key: k, label: v.label }))].map(s => (
            <button key={s.key} onClick={() => setTypeFilter(s.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition whitespace-nowrap ${
                typeFilter === s.key ? 'bg-lime-500/15 text-lime-400 border border-lime-500/25' : 'text-gray-500 hover:text-gray-300 border border-transparent'
              }`}>
              {s.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1 bg-white/[0.03] rounded-xl p-1 border border-white/[0.06]">
          {[{ key: 'all', label: 'Todos' }, ...Object.entries(STATUS_CONFIG).map(([k, v]) => ({ key: k, label: v.label }))].map(s => (
            <button key={s.key} onClick={() => setStatusFilter(s.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition whitespace-nowrap ${
                statusFilter === s.key ? 'bg-lime-500/15 text-lime-400 border border-lime-500/25' : 'text-gray-500 hover:text-gray-300 border border-transparent'
              }`}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Inspections List */}
      {filtered.length === 0 ? (
        <div className="bg-white/[0.03] rounded-2xl border border-white/[0.06] p-12 text-center">
          <ClipboardCheck className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500">{search || typeFilter !== 'all' || statusFilter !== 'all' ? 'No se encontraron inspecciones con esos filtros' : 'No hay inspecciones creadas'}</p>
          <button onClick={() => setShowCreate(true)} className="mt-3 text-sm text-lime-400 hover:text-lime-300 font-bold">
            + Crear primera inspección
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(insp => {
            const tp = TYPE_CONFIG[insp.type] || TYPE_CONFIG.move_in;
            const st = STATUS_CONFIG[insp.status] || STATUS_CONFIG.pending;
            const TpIcon = tp.icon;
            const StIcon = st.icon;
            const isExpanded = expanded === insp._id;
            const isEditing = editingId === insp._id;

            // Count room scores
            const roomEntries = Object.entries(insp.rooms || {});
            const totalChecked = roomEntries.reduce((acc, [, r]) => acc + Object.keys(r.items || {}).length, 0);
            const totalDamaged = roomEntries.reduce((acc: number, [, r]) =>
              acc + Object.values(r.items || {}).filter((it: any) => it.condition === 'damaged' || it.condition === 'poor').length
            , 0);

            return (
              <div key={insp._id} className={`bg-white/[0.03] backdrop-blur-sm rounded-2xl border transition ${
                isExpanded ? 'border-lime-500/20' : 'border-white/[0.06] hover:border-white/[0.12]'
              }`}>
                {/* Main row */}
                <div className="p-4 flex items-center gap-3 cursor-pointer" onClick={() => { setExpanded(isExpanded ? null : insp._id); if (isEditing && !isExpanded) setEditingId(null); }}>
                  <div className={`w-10 h-10 rounded-xl ${tp.bg} ${tp.border} border flex items-center justify-center flex-shrink-0`}>
                    <TpIcon className={`w-5 h-5 ${tp.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-bold text-white truncate">{insp.property_name || 'Sin propiedad'}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${tp.bg} ${tp.color}`}>{tp.label}</span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-gray-500">
                      <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {insp.tenant_name || 'N/A'}</span>
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {insp.scheduled_date ? new Date(insp.scheduled_date).toLocaleDateString('es-US') : 'Sin fecha'}</span>
                      {totalChecked > 0 && (
                        <span className="flex items-center gap-1">
                          <ClipboardCheck className="w-3 h-3" /> {totalChecked} items
                          {totalDamaged > 0 && <span className="text-red-400">({totalDamaged} problemas)</span>}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold ${st.bg} ${st.color} ${st.border} border hidden sm:block`}>{st.label}</span>
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                </div>

                {/* Expanded details / Checklist */}
                {isExpanded && (
                  <div className="border-t border-white/[0.06] p-4 space-y-4">
                    {/* Info */}
                    <div className="flex flex-wrap gap-3 text-xs">
                      <span className="text-gray-400">Inspector: <span className="text-white font-bold">{insp.inspector || 'Admin'}</span></span>
                      <span className="text-gray-400">Creada: <span className="text-white">{insp.created_at ? new Date(insp.created_at).toLocaleDateString('es-US') : ''}</span></span>
                      {insp.completed_at && <span className="text-gray-400">Completada: <span className="text-emerald-400">{new Date(insp.completed_at).toLocaleDateString('es-US')}</span></span>}
                    </div>

                    {insp.general_notes && (
                      <div className="text-xs text-gray-400">
                        <span className="font-bold">Notas:</span> <span className="text-gray-300">{insp.general_notes}</span>
                      </div>
                    )}

                    {/* Checklist View / Edit */}
                    {isEditing ? (
                      <ChecklistEditor
                        rooms={rooms} items={items}
                        editRooms={editRooms} setEditRooms={setEditRooms}
                        onSave={() => saveChecklist(insp._id, false)}
                        onComplete={() => saveChecklist(insp._id, true)}
                        onCancel={() => setEditingId(null)}
                        saving={saving}
                      />
                    ) : (
                      <>
                        {/* Read-only summary of rooms */}
                        {roomEntries.length > 0 && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {roomEntries.map(([roomName, roomData]) => {
                              const itemEntries = Object.entries(roomData.items || {});
                              return (
                                <div key={roomName} className="bg-white/[0.02] rounded-xl border border-white/[0.05] p-3">
                                  <p className="text-xs font-bold text-white mb-2">{roomName}</p>
                                  <div className="space-y-1">
                                    {itemEntries.map(([itemName, itemData]: [string, any]) => {
                                      const cond = CONDITION_CONFIG[itemData.condition as Condition] || CONDITION_CONFIG.good;
                                      return (
                                        <div key={itemName} className="flex items-center justify-between text-[11px]">
                                          <span className="text-gray-400">{itemName.split('/')[0]}</span>
                                          <span className={`px-1.5 py-0.5 rounded ${cond.bg} ${cond.color} font-bold`}>{cond.label}</span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex items-center gap-2 pt-2 border-t border-white/[0.04]">
                          <button onClick={(e) => { e.stopPropagation(); startChecklist(insp); }}
                            className="flex items-center gap-1.5 px-4 py-2 bg-lime-500/10 border border-lime-500/20 rounded-xl text-lime-400 text-xs font-bold hover:bg-lime-500/20 transition">
                            <ClipboardCheck className="w-3.5 h-3.5" /> {roomEntries.length > 0 ? 'Editar Checklist' : 'Llenar Checklist'}
                          </button>
                          {insp.status !== 'completed' && (
                            <>
                              {Object.entries(STATUS_CONFIG).filter(([k]) => k !== insp.status).map(([key, cfg]) => (
                                <button key={key} onClick={(e) => { e.stopPropagation(); updateStatus(insp._id, key as InspectionStatus); }}
                                  className={`text-xs px-3 py-2 rounded-xl font-medium transition border ${cfg.bg} ${cfg.color} ${cfg.border} hover:opacity-80`}>
                                  {cfg.label}
                                </button>
                              ))}
                            </>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ─── Create Modal ────────────────────────────────── */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-[#0c1220] rounded-2xl border border-white/[0.08] w-full max-w-lg p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Nueva Inspección</h3>
              <button onClick={() => setShowCreate(false)} className="text-gray-500 hover:text-gray-300"><X className="w-5 h-5" /></button>
            </div>

            {/* Property */}
            <div>
              <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wider">Propiedad</label>
              <select value={newInsp.property_name} onChange={e => setNewInsp({ ...newInsp, property_name: e.target.value })}
                className="w-full px-4 py-2.5 bg-[#0a1020]/60 border border-white/[0.08] rounded-xl text-white text-sm focus:border-lime-500 focus:outline-none appearance-none">
                <option value="">Seleccionar propiedad...</option>
                {properties.map(p => <option key={p._id} value={p.name || p.address}>{p.name || p.address}</option>)}
              </select>
            </div>

            {/* Tenant */}
            <div>
              <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wider">Inquilino</label>
              <select value={newInsp.tenant_name} onChange={e => setNewInsp({ ...newInsp, tenant_name: e.target.value })}
                className="w-full px-4 py-2.5 bg-[#0a1020]/60 border border-white/[0.08] rounded-xl text-white text-sm focus:border-lime-500 focus:outline-none appearance-none">
                <option value="">Seleccionar inquilino...</option>
                {tenants.map(t => <option key={t._id} value={t.name}>{t.name}</option>)}
              </select>
            </div>

            {/* Type */}
            <div>
              <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wider">Tipo</label>
              <div className="flex gap-2">
                {(Object.entries(TYPE_CONFIG) as [InspectionType, typeof TYPE_CONFIG['move_in']][]).map(([key, cfg]) => {
                  const TIcon = cfg.icon;
                  return (
                    <button key={key} onClick={() => setNewInsp({ ...newInsp, type: key })}
                      className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-xs font-bold transition ${
                        newInsp.type === key ? `${cfg.bg} ${cfg.border} ${cfg.color}` : 'bg-white/[0.02] border-white/[0.06] text-gray-500 hover:text-gray-300'
                      }`}>
                      <TIcon className="w-3.5 h-3.5" /> {cfg.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Date */}
            <div>
              <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wider">Fecha Programada</label>
              <input type="date" value={newInsp.scheduled_date} onChange={e => setNewInsp({ ...newInsp, scheduled_date: e.target.value })}
                className="w-full px-4 py-2.5 bg-[#0a1020]/60 border border-white/[0.08] rounded-xl text-white text-sm focus:border-lime-500 focus:outline-none" />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wider">Notas Generales</label>
              <textarea value={newInsp.general_notes} onChange={e => setNewInsp({ ...newInsp, general_notes: e.target.value })} rows={2}
                className="w-full px-4 py-2.5 bg-[#0a1020]/60 border border-white/[0.08] rounded-xl text-white text-sm focus:border-lime-500 focus:outline-none resize-none"
                placeholder="Notas opcionales..." />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowCreate(false)} className="flex-1 py-2.5 rounded-xl border border-white/[0.08] text-gray-400 text-sm font-bold hover:bg-white/[0.03] transition">
                Cancelar
              </button>
              <button onClick={createInspection} disabled={creating || !newInsp.property_name}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-lime-600 to-lime-500 text-white rounded-xl text-sm font-bold hover:opacity-90 transition disabled:opacity-30">
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Crear
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   CHECKLIST EDITOR — Room-by-Room Item Grading
   ═══════════════════════════════════════════════════════════ */
function ChecklistEditor({
  rooms, items, editRooms, setEditRooms, onSave, onComplete, onCancel, saving,
}: {
  rooms: string[]; items: string[];
  editRooms: Record<string, { items: Record<string, { condition: Condition; notes: string }> }>;
  setEditRooms: React.Dispatch<React.SetStateAction<typeof editRooms>>;
  onSave: () => void; onComplete: () => void; onCancel: () => void; saving: boolean;
}) {
  const [activeRoom, setActiveRoom] = useState(rooms[0] || '');

  const setCond = (room: string, item: string, condition: Condition) => {
    setEditRooms(prev => ({
      ...prev,
      [room]: {
        ...prev[room],
        items: { ...prev[room]?.items, [item]: { ...prev[room]?.items?.[item], condition } },
      },
    }));
  };

  const setNote = (room: string, item: string, notes: string) => {
    setEditRooms(prev => ({
      ...prev,
      [room]: {
        ...prev[room],
        items: { ...prev[room]?.items, [item]: { ...prev[room]?.items?.[item], notes } },
      },
    }));
  };

  return (
    <div className="space-y-4">
      {/* Room tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {rooms.map(room => (
          <button key={room} onClick={(e) => { e.stopPropagation(); setActiveRoom(room); }}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap transition border ${
              activeRoom === room
                ? 'bg-lime-500/10 border-lime-500/25 text-lime-400'
                : 'bg-white/[0.02] border-white/[0.06] text-gray-500 hover:text-gray-300'
            }`}>
            {room.split('/')[0]}
          </button>
        ))}
      </div>

      {/* Items grid for active room */}
      <div className="bg-white/[0.02] rounded-xl border border-white/[0.05] p-4 space-y-3">
        <p className="text-xs font-bold text-white mb-2">{activeRoom}</p>
        {items.map(item => {
          const current = editRooms[activeRoom]?.items?.[item] || { condition: 'good' as Condition, notes: '' };
          return (
            <div key={item} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-300 font-medium">{item}</span>
                <div className="flex gap-1">
                  {(Object.entries(CONDITION_CONFIG) as [Condition, typeof CONDITION_CONFIG['good']][]).map(([cKey, cCfg]) => (
                    <button key={cKey}
                      onClick={(e) => { e.stopPropagation(); setCond(activeRoom, item, cKey); }}
                      className={`px-2 py-1 rounded-lg text-[10px] font-bold transition border ${
                        current.condition === cKey
                          ? `${cCfg.bg} ${cCfg.color} border-current`
                          : 'bg-white/[0.02] border-white/[0.06] text-gray-600 hover:text-gray-400'
                      }`}>
                      {cCfg.label}
                    </button>
                  ))}
                </div>
              </div>
              {(current.condition === 'poor' || current.condition === 'damaged') && (
                <input value={current.notes || ''}
                  onClick={e => e.stopPropagation()}
                  onChange={e => setNote(activeRoom, item, e.target.value)}
                  className="w-full px-3 py-1.5 bg-[#0a1020]/60 border border-white/[0.08] rounded-lg text-white text-[11px] focus:border-lime-500 focus:outline-none"
                  placeholder="Describe el problema..." />
              )}
            </div>
          );
        })}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button onClick={(e) => { e.stopPropagation(); onCancel(); }}
          className="px-4 py-2 rounded-xl border border-white/[0.08] text-gray-400 text-xs font-bold hover:bg-white/[0.03] transition">
          Cancelar
        </button>
        <button onClick={(e) => { e.stopPropagation(); onSave(); }} disabled={saving}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-400 text-xs font-bold hover:bg-blue-500/20 transition disabled:opacity-30">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Guardar Borrador
        </button>
        <button onClick={(e) => { e.stopPropagation(); onComplete(); }} disabled={saving}
          className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-xs font-bold hover:bg-emerald-500/20 transition disabled:opacity-30">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />} Completar Inspección
        </button>
      </div>
    </div>
  );
}

/* ─── Stat Card ──────────────────────────────────────────────── */
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
