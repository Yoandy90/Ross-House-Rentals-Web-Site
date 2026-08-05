import React, { useState, useEffect } from 'react';

import AdminHeader from '../../components/admin/AdminHeader';
import { useRouter } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useThemeColors } from '../../constants/colors';
import api from '../../services/api';

interface Statistics {
  overview: {
    total_credits_in_circulation: number;
    total_lifetime_purchased: number;
    total_lifetime_spent: number;
    total_lifetime_bonus: number;
    total_users_with_credits: number;
    total_users: number;
  };
  revenue: {
    total_revenue_usd: number;
    total_purchases: number;
    average_purchase_value: number;
  };
  usage: {
    total_credits_used: number;
    service_breakdown: { [key: string]: { count: number; total_credits: number } };
    total_services_purchased: number;
  };
  recent_activity: {
    purchases_last_30_days: number;
    usages_last_30_days: number;
  };
  top_purchasers: Array<{ user_id: string; total_spent: number }>;
  package_statistics: Array<{
    package_id: string;
    name: string;
    amount_usd: number;
    total_credits: number;
    sales_count: number;
    is_active: boolean;
  }>;
  refunds: {
    pending: number;
    completed: number;
    rejected: number;
    total_refunded_credits: number;
  };
}

export default function AdminCreditsDashboard() {
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<Statistics | null>(null);

  useEffect(() => {
    loadStatistics();
  }, []);

  const loadStatistics = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const response = await api.get('/admin/credits/statistics');
      setStats(response.data);
    } catch (error) {
      console.error('Error loading statistics:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    loadStatistics(true);
  };

  const formatCurrency = (amount: number) => {
    return `$${amount.toFixed(2)}`;
  };

  const formatNumber = (num: number) => {
    return num.toLocaleString('es-ES', { maximumFractionDigits: 0 });
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <AdminHeader title="Dashboard de Créditos" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Cargando estadísticas...</Text>
        </View>
      </View>
    );
  }

  if (!stats) {
    return null;
  }

  return (
    <View style={styles.container}>
      <AdminHeader 
        title="Dashboard de Créditos" 
        rightAction={{
          icon: 'refresh',
          onPress: () => loadStatistics(true)
        }}
      />

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
          >
            {/* Quick Actions */}
            <View style={styles.quickActions}>
              <TouchableOpacity
                style={styles.actionCard}
                onPress={() => router.push('/(admin)/credits-packages')}
              >
                <Ionicons name="pricetag" size={32} color={colors.primary} />
                <Text style={styles.actionText}>Gestionar Paquetes</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionCard}
                onPress={() => router.push('/(admin)/credits-adjustments')}
              >
                <Ionicons name="create" size={32} color={colors.success} />
                <Text style={styles.actionText}>Ajustar Balances</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionCard}
                onPress={() => router.push('/(admin)/refunds')}
              >
                <Ionicons name="receipt" size={32} color={colors.warning} />
                <Text style={styles.actionText}>Reembolsos</Text>
              </TouchableOpacity>
            </View>

            {/* Overview Cards */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Resumen General</Text>
              <View style={styles.statsGrid}>
                <View style={[styles.statCard, { backgroundColor: colors.primary + '15' }]}>
                  <Ionicons name="wallet" size={32} color={colors.primary} />
                  <Text style={styles.statValue}>
                    {formatNumber(stats.overview.total_credits_in_circulation)}
                  </Text>
                  <Text style={styles.statLabel}>Créditos en Circulación</Text>
                </View>

                <View style={[styles.statCard, { backgroundColor: colors.success + '15' }]}>
                  <Ionicons name="trending-up" size={32} color={colors.success} />
                  <Text style={styles.statValue}>
                    {formatCurrency(stats.revenue.total_revenue_usd)}
                  </Text>
                  <Text style={styles.statLabel}>Ingresos Totales</Text>
                </View>

                <View style={[styles.statCard, { backgroundColor: colors.info + '15' }]}>
                  <Ionicons name="people" size={32} color={colors.info} />
                  <Text style={styles.statValue}>
                    {stats.overview.total_users_with_credits}/{stats.overview.total_users}
                  </Text>
                  <Text style={styles.statLabel}>Usuarios Activos</Text>
                </View>

                <View style={[styles.statCard, { backgroundColor: colors.accent + '15' }]}>
                  <Ionicons name="flash" size={32} color={colors.accent} />
                  <Text style={styles.statValue}>
                    {formatNumber(stats.usage.total_credits_used)}
                  </Text>
                  <Text style={styles.statLabel}>Créditos Usados</Text>
                </View>
              </View>
            </View>

            {/* Revenue Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Ingresos</Text>
              <View style={styles.revenueCard}>
                <View style={styles.revenueRow}>
                  <View style={styles.revenueItem}>
                    <Text style={styles.revenueLabel}>Total de Compras</Text>
                    <Text style={styles.revenueValue}>{stats.revenue.total_purchases}</Text>
                  </View>
                  <View style={styles.revenueItem}>
                    <Text style={styles.revenueLabel}>Promedio por Compra</Text>
                    <Text style={styles.revenueValue}>
                      {formatCurrency(stats.revenue.average_purchase_value)}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Recent Activity */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Actividad (Últimos 30 días)</Text>
              <View style={styles.activityGrid}>
                <View style={styles.activityCard}>
                  <Ionicons name="cart" size={24} color={colors.primary} />
                  <Text style={styles.activityValue}>{stats.recent_activity.purchases_last_30_days}</Text>
                  <Text style={styles.activityLabel}>Compras</Text>
                </View>
                <View style={styles.activityCard}>
                  <Ionicons name="checkmark-circle" size={24} color={colors.success} />
                  <Text style={styles.activityValue}>{stats.recent_activity.usages_last_30_days}</Text>
                  <Text style={styles.activityLabel}>Servicios Pagados</Text>
                </View>
              </View>
            </View>

            {/* Package Statistics */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Estadísticas por Paquete</Text>
              {stats.package_statistics.map((pkg) => (
                <View key={pkg.package_id} style={styles.packageCard}>
                  <View style={styles.packageHeader}>
                    <View style={styles.packageInfo}>
                      <Text style={styles.packageName}>{pkg.name}</Text>
                      <Text style={styles.packagePrice}>
                        {formatCurrency(pkg.amount_usd)} • {pkg.total_credits} créditos
                      </Text>
                    </View>
                    <View style={[
                      styles.packageBadge,
                      { backgroundColor: pkg.is_active ? colors.success + '15' : colors.textGray + '15' }
                    ]}>
                      <Text style={[
                        styles.packageBadgeText,
                        { color: pkg.is_active ? colors.success : colors.textGray }
                      ]}>
                        {pkg.is_active ? 'Activo' : 'Inactivo'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.packageStats}>
                    <Ionicons name="cart" size={18} color={colors.primary} />
                    <Text style={styles.packageSales}>{pkg.sales_count} ventas</Text>
                  </View>
                </View>
              ))}
            </View>

            {/* Top Purchasers */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Top Compradores</Text>
              {stats.top_purchasers.slice(0, 5).map((purchaser, index) => (
                <View key={purchaser.user_id} style={styles.purchaserCard}>
                  <View style={styles.purchaserRank}>
                    <Text style={styles.rankNumber}>#{index + 1}</Text>
                  </View>
                  <View style={styles.purchaserInfo}>
                    <Text style={styles.purchaserUserId}>
                      {purchaser.user_id.substring(0, 8)}...
                    </Text>
                    <Text style={styles.purchaserAmount}>
                      {formatCurrency(purchaser.total_spent)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>

            {/* Refunds Summary */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Reembolsos</Text>
              <View style={styles.refundsCard}>
                <View style={styles.refundRow}>
                  <View style={styles.refundItem}>
                    <Ionicons name="time" size={20} color={colors.warning} />
                    <Text style={styles.refundValue}>{stats.refunds.pending}</Text>
                    <Text style={styles.refundLabel}>Pendientes</Text>
                  </View>
                  <View style={styles.refundItem}>
                    <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                    <Text style={styles.refundValue}>{stats.refunds.completed}</Text>
                    <Text style={styles.refundLabel}>Completados</Text>
                  </View>
                  <View style={styles.refundItem}>
                    <Ionicons name="close-circle" size={20} color={colors.error} />
                    <Text style={styles.refundValue}>{stats.refunds.rejected}</Text>
                    <Text style={styles.refundLabel}>Rechazados</Text>
                  </View>
                </View>
                <View style={styles.refundTotal}>
                  <Text style={styles.refundTotalLabel}>Total Reembolsado:</Text>
                  <Text style={styles.refundTotalValue}>
                    {formatNumber(stats.refunds.total_refunded_credits)} créditos
                  </Text>
                </View>
              </View>
            </View>
          </ScrollView>
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  layout: {
    flex: 1,
    flexDirection: 'row',
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
  },
  refreshButton: {
    padding: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: colors.textGray,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  quickActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  actionCard: {
    flex: 1,
    backgroundColor: '#FFF',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionText: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: 150,
    backgroundColor: '#FFF',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: 8,
  },
  statLabel: {
    fontSize: 13,
    color: colors.textGray,
    marginTop: 4,
    textAlign: 'center',
  },
  revenueCard: {
    backgroundColor: '#FFF',
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  revenueRow: {
    flexDirection: 'row',
    gap: 20,
  },
  revenueItem: {
    flex: 1,
  },
  revenueLabel: {
    fontSize: 14,
    color: colors.textGray,
    marginBottom: 8,
  },
  revenueValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
  },
  activityGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  activityCard: {
    flex: 1,
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  activityValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: 8,
  },
  activityLabel: {
    fontSize: 13,
    color: colors.textGray,
    marginTop: 4,
  },
  packageCard: {
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  packageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  packageInfo: {
    flex: 1,
  },
  packageName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  packagePrice: {
    fontSize: 14,
    color: colors.textGray,
  },
  packageBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  packageBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  packageStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  packageSales: {
    fontSize: 14,
    color: colors.text,
  },
  purchaserCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  purchaserRank: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  rankNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.primary,
  },
  purchaserInfo: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  purchaserUserId: {
    fontSize: 14,
    color: colors.text,
  },
  purchaserAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.success,
  },
  refundsCard: {
    backgroundColor: '#FFF',
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  refundRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  refundItem: {
    alignItems: 'center',
  },
  refundValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: 8,
  },
  refundLabel: {
    fontSize: 12,
    color: colors.textGray,
    marginTop: 4,
  },
  refundTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  refundTotalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textGray,
  },
  refundTotalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.error,
  },
});