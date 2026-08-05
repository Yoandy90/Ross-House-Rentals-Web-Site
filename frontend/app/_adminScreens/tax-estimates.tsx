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
  TextInput,
  RefreshControl,
  Modal,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useThemeColors } from '../../constants/colors';
import api from '../../services/api';

interface TaxEstimate {
  id: string;
  client_name: string;
  client_email: string;
  client_phone: string;
  tax_year: number;
  filing_status: string;
  annual_income: number;
  estimated_refund: number;
  estimated_tax: number;
  status: string;
  wants_office_appointment: boolean;
  client_notes: string;
  admin_notes: string;
  created_at: string;
}

interface Stats {
  total_estimates: number;
  pending_review: number;
  reviewed: number;
  converted_to_case: number;
  wants_appointment: number;
  avg_estimated_refund: number;
}

export default function TaxEstimatesAdmin() {
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  
  const [estimates, setEstimates] = useState<TaxEstimate[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEstimate, setSelectedEstimate] = useState<TaxEstimate | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [adminNotes, setAdminNotes] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const statuses = [
    { value: '', label: 'Todos', color: colors.textSecondary, icon: 'apps' },
    { value: 'pending_review', label: 'Pendiente', color: '#FF9800', icon: 'time' },
    { value: 'reviewed', label: 'Revisado', color: '#2196F3', icon: 'checkmark-circle' },
    { value: 'contacted', label: 'Contactado', color: '#9C27B0', icon: 'call' },
    { value: 'appointment_scheduled', label: 'Cita Agendada', color: '#4CAF50', icon: 'calendar' },
    { value: 'converted_to_case', label: 'Convertido', color: '#00BCD4', icon: 'trophy' },
  ];

  const filingStatusLabels: { [key: string]: string } = {
    single: 'Soltero',
    married_joint: 'Casado',
    married_separate: 'Casado (Sep)',
    head_of_household: 'Jefe Familia',
    widow: 'Viudo(a)',
  };

  useEffect(() => {
    loadEstimates();
  }, [statusFilter]);

  const loadEstimates = async () => {
    try {
      setLoading(true);
      const params: any = { page: 1, limit: 100 };
      if (statusFilter) params.status = statusFilter;

      const response = await api.get('/admin/tax-estimates', { params });
      setEstimates(response.data.estimates || []);
      setStats(response.data.stats || null);
    } catch (error) {
      console.error('Error loading estimates:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadEstimates();
  };

  const openDetail = (estimate: TaxEstimate) => {
    setSelectedEstimate(estimate);
    setAdminNotes(estimate.admin_notes || '');
    setShowDetailModal(true);
  };

  const updateStatus = async (newStatus: string) => {
    if (!selectedEstimate) return;

    try {
      setUpdatingStatus(true);
      await api.put(`/admin/tax-estimates/${selectedEstimate.id}/status`, {
        estimate_id: selectedEstimate.id,
        status: newStatus,
        admin_notes: adminNotes || null,
      });

      setEstimates((prev) =>
        prev.map((e) =>
          e.id === selectedEstimate.id
            ? { ...e, status: newStatus, admin_notes: adminNotes }
            : e
        )
      );

      setShowDetailModal(false);
      loadEstimates();
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Error al actualizar el status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const formatCurrency = (value: number) => {
    return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const getStatusColor = (status: string) => {
    const s = statuses.find((st) => st.value === status);
    return s ? s.color : colors.textSecondary;
  };

  const getStatusLabel = (status: string) => {
    const s = statuses.find((st) => st.value === status);
    return s ? s.label : status;
  };

  const getStatusIcon = (status: string) => {
    const s = statuses.find((st) => st.value === status);
    return s ? s.icon : 'document';
  };

  const filteredEstimates = estimates.filter((est) =>
    searchQuery
      ? est.client_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        est.client_email.toLowerCase().includes(searchQuery.toLowerCase())
      : true
  );

  if (loading && !refreshing) {
    return (
      <View style={styles.container}>
        <AdminHeader title="Estimados de Impuestos" subtitle="Gestión y seguimiento" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Cargando estimados...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AdminHeader 
        title="Estimados de Impuestos" 
        subtitle={`${stats?.total_estimates || 0} solicitudes`}
      />
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
          {/* Stats Cards */}
          {stats && (
            <View style={styles.statsContainer}>
              <View style={styles.statsRow}>
                <View style={styles.statCard}>
                  <Ionicons name="document-text" size={32} color={colors.primary} />
                  <Text style={styles.statValue}>{stats.total_estimates}</Text>
                  <Text style={styles.statLabel}>Total</Text>
                </View>
                
                <View style={styles.statCard}>
                  <Ionicons name="time" size={32} color="#FF9800" />
                  <Text style={styles.statValue}>{stats.pending_review}</Text>
                  <Text style={styles.statLabel}>Pendientes</Text>
                </View>
              </View>
              
              <View style={styles.statsRow}>
                <View style={styles.statCard}>
                  <Ionicons name="trophy" size={32} color="#4CAF50" />
                  <Text style={styles.statValue}>{stats.converted_to_case}</Text>
                  <Text style={styles.statLabel}>Convertidos</Text>
                </View>
                
                <View style={styles.statCard}>
                  <Ionicons name="cash" size={32} color="#2196F3" />
                  <Text style={styles.statValue}>{formatCurrency(stats.avg_estimated_refund || 0)}</Text>
                  <Text style={styles.statLabel}>Promedio</Text>
                </View>
              </View>
            </View>
          )}

          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color={colors.textSecondary} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar por nombre o email..."
              placeholderTextColor={colors.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery !== '' && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>

          {/* Status Filters */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersContainer}>
            {statuses.map((status) => (
              <TouchableOpacity
                key={status.value}
                style={[
                  styles.filterButton,
                  statusFilter === status.value && styles.filterButtonActive,
                ]}
                onPress={() => setStatusFilter(status.value)}
              >
                <Ionicons
                  name={status.icon as any}
                  size={16}
                  color={statusFilter === status.value ? '#fff' : status.color}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={[
                    styles.filterButtonText,
                    statusFilter === status.value && styles.filterButtonTextActive,
                  ]}
                >
                  {status.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Estimates List */}
          <View style={styles.listContainer}>
            {filteredEstimates.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="document-text-outline" size={64} color={colors.textGray} />
                <Text style={styles.emptyText}>No hay estimados</Text>
              </View>
            ) : (
              filteredEstimates.map((estimate) => (
                <TouchableOpacity
                  key={estimate.id}
                  style={styles.estimateCard}
                  onPress={() => openDetail(estimate)}
                >
                  <View style={styles.estimateHeader}>
                    <View style={styles.estimateInfo}>
                      <Text style={styles.clientName}>{estimate.client_name}</Text>
                      <Text style={styles.clientEmail}>{estimate.client_email}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(estimate.status) }]}>
                      <Ionicons
                        name={getStatusIcon(estimate.status) as any}
                        size={14}
                        color="#fff"
                        style={{ marginRight: 4 }}
                      />
                      <Text style={styles.statusBadgeText}>
                        {getStatusLabel(estimate.status)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.estimateDetails}>
                    <View style={styles.detailRow}>
                      <Ionicons name="calendar-outline" size={16} color={colors.textSecondary} />
                      <Text style={styles.detailText}>
                        Año {estimate.tax_year} • {filingStatusLabels[estimate.filing_status]}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Ionicons name="cash-outline" size={16} color={colors.textSecondary} />
                      <Text style={styles.detailText}>
                        Ingreso: {formatCurrency(estimate.annual_income)}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Ionicons
                        name={estimate.estimated_refund >= 0 ? 'arrow-down-circle' : 'arrow-up-circle'}
                        size={16}
                        color={estimate.estimated_refund >= 0 ? '#4CAF50' : '#F44336'}
                      />
                      <Text
                        style={[
                          styles.detailText,
                          { color: estimate.estimated_refund >= 0 ? '#4CAF50' : '#F44336', fontWeight: '600' },
                        ]}
                      >
                        {estimate.estimated_refund >= 0 ? 'Reembolso' : 'Adeuda'}:{' '}
                        {formatCurrency(Math.abs(estimate.estimated_refund))}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.estimateFooter}>
                    {estimate.wants_office_appointment && (
                      <View style={styles.appointmentBadge}>
                        <Ionicons name="calendar" size={12} color="#2196F3" />
                        <Text style={styles.appointmentText}>Quiere cita</Text>
                      </View>
                    )}
                    <Text style={styles.dateText}>{formatDate(estimate.created_at)}</Text>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
        </ScrollView>

      {/* Detail Modal */}
      <Modal visible={showDetailModal} animationType="slide" transparent>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Detalle del Estimado</Text>
              <TouchableOpacity onPress={() => setShowDetailModal(false)}>
                <Ionicons name="close" size={28} color={colors.text} />
              </TouchableOpacity>
            </View>

            {selectedEstimate && (
              <ScrollView style={styles.modalBody}>
                <View style={styles.modalSection}>
                  <Text style={styles.sectionTitle}>👤 Cliente</Text>
                  <View style={styles.infoRow}>
                    <Ionicons name="person" size={20} color={colors.primary} />
                    <Text style={styles.modalText}>{selectedEstimate.client_name}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Ionicons name="mail" size={20} color={colors.primary} />
                    <Text style={styles.modalText}>{selectedEstimate.client_email}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Ionicons name="call" size={20} color={colors.primary} />
                    <Text style={styles.modalText}>{selectedEstimate.client_phone}</Text>
                  </View>
                </View>

                <View style={styles.modalSection}>
                  <Text style={styles.sectionTitle}>💰 Datos Fiscales</Text>
                  <View style={styles.dataGrid}>
                    <View style={styles.dataItem}>
                      <Text style={styles.dataLabel}>Año</Text>
                      <Text style={styles.dataValue}>{selectedEstimate.tax_year}</Text>
                    </View>
                    <View style={styles.dataItem}>
                      <Text style={styles.dataLabel}>Estado Civil</Text>
                      <Text style={styles.dataValue}>{filingStatusLabels[selectedEstimate.filing_status]}</Text>
                    </View>
                    <View style={styles.dataItem}>
                      <Text style={styles.dataLabel}>Ingreso Anual</Text>
                      <Text style={styles.dataValue}>{formatCurrency(selectedEstimate.annual_income)}</Text>
                    </View>
                    <View style={styles.dataItem}>
                      <Text style={styles.dataLabel}>Impuesto Est.</Text>
                      <Text style={styles.dataValue}>{formatCurrency(selectedEstimate.estimated_tax)}</Text>
                    </View>
                  </View>
                  <View style={[
                    styles.refundBanner,
                    { backgroundColor: selectedEstimate.estimated_refund >= 0 ? '#E8F5E9' : '#FFEBEE' }
                  ]}>
                    <Ionicons
                      name={selectedEstimate.estimated_refund >= 0 ? 'checkmark-circle' : 'alert-circle'}
                      size={24}
                      color={selectedEstimate.estimated_refund >= 0 ? '#4CAF50' : '#F44336'}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={[
                        styles.refundLabel,
                        { color: selectedEstimate.estimated_refund >= 0 ? '#4CAF50' : '#F44336' }
                      ]}>
                        {selectedEstimate.estimated_refund >= 0 ? 'Reembolso Estimado' : 'Cantidad Adeudada'}
                      </Text>
                      <Text style={[
                        styles.refundAmount,
                        { color: selectedEstimate.estimated_refund >= 0 ? '#4CAF50' : '#F44336' }
                      ]}>
                        {formatCurrency(Math.abs(selectedEstimate.estimated_refund))}
                      </Text>
                    </View>
                  </View>
                </View>

                {selectedEstimate.client_notes && (
                  <View style={styles.modalSection}>
                    <Text style={styles.sectionTitle}>💬 Notas del Cliente</Text>
                    <View style={styles.notesBox}>
                      <Text style={styles.modalText}>{selectedEstimate.client_notes}</Text>
                    </View>
                  </View>
                )}

                <View style={styles.modalSection}>
                  <Text style={styles.sectionTitle}>📝 Notas del Admin</Text>
                  <TextInput
                    style={styles.notesInput}
                    placeholder="Agregar notas internas..."
                    placeholderTextColor={colors.textSecondary}
                    multiline
                    numberOfLines={4}
                    value={adminNotes}
                    onChangeText={setAdminNotes}
                  />
                </View>

                <View style={styles.modalSection}>
                  <Text style={styles.sectionTitle}>🔄 Cambiar Status</Text>
                  <View style={styles.statusButtons}>
                    {statuses.filter((s) => s.value !== '').map((status) => (
                      <TouchableOpacity
                        key={status.value}
                        style={[
                          styles.statusButton,
                          { borderColor: status.color },
                          selectedEstimate.status === status.value && {
                            backgroundColor: status.color,
                          },
                        ]}
                        onPress={() => updateStatus(status.value)}
                        disabled={updatingStatus}
                      >
                        <Ionicons
                          name={status.icon as any}
                          size={16}
                          color={selectedEstimate.status === status.value ? '#fff' : status.color}
                          style={{ marginRight: 4 }}
                        />
                        <Text
                          style={[
                            styles.statusButtonText,
                            selectedEstimate.status === status.value && { color: '#fff' },
                          ]}
                        >
                          {status.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {updatingStatus && (
                  <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 16 }} />
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      flex: 1,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.background,
    },
    loadingText: {
      marginTop: 12,
      color: colors.textSecondary,
    },
    header: {
      padding: 24,
    },
    headerContent: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    headerTitle: {
      fontSize: 28,
      fontWeight: '800',
      color: 'white',
    },
    headerSubtitle: {
      fontSize: 14,
      color: 'rgba(255,255,255,0.9)',
      marginTop: 4,
    },
    statsContainer: {
      padding: 20,
    },
    statsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 16,
    },
    statCard: {
      flex: 1,
      minWidth: 150,
      backgroundColor: colors.background,
      padding: 20,
      borderRadius: 16,
      alignItems: 'center',
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
        },
        android: {
          elevation: 4,
        },
        web: {
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        },
      }),
    },
    statValue: {
      fontSize: 28,
      fontWeight: '800',
      color: colors.text,
      marginTop: 8,
    },
    statLabel: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 4,
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.background,
      marginHorizontal: 20,
      marginBottom: 16,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    searchIcon: {
      marginRight: 8,
    },
    searchInput: {
      flex: 1,
      fontSize: 16,
      color: colors.text,
      outlineStyle: 'none',
    } as any,
    filtersContainer: {
      paddingHorizontal: 20,
      marginBottom: 16,
    },
    filterButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 20,
      borderWidth: 2,
      borderColor: colors.border,
      marginRight: 8,
      backgroundColor: colors.background,
    },
    filterButtonActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    filterButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    filterButtonTextActive: {
      color: 'white',
    },
    listContainer: {
      padding: 20,
      gap: 16,
    },
    emptyContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 60,
    },
    emptyText: {
      fontSize: 16,
      color: colors.textGray,
      marginTop: 16,
    },
    estimateCard: {
      backgroundColor: colors.background,
      borderRadius: 16,
      padding: 20,
      marginBottom: 12,
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
        },
        android: {
          elevation: 4,
        },
      }),
    },
    estimateHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 12,
    },
    estimateInfo: {
      flex: 1,
    },
    clientName: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
    },
    clientEmail: {
      fontSize: 14,
      color: colors.textSecondary,
      marginTop: 4,
    },
    statusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 12,
    },
    statusBadgeText: {
      fontSize: 12,
      fontWeight: '700',
      color: '#fff',
    },
    estimateDetails: {
      gap: 10,
    },
    detailRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    detailText: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    estimateFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    appointmentBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: '#E3F2FD',
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
    },
    appointmentText: {
      fontSize: 12,
      fontWeight: '600',
      color: '#2196F3',
    },
    dateText: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    modalContainer: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: colors.background,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: '90%',
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
    },
    modalBody: {
      padding: 20,
    },
    modalSection: {
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 12,
    },
    infoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 8,
    },
    modalText: {
      fontSize: 15,
      color: colors.textSecondary,
      flex: 1,
    },
    dataGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      marginBottom: 16,
    },
    dataItem: {
      flex: 1,
      minWidth: '45%',
      backgroundColor: colors.backgroundGray,
      padding: 12,
      borderRadius: 8,
    },
    dataLabel: {
      fontSize: 12,
      color: colors.textSecondary,
      marginBottom: 4,
    },
    dataValue: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    refundBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      borderRadius: 12,
      gap: 12,
    },
    refundLabel: {
      fontSize: 14,
      fontWeight: '600',
      marginBottom: 4,
    },
    refundAmount: {
      fontSize: 24,
      fontWeight: '800',
    },
    notesBox: {
      backgroundColor: colors.backgroundGray,
      padding: 12,
      borderRadius: 8,
    },
    notesInput: {
      backgroundColor: colors.backgroundGray,
      borderRadius: 8,
      padding: 12,
      fontSize: 14,
      color: colors.text,
      minHeight: 100,
      textAlignVertical: 'top',
      borderWidth: 1,
      borderColor: colors.border,
    },
    statusButtons: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 8,
    },
    statusButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 8,
      borderWidth: 2,
    },
    statusButtonText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
    },
  });
