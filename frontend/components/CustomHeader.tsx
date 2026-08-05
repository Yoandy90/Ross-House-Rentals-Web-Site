import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, StatusBar } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeColors } from '../constants/colors';

interface CustomHeaderProps {
  title: string;
  showBack?: boolean;
  showBackButton?: boolean; // Alias for showBack
  backRoute?: string; // Custom route for back button (e.g., '/(tabs)/profile')
  showCart?: boolean;
  showNotifications?: boolean;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  onRightIconPress?: () => void;
  backgroundColor?: string;
  gradientColors?: [string, string]; // Custom gradient colors
  useGradient?: boolean;
}

export default function CustomHeader({
  title,
  showBack = false,
  showBackButton = false, // Alias for showBack
  backRoute,
  showCart = false,
  showNotifications = false,
  rightIcon,
  onRightIconPress,
  backgroundColor,
  gradientColors,
  useGradient = true,
}: CustomHeaderProps) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const styles = React.useMemo(() => createStyles(colors, insets.top), [colors, insets.top]);
  const router = useRouter();

  // Use either showBack or showBackButton
  const shouldShowBack = showBack || showBackButton;

  // Handle back button press
  const handleBackPress = () => {
    if (backRoute) {
      router.push(backRoute);
    } else {
      router.back();
    }
  };

  const headerContent = (
    <View style={styles.container}>
      {/* Left Side - Back Button or Empty Space */}
      <View style={styles.leftSection}>
        {shouldShowBack ? (
          <TouchableOpacity
            style={styles.iconButton}
            onPress={handleBackPress}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>
        ) : (
          <View style={styles.iconButton} />
        )}
      </View>

      {/* Center - Title */}
      <View style={styles.centerSection}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
      </View>

      {/* Right Side - Icons */}
      <View style={styles.rightSection}>
        {showCart && (
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => router.push('/(tabs)/credits')}
            activeOpacity={0.7}
          >
            <Ionicons name="cart-outline" size={24} color="#FFF" />
          </TouchableOpacity>
        )}
        {showNotifications && (
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => router.push('/(tabs)/notifications')}
            activeOpacity={0.7}
          >
            <Ionicons name="notifications-outline" size={24} color="#FFF" />
          </TouchableOpacity>
        )}
        {rightIcon && onRightIconPress && (
          <TouchableOpacity
            style={styles.iconButton}
            onPress={onRightIconPress}
            activeOpacity={0.7}
          >
            <Ionicons name={rightIcon} size={24} color="#FFF" />
          </TouchableOpacity>
        )}
        {!showCart && !showNotifications && !rightIcon && (
          <View style={styles.iconButton} />
        )}
      </View>
    </View>
  );

  if (useGradient) {
    // Default to premium green gradient if no custom colors provided
    const defaultGradient: [string, string] = ['#064E3B', '#065F46'];
    const colors1 = gradientColors || (backgroundColor ? [backgroundColor, backgroundColor] : defaultGradient);
    return (
      <LinearGradient
        colors={colors1 as [string, string]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        {headerContent}
      </LinearGradient>
    );
  }

  return (
    <View style={[styles.gradient, { backgroundColor: backgroundColor || colors.primary }]}>
      {headerContent}
    </View>
  );
}

const createStyles = (colors: any, topInset: number) => StyleSheet.create({
  gradient: {
    paddingTop: Math.max(topInset, StatusBar.currentHeight || 24) + 10,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  leftSection: {
    width: 44,
    alignItems: 'flex-start',
  },
  centerSection: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  rightSection: {
    width: 44,
    alignItems: 'flex-end',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFF',
    textAlign: 'center',
  },
  iconButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
});