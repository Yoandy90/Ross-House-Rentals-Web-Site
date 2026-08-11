import React, { useState, useEffect } from 'react';
import { Redirect } from 'expo-router';
import { useAuth } from '../src/contexts/AuthContext';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Colors } from '../src/constants/theme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import OnboardingScreen from '../src/components/OnboardingScreen';

const ONBOARDING_KEY = '@rosslending_onboarding_completed';

export default function Index() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const [showOnboarding, setShowOnboarding] = useState<boolean | null>(null);

  useEffect(() => {
    checkOnboarding();
  }, []);

  const checkOnboarding = async () => {
    try {
      const completed = await AsyncStorage.getItem(ONBOARDING_KEY);
      setShowOnboarding(completed !== 'true');
    } catch {
      setShowOnboarding(false);
    }
  };

  const handleOnboardingFinish = async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    } catch {}
    setShowOnboarding(false);
  };

  // Still loading auth or onboarding check
  if (isLoading || showOnboarding === null) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={Colors.primaryLight} />
      </View>
    );
  }

  // Show onboarding on first launch
  if (showOnboarding) {
    return <OnboardingScreen onFinish={handleOnboardingFinish} />;
  }

  if (isAuthenticated) {
    // Admin users go directly to the Admin Dashboard
    if (user?.role === 'admin') {
      return <Redirect href="/(admin)/dashboard" />;
    }
    return <Redirect href="/(tabs)" />;
  }

  return <Redirect href="/(auth)/login" />;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.bg,
  },
});
