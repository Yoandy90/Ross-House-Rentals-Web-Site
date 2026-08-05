'use client'

import { useState, useEffect, useCallback } from 'react'
import { Mail, Send, CheckCircle2, X, Bell, Home } from 'lucide-react'
import { useLanguage } from '../i18n/LanguageContext'

const COPY = {
  es: {
    title: '¡No te pierdas nada! 🏡',
    subtitle: 'Suscríbete gratis y entérate primero de rentas disponibles, noticias y ofertas en Dumas, TX.',
    placeholder: 'Tu email...',
    cta: 'Suscribirme gratis',
    success: '¡Listo! Te mantendremos al día 🎉',
    already: 'Ya estás suscrito 🙌',
    invalid: 'Ingresa un email válido',
    later: 'Quizás después',
    privacy: 'Sin spam · Cancela cuando quieras',
  },
  en: {
    title: "Don't miss out! 🏡",
    subtitle: 'Subscribe free and be the first to know about available rentals, news and offers in Dumas, TX.',
    placeholder: 'Your email...',
    cta: 'Subscribe free',
    success: "Done! We'll keep you posted 🎉",
    already: "You're already subscribed 🙌",
    invalid: 'Enter a valid email',
    later: 'Maybe later',
    privacy: 'No spam · Unsubscribe anytime',
  },
}

// Visitor logic:
//  - rhr_nl_subscribed = '1'      → NEVER show (already a subscriber)
//  - rhr_nl_dismissed_at          → don't show again for 30 days (returning visitor, not interested)
//  - sessionStorage guard         → max once per browsing session
//  - 12s delay                    → don't interrupt immediately
const DISMISS_DAYS = 30
const SHOW_DELAY_MS = 12000

export default function NewsletterModal() {
  const { lang } = useLanguage() as any
  const isEs = (lang || 'es') === 'es'
  const t = isEs ? COPY.es : COPY.en

  const [visible, setVisible] = useState(false)
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'done'>('idle')
  const [msg, setMsg] = useState('')

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null
    try {
      if (localStorage.getItem('rhr_nl_subscribed') === '1') return
      if (sessionStorage.getItem('rhr_nl_shown_session') === '1') return
      const dismissedAt = parseInt(localStorage.getItem('rhr_nl_dismissed_at') || '0', 10)
      if (dismissedAt && Date.now() - dismissedAt < DISMISS_DAYS * 24 * 60 * 60 * 1000) return

      timer = setTimeout(() => {
        setVisible(true)
        try { sessionStorage.setItem('rhr_nl_shown_session', '1') } catch { /* noop */ }
      }, SHOW_DELAY_MS)
    } catch { /* noop */ }
    return () => { if (timer) clearTimeout(timer) }
  }, [])

  const dismiss = useCallback(() => {
    setVisible(false)
    try { localStorage.setItem('rhr_nl_dismissed_at', String(Date.now())) } catch { /* noop */ }
  }, [])

  const subscribe = async () => {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email)) { setMsg(t.invalid); return }
    setStatus('sending'); setMsg('')
    try {
      const res = await fetch('/api/public/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source: 'modal', lang: isEs ? 'es' : 'en' }),
      })
      const d = await res.json()
      if (res.ok) {
        setStatus('done')
        setMsg(d.already_subscribed ? t.already : t.success)
        try { localStorage.setItem('rhr_nl_subscribed', '1') } catch { /* noop */ }
        setTimeout(() => setVisible(false), 2500)
      } else {
        setStatus('idle'); setMsg(d.detail || t.invalid)
      }
    } catch {
      setStatus('idle'); setMsg('Error — intenta de nuevo')
    }
  }

  if (!visible) return null

  return (
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={dismiss} />

      {/* Card */}
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden animate-nl-pop">
        {/* Header */}
        <div className="relative bg-gradient-to-br from-cyan-600 via-cyan-500 to-teal-500 px-6 pt-7 pb-9 text-center">
          <button
            aria-label={t.later}
            onClick={dismiss}
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/15 hover:bg-white/30 flex items-center justify-center text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="w-14 h-14 mx-auto rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center ring-1 ring-white/30 mb-3">
            <Bell className="w-7 h-7 text-white" />
          </div>
          <h3 className="text-white font-bold text-xl leading-tight">{t.title}</h3>
        </div>

        {/* Body */}
        <div className="px-6 pt-5 pb-6 -mt-4 relative">
          <div className="bg-white rounded-2xl">
            <p className="text-slate-500 text-sm text-center leading-relaxed mb-5">{t.subtitle}</p>

            {status === 'done' ? (
              <div className="flex items-center justify-center gap-2 py-4 text-emerald-600 font-semibold text-sm">
                <CheckCircle2 className="w-5 h-5" /> {msg}
              </div>
            ) : (
              <>
                <div className="relative mb-3">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && subscribe()}
                    placeholder={t.placeholder}
                    className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 placeholder:text-slate-400"
                  />
                </div>
                {msg && <p className="text-red-500 text-xs mb-2 text-center font-medium">{msg}</p>}
                <button
                  onClick={subscribe}
                  disabled={status === 'sending'}
                  className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-cyan-600 to-teal-600 text-white font-bold text-sm hover:opacity-90 transition disabled:opacity-50"
                >
                  {status === 'sending'
                    ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    : <Send className="w-4 h-4" />}
                  {t.cta}
                </button>
                <button onClick={dismiss} className="w-full text-center text-slate-400 hover:text-slate-600 text-xs mt-3 transition">
                  {t.later}
                </button>
                <p className="flex items-center justify-center gap-1 text-slate-400 text-[10px] mt-3">
                  <Home className="w-3 h-3" /> {t.privacy}
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes nl-pop {
          from { opacity: 0; transform: translateY(24px) scale(.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .animate-nl-pop { animation: nl-pop .35s cubic-bezier(.16,1,.3,1); }
      `}} />
    </div>
  )
}
