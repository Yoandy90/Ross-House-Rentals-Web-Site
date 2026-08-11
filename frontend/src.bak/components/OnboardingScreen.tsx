import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, Dimensions, TouchableOpacity, Animated, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/theme';

const { width: SW, height: SH } = Dimensions.get('window');

interface OnboardingProps {
  onFinish: () => void;
}

const SLIDES = [
  {
    id: '1',
    icon: 'flash' as const,
    bgIcon: 'phone-portrait-outline' as const,
    title: 'Préstamos Rápidos',
    titleEn: 'Fast Loans',
    subtitle: 'Solicita desde tu teléfono',
    subtitleEn: 'Apply from your phone',
    description: 'Obtén aprobación en minutos. Sin filas, sin papeleos complicados. Todo desde la comodidad de tu celular.',
    descriptionEn: 'Get approved in minutes. No lines, no complicated paperwork. All from the comfort of your phone.',
    accent: '#34D399',
    gradientColors: ['#064E3B', '#059669', '#0C1220'] as const,
  },
  {
    id: '2',
    icon: 'shield-checkmark' as const,
    bgIcon: 'document-text-outline' as const,
    title: 'Seguro y Regulado',
    titleEn: 'Safe & Regulated',
    subtitle: 'Licenciado en Texas',
    subtitleEn: 'Licensed in Texas',
    description: 'Regulados por la OCCC bajo el Capítulo 342 del Código Financiero de Texas. Transparencia total en tasas y términos.',
    descriptionEn: 'Regulated by the OCCC under Chapter 342 of the Texas Finance Code. Full transparency in rates and terms.',
    accent: '#60A5FA',
    gradientColors: ['#1E3A5F', '#2563EB', '#0C1220'] as const,
  },
  {
    id: '3',
    icon: 'lock-closed' as const,
    bgIcon: 'finger-print-outline' as const,
    title: 'Sin Afectar tu Crédito',
    titleEn: 'No Credit Impact',
    subtitle: 'Consulta suave solamente',
    subtitleEn: 'Soft inquiry only',
    description: 'Verifica tus tasas sin afectar tu puntaje crediticio. Protegemos tus datos con encriptación bancaria de 256 bits.',
    descriptionEn: 'Check your rates without affecting your credit score. We protect your data with bank-grade 256-bit encryption.',
    accent: '#A78BFA',
    gradientColors: ['#3B0764', '#7C3AED', '#0C1220'] as const,
  },
  {
    id: '4',
    icon: 'wallet' as const,
    bgIcon: 'card-outline' as const,
    title: 'Recibe tu Dinero',
    titleEn: 'Get Your Money',
    subtitle: 'Directo a tu cuenta',
    subtitleEn: 'Directly to your account',
    description: 'Desembolso rápido a tu cuenta bancaria. Sin cargos ocultos, sin sorpresas. Elige cómo quieres recibir tus fondos.',
    descriptionEn: 'Fast disbursement to your bank account. No hidden fees, no surprises. Choose how you want to receive your funds.',
    accent: '#F59E0B',
    gradientColors: ['#78350F', '#D97706', '#0C1220'] as const,
  },
  {
    id: '5',
    icon: 'people' as const,
    bgIcon: 'heart-outline' as const,
    title: 'Tu Comunidad',
    titleEn: 'Your Community',
    subtitle: 'Sirviendo a Texas',
    subtitleEn: 'Serving Texas',
    description: 'Somos un prestamista local que entiende tus necesidades. Atención personalizada en español e inglés para toda la comunidad.',
    descriptionEn: 'We are a local lender that understands your needs. Personalized service in Spanish and English for the entire community.',
    accent: '#FB7185',
    gradientColors: ['#881337', '#E11D48', '#0C1220'] as const,
  },
];

export default function OnboardingScreen({ onFinish }: OnboardingProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const scrollX = useRef(new Animated.Value(0)).current;

  const onViewableItemsChanged = useCallback(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setActiveIndex(viewableItems[0].index || 0);
    }
  }, []);

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const goNext = () => {
    if (activeIndex < SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({ index: activeIndex + 1, animated: true });
    } else {
      onFinish();
    }
  };

  const renderSlide = ({ item }: { item: typeof SLIDES[0] }) => {
    const isLastSlide = item.id === SLIDES[SLIDES.length - 1].id;
    return (
      <View style={S.slide}>
        {/* Background Gradient with Large Icon */}
        <LinearGradient
          colors={item.gradientColors}
          style={S.bgGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          {/* Decorative circles */}
          <View style={[S.decorCircle1, { borderColor: `${item.accent}15` }]} />
          <View style={[S.decorCircle2, { borderColor: `${item.accent}10` }]} />
          <View style={[S.decorCircle3, { backgroundColor: `${item.accent}08` }]} />
          
          {/* Large background icon */}
          <View style={S.bgIconContainer}>
            <Ionicons name={item.bgIcon} size={180} color={`${item.accent}12`} />
          </View>

          {/* Center Icon Badge */}
          <View style={[S.centerIconWrap, { backgroundColor: `${item.accent}20`, borderColor: `${item.accent}30` }]}>
            <Ionicons name={item.icon} size={52} color={item.accent} />
          </View>
        </LinearGradient>

        {/* Content */}
        <View style={S.content}>
          <Text style={S.title}>{item.title}</Text>
          <Text style={[S.subtitle, { color: item.accent }]}>{item.subtitle}</Text>
          <Text style={S.description}>{item.description}</Text>

          {/* Trust badges on last slide */}
          {isLastSlide && (
            <View style={S.trustRow}>
              <View style={S.trustBadge}>
                <Ionicons name="shield-checkmark" size={14} color="#34D399" />
                <Text style={S.trustBadgeText}>OCCC Regulated</Text>
              </View>
              <View style={S.trustBadge}>
                <Ionicons name="lock-closed" size={14} color="#60A5FA" />
                <Text style={S.trustBadgeText}>256-bit SSL</Text>
              </View>
              <View style={S.trustBadge}>
                <Ionicons name="home" size={14} color="#F59E0B" />
                <Text style={S.trustBadgeText}>Equal Housing</Text>
              </View>
            </View>
          )}
        </View>
      </View>
    );
  };

  const isLast = activeIndex === SLIDES.length - 1;

  return (
    <View style={S.container}>
      <SafeAreaView style={S.safeArea} edges={['top']}>
        {/* Skip Button */}
        {!isLast && (
          <TouchableOpacity style={S.skipBtn} onPress={onFinish} activeOpacity={0.7}>
            <Text style={S.skipText}>Saltar</Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
          </TouchableOpacity>
        )}
      </SafeAreaView>

      {/* Slides */}
      <Animated.FlatList
        ref={flatListRef}
        data={SLIDES}
        renderItem={renderSlide}
        keyExtractor={item => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false }
        )}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        scrollEventThrottle={16}
      />

      {/* Bottom Controls */}
      <SafeAreaView edges={['bottom']} style={S.bottomArea}>
        <View style={S.controls}>
          {/* Dots */}
          <View style={S.dotsRow}>
            {SLIDES.map((slide, i) => {
              const inputRange = [(i - 1) * SW, i * SW, (i + 1) * SW];
              const dotWidth = scrollX.interpolate({
                inputRange,
                outputRange: [8, 28, 8],
                extrapolate: 'clamp',
              });
              const dotOpacity = scrollX.interpolate({
                inputRange,
                outputRange: [0.3, 1, 0.3],
                extrapolate: 'clamp',
              });
              return (
                <Animated.View
                  key={i}
                  style={[
                    S.dot,
                    {
                      width: dotWidth,
                      opacity: dotOpacity,
                      backgroundColor: slide.accent,
                    },
                  ]}
                />
              );
            })}
          </View>

          {/* CTA Button */}
          <TouchableOpacity onPress={goNext} activeOpacity={0.85} style={S.ctaWrap}>
            <LinearGradient
              colors={isLast ? ['#059669', '#10B981'] : ['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.04)']}
              style={S.ctaBtn}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Text style={[S.ctaText, isLast && { color: '#fff', fontWeight: '800' }]}>
                {isLast ? 'Comenzar' : 'Siguiente'}
              </Text>
              <Ionicons
                name={isLast ? 'arrow-forward' : 'chevron-forward'}
                size={20}
                color={isLast ? '#fff' : Colors.textSecondary}
              />
            </LinearGradient>
          </TouchableOpacity>

          {/* Already have account */}
          {isLast && (
            <TouchableOpacity onPress={onFinish} style={S.loginLink}>
              <Text style={S.loginLinkText}>¿Ya tienes cuenta? </Text>
              <Text style={[S.loginLinkText, { color: Colors.primaryLight, fontWeight: '700' }]}>Iniciar Sesión</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const S = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  safeArea: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },

  // Skip
  skipBtn: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end',
    paddingHorizontal: 20, paddingVertical: 12, gap: 4,
  },
  skipText: { fontSize: 15, color: Colors.textMuted, fontWeight: '600' },

  // Slide
  slide: { width: SW, height: SH },
  
  // Background gradient
  bgGradient: {
    position: 'absolute', top: 0, left: 0, right: 0, height: SH * 0.55,
    justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
  },
  
  // Decorative elements
  decorCircle1: {
    position: 'absolute', top: -40, right: -40,
    width: 200, height: 200, borderRadius: 100,
    borderWidth: 2,
  },
  decorCircle2: {
    position: 'absolute', bottom: -30, left: -30,
    width: 160, height: 160, borderRadius: 80,
    borderWidth: 2,
  },
  decorCircle3: {
    position: 'absolute', top: '30%', right: '10%',
    width: 60, height: 60, borderRadius: 30,
  },
  bgIconContainer: {
    position: 'absolute', top: '15%', opacity: 0.3,
  },
  centerIconWrap: {
    width: 100, height: 100, borderRadius: 30,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5, marginTop: 20,
  },

  // Content
  content: {
    position: 'absolute', bottom: SH * 0.22, left: 0, right: 0,
    paddingHorizontal: 32, alignItems: 'center',
  },
  title: {
    fontSize: 30, fontWeight: '800', color: Colors.text,
    textAlign: 'center', marginBottom: 8,
  },
  subtitle: {
    fontSize: 15, fontWeight: '700', textAlign: 'center',
    marginBottom: 14, letterSpacing: 0.5,
  },
  description: {
    fontSize: 15, color: Colors.textSecondary, textAlign: 'center',
    lineHeight: 23, paddingHorizontal: 10,
  },

  // Trust badges (last slide)
  trustRow: {
    flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap',
    gap: 8, marginTop: 18,
  },
  trustBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  trustBadgeText: { fontSize: 11, fontWeight: '700', color: Colors.textMuted },

  // Bottom
  bottomArea: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  controls: { paddingHorizontal: 24, paddingBottom: 16, alignItems: 'center' },

  // Dots
  dotsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 24 },
  dot: { height: 8, borderRadius: 4 },

  // CTA
  ctaWrap: { width: '100%' },
  ctaBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    height: 56, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  ctaText: { fontSize: 17, fontWeight: '600', color: Colors.textSecondary },

  // Login link
  loginLink: { flexDirection: 'row', marginTop: 16, paddingVertical: 8 },
  loginLinkText: { fontSize: 14, color: Colors.textMuted },
});
