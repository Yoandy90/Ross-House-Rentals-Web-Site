import React from 'react';
import { Tabs } from 'expo-router';
import { View, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useColors } from '../../src/constants/theme';
import { useAuth } from '../../src/contexts/AuthContext';

function TabIcon({ name, color, focused }: { name: keyof typeof Ionicons.glyphMap; color: string; focused: boolean }) {
  const C = useColors();
  const styles = React.useMemo(() => createStyles(C), [C]);
  return (
    <View style={styles.iconWrap}>
      {focused && <View style={[styles.activeGlow, { backgroundColor: C.brandRed }]} />}
      <Ionicons name={name} size={22} color={color} />
      {focused && <View style={[styles.activeDot, { backgroundColor: C.brandRed }]} />}
    </View>
  );
}

export default function TabsLayout() {
  const { t } = useTranslation();
  const { user, viewAsTenant } = useAuth();
  const C = useColors();
  const role = user?.role || 'guest';
  const isLandlord = role === 'landlord';
  const isAdminView = role === 'admin' && !viewAsTenant;
  const showPayments = !isAdminView && (role === 'tenant' || role === 'admin' || role === 'landlord');

  // Detect light mode by comparing to a light-only sentinel color
  const isLight = C.background === '#F8FAFC';
  const tabBarBg = isLight ? 'rgba(255,255,255,0.94)' : 'rgba(12,12,14,0.92)';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: tabBarBg,
          borderTopColor: C.glassBorder,
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 88 : 70,
          paddingBottom: Platform.OS === 'ios' ? 28 : 10,
          paddingTop: 10,
          elevation: 0,
        },
        tabBarActiveTintColor: C.brandRed,
        tabBarInactiveTintColor: C.textDim,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '700',
          letterSpacing: 0.3,
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: t('tabs.dashboard', 'Panel'),
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name={focused ? 'grid' : 'grid-outline'} color={color} focused={focused} />
          ),
          href: isAdminView ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.home'),
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name={focused ? 'home' : 'home-outline'} color={color} focused={focused} />
          ),
          href: isAdminView ? null : undefined,
        }}
      />
      <Tabs.Screen
        name="properties"
        options={{
          title: t('tabs.properties'),
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name={focused ? 'business' : 'business-outline'} color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="market"
        options={{
          title: t('tabs.market'),
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name={focused ? 'storefront' : 'storefront-outline'} color={color} focused={focused} />
          ),
          href: isAdminView ? null : undefined,
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: t('tabs.messages', 'Mensajes'),
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name={focused ? 'chatbubbles' : 'chatbubbles-outline'} color={color} focused={focused} />
          ),
          href: isAdminView ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="payments"
        options={{
          title: isLandlord ? t('owner_dashboard.income') : t('tabs.payments'),
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name={focused ? (isLandlord ? 'stats-chart' : 'card') : (isLandlord ? 'stats-chart-outline' : 'card-outline')} color={color} focused={focused} />
          ),
          href: showPayments ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="finances"
        options={{
          title: t('tabs.finances', 'Finanzas'),
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name={focused ? 'stats-chart' : 'stats-chart-outline'} color={color} focused={focused} />
          ),
          href: isAdminView ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tabs.profile'),
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name={focused ? 'person' : 'person-outline'} color={color} focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}

const createStyles = (C: any) => StyleSheet.create({
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 44,
    height: 28,
  },
  activeGlow: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
    opacity: 0.12,
  },
  activeDot: {
    position: 'absolute',
    bottom: -6,
    width: 4,
    height: 4,
    borderRadius: 2,
  },
});
