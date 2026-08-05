'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Bed, Bath, Square, MapPin, ArrowRight, Star } from 'lucide-react'
import { motion } from 'framer-motion'

export interface PropertyListItem {
  id: string
  address: string
  city: string
  state: string
  zip_code?: string
  property_type?: string
  bedrooms: number
  bathrooms: number
  square_feet?: number
  rent_amount: number
  sale_price?: number
  listing_type?: string
  status: string
  photos?: string[]
  photo_count?: number
  section8_accepted?: boolean
  features?: string[]
  created_at?: string
  // For "Recién listada" badge - if created within 14 days
  isNew?: boolean
  isPetFriendly?: boolean
}

interface PropertyCardProps {
  property: PropertyListItem
  index?: number
  priority?: boolean
  showStatus?: boolean
}

export default function PropertyCard({ property, index = 0, priority = false, showStatus = true }: PropertyCardProps) {
  const formatPrice = (price: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(price)

  const slug = property.id
  const isRented = property.status === 'rented'
  const isMaintenance = property.status === 'maintenance'
  const isAvailable = property.status === 'available'

  // Detect pet-friendly from features
  const features = property.features || []
  const isPetFriendly = property.isPetFriendly ?? features.some((f) => /pet|mascota|gato|perro|dog|cat/i.test(f))
  const isNew = property.isNew ?? (property.created_at ? (Date.now() - new Date(property.created_at).getTime()) < 14 * 24 * 60 * 60 * 1000 : false)

  const photoUrl = property.photos?.[0] || 'https://images.pexels.com/photos/1396122/pexels-photo-1396122.jpeg?auto=compress&cs=tinysrgb&w=600'

  return (
    <motion.article
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ delay: Math.min(index * 0.05, 0.3) }}
      className="group bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 border border-gray-100 flex flex-col"
      role="listitem"
    >
      <Link href={`/propiedades/${slug}`} className="block focus:outline-none focus:ring-2 focus:ring-primary rounded-2xl" aria-label={`Ver detalles de ${property.address}`}>
        {/* Property Image */}
        <div className="relative h-56 overflow-hidden">
          <Image
            src={photoUrl}
            alt={`Casa en renta en ${property.address}, ${property.city}, ${property.state}`}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover group-hover:scale-105 transition-transform duration-500"
            loading={priority ? 'eager' : 'lazy'}
            priority={priority}
          />

          {/* Price badge */}
          <div className="absolute top-4 left-4">
            <span className="bg-primary text-white px-3 py-1.5 rounded-full text-sm font-bold shadow-md">
              {formatPrice(property.rent_amount)}<span className="text-xs opacity-90">/mes</span>
            </span>
          </div>

          {/* Status / type badges */}
          <div className="absolute top-4 right-4 flex flex-col gap-1.5 items-end">
            {showStatus && isRented && (
              <span className="bg-gray-900/85 text-white px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wide">
                Rentada
              </span>
            )}
            {showStatus && isMaintenance && (
              <span className="bg-amber-500 text-white px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wide">
                Mantenimiento
              </span>
            )}
            {isAvailable && isNew && (
              <span className="bg-green-600 text-white px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wide flex items-center gap-1">
                <Star className="w-2.5 h-2.5 fill-white" /> Recién Listada
              </span>
            )}
            {isAvailable && (
              <span className="bg-emerald-500 text-white px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wide">
                Disponible
              </span>
            )}
          </div>

          {/* Pet-friendly + section 8 badges bottom-left */}
          <div className="absolute bottom-4 left-4 flex gap-1.5">
            {isPetFriendly && (
              <span className="bg-white/95 text-gray-800 px-2 py-0.5 rounded-full text-[10px] font-semibold">
                🐾 Pet-friendly
              </span>
            )}
            {property.section8_accepted && (
              <span className="bg-white/95 text-gray-800 px-2 py-0.5 rounded-full text-[10px] font-semibold">
                Sec. 8 ✓
              </span>
            )}
          </div>

          {/* Photo count chip */}
          {property.photo_count && property.photo_count > 1 && (
            <div className="absolute bottom-4 right-4">
              <span className="bg-black/60 text-white px-2 py-0.5 rounded-full text-[10px] font-medium">
                📷 {property.photo_count}
              </span>
            </div>
          )}
        </div>

        {/* Property Info */}
        <div className="p-6 flex flex-col flex-1">
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-3">
            <MapPin className="w-4 h-4 text-primary flex-shrink-0" aria-hidden="true" />
            <address className="not-italic line-clamp-1 group-hover:text-charcoal transition-colors">
              {property.address}, {property.city}, {property.state}
            </address>
          </div>

          {/* Features */}
          <div className="flex items-center gap-4 text-sm text-gray-600 mb-4">
            <div className="flex items-center gap-1">
              <Bed className="w-4 h-4" aria-hidden="true" />
              <span>{property.bedrooms} {property.bedrooms === 1 ? 'Hab' : 'Habs'}</span>
            </div>
            <div className="flex items-center gap-1">
              <Bath className="w-4 h-4" aria-hidden="true" />
              <span>{property.bathrooms} {property.bathrooms === 1 ? 'Baño' : 'Baños'}</span>
            </div>
            {property.square_feet && property.square_feet > 0 && (
              <div className="flex items-center gap-1">
                <Square className="w-4 h-4" aria-hidden="true" />
                <span>{property.square_feet.toLocaleString()} ft²</span>
              </div>
            )}
          </div>

          <div className="mt-auto">
            <span className="w-full bg-charcoal group-hover:bg-primary text-white py-3 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2">
              Ver Detalles
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" aria-hidden="true" />
            </span>
          </div>
        </div>
      </Link>
    </motion.article>
  )
}
