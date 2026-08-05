'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Mail, Lock, ArrowRight, KeyRound, ArrowLeft, CheckCircle2, Building2 } from 'lucide-react';

type Step = 'email' | 'code' | 'success';

export default function InvestorForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [emailMasked, setEmailMasked] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const requestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email.trim()) { setError('Email requerido'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/investor/forgot-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (res.ok) {
        setEmailMasked(data.email_masked || email);
        setStep('code');
      } else {
        setError(data.detail || 'Error');
      }
    } catch (err: any) {
      setError(err.message || 'Error de red');
    }
    setLoading(false);
  };

  const resetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (code.length !== 6) { setError('El código debe tener 6 dígitos'); return; }
    if (newPassword.length < 6) { setError('Contraseña debe tener al menos 6 caracteres'); return; }
    if (newPassword !== confirmPassword) { setError('Las contraseñas no coinciden'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/investor/reset-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), code, new_password: newPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        setStep('success');
        setTimeout(() => router.push('/inversor'), 2500);
      } else {
        setError(data.detail || 'Código incorrecto');
      }
    } catch (err: any) {
      setError(err.message || 'Error de red');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#070912] flex items-center justify-center px-4 py-12 relative overflow-hidden">
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/[0.06] rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-teal-500/[0.05] rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full relative">
        <Link href="/inversor" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white mb-6 transition">
          <ArrowLeft className="w-4 h-4" /> Volver al login
        </Link>

        <div className="flex items-center gap-2 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="text-sm font-bold text-white">Ross House Rentals</div>
            <div className="text-[10px] text-emerald-400 font-bold tracking-wider">PORTAL INVERSIONISTA</div>
          </div>
        </div>

        <div className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.06] rounded-3xl p-8 shadow-2xl">
          {step === 'email' && (
            <>
              <div className="flex items-center gap-2 mb-2"><KeyRound className="w-5 h-5 text-emerald-400" /><h1 className="text-2xl font-bold text-white">Recuperar contraseña</h1></div>
              <p className="text-sm text-gray-500 mb-6">Ingresa tu email y te enviaremos un código de 6 dígitos.</p>
              {error && <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 mb-4 text-sm text-red-300">{error}</div>}
              <form onSubmit={requestCode} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-400 mb-1.5">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input type="email" required value={email} onChange={e => setEmail(e.target.value)} autoComplete="email"
                      className="w-full pl-10 pr-4 py-3 bg-white/[0.03] border border-white/[0.08] rounded-xl text-white text-sm focus:border-emerald-500 focus:outline-none"
                      placeholder="tu@email.com" />
                  </div>
                </div>
                <button type="submit" disabled={loading} className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl text-sm font-bold hover:opacity-90 disabled:opacity-50 transition flex items-center justify-center gap-2">
                  {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <>Enviar código <ArrowRight className="w-4 h-4" /></>}
                </button>
              </form>
            </>
          )}

          {step === 'code' && (
            <>
              <div className="flex items-center gap-2 mb-2"><KeyRound className="w-5 h-5 text-emerald-400" /><h1 className="text-2xl font-bold text-white">Verifica tu email</h1></div>
              <p className="text-sm text-gray-500 mb-2">Enviamos un código de 6 dígitos a <span className="text-white font-bold">{emailMasked}</span></p>
              <p className="text-[11px] text-gray-600 mb-6">Si no lo ves en tu bandeja, revisa la carpeta de spam. El código expira en 15 minutos.</p>
              {error && <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 mb-4 text-sm text-red-300">{error}</div>}
              <form onSubmit={resetPassword} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-400 mb-1.5">Código</label>
                  <input type="text" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                    className="w-full px-4 py-3 bg-white/[0.03] border border-white/[0.08] rounded-xl text-white text-2xl font-mono text-center tracking-[0.5em] focus:border-emerald-500 focus:outline-none"
                    placeholder="000000" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 mb-1.5">Nueva contraseña</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input type="password" required value={newPassword} onChange={e => setNewPassword(e.target.value)} minLength={6}
                      className="w-full pl-10 pr-4 py-3 bg-white/[0.03] border border-white/[0.08] rounded-xl text-white text-sm focus:border-emerald-500 focus:outline-none"
                      placeholder="Mínimo 6 caracteres" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 mb-1.5">Confirmar contraseña</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input type="password" required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} minLength={6}
                      className="w-full pl-10 pr-4 py-3 bg-white/[0.03] border border-white/[0.08] rounded-xl text-white text-sm focus:border-emerald-500 focus:outline-none"
                      placeholder="Repite la contraseña" />
                  </div>
                </div>
                <button type="submit" disabled={loading} className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl text-sm font-bold hover:opacity-90 disabled:opacity-50 transition flex items-center justify-center gap-2">
                  {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <>Cambiar contraseña <ArrowRight className="w-4 h-4" /></>}
                </button>
                <button type="button" onClick={() => { setStep('email'); setCode(''); setError(''); }} className="w-full text-xs text-gray-500 hover:text-white transition">
                  ← Cambiar de email
                </button>
              </form>
            </>
          )}

          {step === 'success' && (
            <div className="text-center py-8">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-emerald-400" />
              </div>
              <h1 className="text-2xl font-bold text-white mb-2">¡Contraseña actualizada!</h1>
              <p className="text-sm text-gray-400">Redirigiendo al login...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
