import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { apiCall } from '../src/utils/api';
import { useColors, Spacing, FontSizes, BorderRadius } from '../src/constants/theme';

interface Tenant {
  _id: string;
  name: string;
  email: string;
  phone: string;
  property_name?: string;
  lease_end?: string;
  status: string;
  balance?: number;
}

export default function AdminTenantsScreen() {
  const Colors = useColors();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchTenants = useCallback(async () => {
    try {
      const data = await apiCall('/admin/tenants');
      setTenants(data.tenants || data || []);
    } catch (err) {
      console.log('Error fetching tenants:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchTenants(); }, []);
  const onRefresh = () => { setRefreshing(true); fetchTenants(); };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active': case 'activo': return Colors.success;
      case 'pending': case 'pendiente': return Colors.warning;
      case 'inactive': case 'inactivo': return Colors.error;
      default: return Colors.textMuted;
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
        colors={['rgba(59,130,246,0.08)', 'transparent']}
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
            <Text style={styles.headerTitle}>Inquilinos</Text>
            <Text style={styles.headerSubtitle}>{tenants.length} inquilinos registrados</Text>
          </View>
        </View>

        {/* Tenants List */}
        {tenants.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={60} color={Colors.textMuted} />
            <Text style={styles.emptyText}>No hay inquilinos registrados</Text>
          </View>
        ) : (
          tenants.map((tenant) => (
            <View key={tenant._id} style={styles.tenantCard}>
              <View style={styles.cardHeader}>
                <View style={styles.avatarWrap}>
                  <Text style={styles.avatarText}>
                    {(tenant.name || 'T')[0].toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.tenantName}>{tenant.name}</Text>
                  {tenant.property_name && (
                    <Text style={styles.propertyLabel}>{tenant.property_name}</Text>
                  )}
                </View>
                <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor(tenant.status)}20` }]}>
                  <Text style={[styles.statusText, { color: getStatusColor(tenant.status) }]}>
                    {tenant.status === 'active' ? 'Activo' : tenant.status}
                  </Text>
                </View>
              </View>
              
              <View style={styles.contactRow}>
                <TouchableOpacity
                  style={styles.contactBtn}
                  onPress={() => Linking.openURL(`tel:${tenant.phone}`)}
                >
                  <Ionicons name="call" size={16} color="#3B82F6" />
                  <Text style={styles.contactText}>{tenant.phone}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.contactBtn}
                  onPress={() => Linking.openURL(`mailto:${tenant.email}`)}
                >
                  <Ionicons name="mail" size={16} color="#8B5CF6" />
                  <Text style={styles.contactText}>{tenant.email}</Text>
                </TouchableOpacity>
              </View>
              
              {tenant.lease_end && (
                <View style={styles.leaseInfo}>
                  <Ionicons name="calendar-outline" size={14} color={Colors.textMuted} />
                  <Text style={styles.leaseText}>Contrato vence: {tenant.lease_end}</Text>
                </View>
              )}
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

  tenantCard: {
    backgroundColor: Colors.glass,
    borderRadius: BorderRadius.card, padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.glassBorder,
    marginBottom: 12,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatarWrap: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: 'rgba(59,130,246,0.15)',
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontSize: FontSizes.lg, fontWeight: '700', color: '#3B82F6' },
  tenantName: { fontSize: FontSizes.md, fontWeight: '700', color: Colors.textPrimary },
  propertyLabel: { fontSize: FontSizes.xs, color: Colors.textMuted, marginTop: 2 },
  statusBadge: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: BorderRadius.full,
  },
  statusText: { fontSize: 11, fontWeight: '600' },
  
  contactRow: {
    flexDirection: 'row', gap: 12, marginTop: 12,
    paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.glassBorder,
  },
  contactBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.glass, padding: 10,
    borderRadius: BorderRadius.md,
  },
  contactText: { fontSize: FontSizes.xs, color: Colors.textSecondary, flex: 1 },
  
  leaseInfo: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 10,
  },
  leaseText: { fontSize: FontSizes.xs, color: Colors.textMuted },

  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { fontSize: FontSizes.md, color: Colors.textMuted, marginTop: 16 },
});
