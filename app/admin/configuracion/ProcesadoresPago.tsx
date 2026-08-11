'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  CreditCard, Key, Shield, CheckCircle2, AlertTriangle, RefreshCw,
  Save, Zap, Copy, Hash, Link2, Power, ShieldCheck, FlaskConical, Rocket,
  TrendingDown, DollarSign, Receipt, BarChart3,
} from 'lucide-react';

type ProcName = 'stripe' | 'square' | 'clover';
type Env = 'sandbox' | 'production';

const PROC_META: Record<ProcName, { label: string; color: string; desc: string }> = {
  stripe: { label: 'Stripe', color: 'purple', desc: 'Tarjetas, ACH, Payment Links (procesador actual)' },
  square: { label: 'Square', color: 'emerald', desc: 'Checkout hospedado de Square (Payment Links)' },
  clover: { label: 'Clover', color: 'orange', desc: 'Hosted Checkout de Clover' },
};

const FIELDS: Record<ProcName, { key: string; label: string; secret?: boolean; placeholder: Record<Env, string> }[]> = {
  stripe: [
    { key: 'publishable_key', label: 'Publishable Key', placeholder: { sandbox: 'pk_test_...', production: 'pk_live_...' } },
    { key: 'secret_key', label: 'Secret Key', secret: true, placeholder: { sandbox: 'sk_test_...', production: 'sk_live_...' } },
    { key: 'webhook_secret', label: 'Webhook Secret', secret: true, placeholder: { sandbox: 'whsec_...', production: 'whsec_...' } },
  ],
  square: [
    { key: 'application_id', label: 'Application ID', placeholder: { sandbox: 'sandbox-sq0idb-...', production: 'sq0idp-...' } },
    { key: 'access_token', label: 'Access Token', secret: true, placeholder: { sandbox: 'EAAA... (sandbox)', production: 'EAAA... (production)' } },
    { key: 'location_id', label: 'Location ID', placeholder: { sandbox: 'L... (sandbox)', production: 'L... (production)' } },
    { key: 'webhook_signature_key', label: 'Webhook Signature Key', secret: true, placeholder: { sandbox: 'Firma de webhooks', production: 'Firma de webhooks' } },
    { key: 'webhook_url', label: 'Webhook URL registrada', placeholder: { sandbox: 'https://.../api/webhooks/square', production: 'https://.../api/webhooks/square' } },
  ],
  clover: [
    { key: 'merchant_id', label: 'Merchant ID', placeholder: { sandbox: 'Merchant sandbox', production: 'Merchant producción' } },
    { key: 'private_key', label: 'Private Key / API Token', secret: true, placeholder: { sandbox: 'Token sandbox', production: 'Token producción' } },
    { key: 'webhook_signing_secret', label: 'Webhook Signing Secret', secret: true, placeholder: { sandbox: 'Secreto de firma', production: 'Secreto de firma' } },
    { key: 'page_config_uuid', label: 'Page Config UUID (opcional)', placeholder: { sandbox: 'UUID', production: 'UUID' } },
    { key: 'webhook_url', label: 'Webhook URL registrada', placeholder: { sandbox: 'https://.../api/webhooks/clover', production: 'https://.../api/webhooks/clover' } },
  ],
};

const CC: Record<string, { text: string; bg: string; border: string; btn: string }> = {
  purple: { text: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20', btn: 'hover:bg-purple-500/20' },
  emerald: { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', btn: 'hover:bg-emerald-500/20' },
  orange: { text: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20', btn: 'hover:bg-orange-500/20' },
};

export default function ProcesadoresPago({ headers }: { headers: () => Record<string, string> }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  // forms[proc][env][field]
  const [forms, setForms] = useState<any>({});
  // editEnv[proc] = pestaña de credenciales que se está editando
  const [editEnv, setEditEnv] = useState<Record<ProcName, Env>>({ stripe: 'production', square: 'sandbox', clover: 'sandbox' });
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState<Record<string, { ok: boolean; text: string }>>({});
  const [copied, setCopied] = useState('');
  const [fees, setFees] = useState<any>(null);

  const loadFees = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/payment-processors/fee-comparison', { headers: headers() });
      if (res.ok) setFees(await res.json());
    } catch { /* noop */ }
  }, [headers]);

  useEffect(() => { loadFees(); }, [loadFees]);

  const applyData = (d: any) => {
    setData(d);
    const f: any = {};
    (['stripe', 'square', 'clover'] as ProcName[]).forEach(p => {
      f[p] = { sandbox: {}, production: {} };
      (['sandbox', 'production'] as Env[]).forEach(env => {
        FIELDS[p].forEach(field => {
          if (!field.secret) f[p][env][field.key] = d.processors?.[p]?.credentials?.[env]?.[field.key] || '';
        });
      });
    });
    setForms(f);
  };

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/payment-processors', { headers: headers() });
      if (res.ok) {
        const d = await res.json();
        applyData(d);
        setEditEnv({
          stripe: d.processors?.stripe?.environment || 'production',
          square: d.processors?.square?.environment || 'sandbox',
          clover: d.processors?.clover?.environment || 'sandbox',
        });
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const setField = (p: ProcName, env: Env, key: string, val: string) =>
    setForms((prev: any) => ({ ...prev, [p]: { ...prev[p], [env]: { ...prev[p][env], [key]: val } } }));

  const setStatus = (p: string, ok: boolean, text: string) => {
    setMsg(prev => ({ ...prev, [p]: { ok, text } }));
    setTimeout(() => setMsg(prev => { const n = { ...prev }; delete n[p]; return n; }), 6000);
  };

  const call = async (p: ProcName, key: string, url: string, method: string, body?: any) => {
    setBusy(key);
    try {
      const res = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json', ...headers() },
        body: body ? JSON.stringify(body) : undefined,
      });
      const d = await res.json();
      if (res.ok) {
        if (d.processors) applyData(d);
        setStatus(p, true, d.message || d.detail || 'OK');
        return d;
      }
      setStatus(p, false, d.detail || d.error || 'Error');
    } catch { setStatus(p, false, 'Error de red'); }
    finally { setBusy(''); }
    return null;
  };

  const save = async (p: ProcName) => {
    const env = editEnv[p];
    const body: Record<string, string> = { environment: env };
    Object.entries(forms[p][env] || {}).forEach(([k, v]) => { if (v) body[k] = v as string; });
    const d = await call(p, `save-${p}`, `/api/admin/payment-processors/${p}`, 'PUT', body);
    if (d) setForms((prev: any) => {
      const n = { ...prev };
      FIELDS[p].forEach(f => { if (f.secret) n[p][env][f.key] = ''; });
      return n;
    });
  };

  const test = async (p: ProcName) => {
    setBusy(`test-${p}`);
    try {
      const res = await fetch(`/api/admin/payment-processors/${p}/test`, { method: 'POST', headers: headers() });
      const d = await res.json();
      setStatus(p, !!d.success, d.success ? `✓ ${d.detail || 'Conexión exitosa'}` : (d.error || 'Falló la conexión'));
    } catch { setStatus(p, false, 'Error de red'); }
    setBusy('');
  };

  const copyText = (text: string, id: string) => {
    navigator.clipboard?.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(''), 1500);
  };

  if (loading) return (
    <div className="flex items-center justify-center h-40">
      <div className="w-8 h-8 border-3 border-slate-500/30 border-t-slate-500 rounded-full animate-spin" />
    </div>
  );

  const active = data?.active_processor || 'stripe';
  const threeDs = data?.three_ds || { stripe: true, square: true };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
        <Zap className="w-5 h-5 text-blue-400 mt-0.5 shrink-0" />
        <p className="text-sm text-gray-300">
          El procesador <span className="font-bold text-white">ACTIVO</span> cobra en la
          <span className="font-semibold text-white"> app móvil</span> y en la <span className="font-semibold text-white">web</span>.
          Cada procesador guarda credenciales de <span className="font-semibold text-white">Sandbox y Producción</span> por separado
          y puedes cambiar de entorno o de procesador cuando quieras.
        </p>
      </div>

      {/* ═══ COMPARADOR DE COMISIONES ═══ */}
      {fees && fees.tx_count_12m > 0 && (
        <div className="bg-[#0d1526]/80 border border-white/[0.08] rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-cyan-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-white font-bold">Comparador de Comisiones</h3>
              <p className="text-xs text-gray-500">Estimado con tu volumen real de rentas de los últimos {fees.months_with_data} {fees.months_with_data === 1 ? 'mes' : 'meses'}</p>
            </div>
            <button onClick={loadFees} className="p-2 border border-white/[0.08] rounded-lg text-gray-400 hover:bg-white/[0.04]"><RefreshCw className="w-3.5 h-3.5" /></button>
          </div>

          {/* Volumen real */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            {[
              { label: 'Volumen cobrado', value: `$${fees.volume_12m.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, icon: DollarSign, color: 'text-emerald-400' },
              { label: 'Transacciones', value: fees.tx_count_12m, icon: Receipt, color: 'text-blue-400' },
              { label: 'Promedio mensual', value: `$${fees.monthly_avg_volume.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, icon: BarChart3, color: 'text-cyan-400' },
              { label: 'Ticket promedio', value: `$${fees.avg_ticket.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, icon: CreditCard, color: 'text-purple-400' },
            ].map((s, i) => (
              <div key={i} className="p-3 bg-[#0a1020]/60 border border-white/[0.06] rounded-xl">
                <div className="flex items-center gap-1.5 text-[10px] text-gray-500 font-bold uppercase tracking-wider"><s.icon className={`w-3 h-3 ${s.color}`} /> {s.label}</div>
                <div className={`text-lg font-bold mt-1 ${s.color}`}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Comparación por procesador */}
          <div className="space-y-2">
            {fees.comparison.map((c: any) => {
              const maxFee = Math.max(...fees.comparison.map((x: any) => x.fee_annual));
              const pct = maxFee > 0 ? (c.fee_annual / maxFee) * 100 : 0;
              const isCheapest = c.processor === fees.cheapest;
              return (
                <div key={c.processor} className={`p-3 rounded-xl border ${isCheapest ? 'border-emerald-500/35 bg-emerald-500/[0.05]' : 'border-white/[0.06] bg-[#0a1020]/60'}`}>
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <span className="text-sm font-bold text-white">{c.label}</span>
                    <span className="text-[11px] text-gray-500">{c.rate_label} por transacción</span>
                    {isCheapest && (
                      <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-500/15 border border-emerald-500/30 rounded-full text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                        <TrendingDown className="w-3 h-3" /> Más barato
                      </span>
                    )}
                    {c.is_active && (
                      <span className="px-2 py-0.5 bg-green-500/15 border border-green-500/30 rounded-full text-[10px] font-bold text-green-400 uppercase tracking-wider">Activo</span>
                    )}
                    <div className="ml-auto text-right">
                      <span className={`text-base font-bold ${isCheapest ? 'text-emerald-400' : 'text-white'}`}>${c.fee_annual.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                      <span className="text-[11px] text-gray-500"> /12m · {c.effective_pct}% efectivo · ~${c.fee_monthly_avg.toLocaleString('en-US', { minimumFractionDigits: 2 })}/mes</span>
                    </div>
                  </div>
                  <div className="h-2 rounded-full bg-white/[0.05] overflow-hidden">
                    <div className={`h-full rounded-full ${isCheapest ? 'bg-gradient-to-r from-emerald-500 to-emerald-400' : c.is_active ? 'bg-gradient-to-r from-blue-500 to-blue-400' : 'bg-gradient-to-r from-gray-600 to-gray-500'}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Recomendación */}
          {fees.savings_annual_vs_active > 0 ? (
            <div className="mt-3 flex items-center gap-2.5 p-3 bg-emerald-500/[0.06] border border-emerald-500/25 rounded-xl">
              <TrendingDown className="w-4 h-4 text-emerald-400 shrink-0" />
              <p className="text-xs text-emerald-300">
                Con <b className="capitalize">{fees.cheapest}</b> ahorrarías <b>${fees.savings_annual_vs_active.toLocaleString('en-US', { minimumFractionDigits: 2 })}</b> al año vs tu procesador activo con este volumen.
              </p>
            </div>
          ) : (
            <div className="mt-3 flex items-center gap-2.5 p-3 bg-blue-500/[0.06] border border-blue-500/20 rounded-xl">
              <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0" />
              <p className="text-xs text-blue-300">Tu procesador activo ya está entre los más baratos para tu volumen. 👍</p>
            </div>
          )}
          <p className="text-[10px] text-gray-600 mt-2">{fees.note}</p>
        </div>
      )}

      {/* ═══ 3D SECURE ═══ */}
      <div className="bg-[#0d1526]/80 border border-white/[0.08] rounded-2xl p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-green-400" />
          </div>
          <div>
            <h3 className="text-white font-bold">3D Secure (verificación obligatoria)</h3>
            <p className="text-xs text-gray-500">Con 3DS activo, TODA tarjeta debe verificarse (web y links de pago). Si la tarjeta no soporta 3DS, queda registrada la evidencia de que se solicitó → <b className="text-green-400">la responsabilidad por fraude pasa al banco emisor del cliente</b>, no a ti.</p>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          {(['stripe', 'square'] as const).map(p => (
            <div key={p} className="flex items-center justify-between p-3 bg-[#0a1020]/60 border border-white/[0.06] rounded-xl">
              <div>
                <p className="text-sm font-bold text-white">{PROC_META[p].label}</p>
                <p className="text-[11px] text-gray-500">{threeDs[p] ? '3DS obligatorio en todos los cobros' : '3DS desactivado (no recomendado)'}</p>
              </div>
              <button
                onClick={() => call(p, `3ds-${p}`, '/api/admin/payment-processors-3ds', 'PUT', { processor: p, enabled: !threeDs[p] })}
                disabled={busy === `3ds-${p}`}
                className={`relative w-12 h-6.5 rounded-full transition border ${threeDs[p] ? 'bg-green-500/30 border-green-500/50' : 'bg-white/[0.06] border-white/[0.1]'}`}
                style={{ height: 26, width: 48 }}
                title={threeDs[p] ? 'Desactivar 3DS' : 'Activar 3DS'}
              >
                <span className={`absolute top-0.5 w-5 h-5 rounded-full transition-all ${threeDs[p] ? 'right-0.5 bg-green-400' : 'left-0.5 bg-gray-500'}`} />
              </button>
            </div>
          ))}
        </div>
        {(msg['stripe']?.text?.includes('3D') || msg['square']?.text?.includes('3D')) && (
          <p className="text-xs text-green-400 mt-2">{msg['stripe']?.text || msg['square']?.text}</p>
        )}
        <p className="text-[11px] text-gray-600 mt-2">⚠ Nota: con 3DS activo, los links de pago de Stripe usan Checkout seguro con validez de 24h. Square aplica la verificación del comprador automáticamente en su checkout hospedado.</p>
      </div>

      {/* ═══ PROCESADORES ═══ */}
      {(['stripe', 'square', 'clover'] as ProcName[]).map(p => {
        const meta = PROC_META[p];
        const cc = CC[meta.color];
        const proc = data?.processors?.[p] || {};
        const activeEnv: Env = proc.environment || 'sandbox';
        const env = editEnv[p];
        const envCreds = proc.credentials?.[env] || {};
        const isActive = active === p;
        const status = msg[p];
        return (
          <div key={p} className={`bg-[#0d1526]/80 border rounded-2xl p-5 ${isActive ? 'border-green-500/40 ring-1 ring-green-500/20' : 'border-white/[0.08]'}`}>
            {/* Header */}
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <div className={`w-10 h-10 rounded-xl ${cc.bg} border ${cc.border} flex items-center justify-center`}>
                <CreditCard className={`w-5 h-5 ${cc.text}`} />
              </div>
              <div className="flex-1 min-w-[150px]">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-white font-bold">{meta.label}</h3>
                  {isActive && (
                    <span className="flex items-center gap-1 px-2 py-0.5 bg-green-500/15 border border-green-500/30 rounded-full text-[10px] font-bold text-green-400 uppercase tracking-wider">
                      <CheckCircle2 className="w-3 h-3" /> Activo
                    </span>
                  )}
                  <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${activeEnv === 'production' ? 'bg-blue-500/15 border-blue-500/30 text-blue-400' : 'bg-amber-500/10 border-amber-500/25 text-amber-400'}`}>
                    {activeEnv === 'production' ? <Rocket className="w-3 h-3" /> : <FlaskConical className="w-3 h-3" />}
                    {activeEnv === 'production' ? 'Producción' : 'Sandbox'}
                  </span>
                </div>
                <p className="text-xs text-gray-500">{meta.desc}</p>
              </div>
              {/* Cambiar entorno activo */}
              <button
                onClick={() => call(p, `env-${p}`, `/api/admin/payment-processors/${p}/environment`, 'POST',
                  { environment: activeEnv === 'production' ? 'sandbox' : 'production' })}
                disabled={busy === `env-${p}`}
                className="flex items-center gap-1.5 px-3 py-2 bg-white/[0.04] text-gray-300 border border-white/[0.1] rounded-lg text-xs font-bold hover:bg-white/[0.08] transition disabled:opacity-30"
                title="Cambiar entre sandbox y producción"
              >
                {busy === `env-${p}` ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : (activeEnv === 'production' ? <FlaskConical className="w-3.5 h-3.5" /> : <Rocket className="w-3.5 h-3.5" />)}
                Usar {activeEnv === 'production' ? 'Sandbox' : 'Producción'}
              </button>
              {!isActive && (
                <button
                  onClick={() => call(p, `act-${p}`, `/api/admin/payment-processors/${p}/activate`, 'POST')}
                  disabled={busy === `act-${p}` || !proc.configured}
                  title={!proc.configured ? `Guarda las credenciales de ${activeEnv} primero` : `Usar ${meta.label} para todos los cobros`}
                  className="flex items-center gap-2 px-4 py-2 bg-green-500/10 text-green-400 border border-green-500/25 rounded-lg text-sm font-bold hover:bg-green-500/20 transition disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  {busy === `act-${p}` ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Power className="w-4 h-4" />}
                  Activar
                </button>
              )}
            </div>

            {/* Tabs de entorno para EDITAR credenciales */}
            <div className="flex gap-1 mb-3">
              {(['sandbox', 'production'] as Env[]).map(e => (
                <button key={e}
                  onClick={() => setEditEnv(prev => ({ ...prev, [p]: e }))}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition ${env === e ? (e === 'production' ? 'bg-blue-500/15 border-blue-500/30 text-blue-400' : 'bg-amber-500/10 border-amber-500/25 text-amber-400') : 'bg-transparent border-white/[0.06] text-gray-500 hover:text-gray-300'}`}>
                  {e === 'production' ? <Rocket className="w-3 h-3" /> : <FlaskConical className="w-3 h-3" />}
                  {e === 'production' ? 'Credenciales Producción' : 'Credenciales Sandbox'}
                  {proc.credentials?.[e]?.configured && <CheckCircle2 className="w-3 h-3 text-green-400" />}
                </button>
              ))}
            </div>

            {/* Fields */}
            <div className="grid lg:grid-cols-2 gap-3">
              {FIELDS[p].map(field => (
                <div key={field.key}>
                  <label className="flex items-center gap-1.5 text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wider">
                    {field.secret ? <Shield className="w-3 h-3" /> : <Key className="w-3 h-3" />}
                    {field.label}
                    {field.secret && envCreds[`has_${field.key}`] && (
                      <span className="normal-case font-medium text-green-500/80">— guardado ({envCreds[`${field.key}_masked`]})</span>
                    )}
                  </label>
                  <input
                    type={field.secret ? 'password' : 'text'}
                    value={forms[p]?.[env]?.[field.key] || ''}
                    onChange={e => setField(p, env, field.key, e.target.value)}
                    placeholder={field.secret && envCreds[`has_${field.key}`] ? 'Dejar vacío para no cambiar' : field.placeholder[env]}
                    className="w-full px-3 py-2.5 bg-[#0a1020]/60 border border-white/[0.08] rounded-xl text-white text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
              ))}
            </div>

            {/* Webhook endpoint */}
            <div className="mt-3 flex items-center gap-2 p-2.5 bg-[#0a1020]/60 border border-white/[0.06] rounded-xl">
              <Link2 className="w-4 h-4 text-gray-500 shrink-0" />
              <span className="text-xs text-gray-500 shrink-0">Webhook endpoint:</span>
              <code className="text-xs text-gray-300 truncate flex-1">{proc.webhook_endpoint}</code>
              <button onClick={() => copyText(proc.webhook_endpoint, `wh-${p}`)}
                className="flex items-center gap-1 px-2 py-1 text-xs text-gray-400 hover:text-white transition shrink-0">
                {copied === `wh-${p}` ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copied === `wh-${p}` ? 'Copiado' : 'Copiar'}
              </button>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-3 mt-4">
              <button onClick={() => save(p)} disabled={busy === `save-${p}`}
                className={`flex items-center gap-2 px-4 py-2 ${cc.bg} ${cc.text} border ${cc.border} rounded-lg text-sm font-semibold ${cc.btn} transition disabled:opacity-30`}>
                {busy === `save-${p}` ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Guardar ({env === 'production' ? 'Producción' : 'Sandbox'})
              </button>
              <button onClick={() => test(p)} disabled={busy === `test-${p}`}
                className="flex items-center gap-2 px-4 py-2 bg-slate-500/10 text-slate-300 border border-slate-500/20 rounded-lg text-sm font-semibold hover:bg-slate-500/20 transition disabled:opacity-30">
                {busy === `test-${p}` ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Hash className="w-4 h-4" />}
                Probar Conexión ({activeEnv})
              </button>
              {status && (
                <span className={`flex items-center gap-1.5 text-sm font-medium ${status.ok ? 'text-green-400' : 'text-red-400'}`}>
                  {status.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                  {status.text}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
