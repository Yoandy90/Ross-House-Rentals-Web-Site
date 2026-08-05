'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, Loader2, Home as HomeIcon, Bell, Sparkles } from 'lucide-react'
import { useLanguage } from '../i18n/LanguageContext'
import PropertyCard, { PropertyListItem } from '../components/PropertyCard'
import Link from 'next/link'

export default function Properties() {
  const { t } = useLanguage()
  const [properties, setProperties] = useState<PropertyListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchFailed, setFetchFailed] = useState(false)

  useEffect(() => {
    const fetchProperties = async () => {
      try {
        const res = await fetch('/api/public/properties')
        if (res.ok) {
          const data = await res.json()
          // Only show available + limit 6 on home page
          const available = (data.properties || []).filter(
            (p: PropertyListItem) => p.status === 'available'
          ).slice(0, 6)
          setProperties(available)
        } else {
          setFetchFailed(true)
        }
      } catch (e) {
        console.error('Error fetching properties:', e)
        setFetchFailed(true)
      } finally {
        setLoading(false)
      }
    }
    fetchProperties()
  }, [])

  const noAvailability = !loading && !fetchFailed && properties.length === 0

  return (
    <section id="properties" className="py-20 bg-white" aria-labelledby="properties-heading">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="inline-block bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-semibold mb-4">
            {t.properties?.badge || 'Propiedades Disponibles'}
          </span>
          <h2 id="properties-heading" className="font-display text-4xl md:text-5xl font-bold text-charcoal mb-4">
            {t.properties?.title || 'Encuentra Tu Hogar Ideal'}
          </h2>
          <p className="text-gray-600 text-lg max-w-2xl mx-auto">
            {t.properties?.subtitle || 'Casas de calidad disponibles para alquiler en Dumas, Texas'}
          </p>
        </motion.div>

        {/* States */}
        {loading ? (
          <div className="flex justify-center items-center py-20" aria-label="Cargando propiedades">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : noAvailability ? (
          // ─── Elegant "no availability" CTA ────────────────────────────────
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/5 via-white to-amber-50/40 border border-primary/20 p-8 md:p-12 text-center max-w-3xl mx-auto shadow-xl"
          >
            {/* Ambient orbs */}
            <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-20 -left-20 w-64 h-64 rounded-full bg-amber-200/30 blur-3xl pointer-events-none" />

            <div className="relative">
              <div className="inline-flex w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary-dark items-center justify-center mb-5 shadow-lg shadow-primary/30">
                <HomeIcon className="w-8 h-8 text-white" />
              </div>
              <h3 className="font-display text-2xl md:text-3xl font-bold text-charcoal mb-3">
                {t.properties?.noAvailabilityTitle || 'No hay disponibilidad en este momento'}
              </h3>
              <p className="text-gray-600 md:text-lg max-w-xl mx-auto mb-8 leading-relaxed">
                {t.properties?.noAvailabilityBody ||
                  'Nuestras casas se rentan rápidamente. Únete a la lista de espera y serás el primero en enterarte cuando se libere una que se ajuste a lo que buscas.'}
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link
                  href="/interesados"
                  className="group inline-flex items-center gap-2 bg-primary hover:bg-primary-dark text-white font-semibold px-6 py-3.5 rounded-xl shadow-lg hover:shadow-xl transition-all focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                >
                  <Bell className="w-5 h-5" />
                  {t.properties?.joinWaitlist || 'Únete a la lista de espera'}
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link
                  href="/#contact"
                  className="inline-flex items-center gap-2 text-charcoal hover:text-primary font-semibold px-6 py-3.5 rounded-xl border border-gray-200 hover:border-primary bg-white transition-all"
                >
                  <Sparkles className="w-4 h-4" />
                  {t.properties?.contactUs || 'Contáctanos'}
                </Link>
              </div>

              <p className="text-xs text-gray-500 mt-6">
                {t.properties?.avgWait ||
                  '⚡ La mayoría de nuestros inquilinos son contactados dentro de 30 días.'}
              </p>
            </div>
          </motion.div>
        ) : fetchFailed ? (
          <div className="text-center py-12">
            <p className="text-gray-500 mb-4">No pudimos cargar las propiedades ahora mismo.</p>
            <button
              onClick={() => window.location.reload()}
              className="text-primary font-semibold underline"
            >
              Reintentar
            </button>
          </div>
        ) : (
          <>
            <div
              className="grid md:grid-cols-2 lg:grid-cols-3 gap-8"
              role="list"
              aria-label="Lista de propiedades disponibles"
            >
              {properties.slice(0, 6).map((property, index) => (
                <PropertyCard key={property.id} property={property} index={index} priority={index < 3} />
              ))}
            </div>

            {/* View All Button — only if we have available properties */}
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="text-center mt-12"
            >
              <Link
                href="/propiedades"
                className="inline-flex items-center gap-2 bg-primary hover:bg-primary-dark text-white font-semibold text-lg transition-colors px-8 py-3.5 rounded-xl shadow-lg hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-primary"
                aria-label="Ver todas las propiedades disponibles"
              >
                Ver Todas las Propiedades
                <ArrowRight className="w-5 h-5" aria-hidden="true" />
              </Link>
            </motion.div>
          </>
        )}
      </div>
    </section>
  )
}
