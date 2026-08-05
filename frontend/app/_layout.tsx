import 'react-native-get-random-values';
import React from 'react';
import { Stack } from 'expo-router';
import { AuthProvider } from '../contexts/AuthContext';
import { ThemeProvider } from '../contexts/ThemeContext';
import { NotificationProvider } from '../contexts/NotificationContext';
import { ReferralProvider } from '../contexts/ReferralContext';
import { StatusBar } from 'expo-status-bar';
import { VersionChecker } from '../components/VersionChecker';
import '../i18n/config';
import { enableScreens } from 'react-native-screens';

// CRITICAL FIX: Disable native screens to prevent SIGABRT crash on iOS 18.3+
// The crash occurs in RNSScreen setViewToSnapshot during unmountChildComponentView
// This is a known issue with react-native-screens 4.x and iOS 18+ SDK
// Disabling screens uses JS-based navigation which is more stable
enableScreens(false);

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <NotificationProvider>
          <ReferralProvider>
            {/* StatusBar style eliminado - se maneja en cada layout individual */}
            <VersionChecker />
            <Stack
              screenOptions={{
                headerShown: false,
                // CRITICAL FIX: Disable animations to prevent REASwizzledUIManager crash
                // react-native-screens 4.16 + reanimated causes SIGABRT during unmount
                animation: 'none',
                animationTypeForReplace: 'push',
                detachInactiveScreens: false,
                freezeOnBlur: false,
                gestureEnabled: false,
              }}
            />
          </ReferralProvider>
        </NotificationProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
