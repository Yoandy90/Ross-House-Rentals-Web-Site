import { useTranslation } from 'react-i18next';
/**
 * Create Invoice Screen
 * Admin can create new invoices for clients
 * With service selector and dynamic pricing
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import api from '../../services/api';
import AdminHeader from '../../components/admin/AdminHeader';

const colors = {
  primary: '#6C1110',
  secondary: '#8B1A19',
  background: '#F5F5F5',
  surface: '#FFFFFF',
  text: '#1A1A1A',
  textSecondary: '#666666',
  border: '#E0E0E0',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',
};

interface Client {
  id?: string;
  _id?: string;
  name?: string;
  full_name?: string;
  email: string;
}

interface Service {
  _id: string;
  name: string;
  description?: string;
  price_credits?: number;
  base_price?: number;
  category?: string;
  is_active?: boolean;
}

interface InvoiceItem {
  service_id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  is_custom: boolean;
}

const CreateInvoice = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [clients, setClients] = useState<Client[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showClientPicker, setShowClientPicker] = useState(false);
  const [showServicePicker, setShowServicePicker] = useState(false);
  const [currentItemIndex, setCurrentItemIndex] = useState(0);
  const [clientSearch, setClientSearch] = useState('');
  const [serviceSearch, setServiceSearch] = useState('');
  
  const [items, setItems] = useState<InvoiceItem[]>([
    { description: '', quantity: 1, unit_price: 0, is_custom: false }
  ]);
  
  const [taxRate, setTaxRate] = useState('0');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoadingData(true);
      
      // Load ALL clients (limit=1000 for selector) and services in parallel
      const [clientsRes, servicesRes] = await Promise.all([
        api.get('/admin/clients?limit=1000'),
        api.get('/admin/services').catch(() => ({ data: { services: [] } }))
      ]);
      
      setClients(clientsRes.data.clients || []);
      setServices(servicesRes.data.services || servicesRes.data || []);
      
      console.log(`✅ Cargados ${clientsRes.data.clients?.length || 0} clientes de ${clientsRes.data.pagination?.total || 'N/A'} totales`);
      
      if (!clientsRes.data.clients?.length) {
        Alert.alert('Aviso', 'No hay clientes registrados. Crea un cliente primero.');
      }
    } catch (error: any) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'No se pudieron cargar los datos');
    } finally {
      setLoadingData(false);
    }
  };

  const addItem = () => {
    setItems([...items, { description: '', quantity: 1, unit_price: 0, is_custom: false }]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const selectService = (service: Service) => {
    const price = service.price_credits || service.base_price || 0;
    const newItems = [...items];
    newItems[currentItemIndex] = {
      service_id: service._id,
      description: service.name,
      quantity: 1,
      unit_price: price,
      is_custom: false,
    };
    setItems(newItems);
    setShowServicePicker(false);
  };

  const setCustomItem = (index: number) => {
    const newItems = [...items];
    newItems[index] = {
      ...newItems[index],
      is_custom: true,
      service_id: undefined,
    };
    setItems(newItems);
  };

  const updateItem = (index: number, field: keyof InvoiceItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const calculateSubtotal = () => {
    return items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
  };

  const calculateTax = () => {
    const subtotal = calculateSubtotal();
    const rate = parseFloat(taxRate) || 0;
    return subtotal * (rate / 100);
  };

  const calculateTotal = () => {
    return calculateSubtotal() + calculateTax();
  };

  const handleSubmit = async () => {
    console.log('🔄 Intentando crear factura...');
    console.log('Cliente seleccionado:', selectedClient);
    console.log('Items:', items);
    
    if (!selectedClient) {
      if (Platform.OS === 'web') {
        Alert.alert('Aviso', 'Error: Selecciona un cliente');
      } else {
        Alert.alert('Error', 'Selecciona un cliente');
      }
      return;
    }

    const validItems = items.filter(item => item.description && item.unit_price > 0);
    if (validItems.length === 0) {
      if (Platform.OS === 'web') {
        Alert.alert('Aviso', 'Error: Agrega al menos un servicio con precio');
      } else {
        Alert.alert('Error', 'Agrega al menos un servicio con precio');
      }
      return;
    }

    setLoading(true);

    try {
      const clientId = selectedClient.id || selectedClient._id;
      const clientName = selectedClient.name || selectedClient.full_name || '';
      
      // Generar nombre del servicio basado en los items
      const serviceNames = validItems.map(item => item.description).join(', ');
      const serviceName = serviceNames.length > 200 
        ? serviceNames.substring(0, 197) + '...' 
        : serviceNames;
      
      // Estructura que espera el backend (InvoiceCreate model)
      const invoiceData = {
        user_id: clientId,  // Backend espera user_id, no client_id
        service_name: serviceName || 'Servicios de Tax',  // Campo obligatorio
        items: validItems.map(item => ({
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
        })),
        notes: notes || undefined,
        due_date: dueDate ? new Date(dueDate.split('/').reverse().join('-')).toISOString() : undefined,
      };

      console.log('📤 Enviando datos:', JSON.stringify(invoiceData, null, 2));
      const response = await api.post('/admin/invoices', invoiceData);
      console.log('✅ Respuesta:', response.data);

      if (Platform.OS === 'web') {
        Alert.alert('Aviso', `✅ Factura Creada\nFactura por $${calculateTotal().toFixed(2)} creada para ${clientName}`);
        resetForm();
      } else {
        Alert.alert(
          '✅ Factura Creada',
          `Factura por $${calculateTotal().toFixed(2)} creada para ${clientName}`,
          [
            { text: 'Crear Otra', onPress: resetForm },
            { text: 'Ver Facturas', onPress: () => router.back() },
          ]
        );
      }
    } catch (error: any) {
      console.error('❌ Error creating invoice:', error);
      console.error('Error response:', error.response?.data);
      
      let errorMsg = 'No se pudo crear la factura';
      if (error.response?.data?.detail) {
        // Manejar errores de validación de Pydantic
        const detail = error.response.data.detail;
        if (Array.isArray(detail)) {
          errorMsg = detail.map((e: any) => `${e.loc?.join('.')}: ${e.msg}`).join('\n');
        } else {
          errorMsg = detail;
        }
      } else if (error.message) {
        errorMsg = error.message;
      }
      
      if (Platform.OS === 'web') {
        Alert.alert('Aviso', `Error: ${errorMsg}`);
      } else {
        Alert.alert('Error', errorMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedClient(null);
    setItems([{ description: '', quantity: 1, unit_price: 0, is_custom: false }]);
    setTaxRate('0');
    setDueDate('');
    setNotes('');
  };

  const filteredClients = clients.filter(c => {
    const name = (c.name || c.full_name || '').toLowerCase();
    const email = c.email.toLowerCase();
    const search = clientSearch.toLowerCase();
    return name.includes(search) || email.includes(search);
  });

  const filteredServices = services.filter(s => {
    const name = (s.name || '').toLowerCase();
    const search = serviceSearch.toLowerCase();
    return s.is_active !== false && name.includes(search);
  });

  if (loadingData) {
    return (
      <View style={styles.container}>
        <AdminHeader title="Nueva Factura" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Cargando datos...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AdminHeader title="Nueva Factura" />
      
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView 
          style={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Info Banner */}
          <View style={styles.infoBanner}>
            <Ionicons name="information-circle" size={20} color={colors.info} />
            <Text style={styles.infoText}>
              Complete los datos para generar una nueva factura
            </Text>
          </View>

          {/* Client Selection */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="person" size={20} color={colors.primary} />
              <Text style={styles.cardTitle}>Cliente</Text>
            </View>
            
            <TouchableOpacity
              style={styles.selector}
              onPress={() => setShowClientPicker(true)}
            >
              <Ionicons name="people" size={20} color={colors.textSecondary} />
              <Text style={[
                styles.selectorText,
                !selectedClient && styles.selectorPlaceholder
              ]}>
                {selectedClient 
                  ? `${selectedClient.name || selectedClient.full_name} - ${selectedClient.email}`
                  : 'Selecciona un cliente...'
                }
              </Text>
              <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Services/Items */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="receipt" size={20} color={colors.primary} />
              <Text style={styles.cardTitle}>Servicios</Text>
            </View>

            {items.map((item, index) => (
              <View key={index} style={styles.itemContainer}>
                <View style={styles.itemHeader}>
                  <Text style={styles.itemNumber}>Servicio #{index + 1}</Text>
                  {items.length > 1 && (
                    <TouchableOpacity onPress={() => removeItem(index)}>
                      <Ionicons name="trash-outline" size={20} color={colors.error} />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Service Selector or Custom Input */}
                {!item.is_custom ? (
                  <TouchableOpacity
                    style={styles.selector}
                    onPress={() => {
                      setCurrentItemIndex(index);
                      setShowServicePicker(true);
                    }}
                  >
                    <Ionicons name="briefcase" size={20} color={colors.textSecondary} />
                    <Text style={[
                      styles.selectorText,
                      !item.description && styles.selectorPlaceholder
                    ]}>
                      {item.description || 'Selecciona un servicio...'}
                    </Text>
                    <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
                  </TouchableOpacity>
                ) : (
                  <TextInput
                    style={styles.input}
                    value={item.description}
                    onChangeText={(text) => updateItem(index, 'description', text)}
                    placeholder={t('admin.customServiceDescPlaceholder', 'Descripción del servicio personalizado')}
                    placeholderTextColor={colors.textSecondary}
                  />
                )}

                <TouchableOpacity
                  style={styles.customButton}
                  onPress={() => setCustomItem(index)}
                >
                  <Ionicons name="add-circle-outline" size={16} color={colors.info} />
                  <Text style={styles.customButtonText}>
                    {item.is_custom ? 'Servicio personalizado' : 'Agregar servicio personalizado'}
                  </Text>
                </TouchableOpacity>

                <View style={styles.itemRow}>
                  <View style={styles.quantityContainer}>
                    <Text style={styles.label}>Cantidad</Text>
                    <TextInput
                      style={styles.quantityInput}
                      value={String(item.quantity)}
                      onChangeText={(text) => updateItem(index, 'quantity', parseInt(text) || 1)}
                      keyboardType="numeric"
                      placeholder="1"
                    />
                  </View>

                  <View style={styles.priceContainer}>
                    <Text style={styles.label}>Precio Unitario</Text>
                    <View style={styles.priceInput}>
                      <Text style={styles.currencySymbol}>$</Text>
                      <TextInput
                        style={styles.priceTextInput}
                        value={String(item.unit_price || '')}
                        onChangeText={(text) => updateItem(index, 'unit_price', parseFloat(text) || 0)}
                        keyboardType="decimal-pad"
                        placeholder="0.00"
                      />
                    </View>
                  </View>

                  <View style={styles.subtotalContainer}>
                    <Text style={styles.label}>Subtotal</Text>
                    <Text style={styles.subtotalValue}>
                      ${(item.quantity * item.unit_price).toFixed(2)}
                    </Text>
                  </View>
                </View>
              </View>
            ))}

            <TouchableOpacity style={styles.addItemButton} onPress={addItem}>
              <Ionicons name="add-circle" size={24} color={colors.primary} />
              <Text style={styles.addItemText}>Agregar otro servicio</Text>
            </TouchableOpacity>
          </View>

          {/* Invoice Details */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="document-text" size={20} color={colors.primary} />
              <Text style={styles.cardTitle}>Detalles de Factura</Text>
            </View>

            <Text style={styles.label}>Impuesto (%)</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={taxRate}
                onChangeText={setTaxRate}
                keyboardType="decimal-pad"
                placeholder="0"
              />
              <Text style={styles.percentSymbol}>%</Text>
            </View>

            <Text style={styles.label}>Fecha de Vencimiento</Text>
            <TextInput
              style={styles.input}
              value={dueDate}
              onChangeText={setDueDate}
              placeholder="DD/MM/YYYY"
              placeholderTextColor={colors.textSecondary}
            />

            <Text style={styles.label}>Notas (Opcional)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Notas adicionales para la factura..."
              placeholderTextColor={colors.textSecondary}
              multiline
              numberOfLines={3}
            />
          </View>

          {/* Totals */}
          <View style={styles.totalsCard}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Subtotal</Text>
              <Text style={styles.totalValue}>${calculateSubtotal().toFixed(2)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Impuesto ({taxRate}%)</Text>
              <Text style={styles.totalValue}>${calculateTax().toFixed(2)}</Text>
            </View>
            <View style={[styles.totalRow, styles.grandTotalRow]}>
              <Text style={styles.grandTotalLabel}>Total</Text>
              <Text style={styles.grandTotalValue}>${calculateTotal().toFixed(2)}</Text>
            </View>
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={24} color="#FFF" />
                <Text style={styles.submitButtonText}>Crear Factura</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={{ height: 50 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Client Picker Modal */}
      <Modal
        visible={showClientPicker}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Seleccionar Cliente</Text>
            <TouchableOpacity onPress={() => setShowClientPicker(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color={colors.textSecondary} />
            <TextInput
              style={styles.searchInput}
              value={clientSearch}
              onChangeText={setClientSearch}
              placeholder="Buscar cliente..."
              placeholderTextColor={colors.textSecondary}
            />
          </View>

          <ScrollView style={styles.modalList}>
            {filteredClients.length === 0 ? (
              <Text style={styles.emptyText}>No hay clientes disponibles</Text>
            ) : (
              filteredClients.map((client) => {
                const clientId = client.id || client._id;
                const clientName = client.name || client.full_name || 'Sin nombre';
                return (
                  <TouchableOpacity
                    key={clientId}
                    style={styles.modalItem}
                    onPress={() => {
                      setSelectedClient(client);
                      setShowClientPicker(false);
                      setClientSearch('');
                    }}
                  >
                    <View style={styles.modalItemIcon}>
                      <Text style={styles.modalItemInitial}>
                        {clientName.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.modalItemContent}>
                      <Text style={styles.modalItemTitle}>{clientName}</Text>
                      <Text style={styles.modalItemSubtitle}>{client.email}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* Service Picker Modal */}
      <Modal
        visible={showServicePicker}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Seleccionar Servicio</Text>
            <TouchableOpacity onPress={() => setShowServicePicker(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color={colors.textSecondary} />
            <TextInput
              style={styles.searchInput}
              value={serviceSearch}
              onChangeText={setServiceSearch}
              placeholder="Buscar servicio..."
              placeholderTextColor={colors.textSecondary}
            />
          </View>

          <ScrollView style={styles.modalList}>
            {filteredServices.length === 0 ? (
              <View>
                <Text style={styles.emptyText}>No hay servicios predefinidos</Text>
                <TouchableOpacity
                  style={styles.customServiceButton}
                  onPress={() => {
                    setCustomItem(currentItemIndex);
                    setShowServicePicker(false);
                  }}
                >
                  <Ionicons name="add-circle" size={24} color={colors.primary} />
                  <Text style={styles.customServiceText}>Crear servicio personalizado</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {filteredServices.map((service) => {
                  const price = service.price_credits || service.base_price || 0;
                  return (
                    <TouchableOpacity
                      key={service._id}
                      style={styles.modalItem}
                      onPress={() => selectService(service)}
                    >
                      <View style={[styles.modalItemIcon, { backgroundColor: colors.info + '20' }]}>
                        <Ionicons name="briefcase" size={20} color={colors.info} />
                      </View>
                      <View style={styles.modalItemContent}>
                        <Text style={styles.modalItemTitle}>{service.name}</Text>
                        {service.description && (
                          <Text style={styles.modalItemSubtitle} numberOfLines={1}>
                            {service.description}
                          </Text>
                        )}
                      </View>
                      <Text style={styles.servicePrice}>${price.toFixed(2)}</Text>
                    </TouchableOpacity>
                  );
                })}
                
                <TouchableOpacity
                  style={styles.customServiceButton}
                  onPress={() => {
                    setCustomItem(currentItemIndex);
                    setShowServicePicker(false);
                  }}
                >
                  <Ionicons name="add-circle" size={24} color={colors.primary} />
                  <Text style={styles.customServiceText}>Agregar servicio personalizado</Text>
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: colors.textSecondary,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  infoBanner: {
    flexDirection: 'row',
    backgroundColor: '#EBF5FF',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    alignItems: 'center',
    gap: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: colors.info,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  selectorText: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
  },
  selectorPlaceholder: {
    color: colors.textSecondary,
  },
  itemContainer: {
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  itemNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  customButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    marginBottom: 12,
  },
  customButtonText: {
    fontSize: 13,
    color: colors.info,
  },
  itemRow: {
    flexDirection: 'row',
    gap: 12,
  },
  quantityContainer: {
    flex: 1,
  },
  priceContainer: {
    flex: 2,
  },
  subtotalContainer: {
    flex: 1,
    alignItems: 'flex-end',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: colors.text,
  },
  quantityInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
    color: colors.text,
    textAlign: 'center',
  },
  priceInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
  },
  currencySymbol: {
    fontSize: 16,
    color: colors.textSecondary,
    marginRight: 4,
  },
  priceTextInput: {
    flex: 1,
    padding: 10,
    fontSize: 16,
    color: colors.text,
  },
  subtotalValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
    marginTop: 10,
  },
  addItemButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderWidth: 2,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    borderRadius: 8,
    gap: 8,
  },
  addItemText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  percentSymbol: {
    fontSize: 18,
    color: colors.textSecondary,
    marginLeft: 8,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  totalsCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  totalLabel: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  grandTotalRow: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: 8,
    paddingTop: 12,
  },
  grandTotalLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  grandTotalValue: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.primary,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    margin: 16,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
  },
  modalList: {
    flex: 1,
    padding: 16,
  },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: 14,
    borderRadius: 10,
    marginBottom: 10,
    gap: 12,
  },
  modalItemIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalItemInitial: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
  },
  modalItemContent: {
    flex: 1,
  },
  modalItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  modalItemSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
  servicePrice: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.success,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 16,
    color: colors.textSecondary,
    padding: 20,
  },
  customServiceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderWidth: 2,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    borderRadius: 10,
    marginTop: 16,
    gap: 8,
  },
  customServiceText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
  },
});

export default CreateInvoice;
