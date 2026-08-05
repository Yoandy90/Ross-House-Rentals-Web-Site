import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useThemeColors } from '../constants/colors';
import api from '../services/api';

interface MoneyRequest {
  id: string;
  requester_id: string;
  requester_email: string;
  requester_name: string;
  sender_id: string;
  sender_email: string;
  sender_name: string;
  amount: number;
  note: string | null;
  status: string;
  created_at: string;
  expires_at: string;
}

interface ReceiveMoneyModalProps {
  visible: boolean;
  onClose: () => void;
  userEmail: string;
  onSuccess?: () => void;
}

export const ReceiveMoneyModal: React.FC<ReceiveMoneyModalProps> = ({
  visible,
  onClose,
  userEmail,
  onSuccess,
}) => {
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const [activeTab, setActiveTab] = useState<'request' | 'received'>('request');
  const [receiverEmail, setReceiverEmail] = useState('');
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [receivedRequests, setReceivedRequests] = useState<MoneyRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Cargar solicitudes recibidas cuando se abre el modal o cambia a la pestaña
  useEffect(() => {
    if (visible && activeTab === 'received') {
      loadReceivedRequests();
    }
  }, [visible, activeTab]);

  const loadReceivedRequests = async () => {
    try {
      setLoadingRequests(true);
      const response = await api.get('/money-requests/received');
      setReceivedRequests(response.data || []);
    } catch (error) {
      console.error('Error loading received requests:', error);
    } finally {
      setLoadingRequests(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadReceivedRequests();
  };

  const handleApproveRequest = async (requestId: string, amount: number) => {
    try {
      Alert.alert(
        'Aprobar Solicitud',
        `¿Estás seguro de que deseas enviar $${amount.toFixed(2)}?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Aprobar',
            onPress: async () => {
              try {
                setLoadingRequests(true);
                await api.post(`/money-requests/${requestId}/approve`);
                
                // Actualizar lista de solicitudes
                await loadReceivedRequests();
                
                // Notificar a la pantalla principal para actualizar balance
                if (onSuccess) {
                  onSuccess();
                }
                
                // Cerrar el modal automáticamente después de aprobar
                setTimeout(() => {
                  onClose();
                }, 1500);
                
                // Mostrar mensaje de éxito
                Alert.alert('¡Éxito!', 'Créditos transferidos correctamente');
                
              } catch (error: any) {
                Alert.alert(
                  'Error',
                  error.response?.data?.detail || 'No se pudo aprobar la solicitud'
                );
              } finally {
                setLoadingRequests(false);
              }
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error approving request:', error);
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    try {
      Alert.alert(
        'Rechazar Solicitud',
        '¿Estás seguro de que deseas rechazar esta solicitud?',
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Rechazar',
            style: 'destructive',
            onPress: async () => {
              try {
                setLoadingRequests(true);
                await api.post(`/money-requests/${requestId}/reject`);
                
                // Actualizar lista de solicitudes
                await loadReceivedRequests();
                
                // Notificar a la pantalla principal
                if (onSuccess) {
                  onSuccess();
                }
                
                Alert.alert('Solicitud Rechazada', 'La solicitud ha sido rechazada');
                
              } catch (error: any) {
                Alert.alert(
                  'Error',
                  error.response?.data?.detail || 'No se pudo rechazar la solicitud'
                );
              } finally {
                setLoadingRequests(false);
              }
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error rejecting request:', error);
    }
  };

  const handleSendRequest = async () => {
    if (!receiverEmail || !amount) {
      Alert.alert('Error', 'Por favor completa todos los campos obligatorios');
      return;
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      Alert.alert('Error', 'Por favor ingresa un monto válido');
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(receiverEmail)) {
      Alert.alert('Error', 'Por favor ingresa un email válido');
      return;
    }

    setLoading(true);

    try {
      console.log('📨 Sending money request:', { receiverEmail, amount: amountNum, message });
      
      const response = await api.post('/money-requests', {
        recipient_identifier: receiverEmail,
        amount: amountNum,
        note: message || undefined,
      });

      console.log('✅ Money request sent:', response.data);

      Alert.alert(
        '¡Solicitud Enviada!',
        `Se ha enviado una solicitud de $${amountNum} a ${receiverEmail}`,
        [
          {
            text: 'OK',
            onPress: () => {
              // Reset form
              setReceiverEmail('');
              setAmount('');
              setMessage('');
              onClose();
            },
          },
        ]
      );
    } catch (error: any) {
      console.error('❌ Error sending money request:', error);
      const errorMessage = error.response?.data?.detail || 'Error al enviar la solicitud';
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const quickAmounts = [10, 20, 50, 100];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
      >
        <TouchableOpacity
          activeOpacity={1}
          style={styles.backdrop}
          onPress={onClose}
        />
        
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>Gestionar Dinero</Text>
              <Text style={styles.headerSubtitle}>Solicita o aprueba transferencias</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close-circle" size={32} color={colors.textGray} />
            </TouchableOpacity>
          </View>

          {/* Tabs */}
          <View style={styles.tabsContainer}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'request' && styles.activeTab]}
              onPress={() => setActiveTab('request')}
            >
              <Ionicons
                name="paper-plane-outline"
                size={20}
                color={activeTab === 'request' ? colors.primary : colors.textGray}
              />
              <Text style={[styles.tabText, activeTab === 'request' && styles.activeTabText]}>
                Solicitar
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.tab, activeTab === 'received' && styles.activeTab]}
              onPress={() => setActiveTab('received')}
            >
              <Ionicons
                name="download-outline"
                size={20}
                color={activeTab === 'received' ? colors.primary : colors.textGray}
              />
              <Text style={[styles.tabText, activeTab === 'received' && styles.activeTabText]}>
                Recibidas
              </Text>
              {receivedRequests.filter(r => r.status === 'pending').length > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {receivedRequests.filter(r => r.status === 'pending').length}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Content */}
          {activeTab === 'request' ? (
          <>
          <ScrollView 
            style={styles.body}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Receiver Email Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>A quién le solicitas</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="mail-outline" size={20} color={colors.textGray} />
                <TextInput
                  style={styles.input}
                  value={receiverEmail}
                  onChangeText={setReceiverEmail}
                  placeholder="correo@ejemplo.com"
                  placeholderTextColor={colors.textGray}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>

            {/* Amount Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Monto a solicitar</Text>
              <View style={styles.amountInputWrapper}>
                <Text style={styles.dollarSign}>$</Text>
                <TextInput
                  style={styles.amountInput}
                  value={amount}
                  onChangeText={setAmount}
                  placeholder="0"
                  placeholderTextColor={colors.textGray}
                  keyboardType="decimal-pad"
                  maxLength={6}
                />
                <Text style={styles.usdLabel}>USD</Text>
              </View>
            </View>

            {/* Quick Amounts */}
            <View style={styles.quickAmountsContainer}>
              <Text style={styles.quickAmountsLabel}>Montos rápidos</Text>
              <View style={styles.quickAmountsGrid}>
                {quickAmounts.map((quickAmount) => (
                  <TouchableOpacity
                    key={quickAmount}
                    style={[
                      styles.quickAmountButton,
                      amount === quickAmount.toString() && styles.quickAmountButtonActive
                    ]}
                    onPress={() => setAmount(quickAmount.toString())}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.quickAmountText,
                      amount === quickAmount.toString() && styles.quickAmountTextActive
                    ]}>
                      ${quickAmount}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Message Input (Optional) */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Mensaje (opcional)</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="chatbubble-outline" size={20} color={colors.textGray} />
                <TextInput
                  style={styles.input}
                  value={message}
                  onChangeText={setMessage}
                  placeholder="¿Por qué solicitas este dinero?"
                  placeholderTextColor={colors.textGray}
                  multiline
                  maxLength={200}
                />
              </View>
            </View>

            {/* Info Box */}
            <View style={styles.infoBox}>
              <Ionicons name="information-circle" size={20} color={colors.accent} />
              <Text style={styles.infoText}>
                El receptor recibirá una notificación y podrá aprobar o rechazar tu solicitud.
              </Text>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={[
                styles.sendButton,
                (!receiverEmail || !amount || loading) && styles.sendButtonDisabled
              ]}
              onPress={handleSendRequest}
              disabled={!receiverEmail || !amount || loading}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={(!receiverEmail || !amount || loading)
                  ? ['#9CA3AF', '#6B7280']
                  : [colors.primary, colors.secondary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.sendButtonGradient}
              >
                {loading ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <>
                    <Ionicons name="paper-plane" size={20} color="#FFF" />
                    <Text style={styles.sendButtonText}>Enviar Solicitud</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
          </>
          ) : (
          <>
          <ScrollView
            style={styles.body}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
            }
          >
            {loadingRequests && !refreshing ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.loadingText}>Cargando solicitudes...</Text>
              </View>
            ) : receivedRequests.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="mail-open-outline" size={64} color={colors.textGray} />
                <Text style={styles.emptyTitle}>No hay solicitudes</Text>
                <Text style={styles.emptyText}>
                  Aquí aparecerán las solicitudes de dinero que te envíen otros usuarios
                </Text>
              </View>
            ) : (
              receivedRequests.map((request) => (
                <View key={request.id} style={styles.requestCard}>
                  <View style={styles.requestHeader}>
                    <View style={styles.requestAvatarContainer}>
                      <Ionicons name="person" size={24} color={colors.primary} />
                    </View>
                    <View style={styles.requestInfo}>
                      <Text style={styles.requestName}>{request.requester_name}</Text>
                      <Text style={styles.requestEmail}>{request.requester_email}</Text>
                    </View>
                    <View style={[
                      styles.statusBadge,
                      request.status === 'pending' && styles.statusBadgePending,
                      request.status === 'approved' && styles.statusBadgeApproved,
                      request.status === 'rejected' && styles.statusBadgeRejected
                    ]}>
                      <Text style={styles.statusBadgeText}>
                        {request.status === 'pending' ? 'Pendiente' :
                         request.status === 'approved' ? 'Aprobada' : 'Rechazada'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.requestAmount}>
                    <Text style={styles.requestAmountLabel}>Monto solicitado:</Text>
                    <Text style={styles.requestAmountValue}>${request.amount.toFixed(2)}</Text>
                  </View>

                  {request.note && (
                    <View style={styles.requestNote}>
                      <Ionicons name="chatbubble-ellipses-outline" size={16} color={colors.textGray} />
                      <Text style={styles.requestNoteText}>{request.note}</Text>
                    </View>
                  )}

                  <Text style={styles.requestDate}>
                    {new Date(request.created_at).toLocaleDateString('es-ES', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </Text>

                  {request.status === 'pending' && (
                    <View style={styles.requestActions}>
                      <TouchableOpacity
                        style={styles.rejectButton}
                        onPress={() => handleRejectRequest(request.id)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="close-circle" size={20} color="#EF4444" />
                        <Text style={styles.rejectButtonText}>Rechazar</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.approveButton}
                        onPress={() => handleApproveRequest(request.id, request.amount)}
                        activeOpacity={0.7}
                      >
                        <LinearGradient
                          colors={[colors.primary, colors.secondary]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={styles.approveButtonGradient}
                        >
                          <Ionicons name="checkmark-circle" size={20} color="#FFF" />
                          <Text style={styles.approveButtonText}>Aprobar</Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              ))
            )}
          </ScrollView>
          </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const createStyles = (colors: any) => StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.backgroundGray,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: colors.textGray,
    fontWeight: '500',
  },
  closeButton: {
    padding: 4,
  },
  body: {
    padding: 20,
    maxHeight: 500,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
    padding: 0,
  },
  amountInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    paddingVertical: 16,
    paddingHorizontal: 20,
    gap: 8,
  },
  dollarSign: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.primary,
  },
  amountInput: {
    fontSize: 36,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
    minWidth: 100,
    padding: 0,
  },
  usdLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textGray,
  },
  quickAmountsContainer: {
    marginBottom: 20,
  },
  quickAmountsLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 10,
  },
  quickAmountsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  quickAmountButton: {
    flex: 1,
    minWidth: '22%',
    backgroundColor: colors.backgroundGray,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  quickAmountButtonActive: {
    backgroundColor: colors.primary + '15',
    borderColor: colors.primary,
  },
  quickAmountText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  quickAmountTextActive: {
    color: colors.primary,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.accent + '10',
    padding: 12,
    borderRadius: 12,
    gap: 10,
    marginTop: 4,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: colors.accent,
    lineHeight: 18,
    fontWeight: '500',
  },
  footer: {
    padding: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.backgroundGray,
  },
  sendButton: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 10,
  },
  sendButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFF',
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: colors.backgroundGray,
    gap: 8,
  },
  activeTab: {
    backgroundColor: colors.primary + '15',
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textGray,
  },
  activeTabText: {
    color: colors.primary,
  },
  badge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 20,
    alignItems: 'center',
  },
  badgeText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: colors.textGray,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    marginTop: 16,
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  emptyText: {
    marginTop: 8,
    fontSize: 15,
    color: colors.textGray,
    textAlign: 'center',
    lineHeight: 22,
  },
  requestCard: {
    backgroundColor: colors.backgroundCard,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  requestHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  requestAvatarContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  requestInfo: {
    flex: 1,
    marginLeft: 12,
  },
  requestName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  requestEmail: {
    fontSize: 14,
    color: colors.textGray,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusBadgePending: {
    backgroundColor: '#FFA500' + '20',
  },
  statusBadgeApproved: {
    backgroundColor: '#10B981' + '20',
  },
  statusBadgeRejected: {
    backgroundColor: '#EF4444' + '20',
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  requestAmount: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
    marginVertical: 12,
  },
  requestAmountLabel: {
    fontSize: 14,
    color: colors.textGray,
  },
  requestAmountValue: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.primary,
  },
  requestNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    backgroundColor: colors.backgroundGray,
    borderRadius: 8,
    marginBottom: 12,
  },
  requestNoteText: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  requestDate: {
    fontSize: 12,
    color: colors.textGray,
    marginBottom: 12,
  },
  requestActions: {
    flexDirection: 'row',
    gap: 12,
  },
  rejectButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#EF4444' + '15',
    gap: 8,
  },
  rejectButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#EF4444',
  },
  approveButton: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  approveButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  approveButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFF',
  },
});
