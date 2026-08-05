import { useTranslation } from 'react-i18next';
/**
 * Create Service Order Screen - Ultra Modern Premium Design v2
 * Admin can create tax service orders/projects for clients
 * Features: Dynamic services, create client inline, improved search
 */
import React, { useState, useEffect, useRef } from 'react';
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
  Dimensions,
  Animated,
  Modal,
  FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router';
import api from '../../services/api';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 60) / 2; // 2 columns with proper padding

interface Client {
  id?: string;
  _id?: string;
  name?: string;
  full_name?: string;
  email: string;
  phone?: string;
}

interface ServiceType {
  id: string;
  name: string;
  description?: string;
  price?: number;
  icon?: string;
  color?: string;
  is_active?: boolean;
}

// Default services as fallback
const defaultServiceTypes: ServiceType[] = [
  { id: 'tax_preparation', name: 'Preparación de Impuestos', icon: 'calculator', color: '#6C1110' },
  { id: 'itin_application', name: 'Solicitud ITIN', icon: 'card', color: '#3B82F6' },
  { id: 'passport_renewal', name: 'Renovación Pasaporte', icon: 'document-text', color: '#8B5CF6' },
  { id: 'translation', name: 'Traducción de Documentos', icon: 'language', color: '#10B981' },
  { id: 'notary', name: 'Servicios Notariales', icon: 'ribbon', color: '#F59E0B' },
  { id: 'other', name: 'Otro Servicio', icon: 'ellipsis-horizontal', color: '#6B7280' },
];

const priorities = [
  { id: 'low', label: 'Baja', icon: 'arrow-down', color: '#10B981', bg: '#D1FAE5' },
  { id: 'medium', label: 'Media', icon: 'remove', color: '#F59E0B', bg: '#FEF3C7' },
  { id: 'high', label: 'Alta', icon: 'flame', color: '#EF4444', bg: '#FEE2E2' },
];

const getServiceIcon = (iconName?: string) => {
  const icons: { [key: string]: string } = {
    'calculator': 'calculator',
    'card': 'card',
    'document-text': 'document-text',
    'language': 'language',
    'ribbon': 'ribbon',
    'cash': 'cash',
    'briefcase': 'briefcase',
    'home': 'home',
    'car': 'car',
    'medical': 'medical',
    'school': 'school',
  };
  return icons[iconName || ''] || 'briefcase';
};

const getServiceColor = (color?: string) => {
  return color || '#6B7280';
};

const CreateServiceOrder = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const [loadingClients, setLoadingClients] = useState(true);
  const [loadingServices, setLoadingServices] = useState(true);
  const [clients, setClients] = useState<Client[]>([]);
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>(defaultServiceTypes);
  const [showClientPicker, setShowClientPicker] = useState(false);
  const [showCreateClient, setShowCreateClient] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [formData, setFormData] = useState({
    service_type: '',
    description: '',
    tax_year: new Date().getFullYear().toString(),
    estimated_amount: '',
    priority: 'medium',
    notes: '',
  });
  
  // New client form
  const [newClientData, setNewClientData] = useState({
    name: '',
    email: '',
    phone: '',
  });
  const [creatingClient, setCreatingClient] = useState(false);
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    loadClients();
    loadServices();
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
  }, []);

  const loadClients = async () => {
    try {
      const response = await api.get('/admin/clients?limit=1000');
      setClients(response.data.clients || []);
    } catch (error) {
      console.error('Error loading clients:', error);
    } finally {
      setLoadingClients(false);
    }
  };

  const loadServices = async () => {
    try {
      // Try to load from service-prices endpoint
      const response = await api.get('/admin/service-prices');
      const services = response.data.services || response.data.service_prices || response.data || [];
      
      if (services.length > 0) {
        const mappedServices = services
          .filter((s: any) => s.is_active !== false)
          .map((s: any) => ({
            id: s._id || s.id || s.name?.toLowerCase().replace(/\s+/g, '_'),
            name: s.name || s.service_name,
            description: s.description,
            price: s.price || s.base_price,
            icon: s.icon || 'briefcase',
            color: s.color || '#6C1110',
            is_active: s.is_active,
          }));
        
        if (mappedServices.length > 0) {
          setServiceTypes(mappedServices);
          setFormData(prev => ({ ...prev, service_type: mappedServices[0].id }));
        }
      }
    } catch (error) {
      console.error('Error loading services:', error);
      // Keep default services
      setFormData(prev => ({ ...prev, service_type: defaultServiceTypes[0].id }));
    } finally {
      setLoadingServices(false);
    }
  };

  // Improved search - matches beginning of words, phone, email
  const filteredClients = clients.filter(client => {
    const name = (client.name || client.full_name || '').toLowerCase();
    const email = (client.email || '').toLowerCase();
    const phone = (client.phone || '').replace(/\D/g, '');
    const query = searchQuery.toLowerCase().trim();
    const queryDigits = searchQuery.replace(/\D/g, '');
    
    // Match name (any word starting with query)
    const nameWords = name.split(' ');
    const nameMatch = nameWords.some(word => word.startsWith(query));
    
    // Match email
    const emailMatch = email.includes(query);
    
    // Match phone (digits only)
    const phoneMatch = queryDigits.length > 0 && phone.includes(queryDigits);
    
    return nameMatch || emailMatch || phoneMatch;
  }).slice(0, 20); // Limit to 20 results for performance

  const handleCreateClient = async () => {
    if (!newClientData.name.trim()) {
      Alert.alert('Error', 'El nombre es requerido');
      return;
    }
    if (!newClientData.email.trim()) {
      Alert.alert('Error', 'El email es requerido');
      return;
    }

    setCreatingClient(true);
    try {
      const response = await api.post('/admin/clients', {
        name: newClientData.name.trim(),
        full_name: newClientData.name.trim(),
        email: newClientData.email.trim().toLowerCase(),
        phone: newClientData.phone.trim(),
      });

      const newClient = response.data.client || response.data;
      
      // Add to clients list and select
      setClients(prev => [newClient, ...prev]);
      setSelectedClient(newClient);
      setShowCreateClient(false);
      setShowClientPicker(false);
      setNewClientData({ name: '', email: '', phone: '' });
      
      Alert.alert('✅ Cliente Creado', `${newClient.name || newClient.full_name} ha sido agregado`);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'No se pudo crear el cliente');
    } finally {
      setCreatingClient(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedClient) {
      Alert.alert('⚠️ Cliente Requerido', 'Por favor selecciona un cliente para continuar.');
      return;
    }

    if (!formData.service_type) {
      Alert.alert('⚠️ Servicio Requerido', 'Por favor selecciona un tipo de servicio.');
      return;
    }

    if (!formData.description.trim()) {
      Alert.alert('⚠️ Descripción Requerida', 'Por favor agrega una descripción del servicio.');
      return;
    }

    setLoading(true);

    try {
      const selectedService = serviceTypes.find(s => s.id === formData.service_type);
      
      const orderData = {
        client_id: selectedClient.id || selectedClient._id,
        service_type: selectedService?.name || formData.service_type,
        description: formData.description,
        tax_year: parseInt(formData.tax_year),
        estimated_amount: parseFloat(formData.estimated_amount) || selectedService?.price || 0,
        priority: formData.priority,
        notes: formData.notes,
        status: 'pending',
      };

      await api.post('/admin/service-orders', orderData);

      Alert.alert(
        '✅ ¡Orden Creada!',
        'La orden de servicio ha sido creada exitosamente.',
        [{ text: 'Aceptar', onPress: () => router.back() }]
      );
    } catch (error: any) {
      Alert.alert('❌ Error', error.response?.data?.detail || 'No se pudo crear la orden. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const selectedServiceType = serviceTypes.find(s => s.id === formData.service_type);
  const selectedPriority = priorities.find(p => p.id === formData.priority);

  const getStepProgress = () => {
    let progress = 0;
    if (selectedClient) progress += 0.33;
    if (formData.service_type) progress += 0.33;
    if (formData.description) progress += 0.34;
    return progress;
  };

  return (
    <View style={styles.container}>
      {/* Premium Header */}
      <LinearGradient
        colors={['#1C3B72', '#2D5BA8', '#3D6BC8']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 8 }]}
      >
        <View style={styles.headerDecoration}>
          <View style={[styles.decorCircle, styles.decorCircle1]} />
          <View style={[styles.decorCircle, styles.decorCircle2]} />
        </View>

        <View style={styles.headerContent}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={24} color="#FFF" />
          </TouchableOpacity>
          
          <View style={styles.headerCenter}>
            <View style={styles.headerIconBg}>
              <Ionicons name="briefcase" size={20} color="#FFF" />
            </View>
            <View>
              <Text style={styles.headerTitle}>Orden de Servicio</Text>
              <Text style={styles.headerSubtitle}>Nuevo trámite para cliente</Text>
            </View>
          </View>
          
          <View style={{ width: 40 }} />
        </View>

        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <Animated.View 
              style={[styles.progressFill, { width: `${getStepProgress() * 100}%` }]} 
            />
          </View>
          <Text style={styles.progressText}>
            {Math.round(getStepProgress() * 100)}% Completado
          </Text>
        </View>
      </LinearGradient>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.formContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Client Selection Card */}
          <Animated.View 
            style={[styles.sectionCard, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
          >
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIconBg, { backgroundColor: '#EEF2FF' }]}>
                <Ionicons name="person" size={18} color="#6366F1" />
              </View>
              <Text style={styles.sectionTitle}>Cliente</Text>
              <View style={styles.requiredBadge}>
                <Text style={styles.requiredText}>REQUERIDO</Text>
              </View>
            </View>
            
            <TouchableOpacity
              style={[styles.clientSelector, selectedClient && styles.clientSelectorSelected]}
              onPress={() => setShowClientPicker(!showClientPicker)}
            >
              {selectedClient ? (
                <View style={styles.selectedClientRow}>
                  <LinearGradient colors={['#6366F1', '#4F46E5']} style={styles.clientAvatar}>
                    <Text style={styles.avatarText}>
                      {(selectedClient.name || selectedClient.full_name || 'C').charAt(0).toUpperCase()}
                    </Text>
                  </LinearGradient>
                  <View style={styles.clientInfo}>
                    <Text style={styles.clientName}>{selectedClient.name || selectedClient.full_name}</Text>
                    <Text style={styles.clientEmail}>{selectedClient.email}</Text>
                  </View>
                  <View style={styles.changeBtn}>
                    <Text style={styles.changeBtnText}>Cambiar</Text>
                  </View>
                </View>
              ) : (
                <View style={styles.placeholderRow}>
                  <View style={styles.placeholderIcon}>
                    <Ionicons name="person-add" size={22} color="#9CA3AF" />
                  </View>
                  <Text style={styles.placeholderText}>Selecciona un cliente...</Text>
                  <Ionicons name="chevron-down" size={20} color="#9CA3AF" />
                </View>
              )}
            </TouchableOpacity>

            {showClientPicker && (
              <View style={styles.clientPickerContainer}>
                <View style={styles.searchBox}>
                  <Ionicons name="search" size={18} color="#9CA3AF" />
                  <TextInput
                    style={styles.searchInput}
                    placeholder={t('admin.searchNameEmailPlaceholder', 'Buscar por nombre, email o teléfono...')}
                    placeholderTextColor="#9CA3AF"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    autoFocus
                  />
                  {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchQuery('')}>
                      <Ionicons name="close-circle" size={18} color="#9CA3AF" />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Create New Client Button */}
                <TouchableOpacity 
                  style={styles.createClientButton}
                  onPress={() => {
                    setNewClientData({ name: searchQuery, email: '', phone: '' });
                    setShowCreateClient(true);
                  }}
                >
                  <LinearGradient colors={['#10B981', '#059669']} style={styles.createClientIcon}>
                    <Ionicons name="add" size={20} color="#FFF" />
                  </LinearGradient>
                  <View style={styles.createClientInfo}>
                    <Text style={styles.createClientTitle}>Crear Nuevo Cliente</Text>
                    <Text style={styles.createClientDesc}>
                      {searchQuery ? `Agregar "${searchQuery}"` : 'Si no existe, créalo aquí'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#10B981" />
                </TouchableOpacity>

                <ScrollView style={styles.clientList} nestedScrollEnabled>
                  {loadingClients ? (
                    <View style={styles.loadingClients}>
                      <ActivityIndicator color="#6366F1" />
                      <Text style={styles.loadingClientsText}>Cargando clientes...</Text>
                    </View>
                  ) : filteredClients.length === 0 ? (
                    <View style={styles.noResults}>
                      <Ionicons name="search" size={32} color="#D1D5DB" />
                      <Text style={styles.noResultsText}>
                        {searchQuery ? `No se encontró "${searchQuery}"` : 'No hay clientes'}
                      </Text>
                      <Text style={styles.noResultsHint}>Puedes crear uno nuevo arriba ☝️</Text>
                    </View>
                  ) : (
                    filteredClients.map((client, index) => (
                      <TouchableOpacity
                        key={client.id || client._id}
                        style={[styles.clientOption, index === filteredClients.length - 1 && { borderBottomWidth: 0 }]}
                        onPress={() => {
                          setSelectedClient(client);
                          setShowClientPicker(false);
                          setSearchQuery('');
                        }}
                      >
                        <View style={styles.clientOptionAvatar}>
                          <Text style={styles.clientOptionAvatarText}>
                            {(client.name || client.full_name || 'C').charAt(0).toUpperCase()}
                          </Text>
                        </View>
                        <View style={styles.clientOptionInfo}>
                          <Text style={styles.clientOptionName}>{client.name || client.full_name}</Text>
                          <Text style={styles.clientOptionEmail}>{client.email}</Text>
                          {client.phone && <Text style={styles.clientOptionPhone}>{client.phone}</Text>}
                        </View>
                        <Ionicons name="chevron-forward" size={18} color="#D1D5DB" />
                      </TouchableOpacity>
                    ))
                  )}
                </ScrollView>
              </View>
            )}
          </Animated.View>

          {/* Service Selection Card - 2 Columns */}
          <Animated.View 
            style={[styles.sectionCard, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
          >
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIconBg, { backgroundColor: '#FEF3C7' }]}>
                <Ionicons name="briefcase" size={18} color="#F59E0B" />
              </View>
              <Text style={styles.sectionTitle}>Tipo de Servicio</Text>
              <View style={styles.requiredBadge}>
                <Text style={styles.requiredText}>REQUERIDO</Text>
              </View>
            </View>

            {loadingServices ? (
              <View style={styles.loadingServices}>
                <ActivityIndicator color="#6C1110" />
                <Text style={styles.loadingServicesText}>Cargando servicios...</Text>
              </View>
            ) : (
              <View style={styles.servicesGrid}>
                {serviceTypes.map((service, index) => {
                  const isSelected = formData.service_type === service.id;
                  const serviceColor = getServiceColor(service.color);
                  
                  return (
                    <View key={service.id} style={styles.serviceCard}>
                      <TouchableOpacity
                        style={[
                          styles.serviceCardInner,
                          isSelected && { borderColor: serviceColor, backgroundColor: `${serviceColor}10` }
                        ]}
                        onPress={() => setFormData({ ...formData, service_type: service.id })}
                        activeOpacity={0.7}
                      >
                        {isSelected ? (
                          <LinearGradient 
                            colors={[serviceColor, serviceColor + 'DD']} 
                            style={styles.serviceIconActive}
                          >
                            <Ionicons name={getServiceIcon(service.icon) as any} size={24} color="#FFF" />
                          </LinearGradient>
                        ) : (
                          <View style={[styles.serviceIcon, { backgroundColor: `${serviceColor}15` }]}>
                            <Ionicons name={getServiceIcon(service.icon) as any} size={24} color={serviceColor} />
                          </View>
                        )}
                        <Text 
                          style={[styles.serviceLabel, isSelected && { color: serviceColor, fontWeight: '700' }]}
                          numberOfLines={2}
                        >
                          {service.name}
                        </Text>
                        {service.price && (
                          <Text style={[styles.servicePrice, isSelected && { color: serviceColor }]}>
                            ${service.price}
                          </Text>
                        )}
                        {isSelected && (
                          <View style={[styles.serviceCheck, { backgroundColor: serviceColor }]}>
                            <Ionicons name="checkmark" size={12} color="#FFF" />
                          </View>
                        )}
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Tax Year & Amount Row */}
            <View style={styles.row}>
              <View style={styles.halfField}>
                <View style={styles.fieldLabelRow}>
                  <Ionicons name="calendar" size={14} color="#6B7280" />
                  <Text style={styles.fieldLabel}>Año Fiscal</Text>
                </View>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.input}
                    value={formData.tax_year}
                    onChangeText={(text) => setFormData({ ...formData, tax_year: text })}
                    keyboardType="numeric"
                    maxLength={4}
                  />
                </View>
              </View>
              
              <View style={styles.halfField}>
                <View style={styles.fieldLabelRow}>
                  <Ionicons name="cash" size={14} color="#6B7280" />
                  <Text style={styles.fieldLabel}>Monto Estimado</Text>
                </View>
                <View style={styles.inputContainer}>
                  <Text style={styles.currencyPrefix}>$</Text>
                  <TextInput
                    style={[styles.input, styles.inputWithPrefix]}
                    value={formData.estimated_amount}
                    onChangeText={(text) => setFormData({ ...formData, estimated_amount: text })}
                    keyboardType="decimal-pad"
                    placeholder={selectedServiceType?.price ? selectedServiceType.price.toString() : "0.00"}
                    placeholderTextColor="#D1D5DB"
                  />
                </View>
              </View>
            </View>

            {/* Description */}
            <View style={styles.fieldLabelRow}>
              <Ionicons name="document-text" size={14} color="#6B7280" />
              <Text style={styles.fieldLabel}>Descripción del Servicio</Text>
              <Text style={styles.requiredStar}> *</Text>
            </View>
            <View style={styles.textAreaContainer}>
              <TextInput
                style={styles.textArea}
                value={formData.description}
                onChangeText={(text) => setFormData({ ...formData, description: text })}
                placeholder={t('admin.serviceDescPlaceholder', 'Descripción del servicio a realizar...')}
                placeholderTextColor="#D1D5DB"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>
          </Animated.View>

          {/* Priority & Notes Card */}
          <Animated.View 
            style={[styles.sectionCard, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
          >
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIconBg, { backgroundColor: '#FEE2E2' }]}>
                <Ionicons name="flag" size={18} color="#EF4444" />
              </View>
              <Text style={styles.sectionTitle}>Prioridad y Notas</Text>
            </View>

            {/* Priority */}
            <Text style={styles.fieldLabel}>Nivel de Prioridad</Text>
            <View style={styles.priorityRow}>
              {priorities.map((priority) => (
                <TouchableOpacity
                  key={priority.id}
                  style={[
                    styles.priorityOption,
                    formData.priority === priority.id && { 
                      borderColor: priority.color, 
                      backgroundColor: priority.bg 
                    }
                  ]}
                  onPress={() => setFormData({ ...formData, priority: priority.id })}
                >
                  <Ionicons name={priority.icon as any} size={20} color={priority.color} />
                  <Text style={[styles.priorityLabel, { color: priority.color }]}>
                    {priority.label}
                  </Text>
                  {formData.priority === priority.id && (
                    <View style={[styles.priorityCheck, { backgroundColor: priority.color }]}>
                      <Ionicons name="checkmark" size={10} color="#FFF" />
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>

            {/* Notes */}
            <View style={styles.fieldLabelRow}>
              <Ionicons name="create" size={14} color="#6B7280" />
              <Text style={styles.fieldLabel}>Notas Internas</Text>
              <Text style={styles.optionalText}>(opcional)</Text>
            </View>
            <View style={styles.textAreaContainer}>
              <TextInput
                style={[styles.textArea, { minHeight: 80 }]}
                value={formData.notes}
                onChangeText={(text) => setFormData({ ...formData, notes: text })}
                placeholder={t('admin.serviceNotesPlaceholder', 'Notas adicionales para este trámite...')}
                placeholderTextColor="#D1D5DB"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>
          </Animated.View>

          {/* Submit Button */}
          <TouchableOpacity
            style={styles.submitButton}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={loading ? ['#9CA3AF', '#6B7280'] : ['#1C3B72', '#2D5BA8']}
              style={styles.submitGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={22} color="#FFF" />
                  <Text style={styles.submitText}>Crear Orden de Servicio</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Create Client Modal */}
      <Modal visible={showCreateClient} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <LinearGradient colors={['#10B981', '#059669']} style={styles.modalHeader}>
              <View style={styles.modalHeaderContent}>
                <Ionicons name="person-add" size={24} color="#FFF" />
                <Text style={styles.modalTitle}>Crear Nuevo Cliente</Text>
              </View>
              <TouchableOpacity 
                style={styles.modalCloseBtn}
                onPress={() => setShowCreateClient(false)}
              >
                <Ionicons name="close" size={20} color="#FFF" />
              </TouchableOpacity>
            </LinearGradient>
            
            <View style={styles.modalBody}>
              <View style={styles.modalField}>
                <Text style={styles.modalLabel}>Nombre Completo *</Text>
                <TextInput
                  style={styles.modalInput}
                  value={newClientData.name}
                  onChangeText={(text) => setNewClientData({ ...newClientData, name: text })}
                  placeholder="Nombre del cliente"
                  placeholderTextColor="#9CA3AF"
                  autoFocus
                />
              </View>
              
              <View style={styles.modalField}>
                <Text style={styles.modalLabel}>Email *</Text>
                <TextInput
                  style={styles.modalInput}
                  value={newClientData.email}
                  onChangeText={(text) => setNewClientData({ ...newClientData, email: text })}
                  placeholder="correo@ejemplo.com"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
              
              <View style={styles.modalField}>
                <Text style={styles.modalLabel}>Teléfono</Text>
                <TextInput
                  style={styles.modalInput}
                  value={newClientData.phone}
                  onChangeText={(text) => setNewClientData({ ...newClientData, phone: text })}
                  placeholder="(555) 123-4567"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="phone-pad"
                />
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity 
                  style={styles.modalCancelBtn}
                  onPress={() => setShowCreateClient(false)}
                >
                  <Text style={styles.modalCancelText}>Cancelar</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.modalCreateBtn}
                  onPress={handleCreateClient}
                  disabled={creatingClient}
                >
                  <LinearGradient 
                    colors={creatingClient ? ['#9CA3AF', '#6B7280'] : ['#10B981', '#059669']} 
                    style={styles.modalCreateGradient}
                  >
                    {creatingClient ? (
                      <ActivityIndicator color="#FFF" size="small" />
                    ) : (
                      <>
                        <Ionicons name="checkmark" size={18} color="#FFF" />
                        <Text style={styles.modalCreateText}>Crear Cliente</Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  
  // Header
  header: { paddingBottom: 16, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, overflow: 'hidden' },
  headerDecoration: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  decorCircle: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.06)' },
  decorCircle1: { width: 160, height: 160, top: -50, right: -30 },
  decorCircle2: { width: 100, height: 100, bottom: -20, left: -20 },
  headerContent: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, zIndex: 1 },
  backButton: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', marginLeft: 12, gap: 12 },
  headerIconBg: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#FFF' },
  headerSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 1 },
  
  // Progress
  progressContainer: { marginTop: 16, paddingHorizontal: 20 },
  progressBar: { height: 6, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#FFF', borderRadius: 3 },
  progressText: { fontSize: 11, color: 'rgba(255,255,255,0.8)', marginTop: 6, textAlign: 'right' },
  
  // Form
  scrollView: { flex: 1 },
  formContent: { padding: 16, paddingTop: 20 },
  
  // Section Card
  sectionCard: { backgroundColor: '#FFF', borderRadius: 20, padding: 18, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 3 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 10 },
  sectionIconBg: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1F2937', flex: 1 },
  requiredBadge: { backgroundColor: '#FEE2E2', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  requiredText: { fontSize: 9, fontWeight: '700', color: '#EF4444', letterSpacing: 0.5 },
  
  // Client Selector
  clientSelector: { borderWidth: 2, borderColor: '#E5E7EB', borderRadius: 16, padding: 14, borderStyle: 'dashed' },
  clientSelectorSelected: { borderStyle: 'solid', borderColor: '#6366F1', backgroundColor: '#F5F3FF' },
  selectedClientRow: { flexDirection: 'row', alignItems: 'center' },
  clientAvatar: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarText: { fontSize: 20, fontWeight: '700', color: '#FFF' },
  clientInfo: { flex: 1 },
  clientName: { fontSize: 16, fontWeight: '600', color: '#1F2937' },
  clientEmail: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  changeBtn: { backgroundColor: '#EEF2FF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  changeBtnText: { fontSize: 12, fontWeight: '600', color: '#6366F1' },
  placeholderRow: { flexDirection: 'row', alignItems: 'center' },
  placeholderIcon: { width: 48, height: 48, borderRadius: 14, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  placeholderText: { flex: 1, fontSize: 15, color: '#9CA3AF' },
  
  // Client Picker
  clientPickerContainer: { marginTop: 12, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 14, overflow: 'hidden' },
  searchBox: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', backgroundColor: '#F9FAFB', gap: 10 },
  searchInput: { flex: 1, fontSize: 15, color: '#1F2937' },
  
  // Create Client Button
  createClientButton: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: '#ECFDF5', borderBottomWidth: 1, borderBottomColor: '#D1FAE5' },
  createClientIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  createClientInfo: { flex: 1 },
  createClientTitle: { fontSize: 14, fontWeight: '600', color: '#059669' },
  createClientDesc: { fontSize: 12, color: '#10B981', marginTop: 2 },
  
  clientList: { maxHeight: 280 },
  clientOption: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  clientOptionAvatar: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#EEF2FF', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  clientOptionAvatarText: { fontSize: 15, fontWeight: '600', color: '#6366F1' },
  clientOptionInfo: { flex: 1 },
  clientOptionName: { fontSize: 14, fontWeight: '600', color: '#1F2937' },
  clientOptionEmail: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  clientOptionPhone: { fontSize: 11, color: '#9CA3AF', marginTop: 1 },
  loadingClients: { padding: 30, alignItems: 'center', gap: 10 },
  loadingClientsText: { fontSize: 13, color: '#6B7280' },
  noResults: { padding: 30, alignItems: 'center', gap: 8 },
  noResultsText: { fontSize: 14, color: '#6B7280' },
  noResultsHint: { fontSize: 12, color: '#10B981' },
  
  // Services Grid - 2 Columns
  servicesGrid: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    marginBottom: 16,
    marginHorizontal: -5,
  },
  serviceCard: { 
    width: '50%',
    paddingHorizontal: 5,
    marginBottom: 10,
  },
  serviceCardInner: {
    padding: 14, 
    borderRadius: 16, 
    backgroundColor: '#F9FAFB', 
    borderWidth: 2, 
    borderColor: 'transparent', 
    alignItems: 'center', 
    position: 'relative',
    minHeight: 110,
  },
  serviceIcon: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  serviceIconActive: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  serviceLabel: { fontSize: 12, color: '#6B7280', textAlign: 'center', fontWeight: '500', lineHeight: 16 },
  servicePrice: { fontSize: 11, color: '#9CA3AF', marginTop: 4 },
  serviceCheck: { position: 'absolute', top: 8, right: 8, width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  loadingServices: { padding: 30, alignItems: 'center', gap: 10 },
  loadingServicesText: { fontSize: 13, color: '#6B7280' },
  
  // Fields
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8, marginTop: 4 },
  fieldLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8, marginTop: 12 },
  requiredStar: { color: '#EF4444', fontWeight: '700' },
  optionalText: { fontSize: 11, color: '#9CA3AF', marginLeft: 4 },
  
  // Row
  row: { flexDirection: 'row', gap: 12, marginTop: 4 },
  halfField: { flex: 1 },
  
  // Input
  inputContainer: { backgroundColor: '#F9FAFB', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', overflow: 'hidden', position: 'relative' },
  input: { padding: 14, fontSize: 16, color: '#1F2937' },
  inputWithPrefix: { paddingLeft: 28 },
  currencyPrefix: { position: 'absolute', left: 14, top: 14, fontSize: 16, color: '#6B7280', zIndex: 1 },
  
  // TextArea
  textAreaContainer: { backgroundColor: '#F9FAFB', borderRadius: 14, borderWidth: 1, borderColor: '#E5E7EB' },
  textArea: { padding: 14, fontSize: 15, color: '#1F2937', minHeight: 100 },
  
  // Priority
  priorityRow: { flexDirection: 'row', gap: 10 },
  priorityOption: { flex: 1, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 14, borderRadius: 14, backgroundColor: '#F9FAFB', borderWidth: 2, borderColor: 'transparent', gap: 6, position: 'relative' },
  priorityLabel: { fontSize: 13, fontWeight: '600' },
  priorityCheck: { position: 'absolute', top: 6, right: 6, width: 16, height: 16, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  
  // Submit
  submitButton: { marginTop: 8, borderRadius: 16, overflow: 'hidden', shadowColor: '#1C3B72', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 6 },
  submitGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 18, gap: 10 },
  submitText: { fontSize: 17, fontWeight: '700', color: '#FFF' },
  
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#FFF', borderRadius: 24, overflow: 'hidden' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20 },
  modalHeaderContent: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#FFF' },
  modalCloseBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  modalBody: { padding: 20 },
  modalField: { marginBottom: 16 },
  modalLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8 },
  modalInput: { backgroundColor: '#F9FAFB', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', padding: 14, fontSize: 16, color: '#1F2937' },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  modalCancelBtn: { flex: 1, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center' },
  modalCancelText: { fontSize: 15, fontWeight: '600', color: '#6B7280' },
  modalCreateBtn: { flex: 1, borderRadius: 12, overflow: 'hidden' },
  modalCreateGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 14, gap: 8 },
  modalCreateText: { fontSize: 15, fontWeight: '600', color: '#FFF' },
});

export default CreateServiceOrder;
