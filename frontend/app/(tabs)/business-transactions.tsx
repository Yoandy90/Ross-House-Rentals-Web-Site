/**
 * Business Transactions - View and filter business transactions (Plaid)
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import api from '../../services/api';
import { useTranslation } from 'react-i18next';

const MONTHS_ES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const CATEGORY_LABELS: Record<string, [string, string]> = {
  TRANSFER_OUT: ['📤', 'Transferencia enviada'],
  TRANSFER_IN: ['📥', 'Transferencia recibida'],
  GENERAL_SERVICES: ['🔧', 'Servicios generales'],
  GENERAL_MERCHANDISE: ['🛍️', 'Mercancía'],
  FOOD_AND_DRINK: ['🍔', 'Comida y bebida'],
  TRANSPORTATION: ['🚗', 'Transporte'],
  RENT_AND_UTILITIES: ['🏠', 'Renta y servicios'],
  ENTERTAINMENT: ['🎬', 'Entretenimiento'],
  LOAN_PAYMENTS: ['🏦', 'Pagos de préstamo'],
  GOVERNMENT_AND_NON_PROFIT: ['🏛️', 'Gobierno'],
  TRAVEL: ['✈️', 'Viajes'],
  MEDICAL: ['🏥', 'Médico'],
  BANK_FEES: ['🏧', 'Cargos bancarios'],
  INCOME: ['💰', 'Ingreso'],
  PERSONAL_CARE: ['💇', 'Cuidado personal'],
  HOME_IMPROVEMENT: ['🏡', 'Hogar'],
};

const C = {
  bg: '#F0F2F5', card: '#FFFFFF', text: '#1a1a2e', sub: '#6B7280',
  primary: '#1a73e8', accent: '#4285f4', border: '#E5E7EB',
  income: '#0F9D58', expense: '#EA4335',
};

const fmt = (n: number) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function BusinessTransactionsScreen() {
  const { i18n: i18nInstance } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isES = i18nInstance.language === 'es';
  const MONTHS = isES ? MONTHS_ES : MONTHS_EN;
  const now = new Date();

  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [total, setTotal] = useState(0);
  const [totals, setTotals] = useState({ income: 0, expenses: 0 });
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(0);
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [filterType, setFilterType] = useState('all');
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');

  const PAGE_SIZE = 30;

  const fetchTransactions = useCallback(async (skipVal = 0, append = false) => {
    if (!append) setLoading(true);
    setError('');
    try {
      const m = selectedMonth;
      const y = selectedYear;
      const startDate = `${y}-${String(m).padStart(2, '0')}-01`;
      const nextM = m === 12 ? 1 : m + 1;
      const nextY = m === 12 ? y + 1 : y;
      const endDate = `${nextY}-${String(nextM).padStart(2, '0')}-01`;

      let url = `/plaid/transactions?context=business&limit=${PAGE_SIZE}&skip=${skipVal}&start_date=${startDate}&end_date=${endDate}`;

      console.log('[BizTxn] Fetching:', url);
      const res = await api.get(url);
      const data = res.data;

      if (data && data.success !== false) {
        const txns = (data.transactions || []).map((t: any) => {
          const catInfo = CATEGORY_LABELS[t.category] || ['📋', t.category || 'Otro'];
          return {
            id: t.transaction_id || t._id || `${t.date}-${t.amount}-${Math.random()}`,
            date: t.date,
            name: t.merchant_name || t.name || 'Desconocido',
            amount: t.amount,
            isIncome: t.amount < 0,
            category: t.category || 'OTHER',
            categoryLabel: catInfo[1],
            categoryEmoji: catInfo[0],
          };
        });

        if (append) {
          setTransactions(prev => [...prev, ...txns]);
        } else {
          setTransactions(txns);
        }
        setTotal(data.total_count || txns.length);
        setTotals(data.totals || { income: 0, expenses: 0 });
        setHasMore(txns.length === PAGE_SIZE);
      } else {
        if (!append) setTransactions([]);
        setError(data?.detail || '');
        console.warn('[BizTxn] API returned failure:', data);
      }
    } catch (err: any) {
      console.error('[BizTxn] Fetch error:', err?.message || err);
      setError(err?.response?.data?.detail || err?.message || 'Error de conexión');
      if (!append) setTransactions([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedMonth, selectedYear]);

  useEffect(() => {
    setPage(0);
    fetchTransactions(0, false);
  }, [selectedMonth, selectedYear, filterType]);

  const loadMore = () => {
    if (hasMore && !loading) {
      const nextSkip = page + PAGE_SIZE;
      setPage(nextSkip);
      fetchTransactions(nextSkip, true);
    }
  };

  const syncTransactions = async (forceRefresh = false) => {
    setSyncing(true);
    try {
      const res = await api.post('/plaid/sync-transactions', { context: 'business', force_refresh: forceRefresh });
      const d = res.data;
      const total = d.total_changes || d.transactions_added || 0;
      if (total > 0) {
        const parts = [];
        if (d.transactions_added > 0) parts.push(`${d.transactions_added} nuevas`);
        if (d.transactions_modified > 0) parts.push(`${d.transactions_modified} actualizadas`);
        if (d.transactions_removed > 0) parts.push(`${d.transactions_removed} eliminadas`);
        Alert.alert('✅ Sincronizado', parts.join(', '));
      } else {
        Alert.alert('✅ Al día', d.message || 'No hay transacciones nuevas.');
      }
      fetchTransactions(0, false);
    } catch (e) {
      Alert.alert('Error', 'No se pudieron sincronizar las transacciones.');
    } finally {
      setSyncing(false);
    }
  };

  const filteredTxns = filterType === 'all' ? transactions
    : filterType === 'income' ? transactions.filter(t => t.isIncome)
    : transactions.filter(t => !t.isIncome);

  const renderTransaction = ({ item: txn }: any) => (
    <View style={s.txnRow}>
      <View style={[s.txnIcon, { backgroundColor: txn.isIncome ? '#E8F5E9' : '#FFEBEE' }]}>
        <Text style={{ fontSize: 18 }}>{txn.categoryEmoji}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.txnName} numberOfLines={1}>{txn.name}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
          <Text style={s.txnCategory}>{txn.categoryLabel}</Text>
          <Text style={s.txnDate}>{txn.date}</Text>
        </View>
      </View>
      <Text style={[s.txnAmount, { color: txn.isIncome ? C.income : C.expense }]}>
        {txn.isIncome ? '+' : '-'}{fmt(Math.abs(txn.amount))}
      </Text>
    </View>
  );

  return (
    <View style={[s.container, { paddingTop: 0 }]}>
      {/* Header */}
      <LinearGradient colors={['#0D47A1', '#1565C0', '#1976D2']} style={[s.header, { paddingTop: insets.top + 8 }]}>
        <View style={s.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle}>{isES ? 'Transacciones' : 'Transactions'}</Text>
            <Text style={s.headerSub}>{total} {isES ? 'movimientos' : 'movements'} · {MONTHS[selectedMonth - 1]} {selectedYear}</Text>
          </View>
          <TouchableOpacity onPress={syncTransactions} disabled={syncing} style={s.syncBtn}>
            {syncing ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="sync" size={20} color="#fff" />}
          </TouchableOpacity>
        </View>

        {/* Summary Cards inside header */}
        <View style={s.summaryRow}>
          <View style={[s.summaryCard, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
            <Text style={s.summaryLabel}>{isES ? 'Ingresos' : 'Income'}</Text>
            <Text style={[s.summaryValue, { color: '#A5D6A7' }]}>{fmt(totals.income)}</Text>
          </View>
          <View style={[s.summaryCard, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
            <Text style={s.summaryLabel}>{isES ? 'Gastos' : 'Expenses'}</Text>
            <Text style={[s.summaryValue, { color: '#EF9A9A' }]}>{fmt(totals.expenses)}</Text>
          </View>
        </View>
      </LinearGradient>

      {/* Month selector pills */}
      <View style={{ backgroundColor: C.bg }}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={MONTHS}
          keyExtractor={(_, i) => String(i)}
          contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 12, paddingBottom: 10 }}
          initialScrollIndex={Math.max(0, selectedMonth - 3)}
          getItemLayout={(_, i) => ({ length: 56, offset: 56 * i, index: i })}
          renderItem={({ item: monthName, index }) => {
            const active = index + 1 === selectedMonth;
            return (
              <TouchableOpacity
                onPress={() => setSelectedMonth(index + 1)}
                style={[s.monthPill, active && s.monthPillActive, { marginRight: 8 }]}
              >
                <Text style={[s.monthPillText, active && s.monthPillTextActive]}>{monthName}</Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {/* Filter tabs */}
      <View style={s.filterRow}>
        {[
          { key: 'all', label: isES ? 'Todos' : 'All' },
          { key: 'income', label: isES ? 'Ingresos' : 'Income' },
          { key: 'expense', label: isES ? 'Gastos' : 'Expenses' },
        ].map(f => (
          <TouchableOpacity
            key={f.key}
            style={[s.filterTab, filterType === f.key && s.filterTabActive]}
            onPress={() => setFilterType(f.key)}
          >
            <Text style={[s.filterTabText, filterType === f.key && s.filterTabTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Error display */}
      {error ? (
        <View style={s.errorBox}>
          <Ionicons name="warning" size={16} color="#D32F2F" />
          <Text style={s.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => fetchTransactions(0, false)}>
            <Text style={{ color: C.primary, fontWeight: '600', fontSize: 13 }}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Transaction List */}
      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={C.primary} />
        </View>
      ) : (
        <FlatList
          data={filteredTxns}
          renderItem={renderTransaction}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 20 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchTransactions(0, false); }} />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={
            <View style={s.emptyBox}>
              <Text style={{ fontSize: 48 }}>📋</Text>
              <Text style={s.emptyTitle}>{isES ? 'Sin transacciones' : 'No transactions'}</Text>
              <Text style={s.emptySub}>
                {isES ? `No hay movimientos en ${MONTHS[selectedMonth - 1]} ${selectedYear}` : `No movements in ${MONTHS[selectedMonth - 1]} ${selectedYear}`}
              </Text>
              <TouchableOpacity style={s.emptyBtn} onPress={syncTransactions}>
                <Ionicons name="sync" size={18} color="#fff" />
                <Text style={s.emptyBtnText}>{isES ? 'Sincronizar Ahora' : 'Sync Now'}</Text>
              </TouchableOpacity>
            </View>
          }
          ListFooterComponent={
            hasMore ? (
              <View style={{ paddingVertical: 16, alignItems: 'center' }}>
                <ActivityIndicator size="small" color={C.primary} />
              </View>
            ) : filteredTxns.length > 0 ? (
              <Text style={{ textAlign: 'center', color: C.sub, fontSize: 12, paddingVertical: 16 }}>
                — {isES ? 'Fin de las transacciones' : 'End of transactions'} —
              </Text>
            ) : null
          }
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: { paddingBottom: 16, paddingHorizontal: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#fff' },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  syncBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },

  summaryRow: { flexDirection: 'row', gap: 10 },
  summaryCard: { flex: 1, borderRadius: 12, padding: 12, alignItems: 'center' },
  summaryLabel: { fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: '600' },
  summaryValue: { fontSize: 18, fontWeight: '800', marginTop: 2 },

  monthRow: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 10 },
  monthPill: { width: 50, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8EAF6' },
  monthPillActive: { backgroundColor: '#1565C0' },
  monthPillText: { fontSize: 12, fontWeight: '600', color: C.sub },
  monthPillTextActive: { color: '#fff' },

  filterRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginTop: 10, marginBottom: 12 },
  filterTab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 10, backgroundColor: C.card, borderWidth: 1, borderColor: C.border },
  filterTabActive: { backgroundColor: '#E3F2FD', borderColor: '#1565C0' },
  filterTabText: { fontSize: 13, fontWeight: '600', color: C.sub },
  filterTabTextActive: { color: '#1565C0' },

  txnRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: C.border },
  txnIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  txnName: { fontSize: 14, fontWeight: '600', color: C.text },
  txnCategory: { fontSize: 11, color: C.primary, fontWeight: '500', backgroundColor: '#E3F2FD', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },
  txnDate: { fontSize: 11, color: C.sub },
  txnAmount: { fontSize: 15, fontWeight: '700' },

  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginVertical: 6, padding: 10, backgroundColor: '#FFEBEE', borderRadius: 10 },
  errorText: { flex: 1, fontSize: 12, color: '#D32F2F' },

  emptyBox: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: C.text, marginTop: 12 },
  emptySub: { fontSize: 13, color: C.sub, marginTop: 4, textAlign: 'center' },
  emptyBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 20, backgroundColor: C.primary, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
  emptyBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});
