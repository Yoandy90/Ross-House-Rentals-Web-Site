import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert, Animated,
  Dimensions, Platform, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { Colors, Gradients, API_URL } from '../../src/constants/theme';
import { cachedFetch, invalidateCache } from '../../src/utils/apiCache';
import { LoansSkeleton } from '../../src/components/SkeletonLoading';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const fmt = (n: number | null | undefined) => {
  const val = typeof n === 'number' && !isNaN(n) ? n : 0;
  return `$${val.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
};
const fmtShort = (n: number | null | undefined) => {
  const val = typeof n === 'number' && !isNaN(n) ? n : 0;
  return val >= 1000 ? `$${(val / 1000).toFixed(1)}k` : `$${val.toFixed(0)}`;
};

// ═══════════════════════════════════════
// ANIMATED PROGRESS RING
// ═══════════════════════════════════════
function ProgressRing({ progress, size = 120, strokeWidth = 10, paidLabel = 'paid' }: { progress: number; size?: number; strokeWidth?: number; paidLabel?: string }) {
  const animatedValue = useRef(new Animated.Value(0)).current;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: Math.min(progress, 100),
      duration: 1200,
      useNativeDriver: false,
    }).start();
  }, [progress]);

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {/* Background Circle */}
      <View style={{
        position: 'absolute', width: size, height: size,
        borderRadius: size / 2, borderWidth: strokeWidth,
        borderColor: 'rgba(255,255,255,0.08)',
      }} />
      {/* Foreground Arc (simplified with border trick) */}
      <View style={{
        position: 'absolute', width: size, height: size,
        borderRadius: size / 2, borderWidth: strokeWidth,
        borderColor: Colors.primaryLight,
        borderTopColor: progress > 25 ? Colors.primaryLight : 'transparent',
        borderRightColor: progress > 50 ? Colors.primaryLight : 'transparent',
        borderBottomColor: progress > 75 ? Colors.primaryLight : 'transparent',
        borderLeftColor: progress > 0 ? Colors.primaryLight : 'transparent',
        transform: [{ rotate: '-90deg' }],
        opacity: 0.9,
      }} />
      {/* Center content */}
      <View style={{ alignItems: 'center' }}>
        <Text style={{ fontSize: 24, fontWeight: '800', color: '#fff' }}>
          {progress.toFixed(0)}%
        </Text>
        <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>
          {paidLabel}
        </Text>
      </View>
    </View>
  );
}

// ═══════════════════════════════════════
// SEGMENTED CONTROL
// ═══════════════════════════════════════
function SegmentedControl({ segments, selected, onSelect }: {
  segments: { key: string; label: string; icon: string }[];
  selected: string;
  onSelect: (key: string) => void;
}) {
  return (
    <View style={segStyles.container}>
      {segments.map((seg) => {
        const active = seg.key === selected;
        return (
          <TouchableOpacity
            key={seg.key}
            style={[segStyles.tab, active && segStyles.tabActive]}
            onPress={() => { Haptics.selectionAsync(); onSelect(seg.key); }}
            activeOpacity={0.7}
          >
            <Ionicons
              name={seg.icon as any}
              size={16}
              color={active ? Colors.primaryLight : Colors.textMuted}
            />
            <Text style={[segStyles.label, active && segStyles.labelActive]}>
              {seg.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const segStyles = StyleSheet.create({
  container: {
    flexDirection: 'row', backgroundColor: Colors.surface,
    borderRadius: 14, padding: 4, marginBottom: 20,
    borderWidth: 1, borderColor: Colors.border,
  },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 10, borderRadius: 11, gap: 6,
  },
  tabActive: { backgroundColor: 'rgba(52,211,153,0.1)' },
  label: { fontSize: 12, fontWeight: '600', color: Colors.textMuted },
  labelActive: { color: Colors.primaryLight },
});

// ═══════════════════════════════════════
// MAIN SCREEN
// ═══════════════════════════════════════
export default function LoansScreen() {
  const { t } = useTranslation();
  const { user, token } = useAuth();
  const [loans, setLoans] = useState<any[]>([]);
  const [selectedLoan, setSelectedLoan] = useState<any>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [schedule, setSchedule] = useState<any[]>([]);
  const [autopay, setAutopay] = useState<any>(null);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [showAutopayModal, setShowAutopayModal] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState<any>(null);
  const [detailTab, setDetailTab] = useState('overview');
  const [customAmount, setCustomAmount] = useState('');
  const [selectedPayAmount, setSelectedPayAmount] = useState<'monthly' | 'custom' | 'full'>('monthly');

  const [contactInfo, setContactInfo] = useState<any>(null);
  const [profileData, setProfileData] = useState<any>(null);
  const [approvedApps, setApprovedApps] = useState<any[]>([]);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  const STATUS_MAP: Record<string, { label: string; bgColor: string; textColor: string; icon: string }> = {
    pending_signature: { label: t('loanStatus.pendingSignature', 'Pending Signature'), bgColor: 'rgba(147,51,234,0.12)', textColor: '#a855f7', icon: 'create' },
    active: { label: t('loans.statusActive'), bgColor: 'rgba(52,211,153,0.12)', textColor: Colors.primaryLight, icon: 'pulse' },
    approved: { label: t('loanStatus.approved', 'Approved'), bgColor: 'rgba(59,130,246,0.12)', textColor: '#3b82f6', icon: 'checkmark-done' },
    signed: { label: t('loanStatus.signed', 'Signed'), bgColor: 'rgba(99,102,241,0.12)', textColor: '#6366f1', icon: 'checkmark-done' },
    paid_off: { label: t('loans.statusPaid'), bgColor: 'rgba(59,130,246,0.12)', textColor: '#60A5FA', icon: 'checkmark-circle' },
    delinquent: { label: t('loans.statusDelinquent'), bgColor: 'rgba(245,158,11,0.12)', textColor: Colors.accent, icon: 'warning' },
    default: { label: t('loans.statusDefault'), bgColor: 'rgba(239,68,68,0.12)', textColor: Colors.error, icon: 'alert-circle' },
    cancelled: { label: t('loans.statusCancelled'), bgColor: 'rgba(107,114,128,0.12)', textColor: Colors.textMuted, icon: 'close-circle' },
  };

  const fetchLoans = useCallback(async (force = false) => {
    if (!token) { setLoading(false); return; }
    try {
      if (force) invalidateCache('my-loans');
      const [loanData, appData] = await Promise.all([
        cachedFetch(
          `${API_URL}/api/loans/my-loans`,
          { headers: { 'Authorization': `Bearer ${token}` } },
          60_000
        ),
        fetch(`${API_URL}/api/loans/my-applications`, {
          headers: { 'Authorization': `Bearer ${token}` },
        }).then(r => r.ok ? r.json() : { applications: [] }).catch(() => ({ applications: [] })),
      ]);
      const fetchedLoans = loanData.loans || [];
      setLoans(fetchedLoans);

      // Show approved/pending applications that don't yet have a matching loan
      const allApps = appData.applications || [];
      const loanEmails = new Set(fetchedLoans.map((l: any) => l.client_email?.toLowerCase()));
      const pendingApps = allApps.filter((a: any) =>
        ['approved', 'pending', 'under_review', 'pending_signature', 'docs_submitted'].includes(a.status) &&
        !loanEmails.has(a.applicant_email?.toLowerCase())
      );
      setApprovedApps(pendingApps);
    } catch (e) { console.log(e); }
    setLoading(false);
  }, [token, user]);

  const fetchContactInfo = useCallback(async () => {
    try {
      const data = await cachedFetch(
        `${API_URL}/api/public/contact-info`,
        undefined,
        300_000 // 5 min cache for static contact info
      );
      setContactInfo(data.contact);
    } catch (e) { console.log(e); }
  }, []);

  const fetchLoanDetails = async (loanId: string) => {
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      // Parallel cached fetches
      const [schedData, payData, methData] = await Promise.all([
        cachedFetch(`${API_URL}/api/loans/${loanId}/payment-schedule`, { headers }, 30_000).catch(() => null),
        cachedFetch(`${API_URL}/api/loans/${loanId}/payments`, { headers }, 30_000).catch(() => null),
        cachedFetch(`${API_URL}/api/loans/payment-methods`, { headers }, 120_000).catch(() => null),
      ]);

      setSchedule(schedData?.schedule || []);
      setAutopay(schedData?.autopay || { active: false });
      setPayments(payData?.payments || []);
      setPaymentMethods(methData?.methods || []);
    } catch (e) { console.log(e); }
  };

  const fetchProfileData = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) setProfileData(await res.json());
    } catch (e) { console.log(e); }
  }, [token]);

  useEffect(() => { fetchLoans(); fetchContactInfo(); fetchProfileData(); }, [fetchLoans, fetchContactInfo, fetchProfileData]);

  // Auto-select first active loan (or first loan) when loans load
  const [topTab, setTopTab] = useState<'active' | 'history'>('active');

  useEffect(() => {
    if (loans.length > 0 && !selectedLoan) {
      const firstActive = loans.find(l => l.status === 'active') || loans[0];
      selectLoan(firstActive);
    }
  }, [loans]);

  useEffect(() => {
    if (selectedLoan) {
      fadeAnim.setValue(0);
      slideAnim.setValue(30);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]).start();
    }
  }, [selectedLoan]);

  const onRefresh = async () => { setRefreshing(true); invalidateCache('my-loans'); await fetchLoans(true); setRefreshing(false); };

  const selectLoan = (loan: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedLoan(loan);
    setDetailTab('overview');
    fetchLoanDetails(loan._id);
  };

  const handleMakePayment = async (methodId: string) => {
    if (!selectedLoan) return;

    // Validate custom amount
    if (selectedPayAmount === 'custom') {
      const parsed = parseFloat(customAmount);
      if (!customAmount || isNaN(parsed) || parsed <= 0) {
        Alert.alert(t('loans.invalidAmount', 'Invalid Amount'), t('loans.invalidAmountMsg', 'Please enter a valid amount greater than $0.'));
        return;
      }
      if (parsed > (selectedLoan?.balance ?? 0)) {
        Alert.alert(t('loans.amountExceeded', 'Amount Exceeded'), t('loans.amountExceededMsg', 'Amount cannot exceed the balance of') + ` ${fmt(selectedLoan?.balance ?? 0)}.`);
        return;
      }
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setProcessingPayment(true);

    let amount: number | undefined;
    if (selectedPayAmount === 'full') {
      amount = selectedLoan?.balance ?? 0;
    } else if (selectedPayAmount === 'custom' && customAmount) {
      amount = parseFloat(customAmount);
    }

    try {
      const res = await fetch(`${API_URL}/api/loans/${selectedLoan._id}/make-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ payment_method_id: methodId, amount }),
      });
      const data = await res.json();
      if (res.ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setPaymentSuccess(data);
        setShowPayModal(false);
        const updatedLoan = { ...selectedLoan, balance: data.new_balance };
        setSelectedLoan(updatedLoan);
        fetchLoanDetails(selectedLoan._id);
        fetchLoans();
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert(t('common.error'), data.detail || 'Error procesando pago');
      }
    } catch {
      Alert.alert(t('common.error'), t('common.connectionError'));
    }
    setProcessingPayment(false);
  };

  const handleConfigureAutopay = async (methodId: string) => {
    if (!selectedLoan) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setProcessingPayment(true);
    try {
      const res = await fetch(`${API_URL}/api/loans/${selectedLoan._id}/autopay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          payment_method_id: methodId,
          payment_date_preference: 'on_due_date',
          amount_type: 'monthly',
        }),
      });
      const data = await res.json();
      if (res.ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(t('loans.autoPayActivated', 'AutoPay Activated'), `${t('loans.code', 'Code')}: ${data.confirmation_code}`);
        setShowAutopayModal(false);
        setAutopay({ active: true, ...data.config });
        fetchLoanDetails(selectedLoan._id);
      } else {
        Alert.alert(t('common.error'), data.detail || 'Error');
      }
    } catch {
      Alert.alert(t('common.error'), t('common.connectionError'));
    }
    setProcessingPayment(false);
  };

  const handleCancelAutopay = async () => {
    if (!selectedLoan) return;
    Alert.alert(t('loans.cancelAutopay'), t('loans.cancelAutopayConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('loans.deactivate'), style: 'destructive',
        onPress: async () => {
          try {
            const res = await fetch(`${API_URL}/api/loans/${selectedLoan._id}/autopay`, {
              method: 'DELETE',
              headers: { 'Authorization': `Bearer ${token}` },
            });
            if (res.ok) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              setAutopay({ active: false });
            }
          } catch {}
        }
      },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <LoansSkeleton />
      </SafeAreaView>
    );
  }

  // ═══════════════════════════════════════════
  // 💳 PAYMENT SUCCESS OVERLAY
  // ═══════════════════════════════════════════
  if (paymentSuccess) {
    const successAmount = paymentSuccess?.amount ?? 0;
    const successBalance = paymentSuccess?.new_balance ?? 0;
    const successNum = paymentSuccess?.payment_number ?? 0;
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.successContainer}>
          <View style={styles.successIconWrap}>
            <LinearGradient
              colors={['#059669', '#34D399']}
              style={styles.successIcon}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            >
              <Ionicons name="checkmark" size={48} color="#fff" />
            </LinearGradient>
          </View>
          <Text style={styles.successTitle}>{t('loans.paymentSuccess')}</Text>
          <Text style={styles.successAmount}>{fmt(successAmount)}</Text>
          <Text style={styles.successSub}>{t('loans.paymentProcessed', { num: successNum })}</Text>

          <View style={styles.successCard}>
            <View style={styles.successRow}>
              <Text style={styles.successLabel}>{t('loans.newBalance')}</Text>
              <Text style={styles.successValue}>{fmt(successBalance)}</Text>
            </View>
            <View style={[styles.successRow, { borderBottomWidth: 0 }]}>
              <Text style={styles.successLabel}>{t('loans.status')}</Text>
              <View style={styles.successBadge}>
                <Text style={styles.successBadgeText}>{t('loans.processing')}</Text>
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={styles.successBtn}
            onPress={() => {
              // Clear success state first, then refresh
              const loanId = selectedLoan?._id;
              setPaymentSuccess(null);
              // Refresh loan data and list after payment
              fetchLoans();
              if (loanId) {
                fetchLoanDetails(loanId);
              }
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.successBtnText}>{t('loans.continue')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ═══════════════════════════════════════════
  // 📋 LOAN DETAIL VIEW
  // ═══════════════════════════════════════════
  if (selectedLoan) {
    const loanTotalToPay = selectedLoan.total_to_pay || selectedLoan.amount || 0;
    const loanBalance = selectedLoan.balance ?? 0;
    const loanMonthly = selectedLoan.monthly_payment ?? 0;
    const progress = loanTotalToPay > 0
      ? ((loanTotalToPay - loanBalance) / loanTotalToPay) * 100 : 0;
    const st = STATUS_MAP[selectedLoan.status] || STATUS_MAP.active;
    const nextScheduled = schedule.find(s => s.status === 'upcoming');
    const paidCount = schedule.filter(s => s.status === 'paid').length;

    return (
      <SafeAreaView style={styles.container}>
        <Animated.ScrollView
          contentContainerStyle={styles.scroll}
          style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}
          showsVerticalScrollIndicator={false}
        >
          {/* Back + Header */}
          <View style={styles.detailTopBar}>
            {loans.length > 1 ? (
              <TouchableOpacity
                onPress={() => { setSelectedLoan(null); setSchedule([]); setPayments([]); }}
                style={styles.backBtn} activeOpacity={0.7}
              >
                <Ionicons name="chevron-back" size={20} color={Colors.primaryLight} />
                <Text style={styles.backText}>{t('loans.backToLoans')}</Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.pageTitle}>{t('loans.title')}</Text>
            )}
            <View style={[styles.statusBadgeLg, { backgroundColor: st.bgColor }]}>
              <Ionicons name={st.icon as any} size={12} color={st.textColor} />
              <Text style={[styles.statusTextLg, { color: st.textColor }]}>{st.label}</Text>
            </View>
          </View>

          {/* Hero Balance Card */}
          <LinearGradient
            colors={['#064E3B', '#059669', '#34D399']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={styles.heroCard}
          >
            <View style={styles.heroTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.heroLoanNum}>{selectedLoan.loan_number}</Text>
                <Text style={styles.heroType}>
                  {selectedLoan.loan_type === 'tax_advance' ? t('loans.taxAdvance') : t('loans.personalLoan')}
                </Text>
              </View>
              <ProgressRing progress={progress} size={90} strokeWidth={8} paidLabel={t('loans.paid')} />
            </View>

            <View style={styles.heroDivider} />

            <View style={styles.heroBottom}>
              <View style={styles.heroStat}>
                <Text style={styles.heroStatLabel}>Balance</Text>
                <Text style={styles.heroStatValue}>{fmt(loanBalance)}</Text>
              </View>
              <View style={styles.heroStatDivider} />
              <View style={styles.heroStat}>
                <Text style={styles.heroStatLabel}>Pago Mensual</Text>
                <Text style={styles.heroStatValue}>{fmt(loanMonthly)}</Text>
              </View>
              <View style={styles.heroStatDivider} />
              <View style={styles.heroStat}>
                <Text style={styles.heroStatLabel}>Plazo</Text>
                <Text style={styles.heroStatValue}>{paidCount}/{selectedLoan.term_months}</Text>
              </View>
            </View>
          </LinearGradient>

          {/* Quick Actions */}
          {selectedLoan.status === 'pending_signature' && (
            <View style={{ marginBottom: 20, paddingHorizontal: 16 }}>
              <TouchableOpacity
                style={{
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                  backgroundColor: '#a855f7', paddingVertical: 16, borderRadius: 16, gap: 10,
                  shadowColor: '#a855f7', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12,
                }}
                activeOpacity={0.7}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  router.push({ pathname: '/loan/sign-contract', params: { loanId: selectedLoan._id || selectedLoan.id } });
                }}
              >
                <Ionicons name="create" size={22} color="#fff" />
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>
                  {t('loans.signContract', 'Firmar Contrato')}
                </Text>
              </TouchableOpacity>
              <Text style={{ color: Colors.textMuted, fontSize: 12, textAlign: 'center', marginTop: 8 }}>
                {t('loans.signContractDesc', 'Su préstamo fue aprobado. Firme el contrato para activarlo.')}
              </Text>
            </View>
          )}

          {selectedLoan.status === 'active' && (
            <View style={styles.quickActions}>
              <TouchableOpacity
                style={styles.quickActionBtn}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowPayModal(true); }}
                activeOpacity={0.7}
              >
                <LinearGradient colors={Gradients.primary} style={styles.quickActionIcon} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                  <Ionicons name="flash" size={20} color="#fff" />
                </LinearGradient>
                <Text style={styles.quickActionLabel}>{t('loans.payNow')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickActionBtn}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  autopay?.active ? handleCancelAutopay() : setShowAutopayModal(true);
                }}
                activeOpacity={0.7}
              >
                <View style={[styles.quickActionIcon, { backgroundColor: autopay?.active ? 'rgba(52,211,153,0.15)' : Colors.elevated }]}>
                  <Ionicons name="repeat" size={20} color={autopay?.active ? Colors.primaryLight : Colors.textMuted} />
                </View>
                <Text style={styles.quickActionLabel}>
                  {autopay?.active ? t('loans.autopayActive') : t('loans.activateAutopay')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.quickActionBtn} activeOpacity={0.7}
                onPress={() => { setDetailTab('schedule'); Haptics.selectionAsync(); }}
              >
                <View style={[styles.quickActionIcon, { backgroundColor: Colors.elevated }]}>
                  <Ionicons name="calendar" size={20} color={Colors.accent} />
                </View>
                <Text style={styles.quickActionLabel}>{t('loans.viewSchedule')}</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Next Payment Alert */}
          {nextScheduled && selectedLoan.status === 'active' && (
            <View style={styles.nextPayAlert}>
              <View style={styles.nextPayLeft}>
                <View style={styles.nextPayIconWrap}>
                  <Ionicons name="time-outline" size={18} color={Colors.accent} />
                </View>
                <View>
                  <Text style={styles.nextPayTitle}>{t('loans.nextPaymentTitle')}</Text>
                  <Text style={styles.nextPayDate}>
                    {new Date(nextScheduled.due_date).toLocaleDateString('es-MX', {
                      day: 'numeric', month: 'short', year: 'numeric'
                    })}
                  </Text>
                </View>
              </View>
              <Text style={styles.nextPayAmount}>{fmt(nextScheduled.amount)}</Text>
            </View>
          )}

          {/* Segmented Tabs */}
          <SegmentedControl
            segments={[
              { key: 'overview', label: t('loans.overview'), icon: 'grid-outline' },
              { key: 'schedule', label: t('loans.schedule'), icon: 'calendar-outline' },
              { key: 'history', label: t('loans.history'), icon: 'receipt-outline' },
            ]}
            selected={detailTab}
            onSelect={setDetailTab}
          />

          {/* TAB: Overview */}
          {detailTab === 'overview' && (
            <View>
              {/* AutoPay Card */}
              <View style={styles.autopayCard}>
                <View style={styles.autopayRow}>
                  <View style={[styles.autopayDot, { backgroundColor: autopay?.active ? Colors.primaryLight : Colors.textMuted }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.autopayTitle}>{t('loans.autopayTitle')}</Text>
                    <Text style={styles.autopaySubtitle}>
                      {autopay?.active ? t('loans.autopayActiveDesc') : t('loans.autopayInactiveDesc')}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.autopayToggle, autopay?.active && styles.autopayToggleActive]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      autopay?.active ? handleCancelAutopay() : setShowAutopayModal(true);
                    }}
                  >
                    <View style={[styles.autopayKnob, autopay?.active && styles.autopayKnobActive]} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Loan Details Grid */}
              <View style={styles.detailGrid}>
                <View style={styles.detailGridItem}>
                  <Ionicons name="cash-outline" size={18} color={Colors.primaryLight} />
                  <Text style={styles.detailGridLabel}>{t('loans.borrowed')}</Text>
                  <Text style={styles.detailGridValue}>{fmt(selectedLoan.amount ?? 0)}</Text>
                </View>
                <View style={styles.detailGridItem}>
                  <Ionicons name="trending-up" size={18} color={Colors.accent} />
                  <Text style={styles.detailGridLabel}>{t('loans.interest')}</Text>
                  <Text style={styles.detailGridValue}>{fmt(selectedLoan.total_interest ?? 0)}</Text>
                </View>
                <View style={styles.detailGridItem}>
                  <Ionicons name="receipt-outline" size={18} color={Colors.secondaryLight} />
                  <Text style={styles.detailGridLabel}>{t('loans.adminFee')}</Text>
                  <Text style={styles.detailGridValue}>{fmt(selectedLoan.admin_fee ?? 0)}</Text>
                </View>
                <View style={styles.detailGridItem}>
                  <Ionicons name="wallet-outline" size={18} color={Colors.info} />
                  <Text style={styles.detailGridLabel}>{t('loans.totalToPay')}</Text>
                  <Text style={styles.detailGridValue}>{fmt(selectedLoan.total_to_pay ?? 0)}</Text>
                </View>
              </View>

              {/* Contact */}
              <TouchableOpacity style={styles.contactCard} activeOpacity={0.7}>
                <View style={styles.contactIconWrap}>
                  <Ionicons name="headset-outline" size={20} color={Colors.primaryLight} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.contactTitle}>{t('loans.needHelp')}</Text>
                  <Text style={styles.contactSub}>{t('loans.callAdvisor')}</Text>
                </View>
                <Text style={styles.contactPhone}>{contactInfo?.phone || '(806) 934-2018'}</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* TAB: Schedule */}
          {detailTab === 'schedule' && (
            <View>
              {schedule.length === 0 ? (
                <View style={styles.emptyTab}>
                  <Ionicons name="calendar-outline" size={40} color={Colors.textMuted} />
                  <Text style={styles.emptyTabText}>{t('loans.scheduleEmpty')}</Text>
                </View>
              ) : (
                schedule.map((item) => {
                  const isPaid = item.status === 'paid';
                  const isOverdue = item.status === 'overdue';
                  const isNext = item.status === 'upcoming' && item.payment_number === nextScheduled?.payment_number;
                  return (
                    <View key={item.payment_number} style={[
                      styles.scheduleItem,
                      isNext && styles.scheduleItemNext,
                    ]}>
                      <View style={[
                        styles.scheduleDot,
                        { backgroundColor: isPaid ? Colors.primaryLight : isOverdue ? Colors.error : isNext ? Colors.accent : Colors.border },
                      ]}>
                        {isPaid && <Ionicons name="checkmark" size={10} color="#fff" />}
                        {isOverdue && <Ionicons name="alert" size={10} color="#fff" />}
                        {isNext && <Ionicons name="time" size={10} color="#fff" />}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.scheduleNum}>{t('loans.paymentNum', { num: item.payment_number })}</Text>
                        <Text style={styles.scheduleDate}>
                          {new Date(item.due_date).toLocaleDateString('es-MX', { day: 'numeric', month: 'long' })}
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={[styles.scheduleAmount, {
                          color: isPaid ? Colors.primaryLight : isOverdue ? Colors.error : Colors.text
                        }]}>
                          {fmt(item.amount)}
                        </Text>
                        <Text style={[styles.scheduleStatus, {
                          color: isPaid ? Colors.primaryLight : isOverdue ? Colors.error : isNext ? Colors.accent : Colors.textMuted
                        }]}>
                          {isPaid ? t('loans.statusPaidLabel') : isOverdue ? t('loans.statusOverdue') : isNext ? t('loans.statusNext') : t('loans.statusPending')}
                        </Text>
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          )}

          {/* TAB: History */}
          {detailTab === 'history' && (
            <View>
              {payments.length === 0 ? (
                <View style={styles.emptyTab}>
                  <Ionicons name="receipt-outline" size={40} color={Colors.textMuted} />
                  <Text style={styles.emptyTabText}>{t('loans.historyEmpty')}</Text>
                  <Text style={styles.emptyTabSub}>{t('loans.historyEmptyDesc')}</Text>
                </View>
              ) : (
                payments.map((p: any, idx: number) => (
                  <View key={p._id || idx} style={styles.historyItem}>
                    <View style={styles.historyIcon}>
                      <Ionicons name="checkmark-circle" size={22} color={Colors.primaryLight} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.historyTitle}>{t('loans.paymentNum', { num: p.payment_number })}</Text>
                      <Text style={styles.historyDate}>
                        {p.payment_date ? new Date(p.payment_date).toLocaleDateString('es-MX', {
                          day: 'numeric', month: 'short', year: 'numeric'
                        }) : ''}
                        {p.payment_method_name ? ` • ${p.payment_method_name}` : ''}
                      </Text>
                    </View>
                    <Text style={styles.historyAmount}>{fmt(p.amount)}</Text>
                  </View>
                ))
              )}
            </View>
          )}
        </Animated.ScrollView>

        {/* ═══ MAKE PAYMENT OVERLAY — no Modal (crash-safe) ═══ */}
        {showPayModal && (
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 998 }}>
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                {/* Handle */}
                <View style={styles.modalHandle} />

                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>{t('loans.makePayment')}</Text>
                  <TouchableOpacity onPress={() => setShowPayModal(false)} style={styles.modalClose}>
                    <Ionicons name="close" size={22} color={Colors.textMuted} />
                  </TouchableOpacity>
                </View>

                {/* Amount Selection */}
                <View style={styles.amountOptions}>
                  <TouchableOpacity
                    style={[styles.amountOption, selectedPayAmount === 'monthly' && styles.amountOptionActive]}
                    onPress={() => { setSelectedPayAmount('monthly'); Haptics.selectionAsync(); }}
                  >
                    <Text style={[styles.amountOptionLabel, selectedPayAmount === 'monthly' && styles.amountOptionLabelActive]}>
                      {t('loans.monthlyPaymentOption')}
                    </Text>
                    <Text style={[styles.amountOptionValue, selectedPayAmount === 'monthly' && styles.amountOptionValueActive]}>
                      {fmt(selectedLoan?.monthly_payment ?? 0)}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.amountOption, selectedPayAmount === 'full' && styles.amountOptionActive]}
                    onPress={() => { setSelectedPayAmount('full'); Haptics.selectionAsync(); }}
                  >
                    <Text style={[styles.amountOptionLabel, selectedPayAmount === 'full' && styles.amountOptionLabelActive]}>
                      {t('loans.fullBalance')}
                    </Text>
                    <Text style={[styles.amountOptionValue, selectedPayAmount === 'full' && styles.amountOptionValueActive]}>
                      {fmt(selectedLoan?.balance ?? 0)}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Custom Amount Option */}
                <TouchableOpacity
                  style={[styles.customAmountContainer, selectedPayAmount === 'custom' && styles.customAmountContainerActive]}
                  onPress={() => { setSelectedPayAmount('custom'); Haptics.selectionAsync(); }}
                  activeOpacity={0.8}
                >
                  <View style={styles.customAmountHeader}>
                    <View style={styles.customAmountLeft}>
                      <View style={[styles.customRadio, selectedPayAmount === 'custom' && styles.customRadioActive]}>
                        {selectedPayAmount === 'custom' && <View style={styles.customRadioDot} />}
                      </View>
                      <Text style={[styles.customAmountLabel, selectedPayAmount === 'custom' && styles.customAmountLabelActive]}>
                        Otro Monto
                      </Text>
                    </View>
                    <Text style={styles.customAmountHint}>Pagos extras o adelantos</Text>
                  </View>
                  {selectedPayAmount === 'custom' && (
                    <View style={styles.customAmountInputRow}>
                      <Text style={styles.customAmountPrefix}>$</Text>
                      <TextInput
                        style={styles.customAmountInput}
                        value={customAmount}
                        onChangeText={(v) => setCustomAmount(v.replace(/[^0-9.]/g, ''))}
                        placeholder="0.00"
                        placeholderTextColor={Colors.textMuted}
                        keyboardType="decimal-pad"
                        autoFocus
                      />
                      {customAmount ? (
                        <TouchableOpacity onPress={() => setCustomAmount('')} style={styles.customAmountClear}>
                          <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  )}
                </TouchableOpacity>

                {/* Payment Methods */}
                <Text style={styles.modalSectionLabel}>{t('loans.selectMethod')}</Text>

                {paymentMethods.length === 0 ? (
                  <View style={styles.noMethodsBox}>
                    <Ionicons name="card-outline" size={28} color={Colors.textMuted} />
                    <Text style={styles.noMethodsText}>{t('loans.noMethods')}</Text>
                    <Text style={styles.noMethodsSub}>{t('loans.noMethodsDesc')}</Text>
                  </View>
                ) : (
                  <ScrollView style={{ maxHeight: 200 }} showsVerticalScrollIndicator={false}>
                    {paymentMethods.map((m: any) => (
                      <TouchableOpacity
                        key={m._id}
                        style={styles.methodCard}
                        onPress={() => handleMakePayment(m._id)}
                        disabled={processingPayment}
                        activeOpacity={0.7}
                      >
                        <View style={styles.methodIconWrap}>
                          <Ionicons
                            name={m.type === 'bank' ? 'business' : 'card'}
                            size={20}
                            color={Colors.primaryLight}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.methodName}>{m.bank_name || m.name || 'Cuenta'}</Text>
                          <Text style={styles.methodLast4}>••••{m.account_last4 || m.last4 || '0000'}</Text>
                        </View>
                        {processingPayment ? (
                          <ActivityIndicator color={Colors.primaryLight} size="small" />
                        ) : (
                          <View style={styles.methodArrow}>
                            <Ionicons name="arrow-forward" size={16} color={Colors.primaryLight} />
                          </View>
                        )}
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
              </View>
            </View>
          </View>
        )}

        {/* ═══ AUTOPAY OVERLAY — no Modal (crash-safe) ═══ */}
        {showAutopayModal && (
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 997 }}>
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <View style={styles.modalHandle} />

                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>{t('loans.activateAutopayTitle')}</Text>
                  <TouchableOpacity onPress={() => setShowAutopayModal(false)} style={styles.modalClose}>
                    <Ionicons name="close" size={22} color={Colors.textMuted} />
                  </TouchableOpacity>
                </View>

                {/* AutoPay Info */}
                <LinearGradient
                  colors={['rgba(5,150,105,0.08)', 'rgba(52,211,153,0.04)']}
                  style={styles.autopayInfoBox}
                >
                  <View style={styles.autopayInfoIcon}>
                    <Ionicons name="repeat" size={24} color={Colors.primaryLight} />
                  </View>
                  <Text style={styles.autopayInfoTitle}>{t('loans.autopayMonthlyTitle')}</Text>
                  <Text style={styles.autopayInfoAmount}>{fmt(selectedLoan?.monthly_payment ?? 0)}</Text>
                  <Text style={styles.autopayInfoDesc}>{t('loans.autopayDesc')}</Text>
                </LinearGradient>

                {/* Benefits */}
                <View style={styles.autopayBenefits}>
                  <View style={styles.benefitRow}>
                    <Ionicons name="checkmark-circle" size={16} color={Colors.primaryLight} />
                    <Text style={styles.benefitText}>{t('loans.benefitNeverLate')}</Text>
                  </View>
                  <View style={styles.benefitRow}>
                    <Ionicons name="checkmark-circle" size={16} color={Colors.primaryLight} />
                    <Text style={styles.benefitText}>{t('loans.benefitNoFees')}</Text>
                  </View>
                  <View style={styles.benefitRow}>
                    <Ionicons name="checkmark-circle" size={16} color={Colors.primaryLight} />
                    <Text style={styles.benefitText}>{t('loans.benefitCancelAnytime')}</Text>
                  </View>
                </View>

                <Text style={styles.modalSectionLabel}>{t('loans.selectMethod')}</Text>

                {paymentMethods.length === 0 ? (
                  <View style={styles.noMethodsBox}>
                    <Ionicons name="card-outline" size={28} color={Colors.textMuted} />
                    <Text style={styles.noMethodsText}>{t('loans.addMethodFirst')}</Text>
                  </View>
                ) : (
                  paymentMethods.map((m: any) => (
                    <TouchableOpacity
                      key={m._id}
                      style={styles.methodCard}
                      onPress={() => handleConfigureAutopay(m._id)}
                      disabled={processingPayment}
                      activeOpacity={0.7}
                    >
                      <View style={styles.methodIconWrap}>
                        <Ionicons name={m.type === 'bank' ? 'business' : 'card'} size={20} color={Colors.primaryLight} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.methodName}>{m.bank_name || m.name || 'Cuenta'}</Text>
                        <Text style={styles.methodLast4}>••••{m.account_last4 || m.last4 || '0000'}</Text>
                      </View>
                      {processingPayment ? (
                        <ActivityIndicator color={Colors.primaryLight} size="small" />
                      ) : (
                        <View style={styles.methodArrow}>
                          <Ionicons name="arrow-forward" size={16} color={Colors.primaryLight} />
                        </View>
                      )}
                    </TouchableOpacity>
                  ))
                )}
              </View>
            </View>
          </View>
        )}
      </SafeAreaView>
    );
  }

  // ═══════════════════════════════════════════
  // 📱 LOANS LIST VIEW
  // ═══════════════════════════════════════════
  const activeLoans = loans.filter(l => l.status === 'active');
  const paidOffLoans = loans.filter(l => l.status === 'paid_off');
  const otherLoans = loans.filter(l => l.status !== 'active' && l.status !== 'paid_off');
  const totalBalance = loans.reduce((sum, l) => sum + (l.balance || 0), 0);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primaryLight} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.listHeader}>
          <View>
            <Text style={styles.pageTitle}>{t('loans.title')}</Text>
            <Text style={styles.pageSubtitle}>
              {loans.length > 0
                ? t('loans.loanSummary', { active: activeLoans.length, paid: paidOffLoans.length, total: loans.length })
                : approvedApps.length > 0
                ? t('loans.applicationsActive', { count: approvedApps.length })
                : t('loans.noLoans')}
            </Text>
          </View>
          {totalBalance > 0 && (
            <View style={styles.totalBadge}>
              <Text style={styles.totalBadgeLabel}>Balance</Text>
              <Text style={styles.totalBadgeValue}>{fmtShort(totalBalance)}</Text>
            </View>
          )}
        </View>

        {loans.length === 0 ? (
          <View style={styles.emptyState}>
            {/* Show approved/pending applications if any */}
            {approvedApps.length > 0 ? (
              <View style={{ width: '100%' }}>
                <View style={{ alignItems: 'center', marginBottom: 20 }}>
                  <LinearGradient
                    colors={['rgba(59,130,246,0.15)', 'rgba(99,102,241,0.1)']}
                    style={[styles.emptyIconWrap, { marginBottom: 12 }]}
                  >
                    <Ionicons name="document-text-outline" size={44} color="#3B82F6" />
                  </LinearGradient>
                  <Text style={styles.emptyTitle}>{t('loans.applicationsInProgress', 'Solicitudes en Proceso')}</Text>
                  <Text style={[styles.emptySub, { marginBottom: 16 }]}>
                    {t('loans.applicationsSubtitle', 'Tus solicitudes están siendo procesadas')}
                  </Text>
                </View>
                {approvedApps.map((app: any) => {
                  const statusMap: Record<string, { label: string; color: string; bg: string; icon: string }> = {
                    approved: { label: t('loans.statusApproved', 'Aprobada'), color: '#34D399', bg: 'rgba(52,211,153,0.12)', icon: 'checkmark-circle' },
                    pending: { label: t('loans.statusPending', 'En Revisión'), color: '#FBBF24', bg: 'rgba(251,191,36,0.12)', icon: 'time' },
                    under_review: { label: t('loans.statusUnderReview', 'En Revisión'), color: '#60A5FA', bg: 'rgba(96,165,250,0.12)', icon: 'eye' },
                    pending_signature: { label: t('loans.statusPendingSign', 'Firma Pendiente'), color: '#A78BFA', bg: 'rgba(167,139,250,0.12)', icon: 'create' },
                    docs_submitted: { label: t('loans.statusDocsSubmitted', 'Docs Enviados'), color: '#2DD4BF', bg: 'rgba(45,212,191,0.12)', icon: 'documents' },
                  };
                  const st = statusMap[app.status] || statusMap.pending;
                  const amt = app.loan_amount || app.amount_requested || 0;
                  return (
                    <View key={app._id} style={{
                      backgroundColor: Colors.card, borderRadius: 16, padding: 16, marginBottom: 10,
                      borderWidth: 1, borderColor: Colors.border,
                    }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                          <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: st.bg, alignItems: 'center', justifyContent: 'center' }}>
                            <Ionicons name={st.icon as any} size={20} color={st.color} />
                          </View>
                          <View>
                            <Text style={{ fontSize: 16, fontWeight: '700', color: Colors.text }}>
                              ${typeof amt === 'number' ? amt.toLocaleString() : amt}
                            </Text>
                            <Text style={{ fontSize: 11, color: Colors.textMuted, marginTop: 1 }}>
                              {app.loan_purpose || app.purpose || t('loans.personalLoan')}
                            </Text>
                          </View>
                        </View>
                        <View style={{ backgroundColor: st.bg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}>
                          <Text style={{ fontSize: 11, fontWeight: '700', color: st.color }}>{st.label}</Text>
                        </View>
                      </View>
                      {app.status === 'approved' && (
                        <View style={{ marginTop: 10, backgroundColor: 'rgba(52,211,153,0.06)', borderRadius: 10, padding: 10 }}>
                          <Text style={{ fontSize: 11, color: Colors.primaryLight, lineHeight: 16 }}>
                            {t('loans.approvedInfo', '✓ Tu solicitud fue aprobada. El préstamo se activará pronto.')}
                          </Text>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            ) : (
              <>
                <LinearGradient
                  colors={['rgba(5,150,105,0.1)', 'rgba(52,211,153,0.05)']}
                  style={styles.emptyIconWrap}
                >
                  <Ionicons name="wallet-outline" size={44} color={Colors.primaryLight} />
                </LinearGradient>
                <Text style={styles.emptyTitle}>{t('loans.noLoans')}</Text>
                <Text style={styles.emptySub}>{t('loans.applyFirst')}</Text>
                <TouchableOpacity
                  style={styles.emptyBtn}
                  activeOpacity={0.8}
                  onPress={() => router.push('/(tabs)/apply')}
                >
                  <LinearGradient colors={Gradients.primary} style={styles.emptyBtnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                    <Ionicons name="add" size={18} color="#fff" />
                    <Text style={styles.emptyBtnText}>{t('loans.applyNow')}</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </>
            )}
          </View>
        ) : (
          <View>
          {/* Active Loans Section */}
          {activeLoans.length > 0 && (
            <View style={styles.sectionHeader}>
              <Ionicons name="pulse" size={16} color={Colors.primaryLight} />
              <Text style={styles.sectionHeaderText}>{t('loans.activeLoans')}</Text>
            </View>
          )}
          {activeLoans.map((loan, index) => {
            const st = STATUS_MAP[loan.status] || STATUS_MAP.active;
            const prog = loan.total_to_pay > 0 ? ((loan.total_to_pay - loan.balance) / loan.total_to_pay) * 100 : 0;
            return (
              <TouchableOpacity
                key={loan._id}
                style={styles.loanCard}
                onPress={() => selectLoan(loan)}
                activeOpacity={0.7}
              >
                {/* Card Header */}
                <View style={styles.loanCardHeader}>
                  <View style={styles.loanCardIcon}>
                    <Ionicons
                      name={loan.loan_type === 'tax_advance' ? 'document-text' : 'cash'}
                      size={18}
                      color={Colors.primaryLight}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.loanCardType}>
                      {loan.loan_type === 'tax_advance' ? t('loans.taxAdvance') : loan.loan_type === 'subchapter_f' ? t('loans.personalLoan') : t('loans.personalLoan')}
                    </Text>
                    <Text style={styles.loanCardNum}>{loan.loan_number}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: st.bgColor }]}>
                    <Ionicons name={st.icon as any} size={10} color={st.textColor} />
                    <Text style={[styles.statusText, { color: st.textColor }]}>{st.label}</Text>
                  </View>
                </View>

                {/* Balance Row */}
                <View style={styles.loanCardBody}>
                  <View>
                    <Text style={styles.loanBalance}>{fmt(loan.balance)}</Text>
                    <Text style={styles.loanBalanceLabel}>{t('loans.balanceRemaining')}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.loanMonthly}>{fmt(loan.monthly_payment)}</Text>
                    <Text style={styles.loanMonthlyLabel}>{t('loans.monthlyShort')}</Text>
                  </View>
                </View>

                {/* Progress Bar */}
                <View style={styles.progressContainer}>
                  <View style={styles.progressBg}>
                    <LinearGradient
                      colors={Gradients.primary}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[styles.progressFill, { width: `${Math.min(prog, 100)}%` } as any]}
                    />
                  </View>
                  <Text style={styles.progressLabel}>{t('loans.paidPercent', { pct: prog.toFixed(0) })}</Text>
                </View>

                {/* Identity Verification + Disbursement CTA for Approved Loans */}
                {loan.status === 'approved' && !loan.disbursement_method && (
                  <TouchableOpacity
                    style={styles.disbursementBtn}
                    onPress={(e) => {
                      e.stopPropagation && e.stopPropagation();
                      // Check user-level identity verification (persists across loans)
                      const userVerified = profileData?.identity_verified === true;
                      const loanVerified = loan.identity_verified === true;
                      if (userVerified || loanVerified) {
                        // Already verified — go to disbursement
                        router.push({
                          pathname: '/loan/disbursement',
                          params: { loanId: loan._id, amount: String(loan.amount || 0), loanNumber: loan.loan_number || '' }
                        });
                      } else {
                        // Needs verification first
                        router.push({
                          pathname: '/loan/verify-identity',
                          params: { loanId: loan._id, amount: String(loan.amount || 0), loanNumber: loan.loan_number || '' }
                        });
                      }
                    }}
                    activeOpacity={0.8}
                  >
                    <LinearGradient
                      colors={(profileData?.identity_verified || loan.identity_verified) ? ['#1a56db', '#3b82f6'] : ['#059669', '#34D399']}
                      style={styles.disbursementBtnGrad}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    >
                      <Ionicons
                        name={(profileData?.identity_verified || loan.identity_verified) ? 'flash' : 'shield-checkmark-outline'}
                        size={16} color="#fff"
                      />
                      <Text style={styles.disbursementBtnText}>
                        {(profileData?.identity_verified || loan.identity_verified) ? t('loans.selectDisbursement') : 'Verificar Identidad'}
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>
                )}
                {loan.status === 'approved' && loan.disbursement_method && (
                  <View style={styles.disbursementInfo}>
                    <Ionicons name="checkmark-circle" size={14} color="#059669" />
                    <Text style={styles.disbursementInfoText}>
                      {t('loans.disbursementLabel')}: {loan.disbursement_method === 'ach' ? t('loans.disbursementACH') : loan.disbursement_method === 'visa_direct' ? t('loans.disbursementInstant') : loan.disbursement_method === 'zelle' ? 'Zelle' : t('loans.disbursementCash')} — {loan.disbursement_status === 'completed' ? t('loans.disbursementDeposited') : t('loans.disbursementPending')}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}

          {/* Paid Off Loans Section */}
          {paidOffLoans.length > 0 && (
            <View>
              <View style={styles.sectionHeader}>
                <Ionicons name="checkmark-circle" size={16} color="#60A5FA" />
                <Text style={styles.sectionHeaderText}>{t('loans.completedLoans')}</Text>
              </View>
              {paidOffLoans.map((loan) => {
                const st = STATUS_MAP[loan.status] || STATUS_MAP.active;
                return (
                  <TouchableOpacity
                    key={loan._id}
                    style={[styles.loanCard, { opacity: 0.85 }]}
                    onPress={() => selectLoan(loan)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.loanCardHeader}>
                      <View style={[styles.loanCardIcon, { backgroundColor: 'rgba(96,165,250,0.1)' }]}>
                        <Ionicons name="checkmark-done" size={18} color="#60A5FA" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.loanCardType}>
                          {loan.loan_type === 'tax_advance' ? t('loans.taxAdvance') : t('loans.personalLoan')}
                        </Text>
                        <Text style={styles.loanCardNum}>{loan.loan_number}</Text>
                      </View>
                      <View style={[styles.statusBadge, { backgroundColor: st.bgColor }]}>
                        <Ionicons name={st.icon as any} size={10} color={st.textColor} />
                        <Text style={[styles.statusText, { color: st.textColor }]}>{st.label}</Text>
                      </View>
                    </View>
                    <View style={styles.loanCardBody}>
                      <View>
                        <Text style={[styles.loanBalance, { color: Colors.primaryLight }]}>{fmt(loan.total_to_pay || loan.amount)}</Text>
                        <Text style={styles.loanBalanceLabel}>{t('loans.totalPaidLabel')}</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={{ fontSize: 13, fontWeight: '600', color: '#60A5FA' }}>100%</Text>
                        <Text style={styles.loanMonthlyLabel}>{t('loans.completedLabel')}</Text>
                      </View>
                    </View>
                    <View style={styles.progressContainer}>
                      <View style={styles.progressBg}>
                        <LinearGradient
                          colors={['#3b82f6', '#60A5FA']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={[styles.progressFill, { width: '100%' }] as any}
                        />
                      </View>
                      <Text style={styles.progressLabel}>{t('loans.completedLabel')}</Text>
                    </View>
                    <View style={styles.paidHistoryHint}>
                      <Ionicons name="receipt-outline" size={14} color={Colors.primaryLight} />
                      <Text style={styles.paidHistoryHintText}>{t('loans.viewPaymentHistory')}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Other loans (approved, delinquent, etc.) */}
          {otherLoans.map((loan) => {
            const st = STATUS_MAP[loan.status] || STATUS_MAP.active;
            const prog = loan.total_to_pay > 0 ? ((loan.total_to_pay - loan.balance) / loan.total_to_pay) * 100 : 0;
            return (
              <TouchableOpacity
                key={loan._id}
                style={styles.loanCard}
                onPress={() => selectLoan(loan)}
                activeOpacity={0.7}
              >
                <View style={styles.loanCardHeader}>
                  <View style={styles.loanCardIcon}>
                    <Ionicons
                      name={loan.loan_type === 'tax_advance' ? 'document-text' : 'cash'}
                      size={18}
                      color={Colors.primaryLight}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.loanCardType}>
                      {loan.loan_type === 'tax_advance' ? t('loans.taxAdvance') : t('loans.personalLoan')}
                    </Text>
                    <Text style={styles.loanCardNum}>{loan.loan_number}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: st.bgColor }]}>
                    <Ionicons name={st.icon as any} size={10} color={st.textColor} />
                    <Text style={[styles.statusText, { color: st.textColor }]}>{st.label}</Text>
                  </View>
                </View>
                <View style={styles.loanCardBody}>
                  <View>
                    <Text style={styles.loanBalance}>{fmt(loan.balance)}</Text>
                    <Text style={styles.loanBalanceLabel}>{t('loans.balanceRemaining')}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.loanMonthly}>{fmt(loan.monthly_payment)}</Text>
                    <Text style={styles.loanMonthlyLabel}>{t('loans.monthlyShort')}</Text>
                  </View>
                </View>
                <View style={styles.progressContainer}>
                  <View style={styles.progressBg}>
                    <LinearGradient
                      colors={Gradients.primary}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[styles.progressFill, { width: `${Math.min(prog, 100)}%` }] as any}
                    />
                  </View>
                  <Text style={styles.progressLabel}>{t('loans.paidPercent', { pct: prog.toFixed(0) })}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ═══════════════════════════════════════════
// 🎨 STYLES
// ═══════════════════════════════════════════
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.bg },
  scroll: { padding: 20, paddingBottom: 100 },

  // ═══ LIST ═══
  listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  pageTitle: { fontSize: 28, fontWeight: '800', color: Colors.text, letterSpacing: -0.5 },
  pageSubtitle: { fontSize: 13, color: Colors.textMuted, marginTop: 4 },
  totalBadge: {
    backgroundColor: Colors.surface, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8,
    borderWidth: 1, borderColor: Colors.border, alignItems: 'center',
  },
  totalBadgeLabel: { fontSize: 9, color: Colors.textMuted, fontWeight: '600', textTransform: 'uppercase' },
  totalBadgeValue: { fontSize: 16, fontWeight: '800', color: Colors.primaryLight, marginTop: 2 },

  // Loan Card
  loanCard: {
    backgroundColor: Colors.card, borderRadius: 20, padding: 18, marginBottom: 14,
    borderWidth: 1, borderColor: Colors.border,
  },
  loanCardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  loanCardIcon: {
    width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(52,211,153,0.1)',
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  loanCardType: { fontSize: 14, fontWeight: '700', color: Colors.text },
  loanCardNum: { fontSize: 11, color: Colors.textMuted, marginTop: 1, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  loanCardBody: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 14 },
  loanBalance: { fontSize: 24, fontWeight: '800', color: Colors.text },
  loanBalanceLabel: { fontSize: 10, color: Colors.textMuted, marginTop: 2 },
  loanMonthly: { fontSize: 16, fontWeight: '700', color: Colors.primaryLight },
  loanMonthlyLabel: { fontSize: 10, color: Colors.textMuted, marginTop: 2 },

  // Progress
  progressContainer: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  progressBg: { flex: 1, height: 5, backgroundColor: Colors.border, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  progressLabel: { fontSize: 10, color: Colors.textMuted, fontWeight: '600', width: 55, textAlign: 'right' },

  // Status
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  statusText: { fontSize: 10, fontWeight: '700' },
  statusBadgeLg: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  statusTextLg: { fontSize: 11, fontWeight: '700' },

  // Empty
  emptyState: { alignItems: 'center', marginTop: 60, paddingHorizontal: 20 },
  emptyIconWrap: {
    width: 100, height: 100, borderRadius: 50, alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: Colors.text, marginBottom: 8 },
  emptySub: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  emptyBtn: { marginTop: 24 },
  emptyBtnGrad: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 12 },
  emptyBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },

  // ═══ DETAIL ═══
  detailTopBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6 },
  backText: { fontSize: 15, color: Colors.primaryLight, fontWeight: '600' },

  // Hero Card
  heroCard: { borderRadius: 24, padding: 24, marginBottom: 20, overflow: 'hidden' },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroLoanNum: { fontSize: 12, color: 'rgba(255,255,255,0.6)', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  heroType: { fontSize: 18, fontWeight: '700', color: '#fff', marginTop: 4 },
  heroDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.12)', marginVertical: 18 },
  heroBottom: { flexDirection: 'row', justifyContent: 'space-between' },
  heroStat: { alignItems: 'center', flex: 1 },
  heroStatLabel: { fontSize: 10, color: 'rgba(255,255,255,0.6)', marginBottom: 4 },
  heroStatValue: { fontSize: 16, fontWeight: '800', color: '#fff' },
  heroStatDivider: { width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.12)', alignSelf: 'center' },

  // Quick Actions
  quickActions: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 20, paddingHorizontal: 10 },
  quickActionBtn: { alignItems: 'center', gap: 8, width: 80 },
  quickActionIcon: {
    width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
  },
  quickActionLabel: { fontSize: 11, color: Colors.textSecondary, textAlign: 'center', lineHeight: 15 },

  // Next Payment Alert
  nextPayAlert: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'rgba(245,158,11,0.06)', borderRadius: 14, padding: 16,
    marginBottom: 20, borderWidth: 1, borderColor: 'rgba(245,158,11,0.15)',
  },
  nextPayLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  nextPayIconWrap: {
    width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(245,158,11,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  nextPayTitle: { fontSize: 13, fontWeight: '600', color: Colors.text },
  nextPayDate: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  nextPayAmount: { fontSize: 18, fontWeight: '800', color: Colors.accent },

  // AutoPay Card
  autopayCard: {
    backgroundColor: Colors.card, borderRadius: 16, padding: 16, marginBottom: 16,
    borderWidth: 1, borderColor: Colors.border,
  },
  autopayRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  autopayDot: { width: 8, height: 8, borderRadius: 4 },
  autopayTitle: { fontSize: 14, fontWeight: '600', color: Colors.text },
  autopaySubtitle: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  autopayToggle: {
    width: 48, height: 28, borderRadius: 14, backgroundColor: Colors.border,
    justifyContent: 'center', paddingHorizontal: 3,
  },
  autopayToggleActive: { backgroundColor: Colors.primaryLight },
  autopayKnob: {
    width: 22, height: 22, borderRadius: 11, backgroundColor: Colors.textMuted,
  },
  autopayKnobActive: { backgroundColor: '#fff', alignSelf: 'flex-end' },

  // Detail Grid
  detailGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16,
  },
  detailGridItem: {
    width: (SCREEN_WIDTH - 50) / 2 - 5, backgroundColor: Colors.card,
    borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.border, gap: 6,
  },
  detailGridLabel: { fontSize: 11, color: Colors.textMuted },
  detailGridValue: { fontSize: 16, fontWeight: '700', color: Colors.text },

  // Contact
  contactCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.card, borderRadius: 14, padding: 16, marginBottom: 16,
    borderWidth: 1, borderColor: Colors.border,
  },
  contactIconWrap: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(52,211,153,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  contactTitle: { fontSize: 13, fontWeight: '600', color: Colors.text },
  contactSub: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  contactPhone: { fontSize: 14, fontWeight: '700', color: Colors.primaryLight },

  // ═══ SCHEDULE TAB ═══
  scheduleItem: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 12,
  },
  scheduleItemNext: {
    backgroundColor: 'rgba(245,158,11,0.04)', marginHorizontal: -12,
    paddingHorizontal: 12, borderRadius: 10, borderBottomWidth: 0, marginBottom: 4,
  },
  scheduleDot: {
    width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
  },
  scheduleNum: { fontSize: 13, fontWeight: '600', color: Colors.text },
  scheduleDate: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  scheduleAmount: { fontSize: 14, fontWeight: '700' },
  scheduleStatus: { fontSize: 10, fontWeight: '600', marginTop: 2 },

  // ═══ HISTORY TAB ═══
  historyItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.card, borderRadius: 14, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: Colors.border,
  },
  historyIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(52,211,153,0.1)', alignItems: 'center', justifyContent: 'center' },
  historyTitle: { fontSize: 14, fontWeight: '600', color: Colors.text },
  historyDate: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  historyAmount: { fontSize: 16, fontWeight: '800', color: Colors.primaryLight },

  // Empty Tab
  emptyTab: { alignItems: 'center', paddingVertical: 40 },
  emptyTabText: { fontSize: 15, fontWeight: '600', color: Colors.textSecondary, marginTop: 12 },
  emptyTabSub: { fontSize: 12, color: Colors.textMuted, marginTop: 4 },

  // ═══ MODAL ═══
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: Colors.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, paddingTop: 12, maxHeight: '85%',
  },
  modalHandle: {
    width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.border,
    alignSelf: 'center', marginBottom: 16,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { fontSize: 22, fontWeight: '800', color: Colors.text },
  modalClose: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  modalSectionLabel: { fontSize: 12, fontWeight: '700', color: Colors.textMuted, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },

  // Amount Options
  amountOptions: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  amountOption: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: 14, padding: 16,
    borderWidth: 1.5, borderColor: Colors.border, alignItems: 'center',
  },
  amountOptionActive: { borderColor: Colors.primaryLight, backgroundColor: 'rgba(52,211,153,0.06)' },
  amountOptionLabel: { fontSize: 11, color: Colors.textMuted, marginBottom: 4 },
  amountOptionLabelActive: { color: Colors.primaryLight },
  amountOptionValue: { fontSize: 18, fontWeight: '800', color: Colors.text },
  amountOptionValueActive: { color: Colors.primaryLight },

  // Custom Amount
  customAmountContainer: {
    backgroundColor: Colors.surface, borderRadius: 14, padding: 16,
    borderWidth: 1.5, borderColor: Colors.border, marginBottom: 24,
  },
  customAmountContainerActive: { borderColor: Colors.primaryLight, backgroundColor: 'rgba(52,211,153,0.06)' },
  customAmountHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  customAmountLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  customRadio: {
    width: 18, height: 18, borderRadius: 9, borderWidth: 2,
    borderColor: Colors.textMuted, alignItems: 'center', justifyContent: 'center',
  },
  customRadioActive: { borderColor: Colors.primaryLight },
  customRadioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primaryLight },
  customAmountLabel: { fontSize: 14, fontWeight: '700', color: Colors.textSecondary },
  customAmountLabelActive: { color: Colors.primaryLight },
  customAmountHint: { fontSize: 10, color: Colors.textMuted, fontStyle: 'italic' },
  customAmountInputRow: {
    flexDirection: 'row', alignItems: 'center', marginTop: 14,
    backgroundColor: Colors.bg, borderRadius: 12, paddingHorizontal: 14, height: 52,
    borderWidth: 1, borderColor: Colors.border,
  },
  customAmountPrefix: { fontSize: 24, fontWeight: '800', color: Colors.primaryLight, marginRight: 6 },
  customAmountInput: { flex: 1, fontSize: 26, fontWeight: '800', color: Colors.text },
  customAmountClear: { padding: 4 },

  // No Methods
  noMethodsBox: {
    alignItems: 'center', paddingVertical: 30, backgroundColor: Colors.surface,
    borderRadius: 14, borderWidth: 1, borderColor: Colors.border,
  },
  noMethodsText: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary, marginTop: 10 },
  noMethodsSub: { fontSize: 12, color: Colors.textMuted, marginTop: 4 },

  // Method Card
  methodCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.card, borderRadius: 14, padding: 16, marginBottom: 10,
    borderWidth: 1, borderColor: Colors.border,
  },
  methodIconWrap: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(52,211,153,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  methodName: { fontSize: 14, fontWeight: '600', color: Colors.text },
  methodLast4: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  methodArrow: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(52,211,153,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },

  // AutoPay Modal Info
  autopayInfoBox: {
    borderRadius: 16, padding: 20, marginBottom: 20, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(52,211,153,0.15)',
  },
  autopayInfoIcon: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(52,211,153,0.12)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  autopayInfoTitle: { fontSize: 14, fontWeight: '600', color: Colors.text },
  autopayInfoAmount: { fontSize: 32, fontWeight: '800', color: Colors.primaryLight, marginTop: 4 },
  autopayInfoDesc: { fontSize: 12, color: Colors.textSecondary, textAlign: 'center', marginTop: 8, lineHeight: 18 },

  // Benefits
  autopayBenefits: { marginBottom: 20 },
  benefitRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  benefitText: { fontSize: 13, color: Colors.textSecondary },

  // ═══ SUCCESS ═══
  successContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 },
  successIconWrap: { marginBottom: 24 },
  successIcon: {
    width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center',
  },
  successTitle: { fontSize: 24, fontWeight: '800', color: Colors.text, marginBottom: 8 },
  successAmount: { fontSize: 36, fontWeight: '800', color: Colors.primaryLight },
  successSub: { fontSize: 14, color: Colors.textMuted, marginTop: 4 },
  successCard: {
    width: '100%', backgroundColor: Colors.card, borderRadius: 16, padding: 16,
    marginTop: 24, borderWidth: 1, borderColor: Colors.border,
  },
  successRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  successLabel: { fontSize: 13, color: Colors.textSecondary },
  successValue: { fontSize: 16, fontWeight: '700', color: Colors.text },
  successBadge: { backgroundColor: 'rgba(245,158,11,0.12)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  successBadgeText: { fontSize: 11, fontWeight: '700', color: Colors.accent },
  successBtn: {
    width: '100%', height: 52, borderRadius: 14, backgroundColor: Colors.primaryLight,
    alignItems: 'center', justifyContent: 'center', marginTop: 24,
  },
  successBtnText: { fontSize: 16, fontWeight: '700', color: Colors.bg },

  // Disbursement styles
  disbursementBtn: { marginTop: 12, borderRadius: 12, overflow: 'hidden' },
  disbursementBtnGrad: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: 12,
  },
  disbursementBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  disbursementInfo: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12,
    backgroundColor: 'rgba(5,150,105,0.08)', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10,
  },
  disbursementInfoText: { fontSize: 11, color: '#059669', fontWeight: '600', flex: 1 },

  // Section Headers
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginBottom: 12, marginTop: 8,
  },
  sectionHeaderText: { fontSize: 14, fontWeight: '700', color: Colors.textSecondary },

  // Paid loan hint
  paidHistoryHint: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.border,
  },
  paidHistoryHintText: { fontSize: 11, color: Colors.primaryLight, fontWeight: '500' },
});
