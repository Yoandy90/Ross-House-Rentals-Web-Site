import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, Redirect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../src/contexts/AuthContext';
import { apiCall } from '../../src/utils/api';
import { Badge } from '../../src/components/ui/Badge';
import { Spacing, FontSizes, BorderRadius, Shadows, useColors } from '../../src/constants/theme';
import { formatCurrency, daysUntil, formatShortDate } from '../../src/utils/formatters';
import { GaugeChart, MiniStatCard } from '../../src/components/ui/GaugeChart';

// Flag emoji components for language toggle
const USFlag = () => <Text style={{ fontSize: 20 }}>🇺🇸</Text>;
const MXFlag = () => <Text style={{ fontSize: 20 }}>🇲🇽</Text>;

interface DashboardData {
  tenant: { name: string; email: string; phone: string; tenant_number: string };
  contract: any;
  next_payment: any;
  payments: any[];
  property: any;
}

export default function HomeScreen() {
  const C = useColors();
  const styles = React.useMemo(() => createStyles(C), [C]);
  const { t, i18n } = useTranslation();
  const { user, tenant, viewAsTenant } = useAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [chatUnread, setChatUnread] = useState(0);
  const [notifUnread, setNotifUnread] = useState(0);

  const role = user?.role || 'guest';

  // Toggle language function
  const toggleLanguage = () => {
    i18n.changeLanguage(i18n.language === 'es' ? 'en' : 'es');
  };

  // Fetch chat unread count
  const fetchChatUnread = useCallback(async () => {
    try {
      const res = await apiCall('/chat/unread-count');
      if (res.success) setChatUnread(res.unread_count || 0);
    } catch {}
  }, []);

  // Fetch notifications unread count
  const fetchNotifUnread = useCallback(async () => {
    try {
      const res = await apiCall('/marketplace/notifications?limit=50');
      if (res.success && res.notifications) {
        const unread = res.notifications.filter((n: any) => !n.read).length;
        setNotifUnread(unread);
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchChatUnread();
    fetchNotifUnread();
    const interval = setInterval(() => {
      fetchChatUnread();
      fetchNotifUnread();
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = useCallback(async () => {
    // Wait for the auth context to finish hydrating the role before fetching
    // any dashboard payload. This prevents a brief flash of the guest UI on
    // cold start (loading -> guest -> tenant).
    if (!role) return;

    try {
      if (role === 'admin') {
        // Admins get the rental dashboard stats
        try {
          const result = await apiCall('/admin/rental-dashboard');
          if (result) setData({ success: true, admin_stats: result });
        } catch {}
      } else if (role === 'tenant') {
        const result = await apiCall('/tenant/dashboard');
        if (result.success) setData(result);
      }
      // Guest and buyer roles don't need dashboard data
    } catch (err) {
      console.log('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [role]);

  // Re-run when the auth context finishes resolving the role (admin/tenant/guest).
  // The previous deps array of [] caused the dashboard to fetch once with role=null
  // on cold start -> the inner if/else if did not match either branch -> no data ->
  // "Sin contrato activo" until the user manually pull-to-refreshed.
  useEffect(() => { fetchData(); }, [role, fetchData]);

  // Admin in admin view → go straight to the Admin Dashboard tab
  if (role === 'admin' && !viewAsTenant) {
    return <Redirect href="/(tabs)/dashboard" />;
  }

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const firstName = (data?.tenant?.name || user?.name || '').split(' ')[0];
  const days = data?.next_payment?.due_date ? daysUntil(data.next_payment.due_date) : 0;
  const isPaid = data?.next_payment?.current_month_paid;

  // Role-specific quick actions
  const tenantActions = [
    { icon: 'card-outline' as const, label: t('home.pay_rent'), color: C.brandRed, route: '/(tabs)/payments' },
    { icon: 'flash-outline' as const, label: 'Mis Servicios', color: '#F59E0B', route: '/services' },
    { icon: 'trending-up-outline' as const, label: t('home.credit_builder', 'Credit Builder'), color: '#10B981', route: '/credit-builder' },
    { icon: 'chatbubbles-outline' as const, label: t('home.ai_support', 'AI Support 24/7'), color: '#8B5CF6', route: '/chat' },
    { icon: 'construct-outline' as const, label: t('home.report_issue'), color: C.warning, route: '/maintenance' },
    { icon: 'clipboard-outline' as const, label: 'Inspecciones', color: '#ec4899', route: '/tenant-inspections' },
    { icon: 'create-outline' as const, label: 'Mis Contratos', color: C.navyBlue, route: '/contracts' },
    { icon: 'call-outline' as const, label: t('home.contact_us'), color: C.success, route: '/emergency' },
  ];

  const landlordActions = [
    { icon: 'stats-chart-outline' as const, label: t('owner_dashboard.title'), color: C.success, route: '/owner-dashboard' },
    { icon: 'business-outline' as const, label: t('landlord.my_listings'), color: C.navyBlue, route: '/my-listings' },
    { icon: 'create-outline' as const, label: 'Contratos', color: C.warmGold, route: '/contracts' },
    { icon: 'add-circle-outline' as const, label: t('landlord.add_listing'), color: C.brandRed, route: '/add-property' },
  ];

  const buyerActions = [
    { icon: 'search-outline' as const, label: t('properties.title'), color: C.navyBlue, route: '/(tabs)/properties' },
    { icon: 'heart-outline' as const, label: t('properties.for_sale'), color: C.warmGold, route: '/(tabs)/properties' },
    { icon: 'call-outline' as const, label: t('home.contact_us'), color: C.success, route: '/emergency' },
    { icon: 'person-outline' as const, label: t('tabs.profile'), color: C.brandRed, route: '/(tabs)/profile' },
  ];

  const guestActions = [
    { icon: 'search-outline' as const, label: t('properties.title'), color: C.navyBlue, route: '/(tabs)/properties' },
    { icon: 'storefront-outline' as const, label: t('tabs.market'), color: '#8B5CF6', route: '/(tabs)/market' },
    { icon: 'call-outline' as const, label: t('home.contact_us'), color: C.success, route: '/emergency' },
    { icon: 'person-outline' as const, label: t('tabs.profile'), color: C.brandRed, route: '/(tabs)/profile' },
  ];

  const quickActions = role === 'admin' ? tenantActions : role === 'landlord' ? landlordActions : role === 'buyer' ? buyerActions : role === 'tenant' ? tenantActions : guestActions;

  if (loading) {
    return (
      <View style={[styles.centerContainer, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={C.brandRed} />
      </View>
    );
  }

  return (
    <View style={[styles.rootContainer, { backgroundColor: C.background }]}>
      {/* Background Glow Effects */}
      <View style={styles.bgGlow1} />
      <View style={styles.bgGlow2} />

      <ScrollView
        style={[styles.container, { paddingTop: insets.top }]}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.brandRed} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.welcome}>{t('home.welcome')},</Text>
            <Text style={styles.name}>{firstName || t('home.welcome')}</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={() => router.push('/chat')}
              style={styles.headerActionBtn}
              activeOpacity={0.7}
            >
              <Ionicons name="chatbubble-ellipses-outline" size={22} color={C.textPrimary} />
              {chatUnread > 0 && (
                <View style={styles.badgeDot}>
                  <Text style={styles.badgeDotText}>{chatUnread > 9 ? '9+' : chatUnread}</Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push('/notifications')}
              style={styles.headerActionBtn}
              activeOpacity={0.7}
            >
              <Ionicons name="notifications-outline" size={22} color={C.textPrimary} />
              {notifUnread > 0 && (
                <View style={styles.badgeDot}>
                  <Text style={styles.badgeDotText}>{notifUnread > 9 ? '9+' : notifUnread}</Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={toggleLanguage}
              style={styles.headerActionBtn}
              activeOpacity={0.7}
            >
              {i18n.language === 'es' ? <MXFlag /> : <USFlag />}
            </TouchableOpacity>
          </View>
        </View>

        {/* ═══ LANDLORD HOME — Owner Dashboard Inline ═══ */}
        {role === 'landlord' && (
          <>
            <TouchableOpacity
              style={styles.adminBanner}
              onPress={() => router.push('/owner-dashboard')}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={['rgba(16,185,129,0.12)', 'rgba(16,185,129,0.04)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[StyleSheet.absoluteFill, { borderRadius: BorderRadius.card }]}
              />
              <View style={[styles.adminBannerIcon, { backgroundColor: 'rgba(16,185,129,0.12)' }]}>
                <Ionicons name="stats-chart" size={24} color={C.success} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.adminBannerTitle}>{t('owner_dashboard.title')}</Text>
                <Text style={styles.adminBannerDesc}>{t('owner_dashboard.view_full')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={C.textMuted} />
            </TouchableOpacity>
          </>
        )}

        {/* ═══ GUEST HOME — Welcome & Explore ═══ */}
        {role === 'guest' && (
          <View style={styles.glassCard}>
            <LinearGradient
              colors={['rgba(139,92,246,0.08)', 'rgba(139,92,246,0.02)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={[styles.cardAccentBar, { backgroundColor: '#8B5CF6' }]} />
            <View style={styles.glassCardContent}>
              <View style={styles.noContractContainer}>
                <View style={[styles.noContractIcon, { backgroundColor: 'rgba(139,92,246,0.12)', borderColor: 'rgba(139,92,246,0.20)' }]}>
                  <Ionicons name="eye-outline" size={36} color="#8B5CF6" />
                </View>
                <Text style={styles.noContractTitle}>Bienvenido a Ross House</Text>
                <Text style={styles.noContractDesc}>
                  Explora propiedades disponibles para renta. Cuando firmes un contrato, tendrás acceso a pagos, mantenimiento y más.
                </Text>
                <TouchableOpacity
                  style={styles.exploreBtn}
                  onPress={() => router.push('/(tabs)/properties')}
                >
                  <Text style={[styles.exploreBtnText, { color: '#8B5CF6' }]}>Ver Propiedades Disponibles</Text>
                  <Ionicons name="arrow-forward" size={16} color="#8B5CF6" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* Rent Payment Gauge - Tenant Only */}
        {role === 'tenant' && data?.contract && (
          <>
            <GaugeChart
              value={isPaid ? (data?.next_payment?.amount || 0) : 0}
              maxValue={data?.next_payment?.amount || 1}
              label={t('home.next_payment')}
              icon="wallet"
              iconColor={isPaid ? C.success : C.brandRed}
              gradientStart={isPaid ? '#059669' : '#C8102E'}
              gradientEnd={isPaid ? '#10B981' : '#E11D48'}
              formatValue={(v) => formatCurrency(v)}
              formatMax={(v) => formatCurrency(v)}
              size={200}
            />
            <View style={{ height: 12 }} />
            <View style={styles.miniStatRow}>
              <MiniStatCard
                icon={isPaid ? 'checkmark-circle' : 'time-outline'}
                iconColor={isPaid ? C.success : C.warning}
                value={isPaid ? t('home.paid') : `${Math.abs(days)} ${t('home.days')}`}
                label={isPaid ? t('home.status') : days >= 0 ? t('home.remaining') : t('home.overdue_label')}
              />
              <MiniStatCard
                icon="receipt-outline"
                iconColor="#3B82F6"
                value={data?.payments?.length || 0}
                label={t('home.recent_payments')}
              />
            </View>
            <View style={{ height: 12 }} />
          </>
        )}

        {/* Next Payment Card — TENANT ONLY */}
        {role === 'tenant' && data?.contract ? (
          <View style={styles.glassCard}>
            <LinearGradient
              colors={['rgba(255,255,255,0.04)', 'rgba(255,255,255,0.01)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={[styles.cardAccentBar, { backgroundColor: isPaid ? C.success : C.brandRed }]} />
            <View style={[styles.cardOrb, { backgroundColor: isPaid ? C.success : C.brandRed }]} />
            <View style={styles.glassCardContent}>
              <View style={styles.paymentHeader}>
                <Text style={styles.paymentLabel}>{t('home.next_payment')}</Text>
                {isPaid ? (
                  <Badge label={t('home.paid')} variant="success" />
                ) : days > 0 ? (
                  <Badge label={t('home.due_in', { days })} variant={days <= 5 ? 'warning' : 'info'} />
                ) : days === 0 ? (
                  <Badge label={t('home.due_today')} variant="warning" />
                ) : (
                  <Badge label={t('home.overdue', { days: Math.abs(days) })} variant="error" />
                )}
              </View>
              <Text style={styles.paymentAmount}>
                {formatCurrency(data?.next_payment?.amount || 0)}
              </Text>
              {data?.contract?.property_address && (
                <View style={styles.propertyRow}>
                  <Ionicons name="location-outline" size={14} color={C.textMuted} />
                  <Text style={styles.propertyAddress}>{data.contract.property_address}</Text>
                </View>
              )}
            </View>
          </View>
        ) : role === 'tenant' ? (
          <View style={styles.glassCard}>
            <LinearGradient
              colors={['rgba(255,255,255,0.04)', 'rgba(255,255,255,0.01)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={[styles.cardAccentBar, { backgroundColor: C.warmGold }]} />
            <View style={styles.glassCardContent}>
              <View style={styles.noContractContainer}>
                <View style={styles.noContractIcon}>
                  <Ionicons name="key-outline" size={36} color={C.warmGold} />
                </View>
                <Text style={styles.noContractTitle}>{t('home.no_contract')}</Text>
                <Text style={styles.noContractDesc}>{t('home.no_contract_desc')}</Text>
                <TouchableOpacity
                  style={styles.exploreBtn}
                  onPress={() => router.push('/(tabs)/properties')}
                >
                  <Text style={styles.exploreBtnText}>{t('home.explore_properties')}</Text>
                  <Ionicons name="arrow-forward" size={16} color={C.brandRed} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ) : null}

        {/* My Property — Tenant Only */}
        {role === 'tenant' && data?.property && (
          <View style={styles.glassCard}>
            <LinearGradient
              colors={['rgba(255,255,255,0.04)', 'rgba(255,255,255,0.01)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={[styles.cardAccentBar, { backgroundColor: C.info }]} />
            <View style={styles.glassCardContent}>
              <Text style={styles.sectionTitle}>{t('home.my_property')}</Text>
              <View style={styles.propertyInfo}>
                <View style={styles.propertyDetail}>
                  <Ionicons name="bed-outline" size={18} color={C.textSecondary} />
                  <Text style={styles.propertyDetailText}>
                    {data.property.bedrooms} {t('home.bedrooms_short')}
                  </Text>
                </View>
                <View style={styles.propertyDetail}>
                  <Ionicons name="water-outline" size={18} color={C.textSecondary} />
                  <Text style={styles.propertyDetailText}>
                    {data.property.bathrooms} {t('home.bathrooms_short')}
                  </Text>
                </View>
              </View>
              <View style={styles.addressRow}>
                <Ionicons name="location" size={16} color={C.brandRed} />
                <Text style={styles.addressText}>
                  {data.property.address}, {data.property.city}, {data.property.state}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Quick Actions */}
        <Text style={styles.sectionHeader}>{t('home.quick_actions')}</Text>
        <View style={styles.actionsGrid}>
          {quickActions.map((action, i) => (
            <TouchableOpacity
              key={i}
              style={styles.actionItem}
              onPress={() => router.push(action.route as any)}
              activeOpacity={0.7}
            >
              <View style={[styles.actionIcon, { backgroundColor: `${action.color}15` }]}>
                <Ionicons name={action.icon} size={22} color={action.color} />
              </View>
              <Text style={styles.actionLabel}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Recent Payments — Tenant Only */}
        {role === 'tenant' && data?.payments && data.payments.length > 0 && (
          <>
            <Text style={styles.sectionHeader}>{t('home.recent_payments')}</Text>
            {data.payments.slice(0, 3).map((p) => (
              <View key={p.id} style={styles.paymentItem}>
                <View style={styles.paymentItemLeft}>
                  <View style={[
                    styles.paymentDot,
                    { backgroundColor: p.status === 'completed' ? C.success : C.warning }
                  ]} />
                  <View>
                    <Text style={styles.paymentItemMonth}>
                      {p.period_month} {p.period_year}
                    </Text>
                    <Text style={styles.paymentItemDate}>
                      {formatShortDate(p.payment_date)}
                    </Text>
                  </View>
                </View>
                <Text style={styles.paymentItemAmount}>
                  {formatCurrency(p.total_paid || p.amount)}
                </Text>
              </View>
            ))}
          </>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (C: any) => StyleSheet.create({
  rootContainer: { flex: 1, backgroundColor: C.background },
  container: { flex: 1 },
  content: { paddingHorizontal: Spacing.base },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.background },

  // Background Effects
  bgGlow1: {
    position: 'absolute',
    top: -60,
    right: -40,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: C.brandRed,
    opacity: 0.05,
  },
  bgGlow2: {
    position: 'absolute',
    bottom: '30%',
    left: -60,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: C.brandRed,
    opacity: 0.03,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.base,
  },
  welcome: { fontSize: FontSizes.sm, color: C.textMuted, fontWeight: '500' },
  name: { fontSize: FontSizes['2xl'], fontWeight: '800', color: C.textPrimary, marginTop: 2, letterSpacing: -0.5 },
  notifBell: {
    width: 48, height: 48, borderRadius: 14,
    backgroundColor: C.glass,
    borderWidth: 1,
    borderColor: C.glassBorder,
    justifyContent: 'center', alignItems: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerActionBtn: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: C.glass,
    borderWidth: 1,
    borderColor: C.glassBorder,
    justifyContent: 'center', alignItems: 'center',
    position: 'relative',
  },
  badgeDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: C.brandRed,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
    borderWidth: 2,
    borderColor: C.background,
  },
  badgeDotText: {
    fontSize: 9,
    fontWeight: '800',
    color: C.white,
  },

  // Glass Card
  glassCard: {
    backgroundColor: C.glass,
    borderRadius: BorderRadius.card,
    borderWidth: 1,
    borderColor: C.glassBorder,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: Spacing.base,
    ...Shadows.subtle,
  },
  glassCardContent: {
    padding: Spacing.base,
    position: 'relative',
    zIndex: 1,
  },
  cardAccentBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    borderTopLeftRadius: BorderRadius.card,
    borderTopRightRadius: BorderRadius.card,
  },
  cardOrb: {
    position: 'absolute',
    top: -24,
    right: -24,
    width: 96,
    height: 96,
    borderRadius: 48,
    opacity: 0.06,
  },

  paymentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  paymentLabel: { fontSize: FontSizes.xs, color: C.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  paymentAmount: { fontSize: 36, fontWeight: '800', color: C.brandRed, marginBottom: 4, letterSpacing: -1 },
  propertyRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  propertyAddress: { fontSize: FontSizes.sm, color: C.textMuted },

  noContractContainer: { alignItems: 'center', paddingVertical: Spacing.lg },
  noContractIcon: {
    width: 64, height: 64, borderRadius: 20,
    backgroundColor: 'rgba(245,158,11,0.10)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.15)',
  },
  noContractTitle: { fontSize: FontSizes.lg, fontWeight: '700', color: C.textPrimary, marginTop: 12 },
  noContractDesc: { fontSize: FontSizes.sm, color: C.textMuted, textAlign: 'center', marginTop: 4, maxWidth: 280 },
  exploreBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 16 },
  exploreBtnText: { color: C.brandRed, fontWeight: '700', fontSize: FontSizes.base },

  sectionTitle: { fontSize: FontSizes.xs, color: C.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 },
  propertyInfo: { flexDirection: 'row', gap: 24 },
  propertyDetail: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  propertyDetailText: { fontSize: FontSizes.base, color: C.textPrimary, fontWeight: '500' },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  addressText: { fontSize: FontSizes.sm, color: C.textSecondary, flex: 1 },

  // Mini stat cards row for tenant
  miniStatRow: { flexDirection: 'row', gap: 10, marginBottom: 6 },

  // Admin Banner
  adminBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: C.glass,
    borderRadius: BorderRadius.card, padding: Spacing.base,
    borderWidth: 1, borderColor: 'rgba(200,16,46,0.15)',
    marginBottom: Spacing.base, overflow: 'hidden', position: 'relative',
  },
  adminBannerIcon: {
    width: 48, height: 48, borderRadius: 14,
    backgroundColor: 'rgba(200,16,46,0.10)',
    justifyContent: 'center', alignItems: 'center',
  },
  adminBannerTitle: {
    fontSize: FontSizes.md, fontWeight: '700', color: C.textPrimary,
  },
  adminBannerDesc: {
    fontSize: FontSizes.xs, color: C.textMuted, marginTop: 2,
  },

  sectionHeader: {
    fontSize: FontSizes.xs, color: C.textMuted, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 1.2,
    marginTop: Spacing.lg, marginBottom: Spacing.md,
  },

  actionsGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md,
  },
  actionItem: {
    width: '31%',
    backgroundColor: C.glass,
    borderRadius: BorderRadius.card,
    padding: Spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.glassBorder,
  },
  actionIcon: {
    width: 48, height: 48, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 8,
  },
  actionLabel: { fontSize: FontSizes.sm, color: C.textPrimary, fontWeight: '500', textAlign: 'center' },

  paymentItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: C.glass, borderRadius: BorderRadius.md,
    padding: Spacing.md, marginBottom: 8,
    borderWidth: 1, borderColor: C.glassBorder,
  },
  paymentItemLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  paymentDot: { width: 8, height: 8, borderRadius: 4 },
  paymentItemMonth: { fontSize: FontSizes.base, color: C.textPrimary, fontWeight: '500', textTransform: 'capitalize' },
  paymentItemDate: { fontSize: FontSizes.xs, color: C.textMuted, marginTop: 1 },
  paymentItemAmount: { fontSize: FontSizes.md, color: C.brandRed, fontWeight: '700' },
});
