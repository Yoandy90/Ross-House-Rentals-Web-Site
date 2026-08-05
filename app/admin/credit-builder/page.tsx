'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAdminAuth } from '../layout';
import {
  CreditCard, Search, CheckCircle2, PauseCircle, XCircle, Send,
  TrendingUp, User, Phone, Mail, Calendar, FileText, AlertCircle,
  Trash2, Save, X, ChevronDown, ChevronUp,
} from 'lucide-react';

const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n);

interface Enrollment {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  user_phone: string;
  status: 'active' | 'paused' | 'cancelled';
  enrolled_at: string;
  bureaus: string[];
  payments_count: number;
  last_report: string | null;
  credit_score: number | null;
  notes: string;
}

export default function CreditBuilderAdminPage() {
  const { headers } = useAdminAuth();
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [stats, setStats] = useState({ total: 0, active: 0, paused: 0, cancelled: 0, reports_this_month: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [reportModal, setReportModal] = useState<Enrollment | null>(null);
  const [reportForm, setReportForm] = useState({ amount: '', period: '', notes: '' });
  const [reporting, setReporting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const r = await fetch('/api/admin/credit-builder/enrollments', { headers: headers() });
      if (r.ok) {
        const d = await r.json();
        setEnrollments(d.enrollments || []);
        setStats(d.stats || stats);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [headers]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const updateStatus = async (e: Enrollment, newStatus: string) => {
    if (!confirm(`¿Cambiar estado de ${e.user_name} a "${newStatus}"?`)) return;
    try {
      const r = await fetch(`/api/admin/credit-builder/enrollments/${e.id}`, {
        method: 'PATCH', headers: { ...headers(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (r.ok) fetchData();
    } catch (err: any) { alert(err?.message); }
  };

  const removeEnrollment = async (e: Enrollment) => {
    if (!confirm(`¿ELIMINAR PERMANENTEMENTE la inscripción de ${e.user_name}?\n\nEsto borra su historial completo. Si solo quieres dar de baja, usa "Pausar" o "Cancelar".`)) return;
    try {
      const r = await fetch(`/api/admin/credit-builder/enrollments/${e.id}`, { method: 'DELETE', headers: headers() });
      if (r.ok) fetchData();
    } catch (err: any) { alert(err?.message); }
  };

  const openReport = (e: Enrollment) => {
    const now = new Date();
    const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    setReportForm({ amount: '', period, notes: '' });
    setReportModal(e);
  };

  const submitReport = async () => {
    if (!reportModal) return;
    if (!reportForm.amount || parseFloat(reportForm.amount) <= 0) { alert('Monto requerido'); return; }
    setReporting(true);
    try {
      const r = await fetch(`/api/admin/credit-builder/enrollments/${reportModal.id}/report`, {
        method: 'POST', headers: { ...headers(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseFloat(reportForm.amount),
          period: reportForm.period,
          notes: reportForm.notes,
        }),
      });
      const d = await r.json();
      if (!r.ok) { alert(d.detail || 'Error'); setReporting(false); return; }
      alert(`✅ Reporte enviado (MOCKED)\n\nBurós: ${d.report.bureaus.join(', ')}\nMonto: ${fmt(d.report.amount)}\nPeríodo: ${d.report.period}\n\n⚠️ Este reporte es SIMULADO. Cuando conectes tu API real con Equifax/TransUnion/Experian, los reportes serán reales.`);
      setReportModal(null);
      fetchData();
    } catch (err: any) { alert(err?.message); }
    setReporting(false);
  };

  const filtered = enrollments.filter((e) => {
    if (statusFilter !== 'all' && e.status !== statusFilter) return false;
    if (!search) return true;
    const s = search.toLowerCase();
    return (e.user_name || '').toLowerCase().includes(s)
      || (e.user_email || '').toLowerCase().includes(s)
      || (e.user_phone || '').includes(s);
  });

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-3 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 border border-emerald-500/20 flex items-center justify-center">
            <CreditCard className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Credit Builder</h2>
            <p className="text-sm text-gray-500">Inscritos en reporting de renta a burós de crédito</p>
          </div>
        </div>
        <div className="text-[10px] px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 font-bold">
          ⚠️ MOCKED · Sin API real conectada
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Stat icon={<User className="w-4 h-4 text-emerald-400" />} label="TOTAL" value={stats.total} />
        <Stat icon={<CheckCircle2 className="w-4 h-4 text-emerald-400" />} label="ACTIVOS" value={stats.active} accent="emerald" />
        <Stat icon={<PauseCircle className="w-4 h-4 text-amber-400" />} label="PAUSADOS" value={stats.paused} accent="amber" />
        <Stat icon={<XCircle className="w-4 h-4 text-red-400" />} label="CANCELADOS" value={stats.cancelled} accent="red" />
        <Stat icon={<TrendingUp className="w-4 h-4 text-cyan-400" />} label="REPORTES MES" value={stats.reports_this_month} accent="cyan" />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white/[0.03] border border-white/[0.08] rounded-xl text-white text-sm focus:border-emerald-500 focus:outline-none"
            placeholder="Buscar por nombre, email, teléfono..." />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          style={{ colorScheme: 'dark' }}
          className="px-4 py-2.5 bg-white/[0.03] border border-white/[0.08] rounded-xl text-white text-sm focus:border-emerald-500 focus:outline-none">
          <option value="all">Todos los estados</option>
          <option value="active">✓ Activos</option>
          <option value="paused">⏸ Pausados</option>
          <option value="cancelled">✗ Cancelados</option>
        </select>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="bg-white/[0.03] rounded-2xl border border-white/[0.06] p-12 text-center">
          <CreditCard className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500">No hay inscripciones {statusFilter !== 'all' ? `${statusFilter}` : ''}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((e) => {
            const isExp = expanded === e.id;
            const statusColors: any = {
              active: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
              paused: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
              cancelled: 'bg-red-500/10 text-red-400 border-red-500/30',
            };
            return (
              <div key={e.id} className={`bg-white/[0.03] rounded-2xl border transition ${isExp ? 'border-emerald-500/20' : 'border-white/[0.06]'}`}>
                <div className="p-4 flex items-center gap-4">
                  <button onClick={() => setExpanded(isExp ? null : e.id)} className="flex-1 text-left flex items-center gap-4">
                    <div className="w-11 h-11 rounded-xl bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold">
                      {(e.user_name || '?').charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-white">{e.user_name || '(sin nombre)'}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold uppercase ${statusColors[e.status]}`}>{e.status}</span>
                        {e.credit_score && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 font-bold">
                            Score: {e.credit_score}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-gray-500 mt-1 flex-wrap">
                        {e.user_email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{e.user_email}</span>}
                        {e.user_phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{e.user_phone}</span>}
                        <span className="flex items-center gap-1"><FileText className="w-3 h-3" />{e.payments_count} reporte(s)</span>
                      </div>
                    </div>
                    {isExp ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                  </button>
                  <div className="flex items-center gap-1">
                    {e.status === 'active' && (
                      <button onClick={() => openReport(e)} title="Reportar pago a burós"
                        className="px-3 py-2 bg-emerald-500/15 border border-emerald-500/30 rounded-lg text-emerald-300 text-xs font-bold hover:bg-emerald-500/25 flex items-center gap-1.5">
                        <Send className="w-3.5 h-3.5" /> Reportar
                      </button>
                    )}
                  </div>
                </div>

                {isExp && (
                  <div className="border-t border-white/[0.06] p-4 space-y-3">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                      <Mini label="ESTADO" value={e.status} accent={e.status === 'active' ? 'emerald' : e.status === 'paused' ? 'amber' : 'red'} />
                      <Mini label="BURÓS" value={e.bureaus.length.toString()} sub={e.bureaus.slice(0, 2).join(', ')} accent="cyan" />
                      <Mini label="REPORTES" value={e.payments_count.toString()} accent="purple" />
                      <Mini label="ÚLTIMO" value={e.last_report ? new Date(e.last_report).toLocaleDateString('es-MX') : '—'} accent="blue" />
                    </div>

                    <div className="text-[11px] text-gray-400">
                      <p><Calendar className="inline w-3 h-3 mr-1" />Inscrito: <span className="text-white">{new Date(e.enrolled_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })}</span></p>
                      <p className="mt-1">Burós: <span className="text-white">{e.bureaus.join(' · ')}</span></p>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-2 border-t border-white/[0.06]">
                      {e.status !== 'active' && (
                        <button onClick={() => updateStatus(e, 'active')} className="px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-300 text-xs font-bold hover:bg-emerald-500/20">✓ Activar</button>
                      )}
                      {e.status === 'active' && (
                        <button onClick={() => updateStatus(e, 'paused')} className="px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-300 text-xs font-bold hover:bg-amber-500/20">⏸ Pausar</button>
                      )}
                      {e.status !== 'cancelled' && (
                        <button onClick={() => updateStatus(e, 'cancelled')} className="px-3 py-1.5 bg-red-500/10 border border-red-500/30 rounded-lg text-red-300 text-xs font-bold hover:bg-red-500/20">✗ Cancelar</button>
                      )}
                      <button onClick={() => removeEnrollment(e)} className="ml-auto px-3 py-1.5 bg-red-500/10 border border-red-500/30 rounded-lg text-red-300 text-xs font-bold hover:bg-red-500/20 flex items-center gap-1.5">
                        <Trash2 className="w-3.5 h-3.5" /> Eliminar registro
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Report Modal */}
      {reportModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setReportModal(null)}>
          <div onClick={(ev) => ev.stopPropagation()} className="bg-gray-900 border border-white/10 rounded-2xl p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">Reportar pago de renta</h3>
              <button onClick={() => setReportModal(null)} className="p-1 rounded-lg hover:bg-white/5 text-gray-400"><X className="w-5 h-5" /></button>
            </div>
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 mb-4 text-amber-300 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <p><strong>MODO MOCKED:</strong> Sin API real conectada con Equifax / TransUnion / Experian. Este reporte se guarda localmente como simulación. Cuando conectes tu API real, los reportes futuros serán reales automáticamente.</p>
            </div>
            <div className="space-y-3">
              <div className="text-sm text-gray-400">
                <p><strong className="text-white">{reportModal.user_name}</strong> · {reportModal.user_email}</p>
                <p className="text-[11px]">Burós configurados: {reportModal.bureaus.join(' · ')}</p>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-400 mb-1">Monto pagado *</label>
                <input type="number" step="0.01" value={reportForm.amount} onChange={(ev) => setReportForm({ ...reportForm, amount: ev.target.value })}
                  className="w-full px-3 py-2 bg-white/[0.03] border border-white/[0.08] rounded-lg text-white text-sm" placeholder="1200.00" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-400 mb-1">Período</label>
                <input type="text" value={reportForm.period} onChange={(ev) => setReportForm({ ...reportForm, period: ev.target.value })}
                  className="w-full px-3 py-2 bg-white/[0.03] border border-white/[0.08] rounded-lg text-white text-sm" placeholder="2026-06" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-400 mb-1">Notas (opcional)</label>
                <textarea value={reportForm.notes} onChange={(ev) => setReportForm({ ...reportForm, notes: ev.target.value })} rows={2}
                  className="w-full px-3 py-2 bg-white/[0.03] border border-white/[0.08] rounded-lg text-white text-sm" />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setReportModal(null)} disabled={reporting} className="flex-1 py-2.5 bg-white/5 border border-white/10 rounded-xl text-gray-300 text-sm font-bold">Cancelar</button>
                <button onClick={submitReport} disabled={reporting} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-emerald-500 hover:bg-emerald-600 rounded-xl text-white text-sm font-bold disabled:opacity-50">
                  {reporting ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Send className="w-4 h-4" /> Reportar a burós</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string | number; accent?: string }) {
  return (
    <div className="bg-white/[0.03] rounded-xl border border-white/[0.06] p-3 flex items-center gap-3">
      <div className={`w-9 h-9 rounded-lg bg-${accent || 'emerald'}-500/10 flex items-center justify-center`}>{icon}</div>
      <div>
        <div className="text-lg font-bold text-white">{value}</div>
        <div className="text-[10px] text-gray-500">{label}</div>
      </div>
    </div>
  );
}

function Mini({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent: string }) {
  return (
    <div className={`p-2 bg-${accent}-500/5 rounded-lg border border-${accent}-500/15`}>
      <p className={`text-sm font-bold text-${accent}-400 capitalize`}>{value}</p>
      <p className="text-[9px] text-gray-500">{label}</p>
      {sub && <p className="text-[9px] text-gray-600 mt-0.5 truncate">{sub}</p>}
    </div>
  );
}
