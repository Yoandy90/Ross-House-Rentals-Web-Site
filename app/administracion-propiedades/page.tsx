'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import Image from 'next/image'
import Link from 'next/link'
import {
  Building2, CheckCircle2, Loader2, Sparkles, Shield, ArrowRight,
  Phone, Mail, Users, Wrench, FileCheck, LayoutDashboard, Languages,
  Wallet,
} from 'lucide-react'
import { useLanguage } from '../i18n/LanguageContext'
import { Turnstile } from '@marsidev/react-turnstile'

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '1x00000000000000000000AA'

const BENEFIT_ICONS = [Users, Wallet, Wrench, FileCheck, LayoutDashboard, Languages]

export default function PmWaitlistPage() {
  const { t, lang, toggleLang } = useLanguage() as any
  const isEs = (lang || 'es') === 'es'
  const pm = t.pmWaitlist

  const [form, setForm] = useState({
    name: '', email: '', phone: '', city: 'Dumas', state: 'TX',
    property_count: 1,
    property_types: [] as string[],
    current_situation: '',
    notes: '',
  })
  const [captchaToken, setCaptchaToken] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string>('')

  const setField = (k: string, v: any) => setForm(prev => ({ ...prev, [k]: v }))

  const togglePropertyType = (key: string) => {
    setForm(prev => ({
      ...prev,
      property_types: prev.property_types.includes(key)
        ? prev.property_types.filter(k => k !== key)
        : [...prev.property_types, key],
    }))
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!captchaToken) { setError(pm.captchaError); return }
    setSubmitting(true)
    try {
      const res = await fetch('/api/public/pm-service-waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          phone: form.phone,
          city: form.city || null,
          state: form.state || 'TX',
          property_count: Number(form.property_count) || 1,
          property_types: form.property_types.length ? form.property_types : null,
          current_situation: form.current_situation || null,
          notes: form.notes || null,
          language_pref: isEs ? 'es' : 'en',
          captcha_token: captchaToken,
        }),
      })
      if (!res.ok) throw new Error('Submit failed')
      setSuccess(true)
    } catch (_err) {
      setError(pm.submitError)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-amber-50/30">
      {/* Nav */}
      <nav className="fixed w-full z-50 bg-white/95 backdrop-blur-md shadow-sm py-3">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-3 min-w-0">
            <Image src="/logo.jpg" alt="Ross House Rentals LLC" width={48} height={48} className="rounded-xl object-contain w-11 h-11 sm:w-12 sm:h-12 flex-shrink-0" />
            <div className="min-w-0">
              <div className="font-bold text-primary text-sm sm:text-base leading-tight truncate">Ross House Rentals</div>
              <div className="text-gray-400 text-[10px] uppercase tracking-widest truncate">{pm.title}</div>
            </div>
          </Link>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={toggleLang} className="text-gray-500 hover:text-primary text-xs font-semibold px-3 py-1.5 rounded-lg border border-gray-200">
              {t.lang.toggle}
            </button>
            <Link href="/" className="text-gray-500 hover:text-primary text-sm font-medium hidden md:block">
              {pm.backHome}
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-28 pb-12 md:pt-32 md:pb-20 relative overflow-hidden">
        <div className="absolute -top-20 -right-20 w-96 h-96 rounded-full bg-amber-400/10 blur-[100px] pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-96 h-96 rounded-full bg-blue-400/10 blur-[100px] pointer-events-none" />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center relative">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-amber-100 to-orange-100 border border-amber-200 text-amber-800 text-xs font-black uppercase tracking-widest mb-6 shadow-sm">
              <Sparkles className="w-3.5 h-3.5" />
              {pm.badge}
            </div>
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-blue-500 via-indigo-500 to-violet-600 mb-6 shadow-xl shadow-indigo-500/30">
              <Building2 className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-4xl md:text-6xl font-black text-slate-900 leading-tight mb-6">
              {pm.title}
            </h1>
            <p className="text-lg md:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
              {pm.subtitle}
            </p>
          </motion.div>
        </div>
      </section>

      {/* Legal disclaimer callout */}
      <section className="pb-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-200 rounded-2xl p-6 md:p-8 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0">
                <Shield className="w-5 h-5 text-amber-700" />
              </div>
              <div>
                <h3 className="font-bold text-amber-900 text-lg mb-2">{pm.disclaimerTitle}</h3>
                <p className="text-amber-800/90 text-sm md:text-base leading-relaxed">{pm.disclaimerBody}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits grid */}
      <section className="pb-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <h2 className="text-2xl md:text-3xl font-black text-slate-900 mb-6 text-center">{pm.benefitsTitle}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
            {pm.benefits.map((b: string, i: number) => {
              const Ic = BENEFIT_ICONS[i % BENEFIT_ICONS.length]
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-start gap-3 bg-white rounded-2xl border border-slate-200 p-4 hover:border-primary/40 hover:shadow-md transition"
                >
                  <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Ic className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span className="text-slate-700 text-sm leading-relaxed">{b}</span>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Waitlist form */}
      <section id="form" className="pb-24">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
            {success ? (
              <div className="p-8 md:p-12 text-center">
                <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-6">
                  <CheckCircle2 className="w-10 h-10 text-emerald-600" />
                </div>
                <h2 className="text-2xl md:text-3xl font-black text-slate-900 mb-3">{pm.successTitle}</h2>
                <p className="text-slate-600 mb-8 leading-relaxed">
                  {(pm.successBody as string).replace('{name}', form.name)}
                </p>
                <Link href="/" className="inline-flex items-center gap-2 bg-primary hover:bg-primary-dark text-white px-6 py-3 rounded-xl font-semibold transition">
                  {pm.backHome} <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            ) : (
              <>
                <div className="px-6 md:px-8 pt-8 pb-4 border-b border-slate-100">
                  <h2 className="text-2xl font-black text-slate-900 mb-1">{pm.formTitle}</h2>
                  <p className="text-slate-500 text-sm">{pm.formSubtitle}</p>
                </div>
                <form onSubmit={submit} className="p-6 md:p-8 space-y-5">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">{pm.fields.name}</label>
                      <input required minLength={2} value={form.name} onChange={e => setField('name', e.target.value)} placeholder={pm.placeholders.name}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition text-slate-900" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">{pm.fields.email}</label>
                      <input required type="email" value={form.email} onChange={e => setField('email', e.target.value)} placeholder={pm.placeholders.email}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition text-slate-900" />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">{pm.fields.phone}</label>
                      <input required value={form.phone} onChange={e => setField('phone', e.target.value)} placeholder={pm.placeholders.phone}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition text-slate-900" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">{pm.fields.city}</label>
                      <input value={form.city} onChange={e => setField('city', e.target.value)} placeholder={pm.placeholders.city}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition text-slate-900" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">{pm.fields.state}</label>
                      <input value={form.state} onChange={e => setField('state', e.target.value.toUpperCase().slice(0, 2))} maxLength={2}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition text-slate-900" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">{pm.fields.propertyCount}</label>
                    <input required type="number" min={1} max={1000} value={form.property_count} onChange={e => setField('property_count', e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition text-slate-900" />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">{pm.fields.propertyTypes}</label>
                    <div className="flex flex-wrap gap-2">
                      {pm.propertyTypeOptions.map((opt: any) => {
                        const active = form.property_types.includes(opt.key)
                        return (
                          <button key={opt.key} type="button" onClick={() => togglePropertyType(opt.key)}
                            className={`px-4 py-2 rounded-full text-sm font-semibold border transition ${active ? 'bg-primary border-primary text-white shadow-md' : 'bg-white border-slate-200 text-slate-600 hover:border-primary/40'}`}>
                            {opt.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">{pm.fields.currentSituation}</label>
                    <div className="grid sm:grid-cols-2 gap-2">
                      {pm.situationOptions.map((opt: any) => {
                        const active = form.current_situation === opt.key
                        return (
                          <button key={opt.key} type="button" onClick={() => setField('current_situation', opt.key)}
                            className={`px-4 py-3 rounded-xl text-sm font-medium border transition text-left ${active ? 'bg-primary/5 border-primary text-primary' : 'bg-white border-slate-200 text-slate-600 hover:border-primary/40'}`}>
                            {opt.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">{pm.fields.notes}</label>
                    <textarea rows={4} value={form.notes} onChange={e => setField('notes', e.target.value)} placeholder={pm.placeholders.notes}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition text-slate-900 resize-none" />
                  </div>

                  {/* Turnstile CAPTCHA */}
                  <div className="flex justify-center">
                    <Turnstile siteKey={TURNSTILE_SITE_KEY} onSuccess={setCaptchaToken} onError={() => setCaptchaToken('')} onExpire={() => setCaptchaToken('')} />
                  </div>

                  {error && (
                    <div className="px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm">{error}</div>
                  )}

                  <button type="submit" disabled={submitting}
                    className="w-full py-4 rounded-2xl bg-gradient-to-br from-blue-500 via-indigo-500 to-violet-600 hover:brightness-110 text-white font-bold text-base shadow-xl shadow-indigo-500/30 flex items-center justify-center gap-2 disabled:opacity-50 transition">
                    {submitting ? <><Loader2 className="w-5 h-5 animate-spin" /> {pm.sending}</> : <>{pm.submit} <ArrowRight className="w-5 h-5" /></>}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Simple footer */}
      <footer className="bg-slate-900 text-white py-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <p className="text-slate-300 text-sm mb-4">
            <a href="tel:+18069342018" className="inline-flex items-center gap-2 mr-4 hover:text-amber-400"><Phone className="w-4 h-4" /> (806) 934-2018</a>
            <a href="mailto:info@rosshouserentals.com" className="inline-flex items-center gap-2 hover:text-amber-400"><Mail className="w-4 h-4" /> info@rosshouserentals.com</a>
          </p>
          <p className="text-slate-500 text-xs max-w-2xl mx-auto leading-relaxed">{t.disclaimer.short}</p>
          <p className="text-slate-600 text-[10px] mt-4">© {new Date().getFullYear()} Ross House Rentals LLC</p>
        </div>
      </footer>
    </div>
  )
}
