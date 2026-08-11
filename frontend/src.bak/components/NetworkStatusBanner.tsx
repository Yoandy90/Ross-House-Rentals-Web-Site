import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import NetInfo from '@react-native-community/netinfo';

export default function NetworkStatusBanner() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [isConnected, setIsConnected] = useState(true);
  const [showBanner, setShowBanner] = useState(false);
  const slideAnim = useRef(new Animated.Value(-80)).current;
  const wasDisconnected = useRef(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      const connected = state.isConnected ?? true;

      if (!connected) {
        // Lost connection
        wasDisconnected.current = true;
        setIsConnected(false);
        setShowBanner(true);
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 80,
          friction: 12,
        }).start();
      } else if (wasDisconnected.current) {
        // Reconnected after being offline
        setIsConnected(true);
        // Show "connected" for 2.5s, then hide
        setTimeout(() => {
          Animated.timing(slideAnim, {
            toValue: -80,
            duration: 300,
            useNativeDriver: true,
          }).start(() => {
            setShowBanner(false);
            wasDisconnected.current = false;
          });
        }, 2500);
      }
    });

    return () => unsubscribe();
  }, []);

  if (!showBanner) return null;

  return (
    <Animated.View
      style={[
        styles.banner,
        {
          transform: [{ translateY: slideAnim }],
          paddingTop: insets.top + 4,
          backgroundColor: isConnected ? '#059669' : '#DC2626',
        },
      ]}
    >
      <Ionicons
        name={isConnected ? 'wifi' : 'cloud-offline-outline'}
        size={16}
        color="#fff"
      />
      <Text style={styles.bannerText}>
        {isConnected ? '✓ ' + t('common.retry') : t('common.offline')}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 8,
    gap: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
      },
      android: { elevation: 6 },
    }),
  },
  bannerText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
});
