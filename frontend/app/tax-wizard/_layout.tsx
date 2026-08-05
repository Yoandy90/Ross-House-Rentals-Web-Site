/**
 * Tax Wizard Layout - TurboTax-style guided wizard
 * Provides navigation structure for the 6-step wizard
 */
import { Stack } from 'expo-router';
import React from 'react';

export default function TaxWizardLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="personal-info" />
      <Stack.Screen name="filing-status" />
      <Stack.Screen name="income" />
      <Stack.Screen name="dependents" />
      <Stack.Screen name="deductions" />
      <Stack.Screen name="review" />
      <Stack.Screen name="recommendation" />
      <Stack.Screen name="w2-scanner" />
      <Stack.Screen name="admin" />
    </Stack>
  );
}
