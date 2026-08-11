/**
 * PayLayoutNative.tsx
 * Native-only Stripe Provider wrapper
 * This file is only required/imported on iOS and Android
 */
import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StripeProvider } from '@stripe/stripe-react-native';

const API_BASE = process.env.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_BACKEND_URL || '';
const FALLBACK_KEY = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';
const CACHE_KEY = 'stripe_publishable_key';

export default function PayLayoutNative() {
  const [publishableKey, setPublishableKey] = useState<string>(FALLBACK_KEY);

  useEffect(() => {
    loadStripeKey();
  }, []);

  const loadStripeKey = async () => {
    try {
      // Check cache first
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached && cached.startsWith('pk_')) {
        setPublishableKey(cached);
      }
      // Fetch fresh key
      const apiUrl = `${API_BASE}/api/public/stripe-config`;
      const response = await fetch(apiUrl);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.publishable_key?.startsWith('pk_')) {
          setPublishableKey(data.publishable_key);
          await AsyncStorage.setItem(CACHE_KEY, data.publishable_key);
        }
      }
    } catch (e) {
      console.log('PayLayoutNative: Using fallback Stripe key');
    }
  };

  const content = (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0C0C0E' } }} />
  );

  if (!publishableKey?.startsWith('pk_')) {
    return content;
  }

  return (
    <StripeProvider
      publishableKey={publishableKey}
      merchantIdentifier="merchant.com.rosshouse.rentals"
    >
      {content}
    </StripeProvider>
  );
}
