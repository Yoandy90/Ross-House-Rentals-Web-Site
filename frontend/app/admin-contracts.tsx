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

interface Contract {
  _id: string;
  tenant_name: string;
  property_name: string;
  start_date: string;
  end_date: string;
  rent_amount: number;
  status: string;
  deposit: number;
}

export default function AdminContractsScreen() {
  const Colors = useColors();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchContracts = useCallback(async () => {
    try {
      const data = await apiCall('/admin/rental-contracts');
      setContracts(data.contracts || data || []);
    } catch (err) {
      console.log('Error fetching contracts:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchContracts(); }, []);
  const onRefresh = () => { setRefreshing(true); fetchContracts(); };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active': case 'activo': return Colors.success;
      case 'pending': case 'pendiente': case 'draft': return Colors.warning;
      case 'expired': case 'vencido': return Colors.error;
      case 'signed': case 'firmado': return '#3B82F6';
      default: return Colors.textMuted;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active': return 'Activo';
      case 'pending': case 'draft': return 'Pendiente';
      case 'expired': return 'Vencido';
      case 'signed': return 'Firmado';
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
        colors={['rgba(217,170,92,0.08)', 'transparent']}
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
            <Text style={styles.headerTitle}>Contratos</Text>
            <Text style={styles.headerSubtitle}>{contracts.length} contratos registrados</Text>
          </View>
        </View>

        {/* Contracts List */}
        {contracts.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={60} color={Colors.textMuted} />
            <Text style={styles.emptyText}>No hay contratos registrados</Text>
          </View>
        ) : (
          contracts.map((contract) => (
            <TouchableOpacity
              key={contract._id}
              style={styles.contractCard}
              onPress={() => router.push(`/admin-contract-detail?id=${contract._id}`)}
              activeOpacity={0.7}
            >
              <View style={styles.cardHeader}>
                <View style={[styles.iconWrap, { backgroundColor: 'rgba(217,170,92,0.15)' }]}>
                  <Ionicons name="document-text" size={20} color={Colors.warmGold} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.tenantName}>{contract.tenant_name}</Text>
                  <Text style={styles.propertyName}>{contract.property_name}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor(contract.status)}20` }]}>
                  <Text style={[styles.statusText, { color: getStatusColor(contract.status) }]}>
                    {getStatusLabel(contract.status)}
                  </Text>
                </View>
              </View>
              
              <View style={styles.contractDetails}>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Renta</Text>
                  <Text style={styles.detailValue}>{formatCurrency(contract.rent_amount)}</Text>
                </View>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Depósito</Text>
                  <Text style={styles.detailValue}>{formatCurrency(contract.deposit_amount || contract.deposit || 0)}</Text>
                </View>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Vigencia</Text>
                  <Text style={styles.detailValue}>{contract.start_date} - {contract.end_date}</Text>
                </View>
              </View>
            </TouchableOpacity>
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

  contractCard: {
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
  statusBadge: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: BorderRadius.full,
  },
  statusText: { fontSize: 11, fontWeight: '600' },
  
  contractDetails: {
    flexDirection: 'row', justifyContent: 'space-between',
    marginTop: 12, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: Colors.glassBorder,
  },
  detailItem: { alignItems: 'center' },
  detailLabel: { fontSize: 10, color: Colors.textMuted, textTransform: 'uppercase', marginBottom: 4 },
  detailValue: { fontSize: FontSizes.sm, color: Colors.textPrimary, fontWeight: '600' },

  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { fontSize: FontSizes.md, color: Colors.textMuted, marginTop: 16 },
});
