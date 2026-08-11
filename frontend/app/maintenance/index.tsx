import React, { useEffect, useState, useCallback } from 'react';
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
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { apiCall } from '../../src/utils/api';
import { Badge } from '../../src/components/ui/Badge';
import { Spacing, FontSizes, BorderRadius, Shadows, useColors } from '../../src/constants/theme';
import { formatDate } from '../../src/utils/formatters';

const getStatusConfig = (C: any): Record<string, { icon: string; color: string; variant: 'success'|'warning'|'error'|'info'|'default' }> => ({
  open: { icon: 'alert-circle', color: C.warning, variant: 'warning' },
  in_progress: { icon: 'construct', color: C.info, variant: 'info' },
  completed: { icon: 'checkmark-circle', color: C.success, variant: 'success' },
  closed: { icon: 'close-circle', color: C.warmGray, variant: 'default' },
});

const categoryIcons: Record<string, string> = {
  plumbing: 'water', electrical: 'flash', appliance: 'tv',
  hvac: 'thermometer', structural: 'home', pest: 'bug',
  general: 'build', cleaning: 'sparkles', other: 'ellipsis-horizontal',
};

export default function MaintenanceListScreen() {
  const C = useColors();
  const styles = React.useMemo(() => createStyles(C), [C]);
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasActiveContract, setHasActiveContract] = useState(false);

  const fetchRequests = useCallback(async () => {
    try {
      const data = await apiCall('/tenant/maintenance-requests');
      setRequests(data.requests || []);
    } catch (err) {
      console.log('Maintenance fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
    // Check if the tenant has an active contract — required to create requests.
    try {
      const dash = await apiCall('/tenant/dashboard');
      const status = (dash?.contract?.status || dash?.lease?.status || '').toLowerCase();
      setHasActiveContract(status === 'active' || status === 'activo');
    } catch (e) {
      setHasActiveContract(false);
    }
  }, []);

  useEffect(() => { fetchRequests(); }, []);
  const onRefresh = () => { setRefreshing(true); fetchRequests(); };

  const openCount = requests.filter(r => r.status === 'open' || r.status === 'in_progress').length;

  const renderRequest = ({ item }: { item: any }) => {
    const statusConfig = getStatusConfig(C);
    const cfg = statusConfig[item.status] || statusConfig.open;
    const catIcon = categoryIcons[item.category] || 'build';
    return (
      <TouchableOpacity style={styles.card} activeOpacity={0.8}>
        {/* Top accent */}
        <View style={[styles.cardAccent, { backgroundColor: cfg.color }]} />
        {/* Corner orb */}
        <View style={[styles.cornerOrb, { backgroundColor: cfg.color }]} />

        <View style={styles.cardContent}>
          <View style={styles.cardHeader}>
            <View style={[styles.catIcon, { backgroundColor: `${cfg.color}18` }]}>
              <Ionicons name={catIcon as any} size={20} color={cfg.color} />
            </View>
            <View style={styles.cardHeaderText}>
              <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
              <Text style={styles.cardDate}>
                {formatDate(item.created_at, i18n.language)}
              </Text>
            </View>
            <Badge label={t(`maintenance.status_${item.status}`)} variant={cfg.variant} />
          </View>
          <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>
          {item.assigned_provider_name && (
            <View style={styles.providerBadge}>
              <Ionicons name="construct" size={13} color="#f59e0b" />
              <Text style={styles.providerText}>
                {i18n.language === 'es' ? 'Asignado a' : 'Assigned to'}: <Text style={styles.providerName}>{item.assigned_provider_name}</Text>
              </Text>
              {item.assigned_provider_phone && (
                <Text style={styles.providerPhone}>· {item.assigned_provider_phone}</Text>
              )}
            </View>
          )}
          {item.priority === 'urgent' && (
            <View style={styles.urgentBadge}>
              <Ionicons name="warning" size={12} color={C.error} />
              <Text style={styles.urgentText}>{t('maintenance.urgent')}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={C.textPrimary} />
        </TouchableOpacity>
        <View>
          <Text style={styles.title}>{t('maintenance.title')}</Text>
          {openCount > 0 && (
            <Text style={styles.subtitle}>{openCount} {t('maintenance.active')}</Text>
          )}
        </View>
      </View>

      {/* Subtle header glow */}
      <LinearGradient
        colors={['rgba(200,16,46,0.05)', 'transparent']}
        style={styles.headerGlow}
      />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={C.brandRed} />
        </View>
      ) : (
        <FlatList
          data={requests}
          renderItem={renderRequest}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.brandRed} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="checkmark-circle-outline" size={48} color={C.success} />
              </View>
              <Text style={styles.emptyTitle}>{t('maintenance.no_requests')}</Text>
              <Text style={styles.emptyDesc}>{t('maintenance.no_requests_desc')}</Text>
            </View>
          }
        />
      )}

      {/* FAB - New Request (only when tenant has active contract) */}
      {hasActiveContract && (
        <TouchableOpacity
          style={[styles.fab, { bottom: insets.bottom + 20 }]}
          onPress={() => router.push('/maintenance/new')}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={['#E11D48', '#9B1B30']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.fabGradient}
          >
            <Ionicons name="add" size={28} color={C.white} />
          </LinearGradient>
        </TouchableOpacity>
      )}
    </View>
  );
}

const createStyles = (C: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  backBtn: { width: 44, height: 44, justifyContent: 'center' },
  title: { fontSize: FontSizes['2xl'], fontWeight: '800', color: C.textPrimary, letterSpacing: -0.5 },
  subtitle: { fontSize: FontSizes.sm, color: C.warning, fontWeight: '600', marginTop: 1 },
  headerGlow: { height: 30 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { paddingHorizontal: Spacing.base, paddingBottom: 100, gap: 10 },
  card: {
    backgroundColor: C.surface, borderRadius: BorderRadius.card,
    overflow: 'hidden',
    borderWidth: 1, borderColor: C.border, position: 'relative',
    ...Shadows.subtle,
  },
  cardAccent: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 2.5,
    borderTopLeftRadius: BorderRadius.card, borderTopRightRadius: BorderRadius.card,
  },
  cornerOrb: {
    position: 'absolute', top: -20, right: -20,
    width: 72, height: 72, borderRadius: 36, opacity: 0.08,
  },
  cardContent: { padding: Spacing.base },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  catIcon: { width: 42, height: 42, borderRadius: 13, justifyContent: 'center', alignItems: 'center' },
  cardHeaderText: { flex: 1 },
  cardTitle: { fontSize: FontSizes.base, fontWeight: '700', color: C.textPrimary },
  cardDate: { fontSize: FontSizes.xs, color: C.textMuted, marginTop: 1, fontWeight: '500' },
  cardDesc: { fontSize: FontSizes.sm, color: C.textSecondary, lineHeight: 18 },
  urgentBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    marginTop: 8, backgroundColor: C.errorBg,
    paddingVertical: 4, paddingHorizontal: 8, borderRadius: BorderRadius.full,
    alignSelf: 'flex-start', borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)',
  },
  urgentText: { fontSize: FontSizes.xs, color: C.error, fontWeight: '700' },
  providerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#f59e0b15',
    borderWidth: 1,
    borderColor: '#f59e0b30',
    borderRadius: 8,
    flexWrap: 'wrap',
  },
  providerText: { fontSize: FontSizes.xs, color: '#f59e0b' },
  providerName: { fontWeight: '700', color: '#fbbf24' },
  providerPhone: { fontSize: FontSizes.xs, color: '#94a3b8' },
  fab: {
    position: 'absolute', right: 20,
    borderRadius: 16, overflow: 'hidden',
    ...Shadows.button,
  },
  fabGradient: {
    width: 56, height: 56, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center',
  },
  emptyContainer: { alignItems: 'center', paddingTop: 80 },
  emptyIconWrap: {
    width: 88, height: 88, borderRadius: 24,
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  emptyTitle: { fontSize: FontSizes.lg, color: C.textPrimary, fontWeight: '700' },
  emptyDesc: { fontSize: FontSizes.sm, color: C.textMuted, marginTop: 4, textAlign: 'center', maxWidth: 280 },
});
