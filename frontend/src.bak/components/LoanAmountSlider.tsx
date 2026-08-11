/**
 * LoanAmountSlider - Interactive amount selector
 * Simple implementation using onLayout + touch events (no PanResponder)
 */
import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Platform, GestureResponderEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/theme';

const THUMB_SIZE = 32;

interface Props {
  value: number;
  onValueChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
}

export default function LoanAmountSlider({
  value,
  onValueChange,
  min = 100,
  max = 10000,
  step = 50,
}: Props) {
  const trackRef = useRef<View>(null);
  const [trackLayout, setTrackLayout] = useState({ x: 0, width: 0 });

  const clampValue = useCallback((val: number) => {
    const stepped = Math.round(val / step) * step;
    return Math.max(min, Math.min(max, stepped));
  }, [min, max, step]);

  const handleTouch = useCallback((evt: GestureResponderEvent) => {
    if (trackLayout.width <= 0) return;
    const touchX = evt.nativeEvent.locationX;
    const ratio = Math.max(0, Math.min(1, touchX / trackLayout.width));
    const rawValue = min + ratio * (max - min);
    const newValue = clampValue(rawValue);
    onValueChange(newValue);
  }, [trackLayout, min, max, clampValue, onValueChange]);

  // Fill percentage
  const fillPct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));

  return (
    <View style={styles.container}>
      {/* Amount Display */}
      <View style={styles.amountDisplay}>
        <Text style={styles.dollarSign}>$</Text>
        <Text style={styles.amountText}>{value.toLocaleString()}</Text>
      </View>

      {/* Slider Track */}
      <View
        ref={trackRef}
        style={styles.trackContainer}
        onLayout={(e) => {
          setTrackLayout({ x: e.nativeEvent.layout.x, width: e.nativeEvent.layout.width });
        }}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={handleTouch}
        onResponderMove={handleTouch}
      >
        {/* Background Track */}
        <View style={styles.track}>
          <View style={[styles.trackFill, { width: `${fillPct}%` }]} />
        </View>

        {/* Thumb */}
        <View style={[styles.thumb, { left: `${fillPct}%`, marginLeft: -(THUMB_SIZE / 2) }]}>
          <View style={styles.thumbInner}>
            <Ionicons name="cash" size={14} color="#fff" />
          </View>
        </View>
      </View>

      {/* Labels */}
      <View style={styles.labelsRow}>
        <Text style={styles.labelText}>${min.toLocaleString()}</Text>
        <Text style={styles.labelCenter}>${(max / 2).toLocaleString()}</Text>
        <Text style={styles.labelText}>${max.toLocaleString()}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  amountDisplay: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    marginBottom: 20,
  },
  dollarSign: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.primaryLight,
    marginTop: 4,
    marginRight: 2,
  },
  amountText: {
    fontSize: 44,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: -1,
  },
  trackContainer: {
    height: 50,
    justifyContent: 'center',
    position: 'relative',
  },
  track: {
    height: 6,
    backgroundColor: Colors.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  trackFill: {
    height: '100%',
    backgroundColor: Colors.primaryLight,
    borderRadius: 3,
  },
  thumb: {
    position: 'absolute',
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    top: (50 - THUMB_SIZE) / 2,
  },
  thumbInner: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: Colors.primaryLight,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.4,
        shadowRadius: 6,
      },
      android: { elevation: 4 },
    }),
    borderWidth: 3,
    borderColor: 'rgba(5,150,105,0.3)',
  },
  labelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  labelText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  labelCenter: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textDim,
  },
});
