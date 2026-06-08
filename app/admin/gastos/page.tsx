'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAdminAuth } from '../layout';
import {
  DollarSign, Plus, Search, Calendar, Home, Wrench, Trash2, Edit3,
  RefreshCw, X, Save, Droplets, Zap, Shield, Hammer, Paintbrush,
  Bug, Truck, FileText,
} from 'lucide-react';

const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

const CATEGORIES: Record<string, { label: string; Icon: any; color: string }> = {
  maintenance: { label: 'Mantenimiento', Icon: Wrench, color: 'amber' },
  repair: { label: 'Reparación', Icon: Hammer, color: 'red' },
  plumbing: { label: 'Plomería', Icon: Droplets, color: 'blue' },
  electrical: { label: 'Eléctrica', Icon: Zap, color: 'yellow' },
  pest_control: { label: 'Control Plagas', Icon: Bug, color: 'emerald' },
  landscaping: { label: 'Jardinería', Icon: Paintbrush, color: 'green' },
  insurance: { label: 'Seguro', Icon: Shield, color: 'indigo' },
  taxes: { label: 'Impuestos', Icon: FileText, color: 'purple' },
  supplies: { label: 'Suministros', Icon: Truck, color: 'cyan' },
  other: { label: 'Otro', Icon: DollarSign, color: 'gray' },
};

export default function GastosPage() {
  const { headers } = useAdminAuth();
  const [expenses, setExpenses] = useState<any[]>([]);
  const [properties, setProperties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ property_id: '', category: 'maintenance', description: '', amount: '', expense_date: new Date().toISOString().split('T')[0], vendor: '', status: 'completed' });

  const fetchAll = useCallback(async () => {
    try {
      const [eRes, pRes] = await Promise.all([
        fetch('/api/admin/property-expenses', { headers: headers() }),
        fetch('/api/admin/properties', { headers: headers() }),
      ]);
      if (eRes.ok) { const d = await eRes.json(); setExpenses(d.expenses || []); }
      if (pRes.ok) { const d = await pRes.json(); setProperties(d.properties || []); }
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const resetForm = () => { setForm({ property_id: '', category: 'maintenance', description: '', amount: '', expense_date: new Date().toISOString().split('T')[0], vendor: '', status: 'completed' }); setEditing(null); setShowForm(false); };

  const handleSave = async () => {
    setSaving(true);
    const body = { ...form, amount: parseFloat(form.amount) || 0 };
    const url = editing ? `/api/admin/property-expenses/${editing._id}` : '/api/admin/property-expenses';
    const method = editing ? 'PUT' : 'POST';
    const res = await fetch(url, { method, headers: headers(), body: JSON.stringify(body) });
    if (res.ok) { resetForm(); fetchAll(); }
    setSaving(false);
  };

  const handleDelete = async (id: string) => { if (!confirm('¿Eliminar este gasto?')) return; await fetch(`/api/admin/property-expenses/${id}`, { method: 'DELETE', headers: headers() }); fetchAll(); };

  const totalExpenses = expenses.reduce((s, e) => s + (e.amount || 0), 0);
  const getPropName = (id: string) => properties.find(p => p._id === id)?.name || 'General';

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-3 border-red-500/30 border-t-red-500 rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6 relative">
      <div className="fixed bottom-0 left-1/4 w-96 h-96 bg-red-500/[0.02] rounded-full blur-3xl pointer-events-none" />

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-red-500/20 to-red-500/5 border border-red-500/20 flex items-center justify-center"><DollarSign className="w-6 h-6 text-red-400" /></div>
          <div><h2 className="text-2xl font-bold text-white">Gastos</h2><p className="text-sm text-gray-500">Total: {fmt(totalExpenses)} en {expenses.length} registro(s)</p></div>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchAll} className="p-2 border border-white/[0.08] rounded-lg text-gray-400 hover:bg-white/[0.04]"><RefreshCw className="w-3.5 h-3.5" /></button>
          <button onClick={() => { resetForm(); setShowForm(true); }} className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg text-sm font-semibold hover:bg-red-500/20 transition"><Plus className="w-4 h-4" /> Nuevo Gasto</button>
        </div>
      </div>

      {showForm && (
        <div className="bg-white/[0.03] backdrop-blur-xl rounded-2xl border border-red-500/20 p-6">
          <div className="flex items-center justify-between mb-4"><h3 className="text-lg font-bold text-white">{editing ? 'Editar Gasto' : 'Nuevo Gasto'}</h3><button onClick={resetForm} className="text-gray-500 hover:text-white"><X className="w-5 h-5" /></button></div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div><label className="block text-xs font-bold text-gray-400 mb-1 uppercase tracking-wider">Propiedad</label><select value={form.property_id} onChange={e => setForm({...form, property_id: e.target.value})} className="w-full px-3 py-2.5 bg-[#0a1020]/60 border border-white/[0.08] rounded-xl text-white text-sm focus:border-red-500 focus:outline-none appearance-none"><option value="">General (sin propiedad)</option>{properties.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}</select></div>
            <div><label className="block text-xs font-bold text-gray-400 mb-1 uppercase tracking-wider">Categoría</label><select value={form.category} onChange={e => setForm({...form, category: e.target.value})} className="w-full px-3 py-2.5 bg-[#0a1020]/60 border border-white/[0.08] rounded-xl text-white text-sm focus:border-red-500 focus:outline-none appearance-none">{Object.entries(CATEGORIES).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}</select></div>
            <div><label className="block text-xs font-bold text-gray-400 mb-1 uppercase tracking-wider">Monto ($) <span className="text-red-500">*</span></label><input type="number" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} className="w-full px-3 py-2.5 bg-[#0a1020]/60 border border-white/[0.08] rounded-xl text-white text-sm focus:border-red-500 focus:outline-none" /></div>
            <div className="sm:col-span-2"><label className="block text-xs font-bold text-gray-400 mb-1 uppercase tracking-wider">Descripción <span className="text-red-500">*</span></label><input type="text" value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="w-full px-3 py-2.5 bg-[#0a1020]/60 border border-white/[0.08] rounded-xl text-white text-sm focus:border-red-500 focus:outline-none" placeholder="Descripción del gasto" /></div>
            <div><label className="block text-xs font-bold text-gray-400 mb-1 uppercase tracking-wider">Fecha</label><input type="date" value={form.expense_date} onChange={e => setForm({...form, expense_date: e.target.value})} className="w-full px-3 py-2.5 bg-[#0a1020]/60 border border-white/[0.08] rounded-xl text-white text-sm focus:border-red-500 focus:outline-none" /></div>
            <div><label className="block text-xs font-bold text-gray-400 mb-1 uppercase tracking-wider">Proveedor</label><input type="text" value={form.vendor} onChange={e => setForm({...form, vendor: e.target.value})} className="w-full px-3 py-2.5 bg-[#0a1020]/60 border border-white/[0.08] rounded-xl text-white text-sm focus:border-red-500 focus:outline-none" placeholder="Nombre del proveedor" /></div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={resetForm} className="px-4 py-2 border border-white/[0.08] rounded-lg text-sm text-gray-400 hover:bg-white/[0.04]">Cancelar</button>
            <button onClick={handleSave} disabled={saving || !form.amount || !form.description} className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-red-600 to-red-500 text-white rounded-lg text-sm font-bold hover:opacity-90 disabled:opacity-30">{saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Save className="w-4 h-4" /> {editing ? 'Guardar' : 'Registrar'}</>}</button>
          </div>
        </div>
      )}

      {expenses.length === 0 ? (
        <div className="text-center py-12"><div className="w-16 h-16 mx-auto bg-red-500/10 rounded-2xl flex items-center justify-center mb-4"><DollarSign className="w-8 h-8 text-red-400" /></div><p className="text-gray-400 text-sm">No hay gastos registrados</p></div>
      ) : (
        <div className="space-y-2">
          {expenses.map(e => {
            const cat = CATEGORIES[e.category] || CATEGORIES.other;
            return (
              <div key={e._id} className="relative overflow-hidden bg-white/[0.03] backdrop-blur-sm rounded-xl border border-white/[0.06] p-4 flex items-center justify-between hover:border-red-500/15 transition">
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-red-500/30 to-transparent rounded-t-xl" />
                <div className="absolute -bottom-4 -right-4 w-16 h-16 bg-red-500/[0.04] rounded-full blur-xl pointer-events-none" />
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-lg bg-${cat.color}-500/10 flex items-center justify-center`}><cat.Icon className={`w-4 h-4 text-${cat.color}-400`} /></div>
                  <div><div className="font-semibold text-sm text-white">{e.description}</div><div className="text-[11px] text-gray-500">{cat.label} • {getPropName(e.property_id)} • {e.expense_date ? new Date(e.expense_date).toLocaleDateString('es-ES') : ''}{e.vendor ? ` • ${e.vendor}` : ''}</div></div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="font-bold text-sm text-red-400">{fmt(e.amount || 0)}</div>
                  <div className="flex gap-1"><button onClick={() => { setForm({ property_id: e.property_id || '', category: e.category || 'maintenance', description: e.description || '', amount: String(e.amount || ''), expense_date: e.expense_date || '', vendor: e.vendor || '', status: e.status || 'completed' }); setEditing(e); setShowForm(true); }} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-gray-500 hover:text-amber-400"><Edit3 className="w-3.5 h-3.5" /></button><button onClick={() => handleDelete(e._id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-gray-500 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button></div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
