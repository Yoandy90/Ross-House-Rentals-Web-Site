/**
 * Admin — Baúl Seguro (Payment Methods Vault)
 * View, search, edit, and manage ALL client payment methods
 * with active loan protection on deletion
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, Modal, RefreshControl, Platform, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import api from '../../services/api';

const { width: SW } = Dimensions.get('window');

const C = {
  bg: '#0F172A',
  card: '#1E293B',
  border: '#334155',
  brand: '#C41E3A',
  accent: '#22D3EE',
  white: '#F1F5F9',
  sub: '#94A3B8',
  muted: '#64748B',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  info: '#3B82F6',
  purple: '#8B5CF6',
};

interface PaymentMethod {
  _id: string;
  user_id: string;
  type: 'bank' | 'card';
  bank_name?: string;
  account_last4?: string;
  card_last4?: string;
  card_brand?: string;
  card_exp?: string;
  account_type?: string;
  routing_number?: string;
  is_default: boolean;
  created_at?: string;
  user_info?: {
    name: string;
    email: string;
    phone: string;
  };
  linked_loans: Array<{
    loan_id: string;
    loan_number: string;
    amount: number;
    status: string;
  }>;
  has_active_links: boolean;
}

interface VaultStats {
  total_methods: number;
  bank_accounts: number;
  cards: number;
  unique_users: number;
}

export default function BaulSeguro() {
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [stats, setStats] = useState<VaultStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Edit modal
  const [editMethod, setEditMethod] = useState<PaymentMethod | null>(null);
  const [editBankName, setEditBankName] = useState('');
  const [editAccountType, setEditAccountType] = useState('checking');
  const [editRouting, setEditRouting] = useState('');
  const [editAccount, setEditAccount] = useState('');
  const [saving, setSaving] = useState(false);

  // Detail modal
  const [detailMethod, setDetailMethod] = useState<PaymentMethod | null>(null);

  const fetchStats = async () => {
    try {
      const res = await api.get('/loans/admin/vault/stats');
      setStats(res.data);
    } catch {}
  };

  const fetchMethods = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const params: any = { page, limit: 50 };
      if (search) params.search = search;
      if (typeFilter) params.type_filter = typeFilter;

      const res = await api.get('/loans/admin/vault', { params });
      setMethods(res.data.methods || []);
      setTotalPages(res.data.pages || 1);
      setTotal(res.data.total || 0);
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.detail || 'Error cargando métodos');
    }

    setLoading(false);
    setRefreshing(false);
  }, [search, typeFilter, page]);

  useEffect(() => { fetchStats(); }, []);
  useEffect(() => { fetchMethods(); }, [fetchMethods]);

  // Debounced search
  const [searchTimer, setSearchTimer] = useState<any>(null);
  const handleSearch = (text: string) => {
    setSearch(text);
    if (searchTimer) clearTimeout(searchTimer);
    setSearchTimer(setTimeout(() => {
      setPage(1);
    }, 500));
  };

  // ═══ EDIT ═══
  const openEdit = (m: PaymentMethod) => {
    setEditMethod(m);
    setEditBankName(m.bank_name || '');
    setEditAccountType(m.account_type || 'checking');
    setEditRouting(m.routing_number || '');
    setEditAccount('');
  };

  const handleSaveEdit = async () => {
    if (!editMethod) return;
    setSaving(true);
    try {
      const body: any = {};
      if (editBankName) body.bank_name = editBankName;
      if (editAccountType) body.account_type = editAccountType;
      if (editRouting) body.routing_number = editRouting;
      if (editAccount) body.account_number_encrypted = editAccount;

      await api.put(`/loans/admin/vault/${editMethod._id}`, body);
      Alert.alert('✅ Actualizado', 'Método de pago actualizado');
      setEditMethod(null);
      fetchMethods();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.detail || 'No se pudo actualizar');
    }
    setSaving(false);
  };

  // ═══ DELETE ═══
  const handleDelete = (m: PaymentMethod) => {
    const name = m.bank_name || m.card_brand || 'Método';
    const last4 = m.account_last4 || m.card_last4 || '****';

    if (m.has_active_links) {
      Alert.alert(
        '⚠️ Método Vinculado',
        `"${name} ····${last4}" está vinculado a ${m.linked_loans.length} préstamo(s) activo(s):\n${m.linked_loans.map(l => `• ${l.loan_number} ($${l.amount})`).join('\n')}\n\n¿Forzar eliminación?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Forzar Eliminación', style: 'destructive',
            onPress: () => doDelete(m._id, true),
          },
        ]
      );
    } else {
      Alert.alert(
        '🗑️ Eliminar Método',
        `¿Eliminar "${name} ····${last4}"?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Eliminar', style: 'destructive', onPress: () => doDelete(m._id, false) },
        ]
      );
    }
  };

  const doDelete = async (id: string, force: boolean) => {
    try {
      await api.delete(`/loans/admin/vault/${id}`, { params: { force } });
      Alert.alert('✅ Eliminado', 'Método eliminado del baúl');
      fetchMethods();
      fetchStats();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.detail || 'No se pudo eliminar');
    }
  };

  // ═══ SET DEFAULT ═══
  const handleToggleDefault = async (m: PaymentMethod) => {
    try {
      await api.put(`/loans/admin/vault/${m._id}`, { is_default: !m.is_default });
      fetchMethods();
    } catch {}
  };

  const fmt = (n: number) => `$${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;

  return (
    <>
      <Stack.Screen options={{ title: 'Baúl Seguro' }} />
      <SafeAreaView style={S.container} edges={['bottom']}>
        <ScrollView
          contentContainerStyle={S.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchMethods(true)} tintColor={C.accent} />}
        >
          {/* ═══ HEADER ═══ */}
          <View style={S.header}>
            <View style={S.headerIcon}>
              <Ionicons name="shield-checkmark" size={28} color={C.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={S.headerTitle}>Baúl Seguro</Text>
              <Text style={S.headerSub}>Métodos de pago de todos los clientes</Text>
            </View>
            <Ionicons name="lock-closed" size={20} color={C.accent} />
          </View>

          {/* ═══ STATS ═══ */}
          {stats && (
            <View style={S.statsRow}>
              <View style={S.statCard}>
                <Ionicons name="wallet-outline" size={20} color={C.accent} />
                <Text style={S.statNum}>{stats.total_methods}</Text>
                <Text style={S.statLabel}>Total</Text>
              </View>
              <View style={S.statCard}>
                <Ionicons name="business-outline" size={20} color={C.success} />
                <Text style={S.statNum}>{stats.bank_accounts}</Text>
                <Text style={S.statLabel}>Bancos</Text>
              </View>
              <View style={S.statCard}>
                <Ionicons name="card-outline" size={20} color={C.purple} />
                <Text style={S.statNum}>{stats.cards}</Text>
                <Text style={S.statLabel}>Tarjetas</Text>
              </View>
              <View style={S.statCard}>
                <Ionicons name="people-outline" size={20} color={C.warning} />
                <Text style={S.statNum}>{stats.unique_users}</Text>
                <Text style={S.statLabel}>Clientes</Text>
              </View>
            </View>
          )}

          {/* ═══ SEARCH & FILTERS ═══ */}
          <View style={S.searchRow}>
            <View style={S.searchBox}>
              <Ionicons name="search" size={18} color={C.muted} />
              <TextInput
                style={S.searchInput}
                placeholder="Buscar por nombre, último 4, email..."
                placeholderTextColor={C.muted}
                value={search}
                onChangeText={handleSearch}
              />
              {search ? (
                <TouchableOpacity onPress={() => { setSearch(''); setPage(1); }}>
                  <Ionicons name="close-circle" size={18} color={C.muted} />
                </TouchableOpacity>
              ) : null}
            </View>
          </View>

          <View style={S.filterRow}>
            {[
              { key: '', label: 'Todos', icon: 'wallet-outline' as const },
              { key: 'bank', label: 'Bancos', icon: 'business-outline' as const },
              { key: 'card', label: 'Tarjetas', icon: 'card-outline' as const },
            ].map(f => (
              <TouchableOpacity
                key={f.key}
                style={[S.filterBtn, typeFilter === f.key && S.filterBtnActive]}
                onPress={() => { setTypeFilter(f.key); setPage(1); }}
              >
                <Ionicons name={f.icon} size={14} color={typeFilter === f.key ? C.accent : C.muted} />
                <Text style={[S.filterText, typeFilter === f.key && S.filterTextActive]}>{f.label}</Text>
              </TouchableOpacity>
            ))}
            <View style={{ flex: 1 }} />
            <Text style={S.resultCount}>{total} resultado{total !== 1 ? 's' : ''}</Text>
          </View>

          {/* ═══ METHODS LIST ═══ */}
          {loading ? (
            <ActivityIndicator color={C.accent} size="large" style={{ marginTop: 40 }} />
          ) : methods.length === 0 ? (
            <View style={S.empty}>
              <Ionicons name="file-tray-outline" size={48} color={C.muted} />
              <Text style={S.emptyText}>No se encontraron métodos de pago</Text>
            </View>
          ) : (
            methods.map((m) => {
              const isBank = m.type === 'bank';
              const name = m.bank_name || m.card_brand || 'Método';
              const last4 = m.account_last4 || m.card_last4 || '****';
              const user = m.user_info;

              return (
                <View key={m._id} style={[S.methodCard, m.has_active_links && S.methodCardLinked]}>
                  {/* Top row: icon + name + actions */}
                  <View style={S.methodTop}>
                    <View style={[S.methodIcon, !isBank && { backgroundColor: 'rgba(139,92,246,0.1)' }]}>
                      <Ionicons
                        name={isBank ? 'business-outline' : 'card-outline'}
                        size={22}
                        color={isBank ? C.success : C.purple}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={S.methodName}>{name}</Text>
                      <Text style={S.methodLast4}>····{last4}
                        {m.account_type ? ` · ${m.account_type === 'checking' ? 'Corriente' : 'Ahorros'}` : ''}
                        {m.card_exp ? ` · Exp: ${m.card_exp}` : ''}
                      </Text>
                    </View>
                    <View style={S.methodBadges}>
                      {m.is_default && (
                        <View style={S.badge}><Text style={S.badgeText}>Principal</Text></View>
                      )}
                      {m.has_active_links && (
                        <View style={[S.badge, { backgroundColor: 'rgba(239,68,68,0.15)' }]}>
                          <Ionicons name="link-outline" size={10} color={C.danger} />
                          <Text style={[S.badgeText, { color: C.danger }]}>Vinculado</Text>
                        </View>
                      )}
                    </View>
                  </View>

                  {/* Client info */}
                  {user && (
                    <View style={S.clientRow}>
                      <Ionicons name="person-outline" size={14} color={C.muted} />
                      <Text style={S.clientText}>{user.name}</Text>
                      <Text style={S.clientEmail}>{user.email}</Text>
                    </View>
                  )}

                  {/* Routing number (admin can see) */}
                  {isBank && m.routing_number && (
                    <View style={S.routingRow}>
                      <Text style={S.routingLabel}>Routing:</Text>
                      <Text style={S.routingValue}>{m.routing_number}</Text>
                    </View>
                  )}

                  {/* Linked loans */}
                  {m.linked_loans && m.linked_loans.length > 0 && (
                    <View style={S.linkedSection}>
                      {m.linked_loans.map((loan, i) => (
                        <View key={i} style={S.linkedPill}>
                          <Ionicons name="document-text-outline" size={12} color={C.warning} />
                          <Text style={S.linkedText}>{loan.loan_number} · {fmt(loan.amount)}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Actions */}
                  <View style={S.actionRow}>
                    <TouchableOpacity style={S.actionBtn} onPress={() => handleToggleDefault(m)}>
                      <Ionicons name={m.is_default ? 'star' : 'star-outline'} size={16} color={C.warning} />
                      <Text style={S.actionText}>{m.is_default ? 'Quitar Principal' : 'Hacer Principal'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={S.actionBtn} onPress={() => openEdit(m)}>
                      <Ionicons name="create-outline" size={16} color={C.info} />
                      <Text style={[S.actionText, { color: C.info }]}>Editar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={S.actionBtn} onPress={() => handleDelete(m)}>
                      <Ionicons name="trash-outline" size={16} color={C.danger} />
                      <Text style={[S.actionText, { color: C.danger }]}>Eliminar</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}

          {/* ═══ PAGINATION ═══ */}
          {totalPages > 1 && (
            <View style={S.pagination}>
              <TouchableOpacity
                style={[S.pageBtn, page === 1 && { opacity: 0.3 }]}
                onPress={() => page > 1 && setPage(page - 1)}
                disabled={page === 1}
              >
                <Ionicons name="chevron-back" size={18} color={C.white} />
              </TouchableOpacity>
              <Text style={S.pageText}>Página {page} de {totalPages}</Text>
              <TouchableOpacity
                style={[S.pageBtn, page === totalPages && { opacity: 0.3 }]}
                onPress={() => page < totalPages && setPage(page + 1)}
                disabled={page === totalPages}
              >
                <Ionicons name="chevron-forward" size={18} color={C.white} />
              </TouchableOpacity>
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>

        {/* ═══ EDIT MODAL ═══ */}
        <Modal visible={!!editMethod} transparent animationType="fade" onRequestClose={() => setEditMethod(null)}>
          <View style={S.modalOverlay}>
            <View style={S.modalContent}>
              <View style={S.modalHeader}>
                <Ionicons name="create-outline" size={22} color={C.accent} />
                <Text style={S.modalTitle}>Editar Método de Pago</Text>
                <TouchableOpacity onPress={() => setEditMethod(null)}>
                  <Ionicons name="close" size={24} color={C.muted} />
                </TouchableOpacity>
              </View>

              {editMethod && (
                <>
                  {/* Preview */}
                  <View style={S.editPreview}>
                    <Ionicons
                      name={editMethod.type === 'bank' ? 'business-outline' : 'card-outline'}
                      size={20}
                      color={editMethod.type === 'bank' ? C.success : C.purple}
                    />
                    <Text style={S.editPreviewText}>
                      ····{editMethod.account_last4 || editMethod.card_last4 || '****'}
                    </Text>
                    {editMethod.user_info && (
                      <Text style={S.editPreviewUser}>{editMethod.user_info.name}</Text>
                    )}
                  </View>

                  <Text style={S.inputLabel}>Nombre del Banco/Tarjeta</Text>
                  <TextInput
                    style={S.input}
                    value={editBankName}
                    onChangeText={setEditBankName}
                    placeholder="Nombre"
                    placeholderTextColor={C.muted}
                  />

                  {editMethod.type === 'bank' && (
                    <>
                      <Text style={S.inputLabel}>Tipo de Cuenta</Text>
                      <View style={S.toggleRow}>
                        {['checking', 'savings'].map(t => (
                          <TouchableOpacity
                            key={t}
                            style={[S.toggleBtn, editAccountType === t && S.toggleBtnActive]}
                            onPress={() => setEditAccountType(t)}
                          >
                            <Text style={[S.toggleText, editAccountType === t && S.toggleTextActive]}>
                              {t === 'checking' ? 'Corriente' : 'Ahorros'}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>

                      <Text style={S.inputLabel}>Número de Ruta (Routing)</Text>
                      <TextInput
                        style={S.input}
                        value={editRouting}
                        onChangeText={setEditRouting}
                        placeholder="9 dígitos"
                        placeholderTextColor={C.muted}
                        keyboardType="number-pad"
                        maxLength={9}
                      />

                      <Text style={S.inputLabel}>Número de Cuenta (nuevo, opcional)</Text>
                      <TextInput
                        style={S.input}
                        value={editAccount}
                        onChangeText={setEditAccount}
                        placeholder="Dejar vacío para no cambiar"
                        placeholderTextColor={C.muted}
                        keyboardType="number-pad"
                        secureTextEntry
                      />
                    </>
                  )}

                  <TouchableOpacity
                    style={[S.saveBtn, saving && { opacity: 0.6 }]}
                    onPress={handleSaveEdit}
                    disabled={saving}
                  >
                    {saving ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={S.saveBtnText}>Guardar Cambios</Text>
                    )}
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </>
  );
}

const S = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 16, paddingBottom: 40 },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: 'rgba(34,211,238,0.06)', borderRadius: 16,
    padding: 18, marginBottom: 16,
    borderWidth: 1, borderColor: 'rgba(34,211,238,0.15)',
  },
  headerIcon: {
    width: 50, height: 50, borderRadius: 14,
    backgroundColor: 'rgba(34,211,238,0.12)',
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: C.white },
  headerSub: { fontSize: 12, color: C.sub, marginTop: 2 },

  // Stats
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  statCard: {
    flex: 1, backgroundColor: C.card, borderRadius: 12,
    padding: 12, alignItems: 'center', gap: 4,
    borderWidth: 1, borderColor: C.border,
  },
  statNum: { fontSize: 20, fontWeight: '800', color: C.white },
  statLabel: { fontSize: 10, color: C.muted, fontWeight: '600' },

  // Search
  searchRow: { marginBottom: 10 },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: C.card, borderRadius: 12,
    paddingHorizontal: 14, height: 48,
    borderWidth: 1, borderColor: C.border,
  },
  searchInput: { flex: 1, fontSize: 14, color: C.white },

  // Filters
  filterRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16,
  },
  filterBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20,
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
  },
  filterBtnActive: { borderColor: C.accent, backgroundColor: 'rgba(34,211,238,0.08)' },
  filterText: { fontSize: 12, fontWeight: '600', color: C.muted },
  filterTextActive: { color: C.accent },
  resultCount: { fontSize: 11, color: C.muted },

  // Empty
  empty: { alignItems: 'center', marginTop: 60, gap: 12 },
  emptyText: { fontSize: 14, color: C.muted },

  // Method card
  methodCard: {
    backgroundColor: C.card, borderRadius: 14, padding: 16,
    marginBottom: 10, borderWidth: 1, borderColor: C.border,
  },
  methodCardLinked: { borderColor: 'rgba(239,68,68,0.3)' },
  methodTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  methodIcon: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: 'rgba(16,185,129,0.1)',
    justifyContent: 'center', alignItems: 'center',
  },
  methodName: { fontSize: 14, fontWeight: '700', color: C.white },
  methodLast4: { fontSize: 12, color: C.sub, marginTop: 2 },
  methodBadges: { flexDirection: 'row', gap: 6 },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(34,211,238,0.1)', paddingHorizontal: 8,
    paddingVertical: 3, borderRadius: 6,
  },
  badgeText: { fontSize: 10, fontWeight: '700', color: C.accent },

  // Client info
  clientRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: C.border,
  },
  clientText: { fontSize: 12, fontWeight: '600', color: C.sub },
  clientEmail: { fontSize: 11, color: C.muted },

  // Routing
  routingRow: { flexDirection: 'row', gap: 8, marginTop: 6 },
  routingLabel: { fontSize: 11, color: C.muted, fontWeight: '600' },
  routingValue: { fontSize: 11, color: C.sub, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },

  // Linked loans
  linkedSection: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  linkedPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(245,158,11,0.1)', paddingHorizontal: 8,
    paddingVertical: 4, borderRadius: 6,
  },
  linkedText: { fontSize: 10, fontWeight: '600', color: C.warning },

  // Actions
  actionRow: {
    flexDirection: 'row', gap: 8, marginTop: 12,
    paddingTop: 10, borderTopWidth: 1, borderTopColor: C.border,
  },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 8, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.04)',
  },
  actionText: { fontSize: 11, fontWeight: '600', color: C.sub },

  // Pagination
  pagination: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16,
    marginTop: 16,
  },
  pageBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: C.card, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: C.border,
  },
  pageText: { fontSize: 13, color: C.sub, fontWeight: '600' },

  // Modal
  modalOverlay: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)', padding: 20,
  },
  modalContent: {
    backgroundColor: C.card, borderRadius: 20, padding: 24,
    width: '100%', maxWidth: 500,
    borderWidth: 1, borderColor: C.border,
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20,
  },
  modalTitle: { flex: 1, fontSize: 17, fontWeight: '700', color: C.white },

  editPreview: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: C.bg, borderRadius: 10, padding: 12, marginBottom: 16,
  },
  editPreviewText: { fontSize: 15, fontWeight: '600', color: C.sub, letterSpacing: 2 },
  editPreviewUser: { fontSize: 12, color: C.muted, marginLeft: 'auto' },

  inputLabel: { fontSize: 12, fontWeight: '600', color: C.sub, marginBottom: 6, marginLeft: 2 },
  input: {
    backgroundColor: C.bg, borderRadius: 10, borderWidth: 1, borderColor: C.border,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: C.white,
    marginBottom: 14,
  },

  toggleRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  toggleBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5,
    borderColor: C.border, alignItems: 'center',
  },
  toggleBtnActive: { borderColor: C.accent, backgroundColor: 'rgba(34,211,238,0.08)' },
  toggleText: { fontSize: 13, fontWeight: '600', color: C.muted },
  toggleTextActive: { color: C.accent },

  saveBtn: {
    backgroundColor: C.accent, borderRadius: 12, paddingVertical: 14,
    alignItems: 'center', marginTop: 4,
  },
  saveBtnText: { color: C.bg, fontSize: 15, fontWeight: '700' },
});
