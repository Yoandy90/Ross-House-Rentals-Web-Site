'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Mail, Lock, KeyRound, ArrowRight, Eye, EyeOff, CheckCircle2, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'

const API_URL = process.env.NEXT_PUBLIC_RHR_API_URL || 'https://ross-house-backend-production.up.railway.app/api'

type Step = 'email' | 'code' | 'success'

export default function ForgotPassword() {
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [phoneMasked, setPhoneMasked] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sentAt, setSentAt] = useState<number | null>(null)

  // ─── Step 1: request reset code
  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.detail || 'No se pudo enviar el código')
        return
      }
      setPhoneMasked(data.phone_masked || '***')
      setStep('code')
      setSentAt(Date.now())
    } catch {
      setError('Error de conexión. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  // ─── Step 2: verify code + set new password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (newPassword.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres')
      setLoading(false)
      return
    }

    try {
      const res = await fetch(`${API_URL}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          code: code.trim(),
          new_password: newPassword,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.detail || 'Código inválido o expirado')
        return
      }
      setStep('success')
    } catch {
      setError('Error de conexión. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  const resendCode = async () => {
    setCode('')
    setError('')
    await handleSendCode({ preventDefault: () => {} } as React.FormEvent)
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
          <Link href="/tenant" className="text-white/50 hover:text-white text-sm font-medium transition-colors flex items-center gap-1.5">
            <ArrowLeft className="w-4 h-4" /> <span className="hidden sm:inline">Volver al login</span>
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
          {/* Icon + Title */}
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
              <div className="relative w-20 h-20 rounded-3xl border border-white/10 shadow-2xl shadow-primary/20 bg-white/5 backdrop-blur-xl flex items-center justify-center">
                {step === 'success' ? (
                  <CheckCircle2 className="w-9 h-9 text-emerald-400" strokeWidth={2.5} />
                ) : (
                  <KeyRound className="w-8 h-8 text-primary" strokeWidth={2.2} />
                )}
              </div>
            </motion.div>
            <h1 className="font-display text-[26px] font-semibold text-white leading-tight tracking-tight">
              {step === 'email' && 'Restablecer contraseña'}
              {step === 'code' && 'Revisa tu SMS'}
              {step === 'success' && '¡Contraseña actualizada!'}
            </h1>
            <p className="text-white/50 text-sm mt-2 max-w-xs mx-auto leading-relaxed">
              {step === 'email' && 'Te enviaremos un código de 6 dígitos por SMS al teléfono asociado a tu cuenta.'}
              {step === 'code' && `Enviamos un código de 6 dígitos a ${phoneMasked}. Ingrésalo abajo y elige una nueva contraseña.`}
              {step === 'success' && 'Ya puedes iniciar sesión con tu nueva contraseña.'}
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
            <AnimatePresence mode="wait">
              {step === 'email' && (
                <motion.form
                  key="email"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  transition={{ duration: 0.25 }}
                  onSubmit={handleSendCode}
                  className="space-y-5"
                >
                  {error && (
                    <div className="bg-primary/[0.08] border border-primary/30 text-white/90 px-4 py-3 rounded-xl text-sm text-center">{error}</div>
                  )}
                  <div>
                    <label className="block text-white/60 text-[11px] font-semibold uppercase tracking-[0.12em] mb-2.5">
                      <Mail className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" /> Email de tu cuenta
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="tu@email.com"
                      autoComplete="email"
                      autoFocus
                      className="w-full px-4 py-3.5 rounded-xl bg-black/40 border border-white/[0.08] text-white placeholder-white/30 text-sm focus:outline-none focus:border-primary/60 focus:bg-black/50 focus:shadow-[0_0_0_3px_rgba(237,27,51,0.15)] transition-all"
                    />
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
                </motion.form>
              )}

              {step === 'code' && (
                <motion.form
                  key="code"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.25 }}
                  onSubmit={handleResetPassword}
                  className="space-y-5"
                >
                  {error && (
                    <div className="bg-primary/[0.08] border border-primary/30 text-white/90 px-4 py-3 rounded-xl text-sm text-center">{error}</div>
                  )}
                  <div className="bg-emerald-500/[0.08] border border-emerald-400/30 text-emerald-100/90 px-4 py-3 rounded-xl text-xs text-center">
                    ✓ Código enviado a {phoneMasked}
                  </div>
                  <div>
                    <label className="block text-white/60 text-[11px] font-semibold uppercase tracking-[0.12em] mb-2.5">
                      <KeyRound className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" /> Código de 6 dígitos
                    </label>
                    <input
                      type="text"
                      required
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="000000"
                      autoComplete="one-time-code"
                      inputMode="numeric"
                      maxLength={6}
                      autoFocus
                      className="w-full px-4 py-3.5 rounded-xl bg-black/40 border border-white/[0.08] text-white placeholder-white/20 text-2xl font-mono tracking-[0.5em] text-center focus:outline-none focus:border-primary/60 focus:bg-black/50 focus:shadow-[0_0_0_3px_rgba(237,27,51,0.15)] transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-white/60 text-[11px] font-semibold uppercase tracking-[0.12em] mb-2.5">
                      <Lock className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" /> Nueva contraseña
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Mínimo 6 caracteres"
                        autoComplete="new-password"
                        minLength={6}
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
                    <p className="text-white/35 text-xs mt-2">Mínimo 6 caracteres. Usa una combinación de letras, números y símbolos.</p>
                  </div>
                  <button
                    type="submit"
                    disabled={loading || code.length !== 6 || newPassword.length < 6}
                    className="w-full bg-gradient-to-br from-primary to-primary-dark hover:from-primary-light hover:to-primary text-white py-4 rounded-2xl font-semibold text-[15px] tracking-wide transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary/30 hover:shadow-primary/50 active:scale-[0.98]"
                  >
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>Restablecer contraseña <ArrowRight className="w-4 h-4" /></>
                    )}
                  </button>
                  <div className="flex items-center justify-between text-xs">
                    <button
                      type="button"
                      onClick={() => { setStep('email'); setCode(''); setNewPassword(''); setError('') }}
                      className="text-white/40 hover:text-primary transition-colors"
                    >
                      ← Cambiar email
                    </button>
                    {sentAt && Date.now() - sentAt > 30000 && (
                      <button
                        type="button"
                        onClick={resendCode}
                        className="text-white/40 hover:text-primary transition-colors"
                      >
                        Reenviar código
                      </button>
                    )}
                  </div>
                </motion.form>
              )}

              {step === 'success' && (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                  className="text-center py-2"
                >
                  <p className="text-white/70 text-sm mb-6">
                    Tu contraseña ha sido actualizada exitosamente. Ya puedes iniciar sesión.
                  </p>
                  <Link
                    href="/tenant"
                    className="block w-full bg-gradient-to-br from-primary to-primary-dark hover:from-primary-light hover:to-primary text-white py-4 rounded-2xl font-semibold text-[15px] tracking-wide transition-all shadow-lg shadow-primary/30 hover:shadow-primary/50 active:scale-[0.98]"
                  >
                    Iniciar sesión <ArrowRight className="w-4 h-4 inline ml-1" />
                  </Link>
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
