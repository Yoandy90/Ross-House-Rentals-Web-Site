import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useThemeColors } from '../constants/colors';
import api from '../services/api';

// Conditional import - only for native platforms
let CardField: any, useStripe: any, StripeProvider: any;
if (Platform.OS !== 'web') {
  const stripe = require('@stripe/stripe-react-native');
  CardField = stripe.CardField;
  useStripe = stripe.useStripe;
  StripeProvider = stripe.StripeProvider;
}

interface NativePaymentModalProps {
  visible: boolean;
  amount: number;
  onClose: () => void;
  onSuccess: () => void;
  stripePublishableKey: string;
}

// Payment Form Component
const PaymentForm: React.FC<{
  amount: number;
  onClose: () => void;
  onSuccess: () => void;
}> = ({ amount, onClose, onSuccess }) => {
  const colors = useThemeColors();
  const [loading, setLoading] = useState(false);
  const [cardComplete, setCardComplete] = useState(false);
  
  // Only use Stripe hooks on native platforms
  const stripeHook = Platform.OS !== 'web' && useStripe ? useStripe() : null;
  const createPaymentMethod = stripeHook?.createPaymentMethod;

  const handlePayment = async () => {
    if (!cardComplete) {
      Alert.alert('Error', 'Por favor completa la información de tu tarjeta');
      return;
    }

    try {
      setLoading(true);

      // 1. Create payment method
      const { paymentMethod, error: pmError } = await createPaymentMethod({
        paymentMethodType: 'Card',
      });

      if (pmError) {
        Alert.alert('Error', pmError.message || 'Error al procesar la tarjeta');
        setLoading(false);
        return;
      }

      // 2. Send payment method to backend to create payment intent
      const response = await api.post('/credits/create-payment-intent', {
        amount: amount,
        payment_method_id: paymentMethod?.id,
      });

      if (response.data.success) {
        Alert.alert(
          '¡Pago Exitoso! 🎉',
          `Se han agregado ${amount} créditos a tu cuenta.`,
          [
            {
              text: 'Continuar',
              onPress: () => {
                onSuccess();
                onClose();
              },
            },
          ]
        );
      } else {
        throw new Error(response.data.message || 'Error al procesar el pago');
      }
    } catch (error: any) {
      console.error('Payment error:', error);
      const errorMessage = error.response?.data?.detail || error.message || 'Error al procesar el pago';
      Alert.alert('Error', errorMessage);
    } finally {
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

      {/* Card Field - Stripe Native */}
      <View style={styles.cardFieldContainer}>
        <Text style={styles.fieldLabel}>Información de Tarjeta</Text>
        {Platform.OS !== 'web' && CardField ? (
          <CardField
            postalCodeEnabled={true}
            placeholders={{
              number: '4242 4242 4242 4242',
            }}
            cardStyle={{
              backgroundColor: '#FFFFFF',
              textColor: colors.text,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 12,
            }}
            style={styles.cardField}
            onCardChange={(cardDetails) => {
              setCardComplete(cardDetails.complete);
            }}
          />
        ) : (
          <View style={[styles.cardField, styles.webFallback]}>
            <Text style={styles.webFallbackText}>
              Los pagos solo están disponibles en la app móvil de iOS/Android
            </Text>
          </View>
        )}
      </View>

      {/* Security Info */}
      <View style={styles.securityInfo}>
        <Ionicons name="shield-checkmark" size={16} color={colors.primary} />
        <Text style={styles.securityText}>
          Tu información está protegida con encriptación de nivel bancario
        </Text>
      </View>

      {/* Payment Button */}
      <TouchableOpacity
        style={[styles.payButton, !cardComplete && styles.payButtonDisabled]}
        onPress={handlePayment}
        disabled={loading || !cardComplete}
      >
        {loading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <>
            <Ionicons name="card" size={24} color="#FFFFFF" />
            <Text style={styles.payButtonText}>Pagar ${amount.toFixed(2)} USD</Text>
          </>
        )}
      </TouchableOpacity>

      {/* Cancel Button */}
      <TouchableOpacity style={styles.cancelButton} onPress={onClose} disabled={loading}>
        <Text style={styles.cancelButtonText}>Cancelar</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

// Main Modal Component
export default function NativePaymentModal({
  visible,
  amount,
  onClose,
  onSuccess,
  stripePublishableKey,
}: NativePaymentModalProps) {
  const colors = useThemeColors();
  const styles = createStyles(colors);

  return (
    <Modal visible={visible} animationType="slide" transparent={true}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalContainer}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Header */}
            <LinearGradient colors={[colors.primary, colors.primary + 'DD']} style={styles.header}>
              <View style={styles.headerContent}>
                <Ionicons name="wallet" size={32} color="#FFFFFF" />
                <View style={styles.headerTextContainer}>
                  <Text style={styles.headerTitle}>Agregar Créditos</Text>
                  <Text style={styles.headerSubtitle}>Pago seguro con Stripe</Text>
                </View>
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                  <Ionicons name="close" size={28} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </LinearGradient>

            {/* Stripe Provider with Payment Form */}
            {Platform.OS !== 'web' && StripeProvider ? (
              <StripeProvider publishableKey={stripePublishableKey}>
                <PaymentForm amount={amount} onClose={onClose} onSuccess={onSuccess} />
              </StripeProvider>
            ) : (
              <PaymentForm amount={amount} onClose={onClose} onSuccess={onSuccess} />
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    modalContainer: {
      flex: 1,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: colors.background,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      maxHeight: '90%',
      overflow: 'hidden',
    },
    header: {
      paddingTop: 24,
      paddingBottom: 20,
      paddingHorizontal: 20,
    },
    headerContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
    },
    headerTextContainer: {
      flex: 1,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: '#FFFFFF',
      marginBottom: 4,
    },
    headerSubtitle: {
      fontSize: 14,
      color: '#FFFFFF',
      opacity: 0.9,
    },
    closeButton: {
      padding: 4,
    },
    formContainer: {
      padding: 20,
    },
    amountCard: {
      backgroundColor: colors.primary + '10',
      borderRadius: 16,
      padding: 24,
      alignItems: 'center',
      marginBottom: 24,
      borderWidth: 2,
      borderColor: colors.primary + '30',
    },
    amountLabel: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 8,
    },
    amountValue: {
      fontSize: 36,
      fontWeight: '700',
      color: colors.primary,
      marginBottom: 4,
    },
    amountSubtext: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    cardFieldContainer: {
      marginBottom: 20,
    },
    fieldLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 12,
    },
    cardField: {
      width: '100%',
      height: 50,
      marginVertical: 8,
    },
    securityInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.backgroundGray,
      padding: 12,
      borderRadius: 8,
      marginBottom: 24,
    },
    securityText: {
      flex: 1,
      fontSize: 12,
      color: colors.textSecondary,
      lineHeight: 16,
    },
    payButton: {
      backgroundColor: colors.primary,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      padding: 18,
      borderRadius: 12,
      marginBottom: 12,
    },
    payButtonDisabled: {
      opacity: 0.5,
    },
    payButtonText: {
      fontSize: 16,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    cancelButton: {
      padding: 16,
      alignItems: 'center',
    },
    cancelButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    webFallback: {
      backgroundColor: colors.backgroundGray,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    webFallbackText: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
    },
  });
