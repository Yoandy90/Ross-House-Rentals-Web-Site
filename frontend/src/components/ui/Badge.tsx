import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { useColors, FontSizes, BorderRadius, Spacing } from '../../constants/theme';

interface BadgeProps {
  label: string;
  variant?: 'success' | 'warning' | 'error' | 'info' | 'default' | 'brand';
  size?: 'sm' | 'md';
  style?: ViewStyle;
}

const getVariantColors = (Colors: any) => ({
  success: { bg: Colors.successBg, text: Colors.success, border: 'rgba(16,185,129,0.2)' },
  warning: { bg: Colors.warningBg, text: Colors.warning, border: 'rgba(245,158,11,0.2)' },
  error: { bg: Colors.errorBg, text: Colors.error, border: 'rgba(239,68,68,0.2)' },
  info: { bg: Colors.infoBg, text: Colors.info, border: 'rgba(59,130,246,0.2)' },
  brand: { bg: Colors.brandRedLight, text: Colors.brandRed, border: 'rgba(200,16,46,0.2)' },
  default: { bg: 'rgba(140,140,140,0.10)', text: Colors.warmGray, border: 'rgba(140,140,140,0.15)' },
});

export function Badge({ label, variant = 'default', size = 'sm', style }: BadgeProps) {
  const Colors = useColors();
  const styles = React.useMemo(() => create_styles(Colors), [Colors]);
  const colors = getVariantColors(Colors)[variant];
  return (
    <View
      style={[
        styles.base,
        size === 'md' && styles.md,
        { backgroundColor: colors.bg, borderColor: colors.border },
        style,
      ]}
    >
      <Text style={[styles.text, size === 'md' && styles.textMd, { color: colors.text }]}>
        {label}
      </Text>
    </View>
  );
}

const create_styles = (Colors: any) => StyleSheet.create({
  base: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  md: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 5,
  },
  text: {
    fontSize: FontSizes.xs,
    fontWeight: '700',
  },
  textMd: {
    fontSize: FontSizes.sm,
  },
});
