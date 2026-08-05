'use client'

import { Suspense, useState, useEffect, useMemo } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Search, SlidersHorizontal, X, Loader2, Home as HomeIcon, ArrowDown01, ArrowDown10, ArrowRight } from 'lucide-react'
import { useLanguage } from '../i18n/LanguageContext'
import Navbar from '../components/Navbar'
import Footer from '../sections/Footer'
import PropertyCard, { PropertyListItem } from '../components/PropertyCard'

type SortKey = 'price_asc' | 'price_desc' | 'newest'

export default function PropertiesCatalogPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
      </div>
    }>
      <PropertiesCatalogInner />
    </Suspense>
  )
}

function PropertiesCatalogInner() {
  const { t } = useLanguage()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [properties, setProperties] = useState<PropertyListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showFilters, setShowFilters] = useState(false)

  // Filter state — initialize from URL
  const [search, setSearch] = useState(searchParams.get('q') || '')
  const [bedrooms, setBedrooms] = useState<string>(searchParams.get('bedrooms') || '')
  const [bathrooms, setBathrooms] = useState<string>(searchParams.get('bathrooms') || '')
  const [maxPrice, setMaxPrice] = useState<string>(searchParams.get('maxPrice') || '')
  const [minPrice, setMinPrice] = useState<string>(searchParams.get('minPrice') || '')
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get('status') || 'available')
  const [sortBy, setSortBy] = useState<SortKey>((searchParams.get('sort') as SortKey) || 'newest')

  // Fetch properties (once)
  useEffect(() => {
    const fetchProperties = async () => {
      try {
        const res = await fetch('/api/public/properties')
        if (!res.ok) throw new Error('No se pudieron cargar las propiedades')
        const data = await res.json()
        setProperties(data.properties || [])
      } catch (e: any) {
        console.error(e)
        setError(e?.message || 'Error al cargar las propiedades')
      } finally {
        setLoading(false)
      }
    }
    fetchProperties()
  }, [])

  // Sync filters → URL (shareable)
  useEffect(() => {
    const params = new URLSearchParams()
    if (search) params.set('q', search)
    if (bedrooms) params.set('bedrooms', bedrooms)
    if (bathrooms) params.set('bathrooms', bathrooms)
    if (minPrice) params.set('minPrice', minPrice)
    if (maxPrice) params.set('maxPrice', maxPrice)
    if (statusFilter !== 'available') params.set('status', statusFilter)
    if (sortBy !== 'newest') params.set('sort', sortBy)
    const qs = params.toString()
    router.replace(qs ? `?${qs}` : '?', { scroll: false })
  }, [search, bedrooms, bathrooms, minPrice, maxPrice, statusFilter, sortBy, router])

  const filtered = useMemo(() => {
    let result = [...properties]
    if (statusFilter && statusFilter !== 'all') result = result.filter((p) => p.status === statusFilter)
    if (search) {
      const s = search.toLowerCase()
      result = result.filter(
        (p) =>
          p.address?.toLowerCase().includes(s) ||
          p.city?.toLowerCase().includes(s) ||
          p.state?.toLowerCase().includes(s) ||
          p.zip_code?.toLowerCase().includes(s),
      )
    }
    if (bedrooms) {
      const min = parseInt(bedrooms)
      result = result.filter((p) => p.bedrooms >= min)
    }
    if (bathrooms) {
      const min = parseFloat(bathrooms)
      result = result.filter((p) => p.bathrooms >= min)
    }
    if (minPrice) {
      const min = parseFloat(minPrice)
      result = result.filter((p) => p.rent_amount >= min)
    }
    if (maxPrice) {
      const max = parseFloat(maxPrice)
      result = result.filter((p) => p.rent_amount <= max)
    }
    // Sort
    if (sortBy === 'price_asc') result.sort((a, b) => a.rent_amount - b.rent_amount)
    else if (sortBy === 'price_desc') result.sort((a, b) => b.rent_amount - a.rent_amount)
    else if (sortBy === 'newest') result.sort((a, b) => {
      const ta = a.created_at ? new Date(a.created_at).getTime() : 0
      const tb = b.created_at ? new Date(b.created_at).getTime() : 0
      return tb - ta
    })
    return result
  }, [properties, search, bedrooms, bathrooms, minPrice, maxPrice, statusFilter, sortBy])

  const clearFilters = () => {
    setSearch('')
    setBedrooms('')
    setBathrooms('')
    setMinPrice('')
    setMaxPrice('')
    setStatusFilter('available')
    setSortBy('newest')
  }

  const hasActiveFilters = search || bedrooms || bathrooms || minPrice || maxPrice || statusFilter !== 'available' || sortBy !== 'newest'

  return (
    <>
      <Navbar />
      <main className="bg-gray-50 min-h-screen">
        {/* Hero */}
        <section className="bg-gradient-to-br from-charcoal via-charcoal/95 to-primary/90 text-white pt-14 pb-20 relative overflow-hidden">
          {/* Decorative pattern */}
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 20% 30%, white 0%, transparent 40%), radial-gradient(circle at 80% 70%, white 0%, transparent 40%)' }} />

          <div className="max-w-7xl mx-auto px-4 sm:px-6 relative">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <span className="inline-flex items-center gap-2 bg-white/10 backdrop-blur text-white px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider mb-5 border border-white/20">
                <HomeIcon className="w-3.5 h-3.5" />
                Catálogo de Propiedades
              </span>
              <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold mb-4 leading-tight">
                Todas Nuestras Propiedades
              </h1>
              <p className="text-white/85 text-lg max-w-2xl leading-relaxed">
                Explora nuestro inventario completo de casas en renta en Dumas, Texas y áreas cercanas.
                Filtra por precio, habitaciones y características.
              </p>
            </motion.div>

            {/* Search Bar */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="mt-8 max-w-2xl"
            >
              <div className="relative">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por dirección, ciudad o código postal..."
                  className="w-full pl-14 pr-12 py-4 rounded-2xl bg-white text-gray-900 placeholder-gray-400 shadow-2xl focus:outline-none focus:ring-4 focus:ring-primary/30 text-base"
                  aria-label="Buscar propiedades"
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                    aria-label="Limpiar búsqueda"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        </section>

        {/* Content */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
          <div className="flex flex-col lg:flex-row gap-8">

            {/* FILTERS SIDEBAR */}
            <aside className={`lg:w-72 lg:block ${showFilters ? 'block' : 'hidden'}`}>
              <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6 sticky top-24">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="font-semibold text-charcoal flex items-center gap-2">
                    <SlidersHorizontal className="w-4 h-4" /> Filtros
                  </h2>
                  {hasActiveFilters && (
                    <button onClick={clearFilters} className="text-xs text-primary hover:underline">
                      Limpiar todo
                    </button>
                  )}
                </div>

                {/* Bedrooms */}
                <div className="mb-5">
                  <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">Habitaciones (mínimo)</label>
                  <div className="flex gap-2 flex-wrap">
                    {['', '1', '2', '3', '4'].map((n) => (
                      <button
                        key={n || 'any'}
                        onClick={() => setBedrooms(n)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                          bedrooms === n ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {n === '' ? 'Cualquiera' : `${n}+`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Bathrooms */}
                <div className="mb-5">
                  <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">Baños (mínimo)</label>
                  <div className="flex gap-2 flex-wrap">
                    {['', '1', '1.5', '2', '3'].map((n) => (
                      <button
                        key={n || 'any'}
                        onClick={() => setBathrooms(n)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                          bathrooms === n ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {n === '' ? 'Cualquiera' : `${n}+`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Price range */}
                <div className="mb-5">
                  <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">Rango de precio ($/mes)</label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      placeholder="Mín"
                      value={minPrice}
                      onChange={(e) => setMinPrice(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <input
                      type="number"
                      placeholder="Máx"
                      value={maxPrice}
                      onChange={(e) => setMaxPrice(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>

                {/* Status — private: rented option removed. Only "Disponibles" is public. */}
                <input type="hidden" value={statusFilter} readOnly />
              </div>
            </aside>

            {/* RESULTS */}
            <div className="flex-1">
              {/* Top bar — count + sort + mobile filters */}
              <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
                <div>
                  {loading ? (
                    <div className="text-gray-500 text-sm">Cargando propiedades...</div>
                  ) : (
                    <div className="text-charcoal font-semibold">
                      {filtered.length} {filtered.length === 1 ? 'propiedad' : 'propiedades'}
                      {hasActiveFilters && <span className="text-gray-500 font-normal text-sm ml-2">(filtradas)</span>}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowFilters((v) => !v)}
                    className="lg:hidden flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm font-medium hover:bg-gray-50"
                  >
                    <SlidersHorizontal className="w-4 h-4" /> Filtros
                  </button>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortKey)}
                    className="px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary"
                    aria-label="Ordenar por"
                  >
                    <option value="newest">Más recientes</option>
                    <option value="price_asc">Precio: menor a mayor</option>
                    <option value="price_desc">Precio: mayor a menor</option>
                  </select>
                </div>
              </div>

              {/* Grid */}
              {loading ? (
                <div className="flex justify-center items-center py-32">
                  <Loader2 className="w-10 h-10 animate-spin text-primary" />
                </div>
              ) : error ? (
                <div className="text-center py-20">
                  <p className="text-red-600 font-medium mb-2">{error}</p>
                  <button onClick={() => window.location.reload()} className="text-primary underline">Reintentar</button>
                </div>
              ) : filtered.length === 0 ? (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
                  <HomeIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <h3 className="text-lg font-semibold text-charcoal mb-2">
                    {statusFilter === 'available' && properties.length > 0
                      ? '¡No hay disponibilidad en este momento!'
                      : 'No encontramos propiedades'}
                  </h3>
                  <p className="text-gray-500 text-sm mb-5 max-w-md mx-auto">
                    {statusFilter === 'available' && properties.length > 0
                      ? 'Nuestras casas se rentan rápidamente. Únete a la lista de espera y serás el primero en enterarte cuando se libere una que se ajuste a lo que buscas.'
                      : 'Ningún resultado coincide con tus filtros actuales.'}
                  </p>
                  {statusFilter === 'available' && properties.length > 0 ? (
                    <div className="flex items-center justify-center gap-3 flex-wrap">
                      <a
                        href="/interesados"
                        className="inline-flex items-center gap-2 bg-primary hover:bg-primary-dark text-white px-5 py-2.5 rounded-xl font-semibold transition shadow-lg"
                      >
                        Unirme a la lista de espera <ArrowRight className="w-4 h-4" />
                      </a>
                    </div>
                  ) : hasActiveFilters ? (
                    <button onClick={clearFilters} className="text-primary font-medium hover:underline">
                      Limpiar filtros
                    </button>
                  ) : null}
                </div>
              ) : (
                <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6" role="list">
                  {filtered.map((p, idx) => (
                    <PropertyCard key={p.id} property={p} index={idx} priority={idx < 3} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
