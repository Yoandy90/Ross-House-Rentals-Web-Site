/**
 * Dynamic Service Checkout Flow - Complete Implementation
 * Multi-step checkout: Service Selection → Documents → Form → Payment → Appointment → Confirmation
 * 
 * Features:
 * - Multiple documents per type
 * - Additional document types (1099-NEC, 1095-A, Others)
 * - Add payment card modal (without leaving flow)
 * - Square calendar integration for available slots
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Dimensions,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Image,
  RefreshControl,
  FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../../constants/colors';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../../services/api';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n/config';

const { width } = Dimensions.get('window');

interface DynamicService {
  id: string;
  name: string;
  description: string;
  short_description: string;
  price: number;
  duration_minutes: number;
  category: string;
  icon: string;
  color: string;
  modality: string[];
  required_documents: Array<{
    id: string;
    name: string;
    description: string;
    required: boolean;
    allow_multiple?: boolean;
  }>;
  custom_fields: Array<{
    id: string;
    name: string;
    label: string;
    field_type: string;
    required: boolean;
    options?: string[];
    placeholder?: string;
    min_value?: number;
    max_value?: number;
  }>;
}

interface PaymentMethod {
  id: string;
  card_brand: string;
  last_4: string;
  exp_month: number;
  exp_year: number;
  is_default: boolean;
  cardholder_name?: string;
}

interface TimeSlot {
  time: string;
  available: boolean;
}

interface UploadedDocument {
  id: string;
  uri: string;
  base64: string;
  type: string;
  name?: string;
  docType: string;
}

// Additional document types that users can add
const ADDITIONAL_DOC_TYPES = [
  { id: 'w2_extra', nameKey: 'serviceCheckout.docTypes.w2Extra', descKey: 'serviceCheckout.docTypes.w2ExtraDesc', icon: 'document-text' },
  { id: '1099_nec', nameKey: 'serviceCheckout.docTypes.1099nec', descKey: 'serviceCheckout.docTypes.1099necDesc', icon: 'cash' },
  { id: '1099_misc', nameKey: 'serviceCheckout.docTypes.1099misc', descKey: 'serviceCheckout.docTypes.1099miscDesc', icon: 'receipt' },
  { id: '1095_a', nameKey: 'serviceCheckout.docTypes.1095a', descKey: 'serviceCheckout.docTypes.1095aDesc', icon: 'medkit' },
  { id: '1098', nameKey: 'serviceCheckout.docTypes.1098', descKey: 'serviceCheckout.docTypes.1098Desc', icon: 'home' },
  { id: '1098_t', nameKey: 'serviceCheckout.docTypes.1098t', descKey: 'serviceCheckout.docTypes.1098tDesc', icon: 'school' },
  { id: 'bank_statement', nameKey: 'serviceCheckout.docTypes.bankStatement', descKey: 'serviceCheckout.docTypes.bankStatementDesc', icon: 'card' },
  { id: 'otros', nameKey: 'serviceCheckout.docTypes.other', descKey: 'serviceCheckout.docTypes.otherDesc', icon: 'folder' },
];

export default function ServiceCheckout() {
  const { serviceId, serviceType, serviceName, servicePrice, serviceDuration, serviceIcon, serviceColor, serviceDesc } = useLocalSearchParams();
  const colors = useThemeColors();
  const { t } = useTranslation();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  
  // Main state
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [service, setService] = useState<DynamicService | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  
  // Step 1 data - Service selection (modality)
  const [selectedModality, setSelectedModality] = useState<'in_person' | 'remote'>('in_person');
  
  // Step 2 data - Documents (now supports multiple per type)
  const [uploadedDocs, setUploadedDocs] = useState<UploadedDocument[]>([]);
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);
  const [showAddDocModal, setShowAddDocModal] = useState(false);
  
  // Step 3 data - Custom fields
  const [customFieldsData, setCustomFieldsData] = useState<Record<string, any>>({});
  
  // Step 4 data - Payment
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string | null>(null);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [showAddCardModal, setShowAddCardModal] = useState(false);
  
  // Step 5 data - Appointment (Square integrated)
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  
  // Add Card form state
  const [newCardNumber, setNewCardNumber] = useState('');
  const [newCardExpMonth, setNewCardExpMonth] = useState('');
  const [newCardExpYear, setNewCardExpYear] = useState('');
  const [newCardCVV, setNewCardCVV] = useState('');
  const [newCardName, setNewCardName] = useState('');
  const [savingCard, setSavingCard] = useState(false);
  
  // Notes
  const [notes, setNotes] = useState('');

  const steps = [
    { title: t('serviceCheckout.steps.service', 'Servicio'), icon: 'document-text' as const },
    { title: t('serviceCheckout.steps.documents', 'Documentos'), icon: 'cloud-upload' as const },
    { title: t('serviceCheckout.steps.form', 'Formulario'), icon: 'create' as const },
    { title: t('serviceCheckout.steps.payment', 'Pago'), icon: 'card' as const },
    { title: t('serviceCheckout.steps.appointment', 'Cita'), icon: 'calendar' as const },
    { title: t('serviceCheckout.steps.confirm', 'Confirmar'), icon: 'checkmark-circle' as const },
  ];

  // Load initial data
  useEffect(() => {
    loadService();
    loadPaymentMethods();
  }, [serviceId]);

  const loadService = async () => {
    try {
      setLoading(true);
      let serviceData = null;

      // 1. Try loading by direct ID
      try {
        const currentLang = i18n.language || 'es';
        const response = await api.get(`/dynamic-services/${serviceId}?lang=${currentLang}`);
        serviceData = response.data;
      } catch (err: any) {
        console.log('Direct ID fetch failed, trying service_type fallback...');
      }

      // 2. If direct ID failed (e.g. fallback IDs like 'fb-personal-tax'), try finding by service_type
      if (!serviceData && serviceType) {
        try {
          const currentLang = i18n.language || 'es';
          const listResponse = await api.get(`/dynamic-services?lang=${currentLang}`);
          const allServices = listResponse.data?.services || [];
          serviceData = allServices.find((s: any) => s.service_type === serviceType);
          if (serviceData) {
            console.log('Found service by service_type:', serviceType);
          }
        } catch (err2) {
          console.log('Service list fallback also failed');
        }
      }

      // 3. If API calls failed but we have params data, build a minimal service object
      if (!serviceData && serviceName) {
        serviceData = {
          id: serviceId as string,
          name: serviceName as string,
          price: parseFloat(String(servicePrice || '0').replace('$', '')),
          duration_minutes: parseInt(String(serviceDuration || '30')),
          icon: serviceIcon as string || 'briefcase',
          color: serviceColor as string || '#6C1110',
          description: serviceDesc as string || '',
          service_type: serviceType as string || 'general',
          modality: ['in_person', 'remote'],
          required_documents: [],
          custom_fields: [],
        };
        console.log('Using navigation params as service data fallback');
      }

      if (!serviceData) {
        throw new Error('Could not load service data');
      }

      setService(serviceData);
      
      // Initialize modality
      if (serviceData.modality?.length === 1) {
        setSelectedModality(serviceData.modality[0] as 'in_person' | 'remote');
      }
      
      // Initialize custom fields
      const initialData: Record<string, any> = {};
      serviceData.custom_fields?.forEach((field: any) => {
        if (field.field_type === 'checkbox') {
          initialData[field.id] = false;
        } else if (field.field_type === 'number') {
          initialData[field.id] = field.min_value || 0;
        } else {
          initialData[field.id] = '';
        }
      });
      setCustomFieldsData(initialData);
    } catch (error) {
      console.error('Error loading service:', error);
      Alert.alert('Error', t('serviceCheckout.loadServiceError', 'No se pudo cargar el servicio'));
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const loadPaymentMethods = async () => {
    try {
      setLoadingPayments(true);
      
      // Load from ALL sources: NMI (new), Stripe (legacy), and Manual - same as payment-methods screen
      const [nmiResponse, stripeResponse, manualResponse] = await Promise.all([
        api.get('/payment-methods').catch(() => ({ data: { payment_methods: [] } })),
        api.get('/payments/payment-methods').catch(() => ({ data: [] })),
        api.get('/payments/manual-payment-methods').catch(() => ({ data: [] }))
      ]);
      
      // NMI cards + bank accounts
      const nmiMethods = (nmiResponse.data.payment_methods || nmiResponse.data || []).map((m: any) => ({
        ...m,
        type: m.type || 'card',
        last4: m.last4 || m.last_4 || m.bank_account_last4 || '',
        brand: m.brand || m.card_brand || (m.type === 'bank_account' ? 'ACH' : 'Card'),
        account_type: m.account_type || m.bank_account_type || '',
        bank_name: m.bank_name || m.account_holder_name || '',
      }));
      
      // Stripe (legacy) and Manual methods
      const stripeMethods = (stripeResponse.data || []).map((m: any) => ({ ...m, type: 'stripe' }));
      const manualMethods = (manualResponse.data || []).map((m: any) => ({ ...m, type: 'manual' }));
      
      const methods = [...nmiMethods, ...stripeMethods, ...manualMethods];
      setPaymentMethods(methods);
      
      // Auto-select default method
      const defaultMethod = methods.find((m: PaymentMethod) => m.is_default);
      if (defaultMethod) {
        setSelectedPaymentMethod(defaultMethod.id);
      } else if (methods.length > 0) {
        setSelectedPaymentMethod(methods[0].id);
      }
    } catch (error) {
      console.error('Error loading payment methods:', error);
    } finally {
      setLoadingPayments(false);
    }
  };

  // Load available time slots from closed-circuit calendar (circuito cerrado)
  const loadTimeSlots = async (date: string) => {
    try {
      setLoadingSlots(true);
      setSelectedTime(null);
      
      // Use the public availability endpoint connected to admin office hours (circuito cerrado)
      const response = await api.get(`/public/available-slots?date=${date}`);
      
      if (response.data && response.data.length > 0) {
        // Map to expected format
        const slots = response.data.map((slot: any) => ({
          time: slot.time,
          available: slot.available,
          start_at: slot.datetime || `${date}T${slot.time}:00-05:00`
        }));
        setAvailableSlots(slots);
      } else {
        // No slots from backend = office closed or fully booked
        setAvailableSlots([]);
      }
    } catch (error) {
      console.error('Error loading time slots:', error);
      // Try fallback endpoint
      try {
        const fallbackResponse = await api.get(`/appointments/available-slots?date=${date}`);
        const slots = fallbackResponse.data.slots || fallbackResponse.data || [];
        if (Array.isArray(slots) && slots.length > 0) {
          setAvailableSlots(slots.map((s: any) => ({
            time: s.time,
            available: s.available !== false,
            start_at: s.datetime || `${date}T${s.time}:00-06:00`
          })));
        } else {
          setAvailableSlots([]);
        }
      } catch {
        setAvailableSlots([]);
      }
    } finally {
      setLoadingSlots(false);
    }
  };

  const generateDefaultSlots = (): TimeSlot[] => [
    { time: '09:00', available: true },
    { time: '10:00', available: true },
    { time: '11:00', available: true },
    { time: '12:00', available: true },
    { time: '14:00', available: true },
    { time: '15:00', available: true },
    { time: '16:00', available: true },
    { time: '17:00', available: true },
  ];

  // Document handling - now supports multiple documents & multi-select
  const pickDocument = async (docType: string, docName: string, source: 'camera' | 'gallery') => {
    try {
      setUploadingDoc(docType);
      
      let result;
      if (source === 'camera') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          Alert.alert(t('serviceCheckout.cameraPermRequired', 'Permiso Requerido'), t('serviceCheckout.cameraPermMessage', 'Se necesita acceso a la cámara'));
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.7,
          base64: true,
        });
      } else {
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsMultipleSelection: true,
          selectionLimit: 10,
          quality: 0.7,
          base64: true,
        });
      }

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const newDocs: UploadedDocument[] = result.assets.map((asset, index) => ({
          id: `${docType}_${Date.now()}_${index}`,
          uri: asset.uri,
          base64: asset.base64 || '',
          type: 'image',
          name: asset.fileName || `${docName} ${getDocsByType(docType).length + index + 1}`,
          docType: docType,
        }));
        setUploadedDocs(prev => [...prev, ...newDocs]);
      }
    } catch (error) {
      console.error('Error picking document:', error);
      Alert.alert(t('common.error', 'Error'), t('serviceCheckout.docPickError', 'No se pudo seleccionar el documento'));
    } finally {
      setUploadingDoc(null);
    }
  };

  const showDocumentOptions = (docType: string, docName: string) => {
    Alert.alert(
      t('serviceCheckout.uploadDocument', 'Subir Documento'),
      t('serviceCheckout.uploadDocPrompt', {defaultValue: `¿Cómo deseas agregar "${docName}"?`, name: docName}),
      [
        { text: t('serviceCheckout.takePhoto', '📷 Tomar Foto'), onPress: () => pickDocument(docType, docName, 'camera') },
        { text: t('serviceCheckout.fromGallery', '🖼️ Galería (múltiple)'), onPress: () => pickDocument(docType, docName, 'gallery') },
        { text: t('common.cancel', 'Cancelar'), style: 'cancel' },
      ]
    );
  };

  const removeDocument = (docId: string) => {
    setUploadedDocs(prev => prev.filter(d => d.id !== docId));
  };

  // Get documents by type
  const getDocsByType = (docType: string) => {
    return uploadedDocs.filter(d => d.docType === docType);
  };

  // Check if a required document type has at least one document
  const hasRequiredDoc = (docType: string) => {
    return uploadedDocs.some(d => d.docType === docType);
  };

  // Validation
  const validateStep = (): boolean => {
    switch (currentStep) {
      case 0: // Service info
        return true;
        
      case 1: // Documents
        const requiredDocs = service?.required_documents?.filter(d => d.required) || [];
        const missingDocs = requiredDocs.filter(d => !hasRequiredDoc(d.id));
        if (missingDocs.length > 0) {
          Alert.alert(
            t('serviceCheckout.missingDocs', 'Documentos Faltantes'),
            t('serviceCheckout.missingDocsMessage', 'Por favor sube al menos uno de los siguientes documentos:') + '\n\n' + missingDocs.map(d => '• ' + d.name).join('\n')
          );
          return false;
        }
        return true;
        
      case 2: // Custom fields
        const requiredFields = service?.custom_fields?.filter(f => f.required) || [];
        for (const field of requiredFields) {
          const value = customFieldsData[field.id];
          if (value === '' || value === undefined || value === null) {
            Alert.alert(t('serviceCheckout.fieldRequired', 'Campo Requerido'), t('serviceCheckout.fieldRequiredMessage', {defaultValue: `Por favor completa: ${field.label}`, field: field.label}));
            return false;
          }
        }
        return true;
        
      case 3: // Payment
        // Payment method is optional - will be charged at completion
        return true;
        
      case 4: // Appointment
        if (!selectedDate || !selectedTime) {
          Alert.alert(t('serviceCheckout.appointmentRequired', 'Cita Requerida'), t('serviceCheckout.appointmentRequiredMessage', 'Por favor selecciona fecha y hora para tu cita'));
          return false;
        }
        return true;
        
      default:
        return true;
    }
  };

  // Navigation
  const handleNext = () => {
    if (validateStep()) {
      if (currentStep < steps.length - 1) {
        setCurrentStep(prev => prev + 1);
        scrollRef.current?.scrollTo({ y: 0, animated: true });
      }
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    } else {
      router.back();
    }
  };

  // Submit order
  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      
      // Prepare documents data
      const documentsPayload = uploadedDocs.map(doc => ({
        document_id: doc.docType,
        document_name: doc.name,
        base64: doc.base64,
        type: doc.type,
      }));

      // Get selected payment method details
      const paymentMethod = paymentMethods.find(m => m.id === selectedPaymentMethod);

      const orderData = {
        service_id: serviceId,
        documents: documentsPayload,
        custom_fields_data: customFieldsData,
        payment_method_id: selectedPaymentMethod,
        payment_method_details: paymentMethod ? {
          card_brand: paymentMethod.card_brand,
          last_4: paymentMethod.last_4,
        } : null,
        appointment_date: selectedDate,
        appointment_time: selectedTime,
        modality: selectedModality,
        notes: notes.trim() || null,
      };

      const response = await api.post('/service-orders', orderData);
      
      if (response.data.success) {
        const order = response.data.order;
        Alert.alert(
          '✅ ¡Orden Creada!',
          `Tu orden #${order.order_number} ha sido creada exitosamente.\n\nTe esperamos el ${formatDateDisplay(selectedDate!)} a las ${selectedTime}.\n\n${selectedModality === 'remote' ? '📹 Recibirás un enlace para tu cita virtual.' : '🏢 Te esperamos en nuestra oficina.'}`,
          [
            { 
              text: t('serviceCheckout.viewOrders', 'Ver Mis Órdenes'), 
              onPress: () => router.replace('/(tabs)/my-projects') 
            },
            { 
              text: t('serviceCheckout.goHome', 'Ir al Inicio'), 
              onPress: () => router.replace('/') 
            },
          ]
        );
      }
    } catch (error: any) {
      console.error('Error creating order:', error);
      Alert.alert(
        t('common.error', 'Error'),
        error.response?.data?.detail || t('serviceCheckout.orderFailed', 'No se pudo crear la orden. Por favor intenta de nuevo.')
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Date helpers
  const getNextDays = (count: number) => {
    const days = [];
    const today = new Date();
    let daysAdded = 0;
    let offset = 1;
    
    while (daysAdded < count && offset < 60) {
      const date = new Date(today);
      date.setDate(today.getDate() + offset);
      
      // Skip Sundays (day 0)
      if (date.getDay() !== 0) {
        days.push({
          date: date.toISOString().split('T')[0],
          dayName: date.toLocaleDateString(i18n.language === 'en' ? 'en-US' : 'es-ES', { weekday: 'short' }),
          dayNum: date.getDate(),
          month: date.toLocaleDateString(i18n.language === 'en' ? 'en-US' : 'es-ES', { month: 'short' }),
          fullDate: date,
        });
        daysAdded++;
      }
      offset++;
    }
    return days;
  };

  const formatDateDisplay = (dateStr: string): string => {
    const date = new Date(dateStr + 'T12:00:00');
    return date.toLocaleDateString(i18n.language === 'en' ? 'en-US' : 'es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  };

  // Card brand icons
  const getCardIcon = (brand: string): string => {
    const brandLower = brand?.toLowerCase() || '';
    if (brandLower.includes('visa')) return 'card';
    if (brandLower.includes('master')) return 'card';
    if (brandLower.includes('amex') || brandLower.includes('american')) return 'card';
    return 'card-outline';
  };

  // Refresh handler
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadService(), loadPaymentMethods()]);
    setRefreshing(false);
  }, []);

  // Render steps indicator
  const renderStepIndicator = () => (
    <View style={styles.stepIndicator}>
      {steps.map((step, index) => (
        <View key={index} style={styles.stepDot}>
          <View 
            style={[
              styles.stepCircle,
              index < currentStep && styles.stepCompleted,
              index === currentStep && styles.stepActive,
            ]}
          >
            {index < currentStep ? (
              <Ionicons name="checkmark" size={14} color="#fff" />
            ) : (
              <Text style={[
                styles.stepNumber,
                index === currentStep && styles.stepNumberActive,
              ]}>
                {index + 1}
              </Text>
            )}
          </View>
          {index < steps.length - 1 && (
            <View style={[
              styles.stepLine,
              index < currentStep && styles.stepLineCompleted,
            ]} />
          )}
        </View>
      ))}
    </View>
  );

  // Render Step 1 - Service Info
  const renderServiceStep = () => (
    <View style={styles.stepContent}>
      <View style={[styles.serviceCard, { borderLeftColor: service?.color || colors.primary }]}>
        <View style={[styles.serviceIconBg, { backgroundColor: (service?.color || colors.primary) + '20' }]}>
          <Ionicons name={(service?.icon as any) || 'document'} size={36} color={service?.color || colors.primary} />
        </View>
        <Text style={styles.serviceName}>{service?.name}</Text>
        <Text style={styles.serviceDesc}>{service?.description}</Text>
        
        <View style={styles.serviceDetails}>
          <View style={styles.serviceDetailItem}>
            <Ionicons name="cash-outline" size={22} color={colors.success} />
            <Text style={styles.servicePrice}>${service?.price?.toFixed(2)}</Text>
          </View>
          <View style={styles.serviceDetailItem}>
            <Ionicons name="time-outline" size={22} color={colors.textGray} />
            <Text style={styles.serviceDuration}>{service?.duration_minutes} min</Text>
          </View>
        </View>
        
        {service?.modality && service.modality.length > 1 && (
          <View style={styles.modalitySection}>
            <Text style={styles.sectionTitle}>{t('serviceCheckout.howToAttend', '¿Cómo deseas atenderte?')}</Text>
            <View style={styles.modalityOptions}>
              {service.modality.includes('in_person') && (
                <TouchableOpacity
                  style={[
                    styles.modalityOption,
                    selectedModality === 'in_person' && styles.modalityOptionActive
                  ]}
                  onPress={() => setSelectedModality('in_person')}
                >
                  <Ionicons 
                    name="business" 
                    size={28} 
                    color={selectedModality === 'in_person' ? colors.primary : colors.textGray} 
                  />
                  <Text style={[
                    styles.modalityText,
                    selectedModality === 'in_person' && styles.modalityTextActive
                  ]}>
                    Presencial
                  </Text>
                  <Text style={styles.modalityHint}>{t('serviceCheckout.inPersonHint', 'En nuestra oficina')}</Text>
                </TouchableOpacity>
              )}
              {service.modality.includes('remote') && (
                <TouchableOpacity
                  style={[
                    styles.modalityOption,
                    selectedModality === 'remote' && styles.modalityOptionActive
                  ]}
                  onPress={() => setSelectedModality('remote')}
                >
                  <Ionicons 
                    name="videocam" 
                    size={28} 
                    color={selectedModality === 'remote' ? colors.primary : colors.textGray} 
                  />
                  <Text style={[
                    styles.modalityText,
                    selectedModality === 'remote' && styles.modalityTextActive
                  ]}>
                    Virtual
                  </Text>
                  <Text style={styles.modalityHint}>{t('serviceCheckout.virtualHint', 'Por videollamada')}</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      </View>
    </View>
  );

  // Render Step 2 - Documents (with multiple upload support)
  const renderDocumentsStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>{t('serviceCheckout.uploadDocs', '📎 Sube tus Documentos')}</Text>
      <Text style={styles.stepSubtitle}>
        {t('serviceCheckout.uploadDocsSubtitle', 'Los documentos son necesarios para procesar tu servicio. Puedes subir varios de cada tipo.')}
      </Text>
      
      {/* Required Documents */}
      {service?.required_documents && service.required_documents.length > 0 && (
        <>
          {service.required_documents.map((doc) => {
            const docsOfType = getDocsByType(doc.id);
            const hasDoc = docsOfType.length > 0;
            
            return (
              <View key={doc.id} style={styles.docSection}>
                <TouchableOpacity
                  style={[
                    styles.docItem,
                    hasDoc && styles.docItemUploaded,
                    uploadingDoc === doc.id && styles.docItemUploading,
                  ]}
                  onPress={() => showDocumentOptions(doc.id, doc.name)}
                  disabled={uploadingDoc === doc.id}
                >
                  <View style={styles.docLeft}>
                    {uploadingDoc === doc.id ? (
                      <View style={styles.docIconLoading}>
                        <ActivityIndicator size="small" color={colors.primary} />
                      </View>
                    ) : hasDoc ? (
                      <View style={styles.docIconSuccess}>
                        <Ionicons name="checkmark" size={22} color="#fff" />
                      </View>
                    ) : (
                      <View style={styles.docIcon}>
                        <Ionicons name="cloud-upload-outline" size={26} color={colors.primary} />
                      </View>
                    )}
                    <View style={styles.docInfo}>
                      <Text style={styles.docName}>{doc.name}</Text>
                      <Text style={styles.docDesc}>{doc.description}</Text>
                      {hasDoc && (
                        <Text style={styles.docUploaded}>{t('serviceCheckout.documentsUploaded', {defaultValue: '✓ {{count}} documento(s) subido(s)', count: docsOfType.length})}</Text>
                      )}
                    </View>
                  </View>
                  <View style={styles.docRight}>
                    {doc.required && !hasDoc && (
                      <View style={styles.requiredBadge}>
                        <Text style={styles.requiredText}>{t('serviceCheckout.required', 'Requerido')}</Text>
                      </View>
                    )}
                    <Ionicons name="add-circle" size={28} color={colors.primary} />
                  </View>
                </TouchableOpacity>
                
                {/* Show uploaded documents of this type - compact grid */}
                {docsOfType.length > 0 && (
                  <View style={styles.docThumbnailGrid}>
                    {docsOfType.map((uploadedDoc) => (
                      <View key={uploadedDoc.id} style={styles.docThumbnailWrapper}>
                        <Image 
                          source={{ uri: uploadedDoc.uri }} 
                          style={styles.docThumbnailCompact}
                          resizeMode="cover"
                        />
                        <TouchableOpacity
                          style={styles.docRemoveBadge}
                          onPress={() => removeDocument(uploadedDoc.id)}
                        >
                          <Ionicons name="close" size={12} color="#fff" />
                        </TouchableOpacity>
                      </View>
                    ))}
                    <TouchableOpacity
                      style={styles.docAddMoreBtn}
                      onPress={() => showDocumentOptions(doc.id, doc.name)}
                    >
                      <Ionicons name="add" size={20} color={colors.primary} />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })}
        </>
      )}
      
      {/* Additional Documents Section */}
      <View style={styles.addDocSection}>
        <Text style={styles.addDocTitle}>{t('serviceCheckout.additionalDocs', '📄 Documentos Adicionales')}</Text>
        <Text style={styles.addDocSubtitle}>
          {t('serviceCheckout.moreDocsHint', '¿Tienes más documentos? Agrégalos aquí')}
        </Text>
        
        <TouchableOpacity
          style={styles.addDocButton}
          onPress={() => setShowAddDocModal(true)}
        >
          <Ionicons name="add-circle-outline" size={24} color={colors.primary} />
          <Text style={styles.addDocButtonText}>{t('serviceCheckout.addAnotherDoc', 'Agregar Otro Documento')}</Text>
        </TouchableOpacity>
        
        {/* Show additional uploaded documents */}
        {ADDITIONAL_DOC_TYPES.map((docType) => {
          const docsOfType = getDocsByType(docType.id);
          if (docsOfType.length === 0) return null;
          
          return (
            <View key={docType.id} style={styles.additionalDocGroup}>
              <Text style={styles.additionalDocLabel}>
                <Ionicons name={docType.icon as any} size={16} color={colors.primary} /> {t(docType.nameKey)}
              </Text>
              <View style={styles.docThumbnailGrid}>
                {docsOfType.map((doc) => (
                  <View key={doc.id} style={styles.docThumbnailWrapper}>
                    <Image 
                      source={{ uri: doc.uri }} 
                      style={styles.docThumbnailCompact}
                      resizeMode="cover"
                    />
                    <TouchableOpacity
                      style={styles.docRemoveBadge}
                      onPress={() => removeDocument(doc.id)}
                    >
                      <Ionicons name="close" size={12} color="#fff" />
                    </TouchableOpacity>
                  </View>
                ))}
                <TouchableOpacity
                  style={styles.docAddMoreBtn}
                  onPress={() => showDocumentOptions(docType.id, t(docType.nameKey))}
                >
                  <Ionicons name="add" size={20} color={colors.primary} />
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );

  // Render Step 3 - Custom Fields
  const renderCustomFieldsStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>{t('serviceCheckout.additionalInfo', '📝 Información Adicional')}</Text>
      <Text style={styles.stepSubtitle}>
        Completa los siguientes campos para personalizar tu servicio
      </Text>
      
      {service?.custom_fields && service.custom_fields.length > 0 ? (
        service.custom_fields.map((field) => (
          <View key={field.id} style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>
              {field.label}
              {field.required && <Text style={styles.required}> *</Text>}
            </Text>
            
            {field.field_type === 'text' && (
              <TextInput
                style={styles.textInput}
                value={customFieldsData[field.id] || ''}
                onChangeText={(text) => setCustomFieldsData(prev => ({ ...prev, [field.id]: text }))}
                placeholder={field.placeholder || `Ingresa ${field.label.toLowerCase()}`}
                placeholderTextColor="#9ca3af"
              />
            )}
            
            {field.field_type === 'textarea' && (
              <TextInput
                style={[styles.textInput, styles.textAreaInput]}
                value={customFieldsData[field.id] || ''}
                onChangeText={(text) => setCustomFieldsData(prev => ({ ...prev, [field.id]: text }))}
                placeholder={field.placeholder || `Ingresa ${field.label.toLowerCase()}`}
                placeholderTextColor="#9ca3af"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            )}
            
            {field.field_type === 'number' && (
              <View style={styles.numberInputRow}>
                <TouchableOpacity
                  style={styles.numberButton}
                  onPress={() => {
                    const current = customFieldsData[field.id] || 0;
                    const min = field.min_value ?? 0;
                    if (current > min) {
                      setCustomFieldsData(prev => ({ ...prev, [field.id]: current - 1 }));
                    }
                  }}
                >
                  <Ionicons name="remove" size={24} color={colors.primary} />
                </TouchableOpacity>
                <TextInput
                  style={styles.numberInput}
                  value={String(customFieldsData[field.id] ?? 0)}
                  onChangeText={(text) => {
                    const num = parseInt(text) || 0;
                    setCustomFieldsData(prev => ({ ...prev, [field.id]: num }));
                  }}
                  keyboardType="numeric"
                  textAlign="center"
                />
                <TouchableOpacity
                  style={styles.numberButton}
                  onPress={() => {
                    const current = customFieldsData[field.id] || 0;
                    const max = field.max_value ?? 100;
                    if (current < max) {
                      setCustomFieldsData(prev => ({ ...prev, [field.id]: current + 1 }));
                    }
                  }}
                >
                  <Ionicons name="add" size={24} color={colors.primary} />
                </TouchableOpacity>
              </View>
            )}
            
            {field.field_type === 'select' && field.options && (
              <View style={styles.selectOptions}>
                {field.options.map((option) => (
                  <TouchableOpacity
                    key={option}
                    style={[
                      styles.selectOption,
                      customFieldsData[field.id] === option && styles.selectOptionActive
                    ]}
                    onPress={() => setCustomFieldsData(prev => ({ ...prev, [field.id]: option }))}
                  >
                    <Text style={[
                      styles.selectOptionText,
                      customFieldsData[field.id] === option && styles.selectOptionTextActive
                    ]}>
                      {option}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            
            {field.field_type === 'checkbox' && (
              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() => setCustomFieldsData(prev => ({ ...prev, [field.id]: !prev[field.id] }))}
              >
                <View style={[
                  styles.checkbox,
                  customFieldsData[field.id] && styles.checkboxChecked
                ]}>
                  {customFieldsData[field.id] && (
                    <Ionicons name="checkmark" size={18} color="#fff" />
                  )}
                </View>
                <Text style={styles.checkboxLabel}>
                  {customFieldsData[field.id] ? t('serviceCheckout.yes', 'Sí') : t('serviceCheckout.no', 'No')}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        ))
      ) : (
        <View style={styles.noDocsMessage}>
          <View style={styles.noDocsIconBg}>
            <Ionicons name="checkmark-circle" size={48} color={colors.success} />
          </View>
          <Text style={styles.noDocsTitle}>{t('serviceCheckout.allReady', '¡Todo listo!')}</Text>
          <Text style={styles.noDocsText}>{t('serviceCheckout.noAdditionalInfoRequired', 'No se requiere información adicional')}</Text>
        </View>
      )}
    </View>
  );

  // Render Step 4 - Payment (with Add Card Modal)
  const renderPaymentStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>{t('serviceCheckout.paymentMethod', '💳 Método de Pago')}</Text>
      <Text style={styles.stepSubtitle}>
        {t('serviceCheckout.paymentMethodSubtitle', 'Selecciona o agrega un método de pago. Se cobrará al completar el servicio.')}
      </Text>
      
      {loadingPayments ? (
        <View style={styles.loadingPayments}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingPaymentsText}>{t('serviceCheckout.loadingPayments', 'Cargando métodos de pago...')}</Text>
        </View>
      ) : (
        <>
          {paymentMethods.length > 0 && (
            <>
              {paymentMethods.map((method) => {
                const isBank = method.type === 'bank_account' || method.type === 'ach' || method.brand === 'ACH' || method.account_type;
                const displayBrand = isBank 
                  ? `ACH ${(method.account_type || method.bank_account_type || 'CHECKING').toUpperCase()}`
                  : (method.card_brand || method.brand || 'Card');
                const displayLast4 = method.last_4 || method.last4 || method.bank_account_last4 || '';
                const displayIcon = isBank ? 'business-outline' : getCardIcon(method.card_brand || method.brand) as any;
                
                return (
                <TouchableOpacity
                  key={method.id}
                  style={[
                    styles.paymentCard,
                    selectedPaymentMethod === method.id && styles.paymentCardActive
                  ]}
                  onPress={() => setSelectedPaymentMethod(method.id)}
                >
                  <View style={styles.cardIconContainer}>
                    <Ionicons 
                      name={displayIcon}
                      size={28} 
                      color={selectedPaymentMethod === method.id ? colors.primary : colors.textGray} 
                    />
                  </View>
                  <View style={styles.cardInfo}>
                    <Text style={styles.cardBrand}>
                      {displayBrand}
                      {method.is_default && (
                        <Text style={styles.defaultBadgeText}> • {t('serviceCheckout.defaultCard', 'Predeterminada')}</Text>
                      )}
                    </Text>
                    <Text style={styles.cardNumber}>
                      {isBank ? `•••• ${displayLast4}` : `•••• •••• •••• ${displayLast4}`}
                    </Text>
                  </View>
                  <View style={styles.cardRight}>
                    {!isBank && method.exp_month && (
                      <Text style={styles.cardExpiry}>
                        {String(method.exp_month).padStart(2, '0')}/{String(method.exp_year).slice(-2)}
                      </Text>
                    )}
                    {isBank && method.bank_name && (
                      <Text style={styles.cardExpiry}>{method.bank_name}</Text>
                    )}
                    {selectedPaymentMethod === method.id && (
                      <Ionicons name="checkmark-circle" size={24} color={colors.success} />
                    )}
                  </View>
                </TouchableOpacity>
                );
              })}
            </>
          )}
          
          {paymentMethods.length === 0 && (
            <View style={styles.noPaymentMethods}>
              <Ionicons name="card-outline" size={48} color={colors.textGray} />
              <Text style={styles.noPaymentTitle}>{t('serviceCheckout.noPaymentMethods', 'Sin métodos de pago guardados')}</Text>
              <Text style={styles.noPaymentText}>
                {t('serviceCheckout.noPaymentMethodsHint', 'Agrega una tarjeta para facilitar el pago')}
              </Text>
            </View>
          )}
          
          <TouchableOpacity 
            style={styles.addCardButton}
            onPress={() => setShowAddCardModal(true)}
          >
            <Ionicons name="add-circle-outline" size={24} color={colors.primary} />
            <Text style={styles.addCardText}>{t('serviceCheckout.addNewCard', 'Agregar Nueva Tarjeta')}</Text>
          </TouchableOpacity>
          
          <View style={styles.paymentNote}>
            <Ionicons name="shield-checkmark" size={22} color={colors.success} />
            <View style={styles.paymentNoteContent}>
              <Text style={styles.paymentNoteTitle}>{t('serviceCheckout.securePayment', 'Pago Seguro')}</Text>
              <Text style={styles.paymentNoteText}>
                {t('serviceCheckout.securePaymentNote', 'Tu tarjeta será cobrada únicamente al completar tu servicio. Todas las transacciones están protegidas.')}
              </Text>
            </View>
          </View>
        </>
      )}
    </View>
  );

  // Render Step 5 - Appointment (Square integrated)
  const renderAppointmentStep = () => {
    const availableDays = getNextDays(21);
    
    return (
      <View style={styles.stepContent}>
        <Text style={styles.stepTitle}>{t('serviceCheckout.selectAppointment', '📅 Selecciona tu Cita')}</Text>
        <Text style={styles.stepSubtitle}>
          {t('serviceCheckout.selectAppointmentSubtitle', 'Elige el día y la hora que mejor te convenga')}
        </Text>
        
        <Text style={styles.sectionLabel}>{t('serviceCheckout.availableDate', 'Fecha Disponible')}</Text>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          style={styles.datesScroll}
          contentContainerStyle={styles.datesScrollContent}
        >
          {availableDays.map((day) => (
            <TouchableOpacity
              key={day.date}
              style={[
                styles.dateCard,
                selectedDate === day.date && styles.dateCardActive
              ]}
              onPress={() => {
                setSelectedDate(day.date);
                loadTimeSlots(day.date);
              }}
            >
              <Text style={[
                styles.dateDayName,
                selectedDate === day.date && styles.dateTextActive
              ]}>
                {day.dayName}
              </Text>
              <Text style={[
                styles.dateDayNum,
                selectedDate === day.date && styles.dateTextActive
              ]}>
                {day.dayNum}
              </Text>
              <Text style={[
                styles.dateMonth,
                selectedDate === day.date && styles.dateTextActive
              ]}>
                {day.month}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        
        {selectedDate && (
          <>
            <Text style={styles.sectionLabel}>
              {t('serviceCheckout.time', 'Hora') + ' - ' + formatDateDisplay(selectedDate)}
            </Text>
            {loadingSlots ? (
              <View style={styles.loadingSlots}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.loadingSlotsText}>{t('serviceCheckout.checkingAvailability', 'Consultando disponibilidad...')}</Text>
              </View>
            ) : (
              <View style={styles.timeSlotsGrid}>
                {availableSlots.filter(s => s.available).length > 0 ? (
                  availableSlots.filter(s => s.available).map((slot) => (
                    <TouchableOpacity
                      key={slot.time}
                      style={[
                        styles.timeSlot,
                        selectedTime === slot.time && styles.timeSlotActive
                      ]}
                      onPress={() => setSelectedTime(slot.time)}
                    >
                      <Text style={[
                        styles.timeSlotText,
                        selectedTime === slot.time && styles.timeSlotTextActive
                      ]}>
                        {slot.time}
                      </Text>
                    </TouchableOpacity>
                  ))
                ) : (
                  <View style={styles.noSlotsMessage}>
                    <Ionicons name="calendar-outline" size={32} color={colors.textGray} />
                    <Text style={styles.noSlotsText}>
                      {t('serviceCheckout.noSlotsAvailable', 'No hay horarios disponibles para esta fecha. Selecciona otra fecha.')}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </>
        )}
        
        {/* Additional notes */}
        <Text style={styles.sectionLabel}>{t('serviceCheckout.additionalNotes', 'Notas Adicionales (Opcional)')}</Text>
        <TextInput
          style={[styles.textInput, styles.notesInput]}
          value={notes}
          onChangeText={setNotes}
          placeholder={t('serviceCheckout.additionalNotesPlaceholder', '¿Alguna información adicional que debamos saber?')}
          placeholderTextColor="#9ca3af"
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />
      </View>
    );
  };

  // Render Step 6 - Confirmation
  const renderConfirmationStep = () => {
    const selectedPayment = paymentMethods.find(m => m.id === selectedPaymentMethod);
    
    return (
      <View style={styles.stepContent}>
        <Text style={styles.stepTitle}>{t('serviceCheckout.confirmOrder', '✅ Confirmar Orden')}</Text>
        <Text style={styles.stepSubtitle}>
          {t('serviceCheckout.confirmOrderSubtitle', 'Revisa los detalles antes de confirmar')}
        </Text>
        
        <View style={styles.summaryCard}>
          {/* Service */}
          <View style={styles.summarySection}>
            <View style={styles.summarySectionHeader}>
              <Ionicons name="briefcase" size={20} color={service?.color || colors.primary} />
              <Text style={styles.summarySectionTitle}>{t('serviceCheckout.service', 'Servicio')}</Text>
            </View>
            <Text style={styles.summaryServiceName}>{service?.name}</Text>
            <View style={styles.summaryPriceRow}>
              <Text style={styles.summaryLabel}>{t('serviceCheckout.totalToPay', 'Total a pagar')}</Text>
              <Text style={styles.summaryPrice}>${service?.price?.toFixed(2)}</Text>
            </View>
          </View>
          
          <View style={styles.summaryDivider} />
          
          {/* Appointment */}
          <View style={styles.summarySection}>
            <View style={styles.summarySectionHeader}>
              <Ionicons name="calendar" size={20} color={colors.primary} />
              <Text style={styles.summarySectionTitle}>{t('serviceCheckout.appointment', 'Cita')}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>{t('serviceCheckout.date', 'Fecha')}</Text>
              <Text style={styles.summaryValue}>{formatDateDisplay(selectedDate!)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>{t('serviceCheckout.hour', 'Hora')}</Text>
              <Text style={styles.summaryValue}>{selectedTime}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>{t('serviceCheckout.modality', 'Modalidad')}</Text>
              <View style={styles.modalityBadge}>
                <Ionicons 
                  name={selectedModality === 'in_person' ? 'business' : 'videocam'} 
                  size={16} 
                  color={colors.primary} 
                />
                <Text style={styles.modalityBadgeText}>
                  {selectedModality === 'in_person' ? t('serviceCheckout.inPerson', 'Presencial') : t('serviceCheckout.virtual', 'Virtual')}
                </Text>
              </View>
            </View>
          </View>
          
          <View style={styles.summaryDivider} />
          
          {/* Documents */}
          <View style={styles.summarySection}>
            <View style={styles.summarySectionHeader}>
              <Ionicons name="document-attach" size={20} color={colors.primary} />
              <Text style={styles.summarySectionTitle}>Documentos</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>{t('serviceCheckout.uploaded', 'Subidos')}</Text>
              <Text style={styles.summaryValue}>
                {uploadedDocs.length} documento(s)
              </Text>
            </View>
          </View>
          
          <View style={styles.summaryDivider} />
          
          {/* Payment */}
          <View style={styles.summarySection}>
            <View style={styles.summarySectionHeader}>
              <Ionicons name="card" size={20} color={colors.primary} />
              <Text style={styles.summarySectionTitle}>{t('serviceCheckout.paymentMethod')}</Text>
            </View>
            {selectedPayment ? (() => {
                const isBank = selectedPayment.type === 'bank_account' || selectedPayment.type === 'ach' || selectedPayment.brand === 'ACH' || selectedPayment.account_type;
                const displayBrand = isBank 
                  ? `ACH ${(selectedPayment.account_type || selectedPayment.bank_account_type || 'CHECKING').toUpperCase()}`
                  : (selectedPayment.card_brand || selectedPayment.brand || 'Card');
                const displayLast4 = selectedPayment.last_4 || selectedPayment.last4 || selectedPayment.bank_account_last4 || '';
                return (
                  <View style={styles.summaryPaymentCard}>
                    <Ionicons name={isBank ? "business-outline" : "card"} size={24} color={colors.textGray} />
                    <View>
                      <Text style={styles.summaryPaymentBrand}>{displayBrand}</Text>
                      <Text style={styles.summaryPaymentNumber}>•••• {displayLast4}</Text>
                    </View>
                  </View>
                );
              })() : (
              <Text style={styles.summaryNoPayment}>{t('serviceCheckout.payAtService', 'Pago al momento del servicio')}</Text>
            )}
          </View>
          
          {notes.trim() && (
            <>
              <View style={styles.summaryDivider} />
              <View style={styles.summarySection}>
                <View style={styles.summarySectionHeader}>
                  <Ionicons name="chatbubble-ellipses" size={20} color={colors.primary} />
                  <Text style={styles.summarySectionTitle}>{t('serviceCheckout.notes', 'Notas')}</Text>
                </View>
                <Text style={styles.summaryNotes}>{notes}</Text>
              </View>
            </>
          )}
        </View>
        
        <View style={styles.termsNote}>
          <Ionicons name="shield-checkmark" size={22} color={colors.success} />
          <Text style={styles.termsText}>
            Al confirmar, aceptas nuestros términos de servicio y que tu tarjeta 
            sea cobrada una vez completado el servicio satisfactoriamente.
          </Text>
        </View>
      </View>
    );
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0: return renderServiceStep();
      case 1: return renderDocumentsStep();
      case 2: return renderCustomFieldsStep();
      case 3: return renderPaymentStep();
      case 4: return renderAppointmentStep();
      case 5: return renderConfirmationStep();
      default: return null;
    }
  };

  // Add Document Type Modal
  const renderAddDocModal = () => (
    <Modal
      visible={showAddDocModal}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowAddDocModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{t('serviceCheckout.selectDocType', 'Seleccionar Tipo de Documento')}</Text>
            <TouchableOpacity onPress={() => setShowAddDocModal(false)}>
              <Ionicons name="close" size={24} color={colors.textGray} />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.modalScroll}>
            {ADDITIONAL_DOC_TYPES.map((docType) => (
              <TouchableOpacity
                key={docType.id}
                style={styles.docTypeOption}
                onPress={() => {
                  setShowAddDocModal(false);
                  showDocumentOptions(docType.id, t(docType.nameKey));
                }}
              >
                <View style={styles.docTypeIconBg}>
                  <Ionicons name={docType.icon as any} size={24} color={colors.primary} />
                </View>
                <View style={styles.docTypeInfo}>
                  <Text style={styles.docTypeName}>{t(docType.nameKey)}</Text>
                  <Text style={styles.docTypeDesc}>{t(docType.descKey)}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textGray} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  // Handle navigation to payment methods screen
  const handleGoToPaymentMethods = () => {
    setShowAddCardModal(false);
    // Navigate to payment methods screen, will come back with new card
    router.push('/(tabs)/payment-methods');
  };

  // Handle saving a new card inline during checkout
  const handleSaveCardInline = async () => {
    const cleanNumber = newCardNumber.replace(/\s/g, '').replace(/-/g, '');
    if (cleanNumber.length < 13 || cleanNumber.length > 19) {
      Alert.alert(t('common.error', 'Error'), t('serviceCheckout.invalidCardNumber', 'Número de tarjeta inválido'));
      return;
    }
    const expM = parseInt(newCardExpMonth);
    const expY = parseInt(newCardExpYear);
    if (!expM || expM < 1 || expM > 12) {
      Alert.alert(t('common.error', 'Error'), t('serviceCheckout.invalidExpMonth', 'Mes de expiración inválido'));
      return;
    }
    if (!expY || expY < 25 || expY > 40) {
      Alert.alert(t('common.error', 'Error'), t('serviceCheckout.invalidExpYear', 'Año de expiración inválido (2 dígitos)'));
      return;
    }
    if (newCardCVV.length < 3) {
      Alert.alert(t('common.error', 'Error'), t('serviceCheckout.invalidCVV', 'CVV inválido'));
      return;
    }

    try {
      setSavingCard(true);
      const response = await api.post('/payment-methods', {
        card_number: cleanNumber,
        exp_month: expM,
        exp_year: 2000 + expY,
        cvv: newCardCVV,
        cardholder_name: newCardName.trim() || undefined,
        is_default: paymentMethods.length === 0,
      });

      if (response.data.success) {
        Alert.alert(t('serviceCheckout.cardSaved', '✅ Tarjeta Guardada'), t('serviceCheckout.cardSavedMessage', 'Tu tarjeta fue registrada exitosamente.'));
        // Reload payment methods
        await loadPaymentMethods();
        // Select the new card
        const newMethod = response.data.payment_method;
        if (newMethod?.id) {
          setSelectedPaymentMethod(newMethod.id);
        }
        // Reset form & close modal
        setNewCardNumber('');
        setNewCardExpMonth('');
        setNewCardExpYear('');
        setNewCardCVV('');
        setNewCardName('');
        setShowAddCardModal(false);
      }
    } catch (error: any) {
      const msg = error.response?.data?.detail || t('serviceCheckout.cardSaveError', 'No se pudo guardar la tarjeta. Intenta de nuevo.');
      Alert.alert('Error', msg);
    } finally {
      setSavingCard(false);
    }
  };

  // Format card number with spaces
  const formatCardNumber = (text: string) => {
    const clean = text.replace(/\D/g, '').slice(0, 16);
    const groups = clean.match(/.{1,4}/g);
    return groups ? groups.join(' ') : clean;
  };

  // Add Card Modal - Inline card entry form during checkout
  const renderAddCardModal = () => (
    <Modal
      visible={showAddCardModal}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowAddCardModal(false)}
    >
      <View style={styles.modalOverlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ width: '100%', justifyContent: 'flex-end' }}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('serviceCheckout.addCard', '💳 Agregar Tarjeta')}</Text>
              <TouchableOpacity onPress={() => setShowAddCardModal(false)}>
                <Ionicons name="close" size={24} color={colors.textGray} />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.cardForm} keyboardShouldPersistTaps="handled">
              {/* Card Number */}
              <View style={styles.formField}>
                <Text style={styles.formLabel}>{t('serviceCheckout.cardNumber', 'Número de Tarjeta')}</Text>
                <TextInput
                  style={styles.formInput}
                  value={newCardNumber}
                  onChangeText={(text) => setNewCardNumber(formatCardNumber(text))}
                  placeholder={t('serviceCheckout.cardNumberPlaceholder', '1234 5678 9012 3456')}
                  placeholderTextColor="#9ca3af"
                  keyboardType="numeric"
                  maxLength={19}
                />
              </View>

              {/* Cardholder Name */}
              <View style={styles.formField}>
                <Text style={styles.formLabel}>{t('serviceCheckout.cardholderName', 'Nombre del Titular')}</Text>
                <TextInput
                  style={styles.formInput}
                  value={newCardName}
                  onChangeText={setNewCardName}
                  placeholder={t('serviceCheckout.cardholderPlaceholder', 'Como aparece en la tarjeta')}
                  placeholderTextColor="#9ca3af"
                  autoCapitalize="words"
                />
              </View>

              {/* Exp + CVV Row */}
              <View style={styles.formRow}>
                <View style={[styles.formField, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.formLabel}>{t('serviceCheckout.expMonth', 'Mes (MM)')}</Text>
                  <TextInput
                    style={styles.formInput}
                    value={newCardExpMonth}
                    onChangeText={setNewCardExpMonth}
                    placeholder="MM"
                    placeholderTextColor="#9ca3af"
                    keyboardType="numeric"
                    maxLength={2}
                  />
                </View>
                <View style={[styles.formField, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.formLabel}>{t('serviceCheckout.expYear', 'Año (YY)')}</Text>
                  <TextInput
                    style={styles.formInput}
                    value={newCardExpYear}
                    onChangeText={setNewCardExpYear}
                    placeholder="YY"
                    placeholderTextColor="#9ca3af"
                    keyboardType="numeric"
                    maxLength={2}
                  />
                </View>
                <View style={[styles.formField, { flex: 1 }]}>
                  <Text style={styles.formLabel}>{t('serviceCheckout.cvv', 'CVV')}</Text>
                  <TextInput
                    style={styles.formInput}
                    value={newCardCVV}
                    onChangeText={setNewCardCVV}
                    placeholder="123"
                    placeholderTextColor="#9ca3af"
                    keyboardType="numeric"
                    maxLength={4}
                    secureTextEntry
                  />
                </View>
              </View>

              <View style={styles.secureNote}>
                <Ionicons name="shield-checkmark" size={18} color={colors.success} />
                <Text style={styles.secureNoteText}>
                  {t('serviceCheckout.secureEncryption', 'Tus datos están protegidos con encriptación de nivel bancario')}
                </Text>
              </View>
            </ScrollView>
            
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowAddCardModal(false)}
              >
                <Text style={styles.cancelButtonText}>{t('common.cancel', 'Cancelar')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveCardButton, savingCard && styles.buttonDisabled]}
                onPress={handleSaveCardInline}
                disabled={savingCard}
              >
                {savingCard ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Ionicons name="lock-closed" size={18} color="#fff" />
                    <Text style={styles.saveCardButtonText}>{t('serviceCheckout.saveCard', 'Guardar Tarjeta')}</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );

  // Loading state
  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>{t('serviceCheckout.loadingService', 'Cargando servicio...')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={[service?.color || colors.primary, (service?.color || colors.primary) + 'dd']}
        style={[styles.header, { paddingTop: insets.top + 8 }]}
      >
        <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{steps[currentStep].title}</Text>
          <Text style={styles.headerSubtitle}>{t('serviceCheckout.stepOf', {defaultValue: 'Paso {{current}} de {{total}}', current: currentStep + 1, total: steps.length})}</Text>
        </View>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
          <Ionicons name="close" size={24} color="#fff" />
        </TouchableOpacity>
      </LinearGradient>

      {/* Progress Indicator */}
      <View style={styles.progressContainer}>
        {renderStepIndicator()}
        <View style={styles.progressBar}>
          <View 
            style={[
              styles.progressFill, 
              { 
                width: `${((currentStep + 1) / steps.length) * 100}%`, 
                backgroundColor: service?.color || colors.primary 
              }
            ]} 
          />
        </View>
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[service?.color || colors.primary]}
            />
          }
        >
          {renderStepContent()}
          <View style={{ height: 120 }} />
        </ScrollView>

        {/* Bottom Actions */}
        <View style={[styles.bottomActions, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          {currentStep === steps.length - 1 ? (
            <TouchableOpacity
              style={[styles.submitButton, { backgroundColor: service?.color || colors.primary }]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={22} color="#fff" />
                  <Text style={styles.submitButtonText}>{t('serviceCheckout.confirmButton', 'Confirmar Orden')}</Text>
                </>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.nextButton, { backgroundColor: service?.color || colors.primary }]}
              onPress={handleNext}
            >
              <Text style={styles.nextButtonText}>{t('serviceCheckout.continueButton', 'Continuar')}</Text>
              <Ionicons name="arrow-forward" size={20} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>

      {/* Modals */}
      {renderAddDocModal()}
      {renderAddCardModal()}
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: colors.textGray,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  progressContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  stepIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  stepDot: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#e5e7eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepCompleted: {
    backgroundColor: colors.success,
  },
  stepActive: {
    backgroundColor: colors.primary,
  },
  stepNumber: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9ca3af',
  },
  stepNumberActive: {
    color: '#fff',
  },
  stepLine: {
    width: 24,
    height: 2,
    backgroundColor: '#e5e7eb',
    marginHorizontal: 4,
  },
  stepLineCompleted: {
    backgroundColor: colors.success,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#e5e7eb',
    borderRadius: 2,
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  stepContent: {
    gap: 16,
  },
  stepTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1f2937',
  },
  stepSubtitle: {
    fontSize: 14,
    color: colors.textGray,
    marginBottom: 8,
    lineHeight: 20,
  },
  // Service Card
  serviceCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  serviceIconBg: {
    width: 72,
    height: 72,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  serviceName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 8,
  },
  serviceDesc: {
    fontSize: 14,
    color: colors.textGray,
    lineHeight: 21,
    marginBottom: 16,
  },
  serviceDetails: {
    flexDirection: 'row',
    gap: 24,
    marginBottom: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  serviceDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  servicePrice: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.success,
  },
  serviceDuration: {
    fontSize: 15,
    color: colors.textGray,
  },
  modalitySection: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  modalityOptions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalityOption: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 18,
    borderRadius: 14,
    backgroundColor: '#f8fafc',
    gap: 6,
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
  modalityOptionActive: {
    backgroundColor: colors.primary + '10',
    borderColor: colors.primary,
  },
  modalityText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textGray,
  },
  modalityTextActive: {
    color: colors.primary,
  },
  modalityHint: {
    fontSize: 11,
    color: '#9ca3af',
  },
  // Documents
  docSection: {
    marginBottom: 12,
  },
  docItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderStyle: 'dashed',
  },
  docItemUploaded: {
    borderStyle: 'solid',
    borderColor: colors.success,
    backgroundColor: colors.success + '08',
  },
  docItemUploading: {
    opacity: 0.7,
  },
  docLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  docRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  docIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  docIconSuccess: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.success,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  docIconLoading: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  docInfo: {
    flex: 1,
  },
  docName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 2,
  },
  docDesc: {
    fontSize: 12,
    color: colors.textGray,
    lineHeight: 16,
  },
  docUploaded: {
    fontSize: 12,
    color: colors.success,
    fontWeight: '500',
    marginTop: 4,
  },
  requiredBadge: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  requiredText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#f59e0b',
  },
  docPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    marginLeft: 62,
    gap: 12,
    backgroundColor: '#f8fafc',
    padding: 10,
    borderRadius: 10,
  },
  docThumbnail: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: '#e5e7eb',
  },
  docFileName: {
    flex: 1,
    fontSize: 13,
    color: '#374151',
  },
  docRemoveBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#fef2f2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Compact thumbnail grid for uploaded docs
  docThumbnailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    marginLeft: 62,
    gap: 8,
    alignItems: 'center',
  },
  docThumbnailWrapper: {
    position: 'relative' as const,
    width: 56,
    height: 56,
  },
  docThumbnailCompact: {
    width: 56,
    height: 56,
    borderRadius: 10,
    backgroundColor: '#e5e7eb',
  },
  docRemoveBadge: {
    position: 'absolute' as const,
    top: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#ef4444',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    borderWidth: 2,
    borderColor: '#fff',
  },
  docAddMoreBtn: {
    width: 56,
    height: 56,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderStyle: 'dashed' as const,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    backgroundColor: colors.primary + '08',
  },
  // Additional docs section
  addDocSection: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginTop: 8,
  },
  addDocTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 4,
  },
  addDocSubtitle: {
    fontSize: 13,
    color: colors.textGray,
    marginBottom: 16,
  },
  addDocButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 10,
    backgroundColor: colors.primary + '10',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderStyle: 'dashed',
  },
  addDocButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary,
  },
  additionalDocGroup: {
    marginTop: 16,
  },
  additionalDocLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  // Fields
  fieldContainer: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 10,
  },
  required: {
    color: '#ef4444',
  },
  textInput: {
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1f2937',
  },
  textAreaInput: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  notesInput: {
    minHeight: 80,
  },
  numberInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  numberButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  numberInput: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingVertical: 14,
    fontSize: 20,
    fontWeight: '600',
    color: '#1f2937',
  },
  selectOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  selectOption: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
  },
  selectOptionActive: {
    backgroundColor: colors.primary + '15',
    borderColor: colors.primary,
  },
  selectOptionText: {
    fontSize: 14,
    color: colors.textGray,
    fontWeight: '500',
  },
  selectOptionTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkboxLabel: {
    fontSize: 15,
    color: '#1f2937',
    fontWeight: '500',
  },
  noDocsMessage: {
    alignItems: 'center',
    paddingVertical: 48,
    backgroundColor: '#fff',
    borderRadius: 16,
  },
  noDocsIconBg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.success + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  noDocsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 8,
  },
  noDocsText: {
    fontSize: 14,
    color: colors.textGray,
    textAlign: 'center',
  },
  // Payment
  loadingPayments: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingPaymentsText: {
    marginTop: 12,
    fontSize: 14,
    color: colors.textGray,
  },
  paymentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    gap: 14,
    marginBottom: 12,
  },
  paymentCardActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '08',
  },
  cardIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardInfo: {
    flex: 1,
  },
  cardBrand: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  defaultBadgeText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.success,
  },
  cardNumber: {
    fontSize: 13,
    color: colors.textGray,
    marginTop: 2,
  },
  cardRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  cardExpiry: {
    fontSize: 12,
    color: colors.textGray,
  },
  noPaymentMethods: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: '#fff',
    borderRadius: 14,
    marginBottom: 12,
  },
  noPaymentTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginTop: 12,
    marginBottom: 4,
  },
  noPaymentText: {
    fontSize: 13,
    color: colors.textGray,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  addCardButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 10,
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    marginBottom: 16,
  },
  addCardText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary,
  },
  paymentNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
    backgroundColor: colors.success + '10',
    borderRadius: 14,
  },
  paymentNoteContent: {
    flex: 1,
  },
  paymentNoteTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.success,
    marginBottom: 4,
  },
  paymentNoteText: {
    fontSize: 12,
    color: '#374151',
    lineHeight: 18,
  },
  // Appointment
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
    marginTop: 8,
  },
  datesScroll: {
    marginHorizontal: -16,
  },
  datesScrollContent: {
    paddingHorizontal: 16,
    gap: 10,
  },
  dateCard: {
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 14,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    minWidth: 75,
  },
  dateCardActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  dateDayName: {
    fontSize: 11,
    color: colors.textGray,
    textTransform: 'uppercase',
    fontWeight: '500',
  },
  dateDayNum: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1f2937',
    marginVertical: 4,
  },
  dateMonth: {
    fontSize: 11,
    color: colors.textGray,
    textTransform: 'capitalize',
  },
  dateTextActive: {
    color: '#fff',
  },
  loadingSlots: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 20,
  },
  loadingSlotsText: {
    fontSize: 14,
    color: colors.textGray,
  },
  timeSlotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  timeSlot: {
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
  },
  timeSlotActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  timeSlotText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2937',
  },
  timeSlotTextActive: {
    color: '#fff',
  },
  noSlotsMessage: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 24,
    backgroundColor: '#fff',
    borderRadius: 12,
    gap: 8,
    width: '100%',
  },
  noSlotsText: {
    fontSize: 14,
    color: colors.textGray,
    textAlign: 'center',
  },
  // Summary
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  summarySection: {
    gap: 10,
  },
  summarySectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  summarySectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textGray,
    textTransform: 'uppercase',
  },
  summaryServiceName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 4,
  },
  summaryPriceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.success + '10',
    padding: 12,
    borderRadius: 10,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  summaryLabel: {
    fontSize: 14,
    color: colors.textGray,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  summaryPrice: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.success,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 16,
  },
  modalityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary + '10',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  modalityBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  summaryPaymentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 10,
  },
  summaryPaymentBrand: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  summaryPaymentNumber: {
    fontSize: 12,
    color: colors.textGray,
  },
  summaryNoPayment: {
    fontSize: 14,
    color: colors.textGray,
    fontStyle: 'italic',
  },
  summaryNotes: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
    fontStyle: 'italic',
  },
  termsNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
    backgroundColor: colors.success + '10',
    borderRadius: 14,
    marginTop: 16,
  },
  termsText: {
    flex: 1,
    fontSize: 13,
    color: '#374151',
    lineHeight: 19,
  },
  // Bottom Actions
  bottomActions: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 4,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 14,
    gap: 10,
  },
  nextButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 14,
    gap: 10,
  },
  submitButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
  },
  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
  },
  modalScroll: {
    maxHeight: 400,
  },
  // Document type options
  docTypeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  docTypeIconBg: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  docTypeInfo: {
    flex: 1,
  },
  docTypeName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 2,
  },
  docTypeDesc: {
    fontSize: 12,
    color: colors.textGray,
  },
  // Card form
  cardForm: {
    padding: 20,
  },
  formField: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  formInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1f2937',
  },
  formRow: {
    flexDirection: 'row',
  },
  secureNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: colors.success + '10',
    borderRadius: 10,
    marginTop: 8,
  },
  secureNoteText: {
    fontSize: 12,
    color: colors.success,
    flex: 1,
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6b7280',
  },
  saveCardButton: {
    flex: 2,
    flexDirection: 'row',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  saveCardButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  // Add Card Modal new styles
  addCardModalBody: {
    padding: 20,
    alignItems: 'center',
  },
  addCardIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.primary + '10',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  addCardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 12,
  },
  addCardDescription: {
    fontSize: 14,
    color: colors.textGray,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 20,
  },
  paymentOptionsList: {
    width: '100%',
    gap: 12,
    marginBottom: 20,
  },
  paymentOptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#f8fafc',
    padding: 14,
    borderRadius: 12,
  },
  paymentOptionText: {
    fontSize: 15,
    color: '#374151',
    fontWeight: '500',
  },
});
