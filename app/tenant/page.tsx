'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Home, Mail, Phone, Lock, ArrowRight, Shield, Eye, EyeOff } from 'lucide-react'
import Link from 'next/link'

const API_URL = 'https://app-nueva-production.up.railway.app/api'

export default function TenantLogin() {
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPhone, setShowPhone] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch(`${API_URL}/tenant/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          phone: phone.replace(/\D/g, ''),
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.detail || 'Invalid credentials')
        setLoading(false)
        return
      }

      localStorage.setItem('tenant_token', data.token)
      localStorage.setItem('tenant_info', JSON.stringify(data.tenant))
      window.location.href = '/tenant/dashboard'
    } catch {
      setError('Connection error. Please try again.')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-dark via-primary to-primary/90 flex flex-col">
      {/* Nav */}
      <nav className="w-full py-4 px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center">
              <Home className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-display font-bold text-white text-lg leading-tight">Ross House Rentals</div>
              <div className="text-white/60 text-[10px] uppercase tracking-widest">Dumas, Texas</div>
            </div>
          </Link>
          <Link href="/" className="text-white/70 hover:text-white text-sm font-medium transition-colors">
            ← Back to Home
          </Link>
        </div>
      </nav>

      {/* Login Card */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-md"
        >
          <div className="text-center mb-8">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring' }}
              className="w-20 h-20 rounded-3xl bg-accent/20 backdrop-blur-sm border border-accent/30 flex items-center justify-center mx-auto mb-5"
            >
              <Shield className="w-10 h-10 text-accent" />
            </motion.div>
            <h1 className="font-display text-3xl font-bold text-white mb-2">Tenant Portal</h1>
            <p className="text-white/60 text-sm">Sign in with your email and phone number to access your account</p>
          </div>

          <form onSubmit={handleLogin} className="bg-white/10 backdrop-blur-xl rounded-3xl p-8 border border-white/20 shadow-2xl space-y-5">
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-red-500/20 border border-red-400/30 text-red-100 px-4 py-3 rounded-xl text-sm text-center"
              >
                {error}
              </motion.div>
            )}

            <div>
              <label className="block text-white/80 text-xs font-bold uppercase tracking-wider mb-2">
                <Mail className="w-3.5 h-3.5 inline mr-1.5" /> Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full px-4 py-3.5 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/40 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50 transition-all"
              />
            </div>

            <div>
              <label className="block text-white/80 text-xs font-bold uppercase tracking-wider mb-2">
                <Phone className="w-3.5 h-3.5 inline mr-1.5" /> Phone Number
              </label>
              <div className="relative">
                <input
                  type={showPhone ? 'text' : 'password'}
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Last 4 digits or full number"
                  className="w-full px-4 py-3.5 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/40 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50 transition-all pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPhone(!showPhone)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition-colors"
                >
                  {showPhone ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              <p className="text-white/40 text-xs mt-1.5">Enter the last 4 digits of your phone number on file, or the full number.</p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-accent hover:bg-amber-500 text-white py-4 rounded-2xl font-bold text-lg transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Sign In <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>

            <div className="text-center pt-2">
              <p className="text-white/40 text-xs">Need help? Contact us at <a href="tel:+18069342018" className="text-accent hover:text-amber-400 transition-colors">(806) 934-2018</a></p>
            </div>
          </form>

          <div className="mt-6 text-center">
            <p className="text-white/30 text-xs">🔒 Secure login • Your data is protected</p>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
