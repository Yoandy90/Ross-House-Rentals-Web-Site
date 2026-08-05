'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useAdminAuth } from '../layout';
import {
  Heart, Search, Filter, Download, Settings as SettingsIcon, Mail, Phone, MessageSquare,
  Users, DollarSign, Calendar, Home, Briefcase, MapPin, Bell, Send, Sparkles,
  CheckCircle2, XCircle, Clock, UserCheck, TrendingUp, Eye, Trash2, Edit3, X,
  ChevronDown, AlertCircle, Loader2, Flame, Zap, Snowflake,
} from 'lucide-react';

type Lead = any;
type Status = 'new' | 'contacted' | 'qualified' | 'applied' | 'rented' | 'rejected';

const STATUS_LABELS: Record<Status, { es: string; en: string; color: string; icon: any }> = {
  new:        { es: 'Nuevo', en: 'New', color: 'bg-blue-500/15 text-blue-300 border-blue-500/30', icon: Sparkles },
  contacted:  { es: 'Contactado', en: 'Contacted', color: 'bg-amber-500/15 text-amber-300 border-amber-500/30', icon: Phone },
  qualified:  { es: 'Calificado', en: 'Qualified', color: 'bg-violet-500/15 text-violet-300 border-violet-500/30', icon: UserCheck },
  applied:    { es: 'Aplicación', en: 'Applied', color: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30', icon: Clock },
  rented:     { es: 'Rentado', en: 'Rented', color: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30', icon: CheckCircle2 },
  rejected:   { es: 'Descartado', en: 'Rejected', color: 'bg-rose-500/15 text-rose-300 border-rose-500/30', icon: XCircle },
};

const STATUS_ORDER: Status[] = ['new', 'contacted', 'qualified', 'applied', 'rented', 'rejected'];

// ───── AI Lead Scoring helpers (Phase 2) ─────────────────────────────
type ScoreLabel = 'hot' | 'warm' | 'cold' | null;

function getScoreLabel(score?: number | null): ScoreLabel {
  if (score == null) return null;
  if (score >= 75) return 'hot';
  if (score >= 50) return 'warm';
  return 'cold';
}

function ScoreBadge({ score, label, compact = false }: { score?: number | null; label?: string | null; compact?: boolean }) {
  if (score == null) {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-gray-500/10 border border-gray-500/30 text-gray-400" title="Sin scoring aún">
        <Sparkles className="w-2.5 h-2.5" /> —
      </span>
    );
  }
  const lab = (label as ScoreLabel) || getScoreLabel(score);
  const cfg = {
    hot:  { bg: 'bg-rose-500/15',    border: 'border-rose-500/40',    text: 'text-rose-300',    icon: <Flame className="w-3 h-3" />,     name: 'HOT'  },
    warm: { bg: 'bg-amber-500/15',   border: 'border-amber-500/40',   text: 'text-amber-300',   icon: <Zap className="w-3 h-3" />,       name: 'WARM' },
    cold: { bg: 'bg-sky-500/15',     border: 'border-sky-500/40',     text: 'text-sky-300',     icon: <Snowflake className="w-3 h-3" />, name: 'COLD' },
  }[lab || 'cold'];
  if (compact) {
    return (
      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold border ${cfg.bg} ${cfg.border} ${cfg.text}`}>
        {cfg.icon}<span className="tabular-nums">{score}</span>
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold border ${cfg.bg} ${cfg.border} ${cfg.text}`}>
      {cfg.icon}
      <span className="tabular-nums">{score}/100</span>
      <span className="opacity-70">·</span>
      <span>{cfg.name}</span>
    </span>
  );
}

export default function InteresadosPage() {
  const { token } = useAdminAuth();
  const [view, setView] = useState<'kanban' | 'list'>('kanban');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>({});
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterBedrooms, setFilterBedrooms] = useState<number | null>(null);
  const [selected, setSelected] = useState<Lead | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const headers = useCallback(() => ({
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }), [token]);

  const fetchLeads = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus !== 'all') params.set('status', filterStatus);
      if (filterBedrooms) params.set('bedrooms', String(filterBedrooms));
      if (search) params.set('search', search);
      const res = await fetch(`/api/admin/tenant-leads?${params}`, { headers: headers() });
      const data = await res.json();
      setLeads(data.leads || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [filterStatus, filterBedrooms, search, token, headers]);

  const fetchStats = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/admin/tenant-leads/stats', { headers: headers() });
      const data = await res.json();
      setStats(data);
    } catch (e) { console.error(e); }
  }, [token, headers]);

  useEffect(() => { fetchLeads(); fetchStats(); }, [fetchLeads, fetchStats]);

  const updateStatus = async (leadId: string, status: Status) => {
    await fetch(`/api/admin/tenant-leads/${leadId}`, {
      method: 'PATCH',
      headers: headers(),
      body: JSON.stringify({ status }),
    });
    fetchLeads(); fetchStats();
  };

  const deleteLead = async (leadId: string) => {
    if (!confirm('¿Eliminar este prospecto? Esta acción no se puede deshacer.')) return;
    await fetch(`/api/admin/tenant-leads/${leadId}`, { method: 'DELETE', headers: headers() });
    setSelected(null);
    fetchLeads(); fetchStats();
  };

  const exportCSV = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/admin/tenant-leads/export/csv', { headers: headers() });
      if (!res.ok) {
        alert('No se pudo exportar el CSV. Verifica tu sesión.');
        return;
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tenant_leads_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert('Error al exportar CSV');
    }
  };

  const [scoringAll, setScoringAll] = useState(false);
  const scoreAll = async () => {
    if (!token || scoringAll) return;
    const force = confirm('¿Re-puntuar TODOS los leads (force)?\n\nOK = sí (sobrescribe scores existentes)\nCancel = solo los que no tienen score');
    setScoringAll(true);
    try {
      const res = await fetch(`/api/admin/tenant-leads/score-all${force ? '?force=1' : ''}`, {
        method: 'POST', headers: headers(),
      });
      const data = await res.json();
      alert(`✅ Scoring completo: ${data.scored} leads procesados, ${data.failed} fallaron.`);
      fetchLeads();
    } catch (e: any) {
      alert('Error: ' + e.message);
    }
    setScoringAll(false);
  };

  // Kanban groupings
  const byStatus: Record<Status, Lead[]> = {
    new: [], contacted: [], qualified: [], applied: [], rented: [], rejected: []
  };
  leads.forEach(l => { if (byStatus[l.status as Status]) byStatus[l.status as Status].push(l); });

  return (
    <div className="min-h-screen bg-[#070B14] text-white">
      {/* Header */}
      <div className="border-b border-white/10 bg-[#0a1020]/80 backdrop-blur-xl sticky top-0 z-30">
        <div className="px-6 py-5 flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-xl bg-pink-500/15 border border-pink-500/30 flex items-center justify-center">
                <Heart className="w-5 h-5 text-pink-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Lista de Espera</h1>
                <p className="text-xs text-gray-500">Inquilinos interesados</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={scoreAll} disabled={scoringAll} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-violet-500/10 border border-violet-500/30 text-violet-300 hover:bg-violet-500/20 text-sm disabled:opacity-50">
              {scoringAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} AI Score
            </button>
            <button onClick={() => setShowSettings(true)} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 hover:border-white/20 text-sm">
              <SettingsIcon className="w-4 h-4" /> Configuración
            </button>
            <button onClick={exportCSV} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 hover:border-white/20 text-sm">
              <Download className="w-4 h-4" /> CSV
            </button>
            <a href="/interesados" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20 text-sm">
              <Eye className="w-4 h-4" /> Ver formulario público
            </a>
          </div>
        </div>

        {/* Stats */}
        <div className="px-6 pb-5 grid grid-cols-2 md:grid-cols-7 gap-2">
          <StatCard label="Total" value={stats.total || 0} color="text-white" />
          {STATUS_ORDER.map(s => (
            <StatCard
              key={s}
              label={STATUS_LABELS[s].es}
              value={stats.by_status?.[s] || 0}
              color={STATUS_LABELS[s].color.split(' ')[1]}
            />
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="px-6 py-4 border-b border-white/5 flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1 bg-white/5 rounded-lg p-1 border border-white/10">
          <button onClick={() => setView('kanban')} className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${view === 'kanban' ? 'bg-white/10 text-white' : 'text-gray-400'}`}>Kanban</button>
          <button onClick={() => setView('list')} className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${view === 'list' ? 'bg-white/10 text-white' : 'text-gray-400'}`}>Lista</button>
        </div>
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nombre, email o teléfono..." className="w-full pl-9 pr-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:border-emerald-500 outline-none" />
        </div>
        <select value={filterBedrooms || ''} onChange={e => setFilterBedrooms(e.target.value ? parseInt(e.target.value) : null)} className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm">
          <option value="">Todas las hab.</option>
          {[1,2,3,4,5,6].map(n => <option key={n} value={n}>{n} hab.</option>)}
        </select>
      </div>

      {/* Content */}
      <div className="p-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-gray-500" />
          </div>
        ) : leads.length === 0 ? (
          <EmptyState />
        ) : view === 'kanban' ? (
          <KanbanView byStatus={byStatus} onSelect={setSelected} onStatusChange={updateStatus} />
        ) : (
          <ListView leads={leads} onSelect={setSelected} />
        )}
      </div>

      {/* Detail Drawer */}
      {selected && (
        <LeadDetail
          lead={selected}
          onClose={() => setSelected(null)}
          onUpdate={fetchLeads}
          onDelete={deleteLead}
        />
      )}

      {/* Settings Modal */}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-white/[0.03] border border-white/10 rounded-xl p-3">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-20">
      <div className="w-20 h-20 rounded-full bg-pink-500/10 border border-pink-500/30 flex items-center justify-center mx-auto mb-4">
        <Heart className="w-10 h-10 text-pink-400" />
      </div>
      <h3 className="text-lg font-bold mb-2">Aún no hay prospectos</h3>
      <p className="text-gray-400 text-sm mb-6">Cuando alguien se registre desde el formulario público, aparecerá aquí.</p>
      <a href="/interesados" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-sm">
        <Eye className="w-4 h-4" /> Ver formulario público
      </a>
    </div>
  );
}

function KanbanView({ byStatus, onSelect, onStatusChange }: { byStatus: Record<Status, Lead[]>; onSelect: (l: Lead) => void; onStatusChange: (id: string, s: Status) => void }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
      {STATUS_ORDER.map(status => {
        const cfg = STATUS_LABELS[status];
        const Icon = cfg.icon;
        const items = byStatus[status];
        return (
          <div key={status} className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-3 min-h-[300px]">
            <div className={`flex items-center justify-between mb-3 px-2 py-1.5 rounded-lg border ${cfg.color}`}>
              <div className="flex items-center gap-1.5 text-xs font-bold">
                <Icon className="w-3.5 h-3.5" /> {cfg.es}
              </div>
              <span className="text-xs font-bold">{items.length}</span>
            </div>
            <div className="space-y-2">
              {items.map(lead => (
                <KanbanCard key={lead._id} lead={lead} onSelect={onSelect} onStatusChange={onStatusChange} />
              ))}
              {items.length === 0 && <div className="text-xs text-gray-600 text-center py-6">—</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function KanbanCard({ lead, onSelect, onStatusChange }: { lead: Lead; onSelect: (l: Lead) => void; onStatusChange: (id: string, s: Status) => void }) {
  const created = new Date(lead.created_at);
  const days = Math.floor((Date.now() - created.getTime()) / 86400000);
  return (
    <div onClick={() => onSelect(lead)} className="bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.08] hover:border-white/15 rounded-xl p-3 cursor-pointer transition group">
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="font-semibold text-sm truncate flex-1">{lead.name}</div>
        <ScoreBadge score={lead.score} label={lead.score_label} compact />
      </div>
      <div className="text-xs text-gray-400 mb-2 flex items-center gap-2 flex-wrap">
        <span className="flex items-center gap-1"><Home className="w-3 h-3" /> {lead.bedrooms_wanted}h</span>
        <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" /> ${lead.max_budget?.toLocaleString()}</span>
      </div>
      <div className="flex items-center justify-between text-[10px] text-gray-500">
        <span>{days === 0 ? 'Hoy' : `${days}d`}</span>
        <select
          onClick={e => e.stopPropagation()}
          value={lead.status}
          onChange={e => onStatusChange(lead._id, e.target.value as Status)}
          className="bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-[10px] opacity-0 group-hover:opacity-100 transition"
        >
          {STATUS_ORDER.map(s => <option key={s} value={s}>{STATUS_LABELS[s].es}</option>)}
        </select>
      </div>
    </div>
  );
}

function ListView({ leads, onSelect }: { leads: Lead[]; onSelect: (l: Lead) => void }) {
  return (
    <div className="bg-white/[0.02] border border-white/10 rounded-2xl overflow-hidden">
      <div className="grid grid-cols-12 gap-3 px-4 py-3 border-b border-white/10 text-[10px] uppercase tracking-wider text-gray-500 font-bold">
        <div className="col-span-2">Nombre</div>
        <div className="col-span-1 text-center">Score</div>
        <div className="col-span-3">Contacto</div>
        <div className="col-span-1 text-center">Hab.</div>
        <div className="col-span-2 text-right">Presupuesto</div>
        <div className="col-span-2">Mudanza</div>
        <div className="col-span-1 text-right">Estado</div>
      </div>
      {leads.map(lead => {
        const cfg = STATUS_LABELS[lead.status as Status] || STATUS_LABELS.new;
        return (
          <div key={lead._id} onClick={() => onSelect(lead)} className="grid grid-cols-12 gap-3 px-4 py-3 border-b border-white/5 hover:bg-white/[0.03] cursor-pointer items-center text-sm">
            <div className="col-span-2 font-medium truncate">{lead.name}</div>
            <div className="col-span-1 text-center"><ScoreBadge score={lead.score} label={lead.score_label} compact /></div>
            <div className="col-span-3 text-xs text-gray-400 truncate">{lead.email}<br/>{lead.phone}</div>
            <div className="col-span-1 text-center">{lead.bedrooms_wanted}</div>
            <div className="col-span-2 text-right font-mono">${lead.max_budget?.toLocaleString()}</div>
            <div className="col-span-2 text-xs text-gray-400">{lead.move_in_date || 'Flexible'}</div>
            <div className="col-span-1 text-right">
              <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${cfg.color}`}>{cfg.es}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function LeadDetail({ lead, onClose, onUpdate, onDelete }: { lead: Lead; onClose: () => void; onUpdate: () => void; onDelete: (id: string) => void }) {
  const { token } = useAdminAuth();
  const [notes, setNotes] = useState(lead.admin_notes || '');
  const [status, setStatus] = useState(lead.status);
  const [showNotify, setShowNotify] = useState(false);

  const save = async () => {
    await fetch(`/api/admin/tenant-leads/${lead._id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ admin_notes: notes, status }),
    });
    onUpdate();
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-xl bg-[#0a1020] border-l border-white/10 overflow-y-auto">
        <div className="sticky top-0 bg-[#0a1020]/95 backdrop-blur-xl border-b border-white/10 px-6 py-4 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-lg font-bold">{lead.name}</h2>
              <ScoreBadge score={lead.score} label={lead.score_label} />
            </div>
            <p className="text-xs text-gray-500">{new Date(lead.created_at).toLocaleString('es-MX')}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-lg"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 space-y-5">
          {/* AI Score breakdown */}
          <ScoreSection lead={lead} onUpdate={onUpdate} />

          {/* Contact */}
          <Section title="Contacto">
            <Info icon={<Mail className="w-4 h-4" />} label="Email" value={<a href={`mailto:${lead.email}`} className="text-emerald-400 hover:underline">{lead.email}</a>} />
            <Info icon={<Phone className="w-4 h-4" />} label="Teléfono" value={<a href={`tel:${lead.phone}`} className="text-emerald-400 hover:underline">{lead.phone}</a>} />
            <Info icon={<MapPin className="w-4 h-4" />} label="Idioma" value={lead.language_pref?.toUpperCase()} />
          </Section>

          {/* Criteria */}
          <Section title="Criterios de búsqueda">
            <Info icon={<Home className="w-4 h-4" />} label="Habitaciones" value={`${lead.bedrooms_wanted} hab.`} />
            <Info icon={<DollarSign className="w-4 h-4" />} label="Presupuesto máx" value={`$${lead.max_budget?.toLocaleString()}/mes`} />
            <Info icon={<Calendar className="w-4 h-4" />} label="Fecha mudanza" value={lead.move_in_date || 'Flexible'} />
            <Info icon={<Users className="w-4 h-4" />} label="Personas en hogar" value={lead.household_size} />
            <Info icon={<Heart className="w-4 h-4" />} label="Mascotas" value={lead.has_pets ? `Sí — ${lead.pet_details || ''}` : 'No'} />
          </Section>

          {/* Financial */}
          <Section title="Información financiera y empleo">
            <Info icon={<Briefcase className="w-4 h-4" />} label="Empleo" value={lead.employment_status || '—'} />
            <Info icon={<DollarSign className="w-4 h-4" />} label="Ingreso mensual" value={lead.monthly_income ? `$${lead.monthly_income.toLocaleString()}` : '—'} />
            <Info icon={<MapPin className="w-4 h-4" />} label="Situación actual" value={lead.current_situation || '—'} />
          </Section>

          {/* User notes */}
          {lead.notes && (
            <Section title="Comentarios del prospecto">
              <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-gray-300 whitespace-pre-wrap">{lead.notes}</div>
            </Section>
          )}

          {/* Status & Notes */}
          <Section title="Gestión interna">
            <label className="block">
              <span className="text-xs text-gray-400 mb-1.5 block">Estado</span>
              <select value={status} onChange={e => setStatus(e.target.value)} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm">
                {STATUS_ORDER.map(s => <option key={s} value={s}>{STATUS_LABELS[s].es}</option>)}
              </select>
            </label>
            <label className="block mt-3">
              <span className="text-xs text-gray-400 mb-1.5 block">Notas internas (privadas)</span>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={4} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm" />
            </label>
            <button onClick={save} className="mt-3 w-full py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 font-semibold text-sm">Guardar cambios</button>
          </Section>

          {/* Notifications sent */}
          {(lead.notifications_sent?.length || 0) > 0 && (
            <Section title={`Historial de notificaciones (${lead.notifications_sent.length})`}>
              <div className="space-y-2">
                {lead.notifications_sent.slice().reverse().map((n: any, i: number) => (
                  <div key={i} className="bg-white/5 border border-white/10 rounded-lg p-2.5 text-xs">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">{n.type}</span>
                      <span className="text-gray-500">{n.sent_at ? new Date(n.sent_at).toLocaleString('es-MX') : ''}</span>
                    </div>
                    <div className="flex gap-2">
                      {n.email && <span className="text-emerald-400">📧 Email ✓</span>}
                      {n.sms && <span className="text-cyan-400">📱 SMS ✓</span>}
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-4">
            <button onClick={() => setShowNotify(true)} className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 font-semibold text-sm">
              <Send className="w-4 h-4" /> Enviar mensaje
            </button>
            <button onClick={() => onDelete(lead._id)} className="px-4 py-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 text-sm">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {showNotify && <NotifyModal lead={lead} onClose={() => setShowNotify(false)} onSent={() => { setShowNotify(false); onUpdate(); }} />}
      </div>
    </div>
  );
}

function NotifyModal({ lead, onClose, onSent }: { lead: Lead; onClose: () => void; onSent: () => void }) {
  const { token } = useAdminAuth();
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [email, setEmail] = useState(true);
  const [sms, setSms] = useState(true);
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!body.trim()) { alert('Escribe un mensaje'); return; }
    setSending(true);
    try {
      const res = await fetch(`/api/admin/tenant-leads/${lead._id}/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ subject: subject || 'Ross House Rentals', body, email, sms }),
      });
      const data = await res.json();
      alert(`Email: ${data.email_sent ? '✓' : '✗'} | SMS: ${data.sms_sent ? '✓' : '✗'}`);
      onSent();
    } catch (e: any) { alert('Error: ' + e.message); }
    setSending(false);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80" onClick={onClose} />
      <div className="relative w-full max-w-md bg-[#0a1020] border border-white/10 rounded-2xl p-6">
        <h3 className="text-lg font-bold mb-4">Enviar mensaje a {lead.name}</h3>
        <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Asunto (solo email)" className="w-full px-3 py-2 mb-3 bg-white/5 border border-white/10 rounded-lg text-sm" />
        <textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Mensaje..." rows={5} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm" />
        <div className="flex gap-3 mt-3 text-sm">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={email} onChange={e => setEmail(e.target.checked)} /> Email
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={sms} onChange={e => setSms(e.target.checked)} /> SMS
          </label>
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm">Cancelar</button>
          <button disabled={sending} onClick={send} className="flex-1 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 font-semibold text-sm disabled:opacity-50">
            {sending ? 'Enviando...' : 'Enviar'}
          </button>
        </div>
      </div>
    </div>
  );
}

function SettingsModal({ onClose }: { onClose: () => void }) {
  const { token } = useAdminAuth();
  const [settings, setSettings] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetch('/api/admin/lead-settings', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => setSettings(d.settings));
  }, [token]);

  const save = async () => {
    setSaving(true);
    try {
      await fetch('/api/admin/lead-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(settings),
      });
      alert('Configuración guardada');
      onClose();
    } catch (e: any) { alert('Error: ' + e.message); }
    setSaving(false);
  };

  if (!settings) return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80">
      <Loader2 className="w-8 h-8 animate-spin" />
    </div>
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-[#0a1020] border border-white/10 rounded-2xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold flex items-center gap-2"><SettingsIcon className="w-5 h-5 text-emerald-400" /> Configuración de Notificaciones</h3>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>

        <div className="space-y-4">
          <Toggle label="📧 Notificaciones por Email" sub="Enviar bienvenidas y alertas de disponibilidad" value={settings.email_enabled} onChange={v => setSettings({ ...settings, email_enabled: v })} />
          <Toggle label="📱 Notificaciones por SMS" sub="Enviar mensajes vía Twilio" value={settings.sms_enabled} onChange={v => setSettings({ ...settings, sms_enabled: v })} />
          <Toggle label="🤖 Piloto automático (Auto-match)" sub="Notificar automáticamente cuando una propiedad coincida con leads" value={settings.auto_match_enabled} onChange={v => setSettings({ ...settings, auto_match_enabled: v })} />

          <div className="border-t border-white/10 pt-4">
            <label className="block">
              <span className="text-xs text-gray-400 mb-1.5 block">Email de admin (para recibir alertas)</span>
              <input value={settings.notify_admin_email || ''} onChange={e => setSettings({ ...settings, notify_admin_email: e.target.value })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm" />
            </label>
          </div>

          <details className="border border-white/10 rounded-xl p-3">
            <summary className="cursor-pointer text-sm font-semibold text-gray-300">📝 Personalizar plantillas (avanzado)</summary>
            <div className="mt-4 space-y-3">
              <p className="text-xs text-gray-500">Placeholders disponibles: <code className="bg-white/10 px-1 rounded">{'{name}'}</code> <code className="bg-white/10 px-1 rounded">{'{bedrooms}'}</code> <code className="bg-white/10 px-1 rounded">{'{budget}'}</code> <code className="bg-white/10 px-1 rounded">{'{move_in}'}</code></p>
              <Field label="Asunto bienvenida (ES)" value={settings.welcome_email_subject_es} onChange={v => setSettings({ ...settings, welcome_email_subject_es: v })} />
              <Field label="Cuerpo bienvenida (ES)" value={settings.welcome_email_body_es} onChange={v => setSettings({ ...settings, welcome_email_body_es: v })} rows={6} />
              <Field label="SMS bienvenida (ES)" value={settings.welcome_sms_es} onChange={v => setSettings({ ...settings, welcome_sms_es: v })} rows={2} />
              <Field label="Subject welcome (EN)" value={settings.welcome_email_subject_en} onChange={v => setSettings({ ...settings, welcome_email_subject_en: v })} />
              <Field label="Body welcome (EN)" value={settings.welcome_email_body_en} onChange={v => setSettings({ ...settings, welcome_email_body_en: v })} rows={6} />
              <Field label="SMS welcome (EN)" value={settings.welcome_sms_en} onChange={v => setSettings({ ...settings, welcome_sms_en: v })} rows={2} />
            </div>
          </details>
        </div>

        <div className="flex gap-2 mt-6">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm">Cancelar</button>
          <button disabled={saving} onClick={save} className="flex-1 px-4 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 font-semibold text-sm disabled:opacity-50">
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, rows = 1 }: { label: string; value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <label className="block">
      <span className="text-xs text-gray-400 mb-1.5 block">{label}</span>
      {rows > 1 ? (
        <textarea value={value || ''} onChange={e => onChange(e.target.value)} rows={rows} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm font-mono" />
      ) : (
        <input value={value || ''} onChange={e => onChange(e.target.value)} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm" />
      )}
    </label>
  );
}

function Toggle({ label, sub, value, onChange }: { label: string; sub: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!value)} className="w-full flex items-center justify-between p-3 bg-white/5 border border-white/10 rounded-xl hover:border-white/20 transition text-left">
      <div>
        <div className="text-sm font-semibold text-white">{label}</div>
        <div className="text-xs text-gray-500">{sub}</div>
      </div>
      <div className={`w-11 h-6 rounded-full p-0.5 transition ${value ? 'bg-emerald-500' : 'bg-white/10'}`}>
        <div className={`w-5 h-5 rounded-full bg-white transition transform ${value ? 'translate-x-5' : ''}`} />
      </div>
    </button>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-2">{title}</h3>
      <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl divide-y divide-white/[0.04]">
        {children}
      </div>
    </div>
  );
}

function Info({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-3 py-2.5 text-sm">
      <span className="text-gray-400 flex items-center gap-2"><span className="text-gray-500">{icon}</span> {label}</span>
      <span className="text-white font-medium text-right">{value}</span>
    </div>
  );
}

function ScoreSection({ lead, onUpdate }: { lead: Lead; onUpdate: () => void }) {
  const { token } = useAdminAuth();
  const [rescoring, setRescoring] = useState(false);
  const [open, setOpen] = useState(true);

  const rescore = async () => {
    if (!token || rescoring) return;
    setRescoring(true);
    try {
      const res = await fetch(`/api/admin/tenant-leads/${lead._id}/score`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(await res.text());
      onUpdate();
    } catch (e: any) {
      alert('Error: ' + (e?.message || 'No se pudo recomputar el score'));
    }
    setRescoring(false);
  };

  const breakdown = (lead.score_breakdown || {}) as Record<string, number>;
  const categories = [
    { key: 'income_ratio',         label: 'Ingreso vs renta',  max: 30 },
    { key: 'employment',           label: 'Empleo',            max: 20 },
    { key: 'profile_completeness', label: 'Perfil completo',   max: 15 },
    { key: 'urgency',              label: 'Urgencia mudanza',  max: 15 },
    { key: 'budget_fit',           label: 'Presupuesto',       max: 10 },
    { key: 'household_match',      label: 'Familia/hab.',      max: 10 },
  ];

  return (
    <div>
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between mb-2">
        <h3 className="text-[10px] uppercase tracking-wider text-violet-400 font-bold flex items-center gap-1.5">
          <Sparkles className="w-3 h-3" /> AI Lead Score
        </h3>
        <ChevronDown className={`w-4 h-4 text-gray-500 transition ${open ? '' : '-rotate-90'}`} />
      </button>
      {open && (
        <div className="bg-gradient-to-br from-violet-500/5 to-violet-500/[0.02] border border-violet-500/20 rounded-xl p-4 space-y-3">
          {lead.score == null ? (
            <p className="text-xs text-gray-400">Este lead aún no tiene puntuación. Genera una usando Claude Sonnet 4.5.</p>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <ScoreBadge score={lead.score} label={lead.score_label} />
                <span className="text-[10px] text-gray-500">
                  {lead.scored_at ? new Date(lead.scored_at).toLocaleString('es-MX') : ''}
                </span>
              </div>
              {lead.score_reasoning && (
                <p className="text-xs text-gray-300 italic border-l-2 border-violet-500/40 pl-2">{lead.score_reasoning}</p>
              )}
              <div className="space-y-1.5">
                {categories.map(c => {
                  const pts = Number(breakdown[c.key] ?? 0);
                  const pct = c.max > 0 ? (pts / c.max) * 100 : 0;
                  return (
                    <div key={c.key} className="flex items-center gap-2 text-xs">
                      <span className="w-32 text-gray-400 truncate">{c.label}</span>
                      <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-violet-500 to-pink-500" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="w-12 text-right tabular-nums text-gray-300 font-mono">{pts}/{c.max}</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
          <button onClick={rescore} disabled={rescoring} className="w-full mt-2 flex items-center justify-center gap-2 py-2 rounded-lg bg-violet-500/15 hover:bg-violet-500/25 border border-violet-500/30 text-violet-200 text-xs font-semibold disabled:opacity-50">
            {rescoring ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            {lead.score == null ? 'Generar score con AI' : 'Recomputar score'}
          </button>
        </div>
      )}
    </div>
  );
}
