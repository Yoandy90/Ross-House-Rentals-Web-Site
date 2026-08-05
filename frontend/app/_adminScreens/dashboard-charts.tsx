import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../../constants/colors';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../../services/api';
import { BarChart, LineChart, PieChart } from 'react-native-gifted-charts';

const { width } = Dimensions.get('window');
const CHART_WIDTH = width - 64;

interface MonthlyRevenue {
  month: string;
  year: number;
  revenue: number;
}

interface WeeklyClients {
  week: string;
  start_date: string;
  count: number;
}

interface ProjectStats {
  status: string;
  count: number;
}

interface DashboardData {
  monthly_revenue: MonthlyRevenue[];
  weekly_clients: WeeklyClients[];
  project_stats: ProjectStats[];
  summary: {
    total_revenue: number;
    total_clients: number;
    total_projects: number;
    avg_monthly_revenue: number;
  };
}

interface RemindersSummary {
  appointments_count: number;
  overdue_invoices_count: number;
  missing_documents_count: number;
  total_overdue_amount: number;
}

export default function DashboardChartsScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [reminders, setReminders] = useState<RemindersSummary | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [chartsRes, remindersRes] = await Promise.all([
        api.get('/admin/analytics/dashboard-charts'),
        api.get('/admin/reminders/pending'),
      ]);
      
      setDashboardData(chartsRes.data);
      setReminders(remindersRes.data.summary);
    } catch (error: any) {
      console.error('Error loading dashboard:', error);
      Alert.alert('Error', 'No se pudo cargar el dashboard');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const formatCurrency = (value: number) => {
    if (value >= 1000) {
      return `$${(value / 1000).toFixed(1)}k`;
    }
    return `$${value}`;
  };

  // Prepare data for revenue bar chart
  const getRevenueBarData = () => {
    if (!dashboardData?.monthly_revenue) return [];
    return dashboardData.monthly_revenue.map((item, index) => ({
      value: item.revenue,
      label: item.month,
      frontColor: index === dashboardData.monthly_revenue.length - 1 ? '#10B981' : '#3B82F6',
      topLabelComponent: () => (
        <Text style={{ color: colors.textSecondary, fontSize: 10, marginBottom: 4 }}>
          {formatCurrency(item.revenue)}
        </Text>
      ),
    }));
  };

  // Prepare data for clients line chart
  const getClientsLineData = () => {
    if (!dashboardData?.weekly_clients) return [];
    return dashboardData.weekly_clients.map((item) => ({
      value: item.count,
      label: item.start_date,
      dataPointText: item.count > 0 ? String(item.count) : '',
    }));
  };

  // Prepare data for projects pie chart
  const getProjectsPieData = () => {
    if (!dashboardData?.project_stats) return [];
    const statusColors: Record<string, string> = {
      pending: '#F59E0B',
      in_progress: '#3B82F6',
      completed: '#10B981',
      cancelled: '#EF4444',
    };
    const statusLabels: Record<string, string> = {
      pending: 'Pendiente',
      in_progress: 'En Progreso',
      completed: 'Completado',
      cancelled: 'Cancelado',
    };
    return dashboardData.project_stats.map((item) => ({
      value: item.count,
      color: statusColors[item.status] || '#6B7280',
      text: statusLabels[item.status] || item.status,
      focused: item.status === 'in_progress',
    }));
  };

  const renderHeader = () => (
    <View style={[styles.header, { backgroundColor: colors.primary }]}>
      <SafeAreaView edges={['top']}>
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>📊 Dashboard Ejecutivo</Text>
            <Text style={styles.headerSubtitle}>Resumen de tu negocio</Text>
          </View>
          <TouchableOpacity onPress={handleRefresh} style={styles.refreshButton}>
            <Ionicons name="refresh" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );

  const renderSummaryCards = () => (
    <View style={styles.summaryContainer}>
      <View style={styles.summaryRow}>
        <View style={[styles.summaryCard, { backgroundColor: '#10B981' }]}>
          <Ionicons name="cash-outline" size={28} color="#fff" />
          <Text style={styles.summaryValue}>
            ${dashboardData?.summary?.total_revenue?.toLocaleString() || '0'}
          </Text>
          <Text style={styles.summaryLabel}>Ingresos Totales</Text>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: '#3B82F6' }]}>
          <Ionicons name="people-outline" size={28} color="#fff" />
          <Text style={styles.summaryValue}>
            {dashboardData?.summary?.total_clients?.toLocaleString() || '0'}
          </Text>
          <Text style={styles.summaryLabel}>Clientes</Text>
        </View>
      </View>
      <View style={styles.summaryRow}>
        <View style={[styles.summaryCard, { backgroundColor: '#8B5CF6' }]}>
          <Ionicons name="briefcase-outline" size={28} color="#fff" />
          <Text style={styles.summaryValue}>
            {dashboardData?.summary?.total_projects?.toLocaleString() || '0'}
          </Text>
          <Text style={styles.summaryLabel}>Proyectos</Text>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: '#F59E0B' }]}>
          <Ionicons name="trending-up-outline" size={28} color="#fff" />
          <Text style={styles.summaryValue}>
            ${dashboardData?.summary?.avg_monthly_revenue?.toLocaleString() || '0'}
          </Text>
          <Text style={styles.summaryLabel}>Promedio Mensual</Text>
        </View>
      </View>
    </View>
  );

  const renderAlertsSection = () => {
    if (!reminders) return null;
    const hasAlerts = reminders.appointments_count > 0 || 
                      reminders.overdue_invoices_count > 0 || 
                      reminders.missing_documents_count > 0;
    
    if (!hasAlerts) return null;

    return (
      <View style={[styles.alertsContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>⚠️ Alertas y Recordatorios</Text>
        
        {reminders.appointments_count > 0 && (
          <TouchableOpacity 
            style={[styles.alertItem, { borderLeftColor: '#3B82F6' }]}
            onPress={() => router.push('/_adminScreens/appointments')}
          >
            <Ionicons name="calendar" size={20} color="#3B82F6" />
            <View style={styles.alertContent}>
              <Text style={[styles.alertTitle, { color: colors.text }]}>
                {reminders.appointments_count} cita(s) próxima(s)
              </Text>
              <Text style={[styles.alertSubtitle, { color: colors.textSecondary }]}>
                En las próximas 24 horas
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
        
        {reminders.overdue_invoices_count > 0 && (
          <TouchableOpacity 
            style={[styles.alertItem, { borderLeftColor: '#EF4444' }]}
            onPress={() => router.push('/(admin)/invoices')}
          >
            <Ionicons name="alert-circle" size={20} color="#EF4444" />
            <View style={styles.alertContent}>
              <Text style={[styles.alertTitle, { color: colors.text }]}>
                {reminders.overdue_invoices_count} factura(s) vencida(s)
              </Text>
              <Text style={[styles.alertSubtitle, { color: colors.textSecondary }]}>
                Total: ${reminders.total_overdue_amount?.toLocaleString() || '0'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
        
        {reminders.missing_documents_count > 0 && (
          <TouchableOpacity 
            style={[styles.alertItem, { borderLeftColor: '#F59E0B' }]}
            onPress={() => router.push('/_adminScreens/service-orders')}
          >
            <Ionicons name="document-text" size={20} color="#F59E0B" />
            <View style={styles.alertContent}>
              <Text style={[styles.alertTitle, { color: colors.text }]}>
                {reminders.missing_documents_count} proyecto(s) sin documentos
              </Text>
              <Text style={[styles.alertSubtitle, { color: colors.textSecondary }]}>
                Requieren atención
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderRevenueChart = () => {
    const data = getRevenueBarData();
    if (data.length === 0) return null;

    return (
      <View style={[styles.chartContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>💰 Ingresos Mensuales</Text>
        <Text style={[styles.chartSubtitle, { color: colors.textSecondary }]}>Últimos 6 meses</Text>
        <View style={styles.chartWrapper}>
          <BarChart
            data={data}
            width={CHART_WIDTH - 40}
            height={180}
            barWidth={32}
            spacing={20}
            roundedTop
            roundedBottom
            hideRules
            xAxisThickness={1}
            yAxisThickness={0}
            xAxisColor={colors.border}
            yAxisTextStyle={{ color: colors.textSecondary, fontSize: 10 }}
            xAxisLabelTextStyle={{ color: colors.textSecondary, fontSize: 10 }}
            noOfSections={4}
            maxValue={Math.max(...data.map(d => d.value)) * 1.2 || 100}
            isAnimated
            animationDuration={500}
          />
        </View>
      </View>
    );
  };

  const renderClientsChart = () => {
    const data = getClientsLineData();
    if (data.length === 0) return null;

    return (
      <View style={[styles.chartContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>👥 Nuevos Clientes</Text>
        <Text style={[styles.chartSubtitle, { color: colors.textSecondary }]}>Por semana (últimas 8 semanas)</Text>
        <View style={styles.chartWrapper}>
          <LineChart
            data={data}
            width={CHART_WIDTH - 40}
            height={180}
            spacing={40}
            color="#3B82F6"
            thickness={3}
            hideDataPoints={false}
            dataPointsColor="#3B82F6"
            dataPointsRadius={5}
            startFillColor="rgba(59, 130, 246, 0.3)"
            endFillColor="rgba(59, 130, 246, 0.01)"
            areaChart
            curved
            hideRules
            xAxisThickness={1}
            yAxisThickness={0}
            xAxisColor={colors.border}
            yAxisTextStyle={{ color: colors.textSecondary, fontSize: 10 }}
            xAxisLabelTextStyle={{ color: colors.textSecondary, fontSize: 9 }}
            noOfSections={4}
            maxValue={Math.max(...data.map(d => d.value)) * 1.3 || 10}
            isAnimated
            animationDuration={500}
          />
        </View>
      </View>
    );
  };

  const renderProjectsChart = () => {
    const data = getProjectsPieData();
    if (data.length === 0) return null;

    return (
      <View style={[styles.chartContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>📋 Estado de Proyectos</Text>
        <Text style={[styles.chartSubtitle, { color: colors.textSecondary }]}>Distribución actual</Text>
        <View style={styles.pieChartWrapper}>
          <PieChart
            data={data}
            donut
            radius={80}
            innerRadius={50}
            innerCircleColor={colors.card}
            centerLabelComponent={() => (
              <View style={styles.pieCenterLabel}>
                <Text style={[styles.pieCenterValue, { color: colors.text }]}>
                  {dashboardData?.summary?.total_projects || 0}
                </Text>
                <Text style={[styles.pieCenterText, { color: colors.textSecondary }]}>Total</Text>
              </View>
            )}
            showText
            textColor="#fff"
            textSize={12}
            focusOnPress
            isAnimated
          />
          <View style={styles.legendContainer}>
            {data.map((item, index) => (
              <View key={index} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                <Text style={[styles.legendText, { color: colors.text }]}>
                  {item.text}: {item.value}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {renderHeader()}
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.text }]}>Cargando dashboard...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {renderHeader()}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[colors.primary]} />
        }
      >
        {renderSummaryCards()}
        {renderAlertsSection()}
        {renderRevenueChart()}
        {renderClientsChart()}
        {renderProjectsChart()}
        
        {/* Quick Actions */}
        <View style={[styles.quickActionsContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>⚡ Acciones Rápidas</Text>
          <View style={styles.quickActionsRow}>
            <TouchableOpacity 
              style={[styles.quickActionButton, { backgroundColor: '#10B981' }]}
              onPress={() => router.push('/_adminScreens/create-invoice')}
            >
              <Ionicons name="receipt-outline" size={24} color="#fff" />
              <Text style={styles.quickActionText}>Nueva Factura</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.quickActionButton, { backgroundColor: '#3B82F6' }]}
              onPress={() => router.push('/_adminScreens/create-client')}
            >
              <Ionicons name="person-add-outline" size={24} color="#fff" />
              <Text style={styles.quickActionText}>Nuevo Cliente</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.quickActionsRow}>
            <TouchableOpacity 
              style={[styles.quickActionButton, { backgroundColor: '#8B5CF6' }]}
              onPress={() => router.push('/_adminScreens/global-search')}
            >
              <Ionicons name="search-outline" size={24} color="#fff" />
              <Text style={styles.quickActionText}>Buscar</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.quickActionButton, { backgroundColor: '#F59E0B' }]}
              onPress={() => router.push('/_adminScreens/analytics-dashboard')}
            >
              <Ionicons name="stats-chart-outline" size={24} color="#fff" />
              <Text style={styles.quickActionText}>Analytics</Text>
            </TouchableOpacity>
          </View>
        </View>
        
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingBottom: 16,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleContainer: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
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
  summaryContainer: {
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  summaryCard: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginTop: 8,
  },
  summaryLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 4,
    fontWeight: '500',
  },
  alertsContainer: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  alertItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderLeftWidth: 4,
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderRadius: 8,
    marginTop: 12,
  },
  alertContent: {
    flex: 1,
    marginLeft: 12,
  },
  alertTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  alertSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  chartContainer: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  chartSubtitle: {
    fontSize: 13,
    marginTop: 4,
    marginBottom: 16,
  },
  chartWrapper: {
    alignItems: 'center',
    overflow: 'hidden',
  },
  pieChartWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: 16,
  },
  pieCenterLabel: {
    alignItems: 'center',
  },
  pieCenterValue: {
    fontSize: 24,
    fontWeight: '700',
  },
  pieCenterText: {
    fontSize: 12,
  },
  legendContainer: {
    flex: 1,
    marginLeft: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  legendText: {
    fontSize: 13,
    fontWeight: '500',
  },
  quickActionsContainer: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  quickActionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  quickActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
    gap: 8,
  },
  quickActionText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
