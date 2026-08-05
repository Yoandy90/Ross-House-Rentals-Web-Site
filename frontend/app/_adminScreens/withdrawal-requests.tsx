import React, { useState, useEffect } from 'react';
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
import AdminHeader from '../../components/admin/AdminHeader';
import api from '../../services/api';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

interface WithdrawalRequest {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  amount: number;
  method: 'bank_transfer' | 'check' | 'paypal' | 'cash';
  status: 'pending' | 'approved' | 'processing' | 'completed' | 'rejected';
  bank_details?: {
    account_name: string;
    account_number: string;
    routing_number: string;
    bank_name: string;
  };
  paypal_email?: string;
  requested_at: string;
  processed_at?: string;
  completed_at?: string;
  admin_notes?: string;
  rejection_reason?: string;
}

export default function WithdrawalRequestsScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [requests, setRequests] = useState<WithdrawalRequest[]>([]);
  const [activeTab, setActiveTab] = useState<'pending' | 'all'>('pending');
  const [selectedRequest, setSelectedRequest] = useState<WithdrawalRequest | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);
  const [notes, setNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');

  useEffect(() => {
    loadRequests();
  }, [activeTab]);

  const loadRequests = async () => {
    try {
      setLoading(true);
      const status = activeTab === 'pending' ? 'pending' : undefined;
      const response = await api.get('/payments/admin/withdrawal-requests', {
        params: { status }
      });
      setRequests(response.data.requests || []);
    } catch (error: any) {
      console.error('Error loading withdrawal requests:', error);
      Alert.alert('Error', 'No se pudieron cargar las solicitudes de retiro');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadRequests();
  };

  const openActionModal = (request: WithdrawalRequest, action: 'approve' | 'reject') => {
    setSelectedRequest(request);
    setActionType(action);
    setNotes('');
    setRejectionReason('');
    setModalVisible(true);
  };

  const handleAction = async () => {
    if (!selectedRequest || !actionType) return;

    if (actionType === 'reject' && !rejectionReason.trim()) {
      Alert.alert('Error', 'Debes proporcionar una razón para el rechazo');
      return;
    }

    try {
      const endpoint = actionType === 'approve' 
        ? `/api/payments/admin/withdrawal-requests/${selectedRequest.id}/approve`
        : `/api/payments/admin/withdrawal-requests/${selectedRequest.id}/reject`;

      const payload = actionType === 'approve'
        ? { admin_notes: notes }
        : { rejection_reason: rejectionReason, admin_notes: notes };

      await api.post(endpoint, payload);
      
      Alert.alert(
        'Éxito',
        actionType === 'approve' 
          ? 'Solicitud aprobada correctamente'
          : 'Solicitud rechazada'
      );
      
      setModalVisible(false);
      loadRequests();
    } catch (error: any) {
      console.error(`Error ${actionType}ing request:`, error);
      Alert.alert('Error', error.response?.data?.detail || 'No se pudo procesar la solicitud');
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { label: 'Pendiente', color: '#F59E0B', icon: 'time' },
      approved: { label: 'Aprobada', color: '#10B981', icon: 'checkmark-circle' },
      processing: { label: 'Procesando', color: '#3B82F6', icon: 'sync' },
      completed: { label: 'Completada', color: '#10B981', icon: 'checkmark-done' },
      rejected: { label: 'Rechazada', color: '#EF4444', icon: 'close-circle' },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;

    return (
      <View style={[styles.statusBadge, { backgroundColor: config.color + '15' }]}>
        <Ionicons name={config.icon as any} size={16} color={config.color} />
        <Text style={[styles.statusText, { color: config.color }]}>{config.label}</Text>
      </View>
    );
  };

  const getMethodIcon = (method: string) => {
    const icons = {
      bank_transfer: 'business',
      check: 'document-text',
      paypal: 'logo-paypal',
      cash: 'cash',
    };
    return icons[method as keyof typeof icons] || 'wallet';
  };

  const getMethodLabel = (method: string) => {
    const labels = {
      bank_transfer: 'Transferencia Bancaria',
      check: 'Cheque',
      paypal: 'PayPal',
      cash: 'Efectivo',
    };
    return labels[method as keyof typeof labels] || method;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const renderTabBar = () => (
    <View style={[styles.tabBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
      <TouchableOpacity
        style={[styles.tab, activeTab === 'pending' && { borderBottomColor: colors.primary, borderBottomWidth: 3 }]}
        onPress={() => setActiveTab('pending')}
      >
        <Ionicons name="time" size={20} color={activeTab === 'pending' ? colors.primary : colors.textSecondary} />
        <Text style={[styles.tabText, { color: activeTab === 'pending' ? colors.primary : colors.textSecondary }]}>
          Pendientes
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.tab, activeTab === 'all' && { borderBottomColor: colors.primary, borderBottomWidth: 3 }]}
        onPress={() => setActiveTab('all')}
      >
        <Ionicons name="list" size={20} color={activeTab === 'all' ? colors.primary : colors.textSecondary} />
        <Text style={[styles.tabText, { color: activeTab === 'all' ? colors.primary : colors.textSecondary }]}>
          Todas
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderRequestCard = (request: WithdrawalRequest) => (
    <View key={request.id} style={[styles.requestCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.cardHeader}>
        <View style={styles.userInfo}>
          <View style={[styles.avatar, { backgroundColor: colors.primary + '20' }]}>
            <Text style={[styles.avatarText, { color: colors.primary }]}>
              {request.user_name.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.userDetails}>
            <Text style={[styles.userName, { color: colors.text }]}>{request.user_name}</Text>
            <Text style={[styles.userEmail, { color: colors.textSecondary }]}>{request.user_email}</Text>
          </View>
        </View>
        {getStatusBadge(request.status)}
      </View>

      <View style={styles.amountSection}>
        <Text style={[styles.amountLabel, { color: colors.textSecondary }]}>Monto Solicitado</Text>
        <Text style={[styles.amount, { color: colors.primary }]}>${request.amount.toFixed(2)}</Text>
      </View>

      <View style={styles.detailsSection}>
        <View style={styles.detailRow}>
          <Ionicons name={getMethodIcon(request.method) as any} size={20} color={colors.textSecondary} />
          <Text style={[styles.detailText, { color: colors.text }]}>{getMethodLabel(request.method)}</Text>
        </View>

        <View style={styles.detailRow}>
          <Ionicons name="calendar" size={20} color={colors.textSecondary} />
          <Text style={[styles.detailText, { color: colors.text }]}>{formatDate(request.requested_at)}</Text>
        </View>

        {request.method === 'bank_transfer' && request.bank_details && (
          <View style={[styles.bankDetails, { backgroundColor: colors.background }]}>
            <Text style={[styles.bankDetailLabel, { color: colors.textSecondary }]}>Detalles Bancarios:</Text>
            <Text style={[styles.bankDetailText, { color: colors.text }]}>
              {request.bank_details.bank_name}
            </Text>
            <Text style={[styles.bankDetailText, { color: colors.text }]}>
              {request.bank_details.account_name}
            </Text>
            <Text style={[styles.bankDetailText, { color: colors.text }]}>
              ****{request.bank_details.account_number.slice(-4)}
            </Text>
          </View>
        )}

        {request.method === 'paypal' && request.paypal_email && (
          <View style={[styles.bankDetails, { backgroundColor: colors.background }]}>
            <Text style={[styles.bankDetailLabel, { color: colors.textSecondary }]}>PayPal:</Text>
            <Text style={[styles.bankDetailText, { color: colors.text }]}>{request.paypal_email}</Text>
          </View>
        )}

        {request.admin_notes && (
          <View style={[styles.notesSection, { backgroundColor: colors.background }]}>
            <Text style={[styles.notesLabel, { color: colors.textSecondary }]}>Notas del Admin:</Text>
            <Text style={[styles.notesText, { color: colors.text }]}>{request.admin_notes}</Text>
          </View>
        )}

        {request.rejection_reason && (
          <View style={[styles.rejectionSection, { backgroundColor: colors.error + '10' }]}>
            <Text style={[styles.rejectionLabel, { color: colors.error }]}>Razón del Rechazo:</Text>
            <Text style={[styles.rejectionText, { color: colors.error }]}>{request.rejection_reason}</Text>
          </View>
        )}
      </View>

      {request.status === 'pending' && (
        <View style={styles.actionsSection}>
          <TouchableOpacity
            style={[styles.actionButton, styles.rejectButton, { borderColor: colors.error }]}
            onPress={() => openActionModal(request, 'reject')}
          >
            <Ionicons name="close-circle" size={20} color={colors.error} />
            <Text style={[styles.actionButtonText, { color: colors.error }]}>Rechazar</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.approveButton, { backgroundColor: colors.success }]}
            onPress={() => openActionModal(request, 'approve')}
          >
            <Ionicons name="checkmark-circle" size={20} color="#fff" />
            <Text style={[styles.actionButtonText, { color: '#fff' }]}>Aprobar</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  const renderActionModal = () => (
    <Modal
      visible={modalVisible}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setModalVisible(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {actionType === 'approve' ? 'Aprobar Solicitud' : 'Rechazar Solicitud'}
            </Text>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Ionicons name="close" size={28} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            {selectedRequest && (
              <View style={[styles.requestSummary, { backgroundColor: colors.card }]}>
                <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Usuario:</Text>
                <Text style={[styles.summaryValue, { color: colors.text }]}>{selectedRequest.user_name}</Text>
                
                <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Monto:</Text>
                <Text style={[styles.summaryValue, { color: colors.primary }]}>
                  ${selectedRequest.amount.toFixed(2)}
                </Text>
                
                <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Método:</Text>
                <Text style={[styles.summaryValue, { color: colors.text }]}>
                  {getMethodLabel(selectedRequest.method)}
                </Text>
              </View>
            )}

            {actionType === 'reject' && (
              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: colors.text }]}>Razón del Rechazo *</Text>
                <TextInput
                  style={[styles.textArea, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
                  value={rejectionReason}
                  onChangeText={setRejectionReason}
                  placeholder={t('admin.rejectReasonRequired', 'Explica por qué se rechaza esta solicitud...')}
                  placeholderTextColor={colors.textSecondary}
                  multiline
                  numberOfLines={4}
                />
              </View>
            )}

            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.text }]}>Notas Administrativas (Opcional)</Text>
              <TextInput
                style={[styles.textArea, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
                value={notes}
                onChangeText={setNotes}
                placeholder={t('admin.internalNotesPlaceholder', 'Agrega notas internas sobre esta acción...')}
                placeholderTextColor={colors.textSecondary}
                multiline
                numberOfLines={3}
              />
            </View>
          </ScrollView>

          <View style={[styles.modalFooter, { borderTopColor: colors.border }]}>
            <TouchableOpacity
              style={[styles.modalButton, styles.cancelButton, { backgroundColor: colors.border }]}
              onPress={() => setModalVisible(false)}
            >
              <Text style={[styles.modalButtonText, { color: colors.text }]}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.modalButton,
                styles.confirmButton,
                { backgroundColor: actionType === 'approve' ? colors.success : colors.error }
              ]}
              onPress={handleAction}
            >
              <Text style={[styles.modalButtonText, { color: '#fff' }]}>
                {actionType === 'approve' ? 'Aprobar' : 'Rechazar'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <AdminHeader title="Solicitudes de Retiro" subtitle="Cargando..." />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.text }]}>Cargando solicitudes...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AdminHeader title="Solicitudes de Retiro" subtitle={`${requests.length} solicitudes`} />
      
      {renderTabBar()}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        <View style={styles.headerSection}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            {requests.length} Solicitud{requests.length !== 1 ? 'es' : ''}
          </Text>
        </View>

        {requests.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="wallet-outline" size={64} color={colors.textLight} />
            <Text style={[styles.emptyText, { color: colors.textLight }]}>
              {activeTab === 'pending' 
                ? 'No hay solicitudes pendientes' 
                : 'No hay solicitudes de retiro'}
            </Text>
          </View>
        ) : (
          <View style={styles.requestsList}>
            {requests.map(renderRequestCard)}
          </View>
        )}
      </ScrollView>

      {renderActionModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  headerSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  requestsList: {
    gap: 16,
  },
  requestCard: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  userEmail: {
    fontSize: 13,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  amountSection: {
    alignItems: 'center',
    paddingVertical: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 16,
  },
  amountLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  amount: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  detailsSection: {
    gap: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  detailText: {
    fontSize: 14,
  },
  bankDetails: {
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  bankDetailLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  bankDetailText: {
    fontSize: 13,
    marginBottom: 2,
  },
  notesSection: {
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  notesLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  notesText: {
    fontSize: 13,
    lineHeight: 20,
  },
  rejectionSection: {
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  rejectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  rejectionText: {
    fontSize: 13,
    lineHeight: 20,
  },
  actionsSection: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 8,
  },
  rejectButton: {
    borderWidth: 2,
  },
  approveButton: {},
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 16,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  modalBody: {
    padding: 20,
  },
  requestSummary: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  summaryLabel: {
    fontSize: 12,
    marginTop: 8,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 4,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {},
  confirmButton: {},
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
