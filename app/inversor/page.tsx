'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Building2, Mail, Lock, ArrowRight, LogIn, Briefcase } from 'lucide-react';

export default function InvestorLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/investor/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        localStorage.setItem('investor_token', data.token);
        localStorage.setItem('investor_user', JSON.stringify(data.user));
        // Full navigation so the layout re-reads the token from localStorage
        window.location.assign('/inversor/dashboard');
        return;
      } else {
        setError(data.detail || 'Credenciales inválidas');
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
        <Link href="/" className="inline-flex items-center gap-2 mb-6 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="text-sm font-bold text-white leading-none">Ross House Rentals</div>
            <div className="text-[10px] text-emerald-400 font-bold tracking-wider mt-0.5">PORTAL DEL INVERSIONISTA</div>
          </div>
        </Link>

        <div className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.06] rounded-3xl p-8 shadow-2xl">
          <div className="flex items-center gap-2 mb-2">
            <Briefcase className="w-5 h-5 text-emerald-400" />
            <h1 className="text-2xl font-bold text-white">Bienvenido</h1>
          </div>
          <p className="text-sm text-gray-500 mb-6">Accede a tu portafolio de inversiones</p>

          {error && <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 mb-4 text-sm text-red-300">{error}</div>}

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-400 mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" className="w-full pl-10 pr-4 py-3 bg-white/[0.03] border border-white/[0.08] rounded-xl text-white text-sm focus:border-emerald-500 focus:outline-none" placeholder="tu@email.com" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 mb-1.5">Contraseña</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input type="password" required value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" className="w-full pl-10 pr-4 py-3 bg-white/[0.03] border border-white/[0.08] rounded-xl text-white text-sm focus:border-emerald-500 focus:outline-none" placeholder="••••••••" />
              </div>
            </div>
            <button type="submit" disabled={loading} className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl text-sm font-bold hover:opacity-90 disabled:opacity-50 transition flex items-center justify-center gap-2">
              {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><LogIn className="w-4 h-4" /> Iniciar sesión <ArrowRight className="w-4 h-4" /></>}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-white/[0.04] text-center">
            <Link href="/inversor/forgot-password" className="text-xs text-emerald-400 hover:text-emerald-300 transition font-bold">
              ¿Olvidaste tu contraseña?
            </Link>
            <p className="text-xs text-gray-500 mt-4">¿No tienes cuenta?</p>
            <p className="text-xs text-gray-400 mt-1">Las cuentas son creadas por el administrador cuando te añaden a un deal.</p>
            <p className="text-xs text-gray-500 mt-3">Contacta a <a href="mailto:yoandyross@gmail.com" className="text-emerald-400 hover:text-emerald-300">yoandyross@gmail.com</a></p>
          </div>
        </div>
      </div>
    </div>
  );
}
