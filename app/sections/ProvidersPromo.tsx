'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Wrench, Hammer, Sparkles, ArrowRight, Phone, Briefcase, DollarSign, Shield, Zap } from 'lucide-react'
import { useLanguage } from '../i18n/LanguageContext'

const COPY = {
  es: {
    eyebrow: 'Red de proveedores',
    title: '¿Eres contratista en Dumas? Únete a nuestra red',
    subtitle: 'Plomeros, electricistas, jardineros, pintores, albañiles, handyman y más. Te enviamos trabajos directamente cuando los necesitemos. Sin contrato. Sin comisiones.',
    cta: 'Registrarme como proveedor',
    secondaryCta: '(806) 934-2018',
    features: [
      { icon: Briefcase, title: 'Trabajos directos', desc: 'Te llamamos cuando tenemos un trabajo que coincide con tus servicios y zona' },
      { icon: DollarSign, title: 'Pagos rápidos', desc: 'Cobra al terminar — efectivo, cheque, Zelle, CashApp o transferencia' },
      { icon: Shield, title: 'Sin contrato', desc: 'Registro 100% gratis, sin compromiso. Decides qué trabajos tomar' },
      { icon: Zap, title: 'Crece tu negocio', desc: 'Conectamos con decenas de propiedades en Dumas y Amarillo' },
    ],
    badge: 'GRATIS · Para profesionales locales',
    types: ['🔧 Plomeros', '⚡ Electricistas', '🌱 Jardineros', '🎨 Pintores', '🧱 Albañiles', '🛠️ Handyman'],
  },
  en: {
    eyebrow: 'Provider Network',
    title: 'Are you a contractor in Dumas? Join our network',
    subtitle: 'Plumbers, electricians, gardeners, painters, masons, handyman and more. We send jobs directly to you when we need them. No contract. No commissions.',
    cta: 'Register as a provider',
    secondaryCta: '(806) 934-2018',
    features: [
      { icon: Briefcase, title: 'Direct jobs', desc: 'We call you when we have a job matching your services and area' },
      { icon: DollarSign, title: 'Fast payments', desc: 'Get paid when the job is done — cash, check, Zelle, CashApp or wire' },
      { icon: Shield, title: 'No contract', desc: 'Sign up free, no commitment. You choose which jobs to take' },
      { icon: Zap, title: 'Grow your business', desc: 'Connect with dozens of properties in Dumas and Amarillo' },
    ],
    badge: 'FREE · For local professionals',
    types: ['🔧 Plumbers', '⚡ Electricians', '🌱 Gardeners', '🎨 Painters', '🧱 Masons', '🛠️ Handyman'],
  },
}

export default function ProvidersPromo() {
  const { lang } = useLanguage() as any
  const isEs = (lang || 'es') === 'es'
  const t = isEs ? COPY.es : COPY.en

  return (
    <section className="relative py-20 md:py-28 overflow-hidden bg-gradient-to-br from-[#0d1a2e] via-[#1a2942] to-[#070B14] text-white">
      {/* Decorative blobs */}
      <div aria-hidden className="absolute -top-32 -right-32 w-96 h-96 bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />
      <div aria-hidden className="absolute -bottom-32 -left-32 w-96 h-96 bg-orange-500/20 rounded-full blur-3xl pointer-events-none" />
      <div aria-hidden className="absolute top-1/3 left-1/2 w-64 h-64 bg-yellow-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Grid pattern */}
      <div aria-hidden className="absolute inset-0 opacity-[0.04] pointer-events-none" style={{
        backgroundImage: 'linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)',
        backgroundSize: '40px 40px',
      }} />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left visual */}
          <div className="relative order-2 lg:order-1">
            <div className="relative aspect-square max-w-[500px] mx-auto">
              {/* Glow */}
              <div className="absolute inset-0 bg-gradient-to-br from-amber-500 via-orange-500 to-red-500 rounded-[3rem] rotate-[3deg] blur-2xl opacity-50" />
              {/* Tilted card behind */}
              <div className="absolute inset-0 bg-gradient-to-br from-amber-400 to-orange-500 rounded-[3rem] rotate-[-3deg] shadow-2xl" />
              {/* Main image card */}
              <div className="absolute inset-0 bg-[#1a2942] rounded-[3rem] rotate-[1deg] shadow-2xl border border-amber-500/20 overflow-hidden">
                <Image
                  src="https://images.pexels.com/photos/8961065/pexels-photo-8961065.jpeg?auto=compress&cs=tinysrgb&w=800"
                  alt={isEs ? 'Contratista profesional con herramientas' : 'Professional contractor with tools'}
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

                {/* Floating job notification */}
                <div className="absolute top-6 left-6 right-6 bg-white/95 backdrop-blur-md rounded-2xl p-4 shadow-2xl">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center flex-shrink-0">
                      <Wrench className="w-5 h-5 text-white" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[10px] text-amber-700 uppercase tracking-wider font-bold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                        {isEs ? 'Nuevo trabajo' : 'New job'}
                      </div>
                      <div className="text-sm font-bold text-charcoal truncate">
                        {isEs ? 'Plomería · 1234 N Maple' : 'Plumbing · 1234 N Maple'}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-base font-black text-amber-600">$120</div>
                      <div className="text-[9px] text-gray-500 uppercase font-bold">est.</div>
                    </div>
                  </div>
                </div>

                {/* Service chips */}
                <div className="absolute bottom-6 left-6 right-6">
                  <div className="grid grid-cols-3 gap-2">
                    {t.types.slice(0, 6).map((tp, i) => (
                      <div key={i} className="bg-white/15 backdrop-blur-sm border border-white/20 rounded-xl px-2 py-1.5 text-center text-[10px] md:text-[11px] font-semibold text-white">
                        {tp}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right content */}
          <div className="order-1 lg:order-2">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/40 text-amber-300 text-xs font-bold tracking-wider uppercase mb-6">
              <Hammer className="w-3.5 h-3.5" />
              {t.eyebrow}
            </div>
            <h2 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold leading-[1.1] mb-6">
              {t.title}
            </h2>
            <p className="text-lg text-gray-300 leading-relaxed mb-8 max-w-xl">{t.subtitle}</p>

            {/* Features 2-col grid */}
            <div className="grid sm:grid-cols-2 gap-4 mb-10">
              {t.features.map((f, i) => {
                const Ic = f.icon
                return (
                  <div key={i} className="p-5 rounded-2xl bg-white/[0.05] border border-white/10 hover:bg-white/[0.08] hover:border-amber-500/30 transition group">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/30 mb-3 group-hover:scale-110 transition-transform">
                      <Ic className="w-4 h-4 text-white" />
                    </div>
                    <div className="font-bold text-white text-sm mb-1">{f.title}</div>
                    <div className="text-slate-300 text-xs leading-relaxed">{f.desc}</div>
                  </div>
                )
              })}
            </div>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                href={isEs ? '/proveedores' : '/proveedores/en'}
                className="inline-flex items-center justify-center gap-2 px-7 py-4 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-bold shadow-xl shadow-amber-500/30 hover:shadow-2xl hover:scale-[1.02] transition group"
              >
                <Sparkles className="w-4 h-4" />
                {t.cta}
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
              <a
                href="tel:+18069342018"
                className="inline-flex items-center justify-center gap-2 px-7 py-4 rounded-2xl bg-white/10 hover:bg-white/20 border-2 border-amber-500/30 hover:border-amber-500 text-white font-bold transition hover:scale-[1.02]"
              >
                <Phone className="w-4 h-4" />
                {t.secondaryCta}
              </a>
            </div>

            <div className="mt-6 inline-flex items-center gap-2 text-xs text-amber-300 font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              {t.badge}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
