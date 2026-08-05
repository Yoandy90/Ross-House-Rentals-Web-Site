'use client';
import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Zap, CheckCircle2, XCircle, Loader2, ArrowRight } from 'lucide-react';

/**
 * Página registrada como Redirect URL en el portal Green Button de Xcel Energy:
 * https://www.rosshouserentals.com/tenant/utilities?callback=greenbutton
 * Xcel agrega &code=...&state=... tras la autorización del cliente.
 */
function UtilitiesCallbackContent() {
  const params = useSearchParams();
  const router = useRouter();
  const code = params.get('code');
  const state = params.get('state');
  const error = params.get('error');

  const [status, setStatus] = useState<'processing' | 'success' | 'error' | 'idle'>(
    code && state ? 'processing' : error ? 'error' : 'idle'
  );
  const [message, setMessage] = useState(
    error ? `Xcel Energy reportó: ${error}. Puedes intentarlo de nuevo desde el panel.` : ''
  );

  useEffect(() => {
    if (!code || !state) return;
    (async () => {
      try {
        const res = await fetch('/api/greenbutton/exchange', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, state }),
        });
        const data = await res.json();
        if (data.success) {
          setStatus('success');
          setMessage(data.message);
        } else {
          setStatus('error');
          setMessage(data.message || 'No se pudo completar la conexión con Xcel Energy.');
        }
      } catch {
        setStatus('error');
        setMessage('Error de red al conectar con el servidor. Intenta de nuevo.');
      }
    })();
  }, [code, state]);

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6" data-testid="tenant-utilities-page">
      <div className="max-w-md w-full text-center">
        <div className="w-16 h-16 rounded-2xl bg-yellow-500/15 flex items-center justify-center mx-auto mb-6">
          <Zap className="w-8 h-8 text-yellow-500" />
        </div>

        {status === 'processing' && (
          <>
            <Loader2 className="w-8 h-8 text-yellow-500 animate-spin mx-auto mb-4" />
            <h1 className="text-xl font-bold text-white mb-2">Conectando con Xcel Energy…</h1>
            <p className="text-sm text-slate-400">Estamos completando la autorización, no cierres esta ventana.</p>
          </>
        )}

        {status === 'success' && (
          <div data-testid="greenbutton-success">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-white mb-2">¡Conexión exitosa!</h1>
            <p className="text-sm text-slate-400 mb-8">{message}</p>
          </div>
        )}

        {status === 'error' && (
          <div data-testid="greenbutton-error">
            <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-white mb-2">No se pudo conectar</h1>
            <p className="text-sm text-slate-400 mb-8">{message}</p>
          </div>
        )}

        {status === 'idle' && (
          <div data-testid="utilities-idle">
            <h1 className="text-xl font-bold text-white mb-2">Servicios de tu hogar</h1>
            <p className="text-sm text-slate-400 mb-8">
              Administra tus gastos de luz, gas, agua e internet desde la app de Ross House Rentals.
              La conexión con Xcel Energy se inicia desde el panel de Energía.
            </p>
          </div>
        )}

        {status !== 'processing' && (
          <button
            data-testid="go-dashboard-btn"
            onClick={() => router.push('/tenant/dashboard')}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-yellow-500 hover:bg-yellow-400 text-slate-950 text-sm font-semibold transition-colors"
          >
            Ir a mi panel <ArrowRight className="w-4 h-4" />
          </button>
        )}

        <p className="text-xs text-slate-600 mt-10">Ross House Rentals LLC · Xcel Energy Green Button</p>
      </div>
    </div>
  );
}

export default function TenantUtilitiesPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-yellow-500 animate-spin" />
        </div>
      }
    >
      <UtilitiesCallbackContent />
    </Suspense>
  );
}
