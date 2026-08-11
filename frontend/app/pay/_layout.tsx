import React from 'react';
import { Stack } from 'expo-router';
import { Platform } from 'react-native';

// Import native-specific layout only on native platforms
// This avoids Metro bundling Stripe on web completely
const NativePayLayout = Platform.OS !== 'web' 
  ? require('../../src/components/PayLayoutNative').default 
  : null;

export default function PayLayout() {
  // On web, just render a simple stack
  if (Platform.OS === 'web' || !NativePayLayout) {
    return (
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0C0C0E' } }} />
    );
  }

  // On native, use the full Stripe-enabled layout
  return <NativePayLayout />;
}
