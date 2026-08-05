'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Send, CheckCircle, Phone, DollarSign, Home, MessageSquare, Mail, User, Bell, ArrowRight, Sparkles } from 'lucide-react'
import { useLanguage } from '../i18n/LanguageContext'
import TurnstileWidget from '../components/TurnstileWidget'

interface PublicProperty {
  id?: string
  _id?: string
  address?: string
  city?: string
  state?: string
  bedrooms?: number
  bathrooms?: number
  rent?: number
  rent_amount?: number
  status?: string
}

/**
 * Public "Get Notified" waitlist section on the homepage.
 *
 * Submits to POST /api/public/tenant-leads (proxied to the real backend)
 * which persists to the `tenant_leads` collection AND sends welcome
 * email/SMS + admin notification. Previously this component pointed to
 * a wrong hardcoded backend URL, so submissions were silently lost.
 */
export default function Apply() {
  const { t, lang } = useLanguage()
  const isSpanish = lang === 'es'

  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    bedrooms_wanted: 2,
    max_budget: 1500,
    move_in_date: '',
    property_interest: '',
    message: '',
  })
  const [submitted, setSubmitted] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const [captchaKey, setCaptchaKey] = useState(0)
  const [properties, setProperties] = useState<PublicProperty[]>([])
  const [loadingProps, setLoadingProps] = useState(true)

  // Fetch available properties (relative URL — Vercel proxies to real backend)
  useEffect(() => {
    const fetchProps = async () => {
      try {
        const res = await fetch(`/api/public/properties`)
        const data = await res.json()
        const list: PublicProperty[] = data.properties || data.items || (Array.isArray(data) ? data : [])
        const available = list.filter(p => {
          const s = (p.status || '').toLowerCase()
          return !s || s === 'available' || s === 'vacant' || s === 'listed'
        })
        setProperties(available.length ? available : [])
      } catch {
        setProperties([])
      } finally {
        setLoadingProps(false)
      }
    }
    fetchProps()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!form.name.trim() || form.name.trim().length < 2) {
      setError(isSpanish ? 'Por favor escribe tu nombre completo' : 'Please enter your full name')
      return
    }
    const digits = form.phone.replace(/\D/g, '')
    if (digits.length < 10) {
      setError(isSpanish ? 'Tu teléfono debe tener al menos 10 dígitos' : 'Phone must have at least 10 digits')
      return
    }
    if (!form.email || !/^[^@]+@[^@]+\.[^@]+$/.test(form.email)) {
      setError(isSpanish ? 'Por favor ingresa un email válido' : 'Please enter a valid email')
      return
    }
    if (!captchaToken) {
      setError(isSpanish ? 'Completa la verificación de seguridad antes de enviar' : 'Please complete the security verification')
      return
    }

    setSending(true)
    try {
      // Combine property interest into notes so backend keeps context
      const notesParts: string[] = []
      if (form.property_interest) notesParts.push(`${isSpanish ? 'Casa de interés' : 'Property interest'}: ${form.property_interest}`)
      if (form.message.trim()) notesParts.push(form.message.trim())

      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: digits,
        bedrooms_wanted: Number(form.bedrooms_wanted) || 2,
        max_budget: Number(form.max_budget) || 1500,
        move_in_date: form.move_in_date || null,
        household_size: 1,
        has_pets: false,
        language_pref: isSpanish ? 'es' : 'en',
        notes: notesParts.join('\n\n'),
        source: 'home_apply_section',
        captcha_token: captchaToken,
      }

      const res = await fetch(`/api/public/tenant-leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setCaptchaToken(null)
        setCaptchaKey(k => k + 1)
        throw new Error(data.detail || (isSpanish ? 'No pudimos enviar. Intenta de nuevo.' : 'Could not submit. Try again.'))
      }
      setSubmitted(true)
    } catch (err: any) {
      setError(String(err?.message || err))
    }
    setSending(false)
  }

  const resetForm = () => {
    setSubmitted(false)
    setForm({ name: '', phone: '', email: '', bedrooms_wanted: 2, max_budget: 1500, move_in_date: '', property_interest: '', message: '' })
    setCaptchaToken(null)
    setCaptchaKey(k => k + 1)
  }

  const T = isSpanish ? {
    badge: 'Regístrate en 30 segundos',
    title: '¿Buscas casa en renta?',
    subtitle: 'Únete a nuestra lista de espera y te avisaremos apenas tengamos algo perfecto para ti. Sin costo, sin compromiso.',
    orCall: '¿Prefieres hablarnos directo?',
    fullName: 'Nombre completo',
    phone: 'Teléfono',
    email: 'Correo electrónico',
    bedrooms: 'Habitaciones que necesitas',
    budget: 'Presupuesto mensual (USD)',
    moveIn: '¿Cuándo te mudarías? (opcional)',
    propertyInterest: '¿Alguna casa en particular? (opcional)',
    message: '¿Algo más que quieras contarnos? (opcional)',
    submit: 'Avísame cuando haya casas',
    sending: 'Enviando…',
    successTitle: '¡Ya estás en la lista!',
    successMsg: 'Gracias {name}. Te enviamos un email de confirmación y te avisaremos apenas tengamos una casa que coincida con lo que buscas.',
    successAnother: 'Enviar otra solicitud',
    hint: 'Recibirás un email y SMS de confirmación al instante.',
    stepPrivacy: 'Tus datos están protegidos.',
  } : {
    badge: 'Sign up in 30 seconds',
    title: 'Looking for a home to rent?',
    subtitle: "Join our waitlist and we'll let you know when we have something that fits you. Free, no commitment.",
    orCall: 'Prefer to talk?',
    fullName: 'Full name',
    phone: 'Phone',
    email: 'Email',
    bedrooms: 'Bedrooms you need',
    budget: 'Monthly budget (USD)',
    moveIn: 'When would you move in? (optional)',
    propertyInterest: 'Any specific home? (optional)',
    message: 'Anything else? (optional)',
    submit: 'Notify me when there is availability',
    sending: 'Sending…',
    successTitle: 'You are on the list!',
    successMsg: 'Thanks {name}. We sent you a confirmation email and will notify you as soon as a matching home is available.',
    successAnother: 'Submit another request',
    hint: 'You will receive an email and SMS confirmation instantly.',
    stepPrivacy: 'Your data is protected.',
  }

  return (
    <section id="apply" className="py-20 md:py-24 bg-warm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid lg:grid-cols-5 gap-10 lg:gap-16 items-center">
          {/* Left column — pitch */}
          <motion.div className="lg:col-span-2" initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
            <span className="inline-flex items-center gap-1.5 bg-primary/10 text-primary px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest">
              <Sparkles className="w-3.5 h-3.5" /> {T.badge}
            </span>
            <h2 className="font-display text-3xl md:text-5xl font-bold text-charcoal mt-4 mb-4 leading-tight">{T.title}</h2>
            <p className="text-gray-600 text-lg leading-relaxed mb-8">{T.subtitle}</p>

            {/* Trust pills */}
            <div className="space-y-2.5 mb-8">
              {[
                { icon: '🎯', text: isSpanish ? 'Solo te avisamos casas que se ajusten a tu presupuesto y habitaciones' : 'We only ping you for homes that match your budget and bedrooms' },
                { icon: '⚡', text: isSpanish ? 'Aviso instantáneo por email + SMS' : 'Instant email + SMS notification' },
                { icon: '🔒', text: isSpanish ? 'Nunca compartimos tus datos con terceros' : 'We never share your data with third parties' },
              ].map((it, i) => (
                <div key={i} className="flex items-start gap-2.5 text-sm text-gray-700">
                  <span className="text-lg leading-none mt-0.5">{it.icon}</span>
                  <span>{it.text}</span>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <p className="text-gray-500 text-sm mb-3">{T.orCall}</p>
              <a href="tel:+18069342018" className="bg-primary hover:bg-primary-dark text-white px-5 py-3 rounded-xl font-bold transition-all inline-flex items-center gap-2 shadow-md">
                <Phone className="w-4 h-4" /> (806) 934-2018
              </a>
            </div>
          </motion.div>

          {/* Right column — form */}
          <motion.div className="lg:col-span-3" initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
            {submitted ? (
              <div className="bg-white rounded-3xl shadow-xl p-8 md:p-12 text-center border border-gray-100">
                <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
                  <CheckCircle className="w-10 h-10 text-green-500" />
                </div>
                <h3 className="font-display text-2xl md:text-3xl font-bold text-charcoal mb-3">{T.successTitle}</h3>
                <p className="text-gray-500 text-base md:text-lg mb-6">{T.successMsg.replace('{name}', form.name)}</p>
                <button onClick={resetForm} className="text-primary hover:text-primary-dark font-semibold underline">
                  {T.successAnother}
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="bg-white rounded-3xl shadow-xl p-6 md:p-8 border border-gray-100 space-y-4" noValidate>
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm font-medium">
                    ⚠️ {error}
                  </div>
                )}

                {/* Name */}
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-1.5">
                    <User className="w-3.5 h-3.5 inline mr-1" />{T.fullName} <span className="text-red-500">*</span>
                  </label>
                  <input
                    required
                    type="text"
                    autoComplete="name"
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    placeholder={isSpanish ? 'Juan Pérez' : 'John Smith'}
                    className="w-full px-4 py-3 rounded-xl bg-gray-50 border-2 border-gray-200 text-sm focus:border-primary focus:bg-white outline-none transition-all"
                  />
                </div>

                {/* Phone + Email */}
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-1.5">
                      <Phone className="w-3.5 h-3.5 inline mr-1" />{T.phone} <span className="text-red-500">*</span>
                    </label>
                    <input
                      required
                      type="tel"
                      autoComplete="tel"
                      inputMode="tel"
                      value={form.phone}
                      onChange={e => setForm({ ...form, phone: e.target.value })}
                      placeholder="(806) 555-1234"
                      className="w-full px-4 py-3 rounded-xl bg-gray-50 border-2 border-gray-200 text-sm focus:border-primary focus:bg-white outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-1.5">
                      <Mail className="w-3.5 h-3.5 inline mr-1" />{T.email} <span className="text-red-500">*</span>
                    </label>
                    <input
                      required
                      type="email"
                      autoComplete="email"
                      inputMode="email"
                      value={form.email}
                      onChange={e => setForm({ ...form, email: e.target.value })}
                      placeholder="tu@email.com"
                      className="w-full px-4 py-3 rounded-xl bg-gray-50 border-2 border-gray-200 text-sm focus:border-primary focus:bg-white outline-none transition-all"
                    />
                  </div>
                </div>

                {/* Bedrooms + Budget */}
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-1.5">
                      <Home className="w-3.5 h-3.5 inline mr-1" />{T.bedrooms}
                    </label>
                    <select
                      value={form.bedrooms_wanted}
                      onChange={e => setForm({ ...form, bedrooms_wanted: parseInt(e.target.value) })}
                      className="w-full px-4 py-3 rounded-xl bg-gray-50 border-2 border-gray-200 text-sm focus:border-primary focus:bg-white outline-none transition-all appearance-none"
                    >
                      {[1, 2, 3, 4, 5].map(n => (
                        <option key={n} value={n}>{n} {isSpanish ? (n === 1 ? 'habitación' : 'habitaciones') : (n === 1 ? 'bedroom' : 'bedrooms')}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-1.5">
                      <DollarSign className="w-3.5 h-3.5 inline mr-1" />{T.budget}
                    </label>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={500}
                      max={10000}
                      step={50}
                      value={form.max_budget}
                      onChange={e => setForm({ ...form, max_budget: parseInt(e.target.value || '0') })}
                      placeholder="1500"
                      className="w-full px-4 py-3 rounded-xl bg-gray-50 border-2 border-gray-200 text-sm focus:border-primary focus:bg-white outline-none transition-all"
                    />
                  </div>
                </div>

                {/* Property interest (optional) */}
                {properties.length > 0 && (
                  <div>
                    <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-1.5">
                      <Home className="w-3.5 h-3.5 inline mr-1" />{T.propertyInterest}
                    </label>
                    <select
                      value={form.property_interest}
                      onChange={e => setForm({ ...form, property_interest: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl bg-gray-50 border-2 border-gray-200 text-sm focus:border-primary focus:bg-white outline-none transition-all"
                    >
                      <option value="">{isSpanish ? '— No específica —' : '— No specific —'}</option>
                      {properties.map(p => {
                        const addr = p.address || ''
                        const beds = p.bedrooms ? `${p.bedrooms}BR` : ''
                        const rent = (p.rent || p.rent_amount) ? `$${(p.rent || p.rent_amount)?.toLocaleString()}/mo` : ''
                        const label = [addr, beds, rent].filter(Boolean).join(' — ')
                        return <option key={addr} value={addr}>{label}</option>
                      })}
                    </select>
                  </div>
                )}

                {/* Message (optional collapsible) */}
                <details className="group">
                  <summary className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer hover:text-primary transition">
                    <MessageSquare className="w-4 h-4" />
                    {isSpanish ? 'Agregar un mensaje (opcional)' : 'Add a message (optional)'}
                  </summary>
                  <textarea
                    value={form.message}
                    onChange={e => setForm({ ...form, message: e.target.value })}
                    rows={3}
                    placeholder={isSpanish ? 'Cuéntanos si tienes preferencias específicas, mascotas, fecha de mudanza, etc.' : 'Tell us about pet needs, move-in date, or any preferences.'}
                    className="w-full mt-2 px-4 py-3 rounded-xl bg-gray-50 border-2 border-gray-200 text-sm focus:border-primary focus:bg-white outline-none transition-all resize-none"
                  />
                </details>

                {/* Captcha */}
                <div className="flex justify-center pt-1">
                  <TurnstileWidget
                    key={captchaKey}
                    onToken={setCaptchaToken}
                    theme="light"
                    size="flexible"
                    action="home-apply"
                  />
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={sending || !captchaToken}
                  className="w-full bg-primary hover:bg-primary-dark text-white py-4 rounded-2xl font-bold text-base md:text-lg transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sending ? T.sending : (
                    <>
                      <Bell className="w-5 h-5" /> {T.submit}
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                <p className="text-[11px] text-gray-500 text-center flex items-center justify-center gap-1">
                  <span>🔒 {T.stepPrivacy}</span>
                  <span className="hidden sm:inline">·</span>
                  <span className="hidden sm:inline">{T.hint}</span>
                </p>
              </form>
            )}
          </motion.div>
        </div>
      </div>
    </section>
  )
}
