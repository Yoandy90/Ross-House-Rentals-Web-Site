/**
 * Payment Invoice Screen
 * Invoice payments use Stripe (allowed by Apple for physical services)
 * Web uses redirect to Stripe Checkout, Native uses Payment Sheet
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import api from '../services/api';
import { useTranslation } from 'react-i18next';

export default function PaymentInvoiceScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const params = useLocalSearchParams();
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [invoiceValid, setInvoiceValid] = useState(true);
  const [invoiceData, setInvoiceData] = useState<any>(null);
  
  const invoiceId = params.invoiceId as string;
  const invoiceNumber = params.invoiceNumber as string || 'N/A';
  const amount = parseFloat(params.amount as string) || 0;

  // Verify invoice exists on mount
  useEffect(() => {
    verifyInvoice();
  }, [invoiceId]);

  const verifyInvoice = async () => {
    // Skip verification for test IDs
    if (!invoiceId || invoiceId.includes('TEST')) {
      setInvoiceValid(false);
      setVerifying(false);
      return;
    }

    try {
      const response = await api.get(`/invoices/${invoiceId}`);
      if (response.data) {
        setInvoiceData(response.data);
        setInvoiceValid(true);
      } else {
        setInvoiceValid(false);
      }
    } catch (error) {
      setInvoiceValid(false);
    } finally {
      setVerifying(false);
    }
  };

  const handlePayment = async () => {
    setLoading(true);
    
    try {
      // Create checkout session and redirect to Stripe
      const response = await api.post('/invoices/' + invoiceId + '/create-checkout-session');
      
      if (response.data.checkout_url) {
        const canOpen = await Linking.canOpenURL(response.data.checkout_url);
        if (canOpen) {
          await Linking.openURL(response.data.checkout_url);
          // Show success message
          Alert.alert(
            '¡Pago Iniciado!',
            'Completa el pago en la página de Stripe. Recibirás una confirmación cuando se procese.',
            [{ text: 'OK', onPress: () => router.back() }]
          );
        } else {
          Alert.alert('Error', 'No se puede abrir el enlace de pago');
        }
      } else {
        Alert.alert('Error', 'No se recibió el enlace de pago');
      }
    } catch (error: any) {
      console.error('Payment error:', error);
      Alert.alert(
        'Error de Pago',
        error.response?.data?.detail || error.message || 'No se pudo procesar el pago.',
        [
          { text: 'Reintentar', onPress: () => handlePayment() },
          { text: 'Contactar Soporte', onPress: () => router.push('/(tabs)/support') },
          { text: 'Cancelar', style: 'cancel' },
        ]
      );
    } finally {
      setLoading(false);
    }
  };

  // Show loading while verifying
  if (verifying) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#10B981" />
        <Text style={{ marginTop: 16, color: '#666' }}>Verificando factura...</Text>
      </View>
    );
  }

  // Show error if invoice not found
  if (!invoiceValid) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={['#EF4444', '#DC2626']} style={styles.header}>
          <SafeAreaView edges={['top']}>
            <View style={styles.headerContent}>
              <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                <Ionicons name="arrow-back" size={24} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Factura No Encontrada</Text>
              <View style={{ width: 40 }} />
            </View>
          </SafeAreaView>
        </LinearGradient>

        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <View style={{ 
            width: 80, height: 80, borderRadius: 40, 
            backgroundColor: '#FEE2E2', justifyContent: 'center', alignItems: 'center',
            marginBottom: 24 
          }}>
            <Ionicons name="document-outline" size={40} color="#EF4444" />
          </View>
          <Text style={{ fontSize: 20, fontWeight: '700', color: '#1F2937', marginBottom: 8 }}>
            Factura no disponible
          </Text>
          <Text style={{ fontSize: 15, color: '#6B7280', textAlign: 'center', marginBottom: 24 }}>
            Esta factura ya no existe o el enlace ha expirado. Por favor ve a la sección de facturas para ver tus pagos pendientes.
          </Text>
          <TouchableOpacity
            onPress={() => router.replace('/(tabs)/invoices')}
            style={{
              backgroundColor: '#10B981',
              paddingHorizontal: 24,
              paddingVertical: 14,
              borderRadius: 12,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Ionicons name="receipt-outline" size={20} color="#FFF" />
            <Text style={{ color: '#FFF', fontWeight: '600', fontSize: 16 }}>Ver Mis Facturas</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient colors={['#6C1110', '#8B1A19']} style={styles.header}>
        <SafeAreaView edges={['top']}>
          <View style={styles.headerContent}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Pagar Factura</Text>
            <View style={{ width: 40 }} />
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Invoice Summary */}
        <View style={styles.summaryCard}>
          <View style={styles.invoiceHeader}>
            <Ionicons name="receipt" size={48} color="#6C1110" />
            <Text style={styles.invoiceNumber}>Factura #{invoiceNumber}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.amountSection}>
            <Text style={styles.amountLabel}>Total a Pagar</Text>
            <Text style={styles.amountValue}>${amount.toFixed(2)}</Text>
          </View>
        </View>

        {/* Payment Method Card */}
        <View style={styles.paymentMethodCard}>
          <View style={styles.paymentMethodHeader}>
            <Ionicons name="card" size={24} color="#3B82F6" />
            <Text style={styles.paymentMethodTitle}>Método de Pago</Text>
          </View>
          <Text style={styles.paymentMethodText}>
            Paga de forma segura con tu tarjeta de crédito o débito a través de Stripe.
          </Text>
          <View style={styles.securityBadge}>
            <Ionicons name="shield-checkmark" size={18} color="#10B981" />
            <Text style={styles.securityText}>Pago 100% seguro y encriptado</Text>
          </View>
        </View>

        {/* Cards Accepted */}
        <View style={styles.cardsSection}>
          <Text style={styles.cardsTitle}>Tarjetas Aceptadas</Text>
          <View style={styles.cardsRow}>
            {['VISA', 'MC', 'AMEX', 'DISC'].map((card) => (
              <View key={card} style={styles.cardBadge}>
                <Text style={styles.cardText}>{card}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Pay Button */}
        <TouchableOpacity 
          style={[styles.payButton, loading && styles.payButtonDisabled]} 
          onPress={handlePayment}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="lock-closed" size={20} color="#fff" />
              <Text style={styles.payButtonText}>Pagar ${amount.toFixed(2)}</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Alternative Payment Options */}
        <View style={styles.alternativeSection}>
          <Text style={styles.alternativeTitle}>¿Problemas con el pago?</Text>
          <TouchableOpacity 
            style={styles.alternativeButton}
            onPress={() => router.push('/(tabs)/support')}
          >
            <Ionicons name="chatbubbles-outline" size={20} color="#6C1110" />
            <Text style={styles.alternativeButtonText}>Contactar Soporte</Text>
          </TouchableOpacity>
        </View>

        {/* Cancel */}
        <TouchableOpacity style={styles.cancelButton} onPress={() => router.back()}>
          <Text style={styles.cancelButtonText}>Cancelar</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { paddingBottom: 16 },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  backButton: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#fff' },
  scrollView: { flex: 1 },
  content: { padding: 20 },
  summaryCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1, shadowRadius: 8, elevation: 4, marginBottom: 20,
  },
  invoiceHeader: { alignItems: 'center', marginBottom: 16 },
  invoiceNumber: { fontSize: 18, fontWeight: '600', color: '#374151', marginTop: 12 },
  divider: { height: 1, backgroundColor: '#E5E7EB', marginVertical: 16 },
  amountSection: { alignItems: 'center' },
  amountLabel: { fontSize: 14, color: '#6B7280', marginBottom: 8 },
  amountValue: { fontSize: 42, fontWeight: '700', color: '#6C1110' },
  paymentMethodCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  paymentMethodHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  paymentMethodTitle: { fontSize: 16, fontWeight: '600', color: '#374151' },
  paymentMethodText: { fontSize: 14, color: '#6B7280', lineHeight: 20, marginBottom: 16 },
  securityBadge: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#ECFDF5', paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 8, gap: 8,
  },
  securityText: { fontSize: 13, color: '#10B981', fontWeight: '500' },
  cardsSection: { marginBottom: 24 },
  cardsTitle: { fontSize: 14, color: '#6B7280', marginBottom: 12 },
  cardsRow: { flexDirection: 'row', gap: 12 },
  cardBadge: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#F3F4F6', borderRadius: 8 },
  cardText: { fontSize: 12, fontWeight: '700', color: '#374151' },
  payButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#10B981', paddingVertical: 18, borderRadius: 14, gap: 10,
    shadowColor: '#10B981', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  payButtonDisabled: {
    backgroundColor: '#9CA3AF',
    shadowOpacity: 0,
  },
  payButtonText: { fontSize: 18, fontWeight: '700', color: '#fff' },
  alternativeSection: {
    marginTop: 24, alignItems: 'center',
  },
  alternativeTitle: { fontSize: 14, color: '#6B7280', marginBottom: 12 },
  alternativeButton: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 20, paddingVertical: 12,
    backgroundColor: '#FEF2F2', borderRadius: 10,
  },
  alternativeButtonText: { fontSize: 14, color: '#6C1110', fontWeight: '500' },
  cancelButton: { alignItems: 'center', paddingVertical: 16, marginTop: 12 },
  cancelButtonText: { fontSize: 16, color: '#6B7280', fontWeight: '500' },
});
