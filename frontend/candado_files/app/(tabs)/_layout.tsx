import React, { useState, useEffect } from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../../services/api';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const [gamblingEnabled, setGamblingEnabled] = useState(false);

  // Fetch feature flags to determine if gambling tab should be shown
  useEffect(() => {
    const fetchFlags = async () => {
      try {
        const response = await api.get('/api/feature-flags');
        setGamblingEnabled(response.data?.gambling_enabled || false);
      } catch (error) {
        console.log('Feature flags not available, hiding gambling features');
        setGamblingEnabled(false);
      }
    };
    fetchFlags();
    
    // Refresh flags every 5 minutes
    const interval = setInterval(fetchFlags, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#6C1110',
        tabBarInactiveTintColor: '#999999',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 0,
          elevation: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
          paddingBottom: insets.bottom > 0 ? insets.bottom + 10 : 28,
          paddingTop: 10,
          height: 95 + insets.bottom,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
          marginTop: 4,
        },
        tabBarIconStyle: {
          marginBottom: 0,
        },
        tabBarShowLabel: true,
        headerShown: false,
      }}
    >
      {/* Tab 1: Home/Dashboard */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Inicio',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />
      
      {/* Tab 2: Appointments */}
      <Tabs.Screen
        name="appointments"
        options={{
          title: 'Citas',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar-outline" size={size} color={color} />
          ),
        }}
      />
      
      {/* Tab 3: Games - HIDDEN when gambling_enabled is false */}
      <Tabs.Screen
        name="games"
        options={{
          title: 'Juegos',
          href: gamblingEnabled ? '/(tabs)/games' : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="game-controller-outline" size={size} color={color} />
          ),
        }}
      />
      
      {/* Tab 4: Services */}
      <Tabs.Screen
        name="services"
        options={{
          title: 'Servicios',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="briefcase-outline" size={size} color={color} />
          ),
        }}
      />
      
      {/* Tab 5: Menu */}
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Menú',
          tabBarIcon: ({ color, size}) => (
            <Ionicons name="menu" size={size} color={color} />
          ),
        }}
      />
      
      {/* Hidden screens - accessible via navigation but not in tab bar */}
      <Tabs.Screen name="support" options={{ href: null }} />
      <Tabs.Screen name="my-projects" options={{ href: null }} />
      <Tabs.Screen name="quick-actions" options={{ href: null }} />
      <Tabs.Screen name="credits" options={{ href: null }} />
      <Tabs.Screen name="credit-preferences" options={{ href: null }} />
      <Tabs.Screen name="payment-methods" options={{ href: null }} />
      <Tabs.Screen name="shipments" options={{ href: null }} />
      <Tabs.Screen name="add-bank-account" options={{ href: null }} />
      <Tabs.Screen name="bolita-detail" options={{ href: null }} />
      <Tabs.Screen name="book-appointment" options={{ href: null }} />
      <Tabs.Screen name="change-password" options={{ href: null }} />
      <Tabs.Screen name="chat" options={{ href: null }} />
      <Tabs.Screen name="credit-history" options={{ href: null }} />
      <Tabs.Screen name="documents" options={{ href: null }} />
      <Tabs.Screen name="invoices" options={{ href: null }} />
      <Tabs.Screen name="education" options={{ href: null }} />
      <Tabs.Screen name="help" options={{ href: null }} />
      <Tabs.Screen name="kyc" options={{ href: null }} />
      <Tabs.Screen name="language-settings" options={{ href: null }} />
      <Tabs.Screen name="loan-application" options={{ href: null }} />
      <Tabs.Screen name="location-settings" options={{ href: null }} />
      <Tabs.Screen name="lottery" options={{ href: null }} />
      <Tabs.Screen name="my-appointments" options={{ href: null }} />
      <Tabs.Screen name="my-loans" options={{ href: null }} />
      <Tabs.Screen name="my-tax-estimates" options={{ href: null }} />
      <Tabs.Screen name="news" options={{ href: null }} />
      <Tabs.Screen name="notification-settings" options={{ href: null }} />
      <Tabs.Screen name="notifications" options={{ href: null }} />
      <Tabs.Screen name="office-hours" options={{ href: null }} />
      <Tabs.Screen name="personal-info" options={{ href: null }} />
      <Tabs.Screen name="privacy" options={{ href: null }} />
      <Tabs.Screen name="raffles" options={{ href: null }} />
      <Tabs.Screen name="referrals" options={{ href: null }} />
      <Tabs.Screen name="scratch-cards" options={{ href: null }} />
      <Tabs.Screen name="refund-requests" options={{ href: null }} />
      <Tabs.Screen name="refund" options={{ href: null }} />
      <Tabs.Screen name="request-service" options={{ href: null }} />
      <Tabs.Screen name="subscription" options={{ href: null }} />
      <Tabs.Screen name="tax-calculator" options={{ href: null }} />
      <Tabs.Screen name="tax-returns" options={{ href: null }} />
      <Tabs.Screen name="terms" options={{ href: null }} />
      <Tabs.Screen name="theme-settings" options={{ href: null }} />
      <Tabs.Screen name="tools" options={{ href: null }} />
      <Tabs.Screen name="video-call" options={{ href: null }} />
    </Tabs>
  );
}

// No styles needed for this layout
