'use client'

import { useState } from 'react'
import { Mail, Send, CheckCircle2, Sparkles } from 'lucide-react'
import { useLanguage } from '../i18n/LanguageContext'

const COPY = {
  es: {
    badge: 'NOTICIAS',
    title: 'Mantente al día 📬',
    subtitle: 'Suscríbete y sé el primero en enterarte de rentas disponibles, noticias y ofertas especiales en Dumas.',
    placeholder: 'Tu email...',
    cta: 'Suscribirme',
    success: '¡Listo! Te mantendremos al día 🎉',
    already: 'Ya estás suscrito 🙌',
    invalid: 'Ingresa un email válido',
    privacy: 'Sin spam. Puedes cancelar cuando quieras.',
  },
  en: {
    badge: 'NEWS',
    title: 'Stay in the loop 📬',
    subtitle: 'Subscribe and be the first to know about available rentals, news and special offers in Dumas.',
    placeholder: 'Your email...',
    cta: 'Subscribe',
    success: "Done! We'll keep you posted 🎉",
    already: "You're already subscribed 🙌",
    invalid: 'Enter a valid email',
    privacy: 'No spam. Unsubscribe anytime.',
  },
}

export default function NewsletterSection() {
  const { lang } = useLanguage() as any
  const isEs = (lang || 'es') === 'es'
  const t = isEs ? COPY.es : COPY.en
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'done'>('idle')
  const [msg, setMsg] = useState('')

  const subscribe = async () => {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email)) { setMsg(t.invalid); return }
    setStatus('sending'); setMsg('')
    try {
      const res = await fetch('/api/public/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source: 'section', lang: isEs ? 'es' : 'en' }),
      })
      const d = await res.json()
      if (res.ok) {
        setStatus('done')
        setMsg(d.already_subscribed ? t.already : t.success)
        try { localStorage.setItem('rhr_nl_subscribed', '1') } catch { /* noop */ }
      } else {
        setStatus('idle'); setMsg(d.detail || t.invalid)
      }
    } catch {
      setStatus('idle'); setMsg('Error — intenta de nuevo')
    }
  }

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-cyan-700 via-cyan-600 to-teal-600 py-14">
      <div className="absolute inset-0 opacity-10 pointer-events-none" style={{
        backgroundImage: 'radial-gradient(circle at 15% 40%, white 1.5px, transparent 1.5px), radial-gradient(circle at 85% 60%, white 1.5px, transparent 1.5px)',
        backgroundSize: '50px 50px, 70px 70px',
      }} />
      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 text-center">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 text-white text-[11px] font-black tracking-widest mb-4 ring-1 ring-white/25">
          <Sparkles className="w-3 h-3" /> {t.badge}
        </span>
        <h2 className="font-display text-2xl md:text-3xl font-bold text-white mb-2">{t.title}</h2>
        <p className="text-cyan-50/90 text-sm md:text-base max-w-xl mx-auto mb-6">{t.subtitle}</p>

        {status === 'done' ? (
          <div className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-white/15 backdrop-blur ring-1 ring-white/30 text-white font-semibold">
            <CheckCircle2 className="w-5 h-5 text-emerald-300" /> {msg}
          </div>
        ) : (
          <>
            <div className="flex flex-col sm:flex-row gap-3 max-w-lg mx-auto">
              <div className="relative flex-1">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-600" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && subscribe()}
                  placeholder={t.placeholder}
                  className="w-full pl-11 pr-4 py-3.5 rounded-2xl bg-white text-slate-800 text-sm font-medium focus:outline-none focus:ring-4 focus:ring-white/30 placeholder:text-slate-400"
                />
              </div>
              <button
                onClick={subscribe}
                disabled={status === 'sending'}
                className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-2xl bg-slate-900 text-white font-bold text-sm hover:bg-slate-800 hover:scale-[1.02] transition disabled:opacity-50 whitespace-nowrap"
              >
                {status === 'sending'
                  ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <Send className="w-4 h-4" />}
                {t.cta}
              </button>
            </div>
            {msg && <p className="text-amber-200 text-xs mt-3 font-medium">{msg}</p>}
            <p className="text-cyan-100/70 text-[11px] mt-4">{t.privacy}</p>
          </>
        )}
      </div>
    </section>
  )
}
