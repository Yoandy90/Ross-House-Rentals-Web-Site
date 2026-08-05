'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAdminAuth } from '../layout';
import {
  FileBarChart, Download, FileText, Users, Home, DollarSign,
  CreditCard, Calendar, Wrench, Filter, Printer, Table2,
  Sparkles, TrendingUp, FileSpreadsheet, ChevronRight,
} from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_RHR_API_URL || 'https://ross-house-backend-production.up.railway.app';

const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n);
const fmtMoney2 = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

type ReportType = 'revenue' | 'expenses' | 'tenants' | 'properties' | 'contracts' | 'maintenance';

const REPORTS: { key: ReportType; label: string; desc: string; icon: any; color: string }[] = [
  { key: 'revenue', label: 'Ingresos', desc: 'Pagos recibidos por período', icon: DollarSign, color: 'emerald' },
  { key: 'expenses', label: 'Gastos', desc: 'Gastos por categoría y propiedad', icon: CreditCard, color: 'red' },
  { key: 'tenants', label: 'Inquilinos', desc: 'Lista completa de inquilinos', icon: Users, color: 'violet' },
  { key: 'properties', label: 'Propiedades', desc: 'Inventario y estado', icon: Home, color: 'cyan' },
  { key: 'contracts', label: 'Contratos', desc: 'Contratos activos y vencidos', icon: FileText, color: 'amber' },
  { key: 'maintenance', label: 'Mantenimiento', desc: 'Solicitudes y resolución', icon: Wrench, color: 'blue' },
];

export default function ReportesPage() {
  const { headers } = useAdminAuth();
  const [selectedReport, setSelectedReport] = useState<ReportType>('revenue');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [columns, setColumns] = useState<string[]>([]);

  // ─── Professional financial reports (Sprint 2) ──────────────────────
  const [summary, setSummary] = useState<{
    rent_roll?: { units: number; monthly_rent: number; annualized_rent: number; outstanding: number };
    t12?: { income: number; expenses: number; noi: number; period_start: string; period_end: string };
  }>({});
  const [downloading, setDownloading] = useState<string | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const [asOfDate, setAsOfDate] = useState(today);
  const [t12EndDate, setT12EndDate] = useState(today);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`${API_BASE}/api/admin/reports/summary`, { headers: headers() });
        if (!r.ok) return;
        const d = await r.json();
        if (!cancelled) {
          setSummary({ rent_roll: d.rent_roll, t12: d.t12 });
        }
      } catch { /* silent */ }
    })();
    return () => { cancelled = true; };
  }, [headers]);

  const downloadReport = async (
    kind: 'rent-roll' | 't12',
    format: 'pdf' | 'xlsx',
  ) => {
    const key = `${kind}-${format}`;
    setDownloading(key);
    setReportError(null);
    try {
      const params = new URLSearchParams({ format });
      if (kind === 'rent-roll') params.set('as_of', asOfDate);
      if (kind === 't12') params.set('end_date', t12EndDate);
      const url = `${API_BASE}/api/admin/reports/${kind}?${params.toString()}`;
      const res = await fetch(url, { headers: headers() });
      if (!res.ok) {
        let msg = `Error ${res.status}`;
        try { const j = await res.json(); msg = j?.detail || msg; } catch { /* ignore */ }
        throw new Error(msg);
      }
      const blob = await res.blob();
      const dlUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = dlUrl;
      const dateRef = kind === 'rent-roll' ? asOfDate : t12EndDate;
      a.download = `${kind}_${dateRef}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(dlUrl), 5000);
    } catch (e: any) {
      setReportError(e?.message || 'Error al generar el reporte');
    }
    setDownloading(null);
  };

  const fetchReport = useCallback(async (type: ReportType) => {
    setLoading(true);
    setData([]);
    try {
      const endpoints: Record<ReportType, string> = {
        revenue: '/api/admin/rental-dashboard',
        expenses: '/api/admin/property-expenses',
        tenants: '/api/admin/tenants',
        properties: '/api/admin/properties',
        contracts: '/api/admin/rental-contracts',
        maintenance: '/api/admin/maintenance-requests',
      };
      const res = await fetch(endpoints[type], { headers: headers() });
      if (!res.ok) { setLoading(false); return; }
      const d = await res.json();

      let rows: any[] = [];
      let cols: string[] = [];
      switch (type) {
        case 'revenue':
          const dash = d.dashboard || {};
          rows = (dash.monthly_trend || []).map((m: any) => ({
            Mes: m.month, Ingresos: fmt(m.revenue || 0), Gastos: fmt(m.expenses || 0),
            Neto: fmt((m.revenue||0) - (m.expenses||0)), Pagos: m.payments || 0,
          }));
          cols = ['Mes', 'Ingresos', 'Gastos', 'Neto', 'Pagos'];
          break;
        case 'expenses':
          rows = (d.expenses || []).map((e: any) => ({
            Fecha: e.date ? new Date(e.date).toLocaleDateString('es-US') : '',
            Propiedad: e.property_name || '', Categoría: e.category || '',
            Descripción: e.description || '', Monto: fmt(e.amount || 0), Proveedor: e.vendor || '',
          }));
          cols = ['Fecha', 'Propiedad', 'Categoría', 'Descripción', 'Monto', 'Proveedor'];
          break;
        case 'tenants':
          rows = (d.tenants || []).map((t: any) => ({
            Nombre: t.name || '', Email: t.email || '', Teléfono: t.phone || '',
            Propiedad: t.property_name || t.property_address || '', Renta: fmt(t.rent_amount || t.monthly_rent || 0),
            Estado: t.status || 'active',
          }));
          cols = ['Nombre', 'Email', 'Teléfono', 'Propiedad', 'Renta', 'Estado'];
          break;
        case 'properties':
          rows = (d.properties || []).map((p: any) => ({
            Nombre: p.name || '', Dirección: p.address || '',
            Renta: fmt(p.monthly_rent || 0), Estado: p.status === 'occupied' ? 'Ocupada' : 'Vacante',
            Habitaciones: p.bedrooms || 0, Baños: p.bathrooms || 0, Propietario: p.owner_name || '',
          }));
          cols = ['Nombre', 'Dirección', 'Renta', 'Estado', 'Habitaciones', 'Baños', 'Propietario'];
          break;
        case 'contracts':
          rows = (d.contracts || []).map((c: any) => ({
            Inquilino: c.tenant_name || '', Propiedad: c.property_name || '',
            Inicio: c.start_date ? new Date(c.start_date).toLocaleDateString('es-US') : '',
            Fin: c.end_date ? new Date(c.end_date).toLocaleDateString('es-US') : '',
            Renta: fmt(c.rent_amount || c.monthly_rent || 0), Estado: c.status || '',
          }));
          cols = ['Inquilino', 'Propiedad', 'Inicio', 'Fin', 'Renta', 'Estado'];
          break;
        case 'maintenance':
          rows = (d.requests || []).map((r: any) => ({
            Título: r.title || '', Inquilino: r.tenant_name || '', Propiedad: r.property_name || '',
            Prioridad: r.priority || '', Estado: r.status || '',
            Fecha: r.created_at ? new Date(r.created_at).toLocaleDateString('es-US') : '',
          }));
          cols = ['Título', 'Inquilino', 'Propiedad', 'Prioridad', 'Estado', 'Fecha'];
          break;
      }
      setData(rows);
      setColumns(cols);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchReport(selectedReport); }, [selectedReport]);

  const exportCSV = () => {
    if (data.length === 0) return;
    const csv = [columns.join(','), ...data.map(row => columns.map(c => `"${(row[c] || '').toString().replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `reporte_${selectedReport}_${new Date().toISOString().slice(0,10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const printReport = () => {
    const printWin = window.open('', '_blank');
    if (!printWin) return;
    const report = REPORTS.find(r => r.key === selectedReport)!;
    printWin.document.write(`<html><head><title>Reporte ${report.label} - Ross House Rentals</title>
      <style>body{font-family:Arial,sans-serif;padding:20px}h1{color:#333;font-size:20px}h2{color:#666;font-size:14px;margin-bottom:20px}
      table{width:100%;border-collapse:collapse;font-size:12px}th{background:#1a1a2e;color:white;padding:8px;text-align:left}
      td{padding:6px 8px;border-bottom:1px solid #eee}tr:nth-child(even){background:#f9f9f9}
      .footer{margin-top:30px;font-size:10px;color:#999;text-align:center}</style></head><body>
      <h1>Ross House Rentals — Reporte de ${report.label}</h1><h2>Generado: ${new Date().toLocaleString('es-US')}</h2>
      <table><thead><tr>${columns.map(c => `<th>${c}</th>`).join('')}</tr></thead><tbody>
      ${data.map(row => `<tr>${columns.map(c => `<td>${row[c] || ''}</td>`).join('')}</tr>`).join('')}
      </tbody></table><p class="footer">Ross House Rentals LLC — (806) 934-2018</p></body></html>`);
    printWin.document.close();
    setTimeout(() => { printWin.print(); }, 500);
  };

  const report = REPORTS.find(r => r.key === selectedReport)!;

  return (
    <div className="space-y-5 relative">
      <div className="fixed top-0 left-1/3 w-96 h-96 bg-sky-500/[0.02] rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-500/20 to-sky-500/5 border border-sky-500/20 flex items-center justify-center">
            <FileBarChart className="w-6 h-6 text-sky-400" />
          </div>
          <div><h2 className="text-2xl font-bold text-white">Reportes</h2><p className="text-sm text-gray-500">Genera y exporta reportes en CSV o PDF</p></div>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCSV} disabled={data.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-sm font-bold hover:bg-emerald-500/20 transition disabled:opacity-30">
            <Download className="w-4 h-4" /> CSV
          </button>
          <button onClick={printReport} disabled={data.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-sky-500/10 border border-sky-500/20 rounded-xl text-sky-400 text-sm font-bold hover:bg-sky-500/20 transition disabled:opacity-30">
            <Printer className="w-4 h-4" /> Imprimir/PDF
          </button>
        </div>
      </div>

      {/* ─── Featured Financial Reports (Sprint 2) ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* RENT ROLL CARD */}
        <div className="relative overflow-hidden bg-gradient-to-br from-emerald-500/[0.06] via-white/[0.02] to-emerald-500/[0.02] rounded-2xl border border-emerald-500/20 p-5 backdrop-blur-sm">
          <div className="absolute -top-6 -right-6 w-32 h-32 bg-emerald-500/[0.08] rounded-full blur-3xl pointer-events-none" />
          <div className="relative flex items-start justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                <Home className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Rent Roll</h3>
                <p className="text-[11px] text-gray-500">Snapshot de unidades + rentas</p>
              </div>
            </div>
            <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-bold uppercase tracking-wider">
              <Sparkles className="w-2.5 h-2.5 inline mr-0.5" /> Lender-ready
            </span>
          </div>

          {summary.rent_roll && (
            <div className="grid grid-cols-3 gap-2 mb-4 relative">
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-2.5">
                <p className="text-[9px] text-gray-500 uppercase tracking-wider font-bold">Unidades</p>
                <p className="text-lg font-bold text-white mt-0.5">{summary.rent_roll.units}</p>
              </div>
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-2.5">
                <p className="text-[9px] text-gray-500 uppercase tracking-wider font-bold">Renta Mensual</p>
                <p className="text-lg font-bold text-emerald-400 mt-0.5">{fmt(summary.rent_roll.monthly_rent)}</p>
              </div>
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-2.5">
                <p className="text-[9px] text-gray-500 uppercase tracking-wider font-bold">GPR Anual</p>
                <p className="text-lg font-bold text-emerald-400 mt-0.5">{fmt(summary.rent_roll.annualized_rent)}</p>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 flex-wrap relative">
            <label className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mr-1">Al día:</label>
            <input
              type="date"
              value={asOfDate}
              onChange={e => setAsOfDate(e.target.value)}
              className="px-2 py-1.5 bg-[#0C1220]/60 border border-white/[0.08] rounded-lg text-xs text-white focus:border-emerald-500 focus:outline-none"
            />
            <div className="ml-auto flex gap-1.5">
              <button
                onClick={() => downloadReport('rent-roll', 'pdf')}
                disabled={downloading === 'rent-roll-pdf'}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 border border-red-500/25 text-red-300 rounded-lg text-xs font-bold hover:bg-red-500/20 transition disabled:opacity-50"
              >
                {downloading === 'rent-roll-pdf'
                  ? <div className="w-3 h-3 border-2 border-red-300/30 border-t-red-300 rounded-full animate-spin" />
                  : <FileText className="w-3.5 h-3.5" />} PDF
              </button>
              <button
                onClick={() => downloadReport('rent-roll', 'xlsx')}
                disabled={downloading === 'rent-roll-xlsx'}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 rounded-lg text-xs font-bold hover:bg-emerald-500/20 transition disabled:opacity-50"
              >
                {downloading === 'rent-roll-xlsx'
                  ? <div className="w-3 h-3 border-2 border-emerald-300/30 border-t-emerald-300 rounded-full animate-spin" />
                  : <FileSpreadsheet className="w-3.5 h-3.5" />} Excel
              </button>
            </div>
          </div>
        </div>

        {/* T-12 CARD */}
        <div className="relative overflow-hidden bg-gradient-to-br from-sky-500/[0.06] via-white/[0.02] to-sky-500/[0.02] rounded-2xl border border-sky-500/20 p-5 backdrop-blur-sm">
          <div className="absolute -top-6 -right-6 w-32 h-32 bg-sky-500/[0.08] rounded-full blur-3xl pointer-events-none" />
          <div className="relative flex items-start justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-sky-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">T-12 (Trailing 12 Months)</h3>
                <p className="text-[11px] text-gray-500">P&L mes a mes · NOI calculado</p>
              </div>
            </div>
            <span className="text-[9px] px-2 py-0.5 rounded-full bg-sky-500/15 border border-sky-500/30 text-sky-300 font-bold uppercase tracking-wider">
              <Sparkles className="w-2.5 h-2.5 inline mr-0.5" /> DSCR-ready
            </span>
          </div>

          {summary.t12 && (
            <div className="grid grid-cols-3 gap-2 mb-4 relative">
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-2.5">
                <p className="text-[9px] text-gray-500 uppercase tracking-wider font-bold">Ingresos</p>
                <p className="text-lg font-bold text-emerald-400 mt-0.5">{fmt(summary.t12.income)}</p>
              </div>
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-2.5">
                <p className="text-[9px] text-gray-500 uppercase tracking-wider font-bold">Gastos</p>
                <p className="text-lg font-bold text-red-400 mt-0.5">{fmt(summary.t12.expenses)}</p>
              </div>
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-2.5">
                <p className="text-[9px] text-gray-500 uppercase tracking-wider font-bold">NOI</p>
                <p className={`text-lg font-bold mt-0.5 ${(summary.t12.noi || 0) >= 0 ? 'text-sky-400' : 'text-red-400'}`}>
                  {fmt(summary.t12.noi)}
                </p>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 flex-wrap relative">
            <label className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mr-1">Final:</label>
            <input
              type="date"
              value={t12EndDate}
              onChange={e => setT12EndDate(e.target.value)}
              className="px-2 py-1.5 bg-[#0C1220]/60 border border-white/[0.08] rounded-lg text-xs text-white focus:border-sky-500 focus:outline-none"
            />
            <div className="ml-auto flex gap-1.5">
              <button
                onClick={() => downloadReport('t12', 'pdf')}
                disabled={downloading === 't12-pdf'}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 border border-red-500/25 text-red-300 rounded-lg text-xs font-bold hover:bg-red-500/20 transition disabled:opacity-50"
              >
                {downloading === 't12-pdf'
                  ? <div className="w-3 h-3 border-2 border-red-300/30 border-t-red-300 rounded-full animate-spin" />
                  : <FileText className="w-3.5 h-3.5" />} PDF
              </button>
              <button
                onClick={() => downloadReport('t12', 'xlsx')}
                disabled={downloading === 't12-xlsx'}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-500/10 border border-sky-500/25 text-sky-300 rounded-lg text-xs font-bold hover:bg-sky-500/20 transition disabled:opacity-50"
              >
                {downloading === 't12-xlsx'
                  ? <div className="w-3 h-3 border-2 border-sky-300/30 border-t-sky-300 rounded-full animate-spin" />
                  : <FileSpreadsheet className="w-3.5 h-3.5" />} Excel
              </button>
            </div>
          </div>
        </div>
      </div>

      {reportError && (
        <div className="px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/25 text-red-300 text-xs">
          ❌ {reportError}
        </div>
      )}

      {/* Report selector */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2">
        {REPORTS.map(r => {
          const RIcon = r.icon;
          const active = selectedReport === r.key;
          return (
            <button key={r.key} onClick={() => setSelectedReport(r.key)}
              className={`p-3 rounded-xl border text-left transition ${active ? `bg-${r.color}-500/10 border-${r.color}-500/25` : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04]'}`}>
              <RIcon className={`w-5 h-5 ${active ? `text-${r.color}-400` : 'text-gray-500'} mb-1.5`} />
              <p className={`text-xs font-bold ${active ? 'text-white' : 'text-gray-400'}`}>{r.label}</p>
              <p className="text-[10px] text-gray-500">{r.desc}</p>
            </button>
          );
        })}
      </div>

      {/* Data Table */}
      <div className="bg-white/[0.03] backdrop-blur-sm rounded-2xl border border-white/[0.06] overflow-hidden">
        <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Table2 className="w-4 h-4 text-sky-400" />
            <h3 className="text-sm font-bold text-white">Reporte de {report.label}</h3>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.06] text-gray-400">{data.length} registros</span>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48"><div className="w-6 h-6 border-2 border-sky-500/30 border-t-sky-500 rounded-full animate-spin" /></div>
        ) : data.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-gray-600">Sin datos para este reporte</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-white/[0.02]">
                  {columns.map(c => (
                    <th key={c} className="text-left py-3 px-4 text-[10px] text-gray-500 font-bold uppercase tracking-wider whitespace-nowrap">{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((row, i) => (
                  <tr key={i} className="border-t border-white/[0.03] hover:bg-white/[0.02] transition">
                    {columns.map(c => (
                      <td key={c} className="py-2.5 px-4 text-gray-300 whitespace-nowrap">{row[c] || '-'}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
