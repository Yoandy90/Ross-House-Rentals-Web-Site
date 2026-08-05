import LegalDocumentPage from '../../components/LegalDocumentPage';

export const revalidate = 60;

export const metadata = {
  title: 'Política de Cookies — Ross House Rentals',
  description: 'Política de cookies de Ross House Rentals LLC.',
};

export default function Page() {
  return <LegalDocumentPage docKey="cookies" lang="es" title="Política de Cookies" />;
}
