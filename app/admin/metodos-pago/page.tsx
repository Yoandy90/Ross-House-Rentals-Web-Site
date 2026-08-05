'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAdminAuth } from '../layout';
import {
  Wallet, CreditCard, Zap, DollarSign, Building2, Banknote,
  Sparkles, Save, RefreshCw, Eye, EyeOff, AlertTriangle, CheckCircle2,
  Smartphone, Mail, Phone, Hash, MapPin, FileText,
} from 'lucide-react';

type MethodConfig = Record<string, any>;
type PaymentMethods = {
  zelle?: MethodConfig;
  cashapp?: MethodConfig;
  venmo?: MethodConfig;
  bank_transfer?: MethodConfig;
  money_order?: MethodConfig;
  check?: MethodConfig;
  cash?: MethodConfig;
};

const INPUT_CLASS =
  'w-full px-3 py-2.5 bg-[#0a1020]/80 border border-white/[0.08] rounded-xl text-white text-sm focus:border-amber-500 focus:outline-none placeholder:text-gray-600';

const METHOD_META: Record<string, { label: string; Icon: any; color: string; bg: string; ring: string; brand: string }> = {
  stripe:        { label: 'Stripe (Tarjetas)', Icon: CreditCard, color: 'text-violet-300', bg: 'bg-violet-500/15', ring: 'ring-violet-500/30', brand: '#635BFF' },
  zelle:         { label: 'Zelle',             Icon: Zap,        color: 'text-violet-300', bg: 'bg-violet-500/15', ring: 'ring-violet-500/30', brand: '#6D1ED4' },
  cashapp:       { label: 'CashApp',           Icon: DollarSign, color: 'text-emerald-300',bg: 'bg-emerald-500/15',ring: 'ring-emerald-500/30',brand: '#00D632' },
  venmo:         { label: 'Venmo',             Icon: Smartphone, color: 'text-sky-300',    bg: 'bg-sky-500/15',    ring: 'ring-sky-500/30',    brand: '#3D95CE' },
  bank_transfer: { label: 'Transferencia Bancaria', Icon: Building2, color: 'text-blue-300', bg: 'bg-blue-500/15', ring: 'ring-blue-500/30', brand: '#3B82F6' },
  money_order:   { label: 'Money Order',       Icon: Banknote,   color: 'text-amber-300',  bg: 'bg-amber-500/15',  ring: 'ring-amber-500/30',  brand: '#F59E0B' },
  check:         { label: 'Cheque',            Icon: FileText,   color: 'text-slate-300',  bg: 'bg-slate-500/15',  ring: 'ring-slate-500/30',  brand: '#64748B' },
  cash:          { label: 'Efectivo',          Icon: Banknote,   color: 'text-green-300',  bg: 'bg-green-500/15',  ring: 'ring-green-500/30',  brand: '#22C55E' },
};

export default function MetodosPagoPage() {
  const { headers } = useAdminAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [toast, setToast] = useState<{ msg: string; tone: 'ok' | 'err' } | null>(null);

  const [stripeEnabled, setStripeEnabled] = useState(false);
  const [stripePub, setStripePub] = useState('');
  const [stripeSecretMasked, setStripeSecretMasked] = useState('');
  const [stripeSecretInput, setStripeSecretInput] = useState('');
  const [lateFeeAmount, setLateFeeAmount] = useState('50');
  const [lateFeeGraceDays, setLateFeeGraceDays] = useState('5');
  const [methods, setMethods] = useState<PaymentMethods>({});

  const showToast = (msg: string, tone: 'ok' | 'err' = 'ok') => {
    setToast({ msg, tone });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/rental-stripe-config', { headers: headers() });
      if (res.ok) {
        const d = await res.json();
        setStripeEnabled(!!d.stripe_enabled);
        setStripePub(d.stripe_publishable_key || '');
        setStripeSecretMasked(d.stripe_secret_key_masked || '');
        setLateFeeAmount(String(d.default_late_fee_amount ?? 50));
        setLateFeeGraceDays(String(d.default_late_fee_grace_days ?? 5));
        setMethods(d.payment_methods || {});
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [headers]);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const updateMethod = (key: keyof PaymentMethods, patch: MethodConfig) => {
    setMethods(m => ({ ...m, [key]: { ...(m[key] || {}), ...patch } }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const body: any = {
        stripe_enabled: stripeEnabled,
        payment_methods: methods,
        default_late_fee_amount: parseFloat(lateFeeAmount) || 0,
        default_late_fee_grace_days: parseInt(lateFeeGraceDays, 10) || 0,
      };
      if (stripePub && !stripePub.includes('...')) body.stripe_publishable_key = stripePub;
      if (stripeSecretInput) body.stripe_secret_key = stripeSecretInput;

      const res = await fetch('/api/admin/rental-payment-methods', {
        method: 'PUT',
        headers: headers(),
        body: JSON.stringify(body),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.success) {
        showToast('✅ Configuración guardada — visible para inquilinos al instante');
        setStripeSecretInput('');
        await fetchConfig();
      } else {
        showToast(`❌ ${d?.detail || d?.message || 'Error al guardar'}`, 'err');
      }
    } catch (e: any) {
      showToast(`❌ ${e?.message || 'Error de red'}`, 'err');
    }
    setSaving(false);
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-3 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-6 relative pb-32">
      <div className="fixed top-0 right-1/3 w-96 h-96 bg-amber-500/[0.025] rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-1/4 left-1/4 w-96 h-96 bg-violet-500/[0.025] rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="relative w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500/25 to-amber-500/5 border border-amber-500/25 flex items-center justify-center shadow-[0_0_25px_rgba(245,158,11,0.18)]">
            <Wallet className="w-6 h-6 text-amber-400" />
            <Sparkles className="absolute -top-1 -right-1 w-3 h-3 text-amber-300" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Métodos de Pago</h2>
            <p className="text-sm text-gray-500">Lo que verán los inquilinos al pagar la renta</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchConfig}
            className="p-2.5 border border-white/[0.08] rounded-xl text-gray-400 hover:bg-white/[0.04] transition"
            title="Refrescar"
          ><RefreshCw className="w-4 h-4" /></button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-xl text-sm font-bold hover:opacity-90 shadow-[0_0_22px_rgba(245,158,11,0.35)] disabled:opacity-50 transition"
          >
            {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
            Guardar Cambios
          </button>
        </div>
      </div>

      {/* Stripe Section */}
      <div className="relative overflow-hidden bg-gradient-to-br from-violet-500/[0.08] to-transparent rounded-2xl border border-violet-500/25 p-5">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-violet-500 to-violet-400 rounded-t-2xl" />
        <div className="absolute -bottom-8 -right-8 w-40 h-40 bg-violet-500/[0.08] rounded-full blur-2xl pointer-events-none" />
        <div className="relative z-10">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-violet-500/20 ring-1 ring-violet-500/40 flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-violet-300" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Stripe — Pago con Tarjeta</h3>
                <p className="text-xs text-gray-400">Visa, Mastercard, Amex, Apple Pay · Procesamiento instantáneo</p>
              </div>
            </div>
            <Toggle checked={stripeEnabled} onChange={setStripeEnabled} />
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Publishable Key (pk_...)">
              <input
                type="text"
                value={stripePub}
                onChange={e => setStripePub(e.target.value)}
                placeholder="pk_live_..."
                className={INPUT_CLASS}
              />
            </Field>
            <Field label={`Secret Key ${stripeSecretMasked ? `(actual: ${stripeSecretMasked})` : ''}`}>
              <div className="relative">
                <input
                  type={showSecret ? 'text' : 'password'}
                  value={stripeSecretInput}
                  onChange={e => setStripeSecretInput(e.target.value)}
                  placeholder={stripeSecretMasked || 'sk_live_...'}
                  className={INPUT_CLASS + ' pr-10'}
                />
                <button
                  type="button"
                  onClick={() => setShowSecret(s => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-white"
                >
                  {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </Field>
          </div>
          <p className="text-[11px] text-gray-500 mt-2 flex items-center gap-1.5">
            <AlertTriangle className="w-3 h-3 text-amber-400" />
            Dejar el Secret Key vacío para mantener el actual. Se guarda encriptado en el servidor.
          </p>
        </div>
      </div>

      {/* Late Fee Section */}
      <div className="relative overflow-hidden bg-gradient-to-br from-red-500/[0.08] to-transparent rounded-2xl border border-red-500/25 p-5">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-500 to-red-400 rounded-t-2xl" />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-red-500/20 ring-1 ring-red-500/40 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-300" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Recargo por Mora</h3>
              <p className="text-xs text-gray-400">Se aplica automáticamente cuando el inquilino pasa del día de gracia sin pagar</p>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Monto del recargo ($)">
              <input
                type="number"
                step="0.01"
                value={lateFeeAmount}
                onChange={e => setLateFeeAmount(e.target.value)}
                placeholder="50"
                className={INPUT_CLASS}
              />
            </Field>
            <Field label="Días de gracia (después del día 1)">
              <input
                type="number"
                value={lateFeeGraceDays}
                onChange={e => setLateFeeGraceDays(e.target.value)}
                placeholder="5"
                className={INPUT_CLASS}
              />
            </Field>
          </div>
          <p className="text-[11px] text-gray-500 mt-2 flex items-center gap-1.5">
            <AlertTriangle className="w-3 h-3 text-amber-400" />
            Aplica a TODOS los contratos. Para sobrescribir en un contrato específico, edítalo desde Contratos.
          </p>
        </div>
      </div>

      {/* Method Cards */}
      <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mt-8 flex items-center gap-2">
        <Wallet className="w-4 h-4" /> Métodos Manuales (requieren verificación admin)
      </h3>

      {/* Zelle */}
      <MethodCard meta={METHOD_META.zelle} enabled={!!methods.zelle?.enabled} onToggle={v => updateMethod('zelle', { enabled: v })}>
        <Field label="Email" Icon={Mail}>
          <input type="email" value={methods.zelle?.email || ''} onChange={e => updateMethod('zelle', { email: e.target.value })} className={INPUT_CLASS} placeholder="rosshouserentals@gmail.com" />
        </Field>
        <Field label="Teléfono" Icon={Phone}>
          <input type="tel" value={methods.zelle?.phone || ''} onChange={e => updateMethod('zelle', { phone: e.target.value })} className={INPUT_CLASS} placeholder="(806) 934-2018" />
        </Field>
        <Field label="Nombre del Beneficiario" Icon={Building2}>
          <input type="text" value={methods.zelle?.name || ''} onChange={e => updateMethod('zelle', { name: e.target.value })} className={INPUT_CLASS} placeholder="Ross House Rentals LLC" />
        </Field>
      </MethodCard>

      {/* CashApp */}
      <MethodCard meta={METHOD_META.cashapp} enabled={!!methods.cashapp?.enabled} onToggle={v => updateMethod('cashapp', { enabled: v })}>
        <Field label="$Cashtag" Icon={Hash} className="sm:col-span-2">
          <input type="text" value={methods.cashapp?.tag || ''} onChange={e => updateMethod('cashapp', { tag: e.target.value })} className={INPUT_CLASS} placeholder="$RossHouseRentals" />
        </Field>
      </MethodCard>

      {/* Venmo */}
      <MethodCard meta={METHOD_META.venmo} enabled={!!methods.venmo?.enabled} onToggle={v => updateMethod('venmo', { enabled: v })}>
        <Field label="Username @" Icon={Hash} className="sm:col-span-2">
          <input type="text" value={methods.venmo?.username || ''} onChange={e => updateMethod('venmo', { username: e.target.value })} className={INPUT_CLASS} placeholder="@RossHouseRentals" />
        </Field>
      </MethodCard>

      {/* Bank Transfer */}
      <MethodCard meta={METHOD_META.bank_transfer} enabled={!!methods.bank_transfer?.enabled} onToggle={v => updateMethod('bank_transfer', { enabled: v })}>
        <Field label="Banco" Icon={Building2}>
          <input type="text" value={methods.bank_transfer?.bank_name || ''} onChange={e => updateMethod('bank_transfer', { bank_name: e.target.value })} className={INPUT_CLASS} placeholder="Bank of America" />
        </Field>
        <Field label="Nombre Cuenta">
          <input type="text" value={methods.bank_transfer?.account_name || ''} onChange={e => updateMethod('bank_transfer', { account_name: e.target.value })} className={INPUT_CLASS} placeholder="Ross House Rentals LLC" />
        </Field>
        <Field label="Routing Number">
          <input type="text" value={methods.bank_transfer?.routing || ''} onChange={e => updateMethod('bank_transfer', { routing: e.target.value })} className={INPUT_CLASS} placeholder="111000025" />
        </Field>
        <Field label="Cuenta (últimos 4)">
          <input type="text" value={methods.bank_transfer?.account_last4 || ''} onChange={e => updateMethod('bank_transfer', { account_last4: e.target.value })} className={INPUT_CLASS} placeholder="****1234" />
        </Field>
        <Field label="Instrucciones extra" className="sm:col-span-2">
          <input type="text" value={methods.bank_transfer?.instructions || ''} onChange={e => updateMethod('bank_transfer', { instructions: e.target.value })} className={INPUT_CLASS} placeholder='Incluye "RENTA + Dirección" en el memo' />
        </Field>
      </MethodCard>

      {/* Money Order */}
      <MethodCard meta={METHOD_META.money_order} enabled={!!methods.money_order?.enabled} onToggle={v => updateMethod('money_order', { enabled: v })}>
        <Field label="Hacer pagadero a">
          <input type="text" value={methods.money_order?.payable_to || ''} onChange={e => updateMethod('money_order', { payable_to: e.target.value })} className={INPUT_CLASS} placeholder="Ross House Rentals LLC" />
        </Field>
        <Field label="Enviar a" Icon={MapPin}>
          <input type="text" value={methods.money_order?.mail_to || ''} onChange={e => updateMethod('money_order', { mail_to: e.target.value })} className={INPUT_CLASS} placeholder="123 Test St, Dumas, TX 79029" />
        </Field>
        <Field label="O entregar en oficina" className="sm:col-span-2">
          <input type="text" value={methods.money_order?.office_address || ''} onChange={e => updateMethod('money_order', { office_address: e.target.value })} className={INPUT_CLASS} placeholder="305 Bruce Ave, Dumas, TX 79029" />
        </Field>
      </MethodCard>

      {/* Check */}
      <MethodCard meta={METHOD_META.check} enabled={!!methods.check?.enabled} onToggle={v => updateMethod('check', { enabled: v })}>
        <Field label="Hacer pagadero a">
          <input type="text" value={methods.check?.payable_to || ''} onChange={e => updateMethod('check', { payable_to: e.target.value })} className={INPUT_CLASS} placeholder="Ross House Rentals LLC" />
        </Field>
        <Field label="Enviar a" Icon={MapPin}>
          <input type="text" value={methods.check?.mail_to || ''} onChange={e => updateMethod('check', { mail_to: e.target.value })} className={INPUT_CLASS} placeholder="305 Bruce Ave, Dumas, TX 79029" />
        </Field>
      </MethodCard>

      {/* Cash */}
      <MethodCard meta={METHOD_META.cash} enabled={!!methods.cash?.enabled} onToggle={v => updateMethod('cash', { enabled: v })}>
        <Field label="Dirección de oficina" Icon={MapPin}>
          <input type="text" value={methods.cash?.office_address || ''} onChange={e => updateMethod('cash', { office_address: e.target.value })} className={INPUT_CLASS} placeholder="305 Bruce Ave, Dumas, TX 79029" />
        </Field>
        <Field label="Horario">
          <input type="text" value={methods.cash?.office_hours || ''} onChange={e => updateMethod('cash', { office_hours: e.target.value })} className={INPUT_CLASS} placeholder="L-V 9am-5pm" />
        </Field>
      </MethodCard>

      {/* Save floating bar */}
      <div className="fixed bottom-6 right-6 z-50 flex gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-2xl text-sm font-bold hover:opacity-90 shadow-[0_0_30px_rgba(245,158,11,0.4)] disabled:opacity-50 transition"
        >
          {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
          Guardar todos los cambios
        </button>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-24 right-6 z-[60] max-w-sm px-4 py-3 rounded-xl border backdrop-blur-xl shadow-2xl text-sm font-semibold ${
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

/* ─── Sub-components ─────────────────────────────────────────── */

function MethodCard({ meta, enabled, onToggle, children }: {
  meta: any;
  enabled: boolean;
  onToggle: (v: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <div className={`relative overflow-hidden rounded-2xl border p-5 transition ${
      enabled ? `bg-gradient-to-br ${meta.bg} to-transparent ${meta.ring.replace('ring-', 'border-')}` : 'bg-white/[0.02] border-white/[0.06]'
    }`}>
      <div className={`absolute top-0 left-0 right-0 h-0.5 ${enabled ? `bg-gradient-to-r ${meta.bg.replace('bg-', 'from-')} to-transparent` : 'bg-transparent'} rounded-t-2xl`} />
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${meta.bg} ring-1 ${meta.ring} flex items-center justify-center`}>
              <meta.Icon className={`w-5 h-5 ${meta.color}`} />
            </div>
            <h3 className="text-base font-bold text-white">{meta.label}</h3>
            {enabled && <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-bold flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Activo</span>}
          </div>
          <Toggle checked={enabled} onChange={onToggle} />
        </div>
        {enabled && (
          <div className="grid sm:grid-cols-2 gap-3 mt-3">{children}</div>
        )}
      </div>
    </div>
  );
}

function Field({ label, Icon, className, children }: { label: string; Icon?: any; className?: string; children: React.ReactNode }) {
  return (
    <div className={className}>
      <label className="text-[11px] font-bold text-gray-400 mb-1 uppercase tracking-wider flex items-center gap-1.5">
        {Icon && <Icon className="w-3 h-3" />} {label}
      </label>
      {children}
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-full transition ${checked ? 'bg-gradient-to-r from-emerald-500 to-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.4)]' : 'bg-white/[0.08]'}`}
    >
      <div className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform shadow-md ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  );
}
