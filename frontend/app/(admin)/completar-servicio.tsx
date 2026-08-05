import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../../services/api';

interface TaxReturnEntry {
  id: string;
  tax_year: string;
  total_income: string;
  federal_refund: string;
  state_refund: string;
  notes: string;
}

interface AppointmentData {
  id: string;
  client_name: string;
  client_email: string;
  client_phone: string;
  service_name: string;
  scheduled_at: string;
  user_id?: string;
}

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = [
  String(CURRENT_YEAR),
  String(CURRENT_YEAR - 1),
  String(CURRENT_YEAR - 2),
  String(CURRENT_YEAR - 3),
  String(CURRENT_YEAR - 4),
];

const SERVICE_PRICES = [
  { label: '$180 - Declaración Individual', value: 180 },
  { label: '$250 - Declaración Matrimonio', value: 250 },
  { label: '$350 - Declaración + Negocio', value: 350 },
  { label: '$100 - Enmienda', value: 100 },
  { label: 'Personalizado', value: 0 },
];

export default function CompletarServicioScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const appointmentId = params.appointmentId as string;
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [appointment, setAppointment] = useState<AppointmentData | null>(null);
  
  // Tax returns state
  const [taxReturns, setTaxReturns] = useState<TaxReturnEntry[]>([
    {
      id: '1',
      tax_year: String(CURRENT_YEAR),
      total_income: '',
      federal_refund: '',
      state_refund: '',
      notes: '',
    }
  ]);
  
  // Invoice state
  const [createInvoice, setCreateInvoice] = useState(true);
  const [selectedPriceIndex, setSelectedPriceIndex] = useState(0);
  const [customPrice, setCustomPrice] = useState('');
  const [invoiceDescription, setInvoiceDescription] = useState('Preparación de declaración de impuestos');
  
  // Notification state
  const [sendNotifications, setSendNotifications] = useState(true);
  
  // Modal state
  const [showYearPicker, setShowYearPicker] = useState(false);
  const [editingTaxReturnId, setEditingTaxReturnId] = useState<string | null>(null);

  useEffect(() => {
    loadAppointment();
  }, [appointmentId]);

  const loadAppointment = async () => {
    if (!appointmentId) {
      Alert.alert('Error', 'ID de cita no proporcionado');
      router.back();
      return;
    }
    
    try {
      // Try to get appointment details
      const response = await api.get(`/admin/appointments/${appointmentId}`);
      if (response.data) {
        setAppointment({
          id: appointmentId,
          client_name: response.data.user_name || response.data.client_name || 'Cliente',
          client_email: response.data.user_email || response.data.client_email || '',
          client_phone: response.data.user_phone || response.data.client_phone || '',
          service_name: response.data.service_name || response.data.title || 'Consulta',
          scheduled_at: response.data.scheduled_at || '',
          user_id: response.data.user_id,
        });
      }
    } catch (error: any) {
      console.error('Error loading appointment:', error);
      // If appointment not found, create placeholder
      setAppointment({
        id: appointmentId,
        client_name: 'Cliente',
        client_email: '',
        client_phone: '',
        service_name: 'Consulta',
        scheduled_at: new Date().toISOString(),
      });
    } finally {
      setLoading(false);
    }
  };

  const addTaxReturn = () => {
    const usedYears = taxReturns.map(tr => tr.tax_year);
    const availableYear = YEARS.find(y => !usedYears.includes(y)) || String(CURRENT_YEAR - taxReturns.length);
    
    setTaxReturns([
      ...taxReturns,
      {
        id: String(Date.now()),
        tax_year: availableYear,
        total_income: '',
        federal_refund: '',
        state_refund: '',
        notes: '',
      }
    ]);
  };

  const removeTaxReturn = (id: string) => {
    if (taxReturns.length === 1) {
      Alert.alert('Error', 'Debe haber al menos una declaración');
      return;
    }
    setTaxReturns(taxReturns.filter(tr => tr.id !== id));
  };

  const updateTaxReturn = (id: string, field: keyof TaxReturnEntry, value: string) => {
    setTaxReturns(taxReturns.map(tr => 
      tr.id === id ? { ...tr, [field]: value } : tr
    ));
  };

  const selectYear = (year: string) => {
    if (editingTaxReturnId) {
      updateTaxReturn(editingTaxReturnId, 'tax_year', year);
    }
    setShowYearPicker(false);
    setEditingTaxReturnId(null);
  };

  const getInvoiceAmount = () => {
    const selected = SERVICE_PRICES[selectedPriceIndex];
    if (selected.value === 0) {
      return parseFloat(customPrice) || 0;
    }
    return selected.value;
  };

  const getTotalRefund = () => {
    return taxReturns.reduce((sum, tr) => {
      const federal = parseFloat(tr.federal_refund) || 0;
      const state = parseFloat(tr.state_refund) || 0;
      return sum + federal + state;
    }, 0);
  };

  const formatCurrency = (value: number) => {
    return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const handleSubmit = async () => {
    // Validate at least one tax return has refund info
    const hasValidReturn = taxReturns.some(tr => 
      parseFloat(tr.federal_refund) > 0 || parseFloat(tr.state_refund) > 0
    );
    
    if (!hasValidReturn) {
      Alert.alert('Error', 'Ingrese al menos un reembolso (federal o estatal)');
      return;
    }
    
    // Validate invoice amount if creating invoice
    if (createInvoice && getInvoiceAmount() <= 0) {
      Alert.alert('Error', 'Ingrese el monto de la factura');
      return;
    }
    
    setSubmitting(true);
    
    try {
      const payload = {
        tax_returns: taxReturns.map(tr => ({
          tax_year: tr.tax_year,
          total_income: parseFloat(tr.total_income) || null,
          federal_refund: parseFloat(tr.federal_refund) || 0,
          state_refund: parseFloat(tr.state_refund) || 0,
          notes: tr.notes || null,
        })),
        invoice: createInvoice ? {
          service_type: 'Declaración de Impuestos',
          amount: getInvoiceAmount(),
          description: invoiceDescription,
        } : null,
        send_notifications: sendNotifications,
      };
      
      const response = await api.post(`/admin/appointments/${appointmentId}/complete-service`, payload);
      
      if (response.data.success) {
        const results = response.data.results;
        let message = '✅ Servicio completado exitosamente\n\n';
        
        if (results.tax_returns_created?.length > 0) {
          message += `📋 ${results.tax_returns_created.length} declaración(es) creada(s)\n`;
          message += `💰 Total reembolso: ${formatCurrency(getTotalRefund())}\n`;
        }
        
        if (results.invoice_created) {
          message += `🧾 Factura: ${results.invoice_created.invoice_number}\n`;
          message += `   Monto: ${formatCurrency(results.invoice_created.amount)}\n`;
        }
        
        if (results.notifications_sent?.sms || results.notifications_sent?.email) {
          message += '\n📨 Notificaciones enviadas al cliente';
        }
        
        Alert.alert('¡Completado!', message, [
          { text: 'OK', onPress: () => router.back() }
        ]);
      } else {
        Alert.alert('Error', response.data.message || 'No se pudo completar el servicio');
      }
    } catch (error: any) {
      console.error('Error completing service:', error);
      Alert.alert('Error', error.response?.data?.detail || 'No se pudo completar el servicio');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6C1110" />
        <Text style={styles.loadingText}>Cargando información...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <LinearGradient colors={['#1a1a2e', '#16213e']} style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Completar Servicio</Text>
          <Text style={styles.headerSubtitle}>{appointment?.client_name}</Text>
        </View>
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Client Info Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="person-circle" size={24} color="#6C1110" />
            <Text style={styles.cardTitle}>Información del Cliente</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Nombre:</Text>
            <Text style={styles.infoValue}>{appointment?.client_name}</Text>
          </View>
          {appointment?.client_email && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Email:</Text>
              <Text style={styles.infoValue}>{appointment.client_email}</Text>
            </View>
          )}
          {appointment?.client_phone && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Teléfono:</Text>
              <Text style={styles.infoValue}>{appointment.client_phone}</Text>
            </View>
          )}
        </View>

        {/* Tax Returns Section */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="document-text" size={22} color="#6C1110" />
            <Text style={styles.sectionTitle}>Declaraciones de Impuestos</Text>
          </View>
          <TouchableOpacity style={styles.addButton} onPress={addTaxReturn}>
            <Ionicons name="add-circle" size={28} color="#10B981" />
          </TouchableOpacity>
        </View>

        {taxReturns.map((tr, index) => (
          <View key={tr.id} style={styles.taxReturnCard}>
            <View style={styles.taxReturnHeader}>
              <TouchableOpacity 
                style={styles.yearSelector}
                onPress={() => {
                  setEditingTaxReturnId(tr.id);
                  setShowYearPicker(true);
                }}
              >
                <Ionicons name="calendar" size={18} color="#6C1110" />
                <Text style={styles.yearText}>Año {tr.tax_year}</Text>
                <Ionicons name="chevron-down" size={16} color="#666" />
              </TouchableOpacity>
              
              {taxReturns.length > 1 && (
                <TouchableOpacity 
                  style={styles.removeButton}
                  onPress={() => removeTaxReturn(tr.id)}
                >
                  <Ionicons name="trash-outline" size={20} color="#EF4444" />
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Ingresos Totales (opcional)</Text>
              <View style={styles.currencyInput}>
                <Text style={styles.currencySymbol}>$</Text>
                <TextInput
                  style={styles.input}
                  value={tr.total_income}
                  onChangeText={(value) => updateTaxReturn(tr.id, 'total_income', value)}
                  placeholder="0.00"
                  placeholderTextColor="#999"
                  keyboardType="decimal-pad"
                />
              </View>
            </View>

            <View style={styles.refundRow}>
              <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.inputLabel}>Reembolso Federal</Text>
                <View style={[styles.currencyInput, styles.federalInput]}>
                  <Text style={styles.currencySymbol}>$</Text>
                  <TextInput
                    style={styles.input}
                    value={tr.federal_refund}
                    onChangeText={(value) => updateTaxReturn(tr.id, 'federal_refund', value)}
                    placeholder="0.00"
                    placeholderTextColor="#999"
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>
              
              <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                <Text style={styles.inputLabel}>Reembolso Estatal</Text>
                <View style={[styles.currencyInput, styles.stateInput]}>
                  <Text style={styles.currencySymbol}>$</Text>
                  <TextInput
                    style={styles.input}
                    value={tr.state_refund}
                    onChangeText={(value) => updateTaxReturn(tr.id, 'state_refund', value)}
                    placeholder="0.00"
                    placeholderTextColor="#999"
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>
            </View>

            <View style={styles.totalRefundRow}>
              <Text style={styles.totalLabel}>Total Reembolso:</Text>
              <Text style={styles.totalValue}>
                {formatCurrency((parseFloat(tr.federal_refund) || 0) + (parseFloat(tr.state_refund) || 0))}
              </Text>
            </View>
          </View>
        ))}

        {/* Grand Total */}
        <View style={styles.grandTotalCard}>
          <Ionicons name="cash" size={24} color="#10B981" />
          <Text style={styles.grandTotalLabel}>Total Reembolso Estimado:</Text>
          <Text style={styles.grandTotalValue}>{formatCurrency(getTotalRefund())}</Text>
        </View>

        {/* Invoice Section */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="receipt" size={24} color="#6C1110" />
            <Text style={styles.cardTitle}>Factura</Text>
            <TouchableOpacity 
              style={styles.toggleButton}
              onPress={() => setCreateInvoice(!createInvoice)}
            >
              <Ionicons 
                name={createInvoice ? "checkbox" : "square-outline"} 
                size={24} 
                color={createInvoice ? "#10B981" : "#999"} 
              />
            </TouchableOpacity>
          </View>

          {createInvoice && (
            <>
              <Text style={styles.inputLabel}>Seleccionar Precio</Text>
              <View style={styles.priceOptions}>
                {SERVICE_PRICES.map((price, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.priceOption,
                      selectedPriceIndex === index && styles.priceOptionSelected
                    ]}
                    onPress={() => setSelectedPriceIndex(index)}
                  >
                    <Text style={[
                      styles.priceOptionText,
                      selectedPriceIndex === index && styles.priceOptionTextSelected
                    ]}>
                      {price.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {SERVICE_PRICES[selectedPriceIndex].value === 0 && (
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Monto Personalizado</Text>
                  <View style={styles.currencyInput}>
                    <Text style={styles.currencySymbol}>$</Text>
                    <TextInput
                      style={styles.input}
                      value={customPrice}
                      onChangeText={setCustomPrice}
                      placeholder="0.00"
                      placeholderTextColor="#999"
                      keyboardType="decimal-pad"
                    />
                  </View>
                </View>
              )}

              <View style={styles.invoiceSummary}>
                <Text style={styles.invoiceSummaryLabel}>Total Factura:</Text>
                <Text style={styles.invoiceSummaryValue}>{formatCurrency(getInvoiceAmount())}</Text>
              </View>
            </>
          )}
        </View>

        {/* Notifications Section */}
        <View style={styles.card}>
          <TouchableOpacity 
            style={styles.notificationToggle}
            onPress={() => setSendNotifications(!sendNotifications)}
          >
            <Ionicons 
              name={sendNotifications ? "notifications" : "notifications-off"} 
              size={24} 
              color={sendNotifications ? "#3B82F6" : "#999"} 
            />
            <View style={styles.notificationText}>
              <Text style={styles.notificationTitle}>Enviar Notificaciones</Text>
              <Text style={styles.notificationDesc}>
                SMS y Email de agradecimiento + solicitud de reseña
              </Text>
            </View>
            <Ionicons 
              name={sendNotifications ? "checkbox" : "square-outline"} 
              size={24} 
              color={sendNotifications ? "#10B981" : "#999"} 
            />
          </TouchableOpacity>
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={24} color="#fff" />
              <Text style={styles.submitButtonText}>Completar Servicio</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Year Picker Modal */}
      <Modal
        visible={showYearPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowYearPicker(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowYearPicker(false)}
        >
          <View style={styles.yearPickerContent}>
            <Text style={styles.yearPickerTitle}>Seleccionar Año Fiscal</Text>
            {YEARS.map((year) => (
              <TouchableOpacity
                key={year}
                style={styles.yearOption}
                onPress={() => selectYear(year)}
              >
                <Text style={styles.yearOptionText}>{year}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  backButton: {
    padding: 8,
  },
  headerContent: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 10,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
    width: 80,
  },
  infoValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
    flex: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    marginTop: 8,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  addButton: {
    padding: 4,
  },
  taxReturnCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#6C1110',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  taxReturnHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  yearSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  yearText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  removeButton: {
    padding: 8,
  },
  inputGroup: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    marginBottom: 6,
  },
  currencyInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  currencySymbol: {
    fontSize: 16,
    color: '#666',
    marginRight: 4,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    paddingVertical: 12,
  },
  refundRow: {
    flexDirection: 'row',
  },
  federalInput: {
    borderWidth: 1,
    borderColor: '#3B82F6',
    backgroundColor: '#EFF6FF',
  },
  stateInput: {
    borderWidth: 1,
    borderColor: '#10B981',
    backgroundColor: '#ECFDF5',
  },
  totalRefundRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#10B981',
  },
  grandTotalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D1FAE5',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    gap: 12,
  },
  grandTotalLabel: {
    fontSize: 16,
    color: '#065F46',
    flex: 1,
  },
  grandTotalValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#047857',
  },
  toggleButton: {
    padding: 4,
  },
  priceOptions: {
    marginBottom: 16,
  },
  priceOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    marginBottom: 8,
  },
  priceOptionSelected: {
    backgroundColor: '#6C1110',
  },
  priceOptionText: {
    fontSize: 15,
    color: '#333',
  },
  priceOptionTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  invoiceSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  invoiceSummaryLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  invoiceSummaryValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#6C1110',
  },
  notificationToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  notificationText: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  notificationDesc: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B981',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 10,
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  yearPickerContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '80%',
    maxWidth: 300,
  },
  yearPickerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    marginBottom: 16,
  },
  yearOption: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  yearOptionText: {
    fontSize: 18,
    color: '#333',
    textAlign: 'center',
  },
});
