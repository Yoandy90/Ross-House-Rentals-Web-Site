/**
 * Admin Loans — List and manage regulated loans
 */
import React from 'react';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl,
  SafeAreaView, ActivityIndicator, TouchableOpacity, Platform, TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../../src/constants/theme';
import { useAdminLoans } from '../../src/hooks/useAdminLoans';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n || 0);

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  active: { label: 'Activo', color: '#10B981' },
  paid_off: { label: 'Pagado', color: '#3B82F6' },
  delinquent: { label: 'En Mora', color: '#F59E0B' },
  default: { label: 'Incobrable', color: '#EF4444' },
  cancelled: { label: 'Cancelado', color: '#6B7280' },
};

const TYPE_ICONS: Record<string, string> = {
  subchapter_e: '🏦',
  subchapter_f: '💰',
  tax_advance: '📋',
};

export default function LoansScreen() {
  const router = useRouter();
  const { loans, loading, refreshing, refresh, search, setSearch, statusFilter, setStatusFilter } = useAdminLoans();

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primaryLight} />
        <Text style={styles.loadingText}>Cargando préstamos...</Text>
      </SafeAreaView>
    );
  }

  const activeCount = loans.filter(l => l.status === 'active').length;
  const totalBalance = loans.reduce((s, l) => s + (l.balance || 0), 0);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={Colors.primaryLight} />}
      >
        {/* HEADER */}
        <LinearGradient colors={['#059669', '#047857', '#065F46']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.headerBanner}>
          <View style={styles.headerContent}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="chevron-back" size={22} color="#fff" />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>Préstamos</Text>
              <Text style={styles.headerSubtitle}>{loans.length} total · {activeCount} activos · Balance: {fmt(totalBalance)}</Text>
            </View>
          </View>
        </LinearGradient>

        {/* SEARCH */}
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={Colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar por cliente, teléfono, # préstamo..."
            placeholderTextColor={Colors.textMuted}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* FILTER TABS */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          <View style={styles.filterRow}>
            {[
              { key: 'all', label: 'Todos' },
              { key: 'active', label: 'Activos' },
              { key: 'paid_off', label: 'Pagados' },
              { key: 'delinquent', label: 'En Mora' },
            ].map(f => (
              <TouchableOpacity key={f.key} onPress={() => setStatusFilter(f.key)}
                style={[styles.filterTab, statusFilter === f.key && styles.filterTabActive]}>
                <Text style={[styles.filterTabText, statusFilter === f.key && styles.filterTabTextActive]}>{f.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {/* LOANS LIST */}
        {loans.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🏦</Text>
            <Text style={styles.emptyText}>No se encontraron préstamos</Text>
          </View>
        ) : (
          loans.map(loan => {
            const statusCfg = STATUS_MAP[loan.status] || STATUS_MAP.active;
            const profit = (loan.total_interest || 0) + (loan.admin_fee || 0);
            return (
              <View key={loan._id} style={styles.loanCard}>
                <View style={styles.loanHeader}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={{ fontSize: 14 }}>{TYPE_ICONS[loan.loan_type] || '🏦'}</Text>
                      <Text style={styles.loanNumber}>{loan.loan_number}</Text>
                    </View>
                    <Text style={styles.clientName}>{loan.client_name}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: statusCfg.color + '15' }]}>
                    <View style={[styles.statusDot, { backgroundColor: statusCfg.color }]} />
                    <Text style={[styles.statusText, { color: statusCfg.color }]}>{statusCfg.label}</Text>
                  </View>
                </View>

                <View style={styles.loanMetrics}>
                  <View style={styles.metricItem}>
                    <Text style={styles.metricLabel}>Invertido</Text>
                    <Text style={styles.metricValue}>{fmt(loan.amount)}</Text>
                  </View>
                  <View style={styles.metricItem}>
                    <Text style={styles.metricLabel}>Balance</Text>
                    <Text style={[styles.metricValue, { color: Colors.accent }]}>{fmt(loan.balance)}</Text>
                  </View>
                  <View style={styles.metricItem}>
                    <Text style={styles.metricLabel}>Ganancia</Text>
                    <Text style={[styles.metricValue, { color: Colors.primaryLight }]}>{fmt(profit)}</Text>
                  </View>
                  <View style={styles.metricItem}>
                    <Text style={styles.metricLabel}>Pago/Mes</Text>
                    <Text style={styles.metricValue}>{fmt(loan.monthly_payment)}</Text>
                  </View>
                </View>
              </View>
            );
          })
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

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
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, gap: 10, borderWidth: 1, borderColor: Colors.border, marginBottom: 12 },
  searchInput: { flex: 1, fontSize: 14, color: Colors.text },
  filterScroll: { marginBottom: 16 },
  filterRow: { flexDirection: 'row', gap: 8 },
  filterTab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  filterTabActive: { backgroundColor: Colors.primaryLight + '15', borderColor: Colors.primaryLight + '40' },
  filterTabText: { fontSize: 12, color: Colors.textMuted, fontWeight: '600' },
  filterTabTextActive: { color: Colors.primaryLight },
  emptyContainer: { alignItems: 'center', paddingVertical: 48 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: Colors.textMuted, fontSize: 15 },
  loanCard: { backgroundColor: Colors.surface, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: Colors.border },
  loanHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14 },
  loanNumber: { fontSize: 13, fontWeight: '700', color: Colors.primaryLight },
  clientName: { fontSize: 16, fontWeight: '700', color: Colors.text, marginTop: 4 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, gap: 5 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: '700' },
  loanMetrics: { flexDirection: 'row', gap: 4 },
  metricItem: { flex: 1, backgroundColor: Colors.bg, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 8, alignItems: 'center' },
  metricLabel: { fontSize: 9, color: Colors.textMuted, fontWeight: '600', textTransform: 'uppercase', marginBottom: 4 },
  metricValue: { fontSize: 13, fontWeight: '800', color: Colors.text },
});
