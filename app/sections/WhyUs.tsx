'use client'

import { motion } from 'framer-motion'
import { MapPin, Clock, Star, Shield } from 'lucide-react'
import { useLanguage } from '../i18n/LanguageContext'

const icons = [MapPin, Star, Clock, Shield]

export default function WhyUs() {
  const { t } = useLanguage()
  return (
    <section className="py-24 bg-warm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
          <span className="text-primary font-semibold text-sm uppercase tracking-widest">{t.whyUs.badge}</span>
          <h2 className="font-display text-4xl md:text-5xl font-bold text-charcoal mt-3 mb-4">{t.whyUs.title}</h2>
          <p className="text-gray-500 text-lg max-w-2xl mx-auto">{t.whyUs.subtitle}</p>
        </motion.div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {t.whyUs.items.map((item, i) => {
            const Icon = icons[i] || Star
            return (
              <motion.div key={i} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.15 }}
                className="bg-white rounded-3xl p-8 text-center shadow-sm hover:shadow-xl transition-all duration-500 border border-gray-100 group hover:-translate-y-1">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-5 group-hover:bg-primary group-hover:scale-110 transition-all">
                  <Icon className="w-8 h-8 text-primary group-hover:text-white transition-colors" />
                </div>
                <h3 className="font-display text-lg font-bold text-charcoal mb-2">{item.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{item.desc}</p>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
