import ServiceProviderForm from '../../components/ServiceProviderForm';
import ProviderSocialActions from '../../components/ProviderSocialActions';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.rosshouserentals.com';

export const metadata = {
  title: 'Join our contractors network — Ross House Rentals · Dumas TX',
  description: '👷 Plumbers, electricians, gardeners, painters, masons and handymen. Sign up free, no commissions. We call you when we have work for you.',
  keywords: ['service providers', 'contractors', 'Dumas TX', 'plumber', 'electrician', 'gardener', 'jobs', 'Ross House Rentals'],
  alternates: {
    canonical: `${SITE_URL}/proveedores/en`,
    languages: {
      'es-MX': `${SITE_URL}/proveedores`,
      'en-US': `${SITE_URL}/proveedores/en`,
    },
  },
  openGraph: {
    title: 'Join our contractors network 🔧 · Ross House Rentals',
    description: 'Direct jobs in Dumas TX · Free signup · No commissions · Fast payments. Plumbers, electricians, gardeners and more.',
    url: `${SITE_URL}/proveedores/en`,
    siteName: 'Ross House Rentals',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Join our contractors network · Ross House Rentals',
    description: 'Direct jobs · Free signup · No commissions · Dumas TX',
  },
  robots: { index: true, follow: true },
};

export default function Page() {
  return (
    <>
      <ServiceProviderForm lang="en" />
      <ProviderSocialActions lang="en" />
    </>
  );
}
