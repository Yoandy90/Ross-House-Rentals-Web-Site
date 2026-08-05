import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Switch,
  Alert,
  Modal,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../../constants/colors';
import CustomHeader from '../../components/CustomHeader';
import api from '../../services/api';
import { useTranslation } from 'react-i18next';

const US_STATES = [
  { code: 'AL', name: 'Alabama' }, { code: 'AK', name: 'Alaska' },
  { code: 'AZ', name: 'Arizona' }, { code: 'AR', name: 'Arkansas' },
  { code: 'CA', name: 'California' }, { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' }, { code: 'DE', name: 'Delaware' },
  { code: 'DC', name: 'Washington D.C.' }, { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' }, { code: 'HI', name: 'Hawaii' },
  { code: 'ID', name: 'Idaho' }, { code: 'IL', name: 'Illinois' },
  { code: 'IN', name: 'Indiana' }, { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' }, { code: 'KY', name: 'Kentucky' },
  { code: 'LA', name: 'Louisiana' }, { code: 'ME', name: 'Maine' },
  { code: 'MD', name: 'Maryland' }, { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' }, { code: 'MN', name: 'Minnesota' },
  { code: 'MS', name: 'Mississippi' }, { code: 'MO', name: 'Missouri' },
  { code: 'MT', name: 'Montana' }, { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' }, { code: 'NH', name: 'New Hampshire' },
  { code: 'NJ', name: 'New Jersey' }, { code: 'NM', name: 'New Mexico' },
  { code: 'NY', name: 'New York' }, { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' }, { code: 'OH', name: 'Ohio' },
  { code: 'OK', name: 'Oklahoma' }, { code: 'OR', name: 'Oregon' },
  { code: 'PA', name: 'Pennsylvania' }, { code: 'PR', name: 'Puerto Rico' },
  { code: 'RI', name: 'Rhode Island' }, { code: 'SC', name: 'South Carolina' },
  { code: 'SD', name: 'South Dakota' }, { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' }, { code: 'UT', name: 'Utah' },
  { code: 'VT', name: 'Vermont' }, { code: 'VA', name: 'Virginia' },
  { code: 'WA', name: 'Washington' }, { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' }, { code: 'WY', name: 'Wyoming' },
];

export default function TaxCalculatorScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const { t } = useTranslation();
  const styles = createStyles(colors);

  // Basic fields
  const [filingStatus, setFilingStatus] = useState('single');
  const [taxYear, setTaxYear] = useState(2025);
  const [state, setState] = useState('FL');
  const [showStatePicker, setShowStatePicker] = useState(false);

  // Income fields
  const [w2Income, setW2Income] = useState('');
  const [selfEmploymentIncome, setSelfEmploymentIncome] = useState('');
  const [investmentIncome, setInvestmentIncome] = useState('');

  // Dependents
  const [childrenUnder17, setChildrenUnder17] = useState(0);
  const [children17Plus, setChildren17Plus] = useState(0);

  // Optional fields
  const [deductions, setDeductions] = useState('');
  const [credits, setCredits] = useState('');
  const [withholding, setWithholding] = useState('');
  const [notes, setNotes] = useState('');
  const [wantsAppointment, setWantsAppointment] = useState(false);

  // State
  const [calculating, setCalculating] = useState(false);
  const [result, setResult] = useState<any>(null);

  const statuses = [
    { value: 'single', labelKey: 'taxCalculator.single', icon: 'person-outline' },
    { value: 'married_joint', labelKey: 'taxCalculator.marriedJoint', icon: 'people-outline' },
    { value: 'married_separate', labelKey: 'taxCalculator.marriedSeparate', icon: 'people-outline' },
    { value: 'head_of_household', labelKey: 'taxCalculator.headOfHousehold', icon: 'home-outline' },
    { value: 'widow', labelKey: 'taxCalculator.widow', icon: 'heart-outline' },
  ];

  const years = [
    { value: 2024, label: '2024' },
    { value: 2025, label: '2025' },
  ];

  const selectedState = US_STATES.find(s => s.code === state);

  const calculateTaxes = async () => {
    const totalIncome = parseFloat(w2Income || '0') + parseFloat(selfEmploymentIncome || '0');
    if (totalIncome <= 0) {
      Alert.alert(t('taxCalculator.requiredField'), t('taxCalculator.enterIncome'));
      return;
    }

    try {
      Keyboard.dismiss();
      setCalculating(true);

      const response = await api.post('/tax-estimates/create', {
        tax_year: taxYear,
        filing_status: filingStatus,
        annual_income: parseFloat(w2Income || '0'),
        deductions: deductions ? parseFloat(deductions) : 0,
        credits: credits ? parseFloat(credits) : 0,
        withholding: withholding ? parseFloat(withholding) : 0,
        state: state,
        num_children_under_17: childrenUnder17,
        num_children_17_plus: children17Plus,
        self_employment_income: parseFloat(selfEmploymentIncome || '0'),
        investment_income: parseFloat(investmentIncome || '0'),
        notes: notes || null,
        wants_office_appointment: wantsAppointment,
      });

      if (response.data.success) {
        setResult(response.data.calculation_results);
        setTimeout(() => {
          Alert.alert(
            t('taxCalculator.savedAlert') + ' 📊',
            response.data.message + '\n\n💡 ' + t('taxCalculator.savedMessage'),
            [
              { text: t('taxCalculator.understood'), style: 'default' },
              {
                text: t('taxCalculator.scheduleAppointment'),
                onPress: () => router.push('/book-appointment'),
                style: 'default',
              },
            ]
          );
        }, 500);
      }
    } catch (error: any) {
      Alert.alert(
        'Error',
        error.response?.data?.detail || t('taxCalculator.errorCalculating')
      );
    } finally {
      setCalculating(false);
    }
  };

  const formatCurrency = (value: number) => {
    return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const CounterField = ({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) => (
    <View style={styles.counterRow}>
      <Text style={styles.counterLabel}>{label}</Text>
      <View style={styles.counterControls}>
        <TouchableOpacity
          style={[styles.counterButton, value === 0 && styles.counterButtonDisabled]}
          onPress={() => onChange(Math.max(0, value - 1))}
          disabled={value === 0}
        >
          <Ionicons name="remove" size={20} color={value === 0 ? colors.border : colors.primary} />
        </TouchableOpacity>
        <Text style={styles.counterValue}>{value}</Text>
        <TouchableOpacity
          style={styles.counterButton}
          onPress={() => onChange(Math.min(10, value + 1))}
        >
          <Ionicons name="add" size={20} color={colors.primary} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderStateItem = useCallback(({ item }: { item: typeof US_STATES[0] }) => (
    <TouchableOpacity
      style={[styles.stateItem, state === item.code && styles.stateItemActive]}
      onPress={() => {
        setState(item.code);
        setShowStatePicker(false);
      }}
    >
      <Text style={[styles.stateItemText, state === item.code && styles.stateItemTextActive]}>
        {item.code} - {item.name}
      </Text>
      {state === item.code && (
        <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
      )}
    </TouchableOpacity>
  ), [state, colors]);

  return (
    <View style={styles.container}>
      <CustomHeader
        title={t('taxCalculator.title')}
        showBackButton={true}
        onBackPress={() => router.back()}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {/* Info Card */}
          <View style={styles.infoCard}>
            <Ionicons name="document-text" size={40} color={colors.primary} />
            <Text style={styles.infoTitle}>💡 {t('taxCalculator.important')}</Text>
            <Text style={styles.infoText}>
              {t('taxCalculator.importantText')}
            </Text>
          </View>

          {/* Tax Year */}
          <Text style={styles.sectionTitle}>{t('taxCalculator.taxYear')} *</Text>
          <View style={styles.yearContainer}>
            {years.map((year) => (
              <TouchableOpacity
                key={year.value}
                style={[styles.yearButton, taxYear === year.value && styles.yearButtonActive]}
                onPress={() => setTaxYear(year.value)}
              >
                <Ionicons
                  name="calendar-outline"
                  size={20}
                  color={taxYear === year.value ? colors.primary : colors.textSecondary}
                />
                <Text style={[styles.yearButtonText, taxYear === year.value && styles.yearButtonTextActive]}>
                  {year.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Filing Status */}
          <Text style={styles.sectionTitle}>{t('taxCalculator.filingStatus')} *</Text>
          <View style={styles.statusContainer}>
            {statuses.map((s) => (
              <TouchableOpacity
                key={s.value}
                style={[styles.statusButton, filingStatus === s.value && styles.statusButtonActive]}
                onPress={() => setFilingStatus(s.value)}
              >
                <Ionicons
                  name={s.icon as any}
                  size={22}
                  color={filingStatus === s.value ? colors.primary : colors.textSecondary}
                />
                <Text style={[styles.statusButtonText, filingStatus === s.value && styles.statusButtonTextActive]}>
                  {t(s.labelKey)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* State Selector */}
          <Text style={styles.sectionTitle}>{t('taxCalculator.stateLabel')} *</Text>
          <TouchableOpacity style={styles.stateSelector} onPress={() => setShowStatePicker(true)}>
            <Ionicons name="location-outline" size={20} color={colors.primary} />
            <Text style={styles.stateSelectorText}>
              {selectedState ? `${selectedState.code} - ${selectedState.name}` : t('taxCalculator.selectState')}
            </Text>
            <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
          </TouchableOpacity>

          {/* Income Section */}
          <View style={styles.sectionHeader}>
            <Ionicons name="cash-outline" size={22} color={colors.primary} />
            <Text style={styles.sectionTitle}>{t('taxCalculator.incomeSection')}</Text>
          </View>

          <Text style={styles.label}>{t('taxCalculator.w2Income')} *</Text>
          <TextInput
            style={styles.input}
            placeholder={t('taxCalculator.w2Placeholder')}
            placeholderTextColor={colors.textSecondary}
            keyboardType="numeric"
            value={w2Income}
            onChangeText={setW2Income}
          />

          <Text style={styles.label}>{t('taxCalculator.selfEmploymentIncome')}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('taxCalculator.selfEmploymentPlaceholder')}
            placeholderTextColor={colors.textSecondary}
            keyboardType="numeric"
            value={selfEmploymentIncome}
            onChangeText={setSelfEmploymentIncome}
          />

          <Text style={styles.label}>{t('taxCalculator.investmentIncome')}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('taxCalculator.investmentPlaceholder')}
            placeholderTextColor={colors.textSecondary}
            keyboardType="numeric"
            value={investmentIncome}
            onChangeText={setInvestmentIncome}
          />

          {/* Dependents Section */}
          <View style={styles.sectionHeader}>
            <Ionicons name="people-outline" size={22} color={colors.primary} />
            <Text style={styles.sectionTitle}>{t('taxCalculator.dependentsSection')}</Text>
          </View>

          <View style={styles.dependentsCard}>
            <CounterField
              label={t('taxCalculator.childrenUnder17')}
              value={childrenUnder17}
              onChange={setChildrenUnder17}
            />
            <View style={styles.counterDivider} />
            <CounterField
              label={t('taxCalculator.children17Plus')}
              value={children17Plus}
              onChange={setChildren17Plus}
            />
          </View>

          {/* Deductions & Credits */}
          <Text style={styles.label}>{t('taxCalculator.deductions')}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('taxCalculator.deductionsPlaceholder')}
            placeholderTextColor={colors.textSecondary}
            keyboardType="numeric"
            value={deductions}
            onChangeText={setDeductions}
          />

          <Text style={styles.label}>{t('taxCalculator.credits')}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('taxCalculator.creditsPlaceholder')}
            placeholderTextColor={colors.textSecondary}
            keyboardType="numeric"
            value={credits}
            onChangeText={setCredits}
          />

          <Text style={styles.label}>{t('taxCalculator.withholding')}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('taxCalculator.withholdingPlaceholder')}
            placeholderTextColor={colors.textSecondary}
            keyboardType="numeric"
            value={withholding}
            onChangeText={setWithholding}
          />

          {/* Notes */}
          <Text style={styles.label}>{t('taxCalculator.notes')}</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder={t('taxCalculator.questionsPlaceholder')}
            placeholderTextColor={colors.textSecondary}
            multiline
            numberOfLines={3}
            value={notes}
            onChangeText={setNotes}
          />

          {/* Appointment Switch */}
          <View style={styles.switchContainer}>
            <View style={styles.switchContent}>
              <Ionicons name="calendar-outline" size={24} color={colors.primary} />
              <Text style={styles.switchLabel}>{t('taxCalculator.wantAppointment')}</Text>
            </View>
            <Switch
              value={wantsAppointment}
              onValueChange={setWantsAppointment}
              trackColor={{ false: colors.border, true: colors.primary + '50' }}
              thumbColor={wantsAppointment ? colors.primary : colors.textSecondary}
            />
          </View>

          {/* Calculate Button */}
          <TouchableOpacity
            style={styles.calculateButton}
            onPress={calculateTaxes}
            disabled={calculating}
          >
            {calculating ? (
              <ActivityIndicator color={colors.textWhite} />
            ) : (
              <>
                <Ionicons name="calculator-outline" size={20} color={colors.textWhite} />
                <Text style={styles.calculateButtonText}>{t('taxCalculator.getEstimate')}</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Results */}
          {result && (
            <View style={styles.resultsCard}>
              <View style={styles.resultsHeader}>
                <Text style={styles.resultsTitle}>📊 {t('taxCalculator.resultsTitle')} {result.tax_year}</Text>
                <View style={styles.yearBadge}>
                  <Text style={styles.yearBadgeText}>{result.tax_year}</Text>
                </View>
              </View>

              {/* Income Breakdown */}
              <View style={styles.breakdownSection}>
                <Text style={styles.breakdownSectionTitle}>{t('taxCalculator.calculationBreakdown')}</Text>

                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>{t('taxCalculator.grossIncome')}:</Text>
                  <Text style={styles.breakdownValue}>{formatCurrency(result.breakdown?.gross_income || 0)}</Text>
                </View>

                {(result.breakdown?.w2_income || 0) > 0 && (
                  <View style={styles.breakdownSubRow}>
                    <Text style={styles.breakdownSubLabel}>  {t('taxCalculator.w2IncomeLabel')}:</Text>
                    <Text style={styles.breakdownSubValue}>{formatCurrency(result.breakdown.w2_income)}</Text>
                  </View>
                )}

                {(result.breakdown?.self_employment_income || 0) > 0 && (
                  <View style={styles.breakdownSubRow}>
                    <Text style={styles.breakdownSubLabel}>  {t('taxCalculator.selfEmploymentLabel')}:</Text>
                    <Text style={styles.breakdownSubValue}>{formatCurrency(result.breakdown.self_employment_income)}</Text>
                  </View>
                )}

                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>{t('taxCalculator.standardDeduction')}:</Text>
                  <Text style={styles.breakdownValue}>-{formatCurrency(result.breakdown?.standard_deduction || 0)}</Text>
                </View>

                {(result.breakdown?.se_deduction || 0) > 0 && (
                  <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownLabel}>{t('taxCalculator.seDeduction')}:</Text>
                    <Text style={styles.breakdownValue}>-{formatCurrency(result.breakdown.se_deduction)}</Text>
                  </View>
                )}

                {(result.breakdown?.total_deductions || 0) > (result.breakdown?.standard_deduction || 0) + (result.breakdown?.se_deduction || 0) && (
                  <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownLabel}>{t('taxCalculator.additionalDeductions')}:</Text>
                    <Text style={styles.breakdownValue}>
                      -{formatCurrency(
                        (result.breakdown?.total_deductions || 0) -
                        (result.breakdown?.standard_deduction || 0) -
                        (result.breakdown?.se_deduction || 0)
                      )}
                    </Text>
                  </View>
                )}

                <View style={[styles.breakdownRow, styles.breakdownRowBold]}>
                  <Text style={styles.breakdownLabelBold}>{t('taxCalculator.taxableIncome')}:</Text>
                  <Text style={styles.breakdownValueBold}>{formatCurrency(result.breakdown?.taxable_income || 0)}</Text>
                </View>
              </View>

              <View style={styles.divider} />

              {/* Tax Breakdown */}
              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>{t('taxCalculator.federalTax')}:</Text>
                <Text style={styles.resultValue}>{formatCurrency(result.federal_tax || 0)}</Text>
              </View>

              {(result.se_tax || 0) > 0 && (
                <View style={styles.resultRow}>
                  <Text style={styles.resultLabel}>{t('taxCalculator.selfEmploymentTax')}:</Text>
                  <Text style={styles.resultValue}>{formatCurrency(result.se_tax)}</Text>
                </View>
              )}

              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>{t('taxCalculator.stateTax')} ({result.state_tax_detail?.state || state}):</Text>
                <Text style={styles.resultValue}>
                  {result.state_tax_detail?.has_income_tax === false
                    ? `$0.00 (${result.state_tax_detail?.state} ${t('taxCalculator.noStateTax')})`
                    : formatCurrency(result.state_tax || 0)
                  }
                </Text>
              </View>

              {/* Credits Section */}
              {((result.credits_detail?.eitc?.amount || 0) > 0 ||
                (result.credits_detail?.child_tax_credit?.total_credit || 0) > 0 ||
                (result.credits_detail?.other_credits || 0) > 0) && (
                <>
                  <View style={styles.divider} />
                  <View style={styles.creditsSection}>
                    <Text style={styles.creditsSectionTitle}>{t('taxCalculator.creditsApplied')}</Text>

                    {(result.credits_detail?.eitc?.amount || 0) > 0 && (
                      <View style={styles.resultRow}>
                        <Text style={styles.resultLabel}>✅ {t('taxCalculator.eitcCredit')}:</Text>
                        <Text style={[styles.resultValue, { color: '#4CAF50' }]}>
                          -{formatCurrency(result.credits_detail.eitc.amount)}
                        </Text>
                      </View>
                    )}

                    {(result.credits_detail?.child_tax_credit?.total_credit || 0) > 0 && (
                      <View style={styles.resultRow}>
                        <Text style={styles.resultLabel}>👶 {t('taxCalculator.childTaxCredit')}:</Text>
                        <Text style={[styles.resultValue, { color: '#4CAF50' }]}>
                          -{formatCurrency(result.credits_detail.child_tax_credit.total_credit)}
                        </Text>
                      </View>
                    )}

                    {(result.credits_detail?.other_credits || 0) > 0 && (
                      <View style={styles.resultRow}>
                        <Text style={styles.resultLabel}>{t('taxCalculator.otherCredits')}:</Text>
                        <Text style={[styles.resultValue, { color: '#4CAF50' }]}>
                          -{formatCurrency(result.credits_detail.other_credits)}
                        </Text>
                      </View>
                    )}

                    {(result.refundable_credits || 0) > 0 && (
                      <View style={[styles.resultRow, { backgroundColor: '#E8F5E9', borderRadius: 8, padding: 8 }]}>
                        <Text style={[styles.resultLabel, { fontWeight: '700' }]}>💰 {t('taxCalculator.totalRefundableCredits')}:</Text>
                        <Text style={[styles.resultValue, { color: '#2E7D32', fontWeight: '700' }]}>
                          {formatCurrency(result.refundable_credits)}
                        </Text>
                      </View>
                    )}
                  </View>
                </>
              )}

              {/* Self-Employment Tax Detail */}
              {result.se_tax_detail?.applicable && (
                <>
                  <View style={styles.divider} />
                  <View style={styles.seDetailSection}>
                    <Text style={styles.seDetailTitle}>{t('taxCalculator.selfEmploymentTax')}</Text>
                    <View style={styles.breakdownSubRow}>
                      <Text style={styles.breakdownSubLabel}>  Social Security:</Text>
                      <Text style={styles.breakdownSubValue}>{formatCurrency(result.se_tax_detail.ss_portion || 0)}</Text>
                    </View>
                    <View style={styles.breakdownSubRow}>
                      <Text style={styles.breakdownSubLabel}>  Medicare:</Text>
                      <Text style={styles.breakdownSubValue}>{formatCurrency(result.se_tax_detail.medicare_portion || 0)}</Text>
                    </View>
                  </View>
                </>
              )}

              <View style={styles.divider} />

              {/* Totals */}
              <View style={[styles.resultRow, styles.resultRowTotal]}>
                <Text style={styles.resultLabelTotal}>{t('taxCalculator.totalTax')}:</Text>
                <Text style={styles.resultValueTotal}>{formatCurrency(result.total_tax || 0)}</Text>
              </View>

              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>{t('taxCalculator.effectiveRate')}:</Text>
                <Text style={styles.resultValue}>{result.effective_rate || 0}%</Text>
              </View>

              {(result.breakdown?.withholding || 0) > 0 && (
                <View style={[styles.resultRow, styles.refundRow]}>
                  <Text style={styles.refundLabel}>
                    {(result.refund_or_owed || 0) >= 0
                      ? '✅ ' + t('taxCalculator.estimatedRefund')
                      : '⚠️ ' + t('taxCalculator.taxOwed')}
                  </Text>
                  <Text
                    style={[
                      styles.refundValue,
                      (result.refund_or_owed || 0) >= 0 ? styles.refundPositive : styles.refundNegative,
                    ]}
                  >
                    {formatCurrency(Math.abs(result.refund_or_owed || 0))}
                  </Text>
                </View>
              )}

              <View style={styles.disclaimer}>
                <Ionicons name="information-circle-outline" size={16} color={colors.textSecondary} />
                <Text style={styles.disclaimerText}>{t('taxCalculator.disclaimer')}</Text>
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* State Picker Modal */}
      <Modal visible={showStatePicker} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('taxCalculator.selectState')}</Text>
              <TouchableOpacity onPress={() => setShowStatePicker(false)}>
                <Ionicons name="close-circle" size={28} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={US_STATES}
              keyExtractor={(item) => item.code}
              renderItem={renderStateItem}
              style={styles.stateList}
              showsVerticalScrollIndicator={false}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      padding: 16,
      paddingBottom: 100,
    },
    infoCard: {
      backgroundColor: colors.primary + '15',
      borderRadius: 12,
      padding: 20,
      alignItems: 'center',
      marginBottom: 24,
      borderWidth: 1,
      borderColor: colors.primary + '30',
    },
    infoTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
      marginTop: 12,
      marginBottom: 8,
      textAlign: 'center',
    },
    infoText: {
      fontSize: 13,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 24,
      marginBottom: 4,
    },
    sectionTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 8,
      marginTop: 16,
    },
    label: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 6,
      marginTop: 12,
    },
    statusContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      marginBottom: 8,
    },
    statusButton: {
      width: '48%',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      padding: 14,
      borderRadius: 12,
      backgroundColor: colors.card,
      borderWidth: 2,
      borderColor: colors.border,
    },
    statusButtonActive: {
      backgroundColor: colors.primary + '15',
      borderColor: colors.primary,
    },
    statusButtonText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary,
      textAlign: 'center',
    },
    statusButtonTextActive: {
      color: colors.primary,
      fontWeight: '700',
    },
    yearContainer: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 8,
    },
    yearButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      padding: 16,
      borderRadius: 12,
      backgroundColor: colors.card,
      borderWidth: 2,
      borderColor: colors.border,
    },
    yearButtonActive: {
      backgroundColor: colors.primary + '20',
      borderColor: colors.primary,
    },
    yearButtonText: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    yearButtonTextActive: {
      color: colors.primary,
    },
    stateSelector: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 14,
    },
    stateSelectorText: {
      flex: 1,
      fontSize: 15,
      color: colors.text,
      fontWeight: '500',
    },
    input: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 14,
      fontSize: 16,
      color: colors.text,
    },
    textArea: {
      minHeight: 80,
      textAlignVertical: 'top',
      paddingTop: 14,
    },
    dependentsCard: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    counterRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 8,
    },
    counterLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      flex: 1,
    },
    counterControls: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    counterButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.primary + '15',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.primary + '30',
    },
    counterButtonDisabled: {
      backgroundColor: colors.border + '30',
      borderColor: colors.border,
    },
    counterValue: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      minWidth: 24,
      textAlign: 'center',
    },
    counterDivider: {
      height: 1,
      backgroundColor: colors.border,
      marginVertical: 8,
    },
    switchContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: colors.card,
      padding: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      marginTop: 16,
    },
    switchContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flex: 1,
    },
    switchLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      flex: 1,
    },
    calculateButton: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      padding: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 24,
      gap: 8,
    },
    calculateButtonText: {
      color: colors.textWhite,
      fontSize: 16,
      fontWeight: '700',
    },
    resultsCard: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 20,
      marginTop: 24,
      borderWidth: 1,
      borderColor: colors.border,
    },
    resultsHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 20,
    },
    resultsTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      flex: 1,
    },
    yearBadge: {
      backgroundColor: colors.primary,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
    },
    yearBadgeText: {
      color: colors.textWhite,
      fontSize: 14,
      fontWeight: '700',
    },
    breakdownSection: {
      backgroundColor: colors.background,
      borderRadius: 8,
      padding: 16,
      marginBottom: 8,
    },
    breakdownSectionTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textSecondary,
      marginBottom: 12,
      textTransform: 'uppercase',
    },
    breakdownRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 6,
    },
    breakdownSubRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 3,
      paddingLeft: 8,
    },
    breakdownRowBold: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
      marginTop: 8,
      paddingTop: 10,
    },
    breakdownLabel: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    breakdownValue: {
      fontSize: 14,
      color: colors.text,
      fontWeight: '500',
    },
    breakdownSubLabel: {
      fontSize: 13,
      color: colors.textSecondary + 'CC',
    },
    breakdownSubValue: {
      fontSize: 13,
      color: colors.text + 'CC',
      fontWeight: '400',
    },
    breakdownLabelBold: {
      fontSize: 15,
      color: colors.text,
      fontWeight: '700',
    },
    breakdownValueBold: {
      fontSize: 15,
      color: colors.primary,
      fontWeight: '700',
    },
    divider: {
      height: 1,
      backgroundColor: colors.border,
      marginVertical: 12,
    },
    creditsSection: {
      marginBottom: 4,
    },
    creditsSectionTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: '#4CAF50',
      marginBottom: 8,
      textTransform: 'uppercase',
    },
    seDetailSection: {
      marginBottom: 4,
    },
    seDetailTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textSecondary,
      marginBottom: 6,
    },
    resultRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    resultRowTotal: {
      borderTopWidth: 2,
      borderTopColor: colors.primary,
      marginTop: 8,
      paddingTop: 14,
    },
    resultLabel: {
      fontSize: 14,
      color: colors.textSecondary,
      flex: 1,
    },
    resultValue: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
    },
    resultLabelTotal: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
    },
    resultValueTotal: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
    },
    refundRow: {
      backgroundColor: colors.background,
      padding: 16,
      borderRadius: 8,
      marginTop: 12,
      borderBottomWidth: 0,
    },
    refundLabel: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
    },
    refundValue: {
      fontSize: 20,
      fontWeight: '700',
    },
    refundPositive: {
      color: '#4CAF50',
    },
    refundNegative: {
      color: '#F44336',
    },
    disclaimer: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      marginTop: 16,
      padding: 12,
      backgroundColor: colors.background,
      borderRadius: 8,
    },
    disclaimerText: {
      flex: 1,
      fontSize: 12,
      color: colors.textSecondary,
      lineHeight: 18,
    },
    // Modal styles
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: '70%',
      paddingBottom: 30,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
    },
    stateList: {
      paddingHorizontal: 16,
    },
    stateItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 14,
      paddingHorizontal: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    stateItemActive: {
      backgroundColor: colors.primary + '10',
      borderRadius: 8,
    },
    stateItemText: {
      fontSize: 15,
      color: colors.text,
    },
    stateItemTextActive: {
      fontWeight: '700',
      color: colors.primary,
    },
  });
