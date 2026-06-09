'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAdminAuth } from '../layout';
import {
  Home, Plus, Search, MapPin, DollarSign, Bed, Bath, Square,
  Edit3, Trash2, Eye, RefreshCw, CheckCircle2, Wrench, Clock,
  X, ChevronDown, ChevronUp, Save, Image as ImageIcon,
} from 'lucide-react';

const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n);

const STATUS_MAP: Record<string, { label: string; color: string; bg: string; Icon: any }> = {
  available: { label: 'Disponible', color: 'text-emerald-400', bg: 'bg-emerald-500/10', Icon: CheckCircle2 },
  rented: { label: 'Alquilada', color: 'text-blue-400', bg: 'bg-blue-500/10', Icon: Home },
  maintenance: { label: 'Mantenimiento', color: 'text-amber-400', bg: 'bg-amber-500/10', Icon: Wrench },
  unavailable: { label: 'No Disponible', color: 'text-gray-400', bg: 'bg-gray-500/10', Icon: Clock },
};

export default function PropiedadesPage() {
  const { headers } = useAdminAuth();
  const [properties, setProperties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', address: '', city: 'Dumas', state: 'TX', zip: '', type: 'house', bedrooms: '3', bathrooms: '2', sqft: '', rent_amount: '', deposit_amount: '', description: '', status: 'available' });

  const fetchProps = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/properties', { headers: headers() });
      if (res.ok) { const data = await res.json(); setProperties(data.properties || []); }
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchProps(); }, [fetchProps]);

  const resetForm = () => {
    setForm({ name: '', address: '', city: 'Dumas', state: 'TX', zip: '', type: 'house', bedrooms: '3', bathrooms: '2', sqft: '', rent_amount: '', deposit_amount: '', description: '', status: 'available' });
    setEditing(null); setShowForm(false);
  };

  const startEdit = (p: any) => {
    setForm({ name: p.name || '', address: p.address || '', city: p.city || 'Dumas', state: p.state || 'TX', zip: p.zip || '', type: p.type || 'house', bedrooms: String(p.bedrooms || 3), bathrooms: String(p.bathrooms || 2), sqft: String(p.sqft || ''), rent_amount: String(p.rent_amount || ''), deposit_amount: String(p.deposit_amount || ''), description: p.description || '', status: p.status || 'available' });
    setEditing(p); setShowForm(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const body = { ...form, bedrooms: parseInt(form.bedrooms) || 3, bathrooms: parseInt(form.bathrooms) || 2, sqft: parseInt(form.sqft) || 0, rent_amount: parseFloat(form.rent_amount) || 0, deposit_amount: parseFloat(form.deposit_amount) || 0 };
      const url = editing ? `/api/admin/properties/${editing._id}` : '/api/admin/properties';
      const method = editing ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: headers(), body: JSON.stringify(body) });
      if (res.ok) { resetForm(); fetchProps(); }
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta propiedad?')) return;
    await fetch(`/api/admin/properties/${id}`, { method: 'DELETE', headers: headers() });
    fetchProps();
  };

  const filtered = properties.filter(p => !search || `${p.name} ${p.address}`.toLowerCase().includes(search.toLowerCase()));

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-3 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6 relative">
      <div className="fixed top-0 right-1/4 w-96 h-96 bg-cyan-500/[0.02] rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-cyan-500/5 border border-cyan-500/20 flex items-center justify-center">
            <Home className="w-6 h-6 text-cyan-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Propiedades</h2>
            <p className="text-sm text-gray-500">{properties.length} propiedad(es) en inventario</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchProps} className="flex items-center gap-2 px-3 py-2 border border-white/[0.08] rounded-lg text-xs text-gray-400 hover:bg-white/[0.04] transition"><RefreshCw className="w-3.5 h-3.5" /></button>
          <button onClick={() => { resetForm(); setShowForm(true); }} className="flex items-center gap-2 px-4 py-2 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded-lg text-sm hover:bg-cyan-500/20 transition font-semibold"><Plus className="w-4 h-4" /> Nueva</button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nombre o dirección..." className="w-full pl-10 pr-4 py-2.5 bg-[#0C1220]/60 border border-white/[0.08] rounded-xl text-sm text-white focus:border-cyan-500 focus:outline-none placeholder:text-gray-600" />
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="bg-white/[0.03] backdrop-blur-xl rounded-2xl border border-cyan-500/20 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-white">{editing ? 'Editar Propiedad' : 'Nueva Propiedad'}</h3>
            <button onClick={resetForm} className="text-gray-500 hover:text-white"><X className="w-5 h-5" /></button>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Input label="Nombre" value={form.name} onChange={v => setForm({...form, name: v})} placeholder="Casa Main St" required />
            <Input label="Dirección" value={form.address} onChange={v => setForm({...form, address: v})} placeholder="123 Main St" required />
            <Input label="Ciudad" value={form.city} onChange={v => setForm({...form, city: v})} />
            <Input label="ZIP" value={form.zip} onChange={v => setForm({...form, zip: v})} placeholder="79029" />
            <Select label="Tipo" value={form.type} onChange={v => setForm({...form, type: v})} options={[{v:'house',l:'Casa'},{v:'apartment',l:'Apartamento'},{v:'duplex',l:'Duplex'},{v:'mobile_home',l:'Mobile Home'},{v:'commercial',l:'Comercial'}]} />
            <Select label="Estado" value={form.status} onChange={v => setForm({...form, status: v})} options={[{v:'available',l:'Disponible'},{v:'rented',l:'Alquilada'},{v:'maintenance',l:'Mantenimiento'},{v:'unavailable',l:'No Disponible'}]} />
            <Input label="Habitaciones" value={form.bedrooms} onChange={v => setForm({...form, bedrooms: v})} type="number" />
            <Input label="Baños" value={form.bathrooms} onChange={v => setForm({...form, bathrooms: v})} type="number" />
            <Input label="Sq Ft" value={form.sqft} onChange={v => setForm({...form, sqft: v})} type="number" />
            <Input label="Renta Mensual ($)" value={form.rent_amount} onChange={v => setForm({...form, rent_amount: v})} type="number" required />
            <Input label="Depósito ($)" value={form.deposit_amount} onChange={v => setForm({...form, deposit_amount: v})} type="number" />
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="block text-xs font-bold text-gray-400 mb-1 uppercase tracking-wider">Descripción</label>
              <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="w-full px-4 py-2.5 bg-[#0a1020]/60 border border-white/[0.08] rounded-xl text-white text-sm focus:border-cyan-500 focus:outline-none h-16 resize-none placeholder:text-gray-600" />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={resetForm} className="px-4 py-2 border border-white/[0.08] rounded-lg text-sm text-gray-400 hover:bg-white/[0.04]">Cancelar</button>
            <button onClick={handleSave} disabled={saving || !form.name || !form.rent_amount} className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-cyan-600 to-cyan-500 text-white rounded-lg text-sm font-bold hover:opacity-90 disabled:opacity-30 shadow-[0_0_15px_rgba(6,182,212,0.3)]">
              {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Save className="w-4 h-4" /> {editing ? 'Guardar' : 'Crear'}</>}
            </button>
          </div>
        </div>
      )}

      {/* Properties Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-12"><div className="w-16 h-16 mx-auto bg-cyan-500/10 rounded-2xl flex items-center justify-center mb-4"><Home className="w-8 h-8 text-cyan-400" /></div><p className="text-gray-400 text-sm">No hay propiedades aún</p></div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(p => {
            const st = STATUS_MAP[p.status] || STATUS_MAP.available;
            // Get the first photo URL
            const photoPath = p.photos?.[0] || '';
            const photoUrl = photoPath ? `/api/public/property-file/${photoPath}` : '';
            
            return (
              <div key={p._id} className="relative overflow-hidden bg-white/[0.03] backdrop-blur-sm rounded-2xl border border-white/[0.06] hover:border-cyan-500/20 transition group">
                {/* Corner gradient orbs */}
                <div className="absolute -bottom-8 -right-8 w-28 h-28 bg-cyan-500/[0.06] rounded-full blur-2xl pointer-events-none group-hover:bg-cyan-500/15 transition-all" />
                <div className="absolute -top-4 -left-4 w-16 h-16 bg-cyan-500/[0.04] rounded-full blur-xl pointer-events-none" />
                {/* Top gradient bar */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-t-2xl" />
                {/* Image area */}
                <div className="h-32 bg-gradient-to-br from-cyan-500/10 to-blue-500/5 flex items-center justify-center relative overflow-hidden">
                  {photoUrl ? (
                    <img 
                      src={photoUrl} 
                      alt={`${p.address || 'Propiedad'}`}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                        (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                      }}
                    />
                  ) : null}
                  <Home className={`w-10 h-10 text-cyan-500/30 ${photoUrl ? 'hidden' : ''}`} />
                  <span className={`absolute top-2 right-2 text-[10px] px-2 py-0.5 rounded-full font-bold ${st.bg} ${st.color} flex items-center gap-1`}>
                    <st.Icon className="w-3 h-3" /> {st.label}
                  </span>
                </div>
                <div className="p-4">
                  <h3 className="font-bold text-sm text-white mb-1 truncate">{p.name}</h3>
                  <p className="text-[11px] text-gray-500 flex items-center gap-1 mb-3"><MapPin className="w-3 h-3" /> {p.address}{p.city ? `, ${p.city}` : ''}</p>
                  <div className="flex items-center gap-3 text-[11px] text-gray-500 mb-3">
                    <span className="flex items-center gap-1"><Bed className="w-3 h-3" /> {p.bedrooms || 0}</span>
                    <span className="flex items-center gap-1"><Bath className="w-3 h-3" /> {p.bathrooms || 0}</span>
                    {p.sqft > 0 && <span className="flex items-center gap-1"><Square className="w-3 h-3" /> {p.sqft} ft²</span>}
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-lg font-bold text-cyan-400">{fmt(p.rent_amount || 0)}<span className="text-[10px] text-gray-600 font-normal">/mes</span></div>
                    <div className="flex gap-1">
                      <button onClick={() => startEdit(p)} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-gray-500 hover:text-cyan-400 transition"><Edit3 className="w-3.5 h-3.5" /></button>
                      <button onClick={() => handleDelete(p._id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-gray-500 hover:text-red-400 transition"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Input({ label, value, onChange, placeholder, type = 'text', required }: any) {
  return (
    <div>
      <label className="block text-xs font-bold text-gray-400 mb-1 uppercase tracking-wider">{label}{required && <span className="text-cyan-500"> *</span>}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="w-full px-3 py-2.5 bg-[#0a1020]/60 border border-white/[0.08] rounded-xl text-white text-sm focus:border-cyan-500 focus:outline-none placeholder:text-gray-600" />
    </div>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: {v:string;l:string}[] }) {
  return (
    <div>
      <label className="block text-xs font-bold text-gray-400 mb-1 uppercase tracking-wider">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)} className="w-full px-3 py-2.5 bg-[#0a1020]/60 border border-white/[0.08] rounded-xl text-white text-sm focus:border-cyan-500 focus:outline-none appearance-none">
        {options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
    </div>
  );
}
