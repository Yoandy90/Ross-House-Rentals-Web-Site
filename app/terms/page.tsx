import LegalDocumentPage from '../components/LegalDocumentPage';

export const revalidate = 60;

export const metadata = {
  title: 'Terms and Conditions — Ross House Rentals',
  description: 'Ross House Rentals LLC terms and conditions of service.',
};

export default function Page() {
  return <LegalDocumentPage docKey="terms" lang="en" title="Terms & Conditions" />;
}
