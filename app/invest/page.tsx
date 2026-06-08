'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  TrendingUp, DollarSign, Home, BarChart3, Percent, Activity,
  MapPin, Shield, Users, CheckCircle, ArrowRight, Phone,
  Building, Target, Award, Briefcase, PiggyBank, ChevronRight
} from 'lucide-react'
import Link from 'next/link'

const API_URL = 'https://app-nueva-production.up.railway.app/api'

export default function InvestPage() {
  const [marketData, setMarketData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${API_URL}/admin/market-data/city/TX/Dumas`)
      .then(r => r.json())
      .then(d => { setMarketData(d.market_data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const fmtC = (n: number) => `$${(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`

  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="fixed w-full z-50 bg-white/95 backdrop-blur-md shadow-sm py-3">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <Home className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-display font-bold text-primary text-lg leading-tight">Ross House Rentals</div>
              <div className="text-gray-400 text-[10px] uppercase tracking-widest">Investment Opportunities</div>
            </div>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/" className="text-gray-500 hover:text-primary text-sm font-medium transition-colors hidden sm:block">← Home</Link>
            <a href="tel:+18069342018" className="bg-accent hover:bg-amber-500 text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-md flex items-center gap-2">
              <Phone className="w-4 h-4" /> Contact Us
            </a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-20 bg-gradient-to-br from-charcoal via-gray-900 to-primary-dark text-white overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23ffffff' fill-opacity='0.3'%3E%3Cpath d='M0 40L40 0H20L0 20M40 40V20L20 40'/%3E%3C/g%3E%3C/svg%3E")` }}></div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-24 md:py-32 relative z-10">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 bg-accent/20 border border-accent/30 text-accent px-4 py-2 rounded-full text-sm font-semibold mb-6">
              <TrendingUp className="w-4 h-4" /> Real Estate Investment Opportunity
            </div>
            <h1 className="font-display text-4xl md:text-6xl font-bold mb-6 leading-tight">
              Invest in <span className="text-accent">Dumas, Texas</span> Real Estate
            </h1>
            <p className="text-xl text-white/70 mb-10 max-w-2xl mx-auto leading-relaxed">
              Discover why Dumas is one of the best-kept secrets for real estate investors. Low entry costs, strong rental demand, and professional management by Ross House Rentals.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a href="#market-data" className="bg-accent hover:bg-amber-500 text-white px-8 py-4 rounded-2xl font-bold text-lg transition-all shadow-xl flex items-center justify-center gap-2">
                <BarChart3 className="w-5 h-5" /> View Market Data
              </a>
              <a href="#contact-investor" className="bg-white/10 hover:bg-white/20 backdrop-blur-sm border-2 border-white/30 text-white px-8 py-4 rounded-2xl font-bold text-lg transition-all flex items-center justify-center gap-2">
                Start Investing <ArrowRight className="w-5 h-5" />
              </a>
            </div>
          </motion.div>
        </div>
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 80" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full">
            <path d="M0 80L48 73.3C96 66.7 192 53.3 288 48C384 42.7 480 45.3 576 50.7C672 56 768 64 864 64C960 64 1056 56 1152 50.7C1248 45.3 1344 42.7 1392 41.3L1440 40V80H1392C1344 80 1248 80 1152 80C1056 80 960 80 864 80C768 80 672 80 576 80C480 80 384 80 288 80C192 80 96 80 48 80H0Z" fill="white"/>
          </svg>
        </div>
      </section>

      {/* Why Dumas */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
            <span className="text-secondary font-semibold text-sm uppercase tracking-widest">Why Dumas, TX</span>
            <h2 className="font-display text-4xl md:text-5xl font-bold text-charcoal mt-3 mb-4">A Smart Investment Choice</h2>
            <p className="text-gray-500 text-lg max-w-2xl mx-auto">Dumas offers a unique combination of affordability, demand, and growth potential that larger markets simply can&apos;t match.</p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              { icon: PiggyBank, title: 'Low Entry Cost', desc: 'Properties significantly below the national median, allowing you to build a portfolio faster with less capital.', color: 'bg-primary/10 text-primary' },
              { icon: Target, title: 'High Demand', desc: 'Strong rental demand driven by the oil & gas industry, agriculture, and growing families in the region.', color: 'bg-secondary/10 text-secondary' },
              { icon: TrendingUp, title: 'Strong ROI', desc: 'Traditional rental returns consistently outperform national averages with stable, long-term tenants.', color: 'bg-accent/10 text-accent' },
              { icon: Shield, title: 'Professional Management', desc: 'Ross House Rentals handles everything — tenant screening, maintenance, rent collection, and compliance.', color: 'bg-purple-100 text-purple-600' },
              { icon: Users, title: 'Bilingual Team', desc: 'We serve a diverse community fluently in English and Spanish, maximizing your tenant pool.', color: 'bg-blue-100 text-blue-600' },
              { icon: Award, title: '15+ Years Experience', desc: 'Deep local market knowledge and established relationships with contractors, vendors, and tenants.', color: 'bg-green-100 text-green-600' },
            ].map((item, i) => (
              <motion.div key={item.title} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                className="bg-white rounded-3xl p-8 shadow-sm hover:shadow-xl transition-all duration-500 border border-gray-100 group hover:-translate-y-1">
                <div className={`w-14 h-14 rounded-2xl ${item.color} flex items-center justify-center mb-5 group-hover:scale-110 transition-transform`}>
                  <item.icon className="w-7 h-7" />
                </div>
                <h3 className="font-display text-xl font-bold text-charcoal mb-3">{item.title}</h3>
                <p className="text-gray-500 leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Market Data */}
      <section id="market-data" className="py-24 bg-gradient-to-br from-charcoal via-gray-900 to-primary-dark text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23ffffff' fill-opacity='0.3'%3E%3Cpath d='M0 40L40 0H20L0 20M40 40V20L20 40'/%3E%3C/g%3E%3C/svg%3E")` }}></div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
            <span className="text-accent font-semibold text-sm uppercase tracking-widest">Live Market Data</span>
            <h2 className="font-display text-4xl md:text-5xl font-bold mt-3 mb-4">Dumas, TX Investment Metrics</h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">Real-time data powered by Mashvisor® showing why Dumas is an excellent market for rental property investment.</p>
          </motion.div>

          {loading ? (
            <div className="text-center py-12"><div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto"></div><p className="text-gray-400 mt-3">Loading market data...</p></div>
          ) : marketData ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-5 mb-12">
                {[
                  { icon: DollarSign, label: 'Median Price', value: fmtC(marketData.median_price), color: 'from-primary to-primary-dark' },
                  { icon: Home, label: 'Investment Properties', value: String(marketData.investment_properties || 0), color: 'from-secondary to-teal-700' },
                  { icon: Percent, label: 'Cap Rate', value: `${(marketData.traditional_cap_rate || 0).toFixed(1)}%`, color: 'from-accent to-amber-600' },
                  { icon: BarChart3, label: 'Cash-on-Cash ROI', value: `${(marketData.traditional_coc || 0).toFixed(1)}%`, color: 'from-green-500 to-green-700' },
                  { icon: Activity, label: 'Occupancy Rate', value: `${marketData.occupancy || 0}%`, color: 'from-blue-500 to-blue-700' },
                  { icon: TrendingUp, label: 'Avg. Rental Income', value: fmtC(marketData.traditional_rental), color: 'from-purple-500 to-purple-700' },
                ].map((m, i) => (
                  <motion.div key={m.label} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}
                    className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-5 text-center hover:bg-white/10 hover:border-white/20 transition-all group">
                    <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${m.color} flex items-center justify-center mx-auto mb-3 shadow-lg group-hover:scale-110 transition-transform`}>
                      <m.icon className="w-5 h-5 text-white" />
                    </div>
                    <div className="text-2xl font-display font-bold text-white">{m.value}</div>
                    <div className="text-xs text-gray-400 mt-1">{m.label}</div>
                  </motion.div>
                ))}
              </div>

              {/* Rental Rates Breakdown */}
              {marketData.traditional_rental_rates && (
                <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="grid md:grid-cols-2 gap-6">
                  <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-8">
                    <h3 className="font-display text-xl font-bold mb-5 flex items-center gap-2"><Home className="w-5 h-5 text-secondary" /> Rental Rates by Size</h3>
                    <div className="space-y-3">
                      {Object.entries(marketData.traditional_rental_rates)
                        .filter(([, v]) => v !== null)
                        .map(([k, v]: [string, any]) => {
                          const labels: Record<string, string> = { zeroBedRoomHomeValue: 'Studio', oneBedRoomHomeValue: '1 Bedroom', twoBedRoomsHomeValue: '2 Bedrooms', threeBedRoomsHomeValue: '3 Bedrooms', fourBedRoomsHomeValue: '4 Bedrooms' }
                          return (
                            <div key={k} className="flex items-center justify-between bg-white/5 rounded-xl px-4 py-3">
                              <span className="text-gray-300 text-sm">{labels[k] || k}</span>
                              <span className="text-secondary font-bold">{fmtC(v)}/mo</span>
                            </div>
                          )
                        })}
                    </div>
                  </div>
                  <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-8">
                    <h3 className="font-display text-xl font-bold mb-5 flex items-center gap-2"><Briefcase className="w-5 h-5 text-accent" /> Investment Scenario</h3>
                    <div className="space-y-4">
                      <div className="bg-white/5 rounded-xl p-5">
                        <p className="text-gray-400 text-sm mb-2">Purchase a {fmtC(marketData.median_price)} property</p>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs text-gray-500">Monthly Rent</p>
                            <p className="text-lg font-display font-bold text-secondary">{fmtC(marketData.traditional_rental)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Annual Cap Rate</p>
                            <p className="text-lg font-display font-bold text-accent">{(marketData.traditional_cap_rate || 0).toFixed(1)}%</p>
                          </div>
                        </div>
                      </div>
                      <p className="text-gray-300 text-sm leading-relaxed">With professional management from Ross House Rentals, your investment is protected and optimized for maximum returns. We handle tenant placement, maintenance, and rent collection.</p>
                    </div>
                  </div>
                </motion.div>
              )}

              <div className="text-center mt-8">
                <p className="text-xs text-gray-500">Data provided by <span className="text-accent font-semibold">Mashvisor®</span> via RapidAPI • Updated regularly</p>
              </div>
            </>
          ) : (
            <div className="text-center py-12">
              <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-12 max-w-2xl mx-auto">
                <BarChart3 className="w-16 h-16 text-gray-500 mx-auto mb-4" />
                <h3 className="text-xl font-bold mb-2">Market Data Coming Soon</h3>
                <p className="text-gray-400">Contact us directly for the latest investment metrics and available properties.</p>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
            <span className="text-secondary font-semibold text-sm uppercase tracking-widest">Getting Started</span>
            <h2 className="font-display text-4xl md:text-5xl font-bold text-charcoal mt-3 mb-4">How to Invest with Us</h2>
          </motion.div>

          <div className="grid md:grid-cols-4 gap-8">
            {[
              { step: '01', title: 'Initial Consultation', desc: 'Schedule a call to discuss your investment goals, budget, and timeline. We\'ll share our market expertise.', icon: Phone },
              { step: '02', title: 'Property Selection', desc: 'We identify properties that match your criteria, providing detailed analysis on ROI, condition, and market comparables.', icon: Home },
              { step: '03', title: 'Acquisition Support', desc: 'We guide you through the purchase process, connecting you with local lenders, inspectors, and closing agents.', icon: Building },
              { step: '04', title: 'Professional Management', desc: 'We take over full management — tenant placement, maintenance, rent collection, and financial reporting.', icon: Shield },
            ].map((item, i) => (
              <motion.div key={item.step} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.15 }}
                className="text-center relative">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-5">
                  <item.icon className="w-8 h-8 text-primary" />
                </div>
                <div className="text-xs text-accent font-bold mb-2">STEP {item.step}</div>
                <h3 className="font-display text-lg font-bold text-charcoal mb-2">{item.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{item.desc}</p>
                {i < 3 && <ChevronRight className="hidden md:block w-6 h-6 text-gray-300 absolute -right-3 top-8" />}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="contact-investor" className="py-24 bg-warm/40 bg-mesh">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <h2 className="font-display text-4xl md:text-5xl font-bold text-charcoal mb-6">Ready to Build Your Portfolio?</h2>
            <p className="text-gray-500 text-lg mb-10 max-w-2xl mx-auto">Contact us today for a free consultation. We&apos;ll help you analyze properties, understand the market, and start generating rental income.</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a href="tel:+18069342018" className="bg-primary hover:bg-primary-dark text-white px-8 py-4 rounded-2xl font-bold text-lg transition-all shadow-xl flex items-center justify-center gap-3">
                <Phone className="w-5 h-5" /> (806) 934-2018
              </a>
              <a href="https://wa.me/18069342018?text=Hi!%20I%27m%20interested%20in%20investing%20in%20Dumas%20rental%20properties." target="_blank"
                className="bg-green-600 hover:bg-green-700 text-white px-8 py-4 rounded-2xl font-bold text-lg transition-all shadow-xl flex items-center justify-center gap-3">
                WhatsApp Us <ArrowRight className="w-5 h-5" />
              </a>
              <a href="mailto:info@rosshouserentals.com?subject=Investment%20Inquiry" className="bg-white hover:bg-gray-50 text-charcoal border-2 border-gray-200 px-8 py-4 rounded-2xl font-bold text-lg transition-all flex items-center justify-center gap-3">
                Email Us
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-charcoal text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <Home className="w-5 h-5 text-white" />
            </div>
            <div className="font-display font-bold text-xl">Ross House Rentals LLC</div>
          </div>
          <p className="text-gray-400 mb-4">305 Bruce Ave, Dumas, TX 79029 • (806) 934-2018</p>
          <div className="flex justify-center gap-6">
            <Link href="/" className="text-gray-400 hover:text-accent text-sm transition-colors">Home</Link>
            <Link href="/tenant" className="text-gray-400 hover:text-accent text-sm transition-colors">Tenant Portal</Link>
          </div>
          <p className="text-gray-500 text-xs mt-6">© {new Date().getFullYear()} Ross House Rentals LLC. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
