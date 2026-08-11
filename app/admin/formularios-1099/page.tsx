'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useAdminAuth } from '../layout';
import {
  FileBarChart, RefreshCw, Download, Mail, Pencil, X, Save,
  AlertTriangle, CheckCircle2, Building2, Loader2,
} from 'lucide-react';

type Row = {
  provider_id: string; name: string; email: string;
  reportable: number; excluded: number; payments_count: number;
  needs_1099: boolean; w9_complete: boolean;
  w9: { legal_name: string; business_name: string; tax_classification: string;
    tin_type: string; tin_masked: string; address: string; city: string;
    state: string; zip: string };
};

type Payer = { name: string; ein: string; address: string; city: string; state: string; zip: string; phone: string };

const fmt = (n: number) => `$${(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
const CLASSIFICATIONS = ['Individual/sole proprietor', 'Single-member LLC', 'C Corporation', 'S Corporation', 'Partnership', 'LLC (C corp)', 'LLC (S corp)', 'LLC (Partnership)'];

export default function Formularios1099Page() {
  const { headers } = useAdminAuth() as any;
  const [year, setYear] = useState(new Date().getFullYear());
  const [rows, setRows] = useState<Row[]>([]);
  const [payer, setPayer] = useState<Payer | null>(null);
  const [payerComplete, setPayerComplete] = useState(true);
  const [totals, setTotals] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [w9Row, setW9Row] = useState<Row | null>(null);
  const [w9Form, setW9Form] = useState<any>({});
  const [payerModal, setPayerModal] = useState(false);
  const [payerForm, setPayerForm] = useState<Payer>({ name: '', ein: '', address: '', city: '', state: '', zip: '', phone: '' });
  const [busy, setBusy] = useState('');
  const [autoCopyB, setAutoCopyB] = useState<boolean | null>(null);

  const notify = (msg: string, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 4500); };

  const loadCopyBConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/1099/copyb-config', { headers: headers() });
      if (res.ok) setAutoCopyB((await res.json()).auto_send_copyb);
    } catch { /* noop */ }
  }, [headers]);

  useEffect(() => { loadCopyBConfig(); }, [loadCopyBConfig]);

  const toggleAutoCopyB = async () => {
    const next = !autoCopyB;
    setAutoCopyB(next);
    const res = await fetch('/api/admin/1099/copyb-config', {
      method: 'PUT', headers: { 'Content-Type': 'application/json', ...headers() },
      body: JSON.stringify({ auto_send_copyb: next }),
    });
    if (res.ok) notify(next ? '✅ Envío automático activado — Copy B se emailea el 15 de enero' : 'Modo manual: usa "Enviar Copy B ahora"');
    else { setAutoCopyB(!next); notify('Error al guardar', false); }
  };

  const sendCopyBBatch = async () => {
    if (!confirm(`¿Enviar ahora la Copy B ${year} por email a todos los contratistas con $600+ y W-9 completo? (los ya enviados se saltan)`)) return;
    setBusy('copyb-batch');
    try {
      const res = await fetch(`/api/admin/1099/copyb/send-batch?year=${year}`, { method: 'POST', headers: headers() });
      const d = await res.json();
      if (res.ok) notify(`📧 ${d.sent} enviadas · ${d.no_email} sin email · ${d.no_w9} sin W-9 · ${d.already_sent} ya enviadas — revisa tu inbox para el resumen`);
      else notify(d.detail || 'Error', false);
    } catch { notify('Error de red', false); }
    setBusy('');
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/1099/summary?year=${year}`, { headers: headers() });
      if (res.ok) {
        const d = await res.json();
        setRows(d.rows || []);
        setPayer(d.payer);
        setPayerComplete(d.payer_complete);
        setTotals(d.totals || {});
      }
    } catch { /* noop */ }
    setLoading(false);
  }, [year, headers]);

  useEffect(() => { load(); }, [load]);

  const openW9 = (r: Row) => {
    setW9Row(r);
    setW9Form({ ...r.w9, tin: '' });
  };

  const saveW9 = async () => {
    if (!w9Row) return;
    setBusy('w9');
    const body: any = { ...w9Form };
    if (!body.tin) delete body.tin; // no sobreescribir si no lo re-ingresó
    delete body.tin_masked;
    const res = await fetch(`/api/admin/1099/providers/${w9Row.provider_id}/w9`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json', ...headers() },
      body: JSON.stringify(body),
    });
    const d = await res.json();
    if (res.ok) { notify('W-9 guardado ✅'); setW9Row(null); load(); }
    else notify(d.detail || 'Error', false);
    setBusy('');
  };

  const savePayer = async () => {
    setBusy('payer');
    const res = await fetch('/api/admin/1099/payer', {
      method: 'PUT', headers: { 'Content-Type': 'application/json', ...headers() },
      body: JSON.stringify(payerForm),
    });
    if (res.ok) { notify('Datos del pagador guardados ✅'); setPayerModal(false); load(); }
    else notify('Error al guardar', false);
    setBusy('');
  };

  const download = async (r: Row) => {
    setBusy(`pdf-${r.provider_id}`);
    try {
      const res = await fetch(`/api/admin/1099/providers/${r.provider_id}/pdf?year=${year}`, { headers: headers() });
      if (!res.ok) { notify((await res.json()).detail || 'Error', false); setBusy(''); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `1099-NEC-${year}-${r.name.replace(/ /g, '_')}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } catch { notify('Error de red', false); }
    setBusy('');
  };

  const sendEmail = async (r: Row) => {
    if (!confirm(`¿Enviar el 1099-NEC ${year} a ${r.email}?`)) return;
    setBusy(`mail-${r.provider_id}`);
    const res = await fetch(`/api/admin/1099/providers/${r.provider_id}/email?year=${year}`, {
      method: 'POST', headers: headers(),
    });
    const d = await res.json();
    notify(res.ok ? d.message : (d.detail || 'Error'), res.ok);
    setBusy('');
  };

  const requestW9 = async (r: Row) => {
    if (!confirm(`¿Enviar a ${r.email} el link del W-9 digital para que lo complete desde su teléfono?`)) return;
    setBusy(`w9req-${r.provider_id}`);
    const res = await fetch(`/api/admin/1099/providers/${r.provider_id}/request-w9`, {
      method: 'POST', headers: headers(),
    });
    const d = await res.json();
    notify(res.ok ? `📩 ${d.message}` : (d.detail || 'Error'), res.ok);
    setBusy('');
  };

  const exportCsv = async () => {
    const res = await fetch(`/api/admin/1099/export/csv?year=${year}`, { headers: headers() });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `1099-NEC-${year}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const downloadAnnualReport = async () => {
    setBusy('annual-report');
    try {
      const res = await fetch(`/api/admin/reports/annual-tax?year=${year}`, { headers: headers() });
      if (!res.ok) { notify('No se pudo generar el reporte', false); setBusy(''); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `Reporte-Fiscal-${year}.pdf`; a.click();
      URL.revokeObjectURL(url);
      notify(`📊 Reporte fiscal ${year} descargado — listo para tu contador`);
    } catch { notify('Error de red', false); }
    setBusy('');
  };

  const years = Array.from({ length: 4 }, (_, i) => new Date().getFullYear() - i);

  return (
    <div className="space-y-5">
      {toast && (
        <div className={`fixed top-4 right-4 z-[70] px-4 py-3 rounded-xl text-sm font-bold shadow-xl ${toast.ok ? 'bg-emerald-500/90 text-white' : 'bg-red-500/90 text-white'}`}>{toast.msg}</div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2"><FileBarChart className="w-6 h-6 text-lime-400" /> Formularios 1099-NEC</h1>
          <p className="text-xs text-gray-500 mt-1">Pagos a contratistas del año — el IRS exige 1099-NEC si pagaste $600+ (cash/check/Zelle/wire). Pagos con tarjeta/PayPal/Venmo los reporta el procesador (1099-K).</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={year} onChange={e => setYear(parseInt(e.target.value))} className="px-3 py-2 bg-[#0a1020]/60 border border-white/[0.08] rounded-xl text-white text-sm focus:outline-none cursor-pointer">
            {years.map(y => <option key={y} value={y} className="bg-[#0d1526]">{y}</option>)}
          </select>
          <button onClick={exportCsv} className="flex items-center gap-1.5 px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-xl text-xs font-bold text-gray-300 hover:text-white transition"><Download className="w-3.5 h-3.5" /> CSV e-file</button>
          <button onClick={downloadAnnualReport} disabled={busy === 'annual-report'} data-testid="annual-tax-report-btn"
            className="flex items-center gap-1.5 px-3 py-2 bg-violet-500/15 text-violet-300 border border-violet-500/30 rounded-xl text-xs font-bold hover:bg-violet-500/25 transition disabled:opacity-50">
            {busy === 'annual-report' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileBarChart className="w-3.5 h-3.5" />} Reporte anual (contador)
          </button>
          <button onClick={() => { if (payer) setPayerForm(payer); setPayerModal(true); }} className="flex items-center gap-1.5 px-3 py-2 bg-lime-500/15 text-lime-300 border border-lime-500/30 rounded-xl text-xs font-bold hover:bg-lime-500/25 transition"><Building2 className="w-3.5 h-3.5" /> Mi LLC (pagador)</button>
        </div>
      </div>

      {!payerComplete && (
        <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/25 rounded-xl text-amber-300 text-xs font-bold">
          <AlertTriangle className="w-4 h-4 shrink-0" /> Falta el EIN de tu LLC — configúralo en &quot;Mi LLC (pagador)&quot; para que los formularios sean válidos.
        </div>
      )}

      {/* Envío automático de Copy B */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-white/[0.03] border border-cyan-500/20 rounded-2xl">
        <div>
          <div className="text-sm font-bold text-white">📧 Envío de Copy B a contratistas</div>
          <div className="text-[11px] text-gray-500 mt-0.5">
            {autoCopyB
              ? 'Automático: el 15 de enero se emailea la Copy B a cada contratista con $600+, W-9 completo y email. Recibirás un resumen con los pendientes de correo postal.'
              : 'Manual: usa el botón cuando quieras enviarlas. También te llega el resumen con los pendientes.'}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={toggleAutoCopyB} data-testid="copyb-auto-toggle" disabled={autoCopyB === null}
            className={`relative w-12 h-6 rounded-full transition ${autoCopyB ? 'bg-cyan-500' : 'bg-white/[0.1]'} disabled:opacity-40`}>
            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${autoCopyB ? 'left-6' : 'left-0.5'}`} />
          </button>
          <span className={`text-[11px] font-bold ${autoCopyB ? 'text-cyan-300' : 'text-gray-500'}`}>{autoCopyB ? 'Automático (15 ene)' : 'Manual'}</span>
          <button onClick={sendCopyBBatch} disabled={busy === 'copyb-batch'} data-testid="copyb-send-batch"
            className="flex items-center gap-1.5 px-3 py-2 bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 rounded-xl text-xs font-bold hover:bg-cyan-500/25 transition disabled:opacity-50">
            {busy === 'copyb-batch' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
            Enviar Copy B ahora
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="p-4 bg-white/[0.03] border border-white/[0.06] rounded-2xl"><div className="text-2xl font-bold text-lime-400">{totals.providers_needing_1099 ?? 0}</div><div className="text-[10px] text-gray-500 uppercase font-bold mt-1">Requieren 1099 ({year})</div></div>
        <div className="p-4 bg-white/[0.03] border border-white/[0.06] rounded-2xl"><div className={`text-2xl font-bold ${totals.missing_w9 ? 'text-amber-400' : 'text-emerald-400'}`}>{totals.missing_w9 ?? 0}</div><div className="text-[10px] text-gray-500 uppercase font-bold mt-1">W-9 faltantes</div></div>
        <div className="p-4 bg-white/[0.03] border border-white/[0.06] rounded-2xl"><div className="text-2xl font-bold text-white">{fmt(totals.total_reportable)}</div><div className="text-[10px] text-gray-500 uppercase font-bold mt-1">Total reportable</div></div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 text-gray-500 animate-spin" /></div>
      ) : rows.length === 0 ? (
        <p className="text-center text-gray-500 text-sm py-12">No hay pagos a proveedores registrados en {year}.<br />Registra pagos desde la sección Proveedores.</p>
      ) : (
        <div className="border border-white/[0.06] rounded-2xl overflow-hidden divide-y divide-white/[0.04]">
          {rows.map(r => (
            <div key={r.provider_id} className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-white/[0.02]">
              <div className="min-w-[160px]">
                <div className="font-bold text-sm text-white">{r.name}</div>
                <div className="text-[11px] text-gray-500">{r.email || 'sin email'} · {r.payments_count} pago(s)</div>
              </div>
              <div className="text-right">
                <div className="font-bold text-lime-400">{fmt(r.reportable)}</div>
                {r.excluded > 0 && <div className="text-[10px] text-gray-500">+{fmt(r.excluded)} vía tarjeta (1099-K)</div>}
              </div>
              {r.needs_1099
                ? <span className="text-[10px] px-2 py-0.5 rounded-full bg-lime-500/15 text-lime-300 border border-lime-500/30 font-bold">Requiere 1099</span>
                : <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-500/15 text-gray-400 border border-gray-500/30 font-bold">&lt; $600</span>}
              {r.w9_complete
                ? <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-bold"><CheckCircle2 className="w-3 h-3" /> W-9 {r.w9.tin_masked}</span>
                : <span className="flex items-center gap-1 text-[10px] text-amber-400 font-bold"><AlertTriangle className="w-3 h-3" /> Falta W-9</span>}
              <div className="flex-1" />
              {!r.w9_complete && r.email && (
                <button onClick={() => requestW9(r)} disabled={busy === `w9req-${r.provider_id}`} data-testid={`request-w9-${r.provider_id}`}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 transition disabled:opacity-40">
                  {busy === `w9req-${r.provider_id}` ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Mail className="w-3 h-3" />} Pedir W-9
                </button>
              )}
              <button onClick={() => openW9(r)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-white/[0.04] border border-white/[0.08] text-gray-300 hover:text-white transition"><Pencil className="w-3 h-3" /> W-9</button>
              <button onClick={() => download(r)} disabled={busy === `pdf-${r.provider_id}`} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/25 transition disabled:opacity-40">
                {busy === `pdf-${r.provider_id}` ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />} PDF
              </button>
              <button onClick={() => sendEmail(r)} disabled={busy === `mail-${r.provider_id}` || !r.email} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-violet-500/15 text-violet-300 border border-violet-500/30 hover:bg-violet-500/25 transition disabled:opacity-40">
                {busy === `mail-${r.provider_id}` ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Mail className="w-3 h-3" />} Enviar
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Modal W-9 */}
      {w9Row && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60] flex items-center justify-center p-4" onClick={() => setW9Row(null)}>
          <div onClick={e => e.stopPropagation()} className="bg-[#0d1526] border border-white/[0.1] rounded-2xl w-full max-w-lg p-6 space-y-3 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-white font-bold">W-9 — {w9Row.name}</h3>
              <button onClick={() => setW9Row(null)} className="text-gray-500 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <input value={w9Form.legal_name || ''} onChange={e => setW9Form({ ...w9Form, legal_name: e.target.value })} placeholder="Nombre legal (como en su declaración) *" className="w-full px-3 py-2.5 bg-[#0a1020]/60 border border-white/[0.08] rounded-xl text-white text-sm focus:border-lime-500 focus:outline-none" />
            <input value={w9Form.business_name || ''} onChange={e => setW9Form({ ...w9Form, business_name: e.target.value })} placeholder="Nombre del negocio / DBA (opcional)" className="w-full px-3 py-2.5 bg-[#0a1020]/60 border border-white/[0.08] rounded-xl text-white text-sm focus:border-lime-500 focus:outline-none" />
            <select value={w9Form.tax_classification || ''} onChange={e => setW9Form({ ...w9Form, tax_classification: e.target.value })} className="w-full px-3 py-2.5 bg-[#0a1020]/60 border border-white/[0.08] rounded-xl text-white text-sm focus:outline-none cursor-pointer">
              <option value="">Clasificación fiscal...</option>
              {CLASSIFICATIONS.map(c => <option key={c} value={c} className="bg-[#0d1526]">{c}</option>)}
            </select>
            <div className="flex gap-2">
              <select value={w9Form.tin_type || 'ssn'} onChange={e => setW9Form({ ...w9Form, tin_type: e.target.value })} className="w-24 px-2 py-2.5 bg-[#0a1020]/60 border border-white/[0.08] rounded-xl text-white text-sm focus:outline-none cursor-pointer">
                <option value="ssn" className="bg-[#0d1526]">SSN</option>
                <option value="ein" className="bg-[#0d1526]">EIN</option>
              </select>
              <input value={w9Form.tin || ''} onChange={e => setW9Form({ ...w9Form, tin: e.target.value })} placeholder={w9Row.w9.tin_masked ? `TIN guardado ${w9Row.w9.tin_masked} — escribir para cambiar` : 'TIN (9 dígitos) *'} className="flex-1 px-3 py-2.5 bg-[#0a1020]/60 border border-white/[0.08] rounded-xl text-white text-sm focus:border-lime-500 focus:outline-none" />
            </div>
            <input value={w9Form.address || ''} onChange={e => setW9Form({ ...w9Form, address: e.target.value })} placeholder="Dirección *" className="w-full px-3 py-2.5 bg-[#0a1020]/60 border border-white/[0.08] rounded-xl text-white text-sm focus:border-lime-500 focus:outline-none" />
            <div className="flex gap-2">
              <input value={w9Form.city || ''} onChange={e => setW9Form({ ...w9Form, city: e.target.value })} placeholder="Ciudad" className="flex-1 px-3 py-2.5 bg-[#0a1020]/60 border border-white/[0.08] rounded-xl text-white text-sm focus:border-lime-500 focus:outline-none" />
              <input value={w9Form.state || ''} onChange={e => setW9Form({ ...w9Form, state: e.target.value })} placeholder="Estado" className="w-20 px-3 py-2.5 bg-[#0a1020]/60 border border-white/[0.08] rounded-xl text-white text-sm focus:border-lime-500 focus:outline-none" />
              <input value={w9Form.zip || ''} onChange={e => setW9Form({ ...w9Form, zip: e.target.value })} placeholder="ZIP" className="w-24 px-3 py-2.5 bg-[#0a1020]/60 border border-white/[0.08] rounded-xl text-white text-sm focus:border-lime-500 focus:outline-none" />
            </div>
            <button onClick={saveW9} disabled={busy === 'w9'} className="w-full flex items-center justify-center gap-2 py-2.5 bg-lime-500/15 text-lime-300 border border-lime-500/30 rounded-xl text-sm font-bold hover:bg-lime-500/25 transition disabled:opacity-40">
              {busy === 'w9' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Guardar W-9
            </button>
          </div>
        </div>
      )}

      {/* Modal Payer */}
      {payerModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60] flex items-center justify-center p-4" onClick={() => setPayerModal(false)}>
          <div onClick={e => e.stopPropagation()} className="bg-[#0d1526] border border-white/[0.1] rounded-2xl w-full max-w-lg p-6 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-white font-bold flex items-center gap-2"><Building2 className="w-5 h-5 text-lime-400" /> Datos del pagador (tu LLC)</h3>
              <button onClick={() => setPayerModal(false)} className="text-gray-500 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <input value={payerForm.name} onChange={e => setPayerForm({ ...payerForm, name: e.target.value })} placeholder="Nombre legal de la LLC" className="w-full px-3 py-2.5 bg-[#0a1020]/60 border border-white/[0.08] rounded-xl text-white text-sm focus:border-lime-500 focus:outline-none" />
            <input value={payerForm.ein} onChange={e => setPayerForm({ ...payerForm, ein: e.target.value })} placeholder="EIN (XX-XXXXXXX) *" className="w-full px-3 py-2.5 bg-[#0a1020]/60 border border-white/[0.08] rounded-xl text-white text-sm focus:border-lime-500 focus:outline-none" />
            <input value={payerForm.address} onChange={e => setPayerForm({ ...payerForm, address: e.target.value })} placeholder="Dirección" className="w-full px-3 py-2.5 bg-[#0a1020]/60 border border-white/[0.08] rounded-xl text-white text-sm focus:border-lime-500 focus:outline-none" />
            <div className="flex gap-2">
              <input value={payerForm.city} onChange={e => setPayerForm({ ...payerForm, city: e.target.value })} placeholder="Ciudad" className="flex-1 px-3 py-2.5 bg-[#0a1020]/60 border border-white/[0.08] rounded-xl text-white text-sm focus:border-lime-500 focus:outline-none" />
              <input value={payerForm.state} onChange={e => setPayerForm({ ...payerForm, state: e.target.value })} placeholder="Estado" className="w-20 px-3 py-2.5 bg-[#0a1020]/60 border border-white/[0.08] rounded-xl text-white text-sm focus:border-lime-500 focus:outline-none" />
              <input value={payerForm.zip} onChange={e => setPayerForm({ ...payerForm, zip: e.target.value })} placeholder="ZIP" className="w-24 px-3 py-2.5 bg-[#0a1020]/60 border border-white/[0.08] rounded-xl text-white text-sm focus:border-lime-500 focus:outline-none" />
            </div>
            <input value={payerForm.phone} onChange={e => setPayerForm({ ...payerForm, phone: e.target.value })} placeholder="Teléfono" className="w-full px-3 py-2.5 bg-[#0a1020]/60 border border-white/[0.08] rounded-xl text-white text-sm focus:border-lime-500 focus:outline-none" />
            <button onClick={savePayer} disabled={busy === 'payer'} className="w-full flex items-center justify-center gap-2 py-2.5 bg-lime-500/15 text-lime-300 border border-lime-500/30 rounded-xl text-sm font-bold hover:bg-lime-500/25 transition disabled:opacity-40">
              {busy === 'payer' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Guardar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
