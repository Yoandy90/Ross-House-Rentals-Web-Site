/**
 * Admin Dashboard — Main screen with KPIs, Charts, Alerts, Quick Actions
 * Modular: Uses separate components for each section.
 */
import React from 'react';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl,
  SafeAreaView, ActivityIndicator, TouchableOpacity, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Gradients } from '../../src/constants/theme';
import { useAdminDashboard } from '../../src/hooks/useAdminDashboard';
import KPICard from '../../src/components/admin/KPICard';
import AlertsList from '../../src/components/admin/AlertsList';
import QuickActions from '../../src/components/admin/QuickActions';
import LoanCharts from '../../src/components/admin/LoanCharts';

const fmt = (n: number) => {
  if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
};
const fmtFull = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n);

export default function AdminDashboard() {
  const router = useRouter();
  const { stats, charts, alerts, loading, refreshing, refresh } = useAdminDashboard();

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primaryLight} />
        <Text style={styles.loadingText}>Cargando dashboard...</Text>
      </SafeAreaView>
    );
  }

  const kpis = stats?.kpis;
  const counts = stats?.counts;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={Colors.primaryLight} />
        }
      >
        {/* ═══ HEADER BANNER ═══ */}
        <LinearGradient
          colors={['#059669', '#047857', '#065F46']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerBanner}
        >
          <View style={styles.headerContent}>
            <View style={styles.headerLeft}>
              <View style={styles.headerIconBox}>
                <Ionicons name="stats-chart" size={24} color="#fff" />
              </View>
              <View>
                <Text style={styles.headerTitle}>Dashboard Admin</Text>
                <Text style={styles.headerSubtitle}>
                  {counts?.total || 0} préstamos · {counts?.active || 0} activos
                </Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <TouchableOpacity onPress={() => router.push('/(tabs)')} style={styles.clientViewBtn}>
                <Ionicons name="home-outline" size={16} color="#fff" />
                <Text style={styles.clientViewText}>Cliente</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.push('/(tabs)/profile')} style={styles.closeBtn}>
                <Ionicons name="person-outline" size={20} color="rgba(255,255,255,0.7)" />
              </TouchableOpacity>
            </View>
          </View>
          {/* Month Summary Strip */}
          <View style={styles.monthStrip}>
            <View style={styles.monthItem}>
              <Text style={styles.monthLabel}>Este Mes</Text>
              <Text style={styles.monthValue}>{fmtFull(stats?.month_invested || 0)}</Text>
            </View>
            <View style={[styles.monthItem, styles.monthDivider]}>
              <Text style={styles.monthLabel}>Ganancia Mes</Text>
              <Text style={[styles.monthValue, { color: '#6EE7B7' }]}>
                {fmtFull(stats?.month_profit || 0)}
              </Text>
            </View>
            <View style={[styles.monthItem, styles.monthDivider]}>
              <Text style={styles.monthLabel}>Nuevos</Text>
              <Text style={styles.monthValue}>{counts?.this_month || 0}</Text>
            </View>
          </View>
          {/* Decorative circles */}
          <View style={[styles.decorCircle, { top: -30, right: -30, opacity: 0.08 }]} />
          <View style={[styles.decorCircle, { bottom: -20, left: -20, width: 80, height: 80, opacity: 0.06 }]} />
        </LinearGradient>

        {/* ═══ KPI CARDS ═══ */}
        <Text style={styles.sectionTitle}>💰 Indicadores Clave</Text>
        <View style={styles.kpiGrid}>
          <KPICard icon="💵" title="Capital Invertido" value={fmtFull(kpis?.total_invested || 0)} subtitle={`${counts?.total || 0} préstamos originados`} />
          <KPICard icon="⭐" title="Ganancia Total" value={fmtFull(kpis?.total_profit || 0)} subtitle="Interés + Fees Admin" accentColor={Colors.primaryLight} highlighted />
          <KPICard icon="⏳" title="Balance Pendiente" value={fmtFull(kpis?.total_balance || 0)} subtitle={`${counts?.active || 0} activos`} accentColor={Colors.accent} highlighted />
          <KPICard icon="💰" title="Cobrado" value={fmtFull(kpis?.total_collected || 0)} subtitle={`Tasa: ${kpis?.collection_rate || 0}%`} />
        </View>

        {/* ═══ SECONDARY STATS ═══ */}
        <View style={styles.secondaryStats}>
          <View style={styles.statPill}>
            <Text style={styles.statPillLabel}>Solicitudes</Text>
            <Text style={[styles.statPillValue, kpis?.pending_applications ? { color: Colors.warning } : {}]}>
              {kpis?.pending_applications || 0}
            </Text>
          </View>
          <View style={styles.statPill}>
            <Text style={styles.statPillLabel}>Clientes</Text>
            <Text style={styles.statPillValue}>{kpis?.total_clients || 0}</Text>
          </View>
          <View style={styles.statPill}>
            <Text style={styles.statPillLabel}>Morosidad</Text>
            <Text style={[
              styles.statPillValue,
              (kpis?.delinquency_rate || 0) > 0 ? { color: Colors.error } : { color: Colors.success },
            ]}>
              {kpis?.delinquency_rate || 0}%
            </Text>
          </View>
        </View>

        {/* ═══ QUICK ACTIONS ═══ */}
        <Text style={styles.sectionTitle}>⚡ Acciones Rápidas</Text>
        <QuickActions />

        {/* ═══ CHARTS ═══ */}
        {charts && (
          <>
            <Text style={styles.sectionTitle}>📊 Análisis</Text>
            <LoanCharts
              typeDistribution={charts.loan_type_distribution}
              statusDistribution={charts.status_distribution}
              monthlyTrend={charts.monthly_trend}
            />
          </>
        )}

        {/* ═══ ALERTS ═══ */}
        <Text style={styles.sectionTitle}>🔔 Alertas ({alerts.length})</Text>
        <AlertsList alerts={alerts} />

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.bg },
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: Colors.textMuted,
    fontSize: 14,
    marginTop: 12,
  },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 0 : 16 },

  // Header Banner
  headerBanner: {
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 20,
    position: 'relative',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.75)',
    fontWeight: '500',
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Month Strip
  monthStrip: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  monthItem: {
    flex: 1,
    alignItems: 'center',
  },
  monthDivider: {
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255,255,255,0.15)',
  },
  monthLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  monthValue: {
    fontSize: 16,
    fontWeight: '900',
    color: '#fff',
    marginTop: 4,
  },

  // Decorative
  decorCircle: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#fff',
  },

  // Section Titles
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
    marginTop: 20,
    marginBottom: 12,
  },

  // KPI Grid
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },

  // Secondary Stats
  secondaryStats: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  statPill: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  statPillLabel: {
    fontSize: 10,
    color: Colors.textMuted,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  statPillValue: {
    fontSize: 18,
    fontWeight: '900',
    color: Colors.text,
  },
  clientViewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  clientViewText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
});
