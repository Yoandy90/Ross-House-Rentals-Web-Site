/**
 * Admin Reports — Financial reports with Excel export
 */
import React, { useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, SafeAreaView,
  ActivityIndicator, TouchableOpacity, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../../src/constants/theme';
import { useAdminReports } from '../../src/hooks/useAdminReports';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n || 0);

const TYPE_LABELS: Record<string, string> = {
  subchapter_e: 'Subcapítulo E',
  subchapter_f: 'Subcapítulo F',
  tax_advance: 'Tax Advance',
};

export default function ReportsScreen() {
  const router = useRouter();
  const { report, loading, exporting, fetchReport, exportExcel } = useAdminReports();

  useEffect(() => { fetchReport(); }, [fetchReport]);

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primaryLight} />
        <Text style={styles.loadingText}>Generando reporte...</Text>
      </SafeAreaView>
    );
  }

  const summary = report?.summary;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* HEADER */}
        <LinearGradient colors={['#1E40AF', '#1D4ED8', '#2563EB']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.headerBanner}>
          <View style={styles.headerContent}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="chevron-back" size={22} color="#fff" />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>Reportes Financieros</Text>
              <Text style={styles.headerSubtitle}>Análisis de rendimiento del portafolio</Text>
            </View>
            <TouchableOpacity onPress={exportExcel} disabled={exporting} style={styles.exportBtn}>
              {exporting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="download" size={16} color="#fff" />
                  <Text style={styles.exportBtnText}>Excel</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {!report ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📊</Text>
            <Text style={styles.emptyText}>No hay datos para generar reportes</Text>
          </View>
        ) : (
          <>
            {/* EXECUTIVE SUMMARY */}
            <Text style={styles.sectionTitle}>📋 Resumen Ejecutivo</Text>
            <View style={styles.summaryGrid}>
              <SummaryCard icon="💰" label="Total Invertido" value={fmt(summary?.total_invested || 0)} />
              <SummaryCard icon="📈" label="Interés Generado" value={fmt(summary?.total_interest || 0)} accent />
              <SummaryCard icon="🏷️" label="Fees Cobrados" value={fmt(summary?.total_fees || 0)} />
              <SummaryCard icon="💵" label="Total Cobrado" value={fmt(summary?.total_collected || 0)} accent />
              <SummaryCard icon="⏳" label="Balance Pendiente" value={fmt(summary?.total_balance || 0)} warning />
              <SummaryCard icon="📊" label="Préstamo Promedio" value={fmt(summary?.avg_loan_amount || 0)} />
            </View>

            {/* ROI */}
            {(summary?.total_invested || 0) > 0 && (
              <View style={styles.roiCard}>
                <LinearGradient colors={['#059669', '#047857']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.roiGradient}>
                  <View>
                    <Text style={styles.roiLabel}>Retorno sobre Inversión (ROI)</Text>
                    <Text style={styles.roiValue}>
                      {(((summary?.total_interest || 0) + (summary?.total_fees || 0)) / (summary?.total_invested || 1) * 100).toFixed(1)}%
                    </Text>
                  </View>
                  <Text style={styles.roiIcon}>🚀</Text>
                </LinearGradient>
              </View>
            )}

            {/* BY TYPE */}
            {report.by_type && report.by_type.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>🏦 Desglose por Tipo</Text>
                {report.by_type.map((t, i) => (
                  <View key={i} style={styles.typeCard}>
                    <View style={styles.typeHeader}>
                      <Text style={styles.typeName}>{TYPE_LABELS[t.loan_type] || t.loan_type}</Text>
                      <Text style={styles.typeCount}>{t.count} préstamo(s)</Text>
                    </View>
                    <View style={styles.typeMetrics}>
                      <MetricPill label="Invertido" value={fmt(t.total_invested)} />
                      <MetricPill label="Interés" value={fmt(t.total_interest)} color={Colors.primaryLight} />
                      <MetricPill label="Fees" value={fmt(t.fees_collected)} />
                      <MetricPill label="Balance" value={fmt(t.total_balance)} color={Colors.accent} />
                    </View>
                  </View>
                ))}
              </>
            )}

            {/* EXPORT CTA */}
            <TouchableOpacity onPress={exportExcel} disabled={exporting} style={styles.exportCTA} activeOpacity={0.8}>
              <LinearGradient colors={['#059669', '#34D399']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.exportCTAGradient}>
                {exporting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="download" size={22} color="#fff" />
                    <View>
                      <Text style={styles.exportCTATitle}>Exportar Reporte Completo</Text>
                      <Text style={styles.exportCTASubtitle}>Descargar archivo Excel (.xlsx)</Text>
                    </View>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function SummaryCard({ icon, label, value, accent, warning }: { icon: string; label: string; value: string; accent?: boolean; warning?: boolean }) {
  return (
    <View style={[
      summaryStyles.card,
      accent && { borderColor: Colors.primaryLight + '30', backgroundColor: Colors.primaryLight + '06' },
      warning && { borderColor: Colors.accent + '30', backgroundColor: Colors.accent + '06' },
    ]}>
      <Text style={summaryStyles.icon}>{icon}</Text>
      <Text style={summaryStyles.label}>{label}</Text>
      <Text style={[
        summaryStyles.value,
        accent && { color: Colors.primaryLight },
        warning && { color: Colors.accent },
      ]}>{value}</Text>
    </View>
  );
}

function MetricPill({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={metricStyles.pill}>
      <Text style={metricStyles.label}>{label}</Text>
      <Text style={[metricStyles.value, color ? { color } : {}]}>{value}</Text>
    </View>
  );
}

const summaryStyles = StyleSheet.create({
  card: { width: '48%', backgroundColor: Colors.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.border },
  icon: { fontSize: 18, marginBottom: 6 },
  label: { fontSize: 11, color: Colors.textMuted, fontWeight: '600', marginBottom: 4 },
  value: { fontSize: 18, fontWeight: '900', color: Colors.text },
});

const metricStyles = StyleSheet.create({
  pill: { flex: 1, backgroundColor: Colors.bg, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 6, alignItems: 'center' },
  label: { fontSize: 9, color: Colors.textMuted, fontWeight: '600', textTransform: 'uppercase', marginBottom: 3 },
  value: { fontSize: 12, fontWeight: '800', color: Colors.text },
});

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.bg },
  loadingContainer: { flex: 1, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: Colors.textMuted, fontSize: 14, marginTop: 12 },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 0 : 16 },
  headerBanner: { borderRadius: 20, overflow: 'hidden', marginBottom: 16 },
  headerContent: { flexDirection: 'row', alignItems: 'center', padding: 20, gap: 12 },
  backBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.2)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '900', color: '#fff' },
  headerSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  exportBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' },
  exportBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  emptyContainer: { alignItems: 'center', paddingVertical: 48 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: Colors.textMuted, fontSize: 15 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: Colors.text, marginTop: 16, marginBottom: 12 },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  roiCard: { marginTop: 16, borderRadius: 16, overflow: 'hidden' },
  roiGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20 },
  roiLabel: { fontSize: 13, color: 'rgba(255,255,255,0.8)', fontWeight: '600' },
  roiValue: { fontSize: 36, fontWeight: '900', color: '#fff', marginTop: 4 },
  roiIcon: { fontSize: 40 },
  typeCard: { backgroundColor: Colors.surface, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: Colors.border },
  typeHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  typeName: { fontSize: 15, fontWeight: '700', color: Colors.text },
  typeCount: { fontSize: 12, color: Colors.textMuted },
  typeMetrics: { flexDirection: 'row', gap: 6 },
  exportCTA: { marginTop: 20, borderRadius: 16, overflow: 'hidden' },
  exportCTAGradient: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18 },
  exportCTATitle: { fontSize: 15, fontWeight: '800', color: '#fff' },
  exportCTASubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
});
