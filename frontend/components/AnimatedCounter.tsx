import React, { useEffect, useRef, useState } from 'react';
import { Animated, Text, StyleSheet, View } from 'react-native';

interface AnimatedCounterProps {
  value: number;
  duration?: number;
  style?: any;
  prefix?: string;
  suffix?: string;
}

// Fixed to avoid iOS crash - removed addListener which causes race condition with Reanimated 3.17.x
export default function AnimatedCounter({ 
  value, 
  duration = 1000, 
  style,
  prefix = '',
  suffix = ''
}: AnimatedCounterProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const animatedValue = useRef(new Animated.Value(0)).current;
  const previousValue = useRef(0);

  useEffect(() => {
    // Animate from previous value to new value
    animatedValue.setValue(previousValue.current);
    
    Animated.timing(animatedValue, {
      toValue: value,
      duration: duration,
      useNativeDriver: false,
    }).start(() => {
      // Only update display after animation completes (safer than listener)
      setDisplayValue(value);
    });
    
    // Update previous value for next animation
    previousValue.current = value;
    
    // Also set initial display value immediately for first render
    if (displayValue === 0 && value > 0) {
      setDisplayValue(value);
    }
  }, [value, duration]);

  return (
    <View style={styles.container}>
      <Text style={[styles.text, style]}>
        {prefix}{displayValue}{suffix}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: 26,
    fontWeight: '800',
  },
});
