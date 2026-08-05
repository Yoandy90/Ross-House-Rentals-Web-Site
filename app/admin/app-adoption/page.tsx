'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAdminAuth } from '../layout';
import {
  Smartphone, Users, Apple, Wifi, WifiOff, RefreshCw, Loader2,
  Search, Download, Send, TrendingUp, Sparkles, X, Check, MessageSquare, Mail, PieChart,
  Bell, Settings, Zap, Clock, UserPlus, LogIn, DollarSign, Calendar, Play,
} from 'lucide-react';

interface AdoptionUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  status: 'has_app_active' | 'has_app_stale' | 'web_only' | 'inactive';
  has_push_token: boolean;
  push_platform: string;
  push_device_name: string;
  push_token_updated_at: string | null;
  last_login: string | null;
  created_at: string | null;
}

interface Stats {
  total_users: number;
  has_app: number;
  ios_users: number;
  android_users: number;
  active_last_30d: number;
  web_only: number;
  inactive: number;
  adoption_rate_pct: number;
}

interface TimelineEvent {
  ts: string;
  type: string;
  icon: string;
  title: string;
  detail: string;
}

interface ReengageConfig {
  enabled: boolean;
  weekday: number;
  hour_ct: number;
  target_role: string;
  min_days_since_login: number;
  subject: string;
  body_html: string;
  last_run_at: string | null;
  last_run_sent: number;
}

type StatusFilter = 'all' | 'has_app_active' | 'has_app_stale' | 'web_only' | 'inactive';

const STATUS_META: Record<AdoptionUser['status'], { label: string; color: string; dot: string; icon: React.ReactNode }> = {
  has_app_active: { label: 'Usando la app', color: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/25', dot: 'bg-emerald-400', icon: <Wifi className="w-3 h-3" /> },
  has_app_stale: { label: 'App instalada · inactiva', color: 'text-amber-300 bg-amber-500/10 border-amber-500/25', dot: 'bg-amber-400', icon: <Smartphone className="w-3 h-3" /> },
  web_only: { label: 'Solo web', color: 'text-sky-300 bg-sky-500/10 border-sky-500/25', dot: 'bg-sky-400', icon: <WifiOff className="w-3 h-3" /> },
  inactive: { label: 'Sin actividad', color: 'text-slate-400 bg-white/5 border-white/10', dot: 'bg-slate-500', icon: <Users className="w-3 h-3" /> },
};

const TIMELINE_ICONS: Record<string, React.ReactNode> = {
  user_plus: <UserPlus className="w-3.5 h-3.5" />,
  smartphone: <Smartphone className="w-3.5 h-3.5" />,
  log_in: <LogIn className="w-3.5 h-3.5" />,
  send: <Send className="w-3.5 h-3.5" />,
  dollar: <DollarSign className="w-3.5 h-3.5" />,
};

const WEEKDAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

const fmtRelative = (iso: string | null) => {
  if (!iso) return '—';
  const now = Date.now();
  const then = new Date(iso).getTime();
  const days = Math.floor((now - then) / 86400000);
  if (days === 0) return 'Hoy';
  if (days === 1) return 'Ayer';
  if (days < 30) return `Hace ${days} días`;
  if (days < 365) return `Hace ${Math.floor(days / 30)} meses`;
  return `Hace ${Math.floor(days / 365)} años`;
};

const fmtFull = (iso: string) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('es-US', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' · ' + d.toLocaleTimeString('es-US', { hour: '2-digit', minute: '2-digit' });
};

export default function AppAdoptionPage() {
  const { token } = useAdminAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<AdoptionUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState<'tenant' | 'buyer' | 'landlord' | 'all'>('tenant');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [inviteModal, setInviteModal] = useState<AdoptionUser | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);
  const [bulkPushOpen, setBulkPushOpen] = useState(false);
  const [reengageOpen, setReengageOpen] = useState(false);
  const [timelineUser, setTimelineUser] = useState<AdoptionUser | null>(null);
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);

  const authHdr = useMemo(() => ({ Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }), [token]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [statsR, usersR] = await Promise.all([
        fetch(`/api/admin/app-adoption/stats?role=${role}`, { headers: authHdr }).then(r => r.json()),
        fetch(`/api/admin/app-adoption/users?role=${role}&status=${statusFilter}&page_size=200`, { headers: authHdr }).then(r => r.json()),
      ]);
      setStats(statsR?.totals || null);
      setUsers(usersR?.users || []);
    } catch (e) {
      console.error(e);
      setToast({ msg: 'Error al cargar datos', type: 'err' });
    }
    setLoading(false);
  }, [token, authHdr, role, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const filtered = users.filter(u => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (
      (u.name || '').toLowerCase().includes(s) ||
      (u.email || '').toLowerCase().includes(s) ||
      (u.phone || '').includes(s)
    );
  });

  const openTimeline = async (user: AdoptionUser) => {
    setTimelineUser(user);
    setTimelineEvents([]);
    setTimelineLoading(true);
    try {
      const r = await fetch(`/api/admin/app-adoption/users/${user.id}/timeline`, { headers: authHdr }).then(x => x.json());
      setTimelineEvents(r?.events || []);
    } catch (e) {
      setToast({ msg: 'Error al cargar timeline', type: 'err' });
    }
    setTimelineLoading(false);
  };

  const sendInvite = async (user: AdoptionUser, channel: 'sms' | 'email' | 'both') => {
    setSendingId(user.id);
    try {
      const r = await fetch('/api/admin/app-adoption/send-invite', {
        method: 'POST',
        headers: authHdr,
        body: JSON.stringify({ user_id: user.id, channel }),
      });
      const data = await r.json();
      if (r.ok) {
        const parts: string[] = [];
        if (data.sms_sent) parts.push('SMS ✓');
        if (data.email_sent) parts.push('Email ✓');
        if (!parts.length) parts.push('Sin canales (revisa Twilio/SendGrid)');
        setToast({ msg: `Invitación → ${user.name || user.email}: ${parts.join(', ')}`, type: parts.some(p => p.includes('✓')) ? 'ok' : 'err' });
      } else {
        setToast({ msg: data.detail || 'Error', type: 'err' });
      }
    } catch { setToast({ msg: 'Error de red', type: 'err' }); }
    setSendingId(null);
    setInviteModal(null);
    setTimeout(() => setToast(null), 4500);
  };

  const exportCsv = () => {
    fetch(`/api/admin/app-adoption/export.csv?role=${role}&status=${statusFilter}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob())
      .then(blob => {
        const dl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = dl;
        a.download = `app_adoption_${role}_${statusFilter}_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a); a.click(); a.remove();
        URL.revokeObjectURL(dl);
      })
      .catch(() => setToast({ msg: 'Error al exportar', type: 'err' }));
  };

  return (
    <div className="min-h-full bg-slate-50 dark:bg-[#050810] text-slate-900 dark:text-white">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-5">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
              <Smartphone className="w-6 h-6 text-indigo-400" />
              Adopción de App iOS
            </h1>
            <p className="text-xs text-gray-400 mt-1">
              Detecta quién descargó la app · Push masivo · Timeline · Re-engagement automático
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => setBulkPushOpen(true)} className="px-3 py-2 rounded-lg bg-gradient-to-r from-indigo-500 to-violet-600 hover:brightness-110 text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-indigo-500/20">
              <Bell className="w-3.5 h-3.5" /> Push masivo
            </button>
            <button onClick={() => setReengageOpen(true)} className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold flex items-center gap-1.5">
              <Settings className="w-3.5 h-3.5" /> Re-engage
            </button>
            <button onClick={load} disabled={loading} className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50">
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              Actualizar
            </button>
            <button onClick={exportCsv} className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold flex items-center gap-1.5">
              <Download className="w-3.5 h-3.5" /> CSV
            </button>
          </div>
        </div>

        {/* Role tabs */}
        <div className="flex flex-wrap gap-1.5 border-b border-slate-200 dark:border-white/[0.06] pb-2">
          {(['tenant', 'buyer', 'landlord', 'all'] as const).map(r => (
            <button key={r} onClick={() => setRole(r)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${role === r ? 'bg-indigo-500/20 text-indigo-200 border border-indigo-500/40' : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'}`}>
              {r === 'tenant' ? 'Inquilinos' : r === 'buyer' ? 'Compradores' : r === 'landlord' ? 'Propietarios' : 'Todos'}
            </button>
          ))}
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiCard label="Total" value={stats?.total_users ?? 0} icon={<Users className="w-4 h-4" />} tint="slate" />
          <KpiCard label="% adopción" value={`${stats?.adoption_rate_pct ?? 0}%`} icon={<PieChart className="w-4 h-4" />} tint="violet" big />
          <KpiCard label="Con app" value={stats?.has_app ?? 0} icon={<Smartphone className="w-4 h-4" />} tint="emerald" />
          <KpiCard label="Activos 30d" value={stats?.active_last_30d ?? 0} icon={<TrendingUp className="w-4 h-4" />} tint="cyan" />
          <KpiCard label="Solo web" value={stats?.web_only ?? 0} icon={<WifiOff className="w-4 h-4" />} tint="sky" />
          <KpiCard label="Sin actividad" value={stats?.inactive ?? 0} icon={<Users className="w-4 h-4" />} tint="rose" />
        </div>

        {stats && stats.has_app > 0 && (
          <div className="flex items-center gap-3 text-xs">
            <span className="text-gray-500">Plataforma:</span>
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10">
              <Apple className="w-3 h-3 text-white" /> iOS · <b className="text-white">{stats.ios_users}</b>
            </span>
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10">
              🤖 Android · <b className="text-white">{stats.android_users}</b>
            </span>
          </div>
        )}

        {/* Filter chips + search */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <div className="flex flex-wrap gap-1.5">
            {(['all', 'has_app_active', 'has_app_stale', 'web_only', 'inactive'] as StatusFilter[]).map(s => {
              const meta = s === 'all' ? { label: 'Todos', color: 'text-white bg-white/10 border-white/20' } : STATUS_META[s as AdoptionUser['status']];
              return (
                <button key={s} onClick={() => setStatusFilter(s)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition ${statusFilter === s ? meta.color : 'text-gray-400 bg-white dark:bg-white/[0.02] border-white/10 hover:bg-white/5'}`}>
                  {s === 'all' ? 'Todos' : STATUS_META[s as AdoptionUser['status']].label}
                </button>
              );
            })}
          </div>
          <div className="flex-1" />
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-gray-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nombre, email, teléfono..."
              className="w-full pl-8 pr-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white placeholder-gray-500 focus:border-indigo-400/40 focus:outline-none" />
          </div>
        </div>

        {/* Users list */}
        <div className="bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.06] rounded-2xl overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-gray-400 flex items-center justify-center gap-2 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" /> Cargando...
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-gray-500 text-sm">
              <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-30" />
              No hay usuarios con ese filtro
            </div>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {filtered.map(u => {
                const meta = STATUS_META[u.status];
                const canReceive = u.status !== 'has_app_active';
                return (
                  <div key={u.id} className="p-3 sm:p-4 hover:bg-white dark:bg-white/[0.02] transition group">
                    <div className="flex items-start gap-3">
                      <button onClick={() => openTimeline(u)} className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500/30 to-violet-600/20 flex items-center justify-center text-sm font-bold text-indigo-200 flex-shrink-0 hover:ring-2 hover:ring-indigo-400/50 transition"
                        title="Ver timeline">
                        {(u.name?.[0] || u.email?.[0] || '?').toUpperCase()}
                      </button>

                      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => openTimeline(u)}>
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="font-semibold text-sm text-white truncate group-hover:text-indigo-200 transition">{u.name || '(Sin nombre)'}</span>
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border ${meta.color}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} /> {meta.label}
                          </span>
                          {u.push_platform && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-gray-300 font-bold uppercase">{u.push_platform}</span>
                          )}
                        </div>
                        <div className="text-[11px] text-gray-400 flex flex-wrap gap-x-3 gap-y-0.5">
                          <span className="truncate">{u.email || '—'}</span>
                          {u.phone && <span>{u.phone}</span>}
                          {u.push_device_name && <span className="text-indigo-300 truncate">{u.push_device_name}</span>}
                        </div>
                        <div className="text-[10px] text-gray-500 mt-1 flex flex-wrap gap-x-3">
                          <span>App: {fmtRelative(u.push_token_updated_at)}</span>
                          <span>Login: {fmtRelative(u.last_login)}</span>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row items-end gap-1.5">
                        {canReceive ? (
                          <button onClick={() => setInviteModal(u)} disabled={sendingId === u.id}
                            className="px-2.5 py-1.5 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-400/30 text-indigo-200 text-[11px] font-semibold flex items-center gap-1.5 disabled:opacity-50 whitespace-nowrap">
                            {sendingId === u.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                            Invitar
                          </button>
                        ) : (
                          <span className="text-[10px] text-emerald-400 flex items-center gap-1 px-2 py-1 whitespace-nowrap">
                            <Check className="w-3 h-3" /> Activo
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="text-[10px] text-gray-600 text-center">
          Mostrando {filtered.length} de {users.length} usuarios · Filtros: rol=<b>{role}</b>, estado=<b>{statusFilter}</b> · Tip: click en el avatar para ver timeline
        </div>
      </div>

      {/* MODALS */}
      {inviteModal && <InviteModal user={inviteModal} onClose={() => setInviteModal(null)} onSend={sendInvite} sending={sendingId === inviteModal.id} />}
      {bulkPushOpen && <BulkPushModal onClose={() => setBulkPushOpen(false)} authHdr={authHdr} onDone={(msg, type) => { setToast({ msg, type }); setTimeout(() => setToast(null), 5000); }} />}
      {reengageOpen && <ReengageModal onClose={() => setReengageOpen(false)} authHdr={authHdr} onDone={(msg, type) => { setToast({ msg, type }); setTimeout(() => setToast(null), 5000); }} />}
      {timelineUser && <TimelineDrawer user={timelineUser} events={timelineEvents} loading={timelineLoading} onClose={() => setTimelineUser(null)} />}

      {/* TOAST */}
      {toast && (
        <div className={`fixed bottom-4 right-4 z-[110] px-4 py-3 rounded-xl shadow-2xl text-xs font-semibold flex items-center gap-2 border ${toast.type === 'ok' ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-100' : 'bg-red-500/20 border-red-500/40 text-red-100'}`}>
          {toast.type === 'ok' ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────

function KpiCard({ label, value, icon, tint, big }: { label: string; value: string | number; icon: React.ReactNode; tint: string; big?: boolean }) {
  const tintMap: Record<string, string> = {
    slate: 'from-slate-500/10 to-slate-600/5 border-slate-500/20 text-slate-300',
    violet: 'from-violet-500/20 to-fuchsia-500/10 border-violet-500/30 text-violet-200',
    emerald: 'from-emerald-500/10 to-emerald-600/5 border-emerald-500/25 text-emerald-300',
    cyan: 'from-cyan-500/10 to-cyan-600/5 border-cyan-500/25 text-cyan-300',
    sky: 'from-sky-500/10 to-sky-600/5 border-sky-500/25 text-sky-300',
    rose: 'from-rose-500/10 to-rose-600/5 border-rose-500/25 text-rose-300',
  };
  return (
    <div className={`bg-gradient-to-br ${tintMap[tint]} border rounded-xl p-3 flex flex-col gap-1 min-h-[76px]`}>
      <div className="flex items-center justify-between opacity-80">
        <span className="text-[10px] uppercase font-bold tracking-widest">{label}</span>
        {icon}
      </div>
      <div className={`font-black tracking-tight text-white ${big ? 'text-2xl' : 'text-xl'}`}>{value}</div>
    </div>
  );
}

function InviteModal({ user, onClose, onSend, sending }: { user: AdoptionUser; onClose: () => void; onSend: (u: AdoptionUser, c: 'sms' | 'email' | 'both') => void; sending: boolean }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[#0b1220] border border-white/10 rounded-3xl p-5 max-w-md w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-base text-white">Enviar invitación</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10"><X className="w-4 h-4 text-gray-400" /></button>
        </div>
        <div className="mb-4 p-3 bg-white/5 rounded-xl border border-white/10">
          <div className="text-xs text-gray-400">Enviar a</div>
          <div className="text-sm font-semibold text-white">{user.name || '(Sin nombre)'}</div>
          <div className="text-[11px] text-gray-400 mt-0.5">{user.email || '—'} {user.phone && `· ${user.phone}`}</div>
        </div>
        <div className="text-[11px] text-gray-500 mb-3">Se enviará el link del App Store con UTM tracking.</div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <button onClick={() => onSend(user, 'sms')} disabled={!user.phone || sending} className="py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold flex items-center justify-center gap-1.5">
            <MessageSquare className="w-3.5 h-3.5" /> SMS
          </button>
          <button onClick={() => onSend(user, 'email')} disabled={!user.email || sending} className="py-2.5 rounded-xl bg-violet-500 hover:bg-violet-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold flex items-center justify-center gap-1.5">
            <Mail className="w-3.5 h-3.5" /> Email
          </button>
          <button onClick={() => onSend(user, 'both')} disabled={(!user.email && !user.phone) || sending} className="py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold flex items-center justify-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" /> Ambos
          </button>
        </div>
      </div>
    </div>
  );
}

function BulkPushModal({ onClose, authHdr, onDone }: { onClose: () => void; authHdr: Record<string, string>; onDone: (msg: string, type: 'ok' | 'err') => void }) {
  const [role, setRole] = useState('tenant');
  const [status, setStatus] = useState('has_app_stale');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [deepLink, setDeepLink] = useState('');
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!title.trim() || !body.trim()) {
      onDone('Título y mensaje son requeridos', 'err');
      return;
    }
    if (!confirm(`¿Enviar push a segmento "${role} · ${status}"?\n\nEsta acción no se puede deshacer.`)) return;
    setSending(true);
    try {
      const r = await fetch('/api/admin/app-adoption/bulk-push', {
        method: 'POST',
        headers: authHdr,
        body: JSON.stringify({ role, status, title, body, deep_link: deepLink || undefined }),
      });
      const data = await r.json();
      if (r.ok) {
        onDone(`Push enviado ✓ · ${data.sent} entregados / ${data.failed} fallidos (${data.target_count} usuarios)`, 'ok');
        onClose();
      } else {
        onDone(data.detail || 'Error al enviar', 'err');
      }
    } catch { onDone('Error de red', 'err'); }
    setSending(false);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[#0b1220] border border-white/10 rounded-3xl p-5 max-w-lg w-full shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-base text-white flex items-center gap-2"><Bell className="w-4 h-4 text-indigo-400" /> Push masivo a segmento</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10"><X className="w-4 h-4 text-gray-400" /></button>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] uppercase tracking-widest text-gray-400 font-bold mb-1 block">Rol</label>
              <select value={role} onChange={(e) => setRole(e.target.value)} className="w-full py-2 px-2.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white focus:border-indigo-400/40 focus:outline-none">
                <option value="tenant">Inquilinos</option>
                <option value="buyer">Compradores</option>
                <option value="landlord">Propietarios</option>
                <option value="all">Todos</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest text-gray-400 font-bold mb-1 block">Segmento</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full py-2 px-2.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white focus:border-indigo-400/40 focus:outline-none">
                <option value="has_app_active">🟢 Usando la app</option>
                <option value="has_app_stale">🟡 App instalada · inactiva</option>
                <option value="all">Todos con app</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-widest text-gray-400 font-bold mb-1 block">Título ({title.length}/60)</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value.slice(0, 60))} placeholder="Ej: Tu renta ya está próxima 🏠" className="w-full py-2 px-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:border-indigo-400/40 focus:outline-none" />
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-widest text-gray-400 font-bold mb-1 block">Mensaje ({body.length}/200)</label>
            <textarea value={body} onChange={(e) => setBody(e.target.value.slice(0, 200))} placeholder="Ej: Recuerda pagar antes del día 5 para evitar recargo. Págalo en 30s desde la app." rows={3} className="w-full py-2 px-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:border-indigo-400/40 focus:outline-none resize-none" />
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-widest text-gray-400 font-bold mb-1 block">Deep link opcional (path dentro de la app)</label>
            <input type="text" value={deepLink} onChange={(e) => setDeepLink(e.target.value)} placeholder="Ej: /tenant/payments" className="w-full py-2 px-2.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white focus:border-indigo-400/40 focus:outline-none" />
          </div>

          {/* Preview */}
          {(title || body) && (
            <div className="p-3 bg-black/40 border border-white/10 rounded-xl">
              <div className="text-[10px] uppercase tracking-widest text-gray-400 font-bold mb-2">Vista previa (iOS)</div>
              <div className="bg-white/5 rounded-lg p-3 flex gap-2.5">
                <div className="w-7 h-7 rounded-md bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0">RH</div>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] text-gray-400 mb-0.5">ROSS HOUSE · ahora</div>
                  <div className="text-xs font-bold text-white truncate">{title || 'Título'}</div>
                  <div className="text-[11px] text-gray-300 line-clamp-2">{body || 'Cuerpo del mensaje'}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-semibold border border-white/10">Cancelar</button>
          <button onClick={send} disabled={sending || !title.trim() || !body.trim()} className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold flex items-center justify-center gap-1.5">
            {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
            Enviar push masivo
          </button>
        </div>
      </div>
    </div>
  );
}

function ReengageModal({ onClose, authHdr, onDone }: { onClose: () => void; authHdr: Record<string, string>; onDone: (msg: string, type: 'ok' | 'err') => void }) {
  const [cfg, setCfg] = useState<ReengageConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    fetch('/api/admin/app-adoption/reengagement/config', { headers: authHdr })
      .then(r => r.json())
      .then(d => setCfg(d?.config || null))
      .catch(() => onDone('Error al cargar config', 'err'))
      .finally(() => setLoading(false));
  }, [authHdr, onDone]);

  const save = async () => {
    if (!cfg) return;
    setSaving(true);
    try {
      const r = await fetch('/api/admin/app-adoption/reengagement/config', { method: 'PUT', headers: authHdr, body: JSON.stringify(cfg) });
      if (r.ok) {
        onDone('Configuración guardada ✓', 'ok');
        onClose();
      } else {
        onDone('Error al guardar', 'err');
      }
    } catch { onDone('Error de red', 'err'); }
    setSaving(false);
  };

  const runNow = async () => {
    if (!confirm('¿Ejecutar la campaña de re-engagement ahora?\n\nSe enviará email a todos los usuarios que cumplen los criterios (sin app + inactivos).')) return;
    setRunning(true);
    try {
      const r = await fetch('/api/admin/app-adoption/reengagement/run-now', { method: 'POST', headers: authHdr });
      const data = await r.json();
      if (r.ok) {
        onDone(`Campaña ejecutada ✓ · ${data.sent} enviados / ${data.failed} fallidos (${data.candidates} candidatos)`, 'ok');
      } else {
        onDone('Error al ejecutar', 'err');
      }
    } catch { onDone('Error de red', 'err'); }
    setRunning(false);
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
        <div className="bg-[#0b1220] border border-white/10 rounded-3xl p-8 flex items-center gap-2 text-white text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Cargando...</div>
      </div>
    );
  }
  if (!cfg) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[#0b1220] border border-white/10 rounded-3xl p-5 max-w-lg w-full shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-base text-white flex items-center gap-2"><Mail className="w-4 h-4 text-violet-400" /> Email de re-engagement semanal</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10"><X className="w-4 h-4 text-gray-400" /></button>
        </div>

        <div className="space-y-3">
          {/* Enable toggle */}
          <label className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/10 cursor-pointer">
            <input type="checkbox" checked={cfg.enabled} onChange={(e) => setCfg({ ...cfg, enabled: e.target.checked })} className="w-4 h-4 accent-violet-500" />
            <div className="flex-1">
              <div className="text-sm font-semibold text-white">Cron activo</div>
              <div className="text-[11px] text-gray-400">Envía emails automáticamente cada semana a usuarios sin app + inactivos</div>
            </div>
          </label>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] uppercase tracking-widest text-gray-400 font-bold mb-1 block">Día de la semana</label>
              <select value={cfg.weekday} onChange={(e) => setCfg({ ...cfg, weekday: Number(e.target.value) })} className="w-full py-2 px-2.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white">
                {WEEKDAYS.map((w, i) => <option key={i} value={i}>{w}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest text-gray-400 font-bold mb-1 block">Hora (CT)</label>
              <select value={cfg.hour_ct} onChange={(e) => setCfg({ ...cfg, hour_ct: Number(e.target.value) })} className="w-full py-2 px-2.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white">
                {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{h.toString().padStart(2, '0')}:00</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] uppercase tracking-widest text-gray-400 font-bold mb-1 block">Rol objetivo</label>
              <select value={cfg.target_role} onChange={(e) => setCfg({ ...cfg, target_role: e.target.value })} className="w-full py-2 px-2.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white">
                <option value="tenant">Inquilinos</option>
                <option value="buyer">Compradores</option>
                <option value="landlord">Propietarios</option>
                <option value="all">Todos</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest text-gray-400 font-bold mb-1 block">Días min. sin login</label>
              <input type="number" min={1} max={90} value={cfg.min_days_since_login} onChange={(e) => setCfg({ ...cfg, min_days_since_login: Number(e.target.value) })} className="w-full py-2 px-2.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white" />
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-widest text-gray-400 font-bold mb-1 block">Asunto del email</label>
            <input type="text" value={cfg.subject} onChange={(e) => setCfg({ ...cfg, subject: e.target.value })} className="w-full py-2 px-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white" />
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-widest text-gray-400 font-bold mb-1 block">Cuerpo HTML (variables: {'{name}'} · {'{ios_url}'})</label>
            <textarea value={cfg.body_html} onChange={(e) => setCfg({ ...cfg, body_html: e.target.value })} rows={6} className="w-full py-2 px-2.5 bg-white/5 border border-white/10 rounded-lg text-[11px] text-white font-mono resize-y" />
          </div>

          {cfg.last_run_at && (
            <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/25 rounded-lg text-[11px] text-emerald-200">
              Última ejecución: <b>{fmtFull(cfg.last_run_at)}</b> · {cfg.last_run_sent} enviados
            </div>
          )}
        </div>

        <div className="flex gap-2 mt-5">
          <button onClick={runNow} disabled={running || saving} className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-semibold flex items-center justify-center gap-1.5">
            {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            Ejecutar ahora
          </button>
          <button onClick={save} disabled={saving || running} className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-600 hover:brightness-110 disabled:opacity-40 text-white text-xs font-bold flex items-center justify-center gap-1.5">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

function TimelineDrawer({ user, events, loading, onClose }: { user: AdoptionUser; events: TimelineEvent[]; loading: boolean; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center sm:justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[#0b1220] border border-white/10 rounded-t-3xl sm:rounded-3xl p-5 max-w-lg w-full shadow-2xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4 sticky top-0 bg-[#0b1220] pt-1 pb-2 -mt-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500/30 to-violet-600/20 flex items-center justify-center text-sm font-bold text-indigo-200">
              {(user.name?.[0] || user.email?.[0] || '?').toUpperCase()}
            </div>
            <div>
              <h3 className="font-bold text-sm text-white leading-tight">{user.name || '(Sin nombre)'}</h3>
              <div className="text-[11px] text-gray-400">{user.email}</div>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10"><X className="w-4 h-4 text-gray-400" /></button>
        </div>

        <div className="text-[10px] uppercase tracking-widest text-gray-400 font-bold mb-3 flex items-center gap-1.5">
          <Clock className="w-3 h-3" /> Timeline de actividad
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-400 flex items-center justify-center gap-2 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Cargando...
          </div>
        ) : events.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">
            <Calendar className="w-8 h-8 mx-auto mb-2 opacity-30" />
            Sin eventos registrados aún
          </div>
        ) : (
          <div className="space-y-3 relative before:absolute before:left-3.5 before:top-2 before:bottom-2 before:w-px before:bg-white/10">
            {events.map((ev, i) => (
              <div key={i} className="flex gap-3 relative">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500/40 to-violet-600/30 border border-indigo-400/30 flex items-center justify-center text-indigo-200 flex-shrink-0 relative z-10">
                  {TIMELINE_ICONS[ev.icon] || <Sparkles className="w-3.5 h-3.5" />}
                </div>
                <div className="flex-1 min-w-0 pb-1">
                  <div className="text-sm font-semibold text-white leading-tight">{ev.title}</div>
                  <div className="text-[11px] text-gray-400 truncate">{ev.detail}</div>
                  <div className="text-[10px] text-gray-500 mt-0.5">{fmtFull(ev.ts)} · {fmtRelative(ev.ts)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
