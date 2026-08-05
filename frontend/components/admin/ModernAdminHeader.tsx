import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

interface ModernAdminHeaderProps {
  title: string;
  subtitle?: string;
  showBackButton?: boolean;
  rightAction?: {
    icon: string;
    onPress: () => void;
    label?: string;
  };
  gradient?: string[];
}

/**
 * ModernAdminHeader - Header futurista y elegante para el admin panel
 * Características:
 * - Gradient animado con glass morphism
 * - Padding dinámico para StatusBar
 * - Soporte para botón back y acciones
 * - Diseño moderno y minimalista
 */
export default function ModernAdminHeader({
  title,
  subtitle,
  showBackButton = false,
  rightAction,
  gradient = ['#1a1a2e', '#2d2d5f'],
}: ModernAdminHeaderProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <LinearGradient
      colors={gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.gradient, { paddingTop: insets.top + 12 }]}
    >
      {/* Glass morphism overlay */}
      <View style={styles.glassOverlay} />
      
      <View style={styles.container}>
        {/* Left section - Back button or placeholder */}
        <View style={styles.leftSection}>
          {showBackButton ? (
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
          ) : (
            <View style={styles.placeholder} />
          )}
        </View>

        {/* Center section - Title and subtitle */}
        <View style={styles.centerSection}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {subtitle && (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          )}
        </View>

        {/* Right section - Action button */}
        <View style={styles.rightSection}>
          {rightAction ? (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={rightAction.onPress}
              activeOpacity={0.7}
            >
              <View style={styles.actionIconContainer}>
                <Ionicons name={rightAction.icon as any} size={22} color="#fff" />
              </View>
              {rightAction.label && (
                <Text style={styles.actionLabel}>{rightAction.label}</Text>
              )}
            </TouchableOpacity>
          ) : (
            <View style={styles.placeholder} />
          )}
        </View>
      </View>

      {/* Bottom glow effect */}
      <View style={styles.bottomGlow} />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    paddingBottom: 20,
    position: 'relative',
    overflow: 'hidden',
  },
  glassOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    backdropFilter: 'blur(10px)',
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    minHeight: 56,
    zIndex: 1,
  },
  leftSection: {
    width: 48,
    alignItems: 'flex-start',
  },
  centerSection: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  rightSection: {
    width: 48,
    alignItems: 'flex-end',
  },
  placeholder: {
    width: 48,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  title: {
    fontSize: Platform.OS === 'web' ? 24 : 20,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.5,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  subtitle: {
    fontSize: Platform.OS === 'web' ? 14 : 12,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  actionLabel: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
  },
  bottomGlow: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(139, 92, 246, 0.5)',
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
  },
});
