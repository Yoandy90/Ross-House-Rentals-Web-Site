import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../../constants/colors';
import AdminHeader from '../../components/admin/AdminHeader';
import api from '../../services/api';
import { useRouter } from 'expo-router';

const { width } = Dimensions.get('window');

interface AnalyticsData {
  users: {
    total: number;
    new: number;
    active: number;
    growth_rate: number;
  };
  appointments: {
    total: number;
    new: number;
    pending: number;
    completed: number;
    completion_rate: number;
  };
  documents: {
    total: number;
    new: number;
    pending: number;
  };
  financial: {
    active_subscriptions: number;
    credit_revenue: number;
    credit_transactions: number;
    pending_withdrawals: number;
    pending_withdrawal_amount: number;
  };
  engagement: {
    ai_chat_messages: number;
    lottery_tickets: number;
    raffle_entries: number;
  };
  loans: {
    pending: number;
    approved: number;
  };
}

interface RevenueData {
  total: number;
  subscriptions: {
    mrr: number;
    count: number;
    arr: number;
  };
  credits: {
    revenue: number;
    credits_sold: number;
    transactions: number;
    avg_transaction: number;
  };
}

export default function AnalyticsDashboardScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState<'day' | 'week' | 'month' | 'year'>('month');
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [revenue, setRevenue] = useState<RevenueData | null>(null);

  useEffect(() => {
    loadAnalytics();
  }, [period]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const [analyticsRes, revenueRes] = await Promise.all([
        api.get(`/admin/analytics/overview?period=${period}`),
        api.get(`/admin/analytics/revenue?period=${period}`)
      ]);
      
      setAnalytics(analyticsRes.data.analytics);
      setRevenue(revenueRes.data.revenue);
    } catch (error: any) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadAnalytics();
  };

  const renderPeriodSelector = () => (
    <View style={[styles.periodSelector, { backgroundColor: colors.card }]}>
      {(['day', 'week', 'month', 'year'] as const).map((p) => (
        <TouchableOpacity
          key={p}
          style={[
            styles.periodButton,
            { borderColor: colors.border },
            period === p && { backgroundColor: colors.primary }
          ]}
          onPress={() => setPeriod(p)}
        >
          <Text style={[
            styles.periodText,
            { color: period === p ? '#fff' : colors.text }
          ]}>
            {p === 'day' ? 'Día' : p === 'week' ? 'Semana' : p === 'month' ? 'Mes' : 'Año'}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderStatCard = (
    title: string,
    value: string | number,
    subtitle?: string,
    icon?: any,
    trend?: number,
    color?: string
  ) => (
    <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.statHeader}>
        <View style={[styles.statIcon, { backgroundColor: (color || colors.primary) + '20' }]}>
          <Ionicons name={icon || 'stats-chart'} size={24} color={color || colors.primary} />
        </View>
        {trend !== undefined && (
          <View style={[styles.trendBadge, { backgroundColor: trend >= 0 ? '#10B981' : '#EF4444' }]}>
            <Ionicons name={trend >= 0 ? 'trending-up' : 'trending-down'} size={14} color="#fff" />
            <Text style={styles.trendText}>{Math.abs(trend)}%</Text>
          </View>
        )}
      </View>
      <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.statTitle, { color: colors.textSecondary }]}>{title}</Text>
      {subtitle && (
        <Text style={[styles.statSubtitle, { color: colors.textLight }]}>{subtitle}</Text>
      )}
    </View>
  );

  if (loading && !analytics) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <AdminHeader title="Dashboard Ejecutivo" showBack />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.text }]}>Cargando analytics...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AdminHeader title="Dashboard Ejecutivo" showBack />
      
      {renderPeriodSelector()}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {/* Revenue Section */}
        {revenue && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>💰 Ingresos</Text>
            <View style={styles.row}>
              {renderStatCard(
                'Revenue Total',
                `$${revenue.total.toLocaleString()}`,
                undefined,
                'cash',
                undefined,
                '#10B981'
              )}
              {renderStatCard(
                'MRR',
                `$${revenue.subscriptions.mrr.toLocaleString()}`,
                `ARR: $${revenue.subscriptions.arr.toLocaleString()}`,
                'repeat',
                undefined,
                '#3B82F6'
              )}
            </View>
            <View style={styles.row}>
              {renderStatCard(
                'Créditos Vendidos',
                revenue.credits.credits_sold.toLocaleString(),
                `${revenue.credits.transactions} transacciones`,
                'wallet',
                undefined,
                '#F59E0B'
              )}
              {renderStatCard(
                'Revenue Créditos',
                `$${revenue.credits.revenue.toLocaleString()}`,
                `Prom: $${(revenue.credits.avg_transaction || 0).toFixed(0)}`,
                'card',
                undefined,
                '#8B5CF6'
              )}
            </View>
          </View>
        )}

        {/* Users Section */}
        {analytics && (
          <>
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>👥 Usuarios</Text>
              <View style={styles.row}>
                {renderStatCard(
                  'Total Usuarios',
                  analytics.users.total.toLocaleString(),
                  undefined,
                  'people',
                  analytics.users.growth_rate,
                  '#6366F1'
                )}
                {renderStatCard(
                  'Nuevos',
                  analytics.users.new.toLocaleString(),
                  analytics.users.total > 0 ? `${((analytics.users.new / analytics.users.total) * 100).toFixed(1)}% del total` : '0% del total',
                  'person-add',
                  undefined,
                  '#10B981'
                )}
              </View>
              <View style={styles.row}>
                {renderStatCard(
                  'Activos',
                  analytics.users.active.toLocaleString(),
                  analytics.users.total > 0 ? `${((analytics.users.active / analytics.users.total) * 100).toFixed(1)}% del total` : '0% del total',
                  'flash',
                  undefined,
                  '#F59E0B'
                )}
                {renderStatCard(
                  'Tasa Crecimiento',
                  `${analytics.users.growth_rate}%`,
                  undefined,
                  'trending-up',
                  analytics.users.growth_rate,
                  '#8B5CF6'
                )}
              </View>
            </View>

            {/* Appointments Section */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>📅 Citas</Text>
              <View style={styles.row}>
                {renderStatCard(
                  'Total Citas',
                  analytics.appointments.total.toLocaleString(),
                  undefined,
                  'calendar',
                  undefined,
                  '#6366F1'
                )}
                {renderStatCard(
                  'Pendientes',
                  analytics.appointments.pending.toLocaleString(),
                  undefined,
                  'time',
                  undefined,
                  '#F59E0B'
                )}
              </View>
              <View style={styles.row}>
                {renderStatCard(
                  'Completadas',
                  analytics.appointments.completed.toLocaleString(),
                  `${analytics.appointments.completion_rate}% tasa`,
                  'checkmark-circle',
                  analytics.appointments.completion_rate,
                  '#10B981'
                )}
                {renderStatCard(
                  'Nuevas',
                  analytics.appointments.new.toLocaleString(),
                  undefined,
                  'add-circle',
                  undefined,
                  '#3B82F6'
                )}
              </View>
            </View>

            {/* Financial Summary */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>💳 Resumen Financiero</Text>
              <View style={styles.row}>
                {renderStatCard(
                  'Suscripciones Activas',
                  analytics.financial.active_subscriptions.toLocaleString(),
                  undefined,
                  'card',
                  undefined,
                  '#10B981'
                )}
                {renderStatCard(
                  'Retiros Pendientes',
                  analytics.financial.pending_withdrawals.toLocaleString(),
                  `$${(analytics.financial.pending_withdrawal_amount || 0).toFixed(0)}`,
                  'cash',
                  undefined,
                  '#EF4444'
                )}
              </View>
            </View>

            {/* Engagement Section */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>⚡ Engagement</Text>
              <View style={styles.row}>
                {renderStatCard(
                  'Mensajes AI',
                  analytics.engagement.ai_chat_messages.toLocaleString(),
                  undefined,
                  'chatbubbles',
                  undefined,
                  '#8B5CF6'
                )}
                {renderStatCard(
                  'Tickets Lotería',
                  analytics.engagement.lottery_tickets.toLocaleString(),
                  undefined,
                  'ticket',
                  undefined,
                  '#F59E0B'
                )}
              </View>
              <View style={styles.row}>
                {renderStatCard(
                  'Entradas Rifas',
                  analytics.engagement.raffle_entries.toLocaleString(),
                  undefined,
                  'gift',
                  undefined,
                  '#EC4899'
                )}
                {renderStatCard(
                  'Documentos',
                  analytics.documents.new.toLocaleString(),
                  `${analytics.documents.pending} pendientes`,
                  'document-text',
                  undefined,
                  '#3B82F6'
                )}
              </View>
            </View>

            {/* Loans Section */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>💰 Préstamos</Text>
              <View style={styles.row}>
                {renderStatCard(
                  'Pendientes',
                  analytics.loans.pending.toLocaleString(),
                  undefined,
                  'time',
                  undefined,
                  '#F59E0B'
                )}
                {renderStatCard(
                  'Aprobados',
                  analytics.loans.approved.toLocaleString(),
                  undefined,
                  'checkmark-circle',
                  undefined,
                  '#10B981'
                )}
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  periodSelector: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  periodText: {
    fontSize: 14,
    fontWeight: '600',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  trendText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
  },
  statSubtitle: {
    fontSize: 11,
  },
});
