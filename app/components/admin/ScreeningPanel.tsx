'use client';

import React, { useRef, useState } from 'react';
import {
  ShieldCheck, Send, Loader2, FileUp, Download, CheckCircle2,
  Clock, Ban, Save,
} from 'lucide-react';

export type ScreeningResults = {
  credit_score: number | null;
  income_verified: boolean | null;
  criminal_records: string;   // '' | 'clean' | 'found'
  eviction_records: string;   // '' | 'clean' | 'found'
  recommendation: string;     // '' | 'approve' | 'conditional' | 'reject'
  notes: string;
};

export type Screening = {
  status: string;             // requested | in_progress | completed | cancelled
  provider: string;           // smartmove | boomscreen | other
  screening_link: string;
  requested_at: string;
  requested_by: string;
  completed_at: string;
  email_sent: boolean;
  reason?: string;          // only for waived
  results: ScreeningResults;
  report: { filename: string; size: number; uploaded_at: string } | null;
};

const PROVIDER_LABELS: Record<string, string> = {
  smartmove: 'TransUnion SmartMove',
  boomscreen: 'BoomScreen',
  other: 'Otro proveedor',
};

const SCREENING_STATUS: Record<string, { label: string; cls: string; icon: any }> = {
  requested:   { label: 'Solicitado',  cls: 'bg-blue-500/10 text-blue-400 border-blue-500/25',       icon: Send },
  in_progress: { label: 'En proceso',  cls: 'bg-amber-500/10 text-amber-400 border-amber-500/25',    icon: Clock },
  completed:   { label: 'Completado',  cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25', icon: CheckCircle2 },
  cancelled:   { label: 'Cancelado',   cls: 'bg-gray-500/10 text-gray-400 border-gray-500/25',       icon: Ban },
  waived:      { label: 'Exonerado',   cls: 'bg-purple-500/10 text-purple-400 border-purple-500/25', icon: ShieldCheck },
};

const REC_CONFIG: Record<string, { label: string; cls: string }> = {
  approve:     { label: '✅ Aprobar',     cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  conditional: { label: '⚠️ Condicional', cls: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  reject:      { label: '❌ Rechazar',    cls: 'bg-red-500/15 text-red-400 border-red-500/30' },
};

const inputCls = 'w-full px-3 py-2 bg-[#0a1020]/60 border border-white/[0.08] rounded-xl text-sm text-white focus:border-blue-500 focus:outline-none';

export default function ScreeningPanel({ appId, screening, headers, onChanged, notify }: {
  appId: string;
  screening: Screening | null;
  headers: () => Record<string, string>;
  onChanged: () => Promise<void> | void;
  notify: (msg: string, ok: boolean) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [forceRequest, setForceRequest] = useState(false);
  // Request form
  const [provider, setProvider] = useState('smartmove');
  const [link, setLink] = useState('');
  const [sendEmail, setSendEmail] = useState(true);
  // Results form
  const [results, setResults] = useState<ScreeningResults | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const api = async (path: string, init: RequestInit) => {
    const res = await fetch(path, { ...init, headers: headers() });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(d.detail || 'Error del servidor');
    return d;
  };

  const requestScreening = async () => {
    setBusy(true);
    try {
      const d = await api(`/api/admin/rental-applications/${appId}/screening/request`, {
        method: 'POST',
        body: JSON.stringify({ provider, screening_link: link, send_email: sendEmail }),
      });
      notify(d.email_sent ? 'Screening solicitado y email enviado al aplicante' : 'Screening solicitado (sin email)', true);
      await onChanged();
    } catch (e: any) { notify(e.message, false); }
    setBusy(false);
  };

  const setStatus = async (status: string) => {
    setBusy(true);
    try {
      await api(`/api/admin/rental-applications/${appId}/screening`, {
        method: 'PATCH', body: JSON.stringify({ status }),
      });
      notify(`Screening: ${SCREENING_STATUS[status]?.label || status}`, true);
      await onChanged();
    } catch (e: any) { notify(e.message, false); }
    setBusy(false);
  };

  const saveResults = async () => {
    if (!results) return;
    setBusy(true);
    try {
      await api(`/api/admin/rental-applications/${appId}/screening`, {
        method: 'PATCH', body: JSON.stringify({ results }),
      });
      notify('Resultados del screening guardados', true);
      setResults(null);
      await onChanged();
    } catch (e: any) { notify(e.message, false); }
    setBusy(false);
  };

  const uploadReport = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) { notify('El archivo excede 10 MB', false); return; }
    setBusy(true);
    try {
      const b64 = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = reject;
        r.readAsDataURL(file);
      });
      await api(`/api/admin/rental-applications/${appId}/screening/report`, {
        method: 'POST',
        body: JSON.stringify({ filename: file.name, content_type: file.type || 'application/pdf', data_base64: b64 }),
      });
      notify('Reporte subido', true);
      await onChanged();
    } catch (e: any) { notify(e.message, false); }
    setBusy(false);
  };

  const downloadReport = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/rental-applications/${appId}/screening/report`, { headers: headers() });
      if (!res.ok) throw new Error('No se pudo descargar el reporte');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = screening?.report?.filename || 'screening-report.pdf';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) { notify(e.message, false); }
    setBusy(false);
  };

  const isWaived = screening?.status === 'waived';

  // ─── Screening waived by landlord decision ───
  if (isWaived && !forceRequest) {
    return (
      <div className="bg-white/[0.02] rounded-xl border border-white/[0.04] p-4 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="text-xs font-bold text-gray-400 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" /> Screening de crédito y antecedentes
          </div>
          <span className="text-[10px] px-2.5 py-1 rounded-full font-bold border bg-purple-500/10 text-purple-400 border-purple-500/25">
            Exonerado
          </span>
        </div>
        {screening?.reason && (
          <p className="text-xs text-gray-500 leading-relaxed">{screening.reason}</p>
        )}
        <button onClick={() => setForceRequest(true)}
          className="text-xs px-3 py-1.5 rounded-lg font-medium transition border bg-white/[0.03] text-gray-400 border-white/[0.08] hover:text-white">
          Solicitar screening de todas formas
        </button>
      </div>
    );
  }

  // ─── No screening yet: request form ───
  if (!screening || isWaived) {
    return (
      <div className="bg-white/[0.02] rounded-xl border border-white/[0.04] p-4 space-y-3">
        <div className="text-xs font-bold text-gray-400 flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5" /> Screening de crédito y antecedentes
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] uppercase tracking-wider text-gray-500 font-bold block mb-1">Proveedor</label>
            <select value={provider} onChange={e => setProvider(e.target.value)} className={inputCls}>
              <option value="smartmove">TransUnion SmartMove</option>
              <option value="boomscreen">BoomScreen</option>
              <option value="other">Otro</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-gray-500 font-bold block mb-1">Enlace de screening (opcional)</label>
            <input value={link} onChange={e => setLink(e.target.value)} placeholder="https://mysmartmove.com/..." className={inputCls} />
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
            <input type="checkbox" checked={sendEmail} onChange={e => setSendEmail(e.target.checked)} className="accent-blue-500" />
            Enviar email al aplicante con instrucciones
          </label>
          <button onClick={requestScreening} disabled={busy} data-testid="request-screening-btn"
            className="px-4 py-2 bg-blue-500/15 text-blue-400 border border-blue-500/30 rounded-xl text-xs font-bold hover:bg-blue-500/25 transition flex items-center gap-2 disabled:opacity-50">
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
            Solicitar Screening
          </button>
        </div>
      </div>
    );
  }

  // ─── Screening exists ───
  const st = SCREENING_STATUS[screening.status] || SCREENING_STATUS.requested;
  const StIcon = st.icon;
  const r = results ?? screening.results;
  const rec = screening.results.recommendation;

  return (
    <div className="bg-white/[0.02] rounded-xl border border-white/[0.04] p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="text-xs font-bold text-gray-400 flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5" /> Screening de crédito y antecedentes
        </div>
        <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold border flex items-center gap-1 ${st.cls}`}>
          <StIcon className="w-3 h-3" /> {st.label}
        </span>
        <span className="text-[10px] text-gray-600">
          {PROVIDER_LABELS[screening.provider] || screening.provider}
          {screening.requested_at && ` · solicitado ${new Date(screening.requested_at).toLocaleDateString('es-US')}`}
          {screening.email_sent && ' · 📧 email enviado'}
        </span>
        {rec && REC_CONFIG[rec] && (
          <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold border ${REC_CONFIG[rec].cls}`}>
            {REC_CONFIG[rec].label}
          </span>
        )}
      </div>

      {/* Status actions */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Estado:</span>
        {Object.entries(SCREENING_STATUS).filter(([k]) => k !== screening.status && k !== 'waived').map(([key, cfg]) => (
          <button key={key} onClick={() => setStatus(key)} disabled={busy}
            className={`text-xs px-3 py-1.5 rounded-lg font-medium transition border hover:opacity-80 disabled:opacity-30 ${cfg.cls}`}>
            {cfg.label}
          </button>
        ))}
      </div>

      {/* Results */}
      <div className="space-y-2">
        <div className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Resultados</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="text-[10px] text-gray-500 block mb-1">Score de crédito</label>
            <input type="number" min={300} max={850} value={r.credit_score ?? ''} placeholder="—"
              onChange={e => setResults({ ...r, credit_score: e.target.value === '' ? null : parseInt(e.target.value, 10) })}
              className={inputCls} />
          </div>
          <div>
            <label className="text-[10px] text-gray-500 block mb-1">Ingresos verificados</label>
            <select value={r.income_verified === null ? '' : r.income_verified ? 'yes' : 'no'}
              onChange={e => setResults({ ...r, income_verified: e.target.value === '' ? null : e.target.value === 'yes' })}
              className={inputCls}>
              <option value="">—</option>
              <option value="yes">Sí</option>
              <option value="no">No</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] text-gray-500 block mb-1">Antecedentes penales</label>
            <select value={r.criminal_records} onChange={e => setResults({ ...r, criminal_records: e.target.value })} className={inputCls}>
              <option value="">—</option>
              <option value="clean">Limpio</option>
              <option value="found">Registros encontrados</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] text-gray-500 block mb-1">Desalojos previos</label>
            <select value={r.eviction_records} onChange={e => setResults({ ...r, eviction_records: e.target.value })} className={inputCls}>
              <option value="">—</option>
              <option value="clean">Limpio</option>
              <option value="found">Registros encontrados</option>
            </select>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] text-gray-500">Recomendación:</span>
          {Object.entries(REC_CONFIG).map(([key, cfg]) => (
            <button key={key} onClick={() => setResults({ ...r, recommendation: r.recommendation === key ? '' : key })}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition border ${
                r.recommendation === key ? cfg.cls : 'bg-white/[0.02] text-gray-500 border-white/[0.06] hover:text-gray-300'
              }`}>
              {cfg.label}
            </button>
          ))}
        </div>
        <textarea value={r.notes} onChange={e => setResults({ ...r, notes: e.target.value })} rows={2}
          placeholder="Notas del screening (ratio ingreso/renta, observaciones del reporte...)"
          className={`${inputCls} resize-y`} />
        {results && (
          <button onClick={saveResults} disabled={busy}
            className="px-4 py-2 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-bold hover:bg-emerald-500/25 transition flex items-center gap-2 disabled:opacity-50">
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Guardar resultados
          </button>
        )}
      </div>

      {/* Report */}
      <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-white/[0.04]">
        <span className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Reporte:</span>
        {screening.report ? (
          <>
            <button onClick={downloadReport} disabled={busy}
              className="text-xs px-3 py-1.5 rounded-lg font-medium transition border bg-blue-500/10 text-blue-400 border-blue-500/25 hover:bg-blue-500/20 flex items-center gap-1.5 disabled:opacity-30">
              <Download className="w-3.5 h-3.5" /> {screening.report.filename}
              <span className="text-gray-500">({(screening.report.size / 1024).toFixed(0)} KB)</span>
            </button>
            <button onClick={() => fileRef.current?.click()} disabled={busy}
              className="text-xs px-3 py-1.5 rounded-lg font-medium transition border bg-white/[0.03] text-gray-400 border-white/[0.08] hover:text-white flex items-center gap-1.5 disabled:opacity-30">
              <FileUp className="w-3.5 h-3.5" /> Reemplazar
            </button>
          </>
        ) : (
          <button onClick={() => fileRef.current?.click()} disabled={busy}
            className="text-xs px-3 py-1.5 rounded-lg font-medium transition border bg-white/[0.03] text-gray-400 border-white/[0.08] hover:text-white flex items-center gap-1.5 disabled:opacity-30">
            <FileUp className="w-3.5 h-3.5" /> Subir PDF del reporte
          </button>
        )}
        <input ref={fileRef} type="file" accept="application/pdf,image/*" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) uploadReport(f); e.target.value = ''; }} />
      </div>
    </div>
  );
}

/** Compact badge for the applications list row */
export function ScreeningBadge({ screening }: { screening: Screening | null }) {
  if (!screening) return null;
  const st = SCREENING_STATUS[screening.status] || SCREENING_STATUS.requested;
  const rec = screening.results?.recommendation;
  const score = screening.results?.credit_score;
  return (
    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold border ${st.cls}`}>
      🔍 {st.label}{typeof score === 'number' ? ` · ${score}` : ''}{rec === 'approve' ? ' ✅' : rec === 'reject' ? ' ❌' : rec === 'conditional' ? ' ⚠️' : ''}
    </span>
  );
}
