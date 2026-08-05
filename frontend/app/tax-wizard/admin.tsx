/**
 * Mi Reembolso Admin Dashboard
 * View and manage all wizard sessions
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Modal,
  Alert,
  StatusBar,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../../services/api';
import { useTranslation } from 'react-i18next';

interface WizardSession {
  id: string;
  user_id: string;
  tax_year: number;
  status: string;
  current_step: string;
  service_level: string;
  case_complexity: string;
  progress_percentage: number;
  personal_info?: {
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
  };
  refund_estimate?: {
    estimated_refund: number;
    is_refund: boolean;
  };
  total_price?: number;
  created_at: string;
  completed_at?: string;
  assigned_preparer?: string;
}

interface WizardStats {
  total_sessions: number;
  completed: number;
  in_progress: number;
  by_status: { [key: string]: number };
  by_complexity: { [key: string]: number };
}

export default function WizardAdminDashboard() {
  const { t } = useTranslation();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sessions, setSessions] = useState<WizardSession[]>([]);
  const [stats, setStats] = useState<WizardStats | null>(null);
  const [selectedSession, setSelectedSession] = useState<WizardSession | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadData();
  }, [filterStatus]);

  const loadData = async () => {
    try {
      // Load stats
      const statsResponse = await api.get('/tax-wizard/admin/stats');
      if (statsResponse.data.success) {
        setStats(statsResponse.data);
      }

      // Load sessions
      let url = '/tax-wizard/admin/sessions?limit=100';
      if (filterStatus) {
        url += `&status=${filterStatus}`;
      }
      const sessionsResponse = await api.get(url);
      if (sessionsResponse.data.success) {
        setSessions(sessionsResponse.data.sessions);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [filterStatus]);

  const handleExportCSV = async () => {
    try {
      const url = `${api.defaults.baseURL}/tax-wizard/admin/export/csv`;
      await Linking.openURL(url);
    } catch (error) {
      Alert.alert('Error', 'No se pudo descargar el archivo');
    }
  };

  const handleExportJSON = async () => {
    try {
      const url = `${api.defaults.baseURL}/tax-wizard/admin/export/json`;
      await Linking.openURL(url);
    } catch (error) {
      Alert.alert('Error', 'No se pudo descargar el archivo');
    }
  };

  const handleExportXML = async (sessionId: string) => {
    try {
      const url = `${api.defaults.baseURL}/tax-wizard/session/${sessionId}/export/xml`;
      await Linking.openURL(url);
    } catch (error) {
      Alert.alert('Error', 'No se pudo descargar el archivo');
    }
  };

  const getStatusColor = (status: string) => {
    const colors: { [key: string]: string } = {
      'draft': '#6B7280',
      'in_progress': '#3B82F6',
      'pending_documents': '#F59E0B',
      'pending_payment': '#8B5CF6',
      'pending_review': '#EC4899',
      'completed': '#10B981',
      'cancelled': '#EF4444',
    };
    return colors[status] || '#6B7280';
  };

  const getStatusLabel = (status: string) => {
    const labels: { [key: string]: string } = {
      'draft': 'Borrador',
      'in_progress': 'En Progreso',
      'pending_documents': 'Esperando Docs',
      'pending_payment': 'Esperando Pago',
      'pending_review': 'En Revisión',
      'completed': 'Completado',
      'cancelled': 'Cancelado',
    };
    return labels[status] || status;
  };

  const getComplexityColor = (complexity: string) => {
    const colors: { [key: string]: string } = {
      'simple': '#10B981',
      'medium': '#F59E0B',
      'complex': '#EF4444',
    };
    return colors[complexity] || '#6B7280';
  };

  const getServiceLabel = (service: string) => {
    const labels: { [key: string]: string } = {
      'full_service': 'Servicio Completo',
      'assisted': 'Asistido',
      'diy': 'Hazlo Tú Mismo',
    };
    return labels[service] || service || 'N/A';
  };


  const filteredSessions = sessions.filter(session => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const name = `${session.personal_info?.first_name || ''} ${session.personal_info?.last_name || ''}`.toLowerCase();
    const email = (session.personal_info?.email || '').toLowerCase();
    return name.includes(query) || email.includes(query) || session.id.includes(query);
  });

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#10B981" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <LinearGradient colors={['#065F46', '#10B981']} style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>Admin: Ross Tax</Text>
            <Text style={styles.headerSubtitle}>{sessions.length} sesiones</Text>
          </View>
          <TouchableOpacity 
            style={styles.exportBtn} 
            onPress={() => Alert.alert(
              'Exportar Datos',
              'Selecciona el formato',
              [
                { text: 'CSV', onPress: handleExportCSV },
                { text: 'JSON', onPress: handleExportJSON },
                { text: 'Cancelar', style: 'cancel' },
              ]
            )}
          >
            <Ionicons name="download-outline" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Stats Cards */}
        {stats && (
          <View style={styles.statsGrid}>
            <View style={[styles.statCard, { backgroundColor: '#EFF6FF' }]}>
              <Text style={[styles.statValue, { color: '#1E40AF' }]}>{stats.total_sessions}</Text>
              <Text style={styles.statLabel}>Total</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: '#F0FDF4' }]}>
              <Text style={[styles.statValue, { color: '#065F46' }]}>{stats.completed}</Text>
              <Text style={styles.statLabel}>Completados</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: '#FEF3C7' }]}>
              <Text style={[styles.statValue, { color: '#92400E' }]}>{stats.in_progress}</Text>
              <Text style={styles.statLabel}>En Progreso</Text>
            </View>
          </View>
        )}

        {/* Search */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#9CA3AF" />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar por nombre, email o ID..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Filter Pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          <TouchableOpacity
            style={[styles.filterPill, !filterStatus && styles.filterPillActive]}
            onPress={() => setFilterStatus(null)}
          >
            <Text style={[styles.filterPillText, !filterStatus && styles.filterPillTextActive]}>Todos</Text>
          </TouchableOpacity>
          {['in_progress', 'pending_documents', 'pending_review', 'completed'].map(status => (
            <TouchableOpacity
              key={status}
              style={[styles.filterPill, filterStatus === status && styles.filterPillActive]}
              onPress={() => setFilterStatus(status)}
            >
              <View style={[styles.filterDot, { backgroundColor: getStatusColor(status) }]} />
              <Text style={[styles.filterPillText, filterStatus === status && styles.filterPillTextActive]}>
                {getStatusLabel(status)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Sessions List */}
        {filteredSessions.map((session) => (
          <TouchableOpacity
            key={session.id}
            style={styles.sessionCard}
            onPress={() => {
              setSelectedSession(session);
              setShowDetailModal(true);
            }}
          >
            <View style={styles.sessionHeader}>
              <View style={styles.sessionAvatar}>
                <Text style={styles.sessionAvatarText}>
                  {(session.personal_info?.first_name || 'N')[0]}
                </Text>
              </View>
              <View style={styles.sessionInfo}>
                <Text style={styles.sessionName}>
                  {session.personal_info?.first_name || 'Sin'} {session.personal_info?.last_name || 'Nombre'}
                </Text>
                <Text style={styles.sessionEmail}>
                  {session.personal_info?.email || session.id.slice(0, 12) + '...'}
                </Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: getStatusColor(session.status) + '20' }]}>
                <Text style={[styles.statusBadgeText, { color: getStatusColor(session.status) }]}>
                  {getStatusLabel(session.status)}
                </Text>
              </View>
            </View>

            <View style={styles.sessionDetails}>
              <View style={styles.detailItem}>
                <Ionicons name="analytics" size={16} color="#6B7280" />
                <Text style={styles.detailText}>{session.progress_percentage}%</Text>
              </View>
              <View style={styles.detailItem}>
                <Ionicons name="speedometer" size={16} color={getComplexityColor(session.case_complexity)} />
                <Text style={[styles.detailText, { color: getComplexityColor(session.case_complexity) }]}>
                  {session.case_complexity || 'N/A'}
                </Text>
              </View>
              {session.refund_estimate && (
                <View style={styles.detailItem}>
                  <Ionicons 
                    name={session.refund_estimate.is_refund ? 'trending-up' : 'trending-down'} 
                    size={16} 
                    color={session.refund_estimate.is_refund ? '#10B981' : '#EF4444'} 
                  />
                  <Text style={[
                    styles.detailText,
                    { color: session.refund_estimate.is_refund ? '#10B981' : '#EF4444' }
                  ]}>
                    ${Math.abs(session.refund_estimate.estimated_refund).toLocaleString()}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${session.progress_percentage}%` }]} />
            </View>
          </TouchableOpacity>
        ))}

        {filteredSessions.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={48} color="#D1D5DB" />
            <Text style={styles.emptyStateText}>No hay sesiones</Text>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Detail Modal */}
      <Modal visible={showDetailModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Detalle de Sesión</Text>
              <TouchableOpacity onPress={() => setShowDetailModal(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {selectedSession && (
              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Client Info Section */}
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>👤 Cliente</Text>
                  <Text style={styles.modalValue}>
                    {selectedSession.personal_info?.first_name} {selectedSession.personal_info?.last_name}
                  </Text>
                  {selectedSession.personal_info?.email && (
                    <TouchableOpacity onPress={() => Linking.openURL(`mailto:${selectedSession.personal_info?.email}`)}>
                      <Text style={styles.modalLinkValue}>📧 {selectedSession.personal_info?.email}</Text>
                    </TouchableOpacity>
                  )}
                  {selectedSession.personal_info?.phone && (
                    <TouchableOpacity onPress={() => Linking.openURL(`tel:${selectedSession.personal_info?.phone}`)}>
                      <Text style={styles.modalLinkValue}>📱 {selectedSession.personal_info?.phone}</Text>
                    </TouchableOpacity>
                  )}
                  {selectedSession.personal_info?.ssn_last_four && (
                    <Text style={styles.modalSubvalue}>SSN: ***-**-{selectedSession.personal_info?.ssn_last_four}</Text>
                  )}
                </View>

                {/* Status & Progress */}
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>📊 Estado</Text>
                  <View style={[styles.statusBadgeLarge, { backgroundColor: getStatusColor(selectedSession.status) }]}>
                    <Text style={styles.statusBadgeLargeText}>{getStatusLabel(selectedSession.status)}</Text>
                  </View>
                  <View style={styles.progressBarLarge}>
                    <View style={[styles.progressFillLarge, { width: `${selectedSession.progress_percentage}%` }]} />
                  </View>
                  <Text style={styles.progressText}>{selectedSession.progress_percentage}% completado</Text>
                </View>

                <View style={styles.modalRow}>
                  <View style={styles.modalHalf}>
                    <Text style={styles.modalLabel}>Año Fiscal</Text>
                    <Text style={styles.modalValue}>{selectedSession.tax_year}</Text>
                  </View>
                  <View style={styles.modalHalf}>
                    <Text style={styles.modalLabel}>Servicio</Text>
                    <Text style={styles.modalValue}>{getServiceLabel(selectedSession.service_level)}</Text>
                  </View>
                </View>

                <View style={styles.modalRow}>
                  <View style={styles.modalHalf}>
                    <Text style={styles.modalLabel}>Complejidad</Text>
                    <Text style={[styles.modalValue, { color: getComplexityColor(selectedSession.case_complexity) }]}>
                      {selectedSession.case_complexity || 'N/A'}
                    </Text>
                  </View>
                  <View style={styles.modalHalf}>
                    <Text style={styles.modalLabel}>Precio Total</Text>
                    <Text style={[styles.modalValue, { color: '#10B981', fontWeight: 'bold' }]}>
                      ${selectedSession.total_price || 0}
                    </Text>
                  </View>
                </View>

                {/* Refund Estimate */}
                {selectedSession.refund_estimate && (
                  <View style={[styles.estimateBox, { 
                    backgroundColor: selectedSession.refund_estimate.is_refund ? '#D1FAE5' : '#FEE2E2' 
                  }]}>
                    <Text style={styles.estimateBoxLabel}>
                      {selectedSession.refund_estimate.is_refund ? '💰 Reembolso Estimado' : '💸 Impuesto a Pagar'}
                    </Text>
                    <Text style={[styles.estimateBoxValue, { 
                      color: selectedSession.refund_estimate.is_refund ? '#065F46' : '#991B1B' 
                    }]}>
                      ${Math.abs(selectedSession.refund_estimate.estimated_refund).toLocaleString()}
                    </Text>
                  </View>
                )}

                {/* Income Summary */}
                {selectedSession.income && (
                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionTitle}>💼 Ingresos</Text>
                    {selectedSession.income.w2_sources?.map((w2: any, idx: number) => (
                      <View key={idx} style={styles.incomeItem}>
                        <Text style={styles.incomeEmployer}>{w2.employer_name || 'W-2'}</Text>
                        <Text style={styles.incomeAmount}>${(w2.amount || 0).toLocaleString()}</Text>
                      </View>
                    ))}
                    {selectedSession.income.has_self_employment && (
                      <View style={styles.incomeItem}>
                        <Text style={styles.incomeEmployer}>Trabajo Independiente</Text>
                        <Text style={styles.incomeAmount}>${(selectedSession.income.self_employment_income || 0).toLocaleString()}</Text>
                      </View>
                    )}
                  </View>
                )}

                {/* Dependents */}
                {selectedSession.dependents && selectedSession.dependents.length > 0 && (
                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionTitle}>👨‍👩‍👧‍👦 Dependientes ({selectedSession.dependents.length})</Text>
                    {selectedSession.dependents.map((dep: any, idx: number) => (
                      <View key={idx} style={styles.dependentItem}>
                        <Text style={styles.dependentName}>{dep.first_name} {dep.last_name}</Text>
                        <Text style={styles.dependentRelation}>{dep.relationship}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Actions */}
                <View style={styles.modalActions}>
                  <TouchableOpacity 
                    style={[styles.modalAction, { backgroundColor: '#8B5CF6' }]}
                    onPress={() => {
                      setShowDetailModal(false);
                      router.push({
                        pathname: '/tax-wizard/w2-review',
                        params: { sessionId: selectedSession.id, w2Id: '1' }
                      });
                    }}
                  >
                    <Ionicons name="document-text" size={20} color="#fff" />
                    <Text style={[styles.modalActionText, { color: '#fff' }]}>Revisar W-2</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={[styles.modalAction, { backgroundColor: '#3B82F6' }]}
                    onPress={() => handleExportXML(selectedSession.id)}
                  >
                    <Ionicons name="code-outline" size={20} color="#fff" />
                    <Text style={[styles.modalActionText, { color: '#fff' }]}>XML</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={[styles.modalAction, { backgroundColor: '#10B981' }]}
                    onPress={() => {
                      if (selectedSession.personal_info?.phone) {
                        Linking.openURL(`tel:${selectedSession.personal_info.phone}`);
                      }
                    }}
                  >
                    <Ionicons name="call" size={20} color="#fff" />
                    <Text style={[styles.modalActionText, { color: '#fff' }]}>Llamar</Text>
                  </TouchableOpacity>
                </View>

                <View style={{ height: 30 }} />
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  headerTextContainer: {
    flex: 1,
    marginLeft: 8,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  exportBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    backgroundColor: '#F9FAFB',
    flex: 1,
    padding: 20,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
    marginLeft: 12,
  },
  filterScroll: {
    marginBottom: 16,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  filterPillActive: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  filterDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  filterPillText: {
    fontSize: 14,
    color: '#374151',
  },
  filterPillTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  sessionCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  sessionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sessionAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  sessionAvatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  sessionInfo: {
    flex: 1,
  },
  sessionName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  sessionEmail: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  sessionDetails: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailText: {
    fontSize: 13,
    color: '#6B7280',
  },
  progressBar: {
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 2,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#9CA3AF',
    marginTop: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  modalSection: {
    marginBottom: 20,
  },
  modalSectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  modalValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  modalValueLarge: {
    fontSize: 32,
    fontWeight: '700',
  },
  modalSubvalue: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  modalRow: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  modalHalf: {
    flex: 1,
  },
  modalLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  statusBadgeLarge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  statusBadgeLargeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
  },
  modalAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#EFF6FF',
    padding: 14,
    borderRadius: 12,
  },
  modalActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3B82F6',
  },
  modalLinkValue: {
    fontSize: 15,
    color: '#3B82F6',
    marginTop: 4,
  },
  progressBarLarge: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    marginTop: 12,
  },
  progressFillLarge: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
  },
  estimateBox: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginVertical: 16,
  },
  estimateBoxLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  estimateBoxValue: {
    fontSize: 32,
    fontWeight: '700',
  },
  incomeItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  incomeEmployer: {
    fontSize: 14,
    color: '#374151',
  },
  incomeAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  dependentItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  dependentName: {
    fontSize: 14,
    color: '#374151',
  },
  dependentRelation: {
    fontSize: 14,
    color: '#6B7280',
  },
});
