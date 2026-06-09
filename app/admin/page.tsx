import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Dashboard',
  description: 'Panel de administración de Ross House Rentals - Vista general de propiedades, inquilinos y finanzas',
  robots: {
    index: false,
    follow: false,
  },
}

export { default } from './page-client'
