import LegalDocumentPage from '../components/LegalDocumentPage';

export const revalidate = 60;

export const metadata = {
  title: 'Privacy Policy — Ross House Rentals',
  description: 'Ross House Rentals LLC privacy policy and data practices.',
};

export default function Page() {
  return <LegalDocumentPage docKey="privacy" lang="en" title="Privacy Policy" />;
}
