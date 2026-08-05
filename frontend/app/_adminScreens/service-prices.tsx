import React, { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import AdminHeader from '../../components/admin/AdminHeader';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
  Switch,
  Modal,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../../constants/colors';
import api from '../../services/api';
import { useTranslation } from 'react-i18next';

export default function ServicePricesManagement() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingService, setEditingService] = useState<any>(null);
  const [modalVisible, setModalVisible] = useState(false);
  
  // Form state
  const [serviceId, setServiceId] = useState('');
  const [serviceType, setServiceType] = useState('');
  const [serviceNameEs, setServiceNameEs] = useState('');
  const [serviceNameEn, setServiceNameEn] = useState('');
  const [descriptionEs, setDescriptionEs] = useState('');
  const [descriptionEn, setDescriptionEn] = useState('');
  const [priceCredits, setPriceCredits] = useState('');
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    loadServices();
  }, []);

  const loadServices = async () => {
    try {
      setLoading(true);
      // Use dynamic-services endpoint (same as client app)
      const response = await api.get('/dynamic-services');
      const services = Array.isArray(response.data) ? response.data : (response.data.services || []);
      setServices(services);
    } catch (error) {
      console.error('Error loading services:', error);
      Alert.alert('Error', 'No se pudieron cargar los servicios');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEditingService(null);
    setServiceId('');
    setServiceType('');
    setServiceNameEs('');
    setServiceNameEn('');
    setDescriptionEs('');
    setDescriptionEn('');
    setPriceCredits('');
    setIsActive(true);
    setModalVisible(false);
  };

  const handleEdit = (service: any) => {
    setEditingService(service);
    setServiceId(service.id || '');
    setServiceType(service.category || service.service_type || '');
    setServiceNameEs(service.name_es || service.name || '');
    setServiceNameEn(service.name_en || service.name || '');
    setDescriptionEs(service.description_es || service.description || '');
    setDescriptionEn(service.description_en || service.description || '');
    // Use price instead of price_credits for dynamic services
    const servicePrice = service.price ?? service.price_credits ?? 0;
    setPriceCredits(servicePrice.toString());
    setIsActive(service.is_active !== false);
    setModalVisible(true);
  };

  const handleSave = async () => {
    // Validate
    if (!serviceNameEs || !serviceNameEn || !descriptionEs || !descriptionEn || !priceCredits) {
      Alert.alert('Error', 'Por favor completa todos los campos requeridos en ambos idiomas');
      return;
    }

    const price = parseFloat(priceCredits);
    if (isNaN(price) || price <= 0) {
      Alert.alert('Error', 'El precio debe ser un número válido mayor a 0');
      return;
    }

    try {
      const payload = {
        name: serviceNameEs,
        name_es: serviceNameEs,
        name_en: serviceNameEn,
        description: descriptionEs,
        description_es: descriptionEs,
        description_en: descriptionEn,
        price: price,
        is_active: isActive,
        icon: serviceType || 'document-text',
        category: serviceType || 'general',
      };

      if (editingService) {
        // Update existing
        await api.put(`/admin/dynamic-services/${editingService.id}`, payload);
        Alert.alert('Éxito', 'Servicio actualizado correctamente');
      } else {
        // Create new
        const createPayload = {
          ...payload,
          id: serviceId || `service_${Date.now()}`
        };
        await api.post('/admin/dynamic-services', createPayload);
        Alert.alert('Éxito', 'Servicio creado correctamente');
      }

      resetForm();
      loadServices();
    } catch (error: any) {
      console.error('Error saving service:', error);
      Alert.alert('Error', error.response?.data?.detail || 'No se pudo guardar el servicio');
    }
  };

  const handleDelete = (serviceId: string) => {
    const deleteService = async () => {
      try {
        await api.delete(`/admin/dynamic-services/${serviceId}`);
        Alert.alert('Éxito', 'Servicio eliminado correctamente');
        loadServices();
      } catch (error) {
        console.error('Error deleting service:', error);
        Alert.alert('Error', 'No se pudo eliminar el servicio');
      }
    };

    Alert.alert(
      'Confirmar Eliminación',
      '¿Estás seguro de eliminar este servicio? Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Eliminar', 
          style: 'destructive',
          onPress: deleteService
        }
      ]
    );
  };

  const getServiceIcon = (serviceType: string) => {
    switch (serviceType) {
      case 'tax_return': return 'document-text';
      case 'amendment': return 'create';
      case 'appointment': return 'calendar';
      case 'document_processing': return 'folder';
      case 'priority_support': return 'flash';
      default: return 'help-circle';
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <AdminHeader 
          title="Precios de Servicios" 
          subtitle="Gestión de precios"
          rightAction={{
            icon: 'add-circle',
            onPress: () => setModalVisible(true)
          }}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Cargando servicios...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AdminHeader 
        title="Precios de Servicios" 
        subtitle="Gestión de precios"
        rightAction={{
          icon: 'add-circle',
          onPress: () => setModalVisible(true)
        }}
      />
      <ScrollView style={styles.scrollView}>
        <View style={styles.headerInfo}>
          <Text style={styles.subtitle}>
            Gestiona los servicios que los clientes pueden solicitar con créditos
          </Text>
        </View>

      {/* Services List */}
      {services.length === 0 && !modalVisible ? (
        <View style={styles.emptyState}>
          <Ionicons name="pricetags-outline" size={64} color={colors.textGray} />
          <Text style={styles.emptyText}>No hay servicios configurados</Text>
          <Text style={styles.emptySubtext}>
            Crea tu primer servicio para que los clientes puedan solicitarlo
          </Text>
        </View>
      ) : (
        <View style={styles.servicesList}>
          {services.map((service) => (
            <View key={service.id} style={styles.serviceCard}>
              <View style={styles.serviceHeader}>
                <View style={styles.serviceIconContainer}>
                  <Ionicons 
                    name={getServiceIcon(service.icon || service.category || service.service_type)} 
                    size={24} 
                    color={colors.primary} 
                  />
                </View>
                <View style={styles.serviceInfo}>
                  <Text style={styles.serviceName}>{service.name || service.name_es}</Text>
                  <Text style={styles.serviceType}>{service.category || service.service_type || 'General'}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: service.is_active !== false ? colors.success + '20' : colors.error + '20' }]}>
                  <Text style={[styles.statusText, { color: service.is_active !== false ? colors.success : colors.error }]}>
                    {service.is_active !== false ? 'Activo' : 'Inactivo'}
                  </Text>
                </View>
              </View>

              <Text style={styles.serviceDescription} numberOfLines={2}>
                {service.description || service.description_es}
              </Text>

              <View style={styles.priceContainer}>
                <Ionicons name="cash" size={20} color={colors.primary} />
                <Text style={styles.priceText}>${service.price ?? service.price_credits ?? 0}</Text>
              </View>

              <View style={styles.serviceActions}>
                <TouchableOpacity
                  onPress={() => handleEdit(service)}
                  style={styles.editButton}
                >
                  <Ionicons name="pencil" size={20} color={colors.primary} />
                  <Text style={styles.editButtonText}>Editar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => handleDelete(service.id)}
                  style={styles.deleteButton}
                >
                  <Ionicons name="trash" size={20} color={colors.error} />
                  <Text style={styles.deleteButtonText}>Eliminar</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Form Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={resetForm}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContainer}>
            <View style={styles.formHeader}>
              <Text style={styles.formTitle}>
                {editingService ? 'Editar Servicio' : 'Nuevo Servicio'}
              </Text>
              <TouchableOpacity onPress={resetForm}>
                <Ionicons name="close" size={28} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.formScroll} showsVerticalScrollIndicator={false}>
              {!editingService && (
                <>
                  <Text style={styles.label}>ID del Servicio (opcional)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Ej: tax_return_premium"
                    value={serviceId}
                    onChangeText={setServiceId}
                    autoCapitalize="none"
                  />
                </>
              )}

              <Text style={styles.label}>Tipo de Servicio *</Text>
              <TextInput
                style={styles.input}
                placeholder="Ej: tax_return, amendment, appointment"
                value={serviceType}
                onChangeText={setServiceType}
                autoCapitalize="none"
              />

              <Text style={[styles.label, {marginTop: 20, fontSize: 16, color: colors.primary}]}>🇪🇸 Español</Text>
              
              <Text style={styles.label}>Nombre del Servicio (Español) *</Text>
              <TextInput
                style={styles.input}
                placeholder={t('admin.servicePriceNamePlaceholder', 'Ej: Declaración de Impuestos Premium')}
                value={serviceNameEs}
                onChangeText={setServiceNameEs}
              />

              <Text style={styles.label}>Descripción (Español) *</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder={t('admin.servicePriceDescPlaceholder', 'Describe el servicio en detalle en español')}
                value={descriptionEs}
                onChangeText={setDescriptionEs}
                multiline
                numberOfLines={4}
              />

              <Text style={[styles.label, {marginTop: 20, fontSize: 16, color: colors.primary}]}>🇺🇸 English</Text>

              <Text style={styles.label}>Service Name (English) *</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex: Premium Tax Return"
                value={serviceNameEn}
                onChangeText={setServiceNameEn}
              />

              <Text style={styles.label}>Description (English) *</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Describe the service in detail in English"
                value={descriptionEn}
                onChangeText={setDescriptionEn}
                multiline
                numberOfLines={4}
              />

              <Text style={styles.label}>Precio en Dólares ($) *</Text>
              <TextInput
                style={styles.input}
                placeholder="Ej: 180"
                value={priceCredits}
                onChangeText={setPriceCredits}
                keyboardType="decimal-pad"
              />

              <View style={styles.switchContainer}>
                <Text style={styles.label}>¿Servicio Activo?</Text>
                <Switch
                  value={isActive}
                  onValueChange={setIsActive}
                  trackColor={{ false: '#ccc', true: colors.primary + '80' }}
                  thumbColor={isActive ? colors.primary : '#f4f3f4'}
                />
              </View>

              <View style={styles.formActions}>
                <TouchableOpacity
                  onPress={resetForm}
                  style={styles.cancelButton}
                >
                  <Text style={styles.cancelButtonText}>Cancelar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleSave}
                  style={styles.saveButton}
                >
                  <Text style={styles.saveButtonText}>Guardar</Text>
                </TouchableOpacity>
              </View>

              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  scrollView: {
    flex: 1,
  },
  headerInfo: {
    padding: 16,
    paddingTop: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingTop: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: colors.textGray,
  },
  header: {
    backgroundColor: '#FFF',
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
  },
  subtitle: {
    fontSize: 15,
    color: colors.textGray,
    marginTop: 8,
  },
  addButton: {
    backgroundColor: colors.primary,
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 48,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 15,
    color: colors.textGray,
    textAlign: 'center',
    marginTop: 8,
  },
  servicesList: {
    padding: 16,
  },
  serviceCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  serviceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  serviceIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  serviceInfo: {
    flex: 1,
  },
  serviceName: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  serviceType: {
    fontSize: 13,
    color: colors.textGray,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  serviceDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: 12,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
    padding: 12,
    backgroundColor: colors.primary + '10',
    borderRadius: 12,
  },
  priceText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
  },
  serviceActions: {
    flexDirection: 'row',
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    paddingTop: 16,
  },
  editButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    backgroundColor: colors.primary + '10',
    borderRadius: 12,
  },
  editButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary,
  },
  deleteButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    backgroundColor: colors.error + '10',
    borderRadius: 12,
  },
  deleteButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.error,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '90%',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  formContainer: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    marginTop: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  formHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  formTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
  },
  formScroll: {
    maxHeight: 600,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
    backgroundColor: '#F9FAFB',
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  formActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
  },
  saveButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
});