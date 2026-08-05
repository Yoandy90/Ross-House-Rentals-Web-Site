import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Invertir en Bienes Raíces en Dumas, Texas | Ross House Rentals',
  description: 'Descubre oportunidades de inversión inmobiliaria en Dumas, TX con ROI superior al promedio nacional. Cap Rate alto, baja entrada y administración profesional bilingüe.',
  keywords: [
    'invertir en Dumas Texas',
    'inversión inmobiliaria Dumas',
    'real estate investment Dumas TX',
    'cap rate Dumas',
    'cash on cash ROI Texas Panhandle',
    'propiedades de inversión Dumas',
    'rental property investor Dumas',
  ],
  openGraph: {
    title: 'Invertir en Bienes Raíces en Dumas, TX',
    description: 'Bajo costo de entrada, alta demanda de alquiler y administración profesional. Datos del mercado en vivo via Mashvisor®.',
    url: 'https://www.rosshouserentals.com/invest',
    type: 'website',
    locale: 'es_US',
    alternateLocale: 'en_US',
    images: [{ url: '/og-image.jpg', width: 1200, height: 630, alt: 'Invertir en Ross House Rentals' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Inversión Inmobiliaria en Dumas, TX',
    description: 'Métricas en vivo de Mashvisor®. ROI superior al promedio nacional.',
  },
  alternates: {
    canonical: 'https://www.rosshouserentals.com/invest',
    languages: {
      'es-US': 'https://www.rosshouserentals.com/invest',
      'en-US': 'https://www.rosshouserentals.com/invest',
    },
  },
}

export default function InvestLayout({ children }: { children: React.ReactNode }) {
  return children
}
