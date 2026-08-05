'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAdminAuth } from '../layout';
import {
  CreditCard, Plus, Search, DollarSign, CheckCircle2,
  Clock, RefreshCw, X, Save, Download, Edit3, Trash2,
  Zap, Filter, Calendar as CalendarIcon, Home, AlertTriangle, Sparkles,
  Bell, Mail, MessageSquare, Send, Square, CheckSquare,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
} from 'lucide-react';

const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

const STATUS_MAP: Record<string, { label: string; color: string; bg: string; ring: string }> = {
  completed: { label: 'Pagado', color: 'text-emerald-400', bg: 'bg-emerald-500/10', ring: 'ring-emerald-500/30' },
  paid: { label: 'Pagado', color: 'text-emerald-400', bg: 'bg-emerald-500/10', ring: 'ring-emerald-500/30' },
  pending: { label: 'Pendiente', color: 'text-amber-400', bg: 'bg-amber-500/10', ring: 'ring-amber-500/30' },
  late: { label: 'Atrasado', color: 'text-red-400', bg: 'bg-red-500/10', ring: 'ring-red-500/30' },
  partial: { label: 'Parcial', color: 'text-indigo-400', bg: 'bg-indigo-500/10', ring: 'ring-indigo-500/30' },
  cancelled: { label: 'Cancelado', color: 'text-gray-400', bg: 'bg-gray-500/10', ring: 'ring-gray-500/30' },
};

const METHOD_MAP: Record<string, string> = {
  cash: 'Efectivo', check: 'Cheque', money_order: 'Money Order',
  card: 'Tarjeta', ach: 'ACH/Banco', zelle: 'Zelle', venmo: 'Venmo',
  stripe: 'Stripe', other: 'Otro',
};

type FormState = {
  contract_id: string;
  amount: string;
  late_fee: string;
  payment_method: string;
  payment_date: string;
  due_date: string;
  period_year: string;
  period_month_num: string;
  notes: string;
  status: 'completed' | 'pending' | 'late' | 'partial' | 'cancelled';
};

const emptyForm = (): FormState => {
  const today = new Date();
  return {
    contract_id: '',
    amount: '',
    late_fee: '0',
    payment_method: 'cash',
    payment_date: today.toISOString().split('T')[0],
    due_date: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`,
    period_year: String(today.getFullYear()),
    period_month_num: String(today.getMonth() + 1),
    notes: '',
    status: 'pending',
  };
};

const monthName = (m: number) => ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'][m-1] || '';

export default function PagosPage() {
  const { headers } = useAdminAuth();
  const [payments, setPayments] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [yearFilter, setYearFilter] = useState<string>('all');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; tone: 'ok' | 'err' } | null>(null);

  // ─── Bulk operations (Sprint 2) ─────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [reminderChannel, setReminderChannel] = useState<'email' | 'sms' | 'both'>('email');
  const [reminderCustomMsg, setReminderCustomMsg] = useState('');
  const [sendingReminders, setSendingReminders] = useState(false);

  // ─── Server-side pagination (Sprint 2) ──────────────────────────────
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [serverStats, setServerStats] = useState<{
    paid_count?: number;
    pending_count?: number;
    total_completed?: number;
    total_pending?: number;
  }>({});
  const [availableYearsServer, setAvailableYearsServer] = useState<string[]>([]);
  // Debounced search to avoid hammering backend on each keystroke
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const showToast = (msg: string, tone: 'ok' | 'err' = 'ok') => {
    setToast({ msg, tone });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchAll = useCallback(async () => {
    try {
      const qs = new URLSearchParams({
        page: String(page),
        page_size: String(pageSize),
        status: statusFilter,
        year: yearFilter,
      });
      if (debouncedSearch) qs.set('search', debouncedSearch);

      const [payRes, cRes] = await Promise.all([
        fetch(`/api/admin/rental-payments?${qs.toString()}`, { headers: headers() }),
        fetch('/api/admin/rental-contracts', { headers: headers() }),
      ]);
      if (payRes.ok) {
        const d = await payRes.json();
        setPayments(d.payments || []);
        setTotalPages(d.total_pages || 1);
        setTotalCount(d.total ?? d.count ?? 0);
        setServerStats(d.stats || {});
        if (Array.isArray(d.available_years) && d.available_years.length) {
          setAvailableYearsServer(d.available_years);
        }
        // Clamp page if backend returned a smaller total_pages
        if (d.page && d.page !== page) setPage(d.page);
      }
      if (cRes.ok) { const d = await cRes.json(); setContracts(d.contracts || []); }
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [headers, page, pageSize, statusFilter, yearFilter, debouncedSearch]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const resetForm = () => {
    setForm(emptyForm());
    setEditingId(null);
    setShowForm(false);
  };

  const openCreate = () => {
    setForm(emptyForm());
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (p: any) => {
    const pd = p.payment_date ? new Date(p.payment_date).toISOString().split('T')[0] : '';
    const dd = p.due_date ? new Date(p.due_date).toISOString().split('T')[0] : '';
    setForm({
      contract_id: p.contract_id || '',
      amount: String(p.amount ?? ''),
      late_fee: String(p.late_fee ?? 0),
      payment_method: p.payment_method || 'cash',
      payment_date: pd,
      due_date: dd,
      period_year: String(p.period_year ?? new Date().getFullYear()),
      period_month_num: String(p.period_month_num ?? new Date().getMonth() + 1),
      notes: p.notes || '',
      status: (p.status || 'pending') as FormState['status'],
    });
    setEditingId(p._id);
    setShowForm(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const body = {
        ...form,
        amount: parseFloat(form.amount) || 0,
        late_fee: parseFloat(form.late_fee) || 0,
        period_year: parseInt(form.period_year, 10),
        period_month_num: parseInt(form.period_month_num, 10),
        period_month: monthName(parseInt(form.period_month_num, 10)),
        period: `${form.period_year}-${form.period_month_num.padStart(2, '0')}`,
      };
      const url = editingId
        ? `/api/admin/rental-payments/${editingId}`
        : '/api/admin/rental-payments';
      const method = editingId ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: headers(), body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.success !== false) {
        showToast(editingId ? '✅ Factura actualizada' : '✅ Factura creada');
        resetForm();
        await fetchAll();
      } else {
        showToast(`❌ ${data?.detail || data?.message || 'Error al guardar'}`, 'err');
      }
    } catch (e: any) {
      showToast(`❌ ${e?.message || 'Error de red'}`, 'err');
    }
    setSaving(false);
  };

  const handleMarkPaid = async (p: any) => {
    const today = new Date().toISOString().split('T')[0];
    const res = await fetch(`/api/admin/rental-payments/${p._id}`, {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify({
        status: 'completed',
        payment_date: today,
        payment_method: p.payment_method || 'cash',
      }),
    });
    if (res.ok) { showToast(`✅ Factura marcada como pagada`); fetchAll(); }
    else { showToast('❌ No se pudo actualizar', 'err'); }
  };

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/admin/rental-payments/${id}`, { method: 'DELETE', headers: headers() });
    if (res.ok) { showToast('🗑️ Factura eliminada'); setConfirmDelete(null); fetchAll(); }
    else { showToast('❌ No se pudo eliminar', 'err'); }
  };

  const handleGenerateMonthly = async () => {
    setGenerating(true);
    try {
      const res = await fetch('/api/admin/rental-payments/generate-monthly', {
        method: 'POST', headers: headers(),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const s = data.stats || {};
        showToast(`🪄 Generación: ${s.created || 0} creada(s) · ${s.already_exists || 0} ya existían · ${s.late_fee_applied || 0} con recargo`);
        await fetchAll();
      } else {
        showToast(`❌ ${data?.detail || 'Error'}`, 'err');
      }
    } catch (e: any) {
      showToast(`❌ ${e?.message}`, 'err');
    }
    setGenerating(false);
  };

  // Stats (use server-side aggregates so they reflect ALL filtered docs, not just current page)
  const totalCompleted = useMemo(
    () => serverStats.total_completed ?? payments
      .filter(p => ['completed','paid'].includes((p.status || '').toLowerCase()))
      .reduce((s, p) => s + (p.amount || 0) + (p.late_fee || 0), 0),
    [serverStats, payments]
  );
  const totalPending = useMemo(
    () => serverStats.total_pending ?? payments
      .filter(p => ['pending','late','partial'].includes((p.status || '').toLowerCase()))
      .reduce((s, p) => s + (p.amount || 0) + (p.late_fee || 0), 0),
    [serverStats, payments]
  );
  const pendingCount = useMemo(
    () => serverStats.pending_count ?? payments
      .filter(p => ['pending','late'].includes((p.status || '').toLowerCase())).length,
    [serverStats, payments]
  );

  const availableYears = useMemo(() => {
    if (availableYearsServer && availableYearsServer.length) return availableYearsServer;
    const ys = new Set<string>();
    payments.forEach(p => {
      if (p.period_year) ys.add(String(p.period_year));
      else if (p.payment_date) ys.add(String(new Date(p.payment_date).getFullYear()));
    });
    return Array.from(ys).sort().reverse();
  }, [payments, availableYearsServer]);

  // Backend already applies search/status/year filters — no client-side filtering needed.
  const filtered = payments;

  // Reset to page 1 whenever filters change
  useEffect(() => { setPage(1); }, [debouncedSearch, statusFilter, yearFilter, pageSize]);

  // Pending invoices currently visible (used for "select all pending")
  const visiblePendingIds = useMemo(() =>
    filtered
      .filter(p => ['pending','late','partial'].includes((p.status || '').toLowerCase()))
      .map(p => p._id as string)
  , [filtered]);

  const allVisiblePendingSelected = visiblePendingIds.length > 0 &&
    visiblePendingIds.every(id => selectedIds.has(id));

  const toggleSelectAllPending = () => {
    if (allVisiblePendingSelected) {
      // Deselect all visible pending
      setSelectedIds(prev => {
        const next = new Set(prev);
        visiblePendingIds.forEach(id => next.delete(id));
        return next;
      });
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev);
        visiblePendingIds.forEach(id => next.add(id));
        return next;
      });
    }
  };

  const openReminderModal = () => {
    if (selectedIds.size === 0) {
      showToast('Selecciona al menos una factura pendiente', 'err');
      return;
    }
    setReminderChannel('email');
    setReminderCustomMsg('');
    setShowReminderModal(true);
  };

  const sendBulkReminders = async () => {
    if (selectedIds.size === 0) return;
    setSendingReminders(true);
    try {
      const res = await fetch('/api/admin/rental-payments/bulk-reminders', {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          payment_ids: Array.from(selectedIds),
          channel: reminderChannel,
          custom_message: reminderCustomMsg.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.success !== false) {
        const sent = (data.email_sent || 0) + (data.sms_sent || 0);
        const parts: string[] = [];
        if ((data.email_sent || 0) > 0) parts.push(`📧 ${data.email_sent} email${data.email_sent === 1 ? '' : 's'}`);
        if ((data.sms_sent || 0) > 0) parts.push(`📱 ${data.sms_sent} SMS`);
        if ((data.skipped_no_contact || 0) > 0) parts.push(`⚠️ ${data.skipped_no_contact} sin contacto`);
        if ((data.failed || 0) > 0) parts.push(`❌ ${data.failed} fallidos`);
        const summary = parts.length ? parts.join(' · ') : `${sent} enviados`;
        showToast(`✅ Recordatorios: ${summary}`);
        setShowReminderModal(false);
        clearSelection();
        await fetchAll();
      } else {
        showToast(`❌ ${data?.detail || 'Error al enviar recordatorios'}`, 'err');
      }
    } catch (e: any) {
      showToast(`❌ ${e?.message || 'Error de red'}`, 'err');
    }
    setSendingReminders(false);
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-3 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-6 relative pb-32">
      {/* Background glow */}
      <div className="fixed top-0 right-1/3 w-96 h-96 bg-amber-500/[0.025] rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-1/4 left-1/4 w-96 h-96 bg-red-500/[0.02] rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="relative w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500/20 to-amber-500/5 border border-amber-500/20 flex items-center justify-center shadow-[0_0_25px_rgba(245,158,11,0.15)]">
            <CreditCard className="w-6 h-6 text-amber-400" />
            <Sparkles className="absolute -top-1 -right-1 w-3 h-3 text-amber-300" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Facturas & Pagos</h2>
            <p className="text-sm text-gray-500">
              {totalCount} factura{totalCount === 1 ? '' : 's'} · {(serverStats.pending_count ?? pendingCount)} pendiente{(serverStats.pending_count ?? pendingCount) === 1 ? '' : 's'}
              {totalPages > 1 && ` · página ${page} de ${totalPages}`}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={fetchAll}
            className="p-2.5 border border-white/[0.08] rounded-xl text-gray-400 hover:bg-white/[0.04] transition"
            title="Refrescar"
          ><RefreshCw className="w-4 h-4" /></button>
          <button
            onClick={handleGenerateMonthly}
            disabled={generating}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-500/15 to-purple-500/15 text-indigo-300 border border-indigo-500/30 rounded-xl text-sm font-semibold hover:from-indigo-500/25 hover:to-purple-500/25 transition shadow-[0_0_18px_rgba(99,102,241,0.15)] disabled:opacity-50"
          >
            {generating ? <div className="w-4 h-4 border-2 border-indigo-300/30 border-t-indigo-300 rounded-full animate-spin" /> : <Zap className="w-4 h-4" />}
            Generar Renta del Mes
          </button>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-xl text-sm font-bold hover:opacity-90 transition shadow-[0_0_22px_rgba(245,158,11,0.35)]"
          >
            <Plus className="w-4 h-4" /> Nueva Factura
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          icon={<CheckCircle2 className="w-4 h-4 text-emerald-400" />}
          value={fmt(totalCompleted)}
          label="Cobrado total"
          tone="emerald"
        />
        <StatCard
          icon={<Clock className="w-4 h-4 text-amber-400" />}
          value={fmt(totalPending)}
          label="Por cobrar"
          tone="amber"
        />
        <StatCard
          icon={<AlertTriangle className="w-4 h-4 text-red-400" />}
          value={String(pendingCount)}
          label="Facturas pendientes"
          tone="red"
        />
        <StatCard
          icon={<CreditCard className="w-4 h-4 text-blue-400" />}
          value={String(payments.length)}
          label="Total registros"
          tone="blue"
        />
      </div>

      {/* Filters bar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar inquilino, propiedad o # recibo..."
            className="w-full pl-10 pr-4 py-2.5 bg-[#0C1220]/60 border border-white/[0.08] rounded-xl text-sm text-white focus:border-amber-500 focus:outline-none placeholder:text-gray-600"
          />
        </div>

        <FilterPill active={statusFilter === 'all'} onClick={() => setStatusFilter('all')}>Todas</FilterPill>
        <FilterPill active={statusFilter === 'pending'} onClick={() => setStatusFilter('pending')} tone="amber">Pendientes</FilterPill>
        <FilterPill active={statusFilter === 'paid'} onClick={() => setStatusFilter('paid')} tone="emerald">Pagadas</FilterPill>

        <select
          value={yearFilter}
          onChange={e => setYearFilter(e.target.value)}
          className="px-3 py-2 bg-[#0C1220]/60 border border-white/[0.08] rounded-xl text-sm text-white focus:border-amber-500 focus:outline-none appearance-none cursor-pointer"
        >
          <option value="all">Todos los años</option>
          {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={resetForm}>
          <div
            onClick={e => e.stopPropagation()}
            className="w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-gradient-to-br from-[#0a1020] to-[#070a14] rounded-2xl border border-amber-500/30 p-6 shadow-[0_0_60px_rgba(245,158,11,0.15)]"
          >
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center">
                  {editingId ? <Edit3 className="w-5 h-5 text-amber-400" /> : <Plus className="w-5 h-5 text-amber-400" />}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">{editingId ? 'Editar Factura' : 'Nueva Factura'}</h3>
                  <p className="text-xs text-gray-500">Renta mensual o cargo manual</p>
                </div>
              </div>
              <button onClick={resetForm} className="text-gray-500 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <FieldLabel label="Contrato" required>
                <select
                  value={form.contract_id}
                  onChange={e => {
                    const cid = e.target.value;
                    const c = contracts.find(x => x._id === cid);
                    setForm(f => ({
                      ...f,
                      contract_id: cid,
                      amount: c ? String(c.rent_amount || c.monthly_rent || '') : f.amount,
                    }));
                  }}
                  className="w-full px-3 py-2.5 bg-[#0a1020]/80 border border-white/[0.08] rounded-xl text-white text-sm focus:border-amber-500 focus:outline-none"
                  disabled={!!editingId}
                >
                  <option value="">Seleccionar...</option>
                  {contracts.filter(c => c.status === 'active' || c.status === 'activo').map(c => (
                    <option key={c._id} value={c._id}>
                      {(c.property_address || c.property_name || c.property_id || '?').slice(0,40)} — {c.tenant_name || c.tenant_id}
                    </option>
                  ))}
                </select>
              </FieldLabel>

              <FieldLabel label="Estado" required>
                <select
                  value={form.status}
                  onChange={e => setForm(f => ({ ...f, status: e.target.value as FormState['status'] }))}
                  className="w-full px-3 py-2.5 bg-[#0a1020]/80 border border-white/[0.08] rounded-xl text-white text-sm focus:border-amber-500 focus:outline-none"
                >
                  <option value="pending">⏳ Pendiente</option>
                  <option value="completed">✅ Pagado</option>
                  <option value="late">⚠️ Atrasado</option>
                  <option value="partial">🟣 Parcial</option>
                  <option value="cancelled">⛔ Cancelado</option>
                </select>
              </FieldLabel>

              <FieldLabel label="Monto ($)" required>
                <input
                  type="number"
                  step="0.01"
                  value={form.amount}
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-[#0a1020]/80 border border-white/[0.08] rounded-xl text-white text-sm focus:border-amber-500 focus:outline-none"
                  placeholder="1100"
                />
              </FieldLabel>

              <FieldLabel label="Recargo Tardío ($)">
                <input
                  type="number"
                  step="0.01"
                  value={form.late_fee}
                  onChange={e => setForm(f => ({ ...f, late_fee: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-[#0a1020]/80 border border-white/[0.08] rounded-xl text-white text-sm focus:border-amber-500 focus:outline-none"
                />
              </FieldLabel>

              <FieldLabel label="Año">
                <input
                  type="number"
                  value={form.period_year}
                  onChange={e => setForm(f => ({ ...f, period_year: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-[#0a1020]/80 border border-white/[0.08] rounded-xl text-white text-sm focus:border-amber-500 focus:outline-none"
                />
              </FieldLabel>

              <FieldLabel label="Mes (1-12)">
                <select
                  value={form.period_month_num}
                  onChange={e => setForm(f => ({ ...f, period_month_num: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-[#0a1020]/80 border border-white/[0.08] rounded-xl text-white text-sm focus:border-amber-500 focus:outline-none"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                    <option key={m} value={m}>{m} — {monthName(m)}</option>
                  ))}
                </select>
              </FieldLabel>

              <FieldLabel label="Fecha de Vencimiento">
                <input
                  type="date"
                  value={form.due_date}
                  onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-[#0a1020]/80 border border-white/[0.08] rounded-xl text-white text-sm focus:border-amber-500 focus:outline-none"
                />
              </FieldLabel>

              <FieldLabel label="Fecha de Pago">
                <input
                  type="date"
                  value={form.payment_date}
                  onChange={e => setForm(f => ({ ...f, payment_date: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-[#0a1020]/80 border border-white/[0.08] rounded-xl text-white text-sm focus:border-amber-500 focus:outline-none"
                />
              </FieldLabel>

              <FieldLabel label="Método de Pago">
                <select
                  value={form.payment_method}
                  onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-[#0a1020]/80 border border-white/[0.08] rounded-xl text-white text-sm focus:border-amber-500 focus:outline-none"
                >
                  {Object.entries(METHOD_MAP).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </FieldLabel>

              <FieldLabel label="Notas" className="sm:col-span-2">
                <input
                  type="text"
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-[#0a1020]/80 border border-white/[0.08] rounded-xl text-white text-sm focus:border-amber-500 focus:outline-none"
                  placeholder="Opcional — comentarios, descuentos, referencia..."
                />
              </FieldLabel>
            </div>

            <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-white/[0.06]">
              <button
                onClick={resetForm}
                className="px-4 py-2.5 border border-white/[0.08] rounded-xl text-sm text-gray-300 hover:bg-white/[0.04] transition"
              >Cancelar</button>
              <button
                onClick={handleSave}
                disabled={saving || !form.contract_id || !form.amount}
                className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-xl text-sm font-bold hover:opacity-90 disabled:opacity-30 shadow-[0_0_22px_rgba(245,158,11,0.35)] transition"
              >
                {saving ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <><Save className="w-4 h-4" /> {editingId ? 'Guardar Cambios' : 'Crear Factura'}</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* List */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-white/[0.02] rounded-2xl border border-white/[0.06]">
          <div className="w-16 h-16 mx-auto bg-amber-500/10 rounded-2xl flex items-center justify-center mb-4 ring-1 ring-amber-500/20">
            <CreditCard className="w-8 h-8 text-amber-400" />
          </div>
          <p className="text-gray-300 text-sm font-semibold">Sin facturas que mostrar</p>
          <p className="text-gray-500 text-xs mt-1">Crea una factura manualmente o usa &ldquo;Generar Renta del Mes&rdquo;</p>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Bulk select toolbar */}
          {visiblePendingIds.length > 0 && (
            <div className="flex items-center justify-between flex-wrap gap-2 px-3 py-2.5 bg-white/[0.02] border border-white/[0.06] rounded-xl">
              <button
                onClick={toggleSelectAllPending}
                className="flex items-center gap-2 text-xs font-bold text-gray-300 hover:text-white transition"
              >
                {allVisiblePendingSelected
                  ? <CheckSquare className="w-4 h-4 text-amber-400" />
                  : <Square className="w-4 h-4 text-gray-500" />}
                Seleccionar pendientes visibles
                <span className="text-[10px] text-gray-500 font-normal">
                  ({visiblePendingIds.length})
                </span>
              </button>
              {selectedIds.size > 0 && (
                <button
                  onClick={clearSelection}
                  className="text-[11px] text-gray-500 hover:text-gray-300 transition"
                >
                  Limpiar selección ({selectedIds.size})
                </button>
              )}
            </div>
          )}

          {filtered.map(p => {
            const st = STATUS_MAP[(p.status || 'completed').toLowerCase()] || STATUS_MAP.completed;
            const isPaid = ['completed','paid'].includes((p.status || '').toLowerCase());
            const isPending = ['pending','late','partial'].includes((p.status || '').toLowerCase());
            const isSelected = selectedIds.has(p._id);
            const total = (p.amount || 0) + (p.late_fee || 0);
            const periodLabel = p.period_year
              ? `${monthName(p.period_month_num || new Date(p.due_date || p.payment_date || Date.now()).getMonth() + 1)} ${p.period_year}`
              : (p.period_month && p.period_year ? `${p.period_month} ${p.period_year}` : '');

            return (
              <div
                key={p._id}
                className={`group relative overflow-hidden bg-white/[0.03] backdrop-blur-sm rounded-xl border ${isSelected ? 'border-amber-500/60 shadow-[0_0_20px_rgba(245,158,11,0.15)]' : 'border-white/[0.06]'} p-4 hover:border-amber-500/20 transition ring-1 ${st.ring}`}
              >
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-amber-500/30 to-transparent rounded-t-xl" />
                <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-amber-500/[0.04] rounded-full blur-2xl pointer-events-none" />

                <div className="relative z-10 flex items-center gap-3 flex-wrap">
                  {/* Bulk select checkbox (only for pending) */}
                  {isPending && (
                    <button
                      onClick={() => toggleSelect(p._id)}
                      title={isSelected ? 'Deseleccionar' : 'Seleccionar para acciones masivas'}
                      className="shrink-0 p-1 -m-1 rounded hover:bg-white/[0.06] transition"
                    >
                      {isSelected
                        ? <CheckSquare className="w-5 h-5 text-amber-400" />
                        : <Square className="w-5 h-5 text-gray-500" />}
                    </button>
                  )}

                  {/* Icon */}
                  <div className={`w-10 h-10 rounded-xl ${st.bg} flex items-center justify-center ring-1 ${st.ring} shrink-0`}>
                    <Home className={`w-4 h-4 ${st.color}`} />
                  </div>

                  {/* Main info */}
                  <div className="flex-1 min-w-[200px]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-white">{p.tenant_name || 'Inquilino'}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${st.bg} ${st.color}`}>
                        {st.label}
                      </span>
                      {p.auto_generated && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-indigo-500/10 text-indigo-300 ring-1 ring-indigo-500/20 inline-flex items-center gap-1">
                          <Zap className="w-2.5 h-2.5" /> Auto
                        </span>
                      )}
                      {(p.reminder_count || 0) > 0 && (
                        <span
                          className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-500/10 text-amber-300 ring-1 ring-amber-500/20 inline-flex items-center gap-1"
                          title={p.last_reminder_at ? `Último recordatorio: ${new Date(p.last_reminder_at).toLocaleString('es-ES')}` : ''}
                        >
                          <Bell className="w-2.5 h-2.5" /> {p.reminder_count}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-gray-500 mt-0.5">
                      {p.property_address || 'Sin dirección'}
                      {periodLabel && ` • ${periodLabel}`}
                      {p.receipt_number && ` • ${p.receipt_number}`}
                      {p.payment_method && isPaid && ` • ${METHOD_MAP[p.payment_method] || p.payment_method}`}
                    </div>
                    {p.notes && (
                      <div className="text-[11px] text-gray-400 mt-1 italic line-clamp-1">&ldquo;{p.notes}&rdquo;</div>
                    )}
                  </div>

                  {/* Amount */}
                  <div className="text-right shrink-0">
                    <div className={`font-bold text-base ${isPaid ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {fmt(total)}
                    </div>
                    {(p.late_fee || 0) > 0 && (
                      <div className="text-[10px] text-red-400">+{fmt(p.late_fee)} recargo</div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    {!isPaid && (
                      <button
                        onClick={() => handleMarkPaid(p)}
                        title="Marcar como pagada"
                        className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 ring-1 ring-emerald-500/20 transition"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => openEdit(p)}
                      title="Editar"
                      className="p-2 rounded-lg bg-white/[0.04] text-gray-300 hover:bg-white/[0.08] hover:text-white transition"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setConfirmDelete(p._id)}
                      title="Eliminar"
                      className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 ring-1 ring-red-500/20 transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── Pagination Controls ─── */}
      {(totalPages > 1 || totalCount > 10) && (
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 pb-4 px-1">
          <div className="text-xs text-gray-500">
            Mostrando <span className="text-gray-300 font-bold">{filtered.length}</span> de{' '}
            <span className="text-gray-300 font-bold">{totalCount}</span> factura{totalCount === 1 ? '' : 's'}
            {totalPages > 1 && (
              <> · página <span className="text-amber-400 font-bold">{page}</span> de {totalPages}</>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Page size selector */}
            <select
              value={pageSize}
              onChange={e => setPageSize(parseInt(e.target.value, 10) || 50)}
              className="px-2 py-1.5 bg-[#0C1220]/60 border border-white/[0.08] rounded-lg text-xs text-white focus:border-amber-500 focus:outline-none cursor-pointer"
              title="Facturas por página"
            >
              <option value="25">25 / página</option>
              <option value="50">50 / página</option>
              <option value="100">100 / página</option>
              <option value="200">200 / página</option>
            </select>

            {/* Page controls */}
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(1)}
                  disabled={page === 1}
                  className="p-1.5 border border-white/[0.08] rounded-lg text-gray-400 hover:bg-white/[0.04] hover:text-white transition disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Primera página"
                >
                  <ChevronsLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1.5 border border-white/[0.08] rounded-lg text-gray-400 hover:bg-white/[0.04] hover:text-white transition disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Página anterior"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs font-bold text-amber-300 min-w-[60px] text-center">
                  {page} / {totalPages}
                </div>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="p-1.5 border border-white/[0.08] rounded-lg text-gray-400 hover:bg-white/[0.04] hover:text-white transition disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Página siguiente"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPage(totalPages)}
                  disabled={page >= totalPages}
                  className="p-1.5 border border-white/[0.08] rounded-lg text-gray-400 hover:bg-white/[0.04] hover:text-white transition disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Última página"
                >
                  <ChevronsRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Confirm delete */}
      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setConfirmDelete(null)}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="w-full max-w-md bg-gradient-to-br from-[#0a1020] to-[#070a14] rounded-2xl border border-red-500/30 p-6 shadow-[0_0_40px_rgba(239,68,68,0.18)]"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">¿Eliminar factura?</h3>
                <p className="text-xs text-gray-400">Esta acción no se puede deshacer.</p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2.5 border border-white/[0.08] rounded-xl text-sm text-gray-300 hover:bg-white/[0.04] transition"
              >Cancelar</button>
              <button
                onClick={() => handleDelete(confirmDelete)}
                className="px-6 py-2.5 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl text-sm font-bold hover:opacity-90 transition shadow-[0_0_22px_rgba(239,68,68,0.35)]"
              >Eliminar</button>
            </div>
          </div>
        </div>
      )}

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

      {/* ─── Floating Bulk Action Bar ─── */}
      {selectedIds.size > 0 && !showReminderModal && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 px-4 py-3 rounded-2xl bg-gradient-to-br from-[#0a1020]/95 to-[#070a14]/95 backdrop-blur-xl border border-amber-500/30 shadow-[0_0_40px_rgba(245,158,11,0.25)] flex items-center gap-3 flex-wrap max-w-[95vw]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
              <CheckSquare className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <div className="text-sm font-bold text-white leading-tight">{selectedIds.size} factura{selectedIds.size === 1 ? '' : 's'} seleccionada{selectedIds.size === 1 ? '' : 's'}</div>
              <div className="text-[10px] text-gray-500">Acciones masivas</div>
            </div>
          </div>
          <div className="h-8 w-px bg-white/[0.08]" />
          <button
            onClick={openReminderModal}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-white text-sm font-bold hover:opacity-90 transition shadow-[0_0_18px_rgba(245,158,11,0.35)]"
          >
            <Bell className="w-4 h-4" /> Recordar pagos atrasados
          </button>
          <button
            onClick={clearSelection}
            className="p-2 rounded-xl border border-white/[0.08] text-gray-400 hover:text-white hover:bg-white/[0.04] transition"
            title="Limpiar selección"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ─── Bulk Reminder Modal ─── */}
      {showReminderModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => !sendingReminders && setShowReminderModal(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="w-full max-w-lg bg-gradient-to-br from-[#0a1020] to-[#070a14] rounded-2xl border border-amber-500/30 p-6 shadow-[0_0_60px_rgba(245,158,11,0.18)]"
          >
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
                  <Bell className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Enviar Recordatorios</h3>
                  <p className="text-xs text-gray-500">
                    {selectedIds.size} factura{selectedIds.size === 1 ? '' : 's'} pendiente{selectedIds.size === 1 ? '' : 's'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => !sendingReminders && setShowReminderModal(false)}
                className="text-gray-500 hover:text-white p-1 disabled:opacity-30"
                disabled={sendingReminders}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Channel picker */}
            <div className="mb-5">
              <label className="block text-[11px] font-bold text-gray-400 mb-2 uppercase tracking-wider">
                Canal de envío
              </label>
              <div className="grid grid-cols-3 gap-2">
                <ChannelOption
                  active={reminderChannel === 'email'}
                  onClick={() => setReminderChannel('email')}
                  icon={<Mail className="w-4 h-4" />}
                  label="Email"
                  hint="SendGrid"
                />
                <ChannelOption
                  active={reminderChannel === 'sms'}
                  onClick={() => setReminderChannel('sms')}
                  icon={<MessageSquare className="w-4 h-4" />}
                  label="SMS"
                  hint="Twilio"
                />
                <ChannelOption
                  active={reminderChannel === 'both'}
                  onClick={() => setReminderChannel('both')}
                  icon={<Send className="w-4 h-4" />}
                  label="Ambos"
                  hint="Email + SMS"
                />
              </div>
            </div>

            {/* Custom message */}
            <div className="mb-5">
              <label className="block text-[11px] font-bold text-gray-400 mb-2 uppercase tracking-wider">
                Mensaje personalizado (opcional)
              </label>
              <textarea
                value={reminderCustomMsg}
                onChange={e => setReminderCustomMsg(e.target.value)}
                rows={4}
                placeholder="Dejar vacío para usar el mensaje automático (incluye nombre, monto, mes y vencimiento por factura)"
                className="w-full px-3 py-2.5 bg-[#0a1020]/80 border border-white/[0.08] rounded-xl text-white text-sm focus:border-amber-500 focus:outline-none placeholder:text-gray-600 resize-none"
              />
              <p className="text-[10px] text-gray-500 mt-1.5">
                💡 Tip: si lo dejas vacío, cada inquilino recibe un mensaje personalizado con su monto y mes adeudado.
              </p>
            </div>

            {/* Warning if no contact info */}
            <div className="mb-5 p-3 rounded-xl bg-amber-500/[0.05] border border-amber-500/20">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="text-[11px] text-amber-200/90 leading-relaxed">
                  Las facturas sin email/teléfono se omitirán automáticamente. Las pagadas serán ignoradas. Se registrará un contador de recordatorios en cada factura.
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-white/[0.06]">
              <button
                onClick={() => setShowReminderModal(false)}
                disabled={sendingReminders}
                className="px-4 py-2.5 border border-white/[0.08] rounded-xl text-sm text-gray-300 hover:bg-white/[0.04] transition disabled:opacity-30"
              >Cancelar</button>
              <button
                onClick={sendBulkReminders}
                disabled={sendingReminders}
                className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-xl text-sm font-bold hover:opacity-90 disabled:opacity-30 shadow-[0_0_22px_rgba(245,158,11,0.35)] transition"
              >
                {sendingReminders ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <><Send className="w-4 h-4" /> Enviar a {selectedIds.size}</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Helpers ─────────────────────────────────────────────────────────── */

function StatCard({ icon, value, label, tone }: {
  icon: React.ReactNode;
  value: string;
  label: string;
  tone: 'emerald' | 'amber' | 'red' | 'blue';
}) {
  const palette = {
    emerald: { from: 'from-emerald-500/[0.10]', border: 'border-emerald-500/25', bar: 'from-emerald-500 to-emerald-400', glow: 'bg-emerald-500/[0.08]', chipBg: 'bg-emerald-500/15', chipRing: 'ring-emerald-500/25' },
    amber:   { from: 'from-amber-500/[0.10]',   border: 'border-amber-500/25',   bar: 'from-amber-500 to-amber-400',     glow: 'bg-amber-500/[0.08]',   chipBg: 'bg-amber-500/15',   chipRing: 'ring-amber-500/25' },
    red:     { from: 'from-red-500/[0.10]',     border: 'border-red-500/25',     bar: 'from-red-500 to-red-400',         glow: 'bg-red-500/[0.08]',     chipBg: 'bg-red-500/15',     chipRing: 'ring-red-500/25' },
    blue:    { from: 'from-blue-500/[0.10]',    border: 'border-blue-500/25',    bar: 'from-blue-500 to-blue-400',       glow: 'bg-blue-500/[0.08]',    chipBg: 'bg-blue-500/15',    chipRing: 'ring-blue-500/25' },
  }[tone];

  return (
    <div className={`relative overflow-hidden bg-gradient-to-br ${palette.from} to-transparent rounded-2xl border ${palette.border} p-4 group`}>
      <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${palette.bar} rounded-t-2xl`} />
      <div className={`absolute -bottom-6 -right-6 w-24 h-24 ${palette.glow} rounded-full blur-2xl pointer-events-none group-hover:scale-110 transition-transform`} />
      <div className="relative z-10">
        <div className={`w-9 h-9 rounded-lg ${palette.chipBg} flex items-center justify-center ring-1 ${palette.chipRing} mb-2`}>
          {icon}
        </div>
        <div className="text-xl font-bold text-white">{value}</div>
        <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">{label}</div>
      </div>
    </div>
  );
}

function FilterPill({ children, active, onClick, tone }: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
  tone?: 'amber' | 'emerald';
}) {
  const activeStyles = tone === 'emerald'
    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
    : tone === 'amber'
      ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
      : 'bg-amber-500/15 text-amber-300 border-amber-500/30';
  return (
    <button
      onClick={onClick}
      className={`px-3 py-2 rounded-xl text-xs font-bold border transition ${
        active
          ? activeStyles
          : 'bg-white/[0.03] text-gray-400 border-white/[0.08] hover:bg-white/[0.06]'
      }`}
    >{children}</button>
  );
}

function FieldLabel({ label, required, className, children }: {
  label: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <label className="block text-[11px] font-bold text-gray-400 mb-1.5 uppercase tracking-wider">
        {label} {required && <span className="text-amber-500">*</span>}
      </label>
      {children}
    </div>
  );
}

function ChannelOption({ active, onClick, icon, label, hint }: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  hint: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl border transition ${
        active
          ? 'bg-amber-500/15 border-amber-500/40 shadow-[0_0_18px_rgba(245,158,11,0.2)]'
          : 'bg-white/[0.02] border-white/[0.08] hover:bg-white/[0.05]'
      }`}
    >
      <div className={active ? 'text-amber-400' : 'text-gray-400'}>{icon}</div>
      <div className={`text-xs font-bold ${active ? 'text-amber-300' : 'text-gray-300'}`}>{label}</div>
      <div className="text-[9px] text-gray-500 uppercase tracking-wider">{hint}</div>
    </button>
  );
}
