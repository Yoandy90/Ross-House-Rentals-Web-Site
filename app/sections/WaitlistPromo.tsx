'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Heart, Bell, Sparkles, ArrowRight, Mail, Phone, Target, Zap } from 'lucide-react'
import { useLanguage } from '../i18n/LanguageContext'

const COPY = {
  es: {
    eyebrow: 'Lista de espera',
    title: '¿Buscas tu próxima casa en Dumas?',
    subtitle: 'Únete a nuestra lista de espera y serás el primero en enterarte cuando una propiedad coincida con tus criterios. Sin costo, sin compromiso.',
    cta: 'Registrarme gratis',
    secondaryCta: 'Saber más',
    features: [
      { icon: Bell, title: 'Alertas instantáneas', desc: 'Te avisamos por email y SMS cuando hay disponibilidad' },
      { icon: Target, title: 'Match inteligente', desc: 'Te emparejamos con propiedades según tus criterios' },
      { icon: Zap, title: 'Acceso prioritario', desc: 'Conoce nuevas casas antes que el público general' },
    ],
    badge: 'GRATIS · 100% Sin compromiso',
    stat1: { num: '50+', label: 'Familias en cola' },
    stat2: { num: '< 24h', label: 'Tiempo respuesta' },
    stat3: { num: 'GRATIS', label: 'Siempre' },
  },
  en: {
    eyebrow: 'Tenant Waitlist',
    title: 'Looking for your next home in Dumas?',
    subtitle: 'Join our waitlist and be the first to know when a property matches your criteria. No cost, no commitment.',
    cta: 'Sign up free',
    secondaryCta: 'Learn more',
    features: [
      { icon: Bell, title: 'Instant alerts', desc: 'We notify you by email and SMS when units open up' },
      { icon: Target, title: 'Smart matching', desc: 'We match you with properties based on your criteria' },
      { icon: Zap, title: 'Priority access', desc: 'See new homes before the general public' },
    ],
    badge: 'FREE · 100% No commitment',
    stat1: { num: '50+', label: 'Families queued' },
    stat2: { num: '< 24h', label: 'Response time' },
    stat3: { num: 'FREE', label: 'Always' },
  },
}

export default function WaitlistPromo() {
  const { lang } = useLanguage() as any
  const isEs = (lang || 'es') === 'es'
  const t = isEs ? COPY.es : COPY.en

  return (
    <section className="relative py-20 md:py-28 overflow-hidden bg-gradient-to-br from-pink-50 via-fuchsia-50 to-purple-50">
      {/* Decorative blobs */}
      <div aria-hidden className="absolute -top-20 -left-20 w-80 h-80 bg-pink-300/30 rounded-full blur-3xl pointer-events-none" />
      <div aria-hidden className="absolute -bottom-32 -right-20 w-96 h-96 bg-purple-300/30 rounded-full blur-3xl pointer-events-none" />
      <div aria-hidden className="absolute top-40 left-1/3 w-60 h-60 bg-fuchsia-300/20 rounded-full blur-3xl pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left content */}
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-pink-500/10 to-purple-500/10 border border-pink-500/30 text-pink-700 text-xs font-bold tracking-wider uppercase mb-6">
              <Heart className="w-3.5 h-3.5 fill-pink-500 text-pink-500" />
              {t.eyebrow}
            </div>
            <h2 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-charcoal leading-[1.1] mb-6">
              {t.title}
            </h2>
            <p className="text-lg text-gray-600 leading-relaxed mb-8 max-w-xl">{t.subtitle}</p>

            {/* Features grid */}
            <div className="space-y-4 mb-10">
              {t.features.map((f, i) => {
                const Ic = f.icon
                return (
                  <div key={i} className="flex items-start gap-4 group">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center shadow-lg shadow-pink-500/30 flex-shrink-0 group-hover:scale-110 transition-transform">
                      <Ic className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <div className="font-bold text-charcoal text-base mb-0.5">{f.title}</div>
                      <div className="text-gray-600 text-sm leading-relaxed">{f.desc}</div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                href={isEs ? '/interesados' : '/interesados/en'}
                className="inline-flex items-center justify-center gap-2 px-7 py-4 rounded-2xl bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-bold shadow-xl shadow-pink-500/30 hover:shadow-2xl hover:scale-[1.02] transition group"
              >
                <Sparkles className="w-4 h-4" />
                {t.cta}
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
              <a
                href="tel:+18069342018"
                className="inline-flex items-center justify-center gap-2 px-7 py-4 rounded-2xl bg-white border-2 border-pink-200 hover:border-pink-500 text-pink-600 font-bold transition hover:scale-[1.02]"
              >
                <Phone className="w-4 h-4" />
                (806) 934-2018
              </a>
            </div>

            <div className="mt-6 inline-flex items-center gap-2 text-xs text-pink-700 font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              {t.badge}
            </div>
          </div>

          {/* Right visual */}
          <div className="relative">
            <div className="relative aspect-square max-w-[500px] mx-auto">
              {/* Card stack */}
              <div className="absolute inset-0 bg-gradient-to-br from-pink-500 via-fuchsia-500 to-purple-600 rounded-[3rem] rotate-[-4deg] shadow-2xl" />
              <div className="absolute inset-0 bg-white rounded-[3rem] rotate-[2deg] shadow-2xl border border-pink-100 overflow-hidden">
                <Image
                  src="https://images.pexels.com/photos/1571460/pexels-photo-1571460.jpeg?auto=compress&cs=tinysrgb&w=800"
                  alt={isEs ? 'Familia feliz mudándose' : 'Happy family moving in'}
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />

                {/* Floating notification card */}
                <div className="absolute top-6 left-6 bg-white/95 backdrop-blur-sm rounded-2xl px-4 py-3 shadow-xl flex items-center gap-3 max-w-[240px]">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                    <Mail className="w-5 h-5 text-white" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Email + SMS</div>
                    <div className="text-xs font-bold text-charcoal truncate">
                      {isEs ? '¡Casa disponible cerca de ti!' : 'A new home is available!'}
                    </div>
                  </div>
                </div>

                {/* Bottom stats */}
                <div className="absolute bottom-0 left-0 right-0 p-6">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    {[t.stat1, t.stat2, t.stat3].map((s, i) => (
                      <div key={i} className="bg-white/95 backdrop-blur-sm rounded-2xl px-2 py-2.5 shadow-lg">
                        <div className="font-display text-lg md:text-xl font-bold bg-gradient-to-br from-pink-500 to-purple-600 bg-clip-text text-transparent">{s.num}</div>
                        <div className="text-[9px] md:text-[10px] uppercase tracking-wider text-gray-600 font-semibold">{s.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
