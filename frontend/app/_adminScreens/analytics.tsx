import React, { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import AdminHeader from '../../components/admin/AdminHeader';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../../constants/colors';
import api from '../../services/api';
import { LineChart, BarChart, PieChart } from 'react-native-chart-kit';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

const screenWidth = Dimensions.get('window').width;

export default function Analytics() {
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<any>(null);
  const [trends, setTrends] = useState<any>(null);
  const [documentCategories, setDocumentCategories] = useState<any[]>([]);
  const [appointmentStatus, setAppointmentStatus] = useState<any[]>([]);
  const [trendDays, setTrendDays] = useState(30);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    loadAnalytics();
  }, [trendDays]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const [overviewRes, trendsRes, docCategoriesRes, apptStatusRes] = await Promise.all([
        api.get('/admin/analytics/overview'),
        api.get(`/admin/analytics/trends?days=${trendDays}`),
        api.get('/admin/analytics/document-categories'),
        api.get('/admin/analytics/appointment-status'),
      ]);

      setOverview(overviewRes.data);
      setTrends(trendsRes.data);
      setDocumentCategories(docCategoriesRes.data);
      setAppointmentStatus(apptStatusRes.data);
    } catch (error) {
      console.error('Error loading analytics:', error);
      Alert.alert('Error', 'No se pudieron cargar las analíticas');
    } finally {
      setLoading(false);
    }
  };

  const exportReport = async () => {
    setExporting(true);
    try {
      // Create report content
      const reportContent = `
REPORTE DE ANÁLISIS - ROSS TAX PREPARATION
Fecha: ${new Date().toLocaleString('es')}
==============================================

RESUMEN GENERAL:
- Total de Clientes: ${overview.total_clients}
- Nuevos Clientes (30 días): ${overview.new_clients_30d}
- Total de Documentos: ${overview.total_documents}
- Documentos Recientes (30 días): ${overview.recent_documents_30d}
- Total de Citas: ${overview.total_appointments}
- Citas Completadas (30 días): ${overview.completed_appointments_30d}
- Declaraciones de Impuestos: ${overview.total_tax_returns}
- Tasa de Completitud KYC: ${overview.kyc_completion_rate}%
- Promedio de Documentos por Cliente: ${overview.avg_docs_per_client}

CATEGORÍAS DE DOCUMENTOS:
${documentCategories.map(cat => `- ${cat.category}: ${cat.count}`).join('\n')}

ESTADO DE CITAS:
${appointmentStatus.map(st => `- ${st.status}: ${st.count}`).join('\n')}

==============================================
Generado por Ross Tax Preparation Admin Panel
      `.trim();

      const fileName = `reporte_analytics_${new Date().toISOString().split('T')[0]}.txt`;
      const fileUri = FileSystem.documentDirectory + fileName;

      await FileSystem.writeAsStringAsync(fileUri, reportContent, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/plain',
          dialogTitle: 'Exportar Reporte',
        });
      } else {
        Alert.alert('Éxito', `Reporte guardado en: ${fileUri}`);
      }

      Alert.alert('Éxito', 'Reporte exportado exitosamente');
    } catch (error) {
      console.error('Error exporting report:', error);
      Alert.alert('Error', 'No se pudo exportar el reporte');
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <AdminHeader title="Analíticas" subtitle="Métricas y reportes" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Cargando analíticas...</Text>
        </View>
      </View>
    );
  }

  // Prepare chart data
  const getTrendLabels = () => {
    if (!trends || !trends.clients || trends.clients.length === 0) return [];
    return trends.clients.slice(-7).map((item: any) => 
      new Date(item.date).toLocaleDateString('es', { day: 'numeric', month: 'short' })
    );
  };

  const getTrendData = (type: 'clients' | 'documents' | 'appointments') => {
    if (!trends || !trends[type]) return [];
    const data = trends[type].slice(-7);
    return data.map((item: any) => item.count);
  };

  const chartConfig = {
    backgroundColor: colors.background,
    backgroundGradientFrom: colors.background,
    backgroundGradientTo: colors.background,
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(108, 17, 16, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(51, 51, 51, ${opacity})`,
    style: {
      borderRadius: 16,
    },
    propsForDots: {
      r: '4',
      strokeWidth: '2',
      stroke: colors.primary,
    },
  };

  const pieChartData = documentCategories.slice(0, 5).map((cat, index) => ({
    name: cat.category,
    population: cat.count,
    color: [colors.primary, colors.accent, colors.secondary, colors.info, colors.success][index % 5],
    legendFontColor: colors.text,
    legendFontSize: 12,
  }));

  return (
    <View style={styles.container}>
      <AdminHeader 
        title="Analíticas" 
        subtitle="Métricas y reportes"
        rightAction={{
          icon: 'download',
          onPress: exportReport
        }}
      />
      <ScrollView contentContainerStyle={styles.scrollContent}>

        {/* KPIs Overview */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Métricas Clave (KPIs)</Text>
          <View style={styles.kpiGrid}>
            <View style={[styles.kpiCard, { borderLeftColor: colors.primary }]}>
              <Ionicons name="people" size={32} color={colors.primary} />
              <Text style={styles.kpiNumber}>{overview.total_clients}</Text>
              <Text style={styles.kpiLabel}>Total Clientes</Text>
              <Text style={styles.kpiSubtext}>+{overview.new_clients_30d} este mes</Text>
            </View>

            <View style={[styles.kpiCard, { borderLeftColor: colors.accent }]}>
              <Ionicons name="folder" size={32} color={colors.accent} />
              <Text style={styles.kpiNumber}>{overview.total_documents}</Text>
              <Text style={styles.kpiLabel}>Documentos</Text>
              <Text style={styles.kpiSubtext}>+{overview.recent_documents_30d} este mes</Text>
            </View>

            <View style={[styles.kpiCard, { borderLeftColor: colors.secondary }]}>
              <Ionicons name="calendar" size={32} color={colors.secondary} />
              <Text style={styles.kpiNumber}>{overview.total_appointments}</Text>
              <Text style={styles.kpiLabel}>Citas</Text>
              <Text style={styles.kpiSubtext}>{overview.completed_appointments_30d} completadas</Text>
            </View>

            <View style={[styles.kpiCard, { borderLeftColor: colors.success }]}>
              <Ionicons name="document-text" size={32} color={colors.success} />
              <Text style={styles.kpiNumber}>{overview.total_tax_returns}</Text>
              <Text style={styles.kpiLabel}>Declaraciones</Text>
              <Text style={styles.kpiSubtext}>Completadas</Text>
            </View>

            <View style={[styles.kpiCard, { borderLeftColor: colors.info }]}>
              <Ionicons name="checkmark-circle" size={32} color={colors.info} />
              <Text style={styles.kpiNumber}>{overview.kyc_completion_rate}%</Text>
              <Text style={styles.kpiLabel}>KYC Completado</Text>
              <Text style={styles.kpiSubtext}>Tasa de completitud</Text>
            </View>

            <View style={[styles.kpiCard, { borderLeftColor: colors.warning }]}>
              <Ionicons name="stats-chart" size={32} color={colors.warning} />
              <Text style={styles.kpiNumber}>{overview.avg_docs_per_client}</Text>
              <Text style={styles.kpiLabel}>Docs/Cliente</Text>
              <Text style={styles.kpiSubtext}>Promedio</Text>
            </View>
          </View>
        </View>

        {/* Trend Period Selector */}
        <View style={styles.periodSelector}>
          <TouchableOpacity
            style={[styles.periodButton, trendDays === 7 && styles.periodButtonActive]}
            onPress={() => setTrendDays(7)}
          >
            <Text style={[styles.periodButtonText, trendDays === 7 && styles.periodButtonTextActive]}>
              7 días
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.periodButton, trendDays === 30 && styles.periodButtonActive]}
            onPress={() => setTrendDays(30)}
          >
            <Text style={[styles.periodButtonText, trendDays === 30 && styles.periodButtonTextActive]}>
              30 días
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.periodButton, trendDays === 90 && styles.periodButtonActive]}
            onPress={() => setTrendDays(90)}
          >
            <Text style={[styles.periodButtonText, trendDays === 90 && styles.periodButtonTextActive]}>
              90 días
            </Text>
          </TouchableOpacity>
        </View>

        {/* Trends Line Chart */}
        {getTrendLabels().length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Tendencia de Nuevos Clientes</Text>
            <View style={styles.chartContainer}>
              <LineChart
                data={{
                  labels: getTrendLabels(),
                  datasets: [{
                    data: getTrendData('clients').length > 0 ? getTrendData('clients') : [0],
                  }],
                }}
                width={screenWidth - 40}
                height={220}
                chartConfig={chartConfig}
                bezier
                style={styles.chart}
              />
            </View>
          </View>
        )}

        {/* Documents Trend */}
        {getTrendLabels().length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Documentos Subidos</Text>
            <View style={styles.chartContainer}>
              <BarChart
                data={{
                  labels: getTrendLabels(),
                  datasets: [{
                    data: getTrendData('documents').length > 0 ? getTrendData('documents') : [0],
                  }],
                }}
                width={screenWidth - 40}
                height={220}
                chartConfig={{
                  ...chartConfig,
                  color: (opacity = 1) => `rgba(93, 193, 217, ${opacity})`,
                }}
                style={styles.chart}
                yAxisLabel=""
                yAxisSuffix=""
              />
            </View>
          </View>
        )}

        {/* Document Categories Pie Chart */}
        {pieChartData.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Distribución por Categoría</Text>
            <View style={styles.chartContainer}>
              <PieChart
                data={pieChartData}
                width={screenWidth - 40}
                height={220}
                chartConfig={chartConfig}
                accessor="population"
                backgroundColor="transparent"
                paddingLeft="15"
                absolute
              />
            </View>
          </View>
        )}

        {/* Appointment Status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Estado de Citas</Text>
          <View style={styles.statusList}>
            {appointmentStatus.map((status, index) => (
              <View key={index} style={styles.statusItem}>
                <View style={styles.statusInfo}>
                  <View style={[
                    styles.statusDot,
                    { backgroundColor: [colors.primary, colors.success, colors.error, colors.warning][index % 4] }
                  ]} />
                  <Text style={styles.statusLabel}>{status.status}</Text>
                </View>
                <Text style={styles.statusCount}>{status.count}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Info */}
        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={24} color={colors.info} />
          <Text style={styles.infoText}>
            Los datos se actualizan en tiempo real. Usa el botón "Exportar" para generar un reporte completo.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundGray,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textGray,
    marginTop: 4,
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  exportButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textWhite,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 16,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  kpiCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  kpiNumber: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.text,
    marginTop: 8,
  },
  kpiLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    marginTop: 4,
  },
  kpiSubtext: {
    fontSize: 11,
    color: colors.textGray,
    marginTop: 4,
  },
  periodSelector: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: colors.background,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  periodButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  periodButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textGray,
  },
  periodButtonTextActive: {
    color: colors.textWhite,
  },
  chartContainer: {
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2,
  },
  chart: {
    borderRadius: 16,
  },
  statusList: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  statusItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  statusLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.text,
    textTransform: 'capitalize',
  },
  statusCount: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: colors.info + '15',
    borderRadius: 12,
    padding: 16,
    gap: 12,
    alignItems: 'center',
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: colors.info,
  },
});