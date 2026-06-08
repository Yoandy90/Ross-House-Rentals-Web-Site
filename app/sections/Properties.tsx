'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Home, Bed, Bath, Ruler, MapPin, DollarSign, ArrowRight, Loader2 } from 'lucide-react'
import { useLanguage } from '../i18n/LanguageContext'

const API_URL = 'https://app-nueva-production.up.railway.app/api'

interface Property {
  id: string; address: string; city: string; state: string; zip_code: string;
  property_type: string; bedrooms: number; bathrooms: number; square_feet: number;
  rent_amount: number; deposit_amount: number; description: string; features: string[];
  photos: string[]; status: string;
}

export default function Properties() {
  const { t } = useLanguage()
  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${API_URL}/public/properties`)
      .then(r => r.json())
      .then(d => { setProperties(d.properties || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  return (
    <section id="properties" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className="text-center mb-16">
          <span className="text-primary font-semibold text-sm uppercase tracking-widest">{t.properties.badge}</span>
          <h2 className="font-display text-4xl md:text-5xl font-bold text-charcoal mt-3 mb-4">{t.properties.title}</h2>
          <p className="text-gray-500 text-lg max-w-2xl mx-auto">{t.properties.subtitle}</p>
        </motion.div>

        {loading ? (
          <div className="text-center py-20"><Loader2 className="w-8 h-8 text-primary animate-spin mx-auto" /><p className="text-gray-400 mt-3">Loading properties...</p></div>
        ) : properties.length === 0 ? (
          <div className="text-center py-20 bg-warm/50 rounded-3xl">
            <Home className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-700 mb-2">All Properties Currently Leased</h3>
            <p className="text-gray-500 mb-6">We&apos;re at full occupancy! Apply below to join our waitlist.</p>
            <a href="#apply" className="inline-flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-xl font-semibold hover:bg-primary-dark transition-all">Join Waitlist <ArrowRight className="w-4 h-4" /></a>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {properties.map((p, i) => (
              <motion.div key={p.id} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                className="group bg-white rounded-3xl overflow-hidden shadow-md hover:shadow-2xl transition-all duration-500 border border-gray-100">
                <div className="relative h-56 bg-gradient-to-br from-primary/10 to-secondary/10 overflow-hidden">
                  {p.photos?.[0] ? (
                    <img src={p.photos[0]} alt={p.address} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Home className="w-16 h-16 text-primary/20" />
                    </div>
                  )}
                  <div className="absolute top-4 left-4">
                    <span className={`px-3 py-1.5 rounded-full text-xs font-bold shadow-lg ${
                      p.status === 'available' ? 'bg-secondary text-white' : 'bg-gray-700 text-white'
                    }`}>
                      {p.status === 'available' ? '✨ Available' : 'Leased'}
                    </span>
                  </div>
                  <div className="absolute bottom-4 right-4 bg-white/95 backdrop-blur-sm px-4 py-2 rounded-xl shadow-lg">
                    <span className="text-2xl font-display font-bold text-primary">${p.rent_amount.toLocaleString()}</span>
                    <span className="text-gray-500 text-sm">/mo</span>
                  </div>
                </div>
                <div className="p-6">
                  <h3 className="font-display text-xl font-bold text-charcoal mb-1 group-hover:text-primary transition-colors">{p.address}</h3>
                  <p className="flex items-center gap-1.5 text-gray-400 text-sm mb-4"><MapPin className="w-3.5 h-3.5" />{p.city}, {p.state} {p.zip_code}</p>
                  <div className="flex items-center gap-4 py-4 border-t border-gray-100">
                    <div className="flex items-center gap-1.5 text-gray-600"><Bed className="w-4 h-4 text-primary" /><span className="text-sm font-medium">{p.bedrooms} Bed</span></div>
                    <div className="flex items-center gap-1.5 text-gray-600"><Bath className="w-4 h-4 text-primary" /><span className="text-sm font-medium">{p.bathrooms} Bath</span></div>
                    {p.square_feet > 0 && <div className="flex items-center gap-1.5 text-gray-600"><Ruler className="w-4 h-4 text-primary" /><span className="text-sm font-medium">{p.square_feet.toLocaleString()} ft²</span></div>}
                  </div>
                  <div className="flex items-center justify-between mt-4">
                    <div className="text-xs text-gray-400"><DollarSign className="w-3 h-3 inline" /> Deposit: ${p.deposit_amount.toLocaleString()}</div>
                    <a href="#apply" className="inline-flex items-center gap-1 text-primary font-semibold text-sm hover:text-secondary transition-colors">
                      Apply Now <ArrowRight className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
