'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAdminAuth } from '../layout';
import {
  Building2, Users, Home, RefreshCw, Loader2, Mail, Phone, MapPin,
  Search, Download, Sparkles, TrendingUp, ArrowUpRight, Trash2,
  PhoneCall, CheckCircle2,
} from 'lucide-react';

interface PmLead {
  id: string;
  name: string;
  email: string;
  phone: string;
  city?: string | null;
  state?: string | null;
  property_count: number;
  property_types?: string[] | null;
  current_situation?: string | null;
  notes?: string | null;
  language_pref?: string;
  status?: string;
  created_at?: string;
}

const SITUATION_LABEL: Record<string, string> = {
  self_managing: 'Auto-administra',
  other_pm: 'Otro PM',
  no_pm: 'Sin inquilinos',
  other: 'Otra',
};

const TYPE_LABEL: Record<string, string> = {
  sfh: 'Casa',
  duplex: 'Duplex',
  multi: 'Multi',
  commercial: 'Comercial',
};

const STATUS_META: Record<string, { label: string; badge: string; dot: string }> = {
  new: { label: 'Nuevo', badge: 'bg-sky-500/15 text-sky-400 border-sky-500/30', dot: 'bg-sky-400' },
  contacted: { label: 'Contactado', badge: 'bg-amber-500/15 text-amber-400 border-amber-500/30', dot: 'bg-amber-400' },
  converted: { label: 'Convertido', badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', dot: 'bg-emerald-400' },
  discarded: { label: 'Descartado', badge: 'bg-rose-500/15 text-rose-400 border-rose-500/30', dot: 'bg-rose-400' },
};

const STATUS_ORDER = ['new', 'contacted', 'converted', 'discarded'];

export default function PmWaitlistAdminPage() {
  const { token } = useAdminAuth();
  const [items, setItems] = useState<PmLead[]>([]);
  const [stats, setStats] = useState<{ total: number; new: number; contacted?: number; converted?: number; total_properties_interested: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [busyId, setBusyId] = useState<string | null>(null);

  const authHdr = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [listR, statsR] = await Promise.all([
        fetch('/api/admin/pm-service-waitlist?limit=200', { headers: authHdr }).then(x => x.json()),
        fetch('/api/admin/pm-service-waitlist/stats', { headers: authHdr }).then(x => x.json()),
      ]);
      setItems(listR?.items || []);
      setStats(statsR || null);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, [token, authHdr]);

  useEffect(() => { load(); }, [load]);

  const updateStatus = async (id: string, status: string) => {
    setBusyId(id);
    try {
      const r = await fetch(`/api/admin/pm-service-waitlist/${id}`, {
        method: 'PATCH',
        headers: { ...authHdr, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (r.ok) {
        setItems(prev => prev.map(l => (l.id === id ? { ...l, status } : l)));
        const statsR = await fetch('/api/admin/pm-service-waitlist/stats', { headers: authHdr }).then(x => x.json());
        setStats(statsR || null);
      }
    } catch (e) { console.error(e); }
    setBusyId(null);
  };

  const deleteLead = async (id: string, name: string) => {
    if (!window.confirm(`¿Eliminar permanentemente a "${name}" de la lista de espera?`)) return;
    setBusyId(id);
    try {
      const r = await fetch(`/api/admin/pm-service-waitlist/${id}`, { method: 'DELETE', headers: authHdr });
      if (r.ok) {
        setItems(prev => prev.filter(l => l.id !== id));
        const statsR = await fetch('/api/admin/pm-service-waitlist/stats', { headers: authHdr }).then(x => x.json());
        setStats(statsR || null);
      }
    } catch (e) { console.error(e); }
    setBusyId(null);
  };

  const filtered = items.filter(l => {
    if (statusFilter !== 'all' && (l.status || 'new') !== statusFilter) return false;
    if (!q) return true;
    const s = q.toLowerCase();
    return (
      (l.name || '').toLowerCase().includes(s) ||
      (l.email || '').toLowerCase().includes(s) ||
      (l.phone || '').includes(s) ||
      (l.city || '').toLowerCase().includes(s)
    );
  });

  const exportCsv = () => {
    const rows = [
      ['Nombre', 'Email', 'Teléfono', 'Ciudad', 'Estado', 'Propiedades', 'Tipos', 'Situación', 'Idioma', 'Status', 'Notas', 'Recibido'],
      ...filtered.map(l => [
        l.name, l.email, l.phone,
        l.city || '', l.state || '',
        String(l.property_count),
        (l.property_types || []).join('|'),
        SITUATION_LABEL[l.current_situation || ''] || l.current_situation || '',
        l.language_pref || '',
        STATUS_META[l.status || 'new']?.label || l.status || '',
        (l.notes || '').replace(/\n/g, ' '),
        l.created_at ? new Date(l.created_at).toLocaleString('es-MX') : '',
      ]),
    ];
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `pm_waitlist_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-[#060910] pb-12">
      {/* Header */}
      <div className="sticky top-14 z-10 backdrop-blur-xl bg-[#080d18]/85 border-b border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-4 lg:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/30 shrink-0">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base lg:text-lg font-bold text-white leading-tight flex items-center gap-2">
                Property Management · Waitlist
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 font-bold uppercase tracking-wider">Próximamente</span>
              </h1>
              <p className="text-[11px] text-slate-500 leading-tight">Propietarios interesados · Q4 2026 – 2027</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={exportCsv} className="px-3 py-2 rounded-lg bg-white/[0.05] border border-white/[0.1] hover:border-white/[0.2] text-slate-300 text-xs font-semibold flex items-center gap-1.5 shadow-sm">
              <Download className="w-3.5 h-3.5" /> CSV
            </button>
            <button onClick={load} disabled={loading} className="p-2 rounded-lg bg-white/[0.05] border border-white/[0.1] hover:border-white/[0.2] disabled:opacity-50">
              {loading ? <Loader2 className="w-4 h-4 animate-spin text-slate-400" /> : <RefreshCw className="w-4 h-4 text-slate-400" />}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 lg:px-6 pt-5 space-y-5">
        {/* Legal reminder */}
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
          <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-900 leading-relaxed">
            <strong>Recuerda:</strong> Esta lista se convierte en clientes reales cuando obtengamos la <strong>Texas Real Estate Broker License</strong> (Q4 2026 – 2027). Mientras tanto, <strong>NO contactar prometiendo servicios de PM</strong>. Solo actualizaciones de progreso legal.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatCard icon={<Users className="w-4 h-4" />} label="Total interesados" value={stats?.total ?? 0} accent="indigo" />
          <StatCard icon={<Sparkles className="w-4 h-4" />} label="Nuevos" value={stats?.new ?? 0} accent="sky" />
          <StatCard icon={<PhoneCall className="w-4 h-4" />} label="Contactados" value={stats?.contacted ?? 0} accent="amber" />
          <StatCard icon={<CheckCircle2 className="w-4 h-4" />} label="Convertidos" value={stats?.converted ?? 0} accent="emerald" />
          <StatCard icon={<Home className="w-4 h-4" />} label="Propiedades" value={stats?.total_properties_interested ?? 0} accent="violet" />
        </div>

        {/* Status filter chips */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-full text-xs font-bold border transition ${statusFilter === 'all' ? 'bg-white/[0.12] text-white border-white/[0.25]' : 'bg-white/[0.04] text-slate-400 border-white/[0.08] hover:border-white/[0.2]'}`}
          >
            Todos ({items.length})
          </button>
          {STATUS_ORDER.map(s => {
            const count = items.filter(l => (l.status || 'new') === s).length;
            const m = STATUS_META[s];
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(statusFilter === s ? 'all' : s)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold border transition flex items-center gap-1.5 ${statusFilter === s ? m.badge : 'bg-white/[0.04] text-slate-400 border-white/[0.08] hover:border-white/[0.2]'}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />
                {m.label} ({count})
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="bg-[#0c1222] rounded-2xl border border-white/[0.08] p-3 flex items-center gap-2">
          <Search className="w-4 h-4 text-slate-400 ml-1" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nombre, email, teléfono o ciudad..."
            className="flex-1 outline-none text-sm text-slate-200 bg-transparent"
          />
          {q && <button onClick={() => setQ('')} className="text-xs text-slate-400 hover:text-slate-400 px-2">Limpiar</button>}
        </div>

        {/* List */}
        {loading && items.length === 0 ? (
          <div className="py-16 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-slate-400 mx-auto" />
            <p className="text-sm text-slate-500 mt-3">Cargando...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <div className="inline-flex w-16 h-16 rounded-2xl bg-white/[0.06] items-center justify-center mb-3">
              <Building2 className="w-7 h-7 text-slate-300" />
            </div>
            <p className="text-sm text-slate-500">
              {q ? 'Sin resultados con esta búsqueda.' : 'Aún no hay propietarios en la lista de espera.'}
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            {filtered.map(l => (
              <div key={l.id} className="bg-[#0c1222] rounded-2xl border border-white/[0.08] hover:border-indigo-500/40 transition p-4 md:p-5">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white flex items-center justify-center font-black text-sm shrink-0">
                      {(l.name || '?').split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-white truncate">{l.name}</div>
                      <div className="text-[11px] text-slate-500">
                        {l.created_at ? new Date(l.created_at).toLocaleString('es-MX', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] px-2 py-1 rounded-full bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 font-bold flex items-center gap-1">
                      <Home className="w-3 h-3" /> {l.property_count} prop
                    </span>
                    {l.language_pref && (
                      <span className="text-[10px] px-1.5 py-1 rounded-full bg-white/[0.07] text-slate-400 font-bold uppercase">
                        {l.language_pref}
                      </span>
                    )}
                    <span className={`text-[10px] px-2 py-1 rounded-full border font-bold flex items-center gap-1 ${STATUS_META[l.status || 'new']?.badge || STATUS_META.new.badge}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${STATUS_META[l.status || 'new']?.dot || STATUS_META.new.dot}`} />
                      {STATUS_META[l.status || 'new']?.label || l.status}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
                  <a href={`mailto:${l.email}`} className="flex items-center gap-2 text-sm text-slate-300 hover:text-indigo-600 group">
                    <Mail className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-500" />
                    <span className="truncate">{l.email}</span>
                    <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </a>
                  <a href={`tel:${l.phone}`} className="flex items-center gap-2 text-sm text-slate-300 hover:text-indigo-600 group">
                    <Phone className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-500" />
                    <span>{l.phone}</span>
                    <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </a>
                  {(l.city || l.state) && (
                    <div className="flex items-center gap-2 text-sm text-slate-400">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      <span>{l.city}{l.state && `, ${l.state}`}</span>
                    </div>
                  )}
                  {l.current_situation && (
                    <div className="flex items-center gap-2 text-sm text-slate-400">
                      <TrendingUp className="w-3.5 h-3.5 text-slate-400" />
                      <span>{SITUATION_LABEL[l.current_situation] || l.current_situation}</span>
                    </div>
                  )}
                </div>

                {l.property_types && l.property_types.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {l.property_types.map(t => (
                      <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-400 border border-violet-500/30 font-semibold">
                        {TYPE_LABEL[t] || t}
                      </span>
                    ))}
                  </div>
                )}

                {l.notes && (
                  <div className="mt-2 p-3 bg-black/30 border border-white/[0.08] rounded-xl">
                    <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">Notas</div>
                    <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{l.notes}</p>
                  </div>
                )}

                {/* Actions: status pipeline + delete */}
                <div className="mt-3 pt-3 border-t border-white/[0.06] flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {STATUS_ORDER.map(s => {
                      const m = STATUS_META[s];
                      const active = (l.status || 'new') === s;
                      return (
                        <button
                          key={s}
                          disabled={busyId === l.id || active}
                          onClick={() => updateStatus(l.id, s)}
                          className={`text-[10px] px-2.5 py-1.5 rounded-lg border font-bold transition disabled:cursor-default ${active ? m.badge : 'bg-white/[0.03] text-slate-500 border-white/[0.07] hover:text-slate-300 hover:border-white/[0.2]'}`}
                        >
                          {m.label}
                        </button>
                      );
                    })}
                    {busyId === l.id && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />}
                  </div>
                  <button
                    disabled={busyId === l.id}
                    onClick={() => deleteLead(l.id, l.name)}
                    className="text-[10px] px-2.5 py-1.5 rounded-lg border border-rose-500/25 bg-rose-500/10 text-rose-400 font-bold hover:bg-rose-500/20 transition flex items-center gap-1 disabled:opacity-50"
                    title="Eliminar (spam)"
                  >
                    <Trash2 className="w-3 h-3" /> Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, accent }: {
  icon: React.ReactNode; label: string; value: number; accent: 'indigo' | 'emerald' | 'amber' | 'sky' | 'violet';
}) {
  const map: Record<string, string> = {
    indigo: 'bg-indigo-500/15 text-indigo-400 ring-indigo-500/20',
    emerald: 'bg-emerald-500/15 text-emerald-400 ring-emerald-500/20',
    amber: 'bg-amber-500/15 text-amber-400 ring-amber-500/20',
    sky: 'bg-sky-500/15 text-sky-400 ring-sky-500/20',
    violet: 'bg-violet-500/15 text-violet-400 ring-violet-500/20',
  };
  return (
    <div className="bg-[#0c1222] rounded-2xl border border-white/[0.08] p-4">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ring-1 mb-2 ${map[accent]}`}>
        {icon}
      </div>
      <div className="text-2xl lg:text-3xl font-black text-white leading-none tabular-nums">{value.toLocaleString()}</div>
      <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mt-2">{label}</div>
    </div>
  );
}
