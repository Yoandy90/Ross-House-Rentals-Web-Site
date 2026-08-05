'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useAdminAuth } from '../../../admin/layout';
import { PAYMENT_METHODS, methodLabel } from './constants';

export function PaymentsSection({ provider }: { provider: any }) {
  const { token, headers } = useAdminAuth();
  const [data, setData] = useState<any>({ payments: [], total_paid: 0, total_pending: 0 });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`/api/admin/service-providers/${provider._id}/payments`, { headers: headers() });
      const d = await res.json();
      setData(d);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [provider._id, token, headers]);

  useEffect(() => { load(); }, [load]);

  if (loading) return null;

  return (
    <div className="mt-4">
      <h3 className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-2">💰 Pagos ({data.count || 0})</h3>
      <div className="bg-white/[0.02] border border-emerald-500/15 rounded-xl p-3 mb-2 grid grid-cols-2 gap-2">
        <div>
          <div className="text-[10px] text-gray-500">Total pagado</div>
          <div className="text-base font-bold text-emerald-300">${(data.total_paid || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
        </div>
        <div>
          <div className="text-[10px] text-gray-500">Pendiente</div>
          <div className="text-base font-bold text-amber-300">${(data.total_pending || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
        </div>
      </div>
      {(data.payments || []).length === 0 ? (
        <div className="text-xs text-gray-500 text-center py-3">Sin pagos registrados aún</div>
      ) : (
        <div className="space-y-1.5 max-h-72 overflow-y-auto">
          {data.payments.map((pay: any) => (
            <div key={pay._id} className="bg-white/[0.03] border border-white/10 rounded-lg p-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-emerald-300">${pay.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${pay.status === 'paid' ? 'bg-emerald-500/15 text-emerald-300' : pay.status === 'pending' ? 'bg-amber-500/15 text-amber-300' : 'bg-rose-500/15 text-rose-300'}`}>
                  {pay.status === 'paid' ? 'PAGADO' : pay.status === 'pending' ? 'PENDIENTE' : 'CANCELADO'}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1 text-gray-400 text-[11px] flex-wrap">
                <span>{methodLabel(pay.method)}</span>
                {pay.reference && <span>· Ref: {pay.reference}</span>}
                {pay.paid_at && <span>· {new Date(pay.paid_at).toLocaleDateString('es-MX')}</span>}
              </div>
              {pay.job_description && <div className="text-gray-500 text-[11px] mt-1">📋 {pay.job_description}</div>}
              {pay.notes && <div className="text-gray-500 text-[11px] mt-1 italic">{pay.notes}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function PaymentModal({ provider, onClose, onSaved }: { provider: any; onClose: () => void; onSaved: () => void }) {
  const { headers } = useAdminAuth();
  const [amount, setAmount] = useState<number>(0);
  const [method, setMethod] = useState('cash');
  const [reference, setReference] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<'paid' | 'pending'>('paid');
  const [notifyProvider, setNotifyProvider] = useState(true);
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (amount <= 0) { alert('Monto debe ser mayor a 0'); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/service-providers/${provider._id}/payments`, {
        method: 'POST', headers: headers(),
        body: JSON.stringify({
          amount, method, reference, job_description: jobDescription,
          notes, status, notify_provider: notifyProvider,
          paid_at: paidAt ? `${paidAt}T12:00:00.000Z` : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.detail || 'Failed');
      alert(`✅ Pago de $${amount.toFixed(2)} registrado.`);
      onSaved();
    } catch (e: any) { alert('Error: ' + e.message); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80" onClick={onClose} />
      <div className="relative w-full max-w-md bg-[#0a1020] border border-white/10 rounded-2xl p-6 max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-bold mb-1">💰 Registrar pago a {provider.name}</h3>
        <p className="text-xs text-gray-500 mb-4">Anota el pago. Si seleccionas notificar, se enviará confirmación por email/SMS.</p>

        <label className="block mb-3">
          <span className="text-xs text-gray-400 mb-1.5 block">Monto (USD)</span>
          <input type="number" min={0} step={0.01} value={amount || ''} onChange={e => setAmount(parseFloat(e.target.value || '0'))}
            placeholder="0.00"
            className="w-full px-3 py-3 bg-white/5 border border-white/10 rounded-lg text-2xl font-bold focus:border-emerald-500 outline-none" />
        </label>

        <label className="block mb-3">
          <span className="text-xs text-gray-400 mb-1.5 block">Método de pago</span>
          <div className="grid grid-cols-2 gap-1.5">
            {PAYMENT_METHODS.map(m => (
              <button key={m.id} type="button" onClick={() => setMethod(m.id)}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition border ${method === m.id ? 'bg-emerald-500/20 border-emerald-500 text-emerald-200' : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'}`}>
                {m.icon} {m.label}
              </button>
            ))}
          </div>
        </label>

        <div className="grid grid-cols-2 gap-2 mb-3">
          <label className="block">
            <span className="text-xs text-gray-400 mb-1.5 block">Fecha</span>
            <input type="date" value={paidAt} onChange={e => setPaidAt(e.target.value)} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm" />
          </label>
          <label className="block">
            <span className="text-xs text-gray-400 mb-1.5 block">Estado</span>
            <select value={status} onChange={e => setStatus(e.target.value as any)} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm">
              <option value="paid">Pagado ✅</option>
              <option value="pending">Pendiente ⏳</option>
            </select>
          </label>
        </div>

        <label className="block mb-3">
          <span className="text-xs text-gray-400 mb-1.5 block">Referencia / # cheque / # confirmación (opcional)</span>
          <input value={reference} onChange={e => setReference(e.target.value)} placeholder="Ej: Check #1234 o Zelle conf ABC" className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm" />
        </label>

        <label className="block mb-3">
          <span className="text-xs text-gray-400 mb-1.5 block">Concepto / Trabajo</span>
          <input value={jobDescription} onChange={e => setJobDescription(e.target.value)} placeholder="Ej: Reparación de tubería en 123 Main St" className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm" />
        </label>

        <label className="block mb-3">
          <span className="text-xs text-gray-400 mb-1.5 block">Notas internas (opcional)</span>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm" />
        </label>

        <label className="flex items-center gap-2 cursor-pointer mb-4 p-2 bg-emerald-500/5 rounded-lg border border-emerald-500/15">
          <input type="checkbox" checked={notifyProvider} onChange={e => setNotifyProvider(e.target.checked)} />
          <span className="text-sm">📧 Notificar al proveedor por email/SMS</span>
        </label>

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm">Cancelar</button>
          <button disabled={saving} onClick={save} className="flex-1 px-4 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 font-semibold text-sm disabled:opacity-50">
            {saving ? 'Guardando...' : `Registrar $${amount.toFixed(2)}`}
          </button>
        </div>
      </div>
    </div>
  );
}
