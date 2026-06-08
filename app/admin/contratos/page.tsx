'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAdminAuth } from '../layout';
import {
  FileText, Plus, Search, Calendar, DollarSign, Home, Users,
  Edit3, Trash2, CheckCircle2, Clock, AlertTriangle, X, Save,
  RefreshCw, Download, ChevronDown, ChevronUp, FileSignature,
} from 'lucide-react';

const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n);

const STATUS_MAP: Record<string, { label: string; color: string; bg: string; border: string }> = {
  draft: { label: 'Borrador', color: 'text-gray-400', bg: 'bg-gray-500/10', border: 'border-gray-500/20' },
  active: { label: 'Activo', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  expired: { label: 'Vencido', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  terminated: { label: 'Terminado', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' },
  pending_signature: { label: 'Pendiente Firma', color: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20' },
};

export default function ContratosPage() {
  const { headers } = useAdminAuth();
  const [contracts, setContracts] = useState<any[]>([]);
  const [properties, setProperties] = useState<any[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [form, setForm] = useState({ property_id: '', tenant_id: '', start_date: '', end_date: '', rent_amount: '', deposit_amount: '', payment_day: '1', status: 'draft', late_fee: '25', grace_period_days: '5', terms: '' });

  const fetchAll = useCallback(async () => {
    try {
      const [cRes, pRes, tRes] = await Promise.all([
        fetch('/api/admin/rental-contracts', { headers: headers() }),
        fetch('/api/admin/properties', { headers: headers() }),
        fetch('/api/admin/tenants', { headers: headers() }),
      ]);
      if (cRes.ok) { const d = await cRes.json(); setContracts(d.contracts || []); }
      if (pRes.ok) { const d = await pRes.json(); setProperties(d.properties || []); }
      if (tRes.ok) { const d = await tRes.json(); setTenants(d.tenants || []); }
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const getPropName = (id: string) => properties.find(p => p._id === id)?.name || 'N/A';
  const getTenantName = (id: string) => { const t = tenants.find(t => t._id === id); return t ? `${t.first_name} ${t.last_name}` : 'N/A'; };

  const resetForm = () => { setForm({ property_id: '', tenant_id: '', start_date: '', end_date: '', rent_amount: '', deposit_amount: '', payment_day: '1', status: 'draft', late_fee: '25', grace_period_days: '5', terms: '' }); setEditing(null); setShowForm(false); };

  const handleSave = async () => {
    setSaving(true);
    const body = { ...form, rent_amount: parseFloat(form.rent_amount) || 0, deposit_amount: parseFloat(form.deposit_amount) || 0, payment_day: parseInt(form.payment_day) || 1, late_fee: parseFloat(form.late_fee) || 25, grace_period_days: parseInt(form.grace_period_days) || 5 };
    const url = editing ? `/api/admin/rental-contracts/${editing._id}` : '/api/admin/rental-contracts';
    const method = editing ? 'PUT' : 'POST';
    const res = await fetch(url, { method, headers: headers(), body: JSON.stringify(body) });
    if (res.ok) { resetForm(); fetchAll(); }
    setSaving(false);
  };

  const handleDelete = async (id: string) => { if (!confirm('¿Eliminar este contrato?')) return; await fetch(`/api/admin/rental-contracts/${id}`, { method: 'DELETE', headers: headers() }); fetchAll(); };

  const downloadPdf = async (id: string) => {
    const res = await fetch(`/api/admin/rental-contracts/${id}/pdf`, { headers: headers() });
    if (res.ok) { const data = await res.json(); if (data.pdf_base64) { const link = document.createElement('a'); link.href = `data:application/pdf;base64,${data.pdf_base64}`; link.download = `contrato_${id}.pdf`; link.click(); }}
  };

  const filtered = contracts.filter(c => !search || `${getPropName(c.property_id)} ${getTenantName(c.tenant_id)}`.toLowerCase().includes(search.toLowerCase()));

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-3 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6 relative">
      <div className="fixed bottom-0 right-1/4 w-96 h-96 bg-emerald-500/[0.02] rounded-full blur-3xl pointer-events-none" />

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 border border-emerald-500/20 flex items-center justify-center"><FileText className="w-6 h-6 text-emerald-400" /></div>
          <div><h2 className="text-2xl font-bold text-white">Contratos</h2><p className="text-sm text-gray-500">{contracts.length} contrato(s)</p></div>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchAll} className="p-2 border border-white/[0.08] rounded-lg text-gray-400 hover:bg-white/[0.04]"><RefreshCw className="w-3.5 h-3.5" /></button>
          <button onClick={() => { resetForm(); setShowForm(true); }} className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg text-sm font-semibold hover:bg-emerald-500/20 transition"><Plus className="w-4 h-4" /> Nuevo</button>
        </div>
      </div>

      <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" /><input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por propiedad o inquilino..." className="w-full pl-10 pr-4 py-2.5 bg-[#0C1220]/60 border border-white/[0.08] rounded-xl text-sm text-white focus:border-emerald-500 focus:outline-none placeholder:text-gray-600" /></div>

      {showForm && (
        <div className="bg-white/[0.03] backdrop-blur-xl rounded-2xl border border-emerald-500/20 p-6">
          <div className="flex items-center justify-between mb-4"><h3 className="text-lg font-bold text-white">{editing ? 'Editar Contrato' : 'Nuevo Contrato'}</h3><button onClick={resetForm} className="text-gray-500 hover:text-white"><X className="w-5 h-5" /></button></div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div><label className="block text-xs font-bold text-gray-400 mb-1 uppercase tracking-wider">Propiedad <span className="text-emerald-500">*</span></label><select value={form.property_id} onChange={e => setForm({...form, property_id: e.target.value})} className="w-full px-3 py-2.5 bg-[#0a1020]/60 border border-white/[0.08] rounded-xl text-white text-sm focus:border-emerald-500 focus:outline-none appearance-none"><option value="">Seleccionar...</option>{properties.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}</select></div>
            <div><label className="block text-xs font-bold text-gray-400 mb-1 uppercase tracking-wider">Inquilino <span className="text-emerald-500">*</span></label><select value={form.tenant_id} onChange={e => setForm({...form, tenant_id: e.target.value})} className="w-full px-3 py-2.5 bg-[#0a1020]/60 border border-white/[0.08] rounded-xl text-white text-sm focus:border-emerald-500 focus:outline-none appearance-none"><option value="">Seleccionar...</option>{tenants.map(t => <option key={t._id} value={t._id}>{t.first_name} {t.last_name}</option>)}</select></div>
            <div><label className="block text-xs font-bold text-gray-400 mb-1 uppercase tracking-wider">Estado</label><select value={form.status} onChange={e => setForm({...form, status: e.target.value})} className="w-full px-3 py-2.5 bg-[#0a1020]/60 border border-white/[0.08] rounded-xl text-white text-sm focus:border-emerald-500 focus:outline-none appearance-none"><option value="draft">Borrador</option><option value="active">Activo</option><option value="pending_signature">Pendiente Firma</option></select></div>
            <FInput label="Fecha Inicio" value={form.start_date} onChange={v => setForm({...form, start_date: v})} type="date" required />
            <FInput label="Fecha Fin" value={form.end_date} onChange={v => setForm({...form, end_date: v})} type="date" required />
            <FInput label="Día de Pago" value={form.payment_day} onChange={v => setForm({...form, payment_day: v})} type="number" />
            <FInput label="Renta Mensual ($)" value={form.rent_amount} onChange={v => setForm({...form, rent_amount: v})} type="number" required />
            <FInput label="Depósito ($)" value={form.deposit_amount} onChange={v => setForm({...form, deposit_amount: v})} type="number" />
            <FInput label="Cargo Tardío ($)" value={form.late_fee} onChange={v => setForm({...form, late_fee: v})} type="number" />
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={resetForm} className="px-4 py-2 border border-white/[0.08] rounded-lg text-sm text-gray-400 hover:bg-white/[0.04]">Cancelar</button>
            <button onClick={handleSave} disabled={saving || !form.property_id || !form.tenant_id || !form.rent_amount} className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-emerald-600 to-emerald-500 text-white rounded-lg text-sm font-bold hover:opacity-90 disabled:opacity-30 shadow-[0_0_15px_rgba(16,185,129,0.3)]">{saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Save className="w-4 h-4" /> {editing ? 'Guardar' : 'Crear'}</>}</button>
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="text-center py-12"><div className="w-16 h-16 mx-auto bg-emerald-500/10 rounded-2xl flex items-center justify-center mb-4"><FileText className="w-8 h-8 text-emerald-400" /></div><p className="text-gray-400 text-sm">No hay contratos aún</p></div>
      ) : (
        <div className="space-y-3">
          {filtered.map(c => {
            const st = STATUS_MAP[c.status] || STATUS_MAP.draft;
            const isExp = expanded === c._id;
            return (
              <div key={c._id} className={`relative overflow-hidden bg-white/[0.03] backdrop-blur-sm rounded-2xl border transition-all ${isExp ? 'border-emerald-500/20' : 'border-white/[0.06] hover:border-emerald-500/15'}`}>
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-500/40 to-transparent rounded-t-2xl" />
                <div className="absolute -bottom-6 -right-6 w-20 h-20 bg-emerald-500/[0.04] rounded-full blur-2xl pointer-events-none" />
                <div className="flex items-center justify-between p-4 cursor-pointer" onClick={() => setExpanded(isExp ? null : c._id)}>
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 bg-gradient-to-br from-emerald-500/30 to-emerald-600/20 rounded-xl flex items-center justify-center"><FileText className="w-5 h-5 text-emerald-400" /></div>
                    <div className="min-w-0">
                      <div className="font-semibold text-sm text-white truncate">{getPropName(c.property_id)}</div>
                      <div className="text-[11px] text-gray-500 flex items-center gap-2"><Users className="w-3 h-3" /> {getTenantName(c.tenant_id)} <span>•</span> <Calendar className="w-3 h-3" /> {c.start_date} → {c.end_date}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right hidden md:block"><div className="font-bold text-sm text-emerald-400">{fmt(c.rent_amount || 0)}/mes</div></div>
                    <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold ${st.bg} ${st.color} border ${st.border}`}>{st.label}</span>
                    {isExp ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                  </div>
                </div>
                {isExp && (
                  <div className="border-t border-white/[0.06] p-4 bg-white/[0.01]">
                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
                      <DtI label="Renta" value={fmt(c.rent_amount || 0)} />
                      <DtI label="Depósito" value={fmt(c.deposit_amount || 0)} />
                      <DtI label="Día de Pago" value={`Día ${c.payment_day || 1}`} />
                      <DtI label="Cargo Tardío" value={fmt(c.late_fee || 25)} />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => downloadPdf(c._id)} className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-lg hover:bg-blue-500/20 transition"><Download className="w-3 h-3" /> PDF</button>
                      <button onClick={() => { setForm({ property_id: c.property_id, tenant_id: c.tenant_id, start_date: c.start_date || '', end_date: c.end_date || '', rent_amount: String(c.rent_amount || ''), deposit_amount: String(c.deposit_amount || ''), payment_day: String(c.payment_day || 1), status: c.status || 'draft', late_fee: String(c.late_fee || 25), grace_period_days: String(c.grace_period_days || 5), terms: c.terms || '' }); setEditing(c); setShowForm(true); }} className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg hover:bg-emerald-500/20 transition"><Edit3 className="w-3 h-3" /> Editar</button>
                      <button onClick={() => handleDelete(c._id)} className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg hover:bg-red-500/20 transition"><Trash2 className="w-3 h-3" /> Eliminar</button>
                    </div>
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

function FInput({ label, value, onChange, type = 'text', required }: { label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean }) {
  return (<div><label className="block text-xs font-bold text-gray-400 mb-1 uppercase tracking-wider">{label}{required && <span className="text-emerald-500"> *</span>}</label><input type={type} value={value} onChange={e => onChange(e.target.value)} className="w-full px-3 py-2.5 bg-[#0a1020]/60 border border-white/[0.08] rounded-xl text-white text-sm focus:border-emerald-500 focus:outline-none" /></div>);
}

function DtI({ label, value }: { label: string; value: string }) {
  return (<div><div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">{label}</div><div className="text-sm text-gray-300 font-semibold">{value}</div></div>);
}
