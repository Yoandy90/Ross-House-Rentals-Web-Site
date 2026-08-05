'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Wrench, ArrowRight, X, Sparkles, Hammer } from 'lucide-react'
import { useLanguage } from '../i18n/LanguageContext'

const COPY = {
  es: {
    badge: 'ÚNETE',
    title: '¿Eres plomero, electricista o handyman?',
    subtitle: 'Regístrate gratis en nuestra red de proveedores. Te llamamos cuando tengamos trabajo en tu área.',
    cta: 'Registrarme como proveedor',
    perks: ['📞 Trabajos directos', '⚡ Pagos rápidos', '📄 Sin contrato'],
    close: 'Cerrar',
  },
  en: {
    badge: 'JOIN',
    title: 'Are you a plumber, electrician, or handyman?',
    subtitle: 'Sign up free in our provider network. We call you when we have work in your area.',
    cta: 'Register as provider',
    perks: ['📞 Direct jobs', '⚡ Fast payments', '📄 No contract'],
    close: 'Dismiss',
  },
}

export default function ProvidersBanner() {
  const { lang } = useLanguage() as any
  const isEs = (lang || 'es') === 'es'
  const t = isEs ? COPY.es : COPY.en
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    try {
      const stored = localStorage.getItem('rhr_providers_banner_dismissed_v1')
      if (stored === '1') setDismissed(true)
    } catch { /* noop */ }
  }, [])

  const dismiss = () => {
    setDismissed(true)
    try { localStorage.setItem('rhr_providers_banner_dismissed_v1', '1') } catch { /* noop */ }
  }

  if (dismissed) return null

  return (
    <div className="relative overflow-hidden bg-gradient-to-r from-amber-600 via-orange-600 to-red-600 text-white shadow-lg">
      <div className="absolute inset-0 opacity-20 pointer-events-none" style={{
        backgroundImage: 'radial-gradient(circle at 30% 50%, white 1px, transparent 1px), radial-gradient(circle at 70% 30%, white 1px, transparent 1px)',
        backgroundSize: '50px 50px, 70px 70px',
      }} />
      <div className="absolute inset-y-0 -inset-x-1/2 bg-gradient-to-r from-transparent via-white/15 to-transparent animate-shine-providers pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-3 md:py-4 flex items-center gap-3 md:gap-6">
        <div className="hidden md:flex w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm items-center justify-center flex-shrink-0 ring-1 ring-white/30">
          <Wrench className="w-6 h-6 text-white" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white text-amber-600 text-[10px] font-black tracking-wider">
              <Sparkles className="w-2.5 h-2.5" /> {t.badge}
            </span>
            <h3 className="font-bold text-sm md:text-base leading-tight truncate">{t.title}</h3>
          </div>
          <p className="hidden sm:block text-white/90 text-xs md:text-sm leading-snug">{t.subtitle}</p>
          <div className="hidden lg:flex items-center gap-3 mt-1.5 text-[11px] text-white/85">
            {t.perks.map((p) => <span key={p}>{p}</span>)}
          </div>
        </div>

        <Link
          href={isEs ? '/proveedores' : '/proveedores/en'}
          className="inline-flex items-center gap-1.5 px-4 md:px-5 py-2 md:py-2.5 rounded-full bg-white text-amber-600 font-bold text-xs md:text-sm hover:scale-105 hover:shadow-xl transition flex-shrink-0 whitespace-nowrap"
        >
          <Hammer className="w-3.5 h-3.5" />
          <span>{t.cta}</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>

        <button aria-label={t.close} onClick={dismiss}
          className="text-white/70 hover:text-white p-1.5 rounded-full hover:bg-white/10 transition flex-shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes shine-providers {
          from { transform: translateX(-50%); }
          to { transform: translateX(150%); }
        }
        .animate-shine-providers {
          animation: shine-providers 5s ease-in-out infinite;
          animation-delay: 2s;
        }
      `}} />
    </div>
  )
}
