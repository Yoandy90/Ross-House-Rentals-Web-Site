import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Lista de Espera de Inquilinos | Casas en Renta en Dumas, TX',
  description: 'Únete a nuestra lista de espera gratuita y sé el primero en enterarte cuando una casa coincida con tus criterios en Dumas, Texas. Alertas por email y SMS, sin compromiso.',
  keywords: [
    'lista de espera casas Dumas',
    'casas en renta Dumas TX',
    'rental waitlist Dumas Texas',
    'casas disponibles Dumas',
    'apartments Dumas TX',
    'alquiler Dumas Panhandle',
  ],
  openGraph: {
    title: 'Lista de Espera — Casas en Renta Dumas, TX',
    description: 'Te avisamos cuando una casa coincida con tus criterios. Gratis, sin compromiso.',
    url: 'https://www.rosshouserentals.com/interesados',
    type: 'website',
    locale: 'es_US',
    images: [{ url: '/og-image.jpg', width: 1200, height: 630, alt: 'Lista de Espera Ross House Rentals' }],
  },
  alternates: {
    canonical: 'https://www.rosshouserentals.com/interesados',
    languages: {
      'es-US': 'https://www.rosshouserentals.com/interesados',
      'en-US': 'https://www.rosshouserentals.com/interesados/en',
    },
  },
}

export default function InteresadosLayout({ children }: { children: React.ReactNode }) {
  return children
}
