'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useAdminAuth } from '../layout';
import {
  Landmark, RefreshCw, ExternalLink, CheckCircle2, AlertTriangle,
  Loader2, CreditCard, Clock,
} from 'lucide-react';

type YearDue = {
  year: number;
  taxable_value: number;
  base_tax: number;
  base_paid: number;
  base_due: number;
  penalty_interest: number;
  attorney_fees: number;
  amount_due: number;
};

type TaxStatus = {
  account_id: string;
  status: string; // current | delinquent | unknown
  total_due: number;
  years_due: YearDue[];
  portal_url: string;
  last_synced_at: string;
};

type PropTax = {
  property_id: string;
  address: string;
  account_id: string;
  tax_annual_estimate: number;
  tax_status: TaxStatus | null;
};

const fmt = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function ImpuestosPage() {
  const { headers } = useAdminAuth();
  const [items, setItems] = useState<PropTax[]>([]);
  const [totalDue, setTotalDue] = useState(0);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/property-taxes', { headers: headers() });
      if (res.ok) {
        const d = await res.json();
        setItems(d.properties || []);
        setTotalDue(d.total_due || 0);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [headers]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const syncNow = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/admin/property-taxes/sync', { method: 'POST', headers: headers() });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        setToast({ msg: `Sincronizado: ${d.synced_count} cuenta(s) desde el portal del condado`, ok: true });
        await fetchData();
      } else {
        setToast({ msg: d.detail || 'Error al sincronizar', ok: false });
      }
    } catch (e) { setToast({ msg: 'Error de conexión', ok: false }); }
    setSyncing(false);
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-3 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
    </div>
  );

  const neverSynced = items.length > 0 && items.every(i => !i.tax_status);

  return (
    <div className="space-y-5">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl border backdrop-blur-md text-sm font-medium shadow-2xl ${
          toast.ok ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300' : 'bg-red-500/15 border-red-500/30 text-red-300'
        }`}>{toast.msg}</div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500/20 to-amber-500/5 border border-orange-500/20 flex items-center justify-center">
            <Landmark className="w-6 h-6 text-orange-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Impuestos de Propiedad</h2>
            <p className="text-sm text-gray-500">Deuda real en vivo · Moore County Tax Office (esearch.co.moore.tx.us)</p>
          </div>
        </div>
        <button onClick={syncNow} disabled={syncing} data-testid="sync-taxes-btn"
          className="px-4 py-2 bg-orange-500/15 text-orange-400 border border-orange-500/30 rounded-xl text-xs font-bold hover:bg-orange-500/25 transition flex items-center gap-2 disabled:opacity-50">
          {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          {syncing ? 'Consultando al condado...' : 'Sincronizar ahora'}
        </button>
      </div>

      {/* Total due banner */}
      {totalDue > 0 ? (
        <div className="bg-red-500/10 border border-red-500/25 rounded-2xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-6 h-6 text-red-400 flex-shrink-0" />
          <div>
            <div className="text-lg font-bold text-red-300">Deuda total con el condado: {fmt(totalDue)}</div>
            <div className="text-xs text-gray-400">Incluye penalidades, intereses y honorarios de abogado. El interés sube ~1% cada mes — paga cuanto antes.</div>
          </div>
        </div>
      ) : !neverSynced && (
        <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-2xl p-4 flex items-center gap-3">
          <CheckCircle2 className="w-6 h-6 text-emerald-400 flex-shrink-0" />
          <div className="text-sm font-bold text-emerald-300">Todas las propiedades están al día con el condado ✅</div>
        </div>
      )}

      {neverSynced && (
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 text-center text-sm text-gray-400">
          Aún no se ha sincronizado con el portal del condado. Pulsa <b className="text-orange-400">Sincronizar ahora</b>.
        </div>
      )}

      {/* Property cards */}
      <div className="space-y-4">
        {items.map(it => {
          const st = it.tax_status;
          const delinquent = st?.status === 'delinquent';
          return (
            <div key={it.property_id} className={`bg-white/[0.03] rounded-2xl border p-4 space-y-3 ${
              delinquent ? 'border-red-500/25' : 'border-white/[0.06]'
            }`}>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-white">{it.address}</div>
                  <div className="text-[11px] text-gray-500">
                    Cuenta #{it.account_id || '—'} · estimado anual ${Number(it.tax_annual_estimate).toLocaleString()}
                    {st?.last_synced_at && (
                      <span className="ml-2 inline-flex items-center gap-1">
                        <Clock className="w-3 h-3" /> sync {new Date(st.last_synced_at).toLocaleString('es-US', { dateStyle: 'short', timeStyle: 'short' })}
                      </span>
                    )}
                  </div>
                </div>
                {st ? (
                  delinquent ? (
                    <span className="text-xs px-3 py-1.5 rounded-full font-bold bg-red-500/15 text-red-300 border border-red-500/30">
                      🔴 VENCIDO · {fmt(st.total_due)}
                    </span>
                  ) : (
                    <span className="text-xs px-3 py-1.5 rounded-full font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                      ✅ Al día
                    </span>
                  )
                ) : (
                  <span className="text-xs px-3 py-1.5 rounded-full font-bold bg-gray-500/15 text-gray-400 border border-gray-500/30">
                    Sin sincronizar
                  </span>
                )}
                {st?.portal_url && (
                  <div className="flex gap-2">
                    {delinquent && (
                      <a href={st.portal_url} target="_blank" rel="noreferrer"
                        className="text-xs px-3 py-1.5 rounded-lg font-bold bg-blue-500/15 text-blue-300 border border-blue-500/30 hover:bg-blue-500/25 transition flex items-center gap-1.5">
                        <CreditCard className="w-3.5 h-3.5" /> Pagar en línea
                      </a>
                    )}
                    <a href={st.portal_url} target="_blank" rel="noreferrer"
                      className="text-xs px-3 py-1.5 rounded-lg font-medium bg-white/[0.04] text-gray-300 border border-white/[0.08] hover:text-white transition flex items-center gap-1.5">
                      <ExternalLink className="w-3.5 h-3.5" /> Ver en portal
                    </a>
                  </div>
                )}
              </div>

              {/* Years due breakdown */}
              {st && st.years_due.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-gray-500 text-[10px] uppercase tracking-wider">
                        <th className="text-left py-2 pr-3">Año</th>
                        <th className="text-right py-2 px-3">Impuesto base</th>
                        <th className="text-right py-2 px-3">Pagado</th>
                        <th className="text-right py-2 px-3">Base debido</th>
                        <th className="text-right py-2 px-3">Penalidad + interés</th>
                        <th className="text-right py-2 px-3">Abogado</th>
                        <th className="text-right py-2 pl-3">Total debido</th>
                      </tr>
                    </thead>
                    <tbody>
                      {st.years_due.map(y => (
                        <tr key={y.year} className="border-t border-white/[0.05] text-gray-300">
                          <td className="py-2 pr-3 font-bold text-white">{y.year}</td>
                          <td className="text-right py-2 px-3">{fmt(y.base_tax)}</td>
                          <td className="text-right py-2 px-3">{fmt(y.base_paid)}</td>
                          <td className="text-right py-2 px-3">{fmt(y.base_due)}</td>
                          <td className="text-right py-2 px-3 text-amber-300">{fmt(y.penalty_interest)}</td>
                          <td className="text-right py-2 px-3 text-amber-300">{fmt(y.attorney_fees)}</td>
                          <td className="text-right py-2 pl-3 font-bold text-red-300">{fmt(y.amount_due)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-gray-600">
        Fuente: portal público del condado (BIS eSearch). Los pagos en línea pasan por Certified
        Payments (fee ~3% con tarjeta). Sin fees: cheque a &ldquo;Moore County Tax Office&rdquo;, PO Box 616,
        Dumas TX 79029, o en persona en 500 S. Dumas Ave · Tel 806-935-2175.
      </p>
    </div>
  );
}
