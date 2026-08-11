import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

// Conditional imports for native-only Stripe
let CardField: any = null;
let useConfirmSetupIntent: any = null;

if (Platform.OS !== 'web') {
  try {
    const stripeModule = require('@stripe/stripe-react-native');
    CardField = stripeModule.CardField;
    useConfirmSetupIntent = stripeModule.useConfirmSetupIntent;
  } catch (e) {
    console.log('Stripe native module not available');
  }
}

interface Props {
  clientSecret: string;
  onSuccess: () => void;
  onCancel: () => void;
}

// Web fallback component
function WebFallback({ onCancel }: { onCancel: () => void }) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Agregar Tarjeta</Text>
        <TouchableOpacity onPress={onCancel}>
          <Ionicons name="close-circle" size={24} color="rgba(255,255,255,0.4)" />
        </TouchableOpacity>
      </View>
      <View style={styles.webMessage}>
        <Ionicons name="phone-portrait-outline" size={32} color="rgba(255,255,255,0.3)" />
        <Text style={styles.webText}>
          Para agregar una tarjeta, usa la app en tu iPhone o Android.
        </Text>
      </View>
    </View>
  );
}

export default function StripeCardInput({ clientSecret, onSuccess, onCancel }: Props) {
  // On web or if Stripe not available, show fallback
  if (Platform.OS === 'web' || !CardField || !useConfirmSetupIntent) {
    return <WebFallback onCancel={onCancel} />;
  }

  return <NativeStripeCardInput clientSecret={clientSecret} onSuccess={onSuccess} onCancel={onCancel} />;
}

// Native implementation (only rendered on iOS/Android)
function NativeStripeCardInput({ clientSecret, onSuccess, onCancel }: Props) {
  const { confirmSetupIntent } = useConfirmSetupIntent();
  const [cardComplete, setCardComplete] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const handleConfirm = async () => {
    if (!clientSecret) return;
    setSaving(true);
    try {
      const { setupIntent, error } = await confirmSetupIntent(clientSecret, {
        paymentMethodType: 'Card',
      });
      if (error) {
        const { Alert } = require('react-native');
        Alert.alert('Error', error.message || 'No se pudo confirmar la tarjeta.');
      } else if (setupIntent) {
        onSuccess();
      }
    } catch (err: any) {
      const { Alert } = require('react-native');
      Alert.alert('Error', err.message || 'Error al procesar la tarjeta.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Ingresa los datos de tu tarjeta</Text>
        <TouchableOpacity onPress={onCancel}>
          <Ionicons name="close-circle" size={24} color="rgba(255,255,255,0.4)" />
        </TouchableOpacity>
      </View>

      <CardField
        postalCodeEnabled={false}
        placeholder={{ number: '4242 4242 4242 4242' }}
        cardStyle={{
          backgroundColor: '#1a1a2e',
          textColor: '#FFFFFF',
          borderColor: 'rgba(200,16,46,0.3)',
          borderWidth: 1,
          borderRadius: 12,
          fontSize: 16,
          placeholderColor: '#555',
          cursorColor: '#C8102E',
        }}
        style={styles.cardField}
        onCardChange={(details: any) => {
          setCardComplete(details.complete);
        }}
      />

      <View style={styles.actions}>
        <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
          <Text style={styles.cancelText}>Cancelar</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.confirmBtn, !cardComplete && { opacity: 0.4 }]}
          onPress={handleConfirm}
          disabled={!cardComplete || saving}
          activeOpacity={0.7}
        >
          <LinearGradient
            colors={['#C8102E', '#9B1B30']}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="checkmark" size={18} color="#fff" />
              <Text style={styles.confirmText}>Agregar Tarjeta</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.secureRow}>
        <Ionicons name="lock-closed" size={12} color="rgba(255,255,255,0.2)" />
        <Text style={styles.secureText}>Protegido por Stripe · Cifrado 256-bit</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(200,16,46,0.15)',
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: { fontSize: 15, fontWeight: '700', color: '#fff' },
  cardField: { width: '100%', height: 50, marginVertical: 8 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 12 },
  cancelBtn: {
    flex: 1, height: 48, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  cancelText: { color: 'rgba(255,255,255,0.5)', fontWeight: '600', fontSize: 15 },
  confirmBtn: {
    flex: 2, height: 48, borderRadius: 14,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    gap: 8, overflow: 'hidden',
  },
  confirmText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  secureRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, marginTop: 12,
  },
  secureText: { fontSize: 10, color: 'rgba(255,255,255,0.2)', fontWeight: '500' },
  webMessage: {
    alignItems: 'center',
    padding: 16,
  },
  webText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 20,
  },
});
