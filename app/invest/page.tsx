'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  TrendingUp, DollarSign, Home, BarChart3, Percent, Activity,
  Shield, Users, ArrowRight, Phone,
  Building, Target, Award, Briefcase, PiggyBank, ChevronRight, Globe, Mail
} from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useLanguage } from '../i18n/LanguageContext'

// Market-data endpoint (relative — Vercel proxies /api/* to the real Railway backend).
const MARKET_DATA_URL = '/api/admin/market-data/city/TX/Dumas'

const COPY = {
  es: {
    badgeHeader: 'Oportunidades de Inversión',
    backHome: '← Inicio',
    contactCta: 'Contáctanos',
    heroBadge: 'Oportunidad de Inversión Inmobiliaria',
    heroTitleA: 'Invierte en Bienes Raíces en',
    heroTitleB: 'Dumas, Texas',
    heroSubtitle: 'Descubre por qué Dumas es uno de los secretos mejor guardados para inversores inmobiliarios: bajo costo de entrada, alta demanda de alquiler y un equipo local con 15+ años de experiencia.',
    viewMarket: 'Ver Datos del Mercado',
    startInvesting: 'Empezar a Invertir',
    whyDumasEyebrow: 'Por qué Dumas, TX',
    whyDumasTitle: 'Una Inversión Inteligente',
    whyDumasSubtitle: 'Dumas ofrece una combinación única de accesibilidad, demanda y potencial de crecimiento que los mercados más grandes simplemente no pueden igualar.',
    items: [
      { title: 'Bajo Costo de Entrada', desc: 'Propiedades muy por debajo del precio mediano nacional — construye tu portafolio más rápido con menos capital.' },
      { title: 'Alta Demanda', desc: 'Demanda sólida de alquiler impulsada por la industria de petróleo y gas, agricultura y familias en crecimiento.' },
      { title: 'ROI Sólido', desc: 'Los retornos tradicionales de alquiler superan consistentemente los promedios nacionales con inquilinos estables a largo plazo.' },
      { title: 'Gestión Profesional', desc: 'Estamos tramitando nuestra licencia de bienes raíces de Texas. Q4 2026 · 2027. Únete a la lista de espera para ser notificado cuando esté disponible.', comingSoon: true },
      { title: 'Equipo Bilingüe', desc: 'Atendemos a la comunidad fluidamente en inglés y español, maximizando tu base de inquilinos potenciales.' },
      { title: '15+ Años de Experiencia', desc: 'Profundo conocimiento del mercado local y relaciones establecidas con contratistas, proveedores e inquilinos.' },
    ],
    marketEyebrow: 'Datos del Mercado en Vivo',
    marketTitle: 'Métricas de Inversión en Dumas, TX',
    marketSubtitle: 'Datos en tiempo real de Mashvisor® que muestran por qué Dumas es un excelente mercado para inversión en alquileres.',
    metricLabels: ['Precio Mediano', 'Propiedades de Inversión', 'Cap Rate', 'ROI Cash-on-Cash', 'Ocupación', 'Renta Promedio'],
    loadingMarket: 'Cargando datos del mercado...',
    rentalRatesTitle: 'Tarifas de Renta por Tamaño',
    sizeLabels: { studio: 'Estudio', '1br': '1 Recámara', '2br': '2 Recámaras', '3br': '3 Recámaras', '4br': '4 Recámaras' },
    scenarioTitle: 'Escenario de Inversión',
    scenarioBuy: (price: string) => `Compra una propiedad de ${price}`,
    monthlyRent: 'Renta Mensual',
    capRate: 'Cap Rate Anual',
    scenarioFooter: 'Con un equipo local bilingüe de confianza y 15+ años operando propiedades en Dumas, tu inversión está en buenas manos. La administración a terceros con licencia estará disponible próximamente (Q4 2026 · 2027).',
    mashvisorNote: 'Datos provistos por Mashvisor® vía RapidAPI · Actualizados regularmente',
    marketSoonTitle: 'Datos del Mercado Próximamente',
    marketSoonText: 'Contáctanos directamente para las últimas métricas y propiedades disponibles.',
    howEyebrow: 'Cómo Empezar',
    howTitle: 'Cómo Invertir con Nosotros',
    steps: [
      { title: 'Consulta Inicial', desc: 'Agenda una llamada para discutir tus metas, presupuesto y plazos. Compartimos nuestra experiencia del mercado.' },
      { title: 'Selección de Propiedad', desc: 'Identificamos propiedades que cumplan tus criterios y entregamos análisis detallado de ROI, condición y comparables.' },
      { title: 'Soporte de Adquisición', desc: 'Te guiamos en el proceso de compra y te conectamos con prestamistas, inspectores y agentes de cierre locales.' },
      { title: 'Administración (Próximamente)', desc: 'Estamos tramitando nuestra licencia de bienes raíces de Texas. Q4 2026 · 2027. Únete a la lista de espera.', comingSoon: true },
    ],
    stepLabel: 'PASO',
    ctaTitle: '¿Listo para Construir tu Portafolio?',
    ctaSubtitle: 'Contáctanos hoy para una consulta gratuita. Te ayudaremos a analizar propiedades, entender el mercado y empezar a generar ingresos por alquiler.',
    whatsappUs: 'Escríbenos por WhatsApp',
    emailUs: 'Envíanos un Email',
    footerAddress: '305 Bruce Ave, Dumas, TX 79029',
    footerHome: 'Inicio',
    footerTenant: 'Portal de Inquilinos',
    footerRights: 'Todos los derechos reservados.',
    langToggle: 'English',
  },
  en: {
    badgeHeader: 'Investment Opportunities',
    backHome: '← Home',
    contactCta: 'Contact Us',
    heroBadge: 'Real Estate Investment Opportunity',
    heroTitleA: 'Invest in',
    heroTitleB: 'Dumas, Texas Real Estate',
    heroSubtitle: "Discover why Dumas is one of the best-kept secrets for real estate investors: low entry costs, strong rental demand, and an experienced local team with 15+ years in the market.",
    viewMarket: 'View Market Data',
    startInvesting: 'Start Investing',
    whyDumasEyebrow: 'Why Dumas, TX',
    whyDumasTitle: 'A Smart Investment Choice',
    whyDumasSubtitle: "Dumas offers a unique combination of affordability, demand, and growth potential that larger markets simply can't match.",
    items: [
      { title: 'Low Entry Cost', desc: 'Properties significantly below the national median — build a portfolio faster with less capital.' },
      { title: 'High Demand', desc: 'Strong rental demand driven by the oil & gas industry, agriculture, and growing families in the region.' },
      { title: 'Strong ROI', desc: 'Traditional rental returns consistently outperform national averages with stable, long-term tenants.' },
      { title: 'Professional Management', desc: 'We\'re obtaining our Texas real estate license. Q4 2026 · 2027. Join the waitlist to be notified when available.', comingSoon: true },
      { title: 'Bilingual Team', desc: 'We serve a diverse community fluently in English and Spanish, maximizing your tenant pool.' },
      { title: '15+ Years Experience', desc: 'Deep local market knowledge and established relationships with contractors, vendors, and tenants.' },
    ],
    marketEyebrow: 'Live Market Data',
    marketTitle: 'Dumas, TX Investment Metrics',
    marketSubtitle: 'Real-time data powered by Mashvisor® showing why Dumas is an excellent market for rental property investment.',
    metricLabels: ['Median Price', 'Investment Properties', 'Cap Rate', 'Cash-on-Cash ROI', 'Occupancy Rate', 'Avg. Rental Income'],
    loadingMarket: 'Loading market data...',
    rentalRatesTitle: 'Rental Rates by Size',
    sizeLabels: { studio: 'Studio', '1br': '1 Bedroom', '2br': '2 Bedrooms', '3br': '3 Bedrooms', '4br': '4 Bedrooms' },
    scenarioTitle: 'Investment Scenario',
    scenarioBuy: (price: string) => `Purchase a ${price} property`,
    monthlyRent: 'Monthly Rent',
    capRate: 'Annual Cap Rate',
    scenarioFooter: 'With a trusted local bilingual team and 15+ years operating properties in Dumas, your investment is in good hands. Licensed third-party property management coming soon (Q4 2026 · 2027).',
    mashvisorNote: 'Data provided by Mashvisor® via RapidAPI · Updated regularly',
    marketSoonTitle: 'Market Data Coming Soon',
    marketSoonText: 'Contact us directly for the latest investment metrics and available properties.',
    howEyebrow: 'Getting Started',
    howTitle: 'How to Invest with Us',
    steps: [
      { title: 'Initial Consultation', desc: "Schedule a call to discuss your investment goals, budget, and timeline. We'll share our market expertise." },
      { title: 'Property Selection', desc: 'We identify properties that match your criteria, providing detailed analysis on ROI, condition, and market comparables.' },
      { title: 'Acquisition Support', desc: 'We guide you through the purchase process, connecting you with local lenders, inspectors, and closing agents.' },
      { title: 'Property Management (Coming Soon)', desc: 'We\'re obtaining our Texas real estate license. Q4 2026 · 2027. Join the waitlist.', comingSoon: true },
    ],
    stepLabel: 'STEP',
    ctaTitle: 'Ready to Build Your Portfolio?',
    ctaSubtitle: "Contact us today for a free consultation. We'll help you analyze properties, understand the market, and start generating rental income.",
    whatsappUs: 'WhatsApp Us',
    emailUs: 'Email Us',
    footerAddress: '305 Bruce Ave, Dumas, TX 79029',
    footerHome: 'Home',
    footerTenant: 'Tenant Portal',
    footerRights: 'All rights reserved.',
    langToggle: 'Español',
  },
}

const ITEM_ICONS = [PiggyBank, Target, TrendingUp, Shield, Users, Award]
const ITEM_COLORS = ['bg-primary/10 text-primary', 'bg-secondary/10 text-secondary', 'bg-accent/10 text-accent', 'bg-purple-100 text-purple-600', 'bg-blue-100 text-blue-600', 'bg-green-100 text-green-600']
const STEP_ICONS = [Phone, Home, Building, Shield]

export default function InvestPage() {
  const { lang, toggleLang } = useLanguage() as any
  const isEs = (lang || 'es') === 'es'
  const t = isEs ? COPY.es : COPY.en

  const [marketData, setMarketData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(MARKET_DATA_URL)
      .then(r => r.json())
      .then(d => { setMarketData(d.market_data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const fmtC = (n: number) => `$${(n || 0).toLocaleString(isEs ? 'es-MX' : 'en-US', { maximumFractionDigits: 0 })}`

  return (
    <div className="min-h-screen bg-white">
      {/* Nav with official logo */}
      <nav className="fixed w-full z-50 bg-white/95 backdrop-blur-md shadow-sm py-3">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-3 min-w-0">
            <Image
              src="/logo.jpg"
              alt="Ross House Rentals LLC"
              width={56}
              height={56}
              className="rounded-xl object-contain w-12 h-12 sm:w-14 sm:h-14 flex-shrink-0"
            />
            <div className="min-w-0">
              <div className="font-display font-bold text-primary text-base sm:text-lg leading-tight truncate">Ross House Rentals</div>
              <div className="text-gray-400 text-[10px] uppercase tracking-widest truncate">{t.badgeHeader}</div>
            </div>
          </Link>
          <div className="flex items-center gap-1.5 sm:gap-3 flex-shrink-0">
            <button
              onClick={toggleLang}
              className="hidden sm:flex items-center gap-1.5 text-gray-500 hover:text-primary text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-gray-200 hover:border-primary/40 transition"
            >
              <Globe className="w-3.5 h-3.5" /> {t.langToggle}
            </button>
            <Link href="/" className="text-gray-500 hover:text-primary text-sm font-medium transition-colors hidden md:block">
              {t.backHome}
            </Link>
            <a href="tel:+18069342018" className="bg-accent hover:bg-amber-500 text-white px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-xl font-semibold text-xs sm:text-sm transition-all shadow-md flex items-center gap-1.5 whitespace-nowrap">
              <Phone className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> <span className="hidden xs:inline">{t.contactCta}</span><span className="xs:hidden">Call</span>
            </a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-20 bg-gradient-to-br from-charcoal via-gray-900 to-primary-dark text-white overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23ffffff' fill-opacity='0.3'%3E%3Cpath d='M0 40L40 0H20L0 20M40 40V20L20 40'/%3E%3C/g%3E%3C/svg%3E")` }} />
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-20 md:py-32 relative z-10">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 bg-accent/20 border border-accent/30 text-accent px-4 py-2 rounded-full text-sm font-semibold mb-6">
              <TrendingUp className="w-4 h-4" /> {t.heroBadge}
            </div>
            <h1 className="font-display text-3xl sm:text-4xl md:text-6xl font-bold mb-6 leading-tight">
              {t.heroTitleA} <span className="text-accent">{t.heroTitleB}</span>
            </h1>
            <p className="text-lg md:text-xl text-white/70 mb-10 max-w-2xl mx-auto leading-relaxed">{t.heroSubtitle}</p>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
              <a href="#market-data" className="bg-accent hover:bg-amber-500 text-white px-6 md:px-8 py-3 md:py-4 rounded-2xl font-bold text-base md:text-lg transition-all shadow-xl flex items-center justify-center gap-2">
                <BarChart3 className="w-5 h-5" /> {t.viewMarket}
              </a>
              <a href="#contact-investor" className="bg-white/10 hover:bg-white/20 backdrop-blur-sm border-2 border-white/30 text-white px-6 md:px-8 py-3 md:py-4 rounded-2xl font-bold text-base md:text-lg transition-all flex items-center justify-center gap-2">
                {t.startInvesting} <ArrowRight className="w-5 h-5" />
              </a>
            </div>
          </motion.div>
        </div>
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 80" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full">
            <path d="M0 80L48 73.3C96 66.7 192 53.3 288 48C384 42.7 480 45.3 576 50.7C672 56 768 64 864 64C960 64 1056 56 1152 50.7C1248 45.3 1344 42.7 1392 41.3L1440 40V80H1392C1344 80 1248 80 1152 80C1056 80 960 80 864 80C768 80 672 80 576 80C480 80 384 80 288 80C192 80 96 80 48 80H0Z" fill="white" />
          </svg>
        </div>
      </section>

      {/* Why Dumas */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
            <span className="text-secondary font-semibold text-sm uppercase tracking-widest">{t.whyDumasEyebrow}</span>
            <h2 className="font-display text-3xl md:text-5xl font-bold text-charcoal mt-3 mb-4">{t.whyDumasTitle}</h2>
            <p className="text-gray-500 text-base md:text-lg max-w-2xl mx-auto">{t.whyDumasSubtitle}</p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            {t.items.map((item, i) => {
              const Ic = ITEM_ICONS[i]
              const color = ITEM_COLORS[i]
              return (
                <motion.div key={item.title} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                  className="bg-white rounded-3xl p-6 md:p-8 shadow-sm hover:shadow-xl transition-all duration-500 border border-gray-100 group hover:-translate-y-1">
                  <div className={`w-14 h-14 rounded-2xl ${color} flex items-center justify-center mb-5 group-hover:scale-110 transition-transform`}>
                    <Ic className="w-7 h-7" />
                  </div>
                  <h3 className="font-display text-xl font-bold text-charcoal mb-3">{item.title}</h3>
                  <p className="text-gray-500 leading-relaxed">{item.desc}</p>
                </motion.div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Market Data */}
      <section id="market-data" className="py-24 bg-gradient-to-br from-charcoal via-gray-900 to-primary-dark text-white relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
            <span className="text-accent font-bold text-sm uppercase tracking-widest">{t.marketEyebrow}</span>
            <h2 className="font-display text-3xl md:text-5xl font-bold mt-3 mb-4 text-white">{t.marketTitle}</h2>
            <p className="text-slate-200 text-base md:text-lg max-w-2xl mx-auto">{t.marketSubtitle}</p>
          </motion.div>

          {loading ? (
            <div className="text-center py-12"><div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto" /><p className="text-slate-300 mt-3">{t.loadingMarket}</p></div>
          ) : marketData ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-5 mb-12">
                {[
                  { icon: DollarSign, value: fmtC(marketData.median_price), color: 'from-primary to-primary-dark' },
                  { icon: Home, value: String(marketData.investment_properties || 0), color: 'from-secondary to-teal-700' },
                  { icon: Percent, value: `${(marketData.traditional_cap_rate || 0).toFixed(1)}%`, color: 'from-accent to-amber-600' },
                  { icon: BarChart3, value: `${(marketData.traditional_coc || 0).toFixed(1)}%`, color: 'from-green-500 to-green-700' },
                  { icon: Activity, value: `${marketData.occupancy || 0}%`, color: 'from-blue-500 to-blue-700' },
                  { icon: TrendingUp, value: fmtC(marketData.traditional_rental), color: 'from-purple-500 to-purple-700' },
                ].map((m, i) => (
                  <motion.div key={t.metricLabels[i]} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}
                    className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-4 md:p-5 text-center hover:bg-white/15 hover:border-white/30 transition-all group shadow-lg">
                    <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${m.color} flex items-center justify-center mx-auto mb-3 shadow-lg group-hover:scale-110 transition-transform`}>
                      <m.icon className="w-5 h-5 text-white" />
                    </div>
                    <div className="text-xl md:text-2xl font-display font-bold text-white">{m.value}</div>
                    <div className="text-xs font-semibold text-slate-200 mt-1">{t.metricLabels[i]}</div>
                  </motion.div>
                ))}
              </div>

              {marketData.traditional_rental_rates && (
                <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="grid md:grid-cols-2 gap-6">
                  <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-3xl p-6 md:p-8 shadow-xl">
                    <h3 className="font-display text-xl font-bold mb-5 flex items-center gap-2 text-white"><Home className="w-5 h-5 text-secondary" /> {t.rentalRatesTitle}</h3>
                    <div className="space-y-3">
                      {Object.entries(marketData.traditional_rental_rates)
                        .filter(([, v]) => v !== null)
                        .map(([k, v]: [string, any]) => {
                          const sizeMap: Record<string, keyof typeof t.sizeLabels> = {
                            zeroBedRoomHomeValue: 'studio', oneBedRoomHomeValue: '1br',
                            twoBedRoomsHomeValue: '2br', threeBedRoomsHomeValue: '3br',
                            fourBedRoomsHomeValue: '4br',
                          }
                          const lbl = (t.sizeLabels as any)[sizeMap[k] || ''] || k
                          return (
                            <div key={k} className="flex items-center justify-between bg-white/10 border border-white/10 rounded-xl px-4 py-3">
                              <span className="text-slate-100 text-sm font-medium">{lbl}</span>
                              <span className="text-secondary font-bold text-base">{fmtC(v)}/mo</span>
                            </div>
                          )
                        })}
                    </div>
                  </div>
                  <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-3xl p-6 md:p-8 shadow-xl">
                    <h3 className="font-display text-xl font-bold mb-5 flex items-center gap-2 text-white"><Briefcase className="w-5 h-5 text-accent" /> {t.scenarioTitle}</h3>
                    <div className="space-y-4">
                      <div className="bg-white/10 border border-white/10 rounded-xl p-5">
                        <p className="text-slate-200 text-sm mb-2 font-medium">{t.scenarioBuy(fmtC(marketData.median_price))}</p>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs text-slate-300 font-semibold">{t.monthlyRent}</p>
                            <p className="text-lg font-display font-bold text-secondary">{fmtC(marketData.traditional_rental)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-300 font-semibold">{t.capRate}</p>
                            <p className="text-lg font-display font-bold text-accent">{(marketData.traditional_cap_rate || 0).toFixed(1)}%</p>
                          </div>
                        </div>
                      </div>
                      <p className="text-slate-100 text-sm leading-relaxed">{t.scenarioFooter}</p>
                    </div>
                  </div>
                </motion.div>
              )}

              <div className="text-center mt-8">
                <p className="text-xs text-slate-300">{t.mashvisorNote}</p>
              </div>
            </>
          ) : (
            <div className="text-center py-12">
              <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-3xl p-12 max-w-2xl mx-auto">
                <BarChart3 className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <h3 className="text-xl font-bold mb-2 text-white">{t.marketSoonTitle}</h3>
                <p className="text-slate-200">{t.marketSoonText}</p>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
            <span className="text-secondary font-semibold text-sm uppercase tracking-widest">{t.howEyebrow}</span>
            <h2 className="font-display text-3xl md:text-5xl font-bold text-charcoal mt-3 mb-4">{t.howTitle}</h2>
          </motion.div>

          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
            {t.steps.map((item, i) => {
              const Ic = STEP_ICONS[i]
              return (
                <motion.div key={item.title} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.15 }}
                  className="text-center relative">
                  <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-5">
                    <Ic className="w-8 h-8 text-primary" />
                  </div>
                  <div className="text-xs text-accent font-bold mb-2">{t.stepLabel} {String(i + 1).padStart(2, '0')}</div>
                  <h3 className="font-display text-lg font-bold text-charcoal mb-2">{item.title}</h3>
                  <p className="text-gray-500 text-sm leading-relaxed">{item.desc}</p>
                  {i < t.steps.length - 1 && <ChevronRight className="hidden md:block w-6 h-6 text-gray-300 absolute -right-3 top-8" />}
                </motion.div>
              )
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="contact-investor" className="py-24 bg-warm/40 bg-mesh">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <h2 className="font-display text-3xl md:text-5xl font-bold text-charcoal mb-6">{t.ctaTitle}</h2>
            <p className="text-gray-500 text-base md:text-lg mb-10 max-w-2xl mx-auto">{t.ctaSubtitle}</p>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
              <a href="tel:+18069342018" className="bg-primary hover:bg-primary-dark text-white px-6 md:px-8 py-3 md:py-4 rounded-2xl font-bold text-base md:text-lg transition-all shadow-xl flex items-center justify-center gap-3">
                <Phone className="w-5 h-5" /> (806) 934-2018
              </a>
              <a href={`https://wa.me/18069342018?text=${encodeURIComponent(isEs ? 'Hola! Me interesa invertir en propiedades de alquiler en Dumas.' : "Hi! I'm interested in investing in Dumas rental properties.")}`} target="_blank" rel="noreferrer"
                className="bg-green-600 hover:bg-green-700 text-white px-6 md:px-8 py-3 md:py-4 rounded-2xl font-bold text-base md:text-lg transition-all shadow-xl flex items-center justify-center gap-3">
                {t.whatsappUs} <ArrowRight className="w-5 h-5" />
              </a>
              <a href={`mailto:info@rosshouserentals.com?subject=${encodeURIComponent(isEs ? 'Consulta de Inversión' : 'Investment Inquiry')}`} className="bg-white hover:bg-gray-50 text-charcoal border-2 border-gray-200 px-6 md:px-8 py-3 md:py-4 rounded-2xl font-bold text-base md:text-lg transition-all flex items-center justify-center gap-3">
                <Mail className="w-5 h-5" /> {t.emailUs}
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer with official logo */}
      <footer className="bg-charcoal text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Image
              src="/logo.jpg"
              alt="Ross House Rentals LLC"
              width={64}
              height={64}
              className="rounded-xl object-contain w-14 h-14"
            />
            <div className="font-display font-bold text-xl">Ross House Rentals LLC</div>
          </div>
          <p className="text-slate-200 mb-4">{t.footerAddress} · <a href="tel:+18069342018" className="hover:text-accent transition font-semibold">(806) 934-2018</a></p>
          <div className="flex justify-center gap-4 sm:gap-6 flex-wrap">
            <Link href="/" className="text-slate-200 hover:text-accent text-sm transition-colors">{t.footerHome}</Link>
            <Link href="/tenant" className="text-slate-200 hover:text-accent text-sm transition-colors">{t.footerTenant}</Link>
            <button onClick={toggleLang} className="text-slate-200 hover:text-accent text-sm transition-colors flex items-center gap-1">
              <Globe className="w-3.5 h-3.5" /> {t.langToggle}
            </button>
          </div>
          <p className="text-slate-400 text-xs mt-6">© {new Date().getFullYear()} Ross House Rentals LLC. {t.footerRights}</p>
        </div>
      </footer>
    </div>
  )
}
