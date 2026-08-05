'use client'

import { useEffect, useState } from 'react'
import { X, Smartphone, QrCode, Apple, Sparkles } from 'lucide-react'

const IOS_URL = 'https://apps.apple.com/us/app/ross-house/id6775734340'
const ANDROID_URL: string | null = null // TODO: fill in when Play Store live

const withUtm = (url: string, campaign: string): string =>
  `${url}${url.includes('?') ? '&' : '?'}utm_source=web&utm_medium=banner&utm_campaign=${campaign}`

const DISMISS_DAYS = 7

function useIsMobile() {
  const [platform, setPlatform] = useState<'ios' | 'android' | 'desktop' | 'unknown'>('unknown')
  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase()
    if (/iphone|ipad|ipod/.test(ua)) setPlatform('ios')
    else if (/android/.test(ua)) setPlatform('android')
    else setPlatform('desktop')
  }, [])
  return platform
}

function useDismiss(storageKey: string) {
  const [dismissed, setDismissed] = useState(true) // start dismissed to avoid SSR flash
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw) {
        const { until } = JSON.parse(raw)
        if (until && Date.now() < until) return // still dismissed
      }
      setDismissed(false)
    } catch { setDismissed(false) }
  }, [storageKey])
  const dismiss = () => {
    setDismissed(true)
    try {
      localStorage.setItem(storageKey, JSON.stringify({ until: Date.now() + DISMISS_DAYS * 86400000 }))
    } catch { /* no-op */ }
  }
  return { dismissed, dismiss }
}

/* ─── VARIANT 1: Sticky bottom bar for PUBLIC WEB (mobile-only) ─────────── */
export function AppStickyBanner({ campaign = 'public-web' }: { campaign?: string }) {
  const platform = useIsMobile()
  const { dismissed, dismiss } = useDismiss('rhr-app-banner-sticky-v1')
  if (dismissed || platform === 'desktop' || platform === 'unknown') return null

  const isAndroid = platform === 'android'
  const url = isAndroid
    ? (ANDROID_URL ? withUtm(ANDROID_URL, campaign) : '#')
    : withUtm(IOS_URL, campaign)

  return (
    <div className="fixed bottom-0 inset-x-0 z-40 pointer-events-none">
      <div className="mx-3 mb-3 pb-[env(safe-area-inset-bottom)] pointer-events-auto">
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-900 text-white rounded-2xl shadow-2xl shadow-black/30 border border-white/10 backdrop-blur-xl">
          <div className="flex items-center gap-3 p-3 pr-2">
            <div className="w-11 h-11 rounded-xl bg-white shrink-0 flex items-center justify-center shadow-lg">
              {/* eslint-disable-next-line */}
              <img src="/logo.jpg" alt="Ross House" className="w-9 h-9 rounded-lg object-contain" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold text-white leading-tight flex items-center gap-1.5">
                Ross House app
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-400/20 text-emerald-300 font-bold uppercase">Nuevo</span>
              </div>
              <div className="text-[11px] text-slate-300 leading-tight truncate">
                {isAndroid ? 'Android próximamente 🔔' : 'Paga renta y gestiona todo desde tu iPhone'}
              </div>
            </div>
            {isAndroid ? (
              <button
                onClick={dismiss}
                className="text-[10px] px-2.5 py-1.5 rounded-lg bg-white/10 text-slate-300 font-semibold shrink-0"
              >
                OK
              </button>
            ) : (
              <a
                href={url}
                onClick={dismiss}
                className="text-[11px] px-3 py-2 rounded-xl bg-white text-slate-900 font-bold shrink-0 shadow-md active:scale-95 transition"
              >
                Abrir
              </a>
            )}
            <button
              onClick={dismiss}
              className="p-1.5 rounded-lg hover:bg-white/10 active:bg-white/20 shrink-0"
              aria-label="Cerrar"
            >
              <X className="w-4 h-4 text-slate-400" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── VARIANT 2: Hero card for TENANT DASHBOARD ─────────────────────────── */
export function AppHeroCard({ campaign = 'tenant-dashboard' }: { campaign?: string }) {
  const { dismissed, dismiss } = useDismiss('rhr-app-banner-hero-v1')
  if (dismissed) return null

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-900 to-violet-900 text-white shadow-xl mb-6">
      <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-fuchsia-500/20 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-20 -left-20 w-64 h-64 rounded-full bg-cyan-500/20 blur-3xl pointer-events-none" />
      <button
        onClick={dismiss}
        className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-white/10 z-10"
        aria-label="Cerrar"
      >
        <X className="w-4 h-4 text-white/60" />
      </button>
      <div className="relative p-5 md:p-6 flex flex-col md:flex-row items-start md:items-center gap-4">
        <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-white/95 shadow-2xl flex items-center justify-center shrink-0">
          {/* eslint-disable-next-line */}
          <img src="/logo.jpg" alt="Ross House" className="w-11 h-11 md:w-12 md:h-12 rounded-xl object-contain" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] uppercase tracking-widest font-black text-emerald-300 flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> NUEVA APP DISPONIBLE
            </span>
          </div>
          <h3 className="text-lg md:text-xl font-black leading-tight mb-1">
            Ross House para iPhone
          </h3>
          <p className="text-sm text-slate-300 leading-relaxed">
            Paga renta, envía solicitudes de mantenimiento y ve tu contrato — más rápido que en el navegador.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row md:flex-col gap-2 w-full md:w-auto">
          <a
            href={withUtm(IOS_URL, campaign)}
            className="flex items-center justify-center gap-2 bg-white text-slate-900 px-4 py-2.5 rounded-xl font-bold text-sm shadow-lg active:scale-95 transition min-w-[140px]"
          >
            <Apple className="w-4 h-4" /> App Store
          </a>
          <button
            disabled
            className="flex items-center justify-center gap-2 bg-white/10 text-slate-400 px-4 py-2.5 rounded-xl font-semibold text-xs cursor-not-allowed min-w-[140px] border border-white/10"
          >
            <Smartphone className="w-4 h-4" /> Android · Pronto
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── VARIANT 3: Compact widget for ADMIN SIDEBAR (with QR) ─────────────── */
export function AppSidebarWidget({ campaign = 'admin-share', collapsed = false }: { campaign?: string; collapsed?: boolean }) {
  const [showQr, setShowQr] = useState(false)
  const [copied, setCopied] = useState(false)
  const shareUrl = withUtm(IOS_URL, campaign)
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&margin=0&data=${encodeURIComponent(shareUrl)}`

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch { /* no-op */ }
  }

  if (collapsed) {
    return (
      <>
        <button
          onClick={() => setShowQr(true)}
          className="mx-2 mb-2 w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br from-indigo-500/15 to-violet-500/10 border border-indigo-400/25 hover:border-indigo-400/60 hover:from-indigo-500/25 transition"
          title="Compartir app iOS con QR"
        >
          <QrCode className="w-4 h-4 text-indigo-300" />
        </button>
        {showQr && <QrModal onClose={() => setShowQr(false)} qrSrc={qrSrc} shareUrl={shareUrl} copy={copy} copied={copied} />}
      </>
    )
  }

  return (
    <>
      <div className="mx-2 mb-3 p-2.5 rounded-xl bg-gradient-to-br from-indigo-500/10 to-violet-500/10 border border-indigo-400/20">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-7 h-7 rounded-lg bg-white/95 flex items-center justify-center shrink-0">
            {/* eslint-disable-next-line */}
            <img src="/logo.jpg" alt="Ross House" className="w-5 h-5 rounded object-contain" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-bold text-white leading-tight flex items-center gap-1">
              App iOS live
              <span className="text-[8px] px-1 py-0.5 rounded bg-emerald-400/20 text-emerald-300 font-bold uppercase">NEW</span>
            </div>
            <div className="text-[9px] text-gray-400 uppercase tracking-wider leading-tight">Compártela con tenants</div>
          </div>
        </div>
        <button
          onClick={() => setShowQr(true)}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-white/[0.08] hover:bg-white/[0.15] border border-white/10 hover:border-indigo-400/40 text-[11px] font-semibold text-indigo-200 hover:text-white transition"
        >
          <QrCode className="w-3.5 h-3.5" /> Ver código QR
        </button>
      </div>
      {showQr && <QrModal onClose={() => setShowQr(false)} qrSrc={qrSrc} shareUrl={shareUrl} copy={copy} copied={copied} />}
    </>
  )
}

/* ─── VARIANT 4: Compact header button for ADMIN top bar ────────────────── */
export function AppHeaderButton({ campaign = 'admin-share' }: { campaign?: string }) {
  const [showQr, setShowQr] = useState(false)
  const [copied, setCopied] = useState(false)
  const shareUrl = withUtm(IOS_URL, campaign)
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&margin=0&data=${encodeURIComponent(shareUrl)}`

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch { /* no-op */ }
  }

  return (
    <>
      <button
        onClick={() => setShowQr(true)}
        className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 transition-colors"
        title="Compartir la app iOS con inquilinos (QR)"
      >
        <QrCode className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-300" />
        <span className="hidden md:inline text-[11px] font-semibold">App QR</span>
      </button>
      {showQr && <QrModal onClose={() => setShowQr(false)} qrSrc={qrSrc} shareUrl={shareUrl} copy={copy} copied={copied} />}
    </>
  )
}

function QrModal({ onClose, qrSrc, shareUrl, copy, copied }: { onClose: () => void; qrSrc: string; shareUrl: string; copy: () => void; copied: boolean }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg text-slate-900">Escanea para descargar</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100">
            <X className="w-4 h-4 text-slate-600" />
          </button>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-gray-200 flex items-center justify-center mb-4">
          {/* eslint-disable-next-line */}
          <img src={qrSrc} alt="QR code Ross House App" className="w-64 h-64" />
        </div>
        <p className="text-xs text-slate-500 text-center leading-relaxed mb-3">
          Muéstrale este código a tu inquilino en persona. Al escanearlo con la cámara del iPhone se abre directo en App Store.
        </p>
        <div className="flex flex-col gap-2">
          <a
            href={shareUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-bold text-sm shadow-md hover:brightness-110 transition"
          >
            <Apple className="w-4 h-4" /> Abrir enlace del App Store
          </a>
          <button
            onClick={copy}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition"
          >
            {copied ? '✓ Enlace copiado' : 'Copiar enlace del App Store'}
          </button>
        </div>
      </div>
    </div>
  )
}
