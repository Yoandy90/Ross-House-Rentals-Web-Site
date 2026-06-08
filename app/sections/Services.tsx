'use client'

import { motion } from 'framer-motion'
import { Home, UserCheck, Wrench as Tool, BarChart3, Globe2, Scale } from 'lucide-react'
import { useLanguage } from '../i18n/LanguageContext'

const icons = [Home, UserCheck, Tool, BarChart3, Globe2, Scale]

export default function Services() {
  const { t } = useLanguage()
  return (
    <section id="services" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
          <span className="text-primary font-semibold text-sm uppercase tracking-widest">{t.services.badge}</span>
          <h2 className="font-display text-4xl md:text-5xl font-bold text-charcoal mt-3 mb-4">{t.services.title}</h2>
          <p className="text-gray-500 text-lg max-w-2xl mx-auto">{t.services.subtitle}</p>
        </motion.div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {t.services.items.map((item, i) => {
            const Icon = icons[i] || Home
            return (
              <motion.div key={i} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                className="bg-white rounded-3xl p-8 shadow-sm hover:shadow-xl transition-all duration-500 border border-gray-100 group hover:-translate-y-1">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-5 group-hover:bg-primary group-hover:scale-110 transition-all">
                  <Icon className="w-7 h-7 text-primary group-hover:text-white transition-colors" />
                </div>
                <h3 className="font-display text-xl font-bold text-charcoal mb-3">{item.title}</h3>
                <p className="text-gray-500 leading-relaxed">{item.desc}</p>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
