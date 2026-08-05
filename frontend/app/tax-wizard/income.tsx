/**
 * Mi Reembolso - Income Screen
 * Step 3: Enter income information (W-2, 1099, etc.)
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

interface W2Source {
  employer_name: string;
  employer_ein: string;
  amount: string;
  federal_withheld: string;
  state_withheld: string;
}

export default function IncomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // W-2 income
  const [w2Sources, setW2Sources] = useState<W2Source[]>([{
    employer_name: '',
    employer_ein: '',
    amount: '',
    federal_withheld: '',
    state_withheld: '',
  }]);

  // Other income toggles
  const [hasUnemployment, setHasUnemployment] = useState(false);
  const [unemploymentAmount, setUnemploymentAmount] = useState('');
  const [hasSelfEmployment, setHasSelfEmployment] = useState(false);
  const [selfEmploymentIncome, setSelfEmploymentIncome] = useState('');
  const [selfEmploymentExpenses, setSelfEmploymentExpenses] = useState('');
  const [hasOtherIncome, setHasOtherIncome] = useState(false);
  const [otherIncomeAmount, setOtherIncomeAmount] = useState('');

  // Live estimate
  const [liveEstimate, setLiveEstimate] = useState<any>(null);

  useEffect(() => {
    loadExistingData();
  }, []);

  const loadExistingData = async () => {
    if (!sessionId) return;
    try {
      const response = await api.get(`/tax-wizard/session/${sessionId}`);
      if (response.data.success && response.data.session.income) {
        const income = response.data.session.income;
        if (income.w2_sources?.length > 0) {
          setW2Sources(income.w2_sources.map((s: any) => ({
            employer_name: s.employer_name || '',
            employer_ein: s.employer_ein || '',
            amount: s.amount?.toString() || '',
            federal_withheld: s.federal_withheld?.toString() || '',
            state_withheld: s.state_withheld?.toString() || '',
          })));
        }
        setHasUnemployment(income.has_unemployment || false);
        setUnemploymentAmount(income.unemployment_amount?.toString() || '');
        setHasSelfEmployment(income.has_self_employment || false);
        setSelfEmploymentIncome(income.self_employment_income?.toString() || '');
        setSelfEmploymentExpenses(income.self_employment_expenses?.toString() || '');
        setHasOtherIncome(income.has_other_income || false);
        setOtherIncomeAmount(income.other_income_amount?.toString() || '');
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

  const addW2 = () => {
    setW2Sources([...w2Sources, {
      employer_name: '',
      employer_ein: '',
      amount: '',
      federal_withheld: '',
      state_withheld: '',
    }]);
  };

  const removeW2 = (index: number) => {
    if (w2Sources.length > 1) {
      setW2Sources(w2Sources.filter((_, i) => i !== index));
    }
  };

  const updateW2 = (index: number, field: keyof W2Source, value: string) => {
    const updated = [...w2Sources];
    updated[index][field] = value;
    setW2Sources(updated);
  };

  const formatCurrency = (value: string) => {
    const numbers = value.replace(/[^0-9.]/g, '');
    return numbers;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const validW2Sources = w2Sources.filter(w => w.employer_name || w.amount);
      
      const incomeData = {
        has_w2: validW2Sources.length > 0,
        w2_count: validW2Sources.length,
        w2_sources: validW2Sources.map(w => ({
          type: 'w2',
          employer_name: w.employer_name,
          ein: w.employer_ein,
          amount: parseFloat(w.amount) || 0,
          federal_withheld: parseFloat(w.federal_withheld) || 0,
          state_withheld: parseFloat(w.state_withheld) || 0,
        })),
        form_1099_sources: [],
        has_unemployment: hasUnemployment,
        unemployment_amount: hasUnemployment ? parseFloat(unemploymentAmount) || 0 : 0,
        has_self_employment: hasSelfEmployment,
        self_employment_income: hasSelfEmployment ? parseFloat(selfEmploymentIncome) || 0 : 0,
        self_employment_expenses: hasSelfEmployment ? parseFloat(selfEmploymentExpenses) || 0 : 0,
        has_other_income: hasOtherIncome,
        other_income_amount: hasOtherIncome ? parseFloat(otherIncomeAmount) || 0 : 0,
        other_income_description: '',
      };

      const response = await api.post(`/tax-wizard/session/${sessionId}/income`, incomeData);

      if (response.data.success) {
        if (response.data.live_estimate) {
          setLiveEstimate(response.data.live_estimate);
        }
        router.push({
          pathname: '/tax-wizard/dependents',
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
                pathname: '/tax-wizard/filing-status',
                params: { sessionId }
              })} 
              style={styles.backBtn}
            >
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <View style={styles.headerTextContainer}>
              <Text style={styles.headerTitle}>Ingresos</Text>
              <Text style={styles.headerStep}>Paso 3 de 6</Text>
            </View>
          </View>
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: '50%' }]} />
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
              <Text style={styles.estimateNote}>Este es un estimado preliminar</Text>
            </View>
          )}

          {/* W-2 Income */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Ingresos W-2 (Empleador)</Text>
            <TouchableOpacity 
              style={styles.scanButton}
              onPress={() => router.push({
                pathname: '/tax-wizard/w2-scanner',
                params: { sessionId }
              })}
            >
              <Ionicons name="scan" size={18} color="#fff" />
              <Text style={styles.scanButtonText}>Escanear W-2</Text>
            </TouchableOpacity>
          </View>

          {w2Sources.map((w2, index) => (
            <View key={index} style={styles.w2Card}>
              <View style={styles.w2Header}>
                <Text style={styles.w2Title}>W-2 #{index + 1}</Text>
                {w2Sources.length > 1 && (
                  <TouchableOpacity onPress={() => removeW2(index)}>
                    <Ionicons name="trash-outline" size={20} color="#EF4444" />
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Nombre del Empleador</Text>
                <TextInput
                  style={styles.input}
                  value={w2.employer_name}
                  onChangeText={(v) => updateW2(index, 'employer_name', v)}
                  placeholder="Walmart, Amazon, etc."
                  placeholderTextColor="#9CA3AF"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Salario Bruto (Box 1)</Text>
                <View style={styles.currencyInput}>
                  <Text style={styles.currencySymbol}>$</Text>
                  <TextInput
                    style={styles.currencyField}
                    value={w2.amount}
                    onChangeText={(v) => updateW2(index, 'amount', formatCurrency(v))}
                    placeholder="45,000.00"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>

              <View style={styles.row}>
                <View style={styles.inputHalf}>
                  <Text style={styles.label}>Impuesto Federal Retenido</Text>
                  <View style={styles.currencyInput}>
                    <Text style={styles.currencySymbol}>$</Text>
                    <TextInput
                      style={styles.currencyField}
                      value={w2.federal_withheld}
                      onChangeText={(v) => updateW2(index, 'federal_withheld', formatCurrency(v))}
                      placeholder="4,500.00"
                      placeholderTextColor="#9CA3AF"
                      keyboardType="decimal-pad"
                    />
                  </View>
                </View>
                <View style={styles.inputHalf}>
                  <Text style={styles.label}>Impuesto Estatal Retenido</Text>
                  <View style={styles.currencyInput}>
                    <Text style={styles.currencySymbol}>$</Text>
                    <TextInput
                      style={styles.currencyField}
                      value={w2.state_withheld}
                      onChangeText={(v) => updateW2(index, 'state_withheld', formatCurrency(v))}
                      placeholder="0.00"
                      placeholderTextColor="#9CA3AF"
                      keyboardType="decimal-pad"
                    />
                  </View>
                </View>
              </View>
            </View>
          ))}

          <TouchableOpacity style={styles.addButton} onPress={addW2}>
            <Ionicons name="add-circle-outline" size={24} color="#10B981" />
            <Text style={styles.addButtonText}>Agregar otro W-2</Text>
          </TouchableOpacity>

          {/* Other Income Types */}
          <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Otros Ingresos</Text>

          {/* Unemployment */}
          <View style={styles.toggleCard}>
            <View style={styles.toggleRow}>
              <View style={styles.toggleInfo}>
                <Ionicons name="business" size={24} color="#6B7280" />
                <Text style={styles.toggleLabel}>¿Recibiste desempleo?</Text>
              </View>
              <Switch
                value={hasUnemployment}
                onValueChange={setHasUnemployment}
                trackColor={{ false: '#E5E7EB', true: '#86EFAC' }}
                thumbColor={hasUnemployment ? '#10B981' : '#9CA3AF'}
              />
            </View>
            {hasUnemployment && (
              <View style={styles.toggleExpanded}>
                <Text style={styles.label}>Monto Total de Desempleo</Text>
                <View style={styles.currencyInput}>
                  <Text style={styles.currencySymbol}>$</Text>
                  <TextInput
                    style={styles.currencyField}
                    value={unemploymentAmount}
                    onChangeText={(v) => setUnemploymentAmount(formatCurrency(v))}
                    placeholder="0.00"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>
            )}
          </View>

          {/* Self Employment */}
          <View style={styles.toggleCard}>
            <View style={styles.toggleRow}>
              <View style={styles.toggleInfo}>
                <Ionicons name="briefcase" size={24} color="#6B7280" />
                <Text style={styles.toggleLabel}>¿Tienes negocio propio?</Text>
              </View>
              <Switch
                value={hasSelfEmployment}
                onValueChange={setHasSelfEmployment}
                trackColor={{ false: '#E5E7EB', true: '#86EFAC' }}
                thumbColor={hasSelfEmployment ? '#10B981' : '#9CA3AF'}
              />
            </View>
            {hasSelfEmployment && (
              <View style={styles.toggleExpanded}>
                <View style={styles.row}>
                  <View style={styles.inputHalf}>
                    <Text style={styles.label}>Ingresos del Negocio</Text>
                    <View style={styles.currencyInput}>
                      <Text style={styles.currencySymbol}>$</Text>
                      <TextInput
                        style={styles.currencyField}
                        value={selfEmploymentIncome}
                        onChangeText={(v) => setSelfEmploymentIncome(formatCurrency(v))}
                        placeholder="0.00"
                        placeholderTextColor="#9CA3AF"
                        keyboardType="decimal-pad"
                      />
                    </View>
                  </View>
                  <View style={styles.inputHalf}>
                    <Text style={styles.label}>Gastos del Negocio</Text>
                    <View style={styles.currencyInput}>
                      <Text style={styles.currencySymbol}>$</Text>
                      <TextInput
                        style={styles.currencyField}
                        value={selfEmploymentExpenses}
                        onChangeText={(v) => setSelfEmploymentExpenses(formatCurrency(v))}
                        placeholder="0.00"
                        placeholderTextColor="#9CA3AF"
                        keyboardType="decimal-pad"
                      />
                    </View>
                  </View>
                </View>
              </View>
            )}
          </View>

          {/* Other Income */}
          <View style={styles.toggleCard}>
            <View style={styles.toggleRow}>
              <View style={styles.toggleInfo}>
                <Ionicons name="cash" size={24} color="#6B7280" />
                <Text style={styles.toggleLabel}>¿Otros ingresos?</Text>
              </View>
              <Switch
                value={hasOtherIncome}
                onValueChange={setHasOtherIncome}
                trackColor={{ false: '#E5E7EB', true: '#86EFAC' }}
                thumbColor={hasOtherIncome ? '#10B981' : '#9CA3AF'}
              />
            </View>
            {hasOtherIncome && (
              <View style={styles.toggleExpanded}>
                <Text style={styles.label}>Monto de Otros Ingresos</Text>
                <View style={styles.currencyInput}>
                  <Text style={styles.currencySymbol}>$</Text>
                  <TextInput
                    style={styles.currencyField}
                    value={otherIncomeAmount}
                    onChangeText={(v) => setOtherIncomeAmount(formatCurrency(v))}
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
                <Text style={styles.nextButtonText}>{t('wizard.continue')}</Text>
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
  estimateNote: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3B82F6',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  scanButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  w2Card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  w2Header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  w2Title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  inputContainer: {
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  inputHalf: {
    flex: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#111827',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  currencyInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
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
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#10B981',
    borderStyle: 'dashed',
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#10B981',
    marginLeft: 8,
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
    fontSize: 16,
    color: '#111827',
    marginLeft: 12,
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
