/**
 * Passports Admin Management Screen
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import api from '../../services/api';

export default function PassportsAdminScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({ total: 0, pending: 0, approved: 0, completed: 0 });

  useEffect(() => {
    loadApplications();
  }, []);

  const loadApplications = async () => {
    try {
      const response = await api.get('/admin/passport-applications');
      const apps = response.data.applications || response.data || [];
      setApplications(apps);
      setStats({
        total: apps.length,
        pending: apps.filter((a: any) => a.status === 'pending').length,
        approved: apps.filter((a: any) => a.status === 'approved').length,
        completed: apps.filter((a: any) => a.status === 'completed').length,
      });
    } catch (error) {
      console.error('Error:', error);
      setApplications([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'pending': return { label: 'Pendiente', color: '#F59E0B', bg: '#FEF3C7' };
      case 'approved': return { label: 'Aprobado', color: '#10B981', bg: '#D1FAE5' };
      case 'completed': return { label: 'Completado', color: '#3B82F6', bg: '#DBEAFE' };
      case 'rejected': return { label: 'Rechazado', color: '#EF4444', bg: '#FEE2E2' };
      default: return { label: status, color: '#6B7280', bg: '#F3F4F6' };
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1E40AF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#1E40AF', '#3B82F6']}
        style={[styles.header, { paddingTop: insets.top + 8 }]}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Ionicons name="document-text" size={24} color="#FFF" />
            <Text style={styles.headerTitle}>Pasaportes</Text>
          </View>
          <TouchableOpacity style={styles.refreshBtn} onPress={loadApplications}>
            <Ionicons name="refresh" size={20} color="#FFF" />
          </TouchableOpacity>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.total}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.pending}</Text>
            <Text style={styles.statLabel}>Pendientes</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.completed}</Text>
            <Text style={styles.statLabel}>Completados</Text>
          </View>
        </View>
      </LinearGradient>

      <FlatList
        data={applications}
        keyExtractor={(item) => item.id || item._id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadApplications} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="document-outline" size={64} color="#D1D5DB" />
            <Text style={styles.emptyText}>No hay solicitudes de pasaporte</Text>
          </View>
        }
        renderItem={({ item }) => {
          const statusConfig = getStatusConfig(item.status);
          return (
            <TouchableOpacity style={styles.appCard}>
              <View style={styles.appHeader}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{(item.applicant_name || 'P').charAt(0)}</Text>
                </View>
                <View style={styles.appInfo}>
                  <Text style={styles.appName}>{item.applicant_name || 'Solicitante'}</Text>
                  <Text style={styles.appType}>{item.service_type || 'Renovación'}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
                  <Text style={[styles.statusText, { color: statusConfig.color }]}>{statusConfig.label}</Text>
                </View>
              </View>
              <View style={styles.appFooter}>
                <Text style={styles.appDate}>{item.created_at || ''}</Text>
                <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { paddingBottom: 20, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  headerContent: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 16 },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#FFF' },
  refreshBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: 20 },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: '800', color: '#FFF' },
  statLabel: { fontSize: 11, color: 'rgba(255,255,255,0.8)' },
  statDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.2)' },
  listContent: { padding: 16 },
  appCard: { backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginBottom: 12 },
  appHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  avatar: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#1E40AF', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarText: { color: '#FFF', fontWeight: '700', fontSize: 18 },
  appInfo: { flex: 1 },
  appName: { fontSize: 15, fontWeight: '600', color: '#1F2937' },
  appType: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 11, fontWeight: '700' },
  appFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  appDate: { fontSize: 12, color: '#9CA3AF' },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 16, color: '#6B7280', marginTop: 16 },
});
