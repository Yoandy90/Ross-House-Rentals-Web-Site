import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Únete a Nuestra Red de Proveedores | Plomeros, Electricistas, Handyman Dumas TX',
  description: 'Plomeros, electricistas, jardineros, pintores, albañiles y handyman en Dumas, TX. Regístrate GRATIS en el directorio de proveedores locales de Ross House Rentals — sin compromiso, sin cuotas. Te llamamos cuando necesitemos tus servicios.',
  keywords: [
    'proveedores Dumas TX',
    'plomeros Dumas',
    'electricistas Dumas Texas',
    'handyman Dumas',
    'contratistas Texas Panhandle',
    'jardineros Dumas',
    'pintores Dumas',
    'albañiles Dumas',
    'service providers Dumas TX',
  ],
  openGraph: {
    title: 'Red de Proveedores Ross House Rentals',
    description: 'Registro gratuito para contratistas en Dumas, TX. Recibe trabajos directos, sin comisiones.',
    url: 'https://www.rosshouserentals.com/proveedores',
    type: 'website',
    locale: 'es_US',
    images: [{ url: '/og-image.jpg', width: 1200, height: 630, alt: 'Red de Proveedores Ross House' }],
  },
  alternates: {
    canonical: 'https://www.rosshouserentals.com/proveedores',
    languages: {
      'es-US': 'https://www.rosshouserentals.com/proveedores',
      'en-US': 'https://www.rosshouserentals.com/proveedores/en',
    },
  },
}

export default function ProveedoresLayout({ children }: { children: React.ReactNode }) {
  return children
}
