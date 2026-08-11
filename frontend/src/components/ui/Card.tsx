import React, { ReactNode } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { useColors, BorderRadius, Shadows, Spacing } from '../../constants/theme';

interface CardProps {
  children: ReactNode;
  accentColor?: string;
  style?: ViewStyle;
  variant?: 'default' | 'accent' | 'outlined';
}

export function Card({ children, accentColor, style, variant = 'default' }: CardProps) {
  const Colors = useColors();
  const styles = React.useMemo(() => create_styles(Colors), [Colors]);
  return (
    <View
      style={[
        styles.base,
        variant === 'outlined' && styles.outlined,
        accentColor ? { borderColor: `${accentColor}20` } : null,
        Shadows.subtle,
        style,
      ]}
    >
      {accentColor && (
        <View style={[styles.accentBar, { backgroundColor: accentColor }]} />
      )}
      {accentColor && (
        <View
          style={[styles.orbTopRight, { backgroundColor: accentColor, opacity: 0.06 }]}
        />
      )}
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const create_styles = (Colors: any) => StyleSheet.create({
  base: {
    backgroundColor: Colors.glass,
    borderRadius: BorderRadius.card,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    overflow: 'hidden',
    position: 'relative',
  },
  outlined: {
    backgroundColor: 'transparent',
    borderColor: Colors.glassBorderLight,
  },
  accentBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    borderTopLeftRadius: BorderRadius.card,
    borderTopRightRadius: BorderRadius.card,
  },
  orbTopRight: {
    position: 'absolute',
    top: -24,
    right: -24,
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  content: {
    padding: Spacing.base,
    position: 'relative',
    zIndex: 1,
  },
});
