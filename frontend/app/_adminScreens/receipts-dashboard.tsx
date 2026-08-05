/**
 * Admin Receipts Dashboard - Modern Redesign
 * Clean, optimized expense analytics with beautiful visuals
 */
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
  Share,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import Svg, { Circle, Path, G, Text as SvgText } from 'react-native-svg';
import api from '../../services/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface DashboardData {
  year: number;
  summary: {
    total_receipts: number;
    total_amount: number;
    pending: number;
    classified: number;
    reviewed: number;
    ai_classified: number;
    avg_ai_confidence: number;
  };
  by_category: Array<{
    category: string;
    count: number;
    amount: number;
  }>;
  by_month: Array<{
    month: number;
    name: string;
    count: number;
    amount: number;
  }>;
  top_clients: Array<{
    user_id: string;
    name: string;
    count: number;
    amount: number;
  }>;
  available_years: number[];
}

const CATEGORY_CONFIG: Record<string, { color: string; icon: string }> = {
  'Gastos Médicos': { color: '#EF4444', icon: 'medkit' },
  'Comida/Restaurantes': { color: '#F97316', icon: 'restaurant' },
  'Transporte': { color: '#3B82F6', icon: 'car' },
  'Oficina/Suministros': { color: '#8B5CF6', icon: 'briefcase' },
  'Utilidades': { color: '#EAB308', icon: 'flash' },
  'Vivienda': { color: '#10B981', icon: 'home' },
  'Educación': { color: '#06B6D4', icon: 'school' },
  'Donaciones': { color: '#EC4899', icon: 'heart' },
  'Gastos de Negocio': { color: '#6366F1', icon: 'business' },
  'Sin clasificar': { color: '#9CA3AF', icon: 'help-circle' },
  'Otros': { color: '#6B7280', icon: 'ellipsis-horizontal' },
};

// Donut Chart Component
const DonutChart = ({ data, size = 140 }: { data: Array<{ category: string; amount: number }>; size?: number }) => {
  const total = data.reduce((sum, item) => sum + item.amount, 0);
  if (total === 0) return null;

  const radius = size / 2 - 15;
  const strokeWidth = 24;
  const circumference = 2 * Math.PI * radius;
  const centerX = size / 2;
  const centerY = size / 2;

  let currentAngle = -90;

  return (
    <View style={{ alignItems: 'center' }}>
      <Svg width={size} height={size}>
        <G>
          {data.map((item, index) => {
            const percentage = item.amount / total;
            const strokeDasharray = `${circumference * percentage} ${circumference * (1 - percentage)}`;
            const rotation = currentAngle;
            currentAngle += percentage * 360;

            const color = CATEGORY_CONFIG[item.category]?.color || '#6B7280';

            return (
              <Circle
                key={index}
                cx={centerX}
                cy={centerY}
                r={radius}
                stroke={color}
                strokeWidth={strokeWidth}
                fill="none"
                strokeDasharray={strokeDasharray}
                strokeLinecap="round"
                transform={`rotate(${rotation} ${centerX} ${centerY})`}
              />
            );
          })}
        </G>
        <SvgText
          x={centerX}
          y={centerY - 8}
          textAnchor="middle"
          fontSize="20"
          fontWeight="700"
          fill="#1F2937"
        >
          {data.length}
        </SvgText>
        <SvgText
          x={centerX}
          y={centerY + 12}
          textAnchor="middle"
          fontSize="11"
          fill="#6B7280"
        >
          categorías
        </SvgText>
      </Svg>
    </View>
  );
};

// Mini Bar Chart for months
const MiniBarChart = ({ data, maxValue }: { data: Array<{ name: string; amount: number }>; maxValue: number }) => {
  const barWidth = (SCREEN_WIDTH - 80) / Math.max(data.length, 1);
  
  return (
    <View style={styles.miniChart}>
      <View style={styles.miniChartBars}>
        {data.map((item, index) => {
          const height = maxValue > 0 ? (item.amount / maxValue) * 80 : 0;
          const isCurrentMonth = index === new Date().getMonth();
          return (
            <View key={index} style={styles.miniChartBarContainer}>
              <View style={styles.miniChartBarWrapper}>
                <LinearGradient
                  colors={isCurrentMonth ? ['#3B82F6', '#1D4ED8'] : ['#CBD5E1', '#94A3B8']}
                  style={[styles.miniChartBar, { height: Math.max(height, 4) }]}
                />
              </View>
              <Text style={[styles.miniChartLabel, isCurrentMonth && styles.miniChartLabelActive]}>
                {item.name.substring(0, 1)}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
};

export default function ReceiptsDashboard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [exporting, setExporting] = useState(false);

  const loadDashboard = useCallback(async () => {
    try {
      const response = await api.get('/admin/receipts/dashboard', {
        params: { year: selectedYear }
      });
      setData(response.data);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedYear]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const handleExport = async (format: 'csv' | 'json') => {
    setExporting(true);
    try {
      const response = await api.get('/admin/receipts/export', {
        params: { year: selectedYear, format }
      });
      
      await Share.share({
        message: format === 'json' ? JSON.stringify(response.data, null, 2) : response.data,
        title: `Recibos ${selectedYear} - ${format.toUpperCase()}`
      });
    } catch (error) {
      Alert.alert('Error', 'No se pudo exportar');
    } finally {
      setExporting(false);
    }
  };

  const formatCurrency = (amount: number) => {
    if (amount >= 1000) return `$${(amount / 1000).toFixed(1)}K`;
    return `$${amount.toFixed(2)}`;
  };

  const formatFullCurrency = (amount: number) => {
    return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getCategoryConfig = (category: string) => {
    return CATEGORY_CONFIG[category] || { color: '#6B7280', icon: 'help-circle' };
  };

  const maxMonthAmount = data?.by_month?.length
    ? Math.max(...data.by_month.map(m => m.amount))
    : 0;

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>Cargando analíticas...</Text>
      </View>
    );
  }

  const totalAmount = data?.summary?.total_amount || 0;
  const totalReceipts = data?.summary?.total_receipts || 0;
  const pendingCount = data?.summary?.pending || 0;
  const classifiedCount = data?.summary?.classified || 0;
  const reviewedCount = data?.summary?.reviewed || 0;
  const aiConfidence = data?.summary?.avg_ai_confidence || 0;

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      {/* Header */}
      <LinearGradient
        colors={['#0F172A', '#1E293B']}
        style={[styles.header, { paddingTop: insets.top + 8 }]}
      >
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Analíticas de Gastos</Text>
          <TouchableOpacity 
            onPress={() => Alert.alert('Exportar', 'Formato', [
              { text: 'CSV', onPress: () => handleExport('csv') },
              { text: 'JSON', onPress: () => handleExport('json') },
              { text: 'Cancelar', style: 'cancel' }
            ])}
            style={styles.exportBtn}
          >
            {exporting ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Ionicons name="share-outline" size={20} color="#FFF" />
            )}
          </TouchableOpacity>
        </View>

        {/* Year Pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.yearScroll}>
          {data?.available_years?.map(year => (
            <TouchableOpacity
              key={year}
              style={[styles.yearPill, selectedYear === year && styles.yearPillActive]}
              onPress={() => {
                setSelectedYear(year);
                setLoading(true);
              }}
            >
              <Text style={[styles.yearPillText, selectedYear === year && styles.yearPillTextActive]}>
                {year}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Hero Stats */}
        <View style={styles.heroStats}>
          <View style={styles.heroMain}>
            <Text style={styles.heroAmount}>{formatFullCurrency(totalAmount)}</Text>
            <Text style={styles.heroLabel}>Total en {selectedYear}</Text>
          </View>
          <View style={styles.heroDivider} />
          <View style={styles.heroSecondary}>
            <View style={styles.heroSecondaryItem}>
              <Ionicons name="receipt-outline" size={16} color="#94A3B8" />
              <Text style={styles.heroSecondaryValue}>{totalReceipts}</Text>
              <Text style={styles.heroSecondaryLabel}>Recibos</Text>
            </View>
            <View style={styles.heroSecondaryItem}>
              <Ionicons name="sparkles" size={16} color="#A78BFA" />
              <Text style={styles.heroSecondaryValue}>{aiConfidence}%</Text>
              <Text style={styles.heroSecondaryLabel}>IA Conf.</Text>
            </View>
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={() => { setRefreshing(true); loadDashboard(); }}
            tintColor="#3B82F6"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Status Pills Row */}
        <View style={styles.statusRow}>
          <View style={[styles.statusPill, { backgroundColor: '#FEF3C7' }]}>
            <Ionicons name="time-outline" size={14} color="#D97706" />
            <Text style={[styles.statusPillText, { color: '#D97706' }]}>{pendingCount} Pendiente{pendingCount !== 1 ? 's' : ''}</Text>
          </View>
          <View style={[styles.statusPill, { backgroundColor: '#DBEAFE' }]}>
            <Ionicons name="checkmark-circle-outline" size={14} color="#2563EB" />
            <Text style={[styles.statusPillText, { color: '#2563EB' }]}>{classifiedCount} Clasificado{classifiedCount !== 1 ? 's' : ''}</Text>
          </View>
          <View style={[styles.statusPill, { backgroundColor: '#D1FAE5' }]}>
            <Ionicons name="shield-checkmark-outline" size={14} color="#059669" />
            <Text style={[styles.statusPillText, { color: '#059669' }]}>{reviewedCount} Revisado{reviewedCount !== 1 ? 's' : ''}</Text>
          </View>
        </View>

        {/* Categories Section */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Por Categoría</Text>
            <TouchableOpacity onPress={() => router.push('/_adminScreens/receipts-management')}>
              <Text style={styles.cardLink}>Ver todo</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.categoriesContent}>
            {/* Donut Chart */}
            <DonutChart data={data?.by_category || []} size={130} />

            {/* Legend */}
            <View style={styles.categoryLegend}>
              {data?.by_category?.slice(0, 4).map((cat, index) => {
                const config = getCategoryConfig(cat.category);
                const percentage = totalAmount > 0 ? ((cat.amount / totalAmount) * 100).toFixed(0) : 0;
                return (
                  <View key={index} style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: config.color }]} />
                    <View style={styles.legendInfo}>
                      <Text style={styles.legendName} numberOfLines={1}>{cat.category}</Text>
                      <Text style={styles.legendValue}>{formatCurrency(cat.amount)} ({percentage}%)</Text>
                    </View>
                  </View>
                );
              })}
              {(data?.by_category?.length || 0) > 4 && (
                <Text style={styles.moreCategories}>+{(data?.by_category?.length || 0) - 4} más</Text>
              )}
            </View>
          </View>
        </View>

        {/* Monthly Trend */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Tendencia Mensual</Text>
            <Text style={styles.cardSubtitle}>{selectedYear}</Text>
          </View>

          {data?.by_month && data.by_month.length > 0 ? (
            <>
              <MiniBarChart data={data.by_month} maxValue={maxMonthAmount} />
              <View style={styles.monthSummary}>
                <View style={styles.monthSummaryItem}>
                  <Text style={styles.monthSummaryLabel}>Mejor mes</Text>
                  <Text style={styles.monthSummaryValue}>
                    {data.by_month.reduce((max, m) => m.amount > max.amount ? m : max, data.by_month[0]).name}
                  </Text>
                </View>
                <View style={styles.monthSummaryDivider} />
                <View style={styles.monthSummaryItem}>
                  <Text style={styles.monthSummaryLabel}>Promedio</Text>
                  <Text style={styles.monthSummaryValue}>
                    {formatCurrency(data.by_month.reduce((sum, m) => sum + m.amount, 0) / data.by_month.filter(m => m.amount > 0).length || 0)}
                  </Text>
                </View>
              </View>
            </>
          ) : (
            <Text style={styles.emptyText}>Sin datos para mostrar</Text>
          )}
        </View>

        {/* Top Clients */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Top Clientes</Text>
            <Text style={styles.cardSubtitle}>Por gastos</Text>
          </View>

          {data?.top_clients?.length ? (
            data.top_clients.slice(0, 5).map((client, index) => (
              <TouchableOpacity 
                key={client.user_id}
                style={styles.clientRow}
                onPress={() => router.push({
                  pathname: '/_adminScreens/client-details',
                  params: { clientId: client.user_id }
                })}
              >
                <View style={[styles.clientRank, index === 0 && styles.clientRankFirst]}>
                  {index === 0 ? (
                    <Ionicons name="trophy" size={14} color="#F59E0B" />
                  ) : (
                    <Text style={styles.clientRankText}>{index + 1}</Text>
                  )}
                </View>
                <View style={styles.clientInfo}>
                  <Text style={styles.clientName} numberOfLines={1}>{client.name}</Text>
                  <Text style={styles.clientMeta}>{client.count} recibos</Text>
                </View>
                <Text style={styles.clientAmount}>{formatCurrency(client.amount)}</Text>
                <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
              </TouchableOpacity>
            ))
          ) : (
            <Text style={styles.emptyText}>Sin datos de clientes</Text>
          )}
        </View>

        {/* Quick Actions */}
        <View style={styles.actionsGrid}>
          <TouchableOpacity 
            style={styles.actionCard}
            onPress={() => router.push('/_adminScreens/receipts-management')}
          >
            <LinearGradient colors={['#3B82F6', '#1D4ED8']} style={styles.actionGradient}>
              <Ionicons name="list" size={24} color="#FFF" />
              <Text style={styles.actionText}>Ver Recibos</Text>
            </LinearGradient>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.actionCard}
            onPress={() => router.push({
              pathname: '/_adminScreens/receipts-management',
              params: { filter: 'pending' }
            })}
          >
            <LinearGradient colors={['#F59E0B', '#D97706']} style={styles.actionGradient}>
              <Ionicons name="time" size={24} color="#FFF" />
              <Text style={styles.actionText}>Pendientes</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' },
  loadingText: { marginTop: 12, fontSize: 15, color: '#64748B' },

  // Header
  header: { paddingBottom: 20 },
  headerTop: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 16 },
  backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: '#FFF', marginLeft: 12 },
  exportBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },

  // Year Pills
  yearScroll: { paddingHorizontal: 16, marginBottom: 20 },
  yearPill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', marginRight: 8 },
  yearPillActive: { backgroundColor: '#3B82F6' },
  yearPillText: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.6)' },
  yearPillTextActive: { color: '#FFF' },

  // Hero Stats
  heroStats: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, marginHorizontal: 16, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 16 },
  heroMain: { flex: 1 },
  heroAmount: { fontSize: 28, fontWeight: '800', color: '#FFF' },
  heroLabel: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 4 },
  heroDivider: { width: 1, height: 50, backgroundColor: 'rgba(255,255,255,0.15)', marginHorizontal: 16 },
  heroSecondary: { gap: 12 },
  heroSecondaryItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  heroSecondaryValue: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  heroSecondaryLabel: { fontSize: 11, color: 'rgba(255,255,255,0.5)' },

  // Content
  content: { flex: 1 },
  contentContainer: { padding: 16 },

  // Status Pills
  statusRow: { flexDirection: 'row', gap: 8, marginBottom: 16, flexWrap: 'wrap' },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
  statusPillText: { fontSize: 12, fontWeight: '600' },

  // Cards
  card: { backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#1F2937' },
  cardSubtitle: { fontSize: 12, color: '#9CA3AF' },
  cardLink: { fontSize: 13, fontWeight: '600', color: '#3B82F6' },

  // Categories
  categoriesContent: { flexDirection: 'row', alignItems: 'center' },
  categoryLegend: { flex: 1, marginLeft: 16, gap: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendInfo: { flex: 1 },
  legendName: { fontSize: 13, fontWeight: '500', color: '#374151' },
  legendValue: { fontSize: 11, color: '#9CA3AF', marginTop: 1 },
  moreCategories: { fontSize: 12, color: '#6B7280', fontStyle: 'italic' },

  // Mini Chart
  miniChart: { marginVertical: 8 },
  miniChartBars: { flexDirection: 'row', alignItems: 'flex-end', height: 100, gap: 4 },
  miniChartBarContainer: { flex: 1, alignItems: 'center' },
  miniChartBarWrapper: { height: 80, justifyContent: 'flex-end', width: '100%' },
  miniChartBar: { borderRadius: 4, width: '100%' },
  miniChartLabel: { fontSize: 10, color: '#9CA3AF', marginTop: 6 },
  miniChartLabelActive: { color: '#3B82F6', fontWeight: '700' },

  // Month Summary
  monthSummary: { flexDirection: 'row', marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  monthSummaryItem: { flex: 1, alignItems: 'center' },
  monthSummaryLabel: { fontSize: 11, color: '#9CA3AF' },
  monthSummaryValue: { fontSize: 15, fontWeight: '700', color: '#1F2937', marginTop: 2 },
  monthSummaryDivider: { width: 1, backgroundColor: '#E5E7EB' },

  // Clients
  clientRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
  clientRank: { width: 28, height: 28, borderRadius: 8, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
  clientRankFirst: { backgroundColor: '#FEF3C7' },
  clientRankText: { fontSize: 12, fontWeight: '600', color: '#6B7280' },
  clientInfo: { flex: 1, marginLeft: 12 },
  clientName: { fontSize: 14, fontWeight: '600', color: '#1F2937' },
  clientMeta: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  clientAmount: { fontSize: 14, fontWeight: '700', color: '#10B981', marginRight: 8 },

  // Actions
  actionsGrid: { flexDirection: 'row', gap: 12 },
  actionCard: { flex: 1, borderRadius: 14, overflow: 'hidden' },
  actionGradient: { paddingVertical: 20, alignItems: 'center', gap: 8 },
  actionText: { fontSize: 14, fontWeight: '600', color: '#FFF' },

  emptyText: { textAlign: 'center', color: '#9CA3AF', fontSize: 14, paddingVertical: 20 },
});
