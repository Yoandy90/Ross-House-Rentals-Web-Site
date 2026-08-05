import React from 'react';
import { TouchableOpacity, StyleSheet, View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';
import { useThemeColors } from '../constants/colors';

export function ChatFAB() {
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const pathname = usePathname();

  // Don't show FAB on chat screen itself
  if (pathname === '/(tabs)/chat') {
    return null;
  }

  return (
    <View style={styles.fabContainer} pointerEvents="box-none">
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/(tabs)/chat')}
        activeOpacity={0.8}
      >
        <Ionicons name="chatbubbles" size={28} color={colors.textWhite} />
        {/* Badge for unread messages - you can implement counter later */}
        <View style={styles.badge}>
          <Text style={styles.badgeText}>0</Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  fabContainer: {
    position: 'absolute',
    bottom: 130,
    right: 0,
    width: 80,
    height: 80,
    zIndex: 1000,
  },
  fab: {
    position: 'absolute',
    bottom: 150, // Moved up to avoid overlap with chat input
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: colors.error,
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    borderWidth: 2,
    borderColor: colors.background,
  },
  badgeText: {
    color: colors.textWhite,
    fontSize: 12,
    fontWeight: '700',
  },
});
