/**
 * Create Client Screen - Modern Design
 * Clean, step-based form for creating new clients
 */
import React, { useState, useRef } from 'react';
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
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import api from '../../services/api';

interface FormData {
  full_name: string;
  email: string;
  phone: string;
  ssn: string;
  date_of_birth: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  notes: string;
}

const CreateClient = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);
  const progressAnim = useRef(new Animated.Value(0)).current;

  const [formData, setFormData] = useState<FormData>({
    full_name: '',
    email: '',
    phone: '',
    ssn: '',
    date_of_birth: '',
    street: '',
    city: '',
    state: '',
    zip: '',
    notes: '',
  });

  const [errors, setErrors] = useState<Partial<FormData>>({});

  const steps = [
    { id: 'personal', title: 'Información Personal', icon: 'person' },
    { id: 'contact', title: 'Contacto', icon: 'call' },
    { id: 'address', title: 'Dirección', icon: 'location' },
  ];

  const updateField = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const formatPhone = (text: string) => {
    const cleaned = text.replace(/\D/g, '');
    const match = cleaned.match(/^(\d{0,3})(\d{0,3})(\d{0,4})$/);
    if (match) {
      const formatted = [match[1], match[2], match[3]].filter(Boolean).join('-');
      return formatted.length > 0 ? `+1 ${formatted}` : '';
    }
    return text;
  };

  const formatSSN = (text: string) => {
    const cleaned = text.replace(/\D/g, '');
    const match = cleaned.match(/^(\d{0,3})(\d{0,2})(\d{0,4})$/);
    if (match) {
      return [match[1], match[2], match[3]].filter(Boolean).join('-');
    }
    return text;
  };

  const validateStep = (step: number): boolean => {
    const newErrors: Partial<FormData> = {};

    if (step === 0) {
      if (!formData.full_name.trim()) {
        newErrors.full_name = 'Nombre requerido';
      }
    }

    if (step === 1) {
      if (!formData.email.trim()) {
        newErrors.email = 'Email requerido';
      } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
        newErrors.email = 'Email inválido';
      }
      if (!formData.phone.trim()) {
        newErrors.phone = 'Teléfono requerido';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const goToStep = (step: number) => {
    if (step > currentStep && !validateStep(currentStep)) {
      return;
    }
    setCurrentStep(step);
    Animated.timing(progressAnim, {
      toValue: step / (steps.length - 1),
      duration: 300,
      useNativeDriver: false,
    }).start();
  };

  const handleSubmit = async () => {
    if (!validateStep(currentStep)) return;

    setLoading(true);
    try {
      const clientData = {
        full_name: formData.full_name,
        name: formData.full_name,
        email: formData.email,
        phone: formData.phone.replace(/\D/g, ''),
        ssn: formData.ssn.replace(/\D/g, ''),
        date_of_birth: formData.date_of_birth,
        address: formData.street ? {
          street: formData.street,
          city: formData.city,
          state: formData.state,
          zip: formData.zip,
        } : null,
        notes: formData.notes,
        role: 'client',
        is_active: true,
      };

      await api.post('/admin/clients', clientData);

      Alert.alert(
        '✅ Cliente Creado',
        `${formData.full_name} ha sido agregado exitosamente`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error: any) {
      console.error('Error creating client:', error);
      Alert.alert('Error', error.response?.data?.detail || 'No se pudo crear el cliente');
    } finally {
      setLoading(false);
    }
  };

  const renderStepIndicator = () => (
    <View style={styles.stepIndicatorContainer}>
      <View style={styles.progressBarBg}>
        <Animated.View 
          style={[
            styles.progressBarFill,
            {
              width: progressAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
            },
          ]} 
        />
      </View>
      <View style={styles.stepsRow}>
        {steps.map((step, index) => (
          <TouchableOpacity
            key={step.id}
            style={styles.stepItem}
            onPress={() => goToStep(index)}
            disabled={index > currentStep + 1}
          >
            <View style={[
              styles.stepCircle,
              index <= currentStep && styles.stepCircleActive,
              index === currentStep && styles.stepCircleCurrent,
            ]}>
              {index < currentStep ? (
                <Ionicons name="checkmark" size={16} color="#fff" />
              ) : (
                <Ionicons name={step.icon as any} size={16} color={index <= currentStep ? '#fff' : '#9ca3af'} />
              )}
            </View>
            <Text style={[
              styles.stepLabel,
              index === currentStep && styles.stepLabelActive,
            ]}>
              {step.title}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderInput = (
    field: keyof FormData,
    label: string,
    icon: string,
    options?: {
      placeholder?: string;
      keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'numeric';
      autoCapitalize?: 'none' | 'sentences' | 'words';
      multiline?: boolean;
      formatter?: (text: string) => string;
      maxLength?: number;
      secureTextEntry?: boolean;
    }
  ) => (
    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>
        <Ionicons name={icon as any} size={16} color="#6366f1" /> {label}
      </Text>
      <View style={[styles.inputContainer, errors[field] && styles.inputError]}>
        <TextInput
          style={[styles.input, options?.multiline && styles.inputMultiline]}
          value={formData[field]}
          onChangeText={(text) => {
            const formatted = options?.formatter ? options.formatter(text) : text;
            updateField(field, formatted);
          }}
          placeholder={options?.placeholder || `Ingresa ${label.toLowerCase()}`}
          placeholderTextColor="#9ca3af"
          keyboardType={options?.keyboardType || 'default'}
          autoCapitalize={options?.autoCapitalize || 'words'}
          multiline={options?.multiline}
          numberOfLines={options?.multiline ? 3 : 1}
          maxLength={options?.maxLength}
          secureTextEntry={options?.secureTextEntry}
        />
      </View>
      {errors[field] && (
        <Text style={styles.errorText}>
          <Ionicons name="alert-circle" size={12} color="#ef4444" /> {errors[field]}
        </Text>
      )}
    </View>
  );

  const renderPersonalStep = () => (
    <View style={styles.stepContent}>
      <View style={styles.stepHeader}>
        <View style={styles.stepIconLarge}>
          <Ionicons name="person" size={32} color="#6366f1" />
        </View>
        <Text style={styles.stepTitle}>Información Personal</Text>
        <Text style={styles.stepSubtitle}>Ingresa los datos básicos del cliente</Text>
      </View>

      {renderInput('full_name', 'Nombre Completo', 'person-outline', {
        placeholder: 'Ej: Juan Pérez García',
        autoCapitalize: 'words',
      })}

      {renderInput('ssn', 'SSN (Opcional)', 'shield-checkmark-outline', {
        placeholder: 'XXX-XX-XXXX',
        keyboardType: 'numeric',
        formatter: formatSSN,
        maxLength: 11,
      })}

      {renderInput('date_of_birth', 'Fecha de Nacimiento (Opcional)', 'calendar-outline', {
        placeholder: 'MM/DD/YYYY',
        keyboardType: 'numeric',
      })}
    </View>
  );

  const renderContactStep = () => (
    <View style={styles.stepContent}>
      <View style={styles.stepHeader}>
        <View style={styles.stepIconLarge}>
          <Ionicons name="call" size={32} color="#6366f1" />
        </View>
        <Text style={styles.stepTitle}>Información de Contacto</Text>
        <Text style={styles.stepSubtitle}>¿Cómo podemos contactar al cliente?</Text>
      </View>

      {renderInput('email', 'Email', 'mail-outline', {
        placeholder: 'cliente@ejemplo.com',
        keyboardType: 'email-address',
        autoCapitalize: 'none',
      })}

      {renderInput('phone', 'Teléfono', 'call-outline', {
        placeholder: '+1 (555) 123-4567',
        keyboardType: 'phone-pad',
        formatter: formatPhone,
        maxLength: 17,
      })}

      <View style={styles.tipCard}>
        <Ionicons name="bulb-outline" size={20} color="#f59e0b" />
        <Text style={styles.tipText}>
          El cliente recibirá notificaciones por email y SMS cuando crees facturas o citas.
        </Text>
      </View>
    </View>
  );

  const renderAddressStep = () => (
    <View style={styles.stepContent}>
      <View style={styles.stepHeader}>
        <View style={styles.stepIconLarge}>
          <Ionicons name="location" size={32} color="#6366f1" />
        </View>
        <Text style={styles.stepTitle}>Dirección (Opcional)</Text>
        <Text style={styles.stepSubtitle}>Agrega la dirección si es necesario</Text>
      </View>

      {renderInput('street', 'Calle y Número', 'home-outline', {
        placeholder: '123 Main Street, Apt 4B',
      })}

      <View style={styles.row}>
        <View style={styles.halfInput}>
          {renderInput('city', 'Ciudad', 'business-outline', {
            placeholder: 'Miami',
          })}
        </View>
        <View style={styles.halfInput}>
          {renderInput('state', 'Estado', 'flag-outline', {
            placeholder: 'FL',
            autoCapitalize: 'characters' as any,
            maxLength: 2,
          })}
        </View>
      </View>

      {renderInput('zip', 'Código Postal', 'navigate-outline', {
        placeholder: '33101',
        keyboardType: 'numeric',
        maxLength: 5,
      })}

      {renderInput('notes', 'Notas Adicionales', 'document-text-outline', {
        placeholder: 'Notas importantes sobre el cliente...',
        multiline: true,
      })}
    </View>
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 0:
        return renderPersonalStep();
      case 1:
        return renderContactStep();
      case 2:
        return renderAddressStep();
      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={['#1e1b4b', '#312e81']}
        style={[styles.header, { paddingTop: insets.top + 10 }]}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Nuevo Cliente</Text>
          <View style={{ width: 40 }} />
        </View>
      </LinearGradient>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        {/* Step Indicator */}
        {renderStepIndicator()}

        {/* Form Content */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {renderCurrentStep()}
        </ScrollView>

        {/* Navigation Buttons */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + 10 }]}>
          {currentStep > 0 && (
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => goToStep(currentStep - 1)}
            >
              <Ionicons name="arrow-back" size={20} color="#6366f1" />
              <Text style={styles.secondaryButtonText}>Anterior</Text>
            </TouchableOpacity>
          )}

          {currentStep < steps.length - 1 ? (
            <TouchableOpacity
              style={[styles.primaryButton, currentStep === 0 && styles.fullWidthButton]}
              onPress={() => goToStep(currentStep + 1)}
            >
              <Text style={styles.primaryButtonText}>Continuar</Text>
              <Ionicons name="arrow-forward" size={20} color="#fff" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.submitButton, loading && styles.buttonDisabled]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={22} color="#fff" />
                  <Text style={styles.submitButtonText}>Crear Cliente</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  stepIndicatorContainer: {
    backgroundColor: '#fff',
    paddingVertical: 20,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  progressBarBg: {
    height: 4,
    backgroundColor: '#e5e7eb',
    borderRadius: 2,
    marginBottom: 16,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#6366f1',
    borderRadius: 2,
  },
  stepsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stepItem: {
    alignItems: 'center',
    flex: 1,
  },
  stepCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#e5e7eb',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  stepCircleActive: {
    backgroundColor: '#6366f1',
  },
  stepCircleCurrent: {
    backgroundColor: '#6366f1',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  stepLabel: {
    fontSize: 11,
    color: '#9ca3af',
    textAlign: 'center',
  },
  stepLabelActive: {
    color: '#6366f1',
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  stepContent: {
    flex: 1,
  },
  stepHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  stepIconLarge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#eef2ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  stepTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: 15,
    color: '#6b7280',
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  inputContainer: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
  },
  inputError: {
    borderColor: '#ef4444',
  },
  input: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1f2937',
  },
  inputMultiline: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  errorText: {
    fontSize: 12,
    color: '#ef4444',
    marginTop: 6,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  tipCard: {
    flexDirection: 'row',
    backgroundColor: '#fffbeb',
    borderRadius: 12,
    padding: 16,
    gap: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#fef3c7',
  },
  tipText: {
    flex: 1,
    fontSize: 14,
    color: '#92400e',
    lineHeight: 20,
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingVertical: 16,
    gap: 8,
    borderWidth: 2,
    borderColor: '#6366f1',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6366f1',
  },
  primaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6366f1',
    borderRadius: 14,
    paddingVertical: 16,
    gap: 8,
  },
  fullWidthButton: {
    flex: 1,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  submitButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#22c55e',
    borderRadius: 14,
    paddingVertical: 16,
    gap: 8,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
});

export default CreateClient;
