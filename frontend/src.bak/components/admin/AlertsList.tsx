/**
 * AlertsList — Displays active alerts (pending apps, delinquent loans, recent payments)
 */
import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Colors } from '../../constants/theme';

interface Alert {
  type: string;
  severity: 'error' | 'warning' | 'info' | 'success';
  icon: string;
  title: string;
  subtitle: string;
  date: string;
  id: string;
}

interface AlertsListProps {
  alerts: Alert[];
}

const SEVERITY_COLORS: Record<string, string> = {
  error: Colors.error,
  warning: Colors.warning,
  info: Colors.info,
  success: Colors.success,
};

export default function AlertsList({ alerts }: AlertsListProps) {
  if (alerts.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>✅</Text>
        <Text style={styles.emptyText}>Sin alertas pendientes</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {alerts.slice(0, 8).map((alert, index) => {
        const color = SEVERITY_COLORS[alert.severity] || Colors.textMuted;
        return (
          <View key={alert.id || index} style={[styles.alertItem, { borderLeftColor: color }]}>
            <Text style={styles.alertIcon}>{alert.icon}</Text>
            <View style={styles.alertContent}>
              <Text style={styles.alertTitle} numberOfLines={1}>{alert.title}</Text>
              <Text style={styles.alertSubtitle} numberOfLines={1}>{alert.subtitle}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyIcon: { fontSize: 32, marginBottom: 8 },
  emptyText: { color: Colors.textMuted, fontSize: 14 },
  alertItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    borderLeftWidth: 3,
    gap: 12,
  },
  alertIcon: { fontSize: 20 },
  alertContent: { flex: 1 },
  alertTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
  },
  alertSubtitle: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
});
