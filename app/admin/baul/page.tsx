'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAdminAuth } from '../layout';
import {
  Lock, Unlock, Shield, KeyRound, Eye, EyeOff, CreditCard, Building2,
  RefreshCw, Search, AlertTriangle, CheckCircle2, Copy, ClipboardCheck,
  ScrollText, Sparkles, X, User, ShieldAlert, Clock, Trash2, Link2, Plus, DollarSign, ShieldCheck,
} from 'lucide-react';

type Method = {
  id: string;
  type: 'card' | 'bank';
  user_id: string;
  user_name: string;
  user_email: string;
  card_brand?: string;
  card_last4?: string;
  card_exp?: string;
  stripe_payment_method_id?: string;
  bank_name?: string;
  account_type?: string;
  account_last4?: string;
  routing_masked?: string;
  is_default?: boolean;
  is_active_for_autopay?: boolean;
  stripe_payment_method_id?: string;
  created_at?: string;
  source?: string;
  is_legacy?: boolean;
  has_nmi_vault?: boolean;
};

type Revealed = {
  id: string;
  routing_full?: string;
  account_full?: string;
  card_full?: string;
  cvv_full?: string;
  exp_month?: string;
  exp_year?: string;
  expires_at: number;  // epoch ms
};

const VAULT_TOKEN_KEY = 'ross_vault_token';
const VAULT_TOKEN_EXP_KEY = 'ross_vault_token_exp';

const fmtDateTime = (iso?: string | null) => {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch { return '—'; }
};

export default function BaulPage() {
  const { headers } = useAdminAuth();
  const [pinStatus, setPinStatus] = useState<{ has_pin: boolean; configured_at?: string } | null>(null);
  const [vaultToken, setVaultToken] = useState<string>('');
  const [tokenExpiresAt, setTokenExpiresAt] = useState<number>(0);
  const [methods, setMethods] = useState<Method[]>([]);
  const [loading, setLoading] = useState(true);

  const [showPinModal, setShowPinModal] = useState<'unlock' | 'set' | 'change' | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [pinCurrent, setPinCurrent] = useState('');
  const [pinNew, setPinNew] = useState('');
  const [pinSubmitting, setPinSubmitting] = useState(false);

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'card' | 'bank'>('all');
  const [revealed, setRevealed] = useState<Record<string, Revealed>>({});
  const [confirmDelete, setConfirmDelete] = useState<Method | null>(null);
  const [audit, setAudit] = useState<any[]>([]);
  const [showAudit, setShowAudit] = useState(false);
  const [toast, setToast] = useState<{ msg: string; tone: 'ok' | 'err' } | null>(null);
  const [copiedKey, setCopiedKey] = useState('');
  const [chargeTarget, setChargeTarget] = useState<Method | null>(null);
  const [chargeAmount, setChargeAmount] = useState('');
  const [chargeDesc, setChargeDesc] = useState('');
  const [charging, setCharging] = useState(false);
  const [saveCardLink, setSaveCardLink] = useState('');
  const [savingLink, setSavingLink] = useState(false);

  const showToast = (msg: string, tone: 'ok' | 'err' = 'ok') => {
    setToast({ msg, tone });
    setTimeout(() => setToast(null), 3500);
  };

  // Load token from localStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const t = window.localStorage.getItem(VAULT_TOKEN_KEY);
    const e = parseInt(window.localStorage.getItem(VAULT_TOKEN_EXP_KEY) || '0', 10);
    if (t && e > Date.now()) {
      setVaultToken(t);
      setTokenExpiresAt(e);
    }
  }, []);

  const persistToken = (token: string, ttlSeconds: number) => {
    const exp = Date.now() + ttlSeconds * 1000;
    setVaultToken(token);
    setTokenExpiresAt(exp);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(VAULT_TOKEN_KEY, token);
      window.localStorage.setItem(VAULT_TOKEN_EXP_KEY, String(exp));
    }
  };

  const clearToken = () => {
    setVaultToken('');
    setTokenExpiresAt(0);
    setRevealed({});
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(VAULT_TOKEN_KEY);
      window.localStorage.removeItem(VAULT_TOKEN_EXP_KEY);
    }
  };

  const fetchAll = useCallback(async () => {
    try {
      const [pinRes, methodsRes] = await Promise.all([
        fetch('/api/admin/vault/pin-status', { headers: headers() }),
        fetch('/api/admin/vault/payment-methods', { headers: headers() }),
      ]);
      if (pinRes.ok) setPinStatus(await pinRes.json());
      if (methodsRes.ok) {
        const d = await methodsRes.json();
        setMethods(d.items || []);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [headers]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const fetchAudit = async () => {
    try {
      const res = await fetch('/api/admin/vault/audit-log?limit=50', { headers: headers() });
      if (res.ok) {
        const d = await res.json();
        setAudit(d.items || []);
        setShowAudit(true);
      }
    } catch (e) { console.error(e); }
  };

  // ─── PIN actions ────────────────────────────────────────
  const handleUnlock = async () => {
    if (!pinInput || pinInput.length < 4) {
      showToast('PIN debe tener al menos 4 dígitos', 'err');
      return;
    }
    setPinSubmitting(true);
    try {
      const res = await fetch('/api/admin/vault/unlock', {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ pin: pinInput }),
      });
      const d = await res.json();
      if (res.ok && d.success) {
        persistToken(d.vault_token, d.expires_in);
        showToast('🔓 Baúl desbloqueado por 30 min');
        setShowPinModal(null);
        setPinInput('');
      } else {
        showToast(`❌ ${d.detail || 'PIN incorrecto'}`, 'err');
      }
    } catch (e: any) {
      showToast(`❌ ${e?.message || 'Error'}`, 'err');
    }
    setPinSubmitting(false);
  };

  const handleSetPin = async () => {
    if (!pinNew || pinNew.length < 4 || pinNew.length > 8) {
      showToast('PIN debe tener 4-8 dígitos', 'err');
      return;
    }
    setPinSubmitting(true);
    try {
      const body: any = { new_pin: pinNew };
      if (pinStatus?.has_pin) body.current_pin = pinCurrent;
      const res = await fetch('/api/admin/vault/set-pin', {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(body),
      });
      const d = await res.json();
      if (res.ok && d.success) {
        showToast('🔐 PIN configurado exitosamente');
        setShowPinModal(null);
        setPinNew(''); setPinCurrent('');
        await fetchAll();
      } else {
        showToast(`❌ ${d.detail || 'Error'}`, 'err');
      }
    } catch (e: any) {
      showToast(`❌ ${e?.message || 'Error'}`, 'err');
    }
    setPinSubmitting(false);
  };

  // ─── Reveal action ────────────────────────────────────
  const handleReveal = async (m: Method) => {
    if (!vaultToken) {
      setShowPinModal('unlock');
      return;
    }
    try {
      const res = await fetch(`/api/admin/vault/payment-methods/${m.id}/reveal`, {
        headers: { ...headers(), 'X-Vault-Token': vaultToken },
      });
      const d = await res.json();
      if (res.ok && d.success) {
        setRevealed(r => ({
          ...r,
          [m.id]: {
            id: m.id,
            routing_full: d.routing_full,
            account_full: d.account_full,
            card_full: d.card_full,
            cvv_full: d.cvv_full,
            exp_month: d.exp_month,
            exp_year: d.exp_year,
            expires_at: Date.now() + 30 * 1000,
          },
        }));
        if (!d.card_full && !d.routing_full && !d.account_full) {
          showToast(d.message || '⚠️ No hay datos completos para mostrar', 'err');
        }
        setTimeout(() => {
          setRevealed(r => {
            const next = { ...r };
            delete next[m.id];
            return next;
          });
        }, 30 * 1000);
      } else {
        if (res.status === 403) {
          clearToken();
          showToast('Sesión expirada, ingresa el PIN nuevamente', 'err');
          setShowPinModal('unlock');
        } else {
          showToast(`❌ ${d.detail || 'Error'}`, 'err');
        }
      }
    } catch (e: any) {
      showToast(`❌ ${e?.message || 'Error'}`, 'err');
    }
  };

  // ─── Delete action ──────────────────────────────────
  const handleDelete = async (m: Method) => {
    if (!vaultToken) {
      setShowPinModal('unlock');
      return;
    }
    setConfirmDelete(null);
    try {
      const res = await fetch(`/api/admin/vault/payment-methods/${m.id}`, {
        method: 'DELETE',
        headers: { ...headers(), 'X-Vault-Token': vaultToken },
      });
      const d = await res.json();
      if (res.ok && d.success) {
        showToast(`🗑️ ${d.message || 'Eliminado'}`);
        setRevealed(r => { const n = { ...r }; delete n[m.id]; return n; });
        await fetchAll();
      } else {
        if (res.status === 403) {
          clearToken();
          showToast('Sesión expirada, ingresa el PIN', 'err');
          setShowPinModal('unlock');
        } else {
          showToast(`❌ ${d.detail || 'Error'}`, 'err');
        }
      }
    } catch (e: any) {
      showToast(`❌ ${e?.message || 'Error'}`, 'err');
    }
  };

  const handleCopy = (text: string, key: string) => {
    if (!text) return;
    navigator.clipboard?.writeText(text).then(() => {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(''), 2000);
    });
  };

  const handleCharge = async () => {
    if (!chargeTarget) return;
    const amt = parseFloat(chargeAmount);
    if (!amt || amt <= 0) { showToast('Monto inválido', 'err'); return; }
    setCharging(true);
    try {
      const res = await fetch('/api/admin/vault/charge', {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          payment_method_id: chargeTarget.stripe_payment_method_id,
          amount: amt,
          description: chargeDesc,
        }),
      });
      const d = await res.json();
      if (res.ok && d.success) {
        showToast(`💳 Cobro exitoso: $${amt.toFixed(2)}`);
        setChargeTarget(null); setChargeAmount(''); setChargeDesc('');
      } else {
        showToast(`❌ ${d.detail || d.message || 'No se pudo cobrar'}`, 'err');
      }
    } catch (e: any) {
      showToast(`❌ ${e?.message || 'Error'}`, 'err');
    }
    setCharging(false);
  };

  const handleCreateSaveCardLink = async () => {
    setSavingLink(true);
    setSaveCardLink('');
    try {
      const res = await fetch('/api/admin/vault/card-save-link', {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({}),
      });
      const d = await res.json();
      if (res.ok && d.success) {
        setSaveCardLink(d.url);
        showToast('🔗 Link seguro generado — cópialo y envíalo al cliente');
      } else {
        showToast(`❌ ${d.detail || 'No se pudo generar el link'}`, 'err');
      }
    } catch (e: any) {
      showToast(`❌ ${e?.message || 'Error'}`, 'err');
    }
    setSavingLink(false);
  };

  const timeRemaining = vaultToken && tokenExpiresAt
    ? Math.max(0, Math.floor((tokenExpiresAt - Date.now()) / 60000))
    : 0;

  const filtered = useMemo(() => {
    return methods.filter(m => {
      if (filter !== 'all' && m.type !== filter) return false;
      if (search) {
        const h = `${m.user_name} ${m.user_email} ${m.card_brand} ${m.bank_name} ${m.card_last4} ${m.account_last4}`.toLowerCase();
        if (!h.includes(search.toLowerCase())) return false;
      }
      return true;
    });
  }, [methods, search, filter]);

  const stats = useMemo(() => ({
    total: methods.length,
    cards: methods.filter(m => m.type === 'card').length,
    banks: methods.filter(m => m.type === 'bank').length,
    users: new Set(methods.map(m => m.user_id)).size,
  }), [methods]);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-3 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-6 relative pb-32">
      <div className="fixed top-0 right-1/3 w-96 h-96 bg-amber-500/[0.025] rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-1/4 left-1/4 w-96 h-96 bg-red-500/[0.02] rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="relative w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500/25 to-amber-600/10 border border-amber-500/30 flex items-center justify-center shadow-[0_0_25px_rgba(245,158,11,0.20)]">
            {vaultToken ? <Unlock className="w-6 h-6 text-amber-300" /> : <Lock className="w-6 h-6 text-amber-300" />}
            <Sparkles className="absolute -top-1 -right-1 w-3 h-3 text-amber-300" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Baúl Seguro</h2>
            <p className="text-sm text-gray-500">
              {stats.total} método(s) · {stats.users} cliente(s) ·{' '}
              {vaultToken
                ? <span className="text-emerald-400 font-bold">🔓 Desbloqueado ({timeRemaining} min)</span>
                : <span className="text-amber-400 font-bold">🔒 Bloqueado</span>
              }
            </p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={fetchAll} className="p-2.5 border border-white/[0.08] rounded-xl text-gray-400 hover:bg-white/[0.04] transition" title="Refrescar">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={fetchAudit} className="flex items-center gap-2 px-4 py-2.5 border border-white/[0.08] rounded-xl text-sm font-bold text-gray-300 hover:bg-white/[0.04] transition">
            <ScrollText className="w-4 h-4" /> Auditoría
          </button>
          {pinStatus?.has_pin ? (
            <button onClick={() => setShowPinModal('change')} className="flex items-center gap-2 px-4 py-2.5 border border-amber-500/30 bg-amber-500/10 rounded-xl text-sm font-bold text-amber-300 hover:bg-amber-500/20 transition">
              <KeyRound className="w-4 h-4" /> Cambiar PIN
            </button>
          ) : (
            <button onClick={() => setShowPinModal('set')} className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-xl text-sm font-bold hover:opacity-90 shadow-[0_0_22px_rgba(245,158,11,0.35)]">
              <KeyRound className="w-4 h-4" /> Configurar PIN
            </button>
          )}
          {vaultToken ? (
            <button onClick={clearToken} className="flex items-center gap-2 px-4 py-2.5 border border-red-500/30 bg-red-500/10 rounded-xl text-sm font-bold text-red-300 hover:bg-red-500/20 transition">
              <Lock className="w-4 h-4" /> Bloquear ahora
            </button>
          ) : (
            <button onClick={() => setShowPinModal('unlock')} disabled={!pinStatus?.has_pin} className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl text-sm font-bold hover:opacity-90 shadow-[0_0_22px_rgba(16,185,129,0.35)] disabled:opacity-30">
              <Unlock className="w-4 h-4" /> Desbloquear
            </button>
          )}
        </div>
      </div>

      {/* Status banner */}
      <div className={`rounded-2xl border p-4 ${vaultToken ? 'bg-emerald-500/[0.05] border-emerald-500/20' : 'bg-amber-500/[0.05] border-amber-500/20'}`}>
        <div className="flex items-start gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ring-1 shrink-0 ${vaultToken ? 'bg-emerald-500/15 ring-emerald-500/30' : 'bg-amber-500/15 ring-amber-500/30'}`}>
            <Shield className={`w-5 h-5 ${vaultToken ? 'text-emerald-300' : 'text-amber-300'}`} />
          </div>
          <div className="text-sm text-gray-300 space-y-1 flex-1">
            <div className="font-bold text-white">{vaultToken ? '🔓 Baúl Desbloqueado' : '🔒 Baúl Bloqueado — Solo datos enmascarados visibles'}</div>
            <p className="text-xs text-gray-400">
              Por seguridad, todos los routing/account numbers están <strong>encriptados</strong> en la base de datos.
              Para ver los números completos, ingresa el PIN. La sesión dura 30 min y cada lectura queda registrada en la auditoría.
            </p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={<CreditCard className="w-4 h-4 text-violet-400" />} value={String(stats.cards)} label="Tarjetas" tone="violet" />
        <StatCard icon={<Building2 className="w-4 h-4 text-blue-400" />} value={String(stats.banks)} label="Bancos" tone="blue" />
        <StatCard icon={<User className="w-4 h-4 text-emerald-400" />} value={String(stats.users)} label="Clientes" tone="emerald" />
        <StatCard icon={<ShieldAlert className="w-4 h-4 text-amber-400" />} value={String(stats.total)} label="Total métodos" tone="amber" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar cliente, banco, last4..." className="w-full pl-10 pr-4 py-2.5 bg-[#0C1220]/60 border border-white/[0.08] rounded-xl text-sm text-white focus:border-amber-500 focus:outline-none placeholder:text-gray-600" />
        </div>
        <FilterPill active={filter === 'all'} onClick={() => setFilter('all')}>Todos</FilterPill>
        <FilterPill active={filter === 'card'} onClick={() => setFilter('card')} tone="violet">Tarjetas</FilterPill>
        <FilterPill active={filter === 'bank'} onClick={() => setFilter('bank')} tone="blue">Bancos</FilterPill>
      </div>

      {/* Method list */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-white/[0.02] rounded-2xl border border-white/[0.06]">
          <div className="w-16 h-16 mx-auto bg-amber-500/10 rounded-2xl flex items-center justify-center mb-4 ring-1 ring-amber-500/20">
            <Lock className="w-8 h-8 text-amber-400" />
          </div>
          <p className="text-gray-300 text-sm font-semibold">Sin métodos guardados aún</p>
          <p className="text-gray-500 text-xs mt-1">Los clientes pueden agregar tarjeta o banco desde la app</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(m => {
            const isBank = m.type === 'bank';
            const rev = revealed[m.id];
            const meta = isBank
              ? { Icon: Building2, color: 'text-blue-300', bg: 'bg-blue-500/15', ring: 'ring-blue-500/30' }
              : { Icon: CreditCard, color: 'text-violet-300', bg: 'bg-violet-500/15', ring: 'ring-violet-500/30' };

            return (
              <div key={m.id} className="relative overflow-hidden bg-white/[0.03] backdrop-blur-sm rounded-xl border border-white/[0.06] p-4 hover:border-amber-500/20 transition">
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-amber-500/30 to-transparent rounded-t-xl" />

                <div className="flex items-start gap-3 flex-wrap">
                  <div className={`w-11 h-11 rounded-xl ${meta.bg} ring-1 ${meta.ring} flex items-center justify-center shrink-0`}>
                    <meta.Icon className={`w-5 h-5 ${meta.color}`} />
                  </div>

                  <div className="flex-1 min-w-[200px]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-white">
                        {isBank ? (m.bank_name || 'Banco') : (m.card_brand || 'Tarjeta')}
                        {' '}····{isBank ? m.account_last4 : m.card_last4}
                      </span>
                      {m.is_default && <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 font-bold">Principal</span>}
                      {m.is_active_for_autopay && <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-bold">🔁 Autopago</span>}
                      {isBank && m.account_type && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.05] text-gray-300 font-semibold">
                          {m.account_type === 'checking' ? 'Corriente' : 'Ahorros'}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-gray-500 mt-0.5">
                      <span className="inline-flex items-center gap-1"><User className="w-3 h-3" /> {m.user_name || 'Cliente'} ({m.user_email})</span>
                      {!isBank && m.card_exp && <span className="ml-3">Exp: {m.card_exp}</span>}
                    </div>

                    {/* Revealed numbers (or routing mask) */}
                    {isBank ? (
                      <div className="mt-2 grid sm:grid-cols-2 gap-2">
                        <SecretRow
                          label="Routing"
                          masked={m.routing_masked || '•••••••••'}
                          full={rev?.routing_full}
                          copied={copiedKey === `${m.id}_routing`}
                          onCopy={() => handleCopy(rev?.routing_full || '', `${m.id}_routing`)}
                        />
                        <SecretRow
                          label="Account"
                          masked={`••••${m.account_last4 || ''}`}
                          full={rev?.account_full}
                          copied={copiedKey === `${m.id}_account`}
                          onCopy={() => handleCopy(rev?.account_full || '', `${m.id}_account`)}
                        />
                      </div>
                    ) : (
                      rev && (rev.card_full || rev.cvv_full) ? (
                        <div className="mt-2 grid sm:grid-cols-2 gap-2">
                          <SecretRow
                            label={`Número de Tarjeta (${m.card_brand || ''})`}
                            masked={`•••• •••• •••• ${m.card_last4 || ''}`}
                            full={rev.card_full && rev.card_full.replace(/(\d{4})/g, '$1 ').trim()}
                            copied={copiedKey === `${m.id}_pan`}
                            onCopy={() => handleCopy(rev.card_full || '', `${m.id}_pan`)}
                          />
                          <SecretRow
                            label="CVV"
                            masked="•••"
                            full={rev.cvv_full}
                            copied={copiedKey === `${m.id}_cvv`}
                            onCopy={() => handleCopy(rev.cvv_full || '', `${m.id}_cvv`)}
                          />
                        </div>
                      ) : null
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {rev && (rev.routing_full || rev.account_full || rev.card_full) ? (
                      <button onClick={() => setRevealed(r => { const n = { ...r }; delete n[m.id]; return n; })}
                        className="flex items-center gap-1 px-3 py-2 rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/20 text-emerald-300 text-xs font-bold hover:bg-emerald-500/20 transition">
                        <EyeOff className="w-3.5 h-3.5" /> Ocultar
                      </button>
                    ) : (
                      <button onClick={() => handleReveal(m)}
                        className={`flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold transition ${
                          vaultToken
                            ? 'bg-amber-500/15 ring-1 ring-amber-500/30 text-amber-300 hover:bg-amber-500/25'
                            : 'bg-white/[0.05] ring-1 ring-white/[0.08] text-gray-400 hover:bg-white/[0.08]'
                        }`}>
                        {vaultToken ? <Eye className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                        {vaultToken ? 'Ver' : 'Desbloquear'}
                      </button>
                    )}
                    {m.type === 'card' && m.stripe_payment_method_id && (
                      <button onClick={() => setChargeTarget(m)}
                        className="flex items-center gap-1 px-3 py-2 rounded-xl bg-blue-500/15 ring-1 ring-blue-500/30 text-blue-300 text-xs font-bold hover:bg-blue-500/25 transition"
                        title="Cobrar a esta tarjeta">
                        <DollarSign className="w-3.5 h-3.5" /> Cobrar
                      </button>
                    )}
                    <button onClick={() => {
                      if (!vaultToken) { setShowPinModal('unlock'); return; }
                      setConfirmDelete(m);
                    }}
                      className="p-2 rounded-xl bg-red-500/10 ring-1 ring-red-500/20 text-red-300 hover:bg-red-500/20 transition"
                      title="Eliminar (requiere PIN)">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Confirm delete modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setConfirmDelete(null)}>
          <div onClick={e => e.stopPropagation()} className="w-full max-w-md bg-gradient-to-br from-[#0a1020] to-[#070a14] rounded-2xl border border-red-500/30 p-6 shadow-[0_0_40px_rgba(239,68,68,0.18)]">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">¿Eliminar método de pago?</h3>
                <p className="text-xs text-gray-400">Esta acción se registra en auditoría.</p>
              </div>
            </div>
            <div className="bg-white/[0.04] rounded-lg p-3 mb-4 text-xs text-gray-300">
              <div><strong>{confirmDelete.type === 'bank' ? '🏦 Banco' : '💳 Tarjeta'}</strong> {confirmDelete.card_brand || confirmDelete.bank_name || ''} ····{confirmDelete.card_last4 || confirmDelete.account_last4}</div>
              <div className="text-gray-500 mt-1">{confirmDelete.user_name} ({confirmDelete.user_email})</div>
              {confirmDelete.is_active_for_autopay && (
                <div className="text-amber-300 mt-2 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" /> El autopago de este inquilino se desactivará.
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmDelete(null)} className="px-4 py-2.5 border border-white/[0.08] rounded-xl text-sm text-gray-300 hover:bg-white/[0.04] transition">Cancelar</button>
              <button onClick={() => handleDelete(confirmDelete)} className="px-6 py-2.5 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl text-sm font-bold hover:opacity-90 transition shadow-[0_0_22px_rgba(239,68,68,0.35)]">
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PIN Modal */}
      {showPinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setShowPinModal(null)}>
          <div onClick={e => e.stopPropagation()} className="w-full max-w-md bg-gradient-to-br from-[#0a1020] to-[#070a14] rounded-2xl border border-amber-500/30 p-6 shadow-[0_0_60px_rgba(245,158,11,0.20)]">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/15 ring-1 ring-amber-500/30 flex items-center justify-center">
                  <KeyRound className="w-5 h-5 text-amber-300" />
                </div>
                <h3 className="text-lg font-bold text-white">
                  {showPinModal === 'unlock' ? 'Desbloquear Baúl' : showPinModal === 'set' ? 'Configurar PIN' : 'Cambiar PIN'}
                </h3>
              </div>
              <button onClick={() => setShowPinModal(null)} className="p-1 text-gray-500 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            {showPinModal === 'unlock' ? (
              <div className="space-y-3">
                <p className="text-xs text-gray-400">Ingresa tu PIN de 4-8 dígitos para acceder a los datos sensibles. La sesión durará 30 min.</p>
                <input
                  type="password"
                  inputMode="numeric"
                  autoFocus
                  value={pinInput}
                  onChange={e => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 8))}
                  onKeyDown={e => e.key === 'Enter' && handleUnlock()}
                  placeholder="• • • •"
                  className="w-full px-4 py-3 bg-[#0a1020]/80 border border-amber-500/30 rounded-xl text-white text-center text-2xl tracking-[0.5em] focus:border-amber-500 focus:outline-none"
                />
                <button
                  onClick={handleUnlock}
                  disabled={pinSubmitting || pinInput.length < 4}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl text-sm font-bold hover:opacity-90 shadow-[0_0_24px_rgba(16,185,129,0.30)] disabled:opacity-30 transition"
                >
                  {pinSubmitting ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Unlock className="w-4 h-4" />}
                  Desbloquear
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-gray-400">
                  {showPinModal === 'set'
                    ? 'Define un PIN de 4-8 dígitos. Lo necesitarás para ver los routing/account numbers de los clientes.'
                    : 'Ingresa tu PIN actual y luego el nuevo PIN.'}
                </p>
                {showPinModal === 'change' && (
                  <input
                    type="password"
                    inputMode="numeric"
                    value={pinCurrent}
                    onChange={e => setPinCurrent(e.target.value.replace(/\D/g, '').slice(0, 8))}
                    placeholder="PIN actual"
                    className="w-full px-4 py-3 bg-[#0a1020]/80 border border-white/[0.08] rounded-xl text-white text-center text-xl tracking-[0.4em] focus:border-amber-500 focus:outline-none"
                  />
                )}
                <input
                  type="password"
                  inputMode="numeric"
                  autoFocus
                  value={pinNew}
                  onChange={e => setPinNew(e.target.value.replace(/\D/g, '').slice(0, 8))}
                  onKeyDown={e => e.key === 'Enter' && handleSetPin()}
                  placeholder="Nuevo PIN (4-8 dígitos)"
                  className="w-full px-4 py-3 bg-[#0a1020]/80 border border-amber-500/30 rounded-xl text-white text-center text-xl tracking-[0.4em] focus:border-amber-500 focus:outline-none"
                />
                <button
                  onClick={handleSetPin}
                  disabled={pinSubmitting || pinNew.length < 4}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-xl text-sm font-bold hover:opacity-90 shadow-[0_0_24px_rgba(245,158,11,0.30)] disabled:opacity-30 transition"
                >
                  {pinSubmitting ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <KeyRound className="w-4 h-4" />}
                  Guardar PIN
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Audit modal */}
      {showAudit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setShowAudit(false)}>
          <div onClick={e => e.stopPropagation()} className="w-full max-w-3xl max-h-[80vh] overflow-y-auto bg-gradient-to-br from-[#0a1020] to-[#070a14] rounded-2xl border border-white/[0.08] p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <ScrollText className="w-5 h-5 text-amber-300" />
                <h3 className="text-lg font-bold text-white">Auditoría del Baúl</h3>
              </div>
              <button onClick={() => setShowAudit(false)} className="p-1 text-gray-500 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            {audit.length === 0 ? (
              <p className="text-center text-gray-500 py-8">Sin eventos aún.</p>
            ) : (
              <div className="space-y-2">
                {audit.map(ev => (
                  <div key={ev.id} className="bg-white/[0.03] rounded-xl border border-white/[0.06] p-3 flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ring-1 ${
                      ev.action === 'reveal' ? 'bg-amber-500/15 ring-amber-500/30' :
                      ev.action === 'unlock_success' ? 'bg-emerald-500/15 ring-emerald-500/30' :
                      ev.action.includes('fail') ? 'bg-red-500/15 ring-red-500/30' :
                      'bg-blue-500/15 ring-blue-500/30'
                    }`}>
                      {ev.action === 'reveal' ? <Eye className="w-4 h-4 text-amber-300" /> :
                       ev.action === 'unlock_success' ? <Unlock className="w-4 h-4 text-emerald-300" /> :
                       ev.action.includes('fail') ? <AlertTriangle className="w-4 h-4 text-red-300" /> :
                       <KeyRound className="w-4 h-4 text-blue-300" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-white">{ev.action}</div>
                      <div className="text-[11px] text-gray-500 truncate">{ev.admin_email} {ev.target && `· ${ev.target.slice(-8)}`}</div>
                    </div>
                    <div className="text-[11px] text-gray-400 flex items-center gap-1 shrink-0">
                      <Clock className="w-3 h-3" /> {fmtDateTime(ev.timestamp)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Botón: enviar link seguro para guardar tarjeta (flujo manual admin) */}
      <div className="mt-8 bg-white/[0.03] rounded-2xl border border-white/[0.06] p-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 ring-1 ring-emerald-500/30 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-emerald-300" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Registrar tarjeta de un cliente</h2>
              <p className="text-xs text-gray-500">Genera un link seguro; el cliente ingresa su tarjeta (tokenizada por Stripe) y podrás cobrarla luego.</p>
            </div>
          </div>
          <button
            data-testid="create-save-card-link-btn"
            onClick={handleCreateSaveCardLink}
            disabled={savingLink}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-sm font-bold hover:opacity-90 disabled:opacity-40 shadow-[0_0_22px_rgba(16,185,129,0.35)]"
          >
            <Link2 className="w-4 h-4" /> {savingLink ? 'Generando…' : 'Generar link seguro'}
          </button>
        </div>
        {saveCardLink && (
          <div className="mt-3 flex items-center gap-2 bg-black/40 border border-emerald-500/20 rounded-xl px-3 py-2.5">
            <span className="text-xs text-emerald-300 font-mono truncate flex-1">{saveCardLink}</span>
            <button onClick={() => handleCopy(saveCardLink, 'save_card_link')}
              className="p-1.5 rounded-md text-emerald-300 hover:bg-emerald-500/10 shrink-0">
              {copiedKey === 'save_card_link' ? <ClipboardCheck className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        )}
      </div>

      <PaymentLinksSection headers={headers} showToast={showToast} />

      {/* Modal de cobro */}
      {chargeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setChargeTarget(null)}>
          <div onClick={e => e.stopPropagation()} className="w-full max-w-md bg-gradient-to-br from-[#0a1020] to-[#070a14] rounded-2xl border border-blue-500/30 p-6 shadow-[0_0_40px_rgba(59,130,246,0.18)]">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-blue-300" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Cobrar tarjeta</h3>
                <p className="text-xs text-gray-400">{chargeTarget.card_brand} ····{chargeTarget.card_last4} · {chargeTarget.user_name || chargeTarget.user_email}</p>
              </div>
            </div>
            <div className="space-y-3">
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input type="number" inputMode="decimal" autoFocus value={chargeAmount}
                  onChange={e => setChargeAmount(e.target.value)} placeholder="Monto (USD)"
                  className="w-full pl-10 pr-4 py-3 bg-black/60 border border-blue-500/30 rounded-xl text-white focus:border-blue-500 focus:outline-none" />
              </div>
              <input type="text" value={chargeDesc} onChange={e => setChargeDesc(e.target.value)} placeholder="Descripción (opcional)"
                className="w-full px-4 py-3 bg-black/60 border border-white/[0.08] rounded-xl text-white focus:border-blue-500 focus:outline-none placeholder:text-gray-600" />
              <div className="flex justify-end gap-2">
                <button onClick={() => setChargeTarget(null)} className="px-4 py-2.5 border border-white/[0.08] rounded-xl text-sm text-gray-300 hover:bg-white/[0.04]">Cancelar</button>
                <button onClick={handleCharge} disabled={charging}
                  className="px-6 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl text-sm font-bold hover:opacity-90 disabled:opacity-40 shadow-[0_0_22px_rgba(59,130,246,0.35)]">
                  {charging ? 'Cobrando…' : 'Cobrar ahora'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`fixed bottom-6 right-6 z-[60] max-w-md px-4 py-3 rounded-xl border backdrop-blur-xl shadow-2xl text-sm font-semibold ${
          toast.tone === 'ok'
            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 shadow-[0_0_24px_rgba(16,185,129,0.25)]'
            : 'bg-red-500/15 text-red-300 border-red-500/30 shadow-[0_0_24px_rgba(239,68,68,0.25)]'
        }`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

function SecretRow({ label, masked, full, copied, onCopy }: { label: string; masked: string; full?: string; copied: boolean; onCopy: () => void }) {
  return (
    <div className="rounded-lg bg-[#0a1020]/50 border border-white/[0.06] px-3 py-2 flex items-center justify-between gap-2">
      <div className="min-w-0">
        <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">{label}</div>
        <div className={`font-mono text-sm ${full ? 'text-amber-300' : 'text-gray-400'} truncate`}>
          {full || masked}
        </div>
      </div>
      {full && (
        <button onClick={onCopy} className="p-1.5 rounded-md text-gray-400 hover:text-amber-300 hover:bg-amber-500/10 transition shrink-0" title="Copiar">
          {copied ? <ClipboardCheck className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      )}
    </div>
  );
}

function StatCard({ icon, value, label, tone }: { icon: React.ReactNode; value: string; label: string; tone: 'violet' | 'blue' | 'emerald' | 'amber' }) {
  const palette = {
    violet:  { from: 'from-violet-500/[0.10]',  border: 'border-violet-500/25',  bar: 'from-violet-500 to-violet-400',   glow: 'bg-violet-500/[0.08]',  chipBg: 'bg-violet-500/15',  chipRing: 'ring-violet-500/25' },
    blue:    { from: 'from-blue-500/[0.10]',    border: 'border-blue-500/25',    bar: 'from-blue-500 to-blue-400',       glow: 'bg-blue-500/[0.08]',    chipBg: 'bg-blue-500/15',    chipRing: 'ring-blue-500/25' },
    emerald: { from: 'from-emerald-500/[0.10]', border: 'border-emerald-500/25', bar: 'from-emerald-500 to-emerald-400', glow: 'bg-emerald-500/[0.08]', chipBg: 'bg-emerald-500/15', chipRing: 'ring-emerald-500/25' },
    amber:   { from: 'from-amber-500/[0.10]',   border: 'border-amber-500/25',   bar: 'from-amber-500 to-amber-400',     glow: 'bg-amber-500/[0.08]',   chipBg: 'bg-amber-500/15',   chipRing: 'ring-amber-500/25' },
  }[tone];
  return (
    <div className={`relative overflow-hidden bg-gradient-to-br ${palette.from} to-transparent rounded-2xl border ${palette.border} p-4`}>
      <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${palette.bar} rounded-t-2xl`} />
      <div className={`absolute -bottom-6 -right-6 w-24 h-24 ${palette.glow} rounded-full blur-2xl pointer-events-none`} />
      <div className="relative z-10">
        <div className={`w-9 h-9 rounded-lg ${palette.chipBg} flex items-center justify-center ring-1 ${palette.chipRing} mb-2`}>{icon}</div>
        <div className="text-xl font-bold text-white">{value}</div>
        <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">{label}</div>
      </div>
    </div>
  );
}

function FilterPill({ children, active, onClick, tone }: { children: React.ReactNode; active: boolean; onClick: () => void; tone?: 'violet' | 'blue' }) {
  const activeStyles = tone === 'violet'
    ? 'bg-violet-500/15 text-violet-300 border-violet-500/30'
    : tone === 'blue'
      ? 'bg-blue-500/15 text-blue-300 border-blue-500/30'
      : 'bg-amber-500/15 text-amber-300 border-amber-500/30';
  return (
    <button onClick={onClick} className={`px-3 py-2 rounded-xl text-xs font-bold border transition ${active ? activeStyles : 'bg-white/[0.03] text-gray-400 border-white/[0.08] hover:bg-white/[0.06]'}`}>{children}</button>
  );
}

type PayLink = {
  id: string;
  reference: string;
  amount: number;
  url: string;
  status: string;
  tenant_name?: string | null;
  paid_at?: string | null;
  created_at?: string;
};

function PaymentLinksSection({
  headers,
  showToast,
}: {
  headers: () => Record<string, string>;
  showToast: (msg: string, tone?: 'ok' | 'err') => void;
}) {
  const [links, setLinks] = useState<PayLink[]>([]);
  const [open, setOpen] = useState(false);
  const [reference, setReference] = useState('');
  const [amount, setAmount] = useState('');
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/vault/payment-links?limit=50', { headers: headers() });
      if (res.ok) {
        const d = await res.json();
        setLinks(d.items || []);
      }
    } catch { /* noop */ }
  }, [headers]);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    const amt = parseFloat(amount);
    if (!reference.trim()) { showToast('Escribe una referencia', 'err'); return; }
    if (!amt || amt <= 0) { showToast('Escribe un monto válido', 'err'); return; }
    setCreating(true);
    try {
      const res = await fetch('/api/admin/vault/payment-links', {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ reference: reference.trim(), amount: amt }),
      });
      const d = await res.json();
      if (res.ok && d.success) {
        showToast('🔗 Link de pago creado');
        setReference(''); setAmount(''); setOpen(false);
        await load();
      } else {
        showToast(`❌ ${d.detail || 'Error al crear el link'}`, 'err');
      }
    } catch (e: any) {
      showToast(`❌ ${e?.message || 'Error'}`, 'err');
    }
    setCreating(false);
  };

  const copy = (url: string, id: string) => {
    navigator.clipboard?.writeText(url).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(''), 2000);
    });
  };

  const fmt = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="mt-8 bg-white/[0.03] rounded-2xl border border-white/[0.06] p-5" data-testid="payment-links-section">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/15 ring-1 ring-blue-500/30 flex items-center justify-center">
            <Link2 className="w-5 h-5 text-blue-300" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Links de Pago</h2>
            <p className="text-xs text-gray-500">Genera un link con monto y referencia para cobrar cualquier cargo.</p>
          </div>
        </div>
        <button
          data-testid="create-payment-link-btn"
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 text-white text-sm font-bold hover:opacity-90 shadow-[0_0_22px_rgba(59,130,246,0.35)]"
        >
          <Plus className="w-4 h-4" /> Crear link
        </button>
      </div>

      {open && (
        <div className="bg-black/40 border border-blue-500/20 rounded-xl p-4 mb-4 space-y-3" data-testid="create-payment-link-form">
          <input
            type="text"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="Referencia (ej: AFFINITY Tru Frame Cabinetry)"
            className="w-full px-4 py-2.5 bg-black/50 border border-white/[0.08] rounded-lg text-sm text-white focus:border-blue-500 focus:outline-none placeholder:text-gray-600"
          />
          <div className="relative">
            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="number"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Monto (USD)"
              className="w-full pl-10 pr-4 py-2.5 bg-black/50 border border-white/[0.08] rounded-lg text-sm text-white focus:border-blue-500 focus:outline-none placeholder:text-gray-600"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setOpen(false)} className="px-4 py-2 border border-white/[0.08] rounded-lg text-sm text-gray-300 hover:bg-white/[0.04]">Cancelar</button>
            <button
              data-testid="submit-payment-link"
              onClick={create}
              disabled={creating}
              className="px-5 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg text-sm font-bold hover:opacity-90 disabled:opacity-40"
            >
              {creating ? 'Creando…' : 'Generar link'}
            </button>
          </div>
        </div>
      )}

      {links.length === 0 ? (
        <p className="text-center text-gray-500 text-sm py-6">Aún no hay links de pago.</p>
      ) : (
        <div className="space-y-2">
          {links.map((l) => (
            <div key={l.id} className="bg-white/[0.03] rounded-xl border border-white/[0.06] p-3 flex items-center gap-3 flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold text-white">{l.reference}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                    l.status === 'paid' ? 'bg-emerald-500/15 text-emerald-400'
                    : l.status === 'inactive' ? 'bg-gray-500/15 text-gray-400'
                    : 'bg-blue-500/15 text-blue-400'
                  }`}>
                    {l.status === 'paid' ? '✓ Pagado' : l.status === 'inactive' ? 'Inactivo' : 'Activo'}
                  </span>
                </div>
                <div className="text-[11px] text-gray-500 mt-0.5 truncate">{l.url}</div>
              </div>
              <div className="text-sm font-bold text-emerald-300 shrink-0">{fmt(l.amount)}</div>
              <button
                onClick={() => copy(l.url, l.id)}
                className="p-2 rounded-lg bg-blue-500/10 ring-1 ring-blue-500/20 text-blue-300 hover:bg-blue-500/20 shrink-0"
                title="Copiar link"
              >
                {copiedId === l.id ? <ClipboardCheck className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
