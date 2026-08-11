import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '../src/contexts/AuthContext';
import { Colors } from '../src/constants/theme';
import '../src/i18n';
import { loadSavedLanguage } from '../src/i18n';
import StripeWrapper from '../src/components/StripeWrapper';
import NetworkStatusBanner from '../src/components/NetworkStatusBanner';

export default function RootLayout() {
  const [langReady, setLangReady] = useState(false);

  useEffect(() => {
    loadSavedLanguage().then(() => setLangReady(true)).catch(() => setLangReady(true));
  }, []);

  if (!langReady) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.bg, justifyContent: 'center', alignItems: 'center' }}>
        <StatusBar style="light" />
        <ActivityIndicator size="large" color={Colors.primaryLight} />
      </View>
    );
  }

  return (
    <StripeWrapper>
      <AuthProvider>
        <StatusBar style="light" />
        <View style={{ flex: 1, backgroundColor: Colors.bg }}>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: Colors.bg },
              animation: 'slide_from_right',
            }}
          >
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="(admin)" options={{ headerShown: false }} />
            <Stack.Screen 
              name="profile" 
              options={{ 
                headerShown: false,
                presentation: 'card',
              }} 
            />
            <Stack.Screen 
              name="loan" 
              options={{ 
                headerShown: false,
                presentation: 'card',
              }} 
            />
          </Stack>
          <NetworkStatusBanner />
        </View>
      </AuthProvider>
    </StripeWrapper>
  );
}
