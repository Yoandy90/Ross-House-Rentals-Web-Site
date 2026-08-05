/**
 * Transacciones - Transaction List for Mi Negocio
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Platform, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../services/api';

const C = {
  bg: '#F2F2F7', card: '#FFFFFF', text: '#1C1C1E', sub: '#636366',
  muted: '#AEAEB2', border: '#E5E5EA', brand: '#8B1A1A',
  success: '#34C759', blue: '#007AFF',
};

const MONTHS_ES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

interface Transaction {
  id: string;
  name: string;
  amount: number;
  date: string;
  category?: string[];
  merchant_name?: string;
  pending: boolean;
}

export default function TransactionsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'income' | 'expense'>('all');

  const loadTransactions = useCallback(async () => {
    try {
      const res = await api.get('/my-business');
      if (res.data && res.data.recent_transactions) {
        setTransactions(res.data.recent_transactions);
      }
    } catch (e) {
      console.log('Error loading transactions:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadTransactions(); }, [loadTransactions]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadTransactions();
  }, [loadTransactions]);

  const syncTransactions = async (forceRefresh = false) => {
    setSyncing(true);
    try {
      const res = await api.post('/plaid/sync-transactions', { force_refresh: forceRefresh });
      const d = res.data;
      const total = d.total_changes || d.transactions_added || 0;
      if (total > 0) {
        const parts = [];
        if (d.transactions_added > 0) parts.push(`${d.transactions_added} nuevas`);
        if (d.transactions_modified > 0) parts.push(`${d.transactions_modified} actualizadas`);
        if (d.transactions_removed > 0) parts.push(`${d.transactions_removed} eliminadas`);
        Alert.alert('✅ Sincronizado', parts.join(', '));
      } else {
        Alert.alert('✅ Al día', d.message || 'No hay transacciones nuevas. Los bancos pueden tardar 24-48h.');
      }
      loadTransactions();
    } catch (e) {
      Alert.alert('Error', 'No se pudieron sincronizar las transacciones. Verifica tu conexión bancaria.');
    } finally {
      setSyncing(false);
    }
  };

  const filtered = transactions.filter(t => {
    if (filter === 'income') return t.amount < 0; // Plaid: negative = income to user
    if (filter === 'expense') return t.amount > 0;
    return true;
  });

  const totalIncome = transactions.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
  const totalExpense = transactions.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return `${d.getDate()} ${MONTHS_ES[d.getMonth()]}`;
    } catch { return dateStr; }
  };

  if (loading) {
    return (
      <View style={[s.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={C.brand} />
      </View>
    );
  }

  return (
    <View style={s.container}>
      <LinearGradient
        colors={['#0D47A1', '#1976D2', '#42A5F5']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0.5 }}
        style={[s.headerGradient, { paddingTop: insets.top + 8 }]}
      >
        <View style={s.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle}>Transacciones</Text>
            <Text style={s.headerSub}>{transactions.length} movimientos</Text>
          </View>
          <TouchableOpacity onPress={syncTransactions} style={s.syncBtn} disabled={syncing}>
            {syncing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="sync" size={20} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 20 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.blue} />}
      >
        {/* Summary Cards */}
        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
          <View style={[s.statCard, { flex: 1 }]}>
            <Text style={{ fontSize: 11, color: C.sub }}>Ingresos</Text>
            <Text style={{ fontSize: 20, fontWeight: '800', color: C.success }}>${totalIncome.toLocaleString()}</Text>
          </View>
          <View style={[s.statCard, { flex: 1 }]}>
            <Text style={{ fontSize: 11, color: C.sub }}>Gastos</Text>
            <Text style={{ fontSize: 20, fontWeight: '800', color: '#EF4444' }}>${totalExpense.toLocaleString()}</Text>
          </View>
        </View>

        {/* Filter Tabs */}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
          {(['all', 'income', 'expense'] as const).map(f => (
            <TouchableOpacity
              key={f}
              onPress={() => setFilter(f)}
              style={[s.filterTab, filter === f && s.filterTabActive]}
            >
              <Text style={[s.filterText, filter === f && s.filterTextActive]}>
                {f === 'all' ? 'Todos' : f === 'income' ? 'Ingresos' : 'Gastos'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Transactions List */}
        {filtered.length === 0 ? (
          <View style={[s.statCard, { alignItems: 'center', paddingVertical: 40 }]}>
            <Text style={{ fontSize: 48 }}>📊</Text>
            <Text style={{ fontSize: 16, fontWeight: '700', color: C.text, marginTop: 12 }}>Sin transacciones</Text>
            <Text style={{ fontSize: 13, color: C.sub, marginTop: 6, textAlign: 'center' }}>
              Conecta tu cuenta bancaria y sincroniza para ver tus transacciones aquí
            </Text>
            <TouchableOpacity onPress={syncTransactions} style={[s.syncBtnLarge, { marginTop: 16 }]}>
              <Ionicons name="sync" size={18} color="#fff" />
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff' }}>Sincronizar Ahora</Text>
            </TouchableOpacity>
          </View>
        ) : (
          filtered.map((tx, idx) => {
            const isIncome = tx.amount < 0;
            return (
              <View key={tx.id || idx} style={[s.txItem, { marginBottom: 8 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={[s.txIcon, { backgroundColor: isIncome ? '#E8F9ED' : '#FFF0F0' }]}>
                    <Ionicons
                      name={isIncome ? 'arrow-down' : 'arrow-up'}
                      size={18}
                      color={isIncome ? C.success : '#EF4444'}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: C.text }} numberOfLines={1}>
                      {tx.merchant_name || tx.name}
                    </Text>
                    <Text style={{ fontSize: 11, color: C.sub }}>
                      {formatDate(tx.date)}{tx.pending ? ' • Pendiente' : ''}
                      {tx.category?.[0] ? ` • ${tx.category[0]}` : ''}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: isIncome ? C.success : '#EF4444' }}>
                    {isIncome ? '+' : '-'}${Math.abs(tx.amount).toLocaleString()}
                  </Text>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  headerGradient: {},
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, paddingBottom: 16 },
  backBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#fff' },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  syncBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  syncBtnLarge: { flexDirection: 'row', gap: 8, backgroundColor: C.blue, paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12, alignItems: 'center' },
  statCard: {
    backgroundColor: C.card, borderRadius: 14, padding: 14,
    ...Platform.select({ ios: { shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } }, android: { elevation: 2 } }),
  },
  filterTab: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, backgroundColor: C.card },
  filterTabActive: { backgroundColor: C.blue },
  filterText: { fontSize: 13, fontWeight: '600', color: C.sub },
  filterTextActive: { color: '#fff' },
  txItem: {
    backgroundColor: C.card, borderRadius: 14, padding: 14,
    ...Platform.select({ ios: { shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } }, android: { elevation: 1 } }),
  },
  txIcon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
});
