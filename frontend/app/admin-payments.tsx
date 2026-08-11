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
import { formatCurrency } from '../src/utils/formatters';

interface Payment {
  _id: string;
  tenant_name: string;
  property_name: string;
  amount: number;
  date: string;
  type: string;
  status: string;
  method: string;
}

export default function AdminPaymentsScreen() {
  const Colors = useColors();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({ total: 0, pending: 0, received: 0 });

  const fetchPayments = useCallback(async () => {
    try {
      const data = await apiCall('/admin/rental-payments?page=1&page_size=100');
      const list = (data.payments || []).map((p: any) => ({
        _id: p._id || p.id,
        tenant_name: p.tenant_name || '—',
        property_name: p.property_address || '',
        amount: p.total_due ?? p.amount ?? 0,
        date: (p.payment_date || p.due_date || '').slice(0, 10),
        type: 'Renta',
        status: p.status || 'pending',
        method: p.payment_method || '',
      }));
      setPayments(list);
      if (data.stats) {
        setStats({
          total: (data.stats.total_completed || 0) + (data.stats.total_pending || 0),
          pending: data.stats.total_pending || 0,
          received: data.stats.total_completed || 0,
        });
      }
    } catch (err) {
      console.log('Error fetching payments:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchPayments(); }, []);
  const onRefresh = () => { setRefreshing(true); fetchPayments(); };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'completed': case 'paid': case 'pagado': return Colors.success;
      case 'pending': case 'pendiente': return Colors.warning;
      case 'failed': case 'fallido': return Colors.error;
      default: return Colors.textMuted;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'completed': case 'paid': return 'Pagado';
      case 'pending': return 'Pendiente';
      case 'failed': return 'Fallido';
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
        colors={['rgba(16,185,129,0.08)', 'transparent']}
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
            <Text style={styles.headerTitle}>Pagos</Text>
            <Text style={styles.headerSubtitle}>{payments.length} pagos registrados</Text>
          </View>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { borderColor: 'rgba(16,185,129,0.2)' }]}>
            <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
            <Text style={styles.statValue}>{formatCurrency(stats.received)}</Text>
            <Text style={styles.statLabel}>Recibido</Text>
          </View>
          <View style={[styles.statCard, { borderColor: 'rgba(245,158,11,0.2)' }]}>
            <Ionicons name="time" size={20} color={Colors.warning} />
            <Text style={styles.statValue}>{formatCurrency(stats.pending)}</Text>
            <Text style={styles.statLabel}>Pendiente</Text>
          </View>
        </View>

        {/* Payments List */}
        {payments.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="card-outline" size={60} color={Colors.textMuted} />
            <Text style={styles.emptyText}>No hay pagos registrados</Text>
          </View>
        ) : (
          payments.map((payment) => (
            <View key={payment._id} style={styles.paymentCard}>
              <View style={styles.cardHeader}>
                <View style={[styles.iconWrap, { backgroundColor: `${getStatusColor(payment.status)}15` }]}>
                  <Ionicons
                    name={payment.status === 'completed' || payment.status === 'paid' ? 'checkmark-circle' : 'time'}
                    size={20}
                    color={getStatusColor(payment.status)}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.tenantName}>{payment.tenant_name}</Text>
                  <Text style={styles.propertyName}>{payment.property_name}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.amount, { color: getStatusColor(payment.status) }]}>
                    {formatCurrency(payment.amount)}
                  </Text>
                  <Text style={styles.dateText}>{payment.date}</Text>
                </View>
              </View>
              
              <View style={styles.paymentMeta}>
                <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor(payment.status)}20` }]}>
                  <Text style={[styles.statusText, { color: getStatusColor(payment.status) }]}>
                    {getStatusLabel(payment.status)}
                  </Text>
                </View>
                <Text style={styles.methodText}>{payment.method || 'Transferencia'}</Text>
                <Text style={styles.typeText}>{payment.type || 'Renta'}</Text>
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

  statsRow: { flexDirection: 'row', gap: 12, marginBottom: Spacing.lg },
  statCard: {
    flex: 1, alignItems: 'center', padding: Spacing.md,
    backgroundColor: Colors.glass,
    borderRadius: BorderRadius.card, borderWidth: 1,
  },
  statValue: { fontSize: FontSizes.lg, fontWeight: '800', color: Colors.textPrimary, marginTop: 8 },
  statLabel: { fontSize: FontSizes.xs, color: Colors.textMuted, marginTop: 4 },

  paymentCard: {
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
  tenantName: { fontSize: FontSizes.md, fontWeight: '700', color: Colors.textPrimary },
  propertyName: { fontSize: FontSizes.xs, color: Colors.textMuted, marginTop: 2 },
  amount: { fontSize: FontSizes.lg, fontWeight: '800' },
  dateText: { fontSize: FontSizes.xs, color: Colors.textMuted, marginTop: 2 },
  
  paymentMeta: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginTop: 12, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: Colors.glassBorder,
  },
  statusBadge: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: BorderRadius.full,
  },
  statusText: { fontSize: 11, fontWeight: '600' },
  methodText: { fontSize: FontSizes.xs, color: Colors.textSecondary },
  typeText: { fontSize: FontSizes.xs, color: Colors.textMuted, marginLeft: 'auto' },

  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { fontSize: FontSizes.md, color: Colors.textMuted, marginTop: 16 },
});
