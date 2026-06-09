'use client'

import { motion } from 'framer-motion'
import { ArrowRight, MapPin, Shield, Star, Clock } from 'lucide-react'
import { useLanguage } from '../i18n/LanguageContext'
import Image from 'next/image'

export default function Hero() {
  const { t } = useLanguage()

  return (
    <section id="home" className="relative min-h-screen flex items-center overflow-hidden" aria-label="Página principal">
      {/* Background Image with Next.js Image Optimization */}
      <div className="absolute inset-0">
        <Image 
          src="https://images.pexels.com/photos/4469137/pexels-photo-4469137.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=1200&w=1920" 
          alt="Casas en renta en Dumas Texas - Ross House Rentals" 
          fill
          priority
          quality={85}
          sizes="100vw"
          className="object-cover"
          placeholder="blur"
          blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAIAAoDASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAAAAUH/8QAIhAAAgEDAwUBAAAAAAAAAAAAAQIDAAQRBRIhBhMUMUFR/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAZEQACAwEAAAAAAAAAAAAAAAABAgADERIh/9oADAMBAAIRAxEAPwDXdN1CG6ghub7T7O7d4wWV4wNrY9fKrXfj9Z+1KVJdiwJBn/Z//9k="
        />
        <div className="absolute inset-0 bg-gradient-to-r from-charcoal/90 via-charcoal/80 to-charcoal/60" aria-hidden="true"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" aria-hidden="true"></div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10 pt-20">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <motion.div 
            initial={{ opacity: 0, y: 40 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ duration: 0.8 }}
          >
            <motion.div 
              initial={{ opacity: 0, x: -20 }} 
              animate={{ opacity: 1, x: 0 }} 
              transition={{ delay: 0.2 }}
              className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-md border border-white/20 text-white px-4 py-2 rounded-full text-sm font-medium mb-6"
            >
              <MapPin className="w-4 h-4 text-primary" aria-hidden="true" /> 
              <span>{t.hero.badge}</span>
            </motion.div>

            <h1 className="font-display text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-6 leading-[1.1]">
              {t.hero.title1} <span className="text-primary">{t.hero.title2}</span>
            </h1>
            
            <p className="text-lg sm:text-xl text-white/85 mb-10 leading-relaxed max-w-xl">
              {t.hero.subtitle}
            </p>

            <div className="flex flex-col sm:flex-row gap-4 mb-12">
              <a 
                href="#properties"
                className="bg-primary hover:bg-primary-dark text-white px-8 py-4 rounded-2xl font-bold text-lg transition-all shadow-xl hover:shadow-2xl flex items-center justify-center gap-3 group focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-charcoal"
                aria-label="Ver propiedades disponibles"
              >
                {t.hero.cta1}
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" aria-hidden="true" />
              </a>
              <a 
                href="#apply"
                className="bg-white/10 hover:bg-white/20 backdrop-blur-sm border-2 border-white/30 text-white px-8 py-4 rounded-2xl font-bold text-lg transition-all flex items-center justify-center gap-3 focus:outline-none focus:ring-2 focus:ring-white/50"
                aria-label="Aplicar para alquilar"
              >
                {t.hero.cta2}
              </a>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 sm:gap-6" role="list" aria-label="Estadísticas de la empresa">
              {[
                { icon: Clock, value: '15+', label: t.hero.stat1 },
                { icon: Shield, value: '50+', label: t.hero.stat2 },
                { icon: Star, value: '200+', label: t.hero.stat3 },
              ].map(s => (
                <div key={s.label} className="text-center" role="listitem">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <s.icon className="w-4 h-4 text-primary" aria-hidden="true" />
                    <span className="font-display text-xl sm:text-2xl md:text-3xl font-bold text-white">{s.value}</span>
                  </div>
                  <span className="text-white/60 text-xs uppercase tracking-wider">{s.label}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Right Side Image */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }} 
            animate={{ opacity: 1, scale: 1 }} 
            transition={{ delay: 0.4, duration: 0.6 }}
            className="hidden lg:block"
          >
            <div className="relative">
              <div className="absolute -inset-4 bg-primary/20 rounded-3xl blur-2xl" aria-hidden="true"></div>
              <Image 
                src="https://images.pexels.com/photos/1396122/pexels-photo-1396122.jpeg?auto=compress&cs=tinysrgb&w=800" 
                alt="Casa disponible para alquiler en Dumas Texas"
                width={600}
                height={480}
                quality={85}
                className="relative rounded-3xl shadow-2xl w-full h-[480px] object-cover border-4 border-white/10"
                loading="eager"
                sizes="(max-width: 1024px) 0vw, 50vw"
              />
            </div>
          </motion.div>
        </div>
      </div>

      {/* Wave Divider */}
      <div className="absolute bottom-0 left-0 right-0" aria-hidden="true">
        <svg viewBox="0 0 1440 80" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full" preserveAspectRatio="none">
          <path d="M0 80L48 73.3C96 66.7 192 53.3 288 48C384 42.7 480 45.3 576 50.7C672 56 768 64 864 64C960 64 1056 56 1152 50.7C1248 45.3 1344 42.7 1392 41.3L1440 40V80H1392C1344 80 1248 80 1152 80C1056 80 960 80 864 80C768 80 672 80 576 80C480 80 384 80 288 80C192 80 96 80 48 80H0Z" fill="white"/>
        </svg>
      </div>
    </section>
  )
}
