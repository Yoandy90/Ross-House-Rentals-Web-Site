'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { loadStripe, Stripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { ShieldCheck, Lock, CheckCircle2, AlertCircle, CreditCard } from 'lucide-react';

type LinkInfo = { customer_name?: string; customer_email?: string };

function CardForm({ token, onDone }: { token: string; onDone: (customerId: string, pmId: string) => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError('');
    const { error: submitErr } = await elements.submit();
    if (submitErr) {
      setError(submitErr.message || 'Revisa los datos de la tarjeta');
      setSubmitting(false);
      return;
    }
    const { error: confirmErr, setupIntent } = await stripe.confirmSetup({
      elements,
      redirect: 'if_required',
    });
    if (confirmErr) {
      setError(confirmErr.message || 'No se pudo guardar la tarjeta');
      setSubmitting(false);
      return;
    }
    if (setupIntent && setupIntent.status === 'succeeded') {
      onDone(String(setupIntent.customer || ''), String(setupIntent.payment_method || ''));
    } else {
      setError('La confirmación no se completó. Intenta de nuevo.');
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <PaymentElement options={{ layout: 'tabs' }} />
      {error && (
        <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {error}
        </div>
      )}
      <button
        type="submit"
        disabled={!stripe || submitting}
        className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-semibold py-3.5 rounded-xl transition-colors"
      >
        {submitting ? (
          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        ) : (
          <><Lock className="w-4 h-4" /> Guardar tarjeta de forma segura</>
        )}
      </button>
    </form>
  );
}

export default function SaveCardPage() {
  const params = useParams();
  const token = String(params?.token || '');
  const [loading, setLoading] = useState(true);
  const [invalidMsg, setInvalidMsg] = useState('');
  const [info, setInfo] = useState<LinkInfo>({});
  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null);
  const [clientSecret, setClientSecret] = useState('');
  const [done, setDone] = useState(false);
  const [finishing, setFinishing] = useState(false);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const vres = await fetch(`/api/vault/card-save-link/${token}`);
        if (!vres.ok) {
          const d = await vres.json().catch(() => ({}));
          setInvalidMsg(d.detail || 'Este link no es válido.');
          setLoading(false);
          return;
        }
        setInfo(await vres.json());
        const sres = await fetch(`/api/vault/card-save-link/${token}/setup-intent`, { method: 'POST' });
        const sdata = await sres.json();
        if (!sres.ok) {
          setInvalidMsg(sdata.detail || 'No se pudo iniciar el registro.');
          setLoading(false);
          return;
        }
        setClientSecret(sdata.client_secret);
        setStripePromise(loadStripe(sdata.publishable_key));
      } catch {
        setInvalidMsg('Ocurrió un error. Intenta de nuevo.');
      }
      setLoading(false);
    })();
  }, [token]);

  const handleDone = async (customerId: string, pmId: string) => {
    setFinishing(true);
    try {
      await fetch(`/api/vault/card-save-link/${token}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment_method_id: pmId, customer_id: customerId }),
      });
      setDone(true);
    } catch {
      setDone(true);
    }
    setFinishing(false);
  };

  return (
    <div style={{ minHeight: '100vh' }} className="bg-gradient-to-b from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex w-14 h-14 rounded-2xl bg-blue-600 items-center justify-center mb-3">
            <CreditCard className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Ross House Rentals</h1>
          <p className="text-sm text-slate-500">Registro seguro de tarjeta</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6">
          {loading ? (
            <div className="flex justify-center py-10">
              <div className="w-8 h-8 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
            </div>
          ) : invalidMsg ? (
            <div className="text-center py-8">
              <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
              <p className="text-slate-700 font-semibold">{invalidMsg}</p>
              <p className="text-sm text-slate-500 mt-1">Solicita un nuevo enlace al administrador.</p>
            </div>
          ) : done ? (
            <div className="text-center py-8">
              <CheckCircle2 className="w-14 h-14 text-emerald-500 mx-auto mb-3" />
              <p className="text-lg font-bold text-slate-800">¡Tarjeta registrada!</p>
              <p className="text-sm text-slate-500 mt-1">Tu método de pago quedó guardado de forma segura. Ya puedes cerrar esta ventana.</p>
            </div>
          ) : finishing ? (
            <div className="flex flex-col items-center py-10 gap-3">
              <div className="w-8 h-8 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
              <p className="text-sm text-slate-500">Finalizando…</p>
            </div>
          ) : (
            <>
              {info.customer_name && (
                <p className="text-sm text-slate-600 mb-4">
                  Hola <strong>{info.customer_name}</strong>, ingresa tu tarjeta para dejarla registrada.
                </p>
              )}
              {stripePromise && clientSecret && (
                <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'stripe' } }}>
                  <CardForm token={token} onDone={handleDone} />
                </Elements>
              )}
            </>
          )}
        </div>

        <div className="flex items-center justify-center gap-2 mt-4 text-xs text-slate-400">
          <ShieldCheck className="w-3.5 h-3.5" />
          Procesado y cifrado por Stripe · Tus datos nunca tocan nuestros servidores
        </div>
      </div>
    </div>
  );
}
