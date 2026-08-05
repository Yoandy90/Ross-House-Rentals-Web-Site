/**
 * Mi Reembolso - Deductions Screen
 * Step 5: Enter deductions and credits
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  StatusBar,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../../services/api';
import { useTranslation } from 'react-i18next';

export default function DeductionsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Deduction type
  const [useStandardDeduction, setUseStandardDeduction] = useState(true);

  // Itemized deductions
  const [mortgageInterest, setMortgageInterest] = useState('');
  const [propertyTaxes, setPropertyTaxes] = useState('');
  const [stateTaxesPaid, setStateTaxesPaid] = useState('');
  const [charitableDonations, setCharitableDonations] = useState('');
  const [medicalExpenses, setMedicalExpenses] = useState('');

  // Credits
  const [hasPaidChildcare, setHasPaidChildcare] = useState(false);
  const [childcareAmount, setChildcareAmount] = useState('');
  const [hasPaidEducation, setHasPaidEducation] = useState(false);
  const [educationAmount, setEducationAmount] = useState('');
  const [hasEarnedIncomeCredit, setHasEarnedIncomeCredit] = useState(false);
  const [hasRetirementContributions, setHasRetirementContributions] = useState(false);
  const [retirementAmount, setRetirementAmount] = useState('');

  // Live estimate
  const [liveEstimate, setLiveEstimate] = useState<any>(null);

  useEffect(() => {
    loadExistingData();
  }, []);

  const loadExistingData = async () => {
    if (!sessionId) return;
    try {
      const response = await api.get(`/tax-wizard/session/${sessionId}`);
      if (response.data.success && response.data.session.deductions_credits) {
        const ded = response.data.session.deductions_credits;
        setUseStandardDeduction(ded.use_standard_deduction !== false);
        setMortgageInterest(ded.mortgage_interest?.toString() || '');
        setPropertyTaxes(ded.property_taxes?.toString() || '');
        setStateTaxesPaid(ded.state_taxes_paid?.toString() || '');
        setCharitableDonations(ded.charitable_donations?.toString() || '');
        setMedicalExpenses(ded.medical_expenses?.toString() || '');
        setHasPaidChildcare(ded.has_childcare_expenses || false);
        setChildcareAmount(ded.childcare_amount?.toString() || '');
        setHasPaidEducation(ded.has_education_expenses || false);
        setEducationAmount(ded.education_amount?.toString() || '');
        setHasEarnedIncomeCredit(ded.claims_eitc || false);
        setHasRetirementContributions(ded.has_retirement_contributions || false);
        setRetirementAmount(ded.retirement_contributions?.toString() || '');
      }
      // Get estimate
      const estimateResponse = await api.get(`/tax-wizard/session/${sessionId}/estimate`);
      if (estimateResponse.data.success) {
        setLiveEstimate(estimateResponse.data);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: string) => {
    return value.replace(/[^0-9.]/g, '');
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const deductionsData = {
        use_standard_deduction: useStandardDeduction,
        mortgage_interest: !useStandardDeduction ? parseFloat(mortgageInterest) || 0 : 0,
        property_taxes: !useStandardDeduction ? parseFloat(propertyTaxes) || 0 : 0,
        state_local_taxes: !useStandardDeduction ? parseFloat(stateTaxesPaid) || 0 : 0,
        charitable_donations: !useStandardDeduction ? parseFloat(charitableDonations) || 0 : 0,
        medical_expenses: !useStandardDeduction ? parseFloat(medicalExpenses) || 0 : 0,
        has_childcare_expenses: hasPaidChildcare,
        childcare_expenses: hasPaidChildcare ? parseFloat(childcareAmount) || 0 : 0,
        has_education_expenses: hasPaidEducation,
        education_expenses: hasPaidEducation ? parseFloat(educationAmount) || 0 : 0,
        eligible_for_ctc: true, // Will be validated by backend based on dependents
        eligible_for_eic: hasEarnedIncomeCredit,
        has_retirement_contributions: hasRetirementContributions,
        retirement_contributions: hasRetirementContributions ? parseFloat(retirementAmount) || 0 : 0,
      };

      const response = await api.post(`/tax-wizard/session/${sessionId}/deductions`, deductionsData);

      if (response.data.success) {
        if (response.data.live_estimate) {
          setLiveEstimate(response.data.live_estimate);
        }
        router.push({
          pathname: '/tax-wizard/review',
          params: { sessionId }
        });
      }
    } catch (error) {
      console.error('Error saving:', error);
      Alert.alert(t('common.error'), t('wizard.couldNotSave'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#065F46" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#10B981" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#065F46" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        {/* Header */}
        <LinearGradient colors={['#065F46', '#10B981']} style={styles.header}>
          <View style={styles.headerRow}>
            <TouchableOpacity 
              onPress={() => router.push({
                pathname: '/tax-wizard/dependents',
                params: { sessionId }
              })} 
              style={styles.backBtn}
            >
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <View style={styles.headerTextContainer}>
              <Text style={styles.headerTitle}>Deducciones y Créditos</Text>
              <Text style={styles.headerStep}>Paso 5 de 6</Text>
            </View>
          </View>
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: '83.3%' }]} />
            </View>
          </View>
        </LinearGradient>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Live Estimate Card */}
          {liveEstimate && (
            <View style={styles.estimateCard}>
              <View style={styles.estimateHeader}>
                <Ionicons name="calculator" size={24} color="#10B981" />
                <Text style={styles.estimateLabel}>Reembolso Estimado</Text>
              </View>
              <Text style={[
                styles.estimateAmount,
                { color: liveEstimate.is_refund ? '#10B981' : '#EF4444' }
              ]}>
                {liveEstimate.is_refund ? '+' : '-'}${Math.abs(liveEstimate.estimated_refund || 0).toLocaleString()}
              </Text>
            </View>
          )}

          {/* Deduction Type */}
          <Text style={styles.sectionTitle}>Tipo de Deducción</Text>

          <View style={styles.optionsRow}>
            <TouchableOpacity
              style={[
                styles.optionCard,
                useStandardDeduction && styles.optionCardSelected,
              ]}
              onPress={() => setUseStandardDeduction(true)}
            >
              <View style={styles.optionIcon}>
                <Ionicons
                  name="checkmark-circle"
                  size={28}
                  color={useStandardDeduction ? '#10B981' : '#D1D5DB'}
                />
              </View>
              <Text style={[
                styles.optionTitle,
                useStandardDeduction && styles.optionTitleSelected,
              ]}>
                Estándar
              </Text>
              <Text style={styles.optionAmount}>$14,600</Text>
              <Text style={styles.optionDesc}>Recomendado para la mayoría</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.optionCard,
                !useStandardDeduction && styles.optionCardSelected,
              ]}
              onPress={() => setUseStandardDeduction(false)}
            >
              <View style={styles.optionIcon}>
                <Ionicons
                  name="list"
                  size={28}
                  color={!useStandardDeduction ? '#10B981' : '#D1D5DB'}
                />
              </View>
              <Text style={[
                styles.optionTitle,
                !useStandardDeduction && styles.optionTitleSelected,
              ]}>
                Detallada
              </Text>
              <Text style={styles.optionAmount}>Variable</Text>
              <Text style={styles.optionDesc}>Si tienes gastos grandes</Text>
            </TouchableOpacity>
          </View>

          {/* Itemized Deductions */}
          {!useStandardDeduction && (
            <View style={styles.itemizedSection}>
              <Text style={styles.subsectionTitle}>Deducciones Detalladas</Text>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Interés Hipotecario</Text>
                <View style={styles.currencyInput}>
                  <Text style={styles.currencySymbol}>$</Text>
                  <TextInput
                    style={styles.currencyField}
                    value={mortgageInterest}
                    onChangeText={(v) => setMortgageInterest(formatCurrency(v))}
                    placeholder="0.00"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Impuestos de Propiedad</Text>
                <View style={styles.currencyInput}>
                  <Text style={styles.currencySymbol}>$</Text>
                  <TextInput
                    style={styles.currencyField}
                    value={propertyTaxes}
                    onChangeText={(v) => setPropertyTaxes(formatCurrency(v))}
                    placeholder="0.00"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Impuestos Estatales Pagados</Text>
                <View style={styles.currencyInput}>
                  <Text style={styles.currencySymbol}>$</Text>
                  <TextInput
                    style={styles.currencyField}
                    value={stateTaxesPaid}
                    onChangeText={(v) => setStateTaxesPaid(formatCurrency(v))}
                    placeholder="0.00"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Donaciones Caritativas</Text>
                <View style={styles.currencyInput}>
                  <Text style={styles.currencySymbol}>$</Text>
                  <TextInput
                    style={styles.currencyField}
                    value={charitableDonations}
                    onChangeText={(v) => setCharitableDonations(formatCurrency(v))}
                    placeholder="0.00"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Gastos Médicos (>7.5% de ingresos)</Text>
                <View style={styles.currencyInput}>
                  <Text style={styles.currencySymbol}>$</Text>
                  <TextInput
                    style={styles.currencyField}
                    value={medicalExpenses}
                    onChangeText={(v) => setMedicalExpenses(formatCurrency(v))}
                    placeholder="0.00"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>
            </View>
          )}

          {/* Tax Credits */}
          <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Créditos Fiscales</Text>
          <Text style={styles.creditNote}>
            Los créditos reducen directamente tu impuesto, dólar por dólar
          </Text>

          {/* Childcare */}
          <View style={styles.toggleCard}>
            <View style={styles.toggleRow}>
              <View style={styles.toggleInfo}>
                <Ionicons name="school" size={24} color="#6B7280" />
                <Text style={styles.toggleLabel}>¿Pagaste guardería/childcare?</Text>
              </View>
              <Switch
                value={hasPaidChildcare}
                onValueChange={setHasPaidChildcare}
                trackColor={{ false: '#E5E7EB', true: '#86EFAC' }}
                thumbColor={hasPaidChildcare ? '#10B981' : '#9CA3AF'}
              />
            </View>
            {hasPaidChildcare && (
              <View style={styles.toggleExpanded}>
                <Text style={styles.label}>Monto pagado en childcare</Text>
                <View style={styles.currencyInput}>
                  <Text style={styles.currencySymbol}>$</Text>
                  <TextInput
                    style={styles.currencyField}
                    value={childcareAmount}
                    onChangeText={(v) => setChildcareAmount(formatCurrency(v))}
                    placeholder="0.00"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>
            )}
          </View>

          {/* Education */}
          <View style={styles.toggleCard}>
            <View style={styles.toggleRow}>
              <View style={styles.toggleInfo}>
                <Ionicons name="book" size={24} color="#6B7280" />
                <Text style={styles.toggleLabel}>¿Gastos de educación universitaria?</Text>
              </View>
              <Switch
                value={hasPaidEducation}
                onValueChange={setHasPaidEducation}
                trackColor={{ false: '#E5E7EB', true: '#86EFAC' }}
                thumbColor={hasPaidEducation ? '#10B981' : '#9CA3AF'}
              />
            </View>
            {hasPaidEducation && (
              <View style={styles.toggleExpanded}>
                <Text style={styles.label}>Monto pagado en tuición</Text>
                <View style={styles.currencyInput}>
                  <Text style={styles.currencySymbol}>$</Text>
                  <TextInput
                    style={styles.currencyField}
                    value={educationAmount}
                    onChangeText={(v) => setEducationAmount(formatCurrency(v))}
                    placeholder="0.00"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>
            )}
          </View>

          {/* EITC */}
          <View style={styles.toggleCard}>
            <View style={styles.toggleRow}>
              <View style={styles.toggleInfo}>
                <Ionicons name="cash" size={24} color="#6B7280" />
                <Text style={styles.toggleLabel}>Earned Income Credit (EITC)</Text>
              </View>
              <Switch
                value={hasEarnedIncomeCredit}
                onValueChange={setHasEarnedIncomeCredit}
                trackColor={{ false: '#E5E7EB', true: '#86EFAC' }}
                thumbColor={hasEarnedIncomeCredit ? '#10B981' : '#9CA3AF'}
              />
            </View>
            <Text style={styles.toggleHint}>
              Si tus ingresos son moderados, podrías calificar
            </Text>
          </View>

          {/* Retirement */}
          <View style={styles.toggleCard}>
            <View style={styles.toggleRow}>
              <View style={styles.toggleInfo}>
                <Ionicons name="wallet" size={24} color="#6B7280" />
                <Text style={styles.toggleLabel}>¿Contribuciones a IRA/401k?</Text>
              </View>
              <Switch
                value={hasRetirementContributions}
                onValueChange={setHasRetirementContributions}
                trackColor={{ false: '#E5E7EB', true: '#86EFAC' }}
                thumbColor={hasRetirementContributions ? '#10B981' : '#9CA3AF'}
              />
            </View>
            {hasRetirementContributions && (
              <View style={styles.toggleExpanded}>
                <Text style={styles.label}>Total contribuido</Text>
                <View style={styles.currencyInput}>
                  <Text style={styles.currencySymbol}>$</Text>
                  <TextInput
                    style={styles.currencyField}
                    value={retirementAmount}
                    onChangeText={(v) => setRetirementAmount(formatCurrency(v))}
                    placeholder="0.00"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>
            )}
          </View>

          <View style={{ height: 120 }} />
        </ScrollView>

        {/* Bottom CTA */}
        <View style={styles.bottomCTA}>
          <TouchableOpacity
            style={styles.nextButton}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.nextButtonText}>Revisar Declaración</Text>
                <Ionicons name="arrow-forward" size={20} color="#fff" />
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#065F46',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  headerTextContainer: {
    flex: 1,
    marginLeft: 8,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
  },
  headerStep: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  progressContainer: {
    marginTop: 16,
  },
  progressBar: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 3,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#fff',
    borderRadius: 3,
  },
  content: {
    backgroundColor: '#F9FAFB',
    flex: 1,
    padding: 20,
  },
  estimateCard: {
    backgroundColor: '#F0FDF4',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  estimateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  estimateLabel: {
    fontSize: 14,
    color: '#065F46',
    marginLeft: 8,
    fontWeight: '600',
  },
  estimateAmount: {
    fontSize: 36,
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  optionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  optionCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  optionCardSelected: {
    borderColor: '#10B981',
    backgroundColor: '#F0FDF4',
  },
  optionIcon: {
    marginBottom: 8,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 4,
  },
  optionTitleSelected: {
    color: '#065F46',
  },
  optionAmount: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  optionDesc: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  itemizedSection: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  subsectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  currencyInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#065F46',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  currencySymbol: {
    fontSize: 16,
    color: '#6B7280',
    paddingLeft: 16,
  },
  currencyField: {
    flex: 1,
    padding: 16,
    fontSize: 16,
    color: '#111827',
  },
  creditNote: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
  },
  toggleCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  toggleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  toggleLabel: {
    fontSize: 15,
    color: '#111827',
    marginLeft: 12,
    flex: 1,
  },
  toggleHint: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 8,
    marginLeft: 36,
  },
  toggleExpanded: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  bottomCTA: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    padding: 20,
    paddingBottom: 34,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  nextButton: {
    backgroundColor: '#10B981',
    borderRadius: 14,
    padding: 18,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  nextButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
    marginRight: 8,
  },
});
