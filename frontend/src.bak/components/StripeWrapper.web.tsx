import React from 'react';

// Web: No StripeProvider needed (native-only)
export default function StripeWrapper({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
