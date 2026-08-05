/**
 * PremiumButton - 3D button with gradients and animations
 * Part of Ross Tax Premium Design System
 */
import React, { useRef } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  Animated,
  ActivityIndicator,
  View,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

interface PremiumButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success' | 'dark';
  size?: 'small' | 'medium' | 'large';
  icon?: keyof typeof Ionicons.glyphMap;
  iconPosition?: 'left' | 'right';
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  gradientColors?: readonly [string, string, ...string[]];
}

export default function PremiumButton({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  icon,
  iconPosition = 'left',
  loading = false,
  disabled = false,
  fullWidth = false,
  style,
  textStyle,
  gradientColors,
}: PremiumButtonProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 0.96,
        useNativeDriver: true,
        friction: 8,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0.9,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handlePressOut = () => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        friction: 8,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const getColors = (): readonly [string, string, ...string[]] => {
    if (gradientColors) return gradientColors;
    
    switch (variant) {
      case 'primary':
        return ['#10B981', '#059669'];
      case 'secondary':
        return ['#6C1110', '#4A0C0B'];
      case 'danger':
        return ['#EF4444', '#DC2626'];
      case 'success':
        return ['#22C55E', '#16A34A'];
      case 'dark':
        return ['#374151', '#1F2937'];
      default:
        return ['#10B981', '#059669'];
    }
  };

  const getShadowColor = () => {
    switch (variant) {
      case 'primary':
        return '#10B981';
      case 'secondary':
        return '#6C1110';
      case 'danger':
        return '#EF4444';
      case 'success':
        return '#22C55E';
      case 'dark':
        return '#1F2937';
      default:
        return '#10B981';
    }
  };

  const getSize = () => {
    switch (size) {
      case 'small':
        return { height: 40, paddingHorizontal: 16, fontSize: 13, iconSize: 16 };
      case 'large':
        return { height: 56, paddingHorizontal: 28, fontSize: 17, iconSize: 22 };
      default:
        return { height: 48, paddingHorizontal: 22, fontSize: 15, iconSize: 18 };
    }
  };

  const sizeConfig = getSize();
  const isOutline = variant === 'outline';
  const isGhost = variant === 'ghost';

  const renderContent = () => (
    <View style={styles.contentContainer}>
      {loading ? (
        <ActivityIndicator color={isOutline || isGhost ? '#10B981' : '#FFF'} size="small" />
      ) : (
        <>
          {icon && iconPosition === 'left' && (
            <Ionicons
              name={icon}
              size={sizeConfig.iconSize}
              color={isOutline || isGhost ? '#10B981' : '#FFF'}
              style={styles.iconLeft}
            />
          )}
          <Text
            style={[
              styles.text,
              {
                fontSize: sizeConfig.fontSize,
                color: isOutline || isGhost ? '#10B981' : '#FFF',
              },
              textStyle,
            ]}
          >
            {title}
          </Text>
          {icon && iconPosition === 'right' && (
            <Ionicons
              name={icon}
              size={sizeConfig.iconSize}
              color={isOutline || isGhost ? '#10B981' : '#FFF'}
              style={styles.iconRight}
            />
          )}
        </>
      )}
    </View>
  );

  if (isOutline) {
    return (
      <Animated.View
        style={[
          { transform: [{ scale: scaleAnim }], opacity: opacityAnim },
          fullWidth && styles.fullWidth,
          style,
        ]}
      >
        <TouchableOpacity
          onPress={onPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          disabled={disabled || loading}
          activeOpacity={0.8}
          style={[
            styles.outlineButton,
            {
              height: sizeConfig.height,
              paddingHorizontal: sizeConfig.paddingHorizontal,
              opacity: disabled ? 0.5 : 1,
            },
          ]}
        >
          {renderContent()}
        </TouchableOpacity>
      </Animated.View>
    );
  }

  if (isGhost) {
    return (
      <Animated.View
        style={[
          { transform: [{ scale: scaleAnim }], opacity: opacityAnim },
          fullWidth && styles.fullWidth,
          style,
        ]}
      >
        <TouchableOpacity
          onPress={onPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          disabled={disabled || loading}
          activeOpacity={0.7}
          style={[
            styles.ghostButton,
            {
              height: sizeConfig.height,
              paddingHorizontal: sizeConfig.paddingHorizontal,
              opacity: disabled ? 0.5 : 1,
            },
          ]}
        >
          {renderContent()}
        </TouchableOpacity>
      </Animated.View>
    );
  }

  return (
    <Animated.View
      style={[
        { transform: [{ scale: scaleAnim }], opacity: opacityAnim },
        fullWidth && styles.fullWidth,
        style,
      ]}
    >
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || loading}
        activeOpacity={0.9}
      >
        <LinearGradient
          colors={getColors()}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.gradientButton,
            {
              height: sizeConfig.height,
              paddingHorizontal: sizeConfig.paddingHorizontal,
              opacity: disabled ? 0.5 : 1,
              shadowColor: getShadowColor(),
            },
          ]}
        >
          {renderContent()}
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  gradientButton: {
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  outlineButton: {
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#10B981',
    backgroundColor: 'transparent',
  },
  ghostButton: {
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  contentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  iconLeft: {
    marginRight: 8,
  },
  iconRight: {
    marginLeft: 8,
  },
  fullWidth: {
    width: '100%',
  },
});
