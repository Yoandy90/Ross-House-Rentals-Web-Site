/**
 * Admin Applications — View/Approve/Reject loan applications
 */
import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl,
  SafeAreaView, ActivityIndicator, TouchableOpacity, Alert, Platform, TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../../src/constants/theme';
import { useAdminApplications } from '../../src/hooks/useAdminApplications';

const TYPE_MAP: Record<string, string> = {
  subchapter_e: 'Subcapítulo E',
  subchapter_f: 'Subcapítulo F',
  tax_advance: 'Tax Advance',
  hybrid: 'Híbrido',
};

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  pending: { bg: '#FBBF24' + '15', text: '#FBBF24', label: 'Pendiente' },
  approved: { bg: '#10B981' + '15', text: '#10B981', label: 'Aprobada' },
  denied: { bg: '#EF4444' + '15', text: '#EF4444', label: 'Rechazada' },
};

export default function ApplicationsScreen() {
  const router = useRouter();
  const { applications, loading, refreshing, refresh, reviewApplication } = useAdminApplications();
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState('pending');

  const filtered = filterStatus === 'all'
    ? applications
    : applications.filter(a => a.status === filterStatus);

  const pendingCount = applications.filter(a => a.status === 'pending').length;

  const handleReview = (appId: string, name: string, decision: 'approved' | 'denied') => {
    const action = decision === 'approved' ? 'aprobar' : 'rechazar';
    Alert.alert(
      `¿${decision === 'approved' ? 'Aprobar' : 'Rechazar'} solicitud?`,
      `${name} — ¿Deseas ${action} esta solicitud?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: decision === 'approved' ? '✅ Aprobar' : '❌ Rechazar',
          style: decision === 'denied' ? 'destructive' : 'default',
          onPress: async () => {
            setReviewingId(appId);
            await reviewApplication(appId, decision);
            setReviewingId(null);
          },
        },
      ]
    );
  };

  const fmtDate = (d: string) => {
    if (!d) return '—';
    try { return new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }); } catch { return '—'; }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primaryLight} />
        <Text style={styles.loadingText}>Cargando solicitudes...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={Colors.primaryLight} />}
      >
        {/* HEADER */}
        <LinearGradient colors={['#7C3AED', '#6D28D9', '#5B21B6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.headerBanner}>
          <View style={styles.headerContent}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="chevron-back" size={22} color="#fff" />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>Solicitudes</Text>
              <Text style={styles.headerSubtitle}>{pendingCount} pendiente(s) · {applications.length} total</Text>
            </View>
          </View>
        </LinearGradient>

        {/* FILTER TABS */}
        <View style={styles.filterRow}>
          {(['pending', 'approved', 'denied', 'all'] as const).map(s => (
            <TouchableOpacity key={s} onPress={() => setFilterStatus(s)}
              style={[styles.filterTab, filterStatus === s && styles.filterTabActive]}>
              <Text style={[styles.filterTabText, filterStatus === s && styles.filterTabTextActive]}>
                {s === 'pending' ? `Pendientes (${pendingCount})` : s === 'approved' ? 'Aprobadas' : s === 'denied' ? 'Rechazadas' : 'Todas'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* APPLICATIONS LIST */}
        {filtered.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📭</Text>
            <Text style={styles.emptyText}>No hay solicitudes {filterStatus !== 'all' ? STATUS_COLORS[filterStatus]?.label.toLowerCase() + 's' : ''}</Text>
          </View>
        ) : (
          filtered.map(app => {
            const statusCfg = STATUS_COLORS[app.status] || STATUS_COLORS.pending;
            return (
              <View key={app._id} style={styles.appCard}>
                <View style={styles.appCardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.appName}>{app.first_name} {app.last_name}</Text>
                    <Text style={styles.appDetail}>{app.phone || app.email}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: statusCfg.bg }]}>
                    <Text style={[styles.statusText, { color: statusCfg.text }]}>{statusCfg.label}</Text>
                  </View>
                </View>
                <View style={styles.appInfo}>
                  <View style={styles.appInfoItem}>
                    <Text style={styles.appInfoLabel}>Monto</Text>
                    <Text style={styles.appInfoValue}>${app.amount}</Text>
                  </View>
                  <View style={styles.appInfoItem}>
                    <Text style={styles.appInfoLabel}>Tipo</Text>
                    <Text style={styles.appInfoValue}>{TYPE_MAP[app.loan_type] || app.loan_type}</Text>
                  </View>
                  <View style={styles.appInfoItem}>
                    <Text style={styles.appInfoLabel}>Fecha</Text>
                    <Text style={styles.appInfoValue}>{fmtDate(app.created_at)}</Text>
                  </View>
                </View>
                {app.purpose ? <Text style={styles.appPurpose}>📝 {app.purpose}</Text> : null}
                {app.status === 'pending' && (
                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.approveBtn]}
                      onPress={() => handleReview(app._id, `${app.first_name} ${app.last_name}`, 'approved')}
                      disabled={reviewingId === app._id}
                    >
                      {reviewingId === app._id ? <ActivityIndicator size="small" color="#fff" /> : (
                        <><Ionicons name="checkmark-circle" size={18} color="#fff" /><Text style={styles.actionBtnText}>Aprobar</Text></>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.denyBtn]}
                      onPress={() => handleReview(app._id, `${app.first_name} ${app.last_name}`, 'denied')}
                      disabled={reviewingId === app._id}
                    >
                      <Ionicons name="close-circle" size={18} color="#EF4444" />
                      <Text style={[styles.actionBtnText, { color: '#EF4444' }]}>Rechazar</Text>
                    </TouchableOpacity>
                  </View>
                )}
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
  headerSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 16, flexWrap: 'wrap' },
  filterTab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  filterTabActive: { backgroundColor: Colors.primaryLight + '15', borderColor: Colors.primaryLight + '40' },
  filterTabText: { fontSize: 12, color: Colors.textMuted, fontWeight: '600' },
  filterTabTextActive: { color: Colors.primaryLight },
  emptyContainer: { alignItems: 'center', paddingVertical: 48 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: Colors.textMuted, fontSize: 15 },
  appCard: { backgroundColor: Colors.surface, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: Colors.border },
  appCardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  appName: { fontSize: 16, fontWeight: '700', color: Colors.text },
  appDetail: { fontSize: 13, color: Colors.textMuted, marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  statusText: { fontSize: 11, fontWeight: '700' },
  appInfo: { flexDirection: 'row', gap: 16, marginBottom: 10 },
  appInfoItem: {},
  appInfoLabel: { fontSize: 10, color: Colors.textMuted, fontWeight: '600', textTransform: 'uppercase', marginBottom: 2 },
  appInfoValue: { fontSize: 14, color: Colors.text, fontWeight: '600' },
  appPurpose: { fontSize: 12, color: Colors.textSecondary, marginBottom: 10, fontStyle: 'italic' },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10 },
  approveBtn: { backgroundColor: Colors.primaryLight },
  denyBtn: { backgroundColor: '#EF4444' + '12', borderWidth: 1, borderColor: '#EF4444' + '30' },
  actionBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});
