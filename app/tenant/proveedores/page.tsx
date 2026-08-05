'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Wrench, ArrowLeft, Send, CheckCircle2, AlertCircle, Sparkles, Shield, Lock,
} from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || ''

type ServiceCat = { id: string; es: string; en: string; count: number }

const SERVICE_ICONS: Record<string, string> = {
  plumber: '🔧', electrician: '⚡', hvac: '❄️', mason: '🧱', painter: '🎨',
  gardener: '🌱', cleaner: '🧼', locksmith: '🔑', roofer: '🏠',
  appliance_repair: '🔌', pest_control: '🐜', handyman: '🛠️',
  flooring: '🪵', drywall: '🧱', tile: '🔲', concrete: '🏗️',
  fence: '🪵', pool: '🏊', security: '🛡️', other: '✨',
}

const PRIORITIES = [
  { value: 'low', label: 'Baja', color: 'bg-sky-500/15 text-sky-300 border-sky-500/30' },
  { value: 'medium', label: 'Media', color: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30' },
  { value: 'high', label: 'Alta', color: 'bg-orange-500/15 text-orange-300 border-orange-500/30' },
  { value: 'urgent', label: 'Urgente', color: 'bg-rose-500/15 text-rose-300 border-rose-500/30' },
]

export default function TenantProveedoresPage() {
  const [services, setServices] = useState<ServiceCat[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedService, setSelectedService] = useState<ServiceCat | null>(null)

  const getToken = () => typeof window !== 'undefined' ? localStorage.getItem('tenant_token') : null

  const load = useCallback(async () => {
    const token = getToken()
    if (!token) { window.location.href = '/tenant'; return }
    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/tenant/service-providers/services`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.status === 401) { localStorage.removeItem('tenant_token'); window.location.href = '/tenant'; return }
      const d = await res.json()
      if (d.success) setServices(d.services || [])
    } catch (e) { console.error(e) }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const totalProviders = services.reduce((sum, s) => sum + s.count, 0)
  const availableServices = services.filter(s => s.count > 0)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-slate-950/85 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <button
            onClick={() => { window.location.href = '/tenant/dashboard' }}
            className="flex items-center gap-2 text-slate-300 hover:text-white text-sm font-medium transition"
          >
            <ArrowLeft className="w-4 h-4" /> Mi panel
          </button>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold">
            <Lock className="w-3 h-3" /> Servicio gestionado
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 md:py-10">
        {/* Hero */}
        <div className="mb-8 text-center md:text-left">
          <h1 className="font-bold text-3xl md:text-4xl mb-2">
            ¿Algo necesita arreglo?
          </h1>
          <p className="text-slate-400 text-sm md:text-base max-w-2xl">
            Tenemos profesionales verificados listos para resolver cualquier problema en tu unidad. <strong className="text-white">Ross House coordina todo por ti</strong> — solo dinos qué necesitas.
          </p>
        </div>

        {/* Quick stats */}
        <div className="mb-8 p-5 rounded-3xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/30 flex-shrink-0">
              <Wrench className="w-7 h-7 text-white" />
            </div>
            <div>
              <div className="text-3xl font-bold">
                {loading ? '...' : totalProviders}
                <span className="text-base text-slate-400 font-normal ml-2">profesionales disponibles</span>
              </div>
              <div className="text-xs text-amber-300/80 mt-0.5">
                Verificados y listos para atender tu solicitud
              </div>
            </div>
          </div>
        </div>

        {/* Services grid */}
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Tipos de servicio</h2>
          <span className="text-xs text-slate-500">Toca para solicitar ayuda</span>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-28 bg-white/[0.04] rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : availableServices.length === 0 ? (
          <div className="text-center py-16">
            <Wrench className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <h3 className="text-lg font-bold mb-1">No hay servicios activos en este momento</h3>
            <p className="text-slate-500 text-sm">
              Si necesitas ayuda urgente, llama directo al <a href="tel:+18069342018" className="text-amber-400 hover:underline">(806) 934-2018</a>.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {availableServices.map(s => (
              <button
                key={s.id}
                onClick={() => setSelectedService(s)}
                className="group p-4 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 hover:border-amber-500/40 transition text-left"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="text-3xl">{SERVICE_ICONS[s.id] || '🛠️'}</div>
                  <div className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-bold">
                    {s.count}
                  </div>
                </div>
                <div className="font-bold text-white text-sm group-hover:text-amber-300 transition">
                  {s.es}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  {s.count === 1 ? '1 profesional' : `${s.count} profesionales`}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Privacy notice */}
        <div className="mt-10 p-5 rounded-2xl bg-slate-900/60 border border-white/10">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-white text-sm mb-1.5">
                Tu privacidad y la del proveedor están protegidas
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                No compartimos información de contacto entre inquilinos y proveedores.
                Ross House Rentals es tu único punto de contacto: tú envías la solicitud aquí,
                nosotros coordinamos la visita, supervisamos el trabajo y manejamos el pago.
              </p>
            </div>
          </div>
        </div>

        {/* Footer note */}
        <div className="mt-6 text-center">
          <p className="text-xs text-slate-500">
            ¿Emergencia? Llama directo al{' '}
            <a href="tel:+18069342018" className="text-amber-400 hover:underline font-semibold">
              (806) 934-2018
            </a>
          </p>
        </div>
      </main>

      {selectedService && (
        <RequestHelpModal
          service={selectedService}
          onClose={() => setSelectedService(null)}
        />
      )}
    </div>
  )
}

function RequestHelpModal({
  service,
  onClose,
}: {
  service: ServiceCat
  onClose: () => void
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState('medium')
  const [contactPref, setContactPref] = useState<'phone' | 'email' | 'whatsapp'>('phone')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState<{ ok: boolean; msg: string } | null>(null)

  const submit = async () => {
    if (title.trim().length < 4 || description.trim().length < 10) {
      setDone({ ok: false, msg: 'Por favor completa el título (mín 4 caracteres) y la descripción (mín 10 caracteres).' })
      return
    }
    const token = typeof window !== 'undefined' ? localStorage.getItem('tenant_token') : null
    if (!token) { window.location.href = '/tenant'; return }
    setSubmitting(true)
    try {
      const res = await fetch(`${API_URL}/tenant/service-providers/request-help`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service: service.id,
          title: title.trim(),
          description: description.trim(),
          priority,
          contact_preference: contactPref,
        }),
      })
      const d = await res.json()
      if (res.ok && d.success) setDone({ ok: true, msg: d.message || 'Solicitud enviada. Te contactaremos pronto.' })
      else setDone({ ok: false, msg: d.detail || 'No se pudo enviar la solicitud.' })
    } catch (e: any) {
      setDone({ ok: false, msg: String(e?.message || e) })
    }
    setSubmitting(false)
  }

  if (done?.ok) {
    return (
      <div className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-md flex items-center justify-center p-4" onClick={onClose}>
        <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-emerald-500/30 rounded-3xl max-w-md w-full p-7 text-center" onClick={e => e.stopPropagation()}>
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center mx-auto mb-4 animate-pulse">
            <CheckCircle2 className="w-9 h-9 text-emerald-400" />
          </div>
          <h3 className="font-bold text-xl mb-2 text-white">¡Solicitud enviada!</h3>
          <p className="text-sm text-slate-400 leading-relaxed mb-5">{done.msg}</p>
          <button onClick={onClose} className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-white font-bold transition">
            Entendido
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto" onClick={onClose}>
      <div
        className="w-full sm:max-w-lg bg-gradient-to-br from-slate-900 to-slate-950 border border-white/10 sm:rounded-3xl rounded-t-3xl overflow-hidden max-h-[92vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-5 border-b border-white/10">
          <div className="flex items-start gap-3">
            <div className="text-4xl flex-shrink-0">{SERVICE_ICONS[service.id] || '🛠️'}</div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold text-amber-400 uppercase tracking-wider">Solicitar ayuda</div>
              <h3 className="font-bold text-xl mt-0.5">{service.es}</h3>
              <div className="text-xs text-slate-400 mt-0.5">
                {service.count} {service.count === 1 ? 'profesional disponible' : 'profesionales disponibles'} en nuestra red
              </div>
            </div>
            <button onClick={onClose} className="p-2 -m-2 rounded-full hover:bg-white/10 text-slate-300">
              ✕
            </button>
          </div>
        </div>

        <div className="overflow-y-auto p-5 space-y-4 flex-1">
          {done && !done.ok && (
            <div className="flex items-start gap-2 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /> {done.msg}
            </div>
          )}

          <FieldLabel>Título corto (qué necesitas)</FieldLabel>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Ej: Fuga en lavamanos del baño principal"
            maxLength={140}
            className="w-full px-3 py-2.5 rounded-xl bg-white/[0.06] border border-white/10 text-sm outline-none focus:border-amber-500/50 placeholder:text-slate-500"
          />

          <FieldLabel>Descripción detallada</FieldLabel>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Describe el problema con detalle: qué falla, cuándo empezó, si has visto algo extraño..."
            rows={4}
            maxLength={2000}
            className="w-full px-3 py-2.5 rounded-xl bg-white/[0.06] border border-white/10 text-sm outline-none focus:border-amber-500/50 placeholder:text-slate-500 resize-none"
          />

          <FieldLabel>Prioridad</FieldLabel>
          <div className="grid grid-cols-4 gap-1.5">
            {PRIORITIES.map(p2 => (
              <button
                key={p2.value}
                type="button"
                onClick={() => setPriority(p2.value)}
                className={`py-2 px-1 rounded-xl border text-xs font-semibold transition ${priority === p2.value ? p2.color : 'bg-white/[0.04] border-white/10 text-slate-400 hover:bg-white/10'}`}
              >
                {p2.label}
              </button>
            ))}
          </div>

          <FieldLabel>¿Cómo prefieres que te contactemos?</FieldLabel>
          <div className="grid grid-cols-3 gap-1.5">
            {([
              ['phone', '📞 Llamada'],
              ['whatsapp', '💬 WhatsApp'],
              ['email', '✉️ Email'],
            ] as const).map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => setContactPref(val)}
                className={`py-2 px-1 rounded-xl border text-xs font-semibold transition ${contactPref === val ? 'bg-amber-500 border-amber-500 text-white' : 'bg-white/[0.04] border-white/10 text-slate-400 hover:bg-white/10'}`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="mt-4 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-xs text-emerald-300/90 flex items-start gap-2">
            <Sparkles className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>
              Ross House coordinará la visita. Confirmaremos contigo el horario y presupuesto antes de enviar al profesional a tu unidad.
            </span>
          </div>
        </div>

        <div className="p-5 border-t border-white/10 bg-slate-950/60">
          <button
            onClick={submit}
            disabled={submitting}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
          >
            {submitting ? 'Enviando...' : <><Send className="w-4 h-4" /> Enviar solicitud</>}
          </button>
        </div>
      </div>
    </div>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">{children}</label>
}
