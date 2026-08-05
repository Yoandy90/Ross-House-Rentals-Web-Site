'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useAdminAuth } from '../layout';
import {
  ShieldAlert, ShieldCheck, ShieldQuestion, ShieldOff,
  Building2, User, RefreshCw, Save, AlertTriangle, MapPin,
  FileDown, Sparkles,
} from 'lucide-react';

type Comparison = {
  property_owner: string;
  utility_holder: string;
  match: boolean;
  risk_level: 'none' | 'low' | 'medium' | 'high';
  recommendation: string;
};

type AlignmentItem = {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  status: string;
  owner_entity: 'personal' | 'llc' | 'unknown';
  owner_display_name: string;
  utility_account_holder: 'personal' | 'llc' | 'unknown';
  utility_account_holder_name: string;
  comparison: Comparison;
};

type AlignmentResponse = {
  properties: AlignmentItem[];
  summary: { high: number; medium: number; low: number; none: number; total: number };
  legend: Record<string, string>;
};

const RISK_STYLES: Record<string, { bg: string; border: string; text: string; Icon: any; label: string }> = {
  high:   { bg: 'bg-red-500/10',     border: 'border-red-500/40',     text: 'text-red-400',     Icon: ShieldAlert,    label: 'RIESGO ALTO' },
  medium: { bg: 'bg-amber-500/10',   border: 'border-amber-500/40',   text: 'text-amber-400',   Icon: AlertTriangle,  label: 'Mismatch inusual' },
  low:    { bg: 'bg-slate-500/10',   border: 'border-slate-500/40',   text: 'text-slate-400',   Icon: ShieldQuestion, label: 'Falta info' },
  none:   { bg: 'bg-emerald-500/10', border: 'border-emerald-500/40', text: 'text-emerald-400', Icon: ShieldCheck,    label: 'COHERENTE' },
};

function EntityChip({ entity, name }: { entity: string; name: string }) {
  const isLLC = entity === 'llc';
  const isPersonal = entity === 'personal';
  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold ${
      isLLC ? 'bg-violet-500/15 text-violet-300 border border-violet-500/30' :
      isPersonal ? 'bg-sky-500/15 text-sky-300 border border-sky-500/30' :
      'bg-slate-500/15 text-slate-400 border border-slate-500/30'
    }`}>
      {isLLC ? <Building2 className="w-3 h-3" /> : isPersonal ? <User className="w-3 h-3" /> : <ShieldQuestion className="w-3 h-3" />}
      <span className="truncate max-w-[180px]">
        {name || (isLLC ? 'LLC' : isPersonal ? 'Personal' : 'Sin marcar')}
      </span>
    </div>
  );
}

export default function AlineacionUtilitiesPage() {
  const { headers } = useAdminAuth();
  const [data, setData] = useState<AlignmentResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editHolderName, setEditHolderName] = useState('');
  const [editOwnerEntity, setEditOwnerEntity] = useState<'personal' | 'llc'>('llc');
  const [editOwnerName, setEditOwnerName] = useState('Ross House Rentals LLC');
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<'all' | 'high' | 'medium' | 'low' | 'none'>('all');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/utility-alignment', { headers: headers() });
      if (res.ok) {
        const d = await res.json();
        setData(d);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const startEdit = (prop: AlignmentItem) => {
    setEditingId(prop.id);
    setEditHolderName(prop.utility_account_holder_name || '');
    setEditOwnerEntity((prop.owner_entity === 'personal' || prop.owner_entity === 'llc') ? prop.owner_entity : 'llc');
    setEditOwnerName(prop.owner_display_name || 'Ross House Rentals LLC');
  };

  const handleSave = async (propertyId: string) => {
    setSaving(true);
    try {
      // Save owner entity
      await fetch(`/api/admin/properties/${propertyId}/owner-entity`, {
        method: 'POST',
        headers: { ...headers(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner_entity: editOwnerEntity, owner_display_name: editOwnerName }),
      });
      // Save utility holder
      if (editHolderName.trim()) {
        await fetch(`/api/admin/properties/${propertyId}/utility-holder`, {
          method: 'POST',
          headers: { ...headers(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ holder_name: editHolderName.trim() }),
        });
      }
      setEditingId(null);
      await fetchData();
    } catch (e) {
      console.error(e);
      alert('Error al guardar');
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-amber-400" />
      </div>
    );
  }

  const items = data?.properties || [];
  const filtered = filter === 'all' ? items : items.filter((i) => i.comparison.risk_level === filter);
  const s = data?.summary || { high: 0, medium: 0, low: 0, none: 0, total: 0 };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-start justify-between mb-2 flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <ShieldAlert className="w-8 h-8 text-amber-400" />
              Alineación Título ↔ Cuenta de Servicios
            </h1>
            <p className="text-slate-400 mt-2 max-w-3xl">
              Detecta automáticamente cuándo una propiedad está titulada bajo una LLC pero su cuenta de servicios
              (Xcel, agua, gas) está a nombre personal. Esto debilita la protección del velo corporativo.
            </p>
          </div>
          <button
            onClick={fetchData}
            className="px-4 py-2 bg-slate-800/60 border border-slate-700/50 hover:bg-slate-700/60 text-slate-300 rounded-lg text-sm font-semibold flex items-center gap-2 transition"
          >
            <RefreshCw className="w-4 h-4" />
            Actualizar
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <button
          onClick={() => setFilter('all')}
          className={`p-4 rounded-xl border text-left transition ${
            filter === 'all' ? 'bg-slate-800 border-slate-600' : 'bg-slate-900/40 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Total</div>
          <div className="text-3xl font-bold text-white mt-1">{s.total}</div>
        </button>
        {(['high', 'medium', 'low', 'none'] as const).map((k) => {
          const style = RISK_STYLES[k];
          const isActive = filter === k;
          return (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={`p-4 rounded-xl border text-left transition ${
                isActive ? `${style.bg} ${style.border}` : 'bg-slate-900/40 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
                <style.Icon className={`w-3.5 h-3.5 ${style.text}`} />
                <span className={style.text}>{style.label}</span>
              </div>
              <div className={`text-3xl font-bold mt-1 ${style.text}`}>{s[k]}</div>
            </button>
          );
        })}
      </div>

      {/* CTA banner if high risk exists */}
      {s.high > 0 && (
        <div className="mb-6 p-5 bg-gradient-to-br from-red-500/15 to-red-500/5 border border-red-500/40 rounded-2xl flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-6 h-6 text-red-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-red-300 font-bold text-lg mb-1">
              {s.high} propiedad{s.high > 1 ? 'es tienen' : ' tiene'} riesgo de perforación del velo corporativo
            </h3>
            <p className="text-red-200/80 text-sm mb-3">
              Las cuentas de servicios están a nombre personal cuando las propiedades están tituladas bajo LLC.
              Llama a Xcel al <span className="font-mono font-bold">1-800-895-4999</span> y solicita
              transferencia + programa ATO. Te enviamos un PDF con el script de llamada por email.
            </p>
            <div className="flex gap-2 flex-wrap">
              <a
                href="https://cloud.marketing.xcelenergy.com/ato"
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-200 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5"
              >
                <FileDown className="w-3.5 h-3.5" />
                Formulario ATO Xcel
              </a>
              <a
                href="tel:18008954999"
                className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-200 rounded-lg text-xs font-semibold"
              >
                Llamar 1-800-895-4999
              </a>
            </div>
          </div>
        </div>
      )}

      {/* List */}
      {filtered.length === 0 ? (
        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-12 text-center">
          <ShieldCheck className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
          <h3 className="text-white font-bold text-lg">No hay propiedades en esta categoría</h3>
          <p className="text-slate-400 text-sm mt-1">
            {filter === 'none'
              ? 'Aún no tienes propiedades con alineación coherente. ¡Sigue trabajando en transferirlas!'
              : 'Cambia el filtro para ver otras propiedades.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filtered.map((p) => {
            const style = RISK_STYLES[p.comparison.risk_level];
            const isEditing = editingId === p.id;

            return (
              <div
                key={p.id}
                className={`p-5 rounded-2xl border ${style.bg} ${style.border}`}
              >
                {/* Header row */}
                <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
                  <div className="flex-1 min-w-[260px]">
                    <div className="flex items-center gap-2 mb-1">
                      <style.Icon className={`w-5 h-5 ${style.text}`} />
                      <span className={`text-xs font-bold uppercase tracking-wider ${style.text}`}>
                        {style.label}
                      </span>
                    </div>
                    <h3 className="text-white font-bold text-lg">
                      {p.name}
                    </h3>
                    {p.address && (
                      <div className="text-slate-400 text-sm flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3.5 h-3.5" />
                        {p.address}{p.city ? `, ${p.city}` : ''}{p.state ? `, ${p.state}` : ''}
                      </div>
                    )}
                  </div>
                  {!isEditing && (
                    <button
                      onClick={() => startEdit(p)}
                      className="px-3 py-1.5 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-300 rounded-lg text-xs font-semibold flex items-center gap-1.5"
                    >
                      Editar
                    </button>
                  )}
                </div>

                {/* Body: read or edit */}
                {!isEditing ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1.5">
                        Dueño de la propiedad (deed)
                      </div>
                      <EntityChip entity={p.owner_entity} name={p.owner_display_name} />
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1.5">
                        Cuenta de luz / servicios
                      </div>
                      <EntityChip entity={p.utility_account_holder} name={p.utility_account_holder_name} />
                    </div>
                    <div className="md:col-span-2 mt-2 p-3 rounded-lg bg-slate-900/60 border border-slate-800/80">
                      <div className="text-xs text-slate-400 flex items-start gap-2">
                        <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                        <span>{p.comparison.recommendation}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Owner entity selector */}
                    <div>
                      <label className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1.5 block">
                        Dueño de la propiedad (deed)
                      </label>
                      <div className="flex gap-2 mb-2">
                        <button
                          onClick={() => setEditOwnerEntity('llc')}
                          className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold border ${
                            editOwnerEntity === 'llc'
                              ? 'bg-violet-500/20 border-violet-500/50 text-violet-200'
                              : 'bg-slate-800/60 border-slate-700 text-slate-400'
                          }`}
                        >
                          <Building2 className="w-3.5 h-3.5 inline mr-1" />
                          LLC
                        </button>
                        <button
                          onClick={() => setEditOwnerEntity('personal')}
                          className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold border ${
                            editOwnerEntity === 'personal'
                              ? 'bg-sky-500/20 border-sky-500/50 text-sky-200'
                              : 'bg-slate-800/60 border-slate-700 text-slate-400'
                          }`}
                        >
                          <User className="w-3.5 h-3.5 inline mr-1" />
                          Personal
                        </button>
                      </div>
                      <input
                        type="text"
                        value={editOwnerName}
                        onChange={(e) => setEditOwnerName(e.target.value)}
                        placeholder="Ej: Ross House Rentals LLC"
                        className="w-full px-3 py-2 bg-slate-900/80 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500/50"
                      />
                    </div>
                    {/* Utility holder name */}
                    <div>
                      <label className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1.5 block">
                        Titular cuenta de luz (Xcel)
                      </label>
                      <input
                        type="text"
                        value={editHolderName}
                        onChange={(e) => setEditHolderName(e.target.value)}
                        placeholder="Ej: Yoandy Ross  ó  Ross House Rentals LLC"
                        className="w-full px-3 py-2 bg-slate-900/80 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500/50"
                      />
                      <p className="text-[10px] text-slate-500 mt-1">
                        Se detecta automáticamente si es personal o empresarial (LLC, Inc, Corp, etc.).
                      </p>
                    </div>
                    {/* Actions */}
                    <div className="md:col-span-2 flex gap-2 justify-end">
                      <button
                        onClick={() => setEditingId(null)}
                        className="px-4 py-2 bg-slate-800/60 border border-slate-700 text-slate-300 rounded-lg text-sm font-semibold"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={() => handleSave(p.id)}
                        disabled={saving}
                        className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-900 rounded-lg text-sm font-bold flex items-center gap-1.5 disabled:opacity-60"
                      >
                        {saving ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <Save className="w-4 h-4" />
                        )}
                        Guardar
                      </button>
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
