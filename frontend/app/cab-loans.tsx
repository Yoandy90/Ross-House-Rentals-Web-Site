import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Switch, Alert, Linking, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../services/api';

interface CABLoan {
  id: string;
  loan_number: string;
  loan_amount: number;
  cab_fee_percent: number;
  term_months: number;
  monthly_payment: number;
  cab_fee_per_payment: number;
  lender_per_payment: number;
  total_payable: number;
  total_paid: number;
  outstanding_balance: number;
  payments_made: number;
  status: string;
  lender_name: string;
  start_date: string;
  first_payment_date: string;
  maturity_date: string;
  auto_pay: boolean;
  contracts_generated: boolean;
  payment_schedule: PaymentItem[];
}

interface PaymentItem {
  payment_number: number;
  due_date: string;
  total_amount: number;
  cab_fee: number;
  lender_total: number;
  remaining_principal: number;
  status: string;
  paid_date: string;
  paid_amount: number;
}

interface PaymentMethod {
  id: string;
  vault_id: string;
  type: string;
  label: string;
  card_last4: string;
  card_brand: string;
  bank_name: string;
  is_default: boolean;
}

interface ContractDoc {
  id: string;
  document_type: string;
  file_name: string;
  generated_at: string;
}

export default function CABLoansScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [loans, setLoans] = useState<CABLoan[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<CABLoan | null>(null);

  // Auto-pay state
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [showPaymentPicker, setShowPaymentPicker] = useState(false);
  const [autoPayLoading, setAutoPayLoading] = useState(false);

  // Contracts state
  const [contracts, setContracts] = useState<ContractDoc[]>([]);
  const [contractsLoading, setContractsLoading] = useState(false);

  const fetchLoans = useCallback(async () => {
    try {
      const res = await api.get('/cab/my-loans');
      setLoans(res.data?.loans || []);
    } catch (error) {
      console.log('CAB loans fetch error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchLoans();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchLoans();
  };

  // Load contracts when loan is selected
  useEffect(() => {
    if (selectedLoan?.id) {
      loadContracts(selectedLoan.id);
    }
  }, [selectedLoan?.id]);

  const loadContracts = async (loanId: string) => {
    setContractsLoading(true);
    try {
      const res = await api.get(`/cab/my-loans/${loanId}/contracts`);
      setContracts(res.data?.contracts || []);
    } catch (e) {
      console.log('Contracts load error:', e);
    } finally {
      setContractsLoading(false);
    }
  };

  const loadPaymentMethods = async () => {
    try {
      const res = await api.get('/cab/my-payment-methods');
      setPaymentMethods(res.data?.methods || []);
    } catch (e) {
      console.log('Payment methods load error:', e);
    }
  };

  const handleAutoPayToggle = async (loan: CABLoan) => {
    if (loan.auto_pay) {
      // Disable auto-pay
      Alert.alert(
        t('cabLoans.disableAutoPay'),
        t('cabLoans.autoPayDescription'),
        [
          { text: t('common.cancel', 'Cancelar'), style: 'cancel' },
          {
            text: t('common.confirm', 'Confirmar'),
            style: 'destructive',
            onPress: async () => {
              setAutoPayLoading(true);
              try {
                await api.delete(`/cab/my-loans/${loan.id}/auto-pay`);
                // Update local state
                setSelectedLoan({ ...loan, auto_pay: false });
                setLoans(prev => prev.map(l => l.id === loan.id ? { ...l, auto_pay: false } : l));
                Alert.alert('', t('cabLoans.autoPayDeactivated'));
              } catch (e) {
                Alert.alert('Error', t('cabLoans.autoPayError'));
              } finally {
                setAutoPayLoading(false);
              }
            },
          },
        ]
      );
    } else {
      // Load payment methods and show picker
      await loadPaymentMethods();
      setShowPaymentPicker(true);
    }
  };

  const selectPaymentForAutoPay = async (method: PaymentMethod, loan: CABLoan) => {
    setShowPaymentPicker(false);
    setAutoPayLoading(true);
    try {
      const label = method.type === 'card'
        ? `${method.card_brand || 'Card'} ${t('cabLoans.endingIn', { last4: method.card_last4 })}`
        : `${method.bank_name || t('cabLoans.bankAccount')} ${t('cabLoans.endingIn', { last4: method.card_last4 })}`;

      await api.put(`/cab/my-loans/${loan.id}/auto-pay`, {
        vault_id: method.vault_id,
        payment_method_label: label,
      });

      setSelectedLoan({ ...loan, auto_pay: true });
      setLoans(prev => prev.map(l => l.id === loan.id ? { ...l, auto_pay: true } : l));
      Alert.alert('', t('cabLoans.autoPayActivated'));
    } catch (e) {
      Alert.alert('Error', t('cabLoans.autoPayError'));
    } finally {
      setAutoPayLoading(false);
    }
  };

  const getStatusInfo = (status: string) => {
    const map: Record<string, { label: string; color: string; bg: string; icon: string }> = {
      active: { label: t('cabLoans.active'), color: '#059669', bg: '#ECFDF5', icon: 'checkmark-circle' },
      paid_off: { label: t('cabLoans.paidOff'), color: '#2563EB', bg: '#EFF6FF', icon: 'trophy' },
      defaulted: { label: t('cabLoans.defaulted'), color: '#DC2626', bg: '#FEF2F2', icon: 'alert-circle' },
      cancelled: { label: t('cabLoans.cancelled'), color: '#6B7280', bg: '#F9FAFB', icon: 'close-circle' },
    };
    return map[status] || map.active;
  };

  const getContractLabel = (docType: string) => {
    const labels: Record<string, string> = {
      cab_agreement: t('cabLoans.cabAgreement'),
      promissory_note: t('cabLoans.promissoryNote'),
      disclosure: t('cabLoans.disclosure'),
      cancel_notice: t('cabLoans.cancelNotice'),
      payment_schedule: t('cabLoans.paymentScheduleDoc'),
    };
    return labels[docType] || docType;
  };

  const getProgress = (loan: CABLoan) => {
    const total = loan.payment_schedule?.length || loan.term_months;
    return total > 0 ? (loan.payments_made / total) * 100 : 0;
  };

  const fmt = (n: number) => `$${(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // ─── LOADING ───
  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#10B981" />
          <Text style={styles.loadingText}>{t('cabLoans.loading')}</Text>
        </View>
      </View>
    );
  }

  // ─── PAYMENT METHOD PICKER MODAL ───
  if (showPaymentPicker && selectedLoan) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.pickerHeader}>
          <TouchableOpacity onPress={() => setShowPaymentPicker(false)} style={styles.pickerClose}>
            <Ionicons name="close" size={24} color="#374151" />
          </TouchableOpacity>
          <Text style={styles.pickerTitle}>{t('cabLoans.selectPaymentMethod')}</Text>
          <View style={{ width: 36 }} />
        </View>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
          {paymentMethods.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="card-outline" size={48} color="#D1D5DB" />
              <Text style={styles.emptyTitle}>{t('cabLoans.noPaymentMethods')}</Text>
              <Text style={styles.emptySubtitle}>{t('cabLoans.addPaymentMethodFirst')}</Text>
            </View>
          ) : (
            paymentMethods.map((m) => (
              <TouchableOpacity
                key={m.id}
                style={styles.paymentMethodCard}
                onPress={() => selectPaymentForAutoPay(m, selectedLoan)}
                activeOpacity={0.7}
              >
                <View style={styles.pmIconCircle}>
                  <Ionicons
                    name={m.type === 'card' ? 'card-outline' : 'business-outline'}
                    size={22}
                    color="#10B981"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.pmLabel}>
                    {m.type === 'card'
                      ? `${m.card_brand || 'Card'} •••• ${m.card_last4}`
                      : `${m.bank_name || t('cabLoans.bankAccount')} •••• ${m.card_last4}`}
                  </Text>
                  <Text style={styles.pmType}>
                    {m.type === 'card' ? 'Credit/Debit Card' : t('cabLoans.bankAccount')}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      </View>
    );
  }

  // ─── DETAIL VIEW ───
  if (selectedLoan) {
    const status = getStatusInfo(selectedLoan.status);
    const progress = getProgress(selectedLoan);

    return (
      <View style={[styles.container, { paddingTop: 0 }]}>
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={[styles.detailHeader, { paddingTop: insets.top + 12 }]}>
            <TouchableOpacity onPress={() => { setSelectedLoan(null); setContracts([]); }} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={styles.detailTitle}>{selectedLoan.loan_number}</Text>
              <Text style={styles.detailSubtitle}>{selectedLoan.lender_name}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
              <Ionicons name={status.icon as any} size={14} color={status.color} />
              <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
            </View>
          </View>

          {/* Progress Card */}
          <View style={styles.card}>
            <View style={styles.progressRow}>
              <Text style={styles.progressLabel}>{t('cabLoans.paymentProgress')}</Text>
              <Text style={styles.progressValue}>
                {selectedLoan.payments_made}/{selectedLoan.payment_schedule?.length || selectedLoan.term_months}
              </Text>
            </View>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${Math.min(progress, 100)}%` }]} />
            </View>
            <View style={styles.progressRow}>
              <Text style={styles.progressSmall}>{t('cabLoans.paid')}: {fmt(selectedLoan.total_paid)}</Text>
              <Text style={styles.progressSmall}>{t('cabLoans.remaining')}: {fmt(selectedLoan.outstanding_balance)}</Text>
            </View>
          </View>

          {/* Summary Cards */}
          <View style={styles.summaryGrid}>
            <View style={styles.summaryCard}>
              <Ionicons name="cash-outline" size={20} color="#10B981" />
              <Text style={styles.summaryValue}>{fmt(selectedLoan.loan_amount)}</Text>
              <Text style={styles.summaryLabel}>{t('cabLoans.originalAmount')}</Text>
            </View>
            <View style={styles.summaryCard}>
              <Ionicons name="calendar-outline" size={20} color="#3B82F6" />
              <Text style={styles.summaryValue}>{fmt(selectedLoan.monthly_payment)}</Text>
              <Text style={styles.summaryLabel}>{t('cabLoans.monthlyPayment')}</Text>
            </View>
            <View style={styles.summaryCard}>
              <Ionicons name="wallet-outline" size={20} color="#8B5CF6" />
              <Text style={styles.summaryValue}>{fmt(selectedLoan.total_payable)}</Text>
              <Text style={styles.summaryLabel}>{t('cabLoans.totalPayable')}</Text>
            </View>
            <View style={styles.summaryCard}>
              <Ionicons name="time-outline" size={20} color="#F59E0B" />
              <Text style={styles.summaryValue}>{selectedLoan.maturity_date}</Text>
              <Text style={styles.summaryLabel}>{t('cabLoans.maturityDate')}</Text>
            </View>
          </View>

          {/* Auto-Pay Toggle */}
          {selectedLoan.status === 'active' && (
            <View style={styles.card}>
              <View style={styles.autoPayRow}>
                <View style={styles.autoPayLeft}>
                  <View style={[styles.autoPayIcon, { backgroundColor: selectedLoan.auto_pay ? '#D1FAE5' : '#F3F4F6' }]}>
                    <Ionicons
                      name={selectedLoan.auto_pay ? 'card' : 'card-outline'}
                      size={22}
                      color={selectedLoan.auto_pay ? '#059669' : '#6B7280'}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.autoPayTitle}>{t('cabLoans.autoPay')}</Text>
                    <Text style={styles.autoPayDesc}>
                      {selectedLoan.auto_pay
                        ? t('cabLoans.autoPayEnabled')
                        : t('cabLoans.autoPayDescription')}
                    </Text>
                  </View>
                </View>
                {autoPayLoading ? (
                  <ActivityIndicator size="small" color="#10B981" />
                ) : (
                  <Switch
                    value={selectedLoan.auto_pay}
                    onValueChange={() => handleAutoPayToggle(selectedLoan)}
                    trackColor={{ false: '#E5E7EB', true: '#6EE7B7' }}
                    thumbColor={selectedLoan.auto_pay ? '#059669' : '#f4f3f4'}
                    ios_backgroundColor="#E5E7EB"
                  />
                )}
              </View>
            </View>
          )}

          {/* Payment Schedule */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>
              <Ionicons name="list-outline" size={18} color="#1a1a2e" />{' '}
              {t('cabLoans.paymentSchedule')}
            </Text>
            {selectedLoan.payment_schedule?.map((p) => (
              <View
                key={p.payment_number}
                style={[
                  styles.paymentRow,
                  p.status === 'paid' && styles.paymentRowPaid,
                ]}
              >
                <View style={styles.paymentLeft}>
                  <View style={[
                    styles.paymentIcon,
                    { backgroundColor: p.status === 'paid' ? '#D1FAE5' : '#FEF3C7' }
                  ]}>
                    <Ionicons
                      name={p.status === 'paid' ? 'checkmark-circle' : 'time-outline'}
                      size={20}
                      color={p.status === 'paid' ? '#059669' : '#D97706'}
                    />
                  </View>
                  <View>
                    <Text style={styles.paymentNum}>{t('cabLoans.paymentNum', { num: p.payment_number })}</Text>
                    <Text style={styles.paymentDate}>
                      {p.status === 'paid'
                        ? t('cabLoans.paidOn', { date: p.paid_date })
                        : t('cabLoans.dueDate', { date: p.due_date })}
                    </Text>
                  </View>
                </View>
                <View style={styles.paymentRight}>
                  <Text style={[
                    styles.paymentAmount,
                    p.status === 'paid' && { color: '#059669' }
                  ]}>
                    {fmt(p.total_amount)}
                  </Text>
                  {p.status === 'paid' && (
                    <Text style={styles.paidBadge}>{t('cabLoans.paidLabel')}</Text>
                  )}
                </View>
              </View>
            ))}
          </View>

          {/* Contracts */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>
              <Ionicons name="document-text-outline" size={18} color="#1a1a2e" />{' '}
              {t('cabLoans.contracts')}
            </Text>
            {contractsLoading ? (
              <ActivityIndicator size="small" color="#10B981" style={{ marginVertical: 16 }} />
            ) : contracts.length === 0 ? (
              <Text style={styles.noContractsText}>{t('cabLoans.noContracts')}</Text>
            ) : (
              contracts.map((c) => (
                <View key={c.id} style={styles.contractRow}>
                  <View style={styles.contractLeft}>
                    <View style={styles.contractIcon}>
                      <Ionicons name="document-text" size={20} color="#3B82F6" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.contractName}>{getContractLabel(c.document_type)}</Text>
                      <Text style={styles.contractDate}>{c.generated_at}</Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.contractViewBtn}
                    onPress={() => {
                      // Open contract download URL
                      const baseUrl = api.defaults.baseURL || '';
                      const url = `${baseUrl}/cab/my-loans/${selectedLoan.id}/contracts/${c.id}/download`;
                      Linking.openURL(url).catch(() => {});
                    }}
                  >
                    <Ionicons name="open-outline" size={16} color="#3B82F6" />
                    <Text style={styles.contractViewText}>{t('cabLoans.viewContract')}</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>

          {/* Loan Details */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{t('cabLoans.loanDetails')}</Text>
            {[
              [t('cabLoans.cabFeePerPayment'), fmt(selectedLoan.cab_fee_per_payment)],
              [t('cabLoans.lenderPortion'), fmt(selectedLoan.lender_per_payment)],
              [t('cabLoans.cabFeePercent'), t('cabLoans.monthlyPercent', { pct: selectedLoan.cab_fee_percent })],
              [t('cabLoans.startDate'), selectedLoan.start_date],
              [t('cabLoans.firstPayment'), selectedLoan.first_payment_date],
            ].map(([label, value], i) => (
              <View key={i} style={styles.detailRow}>
                <Text style={styles.detailLabel}>{label}</Text>
                <Text style={styles.detailValue}>{value}</Text>
              </View>
            ))}
          </View>

          <View style={{ height: 40 + insets.bottom }} />
        </ScrollView>
      </View>
    );
  }

  // ─── LIST VIEW ───
  return (
    <View style={[styles.container, { paddingTop: 0 }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#10B981']} />}
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerBack}>
            <Ionicons name="arrow-back" size={24} color="#1a1a2e" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('cabLoans.title')}</Text>
        </View>

        {loans.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="wallet-outline" size={64} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>{t('cabLoans.noLoans')}</Text>
            <Text style={styles.emptySubtitle}>{t('cabLoans.noLoansDesc')}</Text>
          </View>
        ) : (
          loans.map((loan) => {
            const status = getStatusInfo(loan.status);
            const progress = getProgress(loan);

            return (
              <TouchableOpacity
                key={loan.id}
                style={styles.loanCard}
                onPress={() => setSelectedLoan(loan)}
                activeOpacity={0.7}
              >
                <View style={styles.loanHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.loanNumber}>{loan.loan_number}</Text>
                    <Text style={styles.loanLender}>{loan.lender_name}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
                    <Ionicons name={status.icon as any} size={12} color={status.color} />
                    <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
                  </View>
                </View>

                <View style={styles.loanAmount}>
                  <Text style={styles.loanAmountValue}>{fmt(loan.loan_amount)}</Text>
                  <Text style={styles.loanAmountLabel}>{t('cabLoans.loanAmount')}</Text>
                </View>

                {/* Mini progress */}
                <View style={styles.miniProgress}>
                  <View style={styles.miniProgressBarBg}>
                    <View style={[styles.miniProgressFill, { width: `${Math.min(progress, 100)}%` }]} />
                  </View>
                  <Text style={styles.miniProgressText}>
                    {loan.payments_made}/{loan.payment_schedule?.length || loan.term_months} {t('cabLoans.payments')}
                  </Text>
                </View>

                {/* Auto-pay badge */}
                {loan.auto_pay && (
                  <View style={styles.autoPayBadge}>
                    <Ionicons name="card" size={12} color="#059669" />
                    <Text style={styles.autoPayBadgeText}>{t('cabLoans.autoPayEnabled')}</Text>
                  </View>
                )}

                <View style={styles.loanFooter}>
                  <View>
                    <Text style={styles.loanFooterLabel}>{t('cabLoans.monthlyPayment')}</Text>
                    <Text style={styles.loanFooterValue}>{fmt(loan.monthly_payment)}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.loanFooterLabel}>{t('cabLoans.outstanding')}</Text>
                    <Text style={styles.loanFooterValue}>{fmt(loan.outstanding_balance)}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
                </View>
              </TouchableOpacity>
            );
          })
        )}

        <View style={{ height: 30 + insets.bottom }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, color: '#6B7280', fontSize: 14 },

  header: { flexDirection: 'row', alignItems: 'center', padding: 16, paddingBottom: 8, backgroundColor: '#F3F4F6' },
  headerBack: { marginRight: 12, width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#1a1a2e' },

  emptyState: { alignItems: 'center', paddingTop: 80 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#6B7280', marginTop: 16 },
  emptySubtitle: { fontSize: 14, color: '#9CA3AF', marginTop: 4, textAlign: 'center', paddingHorizontal: 40 },

  // Loan Card
  loanCard: {
    backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 12, borderRadius: 16,
    padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  loanHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  loanNumber: { fontSize: 16, fontWeight: '700', color: '#1a1a2e' },
  loanLender: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, gap: 4 },
  statusText: { fontSize: 12, fontWeight: '600' },

  loanAmount: { marginBottom: 12 },
  loanAmountValue: { fontSize: 28, fontWeight: '800', color: '#10B981' },
  loanAmountLabel: { fontSize: 12, color: '#6B7280', marginTop: 2 },

  miniProgress: { marginBottom: 8 },
  miniProgressBarBg: { height: 6, backgroundColor: '#E5E7EB', borderRadius: 3, overflow: 'hidden' },
  miniProgressFill: { height: '100%', backgroundColor: '#10B981', borderRadius: 3 },
  miniProgressText: { fontSize: 11, color: '#6B7280', marginTop: 4, textAlign: 'right' },

  autoPayBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#ECFDF5',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, alignSelf: 'flex-start', marginBottom: 8,
  },
  autoPayBadgeText: { fontSize: 11, color: '#059669', fontWeight: '600' },

  loanFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 12 },
  loanFooterLabel: { fontSize: 11, color: '#9CA3AF' },
  loanFooterValue: { fontSize: 14, fontWeight: '600', color: '#374151' },

  // Detail View
  detailHeader: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#065F46',
    padding: 16, paddingBottom: 20, gap: 12,
  },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  detailTitle: { fontSize: 20, fontWeight: '700', color: '#fff' },
  detailSubtitle: { fontSize: 13, color: '#A7F3D0', marginTop: 2 },

  // Cards
  card: {
    backgroundColor: '#fff', margin: 16, marginBottom: 0, borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a2e', marginBottom: 12 },

  progressRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressLabel: { fontSize: 14, fontWeight: '600', color: '#374151' },
  progressValue: { fontSize: 14, fontWeight: '700', color: '#10B981' },
  progressBarBg: { height: 10, backgroundColor: '#E5E7EB', borderRadius: 5, overflow: 'hidden', marginVertical: 10 },
  progressBarFill: { height: '100%', backgroundColor: '#10B981', borderRadius: 5 },
  progressSmall: { fontSize: 12, color: '#6B7280' },

  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, gap: 8, marginTop: 16 },
  summaryCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 12, width: '47%',
    alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03, shadowRadius: 4, elevation: 1,
  },
  summaryValue: { fontSize: 15, fontWeight: '700', color: '#1a1a2e', marginTop: 6 },
  summaryLabel: { fontSize: 11, color: '#6B7280', marginTop: 2, textAlign: 'center' },

  // Auto-Pay
  autoPayRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  autoPayLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  autoPayIcon: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  autoPayTitle: { fontSize: 15, fontWeight: '600', color: '#374151' },
  autoPayDesc: { fontSize: 12, color: '#6B7280', marginTop: 2 },

  // Payment schedule rows
  paymentRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  paymentRowPaid: { opacity: 0.7 },
  paymentLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  paymentIcon: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  paymentNum: { fontSize: 14, fontWeight: '600', color: '#374151' },
  paymentDate: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  paymentRight: { alignItems: 'flex-end' },
  paymentAmount: { fontSize: 15, fontWeight: '700', color: '#374151' },
  paidBadge: { fontSize: 10, color: '#059669', fontWeight: '600', marginTop: 2 },

  // Contracts
  noContractsText: { fontSize: 13, color: '#9CA3AF', textAlign: 'center', paddingVertical: 16 },
  contractRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  contractLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  contractIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center' },
  contractName: { fontSize: 13, fontWeight: '600', color: '#374151' },
  contractDate: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  contractViewBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: '#EFF6FF' },
  contractViewText: { fontSize: 12, fontWeight: '600', color: '#3B82F6' },

  // Details
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  detailLabel: { fontSize: 13, color: '#6B7280' },
  detailValue: { fontSize: 13, fontWeight: '600', color: '#374151' },

  // Payment method picker
  pickerHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  pickerClose: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  pickerTitle: { fontSize: 17, fontWeight: '700', color: '#1a1a2e' },

  paymentMethodCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12,
    padding: 16, marginBottom: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03, shadowRadius: 4, elevation: 1, gap: 12,
  },
  pmIconCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#ECFDF5', justifyContent: 'center', alignItems: 'center' },
  pmLabel: { fontSize: 15, fontWeight: '600', color: '#374151' },
  pmType: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
});
