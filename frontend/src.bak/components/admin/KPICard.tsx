/**
 * KPICard — Reusable KPI metric card for Admin Dashboard
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../../constants/theme';

interface KPICardProps {
  icon: string;
  title: string;
  value: string;
  subtitle?: string;
  accentColor?: string;
  highlighted?: boolean;
}

export default function KPICard({ icon, title, value, subtitle, accentColor, highlighted }: KPICardProps) {
  const accent = accentColor || Colors.primaryLight;

  return (
    <View style={[
      styles.card,
      highlighted && { borderColor: accent + '40', backgroundColor: accent + '08' },
    ]}>
      <View style={styles.headerRow}>
        <Text style={styles.icon}>{icon}</Text>
        <Text style={[styles.title, highlighted && { color: accent }]} numberOfLines={1}>{title}</Text>
      </View>
      <Text style={[styles.value, { color: highlighted ? accent : Colors.text }]} numberOfLines={1}>{value}</Text>
      {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
      {/* Decorative corner */}
      <View style={[styles.corner, { backgroundColor: accent + '12' }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: '46%',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    position: 'relative',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  icon: { fontSize: 16 },
  title: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
    flex: 1,
  },
  value: {
    fontSize: 22,
    fontWeight: '900',
    color: Colors.text,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 4,
  },
  corner: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 50,
    height: 50,
    borderBottomLeftRadius: 30,
  },
});
