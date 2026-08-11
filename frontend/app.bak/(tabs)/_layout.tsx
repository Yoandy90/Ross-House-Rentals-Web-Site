import React from 'react';
import { Tabs } from 'expo-router';
import { Colors } from '../../src/constants/theme';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

type IoniconsName = keyof typeof Ionicons.glyphMap;

function TabIcon({ name, label, focused }: { name: IoniconsName; label: string; focused: boolean }) {
  return (
    <View style={styles.tabItem}>
      <Ionicons 
        name={focused ? name : `${name}-outline` as IoniconsName} 
        size={24} 
        color={focused ? Colors.primaryLight : Colors.textMuted} 
      />
      <Text style={[styles.tabLabel, focused && styles.tabLabelActive]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

export default function TabsLayout() {
  const { t } = useTranslation();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopWidth: 1,
          borderTopColor: Colors.border,
          height: Platform.OS === 'ios' ? 88 : 70,
          paddingTop: 8,
          paddingBottom: Platform.OS === 'ios' ? 24 : 12,
        },
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen name="index" options={{
        tabBarIcon: ({ focused }) => <TabIcon name="home" label={t('tabs.home')} focused={focused} />,
      }} />
      <Tabs.Screen name="loans" options={{
        tabBarIcon: ({ focused }) => <TabIcon name="wallet" label={t('tabs.loans')} focused={focused} />,
      }} />
      <Tabs.Screen name="apply" options={{
        tabBarIcon: ({ focused }) => <TabIcon name="add-circle" label={t('tabs.apply')} focused={focused} />,
      }} />
      <Tabs.Screen name="profile" options={{
        tabBarIcon: ({ focused }) => <TabIcon name="person" label={t('tabs.profile')} focused={focused} />,
      }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabItem: { alignItems: 'center', justifyContent: 'center', minWidth: 60 },
  tabLabel: { fontSize: 11, color: Colors.textMuted, marginTop: 4, fontWeight: '500' },
  tabLabelActive: { color: Colors.primaryLight, fontWeight: '700' },
});
