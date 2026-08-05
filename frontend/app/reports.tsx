/**
 * Reports - P&L (Profit & Loss) Report + Cash Flow Chart
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator,
  StyleSheet, RefreshControl, Alert, Share,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import api from '../services/api';

const MONTHS_ES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const MONTHS_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

const C = {
  bg: '#F0F2F5', card: '#FFFFFF', text: '#1a1a2e', sub: '#6B7280',
  income: '#059669', expense: '#DC2626', primary: '#6366F1', border: '#E5E7EB',
};

const fmt = (n: number) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function ReportsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const now = new Date();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pnl, setPnl] = useState<any>(null);
  const [dashboard, setDashboard] = useState<any>(null);
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear] = useState(now.getFullYear());
  const [viewMode, setViewMode] = useState<'month' | 'year'>('month');
  const [exporting, setExporting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const monthParam = viewMode === 'month' ? `&month=${selectedMonth}` : '';
      const [pnlRes, dashRes] = await Promise.all([
        api.get(`/plaid/pnl-report?context=business&year=${selectedYear}${monthParam}`),
        api.get('/plaid/dashboard-summary?context=business'),
      ]);
      if (pnlRes.data?.success) setPnl(pnlRes.data);
      if (dashRes.data?.success) setDashboard(dashRes.data);
    } catch (e) {
      console.error('Report load error:', e);
    }
    setLoading(false);
    setRefreshing(false);
  }, [selectedMonth, selectedYear, viewMode]);

  useEffect(() => { loadData(); }, [loadData]);

  // Export P&L as CSV
  const exportCSV = async () => {
    if (!pnl) return;
    setExporting(true);
    try {
      let csv = 'Reporte P&L - Mi Negocio\n';
      csv += `Período: ${viewMode === 'month' ? MONTHS_ES[selectedMonth - 1] : 'Año Completo'} ${selectedYear}\n\n`;
      csv += 'INGRESOS\n';
      csv += 'Categoría,Monto,Transacciones,Schedule C\n';
      (pnl.income_items || []).forEach((item: any) => {
        csv += `"${item.label}",${item.amount},${item.count},"${item.schedule_c || ''}"\n`;
      });
      csv += `Total Ingresos,${pnl.totals?.income || 0},,\n\n`;
      csv += 'GASTOS\n';
      csv += 'Categoría,Monto,Transacciones,Schedule C\n';
      (pnl.expense_items || []).forEach((item: any) => {
        csv += `"${item.label}",${item.amount},${item.count},"${item.schedule_c || ''}"\n`;
      });
      csv += `Total Gastos,${pnl.totals?.expenses || 0},,\n\n`;
      csv += `GANANCIA NETA,${pnl.totals?.net_profit || 0},,\n`;
      csv += `Margen,${pnl.totals?.margin_pct || 0}%,,\n`;

      // Try file-based sharing first, fallback to text sharing
      const fileName = `PnL_${viewMode === 'month' ? MONTHS_SHORT[selectedMonth - 1] : 'Anual'}_${selectedYear}.csv`;
      
      try {
        const dirUri = FileSystem.cacheDirectory || FileSystem.documentDirectory;
        if (!dirUri) throw new Error('No directory available');
        
        const fileUri = dirUri + fileName;
        await FileSystem.writeAsStringAsync(fileUri, csv, { encoding: FileSystem.EncodingType.UTF8 });

        const sharingAvailable = await Sharing.isAvailableAsync();
        if (sharingAvailable) {
          await Sharing.shareAsync(fileUri, { 
            mimeType: 'text/csv', 
            dialogTitle: 'Exportar Reporte P&L',
            UTI: 'public.comma-separated-values-text',
          });
        } else {
          throw new Error('Sharing not available');
        }
      } catch (fileError) {
        // Fallback: share as plain text
        console.log('File sharing failed, using text sharing:', fileError);
        await Share.share({ 
          message: csv, 
          title: `Reporte P&L - ${viewMode === 'month' ? MONTHS_ES[selectedMonth - 1] : 'Anual'} ${selectedYear}` 
        });
      }
    } catch (e: any) {
      console.error('Export error:', e);
      // Only show error if user didn't cancel
      if (e?.message !== 'User did not share' && !e?.message?.includes('cancel')) {
        Alert.alert('Error', `No se pudo exportar: ${e.message || 'Error desconocido'}`);
      }
    }
    setExporting(false);
  };

  const totals = pnl?.totals || {};
  const trend = dashboard?.monthly_trend || [];
  const maxTrend = Math.max(...trend.map((t: any) => Math.max(t.income || 0, t.expenses || 0)), 1);
  const comparison = pnl?.comparison;

  return (
    <View style={s.container}>
      {/* Header */}
      <LinearGradient colors={['#312E81', '#4338CA', '#6366F1']} style={[s.header, { paddingTop: insets.top + 8 }]}>
        <View style={s.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle}>Reportes Financieros</Text>
            <Text style={s.headerSub}>{viewMode === 'month' ? MONTHS_ES[selectedMonth - 1] : 'Año Completo'} {selectedYear}</Text>
          </View>
          <TouchableOpacity onPress={exportCSV} disabled={exporting || !pnl} style={s.exportBtn}>
            {exporting ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="share-outline" size={20} color="#fff" />}
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={C.primary} />
          <Text style={{ color: C.sub, marginTop: 10 }}>Generando reporte...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 20 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />}
        >
          {/* View Mode Toggle */}
          <View style={s.toggleRow}>
            {(['month', 'year'] as const).map(mode => (
              <TouchableOpacity
                key={mode}
                style={[s.toggleBtn, viewMode === mode && s.toggleBtnActive]}
                onPress={() => setViewMode(mode)}
              >
                <Text style={[s.toggleText, viewMode === mode && s.toggleTextActive]}>
                  {mode === 'month' ? 'Mensual' : 'Anual'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Month Selector (only for month mode) */}
          {viewMode === 'month' && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginBottom: 14 }}>
              {MONTHS_SHORT.map((m, i) => (
                <TouchableOpacity
                  key={i}
                  style={[s.monthPill, selectedMonth === i + 1 && s.monthPillActive]}
                  onPress={() => setSelectedMonth(i + 1)}
                >
                  <Text style={[s.monthText, selectedMonth === i + 1 && s.monthTextActive]}>{m}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {/* P&L Summary Card */}
          <View style={s.pnlCard}>
            <Text style={s.pnlTitle}>📊 Estado de Pérdidas y Ganancias</Text>

            {/* Totals */}
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
              <View style={[s.totalBox, { backgroundColor: '#ECFDF5' }]}>
                <Text style={{ fontSize: 10, fontWeight: '700', color: C.income }}>INGRESOS BRUTOS</Text>
                <Text style={{ fontSize: 20, fontWeight: '900', color: C.income, marginTop: 4 }}>{fmt(totals.income || 0)}</Text>
                {comparison && comparison.income_change_pct !== 0 && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 4 }}>
                    <Ionicons
                      name={comparison.income_change_pct > 0 ? 'trending-up' : 'trending-down'}
                      size={12}
                      color={comparison.income_change_pct > 0 ? C.income : C.expense}
                    />
                    <Text style={{ fontSize: 10, color: comparison.income_change_pct > 0 ? C.income : C.expense, fontWeight: '600' }}>
                      {comparison.income_change_pct > 0 ? '+' : ''}{comparison.income_change_pct}% vs mes anterior
                    </Text>
                  </View>
                )}
              </View>
              <View style={[s.totalBox, { backgroundColor: '#FEF2F2' }]}>
                <Text style={{ fontSize: 10, fontWeight: '700', color: C.expense }}>GASTOS TOTALES</Text>
                <Text style={{ fontSize: 20, fontWeight: '900', color: C.expense, marginTop: 4 }}>{fmt(totals.expenses || 0)}</Text>
                {comparison && comparison.expense_change_pct !== 0 && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 4 }}>
                    <Ionicons
                      name={comparison.expense_change_pct > 0 ? 'trending-up' : 'trending-down'}
                      size={12}
                      color={comparison.expense_change_pct > 0 ? C.expense : C.income}
                    />
                    <Text style={{ fontSize: 10, color: comparison.expense_change_pct > 0 ? C.expense : C.income, fontWeight: '600' }}>
                      {comparison.expense_change_pct > 0 ? '+' : ''}{comparison.expense_change_pct}% vs mes anterior
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* Net Profit */}
            <View style={[s.netBox, { borderColor: (totals.net_profit || 0) >= 0 ? C.income : C.expense }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: C.sub }}>GANANCIA NETA</Text>
                <View style={{ backgroundColor: (totals.margin_pct || 0) >= 0 ? '#ECFDF5' : '#FEF2F2', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: (totals.margin_pct || 0) >= 0 ? C.income : C.expense }}>
                    Margen: {totals.margin_pct || 0}%
                  </Text>
                </View>
              </View>
              <Text style={{ fontSize: 28, fontWeight: '900', color: (totals.net_profit || 0) >= 0 ? C.income : C.expense, marginTop: 4 }}>
                {(totals.net_profit || 0) >= 0 ? '+' : ''}{fmt(totals.net_profit || 0)}
              </Text>
            </View>
          </View>

          {/* Cash Flow Chart */}
          {trend.length > 0 && (
            <View style={s.chartCard}>
              <Text style={s.sectionTitle}>📈 Flujo de Caja (12 meses)</Text>
              <View style={s.chartLegend}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: C.income }} />
                  <Text style={{ fontSize: 10, color: C.sub }}>Ingresos</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: C.expense }} />
                  <Text style={{ fontSize: 10, color: C.sub }}>Gastos</Text>
                </View>
              </View>
              <View style={s.chart}>
                {trend.map((t: any, i: number) => {
                  const incH = maxTrend > 0 ? (t.income / maxTrend) * 100 : 0;
                  const expH = maxTrend > 0 ? (t.expenses / maxTrend) * 100 : 0;
                  return (
                    <View key={i} style={s.chartCol}>
                      <View style={s.chartBars}>
                        <View style={[s.chartBar, { height: `${incH}%`, backgroundColor: C.income }] as any} />
                        <View style={[s.chartBar, { height: `${expH}%`, backgroundColor: C.expense, opacity: 0.7 }] as any} />
                      </View>
                      <Text style={s.chartLabel}>{MONTHS_SHORT[t.month - 1]}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* Income Breakdown */}
          {(pnl?.income_items || []).length > 0 && (
            <View style={s.sectionCard}>
              <Text style={s.sectionTitle}>💰 Desglose de Ingresos</Text>
              {pnl.income_items.map((item: any, idx: number) => (
                <View key={idx} style={s.lineItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.lineLabel}>{item.label}</Text>
                    {item.schedule_c ? (
                      <Text style={s.scheduleC}>📋 {item.schedule_c}</Text>
                    ) : null}
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[s.lineAmount, { color: C.income }]}>{fmt(item.amount)}</Text>
                    <Text style={s.lineSub}>{item.count} txns · ~{fmt(item.avg_per_txn)}/txn</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Expense Breakdown */}
          {(pnl?.expense_items || []).length > 0 && (
            <View style={s.sectionCard}>
              <Text style={s.sectionTitle}>💸 Desglose de Gastos</Text>
              {pnl.expense_items.map((item: any, idx: number) => {
                const pct = totals.expenses > 0 ? (item.amount / totals.expenses * 100) : 0;
                return (
                  <View key={idx} style={s.lineItem}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={s.lineLabel}>{item.label}</Text>
                        <Text style={{ fontSize: 10, color: C.sub, backgroundColor: '#F1F5F9', paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4 }}>
                          {pct.toFixed(1)}%
                        </Text>
                      </View>
                      {item.schedule_c ? (
                        <Text style={s.scheduleC}>📋 {item.schedule_c}</Text>
                      ) : null}
                      {/* Progress bar */}
                      <View style={{ height: 4, backgroundColor: '#F1F5F9', borderRadius: 2, marginTop: 6, overflow: 'hidden' }}>
                        <View style={{ width: `${pct}%`, height: '100%', backgroundColor: C.expense, borderRadius: 2 } as any} />
                      </View>
                    </View>
                    <View style={{ alignItems: 'flex-end', marginLeft: 12 }}>
                      <Text style={[s.lineAmount, { color: C.expense }]}>{fmt(item.amount)}</Text>
                      <Text style={s.lineSub}>{item.count} txns</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* Tax Deduction Tip */}
          {(pnl?.expense_items || []).some((i: any) => i.schedule_c) && (
            <View style={[s.sectionCard, { backgroundColor: '#FFFBEB', borderLeftWidth: 3, borderLeftColor: '#F59E0B' }]}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#92400E' }}>💡 Tip de Deducciones</Text>
              <Text style={{ fontSize: 12, color: '#78350F', marginTop: 6, lineHeight: 18 }}>
                Los gastos marcados con 📋 son potencialmente deducibles en tu Schedule C (Form 1040).
                Consulta con tu preparador de impuestos para confirmar eligibilidad y mantener todos los recibos.
              </Text>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: { paddingBottom: 16, paddingHorizontal: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#fff' },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 1 },
  exportBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },

  toggleRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  toggleBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10, backgroundColor: C.card, borderWidth: 1, borderColor: C.border },
  toggleBtnActive: { backgroundColor: '#EEF2FF', borderColor: '#6366F1' },
  toggleText: { fontSize: 13, fontWeight: '600', color: C.sub },
  toggleTextActive: { color: '#6366F1' },

  monthPill: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, backgroundColor: '#E8EAF6' },
  monthPillActive: { backgroundColor: '#6366F1' },
  monthText: { fontSize: 12, fontWeight: '600', color: C.sub },
  monthTextActive: { color: '#fff' },

  pnlCard: { backgroundColor: C.card, borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: C.border },
  pnlTitle: { fontSize: 16, fontWeight: '800', color: C.text },
  totalBox: { flex: 1, borderRadius: 12, padding: 12 },
  netBox: { marginTop: 12, padding: 12, borderRadius: 12, borderWidth: 2, backgroundColor: '#FAFAFA' },

  chartCard: { backgroundColor: C.card, borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: C.border },
  chartLegend: { flexDirection: 'row', gap: 16, marginBottom: 10 },
  chart: { flexDirection: 'row', height: 120, gap: 2, alignItems: 'flex-end' },
  chartCol: { flex: 1, alignItems: 'center' },
  chartBars: { flex: 1, width: '100%', flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 1 },
  chartBar: { width: '45%', borderTopLeftRadius: 2, borderTopRightRadius: 2, minHeight: 2 },
  chartLabel: { fontSize: 8, color: C.sub, marginTop: 4, fontWeight: '600' },

  sectionCard: { backgroundColor: C.card, borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: C.border },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: C.text, marginBottom: 12 },
  lineItem: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: C.border },
  lineLabel: { fontSize: 13, fontWeight: '600', color: C.text },
  lineAmount: { fontSize: 14, fontWeight: '800' },
  lineSub: { fontSize: 10, color: C.sub, marginTop: 2 },
  scheduleC: { fontSize: 10, color: '#6366F1', marginTop: 2, fontWeight: '500' },
});
