'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAdminAuth } from '../layout';
import {
  Settings, Save, Building2, DollarSign, CreditCard, Mail,
  FileText, Eye, EyeOff, CheckCircle2, AlertTriangle, RefreshCw,
  Shield, Percent, Bell, Key, Globe, Phone, MapPin, Hash, Scale, Languages
} from 'lucide-react';

export default function ConfiguracionPage() {
  const { headers } = useAdminAuth();
  const [config, setConfig] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState('empresa');
  const [showStripeSecret, setShowStripeSecret] = useState(false);
  const [showWebhookSecret, setShowWebhookSecret] = useState(false);
  const [testingStripe, setTestingStripe] = useState(false);
  const [stripeStatus, setStripeStatus] = useState<'idle' | 'success' | 'error'>('idle');

  // Legal documents state
  const [legalDocs, setLegalDocs] = useState<any>({});
  const [legalLoading, setLegalLoading] = useState(false);
  const [legalSaving, setLegalSaving] = useState(false);
  const [legalSaved, setLegalSaved] = useState(false);
  const [legalLang, setLegalLang] = useState<'es' | 'en'>('es');
  const [legalDoc, setLegalDoc] = useState<'terms' | 'privacy'>('terms');

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/rental-config', { headers: headers() });
      if (res.ok) { const d = await res.json(); setConfig(d.config || {}); }
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  // Fetch legal documents when legal tab is active
  const fetchLegalDocs = useCallback(async () => {
    setLegalLoading(true);
    try {
      const res = await fetch('/api/admin/legal-documents', { headers: headers() });
      if (res.ok) {
        const d = await res.json();
        setLegalDocs(d.documents || {});
      }
    } catch (e) { console.error(e); }
    setLegalLoading(false);
  }, []);

  useEffect(() => {
    if (activeTab === 'legal') fetchLegalDocs();
  }, [activeTab]);

  const handleSaveLegal = async () => {
    setLegalSaving(true);
    try {
      const res = await fetch('/api/admin/legal-documents', {
        method: 'PUT',
        headers: headers(),
        body: JSON.stringify(legalDocs)
      });
      if (res.ok) {
        setLegalSaved(true);
        setTimeout(() => setLegalSaved(false), 3000);
      }
    } catch (e) { console.error(e); }
    setLegalSaving(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/rental-config', {
        method: 'PUT',
        headers: headers(),
        body: JSON.stringify(config)
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  const testStripeConnection = async () => {
    setTestingStripe(true);
    setStripeStatus('idle');
    try {
      const res = await fetch('/api/admin/stripe/test-connection', { headers: headers() });
      if (res.ok) {
        const d = await res.json();
        setStripeStatus(d.success ? 'success' : 'error');
      } else {
        setStripeStatus('error');
      }
    } catch {
      setStripeStatus('error');
    }
    setTestingStripe(false);
  };

  const tabs = [
    { key: 'empresa', label: 'Empresa', icon: Building2, color: 'blue' },
    { key: 'stripe', label: 'Stripe', icon: CreditCard, color: 'purple' },
    { key: 'pagos', label: 'Pagos', icon: DollarSign, color: 'amber' },
    { key: 'contratos', label: 'Contratos', icon: FileText, color: 'emerald' },
    { key: 'notificaciones', label: 'Notificaciones', icon: Bell, color: 'rose' },
    { key: 'legal', label: 'Legal', icon: Scale, color: 'cyan' },
  ];

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-3 border-slate-500/30 border-t-slate-500 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6 relative">
      <div className="fixed bottom-0 right-1/3 w-96 h-96 bg-slate-500/[0.02] rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-slate-500/20 to-slate-500/5 border border-slate-500/20 flex items-center justify-center">
            <Settings className="w-6 h-6 text-slate-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Configuración</h2>
            <p className="text-sm text-gray-500">Ajustes del sistema de alquileres</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {saved && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20">
              <CheckCircle2 className="w-3.5 h-3.5" /> Guardado
            </span>
          )}
          <button onClick={fetchConfig} className="p-2 border border-white/[0.08] rounded-lg text-gray-400 hover:bg-white/[0.04]">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-xl text-sm font-bold hover:opacity-90 disabled:opacity-30 shadow-[0_0_15px_rgba(59,130,246,0.3)] transition"
          >
            {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Save className="w-4 h-4" /> Guardar Cambios</>}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white/[0.02] rounded-xl p-1 border border-white/[0.06]">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all flex-1 justify-center ${
              activeTab === tab.key
                ? `bg-${tab.color}-500/15 text-${tab.color}-400 border border-${tab.color}-500/25`
                : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.03]'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ═══════════ Tab: Empresa ═══════════ */}
      {activeTab === 'empresa' && (
        <div className="grid lg:grid-cols-2 gap-4">
          <Card title="Información de la Empresa" icon={Building2} color="blue">
            <Field label="Nombre de la Empresa" value={config.name || config.company_name || ''} onChange={v => setConfig({...config, name: v, company_name: v})} placeholder="Ross House Rentals LLC" icon={Building2} />
            <Field label="Dirección" value={config.address || ''} onChange={v => setConfig({...config, address: v})} placeholder="305 Bruce Ave, Dumas, TX 79029" icon={MapPin} />
            <Field label="Teléfono" value={config.phone || ''} onChange={v => setConfig({...config, phone: v})} placeholder="(806) 934-2018" icon={Phone} />
            <Field label="Email" value={config.email || ''} onChange={v => setConfig({...config, email: v})} placeholder="info@rosshouserentals.com" icon={Mail} />
            <Field label="Sitio Web" value={config.website || ''} onChange={v => setConfig({...config, website: v})} placeholder="www.rosshouserentals.com" icon={Globe} />
          </Card>

          <Card title="Ubicación Legal" icon={MapPin} color="blue">
            <Field label="Estado" value={config.state || ''} onChange={v => setConfig({...config, state: v})} placeholder="Texas" />
            <Field label="Condado" value={config.county || ''} onChange={v => setConfig({...config, county: v})} placeholder="Moore" />
            <div className="mt-3 p-3 bg-blue-500/5 rounded-xl border border-blue-500/10">
              <p className="text-xs text-blue-400/80">
                <Shield className="w-3.5 h-3.5 inline mr-1" />
                Los contratos se generan con cumplimiento del Capítulo 92 del Código de Propiedad de Texas.
              </p>
            </div>
          </Card>
        </div>
      )}

      {/* ═══════════ Tab: Stripe ═══════════ */}
      {activeTab === 'stripe' && (
        <div className="space-y-4">
          <Card title="Claves de Stripe" icon={Key} color="purple">
            <div className="grid lg:grid-cols-2 gap-4">
              <Field
                label="Publishable Key (Pública)"
                value={config.stripe_publishable_key || ''}
                onChange={v => setConfig({...config, stripe_publishable_key: v})}
                placeholder="pk_live_..."
                icon={Key}
              />
              <div>
                <label className="flex items-center gap-1.5 text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wider">
                  <Key className="w-3 h-3" /> Secret Key (Secreta)
                </label>
                <div className="relative">
                  <input
                    type={showStripeSecret ? 'text' : 'password'}
                    value={config.stripe_secret_key || ''}
                    onChange={e => setConfig({...config, stripe_secret_key: e.target.value})}
                    className="w-full px-3 py-2.5 bg-[#0a1020]/60 border border-white/[0.08] rounded-xl text-white text-sm focus:border-purple-500 focus:outline-none pr-10"
                    placeholder="sk_live_..."
                  />
                  <button
                    onClick={() => setShowStripeSecret(!showStripeSecret)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                  >
                    {showStripeSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
            <div className="mt-3">
              <label className="flex items-center gap-1.5 text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wider">
                <Shield className="w-3 h-3" /> Webhook Secret
              </label>
              <div className="relative">
                <input
                  type={showWebhookSecret ? 'text' : 'password'}
                  value={config.stripe_webhook_secret || ''}
                  onChange={e => setConfig({...config, stripe_webhook_secret: e.target.value})}
                  className="w-full px-3 py-2.5 bg-[#0a1020]/60 border border-white/[0.08] rounded-xl text-white text-sm focus:border-purple-500 focus:outline-none pr-10"
                  placeholder="whsec_..."
                />
                <button
                  onClick={() => setShowWebhookSecret(!showWebhookSecret)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                >
                  {showWebhookSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="flex items-center gap-3 mt-4">
              <button
                onClick={testStripeConnection}
                disabled={testingStripe}
                className="flex items-center gap-2 px-4 py-2 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-lg text-sm font-semibold hover:bg-purple-500/20 transition disabled:opacity-30"
              >
                {testingStripe ? <div className="w-4 h-4 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" /> : <CreditCard className="w-4 h-4" />}
                Probar Conexión
              </button>
              {stripeStatus === 'success' && <span className="flex items-center gap-1 text-xs text-emerald-400"><CheckCircle2 className="w-4 h-4" /> Conectado</span>}
              {stripeStatus === 'error' && <span className="flex items-center gap-1 text-xs text-red-400"><AlertTriangle className="w-4 h-4" /> Error de conexión</span>}
            </div>
          </Card>

          <div className="grid lg:grid-cols-2 gap-4">
            <Card title="Stripe Connect (Propietarios)" icon={Percent} color="purple">
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm text-gray-300">Activar Connect</label>
                <button
                  onClick={() => setConfig({...config, connect_enabled: !config.connect_enabled})}
                  className={`w-11 h-6 rounded-full transition-all ${config.connect_enabled ? 'bg-purple-500' : 'bg-gray-600'}`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full shadow transform transition-transform ${config.connect_enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>
              <Field
                label="Comisión de Ross House (%)"
                value={String(config.commission_rate || 10)}
                onChange={v => setConfig({...config, commission_rate: parseFloat(v) || 10})}
                type="number"
                icon={Percent}
              />
              <div className="mt-2 p-3 bg-purple-500/5 rounded-xl border border-purple-500/10">
                <p className="text-xs text-purple-400/80">
                  Stripe Connect permite depositar automáticamente la renta al propietario, menos tu comisión.
                </p>
              </div>
            </Card>

            <Card title="Estado de Stripe" icon={Shield} color="purple">
              <div className="space-y-3">
                <StatusRow label="Pagos activos" active={config.stripe_enabled} />
                <StatusRow label="Connect activo" active={config.connect_enabled} />
                <StatusRow label="Clave pública" active={!!config.stripe_publishable_key} />
                <StatusRow label="Clave secreta" active={!!config.stripe_secret_key} />
                <StatusRow label="Webhook configurado" active={!!config.stripe_webhook_secret} />
              </div>
              <div className="mt-3 flex items-center justify-between">
                <label className="text-sm text-gray-300">Activar Pagos</label>
                <button
                  onClick={() => setConfig({...config, stripe_enabled: !config.stripe_enabled})}
                  className={`w-11 h-6 rounded-full transition-all ${config.stripe_enabled ? 'bg-emerald-500' : 'bg-gray-600'}`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full shadow transform transition-transform ${config.stripe_enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ═══════════ Tab: Pagos ═══════════ */}
      {activeTab === 'pagos' && (
        <div className="grid lg:grid-cols-2 gap-4">
          <Card title="Configuración de Pagos" icon={DollarSign} color="amber">
            <Field label="Cargo por Retraso ($)" value={String(config.late_fee_default || config.default_late_fee || '')} onChange={v => setConfig({...config, late_fee_default: parseFloat(v), default_late_fee: parseFloat(v)})} type="number" icon={DollarSign} />
            <Field label="Período de Gracia (días)" value={String(config.grace_days_default || config.grace_period_days || '')} onChange={v => setConfig({...config, grace_days_default: parseInt(v), grace_period_days: parseInt(v)})} type="number" icon={Hash} />
            <Field label="Depósito Predeterminado ($)" value={String(config.default_deposit || '')} onChange={v => setConfig({...config, default_deposit: parseFloat(v)})} type="number" icon={DollarSign} />
          </Card>

          <Card title="Métodos de Pago" icon={CreditCard} color="amber">
            <div className="space-y-2">
              {['card', 'bank_transfer', 'cash', 'check'].map(method => {
                const labels: Record<string, string> = { card: 'Tarjeta de Crédito/Débito', bank_transfer: 'Transferencia Bancaria', cash: 'Efectivo', check: 'Cheque' };
                const methods = config.payment_methods || ['card'];
                const active = methods.includes(method);
                return (
                  <div key={method} className="flex items-center justify-between p-3 bg-white/[0.02] rounded-xl border border-white/[0.06]">
                    <span className="text-sm text-gray-300">{labels[method]}</span>
                    <button
                      onClick={() => {
                        const m = active ? methods.filter((x: string) => x !== method) : [...methods, method];
                        setConfig({...config, payment_methods: m});
                      }}
                      className={`w-11 h-6 rounded-full transition-all ${active ? 'bg-amber-500' : 'bg-gray-600'}`}
                    >
                      <div className={`w-5 h-5 bg-white rounded-full shadow transform transition-transform ${active ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </button>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      )}

      {/* ═══════════ Tab: Contratos ═══════════ */}
      {activeTab === 'contratos' && (
        <div className="space-y-4">
          <Card title="Plantillas de Contrato" icon={FileText} color="emerald">
            <div className="mb-3 p-3 bg-emerald-500/5 rounded-xl border border-emerald-500/10">
              <p className="text-xs text-emerald-400/80">
                <Shield className="w-3.5 h-3.5 inline mr-1" />
                Los contratos se generan automáticamente en formato bilingüe (ES/EN) con cumplimiento del Capítulo 92 del Código de Propiedad de Texas. Incluyen todas las cláusulas legales requeridas.
              </p>
            </div>
            <div className="space-y-2">
              {[
                { key: 'standard_lease', label: 'Contrato de Arrendamiento Estándar', desc: 'Contrato principal bilingüe con todas las cláusulas de Texas' },
                { key: '3day_notice', label: 'Aviso de 3 Días (Eviction Notice)', desc: 'Notificación legal de desalojo por falta de pago' },
                { key: 'move_in_checklist', label: 'Checklist de Entrada/Salida', desc: 'Inspección de condición de la propiedad' },
              ].map(t => (
                <div key={t.key} className="flex items-center justify-between p-4 bg-white/[0.02] rounded-xl border border-white/[0.06] hover:border-emerald-500/20 transition">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center">
                      <FileText className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{t.label}</p>
                      <p className="text-xs text-gray-500">{t.desc}</p>
                    </div>
                  </div>
                  <span className="text-[10px] px-2.5 py-1 rounded-full font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Disponible</span>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Cláusulas y Addendums" icon={Shield} color="emerald">
            <p className="text-xs text-gray-500 mb-3">Activa o desactiva cláusulas específicas que se incluirán automáticamente en los contratos nuevos.</p>
            <div className="grid sm:grid-cols-2 gap-2">
              {[
                { key: 'acceleration', label: 'Cláusula de Aceleración' },
                { key: 'mold_addendum', label: 'Addendum de Moho' },
                { key: 'bedbug_addendum', label: 'Addendum de Chinches' },
                { key: 'military_scra', label: 'SCRA (Militar)' },
                { key: 'lead_paint', label: 'Pintura con Plomo' },
                { key: 'pet_addendum', label: 'Addendum de Mascotas' },
              ].map(clause => {
                const clauses = config.lease_clauses || {};
                const active = clauses[clause.key] || false;
                return (
                  <div key={clause.key} className="flex items-center justify-between p-3 bg-white/[0.02] rounded-xl border border-white/[0.06]">
                    <span className="text-sm text-gray-300">{clause.label}</span>
                    <button
                      onClick={() => setConfig({...config, lease_clauses: {...clauses, [clause.key]: !active}})}
                      className={`w-11 h-6 rounded-full transition-all ${active ? 'bg-emerald-500' : 'bg-gray-600'}`}
                    >
                      <div className={`w-5 h-5 bg-white rounded-full shadow transform transition-transform ${active ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </button>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Pet defaults */}
          {config.lease_clauses?.pet_addendum && (
            <Card title="Configuración de Mascotas" icon={Hash} color="emerald">
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <Field label="Máx. Mascotas" value={String(config.pet_defaults?.max_pets || 2)} onChange={v => setConfig({...config, pet_defaults: {...(config.pet_defaults || {}), max_pets: parseInt(v)}})} type="number" />
                <Field label="Peso Máx. (lbs)" value={String(config.pet_defaults?.max_weight || 50)} onChange={v => setConfig({...config, pet_defaults: {...(config.pet_defaults || {}), max_weight: parseInt(v)}})} type="number" />
                <Field label="Depósito ($)" value={String(config.pet_defaults?.deposit || 250)} onChange={v => setConfig({...config, pet_defaults: {...(config.pet_defaults || {}), deposit: parseFloat(v)}})} type="number" />
                <Field label="Renta Mensual ($)" value={String(config.pet_defaults?.monthly_rent || 25)} onChange={v => setConfig({...config, pet_defaults: {...(config.pet_defaults || {}), monthly_rent: parseFloat(v)}})} type="number" />
              </div>
            </Card>
          )}

          <Card title="Avisos Legales" icon={AlertTriangle} color="emerald">
            <div className="grid sm:grid-cols-3 gap-3">
              <Field label="Aviso de Entrada (horas)" value={String(config.notices?.entry_notice_hours || 24)} onChange={v => setConfig({...config, notices: {...(config.notices || {}), entry_notice_hours: parseInt(v)}})} type="number" />
              <Field label="Aviso de Terminación (días)" value={String(config.notices?.termination_notice_days || 30)} onChange={v => setConfig({...config, notices: {...(config.notices || {}), termination_notice_days: parseInt(v)}})} type="number" />
              <Field label="Aviso de Desalojo (días)" value={String(config.notices?.eviction_notice_days || 3)} onChange={v => setConfig({...config, notices: {...(config.notices || {}), eviction_notice_days: parseInt(v)}})} type="number" />
            </div>
          </Card>
        </div>
      )}

      {/* ═══════════ Tab: Notificaciones ═══════════ */}
      {activeTab === 'notificaciones' && (
        <div className="grid lg:grid-cols-2 gap-4">
          <Card title="Email (SendGrid)" icon={Mail} color="rose">
            <Field label="SendGrid API Key" value={config.sendgrid_api_key || ''} onChange={v => setConfig({...config, sendgrid_api_key: v})} placeholder="SG.xxxxx..." type="password" icon={Key} />
            <Field label="Email Remitente" value={config.sendgrid_from_email || ''} onChange={v => setConfig({...config, sendgrid_from_email: v})} placeholder="info@rosshouserentals.com" icon={Mail} />
            <Field label="Nombre Remitente" value={config.sendgrid_from_name || ''} onChange={v => setConfig({...config, sendgrid_from_name: v})} placeholder="Ross House Rentals" icon={Building2} />
          </Card>

          <Card title="Notificaciones Push" icon={Bell} color="rose">
            <div className="space-y-2">
              {[
                { key: 'notify_maintenance', label: 'Alertas de Mantenimiento', desc: 'Notificar a admins y propietarios' },
                { key: 'notify_payments', label: 'Pagos Recibidos', desc: 'Notificar cuando se procesa un pago' },
                { key: 'notify_leases', label: 'Contratos Firmados', desc: 'Notificar cuando se firma un contrato' },
              ].map(n => {
                const notifications = config.notifications || {};
                const active = notifications[n.key] !== false;
                return (
                  <div key={n.key} className="flex items-center justify-between p-3 bg-white/[0.02] rounded-xl border border-white/[0.06]">
                    <div>
                      <p className="text-sm text-gray-300">{n.label}</p>
                      <p className="text-[11px] text-gray-500">{n.desc}</p>
                    </div>
                    <button
                      onClick={() => setConfig({...config, notifications: {...notifications, [n.key]: !active}})}
                      className={`w-11 h-6 rounded-full transition-all ${active ? 'bg-rose-500' : 'bg-gray-600'}`}
                    >
                      <div className={`w-5 h-5 bg-white rounded-full shadow transform transition-transform ${active ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </button>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      )}

      {/* ═══════════ Tab: Legal ═══════════ */}
      {activeTab === 'legal' && (
        <div className="space-y-4">
          {/* Legal header with save button */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                <Scale className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">Documentos Legales de la App</p>
                <p className="text-xs text-gray-500">Estos documentos se muestran en la app móvil para los usuarios</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {legalSaved && (
                <span className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Guardado
                </span>
              )}
              <button
                onClick={handleSaveLegal}
                disabled={legalSaving}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-cyan-600 to-cyan-500 text-white rounded-xl text-sm font-bold hover:opacity-90 disabled:opacity-30 shadow-[0_0_15px_rgba(6,182,212,0.3)] transition"
              >
                {legalSaving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Save className="w-4 h-4" /> Guardar Documentos</>}
              </button>
            </div>
          </div>

          {legalLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="w-8 h-8 border-3 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* Document selector + Language toggle */}
              <div className="flex items-center gap-3">
                <div className="flex gap-1 bg-white/[0.02] rounded-xl p-1 border border-white/[0.06] flex-1">
                  <button
                    onClick={() => setLegalDoc('terms')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all flex-1 justify-center ${
                      legalDoc === 'terms'
                        ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/25'
                        : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.03]'
                    }`}
                  >
                    <FileText className="w-4 h-4" /> Términos y Condiciones
                  </button>
                  <button
                    onClick={() => setLegalDoc('privacy')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all flex-1 justify-center ${
                      legalDoc === 'privacy'
                        ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/25'
                        : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.03]'
                    }`}
                  >
                    <Shield className="w-4 h-4" /> Política de Privacidad
                  </button>
                </div>

                <div className="flex gap-1 bg-white/[0.02] rounded-xl p-1 border border-white/[0.06]">
                  <button
                    onClick={() => setLegalLang('es')}
                    className={`flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      legalLang === 'es'
                        ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/25'
                        : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.03]'
                    }`}
                  >
                    🇪🇸 ES
                  </button>
                  <button
                    onClick={() => setLegalLang('en')}
                    className={`flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      legalLang === 'en'
                        ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/25'
                        : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.03]'
                    }`}
                  >
                    🇺🇸 EN
                  </button>
                </div>
              </div>

              {/* Editor */}
              <div className="bg-white/[0.03] rounded-2xl border border-white/[0.06] p-5">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    {legalDoc === 'terms' ? <FileText className="w-4 h-4 text-cyan-400" /> : <Shield className="w-4 h-4 text-cyan-400" />}
                    {legalDoc === 'terms' ? 'Términos y Condiciones' : 'Política de Privacidad'} — {legalLang === 'es' ? 'Español' : 'English'}
                  </h4>
                  <span className="text-[10px] px-2.5 py-1 rounded-full font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                    Markdown
                  </span>
                </div>

                <div className="mb-2 p-2.5 bg-cyan-500/5 rounded-xl border border-cyan-500/10">
                  <p className="text-[11px] text-cyan-400/80">
                    <Languages className="w-3 h-3 inline mr-1" />
                    Usa formato Markdown: <code className="bg-white/10 px-1 rounded text-[10px]"># Título</code> <code className="bg-white/10 px-1 rounded text-[10px]">## Subtítulo</code> <code className="bg-white/10 px-1 rounded text-[10px]">**negrita**</code> <code className="bg-white/10 px-1 rounded text-[10px]">- lista</code>
                  </p>
                </div>

                <textarea
                  value={legalDocs[`${legalDoc}_${legalLang}`] || ''}
                  onChange={e => setLegalDocs({...legalDocs, [`${legalDoc}_${legalLang}`]: e.target.value})}
                  className="w-full h-[500px] px-4 py-3 bg-[#0a1020]/60 border border-white/[0.08] rounded-xl text-white text-sm font-mono leading-relaxed focus:border-cyan-500 focus:outline-none resize-none"
                  placeholder={`Escribe aquí los ${legalDoc === 'terms' ? 'términos y condiciones' : 'política de privacidad'} en ${legalLang === 'es' ? 'español' : 'inglés'}...`}
                />

                {legalDocs.updated_at && (
                  <p className="text-[11px] text-gray-500 mt-2 text-right">
                    Última actualización: {new Date(legalDocs.updated_at).toLocaleString('es-US')}
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ═══════════ Reusable Components ═══════════ */

function Card({ title, icon: Icon, color, children }: { title: string; icon: any; color: string; children: React.ReactNode }) {
  return (
    <div className="bg-white/[0.03] rounded-2xl border border-white/[0.06] p-5">
      <h3 className={`text-sm font-bold text-white flex items-center gap-2 mb-4`}>
        <Icon className={`w-4 h-4 text-${color}-400`} /> {title}
      </h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = 'text', icon: Icon, required }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; icon?: any; required?: boolean;
}) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wider">
        {Icon && <Icon className="w-3 h-3" />} {label}{required && <span className="text-emerald-500"> *</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2.5 bg-[#0a1020]/60 border border-white/[0.08] rounded-xl text-white text-sm focus:border-blue-500 focus:outline-none"
        placeholder={placeholder}
      />
    </div>
  );
}

function StatusRow({ label, active }: { label: string; active: boolean }) {
  return (
    <div className="flex items-center justify-between p-2 rounded-lg">
      <span className="text-sm text-gray-400">{label}</span>
      {active ? (
        <span className="flex items-center gap-1 text-xs text-emerald-400"><CheckCircle2 className="w-3.5 h-3.5" /> Activo</span>
      ) : (
        <span className="flex items-center gap-1 text-xs text-gray-500"><AlertTriangle className="w-3.5 h-3.5" /> No configurado</span>
      )}
    </div>
  );
}
