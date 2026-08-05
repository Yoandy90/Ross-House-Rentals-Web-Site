import TenantWaitlistForm from '../components/TenantWaitlistForm';

export const metadata = {
  title: 'Lista de Espera — Ross House Rentals Dumas TX',
  description: 'Únete a nuestra lista de inquilinos interesados. Te avisamos cuando una propiedad coincida con tus criterios.',
};

export default function Page() {
  return <TenantWaitlistForm lang="es" />;
}
