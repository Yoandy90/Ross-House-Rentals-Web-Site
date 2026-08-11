import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Dimensions } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── Shimmer Base Component ─────────────────────────
function ShimmerBlock({ width, height, borderRadius = 8, style }: {
  width: number | string;
  height: number;
  borderRadius?: number;
  style?: any;
}) {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(shimmerAnim, { toValue: 0, duration: 1000, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const opacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <Animated.View
      style={[
        {
          width: width as any,
          height,
          borderRadius,
          backgroundColor: 'rgba(255,255,255,0.08)',
          opacity,
        },
        style,
      ]}
    />
  );
}

// ─── Home Screen Skeleton ─────────────────────────
export function HomeSkeleton() {
  const cardW = SCREEN_WIDTH - 32;
  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <ShimmerBlock width={160} height={14} borderRadius={6} />
          <ShimmerBlock width={100} height={20} borderRadius={6} style={{ marginTop: 6 }} />
        </View>
        <ShimmerBlock width={44} height={44} borderRadius={22} />
      </View>

      {/* Balance Card */}
      <View style={s.balanceCard}>
        <ShimmerBlock width={80} height={12} borderRadius={4} />
        <ShimmerBlock width={140} height={32} borderRadius={6} style={{ marginTop: 10 }} />
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
          <ShimmerBlock width={cardW * 0.4} height={48} borderRadius={10} />
          <ShimmerBlock width={cardW * 0.4} height={48} borderRadius={10} />
        </View>
      </View>

      {/* Quick Actions */}
      <View style={s.quickActions}>
        {[1, 2, 3, 4].map(i => (
          <View key={i} style={s.quickActionItem}>
            <ShimmerBlock width={48} height={48} borderRadius={14} />
            <ShimmerBlock width={50} height={10} borderRadius={4} style={{ marginTop: 6 }} />
          </View>
        ))}
      </View>

      {/* Loan Cards */}
      {[1, 2].map(i => (
        <View key={i} style={s.loanCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <ShimmerBlock width={38} height={38} borderRadius={10} />
            <View style={{ flex: 1 }}>
              <ShimmerBlock width={120} height={13} borderRadius={4} />
              <ShimmerBlock width={80} height={10} borderRadius={4} style={{ marginTop: 4 }} />
            </View>
            <ShimmerBlock width={60} height={22} borderRadius={6} />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 }}>
            <View>
              <ShimmerBlock width={90} height={22} borderRadius={4} />
              <ShimmerBlock width={70} height={10} borderRadius={4} style={{ marginTop: 4 }} />
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <ShimmerBlock width={70} height={16} borderRadius={4} />
              <ShimmerBlock width={50} height={10} borderRadius={4} style={{ marginTop: 4 }} />
            </View>
          </View>
          <ShimmerBlock width={'100%' as any} height={6} borderRadius={3} style={{ marginTop: 12 }} />
        </View>
      ))}
    </View>
  );
}

// ─── Loans Screen Skeleton ─────────────────────────
export function LoansSkeleton() {
  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <ShimmerBlock width={120} height={22} borderRadius={6} />
          <ShimmerBlock width={180} height={12} borderRadius={4} style={{ marginTop: 6 }} />
        </View>
        <ShimmerBlock width={70} height={32} borderRadius={10} />
      </View>

      {/* Section title */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 20, marginBottom: 12 }}>
        <ShimmerBlock width={16} height={16} borderRadius={4} />
        <ShimmerBlock width={140} height={14} borderRadius={4} />
      </View>

      {/* Loan Cards */}
      {[1, 2, 3].map(i => (
        <View key={i} style={s.loanCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <ShimmerBlock width={38} height={38} borderRadius={10} />
            <View style={{ flex: 1 }}>
              <ShimmerBlock width={120} height={13} borderRadius={4} />
              <ShimmerBlock width={80} height={10} borderRadius={4} style={{ marginTop: 4 }} />
            </View>
            <ShimmerBlock width={60} height={22} borderRadius={6} />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 }}>
            <View>
              <ShimmerBlock width={90} height={22} borderRadius={4} />
              <ShimmerBlock width={70} height={10} borderRadius={4} style={{ marginTop: 4 }} />
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <ShimmerBlock width={70} height={16} borderRadius={4} />
              <ShimmerBlock width={50} height={10} borderRadius={4} style={{ marginTop: 4 }} />
            </View>
          </View>
          <ShimmerBlock width={'100%' as any} height={6} borderRadius={3} style={{ marginTop: 12 }} />
          <ShimmerBlock width={100} height={10} borderRadius={4} style={{ marginTop: 6, alignSelf: 'flex-end' }} />
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#060B14',
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  balanceCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 20,
    marginBottom: 20,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 24,
  },
  quickActionItem: {
    alignItems: 'center',
  },
  loanCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 16,
    marginBottom: 12,
  },
});

export { ShimmerBlock };
