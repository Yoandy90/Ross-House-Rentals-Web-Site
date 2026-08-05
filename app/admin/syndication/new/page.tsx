'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAdminAuth } from '../../layout';
import {
  Briefcase, ChevronLeft, Save, Plus, X, Building2, DollarSign, Target,
  TrendingUp, Calendar, Users, Image as ImageIcon,
} from 'lucide-react';

export default function NewDealPage() {
  const router = useRouter();
  const { headers } = useAdminAuth();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [highlightDraft, setHighlightDraft] = useState('');
  const [form, setForm] = useState<any>({
    name: '',
    property_address: '',
    property_type: 'multifamily',
    units: 0,
    status: 'draft',
    target_raise: 0,
    min_investment: 25000,
    max_investment: 0,
    lp_percent: 80,
    gp_percent: 20,
    preferred_return: 8,
    projected_irr: 0,
    projected_cash_on_cash: 0,
    hold_period_months: 60,
    description: '',
    highlights: [] as string[],
    cover_image: '',
    open_date: '',
    close_date: '',
  });

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const submit = async () => {
    setError('');
    if (!form.name.trim()) { setError('Nombre requerido'); return; }
    if (!form.target_raise || form.target_raise <= 0) { setError('Target raise debe ser > 0'); return; }
    if (!form.min_investment || form.min_investment <= 0) { setError('Inversión mínima debe ser > 0'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/admin/syndication/deals', {
        method: 'POST', headers: headers(), body: JSON.stringify(form),
      });
      if (res.ok) {
        const d = await res.json();
        router.push(`/admin/syndication/${d.deal.id}`);
      } else {
        const err = await res.json().catch(() => ({}));
        setError(err.detail || 'Error al crear deal');
      }
    } catch (e: any) {
      setError(e.message || 'Error de red');
    }
    setSaving(false);
  };

  const addHighlight = () => {
    if (highlightDraft.trim()) {
      set('highlights', [...form.highlights, highlightDraft.trim()]);
      setHighlightDraft('');
    }
  };

  const handleCoverUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setError('Imagen demasiado grande (máx 5MB)'); return; }
    const reader = new FileReader();
    reader.onload = () => set('cover_image', reader.result as string);
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-center gap-3">
        <Link href="/admin/syndication" className="p-2 bg-white/[0.03] border border-white/[0.06] rounded-xl text-gray-400 hover:text-white transition">
          <ChevronLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2"><Briefcase className="w-6 h-6 text-emerald-400" /> Nuevo Deal</h2>
          <p className="text-sm text-gray-500">Crea una nueva oferta de syndication para tus LPs</p>
        </div>
      </div>

      {error && <div className="bg-red-500/15 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-300">{error}</div>}

      <Section title="Información Básica" icon={Building2}>
        <Field label="Nombre del Deal *" hint="Ej: Jasmine Apartments LP - 142 Units">
          <input value={form.name} onChange={e => set('name', e.target.value)} className="input" />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Dirección"><input value={form.property_address} onChange={e => set('property_address', e.target.value)} className="input" placeholder="Calle, Ciudad, Estado" /></Field>
          <Field label="Tipo de Propiedad">
            <select value={form.property_type} onChange={e => set('property_type', e.target.value)} className="input">
              <option value="multifamily">Multifamily</option>
              <option value="single_family">Single Family</option>
              <option value="commercial">Commercial</option>
              <option value="mixed_use">Mixed Use</option>
              <option value="land">Land</option>
              <option value="other">Otro</option>
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Número de unidades"><input type="number" min="0" value={form.units} onChange={e => set('units', parseInt(e.target.value || '0'))} className="input" /></Field>
          <Field label="Estado inicial">
            <select value={form.status} onChange={e => set('status', e.target.value)} className="input">
              <option value="draft">Borrador (no visible)</option>
              <option value="open">Abierto a inversión</option>
              <option value="funded">Financiado</option>
              <option value="closed">Cerrado</option>
            </select>
          </Field>
        </div>
        <Field label="Descripción" hint="Resumen del deal (visible a inversionistas)">
          <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={4} className="input resize-y" />
        </Field>
      </Section>

      <Section title="Estructura Financiera" icon={DollarSign}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Capital objetivo *" hint="Target raise"><input type="number" min="0" step="1000" value={form.target_raise} onChange={e => set('target_raise', parseFloat(e.target.value || '0'))} className="input" /></Field>
          <Field label="Inversión mínima *"><input type="number" min="0" step="1000" value={form.min_investment} onChange={e => set('min_investment', parseFloat(e.target.value || '0'))} className="input" /></Field>
          <Field label="Inversión máxima"><input type="number" min="0" step="1000" value={form.max_investment} onChange={e => set('max_investment', parseFloat(e.target.value || '0'))} className="input" placeholder="(opcional)" /></Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="LP % (Limited Partners)"><input type="number" min="0" max="100" step="1" value={form.lp_percent} onChange={e => set('lp_percent', parseFloat(e.target.value || '0'))} className="input" /></Field>
          <Field label="GP % (General Partner)"><input type="number" min="0" max="100" step="1" value={form.gp_percent} onChange={e => set('gp_percent', parseFloat(e.target.value || '0'))} className="input" /></Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Preferred Return %"><input type="number" min="0" step="0.5" value={form.preferred_return} onChange={e => set('preferred_return', parseFloat(e.target.value || '0'))} className="input" /></Field>
          <Field label="IRR Proyectado %"><input type="number" min="0" step="0.5" value={form.projected_irr} onChange={e => set('projected_irr', parseFloat(e.target.value || '0'))} className="input" /></Field>
          <Field label="Cash-on-Cash %"><input type="number" min="0" step="0.5" value={form.projected_cash_on_cash} onChange={e => set('projected_cash_on_cash', parseFloat(e.target.value || '0'))} className="input" /></Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Período de hold (meses)"><input type="number" min="1" value={form.hold_period_months} onChange={e => set('hold_period_months', parseInt(e.target.value || '0'))} className="input" /></Field>
          <Field label="Fecha de apertura"><input type="date" value={form.open_date} onChange={e => set('open_date', e.target.value)} className="input" /></Field>
          <Field label="Fecha de cierre"><input type="date" value={form.close_date} onChange={e => set('close_date', e.target.value)} className="input" /></Field>
        </div>
      </Section>

      <Section title="Highlights" icon={Target}>
        <Field label="Puntos destacados (visibles al inversor)" hint="Bullet points cortos">
          <div className="flex gap-2">
            <input value={highlightDraft} onChange={e => setHighlightDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addHighlight(); } }} className="input flex-1" placeholder="Ej: Ubicación premium en Dumas, TX" />
            <button type="button" onClick={addHighlight} className="px-3 py-2 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded-xl text-sm font-bold hover:bg-emerald-500/25"><Plus className="w-4 h-4" /></button>
          </div>
        </Field>
        {form.highlights.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {form.highlights.map((h: string, i: number) => (
              <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 rounded-lg text-xs">
                {h}
                <button onClick={() => set('highlights', form.highlights.filter((_: any, j: number) => j !== i))}><X className="w-3 h-3" /></button>
              </span>
            ))}
          </div>
        )}
      </Section>

      <Section title="Imagen Portada" icon={ImageIcon}>
        {form.cover_image ? (
          <div className="relative">
            <img src={form.cover_image} alt="" className="w-full max-h-48 object-cover rounded-xl" />
            <button onClick={() => set('cover_image', '')} className="absolute top-2 right-2 p-1.5 bg-red-500/80 text-white rounded-lg"><X className="w-4 h-4" /></button>
          </div>
        ) : (
          <label className="flex flex-col items-center justify-center gap-2 p-8 bg-white/[0.02] border-2 border-dashed border-white/[0.08] rounded-xl cursor-pointer hover:border-emerald-500/30 transition">
            <ImageIcon className="w-8 h-8 text-gray-600" />
            <span className="text-sm text-gray-400">Click para subir imagen (max 5MB)</span>
            <input type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} />
          </label>
        )}
      </Section>

      <div className="flex items-center gap-3 sticky bottom-4 bg-[#0a1020]/95 backdrop-blur-md p-4 rounded-2xl border border-white/[0.08]">
        <Link href="/admin/syndication" className="px-4 py-2.5 bg-white/[0.03] border border-white/[0.08] rounded-xl text-sm text-gray-400 hover:text-white">Cancelar</Link>
        <div className="flex-1" />
        <button onClick={submit} disabled={saving} className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl text-sm font-bold hover:opacity-90 disabled:opacity-50 flex items-center gap-2">
          <Save className="w-4 h-4" /> {saving ? 'Guardando...' : 'Crear Deal'}
        </button>
      </div>

      <style>{`
        .input { width: 100%; padding: 10px 12px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; color: #fff; font-size: 14px; outline: none; transition: border 0.2s; }
        .input:focus { border-color: rgb(16, 185, 129); }
      `}</style>
    </div>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-2 pb-2 border-b border-white/[0.04]">
        <Icon className="w-4 h-4 text-emerald-400" />
        <h3 className="text-sm font-bold text-white tracking-wide">{title.toUpperCase()}</h3>
      </div>
      {children}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-bold text-gray-400 mb-1.5">{label}</label>
      {children}
      {hint && <div className="text-[10px] text-gray-600 mt-1">{hint}</div>}
    </div>
  );
}
