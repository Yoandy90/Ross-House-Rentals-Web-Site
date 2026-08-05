/**
 * Mi Reembolso - Payment Screen
 * Process payment for tax preparation service
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  Alert,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../../services/api';
import { useTranslation } from 'react-i18next';

export default function PaymentScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [sessionData, setSessionData] = useState<any>(null);

  useEffect(() => {
    loadSession();
  }, []);

  const loadSession = async () => {
    try {
      const response = await api.get(`/tax-wizard/session/${sessionId}`);
      if (response.data) {
        setSessionData(response.data);
      }
    } catch (error) {
      console.error('Error loading session:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async () => {
    setProcessing(true);
    try {
      // Create Stripe payment intent
      const response = await api.post(`/tax-wizard/session/${sessionId}/payment/create-intent`);
      
      if (response.data.success && response.data.checkout_url) {
        // Open Stripe Checkout in browser
        await Linking.openURL(response.data.checkout_url);
        
        // Navigate to success screen
        setTimeout(() => {
          router.replace({
            pathname: '/tax-wizard/success',
            params: { sessionId }
          });
        }, 1000);
      } else {
        Alert.alert(t('common.error'), t('wizard.payment.couldNotProcess'));
      }
    } catch (error: any) {
      console.error('Error processing payment:', error);
      Alert.alert('Error', error.response?.data?.detail || 'Error al procesar el pago');
    } finally {
      setProcessing(false);
    }
  };

  const handlePayLater = () => {
    Alert.alert(
      t('wizard.payment.payLater'),
      '¿Deseas completar el pago más tarde? Tu declaración quedará guardada.',
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('wizard.payment.yesPayLater'),
          onPress: () => {
            router.replace('/(tabs)');
          }
        }
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#065F46" />
        <ActivityIndicator size="large" color="#10B981" />
        <Text style={styles.loadingText}>Cargando...</Text>
      </View>
    );
  }

  const planType = sessionData?.selected_plan || 'assisted';
  const planPrice = sessionData?.plan_price || (planType === 'diy' ? 49 : 149);
  const planName = planType === 'diy' ? 'DIY Express' : 'Asistido Premium';
  const refundEstimate = sessionData?.refund_estimate?.estimated_refund || 0;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#065F46" />
      
      {/* Header */}
      <LinearGradient colors={['#065F46', '#10B981']} style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Completar Pago</Text>
        <Text style={styles.headerSubtitle}>Un paso más para enviar tu declaración</Text>
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Order Summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Resumen de tu Orden</Text>
          
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Ionicons name="document-text" size={24} color="#10B981" />
              <View style={styles.summaryItemText}>
                <Text style={styles.itemName}>{planName}</Text>
                <Text style={styles.itemDescription}>Declaración de impuestos 2025</Text>
              </View>
            </View>
            <Text style={styles.itemPrice}>${planPrice}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total a pagar</Text>
            <Text style={styles.totalAmount}>${planPrice}</Text>
          </View>
        </View>

        {/* Refund Preview */}
        {refundEstimate > 0 && (
          <View style={styles.refundCard}>
            <Ionicons name="cash" size={28} color="#F59E0B" />
            <View style={styles.refundContent}>
              <Text style={styles.refundLabel}>Tu reembolso estimado</Text>
              <Text style={styles.refundAmount}>${refundEstimate.toLocaleString()}</Text>
              <Text style={styles.refundNote}>
                Después del pago de ${planPrice}, recibirás aproximadamente{' '}
                <Text style={styles.refundHighlight}>${(refundEstimate - planPrice).toLocaleString()}</Text>
              </Text>
            </View>
          </View>
        )}

        {/* What's Included */}
        <View style={styles.includedCard}>
          <Text style={styles.includedTitle}>Incluido en tu plan:</Text>
          <View style={styles.includedList}>
            {planType === 'diy' ? (
              <>
                <IncludedItem text="Cálculos automáticos precisos" />
                <IncludedItem text="Transmisión directa al IRS" />
                <IncludedItem text="Seguimiento de reembolso" />
                <IncludedItem text="Soporte por chat" />
              </>
            ) : (
              <>
                <IncludedItem text="Revisión por preparador certificado" />
                <IncludedItem text="Llamada de 30 minutos" />
                <IncludedItem text="Maximización de deducciones" />
                <IncludedItem text="Representación ante el IRS" />
              </>
            )}
          </View>
        </View>

        {/* Payment Methods */}
        <View style={styles.paymentMethodsCard}>
          <Text style={styles.paymentMethodsTitle}>Métodos de pago aceptados</Text>
          <View style={styles.paymentIcons}>
            <View style={styles.paymentIcon}>
              <Ionicons name="card" size={24} color="#1E40AF" />
              <Text style={styles.paymentIconText}>Tarjeta</Text>
            </View>
            <View style={styles.paymentIcon}>
              <Ionicons name="logo-apple" size={24} color="#000" />
              <Text style={styles.paymentIconText}>Apple Pay</Text>
            </View>
            <View style={styles.paymentIcon}>
              <Ionicons name="logo-google" size={24} color="#EA4335" />
              <Text style={styles.paymentIconText}>Google Pay</Text>
            </View>
          </View>
        </View>

        {/* Pay Button */}
        <TouchableOpacity
          style={[styles.payButton, processing && styles.buttonDisabled]}
          onPress={handlePayment}
          disabled={processing}
        >
          {processing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="lock-closed" size={20} color="#fff" />
              <Text style={styles.payButtonText}>Pagar ${planPrice} ahora</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Pay Later */}
        <TouchableOpacity style={styles.payLaterButton} onPress={handlePayLater}>
          <Text style={styles.payLaterText}>Pagar después</Text>
        </TouchableOpacity>

        {/* Security Note */}
        <View style={styles.securityNote}>
          <Ionicons name="shield-checkmark" size={16} color="#6B7280" />
          <Text style={styles.securityText}>
            Pago seguro procesado por Stripe. Tu información está protegida.
          </Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const IncludedItem = ({ text }: { text: string }) => (
  <View style={styles.includedItem}>
    <Ionicons name="checkmark-circle" size={18} color="#10B981" />
    <Text style={styles.includedItemText}>{text}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
  },
  header: {
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  backBtn: {
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#D1FAE5',
    marginTop: 4,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  summaryItemText: {
    marginLeft: 12,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  itemDescription: {
    fontSize: 13,
    color: '#6B7280',
  },
  itemPrice: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 16,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  totalAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#10B981',
  },
  refundCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFBEB',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  refundContent: {
    marginLeft: 12,
    flex: 1,
  },
  refundLabel: {
    fontSize: 12,
    color: '#92400E',
  },
  refundAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#D97706',
  },
  refundNote: {
    fontSize: 12,
    color: '#92400E',
    marginTop: 4,
  },
  refundHighlight: {
    fontWeight: '600',
  },
  includedCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  includedTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  includedList: {},
  includedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  includedItemText: {
    fontSize: 14,
    color: '#374151',
    marginLeft: 10,
  },
  paymentMethodsCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  paymentMethodsTitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 12,
    textAlign: 'center',
  },
  paymentIcons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
  },
  paymentIcon: {
    alignItems: 'center',
  },
  paymentIconText: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 4,
  },
  payButton: {
    flexDirection: 'row',
    backgroundColor: '#10B981',
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  payButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
  },
  payLaterButton: {
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  payLaterText: {
    fontSize: 16,
    color: '#6B7280',
  },
  securityNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  securityText: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 6,
    textAlign: 'center',
  },
});
