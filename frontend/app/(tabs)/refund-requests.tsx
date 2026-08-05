import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useThemeColors } from '../../constants/colors';
import api from '../../services/api';
import { useTranslation } from 'react-i18next';

interface RefundRequest {
  id: string;
  user_id: string;
  refund_type: 'CREDITS' | 'ORIGINAL_PAYMENT';
  amount: number;
  reason: string;
  purchase_id?: string;
  usage_id?: string;
  status: 'pending' | 'completed' | 'rejected';
  rejection_reason?: string;
  requested_at: string;
  processed_at?: string;
}

export default function RefundRequestsScreen() {
  const colors = useThemeColors();
  const { t } = useTranslation();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refunds, setRefunds] = useState<RefundRequest[]>([]);
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed' | 'rejected'>('all');

  useEffect(() => {
    loadRefunds();
  }, [filter]);

  const loadRefunds = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const params: any = {};
      if (filter !== 'all') {
        params.status = filter;
      }

      const response = await api.get('/credits/refund/requests', { params });
      setRefunds(response.data.refunds || []);
    } catch (error) {
      console.error('Error loading refunds:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    loadRefunds(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return colors.warning;
      case 'completed': return colors.success;
      case 'rejected': return colors.error;
      default: return colors.textGray;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return 'time-outline';
      case 'completed': return 'checkmark-circle';
      case 'rejected': return 'close-circle';
      default: return 'help-circle';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return t('refundRequests.pending');
      case 'completed': return 'Aprobada';
      case 'rejected': return 'Rechazada';
      default: return status;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const renderRefund = (refund: RefundRequest) => {
    const statusColor = getStatusColor(refund.status);

    return (
      <View key={refund.id} style={styles.refundCard}>
        {/* Header */}
        <View style={styles.refundHeader}>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + '15' }]}>
            <Ionicons name={getStatusIcon(refund.status) as any} size={16} color={statusColor} />
            <Text style={[styles.statusText, { color: statusColor }]}>
              {getStatusLabel(refund.status)}
            </Text>
          </View>
          <Text style={styles.refundDate}>{formatDate(refund.requested_at)}</Text>
        </View>

        {/* Amount */}
        <View style={styles.amountSection}>
          <Text style={styles.amountLabel}>Monto:</Text>
          <Text style={styles.amountValue}>{refund.amount} créditos</Text>
        </View>

        {/* Type */}
        <View style={styles.refundType}>
          <Ionicons 
            name={refund.refund_type === 'CREDITS' ? 'sparkles' : 'card'} 
            size={18} 
            color={colors.primary} 
          />
          <Text style={styles.refundTypeText}>
            {refund.refund_type === 'CREDITS' 
              ? 'Reembolso en Créditos' 
              : 'Reembolso al Método Original'}
          </Text>
        </View>

        {/* Reason */}
        <View style={styles.reasonSection}>
          <Text style={styles.reasonLabel}>Motivo:</Text>
          <Text style={styles.reasonText}>{refund.reason}</Text>
        </View>

        {/* Rejection Reason (if rejected) */}
        {refund.status === 'rejected' && refund.rejection_reason && (
          <View style={styles.rejectionSection}>
            <Ionicons name="alert-circle" size={18} color={colors.error} />
            <View style={styles.rejectionContent}>
              <Text style={styles.rejectionLabel}>Motivo del rechazo:</Text>
              <Text style={styles.rejectionText}>{refund.rejection_reason}</Text>
            </View>
          </View>
        )}

        {/* Processed Date */}
        {refund.processed_at && (
          <Text style={styles.processedDate}>
            Procesada: {formatDate(refund.processed_at)}
          </Text>
        )}
      </View>
    );
  };

  const filteredCount = (status: string) => {
    if (status === 'all') return refunds.length;
    return refunds.filter(r => r.status === status).length;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Mis Reembolsos</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Cargando solicitudes...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mis Reembolsos</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Filter Chips */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterContainer}
      >
        <TouchableOpacity
          style={[styles.filterChip, filter === 'all' && styles.filterChipActive]}
          onPress={() => setFilter('all')}
        >
          <Text style={[styles.filterChipText, filter === 'all' && styles.filterChipTextActive]}>
            Todas
          </Text>
          {filteredCount('all') > 0 && (
            <View style={[styles.filterBadge, filter === 'all' && styles.filterBadgeActive]}>
              <Text style={[styles.filterBadgeText, filter === 'all' && styles.filterBadgeTextActive]}>
                {filteredCount('all')}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterChip, filter === 'pending' && styles.filterChipActive]}
          onPress={() => setFilter('pending')}
        >
          <Ionicons 
            name="time" 
            size={16} 
            color={filter === 'pending' ? '#FFF' : colors.warning} 
          />
          <Text style={[styles.filterChipText, filter === 'pending' && styles.filterChipTextActive]}>
            Pendientes
          </Text>
          {filteredCount('pending') > 0 && (
            <View style={[styles.filterBadge, filter === 'pending' && styles.filterBadgeActive]}>
              <Text style={[styles.filterBadgeText, filter === 'pending' && styles.filterBadgeTextActive]}>
                {filteredCount('pending')}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterChip, filter === 'completed' && styles.filterChipActive]}
          onPress={() => setFilter('completed')}
        >
          <Ionicons 
            name="checkmark-circle" 
            size={16} 
            color={filter === 'completed' ? '#FFF' : colors.success} 
          />
          <Text style={[styles.filterChipText, filter === 'completed' && styles.filterChipTextActive]}>
            Aprobadas
          </Text>
          {filteredCount('completed') > 0 && (
            <View style={[styles.filterBadge, filter === 'completed' && styles.filterBadgeActive]}>
              <Text style={[styles.filterBadgeText, filter === 'completed' && styles.filterBadgeTextActive]}>
                {filteredCount('completed')}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterChip, filter === 'rejected' && styles.filterChipActive]}
          onPress={() => setFilter('rejected')}
        >
          <Ionicons 
            name="close-circle" 
            size={16} 
            color={filter === 'rejected' ? '#FFF' : colors.error} 
          />
          <Text style={[styles.filterChipText, filter === 'rejected' && styles.filterChipTextActive]}>
            Rechazadas
          </Text>
          {filteredCount('rejected') > 0 && (
            <View style={[styles.filterBadge, filter === 'rejected' && styles.filterBadgeActive]}>
              <Text style={[styles.filterBadgeText, filter === 'rejected' && styles.filterBadgeTextActive]}>
                {filteredCount('rejected')}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* List */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {refunds.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={64} color={colors.textGray} />
            <Text style={styles.emptyStateTitle}>Sin Solicitudes</Text>
            <Text style={styles.emptyStateText}>
              {filter === 'all' 
                ? 'No has realizado ninguna solicitud de reembolso' 
                : `No tienes solicitudes ${getStatusLabel(filter).toLowerCase()}`}
            </Text>
          </View>
        ) : (
          refunds.map(renderRefund)
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: colors.textGray,
  },
  filterContainer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  filterChipTextActive: {
    color: '#FFF',
  },
  filterBadge: {
    backgroundColor: colors.primary + '20',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 24,
    alignItems: 'center',
  },
  filterBadgeActive: {
    backgroundColor: '#FFF',
  },
  filterBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  filterBadgeTextActive: {
    color: colors.primary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  refundCard: {
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  refundHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
  },
  refundDate: {
    fontSize: 12,
    color: colors.textGray,
  },
  amountSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  amountLabel: {
    fontSize: 14,
    color: colors.textGray,
  },
  amountValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.primary,
  },
  refundType: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 6,
  },
  refundTypeText: {
    fontSize: 14,
    color: colors.text,
  },
  reasonSection: {
    backgroundColor: colors.background,
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  reasonLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textGray,
    marginBottom: 4,
  },
  reasonText: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  rejectionSection: {
    flexDirection: 'row',
    backgroundColor: colors.error + '10',
    padding: 12,
    borderRadius: 8,
    gap: 8,
    marginBottom: 8,
  },
  rejectionContent: {
    flex: 1,
  },
  rejectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.error,
    marginBottom: 4,
  },
  rejectionText: {
    fontSize: 13,
    color: colors.text,
    lineHeight: 18,
  },
  processedDate: {
    fontSize: 12,
    color: colors.textGray,
    fontStyle: 'italic',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: colors.textGray,
    textAlign: 'center',
    maxWidth: 250,
  },
});