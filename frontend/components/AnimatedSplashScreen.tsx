import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Image, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface AnimatedSplashScreenProps {
  onFinish: () => void;
}

export default function AnimatedSplashScreen({ onFinish }: AnimatedSplashScreenProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.3)).current;
  const textFadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Secuencia de animaciones
    Animated.sequence([
      // 1. Logo aparece con fade-in y escala
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
      ]),
      // 2. Pequeña pausa
      Animated.delay(300),
      // 3. Texto aparece
      Animated.timing(textFadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      // 4. Pausa final
      Animated.delay(800),
    ]).start(() => {
      // Animación completada, llamar onFinish
      onFinish();
    });
  }, []);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#8B0000', '#6C1110', '#4A0E0E']}
        style={styles.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      >
        {/* Logo animado */}
        <Animated.View
          style={[
            styles.logoContainer,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <View style={styles.logoBackground}>
            <Image
              source={require('../assets/ross-logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
        </Animated.View>

        {/* Texto animado */}
        <Animated.View
          style={[
            styles.textContainer,
            {
              opacity: textFadeAnim,
            },
          ]}
        >
          <Text style={styles.title}>Ross Tax</Text>
          <Text style={styles.subtitle}>Preparación de Impuestos</Text>
        </Animated.View>

        {/* Indicador de carga sutil */}
        <Animated.View
          style={[
            styles.loadingContainer,
            {
              opacity: textFadeAnim,
            },
          ]}
        >
          <View style={styles.loadingDot} />
          <View style={[styles.loadingDot, styles.loadingDotDelay1]} />
          <View style={[styles.loadingDot, styles.loadingDotDelay2]} />
        </Animated.View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    marginBottom: 40,
  },
  logoBackground: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 20,
  },
  logo: {
    width: 140,
    height: 70,
  },
  textContainer: {
    alignItems: 'center',
    marginTop: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 2,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '400',
    color: '#FFFFFF',
    marginTop: 8,
    opacity: 0.9,
    letterSpacing: 1,
  },
  loadingContainer: {
    flexDirection: 'row',
    marginTop: 60,
    gap: 8,
  },
  loadingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
    opacity: 0.6,
  },
  loadingDotDelay1: {
    opacity: 0.4,
  },
  loadingDotDelay2: {
    opacity: 0.2,
  },
});
