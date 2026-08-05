import type { Metadata, Viewport } from 'next'
import { Inter, Playfair_Display } from 'next/font/google'
import './globals.css'
import { LanguageProvider } from './i18n/LanguageContext'
import Script from 'next/script'
import PublicChatbotMount from './components/PublicChatbotMount'
import VisitorTrackerMount from './components/VisitorTrackerMount'
import NewsletterModalMount from './components/NewsletterModalMount'
import { AppStickyBanner } from './components/AppPromoBanner'
import { ThemeProvider, THEME_NO_FLASH_SCRIPT } from './components/ThemeProvider'

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

// JSON-LD Structured Data — multiple schemas for richer SERP appearance
const orgSchema = {
  '@context': 'https://schema.org',
  '@type': ['RealEstateAgent', 'LocalBusiness', 'Organization'],
  '@id': 'https://www.rosshouserentals.com/#org',
  name: 'Ross House Rentals LLC',
  legalName: 'Ross House Rentals LLC',
  description: 'Professional property management and rental homes in Dumas, Texas. Bilingual service in English and Spanish.',
  url: 'https://www.rosshouserentals.com',
  logo: 'https://www.rosshouserentals.com/logo.jpg',
  image: 'https://www.rosshouserentals.com/og-image.jpg',
  telephone: '+1-806-934-2018',
  email: 'info@rosshouserentals.com',
  foundingDate: '2010',
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
  openingHoursSpecification: [
    {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      opens: '09:00',
      closes: '17:00'
    },
    {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: 'Saturday',
      opens: '10:00',
      closes: '14:00'
    }
  ],
  sameAs: [
    'https://www.facebook.com/rosshouserentals',
  ],
  areaServed: [
    { '@type': 'City', name: 'Dumas', containedInPlace: { '@type': 'State', name: 'Texas' } },
    { '@type': 'City', name: 'Amarillo', containedInPlace: { '@type': 'State', name: 'Texas' } },
    { '@type': 'PostalCode', postalCode: '79029' },
    { '@type': 'PostalCode', postalCode: '79045' },
  ],
  priceRange: '$1000-$2000',
  knowsLanguage: ['en-US', 'es-US'],
  hasOfferCatalog: {
    '@type': 'OfferCatalog',
    name: 'Services',
    itemListElement: [
      { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Property Management', description: 'Professional rental property management — tenant screening, leasing, maintenance, rent collection.' } },
      { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Rental Listings', description: 'Quality rental homes in Dumas, TX with flexible lease terms.' } },
      { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Investment Property Acquisition', description: 'Help investors find and acquire high-ROI rental properties in Dumas, Texas.' } },
      { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Maintenance Coordination', description: 'On-call coordination of plumbing, electrical, HVAC and general handyman services for properties under management.' } },
      { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Tenant Waitlist', description: 'Free notification list for upcoming rental availability matching your criteria.' } },
    ]
  },
}

const websiteSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': 'https://www.rosshouserentals.com/#website',
  url: 'https://www.rosshouserentals.com',
  name: 'Ross House Rentals',
  publisher: { '@id': 'https://www.rosshouserentals.com/#org' },
  inLanguage: ['es-US', 'en-US'],
  potentialAction: {
    '@type': 'SearchAction',
    target: 'https://www.rosshouserentals.com/?q={search_term_string}',
    'query-input': 'required name=search_term_string'
  }
}

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  '@id': 'https://www.rosshouserentals.com/#faq',
  mainEntity: [
    {
      '@type': 'Question',
      name: '¿Qué áreas atiende Ross House Rentals?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Atendemos principalmente Dumas, TX y áreas cercanas del Texas Panhandle incluyendo Amarillo. Nuestros códigos ZIP principales son 79029 y 79045.'
      }
    },
    {
      '@type': 'Question',
      name: 'How can I apply to rent a home?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'You can apply online through our website, join our tenant waitlist to get notified when properties become available, or call us directly at (806) 934-2018. We respond within 24 hours.'
      }
    },
    {
      '@type': 'Question',
      name: '¿Ofrecen administración de propiedades a inversionistas?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Sí. Ofrecemos administración completa para inversionistas: selección de inquilinos, contratos, cobro de renta, mantenimiento y reportes financieros. Visita nuestra página de Inversiones para más detalles.'
      }
    },
    {
      '@type': 'Question',
      name: 'Do you speak Spanish?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes — our team is fully bilingual in English and Spanish. Servimos a la comunidad hispana de Dumas con atención completa en español.'
      }
    },
    {
      '@type': 'Question',
      name: '¿Cómo solicito mantenimiento si soy inquilino?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Inicia sesión en el Portal de Inquilinos y crea una solicitud de mantenimiento. Ross House coordina con proveedores verificados (plomeros, electricistas, etc.) y maneja todo por ti. Para emergencias, llama al (806) 934-2018.'
      }
    },
  ]
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="scroll-smooth" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/logo.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#050810" />
        <link rel="preconnect" href="https://images.pexels.com" />
        <link rel="dns-prefetch" href="https://images.pexels.com" />
        <link rel="preconnect" href="https://ross-house-backend-production.up.railway.app" />
        <script dangerouslySetInnerHTML={{ __html: THEME_NO_FLASH_SCRIPT }} />
        <Script
          id="ld-org"
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(orgSchema) }}
        />
        <Script
          id="ld-website"
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
        />
        <Script
          id="ld-faq"
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
        />
      </head>
      <body className={`${inter.variable} ${playfair.variable} font-body antialiased theme-transition`}>
        <ThemeProvider>
          <LanguageProvider>
            {children}
            <VisitorTrackerMount />
            <PublicChatbotMount />
            <NewsletterModalMount />
            <AppStickyBanner />
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
