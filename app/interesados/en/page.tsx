import TenantWaitlistForm from '../../components/TenantWaitlistForm';

export const metadata = {
  title: 'Waitlist — Ross House Rentals Dumas TX',
  description: 'Join our tenant waitlist. We notify you when a property matches your criteria.',
};

export default function Page() {
  return <TenantWaitlistForm lang="en" />;
}
