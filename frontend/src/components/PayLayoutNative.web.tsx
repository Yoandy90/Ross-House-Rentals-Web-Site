/**
 * PayLayoutNative.web.tsx
 * Web stub - returns null since Stripe is not available on web
 */
import React from 'react';
import { Stack } from 'expo-router';

export default function PayLayoutNative() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0C0C0E' } }} />
  );
}
