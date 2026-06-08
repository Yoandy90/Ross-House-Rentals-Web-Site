import type { Metadata } from 'next'
import { Inter, Playfair_Display } from 'next/font/google'
import './globals.css'
import { LanguageProvider } from './i18n/LanguageContext'

const inter = Inter({ subsets: ['latin'], variable: '--font-body' })
const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-display' })

export const metadata: Metadata = {
  title: 'Ross House Rentals LLC | Alquiler de Casas en Dumas, TX',
  description: 'Hogares de alquiler de calidad con administración profesional en Dumas, Texas. Casas disponibles, portal de inquilinos e inversión inmobiliaria.',
  keywords: 'rental homes, Dumas Texas, property management, casas en renta, Ross House Rentals',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={`${inter.variable} ${playfair.variable} font-body`}>
        <LanguageProvider>
          {children}
        </LanguageProvider>
      </body>
    </html>
  )
}
