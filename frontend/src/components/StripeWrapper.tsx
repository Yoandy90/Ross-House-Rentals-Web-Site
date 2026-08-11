import React, { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Only import Stripe on native platforms
let StripeProvider: any = null;
if (Platform.OS !== 'web') {
  try {
    const stripeModule = require('@stripe/stripe-react-native');
    StripeProvider = stripeModule.StripeProvider;
  } catch (e) {
    console.log('Stripe native module not available');
  }
}

const FALLBACK_KEY = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';
const CACHE_KEY = 'stripe_publishable_key';
const API_BASE = process.env.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_BACKEND_URL || '';

export default function StripeWrapper({ children }: { children: React.ReactNode }) {
  const [publishableKey, setPublishableKey] = useState<string>(FALLBACK_KEY);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    loadStripeKey();
  }, []);

  const loadStripeKey = async () => {
    try {
      // 1. Check cache first
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached && cached.startsWith('pk_')) {
        setPublishableKey(cached);
      }

      // 2. Fetch fresh key from backend
      const apiUrl = `${API_BASE}/api/public/stripe-config`;
      const response = await fetch(apiUrl);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.publishable_key && data.publishable_key.startsWith('pk_')) {
          setPublishableKey(data.publishable_key);
          await AsyncStorage.setItem(CACHE_KEY, data.publishable_key);
        }
      }
    } catch (err) {
      console.log('StripeWrapper: Using fallback key', err);
      // Keep using FALLBACK_KEY or cached key
    } finally {
      setIsReady(true);
    }
  };

  // If on web or Stripe not available, just render children
  if (Platform.OS === 'web' || !StripeProvider) {
    return <>{children}</>;
  }

  // Wait until we've tried to load the key
  if (!isReady) {
    return <>{children}</>;
  }

  // If no valid key, render without Stripe
  if (!publishableKey || !publishableKey.startsWith('pk_')) {
    console.log('StripeWrapper: No valid publishable key, rendering without Stripe');
    return <>{children}</>;
  }

  return (
    <StripeProvider
      publishableKey={publishableKey}
      merchantIdentifier="merchant.com.rosshouse.rentals"
    >
      {children}
    </StripeProvider>
  );
}
