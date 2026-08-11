import React from 'react';
import { StripeProvider } from '@stripe/stripe-react-native';

const STRIPE_KEY = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || 'pk_live_51PTofW04q9n6utOmWTyGMfSCw1H91ZV2BjEcC16qn6BdpIeflsYkJHaptkCdoCDhwODFzg4xrfEcn9insFmpYRYM00UWCVcmEz';

export default function StripeWrapper({ children }: { children: React.ReactNode }) {
  return <StripeProvider publishableKey={STRIPE_KEY}>{children}</StripeProvider>;
}
