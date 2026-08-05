import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { useThemeColors } from '../constants/colors';

interface CenterActionButtonProps {
  onPress: () => void;
}

export function CenterActionButton({ onPress }: CenterActionButtonProps) {
  return (
    <View style={styles.container} pointerEvents="box-none">
      <TouchableOpacity
        style={styles.button}
        onPress={onPress}
        activeOpacity={0.8}
      >
        <Text style={styles.icon}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 45, // Elevated much higher to protrude from tab bar
    left: '50%',
    marginLeft: -35, // Center the larger button
    zIndex: 10000,
    elevation: 10,
  },
  button: {
    width: 70, // Larger button
    height: 70,
    borderRadius: 35,
    backgroundColor: '#6C1110',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 15, // Higher elevation for better shadow
    borderWidth: 5, // Thicker border
    borderColor: '#FFFFFF',
  },
  icon: {
    fontSize: 40, // Larger icon
    fontWeight: '700',
    color: '#FFFFFF',
    lineHeight: 40,
  },
});
