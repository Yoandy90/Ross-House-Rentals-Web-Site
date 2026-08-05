'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, ShieldCheck, Home } from 'lucide-react';

function Contenido() {
  const params = useSearchParams();
  const sessionId = params.get('session_id') || '';

  return (
    <main className="min-h-screen bg-[#0a1020] flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-[#0d1526]/80 border border-white/[0.08] rounded-3xl p-8 text-center">
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center">
          <CheckCircle2 className="w-11 h-11 text-green-400" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">¡Pago exitoso!</h1>
        <p className="text-gray-400 mb-6">
          Tu pago fue procesado correctamente. Recibirás un recibo de Stripe en tu correo electrónico.
        </p>
        <div className="flex items-center justify-center gap-2 mb-8 px-4 py-3 bg-green-500/[0.06] border border-green-500/20 rounded-xl">
          <ShieldCheck className="w-4 h-4 text-green-400 shrink-0" />
          <p className="text-xs text-green-300/90">
            Transacción verificada con 3D Secure — protegida contra fraude
          </p>
        </div>
        {sessionId && (
          <p className="text-[10px] text-gray-600 mb-6 break-all">
            Ref: {sessionId.slice(0, 32)}…
          </p>
        )}
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-6 py-3 bg-white text-[#0a1020] rounded-xl font-bold text-sm hover:bg-gray-200 transition"
        >
          <Home className="w-4 h-4" />
          Volver al inicio
        </Link>
      </div>
    </main>
  );
}

export default function PagoExitoso() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#0a1020]" />}>
      <Contenido />
    </Suspense>
  );
}
