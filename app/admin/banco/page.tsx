'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import { useAdminAuth } from '../layout';
import {
  Landmark, RefreshCw, Loader2, Link2, Trash2, CheckCircle2,
  CircleDashed, EyeOff, Sparkles, ArrowDownLeft, ArrowUpRight,
} from 'lucide-react';

type PlaidItem = {
  item_id: string; institution_name: string; linked_at: string;
  last_synced_at: string | null;
  accounts: { account_id: string; name: string; mask: string; subtype: string; balance: number }[];
};
type BankTx = {
  _id: string; transaction_id: string; name: string; amount: number;
  date: string; pending: boolean; category: string;
  ai_category?: string; ai_category_label?: string;
  match_suggestion?: { type: string; ref_desc: string; ref_amount: number; confidence: number; reason: string };
  match: { status: string; type?: string; ref_desc?: string; days_delta?: number; manual?: boolean; ai_suggested?: boolean };
};

const fmt = (n: number) => `$${Math.abs(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

const PAGE_SIZE = 50;

function ConnectButton({ linkToken, onSuccess }: { linkToken: string; onSuccess: (t: string, name: string) => void }) {
  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: (publicToken, metadata: any) => onSuccess(publicToken, metadata?.institution?.name || ''),
  });
  return (
    <button onClick={() => open()} disabled={!ready}
      className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-bold hover:bg-emerald-500/25 transition disabled:opacity-40">
      <Link2 className="w-3.5 h-3.5" /> {ready ? 'Conectar banco' : 'Cargando Plaid...'}
    </button>
  );
}

export default function BancoPage() {
  const { headers } = useAdminAuth();
  const [items, setItems] = useState<PlaidItem[]>([]);
  const [env, setEnv] = useState('sandbox');
  const [txs, setTxs] = useState<BankTx[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [linkToken, setLinkToken] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const notify = (msg: string, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 5000); };

  const load = useCallback(async (f = filter) => {
    try {
      const [ra, rt] = await Promise.all([
        fetch('/api/admin/plaid/accounts', { headers: headers() }),
        fetch(`/api/admin/plaid/transactions?limit=${PAGE_SIZE}&skip=${(page - 1) * PAGE_SIZE}${f ? `&status=${f}` : ''}`, { headers: headers() }),
      ]);
      if (ra.ok) { const d = await ra.json(); setItems(d.items || []); setEnv(d.env); }
      if (rt.ok) { const d = await rt.json(); setTxs(d.transactions || []); setCounts(d.counts || {}); setTotal(d.total || 0); }
    } catch { /* noop */ }
    setLoading(false);
  }, [headers, filter, page]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/admin/plaid/link-token', { method: 'POST', headers: headers() });
        if (res.ok) setLinkToken((await res.json()).link_token);
      } catch { /* noop */ }
    })();
  }, []);

  const onLinkSuccess = async (publicToken: string, institutionName: string) => {
    setBusy('link');
    const res = await fetch('/api/admin/plaid/exchange', {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...headers() },
      body: JSON.stringify({ public_token: publicToken, institution_name: institutionName }),
    });
    if (res.ok) {
      notify('Banco conectado 🎉 — sincronizando transacciones...');
      await sync();
    } else notify((await res.json()).detail || 'Error al conectar', false);
    setBusy('');
  };

  const sync = async () => {
    setBusy('sync');
    try {
      const res = await fetch('/api/admin/plaid/sync', { method: 'POST', headers: headers() });
      const d = await res.json();
      if (res.ok) notify(`${d.imported} transacciones importadas · ${d.auto_matched} conciliadas ✨`);
      else notify(d.detail || 'Error al sincronizar', false);
    } catch { notify('Error de red', false); }
    await load();
    setBusy('');
  };

  const reconcile = async () => {
    setBusy('rec');
    const res = await fetch('/api/admin/plaid/reconcile', { method: 'POST', headers: headers() });
    const d = await res.json();
    notify(res.ok ? `${d.auto_matched} transacciones conciliadas ✨` : 'Error', res.ok);
    await load();
    setBusy('');
  };

  const aiAnalyze = async () => {
    setBusy('ai');
    try {
      const res = await fetch('/api/admin/plaid/ai-analyze', { method: 'POST', headers: headers() });
      const d = await res.json();
      if (res.ok) notify(`IA: ${d.categorized} categorizadas · ${d.suggested} sugerencia(s) de match 🤖`);
      else notify(d.detail || 'Error en análisis IA', false);
    } catch { notify('Error de red', false); }
    await load();
    setBusy('');
  };

  const resolveSuggestion = async (tx: BankTx, action: 'accept' | 'reject') => {
    const res = await fetch(`/api/admin/plaid/transactions/${tx.transaction_id}/suggestion`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...headers() },
      body: JSON.stringify({ action }),
    });
    notify(res.ok ? (action === 'accept' ? 'Match confirmado ✅' : 'Sugerencia descartada') : 'Error', res.ok);
    load();
  };

  const setStatus = async (tx: BankTx, status: string) => {
    await fetch(`/api/admin/plaid/transactions/${tx.transaction_id}/status`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...headers() },
      body: JSON.stringify({ status }),
    });
    load();
  };

  const unlink = async (it: PlaidItem) => {
    if (!confirm(`¿Desvincular ${it.institution_name || it.item_id}? Se borran sus transacciones importadas.`)) return;
    const res = await fetch(`/api/admin/plaid/items/${it.item_id}`, { method: 'DELETE', headers: headers() });
    notify(res.ok ? 'Cuenta desvinculada' : 'Error', res.ok);
    load();
  };

  const totalTx = Object.values(counts).reduce((a, b) => a + b, 0);
  const pct = totalTx ? Math.round(((counts.matched || 0) / totalTx) * 100) : 0;

  return (
    <div className="space-y-5">
      {toast && (
        <div className={`fixed top-4 right-4 z-[70] px-4 py-3 rounded-xl text-sm font-bold shadow-xl ${toast.ok ? 'bg-emerald-500/90 text-white' : 'bg-red-500/90 text-white'}`}>{toast.msg}</div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Landmark className="w-6 h-6 text-emerald-400" /> Conciliación Bancaria
            {env === 'sandbox' && <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 font-bold">SANDBOX</span>}
          </h1>
          <p className="text-xs text-gray-500 mt-1">Conecta tu banco con Plaid y cruza cada movimiento contra rentas, gastos y pagos a proveedores registrados.</p>
        </div>
        <div className="flex items-center gap-2">
          {linkToken && <ConnectButton linkToken={linkToken} onSuccess={onLinkSuccess} />}
          <button onClick={sync} disabled={busy === 'sync' || items.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 rounded-xl text-xs font-bold hover:bg-cyan-500/25 transition disabled:opacity-40">
            {busy === 'sync' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Sincronizar
          </button>
          <button onClick={reconcile} disabled={busy === 'rec' || totalTx === 0}
            className="flex items-center gap-1.5 px-3 py-2 bg-violet-500/15 text-violet-300 border border-violet-500/30 rounded-xl text-xs font-bold hover:bg-violet-500/25 transition disabled:opacity-40">
            {busy === 'rec' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} Conciliar
          </button>
          <button onClick={aiAnalyze} disabled={busy === 'ai' || totalTx === 0}
            className="flex items-center gap-1.5 px-3 py-2 bg-pink-500/15 text-pink-300 border border-pink-500/30 rounded-xl text-xs font-bold hover:bg-pink-500/25 transition disabled:opacity-40">
            {busy === 'ai' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} Analizar con IA
          </button>
        </div>
      </div>

      {/* Cuentas conectadas */}
      {items.length > 0 && (
        <div className="grid sm:grid-cols-2 gap-3">
          {items.map(it => (
            <div key={it.item_id} className="p-4 bg-white/[0.03] border border-white/[0.06] rounded-2xl">
              <div className="flex items-center justify-between">
                <div className="font-bold text-white text-sm">{it.institution_name || 'Banco'}</div>
                <button onClick={() => unlink(it)} className="p-1 text-gray-600 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
              <div className="mt-2 space-y-1">
                {(it.accounts || []).map(a => (
                  <div key={a.account_id} className="flex items-center justify-between text-xs">
                    <span className="text-gray-400">{a.name} {a.mask && <span className="text-gray-600">••{a.mask}</span>}</span>
                    <span className="font-bold text-emerald-400">{a.balance != null ? fmt(a.balance) : '—'}</span>
                  </div>
                ))}
              </div>
              <div className="text-[10px] text-gray-600 mt-2">Última sync: {it.last_synced_at ? it.last_synced_at.slice(0, 16).replace('T', ' ') : 'nunca'}</div>
            </div>
          ))}
        </div>
      )}

      {/* Resumen + filtros */}
      {totalTx > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.06] text-xs font-bold text-white">{pct}% conciliado</div>
          {[['', `Todas ${totalTx}`], ['matched', `✅ Conciliadas ${counts.matched || 0}`], ['unmatched', `⏳ Pendientes ${counts.unmatched || 0}`], ['ignored', `🚫 Ignoradas ${counts.ignored || 0}`]].map(([v, l]) => (
            <button key={v} onClick={() => { setFilter(v); setPage(1); }}
              className={`px-3 py-1.5 rounded-full text-xs font-bold border transition ${filter === v ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' : 'bg-white/[0.03] text-gray-500 border-white/[0.06] hover:text-white'}`}>{l}</button>
          ))}
        </div>
      )}

      {/* Transacciones */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 text-gray-500 animate-spin" /></div>
      ) : items.length === 0 ? (
        <div className="text-center py-14 space-y-2">
          <Landmark className="w-10 h-10 text-gray-700 mx-auto" />
          <p className="text-gray-500 text-sm">Conecta tu primer banco con el botón <b>Conectar banco</b>.<br />En modo Sandbox usa: usuario <code className="text-cyan-400">user_good</code> · contraseña <code className="text-cyan-400">pass_good</code></p>
        </div>
      ) : txs.length === 0 ? (
        <p className="text-center text-gray-500 text-sm py-10">Sin transacciones{filter ? ' en este filtro' : ' — pulsa Sincronizar'}.</p>
      ) : (
        <div className="border border-white/[0.06] rounded-2xl overflow-hidden divide-y divide-white/[0.04]">
          {txs.map(tx => (
            <div key={tx._id} className="px-4 py-2.5 hover:bg-white/[0.02]">
              <div className="flex flex-wrap items-center gap-3">
              {tx.amount > 0
                ? <ArrowUpRight className="w-4 h-4 text-red-400 shrink-0" />
                : <ArrowDownLeft className="w-4 h-4 text-emerald-400 shrink-0" />}
              <div className="min-w-[180px] flex-1">
                <div className="text-sm text-white font-semibold truncate">{tx.name}{tx.pending && <span className="text-[9px] text-amber-400 ml-1">PENDIENTE</span>}</div>
                <div className="text-[10px] text-gray-500">{tx.date}{tx.category ? ` · ${tx.category.toLowerCase().replace(/_/g, ' ')}` : ''}</div>
              </div>
              <div className={`font-bold text-sm ${tx.amount > 0 ? 'text-red-400' : 'text-emerald-400'}`}>{tx.amount > 0 ? '-' : '+'}{fmt(tx.amount)}</div>
              {tx.ai_category_label && (
                <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${tx.ai_category === 'personal' ? 'bg-gray-500/15 text-gray-400 border-gray-500/30' : tx.ai_category?.includes('income') ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' : 'bg-blue-500/15 text-blue-300 border-blue-500/30'}`}>
                  🏷️ {tx.ai_category_label}
                </span>
              )}
              {tx.match?.status === 'matched' ? (
                <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-bold" title={tx.match.ref_desc}>
                  <CheckCircle2 className="w-3 h-3" /> {tx.match.type}
                </span>
              ) : tx.match?.status === 'ignored' ? (
                <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-gray-500/15 text-gray-400 border border-gray-500/30 font-bold"><EyeOff className="w-3 h-3" /> Ignorada</span>
              ) : (
                <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 font-bold"><CircleDashed className="w-3 h-3" /> Sin conciliar</span>
              )}
              {tx.match?.status === 'unmatched' && (
                <button onClick={() => setStatus(tx, 'ignored')} className="text-[10px] text-gray-600 hover:text-gray-300 font-bold">Ignorar</button>
              )}
              {tx.match?.status === 'ignored' && (
                <button onClick={() => setStatus(tx, 'unmatched')} className="text-[10px] text-gray-600 hover:text-gray-300 font-bold">Restaurar</button>
              )}
              </div>
              {tx.match?.status === 'unmatched' && tx.match_suggestion && (
                <div className="mt-2 ml-7 flex flex-wrap items-center gap-2 p-2.5 bg-violet-500/[0.07] border border-violet-500/25 rounded-xl">
                  <Sparkles className="w-3.5 h-3.5 text-violet-300 shrink-0" />
                  <div className="flex-1 min-w-[200px]">
                    <span className="text-xs text-violet-200 font-bold">IA sugiere: {tx.match_suggestion.type}{tx.match_suggestion.ref_desc ? ` — ${tx.match_suggestion.ref_desc}` : ''} ({fmt(tx.match_suggestion.ref_amount)})</span>
                    <span className="text-[10px] text-gray-400 block">{tx.match_suggestion.reason} · confianza {tx.match_suggestion.confidence}%</span>
                  </div>
                  <button onClick={() => resolveSuggestion(tx, 'accept')} className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30 transition">✓ Confirmar</button>
                  <button onClick={() => resolveSuggestion(tx, 'reject')} className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-red-500/10 text-red-300 border border-red-500/30 hover:bg-red-500/20 transition">✗ No es</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Paginación */}
      {!loading && total > PAGE_SIZE && (
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-gray-500">
            Mostrando {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} de {total}
          </span>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="px-3 py-1.5 rounded-lg text-xs font-bold border border-white/[0.08] text-gray-400 hover:bg-white/[0.04] disabled:opacity-30 transition">← Anterior</button>
            <span className="text-xs text-gray-400 font-bold">{page} / {Math.ceil(total / PAGE_SIZE)}</span>
            <button onClick={() => setPage(p => Math.min(Math.ceil(total / PAGE_SIZE), p + 1))} disabled={page >= Math.ceil(total / PAGE_SIZE)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold border border-white/[0.08] text-gray-400 hover:bg-white/[0.04] disabled:opacity-30 transition">Siguiente →</button>
          </div>
        </div>
      )}
    </div>
  );
}
