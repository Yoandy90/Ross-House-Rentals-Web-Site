/**
 * Immigration Motion Request Screen - Client View
 * Allows clients to request a court closure motion
 * with easy document upload and form submission
 */
import React, { useState, useEffect } from 'react';
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
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import api from '../../services/api';
import { useTranslation } from 'react-i18next';

interface RequiredDocument {
  id: string;
  name: string;
  description: string;
  required: boolean;
  uploaded: boolean;
  file?: {
    uri: string;
    name: string;
    type: string;
  };
}

const MOTION_DOCUMENTS: RequiredDocument[] = [
  {
    id: 'nta',
    name: 'NTA (Notice to Appear)',
    description: 'Papeles de inmigración que le entregaron en la frontera',
    required: true,
    uploaded: false,
  },
  {
    id: 'parol',
    name: 'Documento de Parol',
    description: 'Documento de parole (si aplica)',
    required: false,
    uploaded: false,
  },
  {
    id: 'residence_receipt',
    name: 'Recibo de Aplicación a Residencia',
    description: 'Recibo de la aplicación a la residencia',
    required: true,
    uploaded: false,
  },
  {
    id: 'fingerprint_receipt',
    name: 'Recibo de Huellas',
    description: 'Recibo de las huellas (si aplica)',
    required: false,
    uploaded: false,
  },
  {
    id: 'id_document',
    name: 'Identificación',
    description: 'Licencia de conducir u otra identificación válida',
    required: true,
    uploaded: false,
  },
];

export default function MotionRequestScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const params = useLocalSearchParams();
  const serviceId = params.serviceId as string;
  const requiresPayment = params.requiresPayment === 'true';
  const servicePrice = params.price ? parseFloat(params.price as string) : 0;

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  
  // Form data
  const [formData, setFormData] = useState({
    full_name: '',
    a_number: '',
    email: '',
    phone: '',
    current_address: '',
    notes: '',
  });
  
  // Documents
  const [documents, setDocuments] = useState<RequiredDocument[]>(MOTION_DOCUMENTS);
  
  // Service info
  const [serviceInfo, setServiceInfo] = useState<any>(null);

  useEffect(() => {
    loadServiceInfo();
    loadUserInfo();
  }, []);

  const loadServiceInfo = async () => {
    if (serviceId) {
      try {
        const response = await api.get(`/dynamic-services/${serviceId}`);
        if (response.data) {
          setServiceInfo(response.data);
        }
      } catch (error) {
        console.error('Error loading service:', error);
      }
    }
  };

  const loadUserInfo = async () => {
    try {
      const response = await api.get('/auth/me');
      if (response.data) {
        setFormData(prev => ({
          ...prev,
          full_name: response.data.full_name || '',
          email: response.data.email || '',
          phone: response.data.phone || '',
        }));
      }
    } catch (error) {
      console.error('Error loading user info:', error);
    }
  };

  const handleDocumentPick = async (docId: string) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.[0]) {
        return;
      }

      const file = result.assets[0];
      
      setDocuments(prev => prev.map(doc => 
        doc.id === docId 
          ? { 
              ...doc, 
              uploaded: true, 
              file: {
                uri: file.uri,
                name: file.name,
                type: file.mimeType || 'application/octet-stream',
              }
            }
          : doc
      ));
    } catch (error) {
      console.error('Error picking document:', error);
      Alert.alert(t('common.error', 'Error'), t('motionRequest.docPickError', 'No se pudo seleccionar el documento'));
    }
  };

  const handleRemoveDocument = (docId: string) => {
    setDocuments(prev => prev.map(doc => 
      doc.id === docId 
        ? { ...doc, uploaded: false, file: undefined }
        : doc
    ));
  };

  const validateStep = (step: number): boolean => {
    if (step === 0) {
      // Validate personal info
      if (!formData.full_name.trim()) {
        Alert.alert(t('motionRequest.fieldRequired', 'Campo requerido'), t('motionRequest.nameRequired', 'Por favor ingrese su nombre completo'));
        return false;
      }
      if (!formData.current_address.trim()) {
        Alert.alert(t('motionRequest.fieldRequired', 'Campo requerido'), t('motionRequest.addressRequired', 'Por favor ingrese su dirección actual'));
        return false;
      }
      return true;
    }
    
    if (step === 1) {
      // Validate required documents
      const missingRequired = documents.filter(d => d.required && !d.uploaded);
      if (missingRequired.length > 0) {
        Alert.alert(
          'Documentos requeridos',
          `Faltan los siguientes documentos:\n${missingRequired.map(d => `• ${d.name}`).join('\n')}`
        );
        return false;
      }
      return true;
    }
    
    return true;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    } else {
      router.back();
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    
    try {
      // Create the motion request
      const motionData = {
        motion_type: 'court_closure',
        client_name: formData.full_name,
        client_email: formData.email,
        client_phone: formData.phone,
        current_address: formData.current_address,
        a_number: formData.a_number,
        notes: formData.notes,
        priority: 'normal',
        service_id: serviceId,
        requires_payment: requiresPayment,
        service_price: servicePrice,
      };

      // Create the motion
      const response = await api.post('/motions/request', motionData);
      
      if (response.data?.success) {
        const motionId = response.data.motion.id;
        
        // Upload documents
        for (const doc of documents.filter(d => d.uploaded && d.file)) {
          const formDataDoc = new FormData();
          formDataDoc.append('document_type', doc.id);
          formDataDoc.append('file', {
            uri: doc.file!.uri,
            name: doc.file!.name,
            type: doc.file!.type,
          } as any);

          try {
            await api.post(`/motions/my-motions/${motionId}/document`, formDataDoc, {
              headers: {
                'Content-Type': 'multipart/form-data',
              },
            });
          } catch (uploadError) {
            console.error('Error uploading document:', uploadError);
          }
        }

        // If payment is required, redirect to payment
        if (requiresPayment && servicePrice > 0) {
          Alert.alert(
            '¡Solicitud Creada!',
            'Su solicitud ha sido creada. Ahora procederemos al pago.',
            [
              {
                text: 'Continuar al Pago',
                onPress: () => {
                  router.replace({
                    pathname: '/(tabs)/order-payment',
                    params: {
                      orderId: motionId,
                      amount: servicePrice.toString(),
                      serviceName: 'Moción de Cierre de Corte',
                    },
                  });
                },
              },
            ]
          );
        } else {
          Alert.alert(
            '¡Solicitud Enviada!',
            'Su solicitud de moción ha sido enviada correctamente. Recibirá una factura pronto para completar el pago.',
            [
              {
                text: 'Ver Mis Mociones',
                onPress: () => router.replace('/(tabs)/my-projects'),
              },
            ]
          );
        }
      }
    } catch (error) {
      console.error('Error submitting motion:', error);
      Alert.alert(t('common.error', 'Error'), t('motionRequest.submitError', 'No se pudo enviar la solicitud. Por favor intente nuevamente.'));
    } finally {
      setSubmitting(false);
    }
  };

  const renderStepIndicator = () => (
    <View style={styles.stepIndicator}>
      {['Datos', 'Documentos', 'Revisar'].map((step, index) => (
        <View key={index} style={styles.stepItem}>
          <View style={[
            styles.stepCircle,
            index <= currentStep && styles.stepCircleActive,
            index < currentStep && styles.stepCircleCompleted,
          ]}>
            {index < currentStep ? (
              <Ionicons name="checkmark" size={16} color="#fff" />
            ) : (
              <Text style={[styles.stepNumber, index <= currentStep && styles.stepNumberActive]}>
                {index + 1}
              </Text>
            )}
          </View>
          <Text style={[styles.stepLabel, index <= currentStep && styles.stepLabelActive]}>
            {step}
          </Text>
          {index < 2 && (
            <View style={[styles.stepLine, index < currentStep && styles.stepLineActive]} />
          )}
        </View>
      ))}
    </View>
  );

  const renderStep0 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Información Personal</Text>
      <Text style={styles.stepSubtitle}>{t('motionRequest.completeInfo', 'Complete sus datos para la moción')}</Text>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Nombre Completo *</Text>
        <TextInput
          style={styles.input}
          value={formData.full_name}
          onChangeText={(text) => setFormData({ ...formData, full_name: text })}
          placeholder="Ingrese su nombre completo"
          autoCapitalize="words"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Número A (A-Number)</Text>
        <TextInput
          style={styles.input}
          value={formData.a_number}
          onChangeText={(text) => setFormData({ ...formData, a_number: text })}
          placeholder="A123456789"
          autoCapitalize="characters"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>{t('motionRequest.email', 'Email')}</Text>
        <TextInput
          style={styles.input}
          value={formData.email}
          onChangeText={(text) => setFormData({ ...formData, email: text })}
          placeholder="correo@ejemplo.com"
          keyboardType="email-address"
          autoCapitalize="none"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>{t('motionRequest.phone', 'Teléfono')}</Text>
        <TextInput
          style={styles.input}
          value={formData.phone}
          onChangeText={(text) => setFormData({ ...formData, phone: text })}
          placeholder="+1 (555) 123-4567"
          keyboardType="phone-pad"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Dirección Actual *</Text>
        <TextInput
          style={[styles.input, styles.inputMultiline]}
          value={formData.current_address}
          onChangeText={(text) => setFormData({ ...formData, current_address: text })}
          placeholder={t('motionRequest.addressPlaceholder', 'Ingrese su dirección postal completa')}
          multiline
          numberOfLines={3}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Notas Adicionales</Text>
        <TextInput
          style={[styles.input, styles.inputMultiline]}
          value={formData.notes}
          onChangeText={(text) => setFormData({ ...formData, notes: text })}
          placeholder={t('motionRequest.additionalInfoPlaceholder', 'Información adicional sobre su caso...')}
          multiline
          numberOfLines={3}
        />
      </View>
    </View>
  );

  const renderStep1 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Documentos Requeridos</Text>
      <Text style={styles.stepSubtitle}>{t('motionRequest.uploadDocs', 'Suba los documentos necesarios para su moción')}</Text>

      <View style={styles.documentsContainer}>
        {documents.map((doc) => (
          <View key={doc.id} style={styles.documentCard}>
            <View style={styles.documentHeader}>
              <View style={[
                styles.documentIcon,
                doc.uploaded ? styles.documentIconUploaded : styles.documentIconPending,
              ]}>
                <Ionicons
                  name={doc.uploaded ? 'checkmark-circle' : 'document-outline'}
                  size={24}
                  color={doc.uploaded ? '#10B981' : '#9CA3AF'}
                />
              </View>
              <View style={styles.documentInfo}>
                <Text style={styles.documentName}>
                  {doc.name} {doc.required && <Text style={styles.requiredMark}>*</Text>}
                </Text>
                <Text style={styles.documentDescription}>{doc.description}</Text>
                {doc.uploaded && doc.file && (
                  <Text style={styles.uploadedFileName}>{doc.file.name}</Text>
                )}
              </View>
            </View>
            
            <View style={styles.documentActions}>
              {doc.uploaded ? (
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => handleRemoveDocument(doc.id)}
                >
                  <Ionicons name="trash-outline" size={20} color="#EF4444" />
                  <Text style={styles.removeButtonText}>{t('motionRequest.remove', 'Eliminar')}</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.uploadButton}
                  onPress={() => handleDocumentPick(doc.id)}
                >
                  <Ionicons name="cloud-upload-outline" size={20} color="#fff" />
                  <Text style={styles.uploadButtonText}>{t('motionRequest.upload', 'Subir')}</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ))}
      </View>

      <View style={styles.infoBox}>
        <Ionicons name="information-circle" size={20} color="#3B82F6" />
        <Text style={styles.infoText}>
          Los documentos marcados con * son obligatorios. Puede subir archivos PDF o imágenes.
        </Text>
      </View>
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Revisar y Enviar</Text>
      <Text style={styles.stepSubtitle}>{t('motionRequest.verifyInfo', 'Verifique que la información sea correcta')}</Text>

      {/* Summary Card */}
      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Resumen de su Solicitud</Text>
        
        <View style={styles.summarySection}>
          <Text style={styles.summarySectionTitle}>Información Personal</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Nombre:</Text>
            <Text style={styles.summaryValue}>{formData.full_name}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>A-Number:</Text>
            <Text style={styles.summaryValue}>{formData.a_number || 'No proporcionado'}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Email:</Text>
            <Text style={styles.summaryValue}>{formData.email || 'No proporcionado'}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Teléfono:</Text>
            <Text style={styles.summaryValue}>{formData.phone || 'No proporcionado'}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Dirección:</Text>
            <Text style={styles.summaryValue}>{formData.current_address}</Text>
          </View>
        </View>

        <View style={styles.summarySection}>
          <Text style={styles.summarySectionTitle}>Documentos ({documents.filter(d => d.uploaded).length}/{documents.length})</Text>
          {documents.map(doc => (
            <View key={doc.id} style={styles.summaryDocRow}>
              <Ionicons
                name={doc.uploaded ? 'checkmark-circle' : 'close-circle'}
                size={18}
                color={doc.uploaded ? '#10B981' : (doc.required ? '#EF4444' : '#9CA3AF')}
              />
              <Text style={[
                styles.summaryDocName,
                !doc.uploaded && doc.required && styles.summaryDocMissing,
              ]}>
                {doc.name}
              </Text>
            </View>
          ))}
        </View>

        {requiresPayment && servicePrice > 0 && (
          <View style={styles.paymentSection}>
            <View style={styles.paymentRow}>
              <Text style={styles.paymentLabel}>Costo del Servicio:</Text>
              <Text style={styles.paymentValue}>${servicePrice.toFixed(2)}</Text>
            </View>
            <Text style={styles.paymentNote}>
              Se le pedirá pagar después de enviar la solicitud
            </Text>
          </View>
        )}

        {!requiresPayment && (
          <View style={styles.invoiceNote}>
            <Ionicons name="receipt-outline" size={20} color="#F59E0B" />
            <Text style={styles.invoiceNoteText}>
              Recibirá una factura para pagar este servicio después de que procesemos su solicitud.
            </Text>
          </View>
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#1F2937" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Moción de Cierre de Corte</Text>
            <Text style={styles.headerSubtitle}>Servicio de Inmigración</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        {/* Step Indicator */}
        {renderStepIndicator()}

        {/* Content */}
        <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {currentStep === 0 && renderStep0()}
          {currentStep === 1 && renderStep1()}
          {currentStep === 2 && renderStep2()}
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          {currentStep < 2 ? (
            <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
              <Text style={styles.nextButtonText}>{t('motionRequest.continue', 'Continuar')}</Text>
              <Ionicons name="arrow-forward" size={20} color="#fff" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.submitButton, submitting && styles.buttonDisabled]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Text style={styles.submitButtonText}>
                    {requiresPayment ? 'Enviar y Pagar' : t('motionRequest.submit')}
                  </Text>
                  <Ionicons name="send" size={20} color="#fff" />
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 4,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1F2937',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#6C1110',
  },
  stepIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepCircleActive: {
    backgroundColor: '#6C1110',
  },
  stepCircleCompleted: {
    backgroundColor: '#10B981',
  },
  stepNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  stepNumberActive: {
    color: '#fff',
  },
  stepLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    marginLeft: 6,
  },
  stepLabelActive: {
    color: '#1F2937',
    fontWeight: '500',
  },
  stepLine: {
    width: 40,
    height: 2,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 8,
  },
  stepLineActive: {
    backgroundColor: '#10B981',
  },
  scrollContent: {
    flex: 1,
  },
  stepContent: {
    padding: 16,
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  stepSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1F2937',
  },
  inputMultiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  documentsContainer: {
    gap: 12,
  },
  documentCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  documentHeader: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  documentIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  documentIconPending: {
    backgroundColor: '#F3F4F6',
  },
  documentIconUploaded: {
    backgroundColor: '#D1FAE5',
  },
  documentInfo: {
    flex: 1,
  },
  documentName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  requiredMark: {
    color: '#EF4444',
  },
  documentDescription: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  uploadedFileName: {
    fontSize: 12,
    color: '#10B981',
    marginTop: 4,
  },
  documentActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6C1110',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  uploadButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  removeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#EF4444',
    gap: 6,
  },
  removeButtonText: {
    color: '#EF4444',
    fontWeight: '600',
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#EFF6FF',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
    gap: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#1E40AF',
  },
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 16,
  },
  summarySection: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  summarySectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6C1110',
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#6B7280',
    width: 100,
  },
  summaryValue: {
    fontSize: 14,
    color: '#1F2937',
    flex: 1,
  },
  summaryDocRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 8,
  },
  summaryDocName: {
    fontSize: 14,
    color: '#1F2937',
  },
  summaryDocMissing: {
    color: '#EF4444',
  },
  paymentSection: {
    backgroundColor: '#F0FDF4',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paymentLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#166534',
  },
  paymentValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#166534',
  },
  paymentNote: {
    fontSize: 12,
    color: '#15803D',
    marginTop: 4,
  },
  invoiceNote: {
    flexDirection: 'row',
    backgroundColor: '#FEF3C7',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    gap: 8,
  },
  invoiceNoteText: {
    flex: 1,
    fontSize: 13,
    color: '#92400E',
  },
  footer: {
    backgroundColor: '#fff',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6C1110',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B981',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
