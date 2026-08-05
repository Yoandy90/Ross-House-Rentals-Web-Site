/**
 * PremiumCard - Glassmorphism card component with depth and animations
 * Part of Ross Tax Premium Design System
 */
import React from 'react';
import {
  View,
  StyleSheet,
  ViewStyle,
  Animated,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

interface PremiumCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  variant?: 'default' | 'glass' | 'gradient' | 'elevated' | 'dark';
  gradientColors?: readonly [string, string, ...string[]];
  onPress?: () => void;
  animated?: boolean;
  intensity?: number;
  noPadding?: boolean;
}

export default function PremiumCard({
  children,
  style,
  variant = 'default',
  gradientColors,
  onPress,
  animated = false,
  intensity = 80,
  noPadding = false,
}: PremiumCardProps) {
  const scaleAnim = React.useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    if (animated && onPress) {
      Animated.spring(scaleAnim, {
        toValue: 0.98,
        useNativeDriver: true,
        friction: 8,
      }).start();
    }
  };

  const handlePressOut = () => {
    if (animated && onPress) {
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        friction: 8,
      }).start();
    }
  };

  const renderCard = () => {
    switch (variant) {
      case 'glass':
        return (
          <View style={[styles.glassContainer, style]}>
            {Platform.OS === 'ios' ? (
              <BlurView intensity={intensity} tint="light" style={styles.blur}>
                <View style={[styles.glassContent, noPadding && styles.noPadding]}>
                  {children}
                </View>
              </BlurView>
            ) : (
              <View style={[styles.glassAndroid, noPadding && styles.noPadding]}>
                {children}
              </View>
            )}
          </View>
        );

      case 'gradient':
        return (
          <LinearGradient
            colors={gradientColors || ['#10B981', '#059669']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.gradientCard, style, noPadding && styles.noPadding]}
          >
            {children}
          </LinearGradient>
        );

      case 'elevated':
        return (
          <View style={[styles.elevatedCard, style, noPadding && styles.noPadding]}>
            {children}
          </View>
        );

      case 'dark':
        return (
          <LinearGradient
            colors={['#1F2937', '#111827']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.darkCard, style, noPadding && styles.noPadding]}
          >
            {children}
          </LinearGradient>
        );

      default:
        return (
          <View style={[styles.defaultCard, style, noPadding && styles.noPadding]}>
            {children}
          </View>
        );
    }
  };

  if (onPress) {
    return (
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={onPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
        >
          {renderCard()}
        </TouchableOpacity>
      </Animated.View>
    );
  }

  return renderCard();
}

const styles = StyleSheet.create({
  defaultCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 5,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
  },
  glassContainer: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  blur: {
    overflow: 'hidden',
  },
  glassContent: {
    padding: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  glassAndroid: {
    padding: 20,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 20,
  },
  gradientCard: {
    borderRadius: 20,
    padding: 20,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  elevatedCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 10,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
  },
  darkCard: {
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
  },
  noPadding: {
    padding: 0,
  },
});
