import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import GlobalSearch from './GlobalSearch';

interface AdminHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  showBackButton?: boolean;
  showBack?: boolean; // Alias for showBackButton
  showSearch?: boolean; // Show global search button
  rightAction?: {
    icon: string;
    onPress: () => void;
  };
}

const ADMIN_HEADER_COLOR = '#1a1a2e'; // Mismo color del tab bar

export default function AdminHeader({
  title,
  subtitle,
  onBack,
  showBackButton = true,
  showBack,
  showSearch = false,
  rightAction,
}: AdminHeaderProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [searchVisible, setSearchVisible] = useState(false);
  
  // Support both showBack and showBackButton
  const shouldShowBack = showBack !== undefined ? showBack : showBackButton;

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  };

  return (
    <>
      <View style={[styles.headerContainer, { paddingTop: insets.top + 10 }]}>
        <View style={styles.header}>
          {shouldShowBack ? (
            <TouchableOpacity 
              onPress={handleBack} 
              style={styles.backButton}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <View style={styles.backButtonCircle}>
                <Ionicons name="chevron-back" size={22} color="#FFF" />
              </View>
            </TouchableOpacity>
          ) : (
            <View style={styles.placeholder} />
          )}
          
          <View style={styles.titleContainer}>
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
            {subtitle && (
              <Text style={styles.subtitle} numberOfLines={1}>
                {subtitle}
              </Text>
            )}
          </View>
          
          <View style={styles.rightActions}>
            {showSearch && (
              <TouchableOpacity 
                onPress={() => setSearchVisible(true)} 
                style={styles.button}
                activeOpacity={0.7}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="search" size={22} color="#FFF" />
              </TouchableOpacity>
            )}
            {rightAction && (
              <TouchableOpacity 
                onPress={rightAction.onPress} 
                style={styles.button}
                activeOpacity={0.7}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name={rightAction.icon as any} size={24} color="#FFF" />
              </TouchableOpacity>
            )}
            {!rightAction && !showSearch && (
              <View style={styles.placeholder} />
            )}
          </View>
        </View>
      </View>
      
      {/* Global Search Modal - Only render when showSearch is enabled */}
      {showSearch && (
        <GlobalSearch 
          visible={searchVisible} 
          onClose={() => setSearchVisible(false)} 
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    backgroundColor: ADMIN_HEADER_COLOR,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  backButton: {
    padding: 4,
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  backButtonCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  button: {
    padding: 8,
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  placeholder: {
    width: 44,
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '400',
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    marginTop: 2,
  },
});
