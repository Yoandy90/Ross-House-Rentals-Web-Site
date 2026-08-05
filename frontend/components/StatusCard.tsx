import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../constants/colors';

const { width } = Dimensions.get('window');

interface StatusCardProps {
  title: string;
  status: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}

export const StatusCard: React.FC<StatusCardProps> = ({ title, status, icon, onPress }) => {
  const colors = useThemeColors();
  
  const getStatusColor = () => {
    switch (status) {
      case 'pending': return colors.statusPending;
      case 'in_progress': return colors.statusInProgress;
      case 'completed': return colors.statusCompleted;
      case 'filed': return colors.statusFiled;
      default: return colors.textGray;
    }
  };

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.iconContainer, { backgroundColor: getStatusColor() + '20' }]}>
        <Ionicons name={icon} size={28} color={getStatusColor()} />
      </View>
      <View style={styles.cardContent}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={[styles.statusText, { color: getStatusColor() }]}>
          {status.replace('_', ' ').toUpperCase()}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.textGray} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
  },
});