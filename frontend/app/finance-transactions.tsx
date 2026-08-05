import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator,
  StyleSheet, TextInput, FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../services/api';

const C = {
  bg: '#F8F9FA', card: '#FFFFFF', text: '#1a1a2e', sub: '#6B7280',
  primary: '#007AFF', border: '#E5E7EB', success: '#2ECC71', danger: '#E74C3C',
};

const CATEGORIES = [
  { key: '', label: 'Todas', emoji: '📋' },
  { key: 'FOOD_AND_DRINK', label: 'Comida', emoji: '🍔' },
  { key: 'TRANSPORTATION', label: 'Transporte', emoji: '🚗' },
  { key: 'RENT_AND_UTILITIES', label: 'Renta', emoji: '🏠' },
  { key: 'ENTERTAINMENT', label: 'Streaming', emoji: '📺' },
  { key: 'GENERAL_MERCHANDISE', label: 'Compras', emoji: '🛍️' },
  { key: 'TRANSFER_OUT', label: 'Enviadas', emoji: '📤' },
  { key: 'TRANSFER_IN', label: 'Recibidas', emoji: '📥' },
  { key: 'LOAN_PAYMENTS', label: 'Préstamos', emoji: '🏦' },
  { key: 'INCOME', label: 'Ingresos', emoji: '💰' },
  { key: 'GOVERNMENT_AND_NON_PROFIT', label: 'Gobierno', emoji: '🏛️' },
  { key: 'TRAVEL', label: 'Viajes', emoji: '✈️' },
  { key: 'GENERAL_SERVICES', label: 'Servicios', emoji: '🔧' },
  { key: 'MEDICAL', label: 'Salud', emoji: '🏥' },
  { key: 'BANK_FEES', label: 'Cargos', emoji: '🏧' },
];

const fmt = (n: number) => '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function FinanceTransactionsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [skip, setSkip] = useState(0);
  const PAGE_SIZE = 30;

  const loadTransactions = useCallback(async (reset = false) => {
    const currentSkip = reset ? 0 : skip;
    if (reset) setLoading(true);
    else setLoadingMore(true);

    try {
      const params: any = { limit: PAGE_SIZE, skip: currentSkip };
      if (selectedCategory) params.category = selectedCategory;
      if (search.trim()) params.search = search.trim();

      const queryStr = Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(v as string)}`).join('&');
      const res = await api.get(`/my-finances/transactions?${queryStr}`);
      if (res.data.success) {
        if (reset) {
          setTransactions(res.data.transactions);
          setSkip(PAGE_SIZE);
        } else {
          setTransactions(prev => [...prev, ...res.data.transactions]);
          setSkip(currentSkip + PAGE_SIZE);
        }
        setTotal(res.data.total);
        setHasMore(res.data.has_more);
      }
    } catch (e) {
      console.error('Load transactions error:', e);
    }
    setLoading(false);
    setLoadingMore(false);
  }, [skip, selectedCategory, search]);

  useEffect(() => { loadTransactions(true); }, [selectedCategory]);

  const onSearch = () => { loadTransactions(true); };

  const renderTransaction = ({ item: txn }: { item: any }) => (
    <View style={s.txnRow}>
      <View style={[s.txnIcon, { backgroundColor: (txn.category_color || '#BDC3C7') + '20' }]}>
        <Text style={{ fontSize: 18 }}>{txn.category_emoji || '📋'}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.txnName} numberOfLines={1}>{txn.merchant_name || txn.name}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
          <View style={[s.categoryBadge, { backgroundColor: (txn.category_color || '#BDC3C7') + '20' }]}>
            <Text style={[s.categoryBadgeText, { color: txn.category_color || '#666' }]}>
              {txn.category_label || 'Sin categoría'}
            </Text>
          </View>
          <Text style={s.txnDate}>{txn.date}</Text>
        </View>
      </View>
      <Text style={[s.txnAmount, { color: txn.amount < 0 ? C.success : C.text }]}>
        {txn.amount < 0 ? '+' : '-'}{fmt(txn.amount)}
      </Text>
    </View>
  );

  return (
    <View style={s.container}>
      {/* Header */}
      <LinearGradient
        colors={['#1B5E20', '#2E7D32', '#388E3C']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0.5 }}
        style={[s.headerGradient, { paddingTop: insets.top + 8 }]}
      >
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.headerBack}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle}>Transacciones</Text>
            <Text style={s.headerSub}>{total} transacciones en total</Text>
          </View>
        </View>
      </LinearGradient>

      {/* Search Bar */}
      <View style={s.searchContainer}>
        <View style={s.searchBar}>
          <Ionicons name="search" size={18} color={C.sub} />
          <TextInput
            style={s.searchInput}
            placeholder="Buscar transacción..."
            placeholderTextColor={C.sub}
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={onSearch}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => { setSearch(''); setTimeout(() => loadTransactions(true), 100); }}>
              <Ionicons name="close-circle" size={18} color={C.sub} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Category Filter Pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0, flexShrink: 0, height: 52, backgroundColor: C.bg }}
        contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 6, alignItems: 'center' }}
      >
        {CATEGORIES.map(cat => (
          <TouchableOpacity
            key={cat.key}
            onPress={() => setSelectedCategory(cat.key)}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 0,
              backgroundColor: selectedCategory === cat.key ? '#E8F5E9' : C.card,
              borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8,
              borderWidth: 1.5, borderColor: selectedCategory === cat.key ? '#2E7D32' : C.border,
              marginRight: 8,
            }}
          >
            <Text style={{ fontSize: 14 }}>{cat.emoji}</Text>
            <Text style={{ fontSize: 12, fontWeight: '600', color: selectedCategory === cat.key ? '#2E7D32' : C.sub }}>
              {cat.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Transactions List */}
      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={C.primary} />
          <Text style={{ color: C.sub, marginTop: 10 }}>Cargando transacciones...</Text>
        </View>
      ) : (
        <FlatList
          data={transactions}
          renderItem={renderTransaction}
          keyExtractor={(item) => item.transaction_id || Math.random().toString()}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 20 }}
          onEndReached={() => { if (hasMore && !loadingMore) loadTransactions(false); }}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingTop: 60 }}>
              <Text style={{ fontSize: 48 }}>🔍</Text>
              <Text style={{ fontSize: 16, fontWeight: '700', color: C.text, marginTop: 12 }}>Sin resultados</Text>
              <Text style={{ fontSize: 13, color: C.sub, marginTop: 4 }}>No se encontraron transacciones con estos filtros</Text>
            </View>
          }
          ListFooterComponent={
            loadingMore ? (
              <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                <ActivityIndicator size="small" color={C.primary} />
              </View>
            ) : hasMore ? (
              <TouchableOpacity style={s.loadMoreBtn} onPress={() => loadTransactions(false)}>
                <Text style={s.loadMoreText}>Cargar más transacciones</Text>
              </TouchableOpacity>
            ) : transactions.length > 0 ? (
              <Text style={{ textAlign: 'center', color: C.sub, fontSize: 12, paddingVertical: 16 }}>
                — Fin de las transacciones —
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
  headerGradient: { paddingBottom: 16 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  headerBack: { padding: 4 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#fff' },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 1 },

  searchContainer: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: C.card,
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, gap: 8,
    borderWidth: 1, borderColor: C.border,
  },
  searchInput: { flex: 1, fontSize: 14, color: C.text, padding: 0 },

  filterRow: { paddingHorizontal: 16, paddingVertical: 10, gap: 10, alignItems: 'center' as const },
  filterPill: {
    flexDirection: 'row' as const, alignItems: 'center' as const, alignSelf: 'center' as const, gap: 6,
    backgroundColor: C.card, borderRadius: 22, paddingHorizontal: 16, height: 40,
    borderWidth: 1.5, borderColor: C.border,
  },
  filterPillActive: { backgroundColor: '#E8F5E9', borderColor: '#2E7D32' },
  filterPillText: { fontSize: 13, fontWeight: '600', color: C.sub },
  filterPillTextActive: { color: '#2E7D32' },

  txnRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: C.border,
  },
  txnIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  txnName: { fontSize: 14, fontWeight: '600', color: C.text },
  txnDate: { fontSize: 11, color: C.sub },
  txnAmount: { fontSize: 15, fontWeight: '700' },
  categoryBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  categoryBadgeText: { fontSize: 10, fontWeight: '600' },

  loadMoreBtn: {
    alignItems: 'center', paddingVertical: 14, marginTop: 8,
    backgroundColor: C.primary + '10', borderRadius: 12,
  },
  loadMoreText: { fontSize: 13, fontWeight: '600', color: C.primary },
});
