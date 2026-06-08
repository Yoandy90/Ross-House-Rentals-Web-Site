'use client'

import { motion } from 'framer-motion'
import { MapPin, Phone, Mail, Clock } from 'lucide-react'
import { useLanguage } from '../i18n/LanguageContext'

export default function Contact() {
  const { t } = useLanguage()
  return (
    <section id="contact" className="py-24 bg-charcoal text-white relative overflow-hidden">
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23ffffff' fill-opacity='0.3'%3E%3Cpath d='M0 40L40 0H20L0 20M40 40V20L20 40'/%3E%3C/g%3E%3C/svg%3E")` }}></div>
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
          <span className="text-primary font-semibold text-sm uppercase tracking-widest">{t.contact.badge}</span>
          <h2 className="font-display text-4xl md:text-5xl font-bold mt-3 mb-4">{t.contact.title}</h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">{t.contact.subtitle}</p>
        </motion.div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {[
            { icon: MapPin, label: t.contact.address, value: '305 Bruce Ave, Dumas, TX 79029', href: 'https://maps.google.com/?q=305+Bruce+Ave+Dumas+TX' },
            { icon: Phone, label: t.contact.phone, value: '(806) 934-2018', href: 'tel:+18069342018' },
            { icon: Mail, label: t.contact.email, value: 'info@rosshouserentals.com', href: 'mailto:info@rosshouserentals.com' },
            { icon: Clock, label: t.contact.hours, value: t.contact.hoursValue, href: '' },
          ].map((item, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
              className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 text-center hover:bg-white/10 transition-all">
              <item.icon className="w-6 h-6 text-primary mx-auto mb-3" />
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">{item.label}</p>
              {item.href ? (
                <a href={item.href} className="text-white font-medium hover:text-primary transition-colors text-sm" target={item.href.startsWith('http') ? '_blank' : undefined}>{item.value}</a>
              ) : (
                <p className="text-white font-medium text-sm">{item.value}</p>
              )}
            </motion.div>
          ))}
        </div>
        <div className="text-center">
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="tel:+18069342018" className="bg-primary hover:bg-primary-dark text-white px-8 py-4 rounded-2xl font-bold text-lg transition-all shadow-xl flex items-center justify-center gap-3">
              <Phone className="w-5 h-5" /> {t.contact.cta}
            </a>
            <a href="https://wa.me/18069342018" target="_blank" className="bg-green-600 hover:bg-green-700 text-white px-8 py-4 rounded-2xl font-bold text-lg transition-all shadow-xl flex items-center justify-center gap-3">
              {t.contact.whatsapp}
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
