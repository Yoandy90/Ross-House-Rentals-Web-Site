import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

interface StatCardProps {
  icon: string;
  iconColor: string;
  iconBgColor: string;
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: {
    value: string;
    isPositive: boolean;
  };
  onPress?: () => void;
}

export default function StatCard({
  icon,
  iconColor,
  iconBgColor,
  title,
  value,
  subtitle,
  trend,
  onPress,
}: StatCardProps) {
  const CardContent = (
    <View style={styles.card}>
      <View style={styles.content}>
        <View style={[styles.iconContainer, { backgroundColor: iconBgColor }]}>
          <Ionicons name={icon as any} size={32} color={iconColor} />
        </View>
        
        <View style={styles.textContainer}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.value}>{value}</Text>
          {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>

        {trend && (
          <View style={[styles.trendBadge, trend.isPositive ? styles.trendPositive : styles.trendNegative]}>
            <Ionicons
              name={trend.isPositive ? 'trending-up' : 'trending-down'}
              size={14}
              color={trend.isPositive ? '#10B981' : '#EF4444'}
            />
            <Text style={[styles.trendText, { color: trend.isPositive ? '#10B981' : '#EF4444' }]}>
              {trend.value}
            </Text>
          </View>
        )}
      </View>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity activeOpacity={0.7} onPress={onPress}>
        {CardContent}
      </TouchableOpacity>
    );
  }

  return CardContent;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    ...Platform.select({
      web: {
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 3,
      },
    }),
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 13,
    color: '#666666',
    fontWeight: '600',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  value: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1F2937',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 4,
    fontWeight: '500',
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  trendPositive: {
    backgroundColor: '#D1FAE5',
  },
  trendNegative: {
    backgroundColor: '#FEE2E2',
  },
  trendText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
