import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Alert,
  Modal,
  Platform,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import api from '../../services/api';
import { useTranslation } from 'react-i18next';

interface TaxReturn {
  id: string;
  client_id: string;
  client_name: string;
  client_email: string;
  client_phone: string;
  tax_year: string;
  status: 'pending' | 'submitted' | 'accepted' | 'rejected';
  refund_amount?: number;
  submitted_at?: string;
  accepted_at?: string;
  created_at: string;
  notes?: string;
}

interface Client {
  id: string;
  name: string;
  full_name?: string;
  email: string;
  phone: string;
}

const STATUS_CONFIG = {
  pending: { label: 'Pendiente', color: '#F59E0B', icon: 'time-outline' },
  submitted: { label: 'Enviada al IRS', color: '#3B82F6', icon: 'send-outline' },
  accepted: { label: 'Aceptada', color: '#10B981', icon: 'checkmark-circle' },
  rejected: { label: 'Rechazada', color: '#EF4444', icon: 'close-circle' },
};

// Common IRS rejection reasons
const REJECTION_REASONS = [
  {
    id: 'duplicate_ssn',
    title: 'SSN ya utilizado',
    description: 'Su número de Seguro Social ya fue usado en otra declaración este año.',
    action: 'Necesitamos que presente el Formulario 14039 (Declaración Jurada de Robo de Identidad). Contáctenos para ayudarle.',
  },
  {
    id: 'missing_1095a',
    title: 'Falta Formulario 1095-A',
    description: 'El IRS requiere el Formulario 1095-A de su seguro médico del Marketplace.',
    action: 'Por favor envíenos su Formulario 1095-A. Puede obtenerlo en HealthCare.gov o llamando al 1-800-318-2596.',
  },
  {
    id: 'missing_w2',
    title: 'Falta W-2',
    description: 'Falta información de uno o más formularios W-2.',
    action: 'Por favor envíenos todos sus formularios W-2 de cada empleador del año fiscal.',
  },
  {
    id: 'missing_1099',
    title: 'Falta 1099',
    description: 'Falta información de ingresos reportada al IRS.',
    action: 'Por favor envíenos todos sus formularios 1099 (1099-NEC, 1099-MISC, 1099-INT, etc.).',
  },
  {
    id: 'dependent_claimed',
    title: 'Dependiente ya reclamado',
    description: 'Uno o más dependientes ya fueron reclamados en otra declaración.',
    action: 'Necesitamos verificar la información de sus dependientes. Por favor contáctenos.',
  },
  {
    id: 'identity_verification',
    title: 'Verificación de identidad',
    description: 'El IRS requiere verificación de identidad adicional.',
    action: 'Deberá verificar su identidad en IRS.gov/verify o llamando al número proporcionado por el IRS.',
  },
  {
    id: 'prior_year_agi',
    title: 'AGI del año anterior incorrecto',
    description: 'El ingreso bruto ajustado del año anterior no coincide.',
    action: 'Por favor envíenos una copia de su declaración del año anterior o su PIN de protección de identidad.',
  },
  {
    id: 'name_ssn_mismatch',
    title: 'Nombre/SSN no coinciden',
    description: 'El nombre no coincide con los registros del Seguro Social.',
    action: 'Verifique que su nombre esté escrito exactamente como aparece en su tarjeta de Seguro Social.',
  },
  {
    id: 'other',
    title: 'Otra razón',
    description: 'Razón personalizada',
    action: '',
  },
];

export default function DeclaracionesScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [taxReturns, setTaxReturns] = useState<TaxReturn[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedYear, setSelectedYear] = useState('2025');
  
  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedReturn, setSelectedReturn] = useState<TaxReturn | null>(null);
  const [processing, setProcessing] = useState(false);
  
  // Rejection form
  const [selectedRejectionReason, setSelectedRejectionReason] = useState<string>('');
  const [customRejectionNote, setCustomRejectionNote] = useState('');
  
  // Form data
  const [formData, setFormData] = useState({
    client_id: '',
    tax_year: '2025',
    refund_amount: '',
    notes: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [returnsRes, clientsRes] = await Promise.all([
        api.get('/admin/tax-returns'),
        api.get('/admin/clients?limit=1000'),
      ]);
      
      const returnsData = returnsRes.data?.tax_returns || returnsRes.data || [];
      const clientsData = clientsRes.data?.clients || clientsRes.data || [];
      
      setTaxReturns(Array.isArray(returnsData) ? returnsData : []);
      setClients(Array.isArray(clientsData) ? clientsData : []);
    } catch (error) {
      console.error('Error loading data:', error);
      // Initialize with empty if endpoint doesn't exist yet
      setTaxReturns([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const filteredReturns = useMemo(() => {
    let filtered = taxReturns;
    
    if (filterStatus !== 'all') {
      filtered = filtered.filter(r => r.status === filterStatus);
    }
    
    if (selectedYear) {
      filtered = filtered.filter(r => r.tax_year === selectedYear);
    }
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(r => 
        r.client_name?.toLowerCase().includes(query) ||
        r.client_email?.toLowerCase().includes(query)
      );
    }
    
    return filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [taxReturns, filterStatus, selectedYear, searchQuery]);

  const stats = useMemo(() => {
    const yearReturns = taxReturns.filter(r => r.tax_year === selectedYear);
    return {
      total: yearReturns.length,
      pending: yearReturns.filter(r => r.status === 'pending').length,
      submitted: yearReturns.filter(r => r.status === 'submitted').length,
      accepted: yearReturns.filter(r => r.status === 'accepted').length,
      rejected: yearReturns.filter(r => r.status === 'rejected').length,
    };
  }, [taxReturns, selectedYear]);

  const handleCreateReturn = async () => {
    if (!formData.client_id) {
      Alert.alert('Error', 'Seleccione un cliente');
      return;
    }
    
    setProcessing(true);
    try {
      const client = clients.find(c => c.id === formData.client_id);
      
      await api.post('/admin/tax-returns', {
        client_id: formData.client_id,
        client_name: client?.full_name || client?.name,
        client_email: client?.email,
        client_phone: client?.phone,
        tax_year: formData.tax_year,
        refund_amount: formData.refund_amount ? parseFloat(formData.refund_amount) : null,
        notes: formData.notes,
        status: 'pending',
      });
      
      Alert.alert('Éxito', 'Declaración creada correctamente');
      setShowCreateModal(false);
      setFormData({ client_id: '', tax_year: '2025', refund_amount: '', notes: '' });
      loadData();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'No se pudo crear la declaración');
    } finally {
      setProcessing(false);
    }
  };

  const handleMarkAsAccepted = async () => {
    if (!selectedReturn) return;
    
    setProcessing(true);
    try {
      // Update status and send notifications
      await api.post(`/admin/tax-returns/${selectedReturn.id}/accept`, {
        send_notifications: true,
      });
      
      Alert.alert(
        '✅ Declaración Aceptada',
        `Se ha marcado como aceptada y se enviaron notificaciones a ${selectedReturn.client_name}`,
        [{ text: 'OK' }]
      );
      
      setShowAcceptModal(false);
      setSelectedReturn(null);
      loadData();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'No se pudo procesar');
    } finally {
      setProcessing(false);
    }
  };

  const openAcceptModal = (taxReturn: TaxReturn) => {
    setSelectedReturn(taxReturn);
    setShowAcceptModal(true);
  };

  const openRejectModal = (taxReturn: TaxReturn) => {
    setSelectedReturn(taxReturn);
    setSelectedRejectionReason('');
    setCustomRejectionNote('');
    setShowRejectModal(true);
  };

  const handleMarkAsRejected = async () => {
    if (!selectedReturn || !selectedRejectionReason) {
      Alert.alert('Error', 'Seleccione una razón de rechazo');
      return;
    }
    
    setProcessing(true);
    try {
      const reason = REJECTION_REASONS.find(r => r.id === selectedRejectionReason);
      
      await api.post(`/admin/tax-returns/${selectedReturn.id}/reject`, {
        send_notifications: true,
        rejection_reason_id: selectedRejectionReason,
        rejection_reason_title: reason?.title,
        rejection_reason_description: reason?.description,
        rejection_action_required: selectedRejectionReason === 'other' ? customRejectionNote : reason?.action,
        custom_note: customRejectionNote,
      });
      
      Alert.alert(
        '❌ Declaración Rechazada',
        `Se ha notificado a ${selectedReturn.client_name} sobre el rechazo y las acciones necesarias.`,
        [{ text: 'OK' }]
      );
      
      setShowRejectModal(false);
      setSelectedReturn(null);
      setSelectedRejectionReason('');
      setCustomRejectionNote('');
      loadData();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'No se pudo procesar');
    } finally {
      setProcessing(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return `$${amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const renderAcceptModal = () => (
    <Modal
      visible={showAcceptModal}
      animationType="fade"
      transparent={true}
      onRequestClose={() => setShowAcceptModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.acceptModalContent}>
          <View style={styles.acceptModalHeader}>
            <Ionicons name="checkmark-circle" size={60} color="#10B981" />
            <Text style={styles.acceptModalTitle}>Marcar como Aceptada</Text>
          </View>
          
          {selectedReturn && (
            <View style={styles.acceptModalBody}>
              <Text style={styles.acceptModalText}>
                ¿Confirmar que la declaración de <Text style={styles.bold}>{selectedReturn.client_name}</Text> fue aceptada por el IRS?
              </Text>
              
              <View style={styles.notificationPreview}>
                <Text style={styles.notificationTitle}>📨 Se enviarán:</Text>
                <View style={styles.notificationItem}>
                  <Ionicons name="mail-outline" size={18} color="#666" />
                  <Text style={styles.notificationText}>Email a {selectedReturn.client_email}</Text>
                </View>
                <View style={styles.notificationItem}>
                  <Ionicons name="chatbubble-outline" size={18} color="#666" />
                  <Text style={styles.notificationText}>SMS a {selectedReturn.client_phone}</Text>
                </View>
              </View>
            </View>
          )}
          
          <View style={styles.acceptModalActions}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setShowAcceptModal(false)}
              disabled={processing}
            >
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.confirmButton, processing && styles.buttonDisabled]}
              onPress={handleMarkAsAccepted}
              disabled={processing}
            >
              {processing ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Ionicons name="checkmark" size={20} color="#fff" />
                  <Text style={styles.confirmButtonText}>Confirmar y Notificar</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  const renderRejectModal = () => (
    <Modal
      visible={showRejectModal}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowRejectModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { maxHeight: '90%' }]}>
          <View style={[styles.modalHeader, { backgroundColor: '#FEE2E2' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons name="close-circle" size={28} color="#EF4444" />
              <Text style={[styles.modalTitle, { color: '#DC2626' }]}>Rechazar Declaración</Text>
            </View>
            <TouchableOpacity onPress={() => setShowRejectModal(false)}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>
          
          {selectedReturn && (
            <ScrollView style={styles.modalBody}>
              <View style={styles.rejectClientInfo}>
                <Text style={styles.rejectClientName}>{selectedReturn.client_name}</Text>
                <Text style={styles.rejectClientEmail}>{selectedReturn.client_email}</Text>
              </View>
              
              <Text style={styles.inputLabel}>Seleccione la razón del rechazo:</Text>
              
              {REJECTION_REASONS.map(reason => (
                <TouchableOpacity
                  key={reason.id}
                  style={[
                    styles.rejectionOption,
                    selectedRejectionReason === reason.id && styles.rejectionOptionSelected,
                  ]}
                  onPress={() => setSelectedRejectionReason(reason.id)}
                >
                  <View style={styles.rejectionOptionHeader}>
                    <View style={[
                      styles.radioButton,
                      selectedRejectionReason === reason.id && styles.radioButtonSelected,
                    ]}>
                      {selectedRejectionReason === reason.id && (
                        <View style={styles.radioButtonInner} />
                      )}
                    </View>
                    <Text style={[
                      styles.rejectionOptionTitle,
                      selectedRejectionReason === reason.id && styles.rejectionOptionTitleSelected,
                    ]}>
                      {reason.title}
                    </Text>
                  </View>
                  {reason.id !== 'other' && (
                    <Text style={styles.rejectionOptionDesc}>{reason.description}</Text>
                  )}
                </TouchableOpacity>
              ))}
              
              {selectedRejectionReason === 'other' && (
                <View style={styles.customNoteContainer}>
                  <Text style={styles.inputLabel}>Describa la razón y la acción requerida:</Text>
                  <TextInput
                    style={[styles.input, styles.textArea, { height: 100 }]}
                    value={customRejectionNote}
                    onChangeText={setCustomRejectionNote}
                    multiline
                    numberOfLines={4}
                    placeholder={t('admin.rejectReasonPlaceholder', 'Escriba la razón del rechazo y qué necesita el cliente enviar...')}
                    placeholderTextColor="#999"
                  />
                </View>
              )}
              
              {selectedRejectionReason && selectedRejectionReason !== 'other' && (
                <View style={styles.actionPreview}>
                  <Text style={styles.actionPreviewTitle}>📨 Se notificará al cliente:</Text>
                  <Text style={styles.actionPreviewText}>
                    {REJECTION_REASONS.find(r => r.id === selectedRejectionReason)?.action}
                  </Text>
                </View>
              )}
              
              <View style={{ marginTop: 12, marginBottom: 8 }}>
                <Text style={styles.inputLabel}>Nota adicional (opcional):</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={selectedRejectionReason !== 'other' ? customRejectionNote : ''}
                  onChangeText={selectedRejectionReason !== 'other' ? setCustomRejectionNote : () => {}}
                  multiline
                  numberOfLines={2}
                  placeholder={t('admin.additionalInfoPlaceholder', 'Información adicional para el cliente...')}
                  placeholderTextColor="#999"
                  editable={selectedRejectionReason !== 'other'}
                />
              </View>
            </ScrollView>
          )}
          
          <View style={styles.acceptModalActions}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setShowRejectModal(false)}
              disabled={processing}
            >
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.rejectConfirmButton, processing && styles.buttonDisabled]}
              onPress={handleMarkAsRejected}
              disabled={processing || !selectedRejectionReason}
            >
              {processing ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Ionicons name="close-circle" size={20} color="#fff" />
                  <Text style={styles.confirmButtonText}>Rechazar y Notificar</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  const renderCreateModal = () => (
    <Modal
      visible={showCreateModal}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowCreateModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Nueva Declaración</Text>
            <TouchableOpacity onPress={() => setShowCreateModal(false)}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.modalBody}>
            <Text style={styles.inputLabel}>Cliente *</Text>
            <View style={styles.pickerContainer}>
              <ScrollView style={styles.clientPicker} nestedScrollEnabled>
                {clients.map(client => (
                  <TouchableOpacity
                    key={client.id}
                    style={[
                      styles.clientOption,
                      formData.client_id === client.id && styles.clientOptionSelected,
                    ]}
                    onPress={() => setFormData({...formData, client_id: client.id})}
                  >
                    <Text style={[
                      styles.clientOptionText,
                      formData.client_id === client.id && styles.clientOptionTextSelected,
                    ]}>
                      {client.full_name || client.name}
                    </Text>
                    <Text style={styles.clientOptionEmail}>{client.email}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
            
            <Text style={styles.inputLabel}>Año Fiscal *</Text>
            <View style={styles.yearButtons}>
              {['2024', '2025', '2026'].map(year => (
                <TouchableOpacity
                  key={year}
                  style={[
                    styles.yearButton,
                    formData.tax_year === year && styles.yearButtonActive,
                  ]}
                  onPress={() => setFormData({...formData, tax_year: year})}
                >
                  <Text style={[
                    styles.yearButtonText,
                    formData.tax_year === year && styles.yearButtonTextActive,
                  ]}>{year}</Text>
                </TouchableOpacity>
              ))}
            </View>
            
            <Text style={styles.inputLabel}>Reembolso Estimado</Text>
            <TextInput
              style={styles.input}
              value={formData.refund_amount}
              onChangeText={(text) => setFormData({...formData, refund_amount: text})}
              keyboardType="numeric"
              placeholder="$0.00"
              placeholderTextColor="#999"
            />
            
            <Text style={styles.inputLabel}>Notas</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={formData.notes}
              onChangeText={(text) => setFormData({...formData, notes: text})}
              multiline
              numberOfLines={3}
              placeholder="Notas adicionales..."
              placeholderTextColor="#999"
            />
          </ScrollView>
          
          <TouchableOpacity
            style={[styles.submitButton, processing && styles.buttonDisabled]}
            onPress={handleCreateReturn}
            disabled={processing}
          >
            {processing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitButtonText}>Crear Declaración</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6C1110" />
        <Text style={styles.loadingText}>Cargando declaraciones...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={['#1a1a2e', '#16213e']} style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Declaraciones {selectedYear}</Text>
          <Text style={styles.headerSubtitle}>{stats.total} declaraciones</Text>
        </View>
        <TouchableOpacity style={styles.addButton} onPress={() => setShowCreateModal(true)}>
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>
      </LinearGradient>

      {/* Stats */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statsContainer}>
        <TouchableOpacity
          style={[styles.statCard, filterStatus === 'all' && styles.statCardActive]}
          onPress={() => setFilterStatus('all')}
        >
          <Text style={styles.statNumber}>{stats.total}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.statCard, filterStatus === 'pending' && styles.statCardActive, { borderLeftColor: '#F59E0B' }]}
          onPress={() => setFilterStatus('pending')}
        >
          <Text style={[styles.statNumber, { color: '#F59E0B' }]}>{stats.pending}</Text>
          <Text style={styles.statLabel}>Pendientes</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.statCard, filterStatus === 'submitted' && styles.statCardActive, { borderLeftColor: '#3B82F6' }]}
          onPress={() => setFilterStatus('submitted')}
        >
          <Text style={[styles.statNumber, { color: '#3B82F6' }]}>{stats.submitted}</Text>
          <Text style={styles.statLabel}>Enviadas</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.statCard, filterStatus === 'accepted' && styles.statCardActive, { borderLeftColor: '#10B981' }]}
          onPress={() => setFilterStatus('accepted')}
        >
          <Text style={[styles.statNumber, { color: '#10B981' }]}>{stats.accepted}</Text>
          <Text style={styles.statLabel}>Aceptadas</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#999" />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar cliente..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#999"
        />
      </View>

      {/* List */}
      <ScrollView
        style={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#6C1110']} />
        }
      >
        {filteredReturns.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>No hay declaraciones</Text>
            <Text style={styles.emptySubtext}>Crea una nueva declaración para comenzar</Text>
            <TouchableOpacity
              style={styles.emptyButton}
              onPress={() => setShowCreateModal(true)}
            >
              <Ionicons name="add" size={20} color="#fff" />
              <Text style={styles.emptyButtonText}>Nueva Declaración</Text>
            </TouchableOpacity>
          </View>
        ) : (
          filteredReturns.map(item => {
            const statusConfig = STATUS_CONFIG[item.status];
            return (
              <View key={item.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.clientInfo}>
                    <Text style={styles.clientName}>{item.client_name}</Text>
                    <Text style={styles.clientEmail}>{item.client_email}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: statusConfig.color + '20' }]}>
                    <Ionicons name={statusConfig.icon as any} size={14} color={statusConfig.color} />
                    <Text style={[styles.statusText, { color: statusConfig.color }]}>
                      {statusConfig.label}
                    </Text>
                  </View>
                </View>
                
                <View style={styles.cardBody}>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Año Fiscal:</Text>
                    <Text style={styles.infoValue}>{item.tax_year}</Text>
                  </View>
                  {item.refund_amount && (
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Reembolso:</Text>
                      <Text style={[styles.infoValue, styles.refundAmount]}>
                        {formatCurrency(item.refund_amount)}
                      </Text>
                    </View>
                  )}
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Creada:</Text>
                    <Text style={styles.infoValue}>{formatDate(item.created_at)}</Text>
                  </View>
                </View>
                
                {(item.status === 'pending' || item.status === 'submitted') && (
                  <View style={styles.cardActions}>
                    {item.status === 'pending' && (
                      <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => {
                          // Mark as submitted
                          api.patch(`/admin/tax-returns/${item.id}`, { status: 'submitted' })
                            .then(() => loadData());
                        }}
                      >
                        <Ionicons name="send-outline" size={18} color="#3B82F6" />
                        <Text style={[styles.actionButtonText, { color: '#3B82F6' }]}>
                          Enviada
                        </Text>
                      </TouchableOpacity>
                    )}
                    
                    <TouchableOpacity
                      style={[styles.actionButton, styles.acceptButton]}
                      onPress={() => openAcceptModal(item)}
                    >
                      <Ionicons name="checkmark-circle" size={18} color="#fff" />
                      <Text style={styles.acceptButtonText}>Aceptada</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={[styles.actionButton, styles.rejectButton]}
                      onPress={() => openRejectModal(item)}
                    >
                      <Ionicons name="close-circle" size={18} color="#fff" />
                      <Text style={styles.acceptButtonText}>Rechazada</Text>
                    </TouchableOpacity>
                  </View>
                )}
                
                {item.status === 'accepted' && item.accepted_at && (
                  <View style={styles.acceptedInfo}>
                    <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                    <Text style={styles.acceptedText}>
                      Aceptada el {formatDate(item.accepted_at)}
                    </Text>
                  </View>
                )}
                
                {item.status === 'rejected' && (
                  <View style={[styles.acceptedInfo, { backgroundColor: '#FEE2E2' }]}>
                    <Ionicons name="close-circle" size={16} color="#EF4444" />
                    <Text style={[styles.acceptedText, { color: '#DC2626' }]}>
                      Rechazada - Cliente notificado
                    </Text>
                  </View>
                )}
              </View>
            );
          })
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      {renderCreateModal()}
      {renderAcceptModal()}
      {renderRejectModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#666',
  },
  header: {
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    padding: 8,
  },
  headerContent: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 4,
  },
  addButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    padding: 8,
  },
  statsContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  statCard: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    marginRight: 12,
    minWidth: 90,
    alignItems: 'center',
    borderLeftWidth: 3,
    borderLeftColor: '#6C1110',
  },
  statCardActive: {
    backgroundColor: '#f0f0f0',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    color: '#333',
  },
  list: {
    flex: 1,
    paddingHorizontal: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  clientInfo: {
    flex: 1,
  },
  clientName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#333',
  },
  clientEmail: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  cardBody: {
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  refundAmount: {
    color: '#10B981',
    fontWeight: '600',
  },
  cardActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    gap: 6,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  acceptButton: {
    backgroundColor: '#10B981',
  },
  acceptButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  acceptedInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    gap: 6,
  },
  acceptedText: {
    fontSize: 13,
    color: '#10B981',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6C1110',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 20,
    gap: 8,
  },
  emptyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
  },
  modalBody: {
    padding: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  pickerContainer: {
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    maxHeight: 200,
  },
  clientPicker: {
    padding: 8,
  },
  clientOption: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 4,
  },
  clientOptionSelected: {
    backgroundColor: '#6C1110',
  },
  clientOptionText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333',
  },
  clientOptionTextSelected: {
    color: '#fff',
  },
  clientOptionEmail: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  yearButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  yearButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
  },
  yearButtonActive: {
    backgroundColor: '#6C1110',
  },
  yearButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  yearButtonTextActive: {
    color: '#fff',
  },
  submitButton: {
    backgroundColor: '#6C1110',
    margin: 20,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  // Accept Modal
  acceptModalContent: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    borderRadius: 20,
    marginTop: 'auto',
    marginBottom: 'auto',
  },
  acceptModalHeader: {
    alignItems: 'center',
    paddingTop: 30,
    paddingBottom: 10,
  },
  acceptModalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#333',
    marginTop: 12,
  },
  acceptModalBody: {
    padding: 24,
  },
  acceptModalText: {
    fontSize: 16,
    color: '#555',
    textAlign: 'center',
    lineHeight: 24,
  },
  bold: {
    fontWeight: '700',
    color: '#333',
  },
  notificationPreview: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
  },
  notificationTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  notificationText: {
    fontSize: 14,
    color: '#666',
  },
  acceptModalActions: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  confirmButton: {
    flex: 2,
    flexDirection: 'row',
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
