'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { TrendingUp, DollarSign, Home, BarChart3, Percent, Activity } from 'lucide-react'

const API_URL = 'https://app-nueva-production.up.railway.app/api'

export default function MarketData() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${API_URL}/admin/market-data/city/TX/Dumas`)
      .then(r => r.json())
      .then(d => { setData(d.market_data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const fmtC = (n: number) => `$${(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`

  const metrics = data ? [
    { icon: DollarSign, label: 'Median Home Price', value: fmtC(data.median_price), color: 'from-primary to-primary-dark' },
    { icon: Home, label: 'Investment Properties', value: String(data.investment_properties || 0), color: 'from-secondary to-teal-700' },
    { icon: Percent, label: 'Traditional Cap Rate', value: `${(data.traditional_cap_rate || 0).toFixed(1)}%`, color: 'from-accent to-amber-600' },
    { icon: BarChart3, label: 'Traditional ROI', value: `${(data.traditional_coc || 0).toFixed(1)}%`, color: 'from-green-500 to-green-700' },
    { icon: Activity, label: 'Airbnb Occupancy', value: `${data.occupancy || 0}%`, color: 'from-blue-500 to-blue-700' },
    { icon: TrendingUp, label: 'Avg. Rental Income', value: fmtC(data.traditional_rental), color: 'from-purple-500 to-purple-700' },
  ] : []

  return (
    <section id="market" className="py-24 bg-gradient-to-br from-charcoal via-gray-900 to-primary-dark text-white relative overflow-hidden">
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23ffffff' fill-opacity='0.3'%3E%3Cpath d='M0 40L40 0H20L0 20M40 40V20L20 40'/%3E%3C/g%3E%3C/svg%3E")` }}></div>
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
          <span className="text-accent font-semibold text-sm uppercase tracking-widest">Real-Time Market Data</span>
          <h2 className="font-display text-4xl md:text-5xl font-bold mt-3 mb-4">Dumas, TX Real Estate Market</h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">Live investment metrics powered by Mashvisor&reg; to help you make informed decisions about the Dumas rental market.</p>
        </motion.div>

        {loading ? (
          <div className="text-center py-12"><div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto"></div></div>
        ) : data ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-5">
              {metrics.map((m, i) => (
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

            {(data.traditional_rental_rates || data.airbnb_rental_rates) && (
              <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.3 }}
                className="mt-12 grid md:grid-cols-2 gap-6">
                <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-8">
                  <h3 className="font-display text-xl font-bold mb-5 flex items-center gap-2"><Home className="w-5 h-5 text-secondary" /> Traditional Rental Rates</h3>
                  <div className="space-y-3">
                    {data.traditional_rental_rates && Object.entries(data.traditional_rental_rates)
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
                  <h3 className="font-display text-xl font-bold mb-5 flex items-center gap-2"><BarChart3 className="w-5 h-5 text-accent" /> Why Invest in Dumas?</h3>
                  <div className="space-y-4">
                    <div className="bg-white/5 rounded-xl p-4">
                      <p className="text-gray-400 text-sm mb-1">Portfolio Value (Avg)</p>
                      <p className="text-2xl font-display font-bold text-accent">{fmtC(data.median_price)}</p>
                    </div>
                    <p className="text-gray-300 text-sm leading-relaxed">With a traditional Cap Rate of <span className="text-secondary font-bold">{(data.traditional_cap_rate || 0).toFixed(1)}%</span> and consistent rental demand, Dumas offers a solid opportunity for real estate investment. Our property management expertise ensures your investment is protected and performing.</p>
                    <a href="#contact" className="inline-flex items-center gap-2 text-accent hover:text-amber-400 font-semibold text-sm transition-colors">Learn About Investing →</a>
                  </div>
                </div>
              </motion.div>
            )}

            <div className="text-center mt-8">
              <p className="text-xs text-gray-500">Data provided by <span className="text-accent font-semibold">Mashvisor&reg;</span> via RapidAPI &bull; Updated daily</p>
            </div>
          </>
        ) : (
          <div className="text-center py-12 text-gray-500">Market data temporarily unavailable</div>
        )}
      </div>
    </section>
  )
}
