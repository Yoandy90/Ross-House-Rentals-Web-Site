'use client';

/**
 * Admin login flow with 2-step verification (CAPTCHA + OTP via email/SMS).
 *
 * Step 1: Email + password + Cloudflare Turnstile  -> /api/admin/auth/login-step1
 *   - Server replies either:
 *       { step: "complete", token, user, trusted_device_id? }   (skipped 2FA)
 *       { step: "otp_required", challenge_id, channel, masked, expires_in_seconds }
 *
 * Step 2: 6-digit code + "remember this device"  -> /api/admin/auth/login-step2
 *   - Server replies { token, user, trusted_device_id }.
 *
 * Persists trusted-device id in localStorage to skip OTP for 30 days.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Building2, Mail, MessageSquare, ShieldCheck, RefreshCw, ArrowLeft, KeyRound } from 'lucide-react';
import Cookies from 'js-cookie';
import TurnstileWidget from '../TurnstileWidget';

const TRUSTED_KEY = 'rhr_admin_trusted_device_id';

type Step = 'credentials' | 'otp';

interface OtpState {
  challenge_id: string;
  channel: 'email' | 'sms';
  masked: string;
  expires_at: number;   // epoch ms
}

interface AdminLoginScreenProps {
  onSuccess: (token: string, user: any) => void;
}

export default function AdminLoginScreen({ onSuccess }: AdminLoginScreenProps) {
  // shared
  const [step, setStep] = useState<Step>('credentials');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // step 1
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaKey, setCaptchaKey] = useState(0); // bump to remount Turnstile

  // step 2
  const [otp, setOtpState] = useState<OtpState | null>(null);
  const [code, setCode] = useState('');
  const [remember, setRemember] = useState(true);
  const [resending, setResending] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [resendIn, setResendIn] = useState(0);
  const tickerRef = useRef<any>(null);

  // ── Countdown ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!otp) return;
    const tick = () => {
      const ms = otp.expires_at - Date.now();
      setSecondsLeft(Math.max(0, Math.floor(ms / 1000)));
    };
    tick();
    tickerRef.current = setInterval(tick, 1000);
    return () => clearInterval(tickerRef.current);
  }, [otp]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  // ── Step 1: submit credentials ──────────────────────────────────────────
  const submitCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email || !password) return setError('Completa email y contraseña');
    if (!captchaToken) return setError('Verifica el captcha antes de continuar');

    setLoading(true);
    try {
      const trustedId =
        typeof window !== 'undefined' ? window.localStorage.getItem(TRUSTED_KEY) || '' : '';
      const res = await fetch('/api/admin/auth/login-step1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          password,
          captcha_token: captchaToken,
          trusted_device_id: trustedId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || 'No se pudo iniciar sesión');
        // reset captcha (single-use token)
        setCaptchaToken(null);
        setCaptchaKey((k) => k + 1);
        setLoading(false);
        return;
      }
      if (data.step === 'complete' && data.token) {
        if (data.trusted_device_id && typeof window !== 'undefined') {
          window.localStorage.setItem(TRUSTED_KEY, data.trusted_device_id);
        }
        onSuccess(data.token, data.user);
        return;
      }
      if (data.step === 'otp_required') {
        setOtpState({
          challenge_id: data.challenge_id,
          channel: data.channel,
          masked: data.masked,
          expires_at: Date.now() + (data.expires_in_seconds || 600) * 1000,
        });
        setStep('otp');
        setResendIn(30);
      } else {
        setError('Respuesta inesperada del servidor');
      }
    } catch {
      setError('Error de conexión. Intenta de nuevo.');
    }
    setLoading(false);
  };

  // ── Step 2: submit OTP ───────────────────────────────────────────────────
  const submitOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!otp) return;
    if (code.length !== 6) return setError('Ingresa los 6 dígitos');
    setLoading(true);
    try {
      const res = await fetch('/api/admin/auth/login-step2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challenge_id: otp.challenge_id,
          code,
          remember_device: remember,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || 'Código incorrecto');
        setLoading(false);
        return;
      }
      if (data.trusted_device_id && typeof window !== 'undefined') {
        window.localStorage.setItem(TRUSTED_KEY, data.trusted_device_id);
      }
      onSuccess(data.token, data.user);
    } catch {
      setError('Error de conexión');
    }
    setLoading(false);
  };

  const resend = async () => {
    if (!otp || resendIn > 0) return;
    setResending(true);
    setError('');
    try {
      const res = await fetch('/api/admin/auth/login-step1/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challenge_id: otp.challenge_id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || 'No se pudo reenviar');
      } else {
        setOtpState({
          ...otp,
          expires_at: Date.now() + (data.expires_in_seconds || 600) * 1000,
        });
        setResendIn(30);
        setCode('');
      }
    } catch {
      setError('Error de conexión');
    }
    setResending(false);
  };

  const backToCredentials = () => {
    setStep('credentials');
    setOtpState(null);
    setCode('');
    setError('');
    setCaptchaToken(null);
    setCaptchaKey((k) => k + 1);
  };

  const fmtTime = (s: number) => {
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${String(r).padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-[#060910] flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/[0.04] rounded-full blur-[120px]" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/[0.03] rounded-full blur-[120px]" />

      <div className="w-full max-w-sm relative z-10">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-400 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-[0_0_30px_rgba(59,130,246,0.3)]">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-xl font-bold text-white">Admin Panel</h1>
          <p className="text-sm text-gray-500">Ross House Rentals</p>
        </div>

        {step === 'credentials' && (
          <form onSubmit={submitCredentials} className="bg-white/[0.03] backdrop-blur-xl rounded-2xl border border-white/[0.08] p-6">
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-4 text-red-400 text-sm text-center">
                {error}
              </div>
            )}

            <div className="mb-4">
              <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-[#0a1020]/60 border border-white/[0.08] rounded-xl text-white text-sm focus:border-blue-500 focus:outline-none"
                placeholder="admin@rosshouserentals.com"
                required
                autoComplete="email"
              />
            </div>
            <div className="mb-4">
              <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Contraseña</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-[#0a1020]/60 border border-white/[0.08] rounded-xl text-white text-sm focus:border-blue-500 focus:outline-none"
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
            </div>

            <div className="mb-5 flex justify-center">
              <TurnstileWidget
                key={captchaKey}
                onToken={setCaptchaToken}
                theme="dark"
                size="flexible"
                action="admin-login"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !captchaToken}
              className="w-full bg-gradient-to-r from-blue-600 to-blue-500 text-white py-3 rounded-xl font-bold hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(59,130,246,0.3)] flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" /> Acceder con verificación
                </>
              )}
            </button>

            <div className="mt-4 flex items-center justify-center gap-1.5 text-[10px] text-gray-500">
              <ShieldCheck className="w-3 h-3 text-emerald-400" />
              Protegido por verificación en 2 pasos
            </div>
          </form>
        )}

        {step === 'otp' && otp && (
          <form onSubmit={submitOtp} className="bg-white/[0.03] backdrop-blur-xl rounded-2xl border border-white/[0.08] p-6">
            <button
              type="button"
              onClick={backToCredentials}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 mb-3"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Volver
            </button>

            <div className="flex items-center gap-3 mb-4 p-3 bg-blue-500/5 border border-blue-500/20 rounded-xl">
              <div className="w-10 h-10 rounded-xl bg-blue-500/15 flex items-center justify-center flex-shrink-0">
                {otp.channel === 'sms' ? (
                  <MessageSquare className="w-5 h-5 text-blue-400" />
                ) : (
                  <Mail className="w-5 h-5 text-blue-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-white">
                  Código enviado por {otp.channel === 'sms' ? 'SMS' : 'Email'}
                </div>
                <div className="text-[11px] text-gray-400 truncate">a {otp.masked}</div>
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-3 text-red-400 text-xs text-center">
                {error}
              </div>
            )}

            <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">
              Código de 6 dígitos
            </label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              autoFocus
              className="w-full px-4 py-3 bg-[#0a1020]/60 border border-white/[0.08] rounded-xl text-white text-center text-2xl tracking-[0.5em] font-mono focus:border-blue-500 focus:outline-none"
              placeholder="······"
            />

            <div className="flex items-center justify-between mt-2 mb-4 text-[11px]">
              <span className={`${secondsLeft <= 30 ? 'text-rose-400' : 'text-gray-500'}`}>
                Expira en {fmtTime(secondsLeft)}
              </span>
              <button
                type="button"
                onClick={resend}
                disabled={resendIn > 0 || resending}
                className="text-blue-400 hover:text-blue-300 disabled:text-gray-600 flex items-center gap-1"
              >
                <RefreshCw className={`w-3 h-3 ${resending ? 'animate-spin' : ''}`} />
                {resendIn > 0 ? `Reenviar en ${resendIn}s` : 'Reenviar código'}
              </button>
            </div>

            <label className="flex items-center gap-2 mb-4 text-xs text-gray-400 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="w-4 h-4 rounded bg-[#0a1020] border-white/20"
              />
              Recordar este dispositivo por 30 días
            </label>

            <button
              type="submit"
              disabled={loading || code.length !== 6}
              className="w-full bg-gradient-to-r from-blue-600 to-blue-500 text-white py-3 rounded-xl font-bold hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(59,130,246,0.3)] flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <KeyRound className="w-4 h-4" /> Verificar y entrar
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
