import { useTranslation } from 'react-i18next';
/**
 * Job Applications Admin Screen
 * Admin panel for managing job applications from the website
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  ActivityIndicator,
  Linking,
  Modal,
  TextInput,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import ModernAdminHeader from '../../components/admin/ModernAdminHeader';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8001';

interface JobApplication {
  id: string;
  name: string;
  email: string;
  phone: string;
  position: string;
  experience: string;
  states?: string;
  message?: string;
  status: 'pending' | 'reviewed' | 'interview' | 'hired' | 'rejected';
  ai_evaluation?: string;
  notes?: string;
  documents?: any[];
  created_at: string;
  updated_at: string;
}

interface Stats {
  total: number;
  pending: number;
  reviewed: number;
  interview: number;
  hired: number;
  rejected: number;
  today: number;
}

const JobApplicationsScreen = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const { token } = useAuth();
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedApp, setSelectedApp] = useState<JobApplication | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [notes, setNotes] = useState('');

  const statusColors = {
    pending: '#F59E0B',
    reviewed: '#3B82F6',
    interview: '#8B5CF6',
    hired: '#10B981',
    rejected: '#EF4444',
  };

  const statusLabels = {
    pending: 'Pendiente',
    reviewed: 'Revisada',
    interview: 'Entrevista',
    hired: 'Contratado',
    rejected: 'Rechazada',
  };

  const fetchStats = async () => {
    try {
      const response = await fetch(`${API_URL}/admin/job-applications/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchApplications = async () => {
    try {
      let url = `${API_URL}/admin/job-applications`;
      if (filterStatus) {
        url += `?status=${filterStatus}`;
      }
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setApplications(data.applications || []);
      }
    } catch (error) {
      console.error('Error fetching applications:', error);
      Alert.alert('Error', 'No se pudieron cargar las aplicaciones');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchApplications();
  }, [filterStatus]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchStats();
    fetchApplications();
  }, [filterStatus]);

  const updateApplicationStatus = async (appId: string, newStatus: string) => {
    try {
      const response = await fetch(`${API_URL}/admin/job-applications/${appId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus, notes }),
      });

      if (response.ok) {
        Alert.alert('Éxito', 'Estado actualizado correctamente');
        fetchStats();
        fetchApplications();
        setModalVisible(false);
        setSelectedApp(null);
        setNotes('');
      } else {
        Alert.alert('Error', 'No se pudo actualizar el estado');
      }
    } catch (error) {
      console.error('Error updating application:', error);
      Alert.alert('Error', 'Error de conexión');
    }
  };

  const callApplicant = (phone: string) => {
    Linking.openURL(`tel:${phone}`);
  };

  const emailApplicant = (email: string) => {
    Linking.openURL(`mailto:${email}`);
  };

  const whatsappApplicant = (phone: string, name: string) => {
    const message = `Hola ${name}, gracias por aplicar a Ross Tax Preparation. `;
    Linking.openURL(`https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderStatsCard = () => {
    if (!stats) return null;

    return (
      <View style={styles.statsContainer}>
        <TouchableOpacity
          style={[styles.statCard, filterStatus === null && styles.statCardActive]}
          onPress={() => setFilterStatus(null)}
        >
          <Text style={styles.statNumber}>{stats.total}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.statCard, filterStatus === 'pending' && styles.statCardActive, { borderColor: statusColors.pending }]}
          onPress={() => setFilterStatus(filterStatus === 'pending' ? null : 'pending')}
        >
          <Text style={[styles.statNumber, { color: statusColors.pending }]}>{stats.pending}</Text>
          <Text style={styles.statLabel}>Pendientes</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.statCard, filterStatus === 'interview' && styles.statCardActive, { borderColor: statusColors.interview }]}
          onPress={() => setFilterStatus(filterStatus === 'interview' ? null : 'interview')}
        >
          <Text style={[styles.statNumber, { color: statusColors.interview }]}>{stats.interview}</Text>
          <Text style={styles.statLabel}>Entrevista</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.statCard, filterStatus === 'hired' && styles.statCardActive, { borderColor: statusColors.hired }]}
          onPress={() => setFilterStatus(filterStatus === 'hired' ? null : 'hired')}
        >
          <Text style={[styles.statNumber, { color: statusColors.hired }]}>{stats.hired}</Text>
          <Text style={styles.statLabel}>Contratados</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderApplicationCard = (app: JobApplication) => {
    return (
      <TouchableOpacity
        key={app.id}
        style={styles.applicationCard}
        onPress={() => {
          setSelectedApp(app);
          setNotes(app.notes || '');
          setModalVisible(true);
        }}
      >
        <View style={styles.cardHeader}>
          <View style={styles.applicantInfo}>
            <Ionicons name="person-circle" size={40} color="#6C1110" />
            <View style={styles.applicantDetails}>
              <Text style={styles.applicantName}>{app.name}</Text>
              <Text style={styles.applicantPosition}>{app.position}</Text>
            </View>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusColors[app.status] + '20' }]}>
            <Text style={[styles.statusText, { color: statusColors[app.status] }]}>
              {statusLabels[app.status]}
            </Text>
          </View>
        </View>

        <View style={styles.cardBody}>
          <View style={styles.infoRow}>
            <Ionicons name="briefcase-outline" size={16} color="#666" />
            <Text style={styles.infoText}>{app.experience} de experiencia</Text>
          </View>
          {app.states && (
            <View style={styles.infoRow}>
              <Ionicons name="location-outline" size={16} color="#666" />
              <Text style={styles.infoText}>{app.states}</Text>
            </View>
          )}
          <View style={styles.infoRow}>
            <Ionicons name="time-outline" size={16} color="#666" />
            <Text style={styles.infoText}>{formatDate(app.created_at)}</Text>
          </View>
        </View>

        <View style={styles.cardActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => callApplicant(app.phone)}
          >
            <Ionicons name="call" size={20} color="#10B981" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => emailApplicant(app.email)}
          >
            <Ionicons name="mail" size={20} color="#3B82F6" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => whatsappApplicant(app.phone, app.name)}
          >
            <Ionicons name="logo-whatsapp" size={20} color="#25D366" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const renderDetailModal = () => {
    if (!selectedApp) return null;

    return (
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Detalle de Aplicación</Text>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Ionicons name="close" size={28} color="#333" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {/* Applicant Info */}
            <View style={styles.detailSection}>
              <Text style={styles.detailSectionTitle}>Información del Aplicante</Text>
              <View style={styles.detailRow}>
                <Ionicons name="person" size={20} color="#6C1110" />
                <Text style={styles.detailText}>{selectedApp.name}</Text>
              </View>
              <TouchableOpacity style={styles.detailRow} onPress={() => emailApplicant(selectedApp.email)}>
                <Ionicons name="mail" size={20} color="#3B82F6" />
                <Text style={[styles.detailText, { color: '#3B82F6' }]}>{selectedApp.email}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.detailRow} onPress={() => callApplicant(selectedApp.phone)}>
                <Ionicons name="call" size={20} color="#10B981" />
                <Text style={[styles.detailText, { color: '#10B981' }]}>{selectedApp.phone}</Text>
              </TouchableOpacity>
              {selectedApp.states && (
                <View style={styles.detailRow}>
                  <Ionicons name="location" size={20} color="#666" />
                  <Text style={styles.detailText}>{selectedApp.states}</Text>
                </View>
              )}
            </View>

            {/* Position & Experience */}
            <View style={styles.detailSection}>
              <Text style={styles.detailSectionTitle}>Experiencia</Text>
              <View style={styles.detailRow}>
                <Ionicons name="briefcase" size={20} color="#6C1110" />
                <Text style={styles.detailText}>{selectedApp.position}</Text>
              </View>
              <View style={styles.detailRow}>
                <Ionicons name="time" size={20} color="#666" />
                <Text style={styles.detailText}>{selectedApp.experience}</Text>
              </View>
            </View>

            {/* Message */}
            {selectedApp.message && (
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>Mensaje del Aplicante</Text>
                <Text style={styles.messageText}>{selectedApp.message}</Text>
              </View>
            )}

            {/* AI Evaluation */}
            {selectedApp.ai_evaluation && (
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>🤖 Evaluación AI Ross</Text>
                <View style={styles.aiEvaluation}>
                  <Text style={styles.aiEvaluationText}>{selectedApp.ai_evaluation}</Text>
                </View>
              </View>
            )}

            {/* Notes */}
            <View style={styles.detailSection}>
              <Text style={styles.detailSectionTitle}>Notas del Administrador</Text>
              <TextInput
                style={styles.notesInput}
                multiline
                numberOfLines={4}
                value={notes}
                onChangeText={setNotes}
                placeholder={t('admin.jobNotesPlaceholder', 'Agregar notas sobre esta aplicación...')}
              />
            </View>

            {/* Status Actions */}
            <View style={styles.detailSection}>
              <Text style={styles.detailSectionTitle}>Cambiar Estado</Text>
              <View style={styles.statusButtons}>
                <TouchableOpacity
                  style={[styles.statusButton, { backgroundColor: statusColors.reviewed }]}
                  onPress={() => updateApplicationStatus(selectedApp.id, 'reviewed')}
                >
                  <Text style={styles.statusButtonText}>Revisada</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.statusButton, { backgroundColor: statusColors.interview }]}
                  onPress={() => updateApplicationStatus(selectedApp.id, 'interview')}
                >
                  <Text style={styles.statusButtonText}>Entrevista</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.statusButton, { backgroundColor: statusColors.hired }]}
                  onPress={() => updateApplicationStatus(selectedApp.id, 'hired')}
                >
                  <Text style={styles.statusButtonText}>Contratar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.statusButton, { backgroundColor: statusColors.rejected }]}
                  onPress={() => {
                    Alert.alert(
                      'Confirmar Rechazo',
                      '¿Estás seguro que deseas rechazar esta aplicación?',
                      [
                        { text: 'Cancelar', style: 'cancel' },
                        { text: 'Rechazar', onPress: () => updateApplicationStatus(selectedApp.id, 'rejected') },
                      ]
                    );
                  }}
                >
                  <Text style={styles.statusButtonText}>Rechazar</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Contact Actions */}
            <View style={styles.contactActions}>
              <TouchableOpacity
                style={[styles.contactButton, { backgroundColor: '#25D366' }]}
                onPress={() => whatsappApplicant(selectedApp.phone, selectedApp.name)}
              >
                <Ionicons name="logo-whatsapp" size={24} color="white" />
                <Text style={styles.contactButtonText}>WhatsApp</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.contactButton, { backgroundColor: '#3B82F6' }]}
                onPress={() => emailApplicant(selectedApp.email)}
              >
                <Ionicons name="mail" size={24} color="white" />
                <Text style={styles.contactButtonText}>Email</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.contactButton, { backgroundColor: '#10B981' }]}
                onPress={() => callApplicant(selectedApp.phone)}
              >
                <Ionicons name="call" size={24} color="white" />
                <Text style={styles.contactButtonText}>Llamar</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ModernAdminHeader 
          title="💼 Aplicaciones" 
          subtitle="Gestión de candidatos"
          showBackButton 
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6C1110" />
          <Text style={styles.loadingText}>Cargando aplicaciones...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ModernAdminHeader 
        title="💼 Aplicaciones" 
        subtitle="Gestión de candidatos"
        showBackButton 
      />
      
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#6C1110']} />
        }
      >
        {renderStatsCard()}

        {/* Today's count */}
        {stats && stats.today > 0 && (
          <View style={styles.todayBanner}>
            <Ionicons name="flash" size={20} color="#F59E0B" />
            <Text style={styles.todayText}>
              {stats.today} aplicación{stats.today > 1 ? 'es' : ''} hoy
            </Text>
          </View>
        )}

        {applications.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="briefcase-outline" size={64} color="#CCC" />
            <Text style={styles.emptyText}>
              {filterStatus
                ? `No hay aplicaciones con estado "${statusLabels[filterStatus as keyof typeof statusLabels]}"`
                : 'No hay aplicaciones todavía'}
            </Text>
          </View>
        ) : (
          <View style={styles.applicationsList}>
            {applications.map(renderApplicationCard)}
          </View>
        )}
      </ScrollView>

      {renderDetailModal()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#666',
    fontSize: 16,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 12,
    flex: 1,
    marginHorizontal: 4,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  statCardActive: {
    borderColor: '#6C1110',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  statLabel: {
    fontSize: 11,
    color: '#666',
    marginTop: 4,
  },
  todayBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  todayText: {
    marginLeft: 8,
    color: '#92400E',
    fontWeight: '600',
  },
  applicationsList: {
    gap: 12,
  },
  applicationCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
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
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  applicantInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  applicantDetails: {
    marginLeft: 12,
  },
  applicantName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  applicantPosition: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
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
    alignItems: 'center',
    marginBottom: 8,
  },
  infoText: {
    marginLeft: 8,
    color: '#666',
    fontSize: 14,
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 12,
  },
  actionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  detailSection: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  detailSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  detailText: {
    marginLeft: 12,
    fontSize: 16,
    color: '#333',
  },
  messageText: {
    fontSize: 15,
    color: '#555',
    lineHeight: 22,
  },
  aiEvaluation: {
    backgroundColor: '#F3E8FF',
    borderRadius: 8,
    padding: 12,
  },
  aiEvaluationText: {
    fontSize: 14,
    color: '#6B21A8',
    lineHeight: 20,
  },
  notesInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  statusButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  statusButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  contactActions: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 32,
  },
  contactButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  contactButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 15,
  },
});

export default JobApplicationsScreen;
