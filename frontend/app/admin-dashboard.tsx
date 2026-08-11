import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop, G, Text as SvgText } from 'react-native-svg';
import { useAuth } from '../src/contexts/AuthContext';
import { apiCall } from '../src/utils/api';
import { useColors, Spacing, FontSizes, BorderRadius } from '../src/constants/theme';
import { formatCurrency } from '../src/utils/formatters';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── Types ─────────────────────────────────────────────
interface DashboardStats {
  properties: {
    total: number;
    available: number;
    rented: number;
    maintenance: number;
    occupancy_rate: number;
  };
  tenants: { total: number; active: number };
  contracts: { active: number; draft: number };
  revenue: {
    monthly: number;
    yearly: number;
    expected_monthly: number;
    monthly_payments: number;
  };
  deposits: { held: number };
  portfolio: {
    estimated_value: number;
    noi_annual: number;
    cap_rate: number;
  };
  marketplace: {
    users: { total: number; landlords: number; tenants: number; buyers: number };
    listings: { total: number; pending: number; approved: number };
    inquiries: number;
  } | null;
  monthly_trend: { month: string; revenue: number }[];
  pending_maintenance: number;
}

// ─── Premium Circular Progress Chart ─────────────────────
interface CircularChartProps {
  value: number;
  maxValue: number;
  size?: number;
  strokeWidth?: number;
  gradientColors: string[];
  centerLabel: string;
  centerValue: string;
  subtitle?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
}

function CircularChart({
  value,
  maxValue,
  size = 140,
  strokeWidth = 12,
  gradientColors,
  centerLabel,
  centerValue,
  subtitle,
  icon,
  iconColor = '#fff',
}: CircularChartProps) {
  const Colors = useColors();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const percentage = maxValue > 0 ? Math.min((value / maxValue) * 100, 100) : 0;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;
  const center = size / 2;

  return (
    <View style={[styles.chartContainer, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        <Defs>
          <SvgGradient id={`gradient-${centerLabel}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={gradientColors[0]} />
            <Stop offset="100%" stopColor={gradientColors[1]} />
          </SvgGradient>
        </Defs>
        
        {/* Background Circle */}
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={strokeWidth}
          fill="none"
        />
        
        {/* Progress Circle */}
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={`url(#gradient-${centerLabel})`}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          rotation="-90"
          origin={`${center}, ${center}`}
        />
      </Svg>
      
      {/* Center Content */}
      <View style={[styles.chartCenter, { width: size, height: size }]}>
        {icon && (
          <Ionicons name={icon} size={20} color={iconColor} style={{ marginBottom: 2 }} />
        )}
        <Text style={styles.chartPercentage}>{Math.round(percentage)}%</Text>
        <Text style={styles.chartLabel}>{centerLabel}</Text>
        <Text style={[styles.chartValue, { color: gradientColors[0] }]}>{centerValue}</Text>
        {subtitle && <Text style={styles.chartSubtitle}>{subtitle}</Text>}
      </View>
    </View>
  );
}

// ─── Mini Stat Card ─────────────────────────────────────
interface MiniCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  iconBg: string;
  iconColor: string;
  value: string | number;
  label: string;
  trend?: { value: number; positive: boolean };
}

function MiniCard({ icon, iconBg, iconColor, value, label, trend }: MiniCardProps) {
  const Colors = useColors();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  return (
    <View style={styles.miniCard}>
      <View style={[styles.miniIconWrap, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <View style={styles.miniContent}>
        <Text style={styles.miniValue}>{value}</Text>
        <Text style={styles.miniLabel}>{label}</Text>
      </View>
      {trend && (
        <View style={[styles.trendBadge, { backgroundColor: trend.positive ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)' }]}>
          <Ionicons 
            name={trend.positive ? 'trending-up' : 'trending-down'} 
            size={12} 
            color={trend.positive ? Colors.success : Colors.error} 
          />
          <Text style={[styles.trendText, { color: trend.positive ? Colors.success : Colors.error }]}>
            {trend.value}%
          </Text>
        </View>
      )}
    </View>
  );
}

// ─── Main Component ─────────────────────────────────────
export default function AdminDashboardScreen({ embedded }: { embedded?: boolean }) {
  const Colors = useColors();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      const [dashData, mpStats] = await Promise.allSettled([
        apiCall('/admin/rental-dashboard'),
        apiCall('/admin/marketplace-stats'),
      ]);

      const dashResp = dashData.status === 'fulfilled' ? dashData.value : null;
      const mp = mpStats.status === 'fulfilled' ? mpStats.value : null;

      // Backend wraps response in { success, dashboard: {...} }
      const dash = dashResp?.dashboard || dashResp || null;

      if (dash) {
        setStats({
          properties: dash.properties || { total: 0, available: 0, rented: 0, maintenance: 0, occupancy_rate: 0 },
          tenants: dash.tenants || { total: 0, active: 0 },
          contracts: dash.contracts || { active: 0, draft: 0 },
          revenue: {
            monthly: dash.revenue?.monthly || 0,
            yearly: dash.revenue?.yearly || 0,
            expected_monthly: dash.revenue?.expected_monthly || 0,
            monthly_payments: dash.revenue?.monthly_payments || 0,
          },
          deposits: { held: dash.financials?.total_deposits_held || dash.deposits?.held || 0 },
          portfolio: {
            estimated_value: dash.financials?.estimated_portfolio_value || dash.portfolio?.estimated_value || 0,
            noi_annual: dash.financials?.noi_annual || dash.portfolio?.noi_annual || 0,
            cap_rate: dash.financials?.cap_rate || dash.portfolio?.cap_rate || 0,
          },
          marketplace: mp?.success ? mp : null,
          monthly_trend: dash.monthly_trend || [],
          pending_maintenance: dash.maintenance_pending || dash.maintenance?.pending || 0,
        });
      }
    } catch (err) {
      console.log('Admin dashboard error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchStats(); }, []);
  const onRefresh = () => { setRefreshing(true); fetchStats(); };

  if (loading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={Colors.brandRed} />
      </View>
    );
  }

  // Quick action buttons
  const adminActions = [
    { icon: 'business-outline' as const, label: t('admin_dash.properties'), route: '/admin-properties', color: Colors.brandRed },
    { icon: 'people-outline' as const, label: t('admin_dash.tenants'), route: '/admin-tenants', color: '#3B82F6' },
    { icon: 'document-text-outline' as const, label: t('admin_dash.contracts'), route: '/admin-contracts', color: Colors.warmGold },
    { icon: 'card-outline' as const, label: t('admin_dash.payments'), route: '/admin-payments', color: Colors.success },
    { icon: 'clipboard-outline' as const, label: 'Inspecciones', route: '/admin-inspections', color: '#8B5CF6' },
    { icon: 'chatbubbles-outline' as const, label: t('admin_dash.messages'), route: '/admin-messages', color: '#6366F1' },
    { icon: 'construct-outline' as const, label: 'Mant.', route: '/admin-maintenance', color: '#F59E0B' },
    { icon: 'locate-outline' as const, label: 'Oportunidades', route: '/admin-opportunities', color: '#10B981' },
    { icon: 'trending-up-outline' as const, label: 'Inversiones', route: '/admin-investments', color: '#EC4899' },
    { icon: 'megaphone-outline' as const, label: 'Marketing', route: '/admin-marketing', color: '#22D3EE' },
    { icon: 'stats-chart-outline' as const, label: 'Finanzas', route: '/admin-finanzas', color: '#14B8A6' },
    { icon: 'flash-outline' as const, label: 'Energía', route: '/admin-energy', color: '#EAB308' },
    { icon: 'settings-outline' as const, label: 'Config', route: '/admin-settings', color: '#06B6D4' },
  ];

  // Quick create actions
  const createActions = [
    { icon: 'receipt-outline' as const, label: 'Nuevo Gasto', route: '/admin-create-expense', color: '#F59E0B', desc: 'Registrar gasto con recibo' },
    { icon: 'person-add-outline' as const, label: 'Nuevo Usuario', route: '/admin-create-user', color: '#3B82F6', desc: 'Crear inquilino o admin' },
    { icon: 'document-attach-outline' as const, label: 'Nuevo Contrato', route: '/admin-create-contract', color: Colors.warmGold, desc: 'Crear contrato de renta' },
  ];

  const occupancyPct = stats?.properties.total ? (stats.properties.rented / stats.properties.total) * 100 : 0;
  const collectionPct = stats?.revenue.expected_monthly ? (stats.revenue.monthly / stats.revenue.expected_monthly) * 100 : 0;

  return (
    <View style={styles.root}>
      {/* Premium Background */}
      <LinearGradient
        colors={['rgba(200,16,46,0.08)', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0.5 }}
        style={styles.bgGradient}
      />
      <View style={styles.bgOrb1} />
      <View style={styles.bgOrb2} />

      <ScrollView
        style={[styles.container, { paddingTop: insets.top }]}
        contentContainerStyle={[styles.content, embedded && { paddingBottom: 120 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.brandRed} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          {!embedded && (
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
            </TouchableOpacity>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>{t('admin_dash.title')}</Text>
            <Text style={styles.headerSubtitle}>Ross House Rentals LLC</Text>
          </View>
          <View style={styles.adminBadge}>
            <Ionicons name="shield-checkmark" size={14} color={Colors.brandRed} />
            <Text style={styles.adminBadgeText}>Admin</Text>
          </View>
        </View>

        {/* ════════ Revenue Hero Card ════════ */}
        <View style={styles.heroCard}>
          <LinearGradient
            colors={['rgba(200,16,46,0.15)', 'rgba(200,16,46,0.02)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.heroAccentLine} />
          
          <View style={styles.heroContent}>
            <View style={styles.heroTop}>
              <View>
                <Text style={styles.heroLabel}>{t('admin_dash.monthly_revenue')}</Text>
                <Text style={styles.heroAmount}>{formatCurrency(stats?.revenue.monthly || 0)}</Text>
              </View>
              <View style={styles.heroIconWrap}>
                <Ionicons name="trending-up" size={28} color={Colors.brandRed} />
              </View>
            </View>
            
            <View style={styles.heroStats}>
              <View style={styles.heroStatItem}>
                <Text style={styles.heroStatLabel}>{t('admin_dash.expected')}</Text>
                <Text style={styles.heroStatValue}>{formatCurrency(stats?.revenue.expected_monthly || 0)}</Text>
              </View>
              <View style={styles.heroStatDivider} />
              <View style={styles.heroStatItem}>
                <Text style={styles.heroStatLabel}>{t('admin_dash.yearly')}</Text>
                <Text style={styles.heroStatValue}>{formatCurrency(stats?.revenue.yearly || 0)}</Text>
              </View>
              <View style={styles.heroStatDivider} />
              <View style={styles.heroStatItem}>
                <Text style={styles.heroStatLabel}>Depósitos</Text>
                <Text style={[styles.heroStatValue, { color: Colors.warmGold }]}>{formatCurrency(stats?.deposits.held || 0)}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ════════ Key Metrics - Circular Charts Side by Side ════════ */}
        <Text style={styles.sectionLabel}>{t('admin_dash.key_metrics')}</Text>
        
        <View style={styles.chartsRow}>
          {/* Occupancy Chart */}
          <View style={styles.chartCard}>
            <LinearGradient
              colors={['rgba(200,16,46,0.08)', 'rgba(200,16,46,0.02)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[StyleSheet.absoluteFill, { borderRadius: BorderRadius.card }]}
            />
            <CircularChart
              value={stats?.properties.rented || 0}
              maxValue={stats?.properties.total || 1}
              size={130}
              strokeWidth={10}
              gradientColors={['#C8102E', '#E11D48']}
              centerLabel="OCUPADO"
              centerValue={`${stats?.properties.rented || 0}/${stats?.properties.total || 0}`}
              icon="business"
              iconColor={Colors.brandRed}
            />
          </View>

          {/* Collection Chart */}
          <View style={styles.chartCard}>
            <LinearGradient
              colors={['rgba(16,185,129,0.08)', 'rgba(16,185,129,0.02)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[StyleSheet.absoluteFill, { borderRadius: BorderRadius.card }]}
            />
            <CircularChart
              value={stats?.revenue.monthly || 0}
              maxValue={stats?.revenue.expected_monthly || 1}
              size={130}
              strokeWidth={10}
              gradientColors={['#059669', '#10B981']}
              centerLabel="COBRADO"
              centerValue={formatCurrency(stats?.revenue.monthly || 0)}
              icon="cash-outline"
              iconColor={Colors.success}
            />
          </View>
        </View>

        {/* ════════ Mini Stats Grid ════════ */}
        <View style={styles.miniGrid}>
          <MiniCard
            icon="people"
            iconBg="rgba(59,130,246,0.15)"
            iconColor="#3B82F6"
            value={stats?.tenants.active || 0}
            label={t('admin_dash.active_tenants')}
          />
          <MiniCard
            icon="document-text"
            iconBg="rgba(217,170,92,0.15)"
            iconColor={Colors.warmGold}
            value={stats?.contracts.active || 0}
            label={t('admin_dash.active_contracts')}
          />
        </View>

        <View style={styles.miniGrid}>
          <MiniCard
            icon="card"
            iconBg="rgba(16,185,129,0.15)"
            iconColor={Colors.success}
            value={stats?.revenue.monthly_payments || 0}
            label={t('admin_dash.payments_month')}
          />
          <MiniCard
            icon="construct"
            iconBg="rgba(245,158,11,0.15)"
            iconColor={Colors.warning}
            value={stats?.pending_maintenance || 0}
            label={t('admin_dash.in_maintenance')}
          />
        </View>

        {/* ════════ Portfolio Section ════════ */}
        {stats?.portfolio && stats.portfolio.estimated_value > 0 && (
          <>
            <Text style={styles.sectionLabel}>{t('admin_dash.portfolio')}</Text>
            <View style={styles.portfolioCard}>
              <LinearGradient
                colors={['rgba(139,92,246,0.1)', 'rgba(139,92,246,0.02)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.portfolioRow}>
                <View style={styles.portfolioItem}>
                  <Ionicons name="home" size={16} color="#8B5CF6" />
                  <Text style={styles.portfolioLabel}>{t('admin_dash.est_value')}</Text>
                  <Text style={styles.portfolioValue}>{formatCurrency(stats.portfolio.estimated_value)}</Text>
                </View>
                <View style={styles.portfolioDivider} />
                <View style={styles.portfolioItem}>
                  <Ionicons name="trending-up" size={16} color={Colors.success} />
                  <Text style={styles.portfolioLabel}>NOI</Text>
                  <Text style={[styles.portfolioValue, { color: Colors.success }]}>{formatCurrency(stats.portfolio.noi_annual)}</Text>
                </View>
                <View style={styles.portfolioDivider} />
                <View style={styles.portfolioItem}>
                  <Ionicons name="analytics" size={16} color={Colors.warmGold} />
                  <Text style={styles.portfolioLabel}>Cap Rate</Text>
                  <Text style={[styles.portfolioValue, { color: Colors.warmGold }]}>{stats.portfolio.cap_rate.toFixed(1)}%</Text>
                </View>
              </View>
            </View>
          </>
        )}

        {/* ════════ Property Status ════════ */}
        {stats?.properties && stats.properties.total > 0 && (
          <>
            <Text style={styles.sectionLabel}>{t('admin_dash.property_status')}</Text>
            <View style={styles.statusCard}>
              <View style={styles.statusRow}>
                <View style={[styles.statusDot, { backgroundColor: Colors.success }]} />
                <Text style={styles.statusLabel}>{t('admin_dash.rented')}</Text>
                <View style={styles.statusBarContainer}>
                  <View style={[styles.statusBar, { width: `${(stats.properties.rented / stats.properties.total) * 100}%`, backgroundColor: Colors.success }]} />
                </View>
                <Text style={styles.statusValue}>{stats.properties.rented}</Text>
              </View>
              <View style={styles.statusRow}>
                <View style={[styles.statusDot, { backgroundColor: '#3B82F6' }]} />
                <Text style={styles.statusLabel}>{t('admin_dash.available')}</Text>
                <View style={styles.statusBarContainer}>
                  <View style={[styles.statusBar, { width: `${(stats.properties.available / stats.properties.total) * 100}%`, backgroundColor: '#3B82F6' }]} />
                </View>
                <Text style={styles.statusValue}>{stats.properties.available}</Text>
              </View>
              <View style={styles.statusRow}>
                <View style={[styles.statusDot, { backgroundColor: Colors.warning }]} />
                <Text style={styles.statusLabel}>{t('admin_dash.in_maintenance')}</Text>
                <View style={styles.statusBarContainer}>
                  <View style={[styles.statusBar, { width: `${(stats.properties.maintenance / stats.properties.total) * 100}%`, backgroundColor: Colors.warning }]} />
                </View>
                <Text style={styles.statusValue}>{stats.properties.maintenance}</Text>
              </View>
            </View>
          </>
        )}

        {/* ════════ Create Actions ════════ */}
        <Text style={styles.sectionLabel}>✨ Crear Nuevo</Text>
        <View style={styles.createActionsRow}>
          {createActions.map((action, i) => (
            <TouchableOpacity
              key={i}
              style={styles.createCard}
              onPress={() => router.push(action.route as any)}
              activeOpacity={0.7}
            >
              <LinearGradient
                colors={[`${action.color}20`, `${action.color}08`]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <View style={[styles.createIconWrap, { backgroundColor: `${action.color}25` }]}>
                <Ionicons name={action.icon} size={22} color={action.color} />
              </View>
              <Text style={styles.createLabel}>{action.label}</Text>
              <Text style={styles.createDesc}>{action.desc}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ════════ Quick Actions ════════ */}
        <Text style={styles.sectionLabel}>{t('admin_dash.management')}</Text>
        <View style={styles.actionsGrid}>
          {adminActions.map((action, i) => (
            <TouchableOpacity
              key={i}
              style={styles.actionCard}
              onPress={() => router.push(action.route as any)}
              activeOpacity={0.7}
            >
              <LinearGradient
                colors={[`${action.color}15`, `${action.color}05`]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <View style={[styles.actionIconWrap, { backgroundColor: `${action.color}20` }]}>
                <Ionicons name={action.icon} size={20} color={action.color} />
              </View>
              <Text style={styles.actionLabel}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────
const createStyles = (Colors: any) => StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  container: { flex: 1 },
  content: { paddingHorizontal: Spacing.base },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },

  // Background
  bgGradient: { position: 'absolute', top: 0, left: 0, right: 0, height: 300 },
  bgOrb1: {
    position: 'absolute', top: -80, right: -60, width: 200, height: 200,
    borderRadius: 100, backgroundColor: Colors.brandRed, opacity: 0.06,
  },
  bgOrb2: {
    position: 'absolute', bottom: '30%', left: -80, width: 160, height: 160,
    borderRadius: 80, backgroundColor: '#3B82F6', opacity: 0.04,
  },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: Spacing.md,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: Colors.glassLight,
    borderWidth: 1, borderColor: Colors.glassBorderLight,
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: {
    fontSize: FontSizes['2xl'], fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: FontSizes.xs, color: Colors.textMuted, marginTop: 1,
  },
  adminBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(200,16,46,0.1)',
    borderWidth: 1, borderColor: 'rgba(200,16,46,0.2)',
  },
  adminBadgeText: {
    fontSize: 11, fontWeight: '700', color: Colors.brandRed,
  },

  // Hero Card
  heroCard: {
    borderRadius: BorderRadius.card, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(200,16,46,0.15)',
    marginBottom: Spacing.lg,
  },
  heroAccentLine: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 3,
    backgroundColor: Colors.brandRed,
  },
  heroContent: { padding: Spacing.lg },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  heroIconWrap: {
    width: 50, height: 50, borderRadius: 14,
    backgroundColor: 'rgba(200,16,46,0.1)',
    justifyContent: 'center', alignItems: 'center',
  },
  heroLabel: {
    fontSize: FontSizes.xs, color: Colors.textMuted, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 1.2,
  },
  heroAmount: {
    fontSize: 40, fontWeight: '800', color: Colors.brandRed,
    marginTop: 4, letterSpacing: -1,
  },
  heroStats: {
    flexDirection: 'row', marginTop: 20, paddingTop: 16,
    borderTopWidth: 1, borderTopColor: Colors.glassBorder,
  },
  heroStatItem: { flex: 1, alignItems: 'center' },
  heroStatDivider: { width: 1, backgroundColor: Colors.glassBorder },
  heroStatLabel: { fontSize: 10, color: Colors.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  heroStatValue: { fontSize: FontSizes.md, fontWeight: '700', color: Colors.textPrimary, marginTop: 4 },

  // Section Label
  sectionLabel: {
    fontSize: FontSizes.xs, fontWeight: '700', color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 1.2,
    marginBottom: 12, marginTop: 8,
  },

  // Circular Charts Row
  chartsRow: {
    flexDirection: 'row', gap: 12, marginBottom: Spacing.md,
  },
  chartCard: {
    flex: 1, borderRadius: BorderRadius.card, overflow: 'hidden',
    borderWidth: 1, borderColor: Colors.glassBorder,
    padding: 16, alignItems: 'center', justifyContent: 'center',
  },
  chartContainer: { alignItems: 'center', justifyContent: 'center' },
  chartCenter: {
    position: 'absolute', alignItems: 'center', justifyContent: 'center',
  },
  chartPercentage: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary },
  chartLabel: { fontSize: 9, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 },
  chartValue: { fontSize: 12, fontWeight: '700', marginTop: 2 },
  chartSubtitle: { fontSize: 9, color: Colors.textMuted, marginTop: 2 },

  // Mini Grid
  miniGrid: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  miniCard: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.glass,
    borderRadius: BorderRadius.card, padding: 14,
    borderWidth: 1, borderColor: Colors.glassBorder,
  },
  miniIconWrap: {
    width: 40, height: 40, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
  },
  miniContent: { flex: 1 },
  miniValue: { fontSize: FontSizes.xl, fontWeight: '800', color: Colors.textPrimary },
  miniLabel: { fontSize: 10, color: Colors.textMuted, fontWeight: '600', textTransform: 'uppercase', marginTop: 2 },
  trendBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: BorderRadius.full,
  },
  trendText: { fontSize: 10, fontWeight: '700' },

  // Portfolio
  portfolioCard: {
    borderRadius: BorderRadius.card, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(139,92,246,0.15)',
    padding: Spacing.md, marginBottom: Spacing.lg,
  },
  portfolioRow: { flexDirection: 'row', justifyContent: 'space-between' },
  portfolioItem: { flex: 1, alignItems: 'center', gap: 4 },
  portfolioDivider: { width: 1, backgroundColor: Colors.glassBorder },
  portfolioLabel: { fontSize: 10, color: Colors.textMuted, fontWeight: '600', textTransform: 'uppercase' },
  portfolioValue: { fontSize: FontSizes.md, fontWeight: '800', color: Colors.textPrimary },

  // Status Card
  statusCard: {
    backgroundColor: Colors.glass,
    borderRadius: BorderRadius.card, padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.glassBorder,
    gap: 14, marginBottom: Spacing.lg,
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusLabel: { width: 90, fontSize: FontSizes.sm, color: Colors.textSecondary, fontWeight: '500' },
  statusBarContainer: {
    flex: 1, height: 6, borderRadius: 3, backgroundColor: Colors.glassBorder,
  },
  statusBar: { height: 6, borderRadius: 3 },
  statusValue: { width: 24, fontSize: FontSizes.sm, color: Colors.textPrimary, fontWeight: '700', textAlign: 'right' },

  // Actions Grid
  actionsGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: Spacing.lg,
  },
  actionCard: {
    width: '23%', flexGrow: 1, borderRadius: BorderRadius.card, overflow: 'hidden',
    paddingVertical: 14, paddingHorizontal: 8, alignItems: 'center',
    borderWidth: 1, borderColor: Colors.glassBorder,
  },
  actionIconWrap: {
    width: 42, height: 42, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center', marginBottom: 6,
  },
  actionLabel: {
    fontSize: 10, color: Colors.textSecondary, fontWeight: '600', textAlign: 'center',
  },

  // Create Actions Row
  createActionsRow: {
    flexDirection: 'row', gap: 10, marginBottom: Spacing.lg,
  },
  createCard: {
    flex: 1, borderRadius: BorderRadius.card, overflow: 'hidden',
    padding: 14, alignItems: 'center',
    borderWidth: 1, borderColor: Colors.glassBorderLight,
  },
  createIconWrap: {
    width: 48, height: 48, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center', marginBottom: 10,
  },
  createLabel: {
    fontSize: FontSizes.sm, color: Colors.textPrimary, fontWeight: '700', textAlign: 'center',
  },
  createDesc: {
    fontSize: 9, color: Colors.textMuted, textAlign: 'center', marginTop: 4, lineHeight: 12,
  },
});
