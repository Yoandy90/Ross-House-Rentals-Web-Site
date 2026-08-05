import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Casas en Renta en Dumas, TX — Catálogo Completo',
  description: 'Explora nuestro inventario completo de casas en renta en Dumas, Texas. Filtra por precio, habitaciones, baños y ubicación. Aplicación online disponible.',
  keywords: [
    'casas en renta Dumas TX',
    'rental homes Dumas Texas',
    'apartamentos Dumas',
    'casas disponibles Dumas',
    'Ross House Rentals propiedades',
    'alquiler casas Dumas Texas',
  ],
  openGraph: {
    title: 'Catálogo de Casas en Renta — Ross House Rentals',
    description: 'Casas de calidad en Dumas, TX. Vista completa con filtros, fotos y aplicación online.',
    url: 'https://www.rosshouserentals.com/propiedades',
    siteName: 'Ross House Rentals',
    locale: 'es_US',
    type: 'website',
  },
  alternates: {
    canonical: 'https://www.rosshouserentals.com/propiedades',
  },
}

export default function PropiedadesLayout({ children }: { children: React.ReactNode }) {
  return children
}
