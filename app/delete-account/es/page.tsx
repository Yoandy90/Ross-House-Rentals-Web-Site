import LegalDocumentPage from '../../components/LegalDocumentPage';

export const revalidate = 60;

export const metadata = {
  title: 'Eliminación de Cuenta — Ross House Rentals',
  description: 'Cómo solicitar la eliminación de su cuenta de Ross House Rentals.',
};

export default function Page() {
  return <LegalDocumentPage docKey="account_deletion" lang="es" title="Eliminación de Cuenta — FAQ" />;
}
