'use client';

import { useState, useEffect, useCallback } from 'react';
import AdminTwoFactorSettings from '../../components/admin/AdminTwoFactorSettings';
import { useAdminAuth } from '../layout';
import { ShieldCheck, CreditCard } from 'lucide-react';

function Stripe3DSToggle() {
  const { headers } = useAdminAuth();
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchState = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/security/stripe-3ds', { headers: headers() });
      if (res.ok) { const d = await res.json(); setEnabled(!!d.enabled); }
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [headers]);

  useEffect(() => { fetchState(); }, [fetchState]);

  const toggle = async () => {
    const next = !enabled;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/security/stripe-3ds', {
        method: 'PUT', headers: headers(), body: JSON.stringify({ enabled: next }),
      });
      if (res.ok) setEnabled(next);
      else { const d = await res.json().catch(() => null); alert(d?.detail || 'Error guardando'); }
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  return (
    <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center border shrink-0 ${enabled ? 'bg-emerald-500/15 border-emerald-500/30' : 'bg-white/[0.03] border-white/[0.08]'}`}>
            <CreditCard className={`w-5 h-5 ${enabled ? 'text-emerald-400' : 'text-gray-500'}`} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              3D Secure (Stripe)
              {enabled
                ? <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">ACTIVO</span>
                : <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-500/10 text-gray-400 border border-gray-500/20 font-bold">DESACTIVADO</span>}
            </h3>
            <p className="text-xs text-gray-500 mt-1 max-w-md leading-relaxed">
              Exige verificación 3D Secure (código del banco) en los pagos con tarjeta.
              Reduce fraude y contracargos, pero agrega un paso extra al cliente al pagar.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={toggle}
          disabled={loading || saving}
          className={`relative inline-flex h-7 w-13 items-center rounded-full transition disabled:opacity-40 ${enabled ? 'bg-emerald-500' : 'bg-gray-700'}`}
          style={{ width: 52 }}
          aria-label="Toggle 3D Secure"
        >
          <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${enabled ? 'translate-x-7' : 'translate-x-1'}`} />
        </button>
      </div>
      <div className="flex items-center gap-1.5 mt-3 text-[10px] text-gray-600">
        <ShieldCheck className="w-3 h-3" />
        Aplica a los pagos de renta con tarjeta. Los cobros off-session del Baúl no se afectan.
      </div>
    </div>
  );
}

export default function SeguridadPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Seguridad</h1>
        <p className="text-xs text-gray-500 mt-1">
          Configura la verificación en 2 pasos (2FA), los dispositivos recordados y la seguridad de pagos.
        </p>
      </div>

      <AdminTwoFactorSettings />

      <Stripe3DSToggle />
    </div>
  );
}
