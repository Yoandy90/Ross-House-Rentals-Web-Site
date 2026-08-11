/**
 * Mis Servicios — Premium dashboard-style screen
 * Only Xcel Energy integration (no manual scanning).
 * Matches the visual pattern used in the home dashboard (glass-dark + accent colors).
 */
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
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../src/contexts/AuthContext';
import { apiCall } from '../src/utils/api';
import { ModernBarChart, ModernDonut, DonutLegend, ChartPalette } from '../src/components/PremiumCharts';
import { useStripeSheet } from '../src/components/useStripeSheet';
import { Spacing, FontSizes, BorderRadius, Shadows, useColors } from '../src/constants/theme';

// ─── Accent palette: Xcel uses amber/gold tones to match the dashboard icon
// (and to keep the screen visually consistent with the rest of the app)
const ACCENT = '#F59E0B';
const ACCENT_SOFT = 'rgba(245,158,11,0.15)';
const ACCENT_BORDER = 'rgba(245,158,11,0.30)';

// Map backend provider types to Ionicon names and colors
const TYPE_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
  electricity: { icon: 'flash', color: ACCENT, label: 'Electricidad' },
  gas: { icon: 'flame', color: '#EF4444', label: 'Gas' },
  water: { icon: 'water', color: '#3B82F6', label: 'Agua' },
  internet: { icon: 'wifi', color: '#8B5CF6', label: 'Internet' },
  phone: { icon: 'call', color: '#06B6D4', label: 'Teléfono' },
  tv: { icon: 'tv', color: '#6366F1', label: 'TV' },
  other: { icon: 'document-text', color: '#6B7280', label: 'Otro' },
};

interface XcelUsage {
  connected: boolean;
  status: string;
  has_data: boolean;
  is_demo?: boolean;
  demo_message?: string;
  last_sync: string | null;
  property_address: string | null;
  monthly: { month: string; kwh: number }[];
  daily_current_month: { date: string; kwh: number }[];
  timeseries?: {
    daily_30d: { date: string; kwh: number; weekday: number }[];
    weekly_12w: { week_start: string; week_end: string; label: string; kwh: number }[];
    monthly_12m: { month: string; kwh: number; label: string }[];
  };
  current_month: string;
  current_month_kwh: number;
  prev_month_kwh: number;
  delta_pct: number | null;
  estimated_rate_per_kwh: number;
  estimated_current_cost: number;
  billing_summaries: { period_start: string; period_days: number | null; total_kwh: number | null; cost: number | null }[];
}

interface SavingTip {
  title: string;
  detail: string;
  saving: string;
  icon: string;
}

interface SavingTipsResponse {
  tips: SavingTip[];
  generated_at: string;
  cached: boolean;
  is_demo: boolean;
}

export default function ServicesScreen() {
  const C = useColors();
  const styles = React.useMemo(() => createStyles(C), [C]);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [bills, setBills] = useState<any[]>([]);
  const [billingMode, setBillingMode] = useState<string>('landlord');
  const [providerUrl, setProviderUrl] = useState<string | null>(null);
  const [xcelUsage, setXcelUsage] = useState<XcelUsage | null>(null);
  const [chartTab, setChartTab] = useState<'day' | 'week' | 'month'>('month');
  const [savingTips, setSavingTips] = useState<SavingTipsResponse | null>(null);
  const [tipsLoading, setTipsLoading] = useState(false);
  const [payingBill, setPayingBill] = useState<string | null>(null);
  const { available: stripeAvailable, initPaymentSheet, presentPaymentSheet } = useStripeSheet();

  const fetchData = useCallback(async () => {
    try {
      const [billsRes, xcelUsageRes] = await Promise.all([
        apiCall('/tenant/utility-bills').catch(() => null),
        apiCall('/tenant/xcel/usage').catch(() => null),
      ]);
      if (billsRes) {
        setBills(billsRes.bills || []);
        setBillingMode(billsRes.billing_mode || 'landlord');
        setProviderUrl(billsRes.provider_payment_url || null);
      }
      if (xcelUsageRes) setXcelUsage(xcelUsageRes);
    } catch (err) {
      console.log('Services fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const fetchSavingTips = useCallback(async (forceRefresh = false) => {
    setTipsLoading(true);
    try {
      const path = forceRefresh ? '/tenant/xcel/saving-tips?refresh=true' : '/tenant/xcel/saving-tips';
      const res = await apiCall(path);
      if (res && res.tips) setSavingTips(res);
    } catch (err) {
      console.log('Tips fetch error:', err);
    } finally {
      setTipsLoading(false);
    }
  }, []);

  const connectXcel = async () => {
    try {
      const result = await apiCall('/tenant/xcel/connect-url');
      if (!result.authorization_url) {
        throw new Error(result.detail || 'No se pudo generar el enlace de Xcel');
      }
      await Linking.openURL(result.authorization_url);
    } catch (err: any) {
      Alert.alert('Xcel Energy', err.message || 'No se pudo abrir la autorización');
    }
  };

  const payBill = async (bill: any) => {
    setPayingBill(bill.id);
    try {
      const result = await apiCall(`/tenant/utility-bills/${bill.id}/create-payment`, { method: 'POST' });
      if (!result.success || !result.client_secret) {
        throw new Error(result.detail || 'No se pudo iniciar el pago');
      }
      if (!stripeAvailable) {
        Alert.alert('Pago con tarjeta', 'El pago con tarjeta está disponible en la app móvil (iOS/Android).');
        return;
      }
      const init = await initPaymentSheet({
        paymentIntentClientSecret: result.client_secret,
        merchantDisplayName: 'Ross House Rentals LLC',
        defaultBillingDetails: { name: user?.name || '' },
      });
      if (init.error) throw new Error(init.error.message);
      const present = await presentPaymentSheet();
      if (present.error) {
        if (present.error.code !== 'Canceled') throw new Error(present.error.message);
        return;
      }
      const confirm = await apiCall(`/tenant/utility-bills/${bill.id}/confirm-payment`, {
        method: 'POST',
        body: { payment_intent_id: result.payment_intent_id },
      });
      if (confirm.success) {
        Alert.alert('✅ Pago exitoso', `Tu factura de ${TYPE_CONFIG[bill.type]?.label || bill.type} (${bill.period}) quedó pagada.`);
        fetchData();
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'No se pudo completar el pago');
    } finally {
      setPayingBill(null);
    }
  };

  useEffect(() => { fetchData(); }, []);
  useEffect(() => {
    if (xcelUsage) fetchSavingTips();
  }, [xcelUsage?.is_demo, xcelUsage?.has_data]);

  const onRefresh = () => { setRefreshing(true); fetchData(); };

  const xcelHasRealData = !!(xcelUsage && xcelUsage.has_data);
  const pendingBills = bills.filter((b) => b.status === 'pending');

  const formatPeriod = (period: string) => {
    if (!period) return '';
    const [y, m] = period.split('-');
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return `${months[parseInt(m, 10) - 1]} ${y}`;
  };

  if (loading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={ACCENT} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {/* Subtle background glows */}
      <View style={styles.bgGlow1} />
      <View style={styles.bgGlow2} />

      <ScrollView
        style={[styles.container, { paddingTop: insets.top }]}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ACCENT} />}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── Header (matches dashboard) ─── */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={22} color={C.textPrimary} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Mis Servicios</Text>
            <Text style={styles.headerSub}>Consumo eléctrico y facturas</Text>
          </View>
        </View>

        {/* ─── XCEL ENERGY: Connected with data ─── */}
        {xcelHasRealData && xcelUsage && (
          <View style={styles.glassCard} testID="xcel-usage-card">
            <View style={[styles.cardAccentBar, { backgroundColor: ACCENT }]} />
            <View style={[styles.cardOrb, { backgroundColor: ACCENT }]} />

            <View style={styles.glassCardContent}>
              {/* Header row */}
              <View style={styles.cardHeaderRow}>
                <View style={[styles.cardHeaderIcon, { backgroundColor: ACCENT_SOFT }]}>
                  <Ionicons name="flash" size={20} color={ACCENT} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>Mi consumo eléctrico</Text>
                  <Text style={styles.cardSub}>
                    Green Button · Xcel Energy
                    {xcelUsage.last_sync ? `  ·  Act. ${new Date(xcelUsage.last_sync).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}` : ''}
                  </Text>
                </View>
                {xcelUsage.is_demo ? (
                  <View style={[styles.statusBadge, { backgroundColor: 'rgba(245,158,11,0.15)' }]}>
                    <View style={[styles.statusDot, { backgroundColor: ACCENT }]} />
                    <Text style={[styles.statusText, { color: ACCENT }]}>Demo</Text>
                  </View>
                ) : (
                  <View style={[styles.statusBadge, { backgroundColor: 'rgba(16,185,129,0.15)' }]}>
                    <View style={[styles.statusDot, { backgroundColor: C.success }]} />
                    <Text style={[styles.statusText, { color: C.success }]}>Activo</Text>
                  </View>
                )}
              </View>

              {/* Demo banner */}
              {xcelUsage.is_demo && (
                <View style={styles.demoBanner}>
                  <Ionicons name="information-circle" size={14} color={ACCENT} />
                  <Text style={styles.demoBannerText}>
                    Datos de demostración. Conecta tu cuenta para ver datos reales.
                  </Text>
                </View>
              )}

              {/* Connect / Reconnect */}
              {xcelUsage.is_demo && (
                <TouchableOpacity
                  testID="xcel-connect-from-demo"
                  onPress={connectXcel}
                  activeOpacity={0.85}
                  style={styles.connectInline}
                >
                  <LinearGradient
                    colors={['#F59E0B', '#D97706']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                  <Ionicons name="link" size={16} color="#fff" />
                  <Text style={styles.connectInlineText}>Conectar mi cuenta de Xcel Energy</Text>
                  <Ionicons name="arrow-forward" size={16} color="#fff" />
                </TouchableOpacity>
              )}
              {!xcelUsage.is_demo && xcelUsage.connected && (
                <TouchableOpacity
                  testID="xcel-reconnect"
                  onPress={connectXcel}
                  activeOpacity={0.7}
                  style={styles.reconnectInline}
                >
                  <Ionicons name="refresh" size={13} color={C.textMuted} />
                  <Text style={styles.reconnectInlineText}>Reconectar cuenta</Text>
                </TouchableOpacity>
              )}

              {/* Big kWh number + delta */}
              <View style={styles.kwhRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.kwhLabel}>{formatPeriod(xcelUsage.current_month)} · KWH</Text>
                  <Text style={styles.kwhBig}>
                    {Math.round(xcelUsage.current_month_kwh).toLocaleString('en-US')}
                    <Text style={styles.kwhUnit}> kWh</Text>
                  </Text>
                  {xcelUsage.delta_pct !== null && (
                    <View style={styles.deltaRow}>
                      <Ionicons
                        name={xcelUsage.delta_pct >= 0 ? 'trending-up' : 'trending-down'}
                        size={14}
                        color={xcelUsage.delta_pct >= 0 ? C.error : C.success}
                      />
                      <Text
                        style={[
                          styles.deltaText,
                          { color: xcelUsage.delta_pct >= 0 ? C.error : C.success },
                        ]}
                      >
                        {xcelUsage.delta_pct >= 0 ? '+' : ''}
                        {xcelUsage.delta_pct}% vs mes anterior
                      </Text>
                    </View>
                  )}
                </View>
                <View style={styles.costBox}>
                  <Text style={styles.costLabel}>Costo estimado</Text>
                  <Text style={styles.costValue}>
                    ${xcelUsage.estimated_current_cost.toFixed(2)}
                  </Text>
                  <Text style={styles.costRate}>
                    ${xcelUsage.estimated_rate_per_kwh.toFixed(2)}/kWh
                  </Text>
                </View>
              </View>

              {/* Tabbed chart */}
              {xcelUsage.timeseries && (
                <View style={styles.chartWrap}>
                  <View style={styles.tabRow}>
                    {(['day','week','month'] as const).map((t) => {
                      const labels = { day: 'Día', week: 'Semana', month: 'Mes' };
                      const isActive = chartTab === t;
                      return (
                        <TouchableOpacity
                          key={t}
                          onPress={() => setChartTab(t)}
                          style={[styles.tab, isActive && styles.tabActive]}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                            {labels[t]}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <Text style={styles.chartTitle}>
                    {chartTab === 'day' && 'Últimos 30 días'}
                    {chartTab === 'week' && 'Últimas 12 semanas'}
                    {chartTab === 'month' && 'Últimos 12 meses'}
                  </Text>

                  {(() => {
                    const ts = xcelUsage.timeseries!;
                    const todayIso = new Date().toISOString().slice(0, 10);
                    const currentMonth = xcelUsage.current_month;
                    let points: any[] = [];

                    if (chartTab === 'day') {
                      points = ts.daily_30d.map((d) => ({
                        key: d.date,
                        label: d.date.slice(8, 10),
                        value: d.kwh,
                        isCurrent: d.date === todayIso,
                        isWeekend: d.weekday >= 5,
                      }));
                    } else if (chartTab === 'week') {
                      points = ts.weekly_12w.map((w) => ({
                        key: w.week_start,
                        label: w.label,
                        value: w.kwh,
                        isCurrent: false,
                      }));
                    } else {
                      points = ts.monthly_12m.map((m) => ({
                        key: m.month,
                        label: m.label,
                        value: m.kwh,
                        isCurrent: m.month === currentMonth,
                      }));
                    }

                    return (
                      <ModernBarChart
                        data={points}
                        height={chartTab === 'day' ? 110 : 130}
                        showValues={chartTab !== 'day'}
                        variant={chartTab === 'day' ? 'scroll' : 'compact'}
                      />
                    );
                  })()}
                </View>
              )}

              {/* Donut: current vs prev */}
              {!!(xcelUsage.current_month_kwh || xcelUsage.prev_month_kwh) && (
                <View style={styles.donutSection}>
                  <View style={styles.donutSectionLeft}>
                    <ModernDonut
                      size={130}
                      thickness={14}
                      segments={[
                        {
                          label: 'Mes actual',
                          value: xcelUsage.current_month_kwh || 0.01,
                          gradient: ChartPalette.donutCurrent as [string, string],
                        },
                        {
                          label: 'Mes anterior',
                          value: xcelUsage.prev_month_kwh || 0.01,
                          gradient: ChartPalette.donutPrev as [string, string],
                        },
                      ]}
                      centerLabel="Comparación"
                      centerValue={
                        xcelUsage.delta_pct !== null && xcelUsage.delta_pct !== undefined
                          ? `${xcelUsage.delta_pct > 0 ? '+' : ''}${xcelUsage.delta_pct}%`
                          : '—'
                      }
                      centerSub="vs mes anterior"
                    />
                  </View>
                  <View style={styles.donutSectionRight}>
                    <DonutLegend
                      items={[
                        {
                          label: 'Mes actual',
                          value: `${Math.round(xcelUsage.current_month_kwh || 0)} kWh`,
                          color: ChartPalette.donutCurrent[0],
                        },
                        {
                          label: 'Mes anterior',
                          value: `${Math.round(xcelUsage.prev_month_kwh || 0)} kWh`,
                          color: ChartPalette.donutPrev[0],
                        },
                        {
                          label: 'Costo estimado',
                          value: `$${(xcelUsage.estimated_current_cost || 0).toFixed(2)}`,
                          color: C.success,
                        },
                      ]}
                    />
                  </View>
                </View>
              )}

              <Text style={styles.footnote}>
                * Costo estimado a tarifa promedio residencial. La factura oficial puede variar.
              </Text>
            </View>
          </View>
        )}

        {/* ─── AI SAVING TIPS ─── */}
        {xcelHasRealData && xcelUsage && (
          <View style={styles.glassCard}>
            <View style={[styles.cardAccentBar, { backgroundColor: C.violet }]} />
            <View style={[styles.cardOrb, { backgroundColor: C.violet }]} />

            <View style={styles.glassCardContent}>
              <View style={styles.cardHeaderRow}>
                <View style={[styles.cardHeaderIcon, { backgroundColor: C.violetBg }]}>
                  <Ionicons name="sparkles" size={18} color={C.violet} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>Tips de ahorro con IA</Text>
                  <Text style={styles.cardSub}>Personalizados a tu consumo · GPT-4o</Text>
                </View>
                <TouchableOpacity
                  onPress={() => fetchSavingTips(true)}
                  disabled={tipsLoading}
                  style={styles.refreshBtn}
                  activeOpacity={0.7}
                >
                  {tipsLoading ? (
                    <ActivityIndicator size="small" color={C.violet} />
                  ) : (
                    <Ionicons name="refresh" size={16} color={C.violet} />
                  )}
                </TouchableOpacity>
              </View>

              {tipsLoading && !savingTips ? (
                <View style={styles.tipsLoadingState}>
                  <ActivityIndicator size="small" color={C.violet} />
                  <Text style={styles.tipsLoadingText}>Generando consejos…</Text>
                </View>
              ) : savingTips && savingTips.tips.length > 0 ? (
                <View style={{ gap: 8, marginTop: 6 }}>
                  {savingTips.tips.map((tip, idx) => {
                    const iconMap: Record<string, string> = {
                      bulb: 'bulb', snow: 'snow', water: 'water', tv: 'tv',
                      home: 'home', leaf: 'leaf',
                    };
                    const iconName = iconMap[tip.icon] || 'bulb';
                    return (
                      <View key={idx} style={styles.tipItem}>
                        <View style={styles.tipItemIcon}>
                          <Ionicons name={iconName as any} size={16} color={C.violet} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.tipItemTitle}>{tip.title}</Text>
                          <Text style={styles.tipItemDetail}>{tip.detail}</Text>
                        </View>
                        <View style={styles.tipItemSaving}>
                          <Text style={styles.tipItemSavingText}>{tip.saving}</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <TouchableOpacity
                  onPress={() => fetchSavingTips(true)}
                  activeOpacity={0.85}
                  style={styles.tipsGenerateBtn}
                  testID="generate-tips-btn"
                >
                  <Ionicons name="sparkles" size={16} color="#fff" />
                  <Text style={styles.tipsGenerateBtnText}>Generar consejos personalizados</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* ─── XCEL EMPTY STATE: not connected / no data ─── */}
        {!xcelHasRealData && (
          <TouchableOpacity
            testID="xcel-empty-card"
            style={styles.glassCard}
            onPress={connectXcel}
            activeOpacity={0.9}
          >
            <View style={[styles.cardAccentBar, { backgroundColor: ACCENT }]} />
            <View style={[styles.cardOrb, { backgroundColor: ACCENT }]} />

            <View style={[styles.glassCardContent, { alignItems: 'center', paddingVertical: Spacing.xl }]}>
              <View style={styles.emptyIconWrap}>
                <View style={[styles.emptyIcon, { backgroundColor: ACCENT_SOFT }]}>
                  <Ionicons name="flash" size={32} color={ACCENT} />
                </View>
                <View style={[styles.emptyPulse, { backgroundColor: 'rgba(245,158,11,0.08)' }]} />
              </View>

              <Text style={styles.emptyTitle}>Conecta tu cuenta de Xcel Energy</Text>
              <Text style={styles.emptyDesc}>
                Sincroniza tu consumo eléctrico en tiempo real para ver tus kWh,
                comparar meses y estimar tu factura — directamente desde Xcel.
              </Text>

              <View style={styles.emptyBenefits}>
                <View style={styles.emptyBenefit}>
                  <Ionicons name="bar-chart" size={14} color={ACCENT} />
                  <Text style={styles.emptyBenefitText}>kWh mensuales</Text>
                </View>
                <View style={styles.emptyBenefit}>
                  <Ionicons name="trending-up" size={14} color={ACCENT} />
                  <Text style={styles.emptyBenefitText}>Tendencia</Text>
                </View>
                <View style={styles.emptyBenefit}>
                  <Ionicons name="cash" size={14} color={ACCENT} />
                  <Text style={styles.emptyBenefitText}>Costo estimado</Text>
                </View>
              </View>

              <View style={styles.emptyCta}>
                <LinearGradient
                  colors={['#F59E0B', '#D97706']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                <Ionicons name="link" size={16} color="#fff" />
                <Text style={styles.emptyCtaText}>Conectar Xcel Energy</Text>
                <Ionicons name="chevron-forward" size={16} color="#fff" />
              </View>

              <Text style={styles.emptyFootnote}>
                🔒 Autorización segura vía OAuth · Solo electricidad (Green Button)
              </Text>
            </View>
          </TouchableOpacity>
        )}

        {/* ─── HISTORIAL DE FACTURAS ─── */}
        <TouchableOpacity
          testID="invoices-history-btn"
          style={styles.actionRow}
          onPress={() => router.push('/invoices')}
          activeOpacity={0.85}
        >
          <View style={[styles.actionIcon, { backgroundColor: C.emeraldBg }]}>
            <Ionicons name="document-text" size={18} color={C.emerald} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.actionTitle}>Historial de facturas</Text>
            <Text style={styles.actionSub}>Renta + servicios · Descarga PDFs</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={C.textMuted} />
        </TouchableOpacity>

        {/* ─── FACTURAS POR PAGAR (Ross House Rentals) ─── */}
        {pendingBills.length > 0 && (
          <View style={styles.section} testID="pending-bills-section">
            <Text style={styles.sectionHeader}>Facturas por pagar</Text>
            <Text style={styles.sectionSub}>Servicios facturados por Ross House Rentals</Text>
            {pendingBills.map((bill) => {
              const cfg = TYPE_CONFIG[bill.type] || TYPE_CONFIG.other;
              return (
                <View key={bill.id} style={styles.billCard} testID={`bill-card-${bill.id}`}>
                  <View style={[styles.billIcon, { backgroundColor: `${cfg.color}20` }]}>
                    <Ionicons name={cfg.icon as any} size={20} color={cfg.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.billType}>{cfg.label} · {bill.period}</Text>
                    {bill.kwh ? (
                      <Text style={styles.billDetail}>{bill.kwh} kWh × ${bill.rate_per_kwh}/kWh</Text>
                    ) : bill.notes ? (
                      <Text style={styles.billDetail} numberOfLines={1}>{bill.notes}</Text>
                    ) : null}
                    {bill.add_to_rent && (
                      <Text style={styles.billRentBadge}>Se suma a tu renta mensual</Text>
                    )}
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.billAmount}>${bill.amount?.toFixed(2)}</Text>
                    {!bill.add_to_rent && (
                      <TouchableOpacity
                        testID={`pay-bill-${bill.id}`}
                        style={styles.billPayBtn}
                        onPress={() => payBill(bill)}
                        disabled={payingBill === bill.id}
                      >
                        {payingBill === bill.id ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <Text style={styles.billPayText}>Pagar</Text>
                        )}
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Pago directo al proveedor */}
        {(billingMode === 'provider' || billingMode === 'mixed') && providerUrl && (
          <TouchableOpacity
            testID="pay-provider-btn"
            style={styles.providerBtn}
            onPress={() => Linking.openURL(providerUrl)}
            activeOpacity={0.85}
          >
            <Ionicons name="open-outline" size={18} color={ACCENT} />
            <Text style={styles.providerBtnText}>Pagar mi luz directo en el portal de Xcel</Text>
            <Ionicons name="chevron-forward" size={16} color={ACCENT} />
          </TouchableOpacity>
        )}

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════
const createStyles = (C: any) => StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },
  container: { flex: 1 },
  content: { paddingHorizontal: Spacing.base, paddingBottom: Spacing['2xl'] },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.background },

  bgGlow1: {
    position: 'absolute', top: -60, right: -40,
    width: 200, height: 200, borderRadius: 100,
    backgroundColor: ACCENT, opacity: 0.04,
  },
  bgGlow2: {
    position: 'absolute', bottom: '30%', left: -60,
    width: 160, height: 160, borderRadius: 80,
    backgroundColor: C.violet, opacity: 0.03,
  },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    paddingVertical: Spacing.base,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: C.glass,
    borderWidth: 1, borderColor: C.glassBorder,
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: FontSizes.xl, fontWeight: '800', color: C.textPrimary, letterSpacing: -0.5 },
  headerSub: { fontSize: FontSizes.xs, color: C.textMuted, marginTop: 2 },

  // Glass card (matches dashboard pattern)
  glassCard: {
    position: 'relative',
    backgroundColor: C.glass,
    borderRadius: BorderRadius.card,
    borderWidth: 1,
    borderColor: C.glassBorder,
    overflow: 'hidden',
    marginBottom: Spacing.base,
    ...Shadows.subtle,
  },
  glassCardContent: { padding: Spacing.base, position: 'relative', zIndex: 1 },
  cardAccentBar: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 2,
    borderTopLeftRadius: BorderRadius.card, borderTopRightRadius: BorderRadius.card,
  },
  cardOrb: {
    position: 'absolute', top: -30, right: -30,
    width: 110, height: 110, borderRadius: 55,
    opacity: 0.06,
  },

  // Card header
  cardHeaderRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  cardHeaderIcon: {
    width: 38, height: 38, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
  },
  cardTitle: {
    fontSize: FontSizes.md, fontWeight: '800', color: C.textPrimary,
    letterSpacing: -0.3,
  },
  cardSub: { fontSize: 11, color: C.textMuted, marginTop: 2 },

  // Status badge
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 9, paddingVertical: 4,
    borderRadius: 12,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.4 },

  // Demo banner
  demoBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(245,158,11,0.08)',
    borderColor: ACCENT_BORDER, borderWidth: 1,
    borderRadius: BorderRadius.sm,
    paddingVertical: 8, paddingHorizontal: 10,
    marginBottom: 10,
  },
  demoBannerText: {
    flex: 1, fontSize: 11, color: C.textSecondary, lineHeight: 15,
  },

  // Connect inline button
  connectInline: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, marginBottom: Spacing.md,
    paddingVertical: 11, borderRadius: BorderRadius.md,
    overflow: 'hidden',
  },
  connectInlineText: {
    color: C.textPrimary, fontWeight: '700', fontSize: FontSizes.sm,
    letterSpacing: 0.2,
  },
  reconnectInline: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, marginBottom: Spacing.md, paddingVertical: 6,
  },
  reconnectInlineText: {
    fontSize: 11, color: C.textMuted, fontWeight: '600',
  },

  // kWh row
  kwhRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.md,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: C.glassBorder,
  },
  kwhLabel: {
    fontSize: 10, color: C.textMuted, fontWeight: '700',
    letterSpacing: 1.1, textTransform: 'uppercase',
  },
  kwhBig: {
    fontSize: 38, fontWeight: '900', color: C.textPrimary,
    letterSpacing: -1.5, marginTop: 2,
  },
  kwhUnit: { fontSize: 14, fontWeight: '700', color: C.textMuted, letterSpacing: 0 },
  deltaRow: {
    flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4,
    flexWrap: 'wrap',
  },
  deltaText: { fontSize: 11, fontWeight: '700' },

  costBox: {
    alignItems: 'flex-end', paddingLeft: Spacing.md,
    borderLeftWidth: 1, borderLeftColor: C.glassBorder,
  },
  costLabel: {
    fontSize: 9, color: C.textMuted, fontWeight: '700',
    letterSpacing: 0.8, textTransform: 'uppercase',
  },
  costValue: {
    fontSize: 22, fontWeight: '800', color: C.textPrimary,
    letterSpacing: -0.5, marginTop: 2,
  },
  costRate: { fontSize: 10, color: C.textDim, marginTop: 2, fontWeight: '600' },

  // Chart
  chartWrap: { marginTop: Spacing.md },
  tabRow: {
    flexDirection: 'row', gap: 4, marginBottom: 10,
    backgroundColor: C.glass, padding: 3, borderRadius: 10,
  },
  tab: { flex: 1, paddingVertical: 6, alignItems: 'center', borderRadius: 8 },
  tabActive: { backgroundColor: C.surfaceElevated },
  tabText: { fontSize: 11, fontWeight: '700', color: C.textMuted },
  tabTextActive: { color: C.textPrimary },
  chartTitle: {
    fontSize: 11, color: C.textMuted, fontWeight: '700',
    letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10,
  },

  // Donut
  donutSection: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginTop: Spacing.md,
  },
  donutSectionLeft: { alignItems: 'center' },
  donutSectionRight: { flex: 1 },

  footnote: {
    fontSize: 10, color: C.textDim, marginTop: Spacing.md,
    fontStyle: 'italic',
  },

  // Tips
  refreshBtn: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: C.violetBg,
    justifyContent: 'center', alignItems: 'center',
  },
  tipsLoadingState: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 16,
  },
  tipsLoadingText: { fontSize: 12, color: C.textMuted },
  tipItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: C.glass, borderRadius: BorderRadius.md,
    padding: 10,
    borderWidth: 1, borderColor: C.glassBorder,
  },
  tipItemIcon: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: C.violetBg,
    justifyContent: 'center', alignItems: 'center',
  },
  tipItemTitle: { fontSize: 13, fontWeight: '700', color: C.textPrimary },
  tipItemDetail: { fontSize: 11, color: C.textMuted, marginTop: 2 },
  tipItemSaving: {
    backgroundColor: C.emeraldBg, paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 8,
  },
  tipItemSavingText: { fontSize: 10, fontWeight: '800', color: C.emerald },
  tipsGenerateBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 12, borderRadius: BorderRadius.md,
    backgroundColor: C.violet, marginTop: 4,
  },
  tipsGenerateBtnText: { color: C.textPrimary, fontWeight: '700', fontSize: FontSizes.sm },

  // Empty state (Xcel disconnected)
  emptyIconWrap: {
    width: 86, height: 86,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  emptyIcon: {
    width: 64, height: 64, borderRadius: 32,
    alignItems: 'center', justifyContent: 'center',
    zIndex: 2,
  },
  emptyPulse: {
    position: 'absolute', width: 86, height: 86, borderRadius: 43,
    zIndex: 1,
  },
  emptyTitle: {
    fontSize: FontSizes.lg, fontWeight: '800',
    color: C.textPrimary, textAlign: 'center',
    letterSpacing: -0.3,
  },
  emptyDesc: {
    fontSize: FontSizes.sm, color: C.textSecondary,
    textAlign: 'center', marginTop: 6,
    lineHeight: 20, paddingHorizontal: 8,
  },
  emptyBenefits: {
    flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center',
    gap: 8, marginTop: Spacing.md,
  },
  emptyBenefit: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: C.glass,
    borderColor: C.glassBorder, borderWidth: 1,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 12,
  },
  emptyBenefitText: { fontSize: 11, color: C.textSecondary, fontWeight: '600' },
  emptyCta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, marginTop: Spacing.lg,
    paddingHorizontal: 18, paddingVertical: 12,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    minWidth: 240,
  },
  emptyCtaText: { color: C.textPrimary, fontWeight: '800', fontSize: FontSizes.sm, letterSpacing: 0.2 },
  emptyFootnote: {
    fontSize: 10, color: C.textDim, marginTop: 10, textAlign: 'center',
    paddingHorizontal: 4,
  },

  // Action row
  actionRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: C.glass,
    borderRadius: BorderRadius.card,
    borderWidth: 1, borderColor: C.glassBorder,
    padding: Spacing.md,
    marginBottom: Spacing.base,
    ...Shadows.subtle,
  },
  actionIcon: {
    width: 40, height: 40, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
  },
  actionTitle: { fontSize: FontSizes.base, fontWeight: '700', color: C.textPrimary },
  actionSub: { fontSize: FontSizes.xs, color: C.textMuted, marginTop: 2 },

  // Section
  section: { marginBottom: Spacing.base },
  sectionHeader: {
    fontSize: FontSizes.md, fontWeight: '800', color: C.textPrimary,
    letterSpacing: -0.2, marginBottom: 2,
  },
  sectionSub: { fontSize: FontSizes.xs, color: C.textMuted, marginBottom: Spacing.sm },

  // Bills
  billCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.glass, borderRadius: BorderRadius.card,
    padding: Spacing.md, marginBottom: Spacing.sm,
    gap: Spacing.sm,
    borderWidth: 1, borderColor: C.glassBorder,
  },
  billIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  billType: { fontSize: FontSizes.md, fontWeight: '700', color: C.textPrimary },
  billDetail: { fontSize: FontSizes.xs, color: C.textMuted, marginTop: 2 },
  billRentBadge: { fontSize: 10, color: ACCENT, fontWeight: '700', marginTop: 3 },
  billAmount: { fontSize: FontSizes.lg, fontWeight: '800', color: C.textPrimary },
  billPayBtn: {
    backgroundColor: C.emerald, borderRadius: BorderRadius.md,
    paddingHorizontal: 16, paddingVertical: 7, marginTop: 6,
    minWidth: 70, alignItems: 'center',
  },
  billPayText: { color: C.textPrimary, fontSize: FontSizes.sm, fontWeight: '700' },

  // Provider direct button
  providerBtn: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: 'rgba(245,158,11,0.08)',
    borderRadius: BorderRadius.card,
    padding: Spacing.md, marginBottom: Spacing.base,
    borderWidth: 1, borderColor: ACCENT_BORDER,
  },
  providerBtnText: {
    flex: 1, fontSize: FontSizes.sm, fontWeight: '700', color: ACCENT,
  },
});
