'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Bed, Bath, Square, MapPin, ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, X,
  Phone, Mail, Calendar, Send, Loader2, Check, Home as HomeIcon, Tag, Sparkles,
} from 'lucide-react'
import { useLanguage } from '../../i18n/LanguageContext'
import Navbar from '../../components/Navbar'
import Footer from '../../sections/Footer'
import PropertyCard, { PropertyListItem } from '../../components/PropertyCard'

interface PropertyDetail {
  id: string
  name?: string
  address: string
  city: string
  state: string
  zip_code?: string
  property_type?: string
  bedrooms: number
  bathrooms: number
  square_feet?: number
  rent_amount: number
  deposit_amount?: number
  sale_price?: number
  listing_type?: string
  description?: string
  features?: string[]
  photos?: string[]
  photos_categorized?: { url: string; caption?: string; category?: string }[]
  status: string
  owner_name?: string
  section8_accepted?: boolean
}

export default function PropertyDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { t } = useLanguage()
  const id = params?.id as string

  const [property, setProperty] = useState<PropertyDetail | null>(null)
  const [similar, setSimilar] = useState<PropertyListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Gallery state
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [photoIdx, setPhotoIdx] = useState(0)

  // Apply form state
  const [form, setForm] = useState({ name: '', email: '', phone: '', employment: '', monthly_income: '', message: '' })
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Fetch property + similar
  useEffect(() => {
    if (!id) return
    const fetchAll = async () => {
      try {
        const res = await fetch(`/api/public/properties/${id}`)
        if (!res.ok) {
          if (res.status === 404) throw new Error('Propiedad no encontrada')
          throw new Error('Error al cargar la propiedad')
        }
        const data = await res.json()
        const prop = data.property as PropertyDetail
        setProperty(prop)

        // Fetch similar (same bedroom count, exclude current)
        try {
          const allRes = await fetch('/api/public/properties')
          if (allRes.ok) {
            const allData = await allRes.json()
            const all = (allData.properties || []) as PropertyListItem[]
            const sim = all
              .filter((p) => p.id !== prop.id && p.status === 'available')
              .sort((a, b) => Math.abs(a.bedrooms - prop.bedrooms) - Math.abs(b.bedrooms - prop.bedrooms))
              .slice(0, 3)
            setSimilar(sim)
          }
        } catch (_) { /* ignore */ }
      } catch (e: any) {
        setError(e?.message || 'Error inesperado')
      } finally {
        setLoading(false)
      }
    }
    fetchAll()
  }, [id])

  const formatPrice = (price: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(price)

  // Gallery navigation
  const photos = property?.photos || []
  const nextPhoto = useCallback(() => setPhotoIdx((i) => (i + 1) % Math.max(photos.length, 1)), [photos.length])
  const prevPhoto = useCallback(() => setPhotoIdx((i) => (i - 1 + photos.length) % Math.max(photos.length, 1)), [photos.length])

  // Keyboard nav for lightbox
  useEffect(() => {
    if (!lightboxOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') nextPhoto()
      else if (e.key === 'ArrowLeft') prevPhoto()
      else if (e.key === 'Escape') setLightboxOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [lightboxOpen, nextPhoto, prevPhoto])

  const submitApply = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const res = await fetch('/api/public/rental-application', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          property_interest: property ? `${property.address}, ${property.city}, ${property.state}` : '',
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.detail || 'Error al enviar la aplicación')
      }
      setSubmitted(true)
    } catch (err: any) {
      setSubmitError(err?.message || 'No pudimos enviar la aplicación. Intenta de nuevo.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <>
        <Navbar />
        <main className="bg-gray-50 min-h-screen pb-20">
          <div className="flex justify-center items-center py-32">
            <Loader2 className="w-12 h-12 animate-spin text-primary" />
          </div>
        </main>
        <Footer />
      </>
    )
  }

  if (error || !property) {
    return (
      <>
        <Navbar />
        <main className="bg-gray-50 min-h-screen pb-20 pt-20">
          <div className="max-w-2xl mx-auto px-4 text-center">
            <HomeIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h1 className="text-3xl font-bold text-charcoal mb-3">Propiedad no encontrada</h1>
            <p className="text-gray-600 mb-6">{error || 'Esta propiedad ya no está disponible o ha sido removida.'}</p>
            <Link
              href="/propiedades"
              className="inline-flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-xl font-semibold hover:bg-primary-dark transition"
            >
              <ArrowLeft className="w-4 h-4" /> Ver todas las propiedades
            </Link>
          </div>
        </main>
        <Footer />
      </>
    )
  }

  const isAvailable = property.status === 'available'
  const fullAddress = `${property.address}, ${property.city}, ${property.state}${property.zip_code ? ' ' + property.zip_code : ''}`
  const mapsQuery = encodeURIComponent(fullAddress)

  // JSON-LD for SEO (Real Estate Listing schema)
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'RealEstateListing',
    name: property.name || `Casa en ${property.address}`,
    description: property.description || `Casa en renta de ${property.bedrooms} habitaciones y ${property.bathrooms} baños en ${property.city}, ${property.state}.`,
    url: `https://www.rosshouserentals.com/propiedades/${property.id}`,
    image: photos.slice(0, 5),
    address: {
      '@type': 'PostalAddress',
      streetAddress: property.address,
      addressLocality: property.city,
      addressRegion: property.state,
      postalCode: property.zip_code || '',
      addressCountry: 'US',
    },
    numberOfRooms: property.bedrooms,
    numberOfBathroomsTotal: property.bathrooms,
    floorSize: property.square_feet ? { '@type': 'QuantitativeValue', value: property.square_feet, unitCode: 'FTK' } : undefined,
    offers: {
      '@type': 'Offer',
      price: property.rent_amount,
      priceCurrency: 'USD',
      priceSpecification: { '@type': 'UnitPriceSpecification', price: property.rent_amount, priceCurrency: 'USD', unitCode: 'MON' },
      availability: isAvailable ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
    },
  }

  const mainPhoto = photos[0] || 'https://images.pexels.com/photos/1396122/pexels-photo-1396122.jpeg?auto=compress&cs=tinysrgb&w=1200'

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Navbar />
      <main className="bg-gray-50 min-h-screen">
        {/* Breadcrumb */}
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
            <nav className="flex items-center gap-2 text-sm text-gray-500">
              <Link href="/" className="hover:text-primary">Inicio</Link>
              <span>/</span>
              <Link href="/propiedades" className="hover:text-primary">Propiedades</Link>
              <span>/</span>
              <span className="text-charcoal font-medium truncate">{property.address}</span>
            </nav>
          </div>
        </div>

        {/* GALLERY HERO */}
        <section className="bg-white">
          <div className="max-w-7xl mx-auto">
            {photos.length === 0 ? (
              <div className="relative h-72 md:h-[480px] bg-gray-200 flex items-center justify-center">
                <span className="text-gray-400">Sin fotos disponibles</span>
              </div>
            ) : (
              <div className="grid md:grid-cols-4 md:grid-rows-2 gap-2 p-2 md:p-4">
                {/* Main photo */}
                <button
                  onClick={() => { setPhotoIdx(0); setLightboxOpen(true) }}
                  className="md:col-span-2 md:row-span-2 relative h-72 md:h-[480px] rounded-2xl overflow-hidden group focus:outline-none focus:ring-4 focus:ring-primary/30"
                  aria-label="Ver galería completa"
                >
                  <Image
                    src={mainPhoto}
                    alt={`Foto principal de ${property.address}`}
                    fill
                    sizes="(max-width: 768px) 100vw, 50vw"
                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                    priority
                  />
                </button>
                {/* Side photos (up to 4) */}
                {photos.slice(1, 5).map((url, i) => (
                  <button
                    key={url + i}
                    onClick={() => { setPhotoIdx(i + 1); setLightboxOpen(true) }}
                    className="relative h-32 md:h-[236px] rounded-xl overflow-hidden group focus:outline-none focus:ring-4 focus:ring-primary/30"
                    aria-label={`Ver foto ${i + 2}`}
                  >
                    <Image
                      src={url}
                      alt={`Foto ${i + 2} de ${property.address}`}
                      fill
                      sizes="(max-width: 768px) 50vw, 25vw"
                      className="object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    {i === 3 && photos.length > 5 && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white font-bold text-lg">
                        +{photos.length - 5} fotos
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* LIGHTBOX */}
        {lightboxOpen && photos.length > 0 && (
          <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center" onClick={() => setLightboxOpen(false)}>
            <button
              onClick={(e) => { e.stopPropagation(); setLightboxOpen(false) }}
              className="absolute top-4 right-4 z-10 bg-white/10 hover:bg-white/20 text-white p-2 rounded-full"
              aria-label="Cerrar"
            >
              <X className="w-6 h-6" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); prevPhoto() }}
              className="absolute left-2 md:left-6 bg-white/10 hover:bg-white/20 text-white p-3 rounded-full z-10"
              aria-label="Foto anterior"
            >
              <ChevronLeft className="w-7 h-7" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); nextPhoto() }}
              className="absolute right-2 md:right-6 bg-white/10 hover:bg-white/20 text-white p-3 rounded-full z-10"
              aria-label="Foto siguiente"
            >
              <ChevronRight className="w-7 h-7" />
            </button>
            <div className="relative w-full max-w-5xl aspect-[4/3]" onClick={(e) => e.stopPropagation()}>
              <Image
                src={photos[photoIdx]}
                alt={`Foto ${photoIdx + 1} de ${photos.length}`}
                fill
                sizes="100vw"
                className="object-contain"
                priority
              />
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/60 text-white px-3 py-1 rounded-full text-sm">
                {photoIdx + 1} / {photos.length}
              </div>
            </div>
          </div>
        )}

        {/* MAIN INFO */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
          <div className="grid lg:grid-cols-3 gap-8">
            {/* LEFT COLUMN */}
            <div className="lg:col-span-2">
              {/* Header */}
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                  <div>
                    <h1 className="font-display text-3xl md:text-4xl font-bold text-charcoal mb-2">
                      {property.address}
                    </h1>
                    <div className="flex items-center gap-2 text-gray-600">
                      <MapPin className="w-4 h-4 text-primary" />
                      <span>{property.city}, {property.state} {property.zip_code}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <div className="text-3xl font-bold text-primary">
                      {formatPrice(property.rent_amount)}<span className="text-base text-gray-500 font-medium">/mes</span>
                    </div>
                    {property.deposit_amount && property.deposit_amount > 0 && (
                      <div className="text-xs text-gray-500">Depósito: {formatPrice(property.deposit_amount)}</div>
                    )}
                  </div>
                </div>

                {/* Status badges */}
                <div className="flex flex-wrap gap-2 mb-6">
                  {isAvailable ? (
                    <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide">
                      ✓ Disponible
                    </span>
                  ) : (
                    <span className="bg-gray-200 text-gray-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide">
                      No disponible
                    </span>
                  )}
                  {property.section8_accepted && (
                    <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide">
                      Section 8 aceptado
                    </span>
                  )}
                  {property.property_type && (
                    <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-xs font-medium uppercase">
                      {property.property_type}
                    </span>
                  )}
                </div>

                {/* Quick stats */}
                <div className="grid grid-cols-3 gap-3 mb-8">
                  <div className="bg-white rounded-xl p-4 border border-gray-100 text-center">
                    <Bed className="w-6 h-6 text-primary mx-auto mb-1" />
                    <div className="font-bold text-charcoal text-lg">{property.bedrooms}</div>
                    <div className="text-xs text-gray-500">{property.bedrooms === 1 ? 'Habitación' : 'Habitaciones'}</div>
                  </div>
                  <div className="bg-white rounded-xl p-4 border border-gray-100 text-center">
                    <Bath className="w-6 h-6 text-primary mx-auto mb-1" />
                    <div className="font-bold text-charcoal text-lg">{property.bathrooms}</div>
                    <div className="text-xs text-gray-500">{property.bathrooms === 1 ? 'Baño' : 'Baños'}</div>
                  </div>
                  <div className="bg-white rounded-xl p-4 border border-gray-100 text-center">
                    <Square className="w-6 h-6 text-primary mx-auto mb-1" />
                    <div className="font-bold text-charcoal text-lg">
                      {property.square_feet && property.square_feet > 0 ? property.square_feet.toLocaleString() : '—'}
                    </div>
                    <div className="text-xs text-gray-500">pies²</div>
                  </div>
                </div>

                {/* Description */}
                {property.description && (
                  <div className="bg-white rounded-2xl p-6 border border-gray-100 mb-6">
                    <h2 className="font-semibold text-charcoal text-xl mb-3 flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-primary" /> Descripción
                    </h2>
                    <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{property.description}</p>
                  </div>
                )}

                {/* Features / Amenities */}
                {property.features && property.features.length > 0 && (
                  <div className="bg-white rounded-2xl p-6 border border-gray-100 mb-6">
                    <h2 className="font-semibold text-charcoal text-xl mb-4 flex items-center gap-2">
                      <Tag className="w-5 h-5 text-primary" /> Características
                    </h2>
                    <div className="grid grid-cols-2 gap-3">
                      {property.features.map((f) => (
                        <div key={f} className="flex items-center gap-2 text-gray-700">
                          <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                          <span className="text-sm">{f}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Map */}
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden mb-6">
                  <h2 className="font-semibold text-charcoal text-xl mb-0 flex items-center gap-2 p-6 pb-3">
                    <MapPin className="w-5 h-5 text-primary" /> Ubicación
                  </h2>
                  <p className="text-gray-600 text-sm px-6 mb-4">{fullAddress}</p>
                  <div className="relative w-full h-80 bg-gray-100">
                    <iframe
                      src={`https://www.google.com/maps?q=${mapsQuery}&output=embed`}
                      className="w-full h-full border-0"
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                      title={`Mapa de ${fullAddress}`}
                    />
                  </div>
                </div>
              </motion.div>
            </div>

            {/* RIGHT COLUMN — Apply form */}
            <aside className="lg:col-span-1">
              <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 sticky top-24">
                {submitted ? (
                  <div className="text-center py-6">
                    <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Check className="w-8 h-8 text-emerald-600" />
                    </div>
                    <h3 className="font-bold text-xl text-charcoal mb-2">¡Aplicación enviada!</h3>
                    <p className="text-gray-600 text-sm mb-5">
                      Recibimos tu información. Te contactaremos en las próximas 24-48 horas hábiles.
                    </p>
                    <Link
                      href="/propiedades"
                      className="inline-flex items-center gap-2 text-primary font-semibold hover:underline"
                    >
                      Ver más propiedades <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>
                ) : (
                  <>
                    <h3 className="font-bold text-xl text-charcoal mb-1">Aplicar para esta propiedad</h3>
                    <p className="text-gray-500 text-sm mb-5">Te contactamos en 24-48 horas hábiles.</p>

                    <form onSubmit={submitApply} className="space-y-3">
                      <input
                        type="text"
                        required
                        placeholder="Nombre completo *"
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary text-sm"
                      />
                      <input
                        type="email"
                        placeholder="Email"
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary text-sm"
                      />
                      <input
                        type="tel"
                        placeholder="Teléfono *"
                        value={form.phone}
                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary text-sm"
                      />
                      <input
                        type="text"
                        placeholder="Empleador / Ocupación"
                        value={form.employment}
                        onChange={(e) => setForm({ ...form, employment: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary text-sm"
                      />
                      <input
                        type="text"
                        placeholder="Ingreso mensual"
                        value={form.monthly_income}
                        onChange={(e) => setForm({ ...form, monthly_income: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary text-sm"
                      />
                      <textarea
                        placeholder="Mensaje adicional (opcional)"
                        value={form.message}
                        onChange={(e) => setForm({ ...form, message: e.target.value })}
                        rows={3}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary text-sm resize-none"
                      />

                      {submitError && (
                        <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg p-2">{submitError}</div>
                      )}

                      <button
                        type="submit"
                        disabled={submitting || (!form.email && !form.phone) || !form.name}
                        className="w-full bg-primary hover:bg-primary-dark disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-3 rounded-xl font-semibold transition flex items-center justify-center gap-2"
                      >
                        {submitting ? (
                          <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</>
                        ) : (
                          <>Enviar Aplicación <Send className="w-4 h-4" /></>
                        )}
                      </button>
                    </form>

                    <div className="mt-5 pt-5 border-t border-gray-100">
                      <p className="text-xs text-gray-500 mb-3 uppercase font-semibold tracking-wide">¿Prefieres llamar?</p>
                      <a href="tel:+18069342018" className="flex items-center gap-2 text-charcoal hover:text-primary font-medium text-sm mb-1.5">
                        <Phone className="w-4 h-4 text-primary" /> (806) 934-2018
                      </a>
                      <a href="mailto:info@rosshouserentals.com" className="flex items-center gap-2 text-charcoal hover:text-primary font-medium text-sm">
                        <Mail className="w-4 h-4 text-primary" /> info@rosshouserentals.com
                      </a>
                    </div>
                  </>
                )}
              </div>
            </aside>
          </div>
        </section>

        {/* SIMILAR PROPERTIES */}
        {similar.length > 0 && (
          <section className="bg-white border-t border-gray-100 py-16">
            <div className="max-w-7xl mx-auto px-4 sm:px-6">
              <div className="flex items-end justify-between mb-8">
                <div>
                  <span className="text-primary font-semibold text-sm uppercase tracking-wide">También te puede interesar</span>
                  <h2 className="font-display text-3xl font-bold text-charcoal mt-1">Propiedades similares</h2>
                </div>
                <Link href="/propiedades" className="text-primary font-semibold hover:underline hidden md:flex items-center gap-1">
                  Ver todas <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
              <div className="grid md:grid-cols-3 gap-6">
                {similar.map((p, idx) => <PropertyCard key={p.id} property={p} index={idx} />)}
              </div>
            </div>
          </section>
        )}
      </main>
      <Footer />
    </>
  )
}
