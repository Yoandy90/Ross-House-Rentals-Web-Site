import LegalDocumentPage from '../components/LegalDocumentPage';

export const revalidate = 60;

export const metadata = {
  title: 'Account Deletion — Ross House Rentals',
  description: 'How to request the deletion of your Ross House Rentals account.',
};

export default function Page() {
  return <LegalDocumentPage docKey="account_deletion" lang="en" title="Account Deletion FAQ" />;
}
