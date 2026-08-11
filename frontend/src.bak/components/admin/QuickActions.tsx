/**
 * QuickActions — Grid of quick-access buttons for admin
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '../../constants/theme';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

type IoniconsName = keyof typeof Ionicons.glyphMap;

interface QuickAction {
  icon: IoniconsName;
  label: string;
  route?: string;
  color: string;
}

const ACTIONS: QuickAction[] = [
  { icon: 'add-circle', label: 'Nuevo\nPréstamo', color: Colors.primaryLight, route: '/(tabs)/apply' },
  { icon: 'people', label: 'Clientes', color: Colors.info, route: '/(admin)/loans' },
  { icon: 'document-text', label: 'Solicitudes', color: Colors.warning, route: '/(admin)/applications' },
  { icon: 'bar-chart', label: 'Reportes', color: Colors.secondaryLight, route: '/(admin)/reports' },
  { icon: 'card', label: 'Cobros', color: Colors.accent, route: '/(admin)/loans' },
  { icon: 'settings', label: 'Config', color: Colors.textMuted, route: '/(tabs)/profile' },
];

export default function QuickActions() {
  const router = useRouter();

  return (
    <View style={styles.grid}>
      {ACTIONS.map((action, i) => (
        <TouchableOpacity
          key={i}
          style={styles.actionBtn}
          activeOpacity={0.7}
          onPress={() => {
            // Route will be connected as admin screens are built
            if (action.route) router.push(action.route as any);
          }}
        >
          <View style={[styles.iconCircle, { backgroundColor: action.color + '15' }]}>
            <Ionicons name={action.icon} size={22} color={action.color} />
          </View>
          <Text style={styles.actionLabel}>{action.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionBtn: {
    width: '30%',
    alignItems: 'center',
    paddingVertical: 14,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  actionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 14,
  },
});
