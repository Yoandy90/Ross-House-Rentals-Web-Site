import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useThemeColors } from '../../constants/colors';
import api from '../../services/api';
import CustomHeader from '../../components/CustomHeader';
import { useTranslation } from 'react-i18next';

export default function LoanApplicationScreen() {
  const colors = useThemeColors();
  const { t } = useTranslation();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const params = useLocalSearchParams();
  
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [successMessage, setSuccessMessage] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // Application data
  const [phone, setPhone] = useState('+1 234 567 8900'); // Pre-filled for testing
  const [whatsappOptin, setWhatsappOptin] = useState(true);
  const [email, setEmail] = useState('test@example.com'); // Pre-filled for testing
  const [monthlyIncome, setMonthlyIncome] = useState('3000'); // Pre-filled for testing
  const [monthlyExpenses, setMonthlyExpenses] = useState('1500'); // Pre-filled for testing
  const [employmentStatus, setEmploymentStatus] = useState('employed');
  const [employerName, setEmployerName] = useState('Test Company');
  const [employmentYears, setEmploymentYears] = useState('2');

  const handleSubmit = async () => {
    
    // Use pre-filled values directly if form values are empty
    const finalPhone = phone || '+1 234 567 8900';
    const finalEmail = email || 'test@example.com';
    const finalIncome = monthlyIncome || '3000';
    const finalExpenses = monthlyExpenses || '1500';
    const finalEmploymentStatus = employmentStatus || 'employed';
    const finalEmployerName = employerName || 'Test Company';
    const finalEmploymentYears = employmentYears || '2';
    

    const income = parseFloat(finalIncome);
    const expenses = parseFloat(finalExpenses);


    if (isNaN(income) || income <= 0) {
      Alert.alert('Error', 'Ingresa un ingreso mensual válido');
      return;
    }

    if (isNaN(expenses) || expenses < 0) {
      Alert.alert('Error', 'Ingresa gastos mensuales válidos');
      return;
    }

    try {
      setLoading(true);

      const applicationData = {
        product_id: params.productId as string,
        amount: parseFloat(params.amount as string),
        term_count: parseInt(params.termMonths as string),
        contacts: {
          phone: finalPhone,
          whatsapp_optin: whatsappOptin,
          email: finalEmail,
          language: 'es',
        },
        financials: {
          income_monthly: income,
          expenses_monthly: expenses,
          employment_status: finalEmploymentStatus,
          employer_name: finalEmployerName,
          employment_years: finalEmploymentYears ? parseInt(finalEmploymentYears) : 2,
        },
        consents: ['privacy', 'bank_data', 'credit_check'],
      };

      const response = await api.post('/loan-applications', applicationData);

      // Show success modal
      setShowSuccessModal(true);
      setLoading(false);
      
      
      // Navigate after 3 seconds
      setTimeout(() => {
        setShowSuccessModal(false);
        router.push('/my-loans');
      }, 3000);
      
      return; // Exit function after success
    } catch (error: any) {
      console.error('❌ Error submitting application:', error);
      console.error('Error details:', error.response?.data);
      const message = error.response?.data?.detail || 'No se pudo enviar la solicitud';
      Alert.alert('❌ Error', message);
    } finally {
      setLoading(false);
    }
  };

  const renderStep1 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Información de Contacto</Text>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Teléfono *</Text>
        <TextInput
          style={styles.input}
          placeholder="+1 234 567 8900"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          placeholderTextColor={colors.textGray}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Email *</Text>
        <TextInput
          style={styles.input}
          placeholder="tu@email.com"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          placeholderTextColor={colors.textGray}
        />
      </View>

      <TouchableOpacity
        style={styles.checkboxRow}
        onPress={() => setWhatsappOptin(!whatsappOptin)}
      >
        <Ionicons
          name={whatsappOptin ? 'checkbox' : 'square-outline'}
          size={24}
          color={colors.primary}
        />
        <Text style={styles.checkboxLabel}>
          Acepto recibir notificaciones por WhatsApp
        </Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.nextButton} onPress={() => setStep(2)}>
        <LinearGradient
          colors={[colors.primary, colors.secondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.nextButtonGradient}
        >
          <Text style={styles.nextButtonText}>Continuar</Text>
          <Ionicons name="arrow-forward" size={20} color="#FFF" />
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Información Financiera</Text>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Ingreso Mensual *</Text>
        <TextInput
          style={styles.input}
          placeholder="$0.00"
          value={monthlyIncome}
          onChangeText={setMonthlyIncome}
          keyboardType="decimal-pad"
          placeholderTextColor={colors.textGray}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Gastos Mensuales *</Text>
        <TextInput
          style={styles.input}
          placeholder="$0.00"
          value={monthlyExpenses}
          onChangeText={setMonthlyExpenses}
          keyboardType="decimal-pad"
          placeholderTextColor={colors.textGray}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Empleador (opcional)</Text>
        <TextInput
          style={styles.input}
          placeholder="Nombre de la empresa"
          value={employerName}
          onChangeText={setEmployerName}
          placeholderTextColor={colors.textGray}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Años de Empleo (opcional)</Text>
        <TextInput
          style={styles.input}
          placeholder="0"
          value={employmentYears}
          onChangeText={setEmploymentYears}
          keyboardType="number-pad"
          placeholderTextColor={colors.textGray}
        />
      </View>

      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => setStep(1)}
        >
          <Ionicons name="arrow-back" size={20} color={colors.primary} />
          <Text style={styles.backButtonText}>Atrás</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.submitButton, loading && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          <LinearGradient
            colors={[colors.primary, colors.secondary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.submitButtonGradient}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <Text style={styles.submitButtonText}>{t('loanApplication.submit')}</Text>
                <Ionicons name="checkmark" size={20} color="#FFF" />
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <CustomHeader 
        title={t('loanApplication.title')}
        showBack
        onBackPress={() => router.back()}
      />
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>

          <View style={styles.content}>
            {/* Summary Card */}
            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Monto:</Text>
                <Text style={styles.summaryValue}>
                  ${parseFloat(params.amount as string).toLocaleString()}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Plazo:</Text>
                <Text style={styles.summaryValue}>{params.termMonths} meses</Text>
              </View>
            </View>

            {/* Progress */}
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${(step / 2) * 100}%` }]} />
              </View>
              <Text style={styles.progressText}>Paso {step} de 2</Text>
            </View>

            {/* Steps */}
            {step === 1 && renderStep1()}
            {step === 2 && renderStep2()}

            {/* Info */}
            <View style={styles.infoCard}>
              <Ionicons name="shield-checkmark" size={20} color={colors.success} />
              <Text style={styles.infoText}>
                Tu información está segura y será utilizada únicamente para evaluar tu solicitud.
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Success Modal */}
      <Modal
        visible={showSuccessModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowSuccessModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.successIcon}>
              <Ionicons name="checkmark-circle" size={64} color="#10B981" />
            </View>
            <Text style={styles.modalTitle}>¡Solicitud Enviada!</Text>
            <Text style={styles.modalMessage}>
              Tu solicitud de préstamo ha sido recibida exitosamente. Te contactaremos pronto para continuar con el proceso.
            </Text>
            <View style={styles.modalFooter}>
              <Text style={styles.redirectText}>Redirigiendo a Mis Solicitudes...</Text>
              <ActivityIndicator size="small" color="#ED201D" />
            </View>
          </View>
        </View>
      </Modal>
    </View>
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
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    maxWidth: 400,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  successIcon: {
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textDark,
    marginBottom: 12,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 16,
    color: colors.textGray,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  modalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  redirectText: {
    fontSize: 14,
    color: colors.textGray,
    fontStyle: 'italic',
  },
  summaryCard: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 6,
  },
  summaryLabel: {
    fontSize: 14,
    color: colors.textGray,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
  },
  progressContainer: {
    marginBottom: 24,
  },
  progressBar: {
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
  },
  progressText: {
    fontSize: 12,
    color: colors.textGray,
    textAlign: 'center',
    marginTop: 8,
  },
  stepContent: {
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: colors.backgroundGray,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 16,
  },
  checkboxLabel: {
    fontSize: 14,
    color: colors.text,
    flex: 1,
  },
  nextButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 8,
  },
  nextButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 8,
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  backButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    backgroundColor: colors.backgroundGray,
    borderWidth: 2,
    borderColor: colors.primary,
    gap: 8,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
  },
  submitButton: {
    flex: 2,
    borderRadius: 12,
    overflow: 'hidden',
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 8,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: colors.success + '10',
    padding: 16,
    borderRadius: 12,
    gap: 12,
    alignItems: 'center',
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
    lineHeight: 18,
  },
});