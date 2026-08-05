/**
 * Business Profit & Loss - Simplified P&L statement for clients
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
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import api from '../../services/api';
import { useTranslation } from 'react-i18next';

interface ExpenseItem {
  category: string;
  name: string;
  name_en: string;
  schedule_c_line: string;
  amount: number;
}

interface ProfitLossData {
  year: number;
  business_name: string;
  total_income: number;
  total_expenses: number;
  net_profit: number;
  expense_breakdown: ExpenseItem[];
  total_transactions: number;
}

export default function BusinessPnLScreen() {
  const { i18n: i18nInstance } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isES = i18nInstance.language === 'es';

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasBusiness, setHasBusiness] = useState(false);
  const [pnl, setPnl] = useState<ProfitLossData | null>(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const fetchPnL = useCallback(async () => {
    try {
      const res = await api.get('/my-business/profit-loss', { params: { year: selectedYear } });
      if (res.data.success) {
        setHasBusiness(res.data.has_business);
        setPnl(res.data.profit_loss);
      }
    } catch (err) {
      console.error('Error fetching P&L:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedYear]);

  useEffect(() => {
    setLoading(true);
    fetchPnL();
  }, [fetchPnL]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchPnL();
  };

  const formatCurrency = (amount: number) => {
    return '$' + Math.abs(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366F1" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={['#312E81', '#6366F1']} style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>{isES ? 'Estado de Resultados' : 'Profit & Loss'}</Text>
          <Text style={styles.headerSubtitle}>{pnl?.business_name || ''}</Text>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366F1" />}
        showsVerticalScrollIndicator={false}
      >
        {/* Year Selector */}
        <View style={styles.yearSelector}>
          <TouchableOpacity onPress={() => setSelectedYear(selectedYear - 1)} style={styles.yearBtn}>
            <Ionicons name="chevron-back" size={22} color="#374151" />
          </TouchableOpacity>
          <Text style={styles.yearText}>{selectedYear}</Text>
          <TouchableOpacity onPress={() => setSelectedYear(selectedYear + 1)} style={styles.yearBtn}>
            <Ionicons name="chevron-forward" size={22} color="#374151" />
          </TouchableOpacity>
        </View>

        {!hasBusiness || !pnl ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="bar-chart-outline" size={48} color="#D1D5DB" />
            <Text style={styles.emptyText}>
              {isES ? 'No hay datos para este año' : 'No data for this year'}
            </Text>
          </View>
        ) : (
          <>
            {/* Summary Card */}
            <View style={styles.summaryCard}>
              {/* Income */}
              <View style={styles.summaryRow}>
                <View style={styles.summaryLeft}>
                  <View style={[styles.summaryDot, { backgroundColor: '#10B981' }]} />
                  <Text style={styles.summaryLabel}>{isES ? 'Ingresos Brutos' : 'Gross Income'}</Text>
                </View>
                <Text style={[styles.summaryAmount, { color: '#10B981' }]}>
                  {formatCurrency(pnl.total_income)}
                </Text>
              </View>

              <View style={styles.divider} />

              {/* Expenses */}
              <View style={styles.summaryRow}>
                <View style={styles.summaryLeft}>
                  <View style={[styles.summaryDot, { backgroundColor: '#EF4444' }]} />
                  <Text style={styles.summaryLabel}>{isES ? 'Total Gastos' : 'Total Expenses'}</Text>
                </View>
                <Text style={[styles.summaryAmount, { color: '#EF4444' }]}>
                  ({formatCurrency(pnl.total_expenses)})
                </Text>
              </View>

              <View style={styles.dividerThick} />

              {/* Net Profit */}
              <View style={styles.summaryRow}>
                <View style={styles.summaryLeft}>
                  <View style={[styles.summaryDot, { backgroundColor: pnl.net_profit >= 0 ? '#10B981' : '#EF4444' }]} />
                  <Text style={styles.netLabel}>{isES ? 'Ganancia Neta' : 'Net Profit'}</Text>
                </View>
                <Text style={[styles.netAmount, { color: pnl.net_profit >= 0 ? '#10B981' : '#EF4444' }]}>
                  {pnl.net_profit >= 0 ? '' : '-'}{formatCurrency(pnl.net_profit)}
                </Text>
              </View>
            </View>

            {/* Tax Info */}
            <View style={styles.taxInfoCard}>
              <Ionicons name="information-circle" size={18} color="#6366F1" />
              <Text style={styles.taxInfoText}>
                {isES
                  ? `${pnl.total_transactions} transacciones · Los montos mostrados corresponden al año fiscal ${selectedYear} para tu Schedule C`
                  : `${pnl.total_transactions} transactions · Amounts shown are for fiscal year ${selectedYear} on your Schedule C`}
              </Text>
            </View>

            {/* Expense Breakdown */}
            <Text style={styles.sectionTitle}>{isES ? 'Desglose de Gastos (Schedule C)' : 'Expense Breakdown (Schedule C)'}</Text>

            <View style={styles.breakdownCard}>
              {/* Header */}
              <View style={styles.breakdownHeader}>
                <Text style={styles.breakdownHeaderText}>{isES ? 'Categoría' : 'Category'}</Text>
                <Text style={styles.breakdownHeaderText}>{isES ? 'Línea' : 'Line'}</Text>
                <Text style={[styles.breakdownHeaderText, { textAlign: 'right' }]}>{isES ? 'Monto' : 'Amount'}</Text>
              </View>

              {pnl.expense_breakdown.length === 0 ? (
                <Text style={styles.noExpenses}>{isES ? 'Sin gastos registrados' : 'No expenses recorded'}</Text>
              ) : (
                pnl.expense_breakdown.map((item, idx) => {
                  const pct = pnl.total_expenses > 0 ? (item.amount / pnl.total_expenses) * 100 : 0;
                  return (
                    <View key={idx} style={[styles.breakdownRow, idx % 2 === 0 && styles.breakdownRowAlt]}>
                      <View style={styles.breakdownName}>
                        <Text style={styles.breakdownNameText}>{isES ? item.name : item.name_en}</Text>
                        <View style={styles.breakdownBarBg}>
                          <View style={[styles.breakdownBarFill, { width: `${Math.min(pct, 100)}%` }]} />
                        </View>
                      </View>
                      <Text style={styles.breakdownLine}>{item.schedule_c_line}</Text>
                      <Text style={styles.breakdownAmount}>{formatCurrency(item.amount)}</Text>
                    </View>
                  );
                })
              )}

              {/* Total */}
              <View style={styles.breakdownTotal}>
                <Text style={styles.breakdownTotalLabel}>{isES ? 'Total Gastos' : 'Total Expenses'}</Text>
                <Text style={styles.breakdownTotalAmount}>{formatCurrency(pnl.total_expenses)}</Text>
              </View>
            </View>
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#312E81' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9FAFB' },
  header: { paddingTop: 8, paddingBottom: 20, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center' },
  backBtn: { marginRight: 12, padding: 4 },
  headerContent: { flex: 1 },
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#fff' },
  headerSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  scroll: { flex: 1, backgroundColor: '#F9FAFB' },
  scrollContent: { padding: 16 },
  yearSelector: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 16, gap: 20 },
  yearBtn: { padding: 8 },
  yearText: { fontSize: 22, fontWeight: '700', color: '#111827' },
  emptyContainer: { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 15, color: '#9CA3AF', marginTop: 12 },
  summaryCard: { backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 10, elevation: 3 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  summaryLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  summaryDot: { width: 10, height: 10, borderRadius: 5 },
  summaryLabel: { fontSize: 15, color: '#374151' },
  summaryAmount: { fontSize: 17, fontWeight: '700' },
  divider: { height: 1, backgroundColor: '#F3F4F6', marginVertical: 4 },
  dividerThick: { height: 2, backgroundColor: '#111827', marginVertical: 8 },
  netLabel: { fontSize: 17, fontWeight: '700', color: '#111827' },
  netAmount: { fontSize: 22, fontWeight: '800' },
  taxInfoCard: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#EEF2FF', padding: 14, borderRadius: 12, marginBottom: 16, gap: 10 },
  taxInfoText: { flex: 1, fontSize: 12, color: '#4338CA', lineHeight: 18 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#111827', marginBottom: 12 },
  breakdownCard: { backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 10, elevation: 3 },
  breakdownHeader: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#F9FAFB', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  breakdownHeaderText: { flex: 1, fontSize: 12, fontWeight: '600', color: '#6B7280', textTransform: 'uppercase' },
  noExpenses: { padding: 20, textAlign: 'center', color: '#9CA3AF', fontSize: 14 },
  breakdownRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F9FAFB' },
  breakdownRowAlt: { backgroundColor: '#FAFAFA' },
  breakdownName: { flex: 2, marginRight: 8 },
  breakdownNameText: { fontSize: 13, fontWeight: '500', color: '#374151', marginBottom: 4 },
  breakdownBarBg: { height: 4, backgroundColor: '#F3F4F6', borderRadius: 2, overflow: 'hidden' },
  breakdownBarFill: { height: '100%', backgroundColor: '#6366F1', borderRadius: 2 },
  breakdownLine: { width: 40, fontSize: 12, color: '#9CA3AF', textAlign: 'center' },
  breakdownAmount: { flex: 1, fontSize: 14, fontWeight: '600', color: '#111827', textAlign: 'right' },
  breakdownTotal: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#F3F4F6', borderTopWidth: 2, borderTopColor: '#E5E7EB' },
  breakdownTotalLabel: { fontSize: 15, fontWeight: '700', color: '#111827' },
  breakdownTotalAmount: { fontSize: 15, fontWeight: '700', color: '#EF4444' },
});
