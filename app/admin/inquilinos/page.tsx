'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAdminAuth } from '../layout';
import {
  Users, Plus, Search, Phone, Mail, Edit3, Trash2,
  X, Save, RefreshCw, ChevronDown, ChevronUp, Eye, EyeOff,
  KeyRound, UserPlus, Copy, Check, Smartphone, Globe,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
} from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_RHR_API_URL || 'https://ross-house-backend-production.up.railway.app';

const STATUS_MAP: Record<string, { label: string; color: string; bg: string; border: string }> = {
  active: { label: 'Activo', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  inactive: { label: 'Inactivo', color: 'text-gray-400', bg: 'bg-gray-500/10', border: 'border-gray-500/20' },
  pending: { label: 'Pendiente', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  evicted: { label: 'Desalojado', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' },
  deleted: { label: 'Eliminado', color: 'text-gray-500', bg: 'bg-gray-700/10', border: 'border-gray-700/20' },
};

function gen10() {
  const c = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let s = ''; for (let i = 0; i < 10; i++) s += c[Math.floor(Math.random() * c.length)];
  return s;
}

export default function InquilinosPage() {
  const { token } = useAdminAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [summary, setSummary] = useState<{ total: number; tenants: number; app_users_unlinked: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'tenants' | 'app_users'>('all');
  const [filterS8, setFilterS8] = useState<'all' | 'yes' | 'no'>('all');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [credentialsShown, setCredentialsShown] = useState<{ email: string; password: string; name: string } | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // ─── Server-side pagination (Sprint 2) ──────────────────────────────
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);
  // Reset to page 1 when filters or search change
  useEffect(() => { setPage(1); }, [debouncedSearch, filter, filterS8, pageSize]);

  const [form, setForm] = useState({
    first_name: '', last_name: '', phone: '', email: '',
    password: '', password_visible: false,
    address: '', id_type: 'drivers_license', id_number: '',
    emergency_contact: '', emergency_phone: '',
    status: 'active', notes: '', send_welcome: true,
  });

  const headers = useCallback(() => ({
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }), [token]);

  const fetchUsers = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const sourceParam = filter === 'tenants' ? 'tenant' : filter === 'app_users' ? 'app_user' : 'all';
      const qs = new URLSearchParams({
        page: String(page),
        page_size: String(pageSize),
        source: sourceParam,
        section8: filterS8,
      });
      if (debouncedSearch) qs.set('search', debouncedSearch);
      const res = await fetch(`${API_BASE}/api/admin/all-users?${qs.toString()}`, { headers: headers() });
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
        setSummary(data.summary || null);
        setTotalPages(data.total_pages || 1);
        setTotalCount(data.total ?? data.summary?.total ?? 0);
        if (data.page && data.page !== page) setPage(data.page);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [token, headers, page, pageSize, filter, debouncedSearch]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const resetForm = () => {
    setForm({
      first_name: '', last_name: '', phone: '', email: '',
      password: '', password_visible: false,
      address: '', id_type: 'drivers_license', id_number: '',
      emergency_contact: '', emergency_phone: '',
      status: 'active', notes: '', send_welcome: true,
    });
    setEditing(null);
    setShowForm(false);
  };

  const startEdit = (t: any) => {
    setForm({
      first_name: t.first_name || '',
      last_name: t.last_name || '',
      phone: t.phone || '',
      email: t.email || '',
      password: '',
      password_visible: false,
      address: t.address || '',
      id_type: t.id_type || 'drivers_license',
      id_number: t.id_number || '',
      emergency_contact: t.emergency_contact || '',
      emergency_phone: t.emergency_phone || '',
      status: t.status || 'active',
      notes: t.notes || '',
      send_welcome: false,
    });
    setEditing(t);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.first_name || !form.last_name || !form.phone) {
      alert('Nombre, apellido y teléfono son requeridos');
      return;
    }
    setSaving(true);
    try {
      const url = editing
        ? `${API_BASE}/api/admin/tenants/${editing.id}`
        : `${API_BASE}/api/admin/tenants`;
      const method = editing ? 'PUT' : 'POST';
      const body: any = { ...form };
      delete body.password_visible;
      if (!body.password) delete body.password;
      const res = await fetch(url, { method, headers: headers(), body: JSON.stringify(body) });
      const data = await res.json();
      if (res.ok && data.success) {
        // If a new tenant was created with credentials, show them
        if (!editing && data.credentials?.show_to_admin) {
          setCredentialsShown({
            email: data.credentials.email,
            password: data.credentials.password,
            name: `${form.first_name} ${form.last_name}`,
          });
        }
        resetForm();
        fetchUsers();
      } else {
        alert(data.detail || 'Error al guardar');
      }
    } catch (e: any) {
      alert(e?.message || 'Error de conexión');
    }
    setSaving(false);
  };

  const handleDelete = async (id: string, source: string, name?: string) => {
    const label = name ? `«${name}»` : '';
    const confirmMsg = source === 'app_user'
      ? `¿Eliminar la cuenta ${label}?\n\nEsto borrará el registro del usuario y sus datos de login/notificaciones.`
      : `¿Eliminar el inquilino ${label}?`;
    if (!confirm(confirmMsg)) return;
    const url = source === 'app_user'
      ? `${API_BASE}/api/admin/app-users/${id}`
      : `${API_BASE}/api/admin/tenants/${id}`;
    try {
      const res = await fetch(url, { method: 'DELETE', headers: headers() });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // Offer ?force=true escalation when backend warns about a linked tenant
        const msg: string = data?.detail || `Error ${res.status}`;
        if (source === 'app_user' && /vinculada|vinculado|force=true/i.test(msg)) {
          if (confirm(`${msg}\n\n¿Deseas forzar la eliminación de ambos registros (usuario + inquilino vinculado)?`)) {
            const res2 = await fetch(`${url}?force=true`, { method: 'DELETE', headers: headers() });
            const data2 = await res2.json().catch(() => ({}));
            if (!res2.ok) {
              alert(data2?.detail || `Error ${res2.status} al forzar`);
              return;
            }
            alert(data2?.message || 'Eliminado');
            fetchUsers();
            return;
          }
          return;
        }
        alert(msg);
        return;
      }
      // Optimistic UI: remove the deleted row immediately so it disappears even
      // before the refetch completes
      setUsers(prev => prev.filter(u => u.id !== id));
      fetchUsers();
    } catch (e: any) {
      alert(e?.message || 'Error de conexión');
    }
  };

  const handleConvert = async (userId: string) => {
    if (!confirm('Convertir este usuario en un inquilino formal?')) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/all-users/${userId}/convert-to-tenant`, {
        method: 'POST', headers: headers(),
      });
      const data = await res.json();
      if (data.success) {
        alert(`Convertido a inquilino ${data.tenant_number}`);
        fetchUsers();
      } else {
        alert(data.detail || 'Error al convertir');
      }
    } catch (e: any) {
      alert(e?.message || 'Error de conexión');
    }
  };

  const handleResendWelcome = async (email?: string, phone?: string) => {
    if (!email && !phone) return alert('No hay email ni teléfono');
    try {
      const res = await fetch(`${API_BASE}/api/admin/resend-welcome`, {
        method: 'POST', headers: headers(),
        body: JSON.stringify(email ? { email } : { phone }),
      });
      const data = await res.json();
      if (data.success) {
        alert(`Bienvenida enviada — Email: ${data.email_sent ? '✓' : '✗'}  SMS: ${data.sms_sent ? '✓' : '✗'}`);
      } else {
        alert(data.detail || 'Error');
      }
    } catch (e: any) {
      alert(e?.message || 'Error');
    }
  };

  const copyToClipboard = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch (e) { console.error(e); }
  };

  // Backend already applies search/source filters — no client-side filtering needed
  const filtered = users;

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-3 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6 relative">
      <div className="fixed top-0 left-1/3 w-96 h-96 bg-violet-500/[0.02] rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500/20 to-violet-500/5 border border-violet-500/20 flex items-center justify-center"><Users className="w-6 h-6 text-violet-400" /></div>
          <div>
            <h2 className="text-2xl font-bold text-white">Inquilinos & Usuarios</h2>
            <p className="text-sm text-gray-500">
              {summary
                ? `${summary.total} total · ${summary.tenants} inquilinos · ${summary.app_users_unlinked} sin contrato`
                : `${users.length} registrados`}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchUsers} className="p-2 border border-white/[0.08] rounded-lg text-gray-400 hover:bg-white/[0.04]"><RefreshCw className="w-3.5 h-3.5" /></button>
          <button onClick={() => { resetForm(); setShowForm(true); }} className="flex items-center gap-2 px-4 py-2 bg-violet-500/10 text-violet-400 border border-violet-500/20 rounded-lg text-sm font-semibold hover:bg-violet-500/20 transition"><Plus className="w-4 h-4" /> Nuevo Inquilino</button>
        </div>
      </div>

      {/* Filters + search */}
      <div className="flex gap-3 flex-wrap items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nombre, teléfono, email..." className="w-full pl-10 pr-4 py-2.5 bg-[#0C1220]/60 border border-white/[0.08] rounded-xl text-sm text-white focus:border-violet-500 focus:outline-none placeholder:text-gray-600" />
        </div>
        <div className="flex gap-1 bg-white/[0.03] rounded-xl p-1 border border-white/[0.06]">
          {(['all', 'tenants', 'app_users'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                filter === f ? 'bg-violet-500/20 text-violet-300' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {f === 'all' ? 'Todos' : f === 'tenants' ? 'Inquilinos' : 'Solo App'}
            </button>
          ))}
        </div>
        <div className="flex gap-1 bg-white/[0.03] rounded-xl p-1 border border-white/[0.06]">
          {([['all', '🏛️ S8: Todos'], ['yes', '✓ Con voucher'], ['no', 'Sin voucher']] as const).map(([val, label]) => (
            <button
              key={val}
              onClick={() => setFilterS8(val as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                filterS8 === val ? 'bg-emerald-500/20 text-emerald-300' : 'text-gray-500 hover:text-gray-300'
              }`}
            >{label}</button>
          ))}
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white/[0.03] backdrop-blur-xl rounded-2xl border border-violet-500/20 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-white">{editing ? 'Editar Inquilino' : 'Nuevo Inquilino'}</h3>
            <button onClick={resetForm} className="text-gray-500 hover:text-white"><X className="w-5 h-5" /></button>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Inp label="Nombre" value={form.first_name} onChange={(v) => setForm({ ...form, first_name: v })} required />
            <Inp label="Apellido" value={form.last_name} onChange={(v) => setForm({ ...form, last_name: v })} required />
            <Inp label="Teléfono" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} required placeholder="+18069307456" />
            <Inp label="Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} type="email" placeholder="inquilino@ejemplo.com" />
            <Inp label="ID Number" value={form.id_number} onChange={(v) => setForm({ ...form, id_number: v })} />
            <div>
              <label className="block text-xs font-bold text-gray-400 mb-1 uppercase tracking-wider">Estado</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full px-3 py-2.5 bg-[#0a1020]/60 border border-white/[0.08] rounded-xl text-white text-sm focus:border-violet-500 focus:outline-none">
                <option value="active">Activo</option>
                <option value="inactive">Inactivo</option>
                <option value="pending">Pendiente</option>
              </select>
            </div>

            {/* Password section (only for NEW tenants) */}
            {!editing && (
              <>
                <div className="sm:col-span-2 lg:col-span-3 border-t border-white/[0.05] pt-4 mt-2">
                  <div className="flex items-center gap-2 mb-3">
                    <KeyRound className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">Credenciales de acceso</span>
                    <span className="text-[10px] text-gray-500">(opcional — se genera automática si lo dejas vacío)</span>
                  </div>
                </div>
                <div className="sm:col-span-2 lg:col-span-2">
                  <label className="block text-xs font-bold text-gray-400 mb-1 uppercase tracking-wider">Contraseña</label>
                  <div className="relative">
                    <input
                      type={form.password_visible ? 'text' : 'password'}
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      placeholder="Mínimo 6 caracteres (o vacío para generar automática)"
                      className="w-full px-3 py-2.5 pr-20 bg-[#0a1020]/60 border border-white/[0.08] rounded-xl text-white text-sm focus:border-violet-500 focus:outline-none placeholder:text-gray-600 font-mono"
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, password_visible: !form.password_visible })}
                        className="p-1.5 text-gray-500 hover:text-violet-400"
                        title={form.password_visible ? 'Ocultar' : 'Mostrar'}
                      >
                        {form.password_visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, password: gen10(), password_visible: true })}
                        className="p-1.5 text-gray-500 hover:text-violet-400"
                        title="Generar contraseña"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <input
                    id="send_welcome"
                    type="checkbox"
                    checked={form.send_welcome}
                    onChange={(e) => setForm({ ...form, send_welcome: e.target.checked })}
                    className="w-4 h-4 accent-violet-500"
                  />
                  <label htmlFor="send_welcome" className="text-xs text-gray-300 cursor-pointer">
                    Enviar email + SMS de bienvenida con credenciales
                  </label>
                </div>
              </>
            )}

            <Inp label="Contacto Emergencia" value={form.emergency_contact} onChange={(v) => setForm({ ...form, emergency_contact: v })} />
            <Inp label="Tel Emergencia" value={form.emergency_phone} onChange={(v) => setForm({ ...form, emergency_phone: v })} />
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="block text-xs font-bold text-gray-400 mb-1 uppercase tracking-wider">Notas</label>
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="w-full px-3 py-2.5 bg-[#0a1020]/60 border border-white/[0.08] rounded-xl text-white text-sm focus:border-violet-500 focus:outline-none h-16 resize-none" />
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <button onClick={resetForm} className="px-4 py-2 border border-white/[0.08] rounded-lg text-sm text-gray-400 hover:bg-white/[0.04]">Cancelar</button>
            <button onClick={handleSave} disabled={saving || !form.first_name || !form.last_name || !form.phone} className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-violet-600 to-violet-500 text-white rounded-lg text-sm font-bold hover:opacity-90 disabled:opacity-30 shadow-[0_0_15px_rgba(139,92,246,0.3)]">
              {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Save className="w-4 h-4" /> {editing ? 'Guardar' : 'Crear'}</>}
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto bg-violet-500/10 rounded-2xl flex items-center justify-center mb-4"><Users className="w-8 h-8 text-violet-400" /></div>
          <p className="text-gray-400 text-sm">No hay usuarios registrados</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((t) => {
            const st = STATUS_MAP[t.status] || STATUS_MAP.active;
            const isExp = expanded === t.id;
            const isApp = t.source === 'app_user';
            return (
              <div key={t.id} className={`relative overflow-hidden bg-white/[0.03] backdrop-blur-sm rounded-2xl border transition-all ${isExp ? 'border-violet-500/20' : 'border-white/[0.06] hover:border-violet-500/15'}`}>
                <div className={`absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r ${isApp ? 'from-amber-500/40' : 'from-violet-500/40'} to-transparent rounded-t-2xl`} />
                <div className="flex items-center justify-between p-4 cursor-pointer" onClick={() => setExpanded(isExp ? null : t.id)}>
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 ${isApp ? 'bg-gradient-to-br from-amber-500/30 to-amber-600/20' : 'bg-gradient-to-br from-violet-500/30 to-violet-600/20'} rounded-xl flex items-center justify-center text-white font-bold text-sm`}>
                      {(t.first_name || t.name || 'N')[0]?.toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-white">{t.name || `${t.first_name} ${t.last_name}`.trim() || 'Sin nombre'}</span>
                        {t.tenant_number && <span className="text-[10px] text-violet-400 font-mono">{t.tenant_number}</span>}
                        {isApp ? (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/25 font-bold uppercase tracking-wider flex items-center gap-1">
                            <Smartphone className="w-2.5 h-2.5" /> Solo App
                          </span>
                        ) : (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-400 border border-violet-500/25 font-bold uppercase tracking-wider flex items-center gap-1">
                            <Globe className="w-2.5 h-2.5" /> Inquilino
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-gray-500 mt-0.5">
                        <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {t.phone || '—'}</span>
                        {t.email && <span className="hidden sm:flex items-center gap-1"><Mail className="w-3 h-3" /> {t.email}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold ${st.bg} ${st.color} border ${st.border}`}>{st.label}</span>
                    {isExp ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                  </div>
                </div>

                {isExp && (
                  <div className="border-t border-white/[0.06] p-4 bg-white/[0.01]">
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-3">
                      <Detail label="Contrato" value={t.has_contract ? '✓ Sí' : '✗ No'} />
                      <Detail label="Cuenta app" value={t.has_app_account ? '✓ Sí' : '✗ No'} />
                      <Detail label="Registrado" value={t.created_at ? new Date(t.created_at).toLocaleDateString('es-ES') : '—'} />
                      {t.profile_complete !== undefined && <Detail label="Perfil completo" value={t.profile_complete ? '✓ Sí' : '✗ No'} />}
                      {t.notes && <Detail label="Notas" value={t.notes} />}
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {isApp && (
                        <button onClick={() => handleConvert(t.id)} className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-lg hover:bg-amber-500/20 transition">
                          <UserPlus className="w-3 h-3" /> Convertir a inquilino
                        </button>
                      )}
                      {!isApp && (
                        <button onClick={() => startEdit(t)} className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-violet-500/10 text-violet-400 border border-violet-500/20 rounded-lg hover:bg-violet-500/20 transition">
                          <Edit3 className="w-3 h-3" /> Editar
                        </button>
                      )}
                      {(t.email || t.phone) && (
                        <button onClick={() => handleResendWelcome(t.email, t.phone)} className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-lg hover:bg-blue-500/20 transition">
                          <Mail className="w-3 h-3" /> Reenviar bienvenida
                        </button>
                      )}
                      <button onClick={() => handleDelete(t.id, t.source, t.name)} className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg hover:bg-red-500/20 transition">
                        <Trash2 className="w-3 h-3" /> Eliminar
                      </button>
                    </div>
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
            <span className="text-gray-300 font-bold">{totalCount}</span> usuario{totalCount === 1 ? '' : 's'}
            {totalPages > 1 && (
              <> · página <span className="text-violet-400 font-bold">{page}</span> de {totalPages}</>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={pageSize}
              onChange={e => setPageSize(parseInt(e.target.value, 10) || 50)}
              className="px-2 py-1.5 bg-[#0C1220]/60 border border-white/[0.08] rounded-lg text-xs text-white focus:border-violet-500 focus:outline-none cursor-pointer"
              title="Usuarios por página"
            >
              <option value="25">25 / página</option>
              <option value="50">50 / página</option>
              <option value="100">100 / página</option>
              <option value="200">200 / página</option>
            </select>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(1)}
                  disabled={page === 1}
                  className="p-1.5 border border-white/[0.08] rounded-lg text-gray-400 hover:bg-white/[0.04] hover:text-white transition disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Primera"
                >
                  <ChevronsLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1.5 border border-white/[0.08] rounded-lg text-gray-400 hover:bg-white/[0.04] hover:text-white transition disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="px-3 py-1.5 bg-violet-500/10 border border-violet-500/30 rounded-lg text-xs font-bold text-violet-300 min-w-[60px] text-center">
                  {page} / {totalPages}
                </div>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="p-1.5 border border-white/[0.08] rounded-lg text-gray-400 hover:bg-white/[0.04] hover:text-white transition disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPage(totalPages)}
                  disabled={page >= totalPages}
                  className="p-1.5 border border-white/[0.08] rounded-lg text-gray-400 hover:bg-white/[0.04] hover:text-white transition disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Última"
                >
                  <ChevronsRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Credentials modal */}
      {credentialsShown && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="max-w-md w-full bg-gradient-to-br from-emerald-900/40 to-emerald-950/60 border border-emerald-500/30 rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <KeyRound className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">¡Inquilino creado!</h3>
                <p className="text-sm text-emerald-300">{credentialsShown.name}</p>
              </div>
            </div>

            <p className="text-sm text-gray-300 mb-4">
              📧 Las credenciales fueron enviadas por <strong>email</strong> y <strong>SMS</strong> al inquilino.
              También puedes copiarlas aquí (solo se muestran una vez):
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-emerald-400 mb-1 uppercase tracking-wider">Email</label>
                <div className="flex items-center gap-2 bg-black/30 rounded-lg px-3 py-2 border border-emerald-500/15">
                  <code className="flex-1 text-sm text-white font-mono">{credentialsShown.email}</code>
                  <button onClick={() => copyToClipboard(credentialsShown.email, 'email')} className="text-emerald-400 hover:text-emerald-300">
                    {copiedKey === 'email' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-emerald-400 mb-1 uppercase tracking-wider">Contraseña</label>
                <div className="flex items-center gap-2 bg-black/30 rounded-lg px-3 py-2 border border-emerald-500/15">
                  <code className="flex-1 text-sm text-white font-mono">{credentialsShown.password}</code>
                  <button onClick={() => copyToClipboard(credentialsShown.password, 'pwd')} className="text-emerald-400 hover:text-emerald-300">
                    {copiedKey === 'pwd' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <button
                onClick={() => copyToClipboard(`Email: ${credentialsShown.email}\nContraseña: ${credentialsShown.password}`, 'both')}
                className="w-full text-xs px-3 py-2 bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 rounded-lg hover:bg-emerald-500/25 transition flex items-center justify-center gap-2"
              >
                {copiedKey === 'both' ? <><Check className="w-3 h-3" /> Copiado</> : <><Copy className="w-3 h-3" /> Copiar ambos</>}
              </button>
            </div>

            <button
              onClick={() => setCredentialsShown(null)}
              className="w-full mt-5 py-2.5 bg-emerald-500 text-emerald-950 font-bold rounded-lg hover:bg-emerald-400 transition"
            >
              Listo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Inp({ label, value, onChange, placeholder, type = 'text', required }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; required?: boolean }) {
  return (
    <div>
      <label className="block text-xs font-bold text-gray-400 mb-1 uppercase tracking-wider">
        {label}{required && <span className="text-violet-500"> *</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2.5 bg-[#0a1020]/60 border border-white/[0.08] rounded-xl text-white text-sm focus:border-violet-500 focus:outline-none placeholder:text-gray-600"
      />
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">{label}</div>
      <div className="text-sm text-gray-300">{value}</div>
    </div>
  );
}
