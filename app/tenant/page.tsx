'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Mail, Phone, Lock, ArrowRight, Eye, EyeOff, KeyRound, Smartphone } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'

const API_URL = process.env.NEXT_PUBLIC_RHR_API_URL || 'https://ross-house-backend-production.up.railway.app/api'

type AuthMode = 'password' | 'otp'

export default function TenantLogin() {
  const [mode, setMode] = useState<AuthMode>('password')

  // Password mode
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  // OTP mode
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [otpStep, setOtpStep] = useState<'phone' | 'code'>('phone')
  const [otpSentAt, setOtpSentAt] = useState<number | null>(null)

  // Shared
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const persistSession = (data: { token: string; tenant?: unknown; user?: unknown }) => {
    if (!data?.token) return
    localStorage.setItem('tenant_token', data.token)
    localStorage.setItem('access_token', data.token) // legacy
    if (data.tenant) localStorage.setItem('tenant_info', JSON.stringify(data.tenant))
    if (data.user) localStorage.setItem('user_info', JSON.stringify(data.user))
    window.location.href = '/tenant/dashboard'
  }

  // ─── Password login (uses marketplace-login — same as admin)
  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API_URL}/public/marketplace-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.detail || 'Email o contraseña incorrectos')
        return
      }
      persistSession(data)
    } catch {
      setError('Error de conexión. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  // ─── OTP step 1: send code via Twilio
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const cleanPhone = phone.replace(/\D/g, '')
      if (cleanPhone.length < 10) {
        setError('Ingresa un número de teléfono válido (10 dígitos)')
        setLoading(false)
        return
      }
      const res = await fetch(`${API_URL}/rental/phone/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: cleanPhone }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.detail || 'No se pudo enviar el código')
        return
      }
      setOtpStep('code')
      setOtpSentAt(Date.now())
    } catch {
      setError('Error de conexión. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  // ─── OTP step 2: verify code
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const cleanPhone = phone.replace(/\D/g, '')
      const res = await fetch(`${API_URL}/rental/phone/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: cleanPhone, code: otp.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.detail || 'Código inválido o expirado')
        return
      }
      persistSession(data)
    } catch {
      setError('Error de conexión. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  const switchMode = (newMode: AuthMode) => {
    setMode(newMode)
    setError('')
    if (newMode === 'password') {
      setOtpStep('phone')
      setOtp('')
    }
  }

  return (
    <div className="min-h-screen bg-[#0A0A0C] flex flex-col relative overflow-hidden">
      {/* Layered dark gradient + subtle red bloom */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#0F0F12] via-[#0A0A0C] to-black pointer-events-none" />
      <div
        className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle at center, rgba(237,27,51,0.12) 0%, rgba(237,27,51,0.04) 35%, transparent 70%)' }}
      />
      <div
        className="absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle at center, rgba(237,27,51,0.08) 0%, transparent 65%)' }}
      />

      {/* Nav */}
      <nav className="w-full py-5 px-6 relative z-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-11 h-11 rounded-2xl overflow-hidden border border-white/10 shadow-lg shadow-black/40 bg-white/5">
              <Image src="/logo.jpg" alt="Ross House Rentals" width={44} height={44} className="w-full h-full object-cover" />
            </div>
            <div>
              <div className="font-display font-semibold text-white text-base leading-tight tracking-tight">Ross House Rentals</div>
              <div className="text-white/40 text-[10px] uppercase tracking-[0.18em] mt-0.5">Dumas · Texas</div>
            </div>
          </Link>
          <Link href="/" className="text-white/50 hover:text-white text-sm font-medium transition-colors">
            <span className="hidden sm:inline">Inicio</span><span className="sm:hidden">←</span>
          </Link>
        </div>
      </nav>

      {/* Card */}
      <div className="flex-1 flex items-center justify-center px-4 py-8 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-md"
        >
          {/* Logo + Title */}
          <div className="text-center mb-8">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.15, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="relative inline-block mb-6"
            >
              <div
                className="absolute inset-0 -m-8 rounded-full opacity-80"
                style={{ background: 'radial-gradient(ellipse at center, rgba(237,27,51,0.32) 0%, rgba(237,27,51,0.10) 40%, transparent 70%)', filter: 'blur(20px)' }}
              />
              <div className="relative w-24 h-24 rounded-3xl overflow-hidden border border-white/10 shadow-2xl shadow-primary/20 bg-white/5 backdrop-blur-xl">
                <Image src="/logo.jpg" alt="Ross House Rentals" width={96} height={96} className="w-full h-full object-cover" />
              </div>
            </motion.div>
            <h1 className="font-display text-[28px] font-semibold text-white leading-tight tracking-tight">Bienvenido</h1>
            <p className="text-white/50 text-sm mt-2 max-w-xs mx-auto leading-relaxed">
              Accede a tu portal de inquilino para gestionar renta, contratos y servicios.
            </p>
          </div>

          {/* Form */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="bg-white/[0.04] backdrop-blur-2xl rounded-3xl p-7 border border-white/[0.08] shadow-2xl shadow-black/60"
            style={{ boxShadow: '0 30px 60px -20px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.05), inset 0 1px 0 rgba(255,255,255,0.06)' }}
          >
            {/* Mode Toggle */}
            <div className="flex bg-black/40 rounded-2xl p-1 mb-6 border border-white/[0.06]">
              <button
                type="button"
                onClick={() => switchMode('password')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all ${
                  mode === 'password'
                    ? 'bg-gradient-to-br from-primary to-primary-dark text-white shadow-lg shadow-primary/30'
                    : 'text-white/50 hover:text-white/80'
                }`}
              >
                <KeyRound className="w-3.5 h-3.5" /> Contraseña
              </button>
              <button
                type="button"
                onClick={() => switchMode('otp')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all ${
                  mode === 'otp'
                    ? 'bg-gradient-to-br from-primary to-primary-dark text-white shadow-lg shadow-primary/30'
                    : 'text-white/50 hover:text-white/80'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" /> Código SMS
              </button>
            </div>

            <AnimatePresence mode="wait">
              {/* PASSWORD MODE */}
              {mode === 'password' && (
                <motion.form
                  key="pw"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  transition={{ duration: 0.25 }}
                  onSubmit={handlePasswordLogin}
                  className="space-y-5"
                >
                  {error && (
                    <div className="bg-primary/[0.08] border border-primary/30 text-white/90 px-4 py-3 rounded-xl text-sm text-center">
                      {error}
                    </div>
                  )}

                  <div>
                    <label className="block text-white/60 text-[11px] font-semibold uppercase tracking-[0.12em] mb-2.5">
                      <Mail className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" /> Email
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="tu@email.com"
                      autoComplete="email"
                      className="w-full px-4 py-3.5 rounded-xl bg-black/40 border border-white/[0.08] text-white placeholder-white/30 text-sm focus:outline-none focus:border-primary/60 focus:bg-black/50 focus:shadow-[0_0_0_3px_rgba(237,27,51,0.15)] transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-white/60 text-[11px] font-semibold uppercase tracking-[0.12em] mb-2.5">
                      <Lock className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" /> Contraseña
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Tu contraseña"
                        autoComplete="current-password"
                        className="w-full px-4 py-3.5 rounded-xl bg-black/40 border border-white/[0.08] text-white placeholder-white/30 text-sm focus:outline-none focus:border-primary/60 focus:bg-black/50 focus:shadow-[0_0_0_3px_rgba(237,27,51,0.15)] transition-all pr-12"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/80 transition-colors p-1"
                        aria-label={showPassword ? 'Ocultar' : 'Mostrar'}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <Link href="/tenant/forgot-password" className="text-white/40 hover:text-primary text-xs mt-2 inline-block transition-colors">
                      ¿Olvidaste tu contraseña?
                    </Link>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-gradient-to-br from-primary to-primary-dark hover:from-primary-light hover:to-primary text-white py-4 rounded-2xl font-semibold text-[15px] tracking-wide transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary/30 hover:shadow-primary/50 active:scale-[0.98]"
                  >
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>Entrar <ArrowRight className="w-4 h-4" /></>
                    )}
                  </button>
                </motion.form>
              )}

              {/* OTP MODE */}
              {mode === 'otp' && (
                <motion.div
                  key="otp"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.25 }}
                >
                  {otpStep === 'phone' ? (
                    <form onSubmit={handleSendOtp} className="space-y-5">
                      {error && (
                        <div className="bg-primary/[0.08] border border-primary/30 text-white/90 px-4 py-3 rounded-xl text-sm text-center">{error}</div>
                      )}
                      <div>
                        <label className="block text-white/60 text-[11px] font-semibold uppercase tracking-[0.12em] mb-2.5">
                          <Phone className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" /> Número de teléfono
                        </label>
                        <input
                          type="tel"
                          required
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="(806) 555-1234"
                          autoComplete="tel"
                          className="w-full px-4 py-3.5 rounded-xl bg-black/40 border border-white/[0.08] text-white placeholder-white/30 text-sm focus:outline-none focus:border-primary/60 focus:bg-black/50 focus:shadow-[0_0_0_3px_rgba(237,27,51,0.15)] transition-all"
                        />
                        <p className="text-white/35 text-xs mt-2 leading-relaxed">
                          Te enviaremos un código de 6 dígitos por SMS.
                        </p>
                      </div>
                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-gradient-to-br from-primary to-primary-dark hover:from-primary-light hover:to-primary text-white py-4 rounded-2xl font-semibold text-[15px] tracking-wide transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary/30 hover:shadow-primary/50 active:scale-[0.98]"
                      >
                        {loading ? (
                          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                          <>Enviar código <ArrowRight className="w-4 h-4" /></>
                        )}
                      </button>
                    </form>
                  ) : (
                    <form onSubmit={handleVerifyOtp} className="space-y-5">
                      {error && (
                        <div className="bg-primary/[0.08] border border-primary/30 text-white/90 px-4 py-3 rounded-xl text-sm text-center">{error}</div>
                      )}
                      <div className="bg-emerald-500/[0.08] border border-emerald-400/30 text-emerald-100/90 px-4 py-3 rounded-xl text-xs text-center">
                        ✓ Código enviado a {phone}
                      </div>
                      <div>
                        <label className="block text-white/60 text-[11px] font-semibold uppercase tracking-[0.12em] mb-2.5">
                          <KeyRound className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" /> Código de verificación
                        </label>
                        <input
                          type="text"
                          required
                          value={otp}
                          onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          placeholder="000000"
                          autoComplete="one-time-code"
                          inputMode="numeric"
                          maxLength={6}
                          className="w-full px-4 py-3.5 rounded-xl bg-black/40 border border-white/[0.08] text-white placeholder-white/20 text-2xl font-mono tracking-[0.5em] text-center focus:outline-none focus:border-primary/60 focus:bg-black/50 focus:shadow-[0_0_0_3px_rgba(237,27,51,0.15)] transition-all"
                        />
                        <button
                          type="button"
                          onClick={() => { setOtpStep('phone'); setOtp(''); setError('') }}
                          className="text-white/40 hover:text-primary text-xs mt-2 inline-block transition-colors"
                        >
                          ← Usar otro número
                        </button>
                      </div>
                      <button
                        type="submit"
                        disabled={loading || otp.length !== 6}
                        className="w-full bg-gradient-to-br from-primary to-primary-dark hover:from-primary-light hover:to-primary text-white py-4 rounded-2xl font-semibold text-[15px] tracking-wide transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary/30 hover:shadow-primary/50 active:scale-[0.98]"
                      >
                        {loading ? (
                          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                          <>Verificar y entrar <ArrowRight className="w-4 h-4" /></>
                        )}
                      </button>
                      {otpSentAt && Date.now() - otpSentAt > 30000 && (
                        <button
                          type="button"
                          onClick={(e) => { e.preventDefault(); handleSendOtp(e as unknown as React.FormEvent) }}
                          className="block mx-auto text-white/40 hover:text-primary text-xs transition-colors"
                        >
                          Reenviar código
                        </button>
                      )}
                    </form>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Footer */}
          <div className="mt-7 text-center space-y-3">
            <p className="text-white/35 text-xs">
              ¿Necesitas ayuda?{' '}
              <a href="tel:+18069342018" className="text-white/70 hover:text-primary transition-colors font-medium">(806) 934-2018</a>
            </p>
            <div className="flex items-center justify-center gap-1.5 text-white/25 text-[10px] uppercase tracking-[0.15em] font-medium">
              <span className="w-1 h-1 rounded-full bg-emerald-400/80 animate-pulse" />
              Sesión segura
              <span className="text-white/15 mx-1">·</span>
              Cifrado de 256 bits
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
