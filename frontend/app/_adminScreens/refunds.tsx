import React, { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import AdminHeader from '../../components/admin/AdminHeader';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  TextInput,
  Modal,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../../constants/colors';
import api from '../../services/api';

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
  approved_by?: string;
}

export default function AdminRefundsScreen() {
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refunds, setRefunds] = useState<RefundRequest[]>([]);
  const [filter, setFilter] = useState<'pending' | 'completed' | 'rejected' | 'all'>('pending');
  const [processing, setProcessing] = useState(false);
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [selectedRefund, setSelectedRefund] = useState<RefundRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

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

      const response = await api.get('/admin/credits/refund/requests', { params });
      setRefunds(response.data.refunds || []);
    } catch (error) {
      console.error('Error loading refunds:', error);
      Alert.alert('Error', 'No se pudieron cargar las solicitudes');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    loadRefunds(true);
  };

  const handleApprove = (refund: RefundRequest) => {
    Alert.alert(
      'Aprobar Reembolso',
      `¿Estás seguro de aprobar este reembolso?\n\nMonto: ${refund.amount} créditos\nTipo: ${refund.refund_type === 'CREDITS' ? 'En Créditos' : 'Método Original'}\n\nEsta acción es irreversible.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Aprobar',
          style: 'default',
          onPress: () => processRefund(refund.id, 'approve')
        }
      ]
    );
  };

  const handleReject = (refund: RefundRequest) => {
    setSelectedRefund(refund);
    setRejectionReason('');
    setRejectModalVisible(true);
  };

  const submitRejection = () => {
    if (!rejectionReason.trim()) {
      Alert.alert('Campo Requerido', 'Debes ingresar un motivo de rechazo');
      return;
    }

    if (selectedRefund) {
      processRefund(selectedRefund.id, 'reject', rejectionReason);
      setRejectModalVisible(false);
    }
  };

  const processRefund = async (refundId: string, action: 'approve' | 'reject', rejectionReason?: string) => {
    try {
      setProcessing(true);

      await api.post('/admin/credits/refund/process', {
        refund_id: refundId,
        action,
        rejection_reason: rejectionReason
      });

      Alert.alert(
        'Éxito',
        `Reembolso ${action === 'approve' ? 'aprobado' : 'rechazado'} exitosamente`,
        [{ text: 'OK', onPress: () => loadRefunds() }]
      );
    } catch (error: any) {
      console.error('Error processing refund:', error);
      const errorMsg = error.response?.data?.detail || 'Error al procesar el reembolso';
      Alert.alert('Error', errorMsg);
    } finally {
      setProcessing(false);
    }
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
      case 'pending': return 'hourglass-outline';
      case 'completed': return 'checkmark-circle';
      case 'rejected': return 'close-circle';
      default: return 'help-circle';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return 'Pendiente';
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

  const filteredRefunds = refunds.filter(r => 
    r.user_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.reason.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getFilterCount = (status: string) => {
    if (status === 'all') return refunds.length;
    return refunds.filter(r => r.status === status).length;
  };

  const renderRefund = (refund: RefundRequest) => {
    const statusColor = getStatusColor(refund.status);
    const isPending = refund.status === 'pending';

    return (
      <View key={refund.id} style={styles.refundCard}>
        {/* Icon and Status */}
        <View style={[styles.iconContainer, { backgroundColor: statusColor + '20' }]}>
          <Ionicons name={getStatusIcon(refund.status) as any} size={24} color={statusColor} />
        </View>

        {/* Main Content */}
        <View style={styles.mainContent}>
          <View style={styles.topRow}>
            <Text style={styles.userId}>{refund.user_id.substring(0, 10)}...</Text>
            <View style={[styles.statusBadge, { backgroundColor: statusColor + '15' }]}>
              <Text style={[styles.statusText, { color: statusColor }]}>
                {getStatusLabel(refund.status)}
              </Text>
            </View>
          </View>

          <Text style={styles.reasonText} numberOfLines={2}>
            {refund.reason}
          </Text>

          <View style={styles.detailsRow}>
            <View style={styles.detailItem}>
              <Ionicons 
                name={refund.refund_type === 'CREDITS' ? 'sparkles' : 'card'} 
                size={14} 
                color={colors.textGray} 
              />
              <Text style={styles.detailText}>
                {refund.refund_type === 'CREDITS' ? 'Créditos' : 'Original'}
              </Text>
            </View>
            <Text style={styles.dateText}>{formatDate(refund.requested_at)}</Text>
          </View>

          {refund.status === 'rejected' && refund.rejection_reason && (
            <View style={styles.rejectionBanner}>
              <Ionicons name="alert-circle" size={14} color={colors.error} />
              <Text style={styles.rejectionText} numberOfLines={1}>
                {refund.rejection_reason}
              </Text>
            </View>
          )}

          {isPending && (
            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={[styles.actionBtn, styles.rejectBtn]}
                onPress={() => handleReject(refund)}
                disabled={processing}
              >
                <Ionicons name="close-circle" size={18} color={colors.error} />
                <Text style={styles.rejectBtnText}>Rechazar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionBtn, styles.approveBtn]}
                onPress={() => handleApprove(refund)}
                disabled={processing}
              >
                {processing ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={18} color="#FFF" />
                    <Text style={styles.approveBtnText}>Aprobar</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Amount Section */}
        <View style={styles.amountSection}>
          <Text style={styles.amountValue}>{refund.amount}</Text>
          <Text style={styles.amountLabel}>créditos</Text>
          {refund.processed_at && (
            <Text style={styles.processedBadge}>✓</Text>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <AdminHeader title="Reembolsos" />

        <View style={styles.content}>
          {loading && !refreshing ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>Cargando solicitudes...</Text>
            </View>
          ) : (
            <>
              <View style={styles.searchContainer}>
                <Ionicons name="search" size={20} color={colors.textGray} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Buscar por usuario o motivo..."
                  placeholderTextColor={colors.textGray}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery('')}>
                    <Ionicons name="close-circle" size={20} color={colors.textGray} />
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.filtersContainer}>
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.filtersScroll}
                >
                  {[
                    { key: 'pending', icon: 'hourglass-outline', label: 'Pendientes' },
                    { key: 'completed', icon: 'checkmark-circle-outline', label: 'Aprobadas' },
                    { key: 'rejected', icon: 'close-circle-outline', label: 'Rechazadas' },
                    { key: 'all', icon: 'list-outline', label: 'Todas' },
                  ].map(tab => {
                    const isActive = filter === tab.key;
                    const count = getFilterCount(tab.key);
                    
                    return (
                      <TouchableOpacity
                        key={tab.key}
                        style={[styles.filterChip, isActive && styles.filterChipActive]}
                        onPress={() => setFilter(tab.key as any)}
                        activeOpacity={0.7}
                      >
                        <Ionicons 
                          name={tab.icon as any} 
                          size={18} 
                          color={isActive ? '#FFF' : colors.primary} 
                        />
                        <Text style={[styles.filterChipLabel, isActive && styles.filterChipLabelActive]}>
                          {tab.label}
                        </Text>
                        {count > 0 && (
                          <View style={[styles.filterChipBadge, isActive && styles.filterChipBadgeActive]}>
                            <Text style={[styles.filterChipBadgeText, isActive && styles.filterChipBadgeTextActive]}>
                              {count}
                            </Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                refreshControl={
                  <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
              >
                {filteredRefunds.length === 0 ? (
                  <View style={styles.emptyState}>
                    <View style={styles.emptyIconCircle}>
                      <Ionicons name="receipt-outline" size={48} color={colors.textGray} />
                    </View>
                    <Text style={styles.emptyStateTitle}>
                      {searchQuery ? 'Sin resultados' : 'Sin Solicitudes'}
                    </Text>
                    <Text style={styles.emptyStateText}>
                      {searchQuery 
                        ? 'No se encontraron solicitudes con ese criterio' 
                        : `No hay solicitudes ${filter !== 'all' ? getStatusLabel(filter).toLowerCase() : ''}`}
                    </Text>
                  </View>
                ) : (
                  filteredRefunds.map(renderRefund)
                )}
              </ScrollView>
            </>
          )}
        </View>

      <Modal
        visible={rejectModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRejectModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalIconHeader}>
              <View style={styles.modalIconCircle}>
                <Ionicons name="close-circle" size={40} color={colors.error} />
              </View>
            </View>

            <Text style={styles.modalTitle}>Rechazar Reembolso</Text>
            <Text style={styles.modalSubtitle}>
              Explica el motivo del rechazo al usuario
            </Text>

            <TextInput
              style={styles.modalInput}
              placeholder="Motivo del rechazo..."
              placeholderTextColor={colors.textGray}
              value={rejectionReason}
              onChangeText={setRejectionReason}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalCancelBtn]}
                onPress={() => setRejectModalVisible(false)}
              >
                <Text style={styles.modalCancelBtnText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalBtn, styles.modalConfirmBtn]}
                onPress={submitRejection}
                disabled={!rejectionReason.trim()}
              >
                <Ionicons name="checkmark" size={20} color="#FFF" />
                <Text style={styles.modalConfirmBtnText}>Rechazar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  layout: { flex: 1, flexDirection: 'row' },
  content: { flex: 1 },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingHorizontal: 20, 
    paddingVertical: 16, 
    backgroundColor: '#FFF', 
    borderBottomWidth: 1, 
    borderBottomColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 3,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconCircle: { 
    width: 44, 
    height: 44, 
    borderRadius: 22, 
    backgroundColor: colors.primary + '15', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: colors.text },
  headerSubtitle: { fontSize: 13, color: colors.textGray, marginTop: 2 },
  refreshBtn: { 
    width: 40, 
    height: 40, 
    borderRadius: 20, 
    backgroundColor: colors.primary + '10', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 16, fontSize: 16, color: colors.textGray },
  searchContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#FFF', 
    marginHorizontal: 16, 
    marginTop: 16, 
    paddingHorizontal: 14, 
    paddingVertical: 10, 
    borderRadius: 12, 
    borderWidth: 1, 
    borderColor: colors.border, 
    gap: 10 
  },
  searchInput: { flex: 1, fontSize: 15, color: colors.text },
  filtersContainer: {
    backgroundColor: '#FFF',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  filtersScroll: {
    paddingHorizontal: 16,
    gap: 10,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.primary + '15',
    borderWidth: 1.5,
    borderColor: colors.primary + '30',
    gap: 6,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 5,
  },
  filterChipLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  filterChipLabelActive: {
    color: '#FFF',
  },
  filterChipBadge: {
    backgroundColor: colors.primary,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  filterChipBadgeActive: {
    backgroundColor: '#FFF',
  },
  filterChipBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#FFF',
  },
  filterChipBadgeTextActive: {
    color: colors.primary,
  },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 100 },
  refundCard: { 
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF', 
    borderRadius: 12, 
    marginBottom: 12, 
    padding: 14,
    borderWidth: 1, 
    borderColor: colors.border, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 2 }, 
    shadowOpacity: 0.05, 
    shadowRadius: 4, 
    elevation: 2,
    gap: 12,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mainContent: {
    flex: 1,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  userId: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  reasonText: {
    fontSize: 13,
    color: '#000000',
    lineHeight: 18,
    marginBottom: 6,
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailText: {
    fontSize: 12,
    color: colors.textGray,
    fontWeight: '500',
  },
  dateText: {
    fontSize: 11,
    color: colors.textGray,
  },
  rejectionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.error + '10',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
    marginBottom: 6,
  },
  rejectionText: {
    flex: 1,
    fontSize: 11,
    color: colors.error,
    fontWeight: '600',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 8,
    gap: 6,
  },
  rejectBtn: {
    backgroundColor: colors.error + '10',
    borderWidth: 1,
    borderColor: colors.error + '30',
  },
  rejectBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.error,
  },
  approveBtn: {
    backgroundColor: colors.success,
  },
  approveBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFF',
  },
  amountSection: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    minWidth: 75,
  },
  amountValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.primary,
  },
  amountLabel: {
    fontSize: 11,
    color: colors.textGray,
    marginTop: 2,
  },
  processedBadge: {
    fontSize: 16,
    color: colors.success,
    marginTop: 4,
  },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 80 },
  emptyIconCircle: { 
    width: 96, 
    height: 96, 
    borderRadius: 48, 
    backgroundColor: colors.background, 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginBottom: 16 
  },
  emptyStateTitle: { fontSize: 20, fontWeight: 'bold', color: colors.text, marginBottom: 8 },
  emptyStateText: { fontSize: 14, color: colors.textGray, textAlign: 'center', maxWidth: 280 },
  modalOverlay: { 
    flex: 1, 
    backgroundColor: 'rgba(0, 0, 0, 0.6)', 
    justifyContent: 'center', 
    alignItems: 'center', 
    padding: 20 
  },
  modalContainer: { 
    backgroundColor: '#FFF', 
    borderRadius: 20, 
    padding: 24, 
    width: '100%', 
    maxWidth: 440 
  },
  modalIconHeader: { alignItems: 'center', marginBottom: 16 },
  modalIconCircle: { 
    width: 80, 
    height: 80, 
    borderRadius: 40, 
    backgroundColor: colors.error + '15', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  modalTitle: { 
    fontSize: 22, 
    fontWeight: 'bold', 
    color: colors.text, 
    textAlign: 'center', 
    marginBottom: 8 
  },
  modalSubtitle: { 
    fontSize: 14, 
    color: colors.textGray, 
    textAlign: 'center', 
    marginBottom: 24 
  },
  modalInput: { 
    backgroundColor: colors.background, 
    borderWidth: 1, 
    borderColor: colors.border, 
    borderRadius: 12, 
    padding: 14, 
    fontSize: 15, 
    color: colors.text, 
    minHeight: 100, 
    marginBottom: 24 
  },
  modalActions: { flexDirection: 'row', gap: 12 },
  modalBtn: { 
    flex: 1, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    paddingVertical: 14, 
    borderRadius: 12, 
    gap: 8 
  },
  modalCancelBtn: { 
    backgroundColor: colors.background, 
    borderWidth: 1, 
    borderColor: colors.border 
  },
  modalCancelBtnText: { fontSize: 16, fontWeight: '600', color: colors.text },
  modalConfirmBtn: { backgroundColor: colors.error },
  modalConfirmBtnText: { fontSize: 16, fontWeight: '600', color: '#FFF' },
});