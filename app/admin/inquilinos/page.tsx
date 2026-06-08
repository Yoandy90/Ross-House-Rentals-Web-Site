'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAdminAuth } from '../layout';
import {
  Users, Plus, Search, Phone, Mail, MapPin, Calendar, Edit3, Trash2,
  CheckCircle2, Clock, XCircle, X, Save, RefreshCw, ChevronDown, ChevronUp,
} from 'lucide-react';

const STATUS_MAP: Record<string, { label: string; color: string; bg: string; border: string }> = {
  active: { label: 'Activo', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  inactive: { label: 'Inactivo', color: 'text-gray-400', bg: 'bg-gray-500/10', border: 'border-gray-500/20' },
  pending: { label: 'Pendiente', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  evicted: { label: 'Desalojado', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' },
};

export default function InquilinosPage() {
  const { headers } = useAdminAuth();
  const [tenants, setTenants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [form, setForm] = useState({ first_name: '', last_name: '', phone: '', email: '', address: '', id_type: 'drivers_license', id_number: '', emergency_contact: '', emergency_phone: '', status: 'active', notes: '' });

  const fetchTenants = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/tenants', { headers: headers() });
      if (res.ok) { const data = await res.json(); setTenants(data.tenants || []); }
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchTenants(); }, [fetchTenants]);

  const resetForm = () => { setForm({ first_name: '', last_name: '', phone: '', email: '', address: '', id_type: 'drivers_license', id_number: '', emergency_contact: '', emergency_phone: '', status: 'active', notes: '' }); setEditing(null); setShowForm(false); };

  const startEdit = (t: any) => { setForm({ first_name: t.first_name || '', last_name: t.last_name || '', phone: t.phone || '', email: t.email || '', address: t.address || '', id_type: t.id_type || 'drivers_license', id_number: t.id_number || '', emergency_contact: t.emergency_contact || '', emergency_phone: t.emergency_phone || '', status: t.status || 'active', notes: t.notes || '' }); setEditing(t); setShowForm(true); };

  const handleSave = async () => {
    setSaving(true);
    const url = editing ? `/api/admin/tenants/${editing._id}` : '/api/admin/tenants';
    const method = editing ? 'PUT' : 'POST';
    const res = await fetch(url, { method, headers: headers(), body: JSON.stringify(form) });
    if (res.ok) { resetForm(); fetchTenants(); }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este inquilino?')) return;
    await fetch(`/api/admin/tenants/${id}`, { method: 'DELETE', headers: headers() });
    fetchTenants();
  };

  const filtered = tenants.filter(t => !search || `${t.first_name} ${t.last_name} ${t.phone} ${t.email}`.toLowerCase().includes(search.toLowerCase()));

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-3 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6 relative">
      <div className="fixed top-0 left-1/3 w-96 h-96 bg-violet-500/[0.02] rounded-full blur-3xl pointer-events-none" />

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500/20 to-violet-500/5 border border-violet-500/20 flex items-center justify-center"><Users className="w-6 h-6 text-violet-400" /></div>
          <div><h2 className="text-2xl font-bold text-white">Inquilinos</h2><p className="text-sm text-gray-500">{tenants.length} inquilino(s) registrado(s)</p></div>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchTenants} className="p-2 border border-white/[0.08] rounded-lg text-gray-400 hover:bg-white/[0.04]"><RefreshCw className="w-3.5 h-3.5" /></button>
          <button onClick={() => { resetForm(); setShowForm(true); }} className="flex items-center gap-2 px-4 py-2 bg-violet-500/10 text-violet-400 border border-violet-500/20 rounded-lg text-sm font-semibold hover:bg-violet-500/20 transition"><Plus className="w-4 h-4" /> Nuevo</button>
        </div>
      </div>

      <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" /><input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nombre, teléfono o email..." className="w-full pl-10 pr-4 py-2.5 bg-[#0C1220]/60 border border-white/[0.08] rounded-xl text-sm text-white focus:border-violet-500 focus:outline-none placeholder:text-gray-600" /></div>

      {showForm && (
        <div className="bg-white/[0.03] backdrop-blur-xl rounded-2xl border border-violet-500/20 p-6">
          <div className="flex items-center justify-between mb-4"><h3 className="text-lg font-bold text-white">{editing ? 'Editar Inquilino' : 'Nuevo Inquilino'}</h3><button onClick={resetForm} className="text-gray-500 hover:text-white"><X className="w-5 h-5" /></button></div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Inp label="Nombre" value={form.first_name} onChange={v => setForm({...form, first_name: v})} required />
            <Inp label="Apellido" value={form.last_name} onChange={v => setForm({...form, last_name: v})} required />
            <Inp label="Teléfono" value={form.phone} onChange={v => setForm({...form, phone: v})} required />
            <Inp label="Email" value={form.email} onChange={v => setForm({...form, email: v})} type="email" />
            <Inp label="ID Number" value={form.id_number} onChange={v => setForm({...form, id_number: v})} />
            <Inp label="Contacto Emergencia" value={form.emergency_contact} onChange={v => setForm({...form, emergency_contact: v})} />
            <Inp label="Tel Emergencia" value={form.emergency_phone} onChange={v => setForm({...form, emergency_phone: v})} />
            <div><label className="block text-xs font-bold text-gray-400 mb-1 uppercase tracking-wider">Estado</label><select value={form.status} onChange={e => setForm({...form, status: e.target.value})} className="w-full px-3 py-2.5 bg-[#0a1020]/60 border border-white/[0.08] rounded-xl text-white text-sm focus:border-violet-500 focus:outline-none appearance-none"><option value="active">Activo</option><option value="inactive">Inactivo</option><option value="pending">Pendiente</option></select></div>
            <div className="sm:col-span-2 lg:col-span-3"><label className="block text-xs font-bold text-gray-400 mb-1 uppercase tracking-wider">Notas</label><textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} className="w-full px-3 py-2.5 bg-[#0a1020]/60 border border-white/[0.08] rounded-xl text-white text-sm focus:border-violet-500 focus:outline-none h-16 resize-none" /></div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={resetForm} className="px-4 py-2 border border-white/[0.08] rounded-lg text-sm text-gray-400 hover:bg-white/[0.04]">Cancelar</button>
            <button onClick={handleSave} disabled={saving || !form.first_name || !form.last_name || !form.phone} className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-violet-600 to-violet-500 text-white rounded-lg text-sm font-bold hover:opacity-90 disabled:opacity-30 shadow-[0_0_15px_rgba(139,92,246,0.3)]">{saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Save className="w-4 h-4" /> {editing ? 'Guardar' : 'Crear'}</>}</button>
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="text-center py-12"><div className="w-16 h-16 mx-auto bg-violet-500/10 rounded-2xl flex items-center justify-center mb-4"><Users className="w-8 h-8 text-violet-400" /></div><p className="text-gray-400 text-sm">No hay inquilinos registrados</p></div>
      ) : (
        <div className="space-y-3">
          {filtered.map(t => {
            const st = STATUS_MAP[t.status] || STATUS_MAP.active;
            const isExp = expanded === t._id;
            return (
              <div key={t._id} className={`relative overflow-hidden bg-white/[0.03] backdrop-blur-sm rounded-2xl border transition-all ${isExp ? 'border-violet-500/20' : 'border-white/[0.06] hover:border-violet-500/15'}`}>
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-violet-500/40 to-transparent rounded-t-2xl" />
                <div className="absolute -bottom-6 -right-6 w-20 h-20 bg-violet-500/[0.04] rounded-full blur-2xl pointer-events-none" />
                <div className="flex items-center justify-between p-4 cursor-pointer" onClick={() => setExpanded(isExp ? null : t._id)}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-violet-500/30 to-violet-600/20 rounded-xl flex items-center justify-center text-white font-bold text-sm">{(t.first_name || 'N')[0]}</div>
                    <div><div className="font-semibold text-sm text-white">{t.first_name} {t.last_name}</div><div className="flex items-center gap-3 text-[11px] text-gray-500"><span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {t.phone}</span>{t.email && <span className="hidden sm:flex items-center gap-1"><Mail className="w-3 h-3" /> {t.email}</span>}</div></div>
                  </div>
                  <div className="flex items-center gap-3"><span className={`text-[10px] px-2.5 py-1 rounded-full font-bold ${st.bg} ${st.color} border ${st.border}`}>{st.label}</span>{isExp ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}</div>
                </div>
                {isExp && (
                  <div className="border-t border-white/[0.06] p-4 bg-white/[0.01]">
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-3">
                      {t.id_number && <Detail label="ID" value={t.id_number} />}
                      {t.emergency_contact && <Detail label="Contacto Emergencia" value={`${t.emergency_contact} ${t.emergency_phone || ''}`} />}
                      {t.notes && <Detail label="Notas" value={t.notes} />}
                      <Detail label="Registrado" value={t.created_at ? new Date(t.created_at).toLocaleDateString('es-ES') : '—'} />
                    </div>
                    <div className="flex gap-2"><button onClick={() => startEdit(t)} className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-violet-500/10 text-violet-400 border border-violet-500/20 rounded-lg hover:bg-violet-500/20 transition"><Edit3 className="w-3 h-3" /> Editar</button><button onClick={() => handleDelete(t._id)} className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg hover:bg-red-500/20 transition"><Trash2 className="w-3 h-3" /> Eliminar</button></div>
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

function Inp({ label, value, onChange, placeholder, type = 'text', required }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; required?: boolean }) {
  return (<div><label className="block text-xs font-bold text-gray-400 mb-1 uppercase tracking-wider">{label}{required && <span className="text-violet-500"> *</span>}</label><input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="w-full px-3 py-2.5 bg-[#0a1020]/60 border border-white/[0.08] rounded-xl text-white text-sm focus:border-violet-500 focus:outline-none placeholder:text-gray-600" /></div>);
}

function Detail({ label, value }: { label: string; value: string }) {
  return (<div><div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">{label}</div><div className="text-sm text-gray-300">{value}</div></div>);
}
