import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Image, Dimensions, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  withDelay,
  interpolate,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import * as SplashScreen from 'expo-splash-screen';
import { useAuth } from '../src/contexts/AuthContext';
import { Colors } from '../src/constants/theme';

// Keep the native splash visible while we mount our animated one — prevents
// the "flash" between native asset and JS render.
SplashScreen.preventAutoHideAsync().catch(() => {});

const { width: SCREEN_W } = Dimensions.get('window');
const LOGO_SIZE = Math.min(SCREEN_W * 0.7, 320);
// Subtle elliptical glow ring, just like the login screen
const GLOW_W = LOGO_SIZE * 1.15;
const GLOW_H = LOGO_SIZE * 0.7;

export default function Index() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);
  const [ready, setReady] = useState(false);

  // ── Animation values ───────────────────────────────────────────────
  const logoOpacity = useSharedValue(0);
  const logoScale = useSharedValue(0.92);
  const glowOpacity = useSharedValue(0);
  const dot1 = useSharedValue(0);
  const dot2 = useSharedValue(0);
  const dot3 = useSharedValue(0);
  const containerOpacity = useSharedValue(1);

  // ── Mount animations ───────────────────────────────────────────────
  useEffect(() => {
    // Hide native splash now that JS is ready to paint
    SplashScreen.hideAsync().catch(() => {});

    // Logo fade + gentle scale (subtle, no spring bounce)
    logoOpacity.value = withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) });
    logoScale.value = withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) });

    // Soft elliptical glow fade-in + breathing pulse
    glowOpacity.value = withDelay(
      150,
      withTiming(1, { duration: 700 }, () => {
        glowOpacity.value = withRepeat(
          withSequence(
            withTiming(0.6, { duration: 1600, easing: Easing.inOut(Easing.quad) }),
            withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.quad) }),
          ),
          -1,
          false,
        );
      }),
    );

    // Loading dots — staggered bounce
    const dotCycle = () =>
      withRepeat(
        withSequence(
          withTiming(1, { duration: 400, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: 400, easing: Easing.in(Easing.quad) }),
        ),
        -1,
        false,
      );
    dot1.value = withDelay(600, dotCycle());
    dot2.value = withDelay(750, dotCycle());
    dot3.value = withDelay(900, dotCycle());

    return () => {
      cancelAnimation(logoOpacity);
      cancelAnimation(logoScale);
      cancelAnimation(glowOpacity);
      cancelAnimation(dot1);
      cancelAnimation(dot2);
      cancelAnimation(dot3);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Onboarding + auth routing ──────────────────────────────────────
  useEffect(() => {
    const checkFlow = async () => {
      try {
        const onboardingDone = await AsyncStorage.getItem('onboarding_completed');
        if (!onboardingDone) {
          setTimeout(() => router.replace('/onboarding'), 900);
          return;
        }
      } catch {}
      setCheckingOnboarding(false);
    };
    checkFlow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!checkingOnboarding && !isLoading) {
      setReady(true);
    }
  }, [checkingOnboarding, isLoading]);

  // Once auth is resolved, fade out the splash then navigate
  useEffect(() => {
    if (!ready) return;
    const dwell = setTimeout(() => {
      containerOpacity.value = withTiming(
        0,
        { duration: 380, easing: Easing.in(Easing.cubic) },
        () => {},
      );
      setTimeout(() => {
        if (isAuthenticated) {
          router.replace('/(tabs)');
        } else {
          router.replace('/(auth)/login');
        }
      }, 380);
    }, 1500);
    return () => clearTimeout(dwell);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, isAuthenticated]);

  // ── Animated styles ────────────────────────────────────────────────
  const containerStyle = useAnimatedStyle(() => ({ opacity: containerOpacity.value }));

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value * 0.75,
  }));

  const dot1Style = useAnimatedStyle(() => ({
    opacity: interpolate(dot1.value, [0, 1], [0.3, 1]),
    transform: [{ translateY: interpolate(dot1.value, [0, 1], [0, -4]) }],
  }));
  const dot2Style = useAnimatedStyle(() => ({
    opacity: interpolate(dot2.value, [0, 1], [0.3, 1]),
    transform: [{ translateY: interpolate(dot2.value, [0, 1], [0, -4]) }],
  }));
  const dot3Style = useAnimatedStyle(() => ({
    opacity: interpolate(dot3.value, [0, 1], [0.3, 1]),
    transform: [{ translateY: interpolate(dot3.value, [0, 1], [0, -4]) }],
  }));

  return (
    <Animated.View style={[styles.container, containerStyle]}>
      {/* Plain dark background — no gradient bloom, keeps it clean like login */}
      <View style={styles.centerWrapper}>
        {/* Subtle elliptical red glow ring behind logo (matches login screen) */}
        <Animated.View style={[styles.glowWrap, glowStyle]} pointerEvents="none">
          <LinearGradient
            colors={[
              'rgba(200,16,46,0.32)',
              'rgba(200,16,46,0.14)',
              'rgba(200,16,46,0.04)',
              'transparent',
            ]}
            locations={[0, 0.45, 0.75, 1]}
            start={{ x: 0.5, y: 0.5 }}
            end={{ x: 1, y: 1 }}
            style={styles.glowEllipse}
          />
        </Animated.View>

        {/* Logo only — no extra title text */}
        <Animated.View style={logoStyle}>
          <Image
            source={require('../assets/splash-icon.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </Animated.View>
      </View>

      {/* Minimal loading dots at bottom */}
      <View style={styles.dotsRow}>
        <Animated.View style={[styles.dot, dot1Style]} />
        <Animated.View style={[styles.dot, dot2Style]} />
        <Animated.View style={[styles.dot, dot3Style]} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerWrapper: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  glowWrap: {
    position: 'absolute',
    width: GLOW_W,
    height: GLOW_H,
    borderRadius: GLOW_W / 2,
    overflow: 'hidden',
  },
  glowEllipse: {
    flex: 1,
    borderRadius: GLOW_W / 2,
  },
  logo: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    ...Platform.select({
      ios: {
        shadowColor: Colors.brandRed,
        shadowOpacity: 0.25,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 0 },
      },
      android: { elevation: 6 },
    }),
  },
  dotsRow: {
    position: 'absolute',
    bottom: 80,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: Colors.brandRed,
  },
});
