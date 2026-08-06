'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { X, Plus, Trash2, RefreshCw, Layers, Save, Pencil } from 'lucide-react';

interface Unit {
  _id: string; unit_name: string; bedrooms: number; bathrooms: number;
  square_feet: number; rent_amount: number; deposit_amount: number;
  status: string; tenant_name?: string; notes?: string;
}

interface Summary {
  total: number; rented: number; available: number; maintenance: number;
  monthly_income_potential: number; monthly_income_current: number;
}

const STATUS_OPTS = [
  { value: 'available', label: 'Disponible', cls: 'text-emerald-300' },
  { value: 'rented', label: 'Rentada', cls: 'text-cyan-300' },
  { value: 'maintenance', label: 'Mantenimiento', cls: 'text-amber-300' },
];

const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n || 0);

export default function UnitsManager({ propertyId, propertyName, headers, onClose, onChanged }: {
  propertyId: string; propertyName: string;
  headers: () => Record<string, string>;
  onClose: () => void; onChanged: () => void;
}) {
  const [units, setUnits] = useState<Unit[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [single, setSingle] = useState({ unit_name: '', bedrooms: '', bathrooms: '', rent_amount: '' });
  const [bulk, setBulk] = useState({ prefix: 'Apt', bulk_count: '', start_number: '1', rent_amount: '', bedrooms: '', bathrooms: '' });
  const [mode, setMode] = useState<'single' | 'bulk'>('single');
  const [busy, setBusy] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editRow, setEditRow] = useState({ unit_name: '', bedrooms: '', bathrooms: '', rent_amount: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/properties/${propertyId}/units`, { headers: headers() });
      if (res.ok) {
        const d = await res.json();
        setUnits(d.units || []);
        setSummary(d.summary || null);
      }
    } catch { /* noop */ }
    setLoading(false);
  }, [propertyId]);

  useEffect(() => { load(); }, [load]);

  const flash = (msg: string) => { setErr(msg); setTimeout(() => setErr(''), 5000); };

  const create = async () => {
    setBusy(true);
    const body: any = mode === 'bulk'
      ? { bulk_count: parseInt(bulk.bulk_count || '0'), prefix: bulk.prefix, start_number: parseInt(bulk.start_number || '1'), rent_amount: bulk.rent_amount || undefined, bedrooms: bulk.bedrooms || undefined, bathrooms: bulk.bathrooms || undefined }
      : { unit_name: single.unit_name, bedrooms: single.bedrooms || undefined, bathrooms: single.bathrooms || undefined, rent_amount: single.rent_amount || undefined };
    try {
      const res = await fetch(`/api/admin/properties/${propertyId}/units`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...headers() },
        body: JSON.stringify(body),
      });
      const d = await res.json();
      if (res.ok) {
        setSingle({ unit_name: '', bedrooms: '', bathrooms: '', rent_amount: '' });
        setBulk({ ...bulk, bulk_count: '' });
        load(); onChanged();
      } else flash(d.detail || 'Error al crear');
    } catch { flash('Error de red'); }
    setBusy(false);
  };

  const setStatus = async (u: Unit, status: string) => {
    const res = await fetch(`/api/admin/units/${u._id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json', ...headers() },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) flash((await res.json()).detail || 'Error');
    load(); onChanged();
  };

  const saveEdit = async () => {
    if (!editId) return;
    const res = await fetch(`/api/admin/units/${editId}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json', ...headers() },
      body: JSON.stringify({
        unit_name: editRow.unit_name, bedrooms: editRow.bedrooms || 0,
        bathrooms: editRow.bathrooms || 0, rent_amount: editRow.rent_amount || 0,
      }),
    });
    if (!res.ok) flash((await res.json()).detail || 'Error');
    setEditId(null); load(); onChanged();
  };

  const del = async (u: Unit) => {
    if (!confirm(`¿Eliminar ${u.unit_name}?`)) return;
    const res = await fetch(`/api/admin/units/${u._id}`, { method: 'DELETE', headers: headers() });
    if (!res.ok) flash((await res.json()).detail || 'No se pudo eliminar');
    load(); onChanged();
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="bg-[#0d1526] border border-white/[0.1] rounded-2xl w-full max-w-3xl p-6 max-h-[90vh] overflow-y-auto space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-white font-bold text-lg flex items-center gap-2">
            <Layers className="w-5 h-5 text-cyan-400" /> Unidades — {propertyName}
          </h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        {err && <div className="p-2.5 bg-red-500/10 border border-red-500/25 rounded-lg text-red-400 text-xs">{err}</div>}

        {summary && summary.total > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
            <div className="p-2.5 bg-white/[0.03] border border-white/[0.06] rounded-xl"><div className="text-lg font-bold text-white">{summary.total}</div><div className="text-[10px] text-gray-500 uppercase font-bold">Unidades</div></div>
            <div className="p-2.5 bg-cyan-500/[0.06] border border-cyan-500/20 rounded-xl"><div className="text-lg font-bold text-cyan-300">{summary.rented}</div><div className="text-[10px] text-gray-500 uppercase font-bold">Rentadas</div></div>
            <div className="p-2.5 bg-emerald-500/[0.06] border border-emerald-500/20 rounded-xl"><div className="text-lg font-bold text-emerald-300">{summary.available}</div><div className="text-[10px] text-gray-500 uppercase font-bold">Disponibles</div></div>
            <div className="p-2.5 bg-white/[0.03] border border-white/[0.06] rounded-xl"><div className="text-sm font-bold text-white">{fmt(summary.monthly_income_current)}<span className="text-gray-600 text-[10px]"> / {fmt(summary.monthly_income_potential)}</span></div><div className="text-[10px] text-gray-500 uppercase font-bold">Ingreso/mes</div></div>
          </div>
        )}

        {/* Crear */}
        <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl space-y-3">
          <div className="flex gap-2">
            <button onClick={() => setMode('single')} className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${mode === 'single' ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30' : 'bg-white/[0.03] text-gray-500 border-white/[0.06]'}`}>+ Una unidad</button>
            <button onClick={() => setMode('bulk')} className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${mode === 'bulk' ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30' : 'bg-white/[0.03] text-gray-500 border-white/[0.06]'}`}>⚡ Generar en masa</button>
          </div>
          {mode === 'single' ? (
            <div className="flex flex-wrap gap-2">
              <input value={single.unit_name} onChange={e => setSingle({ ...single, unit_name: e.target.value })} placeholder="Nombre (ej. Apt 1)" className="flex-1 min-w-[120px] px-3 py-2 bg-[#0a1020]/60 border border-white/[0.08] rounded-lg text-white text-sm focus:border-cyan-500 focus:outline-none" />
              <input value={single.bedrooms} onChange={e => setSingle({ ...single, bedrooms: e.target.value })} placeholder="Hab" type="number" className="w-16 px-2 py-2 bg-[#0a1020]/60 border border-white/[0.08] rounded-lg text-white text-sm focus:border-cyan-500 focus:outline-none" />
              <input value={single.bathrooms} onChange={e => setSingle({ ...single, bathrooms: e.target.value })} placeholder="Baños" type="number" className="w-16 px-2 py-2 bg-[#0a1020]/60 border border-white/[0.08] rounded-lg text-white text-sm focus:border-cyan-500 focus:outline-none" />
              <input value={single.rent_amount} onChange={e => setSingle({ ...single, rent_amount: e.target.value })} placeholder="Renta $" type="number" className="w-24 px-2 py-2 bg-[#0a1020]/60 border border-white/[0.08] rounded-lg text-white text-sm focus:border-cyan-500 focus:outline-none" />
              <button onClick={create} disabled={busy || !single.unit_name} className="flex items-center gap-1.5 px-4 py-2 bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 rounded-lg text-xs font-bold hover:bg-cyan-500/25 transition disabled:opacity-40">
                {busy ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} Agregar
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2 items-center">
              <input value={bulk.prefix} onChange={e => setBulk({ ...bulk, prefix: e.target.value })} placeholder="Prefijo" className="w-20 px-2 py-2 bg-[#0a1020]/60 border border-white/[0.08] rounded-lg text-white text-sm focus:border-cyan-500 focus:outline-none" />
              <input value={bulk.bulk_count} onChange={e => setBulk({ ...bulk, bulk_count: e.target.value })} placeholder="Cantidad" type="number" className="w-24 px-2 py-2 bg-[#0a1020]/60 border border-white/[0.08] rounded-lg text-white text-sm focus:border-cyan-500 focus:outline-none" />
              <span className="text-[11px] text-gray-500">desde #</span>
              <input value={bulk.start_number} onChange={e => setBulk({ ...bulk, start_number: e.target.value })} type="number" className="w-16 px-2 py-2 bg-[#0a1020]/60 border border-white/[0.08] rounded-lg text-white text-sm focus:border-cyan-500 focus:outline-none" />
              <input value={bulk.rent_amount} onChange={e => setBulk({ ...bulk, rent_amount: e.target.value })} placeholder="Renta $ c/u" type="number" className="w-24 px-2 py-2 bg-[#0a1020]/60 border border-white/[0.08] rounded-lg text-white text-sm focus:border-cyan-500 focus:outline-none" />
              <button onClick={create} disabled={busy || !parseInt(bulk.bulk_count || '0')} className="flex items-center gap-1.5 px-4 py-2 bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 rounded-lg text-xs font-bold hover:bg-cyan-500/25 transition disabled:opacity-40">
                {busy ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} Generar
              </button>
              {parseInt(bulk.bulk_count || '0') > 0 && (
                <span className="text-[11px] text-gray-500 w-full">Se crearán: {bulk.prefix} {bulk.start_number} … {bulk.prefix} {parseInt(bulk.start_number || '1') + parseInt(bulk.bulk_count || '0') - 1}</span>
              )}
            </div>
          )}
        </div>

        {/* Lista */}
        {loading ? (
          <div className="flex justify-center py-8"><RefreshCw className="w-6 h-6 text-gray-500 animate-spin" /></div>
        ) : units.length === 0 ? (
          <p className="text-center text-gray-500 text-sm py-6">Esta propiedad no tiene unidades — funciona como casa individual.<br />Agrega unidades para convertirla en multi-unidad (dúplex, apartamentos).</p>
        ) : (
          <div className="border border-white/[0.06] rounded-xl overflow-hidden divide-y divide-white/[0.04]">
            {units.map(u => (
              <div key={u._id} className="flex flex-wrap items-center gap-2 px-3 py-2.5 hover:bg-white/[0.02]">
                {editId === u._id ? (
                  <>
                    <input value={editRow.unit_name} onChange={e => setEditRow({ ...editRow, unit_name: e.target.value })} className="w-24 px-2 py-1.5 bg-[#0a1020]/60 border border-cyan-500/40 rounded-lg text-white text-xs focus:outline-none" />
                    <input value={editRow.bedrooms} onChange={e => setEditRow({ ...editRow, bedrooms: e.target.value })} type="number" className="w-14 px-2 py-1.5 bg-[#0a1020]/60 border border-white/[0.08] rounded-lg text-white text-xs focus:outline-none" title="Habitaciones" />
                    <input value={editRow.bathrooms} onChange={e => setEditRow({ ...editRow, bathrooms: e.target.value })} type="number" className="w-14 px-2 py-1.5 bg-[#0a1020]/60 border border-white/[0.08] rounded-lg text-white text-xs focus:outline-none" title="Baños" />
                    <input value={editRow.rent_amount} onChange={e => setEditRow({ ...editRow, rent_amount: e.target.value })} type="number" className="w-20 px-2 py-1.5 bg-[#0a1020]/60 border border-white/[0.08] rounded-lg text-white text-xs focus:outline-none" title="Renta" />
                    <button onClick={saveEdit} className="p-1.5 text-emerald-400 hover:bg-emerald-500/10 rounded-lg"><Save className="w-4 h-4" /></button>
                    <button onClick={() => setEditId(null)} className="p-1.5 text-gray-500 hover:text-white"><X className="w-4 h-4" /></button>
                  </>
                ) : (
                  <>
                    <span className="font-bold text-sm text-white w-20 truncate">{u.unit_name}</span>
                    <span className="text-[11px] text-gray-500">{u.bedrooms}hab · {u.bathrooms}ba</span>
                    <span className="text-sm font-bold text-cyan-400">{fmt(u.rent_amount)}</span>
                    <select value={u.status} onChange={e => setStatus(u, e.target.value)}
                      className={`text-xs px-2 py-1 rounded-lg border border-white/[0.08] bg-[#0a1020]/60 focus:outline-none cursor-pointer ${STATUS_OPTS.find(s => s.value === u.status)?.cls || 'text-gray-400'}`}>
                      {STATUS_OPTS.map(s => <option key={s.value} value={s.value} className="bg-[#0d1526]">{s.label}</option>)}
                    </select>
                    {u.tenant_name && <span className="text-[11px] text-gray-400 truncate">👤 {u.tenant_name}</span>}
                    <div className="flex-1" />
                    <button onClick={() => { setEditId(u._id); setEditRow({ unit_name: u.unit_name, bedrooms: String(u.bedrooms || ''), bathrooms: String(u.bathrooms || ''), rent_amount: String(u.rent_amount || '') }); }}
                      className="p-1.5 text-gray-500 hover:text-cyan-400 rounded-lg"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => del(u)} className="p-1.5 text-gray-500 hover:text-red-400 rounded-lg"><Trash2 className="w-3.5 h-3.5" /></button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
