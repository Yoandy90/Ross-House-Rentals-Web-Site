'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Bed, Bath, Square, MapPin, ArrowRight, Loader2 } from 'lucide-react'
import { useLanguage } from '../i18n/LanguageContext'
import Image from 'next/image'

interface Property {
  _id: string
  address: string
  city: string
  state: string
  bedrooms: number
  bathrooms: number
  square_feet: number
  rent_amount: number
  status: string
  photos?: { url: string; category: string }[]
}

export default function Properties() {
  const { t } = useLanguage()
  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchProperties = async () => {
      try {
        const res = await fetch('/api/public/properties?status=available&limit=6')
        if (res.ok) {
          const data = await res.json()
          setProperties(data.properties || [])
        }
      } catch (e) {
        console.error('Error fetching properties:', e)
      } finally {
        setLoading(false)
      }
    }
    fetchProperties()
  }, [])

  const formatPrice = (price: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(price)

  // Fallback properties if API fails
  const fallbackProperties = [
    { _id: '1', address: '812 NE 2nd', city: 'Dumas', state: 'TX', bedrooms: 2, bathrooms: 1, square_feet: 965, rent_amount: 1200, status: 'available', photos: [] },
    { _id: '2', address: '121 Oak Ave', city: 'Dumas', state: 'TX', bedrooms: 2, bathrooms: 2, square_feet: 1100, rent_amount: 1100, status: 'available', photos: [] },
  ]

  const displayProperties = properties.length > 0 ? properties : fallbackProperties

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

        {/* Properties Grid */}
        {loading ? (
          <div className="flex justify-center items-center py-20" aria-label="Cargando propiedades">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8" role="list" aria-label="Lista de propiedades disponibles">
            {displayProperties.slice(0, 6).map((property, index) => (
              <motion.article
                key={property._id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="group bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 border border-gray-100"
                role="listitem"
              >
                {/* Property Image */}
                <div className="relative h-56 overflow-hidden">
                  <Image
                    src={property.photos?.[0]?.url || 'https://images.pexels.com/photos/1396122/pexels-photo-1396122.jpeg?auto=compress&cs=tinysrgb&w=600'}
                    alt={`Casa en renta en ${property.address}, ${property.city}, ${property.state}`}
                    fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                    loading={index < 3 ? 'eager' : 'lazy'}
                  />
                  <div className="absolute top-4 left-4">
                    <span className="bg-primary text-white px-3 py-1 rounded-full text-sm font-semibold">
                      {formatPrice(property.rent_amount)}/mes
                    </span>
                  </div>
                </div>

                {/* Property Info */}
                <div className="p-6">
                  <div className="flex items-center gap-2 text-gray-500 text-sm mb-3">
                    <MapPin className="w-4 h-4 text-primary" aria-hidden="true" />
                    <address className="not-italic">
                      {property.address}, {property.city}, {property.state}
                    </address>
                  </div>

                  {/* Features */}
                  <div className="flex items-center gap-4 text-sm text-gray-600 mb-4" role="list" aria-label="Características de la propiedad">
                    <div className="flex items-center gap-1" role="listitem">
                      <Bed className="w-4 h-4" aria-hidden="true" />
                      <span>{property.bedrooms} {property.bedrooms === 1 ? 'Hab' : 'Habs'}</span>
                    </div>
                    <div className="flex items-center gap-1" role="listitem">
                      <Bath className="w-4 h-4" aria-hidden="true" />
                      <span>{property.bathrooms} {property.bathrooms === 1 ? 'Baño' : 'Baños'}</span>
                    </div>
                    {property.square_feet > 0 && (
                      <div className="flex items-center gap-1" role="listitem">
                        <Square className="w-4 h-4" aria-hidden="true" />
                        <span>{property.square_feet.toLocaleString()} ft²</span>
                      </div>
                    )}
                  </div>

                  <a 
                    href="#apply" 
                    className="w-full bg-charcoal hover:bg-charcoal/90 text-white py-3 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2 group/btn focus:outline-none focus:ring-2 focus:ring-primary"
                    aria-label={`Aplicar para alquilar ${property.address}`}
                  >
                    Aplicar Ahora
                    <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" aria-hidden="true" />
                  </a>
                </div>
              </motion.article>
            ))}
          </div>
        )}

        {/* View All Button */}
        <motion.div 
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center mt-12"
        >
          <a 
            href="/admin" 
            className="inline-flex items-center gap-2 text-primary hover:text-primary-dark font-semibold text-lg transition-colors focus:outline-none focus:ring-2 focus:ring-primary rounded-lg px-4 py-2"
            aria-label="Ver todas las propiedades disponibles"
          >
            Ver Todas las Propiedades
            <ArrowRight className="w-5 h-5" aria-hidden="true" />
          </a>
        </motion.div>
      </div>
    </section>
  )
}
