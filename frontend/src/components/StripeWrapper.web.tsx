import React, { createContext, useContext, useEffect, useState } from 'react';

/**
 * StripeWrapper.web.tsx
 * Web version - Stripe React Native SDK no funciona en web.
 * Esto provee un contexto mock y opcionalmente carga la publishable key
 * desde el backend para cuando se integre Stripe.js en web.
 */

interface StripeWebContextType {
  publishableKey: string;
  isLoading: boolean;
}

const StripeWebContext = createContext<StripeWebContextType>({
  publishableKey: '',
  isLoading: true,
});

export const useStripeWebContext = () => useContext(StripeWebContext);

const API_BASE = process.env.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_BACKEND_URL || '';

export default function StripeWrapper({ children }: { children: React.ReactNode }) {
  const [publishableKey, setPublishableKey] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStripeKey();
  }, []);

  const loadStripeKey = async () => {
    try {
      const apiUrl = `${API_BASE}/api/public/stripe-config`;
      const response = await fetch(apiUrl);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.publishable_key && data.publishable_key.startsWith('pk_')) {
          setPublishableKey(data.publishable_key);
        }
      }
    } catch (err) {
      console.log('StripeWrapper.web: Could not fetch Stripe key', err);
    }
    setIsLoading(false);
  };

  return (
    <StripeWebContext.Provider value={{ publishableKey, isLoading }}>
      {children}
    </StripeWebContext.Provider>
  );
}
