import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, G, Path, Circle, Rect } from 'react-native-svg';

type Props = {
  size?: number;
  showBackground?: boolean;
};

/**
 * Premium Ross House Rentals Logo
 * A modern luxury logo featuring a minimalist house icon
 * inside a shield/diamond shape with the brand red gradient.
 */
export function PremiumLogo({ size = 120, showBackground = true }: Props) {
  const scale = size / 120;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size} viewBox="0 0 120 120">
        <Defs>
          {/* Main red gradient */}
          <LinearGradient id="brandGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#E11D48" stopOpacity="1" />
            <Stop offset="1" stopColor="#9B1B30" stopOpacity="1" />
          </LinearGradient>

          {/* Subtle glow gradient */}
          <LinearGradient id="glowGrad" x1="0.5" y1="0" x2="0.5" y2="1">
            <Stop offset="0" stopColor="#FF3366" stopOpacity="0.25" />
            <Stop offset="1" stopColor="#C8102E" stopOpacity="0.05" />
          </LinearGradient>

          {/* Dark surface gradient */}
          <LinearGradient id="surfaceGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#1A1A1E" stopOpacity="1" />
            <Stop offset="1" stopColor="#0F0F12" stopOpacity="1" />
          </LinearGradient>

          {/* Gold accent gradient */}
          <LinearGradient id="goldGrad" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#D4A574" stopOpacity="0.8" />
            <Stop offset="1" stopColor="#B8860B" stopOpacity="0.4" />
          </LinearGradient>
        </Defs>

        {/* Outer circle - background */}
        {showBackground && (
          <Circle cx="60" cy="60" r="58" fill="url(#surfaceGrad)" stroke="#2A2A30" strokeWidth="0.5" />
        )}

        {/* Subtle glow ring */}
        <Circle cx="60" cy="60" r="48" fill="none" stroke="url(#glowGrad)" strokeWidth="1" />

        {/* Inner decorative ring */}
        <Circle cx="60" cy="60" r="42" fill="none" stroke="#C8102E" strokeWidth="0.3" strokeOpacity="0.3" />

        {/* Shield / Diamond shape background */}
        <G>
          <Path
            d="M60 22 L88 42 L88 72 Q88 86 60 98 Q32 86 32 72 L32 42 Z"
            fill="url(#brandGrad)"
            opacity="0.12"
          />
          <Path
            d="M60 22 L88 42 L88 72 Q88 86 60 98 Q32 86 32 72 L32 42 Z"
            fill="none"
            stroke="url(#brandGrad)"
            strokeWidth="1.5"
            opacity="0.6"
          />
        </G>

        {/* House Icon - Minimalist */}
        <G>
          {/* Roof */}
          <Path
            d="M60 34 L78 50 L74 50 L74 72 L46 72 L46 50 L42 50 Z"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* Door */}
          <Rect
            x="54"
            y="58"
            width="12"
            height="14"
            rx="2"
            fill="url(#brandGrad)"
            opacity="0.9"
          />

          {/* Door handle */}
          <Circle cx="63" cy="65" r="1.2" fill="#FFFFFF" opacity="0.9" />

          {/* Window Left */}
          <Rect
            x="49"
            y="50"
            width="8"
            height="6"
            rx="1"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="1.2"
            opacity="0.7"
          />

          {/* Window Right */}
          <Rect
            x="63"
            y="50"
            width="8"
            height="6"
            rx="1"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="1.2"
            opacity="0.7"
          />
        </G>

        {/* Small "R" monogram at bottom */}
        <G opacity="0.5">
          <Path
            d="M55 88 L55 82 Q55 80 58 80 L62 80 Q65 80 65 82 L65 84 Q65 86 62 86 L58 86 L65 90"
            fill="none"
            stroke="url(#goldGrad)"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </G>

        {/* Decorative dots */}
        <Circle cx="38" cy="36" r="1" fill="#C8102E" opacity="0.3" />
        <Circle cx="82" cy="36" r="1" fill="#C8102E" opacity="0.3" />
        <Circle cx="30" cy="60" r="0.8" fill="#C8102E" opacity="0.2" />
        <Circle cx="90" cy="60" r="0.8" fill="#C8102E" opacity="0.2" />
      </Svg>
    </View>
  );
}

/**
 * Compact version for tab bar, headers, etc.
 */
export function PremiumLogoCompact({ size = 40 }: { size?: number }) {
  return (
    <View style={[styles.compact, { width: size, height: size }]}>
      <Svg width={size} height={size} viewBox="0 0 40 40">
        <Defs>
          <LinearGradient id="compactGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#E11D48" stopOpacity="1" />
            <Stop offset="1" stopColor="#9B1B30" stopOpacity="1" />
          </LinearGradient>
        </Defs>

        {/* Background circle */}
        <Circle cx="20" cy="20" r="18" fill="url(#compactGrad)" />

        {/* House */}
        <G>
          <Path
            d="M20 10 L30 18 L28 18 L28 28 L12 28 L12 18 L10 18 Z"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <Rect x="17" y="22" width="6" height="6" rx="1" fill="#FFFFFF" opacity="0.9" />
        </G>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  compact: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default PremiumLogo;
