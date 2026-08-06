'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAdminAuth } from '../layout';
import {
  Home, Plus, Search, MapPin, DollarSign, Bed, Bath, Square,
  Edit3, Trash2, Eye, RefreshCw, CheckCircle2, Wrench, Clock,
  X, ChevronDown, ChevronUp, Save, Image as ImageIcon,
  Building2, Shield, Calendar as CalIcon, AlertTriangle, Layers,
} from 'lucide-react';
import UnitsManager from '../../components/admin/UnitsManager';

const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n);

const STATUS_MAP: Record<string, { label: string; color: string; bg: string; Icon: any }> = {
  available: { label: 'Disponible', color: 'text-emerald-400', bg: 'bg-emerald-500/10', Icon: CheckCircle2 },
  rented: { label: 'Alquilada', color: 'text-blue-400', bg: 'bg-blue-500/10', Icon: Home },
  maintenance: { label: 'Mantenimiento', color: 'text-amber-400', bg: 'bg-amber-500/10', Icon: Wrench },
  unavailable: { label: 'No Disponible', color: 'text-gray-400', bg: 'bg-gray-500/10', Icon: Clock },
};

const PHOTO_CATEGORIES = [
  { v: 'exterior', l: 'Exterior' }, { v: 'kitchen', l: 'Cocina' }, { v: 'bathroom', l: 'Baño' },
  { v: 'bedroom', l: 'Recámara' }, { v: 'living_room', l: 'Sala' }, { v: 'patio', l: 'Patio' },
  { v: 'garage', l: 'Garaje' }, { v: 'other', l: 'Otra' },
];

export default function PropiedadesPage() {
  const { headers } = useAdminAuth();
  const [properties, setProperties] = useState<any[]>([]);
  const [unitsProp, setUnitsProp] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', address: '', city: 'Dumas', state: 'TX', zip: '', type: 'house', bedrooms: '3', bathrooms: '2', sqft: '', rent_amount: '', deposit_amount: '', description: '', status: 'available', owner_id: '', section8_accepted: false, section8_pha: '', section8_pha_contact: '', section8_last_inspection: '', section8_next_inspection: '', section8_notes: '' });

  // ─── Owners list (for the assign-owner dropdown in form) ───
  const [owners, setOwners] = useState<Array<{ id: string; name: string; email: string }>>([]);
  const [showQuickOwner, setShowQuickOwner] = useState(false);
  const [quickOwner, setQuickOwner] = useState({ name: '', email: '', phone: '' });
  const [quickOwnerSaving, setQuickOwnerSaving] = useState(false);
  const fetchOwners = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/owners', { headers: headers() });
      if (res.ok) {
        const d = await res.json();
        setOwners((d.owners || []).map((o: any) => ({ id: o.id, name: o.name, email: o.email })));
      }
    } catch (e) { console.error(e); }
  }, [headers]);

  const createQuickOwner = async () => {
    if (!quickOwner.name.trim() || !quickOwner.email.trim()) {
      alert('Nombre y email son requeridos');
      return;
    }
    setQuickOwnerSaving(true);
    try {
      const res = await fetch('/api/admin/owners', {
        method: 'POST',
        headers: { ...headers(), 'Content-Type': 'application/json' },
        body: JSON.stringify(quickOwner),
      });
      const d = await res.json();
      if (!res.ok) { alert(d.detail || 'Error creando propietario'); return; }
      if (d.temp_password) {
        alert(`✅ Propietario creado.\n\nPassword temporal: ${d.temp_password}\n\nGuárdala — el propietario debe cambiarla en su primer login.`);
      }
      // Refresh owners list and pre-select the new one
      await fetchOwners();
      setForm((f) => ({ ...f, owner_id: d.owner_id }));
      setShowQuickOwner(false);
      setQuickOwner({ name: '', email: '', phone: '' });
    } catch (e: any) {
      alert(e?.message || 'Error de red');
    }
    setQuickOwnerSaving(false);
  };

  // ─── Section 8 NOI Impact (Sprint S8 #2) ───
  const [s8Summary, setS8Summary] = useState<any>(null);
  const [editImpact, setEditImpact] = useState<any>(null);
  const [s8Inspections, setS8Inspections] = useState<any>(null);

  const fetchS8Summary = useCallback(async () => {
    try {
      const [r1, r2] = await Promise.all([
        fetch('/api/admin/properties/s8-impact-summary', { headers: headers() }),
        fetch('/api/admin/section8/inspections', { headers: headers() }),
      ]);
      if (r1.ok) setS8Summary(await r1.json());
      if (r2.ok) setS8Inspections(await r2.json());
    } catch (e) { console.error('s8-summary error', e); }
  }, [headers]);

  // Recalculate impact on the fly while editing the form (uses backend live)
  useEffect(() => {
    if (!showForm || !form.city || !form.bedrooms || !form.rent_amount) {
      setEditImpact(null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const qs = new URLSearchParams({ city: form.city, bedrooms: String(form.bedrooms), rent: String(form.rent_amount) });
        // Use single-property endpoint if editing, otherwise simulate using city+bedrooms
        if (editing?._id) {
          const res = await fetch(`/api/admin/properties/${editing._id}/s8-impact`, { headers: headers() });
          if (res.ok && !cancelled) {
            const d = await res.json();
            // Recompute against current form (which may differ from saved)
            const monthly = Math.max(0, (d.fmr?.fmr_amount || 0) - parseFloat(form.rent_amount || '0'));
            setEditImpact({
              ...d.impact,
              fmr_amount: d.fmr?.fmr_amount || 0,
              msa: d.fmr?.msa_display,
              monthly_uplift: Math.round(monthly * 100) / 100,
              annual_uplift: Math.round(monthly * 12 * 100) / 100,
            });
          }
        }
      } catch (e) { /* silent */ }
    }, 400);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [showForm, form.city, form.bedrooms, form.rent_amount, editing, headers]);

  useEffect(() => { fetchS8Summary(); }, [fetchS8Summary]);

  const fetchProps = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/properties', { headers: headers() });
      if (res.ok) { const data = await res.json(); setProperties(data.properties || []); }
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchProps(); fetchOwners(); }, [fetchProps, fetchOwners]);

  const resetForm = () => {
    setForm({ name: '', address: '', city: 'Dumas', state: 'TX', zip: '', type: 'house', bedrooms: '3', bathrooms: '2', sqft: '', rent_amount: '', deposit_amount: '', description: '', status: 'available', owner_id: '', section8_accepted: false, section8_pha: '', section8_pha_contact: '', section8_last_inspection: '', section8_next_inspection: '', section8_notes: '' });
    setEditing(null); setShowForm(false);
  };

  const startEdit = (p: any) => {
    setForm({
      name: p.name || '', address: p.address || '', city: p.city || 'Dumas', state: p.state || 'TX',
      zip: p.zip || p.zip_code || '', type: p.type || 'house',
      bedrooms: String(p.bedrooms || 3), bathrooms: String(p.bathrooms || 2),
      sqft: String(p.sqft || p.square_feet || ''),
      rent_amount: String(p.rent_amount || ''), deposit_amount: String(p.deposit_amount || ''),
      description: p.description || '', status: p.status || 'available',
      owner_id: p.owner_id || '',
      tax_account_id: p.tax_account_id || '',
      tax_annual_estimate: p.tax_annual_estimate ? String(p.tax_annual_estimate) : '',
      section8_accepted: !!p.section8_accepted,
      section8_pha: p.section8_pha || '',
      section8_pha_contact: p.section8_pha_contact || '',
      section8_last_inspection: p.section8_last_inspection ? String(p.section8_last_inspection).slice(0, 10) : '',
      section8_next_inspection: p.section8_next_inspection ? String(p.section8_next_inspection).slice(0, 10) : '',
      section8_notes: p.section8_notes || '',
    });
    setEditing(p); setShowForm(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const body = { ...form, bedrooms: parseInt(form.bedrooms) || 3, bathrooms: parseInt(form.bathrooms) || 2, sqft: parseInt(form.sqft) || 0, rent_amount: parseFloat(form.rent_amount) || 0, deposit_amount: parseFloat(form.deposit_amount) || 0, tax_annual_estimate: parseFloat(form.tax_annual_estimate) || 0 };
      const url = editing ? `/api/admin/properties/${editing._id}` : '/api/admin/properties';
      const method = editing ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: headers(), body: JSON.stringify(body) });
      if (res.ok) {
        const result = await res.json().catch(() => null);
        const newPropId = editing ? editing._id : result?.property_id;
        // If editing and owner changed, call assign-owner endpoint
        if (editing && newPropId && form.owner_id !== (editing.owner_id || '')) {
          await fetch(`/api/admin/properties/${newPropId}/assign-owner`, {
            method: 'PATCH', headers: headers(), body: JSON.stringify({ owner_id: form.owner_id || null }),
          });
        }
        resetForm(); fetchProps();
      }
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta propiedad?')) return;
    await fetch(`/api/admin/properties/${id}`, { method: 'DELETE', headers: headers() });
    fetchProps();
  };

  // ─── Property Photos (edit mode) ───
  const [photos, setPhotos] = useState<any[]>([]);
  const [photosLoading, setPhotosLoading] = useState(false);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const photoSrc = (ph: any) => ph.url || `/api/public/property-file/${String(ph.storage_path || '').replace('ross-rentals/', '')}`;

  const fetchPhotos = useCallback(async (propId: string) => {
    setPhotosLoading(true);
    try {
      const res = await fetch(`/api/admin/properties/${propId}/photos`, { headers: headers() });
      if (res.ok) { const d = await res.json(); setPhotos(d.photos || []); }
    } catch (e) { console.error(e); }
    setPhotosLoading(false);
  }, [headers]);

  useEffect(() => {
    if (editing?._id) fetchPhotos(editing._id); else setPhotos([]);
  }, [editing, fetchPhotos]);

  const handlePhotoUpload = async (files: FileList | null) => {
    if (!files || files.length === 0 || !editing?._id) return;
    setUploadingPhotos(true);
    for (const file of Array.from(files)) {
      try {
        const b64: string = await new Promise((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(String(r.result));
          r.onerror = reject;
          r.readAsDataURL(file);
        });
        const res = await fetch(`/api/admin/properties/${editing._id}/photos`, {
          method: 'POST', headers: headers(),
          body: JSON.stringify({ image_data: b64, filename: file.name, content_type: file.type || 'image/jpeg', category: 'other', caption: '' }),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => null);
          alert(d?.detail || `Error subiendo ${file.name}`);
        }
      } catch (e) { console.error(e); }
    }
    await fetchPhotos(editing._id);
    fetchProps();
    setUploadingPhotos(false);
  };

  const handlePhotoDelete = async (fileId: string) => {
    if (!editing?._id || !confirm('¿Eliminar esta foto?')) return;
    await fetch(`/api/admin/properties/${editing._id}/photos/${fileId}`, { method: 'DELETE', headers: headers() });
    await fetchPhotos(editing._id);
    fetchProps();
  };

  const handlePhotoMeta = async (fileId: string, fields: { category?: string; caption?: string }) => {
    if (!editing?._id) return;
    setPhotos(prev => prev.map(p => (p.file_id === fileId ? { ...p, ...fields } : p)));
    try {
      await fetch(`/api/admin/properties/${editing._id}/photos/${fileId}`, {
        method: 'PUT', headers: headers(), body: JSON.stringify(fields),
      });
    } catch (e) { console.error(e); }
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

      {/* ─── Section 8 Inspections Alert ─── */}
      {s8Inspections && (s8Inspections.counts.overdue > 0 || s8Inspections.counts.urgent > 0 || s8Inspections.counts.soon > 0) && (
        <div className="relative overflow-hidden bg-gradient-to-br from-red-500/[0.08] via-amber-500/[0.04] to-transparent rounded-2xl border border-red-500/30 p-4 backdrop-blur-sm">
          <div className="flex items-start gap-3 flex-wrap">
            <div className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-red-400" />
            </div>
            <div className="flex-1 min-w-[200px]">
              <h4 className="text-sm font-bold text-white">🏛️ Inspecciones HQS pendientes</h4>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {s8Inspections.counts.overdue > 0 && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/30 font-bold">
                    ⚠️ {s8Inspections.counts.overdue} VENCIDA{s8Inspections.counts.overdue === 1 ? '' : 'S'}
                  </span>
                )}
                {s8Inspections.counts.urgent > 0 && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-500/15 text-red-300 border border-red-500/25 font-bold">
                    🔴 {s8Inspections.counts.urgent} en ≤7 días
                  </span>
                )}
                {s8Inspections.counts.soon > 0 && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/25 font-bold">
                    🟡 {s8Inspections.counts.soon} en ≤15 días
                  </span>
                )}
              </div>
            </div>
          </div>
          {/* List urgent properties */}
          {s8Inspections.inspections && s8Inspections.inspections.length > 0 && (
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {s8Inspections.inspections.filter((i: any) => ['overdue','urgent','soon'].includes(i.urgency)).slice(0, 6).map((ins: any) => (
                <div key={ins.property_id} className={`p-2.5 rounded-lg border ${
                  ins.urgency === 'overdue' ? 'bg-red-500/[0.08] border-red-500/30' :
                  ins.urgency === 'urgent' ? 'bg-red-500/[0.05] border-red-500/20' :
                  'bg-amber-500/[0.05] border-amber-500/20'
                }`}>
                  <div className="text-xs font-bold text-white truncate">{ins.name || ins.address}</div>
                  <div className="text-[10px] text-gray-500 truncate">{ins.section8_pha || '—'}</div>
                  <div className={`text-[11px] font-bold mt-1 ${
                    ins.urgency === 'overdue' ? 'text-red-300' :
                    ins.urgency === 'urgent' ? 'text-red-300' : 'text-amber-300'
                  }`}>
                    {ins.urgency === 'overdue'
                      ? `🚨 Venció hace ${Math.abs(ins.days_until)} días`
                      : `📅 En ${ins.days_until} días (${ins.section8_next_inspection})`}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── Section 8 Portfolio Impact Banner ─── */}
      {s8Summary && s8Summary.totals && s8Summary.totals.total_potential_annual > 0 && (
        <div className="relative overflow-hidden bg-gradient-to-br from-emerald-500/[0.08] via-white/[0.02] to-emerald-500/[0.04] rounded-2xl border border-emerald-500/25 p-5 backdrop-blur-sm">
          <div className="absolute -top-8 -right-8 w-40 h-40 bg-emerald-500/[0.10] rounded-full blur-3xl pointer-events-none" />
          <div className="relative flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-3 flex-1 min-w-[250px]">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
                <Building2 className="w-6 h-6 text-emerald-400" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-base font-bold text-white">Section 8 — Oportunidad de NOI sin explotar</h3>
                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-bold uppercase tracking-wider">
                    💰 Dinero en la mesa
                  </span>
                </div>
                <p className="text-xs text-gray-400 leading-relaxed">
                  {s8Summary.totals.eligible_for_uplift} de {s8Summary.totals.property_count} propiedad{s8Summary.totals.property_count === 1 ? '' : 'es'} podría
                  generar más NOI activando Section 8. El FMR de HUD está sobre tu renta actual.
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-emerald-400 leading-none">
                +${s8Summary.totals.total_potential_annual.toLocaleString()}
              </div>
              <div className="text-[11px] text-gray-500 mt-1">potencial anual</div>
              <div className="text-[10px] text-gray-500">+${s8Summary.totals.total_potential_monthly.toLocaleString()}/mes</div>
            </div>
          </div>

          {s8Summary.top_opportunities && s8Summary.top_opportunities.length > 0 && (
            <div className="relative mt-4 pt-4 border-t border-emerald-500/15">
              <div className="text-[10px] font-bold text-emerald-300/80 uppercase tracking-wider mb-2">⭐ Top oportunidades</div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {s8Summary.top_opportunities.map((opp: any) => (
                  <div key={opp.property_id} className="bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-white truncate">{opp.name || opp.address}</div>
                        <div className="text-[10px] text-gray-500 truncate">
                          {opp.bedrooms}BR · {opp.msa} · ${opp.current_rent.toLocaleString()} → ${opp.fmr_amount.toLocaleString()}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-sm font-bold text-emerald-400">+${opp.annual_uplift.toLocaleString()}</div>
                        <div className="text-[9px] text-gray-500">+{opp.pct_uplift}%</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

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

            {/* ─── Propietario ─── */}
            <div className="md:col-span-2">
              <label className="block text-[11px] font-bold text-gray-400 mb-1">Propietario</label>
              <div className="flex gap-2">
                <select
                  value={form.owner_id}
                  onChange={(e) => {
                    if (e.target.value === '__NEW__') { setShowQuickOwner(true); }
                    else { setForm({ ...form, owner_id: e.target.value }); }
                  }}
                  className="flex-1 px-3 py-2.5 bg-[#0a1020]/60 border border-white/[0.08] rounded-xl text-white text-sm focus:border-cyan-500 focus:outline-none"
                >
                  <option value="">Sin propietario asignado</option>
                  {owners.map((o) => (
                    <option key={o.id} value={o.id}>{o.name} — {o.email}</option>
                  ))}
                  <option value="__NEW__">➕  Crear nuevo propietario...</option>
                </select>
              </div>
              {form.owner_id && (
                <p className="text-[10px] text-emerald-400 mt-1">
                  ✓ Asignado a {owners.find((o) => o.id === form.owner_id)?.name || '—'}
                </p>
              )}
            </div>
            <Select label="Tipo" value={form.type} onChange={v => setForm({...form, type: v})} options={[{v:'house',l:'Casa'},{v:'apartment',l:'Apartamento'},{v:'duplex',l:'Duplex'},{v:'mobile_home',l:'Mobile Home'},{v:'commercial',l:'Comercial'}]} />
            <Select label="Estado" value={form.status} onChange={v => setForm({...form, status: v})} options={[{v:'available',l:'Disponible'},{v:'rented',l:'Alquilada'},{v:'maintenance',l:'Mantenimiento'},{v:'unavailable',l:'No Disponible'}]} />
            <Input label="Habitaciones" value={form.bedrooms} onChange={v => setForm({...form, bedrooms: v})} type="number" />
            <Input label="Baños" value={form.bathrooms} onChange={v => setForm({...form, bathrooms: v})} type="number" />
            <Input label="Sq Ft" value={form.sqft} onChange={v => setForm({...form, sqft: v})} type="number" />
            <Input label="Renta Mensual ($)" value={form.rent_amount} onChange={v => setForm({...form, rent_amount: v})} type="number" required />
            <Input label="Depósito ($)" value={form.deposit_amount} onChange={v => setForm({...form, deposit_amount: v})} type="number" />
            <Input label="Cuenta Impuestos (Moore County)" value={form.tax_account_id} onChange={v => setForm({...form, tax_account_id: v})} placeholder="ej. 13572" />
            <Input label="Impuesto anual estimado ($)" value={form.tax_annual_estimate} onChange={v => setForm({...form, tax_annual_estimate: v})} type="number" placeholder="ej. 3317" />
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="block text-xs font-bold text-gray-400 mb-1 uppercase tracking-wider">Descripción</label>
              <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="w-full px-4 py-2.5 bg-[#0a1020]/60 border border-white/[0.08] rounded-xl text-white text-sm focus:border-cyan-500 focus:outline-none h-16 resize-none placeholder:text-gray-600" />
            </div>

            {/* ─── Section 8 (Housing Choice Voucher) ─── */}
            <div className="sm:col-span-2 lg:col-span-3 mt-2 pt-4 border-t border-white/[0.06]">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${form.section8_accepted ? 'bg-emerald-500/15 border-emerald-500/30' : 'bg-white/[0.03] border-white/[0.08]'}`}>
                    <Building2 className={`w-4 h-4 ${form.section8_accepted ? 'text-emerald-400' : 'text-gray-500'}`} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">Section 8 / Housing Choice Voucher</h4>
                    <p className="text-[10px] text-gray-500">Acepta inquilinos con voucher HUD — pago garantizado mensual</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, section8_accepted: !form.section8_accepted })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${form.section8_accepted ? 'bg-emerald-500' : 'bg-gray-700'}`}
                  aria-label="Toggle Section 8"
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${form.section8_accepted ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>

              {/* Live S8 Impact Calculator */}
              {!form.section8_accepted && editImpact && editImpact.fmr_amount > 0 && (
                <div className={`mb-3 p-3 rounded-xl border ${
                  editImpact.recommendation === 'excellent' ? 'bg-emerald-500/[0.06] border-emerald-500/30' :
                  editImpact.recommendation === 'good' ? 'bg-sky-500/[0.06] border-sky-500/30' :
                  editImpact.recommendation === 'marginal' ? 'bg-amber-500/[0.06] border-amber-500/30' :
                  editImpact.recommendation === 'no_upside' ? 'bg-gray-500/[0.06] border-gray-500/30' :
                  'bg-white/[0.03] border-white/[0.08]'
                }`}>
                  <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        editImpact.recommendation === 'excellent' ? 'bg-emerald-500/20' :
                        editImpact.recommendation === 'good' ? 'bg-sky-500/20' :
                        editImpact.recommendation === 'marginal' ? 'bg-amber-500/20' :
                        'bg-gray-500/20'
                      }`}>
                        <DollarSign className={`w-4 h-4 ${
                          editImpact.recommendation === 'excellent' ? 'text-emerald-300' :
                          editImpact.recommendation === 'good' ? 'text-sky-300' :
                          editImpact.recommendation === 'marginal' ? 'text-amber-300' :
                          'text-gray-400'
                        }`} />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white">📊 S8 NOI Impact Calculator</div>
                        <div className="text-[10px] text-gray-500">FMR de {editImpact.msa} · {form.bedrooms} BR</div>
                      </div>
                    </div>
                    {editImpact.monthly_uplift > 0 && (
                      <div className="text-right">
                        <div className={`text-xl font-bold ${
                          editImpact.recommendation === 'excellent' ? 'text-emerald-400' : 'text-sky-400'
                        }`}>+${editImpact.annual_uplift.toLocaleString()}<span className="text-xs font-normal text-gray-500">/año</span></div>
                        <div className="text-[10px] text-gray-500">+${editImpact.monthly_uplift}/mes · +{editImpact.pct_uplift}%</div>
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    <div className="bg-white/[0.03] rounded-lg px-2 py-1.5 text-center">
                      <div className="text-[9px] text-gray-500 uppercase tracking-wider">Renta actual</div>
                      <div className="text-sm font-bold text-white">${parseFloat(form.rent_amount || '0').toLocaleString()}</div>
                    </div>
                    <div className="bg-emerald-500/10 rounded-lg px-2 py-1.5 text-center">
                      <div className="text-[9px] text-emerald-300/80 uppercase tracking-wider">FMR HUD</div>
                      <div className="text-sm font-bold text-emerald-300">${editImpact.fmr_amount.toLocaleString()}</div>
                    </div>
                    <div className={`rounded-lg px-2 py-1.5 text-center ${editImpact.monthly_uplift > 0 ? 'bg-amber-500/10' : 'bg-gray-500/10'}`}>
                      <div className={`text-[9px] uppercase tracking-wider ${editImpact.monthly_uplift > 0 ? 'text-amber-300/80' : 'text-gray-500'}`}>Uplift/mes</div>
                      <div className={`text-sm font-bold ${editImpact.monthly_uplift > 0 ? 'text-amber-300' : 'text-gray-400'}`}>${editImpact.monthly_uplift}</div>
                    </div>
                  </div>
                  <p className="text-[11px] text-gray-300 leading-relaxed">
                    {editImpact.recommendation_text}
                  </p>
                </div>
              )}

              {form.section8_accepted && (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4 bg-emerald-500/[0.03] border border-emerald-500/15 rounded-xl">
                  <div>
                    <label className="block text-[11px] font-bold text-gray-400 mb-1 uppercase tracking-wider">Public Housing Authority (PHA)</label>
                    <select
                      value={form.section8_pha}
                      onChange={e => setForm({ ...form, section8_pha: e.target.value })}
                      className="w-full px-3 py-2 bg-[#0a1020]/60 border border-white/[0.08] rounded-lg text-white text-sm focus:border-emerald-500 focus:outline-none"
                    >
                      <option value="">— Selecciona PHA —</option>
                      <option value="Amarillo Housing Authority">Amarillo HA (Dumas / Jasmine)</option>
                      <option value="Houston Housing Authority">Houston HA</option>
                      <option value="Dallas Housing Authority">Dallas HA</option>
                      <option value="HACA Austin">Housing Authority of Austin (HACA)</option>
                      <option value="Fort Worth Housing Solutions">Fort Worth Housing Solutions</option>
                      <option value="SAHA San Antonio">SAHA / Opportunity Home (San Antonio)</option>
                      <option value="Tarrant County HAO">Tarrant County HAO</option>
                      <option value="TDHCA Statewide">TDHCA (Statewide)</option>
                      <option value="Other">Otra</option>
                    </select>
                  </div>
                  <Input
                    label="Contacto Landlord Liaison"
                    value={form.section8_pha_contact}
                    onChange={v => setForm({ ...form, section8_pha_contact: v })}
                    placeholder="Nombre / Teléfono"
                  />
                  <div /> {/* spacer */}
                  <div>
                    <label className="block text-[11px] font-bold text-gray-400 mb-1 uppercase tracking-wider">Última Inspección HQS</label>
                    <input
                      type="date"
                      value={form.section8_last_inspection}
                      onChange={e => setForm({ ...form, section8_last_inspection: e.target.value })}
                      className="w-full px-3 py-2 bg-[#0a1020]/60 border border-white/[0.08] rounded-lg text-white text-sm focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-400 mb-1 uppercase tracking-wider">Próxima Inspección</label>
                    <input
                      type="date"
                      value={form.section8_next_inspection}
                      onChange={e => setForm({ ...form, section8_next_inspection: e.target.value })}
                      className="w-full px-3 py-2 bg-[#0a1020]/60 border border-white/[0.08] rounded-lg text-white text-sm focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div /> {/* spacer */}
                  <div className="sm:col-span-2 lg:col-span-3">
                    <label className="block text-[11px] font-bold text-gray-400 mb-1 uppercase tracking-wider">Notas / Voucher info</label>
                    <textarea
                      value={form.section8_notes}
                      onChange={e => setForm({ ...form, section8_notes: e.target.value })}
                      placeholder="Voucher number, fechas claves, comentarios del inspector..."
                      className="w-full px-3 py-2 bg-[#0a1020]/60 border border-white/[0.08] rounded-lg text-white text-sm focus:border-emerald-500 focus:outline-none h-14 resize-none placeholder:text-gray-600"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* ─── Fotos de la propiedad (solo al editar) ─── */}
            {editing && (
              <div className="sm:col-span-2 lg:col-span-3 mt-2 pt-4 border-t border-white/[0.06]">
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                      <ImageIcon className="w-4 h-4 text-cyan-400" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">Fotos de la propiedad</h4>
                      <p className="text-[10px] text-gray-500">{photos.length} foto(s) · se optimizan automáticamente (1920px, JPEG) · la primera se usa como portada</p>
                    </div>
                  </div>
                  <label className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer transition ${uploadingPhotos ? 'bg-gray-500/10 text-gray-500 cursor-wait' : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/20'}`}>
                    {uploadingPhotos ? (
                      <><div className="w-4 h-4 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" /> Subiendo...</>
                    ) : (
                      <><Plus className="w-4 h-4" /> Subir fotos</>
                    )}
                    <input
                      type="file" accept="image/*" multiple className="hidden" disabled={uploadingPhotos}
                      onChange={e => { handlePhotoUpload(e.target.files); e.target.value = ''; }}
                    />
                  </label>
                </div>

                {photosLoading ? (
                  <div className="flex items-center justify-center py-8"><div className="w-6 h-6 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" /></div>
                ) : photos.length === 0 ? (
                  <div className="text-center py-8 bg-white/[0.02] border border-dashed border-white/[0.08] rounded-xl">
                    <ImageIcon className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                    <p className="text-xs text-gray-500">Sin fotos aún — sube la primera</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {photos.map((ph: any) => (
                      <div key={ph.file_id} className="bg-white/[0.03] border border-white/[0.08] rounded-xl overflow-hidden group">
                        <div className="relative h-28">
                          <img src={photoSrc(ph)} alt={ph.caption || ph.filename || 'Foto'} className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => handlePhotoDelete(ph.file_id)}
                            className="absolute top-1.5 right-1.5 w-7 h-7 rounded-lg bg-black/60 backdrop-blur flex items-center justify-center text-red-400 opacity-0 group-hover:opacity-100 transition hover:bg-red-500/30"
                            title="Eliminar foto"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          {ph.is_legacy && (
                            <span className="absolute bottom-1.5 left-1.5 text-[9px] px-1.5 py-0.5 rounded bg-black/60 text-gray-300">Existente</span>
                          )}
                        </div>
                        {!ph.is_legacy && (
                          <div className="p-2 space-y-1.5">
                            <select
                              value={ph.category || 'other'}
                              onChange={e => handlePhotoMeta(ph.file_id, { category: e.target.value })}
                              className="w-full px-2 py-1 bg-[#0a1020]/60 border border-white/[0.08] rounded-lg text-[11px] text-white focus:border-cyan-500 focus:outline-none"
                            >
                              {PHOTO_CATEGORIES.map(c => <option key={c.v} value={c.v}>{c.l}</option>)}
                            </select>
                            <input
                              type="text"
                              defaultValue={ph.caption || ''}
                              placeholder="Descripción..."
                              onBlur={e => { if (e.target.value !== (ph.caption || '')) handlePhotoMeta(ph.file_id, { caption: e.target.value }); }}
                              className="w-full px-2 py-1 bg-[#0a1020]/60 border border-white/[0.08] rounded-lg text-[11px] text-white focus:border-cyan-500 focus:outline-none placeholder:text-gray-600"
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
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
            // Get the first photo URL - remove ross-rentals/ prefix if present
            const photoPath = p.photos?.[0] || '';
            const cleanPath = photoPath.replace('ross-rentals/', '');
            const photoUrl = cleanPath ? `/api/public/property-file/${cleanPath}` : '';
            
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
                  {p.section8_accepted && (
                    <span
                      className="absolute top-2 left-2 text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1 backdrop-blur-sm"
                      title={p.section8_pha ? `Section 8 — ${p.section8_pha}` : 'Section 8 aceptada'}
                    >
                      <Building2 className="w-3 h-3" /> S8
                    </span>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-bold text-sm text-white mb-1 truncate">{p.name}</h3>
                  <p className="text-[11px] text-gray-500 flex items-center gap-1 mb-3"><MapPin className="w-3 h-3" /> {p.address}{p.city ? `, ${p.city}` : ''}</p>
                  <div className="flex items-center gap-3 text-[11px] text-gray-500 mb-3">
                    <span className="flex items-center gap-1"><Bed className="w-3 h-3" /> {p.bedrooms || 0}</span>
                    <span className="flex items-center gap-1"><Bath className="w-3 h-3" /> {p.bathrooms || 0}</span>
                    {p.sqft > 0 && <span className="flex items-center gap-1"><Square className="w-3 h-3" /> {p.sqft} ft²</span>}
                    {p.is_multi_unit && (
                      <span className="flex items-center gap-1 text-cyan-400 font-bold" title={`${p.units_rented || 0} de ${p.units_count || 0} unidades ocupadas`}>
                        <Layers className="w-3 h-3" /> {p.units_rented || 0}/{p.units_count || 0}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-lg font-bold text-cyan-400">{fmt(p.rent_amount || 0)}<span className="text-[10px] text-gray-600 font-normal">/mes</span></div>
                    <div className="flex gap-1">
                      <button onClick={() => setUnitsProp(p)} title="Unidades (multi-unidad)" className="p-1.5 rounded-lg hover:bg-cyan-500/10 text-gray-500 hover:text-cyan-400 transition"><Layers className="w-3.5 h-3.5" /></button>
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

      {/* Units manager modal */}
      {unitsProp && (
        <UnitsManager propertyId={unitsProp._id} propertyName={unitsProp.name || unitsProp.address || 'Propiedad'}
          headers={headers} onClose={() => setUnitsProp(null)} onChanged={fetchProps} />
      )}

      {/* Quick-create owner modal (used inside form) */}
      {showQuickOwner && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60] flex items-center justify-center p-4" onClick={() => setShowQuickOwner(false)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-gray-900 border border-white/10 rounded-2xl p-6 max-w-md w-full">
            <h3 className="text-lg font-bold text-white mb-4">Nuevo propietario rápido</h3>
            <div className="space-y-3">
              <Input label="Nombre completo" value={quickOwner.name} onChange={(v: string) => setQuickOwner({ ...quickOwner, name: v })} placeholder="Juan Pérez" required />
              <Input label="Email" value={quickOwner.email} onChange={(v: string) => setQuickOwner({ ...quickOwner, email: v })} placeholder="juan@example.com" type="email" required />
              <Input label="Teléfono" value={quickOwner.phone} onChange={(v: string) => setQuickOwner({ ...quickOwner, phone: v })} placeholder="+1 555 555 5555" />
              <p className="text-[11px] text-gray-500">Se generará una password temporal. Para más campos (LLC, EIN, dirección), usa la página completa de Propietarios.</p>
              <div className="flex gap-2 pt-2">
                <button onClick={() => setShowQuickOwner(false)} className="flex-1 py-2.5 bg-white/5 border border-white/10 rounded-xl text-gray-300 text-sm font-bold hover:bg-white/10 transition">
                  Cancelar
                </button>
                <button onClick={createQuickOwner} disabled={quickOwnerSaving}
                  className="flex-1 py-2.5 bg-purple-500 hover:bg-purple-600 rounded-xl text-white text-sm font-bold transition disabled:opacity-50">
                  {quickOwnerSaving ? 'Creando...' : 'Crear y asignar'}
                </button>
              </div>
            </div>
          </div>
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
