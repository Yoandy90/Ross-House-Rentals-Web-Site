import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AnimatedSplashScreen from '../components/AnimatedSplashScreen';
import OnboardingScreen from '../components/OnboardingScreen';
import LocationPermissionModal from '../components/LocationPermissionModal';

const ONBOARDING_KEY = '@ross_tax_onboarding_completed';
const LOCATION_PERMISSION_KEY = '@location_permission_asked';

export default function Index() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [showSplash, setShowSplash] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [readyToNavigate, setReadyToNavigate] = useState(false);
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);

  // Verificar si el onboarding ya se mostró
  useEffect(() => {
    checkOnboardingStatus();
  }, []);

  const checkOnboardingStatus = async () => {
    try {
      const completed = await AsyncStorage.getItem(ONBOARDING_KEY);
      if (!completed && !user) {
        // Primera vez y sin usuario logueado -> mostrar onboarding
        setShowOnboarding(true);
      }
    } catch (error) {
      console.error('Error checking onboarding status:', error);
    } finally {
      setCheckingOnboarding(false);
    }
  };

  // Esperar a que termine el splash y la autenticación
  useEffect(() => {
    if (!loading && !showSplash && !showOnboarding && readyToNavigate && !checkingOnboarding) {
      if (user) {
        // Check if user is admin
        if (user.role === 'admin' || user.role === 'office_assistant') {
          router.replace('/(admin)');
        } else {
          router.replace('/(tabs)');
        }
      } else {
        router.replace('/(auth)/login');
      }
    }
  }, [user, loading, showSplash, showOnboarding, readyToNavigate, checkingOnboarding]);

  const handleSplashFinish = () => {
    setShowSplash(false);
    if (!showOnboarding) {
      setReadyToNavigate(true);
    }
  };

  const handleOnboardingComplete = async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
      setShowOnboarding(false);
      setReadyToNavigate(true);
    } catch (error) {
      console.error('Error saving onboarding status:', error);
      setShowOnboarding(false);
      setReadyToNavigate(true);
    }
  };

  // Mostrar el splash screen animado
  if (showSplash) {
    return <AnimatedSplashScreen onFinish={handleSplashFinish} />;
  }

  // Mostrar onboarding si es primera vez
  if (showOnboarding && !checkingOnboarding) {
    return <OnboardingScreen onComplete={handleOnboardingComplete} />;
  }

  // Pantalla de transición mientras se navega
  return <View style={styles.container} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#6C1110',
  },
});
