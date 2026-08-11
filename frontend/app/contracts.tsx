import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { apiCall } from '../src/utils/api';
import { useAuth } from '../src/contexts/AuthContext';
import { Spacing, FontSizes, BorderRadius, Shadows, useColors } from '../src/constants/theme';

interface Lease {
  id: string;
  property_address: string;
  lease_type: string;
  start_date: string;
  end_date: string;
  rent_amount: number;
  status: string;
  has_tenant_signature: boolean;
  has_landlord_signature: boolean;
  has_admin_signature: boolean;
  created_at: string;
}

export default function ContractsScreen() {
  const C = useColors();
  const styles = React.useMemo(() => createStyles(C), [C]);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const [leases, setLeases] = useState<Lease[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchLeases = useCallback(async () => {
    try {
      const data = await apiCall('/my-leases');
      if (data.success) {
        setLeases(data.leases);
      }
    } catch (err) {
      console.log('Fetch leases error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchLeases();
  }, [fetchLeases]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchLeases();
  };

  const getStatusConfig = (status: string) => {
    const map: Record<string, { label: string; color: string; bg: string; icon: string }> = {
      pending_tenant: {
        label: 'Pendiente tu firma',
        color: C.warmGold,
        bg: 'rgba(245,158,11,0.1)',
        icon: 'create',
      },
      pending_landlord: {
        label: 'Pendiente firma propietario',
        color: C.warmGold,
        bg: 'rgba(245,158,11,0.1)',
        icon: 'time',
      },
      pending_signatures: {
        label: 'Pendiente firmas',
        color: C.warmGold,
        bg: 'rgba(245,158,11,0.1)',
        icon: 'time',
      },
      active: {
        label: 'Activo',
        color: C.success,
        bg: 'rgba(34,197,94,0.1)',
        icon: 'checkmark-circle',
      },
      expired: {
        label: 'Expirado',
        color: C.error,
        bg: 'rgba(239,68,68,0.1)',
        icon: 'alert-circle',
      },
      terminated: {
        label: 'Terminado',
        color: C.textMuted,
        bg: 'rgba(156,163,175,0.1)',
        icon: 'close-circle',
      },
    };
    return map[status] || { label: status, color: C.textMuted, bg: 'rgba(156,163,175,0.1)', icon: 'help-circle' };
  };

  const formatDate = (d: string) => {
    if (!d) return '—';
    try {
      return new Date(d).toLocaleDateString('es-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return d;
    }
  };

  const renderLease = ({ item }: { item: Lease }) => {
    const statusConfig = getStatusConfig(item.status);
    const needsAction = item.status === 'pending_tenant' || 
                       (item.status === 'pending_landlord' && user?.role === 'landlord');

    return (
      <TouchableOpacity
        style={[styles.leaseCard, needsAction && styles.leaseCardAction]}
        onPress={() => router.push({ pathname: '/lease-signing', params: { lease_id: item.id } })}
        activeOpacity={0.7}
      >
        {/* Top: Status badge */}
        <View style={styles.cardTop}>
          <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
            <Ionicons name={statusConfig.icon as any} size={14} color={statusConfig.color} />
            <Text style={[styles.statusText, { color: statusConfig.color }]}>{statusConfig.label}</Text>
          </View>
          {needsAction && (
            <View style={styles.actionDot} />
          )}
        </View>

        {/* Address */}
        <Text style={styles.addressText} numberOfLines={2}>
          {item.property_address || 'Propiedad sin dirección'}
        </Text>

        {/* Details row */}
        <View style={styles.detailsRow}>
          <View style={styles.detailChip}>
            <Ionicons name="calendar-outline" size={14} color={C.textMuted} />
            <Text style={styles.detailChipText}>
              {formatDate(item.start_date)} — {formatDate(item.end_date)}
            </Text>
          </View>
        </View>

        <View style={styles.bottomRow}>
          <Text style={styles.rentAmount}>
            ${item.rent_amount?.toLocaleString() || '0'}/mes
          </Text>

          {/* Signature progress */}
          <View style={styles.sigProgress}>
            <View style={[styles.sigDot, item.has_admin_signature && styles.sigDotSigned]} />
            <View style={[styles.sigDot, item.has_tenant_signature && styles.sigDotSigned]} />
            <View style={[styles.sigDot, item.has_landlord_signature && styles.sigDotSigned]} />
            <Text style={styles.sigLabel}>Firmas</Text>
          </View>
        </View>

        {/* Action hint */}
        {needsAction && (
          <View style={styles.actionHint}>
            <Ionicons name="finger-print" size={16} color={C.brandRed} />
            <Text style={styles.actionHintText}>Toca para firmar</Text>
            <Ionicons name="chevron-forward" size={16} color={C.brandRed} />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={C.brandRed} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={C.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mis Contratos</Text>
        <View style={{ width: 44 }} />
      </View>

      <FlatList
        data={leases}
        renderItem={renderLease}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.brandRed} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={56} color={C.textMuted} />
            <Text style={styles.emptyTitle}>Sin contratos</Text>
            <Text style={styles.emptyDesc}>
              Cuando tengas un contrato de arrendamiento, aparecerá aquí para que lo puedas firmar digitalmente.
            </Text>
          </View>
        }
      />
    </View>
  );
}

const createStyles = (C: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: FontSizes.lg, fontWeight: '800', color: C.textPrimary, letterSpacing: -0.3 },

  listContent: { padding: Spacing.base, gap: 12 },

  leaseCard: {
    backgroundColor: C.surface,
    borderRadius: BorderRadius.card,
    padding: Spacing.base,
    borderWidth: 1,
    borderColor: C.border,
  },
  leaseCardAction: {
    borderColor: C.brandRed,
    borderWidth: 1.5,
  },

  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  statusText: { fontSize: FontSizes.xs, fontWeight: '600' },
  actionDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: C.brandRed,
  },

  addressText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: C.textPrimary,
    marginBottom: 8,
  },

  detailsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  detailChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: C.surfaceLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  detailChipText: { fontSize: FontSizes.xs, color: C.textMuted },

  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rentAmount: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: C.brandRed,
  },
  sigProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sigDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.border,
  },
  sigDotSigned: {
    backgroundColor: C.success,
  },
  sigLabel: {
    fontSize: 10,
    color: C.textMuted,
    marginLeft: 4,
  },

  actionHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  actionHintText: {
    fontSize: FontSizes.sm,
    color: C.brandRed,
    fontWeight: '600',
  },

  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 32,
    gap: 8,
  },
  emptyTitle: { fontSize: FontSizes.lg, fontWeight: '700', color: C.textPrimary },
  emptyDesc: { fontSize: FontSizes.sm, color: C.textMuted, textAlign: 'center', lineHeight: 20 },
});
