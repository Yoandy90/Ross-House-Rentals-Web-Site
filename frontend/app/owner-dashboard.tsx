import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { apiCall } from '../src/utils/api';
import { Spacing, FontSizes, BorderRadius, Shadows, useColors } from '../src/constants/theme';
import { formatCurrency } from '../src/utils/formatters';
import { GaugeChart, MiniStatCard } from '../src/components/ui/GaugeChart';

interface DashboardData {
  properties_count: number;
  financials: {
    total_income: number;
    total_commission: number;
    total_net: number;
    total_expenses: number;
    total_paid_out: number;
    pending_payout: number;
    month_income: number;
    month_commission: number;
    month_net: number;
    month_expenses: number;
  };
  maintenance_alerts: any[];
  recent_transactions: any[];
  payouts: any[];
}

const PRIORITY_COLORS: Record<string, string> = {
  urgent: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#22c55e',
};

export default function OwnerDashboardScreen() {
  const C = useColors();
  const styles = React.useMemo(() => createStyles(C), [C]);
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showBanking, setShowBanking] = useState(false);
  const [bankingData, setBankingData] = useState<any>(null);
  const [bankForm, setBankForm] = useState({
    bank_name: '',
    account_holder: '',
    routing_number: '',
    account_number: '',
    account_type: 'checking',
  });
  const [savingBank, setSavingBank] = useState(false);
  const [viewMode, setViewMode] = useState<'month' | 'all'>('month');

  const fetchDashboard = useCallback(async () => {
    try {
      const [dashData, bankData] = await Promise.all([
        apiCall('/owner/dashboard'),
        apiCall('/owner/banking'),
      ]);
      if (dashData.success) setData(dashData);
      if (bankData.success) setBankingData(bankData.banking);
    } catch (err) {
      console.log('Owner dashboard error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchDashboard(); }, []);

  const onRefresh = () => { setRefreshing(true); fetchDashboard(); };

  const saveBanking = async () => {
    if (!bankForm.bank_name || !bankForm.routing_number || !bankForm.account_number) {
      Alert.alert('Error', 'Completa todos los campos requeridos');
      return;
    }
    setSavingBank(true);
    try {
      await apiCall('/owner/banking', { method: 'POST', body: bankForm });
      Alert.alert('✅', t('owner_dashboard.bank_saved'));
      setShowBanking(false);
      fetchDashboard();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setSavingBank(false);
    }
  };

  const fin = viewMode === 'month'
    ? { income: data?.financials.month_income || 0, expenses: data?.financials.month_expenses || 0, commission: data?.financials.month_commission || 0, net: data?.financials.month_net || 0 }
    : { income: data?.financials.total_income || 0, expenses: data?.financials.total_expenses || 0, commission: data?.financials.total_commission || 0, net: data?.financials.total_net || 0 };

  if (loading) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={C.brandRed} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.rootBg}>
        {/* Background Glows */}
        <View style={styles.bgGlow1} />
        <View style={styles.bgGlow2} />

        <ScrollView
          style={[styles.container, { paddingTop: insets.top }]}
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.brandRed} />}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={22} color={C.textPrimary} />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>{t('owner_dashboard.title')}</Text>
              <Text style={styles.headerSub}>
                {data?.properties_count || 0} {t('owner_dashboard.properties_managed')}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.bankingBtn}
              onPress={() => setShowBanking(!showBanking)}
            >
              <Ionicons
                name={bankingData?.has_banking ? 'checkmark-circle' : 'alert-circle'}
                size={18}
                color={bankingData?.has_banking ? C.success : C.warning}
              />
              <Text style={styles.bankingBtnText}>{t('owner_dashboard.bank_info')}</Text>
            </TouchableOpacity>
          </View>

          {/* Banking Setup Alert */}
          {!bankingData?.has_banking && !showBanking && (
            <TouchableOpacity style={styles.bankAlert} onPress={() => setShowBanking(true)}>
              <Ionicons name="warning" size={18} color={C.warmGold} />
              <Text style={styles.bankAlertText}>{t('owner_dashboard.setup_banking')}</Text>
              <Ionicons name="chevron-forward" size={16} color={C.warmGold} />
            </TouchableOpacity>
          )}

          {/* Stripe Connect CTA */}
          <TouchableOpacity
            style={styles.stripeConnectBanner}
            onPress={() => router.push('/stripe-connect')}
            activeOpacity={0.7}
          >
            <LinearGradient
              colors={['rgba(99,91,255,0.10)', 'rgba(99,91,255,0.03)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[StyleSheet.absoluteFill, { borderRadius: BorderRadius.card }]}
            />
            <View style={styles.stripeIcon}>
              <Ionicons name="flash" size={20} color="#635BFF" />
            </View>
            <View style={styles.stripeBannerContent}>
              <Text style={styles.stripeBannerTitle}>Stripe Connect</Text>
              <Text style={styles.stripeBannerDesc}>Recibe pagos automáticos de renta</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={C.textMuted} />
          </TouchableOpacity>

          {/* Banking Form */}
          {showBanking && (
            <View style={styles.bankingCard}>
              <View style={styles.bankingHeader}>
                <Ionicons name="card-outline" size={20} color={C.navyBlue} />
                <Text style={styles.bankingTitle}>{t('owner_dashboard.bank_info')}</Text>
                <TouchableOpacity onPress={() => setShowBanking(false)} style={{ marginLeft: 'auto' }}>
                  <Ionicons name="close" size={20} color={C.textMuted} />
                </TouchableOpacity>
              </View>

              {bankingData?.has_banking && (
                <View style={styles.currentBank}>
                  <Text style={styles.currentBankLabel}>Actual:</Text>
                  <Text style={styles.currentBankVal}>Ruta: {bankingData.routing_masked} • Cuenta: {bankingData.account_masked}</Text>
                </View>
              )}

              <TextInput style={styles.bankInput} placeholder={t('owner_dashboard.bank_name')} placeholderTextColor={C.textMuted} value={bankForm.bank_name} onChangeText={(v) => setBankForm({...bankForm, bank_name: v})} />
              <TextInput style={styles.bankInput} placeholder={t('owner_dashboard.account_holder')} placeholderTextColor={C.textMuted} value={bankForm.account_holder} onChangeText={(v) => setBankForm({...bankForm, account_holder: v})} />
              <TextInput style={styles.bankInput} placeholder={t('owner_dashboard.routing_number')} placeholderTextColor={C.textMuted} value={bankForm.routing_number} onChangeText={(v) => setBankForm({...bankForm, routing_number: v})} keyboardType="number-pad" />
              <TextInput style={styles.bankInput} placeholder={t('owner_dashboard.account_number')} placeholderTextColor={C.textMuted} value={bankForm.account_number} onChangeText={(v) => setBankForm({...bankForm, account_number: v})} keyboardType="number-pad" />

              <View style={styles.accountTypeRow}>
                {['checking', 'savings'].map((at) => (
                  <TouchableOpacity
                    key={at}
                    style={[styles.accountTypeBtn, bankForm.account_type === at && styles.accountTypeBtnActive]}
                    onPress={() => setBankForm({...bankForm, account_type: at})}
                  >
                    <Text style={[styles.accountTypeText, bankForm.account_type === at && styles.accountTypeTextActive]}>
                      {t(`owner_dashboard.${at}`)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity style={styles.saveBankBtn} onPress={saveBanking} disabled={savingBank}>
                <LinearGradient
                  colors={['#C8102E', '#9B1B30']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[StyleSheet.absoluteFill, { borderRadius: BorderRadius.sm }]}
                />
                <Text style={styles.saveBankText}>{savingBank ? t('owner_dashboard.saving') : t('owner_dashboard.save_banking')}</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Period Toggle */}
          <View style={styles.periodRow}>
            {(['month', 'all'] as const).map((m) => (
              <TouchableOpacity
                key={m}
                style={[styles.periodBtn, viewMode === m && styles.periodBtnActive]}
                onPress={() => setViewMode(m)}
              >
                <Text style={[styles.periodText, viewMode === m && styles.periodTextActive]}>
                  {m === 'month' ? t('owner_dashboard.this_month') : t('owner_dashboard.all_time')}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ═══ Gauge Charts — 2 Columns ═══ */}
          <View style={styles.gaugeRow}>
            <View style={styles.gaugeCol}>
              <GaugeChart
                value={fin.income}
                maxValue={Math.max(fin.income, fin.income + fin.commission) || 1}
                label={t('owner_dashboard.income')}
                icon="trending-up"
                iconColor={C.success}
                gradientStart="#059669"
                gradientEnd="#10B981"
                formatValue={(v) => formatCurrency(v)}
                formatMax={(v) => formatCurrency(v)}
                size={150}
              />
            </View>
            <View style={styles.gaugeCol}>
              <GaugeChart
                value={Math.max(fin.net - fin.expenses, 0)}
                maxValue={Math.max(fin.income, 1)}
                label={t('owner_dashboard.net_profit')}
                icon="wallet"
                iconColor={C.brandRed}
                gradientStart="#C8102E"
                gradientEnd="#E11D48"
                formatValue={(v) => formatCurrency(v)}
                formatMax={(v) => formatCurrency(v)}
                size={150}
              />
            </View>
          </View>

          {/* Mini Stats Row */}
          <View style={styles.miniRow}>
            <MiniStatCard
              icon="trending-down"
              iconColor="#ef4444"
              value={formatCurrency(fin.expenses)}
              label={t('owner_dashboard.expenses')}
            />
            <MiniStatCard
              icon="remove-circle-outline"
              iconColor="#818cf8"
              value={formatCurrency(fin.commission)}
              label={t('owner_dashboard.commission')}
            />
          </View>
          <View style={{ height: 6 }} />
          <View style={styles.miniRow}>
            <MiniStatCard
              icon="time-outline"
              iconColor={C.warmGold}
              value={formatCurrency(data?.financials.pending_payout || 0)}
              label={t('owner_dashboard.pending_payout')}
            />
            <MiniStatCard
              icon="cash-outline"
              iconColor={C.success}
              value={formatCurrency(data?.financials.total_paid_out || 0)}
              label={t('owner_dashboard.total_paid_out')}
            />
          </View>

          {/* Maintenance Alerts */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="warning" size={18} color={C.warning} />
              <Text style={styles.sectionTitle}>{t('owner_dashboard.maintenance_alerts')}</Text>
              {(data?.maintenance_alerts?.length || 0) > 0 && (
                <View style={styles.alertBadge}>
                  <Text style={styles.alertBadgeText}>{data?.maintenance_alerts?.length}</Text>
                </View>
              )}
            </View>

            {(!data?.maintenance_alerts || data.maintenance_alerts.length === 0) ? (
              <View style={styles.emptySection}>
                <Ionicons name="checkmark-circle" size={32} color={C.success} />
                <Text style={styles.emptyText}>{t('owner_dashboard.no_alerts')}</Text>
              </View>
            ) : (
              data.maintenance_alerts.map((alert, i) => (
                <View key={alert._id || i} style={styles.alertCard}>
                  <View style={[styles.alertPriority, { backgroundColor: PRIORITY_COLORS[alert.priority] || PRIORITY_COLORS.medium }]} />
                  <View style={styles.alertContent}>
                    <Text style={styles.alertTitle}>{alert.title}</Text>
                    <Text style={styles.alertProperty} numberOfLines={1}>{alert.property_address}</Text>
                    {alert.tenant_name && (
                      <Text style={styles.alertTenant}>
                        <Ionicons name="person-outline" size={11} color={C.textMuted} /> {alert.tenant_name}
                      </Text>
                    )}
                  </View>
                  <View style={[styles.alertStatus, { backgroundColor: alert.status === 'new' ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)' }]}>
                    <Text style={[styles.alertStatusText, { color: alert.status === 'new' ? '#ef4444' : '#f59e0b' }]}>
                      {alert.status === 'new' ? t('owner_dashboard.new_issue') : t('owner_dashboard.in_progress')}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>

          {/* Recent Transactions */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="swap-vertical" size={18} color={C.navyBlue} />
              <Text style={styles.sectionTitle}>{t('owner_dashboard.recent_transactions')}</Text>
            </View>

            {(!data?.recent_transactions || data.recent_transactions.length === 0) ? (
              <View style={styles.emptySection}>
                <Ionicons name="receipt-outline" size={32} color={C.textMuted} />
                <Text style={styles.emptyText}>{t('owner_dashboard.no_transactions')}</Text>
              </View>
            ) : (
              data.recent_transactions.map((tx, i) => (
                <View key={i} style={styles.txRow}>
                  <View style={[styles.txIcon, { backgroundColor: tx.type === 'income' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)' }]}>
                    <Ionicons
                      name={tx.type === 'income' ? 'arrow-down' : 'arrow-up'}
                      size={14}
                      color={tx.type === 'income' ? C.success : '#ef4444'}
                    />
                  </View>
                  <View style={styles.txInfo}>
                    <Text style={styles.txDesc} numberOfLines={1}>{tx.description}</Text>
                    <Text style={styles.txDate}>{new Date(tx.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</Text>
                  </View>
                  <Text style={[styles.txAmount, { color: tx.type === 'income' ? C.success : '#ef4444' }]}>
                    {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                  </Text>
                </View>
              ))
            )}
          </View>

          {/* Quick Actions */}
          <View style={styles.actionsRow}>
            <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/my-listings')}>
              <LinearGradient
                colors={['rgba(255,255,255,0.04)', 'rgba(255,255,255,0.01)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <Ionicons name="business" size={20} color={C.navyBlue} />
              <Text style={styles.actionText}>{t('landlord.my_listings')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/add-property')}>
              <LinearGradient
                colors={['rgba(200,16,46,0.08)', 'rgba(200,16,46,0.02)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <Ionicons name="add-circle" size={20} color={C.brandRed} />
              <Text style={styles.actionText}>{t('landlord.add_listing')}</Text>
            </TouchableOpacity>
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const createStyles = (C: any) => StyleSheet.create({
  flex: { flex: 1 },
  rootBg: { flex: 1, backgroundColor: C.background },
  container: { flex: 1 },
  content: { paddingHorizontal: Spacing.base },
  center: { justifyContent: 'center', alignItems: 'center' },

  // Background glows
  bgGlow1: {
    position: 'absolute', top: -60, right: -40, width: 200, height: 200,
    borderRadius: 100, backgroundColor: C.success, opacity: 0.04,
  },
  bgGlow2: {
    position: 'absolute', bottom: '25%', left: -50, width: 160, height: 160,
    borderRadius: 80, backgroundColor: C.brandRed, opacity: 0.03,
  },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: Spacing.md,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: C.glass,
    borderWidth: 1, borderColor: C.glassBorder,
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: FontSizes['2xl'], fontWeight: '800', color: C.textPrimary, letterSpacing: -0.5 },
  headerSub: { fontSize: FontSizes.sm, color: C.textMuted, marginTop: 2 },

  miniRow: { flexDirection: 'row', gap: 10, marginBottom: 6 },
  gaugeRow: { flexDirection: 'row', gap: 10, marginBottom: 6 },
  gaugeCol: { flex: 1 },
  bankingBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: BorderRadius.full, backgroundColor: C.surface,
    borderWidth: 1, borderColor: C.border,
  },
  bankingBtnText: { fontSize: FontSizes.xs, color: C.textSecondary, fontWeight: '600' },
  bankAlert: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(245,158,11,0.08)', borderRadius: BorderRadius.card,
    padding: 14, marginBottom: Spacing.md, borderWidth: 1, borderColor: 'rgba(245,158,11,0.15)',
  },
  bankAlertText: { flex: 1, fontSize: FontSizes.xs, color: C.warmGold, fontWeight: '500' },
  bankingCard: {
    backgroundColor: C.surface, borderRadius: BorderRadius.card,
    padding: Spacing.base, marginBottom: Spacing.lg,
    borderWidth: 1, borderColor: C.border,
  },
  bankingHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  bankingTitle: { fontSize: FontSizes.md, fontWeight: '700', color: C.textPrimary },
  currentBank: {
    backgroundColor: 'rgba(34,197,94,0.08)', borderRadius: 8,
    padding: 10, marginBottom: 12,
  },
  currentBankLabel: { fontSize: 10, color: C.success, fontWeight: '700', marginBottom: 2 },
  currentBankVal: { fontSize: FontSizes.xs, color: C.textSecondary },
  bankInput: {
    backgroundColor: C.surfaceLight, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: FontSizes.sm, color: C.white,
    marginBottom: 10, borderWidth: 1, borderColor: C.border,
  },
  accountTypeRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  accountTypeBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 10,
    backgroundColor: C.surfaceLight, alignItems: 'center',
    borderWidth: 1, borderColor: C.border,
  },
  accountTypeBtnActive: { borderColor: C.navyBlue, backgroundColor: 'rgba(30,58,138,0.12)' },
  accountTypeText: { fontSize: FontSizes.sm, color: C.textMuted, fontWeight: '600' },
  accountTypeTextActive: { color: C.navyBlue },
  saveBankBtn: {
    borderRadius: BorderRadius.sm,
    paddingVertical: 14, alignItems: 'center',
    overflow: 'hidden', position: 'relative',
  },
  saveBankText: { color: C.white, fontSize: FontSizes.sm, fontWeight: '700' },
  periodRow: {
    flexDirection: 'row', backgroundColor: C.surface,
    borderRadius: BorderRadius.card, padding: 3, marginBottom: Spacing.md,
    borderWidth: 1, borderColor: C.border,
  },
  periodBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  periodBtnActive: { backgroundColor: C.charcoal },
  periodText: { fontSize: FontSizes.sm, color: C.textMuted, fontWeight: '600' },
  periodTextActive: { color: C.white },
  finGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: Spacing.md },
  finCardWide: { flexBasis: '100%' },
  finCard: {
    flex: 1, minWidth: '45%', backgroundColor: C.surface,
    borderRadius: BorderRadius.card, padding: 14,
    borderWidth: 1, borderColor: C.border,
  },
  finRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  finIconWrap: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  finLabel: { fontSize: FontSizes.xs, color: C.textMuted, fontWeight: '500' },
  finValue: { fontSize: FontSizes['2xl'], fontWeight: '800' },
  finLabelSm: { fontSize: 11, color: C.textMuted, fontWeight: '500', marginTop: 8 },
  finValueSm: { fontSize: FontSizes.lg, fontWeight: '700', marginTop: 2 },
  netCard: {
    backgroundColor: C.surface, borderRadius: BorderRadius.card,
    padding: Spacing.base, marginBottom: Spacing.lg,
    borderWidth: 1, borderColor: C.border,
  },
  netRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  netLabel: { fontSize: FontSizes.xs, color: C.textMuted, fontWeight: '500', marginBottom: 4 },
  netValue: { fontSize: FontSizes.xl, fontWeight: '800', color: C.white },
  netDivider: { width: 1, height: 40, backgroundColor: C.border },
  section: { marginBottom: Spacing.lg },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionTitle: { fontSize: FontSizes.md, fontWeight: '700', color: C.textPrimary },
  alertBadge: {
    backgroundColor: C.brandRed, borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 2, marginLeft: 'auto',
  },
  alertBadgeText: { color: C.white, fontSize: 11, fontWeight: '700' },
  emptySection: {
    alignItems: 'center', paddingVertical: 24,
    backgroundColor: C.surface, borderRadius: BorderRadius.card,
    borderWidth: 1, borderColor: C.border,
  },
  emptyText: { fontSize: FontSizes.sm, color: C.textMuted, marginTop: 8 },
  alertCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.surface, borderRadius: BorderRadius.card,
    padding: 12, marginBottom: 8, borderWidth: 1, borderColor: C.border,
    overflow: 'hidden',
  },
  alertPriority: { width: 4, height: '100%', borderRadius: 2, position: 'absolute', left: 0 },
  alertContent: { flex: 1, paddingLeft: 8 },
  alertTitle: { fontSize: FontSizes.sm, fontWeight: '600', color: C.textPrimary },
  alertProperty: { fontSize: 11, color: C.textMuted, marginTop: 2 },
  alertTenant: { fontSize: 11, color: C.textSecondary, marginTop: 2 },
  alertStatus: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: BorderRadius.full },
  alertStatusText: { fontSize: 10, fontWeight: '700' },
  txRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: C.surface, borderRadius: BorderRadius.card,
    padding: 12, marginBottom: 6, borderWidth: 1, borderColor: C.border,
  },
  txIcon: { width: 32, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  txInfo: { flex: 1 },
  txDesc: { fontSize: FontSizes.sm, color: C.textPrimary, fontWeight: '500' },
  txDate: { fontSize: 11, color: C.textMuted, marginTop: 2 },
  txAmount: { fontSize: FontSizes.md, fontWeight: '700' },
  actionsRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, borderRadius: BorderRadius.card,
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
  },
  actionText: { fontSize: FontSizes.sm, color: C.textPrimary, fontWeight: '600' },
  stripeConnectBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: Spacing.base,
    padding: 14,
    backgroundColor: C.surface,
    borderRadius: BorderRadius.card,
    borderWidth: 1,
    borderColor: 'rgba(99,91,255,0.3)',
  },
  stripeIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(99,91,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stripeBannerContent: { flex: 1 },
  stripeBannerTitle: { fontSize: FontSizes.sm, fontWeight: '700', color: C.textPrimary },
  stripeBannerDesc: { fontSize: FontSizes.xs, color: C.textMuted, marginTop: 2 },
});
