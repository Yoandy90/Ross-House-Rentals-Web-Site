import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import api from '../../services/api';
import { useTranslation } from 'react-i18next';

interface Motion {
  id: string;
  motion_number: string;
  motion_type: string;
  motion_type_label: string;
  status: string;
  status_label: string;
  client_name: string;
  client_email: string;
  priority: string;
  deadline: string | null;
  documents_complete: boolean;
  created_at: string;
  updated_at: string | null;
}

interface MotionStats {
  total: number;
  by_status: { [key: string]: { count: number; label: string } };
  by_type: { [key: string]: { count: number; label: string } };
  pending_documents: number;
  approaching_deadlines: number;
  overdue: number;
}

const STATUS_COLORS: { [key: string]: string } = {
  new: '#3B82F6',
  in_review: '#F59E0B',
  drafting: '#8B5CF6',
  legal_review: '#EC4899',
  submitted: '#10B981',
  awaiting_response: '#6366F1',
  approved: '#22C55E',
  denied: '#EF4444',
  cancelled: '#6B7280',
};

const PRIORITY_COLORS: { [key: string]: string } = {
  high: '#EF4444',
  normal: '#3B82F6',
  low: '#6B7280',
};

export default function MotionsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [motions, setMotions] = useState<Motion[]>([]);
  const [stats, setStats] = useState<MotionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  
  // Form state for new motion
  const [newMotion, setNewMotion] = useState({
    motion_type: 'court_closure',
    client_name: '',
    client_email: '',
    client_phone: '',
    current_address: '',
    a_number: '',
    current_court: '',
    new_address: '',
    destination_court: '',
    priority: 'normal',
    notes: '',
  });
  const [creating, setCreating] = useState(false);

  const loadData = useCallback(async () => {
    try {
      // Load stats
      const statsRes = await api.get('/motions/admin/stats');
      setStats(statsRes.data);
      
      // Load motions with filters
      let url = '/motions/admin/list?limit=100';
      if (selectedStatus) url += `&status=${selectedStatus}`;
      if (selectedType) url += `&motion_type=${selectedType}`;
      if (searchQuery) url += `&search=${encodeURIComponent(searchQuery)}`;
      
      const motionsRes = await api.get(url);
      setMotions(motionsRes.data.motions || []);
    } catch (error) {
      console.error('Error loading motions:', error);
      Alert.alert('Error', 'No se pudieron cargar las mociones');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedStatus, selectedType, searchQuery]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleCreateMotion = async () => {
    if (!newMotion.client_name || !newMotion.current_address) {
      Alert.alert('Error', 'Por favor complete los campos requeridos');
      return;
    }
    
    setCreating(true);
    try {
      await api.post('/motions/admin/create', newMotion);
      Alert.alert('Éxito', 'Moción creada correctamente');
      setShowCreateModal(false);
      setNewMotion({
        motion_type: 'court_closure',
        client_name: '',
        client_email: '',
        client_phone: '',
        current_address: '',
        a_number: '',
        current_court: '',
        new_address: '',
        destination_court: '',
        priority: 'normal',
        notes: '',
      });
      loadData();
    } catch (error) {
      console.error('Error creating motion:', error);
      Alert.alert('Error', 'No se pudo crear la moción');
    } finally {
      setCreating(false);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const renderStatsCard = (title: string, value: number, icon: string, color: string) => (
    <View style={[styles.statsCard, { borderLeftColor: color }]}>
      <Ionicons name={icon as any} size={24} color={color} />
      <Text style={styles.statsValue}>{value}</Text>
      <Text style={styles.statsLabel}>{title}</Text>
    </View>
  );

  const renderMotionCard = (motion: Motion) => (
    <TouchableOpacity
      key={motion.id}
      style={styles.motionCard}
      onPress={() => router.push(`/_adminScreens/motion-details?id=${motion.id}`)}
    >
      <View style={styles.motionHeader}>
        <View style={styles.motionTitleRow}>
          <Text style={styles.motionNumber}>{motion.motion_number}</Text>
          <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[motion.status] || '#6B7280' }]}>
            <Text style={styles.statusText}>{motion.status_label}</Text>
          </View>
        </View>
        <Text style={styles.motionType}>{motion.motion_type_label}</Text>
      </View>
      
      <View style={styles.motionBody}>
        <View style={styles.motionRow}>
          <Ionicons name="person" size={16} color="#6B7280" />
          <Text style={styles.motionText}>{motion.client_name}</Text>
        </View>
        <View style={styles.motionRow}>
          <Ionicons name="mail" size={16} color="#6B7280" />
          <Text style={styles.motionText}>{motion.client_email || 'Sin email'}</Text>
        </View>
        <View style={styles.motionRow}>
          <Ionicons name="calendar" size={16} color="#6B7280" />
          <Text style={styles.motionText}>Creado: {formatDate(motion.created_at)}</Text>
        </View>
      </View>
      
      <View style={styles.motionFooter}>
        <View style={[styles.priorityBadge, { backgroundColor: PRIORITY_COLORS[motion.priority] + '20' }]}>
          <Text style={[styles.priorityText, { color: PRIORITY_COLORS[motion.priority] }]}>
            {motion.priority === 'high' ? 'Alta' : motion.priority === 'normal' ? 'Normal' : 'Baja'}
          </Text>
        </View>
        {!motion.documents_complete && (
          <View style={styles.docsWarning}>
            <Ionicons name="warning" size={14} color="#F59E0B" />
            <Text style={styles.docsWarningText}>Docs pendientes</Text>
          </View>
        )}
        <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6C1110" />
          <Text style={styles.loadingText}>Cargando mociones...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mociones de Inmigración</Text>
        <TouchableOpacity onPress={() => setShowCreateModal(true)}>
          <Ionicons name="add-circle" size={28} color="#6C1110" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#6C1110']} />
        }
      >
        {/* Stats */}
        {stats && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statsContainer}>
            {renderStatsCard('Total', stats.total, 'documents', '#6C1110')}
            {renderStatsCard('Pendientes', stats.pending_documents, 'document-text', '#F59E0B')}
            {renderStatsCard('Por Vencer', stats.approaching_deadlines, 'time', '#8B5CF6')}
            {renderStatsCard('Vencidas', stats.overdue, 'alert-circle', '#EF4444')}
          </ScrollView>
        )}

        {/* Search and Filters */}
        <View style={styles.searchContainer}>
          <View style={styles.searchInput}>
            <Ionicons name="search" size={20} color="#9CA3AF" />
            <TextInput
              style={styles.searchTextInput}
              placeholder={t('admin.searchClientsPlaceholder', 'Buscar por número, cliente...')}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={loadData}
              returnKeyType="search"
            />
          </View>
          <TouchableOpacity
            style={[styles.filterButton, showFilters && styles.filterButtonActive]}
            onPress={() => setShowFilters(!showFilters)}
          >
            <Ionicons name="filter" size={20} color={showFilters ? '#fff' : '#6C1110'} />
          </TouchableOpacity>
        </View>

        {/* Filters */}
        {showFilters && (
          <View style={styles.filtersContainer}>
            <Text style={styles.filterLabel}>Estado:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <TouchableOpacity
                style={[styles.filterChip, !selectedStatus && styles.filterChipActive]}
                onPress={() => setSelectedStatus(null)}
              >
                <Text style={[styles.filterChipText, !selectedStatus && styles.filterChipTextActive]}>Todos</Text>
              </TouchableOpacity>
              {stats && Object.entries(stats.by_status).map(([key, value]) => (
                <TouchableOpacity
                  key={key}
                  style={[styles.filterChip, selectedStatus === key && styles.filterChipActive]}
                  onPress={() => setSelectedStatus(selectedStatus === key ? null : key)}
                >
                  <Text style={[styles.filterChipText, selectedStatus === key && styles.filterChipTextActive]}>
                    {value.label} ({value.count})
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            
            <Text style={[styles.filterLabel, { marginTop: 12 }]}>Tipo:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <TouchableOpacity
                style={[styles.filterChip, !selectedType && styles.filterChipActive]}
                onPress={() => setSelectedType(null)}
              >
                <Text style={[styles.filterChipText, !selectedType && styles.filterChipTextActive]}>Todos</Text>
              </TouchableOpacity>
              {stats && Object.entries(stats.by_type).map(([key, value]) => (
                <TouchableOpacity
                  key={key}
                  style={[styles.filterChip, selectedType === key && styles.filterChipActive]}
                  onPress={() => setSelectedType(selectedType === key ? null : key)}
                >
                  <Text style={[styles.filterChipText, selectedType === key && styles.filterChipTextActive]}>
                    {value.label} ({value.count})
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Motions List */}
        <View style={styles.motionsList}>
          {motions.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="document-text-outline" size={64} color="#D1D5DB" />
              <Text style={styles.emptyStateText}>No hay mociones</Text>
              <Text style={styles.emptyStateSubtext}>
                Crea una nueva moción para comenzar
              </Text>
            </View>
          ) : (
            motions.map(renderMotionCard)
          )}
        </View>
      </ScrollView>

      {/* Create Motion Modal */}
      <Modal
        visible={showCreateModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowCreateModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowCreateModal(false)}>
              <Text style={styles.modalCancel}>Cancelar</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Nueva Moción</Text>
            <TouchableOpacity onPress={handleCreateMotion} disabled={creating}>
              {creating ? (
                <ActivityIndicator size="small" color="#6C1110" />
              ) : (
                <Text style={styles.modalSave}>Crear</Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {/* Motion Type */}
            <Text style={styles.formLabel}>Tipo de Moción *</Text>
            <View style={styles.typeSelector}>
              <TouchableOpacity
                style={[
                  styles.typeOption,
                  newMotion.motion_type === 'court_closure' && styles.typeOptionActive,
                ]}
                onPress={() => setNewMotion({ ...newMotion, motion_type: 'court_closure' })}
              >
                <Ionicons
                  name="close-circle"
                  size={24}
                  color={newMotion.motion_type === 'court_closure' ? '#6C1110' : '#9CA3AF'}
                />
                <Text
                  style={[
                    styles.typeOptionText,
                    newMotion.motion_type === 'court_closure' && styles.typeOptionTextActive,
                  ]}
                >
                  Cierre de Corte
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.typeOption,
                  newMotion.motion_type === 'court_transfer' && styles.typeOptionActive,
                ]}
                onPress={() => setNewMotion({ ...newMotion, motion_type: 'court_transfer' })}
              >
                <Ionicons
                  name="swap-horizontal"
                  size={24}
                  color={newMotion.motion_type === 'court_transfer' ? '#6C1110' : '#9CA3AF'}
                />
                <Text
                  style={[
                    styles.typeOptionText,
                    newMotion.motion_type === 'court_transfer' && styles.typeOptionTextActive,
                  ]}
                >
                  Traslado de Corte
                </Text>
              </TouchableOpacity>
            </View>

            {/* Client Info */}
            <Text style={styles.formSectionTitle}>Información del Cliente</Text>
            
            <Text style={styles.formLabel}>Nombre Completo *</Text>
            <TextInput
              style={styles.formInput}
              value={newMotion.client_name}
              onChangeText={(text) => setNewMotion({ ...newMotion, client_name: text })}
              placeholder="Nombre del cliente"
            />

            <Text style={styles.formLabel}>Email</Text>
            <TextInput
              style={styles.formInput}
              value={newMotion.client_email}
              onChangeText={(text) => setNewMotion({ ...newMotion, client_email: text })}
              placeholder="email@ejemplo.com"
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Text style={styles.formLabel}>Teléfono</Text>
            <TextInput
              style={styles.formInput}
              value={newMotion.client_phone}
              onChangeText={(text) => setNewMotion({ ...newMotion, client_phone: text })}
              placeholder="+1 (555) 123-4567"
              keyboardType="phone-pad"
            />

            {/* Address Info */}
            <Text style={styles.formSectionTitle}>Información del Caso</Text>

            <Text style={styles.formLabel}>Dirección Actual *</Text>
            <TextInput
              style={[styles.formInput, styles.formInputMultiline]}
              value={newMotion.current_address}
              onChangeText={(text) => setNewMotion({ ...newMotion, current_address: text })}
              placeholder={t('admin.mailingAddressPlaceholder', 'Dirección postal completa')}
              multiline
              numberOfLines={2}
            />

            <Text style={styles.formLabel}>Número A (A-Number)</Text>
            <TextInput
              style={styles.formInput}
              value={newMotion.a_number}
              onChangeText={(text) => setNewMotion({ ...newMotion, a_number: text })}
              placeholder="A123456789"
            />

            <Text style={styles.formLabel}>Tribunal Actual</Text>
            <TextInput
              style={styles.formInput}
              value={newMotion.current_court}
              onChangeText={(text) => setNewMotion({ ...newMotion, current_court: text })}
              placeholder="Ej: Dallas Immigration Court"
            />

            {/* Transfer-specific fields */}
            {newMotion.motion_type === 'court_transfer' && (
              <>
                <Text style={styles.formSectionTitle}>Información de Traslado</Text>

                <Text style={styles.formLabel}>Nueva Dirección *</Text>
                <TextInput
                  style={[styles.formInput, styles.formInputMultiline]}
                  value={newMotion.new_address}
                  onChangeText={(text) => setNewMotion({ ...newMotion, new_address: text })}
                  placeholder={t('admin.livingAddressPlaceholder', 'Dirección donde vivirá')}
                  multiline
                  numberOfLines={2}
                />

                <Text style={styles.formLabel}>Tribunal Destino</Text>
                <TextInput
                  style={styles.formInput}
                  value={newMotion.destination_court}
                  onChangeText={(text) => setNewMotion({ ...newMotion, destination_court: text })}
                  placeholder="Ej: Los Angeles Immigration Court"
                />
              </>
            )}

            {/* Priority */}
            <Text style={styles.formLabel}>Prioridad</Text>
            <View style={styles.prioritySelector}>
              {['low', 'normal', 'high'].map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[
                    styles.priorityOption,
                    newMotion.priority === p && { backgroundColor: PRIORITY_COLORS[p] + '20', borderColor: PRIORITY_COLORS[p] },
                  ]}
                  onPress={() => setNewMotion({ ...newMotion, priority: p })}
                >
                  <Text
                    style={[
                      styles.priorityOptionText,
                      newMotion.priority === p && { color: PRIORITY_COLORS[p] },
                    ]}
                  >
                    {p === 'high' ? 'Alta' : p === 'normal' ? 'Normal' : 'Baja'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Notes */}
            <Text style={styles.formLabel}>Notas</Text>
            <TextInput
              style={[styles.formInput, styles.formInputMultiline]}
              value={newMotion.notes}
              onChangeText={(text) => setNewMotion({ ...newMotion, notes: text })}
              placeholder="Notas adicionales sobre el caso..."
              multiline
              numberOfLines={4}
            />

            <View style={{ height: 40 }} />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  content: {
    flex: 1,
  },
  statsContainer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  statsCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginRight: 12,
    minWidth: 100,
    borderLeftWidth: 4,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  statsValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    marginTop: 8,
  },
  statsLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    marginRight: 12,
  },
  searchTextInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    color: '#1F2937',
  },
  filterButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterButtonActive: {
    backgroundColor: '#6C1110',
  },
  filtersContainer: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: '#6C1110',
  },
  filterChipText: {
    fontSize: 13,
    color: '#6B7280',
  },
  filterChipTextActive: {
    color: '#fff',
  },
  motionsList: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  motionCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  motionHeader: {
    marginBottom: 12,
  },
  motionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  motionNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  motionType: {
    fontSize: 14,
    color: '#6C1110',
    fontWeight: '500',
  },
  motionBody: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 12,
  },
  motionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  motionText: {
    fontSize: 14,
    color: '#4B5563',
    marginLeft: 8,
  },
  motionFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  priorityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: 12,
  },
  priorityText: {
    fontSize: 12,
    fontWeight: '600',
  },
  docsWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  docsWarningText: {
    fontSize: 12,
    color: '#F59E0B',
    marginLeft: 4,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 8,
  },
  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalCancel: {
    fontSize: 16,
    color: '#6B7280',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  modalSave: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6C1110',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  formSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginTop: 20,
    marginBottom: 12,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#4B5563',
    marginBottom: 6,
    marginTop: 12,
  },
  formInput: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1F2937',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  formInputMultiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  typeSelector: {
    flexDirection: 'row',
    gap: 12,
  },
  typeOption: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  typeOptionActive: {
    borderColor: '#6C1110',
    backgroundColor: '#FEF2F2',
  },
  typeOptionText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6B7280',
    marginTop: 8,
    textAlign: 'center',
  },
  typeOptionTextActive: {
    color: '#6C1110',
  },
  prioritySelector: {
    flexDirection: 'row',
    gap: 12,
  },
  priorityOption: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  priorityOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
});
