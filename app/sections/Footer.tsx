'use client'

import { Phone, Mail, MapPin, ArrowUp, Shield, FileText, Globe, Trash2 } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useLanguage } from '../i18n/LanguageContext'

export default function Footer() {
  const { t, lang } = useLanguage() as any
  const isEs = (lang || 'es') === 'es'
  const legalLinks = [
    { name: t.footer.privacy, href: isEs ? '/privacy-policy/es' : '/privacy-policy', icon: Shield },
    { name: t.footer.terms, href: isEs ? '/terms/es' : '/terms', icon: FileText },
    { name: t.footer.cookies, href: isEs ? '/cookies/es' : '/cookies', icon: Globe },
    { name: t.footer.deleteAccount, href: isEs ? '/delete-account/es' : '/delete-account', icon: Trash2 },
  ]

  return (
    <footer className="bg-charcoal text-white pt-16 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid md:grid-cols-5 gap-10 mb-12">
          <div className="md:col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <Image src="/logo.jpg" alt="Ross House Rentals" width={64} height={64} className="rounded-xl object-contain" />
              <div>
                <div className="font-display font-bold text-xl">Ross House Rentals</div>
                <div className="text-slate-200 text-xs uppercase tracking-widest">LLC &mdash; Dumas, Texas</div>
              </div>
            </div>
            <p className="text-slate-200 leading-relaxed max-w-md">{t.apply.subtitle}</p>
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
                <li key={link.name}><a href={link.href} className="text-slate-200 hover:text-primary transition-colors text-sm">{link.name}</a></li>
              ))}
              <li><Link href="/invest" className="text-primary hover:text-primary-light transition-colors text-sm font-semibold">{t.footer.investLink}</Link></li>
              <li><Link href="/administracion-propiedades" className="text-indigo-400 hover:text-indigo-300 transition-colors text-sm font-semibold">🚧 {isEs ? 'Admin. de Propiedades (Próximamente)' : 'Property Mgmt (Coming Soon)'}</Link></li>
              <li><Link href={isEs ? '/interesados' : '/interesados/en'} className="text-pink-400 hover:text-pink-300 transition-colors text-sm font-semibold">❤️ {t.footer.waitlistLink}</Link></li>
              <li><Link href={isEs ? '/proveedores' : '/proveedores/en'} className="text-amber-400 hover:text-amber-300 transition-colors text-sm font-semibold">🛠️ {t.footer.providersLink}</Link></li>
              <li><Link href="/tenant" className="text-slate-200 hover:text-primary transition-colors text-sm">{t.footer.tenantLink}</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-display font-bold text-lg mb-4">{t.footer.legalTitle}</h4>
            <ul className="space-y-2">
              {legalLinks.map(link => {
                const Ic = link.icon
                return (
                  <li key={link.name}>
                    <Link href={link.href} className="flex items-center gap-2 text-slate-200 hover:text-primary transition-colors text-sm">
                      <Ic className="w-3.5 h-3.5 flex-shrink-0" /> {link.name}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
          <div>
            <h4 className="font-display font-bold text-lg mb-4">{t.footer.contactTitle}</h4>
            <ul className="space-y-3">
              <li className="flex items-start gap-2 text-slate-200 text-sm"><MapPin className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" /> <span>305 Bruce Ave,<br/>Dumas, TX 79029</span></li>
              <li><a href="tel:+18069342018" className="flex items-center gap-2 text-slate-200 hover:text-white text-sm transition-colors"><Phone className="w-4 h-4 text-primary flex-shrink-0" /> (806) 934-2018</a></li>
              <li><a href="mailto:info@rosshouserentals.com" className="flex items-center gap-2 text-slate-200 hover:text-white text-sm transition-colors break-all"><Mail className="w-4 h-4 text-primary flex-shrink-0" /> info@rosshouserentals.com</a></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-gray-700/50 pt-8 flex flex-col gap-6">
          <div className="bg-slate-800/60 border border-amber-500/20 rounded-2xl px-4 md:px-5 py-3 md:py-4 flex items-start gap-3">
            <Shield className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <div className="text-amber-300 text-[10px] font-bold uppercase tracking-widest mb-1">{t.disclaimer.footerLabel}</div>
              <p className="text-slate-300 text-[11px] md:text-xs leading-relaxed">{t.disclaimer.short}</p>
            </div>
          </div>
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-slate-300 text-sm">&copy; {new Date().getFullYear()} Ross House Rentals LLC. {t.footer.rights}</p>
            <div className="flex items-center gap-6">
              <span className="text-slate-300 text-xs">{t.footer.bilingual}</span>
              <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="w-10 h-10 rounded-xl bg-primary/20 hover:bg-primary text-white flex items-center justify-center transition-all">
                <ArrowUp className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
