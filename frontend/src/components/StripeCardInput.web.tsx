import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  clientSecret: string;
  onSuccess: () => void;
  onCancel: () => void;
}

// Web: Stripe Card Input is not available - show message
export default function StripeCardInput({ clientSecret, onSuccess, onCancel }: Props) {
  return (
    <View style={styles.container}>
      <Ionicons name="phone-portrait-outline" size={32} color="rgba(255,255,255,0.3)" />
      <Text style={styles.text}>
        Para agregar una tarjeta, usa la app en tu iPhone o Android.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 24,
    alignItems: 'center',
  },
  text: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 20,
  },
});
