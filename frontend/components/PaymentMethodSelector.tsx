import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../constants/colors';
import api from '../services/api';

interface ServicePrice {
  id: string;
  service_type: string;
  name: string;
  description: string;
  price_credits: number;
  is_active: boolean;
}

interface PaymentMethodSelectorProps {
  visible: boolean;
  onClose: () => void;
  servicePriceId: string; // ID del servicio (ej: 'tax_return_standard')
  serviceInstanceId: string; // ID de la instancia (ej: tax return ID)
  onPaymentSuccess: (result: any) => void;
  onPaymentError: (error: string) => void;
}

export default function PaymentMethodSelector({
  visible,
  onClose,
  servicePriceId,
  serviceInstanceId,
  onPaymentSuccess,
  onPaymentError,
}: PaymentMethodSelectorProps) {
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [balance, setBalance] = useState(0);
  const [servicePrice, setServicePrice] = useState<ServicePrice | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<'credits' | 'stripe' | null>(null);

  useEffect(() => {
    if (visible) {
      loadData();
    }
  }, [visible, servicePriceId]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load user balance
      const balanceRes = await api.get('/credits/balance');
      setBalance(balanceRes.data.balance || 0);

      // Load all service prices and find the one we need
      const pricesRes = await api.get('/credits/service-prices');
      const prices = pricesRes.data.service_prices || [];
      const price = prices.find((p: ServicePrice) => p.id === servicePriceId);
      
      if (price) {
        setServicePrice(price);
      } else {
        onPaymentError('Servicio no encontrado');
        onClose();
      }
    } catch (error) {
      console.error('Error loading payment data:', error);
      onPaymentError('Error al cargar información de pago');
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const handlePayWithCredits = () => {
    if (!servicePrice) return;

    if (balance < servicePrice.price_credits) {
      Alert.alert(
        'Saldo Insuficiente',
        `Necesitas ${servicePrice.price_credits} créditos pero solo tienes ${balance.toFixed(0)}. ¿Deseas comprar más créditos?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Comprar Créditos', onPress: () => {
            onClose();
            // TODO: Navigate to credits purchase screen
          }}
        ]
      );
      return;
    }

    Alert.alert(
      'Confirmar Pago',
      `¿Deseas pagar ${servicePrice.name} usando ${servicePrice.price_credits} créditos?\n\nTu nuevo balance será: ${(balance - servicePrice.price_credits).toFixed(0)} créditos`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Confirmar', 
          onPress: () => processPayment(),
          style: 'default'
        }
      ]
    );
  };

  const processPayment = async () => {
    if (!servicePrice) return;

    try {
      setProcessing(true);

      const response = await api.post('/credits/use-for-service', {
        service_price_id: servicePriceId,
        service_instance_id: serviceInstanceId,
        metadata: {
          payment_method: 'credits',
          timestamp: new Date().toISOString()
        }
      });

      Alert.alert(
        '¡Pago Exitoso!',
        `Has pagado ${servicePrice.name} con ${response.data.credits_used} créditos.\n\nNuevo balance: ${response.data.new_balance} créditos`,
        [
          {
            text: 'OK',
            onPress: () => {
              onPaymentSuccess(response.data);
              onClose();
            }
          }
        ]
      );
    } catch (error: any) {
      console.error('Error processing payment:', error);
      const errorMsg = error.response?.data?.detail || 'Error al procesar el pago';
      Alert.alert('Error', errorMsg);
      onPaymentError(errorMsg);
    } finally {
      setProcessing(false);
    }
  };

  const handlePayWithStripe = async () => {
    if (!servicePrice) return;

    try {
      setProcessing(true);
      Alert.alert('Redirigiendo a Stripe', 'Te redirigiremos a la pasarela de pago segura...');

      // Crear sesión de pago en Stripe
      const response = await api.post('/credits/create-service-payment-session', {
        service_price_id: servicePriceId,
        service_instance_id: serviceInstanceId,
        service_name: servicePrice?.name || 'Servicio Ross Tax',
        amount: servicePrice?.price_credits || 0, // Usaremos los créditos como precio en USD
      });

      if (response.data.session_url) {
        // Abrir la URL de Stripe en el navegador
        const { Linking } = require('react-native');
        await Linking.openURL(response.data.session_url);
        
        // Cerrar el modal
        onClose();
        
        // Mostrar mensaje informativo
        Alert.alert(
          'Pago Iniciado',
          'Completa el pago en tu navegador. Cuando termines, regresa a la app y recarga la pantalla.',
          [{ text: 'OK' }]
        );
      }
    } catch (error: any) {
      console.error('Error creating Stripe session:', error);
      const errorMsg = error.response?.data?.detail || 'Error al iniciar pago con Stripe';
      Alert.alert('Error', errorMsg);
      onPaymentError(errorMsg);
    } finally {
      setProcessing(false);
    }
  };

  const hasSufficientCredits = servicePrice ? balance >= servicePrice.price_credits : false;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Método de Pago</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>Cargando...</Text>
            </View>
          ) : (
            <>
              {/* Service Info */}
              {servicePrice && (
                <View style={styles.serviceInfo}>
                  <Ionicons name="document-text" size={32} color={colors.primary} />
                  <View style={styles.serviceDetails}>
                    <Text style={styles.serviceName}>{servicePrice.name}</Text>
                    <Text style={styles.serviceDescription}>{servicePrice.description}</Text>
                    <View style={styles.priceContainer}>
                      <Text style={styles.priceLabel}>Costo:</Text>
                      <Text style={styles.priceValue}>{servicePrice.price_credits} créditos</Text>
                    </View>
                  </View>
                </View>
              )}

              {/* Balance Info */}
              <View style={styles.balanceCard}>
                <View style={styles.balanceRow}>
                  <Ionicons name="wallet" size={24} color={colors.primary} />
                  <View style={styles.balanceInfo}>
                    <Text style={styles.balanceLabel}>Tu Balance</Text>
                    <Text style={styles.balanceAmount}>{balance.toFixed(0)} créditos</Text>
                  </View>
                  {hasSufficientCredits ? (
                    <Ionicons name="checkmark-circle" size={28} color={colors.success} />
                  ) : (
                    <Ionicons name="alert-circle" size={28} color={colors.error} />
                  )}
                </View>
                {!hasSufficientCredits && servicePrice && (
                  <Text style={styles.insufficientText}>
                    Necesitas {(servicePrice.price_credits - balance).toFixed(0)} créditos más
                  </Text>
                )}
              </View>

              {/* Payment Methods */}
              <Text style={styles.sectionTitle}>Selecciona método de pago:</Text>

              {/* Credits Payment */}
              <TouchableOpacity
                style={[
                  styles.paymentMethod,
                  selectedMethod === 'credits' && styles.paymentMethodSelected,
                  !hasSufficientCredits && styles.paymentMethodDisabled
                ]}
                onPress={() => setSelectedMethod('credits')}
                disabled={!hasSufficientCredits || processing}
              >
                <View style={styles.paymentMethodIcon}>
                  <Ionicons 
                    name="sparkles" 
                    size={28} 
                    color={hasSufficientCredits ? colors.primary : colors.textGray} 
                  />
                </View>
                <View style={styles.paymentMethodInfo}>
                  <Text style={[
                    styles.paymentMethodTitle,
                    !hasSufficientCredits && styles.paymentMethodTitleDisabled
                  ]}>
                    Pagar con Créditos
                  </Text>
                  <Text style={styles.paymentMethodDesc}>
                    {hasSufficientCredits 
                      ? 'Pago instantáneo con tu balance' 
                      : 'Saldo insuficiente'}
                  </Text>
                </View>
                {selectedMethod === 'credits' && (
                  <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
                )}
              </TouchableOpacity>

              {/* Stripe Payment */}
              <TouchableOpacity
                style={[
                  styles.paymentMethod,
                  selectedMethod === 'stripe' && styles.paymentMethodSelected,
                ]}
                onPress={() => setSelectedMethod('stripe')}
                disabled={processing}
              >
                <View style={styles.paymentMethodIcon}>
                  <Ionicons name="card" size={28} color={colors.primary} />
                </View>
                <View style={styles.paymentMethodInfo}>
                  <Text style={styles.paymentMethodTitle}>
                    Pagar con Tarjeta
                  </Text>
                  <Text style={styles.paymentMethodDesc}>Visa, Mastercard, American Express</Text>
                </View>
                {selectedMethod === 'stripe' && (
                  <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
                )}
              </TouchableOpacity>

              {/* Action Buttons */}
              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.button, styles.cancelButton]}
                  onPress={onClose}
                  disabled={processing}
                >
                  <Text style={styles.cancelButtonText}>Cancelar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.button,
                    styles.confirmButton,
                    (!selectedMethod || processing || (selectedMethod === 'credits' && !hasSufficientCredits)) && styles.confirmButtonDisabled
                  ]}
                  onPress={() => {
                    console.log('🔘 Pago seleccionado:', selectedMethod);
                    console.log('💰 Tiene créditos suficientes:', hasSufficientCredits);
                    console.log('✅ Botón debería estar:', (!selectedMethod || processing || (selectedMethod === 'credits' && !hasSufficientCredits)) ? 'DESHABILITADO' : 'HABILITADO');
                    
                    if (selectedMethod === 'credits') {
                      handlePayWithCredits();
                    } else {
                      handlePayWithStripe();
                    }
                  }}
                  disabled={!selectedMethod || processing || (selectedMethod === 'credits' && !hasSufficientCredits)}
                >
                  {processing ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <Text style={styles.confirmButtonText}>
                      {selectedMethod === 'credits' ? 'Confirmar Pago' : 'Pagar con Tarjeta'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
  },
  closeButton: {
    padding: 4,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: colors.textGray,
  },
  serviceInfo: {
    flexDirection: 'row',
    padding: 20,
    backgroundColor: colors.primary + '10',
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 12,
    gap: 12,
  },
  serviceDetails: {
    flex: 1,
  },
  serviceName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 4,
  },
  serviceDescription: {
    fontSize: 14,
    color: colors.textGray,
    marginBottom: 8,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  priceLabel: {
    fontSize: 14,
    color: colors.textGray,
  },
  priceValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.primary,
  },
  balanceCard: {
    backgroundColor: colors.background,
    marginHorizontal: 20,
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  balanceInfo: {
    flex: 1,
  },
  balanceLabel: {
    fontSize: 13,
    color: colors.textGray,
    marginBottom: 4,
  },
  balanceAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
  },
  insufficientText: {
    marginTop: 12,
    fontSize: 13,
    color: colors.error,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginHorizontal: 20,
    marginTop: 24,
    marginBottom: 12,
  },
  paymentMethod: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: '#FFF',
    gap: 12,
  },
  paymentMethodSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '10',
  },
  paymentMethodDisabled: {
    opacity: 0.5,
  },
  paymentMethodIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  paymentMethodInfo: {
    flex: 1,
  },
  paymentMethodTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  paymentMethodTitleDisabled: {
    color: colors.textGray,
  },
  paymentMethodDesc: {
    fontSize: 13,
    color: colors.textGray,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    marginTop: 24,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  confirmButton: {
    backgroundColor: colors.primary,
  },
  confirmButtonDisabled: {
    backgroundColor: colors.textGray,
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
});