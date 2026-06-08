'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Send, CheckCircle, Phone, Briefcase, DollarSign, Home, MessageSquare, Mail, User } from 'lucide-react'
import { useLanguage } from '../i18n/LanguageContext'

const API_URL = 'https://app-nueva-production.up.railway.app/api'

export default function Apply() {
  const { t } = useLanguage()
  const [form, setForm] = useState({ name: '', phone: '', email: '', employment: '', monthly_income: '', property_interest: '', message: '' })
  const [submitted, setSubmitted] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSending(true)
    setError('')
    try {
      const res = await fetch(`${API_URL}/public/rental-application`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      })
      const data = await res.json()
      if (data.success) setSubmitted(true)
      else setError(data.detail || 'Error')
    } catch {
      const subject = encodeURIComponent('Rental Application - ' + form.name)
      const body = encodeURIComponent(`Name: ${form.name}\nPhone: ${form.phone}\nEmail: ${form.email}`)
      window.open(`mailto:info@rosshouserentals.com?subject=${subject}&body=${body}`)
      setSubmitted(true)
    }
    setSending(false)
  }

  return (
    <section id="apply" className="py-24 bg-warm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
            <span className="text-primary font-semibold text-sm uppercase tracking-widest">{t.apply.badge}</span>
            <h2 className="font-display text-4xl md:text-5xl font-bold text-charcoal mt-3 mb-4">{t.apply.title}</h2>
            <p className="text-gray-500 text-lg mb-8">{t.apply.subtitle}</p>
            <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
              <p className="text-gray-500 mb-4">{t.apply.orCall}</p>
              <a href="tel:+18069342018" className="bg-primary hover:bg-primary-dark text-white px-6 py-3 rounded-xl font-bold transition-all inline-flex items-center gap-2">
                <Phone className="w-5 h-5" /> (806) 934-2018
              </a>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
            {submitted ? (
              <div className="bg-white rounded-3xl shadow-xl p-12 text-center border border-gray-100">
                <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
                  <CheckCircle className="w-10 h-10 text-green-500" />
                </div>
                <h3 className="font-display text-3xl font-bold text-charcoal mb-3">{t.apply.successTitle}</h3>
                <p className="text-gray-500 text-lg mb-6">{t.apply.successMsg.replace('{name}', form.name)}</p>
                <button onClick={() => { setSubmitted(false); setForm({ name: '', phone: '', email: '', employment: '', monthly_income: '', property_interest: '', message: '' }) }}
                  className="text-primary hover:text-primary-dark font-semibold">{t.apply.successAnother}</button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100 space-y-5">
                {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">{error}</div>}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5"><User className="w-3 h-3 inline mr-1" />{t.apply.fullName} *</label>
                    <input required value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder={t.apply.placeholders.name}
                      className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5"><Phone className="w-3 h-3 inline mr-1" />{t.apply.phone} *</label>
                    <input required value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} placeholder={t.apply.placeholders.phone}
                      className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5"><Mail className="w-3 h-3 inline mr-1" />{t.apply.email}</label>
                  <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder={t.apply.placeholders.email}
                    className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5"><Briefcase className="w-3 h-3 inline mr-1" />{t.apply.employer}</label>
                    <input value={form.employment} onChange={e => setForm({...form, employment: e.target.value})} placeholder={t.apply.placeholders.employer}
                      className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5"><DollarSign className="w-3 h-3 inline mr-1" />{t.apply.income}</label>
                    <input value={form.monthly_income} onChange={e => setForm({...form, monthly_income: e.target.value})} placeholder={t.apply.placeholders.income}
                      className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5"><Home className="w-3 h-3 inline mr-1" />{t.apply.propertyInterest}</label>
                  <input value={form.property_interest} onChange={e => setForm({...form, property_interest: e.target.value})} placeholder={t.apply.placeholders.property}
                    className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5"><MessageSquare className="w-3 h-3 inline mr-1" />{t.apply.message}</label>
                  <textarea value={form.message} onChange={e => setForm({...form, message: e.target.value})} rows={3} placeholder={t.apply.placeholders.message}
                    className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all resize-none" />
                </div>
                <button type="submit" disabled={sending}
                  className="w-full bg-primary hover:bg-primary-dark text-white py-4 rounded-2xl font-bold text-lg transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2 disabled:opacity-50">
                  {sending ? t.apply.sending : <><Send className="w-5 h-5" /> {t.apply.submit}</>}
                </button>
              </form>
            )}
          </motion.div>
        </div>
      </div>
    </section>
  )
}
