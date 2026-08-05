import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../../constants/colors';
import { CustomInput } from '../../components/CustomInput';
import { CustomButton } from '../../components/CustomButton';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import CustomHeader from '../../components/CustomHeader';
import { useTranslation } from 'react-i18next';

export default function KYC() {
  const colors = useThemeColors();
  const { t } = useTranslation();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [kycStatus, setKycStatus] = useState<any>(null);

  // Form data
  const [formData, setFormData] = useState({
    full_name: user?.name || '',
    date_of_birth: '',
    ssn_or_itin: '',
    address_street: '',
    address_city: '',
    address_state: '',
    address_zip: '',
    marital_status: 'single',
    spouse_name: '',
    spouse_ssn_or_itin: '',
    num_dependents: 0,
    dependents: [],
    primary_phone: user?.phone || '',
    secondary_phone: '',
    preferred_contact_method: 'email',
    preferred_contact_time: 'afternoon',
  });

  useEffect(() => {
    checkKycStatus();
  }, []);

  const checkKycStatus = async () => {
    try {
      const response = await api.get('/kyc/status');
      setKycStatus(response.data);
      
      if (response.data.completed) {
        // Load existing KYC data
        const kycData = await api.get('/kyc/data');
        setFormData({
          ...formData,
          ...kycData.data,
          ssn_or_itin: '', // Don't prefill sensitive data
          spouse_ssn_or_itin: '',
        });
      }
    } catch (error) {
      console.error('Error checking KYC status:', error);
    }
  };

  const handleSubmit = async () => {
    // Validate required fields
    if (!formData.full_name || !formData.date_of_birth || !formData.ssn_or_itin ||
        !formData.address_street || !formData.address_city || !formData.address_state ||
        !formData.address_zip || !formData.primary_phone) {
      Alert.alert('Campos Requeridos', 'Por favor complete todos los campos obligatorios');
      return;
    }

    // Validate SSN format
    const ssnClean = formData.ssn_or_itin.replace(/[^0-9]/g, '');
    if (ssnClean.length !== 9) {
      Alert.alert('SSN/ITIN Inválido', 'El SSN/ITIN debe tener 9 dígitos');
      return;
    }

    // Validate spouse SSN if married
    if (formData.marital_status === 'married' && formData.spouse_ssn_or_itin) {
      const spouseSsnClean = formData.spouse_ssn_or_itin.replace(/[^0-9]/g, '');
      if (spouseSsnClean.length !== 9) {
        Alert.alert('SSN/ITIN Inválido', 'El SSN/ITIN del cónyuge debe tener 9 dígitos');
        return;
      }
    }

    setLoading(true);
    try {
      await api.post('/kyc/submit', formData);
      
      Alert.alert(
        '¡Éxito! 🎉',
        'Tu información KYC ha sido enviada correctamente. Ahora tienes prioridad al agendar citas.',
        [
          {
            text: 'Agendar Cita',
            onPress: () => router.push('/(tabs)/appointments'),
          },
        ]
      );
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'No se pudo enviar la información');
    } finally {
      setLoading(false);
    }
  };

  const renderStep1 = () => (
    <>
      <Text style={styles.stepTitle}>{t('kyc.step1')}</Text>
      
      <CustomInput
        label="Nombre Completo *"
        value={formData.full_name}
        onChangeText={(text) => setFormData({ ...formData, full_name: text })}
        placeholder={t('kyc.namePlaceholder', 'Juan Pérez López')}
        autoCapitalize="words"
      />

      <CustomInput
        label="Fecha de Nacimiento *"
        value={formData.date_of_birth}
        onChangeText={(text) => setFormData({ ...formData, date_of_birth: text })}
        placeholder="1990-12-31"
      />

      <CustomInput
        label="SSN o ITIN *"
        value={formData.ssn_or_itin}
        onChangeText={(text) => setFormData({ ...formData, ssn_or_itin: text })}
        placeholder="XXX-XX-XXXX"
        keyboardType="number-pad"
        maxLength={11}
      />

      <Text style={styles.helperText}>
        Tu SSN/ITIN es confidencial y está protegido. Solo guardamos los últimos 4 dígitos.
      </Text>
    </>
  );

  const renderStep2 = () => (
    <>
      <Text style={styles.stepTitle}>Dirección</Text>
      
      <CustomInput
        label={t('kyc.streetLabel', 'Calle y Número *')}
        value={formData.address_street}
        onChangeText={(text) => setFormData({ ...formData, address_street: text })}
        placeholder="123 Main Street"
      />

      <CustomInput
        label="Ciudad *"
        value={formData.address_city}
        onChangeText={(text) => setFormData({ ...formData, address_city: text })}
        placeholder="Los Angeles"
      />

      <View style={styles.row}>
        <View style={styles.halfWidth}>
          <CustomInput
            label="Estado *"
            value={formData.address_state}
            onChangeText={(text) => setFormData({ ...formData, address_state: text })}
            placeholder="CA"
            maxLength={2}
            autoCapitalize="characters"
          />
        </View>
        <View style={styles.halfWidth}>
          <CustomInput
            label={t('kyc.zipLabel', 'Código Postal *')}
            value={formData.address_zip}
            onChangeText={(text) => setFormData({ ...formData, address_zip: text })}
            placeholder="90001"
            keyboardType="number-pad"
            maxLength={10}
          />
        </View>
      </View>
    </>
  );

  const renderStep3 = () => (
    <>
      <Text style={styles.stepTitle}>Estado Civil y Familia</Text>
      
      <Text style={styles.label}>Estado Civil *</Text>
      <View style={styles.radioGroup}>
        {[
          { value: 'single', label: 'Soltero(a)' },
          { value: 'married', label: 'Casado(a)' },
          { value: 'divorced', label: 'Divorciado(a)' },
          { value: 'widowed', label: 'Viudo(a)' },
        ].map((option) => (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.radioButton,
              formData.marital_status === option.value && styles.radioButtonActive,
            ]}
            onPress={() => setFormData({ ...formData, marital_status: option.value })}
          >
            <Ionicons
              name={formData.marital_status === option.value ? 'radio-button-on' : 'radio-button-off'}
              size={20}
              color={formData.marital_status === option.value ? colors.primary : colors.textGray}
            />
            <Text style={styles.radioLabel}>{option.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {formData.marital_status === 'married' && (
        <>
          <CustomInput
            label={t('kyc.spouseName', 'Nombre del Cónyuge')}
            value={formData.spouse_name}
            onChangeText={(text) => setFormData({ ...formData, spouse_name: text })}
            placeholder={t('kyc.spouseNamePlaceholder', 'María Pérez')}
            autoCapitalize="words"
          />

          <CustomInput
            label={t('kyc.spouseSSN', 'SSN/ITIN del Cónyuge')}
            value={formData.spouse_ssn_or_itin}
            onChangeText={(text) => setFormData({ ...formData, spouse_ssn_or_itin: text })}
            placeholder="XXX-XX-XXXX"
            keyboardType="number-pad"
            maxLength={11}
          />
        </>
      )}

      <CustomInput
        label={t('kyc.dependentCount', 'Número de Dependientes')}
        value={formData.num_dependents.toString()}
        onChangeText={(text) => setFormData({ ...formData, num_dependents: parseInt(text) || 0 })}
        placeholder="0"
        keyboardType="number-pad"
      />
    </>
  );

  const renderStep4 = () => (
    <>
      <Text style={styles.stepTitle}>Preferencias de Contacto</Text>
      
      <CustomInput
        label={t('kyc.primaryPhone', 'Teléfono Principal *')}
        value={formData.primary_phone}
        onChangeText={(text) => setFormData({ ...formData, primary_phone: text })}
        placeholder="(555) 123-4567"
        keyboardType="phone-pad"
      />

      <CustomInput
        label={t('kyc.secondaryPhone', 'Teléfono Secundario')}
        value={formData.secondary_phone}
        onChangeText={(text) => setFormData({ ...formData, secondary_phone: text })}
        placeholder="(555) 987-6543"
        keyboardType="phone-pad"
      />

      <Text style={styles.label}>Método de Contacto Preferido</Text>
      <View style={styles.radioGroup}>
        {[
          { value: 'email', label: 'Email', icon: 'mail' },
          { value: 'phone', label: 'Teléfono', icon: 'call' },
          { value: 'text', label: 'Mensaje de Texto', icon: 'chatbubble' },
        ].map((option) => (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.radioButton,
              formData.preferred_contact_method === option.value && styles.radioButtonActive,
            ]}
            onPress={() => setFormData({ ...formData, preferred_contact_method: option.value })}
          >
            <Ionicons
              name={option.icon as any}
              size={20}
              color={formData.preferred_contact_method === option.value ? colors.primary : colors.textGray}
            />
            <Text style={styles.radioLabel}>{option.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Mejor Horario para Contactar</Text>
      <View style={styles.radioGroup}>
        {[
          { value: 'morning', label: 'Mañana (8am-12pm)' },
          { value: 'afternoon', label: 'Tarde (12pm-5pm)' },
          { value: 'evening', label: 'Noche (5pm-8pm)' },
        ].map((option) => (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.radioButton,
              formData.preferred_contact_time === option.value && styles.radioButtonActive,
            ]}
            onPress={() => setFormData({ ...formData, preferred_contact_time: option.value })}
          >
            <Ionicons
              name={formData.preferred_contact_time === option.value ? 'radio-button-on' : 'radio-button-off'}
              size={20}
              color={formData.preferred_contact_time === option.value ? colors.primary : colors.textGray}
            />
            <Text style={styles.radioLabel}>{option.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </>
  );

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Custom Header */}
      <CustomHeader 
        title="Verificación KYC"
        showBack={true}
      />
      
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Icon & Subtitle */}
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <Ionicons name="shield-checkmark" size={40} color={colors.primary} />
            </View>
            <Text style={styles.subtitle}>
              Complete su información para obtener prioridad al agendar citas
            </Text>
          </View>

          {/* Progress Indicator */}
          <View style={styles.progressContainer}>
            {[1, 2, 3, 4].map((s) => (
              <View
                key={s}
                style={[
                  styles.progressDot,
                  s <= step && styles.progressDotActive,
                  s < step && styles.progressDotCompleted,
                ]}
              />
            ))}
          </View>

          {/* Form Steps */}
          <View style={styles.form}>
            {step === 1 && renderStep1()}
            {step === 2 && renderStep2()}
            {step === 3 && renderStep3()}
            {step === 4 && renderStep4()}
          </View>

          {/* Navigation Buttons */}
          <View style={styles.buttonContainer}>
            {step > 1 && (
              <CustomButton
                title={t('common.back')}
                onPress={() => setStep(step - 1)}
                variant="outline"
                style={styles.button}
              />
            )}
            {step < 4 ? (
              <CustomButton
                title={t('common.next')}
                onPress={() => setStep(step + 1)}
                style={styles.button}
              />
            ) : (
              <CustomButton
                title={t('kyc.submit')}
                onPress={handleSubmit}
                loading={loading}
                style={styles.button}
              />
            )}
          </View>

          {/* Benefits Card */}
          <View style={styles.benefitsCard}>
            <Ionicons name="star" size={24} color={colors.warning} />
            <Text style={styles.benefitsText}>
              Al completar el KYC, obtendrás prioridad en el calendario de citas y tu asesor tendrá toda la información necesaria desde el primer día.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundGray,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 180, // Increased for full visibility with bottom tab bar and keyboard
  },
  header: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textGray,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginVertical: 24,
  },
  progressDot: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
  },
  progressDotActive: {
    backgroundColor: colors.primary,
  },
  progressDotCompleted: {
    backgroundColor: colors.success,
  },
  form: {
    marginTop: 8,
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 16,
  },
  helperText: {
    fontSize: 12,
    color: colors.textGray,
    marginTop: -8,
    marginBottom: 16,
    fontStyle: 'italic',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfWidth: {
    flex: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  radioGroup: {
    marginBottom: 16,
  },
  radioButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    backgroundColor: colors.background,
    marginBottom: 8,
    gap: 12,
  },
  radioButtonActive: {
    backgroundColor: colors.primary + '10',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  radioLabel: {
    fontSize: 15,
    color: colors.text,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  button: {
    flex: 1,
  },
  benefitsCard: {
    flexDirection: 'row',
    backgroundColor: colors.warning + '15',
    borderRadius: 12,
    padding: 16,
    marginTop: 24,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.warning + '30',
  },
  benefitsText: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
    lineHeight: 18,
  },
});