/**
 * Dynamic Service Form Screen
 * Displays a dynamic form based on the selected service template
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useThemeColors } from '../../constants/colors';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';
import CustomHeader from '../../components/CustomHeader';
import DynamicFieldRenderer, {
  DynamicField,
  FieldGroup,
} from '../../components/DynamicFieldRenderer';

interface ServiceTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  color: string;
  fields: string[];
  translations?: {
    name?: { es?: string; en?: string };
    description?: { es?: string; en?: string };
  };
}

export default function DynamicServiceFormScreen() {
  const { t, i18n } = useTranslation();
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const params = useLocalSearchParams<{ templateId: string }>();
  const language = (i18n.language?.split('-')[0] || 'es') as 'es' | 'en';

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [template, setTemplate] = useState<ServiceTemplate | null>(null);
  const [fields, setFields] = useState<DynamicField[]>([]);
  const [groups, setGroups] = useState<FieldGroup[]>([]);
  const [values, setValues] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    loadTemplateAndFields();
  }, [params.templateId]);

  const loadTemplateAndFields = async () => {
    try {
      setLoading(true);

      if (!params.templateId) {
        // Load all templates to show selection
        const res = await api.get('/admin/dynamic-fields/templates');
        setLoading(false);
        return;
      }

      // Load specific template with expanded fields (public read access)
      const res = await api.get(`/admin/dynamic-fields/templates/${params.templateId}`);

      setTemplate(res.data.template);
      setFields(res.data.fields || []);
      setGroups(res.data.ui_hints?.groups || []);

      // Initialize values with defaults
      const initialValues: Record<string, any> = {};
      (res.data.fields || []).forEach((field: DynamicField) => {
        if (field.meta?.default_value !== undefined) {
          initialValues[field.id] = field.meta.default_value;
        } else if (field.type === 'checkbox') {
          initialValues[field.id] = false;
        } else if (field.type === 'items' || field.type === 'multiselect' || field.type === 'checkbox_group') {
          initialValues[field.id] = [];
        } else {
          initialValues[field.id] = '';
        }
      });
      setValues(initialValues);
    } catch (error) {
      console.error('Error loading template:', error);
      Alert.alert(
        language === 'es' ? 'Error' : 'Error',
        language === 'es'
          ? 'No se pudo cargar el formulario. Intenta de nuevo.'
          : 'Could not load the form. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleFieldChange = (fieldId: string, value: any) => {
    setValues((prev) => ({ ...prev, [fieldId]: value }));
    // Clear error when field changes
    if (errors[fieldId]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[fieldId];
        return newErrors;
      });
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    fields.forEach((field) => {
      // Skip hidden fields
      if (field.visible === false) return;

      const value = values[field.id];

      // Required validation
      if (field.required) {
        if (
          value === undefined ||
          value === null ||
          value === '' ||
          (Array.isArray(value) && value.length === 0)
        ) {
          newErrors[field.id] =
            language === 'es' ? 'Este campo es requerido' : 'This field is required';
          return;
        }
      }

      // Skip further validation if empty and not required
      if (!value && !field.required) return;

      // Regex validation
      if (field.validation?.regex && value) {
        const regex = new RegExp(field.validation.regex);
        if (!regex.test(value)) {
          newErrors[field.id] =
            field.validation.pattern_message ||
            (language === 'es' ? 'Formato inválido' : 'Invalid format');
        }
      }

      // Min/Max validation for numbers
      if (field.type === 'number' || field.type === 'currency') {
        const num = parseFloat(value);
        if (!isNaN(num)) {
          if (field.validation?.min !== undefined && num < field.validation.min) {
            newErrors[field.id] =
              language === 'es'
                ? `El valor mínimo es ${field.validation.min}`
                : `Minimum value is ${field.validation.min}`;
          }
          if (field.validation?.max !== undefined && num > field.validation.max) {
            newErrors[field.id] =
              language === 'es'
                ? `El valor máximo es ${field.validation.max}`
                : `Maximum value is ${field.validation.max}`;
          }
        }
      }

      // Min/Max length for strings
      if (typeof value === 'string') {
        if (
          field.validation?.min_length !== undefined &&
          value.length < field.validation.min_length
        ) {
          newErrors[field.id] =
            language === 'es'
              ? `Mínimo ${field.validation.min_length} caracteres`
              : `Minimum ${field.validation.min_length} characters`;
        }
        if (
          field.validation?.max_length !== undefined &&
          value.length > field.validation.max_length
        ) {
          newErrors[field.id] =
            language === 'es'
              ? `Máximo ${field.validation.max_length} caracteres`
              : `Maximum ${field.validation.max_length} characters`;
        }
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      Alert.alert(
        language === 'es' ? 'Formulario Incompleto' : 'Incomplete Form',
        language === 'es'
          ? 'Por favor corrige los errores marcados en rojo.'
          : 'Please fix the errors marked in red.'
      );
      return;
    }

    try {
      setSubmitting(true);

      // Submit the form data
      const payload = {
        template_id: params.templateId,
        template_name: template?.name,
        form_data: values,
        submitted_at: new Date().toISOString(),
      };

      // TODO: Replace with actual API endpoint
      // const response = await api.post('/service-requests', payload);

      Alert.alert(
        language === 'es' ? '¡Solicitud Enviada!' : 'Request Submitted!',
        language === 'es'
          ? 'Tu solicitud ha sido enviada exitosamente. Te contactaremos pronto.'
          : 'Your request has been submitted successfully. We will contact you soon.',
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]
      );
    } catch (error) {
      console.error('Error submitting form:', error);
      Alert.alert(
        language === 'es' ? 'Error' : 'Error',
        language === 'es'
          ? 'No se pudo enviar la solicitud. Intenta de nuevo.'
          : 'Could not submit the request. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <CustomHeader
          title={language === 'es' ? 'Cargando...' : 'Loading...'}
          showBack
          onBackPress={() => router.back()}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>
            {language === 'es' ? 'Cargando formulario...' : 'Loading form...'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!template) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <CustomHeader
          title={language === 'es' ? 'Error' : 'Error'}
          showBack
          onBackPress={() => router.back()}
        />
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color={colors.error} />
          <Text style={styles.errorTitle}>
            {language === 'es' ? 'Plantilla no encontrada' : 'Template not found'}
          </Text>
          <Text style={styles.errorText}>
            {language === 'es'
              ? 'No se pudo cargar la plantilla del servicio.'
              : 'Could not load the service template.'}
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadTemplateAndFields}>
            <Text style={styles.retryButtonText}>
              {language === 'es' ? 'Reintentar' : 'Retry'}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const templateName =
    template.translations?.name?.[language] || template.name;
  const templateDescription =
    template.translations?.description?.[language] || template.description;

  // Calculate progress
  const requiredFields = fields.filter((f) => f.required && f.visible !== false);
  const completedRequired = requiredFields.filter((f) => {
    const val = values[f.id];
    return val !== undefined && val !== null && val !== '' && (!Array.isArray(val) || val.length > 0);
  });
  const progress = requiredFields.length > 0 ? (completedRequired.length / requiredFields.length) * 100 : 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <CustomHeader
        title={templateName}
        showBack
        onBackPress={() => router.back()}
      />

      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressText}>
            {language === 'es' ? 'Progreso' : 'Progress'}: {Math.round(progress)}%
          </Text>
          <Text style={styles.progressSubtext}>
            {completedRequired.length}/{requiredFields.length}{' '}
            {language === 'es' ? 'campos completados' : 'fields completed'}
          </Text>
        </View>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>
      </View>

      {/* Service Info */}
      <View style={styles.serviceInfo}>
        <View style={[styles.serviceIcon, { backgroundColor: template.color + '20' }]}>
          <Ionicons
            name={(template.icon || 'document-text') as any}
            size={24}
            color={template.color}
          />
        </View>
        <View style={styles.serviceTextContainer}>
          <Text style={styles.serviceName}>{templateName}</Text>
          <Text style={styles.serviceDescription} numberOfLines={2}>
            {templateDescription}
          </Text>
        </View>
      </View>

      {/* Dynamic Form */}
      <View style={styles.formContainer}>
        <DynamicFieldRenderer
          fields={fields}
          values={values}
          onChange={handleFieldChange}
          errors={errors}
          groups={groups}
          disabled={submitting}
          language={language}
        />
      </View>

      {/* Submit Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <>
              <Ionicons name="send" size={20} color="#FFF" />
              <Text style={styles.submitButtonText}>
                {language === 'es' ? 'Enviar Solicitud' : 'Submit Request'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
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
      marginTop: 16,
      fontSize: 16,
      color: colors.textGray,
    },
    errorContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    },
    errorTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: colors.text,
      marginTop: 16,
    },
    errorText: {
      fontSize: 14,
      color: colors.textGray,
      textAlign: 'center',
      marginTop: 8,
    },
    retryButton: {
      marginTop: 24,
      paddingHorizontal: 24,
      paddingVertical: 12,
      backgroundColor: colors.primary,
      borderRadius: 8,
    },
    retryButtonText: {
      color: '#FFF',
      fontSize: 16,
      fontWeight: '600',
    },
    progressContainer: {
      padding: 16,
      backgroundColor: '#FFF',
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    progressHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    progressText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    progressSubtext: {
      fontSize: 12,
      color: colors.textGray,
    },
    progressBar: {
      height: 6,
      backgroundColor: colors.border,
      borderRadius: 3,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      backgroundColor: colors.primary,
      borderRadius: 3,
    },
    serviceInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      backgroundColor: '#FFF',
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: 12,
    },
    serviceIcon: {
      width: 48,
      height: 48,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
    },
    serviceTextContainer: {
      flex: 1,
    },
    serviceName: {
      fontSize: 16,
      fontWeight: 'bold',
      color: colors.text,
    },
    serviceDescription: {
      fontSize: 13,
      color: colors.textGray,
      marginTop: 2,
    },
    formContainer: {
      flex: 1,
    },
    footer: {
      padding: 16,
      backgroundColor: '#FFF',
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    submitButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      paddingVertical: 16,
      borderRadius: 12,
      gap: 8,
    },
    submitButtonDisabled: {
      opacity: 0.7,
    },
    submitButtonText: {
      color: '#FFF',
      fontSize: 16,
      fontWeight: '600',
    },
  });
