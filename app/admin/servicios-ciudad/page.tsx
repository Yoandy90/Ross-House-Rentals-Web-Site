'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useAdminAuth } from '../layout';
import {
  Droplets, RefreshCw, Plus, Trash2, Pencil, X, Save, ExternalLink,
  AlertTriangle, CheckCircle2, Loader2,
} from 'lucide-react';

type Account = {
  id: string; account_number: string; label: string; address: string;
  balance: number; due_date: string; status: string; active: boolean;
  last_checked_at: string; last_error?: string | null;
};

const fmt = (n: number) => `$${(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

export default function ServiciosCiudadPage() {
  const { headers } = useAdminAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [addModal, setAddModal] = useState(false);
  const [editAcc, setEditAcc] = useState<Account | null>(null);
  const [form, setForm] = useState({ account_number: '', last_payment_amount: '', label: '' });

  const notify = (msg: string, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 4500); };

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/city-utilities/accounts', { headers: headers() });
      if (res.ok) setAccounts((await res.json()).accounts);
    } catch { /* noop */ }
    setLoading(false);
  }, [headers]);

  useEffect(() => { load(); }, [load]);

  const syncAll = async () => {
    setBusy('sync');
    try {
      const res = await fetch('/api/admin/city-utilities/sync', { method: 'POST', headers: headers() });
      const d = await res.json();
      if (res.ok) { notify(`🔄 ${d.synced} cuenta(s) sincronizadas · ${d.with_debt} con saldo`); load(); }
      else notify(d.detail || 'Error', false);
    } catch { notify('Error de red', false); }
    setBusy('');
  };

  const addAccount = async () => {
    if (!form.account_number.trim() || !form.last_payment_amount.trim()) { notify('Cuenta y último pago requeridos', false); return; }
    setBusy('add');
    try {
      const res = await fetch('/api/admin/city-utilities/accounts', {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...headers() },
        body: JSON.stringify(form),
      });
      const d = await res.json();
      if (res.ok) { notify(`✅ Cuenta verificada: ${d.account.address}`); setAddModal(false); setForm({ account_number: '', last_payment_amount: '', label: '' }); load(); }
      else notify(d.detail || 'Error al verificar', false);
    } catch { notify('Error de red', false); }
    setBusy('');
  };

  const saveEdit = async () => {
    if (!editAcc) return;
    setBusy('edit');
    try {
      const res = await fetch(`/api/admin/city-utilities/accounts/${editAcc.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json', ...headers() },
        body: JSON.stringify({ label: editAcc.label, last_payment_amount: form.last_payment_amount || undefined }),
      });
      if (res.ok) { notify('✅ Guardado'); setEditAcc(null); setForm({ account_number: '', last_payment_amount: '', label: '' }); load(); }
      else notify((await res.json()).detail || 'Error', false);
    } catch { notify('Error de red', false); }
    setBusy('');
  };

  const remove = async (a: Account) => {
    if (!confirm(`¿Eliminar la cuenta ${a.account_number} (${a.label})?`)) return;
    const res = await fetch(`/api/admin/city-utilities/accounts/${a.id}`, { method: 'DELETE', headers: headers() });
    if (res.ok) { notify('Cuenta eliminada'); load(); } else notify('Error', false);
  };

  const totalDebt = accounts.reduce((s, a) => s + (a.status === 'ok' ? a.balance || 0 : 0), 0);

  const inputCls = 'w-full bg-white/[0.04] border border-white/[0.1] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500';

  return (
    <div className="space-y-5">
      {toast && (
        <div className={`fixed top-4 right-4 z-[80] px-4 py-3 rounded-xl text-sm font-bold shadow-xl ${toast.ok ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>{toast.msg}</div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2"><Droplets className="w-5 h-5 text-cyan-400" /> City de Dumas — Servicios</h1>
          <p className="text-xs text-gray-500 mt-0.5">Agua, basura y alcantarillado · monitoreo automático diario (8AM) con alertas por email</p>
        </div>
        <div className="flex gap-2">
          <a href="https://dumastx.municipalonlinepayments.com/dumastx/utilities/quickpay" target="_blank" rel="noreferrer"
            className="flex items-center gap-1.5 px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-xl text-xs font-bold text-gray-300 hover:text-white transition"><ExternalLink className="w-3.5 h-3.5" /> Portal de la ciudad</a>
          <button onClick={syncAll} disabled={busy === 'sync'} data-testid="sync-all-btn"
            className="flex items-center gap-1.5 px-3 py-2 bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 rounded-xl text-xs font-bold hover:bg-cyan-500/25 transition disabled:opacity-50">
            {busy === 'sync' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Sincronizar ahora
          </button>
          <button onClick={() => setAddModal(true)} data-testid="add-account-btn"
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-bold hover:bg-emerald-500/25 transition"><Plus className="w-3.5 h-3.5" /> Agregar cuenta</button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4">
          <div className="text-2xl font-bold text-white">{accounts.length}</div>
          <div className="text-[11px] text-gray-500 mt-0.5">Cuentas monitoreadas</div>
        </div>
        <div className={`rounded-2xl p-4 border ${totalDebt > 0 ? 'bg-red-500/[0.06] border-red-500/25' : 'bg-emerald-500/[0.06] border-emerald-500/20'}`}>
          <div className={`text-2xl font-bold ${totalDebt > 0 ? 'text-red-300' : 'text-emerald-300'}`}>{fmt(totalDebt)}</div>
          <div className="text-[11px] text-gray-500 mt-0.5">Saldo total adeudado</div>
        </div>
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4">
          <div className="text-2xl font-bold text-amber-300">{accounts.filter(a => a.status === 'verify_failed').length}</div>
          <div className="text-[11px] text-gray-500 mt-0.5">Requieren re-verificación</div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 text-cyan-400 animate-spin" /></div>
      ) : accounts.length === 0 ? (
        <div className="text-center py-16 bg-white/[0.02] border border-white/[0.05] rounded-2xl">
          <Droplets className="w-10 h-10 text-cyan-500/40 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Sin cuentas aún — agrega tu primera cuenta con el número de cuenta y el monto de tu último pago</p>
        </div>
      ) : (
        <div className="space-y-2">
          {accounts.map(a => (
            <div key={a.id} data-testid={`account-row-${a.account_number}`}
              className="flex flex-wrap items-center gap-3 p-4 bg-white/[0.03] border border-white/[0.06] rounded-2xl">
              <div className="flex-1 min-w-[180px]">
                <div className="text-sm font-bold text-white">{a.label || a.address}</div>
                <div className="text-[11px] text-gray-500">{a.account_number} · {a.address}</div>
              </div>
              <div className="text-right">
                <div className={`text-lg font-bold ${(a.balance || 0) > 0 ? 'text-red-300' : 'text-emerald-300'}`}>
                  {a.status === 'ok' ? fmt(a.balance) : '—'}
                </div>
                <div className="text-[10px] text-gray-500">{a.due_date ? `Vence ${a.due_date}` : ''}</div>
              </div>
              <div>
                {a.status === 'ok' && (a.balance || 0) === 0 && (
                  <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-300"><CheckCircle2 className="w-3.5 h-3.5" /> Al día</span>
                )}
                {a.status === 'ok' && (a.balance || 0) > 0 && (
                  <span className="flex items-center gap-1 text-[11px] font-bold text-red-300"><AlertTriangle className="w-3.5 h-3.5" /> Saldo pendiente</span>
                )}
                {a.status === 'verify_failed' && (
                  <span className="flex items-center gap-1 text-[11px] font-bold text-amber-300"><AlertTriangle className="w-3.5 h-3.5" /> Actualiza último pago</span>
                )}
                {a.status === 'error' && (
                  <span className="text-[11px] font-bold text-gray-400">Error de portal</span>
                )}
              </div>
              <div className="flex gap-1.5">
                <button onClick={() => { setEditAcc(a); setForm({ account_number: a.account_number, last_payment_amount: '', label: a.label }); }}
                  className="p-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-gray-400 hover:text-white transition"><Pencil className="w-3.5 h-3.5" /></button>
                <button onClick={() => remove(a)}
                  className="p-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-gray-400 hover:text-red-300 transition"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-[11px] text-gray-600">💡 La ciudad verifica con el monto de tu último pago registrado (sin el technology fee). Cuando pagues de nuevo, actualiza el monto aquí si la verificación falla. Pagos: portal (3% tarjeta), kiosko en City Hall, o tel. 1-888-401-4282.</p>

      {(addModal || editAcc) && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => { setAddModal(false); setEditAcc(null); }} />
          <div className="relative w-full max-w-md bg-[#0d1017] border border-white/[0.1] rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">{editAcc ? `Editar ${editAcc.account_number}` : 'Agregar cuenta de la ciudad'}</h3>
              <button onClick={() => { setAddModal(false); setEditAcc(null); }} className="p-1.5 rounded-lg bg-white/[0.05] text-gray-400 hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            {!editAcc && (
              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Número de cuenta (con guiones)</label>
                <input value={form.account_number} onChange={e => setForm(f => ({ ...f, account_number: e.target.value }))}
                  placeholder="17-09970-005" className={inputCls} data-testid="input-account-number" />
              </div>
            )}
            <div>
              <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">
                {editAcc ? 'Nuevo monto del último pago (opcional)' : 'Monto del último pago (sin tech fee)'}
              </label>
              <input value={form.last_payment_amount} onChange={e => setForm(f => ({ ...f, last_payment_amount: e.target.value }))}
                placeholder="136.29" className={inputCls} data-testid="input-last-payment" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Etiqueta (propiedad)</label>
              <input value={editAcc ? editAcc.label : form.label}
                onChange={e => editAcc ? setEditAcc({ ...editAcc, label: e.target.value }) : setForm(f => ({ ...f, label: e.target.value }))}
                placeholder="305 Bruce Ave" className={inputCls} />
            </div>
            <button onClick={editAcc ? saveEdit : addAccount} disabled={busy === 'add' || busy === 'edit'} data-testid="save-account-btn"
              className="w-full flex items-center justify-center gap-2 py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl text-sm transition disabled:opacity-50">
              {(busy === 'add' || busy === 'edit') ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {editAcc ? 'Guardar cambios' : 'Verificar y agregar'}
            </button>
            {!editAcc && <p className="text-[10px] text-gray-600">Se verifica en vivo contra el portal de la ciudad antes de guardar.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
