'use client'

import { useState, useEffect } from 'react'
import { Menu, X, Phone, Globe } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import { useLanguage } from '../i18n/LanguageContext'

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)
  const { t, lang, toggleLang } = useLanguage()

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const navLinks = [
    { name: t.nav.home, href: '#home' },
    { name: t.nav.properties, href: '#properties' },
    { name: t.nav.services, href: '#services' },
    { name: t.nav.market, href: '#market' },
    { name: t.nav.apply, href: '#apply' },
    { name: t.nav.contact, href: '#contact' },
  ]

  return (
    <nav className={`fixed w-full z-50 transition-all duration-500 ${isScrolled ? 'bg-white/95 backdrop-blur-md shadow-lg py-2' : 'bg-transparent py-4'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between">
          <a href="#home" className="flex items-center gap-3 group">
            <Image src="/logo.jpg" alt="Ross House Rentals LLC" width={72} height={72} className="rounded-xl object-contain w-[56px] h-[56px] lg:w-[72px] lg:h-[72px]" />
            <div>
              <div className={`font-display font-bold text-xl lg:text-2xl leading-tight transition-colors ${isScrolled ? 'text-charcoal' : 'text-white'}`}>Ross House Rentals</div>
              <div className={`text-[10px] lg:text-xs uppercase tracking-widest transition-colors ${isScrolled ? 'text-gray-500' : 'text-white/70'}`}>LLC — Dumas, Texas</div>
            </div>
          </a>

          <div className="hidden lg:flex items-center gap-1">
            {navLinks.map(link => (
              <a key={link.name} href={link.href}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${isScrolled ? 'text-gray-600 hover:text-primary hover:bg-primary/5' : 'text-white/90 hover:text-white hover:bg-white/10'}`}>
                {link.name}
              </a>
            ))}
            <Link href="/invest"
              className={`px-3 py-2 rounded-lg text-sm font-semibold transition-all ${isScrolled ? 'text-primary hover:bg-primary/5' : 'text-red-300 hover:text-white hover:bg-white/10'}`}>
              {t.nav.invest}
            </Link>
            <Link href="/tenant"
              className={`ml-1 px-3 py-2 rounded-lg text-sm font-medium transition-all border ${isScrolled ? 'text-charcoal hover:bg-gray-100 border-gray-200' : 'text-white/90 hover:text-white hover:bg-white/10 border-white/20'}`}>
              {t.nav.tenantPortal}
            </Link>
            {/* Language Toggle */}
            <button onClick={toggleLang}
              className={`ml-2 px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${isScrolled ? 'text-gray-500 hover:text-primary hover:bg-primary/5' : 'text-white/70 hover:text-white hover:bg-white/10'}`}>
              <Globe className="w-3.5 h-3.5" /> {t.lang.toggle}
            </button>
            <a href="tel:+18069342018"
              className="ml-2 bg-primary hover:bg-primary-dark text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-md hover:shadow-lg flex items-center gap-2">
              <Phone className="w-4 h-4" /> (806) 934-2018
            </a>
          </div>

          <div className="flex items-center gap-2 lg:hidden">
            <button onClick={toggleLang}
              className={`p-2 rounded-lg text-sm font-bold transition-all ${isScrolled ? 'text-primary bg-primary/10' : 'text-white bg-white/10'}`}>
              {t.lang.label}
            </button>
            <button onClick={() => setIsOpen(!isOpen)}
              className={`p-2.5 rounded-xl transition-all ${isScrolled ? 'text-gray-700 hover:bg-gray-100' : 'text-white hover:bg-white/10'}`}>
              {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {isOpen && (
          <div className="lg:hidden mt-3 py-4 bg-white rounded-2xl shadow-2xl border border-gray-100">
            {navLinks.map(link => (
              <a key={link.name} href={link.href}
                className="block px-5 py-3 text-gray-700 hover:bg-primary/5 hover:text-primary font-medium transition-all"
                onClick={() => setIsOpen(false)}>
                {link.name}
              </a>
            ))}
            <Link href="/invest" className="block px-5 py-3 text-primary font-semibold hover:bg-primary/5 transition-all" onClick={() => setIsOpen(false)}>
              {t.nav.invest}
            </Link>
            <Link href="/tenant" className="block px-5 py-3 text-charcoal font-medium hover:bg-gray-50 transition-all" onClick={() => setIsOpen(false)}>
              {t.nav.tenantPortal}
            </Link>
            <div className="mx-4 mt-3 pt-3 border-t border-gray-100">
              <a href="tel:+18069342018" className="flex items-center justify-center gap-2 bg-primary text-white px-4 py-3 rounded-xl font-semibold">
                <Phone className="w-4 h-4" /> (806) 934-2018
              </a>
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}
