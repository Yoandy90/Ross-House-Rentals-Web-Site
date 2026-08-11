import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { apiCall } from '../src/utils/api';
import { useColors, Spacing, FontSizes, BorderRadius } from '../src/constants/theme';

interface MaintenanceRequest {
  _id: string;
  tenant_name: string;
  property_name: string;
  issue: string;
  description: string;
  priority: string;
  status: string;
  date: string;
}

export default function AdminMaintenanceScreen() {
  const Colors = useColors();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchRequests = useCallback(async () => {
    try {
      const data = await apiCall('/admin/maintenance-requests');
      setRequests(data.requests || data || []);
    } catch (err) {
      console.log('Error fetching maintenance:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchRequests(); }, []);
  const onRefresh = () => { setRefreshing(true); fetchRequests(); };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'completed': case 'completado': return Colors.success;
      case 'in_progress': case 'en_progreso': return '#3B82F6';
      case 'pending': case 'pendiente': return Colors.warning;
      default: return Colors.textMuted;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case 'high': case 'alta': return Colors.error;
      case 'medium': case 'media': return Colors.warning;
      case 'low': case 'baja': return Colors.success;
      default: return Colors.textMuted;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'completed': return 'Completado';
      case 'in_progress': return 'En Progreso';
      case 'pending': return 'Pendiente';
      default: return status;
    }
  };

  if (loading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={Colors.brandRed} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={['rgba(245,158,11,0.08)', 'transparent']}
        style={styles.bgGradient}
      />
      
      <ScrollView
        style={[styles.container, { paddingTop: insets.top }]}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.brandRed} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Mantenimiento</Text>
            <Text style={styles.headerSubtitle}>
              {requests.filter(r => r.status === 'pending').length} pendientes
            </Text>
          </View>
        </View>

        {/* Requests List */}
        {requests.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="construct-outline" size={60} color={Colors.textMuted} />
            <Text style={styles.emptyText}>No hay solicitudes de mantenimiento</Text>
          </View>
        ) : (
          requests.map((request) => (
            <View key={request._id} style={styles.requestCard}>
              <View style={styles.cardHeader}>
                <View style={[styles.iconWrap, { backgroundColor: 'rgba(245,158,11,0.15)' }]}>
                  <Ionicons name="construct" size={20} color={Colors.warning} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.issueName}>{request.issue}</Text>
                  <Text style={styles.propertyName}>{request.property_name}</Text>
                </View>
                <View style={[styles.priorityBadge, { backgroundColor: `${getPriorityColor(request.priority)}20` }]}>
                  <Text style={[styles.priorityText, { color: getPriorityColor(request.priority) }]}>
                    {request.priority === 'high' ? 'Alta' : request.priority === 'medium' ? 'Media' : 'Baja'}
                  </Text>
                </View>
              </View>
              
              <Text style={styles.description} numberOfLines={2}>
                {request.description}
              </Text>
              
              <View style={styles.requestMeta}>
                <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor(request.status)}20` }]}>
                  <Text style={[styles.statusText, { color: getStatusColor(request.status) }]}>
                    {getStatusLabel(request.status)}
                  </Text>
                </View>
                <Text style={styles.tenantText}>{request.tenant_name}</Text>
                <Text style={styles.dateText}>{request.date}</Text>
              </View>
            </View>
          ))
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (Colors: any) => StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  container: { flex: 1 },
  content: { paddingHorizontal: Spacing.base },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  bgGradient: { position: 'absolute', top: 0, left: 0, right: 0, height: 200 },
  
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: Spacing.md,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: Colors.glassLight,
    borderWidth: 1, borderColor: Colors.glassBorderLight,
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: FontSizes['2xl'], fontWeight: '800', color: Colors.textPrimary },
  headerSubtitle: { fontSize: FontSizes.xs, color: Colors.textMuted, marginTop: 2 },

  requestCard: {
    backgroundColor: Colors.glass,
    borderRadius: BorderRadius.card, padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.glassBorder,
    marginBottom: 12,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconWrap: {
    width: 44, height: 44, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
  },
  issueName: { fontSize: FontSizes.md, fontWeight: '700', color: Colors.textPrimary },
  propertyName: { fontSize: FontSizes.xs, color: Colors.textMuted, marginTop: 2 },
  priorityBadge: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: BorderRadius.full,
  },
  priorityText: { fontSize: 11, fontWeight: '600' },
  
  description: {
    fontSize: FontSizes.sm, color: Colors.textSecondary,
    marginTop: 10, lineHeight: 20,
  },
  
  requestMeta: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginTop: 12, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: Colors.glassBorder,
  },
  statusBadge: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: BorderRadius.full,
  },
  statusText: { fontSize: 11, fontWeight: '600' },
  tenantText: { fontSize: FontSizes.xs, color: Colors.textSecondary, flex: 1 },
  dateText: { fontSize: FontSizes.xs, color: Colors.textMuted },

  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { fontSize: FontSizes.md, color: Colors.textMuted, marginTop: 16 },
});
