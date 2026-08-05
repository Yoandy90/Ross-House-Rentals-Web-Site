'use client';

/**
 * Admin 2FA Settings panel.
 *
 * Lets the admin:
 *  - Choose the OTP channel (email or SMS)
 *  - Enable/disable the 2FA layer
 *  - Revoke all "trusted device" tokens (forces full re-verification next login)
 */
import React, { useEffect, useState } from 'react';
import { useAdminAuth } from '../../admin/layout';
import {
  Shield, Mail, MessageSquare, CheckCircle2, AlertTriangle,
  Smartphone, Loader2, LogOut,
} from 'lucide-react';

type Settings = {
  enabled: boolean;
  channel: 'email' | 'sms';
  phone_on_file: boolean;
  email: string;
  trusted_devices_count: number;
  available_channels: string[];
};

export default function AdminTwoFactorSettings() {
  const { headers } = useAdminAuth();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/admin/auth/2fa-settings', { headers: headers() });
      if (!res.ok) throw new Error('No se pudo cargar la configuración');
      const data = await res.json();
      setSettings(data);
    } catch (e: any) {
      setError(e.message || 'Error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const patch = async (body: Partial<Pick<Settings, 'channel' | 'enabled'>>) => {
    if (!settings) return;
    try {
      setSaving(true);
      setError(null);
      const res = await fetch('/api/admin/auth/2fa-settings', {
        method: 'PATCH',
        headers: headers(),
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'No se pudo guardar');
      setSettings(data);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e: any) {
      setError(e.message || 'Error');
    } finally {
      setSaving(false);
    }
  };

  const revokeAll = async () => {
    if (!confirm('¿Cerrar todas las sesiones de dispositivos recordados? Tendrás que verificar OTP en cada dispositivo de nuevo.')) return;
    try {
      setSaving(true);
      const res = await fetch('/api/admin/auth/trusted-devices/revoke-all', {
        method: 'POST', headers: headers(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Error');
      alert(`✅ Se revocaron ${data.revoked} dispositivo(s).`);
      // Drop the local trusted-device cookie too
      try { window.localStorage.removeItem('rhr_admin_trusted_device_id'); } catch { /* noop */ }
      await load();
    } catch (e: any) {
      setError(e.message || 'Error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6 flex items-center gap-3 text-gray-400">
        <Loader2 className="w-5 h-5 animate-spin text-blue-400" /> Cargando configuración de seguridad…
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-5 text-rose-300">
        {error || 'No se pudo cargar la configuración'}
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-3xl">
      {/* Header */}
      <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5 lg:p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/10 flex items-center justify-center flex-shrink-0">
            <Shield className="w-6 h-6 text-blue-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-white">Verificación en 2 pasos (2FA)</h2>
            <p className="text-xs text-gray-400 mt-1">
              Cada vez que inicies sesión, te pediremos un código de 6 dígitos
              además de tu contraseña. Esto te protege incluso si tu contraseña se filtra.
            </p>
          </div>
          {saved && (
            <div className="flex items-center gap-1.5 text-emerald-400 text-xs">
              <CheckCircle2 className="w-4 h-4" /> Guardado
            </div>
          )}
        </div>

        {error && (
          <div className="mt-4 bg-rose-500/10 border border-rose-500/20 rounded-lg p-3 text-rose-300 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> {error}
          </div>
        )}

        {/* Enabled toggle */}
        <div className="mt-5 flex items-center justify-between p-4 bg-[#0a1020]/40 rounded-xl border border-white/[0.04]">
          <div>
            <div className="text-sm font-bold text-white">
              {settings.enabled ? '✅ Protección activa' : '⚠️ Protección desactivada'}
            </div>
            <div className="text-[11px] text-gray-500 mt-0.5">
              {settings.enabled
                ? 'Tu cuenta está protegida con verificación en 2 pasos.'
                : 'Tu cuenta solo está protegida por contraseña. Recomendamos activar 2FA.'}
            </div>
          </div>
          <button
            onClick={() => patch({ enabled: !settings.enabled })}
            disabled={saving}
            className={`relative w-12 h-6 rounded-full transition-colors flex items-center px-0.5 ${
              settings.enabled ? 'bg-emerald-500 justify-end' : 'bg-gray-700 justify-start'
            }`}
          >
            <div className="w-5 h-5 bg-white rounded-full shadow" />
          </button>
        </div>

        {/* Channel picker */}
        {settings.enabled && (
          <div className="mt-4">
            <div className="text-[11px] text-gray-500 uppercase tracking-wider font-bold mb-2">
              Canal preferido
            </div>
            <div className="grid grid-cols-2 gap-3">
              <ChannelCard
                active={settings.channel === 'email'}
                disabled={saving}
                onClick={() => patch({ channel: 'email' })}
                title="Por Email"
                description={`Enviado a ${settings.email}`}
                icon={<Mail className="w-5 h-5" />}
                badge="Recomendado"
              />
              <ChannelCard
                active={settings.channel === 'sms'}
                disabled={saving || !settings.phone_on_file}
                onClick={() => patch({ channel: 'sms' })}
                title="Por SMS"
                description={settings.phone_on_file
                  ? 'Enviado a tu número registrado'
                  : 'Añade un teléfono en tu perfil primero'}
                icon={<MessageSquare className="w-5 h-5" />}
              />
            </div>
          </div>
        )}
      </div>

      {/* Trusted devices */}
      <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5 lg:p-6">
        <div className="flex items-start gap-4 mb-4">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center flex-shrink-0">
            <Smartphone className="w-5 h-5 text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-white">Dispositivos recordados</h3>
            <p className="text-xs text-gray-400 mt-1">
              Estos dispositivos pueden iniciar sesión sin pedir OTP por 30 días.
            </p>
          </div>
          <div className="text-2xl font-black text-amber-400">{settings.trusted_devices_count}</div>
        </div>
        <button
          onClick={revokeAll}
          disabled={saving || settings.trusted_devices_count === 0}
          className="flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 hover:bg-rose-500/20 disabled:opacity-50 transition"
        >
          <LogOut className="w-3.5 h-3.5" />
          Revocar todos los dispositivos
        </button>
      </div>
    </div>
  );
}

function ChannelCard({
  active, disabled, onClick, title, description, icon, badge,
}: {
  active: boolean; disabled?: boolean; onClick: () => void;
  title: string; description: string; icon: React.ReactNode; badge?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`text-left p-3 rounded-xl border transition-all ${
        active
          ? 'bg-blue-500/10 border-blue-500/40 ring-1 ring-blue-500/30'
          : 'bg-[#0a1020]/40 border-white/[0.06] hover:border-white/[0.15]'
      } ${disabled && !active ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <div className="flex items-center gap-2 mb-1">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
          active ? 'bg-blue-500/20 text-blue-400' : 'bg-white/[0.05] text-gray-400'
        }`}>
          {icon}
        </div>
        <div className="font-bold text-xs text-white">{title}</div>
        {badge && (
          <span className="ml-auto text-[9px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded">
            {badge}
          </span>
        )}
        {active && <CheckCircle2 className="w-4 h-4 text-blue-400 ml-auto" />}
      </div>
      <div className="text-[10px] text-gray-500 leading-relaxed">{description}</div>
    </button>
  );
}
