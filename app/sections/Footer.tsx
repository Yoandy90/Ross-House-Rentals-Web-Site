'use client'

import { Phone, Mail, MapPin, ArrowUp } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useLanguage } from '../i18n/LanguageContext'

export default function Footer() {
  const { t } = useLanguage()
  return (
    <footer className="bg-charcoal text-white pt-16 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid md:grid-cols-4 gap-12 mb-12">
          <div className="md:col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <Image src="/logo.jpg" alt="Ross House Rentals" width={64} height={64} className="rounded-xl object-contain" />
              <div>
                <div className="font-display font-bold text-xl">Ross House Rentals</div>
                <div className="text-gray-400 text-xs uppercase tracking-widest">LLC &mdash; Dumas, Texas</div>
              </div>
            </div>
            <p className="text-gray-400 leading-relaxed max-w-md">{t.apply.subtitle}</p>
          </div>
          <div>
            <h4 className="font-display font-bold text-lg mb-4">{t.footer.quickLinks}</h4>
            <ul className="space-y-2">
              {[
                { name: t.nav.properties, href: '#properties' },
                { name: t.nav.services, href: '#services' },
                { name: t.nav.apply, href: '#apply' },
                { name: t.nav.market, href: '#market' },
                { name: t.nav.contact, href: '#contact' },
              ].map(link => (
                <li key={link.name}><a href={link.href} className="text-gray-400 hover:text-primary transition-colors text-sm">{link.name}</a></li>
              ))}
              <li><Link href="/invest" className="text-primary hover:text-primary-light transition-colors text-sm font-semibold">{t.footer.investLink}</Link></li>
              <li><Link href="/tenant" className="text-gray-400 hover:text-primary transition-colors text-sm">{t.footer.tenantLink}</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-display font-bold text-lg mb-4">{t.footer.contactTitle}</h4>
            <ul className="space-y-3">
              <li className="flex items-center gap-2 text-gray-400 text-sm"><MapPin className="w-4 h-4 text-primary flex-shrink-0" /> 305 Bruce Ave, Dumas, TX 79029</li>
              <li><a href="tel:+18069342018" className="flex items-center gap-2 text-gray-400 hover:text-white text-sm transition-colors"><Phone className="w-4 h-4 text-primary flex-shrink-0" /> (806) 934-2018</a></li>
              <li><a href="mailto:info@rosshouserentals.com" className="flex items-center gap-2 text-gray-400 hover:text-white text-sm transition-colors"><Mail className="w-4 h-4 text-primary flex-shrink-0" /> info@rosshouserentals.com</a></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-gray-700/50 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-gray-500 text-sm">&copy; {new Date().getFullYear()} Ross House Rentals LLC. {t.footer.rights}</p>
          <div className="flex items-center gap-6">
            <span className="text-gray-500 text-xs">{t.footer.bilingual}</span>
            <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="w-10 h-10 rounded-xl bg-primary/20 hover:bg-primary text-white flex items-center justify-center transition-all">
              <ArrowUp className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </footer>
  )
}
