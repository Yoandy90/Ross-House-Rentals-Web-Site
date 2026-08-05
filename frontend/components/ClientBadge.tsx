import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../constants/colors';

type ClientStatus = 'new' | 'in_progress' | 'awaiting_docs' | 'pending_signature' | 'completed' | 'payment_due';

interface ClientBadgeProps {
  status: ClientStatus;
  size?: 'small' | 'medium' | 'large';
}

export default function ClientBadge({ status, size = 'medium' }: ClientBadgeProps) {
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  
  // Status configuration with theme colors
  const STATUS_CONFIG = {
    new: {
      label: 'Nuevo',
      icon: 'add-circle-outline',
      color: colors.info,
      bgColor: colors.info + '15',
      borderColor: colors.info + '40',
    },
    in_progress: {
      label: 'En Proceso',
      icon: 'play-circle',
      color: colors.info,
      bgColor: colors.accent + '20',
      borderColor: colors.accent + '50',
    },
    awaiting_docs: {
      label: 'Esperando Docs',
      icon: 'document-attach',
      color: colors.warning,
      bgColor: colors.warning + '15',
      borderColor: colors.warning + '40',
    },
    pending_signature: {
      label: 'Firma Pendiente',
      icon: 'create-outline',
      color: '#8B5CF6',
      bgColor: '#8B5CF615',
      borderColor: '#8B5CF640',
    },
    completed: {
      label: 'Completado',
      icon: 'checkmark-circle',
      color: colors.success,
      bgColor: colors.success + '15',
      borderColor: colors.success + '40',
    },
    payment_due: {
      label: 'Pago Pendiente',
      icon: 'card-outline',
      color: colors.error,
      bgColor: colors.error + '15',
      borderColor: colors.error + '40',
    },
  };
  
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.new;
  
  const sizeStyles = {
    small: { paddingHorizontal: 8, paddingVertical: 4, fontSize: 11, iconSize: 14 },
    medium: { paddingHorizontal: 10, paddingVertical: 6, fontSize: 12, iconSize: 16 },
    large: { paddingHorizontal: 12, paddingVertical: 8, fontSize: 13, iconSize: 18 },
  };

  const currentSize = sizeStyles[size];

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: config.bgColor,
          borderColor: config.borderColor,
          paddingHorizontal: currentSize.paddingHorizontal,
          paddingVertical: currentSize.paddingVertical,
        },
      ]}
    >
      <Ionicons
        name={config.icon as any}
        size={currentSize.iconSize}
        color={config.color}
        style={styles.icon}
      />
      <Text
        style={[
          styles.label,
          {
            color: config.color,
            fontSize: currentSize.fontSize,
          },
        ]}
      >
        {config.label}
      </Text>
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1.5,
    alignSelf: 'flex-start',
  },
  icon: {
    marginRight: 4,
  },
  label: {
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
});