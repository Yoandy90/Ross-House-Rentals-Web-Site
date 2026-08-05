import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  FlatList,
  Animated,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

const { width, height } = Dimensions.get('window');

interface OnboardingSlide {
  id: string;
  icon: string;
  iconName: keyof typeof Ionicons.glyphMap;
  titleKey: string;
  subtitleKey: string;
  featureKeys: string[];
  gradient: [string, string];
  accentColor: string;
}

const slideConfigs: OnboardingSlide[] = [
  {
    id: '1',
    icon: '🎉',
    iconName: 'sparkles',
    titleKey: 'onboarding.slide1Title',
    subtitleKey: 'onboarding.slide1Subtitle',
    featureKeys: [
      'onboarding.slide1Feature1',
      'onboarding.slide1Feature2',
      'onboarding.slide1Feature3',
    ],
    gradient: ['#1E3A5F', '#2C5282'],
    accentColor: '#60A5FA',
  },
  {
    id: '2',
    icon: '📅',
    iconName: 'calendar',
    titleKey: 'onboarding.slide2Title',
    subtitleKey: 'onboarding.slide2Subtitle',
    featureKeys: [
      'onboarding.slide2Feature1',
      'onboarding.slide2Feature2',
      'onboarding.slide2Feature3',
    ],
    gradient: ['#059669', '#10B981'],
    accentColor: '#34D399',
  },
  {
    id: '3',
    icon: '📄',
    iconName: 'document-text',
    titleKey: 'onboarding.slide3Title',
    subtitleKey: 'onboarding.slide3Subtitle',
    featureKeys: [
      'onboarding.slide3Feature1',
      'onboarding.slide3Feature2',
      'onboarding.slide3Feature3',
    ],
    gradient: ['#7C3AED', '#8B5CF6'],
    accentColor: '#A78BFA',
  },
  {
    id: '4',
    icon: '💬',
    iconName: 'chatbubbles',
    titleKey: 'onboarding.slide4Title',
    subtitleKey: 'onboarding.slide4Subtitle',
    featureKeys: [
      'onboarding.slide4Feature1',
      'onboarding.slide4Feature2',
      'onboarding.slide4Feature3',
    ],
    gradient: ['#DC2626', '#EF4444'],
    accentColor: '#FCA5A5',
  },
  {
    id: '5',
    icon: '💳',
    iconName: 'card',
    titleKey: 'onboarding.slide5Title',
    subtitleKey: 'onboarding.slide5Subtitle',
    featureKeys: [
      'onboarding.slide5Feature1',
      'onboarding.slide5Feature2',
      'onboarding.slide5Feature3',
    ],
    gradient: ['#D97706', '#F59E0B'],
    accentColor: '#FCD34D',
  },
];

interface OnboardingScreenProps {
  onComplete: () => void;
}

export default function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  const { t } = useTranslation();
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();

  const goToNext = () => {
    if (currentIndex < slideConfigs.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true });
      setCurrentIndex(currentIndex + 1);
    } else {
      onComplete();
    }
  };

  const goToSlide = (index: number) => {
    flatListRef.current?.scrollToIndex({ index, animated: true });
    setCurrentIndex(index);
  };

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0].index || 0);
    }
  }).current;

  const renderSlide = ({ item, index }: { item: OnboardingSlide; index: number }) => (
    <View style={[styles.slide, { width }]}>
      <LinearGradient colors={item.gradient} style={styles.slideGradient}>
        {/* Top spacer for safe area */}
        <View style={{ height: insets.top + 10 }} />

        {/* Skip button */}
        {index < slideConfigs.length - 1 && (
          <TouchableOpacity style={styles.skipBtn} onPress={onComplete}>
            <Text style={styles.skipText}>{t('onboarding.skip')}</Text>
          </TouchableOpacity>
        )}

        {/* Icon Circle */}
        <View style={styles.iconContainer}>
          <View style={[styles.iconCircle, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
            <View style={[styles.iconInner, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
              <Ionicons name={item.iconName} size={60} color="#FFF" />
            </View>
          </View>
          <Text style={styles.emoji}>{item.icon}</Text>
        </View>

        {/* Title & Subtitle */}
        <View style={styles.textContainer}>
          <Text style={styles.title}>{t(item.titleKey)}</Text>
          <Text style={styles.subtitle}>{t(item.subtitleKey)}</Text>
        </View>

        {/* Features Card */}
        <View style={styles.featuresCard}>
          {item.featureKeys.map((featureKey, i) => (
            <View key={i} style={styles.featureRow}>
              <View style={[styles.featureCheck, { backgroundColor: item.gradient[1] }]}>
                <Ionicons name="checkmark" size={14} color="#FFF" />
              </View>
              <Text style={styles.featureText}>{t(featureKey)}</Text>
            </View>
          ))}
        </View>

        {/* Bottom Controls */}
        <View style={[styles.bottomControls, { paddingBottom: insets.bottom + 20 }]}>
          {/* Dots */}
          <View style={styles.dotsContainer}>
            {slideConfigs.map((_, i) => (
              <TouchableOpacity
                key={i}
                onPress={() => goToSlide(i)}
                style={[
                  styles.dot,
                  {
                    backgroundColor: i === currentIndex ? '#FFF' : 'rgba(255,255,255,0.3)',
                    width: i === currentIndex ? 28 : 8,
                  },
                ]}
              />
            ))}
          </View>

          {/* Next / Start Button */}
          <TouchableOpacity style={styles.nextButton} onPress={goToNext} activeOpacity={0.8}>
            <Text style={[styles.nextButtonText, { color: item.gradient[0] }]}>
              {index === slideConfigs.length - 1 ? t('onboarding.start') : t('onboarding.next')}
            </Text>
            <Ionicons
              name={index === slideConfigs.length - 1 ? 'rocket' : 'arrow-forward'}
              size={20}
              color={item.gradient[0]}
            />
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={slideConfigs}
        renderItem={renderSlide}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ viewAreaCoveragePercentThreshold: 50 }}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
          useNativeDriver: false,
        })}
        scrollEventThrottle={16}
        bounces={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  slide: {
    flex: 1,
  },
  slideGradient: {
    flex: 1,
    paddingHorizontal: 28,
  },
  skipBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 20,
    right: 24,
    zIndex: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  skipText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    fontWeight: '600',
  },
  iconContainer: {
    alignItems: 'center',
    marginTop: height * 0.04,
    marginBottom: 20,
  },
  iconCircle: {
    width: 150,
    height: 150,
    borderRadius: 75,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconInner: {
    width: 110,
    height: 110,
    borderRadius: 55,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    position: 'absolute',
    top: -5,
    right: width * 0.28,
    fontSize: 36,
  },
  textContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFF',
    textAlign: 'center',
    lineHeight: 38,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 22,
    paddingHorizontal: 10,
  },
  featuresCard: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 20,
    padding: 20,
    gap: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  featureCheck: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: {
    color: '#FFF',
    fontSize: 14.5,
    fontWeight: '500',
    flex: 1,
    lineHeight: 20,
  },
  bottomControls: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 20,
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF',
    paddingVertical: 16,
    paddingHorizontal: 36,
    borderRadius: 16,
    gap: 10,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  nextButtonText: {
    fontSize: 18,
    fontWeight: '700',
  },
});
