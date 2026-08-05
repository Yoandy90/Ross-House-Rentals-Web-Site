import LegalDocumentPage from '../components/LegalDocumentPage';

export const revalidate = 60;

export const metadata = {
  title: 'Cookie Policy — Ross House Rentals',
  description: 'Ross House Rentals LLC cookie policy.',
};

export default function Page() {
  return <LegalDocumentPage docKey="cookies" lang="en" title="Cookie Policy" />;
}
