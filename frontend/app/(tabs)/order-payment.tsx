/**
 * Order Payment Screen - Pay for existing service orders
 * Simple payment flow for orders with pending payment
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../../services/api';
import { useTranslation } from 'react-i18next';

interface PaymentMethod {
  id: string;
  card_brand: string;
  last_4: string;
  exp_month: number;
  exp_year: number;
  is_default: boolean;
  cardholder_name?: string;
}

export default function OrderPaymentScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  
  const orderId = params.orderId as string;
  const orderNumber = params.orderNumber as string;
  const serviceType = params.serviceType as string;
  const amount = parseFloat(params.amount as string) || 0;
  
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const [showAddCardModal, setShowAddCardModal] = useState(false);
  
  // Add card form
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [cardholderName, setCardholderName] = useState('');
  const [addingCard, setAddingCard] = useState(false);

  useEffect(() => {
    loadPaymentMethods();
  }, []);

  const loadPaymentMethods = async () => {
    try {
      const response = await api.get('/payment-methods');
      const methods = response.data.payment_methods || response.data || [];
      setPaymentMethods(methods);
      
      // Auto-select default card
      const defaultCard = methods.find((m: PaymentMethod) => m.is_default);
      if (defaultCard) {
        setSelectedMethod(defaultCard.id);
      } else if (methods.length > 0) {
        setSelectedMethod(methods[0].id);
      }
    } catch (error) {
      console.error('Error loading payment methods:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCardNumber = (value: string) => {
    const cleaned = value.replace(/\D/g, '');
    const formatted = cleaned.replace(/(\d{4})(?=\d)/g, '$1 ');
    return formatted.substring(0, 19);
  };

  const formatExpiry = (value: string) => {
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length >= 2) {
      return cleaned.substring(0, 2) + '/' + cleaned.substring(2, 4);
    }
    return cleaned;
  };

  const handleAddCard = async () => {
    if (cardNumber.replace(/\s/g, '').length < 15) {
      Alert.alert(t('common.error', 'Error'), t('orderPayment.invalidCard', 'Número de tarjeta inválido'));
      return;
    }
    if (expiry.length < 5) {
      Alert.alert(t('common.error', 'Error'), t('orderPayment.invalidExpiry', 'Fecha de expiración inválida'));
      return;
    }
    if (cvv.length < 3) {
      Alert.alert(t('common.error', 'Error'), t('orderPayment.invalidCVV', 'CVV inválido'));
      return;
    }

    setAddingCard(true);
    try {
      const [expMonth, expYear] = expiry.split('/');
      await api.post('/payment-methods', {
        card_number: cardNumber.replace(/\s/g, ''),
        exp_month: parseInt(expMonth),
        exp_year: parseInt('20' + expYear),
        cvv: cvv,
        cardholder_name: cardholderName,
      });
      
      Alert.alert(t('orderPayment.success', 'Éxito'), t('orderPayment.cardAdded', 'Tarjeta agregada correctamente'));
      setShowAddCardModal(false);
      setCardNumber('');
      setExpiry('');
      setCvv('');
      setCardholderName('');
      loadPaymentMethods();
    } catch (error: any) {
      const detail = error.response?.data?.detail;
      const errorMsg = typeof detail === 'string' ? detail : 
        Array.isArray(detail) ? detail.map((d: any) => d.msg || d.message || JSON.stringify(d)).join(', ') :
        'No se pudo agregar la tarjeta';
      Alert.alert('Error', errorMsg);
    } finally {
      setAddingCard(false);
    }
  };

  const handlePayment = async () => {
    if (!selectedMethod) {
      Alert.alert(t('common.error', 'Error'), t('orderPayment.selectMethod', 'Por favor selecciona un método de pago'));
      return;
    }

    setProcessing(true);
    try {
      // Process payment
      await api.post(`/service-orders/${orderId}/pay`, {
        payment_method_id: selectedMethod,
        amount: amount,
      });
      
      Alert.alert(
        '✅ Pago Exitoso',
        `Tu pago de $${amount.toFixed(2)} ha sido procesado correctamente.`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error: any) {
      console.error('Payment error:', error);
      Alert.alert(t('common.error', 'Error'), error.response?.data?.detail || t('orderPayment.paymentError', 'No se pudo procesar el pago'));
    } finally {
      setProcessing(false);
    }
  };

  const getCardIcon = (brand: string) => {
    switch (brand?.toLowerCase()) {
      case 'visa': return '💳';
      case 'mastercard': return '💳';
      case 'amex': case 'american express': return '💳';
      default: return '💳';
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <LinearGradient colors={['#10B981', '#059669']} style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FFF" />
          <Text style={styles.loadingText}>Cargando métodos de pago...</Text>
        </LinearGradient>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient colors={['#10B981', '#059669']} style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>Pagar Orden</Text>
            <Text style={styles.headerSubtitle}>{orderNumber}</Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Order Summary */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <Ionicons name="receipt" size={24} color="#10B981" />
            <Text style={styles.summaryTitle}>Resumen de la Orden</Text>
          </View>
          
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{t('orderPayment.service', 'Servicio')}</Text>
            <Text style={styles.summaryValue}>{serviceType}</Text>
          </View>
          
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Número de Orden</Text>
            <Text style={styles.summaryValue}>{orderNumber}</Text>
          </View>
          
          <View style={styles.summaryDivider} />
          
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total a Pagar</Text>
            <Text style={styles.totalAmount}>${amount.toFixed(2)}</Text>
          </View>
        </View>

        {/* Payment Methods */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Método de Pago</Text>
          
          {paymentMethods.length === 0 ? (
            <View style={styles.emptyMethods}>
              <Ionicons name="card-outline" size={48} color="#D1D5DB" />
              <Text style={styles.emptyText}>{t('orderPayment.noCards', 'No tienes tarjetas guardadas')}</Text>
              <TouchableOpacity 
                style={styles.addCardButton}
                onPress={() => setShowAddCardModal(true)}
              >
                <LinearGradient colors={['#3B82F6', '#2563EB']} style={styles.addCardGradient}>
                  <Ionicons name="add" size={20} color="#FFF" />
                  <Text style={styles.addCardText}>Agregar Tarjeta</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {paymentMethods.map((method) => (
                <TouchableOpacity
                  key={method.id}
                  style={[
                    styles.methodCard,
                    selectedMethod === method.id && styles.methodCardSelected
                  ]}
                  onPress={() => setSelectedMethod(method.id)}
                >
                  <View style={styles.methodInfo}>
                    <Text style={styles.methodIcon}>{getCardIcon(method.card_brand)}</Text>
                    <View>
                      <Text style={styles.methodBrand}>
                        {method.card_brand} •••• {method.last_4}
                      </Text>
                      <Text style={styles.methodExpiry}>
                        Expira {method.exp_month}/{method.exp_year}
                      </Text>
                    </View>
                  </View>
                  <View style={[
                    styles.methodRadio,
                    selectedMethod === method.id && styles.methodRadioSelected
                  ]}>
                    {selectedMethod === method.id && (
                      <Ionicons name="checkmark" size={16} color="#FFF" />
                    )}
                  </View>
                </TouchableOpacity>
              ))}
              
              <TouchableOpacity 
                style={styles.addAnotherCard}
                onPress={() => setShowAddCardModal(true)}
              >
                <Ionicons name="add-circle-outline" size={20} color="#3B82F6" />
                <Text style={styles.addAnotherCardText}>{t('orderPayment.addAnother', 'Agregar otra tarjeta')}</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Pay Button */}
        <TouchableOpacity
          style={[styles.payButton, (!selectedMethod || processing) && styles.payButtonDisabled]}
          onPress={handlePayment}
          disabled={!selectedMethod || processing}
        >
          <LinearGradient 
            colors={selectedMethod ? ['#10B981', '#059669'] : ['#D1D5DB', '#9CA3AF']} 
            style={styles.payButtonGradient}
          >
            {processing ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <Ionicons name="lock-closed" size={20} color="#FFF" />
                <Text style={styles.payButtonText}>Pagar ${amount.toFixed(2)}</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>

        <View style={styles.securityNote}>
          <Ionicons name="shield-checkmark" size={16} color="#6B7280" />
          <Text style={styles.securityText}>{t('orderPayment.securePayment', 'Pago seguro y encriptado')}</Text>
        </View>
      </ScrollView>

      {/* Add Card Modal */}
      <Modal visible={showAddCardModal} animationType="slide" transparent>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalOverlay}
          >
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Agregar Tarjeta</Text>
                <TouchableOpacity onPress={() => setShowAddCardModal(false)}>
                  <Ionicons name="close" size={24} color="#374151" />
                </TouchableOpacity>
              </View>

              <ScrollView 
                style={styles.modalScrollView}
                contentContainerStyle={styles.modalBody}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Nombre del Titular</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Como aparece en la tarjeta"
                    value={cardholderName}
                    onChangeText={setCardholderName}
                    autoCapitalize="words"
                    placeholderTextColor="#9CA3AF"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Número de Tarjeta</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="1234 5678 9012 3456"
                    value={cardNumber}
                    onChangeText={(text) => setCardNumber(formatCardNumber(text))}
                    keyboardType="numeric"
                    maxLength={19}
                    placeholderTextColor="#9CA3AF"
                  />
                </View>

                <View style={styles.inputRow}>
                  <View style={[styles.inputGroup, { flex: 1, marginRight: 12 }]}>
                    <Text style={styles.inputLabel}>{t('orderPayment.expiration', 'Expiración')}</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="MM/YY"
                      value={expiry}
                      onChangeText={(text) => setExpiry(formatExpiry(text))}
                      keyboardType="numeric"
                      maxLength={5}
                      placeholderTextColor="#9CA3AF"
                    />
                  </View>
                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={styles.inputLabel}>CVV</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="123"
                      value={cvv}
                      onChangeText={setCvv}
                      keyboardType="numeric"
                      maxLength={4}
                      secureTextEntry
                      placeholderTextColor="#9CA3AF"
                    />
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.modalButton}
                  onPress={handleAddCard}
                  disabled={addingCard}
                >
                  <LinearGradient colors={['#3B82F6', '#2563EB']} style={styles.modalButtonGradient}>
                    {addingCard ? (
                      <ActivityIndicator color="#FFF" />
                    ) : (
                      <Text style={styles.modalButtonText}>Guardar Tarjeta</Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
                
                {/* Extra padding for keyboard */}
                <View style={{ height: 20 }} />
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 16, color: '#FFF' },

  // Header
  header: { paddingBottom: 20, paddingHorizontal: 16 },
  headerContent: { flexDirection: 'row', alignItems: 'center' },
  backButton: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  headerTextContainer: { marginLeft: 12 },
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#FFF' },
  headerSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: 2 },

  // Content
  content: { flex: 1 },
  contentContainer: { padding: 16 },

  // Summary Card
  summaryCard: { backgroundColor: '#FFF', borderRadius: 16, padding: 20, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  summaryHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 10 },
  summaryTitle: { fontSize: 18, fontWeight: '700', color: '#1F2937' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  summaryLabel: { fontSize: 14, color: '#6B7280' },
  summaryValue: { fontSize: 14, fontWeight: '600', color: '#1F2937' },
  summaryDivider: { height: 1, backgroundColor: '#E5E7EB', marginVertical: 16 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { fontSize: 16, fontWeight: '600', color: '#374151' },
  totalAmount: { fontSize: 28, fontWeight: '800', color: '#10B981' },

  // Section
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1F2937', marginBottom: 12 },

  // Empty Methods
  emptyMethods: { backgroundColor: '#FFF', borderRadius: 16, padding: 32, alignItems: 'center' },
  emptyText: { fontSize: 14, color: '#6B7280', marginTop: 12, marginBottom: 20 },
  addCardButton: { borderRadius: 12, overflow: 'hidden' },
  addCardGradient: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 14, gap: 8 },
  addCardText: { fontSize: 15, fontWeight: '600', color: '#FFF' },

  // Method Card
  methodCard: { backgroundColor: '#FFF', borderRadius: 12, padding: 16, marginBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 2, borderColor: '#E5E7EB' },
  methodCardSelected: { borderColor: '#10B981', backgroundColor: '#F0FDF4' },
  methodInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  methodIcon: { fontSize: 28 },
  methodBrand: { fontSize: 15, fontWeight: '600', color: '#1F2937' },
  methodExpiry: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  methodRadio: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#D1D5DB', justifyContent: 'center', alignItems: 'center' },
  methodRadioSelected: { backgroundColor: '#10B981', borderColor: '#10B981' },

  addAnotherCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, gap: 8 },
  addAnotherCardText: { fontSize: 14, fontWeight: '600', color: '#3B82F6' },

  // Pay Button
  payButton: { borderRadius: 14, overflow: 'hidden', marginTop: 20 },
  payButtonDisabled: { opacity: 0.7 },
  payButtonGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 18, gap: 10 },
  payButtonText: { fontSize: 18, fontWeight: '700', color: '#FFF' },

  securityNote: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 16, gap: 6 },
  securityText: { fontSize: 12, color: '#6B7280' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#1F2937' },
  modalScrollView: { flexGrow: 0 },
  modalBody: { padding: 20 },

  inputGroup: { marginBottom: 16 },
  inputLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8 },
  input: { backgroundColor: '#F3F4F6', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: '#1F2937' },
  inputRow: { flexDirection: 'row' },

  modalButton: { borderRadius: 12, overflow: 'hidden', marginTop: 8 },
  modalButtonGradient: { alignItems: 'center', paddingVertical: 16 },
  modalButtonText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
});
