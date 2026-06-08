'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAdminAuth } from '../layout';
import {
  CreditCard, Plus, Search, Calendar, DollarSign, CheckCircle2,
  Clock, XCircle, RefreshCw, X, Save, ChevronDown, ChevronUp,
  Download, AlertTriangle, Home, Users,
} from 'lucide-react';

const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  completed: { label: 'Completado', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  pending: { label: 'Pendiente', color: 'text-amber-400', bg: 'bg-amber-500/10' },
  late: { label: 'Atrasado', color: 'text-red-400', bg: 'bg-red-500/10' },
  partial: { label: 'Parcial', color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
  cancelled: { label: 'Cancelado', color: 'text-gray-400', bg: 'bg-gray-500/10' },
};

const METHOD_MAP: Record<string, string> = {
  cash: 'Efectivo', check: 'Cheque', money_order: 'Money Order',
  card: 'Tarjeta', ach: 'ACH/Banco', zelle: 'Zelle', venmo: 'Venmo', other: 'Otro',
};

export default function PagosPage() {
  const { headers } = useAdminAuth();
  const [payments, setPayments] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ contract_id: '', amount: '', payment_method: 'cash', payment_date: new Date().toISOString().split('T')[0], notes: '', status: 'completed', covers_month: '' });

  const fetchAll = useCallback(async () => {
    try {
      const [payRes, cRes] = await Promise.all([
        fetch('/api/admin/rental-payments', { headers: headers() }),
        fetch('/api/admin/rental-contracts', { headers: headers() }),
      ]);
      if (payRes.ok) { const d = await payRes.json(); setPayments(d.payments || []); }
      if (cRes.ok) { const d = await cRes.json(); setContracts(d.contracts || []); }
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const resetForm = () => { setForm({ contract_id: '', amount: '', payment_method: 'cash', payment_date: new Date().toISOString().split('T')[0], notes: '', status: 'completed', covers_month: '' }); setShowForm(false); };

  const handleSave = async () => {
    setSaving(true);
    const body = { ...form, amount: parseFloat(form.amount) || 0 };
    const res = await fetch('/api/admin/rental-payments', { method: 'POST', headers: headers(), body: JSON.stringify(body) });
    if (res.ok) { resetForm(); fetchAll(); }
    setSaving(false);
  };

  // Stats
  const totalCompleted = payments.filter(p => p.status === 'completed').reduce((s, p) => s + (p.amount || 0), 0);
  const totalPending = payments.filter(p => p.status === 'pending' || p.status === 'late').reduce((s, p) => s + (p.amount || 0), 0);

  const filtered = payments.filter(p => !search || `${p.tenant_name} ${p.property_name}`.toLowerCase().includes(search.toLowerCase()));

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-3 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6 relative">
      <div className="fixed top-0 right-1/3 w-96 h-96 bg-amber-500/[0.02] rounded-full blur-3xl pointer-events-none" />

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500/20 to-amber-500/5 border border-amber-500/20 flex items-center justify-center"><CreditCard className="w-6 h-6 text-amber-400" /></div>
          <div><h2 className="text-2xl font-bold text-white">Pagos</h2><p className="text-sm text-gray-500">{payments.length} pago(s) registrado(s)</p></div>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchAll} className="p-2 border border-white/[0.08] rounded-lg text-gray-400 hover:bg-white/[0.04]"><RefreshCw className="w-3.5 h-3.5" /></button>
          <button onClick={() => { resetForm(); setShowForm(true); }} className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-lg text-sm font-semibold hover:bg-amber-500/20 transition"><Plus className="w-4 h-4" /> Registrar Pago</button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <div className="relative overflow-hidden bg-gradient-to-br from-emerald-500/[0.08] to-transparent rounded-2xl border border-emerald-500/20 p-4 group">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-t-2xl" />
          <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-emerald-500/[0.08] rounded-full blur-2xl pointer-events-none group-hover:bg-emerald-500/15 transition-all" />
          <div className="absolute -top-4 -left-4 w-16 h-16 bg-emerald-500/[0.05] rounded-full blur-xl pointer-events-none" />
          <div className="relative z-10"><div className="w-9 h-9 rounded-lg bg-emerald-500/15 flex items-center justify-center ring-1 ring-emerald-500/20 mb-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" /></div><div className="text-xl font-bold text-white">{fmt(totalCompleted)}</div><div className="text-[10px] text-gray-500 font-bold uppercase">Cobrado</div></div>
        </div>
        <div className="relative overflow-hidden bg-gradient-to-br from-amber-500/[0.08] to-transparent rounded-2xl border border-amber-500/20 p-4 group">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 to-amber-400 rounded-t-2xl" />
          <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-amber-500/[0.08] rounded-full blur-2xl pointer-events-none group-hover:bg-amber-500/15 transition-all" />
          <div className="absolute -top-4 -left-4 w-16 h-16 bg-amber-500/[0.05] rounded-full blur-xl pointer-events-none" />
          <div className="relative z-10"><div className="w-9 h-9 rounded-lg bg-amber-500/15 flex items-center justify-center ring-1 ring-amber-500/20 mb-2"><Clock className="w-4 h-4 text-amber-400" /></div><div className="text-xl font-bold text-white">{fmt(totalPending)}</div><div className="text-[10px] text-gray-500 font-bold uppercase">Pendiente</div></div>
        </div>
        <div className="relative overflow-hidden bg-gradient-to-br from-blue-500/[0.08] to-transparent rounded-2xl border border-blue-500/20 p-4 group">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-blue-400 rounded-t-2xl" />
          <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-blue-500/[0.08] rounded-full blur-2xl pointer-events-none group-hover:bg-blue-500/15 transition-all" />
          <div className="absolute -top-4 -left-4 w-16 h-16 bg-blue-500/[0.05] rounded-full blur-xl pointer-events-none" />
          <div className="relative z-10"><div className="w-9 h-9 rounded-lg bg-blue-500/15 flex items-center justify-center ring-1 ring-blue-500/20 mb-2"><CreditCard className="w-4 h-4 text-blue-400" /></div><div className="text-xl font-bold text-white">{payments.length}</div><div className="text-[10px] text-gray-500 font-bold uppercase">Total Registros</div></div>
        </div>
      </div>

      <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" /><input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por inquilino o propiedad..." className="w-full pl-10 pr-4 py-2.5 bg-[#0C1220]/60 border border-white/[0.08] rounded-xl text-sm text-white focus:border-amber-500 focus:outline-none placeholder:text-gray-600" /></div>

      {showForm && (
        <div className="bg-white/[0.03] backdrop-blur-xl rounded-2xl border border-amber-500/20 p-6">
          <div className="flex items-center justify-between mb-4"><h3 className="text-lg font-bold text-white">Registrar Pago</h3><button onClick={resetForm} className="text-gray-500 hover:text-white"><X className="w-5 h-5" /></button></div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div><label className="block text-xs font-bold text-gray-400 mb-1 uppercase tracking-wider">Contrato <span className="text-amber-500">*</span></label><select value={form.contract_id} onChange={e => setForm({...form, contract_id: e.target.value})} className="w-full px-3 py-2.5 bg-[#0a1020]/60 border border-white/[0.08] rounded-xl text-white text-sm focus:border-amber-500 focus:outline-none appearance-none"><option value="">Seleccionar...</option>{contracts.filter(c => c.status === 'active').map(c => <option key={c._id} value={c._id}>{c.property_name || c.property_id} - {c.tenant_name || c.tenant_id}</option>)}</select></div>
            <div><label className="block text-xs font-bold text-gray-400 mb-1 uppercase tracking-wider">Monto ($) <span className="text-amber-500">*</span></label><input type="number" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} className="w-full px-3 py-2.5 bg-[#0a1020]/60 border border-white/[0.08] rounded-xl text-white text-sm focus:border-amber-500 focus:outline-none" /></div>
            <div><label className="block text-xs font-bold text-gray-400 mb-1 uppercase tracking-wider">Método</label><select value={form.payment_method} onChange={e => setForm({...form, payment_method: e.target.value})} className="w-full px-3 py-2.5 bg-[#0a1020]/60 border border-white/[0.08] rounded-xl text-white text-sm focus:border-amber-500 focus:outline-none appearance-none">{Object.entries(METHOD_MAP).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select></div>
            <div><label className="block text-xs font-bold text-gray-400 mb-1 uppercase tracking-wider">Fecha</label><input type="date" value={form.payment_date} onChange={e => setForm({...form, payment_date: e.target.value})} className="w-full px-3 py-2.5 bg-[#0a1020]/60 border border-white/[0.08] rounded-xl text-white text-sm focus:border-amber-500 focus:outline-none" /></div>
            <div><label className="block text-xs font-bold text-gray-400 mb-1 uppercase tracking-wider">Cubre Mes</label><input type="month" value={form.covers_month} onChange={e => setForm({...form, covers_month: e.target.value})} className="w-full px-3 py-2.5 bg-[#0a1020]/60 border border-white/[0.08] rounded-xl text-white text-sm focus:border-amber-500 focus:outline-none" /></div>
            <div><label className="block text-xs font-bold text-gray-400 mb-1 uppercase tracking-wider">Notas</label><input type="text" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} className="w-full px-3 py-2.5 bg-[#0a1020]/60 border border-white/[0.08] rounded-xl text-white text-sm focus:border-amber-500 focus:outline-none" placeholder="Opcional" /></div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={resetForm} className="px-4 py-2 border border-white/[0.08] rounded-lg text-sm text-gray-400 hover:bg-white/[0.04]">Cancelar</button>
            <button onClick={handleSave} disabled={saving || !form.contract_id || !form.amount} className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-amber-600 to-amber-500 text-white rounded-lg text-sm font-bold hover:opacity-90 disabled:opacity-30 shadow-[0_0_15px_rgba(245,158,11,0.3)]">{saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Save className="w-4 h-4" /> Registrar</>}</button>
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="text-center py-12"><div className="w-16 h-16 mx-auto bg-amber-500/10 rounded-2xl flex items-center justify-center mb-4"><CreditCard className="w-8 h-8 text-amber-400" /></div><p className="text-gray-400 text-sm">No hay pagos registrados</p></div>
      ) : (
        <div className="space-y-2">
          {filtered.map(p => {
            const st = STATUS_MAP[p.status] || STATUS_MAP.completed;
            return (
              <div key={p._id} className="relative overflow-hidden bg-white/[0.03] backdrop-blur-sm rounded-xl border border-white/[0.06] p-4 flex items-center justify-between hover:border-amber-500/15 transition">
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-amber-500/30 to-transparent rounded-t-xl" />
                <div className="absolute -bottom-4 -right-4 w-16 h-16 bg-amber-500/[0.04] rounded-full blur-xl pointer-events-none" />
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-lg ${st.bg} flex items-center justify-center`}><DollarSign className={`w-4 h-4 ${st.color}`} /></div>
                  <div><div className="font-semibold text-sm text-white">{p.tenant_name || 'Inquilino'}</div><div className="text-[11px] text-gray-500">{p.property_name || ''} • {p.payment_date ? new Date(p.payment_date).toLocaleDateString('es-ES') : ''} • {METHOD_MAP[p.payment_method] || p.payment_method}</div></div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right"><div className="font-bold text-sm text-emerald-400">{fmt(p.amount || 0)}</div></div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${st.bg} ${st.color}`}>{st.label}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
