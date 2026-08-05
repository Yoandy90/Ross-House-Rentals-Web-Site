import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Alert,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useThemeColors } from '../constants/colors';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import api from '../services/api';

// Initialize Stripe
let stripePromise: any = null;

const getStripe = (publishableKey: string) => {
  if (!stripePromise && publishableKey) {
    stripePromise = loadStripe(publishableKey);
  }
  return stripePromise;
};

interface NativePaymentModalProps {
  visible: boolean;
  amount: number;
  onClose: () => void;
  onSuccess: () => void;
  stripePublishableKey: string;
}

// Card Form Component (inside Elements provider)
const CardPaymentForm: React.FC<{
  amount: number;
  onClose: () => void;
  onSuccess: () => void;
}> = ({ amount, onClose, onSuccess }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [cardholderName, setCardholderName] = useState('');

  const handlePayment = async () => {
    if (!stripe || !elements) {
      Alert.alert('Error', 'Stripe no está listo. Intenta nuevamente.');
      return;
    }

    const cardElement = elements.getElement(CardElement);
    if (!cardElement) {
      Alert.alert('Error', 'No se encontró el formulario de tarjeta');
      return;
    }

    try {
      setLoading(true);
      console.log('💳 Creating payment intent for amount:', amount);

      // Step 1: Create Payment Intent
      const response = await api.post('/credits/create-payment-intent', {
        package_id: 'custom',
        custom_amount: amount,
      });

      console.log('✅ Payment intent created:', response.data);

      const { client_secret, payment_intent_id, credits } = response.data;

      // Step 2: Confirm payment with Stripe
      console.log('🔐 Confirming payment with Stripe...');
      const { error: confirmError, paymentIntent } = await stripe.confirmCardPayment(
        client_secret,
        {
          payment_method: {
            card: cardElement,
            billing_details: {
              name: cardholderName || 'Cliente',
            },
          },
        }
      );

      if (confirmError) {
        console.error('❌ Payment confirmation error:', confirmError);
        Alert.alert('Error de Pago', confirmError.message || 'No se pudo procesar el pago');
        setLoading(false);
        return;
      }

      console.log('✅ Payment confirmed:', paymentIntent);

      // Step 3: Confirm with backend and allocate credits
      if (paymentIntent.status === 'succeeded') {
        console.log('🎉 Payment succeeded! Allocating credits...');
        
        try {
          const confirmResponse = await api.post(
            `/credits/confirm-payment?payment_intent_id=${paymentIntent.id}`
          );
          
          console.log('✅ Credits allocated:', confirmResponse.data);
          
          Alert.alert(
            'Pago Exitoso',
            `Se han agregado ${confirmResponse.data.credits_added} créditos a tu cuenta. Nuevo balance: ${confirmResponse.data.new_balance} créditos`,
            [
              {
                text: 'OK',
                onPress: () => {
                  onSuccess();
                  onClose();
                },
              },
            ]
          );
        } catch (confirmError: any) {
          console.error('❌ Credit allocation error:', confirmError);
          Alert.alert(
            'Pago Procesado',
            'Tu pago fue procesado pero hubo un error al acreditar los créditos. Contacta soporte.',
            [
              {
                text: 'OK',
                onPress: () => {
                  onSuccess();
                  onClose();
                },
              },
            ]
          );
        }
      } else {
        Alert.alert('Pago Pendiente', 'El pago está siendo procesado');
        setLoading(false);
      }
    } catch (error: any) {
      console.error('❌ Payment error:', error);
      const errorMessage = error.response?.data?.detail || error.message || 'Error al procesar el pago';
      Alert.alert('Error', errorMessage);
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.formContainer} showsVerticalScrollIndicator={false}>
      {/* Amount Display */}
      <View style={styles.amountCard}>
        <Text style={styles.amountLabel}>Total a pagar</Text>
        <Text style={styles.amountValue}>${amount.toFixed(2)} USD</Text>
        <Text style={styles.amountSubtext}>{amount} créditos</Text>
      </View>

      {/* Card Element - Stripe's secure form */}
      <View style={styles.cardElementContainer}>
        <Text style={styles.fieldLabel}>Información de Tarjeta</Text>
        <View style={styles.cardElementWrapper}>
          <CardElement
            options={{
              style: {
                base: {
                  fontSize: '16px',
                  color: colors.text,
                  '::placeholder': {
                    color: colors.textGray,
                  },
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                  fontSmoothing: 'antialiased',
                },
                invalid: {
                  color: colors.error,
                },
              },
              hidePostalCode: false,
            }}
          />
        </View>
      </View>

      {/* Security Info */}
      <View style={styles.securityInfo}>
        <Ionicons name="shield-checkmark" size={20} color={colors.accent} />
        <View style={styles.securityTextContainer}>
          <Text style={styles.securityText}>
            Tu información está protegida con encriptación SSL de 256 bits
          </Text>
        </View>
      </View>

      {/* Payment Button */}
      <TouchableOpacity
        style={[styles.payButton, loading && styles.buttonDisabled]}
        onPress={handlePayment}
        disabled={loading || !stripe}
      >
        <LinearGradient
          colors={[colors.primary, colors.secondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.payButtonGradient}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <>
              <Ionicons name="lock-closed" size={20} color="#FFF" />
              <Text style={styles.payButtonText}>Pagar ${amount.toFixed(2)}</Text>
            </>
          )}
        </LinearGradient>
      </TouchableOpacity>

      {/* Powered by Stripe */}
      <View style={styles.poweredBy}>
        <Text style={styles.poweredByText}>Powered by</Text>
        <Text style={styles.stripeLogo}>Stripe</Text>
      </View>
    </ScrollView>
  );
};

// Main Modal Component
export const NativePaymentModal: React.FC<NativePaymentModalProps> = ({
  visible,
  amount,
  onClose,
  onSuccess,
  stripePublishableKey,
}) => {
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  console.log('🎯 NativePaymentModal rendered:', { visible, amount, hasKey: !!stripePublishableKey, key: stripePublishableKey?.substring(0, 20) });
  
  if (Platform.OS !== 'web') {
    console.log('❌ Platform is not web:', Platform.OS);
    return null; // Only works on web for now
  }

  if (!stripePublishableKey || stripePublishableKey === '') {
    console.log('⚠️ No Stripe key available yet');
    // Show modal with loading state while key loads
    return (
      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={onClose}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.header}>
              <Text style={styles.headerTitle}>Agregar Créditos</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close" size={28} color={colors.text} />
              </TouchableOpacity>
            </View>
            <View style={styles.errorContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.errorText}>Cargando procesador de pagos...</Text>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  const stripePromise = getStripe(stripePublishableKey);
  console.log('✅ Stripe initialized');

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
      >
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Agregar Créditos</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={28} color={colors.text} />
            </TouchableOpacity>
          </View>

          {/* Form */}
          {stripePublishableKey ? (
            <Elements stripe={stripePromise}>
              <CardPaymentForm amount={amount} onClose={onClose} onSuccess={onSuccess} />
            </Elements>
          ) : (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={48} color={colors.error} />
              <Text style={styles.errorText}>
                No se pudo cargar el formulario de pago. Intenta nuevamente.
              </Text>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const createStyles = (colors: any) => StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: colors.background,
    borderRadius: 20,
    width: '100%',
    maxWidth: 500,
    maxHeight: '90%',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
  },
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
    backgroundColor: colors.backgroundGray,
  },
  formContainer: {
    padding: 24,
  },
  amountCard: {
    backgroundColor: colors.accent + '10',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 2,
    borderColor: colors.accent + '30',
  },
  amountLabel: {
    fontSize: 14,
    color: colors.textGray,
    marginBottom: 8,
  },
  amountValue: {
    fontSize: 36,
    fontWeight: '800',
    color: colors.primary,
    marginBottom: 4,
  },
  amountSubtext: {
    fontSize: 14,
    color: colors.textGray,
  },
  cardElementContainer: {
    marginBottom: 24,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  cardElementWrapper: {
    backgroundColor: colors.backgroundGray,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  securityInfo: {
    flexDirection: 'row',
    backgroundColor: colors.accent + '10',
    padding: 12,
    borderRadius: 12,
    marginBottom: 24,
    gap: 10,
  },
  securityTextContainer: {
    flex: 1,
  },
  securityText: {
    fontSize: 12,
    color: colors.text,
    lineHeight: 18,
  },
  payButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  payButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 10,
  },
  payButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
  },
  poweredBy: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingBottom: 8,
  },
  poweredByText: {
    fontSize: 12,
    color: colors.textGray,
  },
  stripeLogo: {
    fontSize: 14,
    fontWeight: '700',
    color: '#635BFF',
  },
  errorContainer: {
    padding: 40,
    alignItems: 'center',
    gap: 16,
  },
  errorText: {
    fontSize: 14,
    color: colors.textGray,
    textAlign: 'center',
  },
});
