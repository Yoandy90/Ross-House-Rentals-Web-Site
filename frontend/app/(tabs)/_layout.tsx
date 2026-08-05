import React, { useState, useEffect } from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';
// DISABLED: expo-notifications causing TurboModule crash on iOS 18.3
// import { registerForPushNotificationsAsync } from '../../services/notificationService';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [gamblingEnabled, setGamblingEnabled] = useState(false);

  // Fetch feature flags to determine if gambling tab should be shown
  useEffect(() => {
    const fetchFlags = async () => {
      try {
        const response = await api.get('/feature-flags');
        setGamblingEnabled(response.data?.gambling_enabled || false);
      } catch (error) {
        setGamblingEnabled(false);
      }
    };
    fetchFlags();
    
    // Refresh flags every 5 minutes
    const interval = setInterval(fetchFlags, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // DISABLED: Push notifications initialization causing TurboModule crash
  // Will be re-enabled after fixing expo-notifications compatibility with iOS 18.3
  // useEffect(() => {
  //   const initNotifications = async () => {
  //     try {
  //       await registerForPushNotificationsAsync();
  //     } catch (error) {
  //     }
  //   };
  //   initNotifications();
  // }, []);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#10B981',
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 0,
          elevation: 12,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.08,
          shadowRadius: 12,
          paddingBottom: insets.bottom > 0 ? insets.bottom + 10 : 28,
          paddingTop: 12,
          height: 98 + insets.bottom,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 4,
          letterSpacing: 0.3,
        },
        tabBarIconStyle: {
          marginBottom: 0,
        },
        tabBarShowLabel: true,
        headerShown: false,
        // Fix para crash iOS 18.3+ en react-native-screens
        // Previene SIGABRT en setViewToSnapshot durante navegación
        detachInactiveScreens: false,
        freezeOnBlur: false,
        // Deshabilitar animaciones para evitar snapshot crash
        animation: 'none',
        // Lazy loading restaurado - notificaciones deshabilitadas
        lazy: true,
      }}
    >
      {/* Tab 1: Home/Dashboard */}
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.home', 'Inicio'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />
      
      {/* Tab 2: Taxes - Dedicated Tax Wizard Hub */}
      <Tabs.Screen
        name="taxes"
        options={{
          title: t('tabs.taxes', 'Impuestos'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="document-text-outline" size={size} color={color} />
          ),
        }}
      />
      
      {/* Tab 3: Appointments */}
      <Tabs.Screen
        name="appointments"
        options={{
          title: t('tabs.appointments', 'Citas'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar-outline" size={size} color={color} />
          ),
        }}
      />
      
      {/* Tab 4: Services */}
      <Tabs.Screen
        name="services"
        options={{
          title: t('tabs.services', 'Servicios'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="briefcase-outline" size={size} color={color} />
          ),
        }}
      />
      
      {/* Tab 5: Menu */}
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tabs.menu', 'Menú'),
          tabBarIcon: ({ color, size}) => (
            <Ionicons name="menu" size={size} color={color} />
          ),
        }}
      />
      
      {/* Games - Hidden from tab bar, accessible via Menu */}
      <Tabs.Screen
        name="games"
        options={{
          href: null,
          freezeOnBlur: false,
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
      <Tabs.Screen name="dependents" options={{ href: null }} />
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
      <Tabs.Screen name="my-receipts" options={{ href: null }} />
      <Tabs.Screen name="tax-declarations" options={{ href: null }} />
      <Tabs.Screen name="service-checkout" options={{ href: null }} />
      <Tabs.Screen name="order-payment" options={{ href: null }} />
      <Tabs.Screen name="mis-facturas" options={{ href: null }} />
      <Tabs.Screen name="motion-detail" options={{ href: null }} />
      <Tabs.Screen name="motion-request" options={{ href: null }} />
      <Tabs.Screen name="my-motions" options={{ href: null }} />
      <Tabs.Screen name="credits_backup" options={{ href: null }} />
      <Tabs.Screen name="dynamic-service-form" options={{ href: null }} />
      <Tabs.Screen name="service-templates" options={{ href: null }} />
      <Tabs.Screen name="tax-dashboard" options={{ href: null }} />
      <Tabs.Screen name="form-4506c" options={{ href: null }} />
      <Tabs.Screen name="my-business" options={{ href: null }} />
      <Tabs.Screen name="business-receipt-upload" options={{ href: null }} />
      <Tabs.Screen name="business-transactions" options={{ href: null }} />
      <Tabs.Screen name="business-pnl" options={{ href: null }} />
      <Tabs.Screen name="business-invoices" options={{ href: null }} />
      <Tabs.Screen name="business-mileage" options={{ href: null }} />
      <Tabs.Screen name="business-receipts" options={{ href: null }} />
      <Tabs.Screen name="security-settings" options={{ href: null }} />
    </Tabs>
  );
}

// No styles needed for this layout
