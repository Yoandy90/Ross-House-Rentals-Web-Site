import type { Metadata, Viewport } from 'next'
import { Inter, Playfair_Display } from 'next/font/google'
import './globals.css'
import { LanguageProvider } from './i18n/LanguageContext'
import Script from 'next/script'

const inter = Inter({ 
  subsets: ['latin'], 
  variable: '--font-body',
  display: 'swap',
  preload: true,
})

const playfair = Playfair_Display({ 
  subsets: ['latin'], 
  variable: '--font-display',
  display: 'swap',
  preload: true,
})

// SEO Metadata
export const metadata: Metadata = {
  metadataBase: new URL('https://www.rosshouserentals.com'),
  title: {
    default: 'Ross House Rentals LLC | Casas en Renta en Dumas, TX',
    template: '%s | Ross House Rentals'
  },
  description: 'Encuentra tu hogar ideal en Dumas, Texas. Ross House Rentals ofrece casas de calidad con administración profesional, mantenimiento 24/7 y portal de inquilinos.',
  keywords: [
    'casas en renta Dumas TX',
    'rental homes Dumas Texas', 
    'property management Dumas',
    'alquiler de casas Texas',
    'Ross House Rentals',
    'casas disponibles Dumas',
    'renta de propiedades',
    'administración de propiedades',
    'inquilinos Dumas'
  ],
  authors: [{ name: 'Ross House Rentals LLC' }],
  creator: 'Ross House Rentals LLC',
  publisher: 'Ross House Rentals LLC',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: 'website',
    locale: 'es_US',
    alternateLocale: 'en_US',
    url: 'https://www.rosshouserentals.com',
    siteName: 'Ross House Rentals',
    title: 'Ross House Rentals | Casas en Renta en Dumas, Texas',
    description: 'Encuentra tu hogar ideal en Dumas, Texas. Casas de calidad con administración profesional.',
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'Ross House Rentals - Casas en Renta en Dumas, TX',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Ross House Rentals | Casas en Renta en Dumas, TX',
    description: 'Encuentra tu hogar ideal en Dumas, Texas. Administración profesional de propiedades.',
    images: ['/og-image.jpg'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    // Add your verification codes here
    // google: 'your-google-verification-code',
    // yandex: 'your-yandex-verification-code',
  },
  alternates: {
    canonical: 'https://www.rosshouserentals.com',
    languages: {
      'es-US': 'https://www.rosshouserentals.com',
      'en-US': 'https://www.rosshouserentals.com',
    },
  },
  category: 'real estate',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
  ],
}

// JSON-LD Structured Data
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'RealEstateAgent',
  name: 'Ross House Rentals LLC',
  description: 'Professional property management and rental homes in Dumas, Texas',
  url: 'https://www.rosshouserentals.com',
  logo: 'https://www.rosshouserentals.com/logo.svg',
  image: 'https://www.rosshouserentals.com/og-image.jpg',
  telephone: '+1-806-934-2018',
  email: 'info@rosshouserentals.com',
  address: {
    '@type': 'PostalAddress',
    streetAddress: '305 Bruce Ave',
    addressLocality: 'Dumas',
    addressRegion: 'TX',
    postalCode: '79029',
    addressCountry: 'US'
  },
  geo: {
    '@type': 'GeoCoordinates',
    latitude: 35.8656,
    longitude: -101.9730
  },
  openingHoursSpecification: {
    '@type': 'OpeningHoursSpecification',
    dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    opens: '09:00',
    closes: '17:00'
  },
  sameAs: [
    'https://www.facebook.com/rosshouserentals',
  ],
  areaServed: {
    '@type': 'City',
    name: 'Dumas',
    containedInPlace: {
      '@type': 'State',
      name: 'Texas'
    }
  },
  priceRange: '$1000-$1500'
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="scroll-smooth">
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/logo.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="preconnect" href="https://images.pexels.com" />
        <link rel="dns-prefetch" href="https://images.pexels.com" />
        <link rel="preconnect" href="https://ross-house-backend-production.up.railway.app" />
        <Script
          id="json-ld"
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className={`${inter.variable} ${playfair.variable} font-body antialiased`}>
        <LanguageProvider>
          {children}
        </LanguageProvider>
      </body>
    </html>
  )
}
