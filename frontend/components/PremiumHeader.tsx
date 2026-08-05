/**
 * PremiumHeader - Animated header with glassmorphism effect
 * Part of Ross Tax Premium Design System
 */
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Platform,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

interface PremiumHeaderProps {
  title: string;
  subtitle?: string;
  scrollY?: Animated.Value;
  showBack?: boolean;
  onBack?: () => void;
  rightAction?: React.ReactNode;
  variant?: 'gradient' | 'glass' | 'dark' | 'transparent';
  gradientColors?: readonly [string, string, ...string[]];
  icon?: keyof typeof Ionicons.glyphMap;
}

export default function PremiumHeader({
  title,
  subtitle,
  scrollY,
  showBack = false,
  onBack,
  rightAction,
  variant = 'gradient',
  gradientColors = ['#10B981', '#059669'],
  icon,
}: PremiumHeaderProps) {
  const insets = useSafeAreaInsets();

  // Animated values for scroll effects
  const headerOpacity = scrollY?.interpolate({
    inputRange: [0, 60],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  }) || new Animated.Value(1);

  const titleScale = scrollY?.interpolate({
    inputRange: [0, 60],
    outputRange: [1, 0.9],
    extrapolate: 'clamp',
  }) || new Animated.Value(1);

  const renderContent = () => (
    <View style={[styles.content, { paddingTop: insets.top + 10 }]}>
      <View style={styles.topRow}>
        {showBack && (
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <View style={styles.backButtonInner}>
              <Ionicons name="chevron-back" size={22} color="#FFF" />
            </View>
          </TouchableOpacity>
        )}
        
        <Animated.View style={[styles.titleContainer, { transform: [{ scale: titleScale }] }]}>
          {icon && (
            <View style={styles.iconContainer}>
              <Ionicons name={icon} size={24} color="#FFF" />
            </View>
          )}
          <View>
            <Text style={styles.title}>{title}</Text>
            {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
          </View>
        </Animated.View>

        {rightAction && <View style={styles.rightAction}>{rightAction}</View>}
      </View>
    </View>
  );

  const renderCompactHeader = () => (
    <Animated.View
      style={[
        styles.compactHeader,
        {
          paddingTop: insets.top,
          opacity: headerOpacity,
        },
      ]}
    >
      {Platform.OS === 'ios' ? (
        <BlurView intensity={95} tint="light" style={styles.blurHeader}>
          <View style={styles.compactContent}>
            {showBack && (
              <TouchableOpacity onPress={onBack} style={styles.compactBack}>
                <Ionicons name="chevron-back" size={24} color="#059669" />
              </TouchableOpacity>
            )}
            <Text style={styles.compactTitle}>{title}</Text>
            {rightAction && <View style={styles.compactRight}>{rightAction}</View>}
          </View>
        </BlurView>
      ) : (
        <View style={[styles.compactAndroid, { paddingTop: insets.top }]}>
          <View style={styles.compactContent}>
            {showBack && (
              <TouchableOpacity onPress={onBack} style={styles.compactBack}>
                <Ionicons name="chevron-back" size={24} color="#059669" />
              </TouchableOpacity>
            )}
            <Text style={styles.compactTitle}>{title}</Text>
            {rightAction && <View style={styles.compactRight}>{rightAction}</View>}
          </View>
        </View>
      )}
    </Animated.View>
  );

  switch (variant) {
    case 'glass':
      return (
        <>
          <StatusBar barStyle="light-content" />
          <View style={styles.glassContainer}>
            {Platform.OS === 'ios' ? (
              <BlurView intensity={80} tint="dark" style={styles.blur}>
                {renderContent()}
              </BlurView>
            ) : (
              <View style={styles.glassAndroid}>{renderContent()}</View>
            )}
          </View>
          {scrollY && renderCompactHeader()}
        </>
      );

    case 'dark':
      return (
        <>
          <StatusBar barStyle="light-content" />
          <LinearGradient
            colors={['#1F2937', '#111827']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradientContainer}
          >
            {renderContent()}
          </LinearGradient>
          {scrollY && renderCompactHeader()}
        </>
      );

    case 'transparent':
      return (
        <>
          <StatusBar barStyle="light-content" />
          <View style={[styles.transparentContainer, { paddingTop: insets.top }]}>
            {renderContent()}
          </View>
        </>
      );

    default:
      return (
        <>
          <StatusBar barStyle="light-content" />
          <LinearGradient
            colors={gradientColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradientContainer}
          >
            {renderContent()}
            {/* Decorative elements */}
            <View style={styles.decorCircle1} />
            <View style={styles.decorCircle2} />
          </LinearGradient>
          {scrollY && renderCompactHeader()}
        </>
      );
  }
}

const styles = StyleSheet.create({
  gradientContainer: {
    paddingBottom: 24,
    overflow: 'hidden',
    position: 'relative',
  },
  glassContainer: {
    overflow: 'hidden',
  },
  blur: {
    paddingBottom: 24,
  },
  glassAndroid: {
    backgroundColor: 'rgba(31, 41, 55, 0.95)',
    paddingBottom: 24,
  },
  transparentContainer: {
    backgroundColor: 'transparent',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginRight: 12,
  },
  backButtonInner: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '500',
    marginTop: 2,
  },
  rightAction: {
    marginLeft: 12,
  },
  // Decorative circles
  decorCircle1: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(255,255,255,0.08)',
    top: -50,
    right: -30,
  },
  decorCircle2: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.05)',
    bottom: -30,
    left: -20,
  },
  // Compact header (shown on scroll)
  compactHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
  },
  blurHeader: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  compactAndroid: {
    backgroundColor: 'rgba(255,255,255,0.98)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  compactContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  compactBack: {
    position: 'absolute',
    left: 16,
  },
  compactTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1F2937',
    letterSpacing: -0.3,
  },
  compactRight: {
    position: 'absolute',
    right: 16,
  },
});
