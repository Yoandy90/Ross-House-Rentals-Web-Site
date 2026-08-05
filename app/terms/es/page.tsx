import LegalDocumentPage from '../../components/LegalDocumentPage';

export const revalidate = 60;

export const metadata = {
  title: 'Términos y Condiciones — Ross House Rentals',
  description: 'Términos y condiciones del servicio de Ross House Rentals LLC.',
};

export default function Page() {
  return <LegalDocumentPage docKey="terms" lang="es" title="Términos y Condiciones" />;
}
