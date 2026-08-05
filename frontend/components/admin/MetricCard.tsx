import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: keyof typeof Ionicons.glyphMap;
  subtitle?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  colors?: [string, string];
}

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  icon,
  subtitle,
  trend,
  colors = ['#4E79A7', '#6B9BD1'],
}) => {
  return (
    <LinearGradient colors={colors} style={styles.card}>
      <View style={styles.iconContainer}>
        <Ionicons name={icon} size={Platform.OS === 'web' ? 28 : 16} color="#fff" />
      </View>
      
      <View style={styles.content}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.value}>{value}</Text>
        
        {subtitle && (
          <Text style={styles.subtitle}>{subtitle}</Text>
        )}
        
        {trend && (
          <View style={styles.trendContainer}>
            <Ionicons
              name={trend.isPositive ? 'trending-up' : 'trending-down'}
              size={16}
              color={trend.isPositive ? '#4ade80' : '#f87171'}
            />
            <Text
              style={[
                styles.trendText,
                { color: trend.isPositive ? '#4ade80' : '#f87171' },
              ]}
            >
              {trend.value > 0 ? '+' : ''}{trend.value}%
            </Text>
          </View>
        )}
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: Platform.OS === 'web' ? 16 : 10,
    padding: Platform.OS === 'web' ? 16 : 8,
    marginBottom: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: Platform.OS === 'web' ? 4 : 2 },
    shadowOpacity: Platform.OS === 'web' ? 0.15 : 0.1,
    shadowRadius: Platform.OS === 'web' ? 8 : 4,
    elevation: Platform.OS === 'web' ? 5 : 3,
    minHeight: Platform.OS === 'web' ? 130 : 115,
    height: Platform.OS === 'web' ? 130 : 115, // Altura fija para simetría
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  iconContainer: {
    width: Platform.OS === 'web' ? 48 : 32,
    height: Platform.OS === 'web' ? 48 : 32,
    borderRadius: Platform.OS === 'web' ? 24 : 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Platform.OS === 'web' ? 8 : 4,
    alignSelf: 'center',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Platform.OS === 'web' ? 4 : 0,
  },
  title: {
    fontSize: Platform.OS === 'web' ? 13 : 9,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '500',
    marginBottom: Platform.OS === 'web' ? 6 : 3,
    textAlign: 'center',
    lineHeight: Platform.OS === 'web' ? 16 : 11,
    flexWrap: 'wrap',
  },
  value: {
    fontSize: Platform.OS === 'web' ? 24 : 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 2,
    textAlign: 'center',
    flexShrink: 1,
    flexWrap: 'wrap',
    maxWidth: '100%',
  },
  subtitle: {
    fontSize: Platform.OS === 'web' ? 11 : 8,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
    textAlign: 'center',
    lineHeight: Platform.OS === 'web' ? 14 : 10,
    flexWrap: 'wrap',
  },
  trendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Platform.OS === 'web' ? 8 : 3,
    gap: 4,
  },
  trendText: {
    fontSize: Platform.OS === 'web' ? 14 : 10,
    fontWeight: '600',
  },
});

export default MetricCard;
