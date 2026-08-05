import React from 'react';
import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        // CRITICAL FIX: Disable ALL animations to prevent REASwizzledUIManager crash
        // react-native-screens uses Reanimated internally for transitions
        // This causes SIGABRT when the screen is unmounted during login navigation
        animation: 'none',
        animationTypeForReplace: 'push',
        // Additional fixes for iOS screen management
        detachInactiveScreens: false,
        freezeOnBlur: false,
        // Disable gesture to prevent animation-related crashes
        gestureEnabled: false,
      }}
    >
      <Stack.Screen
        name="login"
        options={{
          title: 'Iniciar Sesión',
          animation: 'none',
        }}
      />
      <Stack.Screen
        name="register"
        options={{
          title: 'Registrarse',
          animation: 'none',
        }}
      />
    </Stack>
  );
}
