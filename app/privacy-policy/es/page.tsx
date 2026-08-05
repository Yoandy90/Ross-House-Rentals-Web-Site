import LegalDocumentPage from '../../components/LegalDocumentPage';

export const revalidate = 60;

export const metadata = {
  title: 'Política de Privacidad — Ross House Rentals',
  description: 'Política de privacidad y prácticas de datos de Ross House Rentals LLC.',
};

export default function Page() {
  return <LegalDocumentPage docKey="privacy" lang="es" title="Política de Privacidad" />;
}
