'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Home, LogOut, DollarSign, FileText, Calendar, Clock,
  CheckCircle, AlertCircle, Wrench, Send, ChevronDown,
  ChevronUp, Phone, MapPin, User, CreditCard,
  ArrowRight, Shield, Smartphone, Building, Banknote,
  Copy, ExternalLink, Check, X, Info
} from 'lucide-react'
import Link from 'next/link'

const API_URL = 'https://app-nueva-production.up.railway.app/api'

interface DashboardData {
  tenant: { name: string; email: string; phone: string; tenant_number: string }
  contract: {
    id: string; contract_number: string; property_address: string;
    start_date: string; end_date: string; rent_amount: number;
    deposit_amount: number; payment_due_day: number;
    late_fee_amount: number; late_fee_grace_days: number; status: string;
  } | null
  next_payment: { due_date: string; amount: number; current_month_paid: boolean } | null
  payments: Array<{
    id: string; receipt_number: string; amount: number; late_fee: number;
    total_paid: number; payment_method: string; period_month: string;
    period_year: number; payment_date: string; status: string;
  }>
  property: { address: string; city: string; state: string; bedrooms: number; bathrooms: number } | null
}

interface MaintenanceRequest {
  id: string; title: string; description: string; category: string;
  priority: string; status: string; created_at: string; updated_at: string;
}

interface PaymentConfig {
  rent_amount: number; late_fee: number; due_day: number;
  current_month_paid: boolean; current_month: string; contract_id: string | null;
  payment_methods: {
    zelle: { enabled: boolean; email: string; phone: string; name: string };
    cashapp: { enabled: boolean; tag: string };
    bank_transfer: { enabled: boolean; bank_name: string; account_name: string };
    money_order: { enabled: boolean; address: string; payable_to: string };
  }
}

export default function TenantDashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'pay' | 'payments' | 'maintenance' | 'contract'>('overview')
  const [showAllPayments, setShowAllPayments] = useState(false)
  const [maintenance, setMaintenance] = useState<MaintenanceRequest[]>([])
  const [showMaintForm, setShowMaintForm] = useState(false)
  const [maintForm, setMaintForm] = useState({ title: '', description: '', category: 'general', priority: 'normal' })
  const [submittingMaint, setSubmittingMaint] = useState(false)
  const [tenantName, setTenantName] = useState('')
  
  // Payment states
  const [payConfig, setPayConfig] = useState<PaymentConfig | null>(null)
  const [selectedMethod, setSelectedMethod] = useState('')
  const [payStep, setPayStep] = useState<'select' | 'instructions' | 'confirm' | 'success'>('select')
  const [payForm, setPayForm] = useState({ reference_number: '', notes: '', amount: 0, include_late_fee: false })
  const [submittingPay, setSubmittingPay] = useState(false)
  const [payError, setPayError] = useState('')
  const [paySuccess, setPaySuccess] = useState<{ receipt_number: string } | null>(null)
  const [copied, setCopied] = useState('')

  const getToken = () => typeof window !== 'undefined' ? localStorage.getItem('tenant_token') : null

  useEffect(() => {
    const token = getToken()
    if (!token) { window.location.href = '/tenant'; return }
    const info = localStorage.getItem('tenant_info')
    if (info) { try { setTenantName(JSON.parse(info).name || '') } catch {} }
    fetchDashboard(token)
    fetchMaintenance(token)
    fetchPayConfig(token)
  }, [])

  const fetchDashboard = async (token: string) => {
    try {
      const res = await fetch(`${API_URL}/tenant/dashboard`, { headers: { 'Authorization': `Bearer ${token}` } })
      if (res.status === 401) { localStorage.removeItem('tenant_token'); localStorage.removeItem('tenant_info'); window.location.href = '/tenant'; return }
      const d = await res.json()
      if (d.success) { setData(d); setTenantName(d.tenant?.name || '') }
    } catch (err) { console.error('Dashboard fetch error:', err) }
    setLoading(false)
  }

  const fetchMaintenance = async (token: string) => {
    try {
      const res = await fetch(`${API_URL}/tenant/maintenance-requests`, { headers: { 'Authorization': `Bearer ${token}` } })
      const d = await res.json()
      if (d.success) setMaintenance(d.requests || [])
    } catch {}
  }

  const fetchPayConfig = async (token: string) => {
    try {
      const res = await fetch(`${API_URL}/tenant/payment-config`, { headers: { 'Authorization': `Bearer ${token}` } })
      const d = await res.json()
      if (d.success) { setPayConfig(d); setPayForm(prev => ({ ...prev, amount: d.rent_amount })) }
    } catch {}
  }

  const submitMaintenance = async () => {
    const token = getToken()
    if (!token || !maintForm.title || !maintForm.description) return
    setSubmittingMaint(true)
    try {
      const res = await fetch(`${API_URL}/tenant/maintenance-request`, {
        method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(maintForm),
      })
      const d = await res.json()
      if (d.success) { setMaintForm({ title: '', description: '', category: 'general', priority: 'normal' }); setShowMaintForm(false); fetchMaintenance(token) }
    } catch {}
    setSubmittingMaint(false)
  }

  const submitPayment = async () => {
    const token = getToken()
    if (!token) return
    setSubmittingPay(true)
    setPayError('')
    try {
      const totalAmount = payForm.include_late_fee ? payForm.amount + (payConfig?.late_fee || 0) : payForm.amount
      const res = await fetch(`${API_URL}/tenant/submit-payment`, {
        method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment_method: selectedMethod,
          reference_number: payForm.reference_number,
          amount: totalAmount,
          late_fee: payForm.include_late_fee ? payConfig?.late_fee || 0 : 0,
          notes: payForm.notes,
        }),
      })
      const d = await res.json()
      if (d.success) {
        setPaySuccess({ receipt_number: d.receipt_number })
        setPayStep('success')
        fetchDashboard(token)
        fetchPayConfig(token)
      } else {
        setPayError(d.detail || 'Error al enviar el pago')
      }
    } catch { setPayError('Error de conexión') }
    setSubmittingPay(false)
  }

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    setCopied(label)
    setTimeout(() => setCopied(''), 2000)
  }

  const handleLogout = () => { localStorage.removeItem('tenant_token'); localStorage.removeItem('tenant_info'); window.location.href = '/tenant' }
  const formatDate = (d: string) => { if (!d) return '—'; try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) } catch { return d } }
  const formatCurrency = (n: number) => `$${(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
  const statusColor = (s: string) => {
    const map: Record<string, string> = {
      completed: 'bg-green-100 text-green-700', paid: 'bg-green-100 text-green-700',
      pending: 'bg-yellow-100 text-yellow-700', pending_verification: 'bg-blue-100 text-blue-700',
      open: 'bg-blue-100 text-blue-700', 'in-progress': 'bg-purple-100 text-purple-700',
      closed: 'bg-gray-100 text-gray-600', active: 'bg-green-100 text-green-700',
    }
    return map[s] || 'bg-gray-100 text-gray-600'
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-3 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading your portal...</p>
        </div>
      </div>
    )
  }

  const tabs = [
    { id: 'overview' as const, label: 'Overview', icon: Home },
    { id: 'pay' as const, label: 'Pay Rent', icon: CreditCard },
    { id: 'payments' as const, label: 'History', icon: DollarSign },
    { id: 'maintenance' as const, label: 'Maintenance', icon: Wrench },
    { id: 'contract' as const, label: 'Lease', icon: FileText },
  ]

  const paymentMethodInfo: Record<string, { icon: any; label: string; color: string; desc: string }> = {
    zelle: { icon: Smartphone, label: 'Zelle', color: 'from-purple-500 to-purple-700', desc: 'Instant bank transfer' },
    cashapp: { icon: DollarSign, label: 'Cash App', color: 'from-green-500 to-green-700', desc: 'Mobile payment' },
    bank_transfer: { icon: Building, label: 'Bank Transfer', color: 'from-blue-500 to-blue-700', desc: 'Direct deposit' },
    money_order: { icon: Banknote, label: 'Money Order', color: 'from-amber-500 to-amber-700', desc: 'Mail or deliver' },
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center"><Home className="w-5 h-5 text-white" /></div>
            <div>
              <div className="font-display font-bold text-primary text-lg leading-tight">Tenant Portal</div>
              <div className="text-gray-400 text-xs">Ross House Rentals</div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:block text-right">
              <p className="text-sm font-semibold text-charcoal">{tenantName}</p>
              <p className="text-xs text-gray-400">{data?.tenant?.tenant_number}</p>
            </div>
            <button onClick={handleLogout} className="flex items-center gap-1.5 text-gray-400 hover:text-red-500 transition-colors text-sm font-medium">
              <LogOut className="w-4 h-4" /> Sign Out
            </button>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex gap-1 overflow-x-auto pb-0">
            {tabs.map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
                  activeTab === t.id ? 'border-primary text-primary' : 'border-transparent text-gray-400 hover:text-gray-600 hover:border-gray-200'
                }`}>
                <t.icon className="w-4 h-4" /> {t.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <div className="bg-gradient-to-r from-primary to-primary-dark rounded-3xl p-8 text-white">
              <h1 className="font-display text-2xl md:text-3xl font-bold mb-2">Welcome back, {tenantName?.split(' ')[0] || 'Tenant'}!</h1>
              <p className="text-white/70">Here&apos;s an overview of your rental account.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center"><DollarSign className="w-5 h-5 text-primary" /></div>
                  <span className="text-xs text-gray-400 font-medium uppercase">Monthly Rent</span>
                </div>
                <p className="text-2xl font-display font-bold text-charcoal">{formatCurrency(data?.contract?.rent_amount || 0)}</p>
              </div>
              <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center"><Calendar className="w-5 h-5 text-secondary" /></div>
                  <span className="text-xs text-gray-400 font-medium uppercase">Next Due</span>
                </div>
                <p className="text-2xl font-display font-bold text-charcoal">{data?.next_payment ? formatDate(data.next_payment.due_date) : '—'}</p>
              </div>
              <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${data?.next_payment?.current_month_paid ? 'bg-green-100' : 'bg-amber-100'}`}>
                    {data?.next_payment?.current_month_paid ? <CheckCircle className="w-5 h-5 text-green-600" /> : <AlertCircle className="w-5 h-5 text-amber-600" />}
                  </div>
                  <span className="text-xs text-gray-400 font-medium uppercase">This Month</span>
                </div>
                <p className={`text-lg font-bold ${data?.next_payment?.current_month_paid ? 'text-green-600' : 'text-amber-600'}`}>
                  {data?.next_payment?.current_month_paid ? '✓ Paid' : 'Payment Due'}
                </p>
              </div>
              <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center"><Wrench className="w-5 h-5 text-accent" /></div>
                  <span className="text-xs text-gray-400 font-medium uppercase">Open Requests</span>
                </div>
                <p className="text-2xl font-display font-bold text-charcoal">{maintenance.filter(m => m.status === 'open' || m.status === 'in-progress').length}</p>
              </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
              {data?.property && (
                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                  <h3 className="font-display text-lg font-bold text-charcoal mb-4 flex items-center gap-2"><MapPin className="w-5 h-5 text-primary" /> Your Property</h3>
                  <div className="space-y-3">
                    <p className="text-gray-700 font-medium">{data.property.address}</p>
                    <p className="text-gray-500 text-sm">{data.property.city}, {data.property.state}</p>
                    <div className="flex gap-4 pt-2">
                      <span className="text-sm text-gray-500">🛏️ {data.property.bedrooms} Bed</span>
                      <span className="text-sm text-gray-500">🚿 {data.property.bathrooms} Bath</span>
                    </div>
                  </div>
                </div>
              )}
              <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                <h3 className="font-display text-lg font-bold text-charcoal mb-4 flex items-center gap-2"><CreditCard className="w-5 h-5 text-secondary" /> Recent Payments</h3>
                {data?.payments && data.payments.length > 0 ? (
                  <div className="space-y-3">
                    {data.payments.slice(0, 3).map(p => (
                      <div key={p.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                        <div>
                          <p className="text-sm font-medium text-charcoal capitalize">{p.period_month} {p.period_year}</p>
                          <p className="text-xs text-gray-400">{formatDate(p.payment_date)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-charcoal">{formatCurrency(p.total_paid || p.amount)}</p>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor(p.status)}`}>{p.status}</span>
                        </div>
                      </div>
                    ))}
                    <button onClick={() => setActiveTab('payments')} className="text-primary text-sm font-medium flex items-center gap-1 pt-2 hover:text-secondary transition-colors">
                      View All <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <p className="text-gray-400 text-sm">No payments recorded yet.</p>
                )}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <button onClick={() => setActiveTab('pay')}
                className="bg-gradient-to-br from-primary to-primary-dark rounded-2xl p-5 shadow-lg hover:shadow-xl transition-all text-left group text-white">
                <CreditCard className="w-8 h-8 mb-3 group-hover:scale-110 transition-transform" />
                <h4 className="font-bold mb-1">Pay Rent Online</h4>
                <p className="text-white/70 text-sm">Submit your monthly payment</p>
              </button>
              <button onClick={() => { setActiveTab('maintenance'); setShowMaintForm(true) }}
                className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-md hover:border-primary/20 transition-all text-left group">
                <Wrench className="w-8 h-8 text-accent mb-3 group-hover:scale-110 transition-transform" />
                <h4 className="font-bold text-charcoal mb-1">Request Maintenance</h4>
                <p className="text-gray-400 text-sm">Submit a repair request</p>
              </button>
              <a href="tel:+18069342018" className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-md hover:border-primary/20 transition-all text-left group">
                <Phone className="w-8 h-8 text-secondary mb-3 group-hover:scale-110 transition-transform" />
                <h4 className="font-bold text-charcoal mb-1">Contact Office</h4>
                <p className="text-gray-400 text-sm">(806) 934-2018</p>
              </a>
            </div>
          </motion.div>
        )}

        {/* PAY RENT TAB */}
        {activeTab === 'pay' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl font-bold text-charcoal">Pay Rent</h2>
              {payConfig && !payConfig.current_month_paid && (
                <span className="bg-amber-100 text-amber-700 px-4 py-1.5 rounded-full text-sm font-semibold flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4" /> {payConfig.current_month} — Payment Due
                </span>
              )}
              {payConfig?.current_month_paid && (
                <span className="bg-green-100 text-green-700 px-4 py-1.5 rounded-full text-sm font-semibold flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4" /> {payConfig.current_month} — Paid
                </span>
              )}
            </div>

            {payConfig?.current_month_paid && payStep !== 'success' ? (
              <div className="bg-white rounded-3xl p-12 border border-gray-100 shadow-sm text-center">
                <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-5">
                  <CheckCircle className="w-10 h-10 text-green-500" />
                </div>
                <h3 className="font-display text-2xl font-bold text-charcoal mb-2">You&apos;re all set!</h3>
                <p className="text-gray-500 mb-4">Your rent for {payConfig.current_month} has been received or is pending verification.</p>
                <button onClick={() => setActiveTab('payments')} className="text-primary font-semibold text-sm hover:text-secondary transition-colors flex items-center gap-1 mx-auto">
                  View Payment History <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <>
                {/* Amount Summary Card */}
                {payConfig && payStep !== 'success' && (
                  <div className="bg-gradient-to-br from-primary to-primary-dark rounded-3xl p-6 text-white">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-white/60 text-xs font-bold uppercase tracking-wider mb-1">Amount Due</p>
                        <p className="font-display text-4xl font-bold">{formatCurrency(payConfig.rent_amount)}</p>
                        <p className="text-white/60 text-sm mt-1">Due on the {payConfig.due_day}th of each month</p>
                      </div>
                      <div className="text-right">
                        <p className="text-white/60 text-xs mb-1">Late Fee</p>
                        <p className="text-white/80 font-semibold">{formatCurrency(payConfig.late_fee)}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 1: Select Payment Method */}
                {payStep === 'select' && (
                  <div className="space-y-4">
                    <h3 className="font-bold text-charcoal text-lg">Choose Payment Method</h3>
                    <div className="grid sm:grid-cols-2 gap-4">
                      {payConfig && Object.entries(payConfig.payment_methods)
                        .filter(([, v]) => v.enabled)
                        .map(([key, method]) => {
                          const info = paymentMethodInfo[key]
                          if (!info) return null
                          const Icon = info.icon
                          return (
                            <button key={key} onClick={() => { setSelectedMethod(key); setPayStep('instructions') }}
                              className={`bg-white rounded-2xl p-6 border-2 shadow-sm hover:shadow-lg transition-all text-left group ${
                                selectedMethod === key ? 'border-primary' : 'border-gray-100 hover:border-primary/30'
                              }`}>
                              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${info.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-lg`}>
                                <Icon className="w-6 h-6 text-white" />
                              </div>
                              <h4 className="font-display font-bold text-charcoal text-lg">{info.label}</h4>
                              <p className="text-gray-400 text-sm mt-1">{info.desc}</p>
                            </button>
                          )
                        })}
                    </div>
                  </div>
                )}

                {/* Step 2: Payment Instructions */}
                {payStep === 'instructions' && payConfig && (
                  <div className="space-y-6">
                    <div className="flex items-center gap-3">
                      <button onClick={() => setPayStep('select')} className="text-gray-400 hover:text-charcoal transition-colors">
                        ← Back
                      </button>
                      <h3 className="font-bold text-charcoal text-lg">
                        Payment via {paymentMethodInfo[selectedMethod]?.label}
                      </h3>
                    </div>

                    {/* Instructions Card */}
                    <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                      <div className="flex items-center gap-3 mb-5">
                        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${paymentMethodInfo[selectedMethod]?.color} flex items-center justify-center shadow-md`}>
                          {(() => { const Icon = paymentMethodInfo[selectedMethod]?.icon; return Icon ? <Icon className="w-5 h-5 text-white" /> : null })()}
                        </div>
                        <div>
                          <h4 className="font-bold text-charcoal">{paymentMethodInfo[selectedMethod]?.label} Instructions</h4>
                          <p className="text-gray-400 text-xs">Follow these steps to complete your payment</p>
                        </div>
                      </div>

                      {selectedMethod === 'zelle' && (
                        <div className="space-y-4">
                          <div className="bg-purple-50 rounded-xl p-4">
                            <p className="text-xs text-purple-600 font-bold uppercase mb-3">Send payment to:</p>
                            <div className="space-y-3">
                              <div className="flex items-center justify-between bg-white rounded-lg px-4 py-3 border border-purple-100">
                                <div>
                                  <p className="text-xs text-gray-400">Recipient Name</p>
                                  <p className="font-semibold text-charcoal">{payConfig.payment_methods.zelle.name}</p>
                                </div>
                                <button onClick={() => copyToClipboard(payConfig.payment_methods.zelle.name, 'name')}
                                  className="text-purple-500 hover:text-purple-700 transition-colors">
                                  {copied === 'name' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                </button>
                              </div>
                              <div className="flex items-center justify-between bg-white rounded-lg px-4 py-3 border border-purple-100">
                                <div>
                                  <p className="text-xs text-gray-400">Email</p>
                                  <p className="font-semibold text-charcoal">{payConfig.payment_methods.zelle.email}</p>
                                </div>
                                <button onClick={() => copyToClipboard(payConfig.payment_methods.zelle.email, 'email')}
                                  className="text-purple-500 hover:text-purple-700 transition-colors">
                                  {copied === 'email' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                </button>
                              </div>
                              <div className="flex items-center justify-between bg-white rounded-lg px-4 py-3 border border-purple-100">
                                <div>
                                  <p className="text-xs text-gray-400">Phone</p>
                                  <p className="font-semibold text-charcoal">{payConfig.payment_methods.zelle.phone}</p>
                                </div>
                                <button onClick={() => copyToClipboard(payConfig.payment_methods.zelle.phone, 'phone')}
                                  className="text-purple-500 hover:text-purple-700 transition-colors">
                                  {copied === 'phone' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                </button>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-start gap-2 bg-blue-50 rounded-xl p-3">
                            <Info className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                            <p className="text-blue-700 text-xs">Open your banking app → Transfers → Send with Zelle → Enter the email or phone above → Send exactly {formatCurrency(payConfig.rent_amount)}</p>
                          </div>
                        </div>
                      )}

                      {selectedMethod === 'cashapp' && (
                        <div className="space-y-4">
                          <div className="bg-green-50 rounded-xl p-4">
                            <p className="text-xs text-green-600 font-bold uppercase mb-3">Send payment to:</p>
                            <div className="flex items-center justify-between bg-white rounded-lg px-4 py-3 border border-green-100">
                              <div>
                                <p className="text-xs text-gray-400">Cash App Tag</p>
                                <p className="font-semibold text-charcoal text-lg">{payConfig.payment_methods.cashapp.tag}</p>
                              </div>
                              <button onClick={() => copyToClipboard(payConfig.payment_methods.cashapp.tag, 'cashtag')}
                                className="text-green-500 hover:text-green-700 transition-colors">
                                {copied === 'cashtag' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                              </button>
                            </div>
                          </div>
                          <div className="flex items-start gap-2 bg-blue-50 rounded-xl p-3">
                            <Info className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                            <p className="text-blue-700 text-xs">Open Cash App → Tap Pay → Enter {payConfig.payment_methods.cashapp.tag} → Amount: {formatCurrency(payConfig.rent_amount)} → Add note: &quot;Rent + your name&quot;</p>
                          </div>
                        </div>
                      )}

                      {selectedMethod === 'bank_transfer' && (
                        <div className="space-y-4">
                          <div className="bg-blue-50 rounded-xl p-4">
                            <p className="text-xs text-blue-600 font-bold uppercase mb-3">Bank Transfer Details:</p>
                            <div className="space-y-3">
                              <div className="bg-white rounded-lg px-4 py-3 border border-blue-100">
                                <p className="text-xs text-gray-400">Account Name</p>
                                <p className="font-semibold text-charcoal">{payConfig.payment_methods.bank_transfer.account_name}</p>
                              </div>
                              <div className="bg-white rounded-lg px-4 py-3 border border-blue-100">
                                <p className="text-xs text-gray-400">Bank</p>
                                <p className="font-semibold text-charcoal">{payConfig.payment_methods.bank_transfer.bank_name}</p>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-start gap-2 bg-amber-50 rounded-xl p-3">
                            <Info className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                            <p className="text-amber-700 text-xs">For routing and account numbers, please call our office at (806) 934-2018.</p>
                          </div>
                        </div>
                      )}

                      {selectedMethod === 'money_order' && (
                        <div className="space-y-4">
                          <div className="bg-amber-50 rounded-xl p-4">
                            <p className="text-xs text-amber-600 font-bold uppercase mb-3">Money Order Details:</p>
                            <div className="space-y-3">
                              <div className="bg-white rounded-lg px-4 py-3 border border-amber-100">
                                <p className="text-xs text-gray-400">Make Payable To</p>
                                <p className="font-semibold text-charcoal">{payConfig.payment_methods.money_order.payable_to}</p>
                              </div>
                              <div className="bg-white rounded-lg px-4 py-3 border border-amber-100">
                                <p className="text-xs text-gray-400">Deliver or Mail To</p>
                                <p className="font-semibold text-charcoal">{payConfig.payment_methods.money_order.address}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* After making payment, confirm */}
                    <button onClick={() => setPayStep('confirm')}
                      className="w-full bg-primary hover:bg-primary-dark text-white py-4 rounded-2xl font-bold text-lg transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2">
                      I&apos;ve Made the Payment <ArrowRight className="w-5 h-5" />
                    </button>
                  </div>
                )}

                {/* Step 3: Confirm Payment */}
                {payStep === 'confirm' && payConfig && (
                  <div className="space-y-6">
                    <div className="flex items-center gap-3">
                      <button onClick={() => setPayStep('instructions')} className="text-gray-400 hover:text-charcoal transition-colors">← Back</button>
                      <h3 className="font-bold text-charcoal text-lg">Confirm Your Payment</h3>
                    </div>

                    {payError && (
                      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
                        <X className="w-4 h-4 flex-shrink-0" /> {payError}
                      </div>
                    )}

                    <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm space-y-5">
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Payment Amount</label>
                          <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span>
                            <input type="number" step="0.01" value={payForm.amount} onChange={e => setPayForm({...payForm, amount: parseFloat(e.target.value) || 0})}
                              className="w-full pl-8 pr-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all" />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Reference / Confirmation #</label>
                          <input type="text" value={payForm.reference_number} onChange={e => setPayForm({...payForm, reference_number: e.target.value})}
                            placeholder="e.g., Zelle confirmation ID"
                            className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all" />
                        </div>
                      </div>

                      {payConfig.late_fee > 0 && (
                        <label className="flex items-center gap-3 bg-amber-50 rounded-xl p-3 cursor-pointer">
                          <input type="checkbox" checked={payForm.include_late_fee} onChange={e => setPayForm({...payForm, include_late_fee: e.target.checked})}
                            className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary" />
                          <div>
                            <p className="text-sm font-medium text-charcoal">Include late fee: {formatCurrency(payConfig.late_fee)}</p>
                            <p className="text-xs text-gray-400">Check this if your payment was made after the grace period</p>
                          </div>
                        </label>
                      )}

                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Notes (optional)</label>
                        <textarea value={payForm.notes} onChange={e => setPayForm({...payForm, notes: e.target.value})} rows={2}
                          placeholder="Any additional notes..."
                          className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all resize-none" />
                      </div>

                      {/* Summary */}
                      <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Rent Amount</span>
                          <span className="font-medium text-charcoal">{formatCurrency(payForm.amount)}</span>
                        </div>
                        {payForm.include_late_fee && (
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Late Fee</span>
                            <span className="font-medium text-red-500">+{formatCurrency(payConfig.late_fee)}</span>
                          </div>
                        )}
                        <div className="border-t border-gray-200 pt-2 flex justify-between">
                          <span className="font-bold text-charcoal">Total</span>
                          <span className="font-display font-bold text-primary text-lg">
                            {formatCurrency(payForm.include_late_fee ? payForm.amount + payConfig.late_fee : payForm.amount)}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Method</span>
                          <span className="font-medium text-charcoal capitalize">{paymentMethodInfo[selectedMethod]?.label}</span>
                        </div>
                      </div>

                      <button onClick={submitPayment} disabled={submittingPay || payForm.amount <= 0}
                        className="w-full bg-green-600 hover:bg-green-700 text-white py-4 rounded-2xl font-bold text-lg transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2 disabled:opacity-50">
                        {submittingPay ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> :
                          <><Shield className="w-5 h-5" /> Confirm Payment Submission</>}
                      </button>
                      <p className="text-xs text-gray-400 text-center">Your payment will be verified by our team within 1 business day.</p>
                    </div>
                  </div>
                )}

                {/* Step 4: Success */}
                {payStep === 'success' && paySuccess && (
                  <div className="bg-white rounded-3xl p-12 border border-gray-100 shadow-sm text-center">
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', duration: 0.6 }}>
                      <div className="w-24 h-24 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
                        <CheckCircle className="w-12 h-12 text-green-500" />
                      </div>
                    </motion.div>
                    <h3 className="font-display text-3xl font-bold text-charcoal mb-3">Payment Submitted!</h3>
                    <p className="text-gray-500 mb-6 max-w-md mx-auto">Your payment has been received and is pending verification. You&apos;ll receive confirmation within 1 business day.</p>
                    <div className="bg-gray-50 rounded-xl p-4 inline-block mb-6">
                      <p className="text-xs text-gray-400 uppercase mb-1">Receipt Number</p>
                      <p className="font-display font-bold text-primary text-xl">{paySuccess.receipt_number}</p>
                    </div>
                    <div className="flex gap-3 justify-center">
                      <button onClick={() => { setPayStep('select'); setPaySuccess(null); setSelectedMethod(''); setPayForm({ reference_number: '', notes: '', amount: payConfig?.rent_amount || 0, include_late_fee: false }) }}
                        className="bg-gray-100 hover:bg-gray-200 text-charcoal px-6 py-3 rounded-xl font-semibold text-sm transition-all">
                        Done
                      </button>
                      <button onClick={() => setActiveTab('payments')}
                        className="bg-primary hover:bg-primary-dark text-white px-6 py-3 rounded-xl font-semibold text-sm transition-all flex items-center gap-2">
                        View History <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </motion.div>
        )}

        {/* PAYMENTS HISTORY TAB */}
        {activeTab === 'payments' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl font-bold text-charcoal">Payment History</h2>
            </div>
            {data?.payments && data.payments.length > 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="text-left px-5 py-3.5 text-xs font-bold text-gray-500 uppercase">Period</th>
                        <th className="text-left px-5 py-3.5 text-xs font-bold text-gray-500 uppercase">Date</th>
                        <th className="text-left px-5 py-3.5 text-xs font-bold text-gray-500 uppercase">Amount</th>
                        <th className="text-left px-5 py-3.5 text-xs font-bold text-gray-500 uppercase">Late Fee</th>
                        <th className="text-left px-5 py-3.5 text-xs font-bold text-gray-500 uppercase">Total</th>
                        <th className="text-left px-5 py-3.5 text-xs font-bold text-gray-500 uppercase">Method</th>
                        <th className="text-left px-5 py-3.5 text-xs font-bold text-gray-500 uppercase">Status</th>
                        <th className="text-left px-5 py-3.5 text-xs font-bold text-gray-500 uppercase">Receipt</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(showAllPayments ? data.payments : data.payments.slice(0, 12)).map(p => (
                        <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                          <td className="px-5 py-4 text-sm font-medium text-charcoal capitalize">{p.period_month} {p.period_year}</td>
                          <td className="px-5 py-4 text-sm text-gray-500">{formatDate(p.payment_date)}</td>
                          <td className="px-5 py-4 text-sm font-medium text-charcoal">{formatCurrency(p.amount)}</td>
                          <td className="px-5 py-4 text-sm text-red-500">{p.late_fee > 0 ? formatCurrency(p.late_fee) : '—'}</td>
                          <td className="px-5 py-4 text-sm font-bold text-charcoal">{formatCurrency(p.total_paid || p.amount)}</td>
                          <td className="px-5 py-4 text-sm text-gray-500 capitalize">{p.payment_method || '—'}</td>
                          <td className="px-5 py-4"><span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColor(p.status)}`}>{p.status}</span></td>
                          <td className="px-5 py-4">{p.receipt_number && <span className="text-xs text-gray-400">#{p.receipt_number}</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {data.payments.length > 12 && (
                  <div className="px-5 py-3 border-t border-gray-100 text-center">
                    <button onClick={() => setShowAllPayments(!showAllPayments)} className="text-primary text-sm font-medium flex items-center gap-1 mx-auto hover:text-secondary transition-colors">
                      {showAllPayments ? <><ChevronUp className="w-4 h-4" /> Show Less</> : <><ChevronDown className="w-4 h-4" /> Show All ({data.payments.length})</>}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-2xl p-12 border border-gray-100 shadow-sm text-center">
                <DollarSign className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-400">No payment records found.</p>
              </div>
            )}
          </motion.div>
        )}

        {/* MAINTENANCE TAB */}
        {activeTab === 'maintenance' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl font-bold text-charcoal">Maintenance Requests</h2>
              <button onClick={() => setShowMaintForm(!showMaintForm)}
                className="bg-primary hover:bg-primary-dark text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition-all flex items-center gap-2 shadow-md">
                <Wrench className="w-4 h-4" /> New Request
              </button>
            </div>
            {showMaintForm && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                <h3 className="font-bold text-charcoal mb-4">Submit Maintenance Request</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Title *</label>
                    <input type="text" value={maintForm.title} onChange={e => setMaintForm({...maintForm, title: e.target.value})}
                      placeholder="e.g., Leaking faucet in kitchen"
                      className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Category</label>
                      <select value={maintForm.category} onChange={e => setMaintForm({...maintForm, category: e.target.value})}
                        className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all">
                        <option value="general">General</option><option value="plumbing">Plumbing</option><option value="electrical">Electrical</option>
                        <option value="hvac">HVAC / Heating</option><option value="appliance">Appliance</option><option value="pest">Pest Control</option>
                        <option value="exterior">Exterior / Yard</option><option value="other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Priority</label>
                      <select value={maintForm.priority} onChange={e => setMaintForm({...maintForm, priority: e.target.value})}
                        className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all">
                        <option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="emergency">🚨 Emergency</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Description *</label>
                    <textarea value={maintForm.description} onChange={e => setMaintForm({...maintForm, description: e.target.value})} rows={4}
                      placeholder="Please describe the issue in detail..."
                      className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all resize-none" />
                  </div>
                  <div className="flex gap-3 justify-end">
                    <button onClick={() => setShowMaintForm(false)} className="px-5 py-2.5 rounded-xl text-gray-500 hover:bg-gray-100 text-sm font-medium transition-all">Cancel</button>
                    <button onClick={submitMaintenance} disabled={submittingMaint || !maintForm.title || !maintForm.description}
                      className="bg-primary hover:bg-primary-dark text-white px-6 py-2.5 rounded-xl font-semibold text-sm transition-all flex items-center gap-2 disabled:opacity-50">
                      {submittingMaint ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Send className="w-4 h-4" /> Submit</>}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
            {maintenance.length > 0 ? (
              <div className="space-y-3">
                {maintenance.map(m => (
                  <div key={m.id} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-all">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-bold text-charcoal">{m.title}</h4>
                          <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${statusColor(m.status)}`}>{m.status}</span>
                        </div>
                        <p className="text-gray-500 text-sm mb-2">{m.description}</p>
                        <div className="flex gap-4 text-xs text-gray-400">
                          <span>📁 {m.category}</span><span>⚡ {m.priority}</span><span>📅 {formatDate(m.created_at)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-2xl p-12 border border-gray-100 shadow-sm text-center">
                <CheckCircle className="w-12 h-12 text-green-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">No maintenance requests</p>
                <p className="text-gray-400 text-sm mt-1">Everything looks good!</p>
              </div>
            )}
          </motion.div>
        )}

        {/* CONTRACT/LEASE TAB */}
        {activeTab === 'contract' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <h2 className="font-display text-2xl font-bold text-charcoal">Lease Agreement</h2>
            {data?.contract ? (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="bg-gradient-to-r from-primary to-primary-dark p-6 text-white">
                  <div className="flex items-center gap-3 mb-2">
                    <FileText className="w-6 h-6" />
                    <h3 className="font-display text-xl font-bold">Contract #{data.contract.contract_number}</h3>
                  </div>
                  <p className="text-white/70">{data.contract.property_address}</p>
                </div>
                <div className="p-6">
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div><p className="text-xs text-gray-400 font-bold uppercase mb-1">Status</p><span className={`text-sm px-3 py-1 rounded-full font-medium ${statusColor(data.contract.status)}`}>{data.contract.status}</span></div>
                    <div><p className="text-xs text-gray-400 font-bold uppercase mb-1">Start Date</p><p className="text-sm font-medium text-charcoal">{formatDate(data.contract.start_date)}</p></div>
                    <div><p className="text-xs text-gray-400 font-bold uppercase mb-1">End Date</p><p className="text-sm font-medium text-charcoal">{formatDate(data.contract.end_date)}</p></div>
                    <div><p className="text-xs text-gray-400 font-bold uppercase mb-1">Monthly Rent</p><p className="text-lg font-display font-bold text-primary">{formatCurrency(data.contract.rent_amount)}</p></div>
                    <div><p className="text-xs text-gray-400 font-bold uppercase mb-1">Security Deposit</p><p className="text-sm font-medium text-charcoal">{formatCurrency(data.contract.deposit_amount)}</p></div>
                    <div><p className="text-xs text-gray-400 font-bold uppercase mb-1">Payment Due Day</p><p className="text-sm font-medium text-charcoal">{data.contract.payment_due_day}th of each month</p></div>
                    <div><p className="text-xs text-gray-400 font-bold uppercase mb-1">Late Fee</p><p className="text-sm font-medium text-charcoal">{formatCurrency(data.contract.late_fee_amount)} (after {data.contract.late_fee_grace_days} days)</p></div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl p-12 border border-gray-100 shadow-sm text-center">
                <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">No active lease found</p>
                <p className="text-gray-400 text-sm mt-1">Contact the office for more information.</p>
              </div>
            )}
            {data?.tenant && (
              <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                <h3 className="font-display text-lg font-bold text-charcoal mb-4 flex items-center gap-2"><User className="w-5 h-5 text-primary" /> Your Information</h3>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div><p className="text-xs text-gray-400 font-bold uppercase mb-1">Name</p><p className="text-sm font-medium text-charcoal">{data.tenant.name}</p></div>
                  <div><p className="text-xs text-gray-400 font-bold uppercase mb-1">Email</p><p className="text-sm font-medium text-charcoal">{data.tenant.email}</p></div>
                  <div><p className="text-xs text-gray-400 font-bold uppercase mb-1">Phone</p><p className="text-sm font-medium text-charcoal">{data.tenant.phone}</p></div>
                  <div><p className="text-xs text-gray-400 font-bold uppercase mb-1">Tenant #</p><p className="text-sm font-medium text-charcoal">{data.tenant.tenant_number || '—'}</p></div>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </main>

      <footer className="bg-white border-t border-gray-100 py-6 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 text-center">
          <p className="text-gray-400 text-sm">© {new Date().getFullYear()} Ross House Rentals LLC • <a href="tel:+18069342018" className="text-primary hover:text-secondary transition-colors">(806) 934-2018</a></p>
        </div>
      </footer>
    </div>
  )
}
