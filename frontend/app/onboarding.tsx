import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  Platform,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useColors, Spacing, FontSizes, BorderRadius } from '../src/constants/theme';

interface SlideConfig {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  accentColor: string;
  glowColor: string;
  decorIcon1: keyof typeof Ionicons.glyphMap;
  decorIcon2: keyof typeof Ionicons.glyphMap;
}

const SLIDES: SlideConfig[] = [
  {
    key: 'slide1',
    icon: 'home',
    accentColor: '#C8102E',
    glowColor: 'rgba(200,16,46,0.15)',
    decorIcon1: 'key-outline',
    decorIcon2: 'shield-checkmark-outline',
  },
  {
    key: 'slide2',
    icon: 'business',
    accentColor: '#3B82F6',
    glowColor: 'rgba(59,130,246,0.15)',
    decorIcon1: 'map-outline',
    decorIcon2: 'search-outline',
  },
  {
    key: 'slide3',
    icon: 'card',
    accentColor: '#10B981',
    glowColor: 'rgba(16,185,129,0.15)',
    decorIcon1: 'cash-outline',
    decorIcon2: 'checkmark-circle-outline',
  },
  {
    key: 'slide4',
    icon: 'construct',
    accentColor: '#F59E0B',
    glowColor: 'rgba(245,158,11,0.15)',
    decorIcon1: 'camera-outline',
    decorIcon2: 'chatbubbles-outline',
  },
];

export default function OnboardingScreen() {
  const Colors = useColors();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [currentIndex, setCurrentIndex] = useState(0);

  const slide = SLIDES[currentIndex];
  const isLast = currentIndex === SLIDES.length - 1;

  const handleNext = useCallback(() => {
    if (currentIndex < SLIDES.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  }, [currentIndex]);

  const completeOnboarding = useCallback(async () => {
    try {
      await AsyncStorage.setItem('onboarding_completed', 'true');
    } catch {}
    router.replace('/(auth)/login');
  }, []);

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 8 }]}>
      {/* Background glows */}
      <View style={[styles.bgGlow1, { backgroundColor: slide.accentColor }]} />
      <View style={[styles.bgGlow2, { backgroundColor: slide.accentColor }]} />

      {/* Subtle grid lines (decorative) */}
      <View style={styles.gridLine1} />
      <View style={styles.gridLine2} />

      {/* Skip button */}
      {!isLast && (
        <TouchableOpacity
          onPress={completeOnboarding}
          style={styles.skipBtn}
          activeOpacity={0.7}
        >
          <Text style={styles.skipText}>{t('onboarding.skip')}</Text>
        </TouchableOpacity>
      )}

      {/* Main content */}
      <View style={styles.content}>
        {/* Decorative floating icons */}
        <View style={[styles.floatIcon, styles.floatIcon1]}>
          <View style={[styles.floatIconBg, { backgroundColor: slide.glowColor }]}>
            <Ionicons name={slide.decorIcon1} size={28} color={slide.accentColor} />
          </View>
        </View>
        <View style={[styles.floatIcon, styles.floatIcon2]}>
          <View style={[styles.floatIconBg, { backgroundColor: slide.glowColor }]}>
            <Ionicons name={slide.decorIcon2} size={24} color={slide.accentColor} />
          </View>
        </View>

        {/* Central icon with glass card */}
        <View style={styles.iconSection}>
          {currentIndex === 0 ? (
            // First slide: Show official Ross House Rentals logo (premium ambient)
            <View style={styles.officialLogoWrap}>
              <View style={styles.officialLogoHaloOuter} />
              <View style={styles.officialLogoHaloInner} />
              <View style={styles.officialLogoGlow} />
              <Image
                source={Colors.background === '#F8FAFC' ? require('../assets/images/ross_house_logo.png') : require('../assets/images/ross_house_logo_white.png')}
                style={styles.officialLogoImg}
                resizeMode="contain"
              />
            </View>
          ) : (
          /* Outer ring */
          <View style={[styles.outerRing, { borderColor: `${slide.accentColor}15` }]}>
            <View style={[styles.innerRing, { borderColor: `${slide.accentColor}25` }]}>
              {/* Glass icon container */}
              <View style={[styles.iconContainer]}>
                <LinearGradient
                  colors={[`${slide.accentColor}30`, `${slide.accentColor}10`]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                <View style={[styles.iconGlow, { backgroundColor: slide.accentColor }]} />
                <Ionicons name={slide.icon} size={44} color={Colors.white} />
              </View>
            </View>
          </View>
          )}
        </View>

        {/* Text section */}
        <View style={styles.textSection}>
          <View style={[styles.labelBadge, { backgroundColor: slide.glowColor }]}>
            <View style={[styles.labelDot, { backgroundColor: slide.accentColor }]} />
            <Text style={[styles.labelText, { color: slide.accentColor }]}>
              {currentIndex + 1}/{SLIDES.length}
            </Text>
          </View>
          <Text style={styles.title}>{t(`onboarding.${slide.key}_title`)}</Text>
          <Text style={styles.desc}>{t(`onboarding.${slide.key}_desc`)}</Text>
        </View>
      </View>

      {/* Bottom controls */}
      <View style={styles.bottomBar}>
        {/* Progress bar (glass style) */}
        <View style={styles.progressContainer}>
          {SLIDES.map((s, i) => (
            <View
              key={s.key}
              style={[
                styles.progressSegment,
                i <= currentIndex && { backgroundColor: slide.accentColor },
              ]}
            />
          ))}
        </View>

        {/* CTA */}
        {isLast ? (
          <TouchableOpacity
            style={styles.getStartedBtn}
            activeOpacity={0.85}
            onPress={completeOnboarding}
          >
            <LinearGradient
              colors={['#C8102E', '#9B1B30']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[StyleSheet.absoluteFill, { borderRadius: BorderRadius.full }]}
            />
            <Text style={styles.getStartedText}>{t('onboarding.get_started')}</Text>
            <Ionicons name="arrow-forward" size={18} color={Colors.white} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.nextBtn]}
            activeOpacity={0.85}
            onPress={handleNext}
          >
            <LinearGradient
              colors={[slide.accentColor, `${slide.accentColor}CC`]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[StyleSheet.absoluteFill, { borderRadius: 28 }]}
            />
            <Ionicons name="arrow-forward" size={22} color={Colors.white} />
          </TouchableOpacity>
        )}
      </View>

      {/* Watermark */}
      <Text style={styles.watermark}>Ross House Rentals LLC</Text>
    </View>
  );
}

const createStyles = (Colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  bgGlow1: {
    position: 'absolute',
    top: -80,
    right: -40,
    width: 240,
    height: 240,
    borderRadius: 120,
    opacity: 0.06,
  },
  bgGlow2: {
    position: 'absolute',
    bottom: '20%',
    left: -60,
    width: 180,
    height: 180,
    borderRadius: 90,
    opacity: 0.04,
  },
  gridLine1: {
    position: 'absolute',
    top: '30%',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: Colors.glass,
  },
  gridLine2: {
    position: 'absolute',
    top: '55%',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: Colors.glass,
  },
  skipBtn: {
    alignSelf: 'flex-end',
    marginRight: Spacing.base,
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.glass,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    zIndex: 5,
  },
  skipText: {
    color: Colors.textSecondary,
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing['2xl'],
  },
  floatIcon: {
    position: 'absolute',
    zIndex: 0,
  },
  floatIcon1: {
    top: '10%',
    left: '8%',
    transform: [{ rotate: '-12deg' }],
  },
  floatIcon2: {
    top: '16%',
    right: '10%',
    transform: [{ rotate: '10deg' }],
  },
  floatIconBg: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  iconSection: {
    marginBottom: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Official PNG logo wrapper (first slide) with premium ambient
  officialLogoWrap: {
    width: 220,
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  officialLogoHaloOuter: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 1,
    borderColor: 'rgba(200,16,46,0.10)',
  },
  officialLogoHaloInner: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 1,
    borderColor: 'rgba(200,16,46,0.18)',
  },
  officialLogoGlow: {
    position: 'absolute',
    width: 145,
    height: 145,
    borderRadius: 72.5,
    backgroundColor: Colors.brandRed,
    opacity: 0.10,
  },
  officialLogoImg: {
    width: 240,
    height: 200,
  },
  outerRing: {
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  innerRing: {
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.glassBorderLight,
  },
  iconGlow: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    opacity: 0.3,
    top: -10,
    right: -10,
  },
  textSection: {
    alignItems: 'center',
  },
  labelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: BorderRadius.full,
    gap: 6,
    marginBottom: 16,
  },
  labelDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  labelText: {
    fontSize: FontSizes.xs,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: Colors.textPrimary,
    textAlign: 'center',
    lineHeight: 38,
    letterSpacing: -0.5,
  },
  desc: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginTop: 14,
    maxWidth: 300,
  },
  bottomBar: {
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: Spacing.lg,
    gap: 20,
  },
  progressContainer: {
    flexDirection: 'row',
    gap: 6,
  },
  progressSegment: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: Colors.glassBorderLight,
  },
  nextBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'flex-end',
    overflow: 'hidden',
  },
  getStartedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
  },
  getStartedText: {
    color: Colors.textPrimary,
    fontSize: FontSizes.md,
    fontWeight: '700',
  },
  watermark: {
    textAlign: 'center',
    color: Colors.textDim,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
    paddingBottom: 4,
  },
});
