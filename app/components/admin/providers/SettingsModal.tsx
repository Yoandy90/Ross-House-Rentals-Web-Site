'use client';

import React, { useEffect, useState } from 'react';
import { Loader2, Settings as SettingsIcon, X } from 'lucide-react';
import { useAdminAuth } from '../../../admin/layout';
import { Toggle } from './ui';

export default function SettingsModal({ onClose }: { onClose: () => void }) {
  const { token, headers } = useAdminAuth();
  const [settings, setSettings] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetch('/api/admin/provider-settings', { headers: headers() })
      .then(r => r.json()).then(d => setSettings(d.settings));
  }, [token, headers]);

  const save = async () => {
    setSaving(true);
    try {
      await fetch('/api/admin/provider-settings', {
        method: 'PUT', headers: headers(),
        body: JSON.stringify(settings),
      });
      alert('Guardado'); onClose();
    } catch (e: any) { alert('Error: ' + e.message); }
    setSaving(false);
  };

  if (!settings) return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80"><Loader2 className="w-8 h-8 animate-spin" /></div>
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-[#0a1020] border border-white/10 rounded-2xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold flex items-center gap-2"><SettingsIcon className="w-5 h-5 text-amber-400" /> Configuración de Proveedores</h3>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-4">
          <Toggle label="📧 Notificaciones por Email" sub="Bienvenidas y dispatch de trabajos" value={settings.email_enabled} onChange={v => setSettings({ ...settings, email_enabled: v })} />
          <Toggle label="📱 Notificaciones por SMS" sub="Envío por Twilio" value={settings.sms_enabled} onChange={v => setSettings({ ...settings, sms_enabled: v })} />
          <div className="border-t border-white/10 pt-4">
            <label className="block">
              <span className="text-xs text-gray-400 mb-1.5 block">Email de admin (para alertas de nuevos proveedores)</span>
              <input value={settings.notify_admin_email || ''} onChange={e => setSettings({ ...settings, notify_admin_email: e.target.value })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm" />
            </label>
          </div>
          <details className="border border-white/10 rounded-xl p-3">
            <summary className="cursor-pointer text-sm font-semibold text-gray-300">📝 Plantillas (avanzado)</summary>
            <div className="mt-4 space-y-3">
              <p className="text-xs text-gray-500">Placeholders: <code className="bg-white/10 px-1 rounded">{'{name}'}</code> <code className="bg-white/10 px-1 rounded">{'{services}'}</code> <code className="bg-white/10 px-1 rounded">{'{company}'}</code></p>
              {(['welcome_email_subject_es', 'welcome_email_body_es', 'welcome_sms_es', 'welcome_email_subject_en', 'welcome_email_body_en', 'welcome_sms_en'] as const).map(k => (
                <label key={k} className="block">
                  <span className="text-xs text-gray-400 mb-1.5 block">{k}</span>
                  {k.includes('body') ? (
                    <textarea value={settings[k] || ''} onChange={e => setSettings({ ...settings, [k]: e.target.value })} rows={5} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm font-mono" />
                  ) : (
                    <input value={settings[k] || ''} onChange={e => setSettings({ ...settings, [k]: e.target.value })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm" />
                  )}
                </label>
              ))}
            </div>
          </details>
        </div>
        <div className="flex gap-2 mt-6">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm">Cancelar</button>
          <button disabled={saving} onClick={save} className="flex-1 px-4 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 font-semibold text-sm disabled:opacity-50">
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}
