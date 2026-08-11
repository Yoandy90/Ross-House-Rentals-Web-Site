'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { X, Plus, Edit3, Trash2, Loader2, Landmark, Star, Phone, MapPin } from 'lucide-react';

export type TitleCompany = {
  id: string;
  name: string;
  escrow_officer?: string;
  phone?: string;
  fax?: string;
  email?: string;
  address?: string;
  bank_name?: string;
  routing_number?: string;
  account_number?: string;
  wire_notes?: string;
  is_default?: boolean;
};

const EMPTY_FORM = {
  name: '', escrow_officer: '', phone: '', fax: '', email: '', address: '',
  bank_name: '', routing_number: '', account_number: '', wire_notes: '', is_default: false,
};

export default function TitleCompaniesModal({ headers, onClose, onChanged }: {
  headers: () => Record<string, string>;
  onClose: () => void;
  onChanged?: (items: TitleCompany[]) => void;
}) {
  const [items, setItems] = useState<TitleCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null); // id | 'new' | null
  const [form, setForm] = useState<typeof EMPTY_FORM>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/admin/title-companies', { headers: headers() });
      const d = await r.json();
      if (r.ok) { setItems(d.items || []); onChanged?.(d.items || []); }
    } catch { /* noop */ }
    setLoading(false);
  }, [headers, onChanged]);

  useEffect(() => { load(); }, [load]);

  const startEdit = (c: TitleCompany) => {
    setEditing(c.id);
    setForm({
      name: c.name || '', escrow_officer: c.escrow_officer || '', phone: c.phone || '',
      fax: c.fax || '', email: c.email || '', address: c.address || '',
      bank_name: c.bank_name || '', routing_number: c.routing_number || '',
      account_number: c.account_number || '', wire_notes: c.wire_notes || '',
      is_default: !!c.is_default,
    });
    setError('');
  };

  const save = async () => {
    if (!form.name.trim()) { setError('El nombre es requerido'); return; }
    setSaving(true);
    setError('');
    try {
      const isNew = editing === 'new';
      const r = await fetch(isNew ? '/api/admin/title-companies' : `/api/admin/title-companies/${editing}`, {
        method: isNew ? 'POST' : 'PUT',
        headers: { ...headers(), 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) { setEditing(null); setForm(EMPTY_FORM); await load(); }
      else setError(d.detail || 'Error guardando');
    } catch { setError('Error de conexión'); }
    setSaving(false);
  };

  const remove = async (c: TitleCompany) => {
    if (!window.confirm(`¿Eliminar "${c.name}"?`)) return;
    try {
      const r = await fetch(`/api/admin/title-companies/${c.id}`, { method: 'DELETE', headers: headers() });
      if (r.ok) await load();
    } catch { /* noop */ }
  };

  const field = (label: string, k: keyof typeof EMPTY_FORM, placeholder?: string, span2?: boolean) => (
    <div className={span2 ? 'sm:col-span-2' : ''}>
      <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">{label}</label>
      <input
        value={String(form[k] ?? '')}
        onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))}
        placeholder={placeholder}
        className="w-full px-3 py-2 bg-black/30 border border-white/[0.08] rounded-lg text-xs text-white focus:border-amber-500/50 focus:outline-none placeholder:text-gray-600"
      />
    </div>
  );

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl max-h-[88vh] bg-[#0d1017] border border-white/[0.1] rounded-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.08]">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
              <Landmark className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <div className="text-sm font-bold text-white">Casas de Título</div>
              <div className="text-[10px] text-gray-500">Para cierres de compra — la default sale en los contratos</div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg bg-white/[0.05] text-gray-400 hover:text-white transition"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {loading ? (
            <div className="py-10 text-center"><Loader2 className="w-6 h-6 animate-spin text-gray-500 mx-auto" /></div>
          ) : (
            <>
              {items.map(c => (
                <div key={c.id} className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-white">{c.name}</span>
                        {c.is_default && (
                          <span className="text-[9px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 font-bold flex items-center gap-1">
                            <Star className="w-2.5 h-2.5" /> DEFAULT
                          </span>
                        )}
                      </div>
                      {c.escrow_officer && <div className="text-[11px] text-gray-400 mt-0.5">Escrow: {c.escrow_officer}</div>}
                      <div className="flex items-center gap-3 mt-1 text-[11px] text-gray-500 flex-wrap">
                        {c.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {c.phone}</span>}
                        {c.address && <span className="flex items-center gap-1 truncate"><MapPin className="w-3 h-3 shrink-0" /> {c.address}</span>}
                      </div>
                      {c.bank_name && (
                        <div className="text-[10px] text-gray-600 mt-1">
                          🏦 {c.bank_name} · ABA {c.routing_number || '—'} · Cta {c.account_number || '—'} (solo WIRE)
                        </div>
                      )}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => startEdit(c)} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-gray-500 hover:text-amber-400 transition" title="Editar"><Edit3 className="w-3.5 h-3.5" /></button>
                      <button onClick={() => remove(c)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-gray-500 hover:text-red-400 transition" title="Eliminar"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                </div>
              ))}

              {editing ? (
                <div className="bg-amber-500/[0.04] border border-amber-500/25 rounded-xl p-4 space-y-3">
                  <div className="text-xs font-bold text-amber-300">{editing === 'new' ? '➕ Nueva casa de título' : '✏️ Editar casa de título'}</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {field('Nombre *', 'name', 'Chicago Title of Texas, LLC', true)}
                    {field('Escrow Officer / Closer', 'escrow_officer', 'Shalmarie Permenter')}
                    {field('Teléfono', 'phone', '(806) 358-0893')}
                    {field('Email', 'email', 'closer@titulo.com')}
                    {field('Fax', 'fax')}
                    {field('Dirección', 'address', '4211 I-40 West, Suite 100, Amarillo, TX', true)}
                    {field('Banco (para wires)', 'bank_name', 'Amarillo National Bank')}
                    {field('ABA / Routing', 'routing_number', '111300958')}
                    {field('Número de cuenta', 'account_number', '203793')}
                    <div className="flex items-end pb-1">
                      <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
                        <input type="checkbox" checked={form.is_default}
                          onChange={e => setForm(f => ({ ...f, is_default: e.target.checked }))}
                          className="w-4 h-4 accent-amber-500" />
                        Usar como default en contratos
                      </label>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Notas de wire / seguridad</label>
                      <textarea value={form.wire_notes} onChange={e => setForm(f => ({ ...f, wire_notes: e.target.value }))}
                        rows={2} placeholder="Solo wire, verificar por teléfono antes de enviar fondos..."
                        className="w-full px-3 py-2 bg-black/30 border border-white/[0.08] rounded-lg text-xs text-white focus:border-amber-500/50 focus:outline-none resize-none placeholder:text-gray-600" />
                    </div>
                  </div>
                  {error && <div className="text-[11px] text-red-400">{error}</div>}
                  <div className="flex gap-2">
                    <button onClick={() => { setEditing(null); setForm(EMPTY_FORM); setError(''); }}
                      className="flex-1 py-2 rounded-lg border border-white/[0.1] text-xs text-gray-400 hover:bg-white/[0.04] font-bold transition">Cancelar</button>
                    <button onClick={save} disabled={saving}
                      className="flex-1 py-2 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-bold hover:bg-amber-500/30 transition disabled:opacity-50 flex items-center justify-center gap-1.5">
                      {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                      {editing === 'new' ? 'Agregar' : 'Guardar cambios'}
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={() => { setEditing('new'); setForm(EMPTY_FORM); setError(''); }}
                  className="w-full py-2.5 rounded-xl border border-dashed border-amber-500/30 text-amber-400 text-xs font-bold hover:bg-amber-500/[0.06] transition flex items-center justify-center gap-1.5">
                  <Plus className="w-3.5 h-3.5" /> Agregar casa de título
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
