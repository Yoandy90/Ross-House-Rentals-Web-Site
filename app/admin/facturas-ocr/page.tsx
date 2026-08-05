'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAdminAuth } from '../layout';
import {
  ScanLine, Upload, FileText, Droplets, Flame, Trash2, Wifi, Phone,
  Tv, Home, Sparkles, CheckCircle2, AlertTriangle, X, Save,
  RefreshCw, Building2, DollarSign, Calendar as CalendarIcon, Hash,
  Loader2, MapPin, ChevronDown,
} from 'lucide-react';

const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

const BILL_TYPE_META: Record<string, { label: string; Icon: any; color: string; bg: string; ring: string }> = {
  water:             { label: 'Agua',         Icon: Droplets, color: 'text-cyan-400',    bg: 'bg-cyan-500/15',    ring: 'ring-cyan-500/30' },
  sewer:             { label: 'Alcantarillado', Icon: Droplets, color: 'text-blue-400',   bg: 'bg-blue-500/15',    ring: 'ring-blue-500/30' },
  gas:               { label: 'Gas',          Icon: Flame,    color: 'text-orange-400',  bg: 'bg-orange-500/15',  ring: 'ring-orange-500/30' },
  trash:             { label: 'Basura',       Icon: Trash2,   color: 'text-slate-400',   bg: 'bg-slate-500/15',   ring: 'ring-slate-500/30' },
  electricity_other: { label: 'Electricidad', Icon: Sparkles, color: 'text-yellow-400',  bg: 'bg-yellow-500/15',  ring: 'ring-yellow-500/30' },
  internet:          { label: 'Internet',     Icon: Wifi,     color: 'text-violet-400',  bg: 'bg-violet-500/15',  ring: 'ring-violet-500/30' },
  phone:             { label: 'Teléfono',     Icon: Phone,    color: 'text-emerald-400', bg: 'bg-emerald-500/15', ring: 'ring-emerald-500/30' },
  tv:                { label: 'TV',           Icon: Tv,       color: 'text-pink-400',    bg: 'bg-pink-500/15',    ring: 'ring-pink-500/30' },
  hoa:               { label: 'HOA',          Icon: Home,     color: 'text-indigo-400',  bg: 'bg-indigo-500/15',  ring: 'ring-indigo-500/30' },
  other:             { label: 'Otro',         Icon: FileText, color: 'text-gray-400',    bg: 'bg-gray-500/15',    ring: 'ring-gray-500/30' },
};

type OcrResult = {
  success: boolean;
  provider?: string | null;
  bill_type?: string | null;
  period_start?: string | null;
  period_end?: string | null;
  due_date?: string | null;
  total_amount?: number | null;
  usage_value?: number | null;
  usage_unit?: string | null;
  account_number?: string | null;
  service_address?: string | null;
  confidence?: number | null;
  needs_manual_review?: boolean;
  raw_text?: string | null;
};

export default function FacturasOcrPage() {
  const { headers } = useAdminAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [bills, setBills] = useState<any[]>([]);
  const [properties, setProperties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragOver, setDragOver] = useState(false);

  // OCR review state
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [billTypeHint, setBillTypeHint] = useState<string>('auto');
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('');
  const [createTenantBill, setCreateTenantBill] = useState(true);
  const [adminNotes, setAdminNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; tone: 'ok' | 'err' } | null>(null);

  const showToast = (msg: string, tone: 'ok' | 'err' = 'ok') => {
    setToast({ msg, tone });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchAll = useCallback(async () => {
    try {
      const [bRes, pRes] = await Promise.all([
        fetch('/api/admin/utility-ocr/non-xcel-bills', { headers: headers() }),
        fetch('/api/admin/properties', { headers: headers() }),
      ]);
      if (bRes.ok) { const d = await bRes.json(); setBills(d.bills || []); }
      if (pRes.ok) { const d = await pRes.json(); setProperties(d.properties || []); }
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [headers]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const resetUpload = () => {
    setUploadedFile(null);
    setPreviewUrl(null);
    setOcrResult(null);
    setSelectedPropertyId('');
    setAdminNotes('');
    setBillTypeHint('auto');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileSelected = (file: File) => {
    setUploadedFile(file);
    setOcrResult(null);
    if (file.type.startsWith('image/')) {
      setPreviewUrl(URL.createObjectURL(file));
    } else {
      setPreviewUrl(null);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFileSelected(f);
  };

  const handleExtract = async () => {
    if (!uploadedFile) return;
    setOcrLoading(true);
    try {
      const fd = new FormData();
      fd.append('file', uploadedFile);
      fd.append('bill_type_hint', billTypeHint);
      const h = headers();
      // FormData manages content-type; strip JSON header if any
      delete (h as any)['Content-Type'];
      const res = await fetch('/api/admin/utility-ocr/extract', {
        method: 'POST',
        headers: h,
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setOcrResult(data);
        if (!data.success) {
          showToast(`⚠️ ${data.raw_text || 'No se pudo extraer'}`, 'err');
        } else {
          showToast('🔍 Factura analizada — revisa los datos antes de guardar');
        }
      } else {
        showToast(`❌ ${data?.detail || 'Error al procesar'}`, 'err');
      }
    } catch (e: any) {
      showToast(`❌ ${e?.message || 'Error de red'}`, 'err');
    }
    setOcrLoading(false);
  };

  const handleSave = async () => {
    if (!ocrResult || !selectedPropertyId) {
      showToast('⚠️ Selecciona una propiedad', 'err');
      return;
    }
    setSaving(true);
    try {
      const body = {
        property_id: selectedPropertyId,
        provider: ocrResult.provider,
        bill_type: ocrResult.bill_type || 'other',
        period_start: ocrResult.period_start,
        period_end: ocrResult.period_end,
        due_date: ocrResult.due_date,
        total_amount: ocrResult.total_amount,
        usage_value: ocrResult.usage_value,
        usage_unit: ocrResult.usage_unit,
        account_number: ocrResult.account_number,
        service_address: ocrResult.service_address,
        confidence: ocrResult.confidence,
        notes: adminNotes,
        create_tenant_bill: createTenantBill,
      };
      const res = await fetch('/api/admin/utility-ocr/save-bill', {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        const msg = data.tenant_bills_created > 0
          ? `✅ Factura guardada + ${data.tenant_bills_created} factura(s) pagable(s) para el inquilino`
          : '✅ Factura guardada (sin asignar a inquilino)';
        showToast(msg);
        resetUpload();
        await fetchAll();
      } else {
        showToast(`❌ ${data?.detail || 'Error al guardar'}`, 'err');
      }
    } catch (e: any) {
      showToast(`❌ ${e?.message || 'Error de red'}`, 'err');
    }
    setSaving(false);
  };

  const totalAmount = useMemo(
    () => bills.reduce((s, b) => s + (b.total_amount || 0), 0),
    [bills]
  );

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-3 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-6 relative pb-32">
      {/* Glows */}
      <div className="fixed top-0 right-1/3 w-96 h-96 bg-cyan-500/[0.03] rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-1/4 left-1/4 w-96 h-96 bg-violet-500/[0.025] rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="relative w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500/25 to-cyan-500/5 border border-cyan-500/25 flex items-center justify-center shadow-[0_0_25px_rgba(6,182,212,0.18)]">
            <ScanLine className="w-6 h-6 text-cyan-400" />
            <Sparkles className="absolute -top-1 -right-1 w-3 h-3 text-cyan-300" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Facturas OCR <span className="text-xs font-semibold text-cyan-400 ml-2">GPT-4o Vision</span></h2>
            <p className="text-sm text-gray-500">{bills.length} factura(s) extraída(s) · Water, Gas, Trash, etc.</p>
          </div>
        </div>
        <button
          onClick={fetchAll}
          className="p-2.5 border border-white/[0.08] rounded-xl text-gray-400 hover:bg-white/[0.04] transition"
          title="Refrescar"
        ><RefreshCw className="w-4 h-4" /></button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <StatCard icon={<FileText className="w-4 h-4 text-cyan-400" />} value={String(bills.length)} label="Facturas extraídas" tone="cyan" />
        <StatCard icon={<DollarSign className="w-4 h-4 text-emerald-400" />} value={fmt(totalAmount)} label="Total facturado" tone="emerald" />
        <StatCard icon={<Sparkles className="w-4 h-4 text-violet-400" />} value="GPT-4o" label="IA en uso" tone="violet" />
      </div>

      {/* Upload zone */}
      {!uploadedFile && (
        <div
          onDrop={onDrop}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          className={`relative rounded-2xl border-2 border-dashed transition cursor-pointer p-10 text-center group ${
            dragOver
              ? 'border-cyan-500/60 bg-cyan-500/[0.06]'
              : 'border-white/[0.10] bg-white/[0.02] hover:border-cyan-500/40 hover:bg-cyan-500/[0.03]'
          }`}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,image/*"
            className="hidden"
            onChange={e => {
              const f = e.target.files?.[0];
              if (f) handleFileSelected(f);
            }}
          />
          <div className="w-20 h-20 mx-auto bg-gradient-to-br from-cyan-500/20 to-violet-500/10 rounded-2xl flex items-center justify-center mb-4 ring-1 ring-cyan-500/25 shadow-[0_0_30px_rgba(6,182,212,0.18)] group-hover:scale-105 transition">
            <Upload className="w-10 h-10 text-cyan-400" />
          </div>
          <h3 className="text-lg font-bold text-white mb-1">Arrastra una factura aquí o haz clic</h3>
          <p className="text-sm text-gray-500">PDF o imagen (JPG/PNG/HEIC) · Hasta 10 MB</p>
          <p className="text-xs text-gray-600 mt-2 flex items-center justify-center gap-1.5">
            <Sparkles className="w-3 h-3 text-cyan-400" /> Extrae monto, vencimiento, consumo y proveedor automáticamente
          </p>
        </div>
      )}

      {/* Uploaded file + OCR controls */}
      {uploadedFile && (
        <div className="grid lg:grid-cols-2 gap-5">
          {/* Preview pane */}
          <div className="bg-white/[0.03] rounded-2xl border border-white/[0.06] p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-cyan-500/15 border border-cyan-500/25 flex items-center justify-center">
                  <FileText className="w-4 h-4 text-cyan-400" />
                </div>
                <div>
                  <div className="text-sm font-bold text-white line-clamp-1">{uploadedFile.name}</div>
                  <div className="text-xs text-gray-500">{(uploadedFile.size / 1024).toFixed(1)} KB · {uploadedFile.type || 'desconocido'}</div>
                </div>
              </div>
              <button onClick={resetUpload} className="text-gray-500 hover:text-red-400 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            {previewUrl ? (
              <div className="rounded-xl overflow-hidden border border-white/[0.06] bg-black/40 max-h-[420px] flex items-center justify-center">
                {/* eslint-disable-next-line */}
                <img src={previewUrl} alt="Preview" className="max-h-[420px] w-auto object-contain" />
              </div>
            ) : (
              <div className="rounded-xl bg-gradient-to-br from-red-500/[0.06] to-transparent border border-red-500/15 p-8 text-center">
                <FileText className="w-12 h-12 text-red-400 mx-auto mb-3" />
                <div className="text-sm font-bold text-white">PDF cargado</div>
                <div className="text-xs text-gray-500 mt-1">La vista previa se mostrará tras el análisis</div>
              </div>
            )}

            {/* Bill type hint */}
            <div className="mt-4">
              <label className="block text-[11px] font-bold text-gray-400 mb-1.5 uppercase tracking-wider">Pista del tipo de factura (opcional)</label>
              <div className="flex flex-wrap gap-1.5">
                {(['auto','water','gas','trash','sewer','electricity_other','internet','other'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setBillTypeHint(t)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition ${
                      billTypeHint === t
                        ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                        : 'bg-white/[0.03] text-gray-400 border-white/[0.08] hover:bg-white/[0.06]'
                    }`}
                  >{t === 'auto' ? '🤖 Auto' : (BILL_TYPE_META[t]?.label || t)}</button>
                ))}
              </div>
            </div>

            <button
              onClick={handleExtract}
              disabled={ocrLoading}
              className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-cyan-500 to-violet-500 text-white rounded-xl text-sm font-bold hover:opacity-90 transition shadow-[0_0_24px_rgba(6,182,212,0.30)] disabled:opacity-50"
            >
              {ocrLoading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Analizando con GPT-4o…</>
              ) : (
                <><ScanLine className="w-4 h-4" /> Extraer datos con IA</>
              )}
            </button>
          </div>

          {/* OCR result pane */}
          <div className="bg-white/[0.03] rounded-2xl border border-white/[0.06] p-5">
            {!ocrResult ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-12">
                <Sparkles className="w-12 h-12 text-cyan-400 mb-3 animate-pulse" />
                <div className="text-sm font-semibold text-gray-300">Esperando análisis…</div>
                <div className="text-xs text-gray-500 mt-1">La IA extraerá los campos automáticamente</div>
              </div>
            ) : (
              <ReviewForm
                ocrResult={ocrResult}
                setOcrResult={setOcrResult}
                properties={properties}
                selectedPropertyId={selectedPropertyId}
                setSelectedPropertyId={setSelectedPropertyId}
                createTenantBill={createTenantBill}
                setCreateTenantBill={setCreateTenantBill}
                adminNotes={adminNotes}
                setAdminNotes={setAdminNotes}
                saving={saving}
                onSave={handleSave}
              />
            )}
          </div>
        </div>
      )}

      {/* Saved bills list */}
      <div>
        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3 mt-8 flex items-center gap-2">
          <FileText className="w-4 h-4" /> Facturas extraídas previamente
        </h3>

        {bills.length === 0 ? (
          <div className="text-center py-12 bg-white/[0.02] rounded-2xl border border-white/[0.06]">
            <FileText className="w-10 h-10 text-gray-500 mx-auto mb-2" />
            <p className="text-gray-400 text-sm">Aún no hay facturas extraídas</p>
            <p className="text-gray-600 text-xs mt-1">Sube tu primera factura arriba</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {bills.map(b => {
              const meta = BILL_TYPE_META[b.bill_type] || BILL_TYPE_META.other;
              const conf = Math.round((b.confidence || 0) * 100);
              return (
                <div key={b._id} className="relative overflow-hidden bg-white/[0.03] backdrop-blur-sm rounded-xl border border-white/[0.06] p-4 hover:border-cyan-500/20 transition group">
                  <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-cyan-500/30 to-transparent rounded-t-xl" />
                  <div className={`absolute -bottom-4 -right-4 w-24 h-24 ${meta.bg} rounded-full blur-2xl pointer-events-none opacity-30`} />
                  <div className="relative z-10">
                    <div className="flex items-start justify-between mb-2">
                      <div className={`w-10 h-10 rounded-xl ${meta.bg} flex items-center justify-center ring-1 ${meta.ring}`}>
                        <meta.Icon className={`w-5 h-5 ${meta.color}`} />
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                        conf >= 85 ? 'bg-emerald-500/10 text-emerald-400' : conf >= 60 ? 'bg-amber-500/10 text-amber-400' : 'bg-red-500/10 text-red-400'
                      }`}>
                        {conf}% conf
                      </span>
                    </div>
                    <div className="text-sm font-bold text-white">{b.provider || 'Proveedor desconocido'}</div>
                    <div className="text-xs text-gray-500 line-clamp-1">{b.service_address || 'Sin dirección'}</div>
                    <div className="flex items-end justify-between mt-2">
                      <div>
                        <div className="text-lg font-bold text-emerald-400">{fmt(b.total_amount || 0)}</div>
                        <div className="text-[10px] text-gray-500">
                          {b.period_end ? new Date(b.period_end).toLocaleDateString('es-ES', { month: 'short', year: 'numeric' }) : '—'}
                        </div>
                      </div>
                      {b.usage_value && (
                        <div className="text-right">
                          <div className="text-xs font-bold text-white">{b.usage_value}</div>
                          <div className="text-[10px] text-gray-500">{b.usage_unit || ''}</div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-[60] max-w-sm px-4 py-3 rounded-xl border backdrop-blur-xl shadow-2xl text-sm font-semibold ${
          toast.tone === 'ok'
            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 shadow-[0_0_24px_rgba(16,185,129,0.25)]'
            : 'bg-red-500/15 text-red-300 border-red-500/30 shadow-[0_0_24px_rgba(239,68,68,0.25)]'
        }`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

/* ─── Review form (after OCR returns) ────────────────────────────────── */

function ReviewForm({
  ocrResult, setOcrResult, properties, selectedPropertyId, setSelectedPropertyId,
  createTenantBill, setCreateTenantBill, adminNotes, setAdminNotes, saving, onSave,
}: {
  ocrResult: OcrResult;
  setOcrResult: (r: OcrResult) => void;
  properties: any[];
  selectedPropertyId: string;
  setSelectedPropertyId: (id: string) => void;
  createTenantBill: boolean;
  setCreateTenantBill: (v: boolean) => void;
  adminNotes: string;
  setAdminNotes: (v: string) => void;
  saving: boolean;
  onSave: () => void;
}) {
  const conf = Math.round((ocrResult.confidence || 0) * 100);
  const meta = BILL_TYPE_META[ocrResult.bill_type || 'other'] || BILL_TYPE_META.other;
  const update = (patch: Partial<OcrResult>) => setOcrResult({ ...ocrResult, ...patch });

  if (!ocrResult.success) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-3" />
        <div className="text-sm font-bold text-white mb-1">No se pudo procesar</div>
        <div className="text-xs text-gray-400 max-w-sm mx-auto">{ocrResult.raw_text || 'Revisa el archivo y vuelve a intentar.'}</div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <div className={`w-9 h-9 rounded-xl ${meta.bg} flex items-center justify-center ring-1 ${meta.ring}`}>
            <meta.Icon className={`w-4 h-4 ${meta.color}`} />
          </div>
          <div>
            <div className="text-sm font-bold text-white">{ocrResult.provider || 'Proveedor'}</div>
            <div className="text-xs text-gray-500">Revisa y confirma los datos</div>
          </div>
        </div>
        <span className={`text-[11px] px-2.5 py-1 rounded-full font-bold ${
          conf >= 85 ? 'bg-emerald-500/10 text-emerald-400'
          : conf >= 60 ? 'bg-amber-500/10 text-amber-400'
          : 'bg-red-500/10 text-red-400'
        }`}>
          {conf}% confianza
        </span>
      </div>

      {ocrResult.needs_manual_review && (
        <div className="rounded-lg bg-amber-500/10 border border-amber-500/25 px-3 py-2 text-xs text-amber-300 flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          Revisión manual recomendada. Verifica todos los campos antes de guardar.
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Proveedor">
          <input type="text" value={ocrResult.provider || ''}
            onChange={e => update({ provider: e.target.value })}
            className={INPUT_CLASS} />
        </Field>
        <Field label="Tipo">
          <select value={ocrResult.bill_type || 'other'}
            onChange={e => update({ bill_type: e.target.value })}
            className={INPUT_CLASS}>
            {Object.entries(BILL_TYPE_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </Field>
        <Field label="Monto Total ($)">
          <input type="number" step="0.01" value={ocrResult.total_amount ?? ''}
            onChange={e => update({ total_amount: parseFloat(e.target.value) || 0 })}
            className={INPUT_CLASS} />
        </Field>
        <Field label="Vencimiento">
          <input type="date" value={ocrResult.due_date || ''}
            onChange={e => update({ due_date: e.target.value })}
            className={INPUT_CLASS} />
        </Field>
        <Field label="Período Inicio">
          <input type="date" value={ocrResult.period_start || ''}
            onChange={e => update({ period_start: e.target.value })}
            className={INPUT_CLASS} />
        </Field>
        <Field label="Período Fin">
          <input type="date" value={ocrResult.period_end || ''}
            onChange={e => update({ period_end: e.target.value })}
            className={INPUT_CLASS} />
        </Field>
        <Field label="Consumo">
          <input type="number" step="0.01" value={ocrResult.usage_value ?? ''}
            onChange={e => update({ usage_value: parseFloat(e.target.value) || 0 })}
            className={INPUT_CLASS} />
        </Field>
        <Field label="Unidad">
          <select value={ocrResult.usage_unit || ''}
            onChange={e => update({ usage_unit: e.target.value })}
            className={INPUT_CLASS}>
            <option value="">—</option>
            <option value="gallons">Galones (water)</option>
            <option value="therms">Therms (gas)</option>
            <option value="kwh">kWh (electricidad)</option>
            <option value="ccf">CCF (gas)</option>
            <option value="minutes">Minutos</option>
          </select>
        </Field>
        <Field label="N° de Cuenta" className="col-span-2">
          <input type="text" value={ocrResult.account_number || ''}
            onChange={e => update({ account_number: e.target.value })}
            className={INPUT_CLASS} />
        </Field>
        <Field label="Dirección del Servicio" className="col-span-2">
          <input type="text" value={ocrResult.service_address || ''}
            onChange={e => update({ service_address: e.target.value })}
            className={INPUT_CLASS} />
        </Field>
      </div>

      <div className="pt-3 border-t border-white/[0.06] space-y-3">
        <Field label="Propiedad" required>
          <select value={selectedPropertyId} onChange={e => setSelectedPropertyId(e.target.value)} className={INPUT_CLASS}>
            <option value="">Seleccionar propiedad…</option>
            {properties.map(p => (
              <option key={p._id} value={p._id}>{p.name || p.address || p._id}</option>
            ))}
          </select>
        </Field>

        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={createTenantBill}
            onChange={e => setCreateTenantBill(e.target.checked)}
            className="w-4 h-4 accent-cyan-500"
          />
          <span className="text-xs text-gray-300">
            Crear factura pagable para el inquilino activo (aparecerá en su app)
          </span>
        </label>

        <Field label="Notas (opcional)">
          <input
            type="text"
            value={adminNotes}
            onChange={e => setAdminNotes(e.target.value)}
            placeholder="Comentarios internos…"
            className={INPUT_CLASS}
          />
        </Field>
      </div>

      <button
        onClick={onSave}
        disabled={saving || !selectedPropertyId || !ocrResult.total_amount}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl text-sm font-bold hover:opacity-90 transition shadow-[0_0_24px_rgba(16,185,129,0.30)] disabled:opacity-30"
      >
        {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando…</> : <><Save className="w-4 h-4" /> Guardar factura</>}
      </button>
    </div>
  );
}

const INPUT_CLASS = 'w-full px-3 py-2.5 bg-[#0a1020]/80 border border-white/[0.08] rounded-xl text-white text-sm focus:border-cyan-500 focus:outline-none';

function Field({ label, required, className, children }: { label: string; required?: boolean; className?: string; children: React.ReactNode }) {
  return (
    <div className={className}>
      <label className="block text-[11px] font-bold text-gray-400 mb-1 uppercase tracking-wider">
        {label} {required && <span className="text-cyan-400">*</span>}
      </label>
      {children}
    </div>
  );
}

function StatCard({ icon, value, label, tone }: { icon: React.ReactNode; value: string; label: string; tone: 'cyan' | 'emerald' | 'violet' }) {
  const palette = {
    cyan:    { from: 'from-cyan-500/[0.10]',    border: 'border-cyan-500/25',    bar: 'from-cyan-500 to-cyan-400',       glow: 'bg-cyan-500/[0.08]',    chipBg: 'bg-cyan-500/15',    chipRing: 'ring-cyan-500/25' },
    emerald: { from: 'from-emerald-500/[0.10]', border: 'border-emerald-500/25', bar: 'from-emerald-500 to-emerald-400', glow: 'bg-emerald-500/[0.08]', chipBg: 'bg-emerald-500/15', chipRing: 'ring-emerald-500/25' },
    violet:  { from: 'from-violet-500/[0.10]',  border: 'border-violet-500/25',  bar: 'from-violet-500 to-violet-400',   glow: 'bg-violet-500/[0.08]',  chipBg: 'bg-violet-500/15',  chipRing: 'ring-violet-500/25' },
  }[tone];

  return (
    <div className={`relative overflow-hidden bg-gradient-to-br ${palette.from} to-transparent rounded-2xl border ${palette.border} p-4 group`}>
      <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${palette.bar} rounded-t-2xl`} />
      <div className={`absolute -bottom-6 -right-6 w-24 h-24 ${palette.glow} rounded-full blur-2xl pointer-events-none group-hover:scale-110 transition-transform`} />
      <div className="relative z-10">
        <div className={`w-9 h-9 rounded-lg ${palette.chipBg} flex items-center justify-center ring-1 ${palette.chipRing} mb-2`}>{icon}</div>
        <div className="text-xl font-bold text-white">{value}</div>
        <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">{label}</div>
      </div>
    </div>
  );
}
