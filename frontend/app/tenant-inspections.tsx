import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator,
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
  property_name: string;
  property_address: string;
  inspection_type: 'move_in' | 'move_out' | 'routine';
  status: string;
  scheduled_date: string;
  admin_signature?: string;
  tenant_signature?: string;
  pending_tenant_signature?: boolean;
  created_at: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: keyof typeof Ionicons.glyphMap }> = {
  pending: { label: 'Pendiente', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', icon: 'time-outline' },
  in_progress: { label: 'En Progreso', color: '#3b82f6', bg: 'rgba(59,130,246,0.1)', icon: 'hourglass-outline' },
  pending_signature: { label: 'Esperando Tu Firma', color: '#ec4899', bg: 'rgba(236,72,153,0.15)', icon: 'create-outline' },
  completed: { label: 'Completada', color: '#10b981', bg: 'rgba(16,185,129,0.1)', icon: 'checkmark-circle-outline' },
  disputed: { label: 'Disputada', color: '#ef4444', bg: 'rgba(239,68,68,0.1)', icon: 'alert-circle-outline' },
};

const TYPE_CONFIG: Record<string, { label: string; color: string; icon: keyof typeof Ionicons.glyphMap }> = {
  move_in: { label: 'Move-In', color: '#10b981', icon: 'log-in-outline' },
  move_out: { label: 'Move-Out', color: '#ef4444', icon: 'log-out-outline' },
  routine: { label: 'Rutinaria', color: '#8b5cf6', icon: 'refresh-outline' },
};

export default function TenantInspectionsScreen() {
  const C = useColors();
  const styles = React.useMemo(() => createStyles(C), [C]);
  const router = useRouter();
  const { user } = useAuth();
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending_signature'>('all');

  const fetchInspections = useCallback(async () => {
    try {
      const data = await apiCall('/tenant/inspections');
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

  const filteredInspections = filter === 'pending_signature'
    ? inspections.filter(i => i.pending_tenant_signature || i.status === 'pending_signature')
    : inspections;

  const pendingCount = inspections.filter(i => 
    i.pending_tenant_signature || i.status === 'pending_signature'
  ).length;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={C.brandRed} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={['rgba(200,16,46,0.08)', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0.5 }}
        style={styles.bgGradient}
      />

      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Mis Inspecciones</Text>
            <Text style={styles.headerSubtitle}>
              {pendingCount > 0 ? `${pendingCount} pendiente(s) de firma` : 'Todas al día'}
            </Text>
          </View>
        </View>

        {/* Filter Tabs */}
        <View style={styles.filterTabs}>
          <TouchableOpacity
            style={[styles.filterTab, filter === 'all' && styles.filterTabActive]}
            onPress={() => setFilter('all')}
          >
            <Text style={[styles.filterTabText, filter === 'all' && styles.filterTabTextActive]}>
              Todas ({inspections.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterTab, filter === 'pending_signature' && styles.filterTabActive]}
            onPress={() => setFilter('pending_signature')}
          >
            <Ionicons 
              name="create-outline" 
              size={16} 
              color={filter === 'pending_signature' ? '#ec4899' : '#888'} 
            />
            <Text style={[styles.filterTabText, filter === 'pending_signature' && { color: '#ec4899' }]}>
              Por Firmar ({pendingCount})
            </Text>
          </TouchableOpacity>
        </View>

        {/* List */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.brandRed} />
          }
          showsVerticalScrollIndicator={false}
        >
          {filteredInspections.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="clipboard-outline" size={60} color="#333" />
              <Text style={styles.emptyTitle}>
                {filter === 'pending_signature' ? 'No hay inspecciones pendientes de firma' : 'No tienes inspecciones'}
              </Text>
              <Text style={styles.emptySubtitle}>
                Las inspecciones de tu propiedad aparecerán aquí
              </Text>
            </View>
          ) : (
            filteredInspections.map((insp) => {
              const status = STATUS_CONFIG[insp.status] || STATUS_CONFIG.pending;
              const type = TYPE_CONFIG[insp.inspection_type] || TYPE_CONFIG.routine;
              const needsSignature = insp.pending_tenant_signature || insp.status === 'pending_signature';

              return (
                <TouchableOpacity
                  key={insp._id}
                  style={[styles.card, needsSignature && styles.cardHighlight]}
                  onPress={() => router.push(`/tenant-inspection-sign?id=${insp._id}`)}
                  activeOpacity={0.7}
                >
                  <LinearGradient
                    colors={needsSignature 
                      ? ['rgba(236,72,153,0.1)', 'rgba(236,72,153,0.02)']
                      : ['rgba(255,255,255,0.03)', 'transparent']
                    }
                    style={StyleSheet.absoluteFill}
                  />
                  
                  <View style={styles.cardHeader}>
                    <View style={[styles.typeTag, { backgroundColor: `${type.color}20` }]}>
                      <Ionicons name={type.icon} size={14} color={type.color} />
                      <Text style={[styles.typeText, { color: type.color }]}>{type.label}</Text>
                    </View>
                    <View style={[styles.statusTag, { backgroundColor: status.bg }]}>
                      <Ionicons name={status.icon} size={14} color={status.color} />
                      <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
                    </View>
                  </View>

                  <Text style={styles.propertyName}>{insp.property_name}</Text>
                  <Text style={styles.propertyAddress}>{insp.property_address}</Text>

                  <View style={styles.cardFooter}>
                    <View style={styles.dateRow}>
                      <Ionicons name="calendar-outline" size={14} color="#666" />
                      <Text style={styles.dateText}>
                        {new Date(insp.scheduled_date || insp.created_at).toLocaleDateString('es-MX', {
                          year: 'numeric', month: 'short', day: 'numeric'
                        })}
                      </Text>
                    </View>
                    
                    {needsSignature ? (
                      <View style={styles.signBadge}>
                        <Ionicons name="create" size={16} color="#fff" />
                        <Text style={styles.signBadgeText}>Firmar Ahora</Text>
                      </View>
                    ) : (
                      <Ionicons name="chevron-forward" size={20} color="#666" />
                    )}
                  </View>

                  {/* Signature Status */}
                  <View style={styles.signatureStatus}>
                    <View style={styles.signatureItem}>
                      <Ionicons 
                        name={insp.admin_signature ? 'checkmark-circle' : 'ellipse-outline'} 
                        size={16} 
                        color={insp.admin_signature ? '#10b981' : '#444'} 
                      />
                      <Text style={[styles.signatureText, insp.admin_signature && { color: '#10b981' }]}>
                        Admin
                      </Text>
                    </View>
                    <View style={styles.signatureItem}>
                      <Ionicons 
                        name={insp.tenant_signature ? 'checkmark-circle' : 'ellipse-outline'} 
                        size={16} 
                        color={insp.tenant_signature ? '#10b981' : '#444'} 
                      />
                      <Text style={[styles.signatureText, insp.tenant_signature && { color: '#10b981' }]}>
                        Tu Firma
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}

          <View style={{ height: 100 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const createStyles = (C: any) => StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0e15' },
  bgGradient: { ...StyleSheet.absoluteFillObject },
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0e15' },
  
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: C.glassLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: { fontSize: 22, fontWeight: '700', color: C.textPrimary },
  headerSubtitle: { fontSize: 13, color: '#888', marginTop: 2 },

  filterTabs: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 12,
  },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: C.glassLight,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  filterTabActive: {
    backgroundColor: 'rgba(236,72,153,0.1)',
    borderColor: 'rgba(236,72,153,0.3)',
  },
  filterTabText: { fontSize: 13, color: '#888', fontWeight: '500' },
  filterTabTextActive: { color: '#ec4899' },

  scrollView: { flex: 1 },
  content: { paddingHorizontal: 16 },

  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: C.textPrimary, marginTop: 16 },
  emptySubtitle: { fontSize: 14, color: '#666', marginTop: 6, textAlign: 'center' },

  card: {
    backgroundColor: C.glass,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: C.glassBorder,
    overflow: 'hidden',
  },
  cardHighlight: {
    borderColor: 'rgba(236,72,153,0.4)',
  },

  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  typeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  typeText: { fontSize: 12, fontWeight: '600' },
  statusTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: { fontSize: 12, fontWeight: '600' },

  propertyName: { fontSize: 17, fontWeight: '700', color: C.textPrimary, marginBottom: 4 },
  propertyAddress: { fontSize: 14, color: '#888' },

  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: C.glassBorder,
  },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dateText: { fontSize: 13, color: '#666' },

  signBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ec4899',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  signBadgeText: { fontSize: 13, fontWeight: '600', color: C.textPrimary },

  signatureStatus: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: C.glassBorder,
  },
  signatureItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  signatureText: { fontSize: 12, color: '#666' },
});
