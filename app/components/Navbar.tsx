'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { Menu, X, Phone, Globe, ChevronDown } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import { useLanguage } from '../i18n/LanguageContext'
import ThemeToggle from './ThemeToggle'

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const { t, lang, toggleLang } = useLanguage()
  const pathname = usePathname()

  // Always use solid navbar — looks cleaner with the promo banners on home and matches inner pages.
  const transparent = false
  const isHome = pathname === '/' || pathname === ''

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll)
    handleScroll()
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Close "more" menu on outside click / route change
  useEffect(() => { setMoreOpen(false); setIsOpen(false) }, [pathname])

  // Helper: returns anchor that works from anywhere (always goes home + scroll)
  const anchor = (id: string) => isHome ? `#${id}` : `/#${id}`

  const primaryLinks = [
    { name: t.nav.home, href: '/' },
    { name: t.nav.properties, href: '/propiedades' },
    { name: t.nav.services, href: anchor('services') },
    { name: t.nav.contact, href: anchor('contact') },
  ]
  const secondaryLinks = [
    { name: t.nav.market, href: anchor('market') },
    { name: t.nav.apply, href: anchor('apply') },
  ]

  return (
    <nav
      className={`sticky top-0 z-50 transition-all duration-300 ${
        transparent
          ? 'bg-transparent py-4'
          : 'bg-white/95 backdrop-blur-md shadow-md py-2 border-b border-gray-100'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between gap-3">

          {/* LOGO — compact */}
          <Link href="/" className="flex items-center gap-2.5 group flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-primary rounded-lg">
            <Image
              src="/logo.jpg"
              alt="Ross House Rentals LLC"
              width={64}
              height={64}
              priority
              className="rounded-xl object-contain w-12 h-12 lg:w-14 lg:h-14"
            />
            <div className="hidden sm:block leading-tight">
              <div className={`font-display font-bold text-base xl:text-lg transition-colors ${transparent ? 'text-white' : 'text-charcoal'}`}>
                Ross House Rentals
              </div>
              <div className={`text-[10px] uppercase tracking-wider transition-colors hidden xl:block ${transparent ? 'text-white/70' : 'text-gray-500'}`}>
                LLC · Dumas, Texas
              </div>
            </div>
          </Link>

          {/* DESKTOP NAV */}
          <div className="hidden lg:flex items-center gap-0.5 flex-1 justify-center">
            {primaryLinks.map((link) => (
              <Link
                key={link.name}
                href={link.href}
                className={`px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                  transparent
                    ? 'text-white/90 hover:text-white hover:bg-white/10'
                    : 'text-gray-700 hover:text-primary hover:bg-primary/5'
                }`}
              >
                {link.name}
              </Link>
            ))}

            {/* "Más" dropdown for secondary links */}
            <div className="relative">
              <button
                onClick={() => setMoreOpen((v) => !v)}
                onBlur={() => setTimeout(() => setMoreOpen(false), 150)}
                className={`px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all flex items-center gap-1 ${
                  transparent
                    ? 'text-white/90 hover:text-white hover:bg-white/10'
                    : 'text-gray-700 hover:text-primary hover:bg-primary/5'
                }`}
                aria-expanded={moreOpen}
                aria-haspopup="true"
              >
                {t.nav.more || 'Más'} <ChevronDown className={`w-3.5 h-3.5 transition-transform ${moreOpen ? 'rotate-180' : ''}`} />
              </button>
              {moreOpen && (
                <div className="absolute top-full left-0 mt-1 w-44 bg-white rounded-xl shadow-xl border border-gray-100 py-2 overflow-hidden">
                  {secondaryLinks.map((link) => (
                    <Link
                      key={link.name}
                      href={link.href}
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-primary/5 hover:text-primary transition"
                    >
                      {link.name}
                    </Link>
                  ))}
                  <Link
                    href="/invest"
                    className="block px-4 py-2 text-sm text-primary font-semibold hover:bg-primary/5 transition border-t border-gray-100 mt-1 pt-2"
                  >
                    {t.nav.invest || 'Invertir'}
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT — CTAs */}
          <div className="hidden lg:flex items-center gap-2 flex-shrink-0">
            {/* Invest highlighted */}
            <Link
              href="/invest"
              className={`px-3 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all hidden xl:block ${
                transparent
                  ? 'text-amber-300 hover:text-white hover:bg-white/10'
                  : 'text-amber-600 hover:bg-amber-50'
              }`}
            >
              💎 {t.nav.invest || 'Invertir'}
            </Link>

            {/* Tenant portal */}
            <Link
              href="/tenant"
              className={`px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all border ${
                transparent
                  ? 'text-white/90 hover:bg-white/10 border-white/30'
                  : 'text-charcoal hover:bg-gray-50 border-gray-200'
              }`}
            >
              {t.nav.tenantPortal}
            </Link>

            {/* Lang toggle */}
            <button
              onClick={toggleLang}
              aria-label="Toggle language"
              className={`p-2 rounded-lg transition-all flex items-center gap-1 ${
                transparent
                  ? 'text-white/80 hover:text-white hover:bg-white/10'
                  : 'text-gray-600 hover:text-primary hover:bg-primary/5'
              }`}
            >
              <Globe className="w-4 h-4" />
              <span className="text-xs font-bold">{t.lang.label}</span>
            </button>

            {/* Theme toggle */}
            <ThemeToggle variant="icon-only" />

            {/* Phone CTA */}
            <a
              href="tel:+18069342018"
              className="bg-primary hover:bg-primary-dark text-white px-4 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-md hover:shadow-lg flex items-center gap-1.5 whitespace-nowrap"
            >
              <Phone className="w-4 h-4" />
              <span className="hidden xl:inline">(806) 934-2018</span>
              <span className="xl:hidden">Llamar</span>
            </a>
          </div>

          {/* MOBILE — Hamburger */}
          <div className="flex items-center gap-1 lg:hidden flex-shrink-0">
            <ThemeToggle variant="icon-only" />
            <button
              onClick={toggleLang}
              aria-label="Toggle language"
              className={`p-2 rounded-lg text-xs font-bold transition-all ${
                transparent ? 'text-white bg-white/10' : 'text-primary bg-primary/10'
              }`}
            >
              {t.lang.label}
            </button>
            <a
              href="tel:+18069342018"
              aria-label="Llamar"
              className="p-2 rounded-lg bg-primary text-white"
            >
              <Phone className="w-5 h-5" />
            </a>
            <button
              onClick={() => setIsOpen((v) => !v)}
              aria-label={isOpen ? 'Cerrar menú' : 'Abrir menú'}
              aria-expanded={isOpen}
              className={`p-2 rounded-lg transition-all ${
                transparent ? 'text-white hover:bg-white/10' : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* MOBILE DRAWER */}
        {isOpen && (
          <div className="lg:hidden mt-3 py-2 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
            {[...primaryLinks, ...secondaryLinks].map((link) => (
              <Link
                key={link.name}
                href={link.href}
                onClick={() => setIsOpen(false)}
                className="block px-5 py-3 text-gray-700 hover:bg-primary/5 hover:text-primary font-medium transition"
              >
                {link.name}
              </Link>
            ))}
            <Link
              href="/invest"
              onClick={() => setIsOpen(false)}
              className="block px-5 py-3 text-amber-600 font-semibold hover:bg-amber-50 transition border-t border-gray-100"
            >
              💎 {t.nav.invest || 'Invertir'}
            </Link>
            <Link
              href="/tenant"
              onClick={() => setIsOpen(false)}
              className="block px-5 py-3 text-charcoal font-medium hover:bg-gray-50 transition"
            >
              {t.nav.tenantPortal}
            </Link>
            <div className="px-4 py-3 border-t border-gray-100">
              <a
                href="tel:+18069342018"
                className="flex items-center justify-center gap-2 bg-primary text-white px-4 py-3 rounded-xl font-semibold"
              >
                <Phone className="w-4 h-4" /> (806) 934-2018
              </a>
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}
