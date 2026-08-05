import type { Metadata } from 'next'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.rosshouserentals.com'

export const metadata: Metadata = {
  title: 'Administración de Propiedades · Próximamente Q4 2026–2027 — Ross House Rentals',
  description: '🏠 ¿Tienes propiedades de inversión en Dumas TX? Únete a la lista de espera de nuestro servicio de administración. Estamos tramitando nuestra licencia de bienes raíces de Texas. Lanzamiento estimado Q4 2026 – 2027.',
  keywords: [
    'administración de propiedades Dumas',
    'property management Dumas TX',
    'gestión de alquileres Texas',
    'property manager waitlist',
    'Ross House Rentals',
  ],
  openGraph: {
    title: '🚧 Administración de Propiedades · Ross House Rentals',
    description: 'Próximamente Q4 2026 – 2027. Unéte a la lista de espera y sé el primero en enterarte cuando lancemos nuestro servicio de PM en Dumas TX.',
    url: `${SITE_URL}/administracion-propiedades`,
    siteName: 'Ross House Rentals',
    locale: 'es_MX',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Administración de Propiedades · Próximamente Q4 2026-2027',
    description: 'Unéte a la waitlist · Ross House Rentals · Dumas TX',
  },
  alternates: {
    canonical: `${SITE_URL}/administracion-propiedades`,
  },
  robots: { index: true, follow: true },
}

export default function PmLayout({ children }: { children: React.ReactNode }) {
  return children
}
