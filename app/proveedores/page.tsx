import ServiceProviderForm from '../components/ServiceProviderForm';
import ProviderSocialActions from '../components/ProviderSocialActions';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.rosshouserentals.com';

export const metadata = {
  title: 'Únete a nuestra red de proveedores — Ross House Rentals · Dumas TX',
  description: '👷 Plomeros, electricistas, jardineros, pintores, albañiles y handyman. Regístrate gratis, sin comisiones. Te llamamos cuando tengamos trabajo para ti.',
  keywords: ['proveedores', 'contratistas', 'Dumas TX', 'plomero', 'electricista', 'jardinero', 'trabajos', 'Ross House Rentals'],
  alternates: {
    canonical: `${SITE_URL}/proveedores`,
    languages: {
      'es-MX': `${SITE_URL}/proveedores`,
      'en-US': `${SITE_URL}/proveedores/en`,
    },
  },
  openGraph: {
    title: 'Únete a nuestra red de proveedores 🔧 · Ross House Rentals',
    description: 'Directorio de contratistas locales en Dumas TX · Registro gratis · Sin compromiso. Plomeros, electricistas, jardineros y más.',
    url: `${SITE_URL}/proveedores`,
    siteName: 'Ross House Rentals',
    locale: 'es_MX',
    type: 'website',
    // opengraph-image.tsx auto-generates the 1200x630 image
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Únete a nuestra red de proveedores · Ross House Rentals',
    description: 'Trabajos directos · Registro gratis · Sin comisiones · Dumas TX',
  },
  robots: { index: true, follow: true },
};

export default function Page() {
  return (
    <>
      <ServiceProviderForm lang="es" />
      <ProviderSocialActions lang="es" />
    </>
  );
}
