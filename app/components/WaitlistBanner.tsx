'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Heart, ArrowRight, X, Sparkles, Bell } from 'lucide-react'
import { useLanguage } from '../i18n/LanguageContext'

const COPY = {
  es: {
    badge: 'NUEVO',
    title: '¿Buscas casa en Dumas?',
    subtitle: 'Únete a nuestra lista de espera y te avisaremos por email y SMS cuando tengamos una propiedad que coincida con tus criterios.',
    cta: 'Registrarme gratis',
    perks: ['📧 Alertas Email + SMS', '🎯 Match inteligente', '⚡ Acceso prioritario'],
    close: 'Cerrar',
  },
  en: {
    badge: 'NEW',
    title: 'Looking for a home in Dumas?',
    subtitle: "Join our waitlist and we'll alert you by email and SMS the moment a matching property opens.",
    cta: 'Sign up free',
    perks: ['📧 Email + SMS alerts', '🎯 Smart matching', '⚡ Priority access'],
    close: 'Dismiss',
  },
}

export default function WaitlistBanner() {
  const { lang } = useLanguage() as any
  const isEs = (lang || 'es') === 'es'
  const t = isEs ? COPY.es : COPY.en
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    try {
      const stored = localStorage.getItem('rhr_waitlist_banner_dismissed_v1')
      if (stored === '1') setDismissed(true)
    } catch { /* noop */ }
  }, [])

  const dismiss = () => {
    setDismissed(true)
    try { localStorage.setItem('rhr_waitlist_banner_dismissed_v1', '1') } catch { /* noop */ }
  }

  if (dismissed) return null

  return (
    <div className="relative overflow-hidden bg-gradient-to-r from-pink-600 via-fuchsia-600 to-purple-600 text-white shadow-lg">
      {/* Decorative pulse dots */}
      <div className="absolute inset-0 opacity-20 pointer-events-none" style={{
        backgroundImage: 'radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 30%, white 1px, transparent 1px)',
        backgroundSize: '40px 40px, 60px 60px',
      }} />
      {/* Shine animation */}
      <div className="absolute inset-y-0 -inset-x-1/2 bg-gradient-to-r from-transparent via-white/15 to-transparent animate-shine pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-3 md:py-4 flex items-center gap-3 md:gap-6">
        {/* Icon */}
        <div className="hidden md:flex w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm items-center justify-center flex-shrink-0 ring-1 ring-white/30">
          <Heart className="w-6 h-6 text-white fill-white/30" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white text-pink-600 text-[10px] font-black tracking-wider">
              <Sparkles className="w-2.5 h-2.5" /> {t.badge}
            </span>
            <h3 className="font-bold text-sm md:text-base leading-tight truncate">{t.title}</h3>
          </div>
          <p className="hidden sm:block text-white/90 text-xs md:text-sm leading-snug">{t.subtitle}</p>
          <div className="hidden lg:flex items-center gap-3 mt-1.5 text-[11px] text-white/85">
            {t.perks.map((p) => <span key={p}>{p}</span>)}
          </div>
        </div>

        {/* CTA */}
        <Link
          href={isEs ? '/interesados' : '/interesados/en'}
          className="inline-flex items-center gap-1.5 px-4 md:px-5 py-2 md:py-2.5 rounded-full bg-white text-pink-600 font-bold text-xs md:text-sm hover:scale-105 hover:shadow-xl transition flex-shrink-0 whitespace-nowrap"
        >
          <Bell className="w-3.5 h-3.5" />
          <span>{t.cta}</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>

        {/* Close */}
        <button
          aria-label={t.close}
          onClick={dismiss}
          className="text-white/70 hover:text-white p-1.5 rounded-full hover:bg-white/10 transition flex-shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes shine {
          from { transform: translateX(-50%); }
          to { transform: translateX(150%); }
        }
        .animate-shine {
          animation: shine 4s ease-in-out infinite;
        }
      `}} />
    </div>
  )
}
