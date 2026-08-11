import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, TextInput, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/contexts/AuthContext';
import { apiCall } from '../src/utils/api';
import { useColors } from '../src/constants/theme';

interface Inspection {
  _id: string;
  property_id: string;
  property_name: string;
  property_address: string;
  tenant_id: string;
  tenant_name: string;
  inspection_type: 'move_in' | 'move_out' | 'routine';
  status: 'pending' | 'in_progress' | 'completed';
  scheduled_date: string;
  inspector_name: string;
  notes: string;
  rooms: any[];
  admin_signature?: string;
  tenant_signature?: string;
  created_at: string;
}

const STATUS_CONFIG = {
  pending: { label: 'Pendiente', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', icon: 'time-outline' },
  in_progress: { label: 'En Progreso', color: '#3b82f6', bg: 'rgba(59,130,246,0.1)', icon: 'hourglass-outline' },
  completed: { label: 'Completada', color: '#10b981', bg: 'rgba(16,185,129,0.1)', icon: 'checkmark-circle-outline' },
};

const TYPE_CONFIG = {
  move_in: { label: 'Move-In', color: '#10b981', icon: 'log-in-outline' },
  move_out: { label: 'Move-Out', color: '#ef4444', icon: 'log-out-outline' },
  routine: { label: 'Rutinaria', color: '#8b5cf6', icon: 'refresh-outline' },
};

export default function AdminInspectionsScreen() {
  const C = useColors();
  const styles = React.useMemo(() => create_styles(C), [C]);
  const router = useRouter();
  const { user } = useAuth();
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'in_progress' | 'completed'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchInspections = useCallback(async () => {
    try {
      const data = await apiCall('/admin/inspections');
      setInspections(data.inspections || []);
    } catch (e) {
      console.error('Error fetching inspections:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchInspections();
  }, [fetchInspections]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchInspections();
  };

  const filteredInspections = inspections.filter(insp => {
    if (filter !== 'all' && insp.status !== filter) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        insp.property_name?.toLowerCase().includes(query) ||
        insp.property_address?.toLowerCase().includes(query) ||
        insp.tenant_name?.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const counts = {
    all: inspections.length,
    pending: inspections.filter(i => i.status === 'pending').length,
    in_progress: inspections.filter(i => i.status === 'in_progress').length,
    completed: inspections.filter(i => i.status === 'completed').length,
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#C8102E" />
          <Text style={styles.loadingText}>Cargando inspecciones...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={C.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Inspecciones</Text>
          <Text style={styles.headerSubtitle}>{inspections.length} registradas</Text>
        </View>
        <TouchableOpacity 
          style={styles.addButton}
          onPress={() => router.push('/admin-inspection-create')}
        >
          <LinearGradient colors={['#C8102E', '#9B1B30']} style={StyleSheet.absoluteFill} />
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Stats Cards */}
      <View style={styles.statsRow}>
        {[
          { key: 'pending', icon: 'time-outline', color: '#f59e0b' },
          { key: 'in_progress', icon: 'hourglass-outline', color: '#3b82f6' },
          { key: 'completed', icon: 'checkmark-circle-outline', color: '#10b981' },
        ].map(stat => (
          <TouchableOpacity 
            key={stat.key}
            style={[styles.statCard, filter === stat.key && styles.statCardActive]}
            onPress={() => setFilter(filter === stat.key ? 'all' : stat.key as any)}
          >
            <Ionicons name={stat.icon as any} size={20} color={stat.color} />
            <Text style={styles.statValue}>{counts[stat.key as keyof typeof counts]}</Text>
            <Text style={styles.statLabel}>{STATUS_CONFIG[stat.key as keyof typeof STATUS_CONFIG].label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={20} color={C.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar propiedad o inquilino..."
          placeholderTextColor={C.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color={C.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* List */}
      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#C8102E" />
        }
      >
        {filteredInspections.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="clipboard-outline" size={48} color={C.textMuted} />
            <Text style={styles.emptyText}>No hay inspecciones</Text>
            <Text style={styles.emptySubtext}>
              {filter !== 'all' ? 'Prueba cambiando el filtro' : 'Crea una nueva inspección'}
            </Text>
          </View>
        ) : (
          filteredInspections.map(insp => {
            const status = STATUS_CONFIG[insp.status];
            const type = TYPE_CONFIG[insp.inspection_type];
            const hasSignatures = insp.admin_signature && insp.tenant_signature;

            return (
              <TouchableOpacity
                key={insp._id}
                style={styles.inspectionCard}
                onPress={() => router.push(`/admin-inspection-detail?id=${insp._id}`)}
                activeOpacity={0.7}
              >
                {/* Type Badge */}
                <View style={[styles.typeBadge, { backgroundColor: type.color + '20' }]}>
                  <Ionicons name={type.icon as any} size={14} color={type.color} />
                  <Text style={[styles.typeBadgeText, { color: type.color }]}>{type.label}</Text>
                </View>

                {/* Property Info */}
                <Text style={styles.propertyName}>{insp.property_name || 'Propiedad'}</Text>
                <View style={styles.infoRow}>
                  <Ionicons name="location-outline" size={14} color={C.textMuted} />
                  <Text style={styles.infoText}>{insp.property_address || 'Sin dirección'}</Text>
                </View>

                {/* Tenant */}
                <View style={styles.infoRow}>
                  <Ionicons name="person-outline" size={14} color={C.textMuted} />
                  <Text style={styles.infoText}>{insp.tenant_name || 'Sin asignar'}</Text>
                </View>

                {/* Date */}
                <View style={styles.infoRow}>
                  <Ionicons name="calendar-outline" size={14} color={C.textMuted} />
                  <Text style={styles.infoText}>
                    {insp.scheduled_date ? new Date(insp.scheduled_date).toLocaleDateString('es-ES') : 'Sin fecha'}
                  </Text>
                </View>

                {/* Footer */}
                <View style={styles.cardFooter}>
                  <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
                    <Ionicons name={status.icon as any} size={12} color={status.color} />
                    <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
                  </View>

                  {/* Signature Status */}
                  <View style={styles.signatureStatus}>
                    <View style={[styles.signatureIndicator, insp.admin_signature && styles.signatureComplete]}>
                      <Ionicons name="person" size={10} color={insp.admin_signature ? '#10b981' : '#666'} />
                    </View>
                    <View style={[styles.signatureIndicator, insp.tenant_signature && styles.signatureComplete]}>
                      <Ionicons name="home" size={10} color={insp.tenant_signature ? '#10b981' : '#666'} />
                    </View>
                    {hasSignatures && (
                      <Ionicons name="checkmark-done" size={14} color="#10b981" style={{ marginLeft: 4 }} />
                    )}
                  </View>

                  <Ionicons name="chevron-forward" size={20} color={C.textMuted} />
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const create_styles = (C: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: C.textMuted,
    fontSize: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: C.glassLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: C.textPrimary,
  },
  headerSubtitle: {
    fontSize: 13,
    color: C.textMuted,
    marginTop: 2,
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: C.glass,
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.glassLight,
  },
  statCardActive: {
    borderColor: '#C8102E',
    backgroundColor: 'rgba(200,16,46,0.1)',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: C.textPrimary,
    marginTop: 6,
  },
  statLabel: {
    fontSize: 10,
    color: C.textMuted,
    marginTop: 2,
    textTransform: 'uppercase',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.glass,
    marginHorizontal: 16,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    borderWidth: 1,
    borderColor: C.glassLight,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 15,
    color: C.textPrimary,
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    paddingTop: 0,
    gap: 12,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: C.textMuted,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 13,
    color: C.textMuted,
    marginTop: 4,
  },
  inspectionCard: {
    backgroundColor: C.glass,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: C.glassBorder,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 5,
    marginBottom: 10,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  propertyName: {
    fontSize: 17,
    fontWeight: '700',
    color: C.textPrimary,
    marginBottom: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  infoText: {
    fontSize: 13,
    color: C.textMuted,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: C.glassLight,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 5,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  signatureStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 'auto',
    marginRight: 10,
    gap: 4,
  },
  signatureIndicator: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: C.glassLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  signatureComplete: {
    backgroundColor: 'rgba(16,185,129,0.2)',
  },
});
