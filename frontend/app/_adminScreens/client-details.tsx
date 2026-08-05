import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
  Image,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import SegmentedControl from '@react-native-segmented-control/segmented-control';
import { useThemeColors } from '../../constants/colors';
import api from '../../services/api';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import ClientTimeline from '../../components/ClientTimeline';
import RequestDocumentsModal from '../../components/RequestDocumentsModal';
import AddNoteModal from '../../components/AddNoteModal';
import EditClientProfileModal from '../../components/EditClientProfileModal';
import AdminHeader from '../../components/admin/AdminHeader';
import { appCache, CACHE_KEYS } from '../../utils/cache';

export default function ClientDetails() {
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const params = useLocalSearchParams();
  
  // Debug log
  console.log('🔍 ClientDetails params:', JSON.stringify(params));
  
  const id = params.id || params.userId || params.clientId; // Support 'id', 'userId', and 'clientId' parameters
  
  console.log('🔍 ClientDetails id extracted:', id);
  
  const [clientData, setClientData] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [selectedTab, setSelectedTab] = useState(0);
  const [showRequestDocsModal, setShowRequestDocsModal] = useState(false);
  const [showAddNoteModal, setShowAddNoteModal] = useState(false);
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [timelineData, setTimelineData] = useState<any[]>([]);
  const [invalidId, setInvalidId] = useState(false);
  const [adminDocYear, setAdminDocYear] = useState<number | null>(null); // null = show all

  // Check if ID is valid - this must happen after all hooks
  useEffect(() => {
    if (!id || id === 'undefined') {
      setInvalidId(true);
      setLoading(false);
    } else {
      setInvalidId(false);
      loadClientData();
    }
  }, [id]);

  // Show error screen for invalid ID - AFTER all hooks
  if (invalidId) {
    return (
      <View style={{ flex: 1, backgroundColor: '#fff' }}>
        <AdminHeader title="Detalles del Cliente" />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <Ionicons name="alert-circle-outline" size={64} color="#ef4444" />
          <Text style={{ fontSize: 18, fontWeight: '600', marginTop: 16, textAlign: 'center' }}>
            Error: ID de cliente no válido
          </Text>
          <Text style={{ fontSize: 14, color: '#666', marginTop: 8, textAlign: 'center' }}>
            No se pudo cargar la información del cliente
          </Text>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{
              marginTop: 24,
              backgroundColor: '#3b82f6',
              paddingHorizontal: 24,
              paddingVertical: 12,
              borderRadius: 8,
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '600' }}>Volver</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const buildTimeline = (data: any) => {
    const timeline: any[] = [];

    // Add documents
    data.documents?.forEach((doc: any) => {
      timeline.push({
        id: `doc-${doc.id}`,
        type: 'document',
        title: `Documento subido: ${doc.name}`,
        description: doc.category ? `Categoría: ${doc.category}` : undefined,
        timestamp: doc.uploaded_at,
        metadata: { category: doc.category },
      });
    });

    // Add appointments
    data.appointments?.forEach((appt: any) => {
      timeline.push({
        id: `appt-${appt.id}`,
        type: 'appointment',
        title: appt.title || 'Cita programada',
        description: `Estado: ${appt.status}`,
        timestamp: appt.scheduled_at,
        metadata: { status: appt.status },
      });
    });

    // Add KYC completion
    if (data.kyc?.completed) {
      timeline.push({
        id: 'kyc-completed',
        type: 'kyc',
        title: 'KYC Completado',
        description: data.kyc.verified ? 'Verificado por admin' : 'Pendiente de verificación',
        timestamp: data.kyc.completed_at || data.user.created_at,
      });
    }

    // Add tax returns
    data.completed_returns?.forEach((ret: any) => {
      timeline.push({
        id: `return-${ret.id}`,
        type: 'tax_return',
        title: `Declaración año fiscal ${ret.tax_year}`,
        description: ret.filed_date ? 'Presentado' : 'Completado',
        timestamp: ret.filed_date || ret.completed_at,
        metadata: { tax_year: ret.tax_year },
      });
    });

    // Sort by timestamp (newest first)
    timeline.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return timeline;
  };

  const loadClientData = async () => {
    try {
      console.log('🔍 Loading client data for ID:', id);
      const response = await api.get(`/admin/clients/${id}`);
      console.log('✅ Client data loaded:', response.data);
      setClientData(response.data);
      
      // Build timeline from data
      const timeline = buildTimeline(response.data);
      setTimelineData(timeline);
    } catch (error: any) {
      console.error('❌ Error loading client data:', error);
      console.error('Error response:', error.response?.data);
      alert('Error: No se pudo cargar la información del cliente. ' + (error.response?.data?.detail || error.message));
      router.back();
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadClientData();
  };

  const verifyKYC = async () => {
    setVerifying(true);
    try {
      await api.patch(`/admin/kyc/${id}/verify`);
      Alert.alert('Éxito', 'KYC verificado correctamente');
      loadClientData();
    } catch (error) {
      Alert.alert('Error', 'No se pudo verificar el KYC');
    } finally {
      setVerifying(false);
    }
  };

  // Función para eliminar cliente
  const handleDeleteClient = () => {
    Alert.alert(
      '⚠️ Eliminar Cliente',
      `¿Estás seguro de que deseas eliminar a "${clientData?.user?.name}"?\n\nEsta acción eliminará:\n• Todos sus documentos\n• Citas programadas\n• Historial de declaraciones\n• Datos de KYC\n\nEsta acción NO se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: confirmDeleteClient,
        },
      ]
    );
  };

  const confirmDeleteClient = async () => {
    setDeleting(true);
    try {
      await api.delete(`/admin/clients/${id}`);
      
      // Limpiar el caché de la lista de clientes para forzar recarga
      appCache.delete(CACHE_KEYS.CLIENTS_LIST);
      
      Alert.alert(
        '✅ Cliente Eliminado',
        'El cliente y todos sus datos han sido eliminados correctamente.',
        [
          {
            text: 'OK',
            onPress: () => router.replace('/(admin)/clients'),
          },
        ]
      );
    } catch (error: any) {
      console.error('Error deleting client:', error);
      Alert.alert(
        'Error',
        error.response?.data?.detail || 'No se pudo eliminar el cliente. Intenta de nuevo.'
      );
    } finally {
      setDeleting(false);
    }
  };

  if (loading || !clientData) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const { user, kyc, documents, appointments, tax_returns, completed_returns } = clientData;

  // Render functions for each tab
  const renderOverviewTab = () => (
    <View>
      {/* KYC Status */}
      {kyc && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Estado KYC</Text>
            {kyc.completed && !kyc.verified && (
              <TouchableOpacity
                style={styles.verifyButton}
                onPress={verifyKYC}
                disabled={verifying}
              >
                {verifying ? (
                  <ActivityIndicator size="small" color={colors.textWhite} />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={16} color={colors.textWhite} />
                    <Text style={styles.verifyButtonText}>Verificar</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.kycCard}>
            <View style={styles.kycRow}>
              <Text style={styles.kycLabel}>Estado:</Text>
              <View style={[styles.statusBadge, kyc.completed ? styles.statusComplete : styles.statusPending]}>
                <Text style={styles.statusText}>
                  {kyc.completed ? 'Completo' : 'Pendiente'}
                </Text>
              </View>
            </View>
            {kyc.completed && (
              <>
                <View style={styles.kycRow}>
                  <Text style={styles.kycLabel}>Verificado:</Text>
                  <Ionicons
                    name={kyc.verified ? 'checkmark-circle' : 'close-circle'}
                    size={20}
                    color={kyc.verified ? colors.success : colors.error}
                  />
                </View>
                <View style={styles.kycRow}>
                  <Text style={styles.kycLabel}>Prioridad:</Text>
                  <Ionicons
                    name={kyc.priority_status ? 'star' : 'star-outline'}
                    size={20}
                    color={kyc.priority_status ? colors.warning : colors.textGray}
                  />
                </View>
                <View style={styles.kycDivider} />
                <View style={styles.kycRow}>
                  <Text style={styles.kycLabel}>SSN/ITIN:</Text>
                  <Text style={styles.kycValue}>***-**-{kyc.ssn_last_four}</Text>
                </View>
                <View style={styles.kycRow}>
                  <Text style={styles.kycLabel}>Estado Civil:</Text>
                  <Text style={styles.kycValue}>{kyc.marital_status}</Text>
                </View>
                <View style={styles.kycRow}>
                  <Text style={styles.kycLabel}>Dependientes:</Text>
                  <Text style={styles.kycValue}>{kyc.num_dependents}</Text>
                </View>
                <View style={styles.kycRow}>
                  <Text style={styles.kycLabel}>Dirección:</Text>
                  <Text style={styles.kycValueMultiline}>
                    {kyc.address_street}, {kyc.address_city}, {kyc.address_state} {kyc.address_zip}
                  </Text>
                </View>
              </>
            )}
          </View>
        </View>
      )}

      {/* Statistics */}
      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Ionicons name="folder" size={24} color={colors.accent} />
          <Text style={styles.statNumber}>{documents.length}</Text>
          <Text style={styles.statLabel}>Documentos</Text>
        </View>
        <View style={styles.statBox}>
          <Ionicons name="calendar" size={24} color={colors.warning} />
          <Text style={styles.statNumber}>{appointments.length}</Text>
          <Text style={styles.statLabel}>Citas</Text>
        </View>
        <View style={styles.statBox}>
          <Ionicons name="document-text" size={24} color={colors.success} />
          <Text style={styles.statNumber}>{completed_returns.length}</Text>
          <Text style={styles.statLabel}>Declaraciones</Text>
        </View>
      </View>
    </View>
  );

  const renderTimelineTab = () => (
    <View style={styles.timelineContainer}>
      <ClientTimeline items={timelineData} />
    </View>
  );

  const handleDownloadDocument = async (doc: any) => {
    try {
      const response = await api.get(`/admin/documents/${doc.id}`);
      const fileData = response.data.file_data;

      if (Platform.OS === 'web') {
        const link = document.createElement('a');
        link.href = `data:${doc.file_type};base64,${fileData}`;
        link.download = doc.name;
        link.click();
        Alert.alert('Éxito', 'Documento descargado');
      } else {
        Alert.alert('Info', 'Descarga móvil no implementada aún');
      }
    } catch (error) {
      console.error('Error downloading document:', error);
      Alert.alert('Error', 'No se pudo descargar el documento');
    }
  };

  const handleMarkDocumentReviewed = async (docId: string, reviewed: boolean) => {
    try {
      await api.patch(`/admin/documents/${docId}/mark-reviewed?reviewed=${reviewed}`);
      Alert.alert('Éxito', `Documento marcado como ${reviewed ? 'revisado' : 'no revisado'}`);
      loadClientData();
    } catch (error) {
      console.error('Error marking document:', error);
      Alert.alert('Error', 'No se pudo actualizar el documento');
    }
  };

  const renderDocumentsTab = () => {
    // Get unique years from documents
    const docYears = [...new Set(documents.map((d: any) => d.tax_year).filter(Boolean))].sort((a: number, b: number) => b - a);
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    const defaultYear = currentMonth <= 4 ? currentYear - 1 : currentYear;
    
    // Ensure we always show at least 3 years including the default
    const allYears: number[] = [...new Set([defaultYear, defaultYear - 1, defaultYear - 2, ...docYears])].sort((a, b) => b - a);
    
    // Filter documents by selected year (null = show all)
    const filteredDocs = adminDocYear 
      ? documents.filter((d: any) => d.tax_year === adminDocYear || (!d.tax_year && adminDocYear === defaultYear))
      : documents;

    return (
      <View style={styles.section}>
        {/* Year filter pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }} contentContainerStyle={{ gap: 8 }}>
          <TouchableOpacity
            style={[styles.yearPill, !adminDocYear && styles.yearPillActive]}
            onPress={() => setAdminDocYear(null)}
          >
            <Text style={[styles.yearPillText, !adminDocYear && styles.yearPillTextActive]}>Todos ({documents.length})</Text>
          </TouchableOpacity>
          {allYears.map((year) => {
            const count = documents.filter((d: any) => d.tax_year === year || (!d.tax_year && year === defaultYear)).length;
            return (
              <TouchableOpacity
                key={year}
                style={[styles.yearPill, adminDocYear === year && styles.yearPillActive]}
                onPress={() => setAdminDocYear(year)}
              >
                <Ionicons name="calendar-outline" size={12} color={adminDocYear === year ? '#FFF' : colors.textGray} />
                <Text style={[styles.yearPillText, adminDocYear === year && styles.yearPillTextActive]}>{year} ({count})</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {filteredDocs.length === 0 ? (
          <Text style={styles.emptyText}>{adminDocYear ? `Sin documentos para ${adminDocYear}` : 'Sin documentos'}</Text>
        ) : (
          filteredDocs.map((doc: any) => (
            <View key={doc.id} style={styles.documentItemCard}>
              <View style={styles.documentItemLeft}>
                <Ionicons name="document" size={20} color={colors.accent} />
                <View style={styles.documentItemInfo}>
                  <Text style={styles.listItemTitle} numberOfLines={1}>{doc.name}</Text>
                  <Text style={styles.listItemSubtitle}>
                    {doc.category} • {format(new Date(doc.uploaded_at), 'dd MMM yyyy', { locale: es })}
                    {doc.tax_year ? ` • Año ${doc.tax_year}` : ''}
                  </Text>
                  {doc.reviewed && (
                    <View style={styles.reviewedBadgeSmall}>
                      <Ionicons name="checkmark-circle" size={12} color={colors.success} />
                      <Text style={styles.reviewedBadgeText}>Revisado</Text>
                    </View>
                  )}
                </View>
              </View>
              <View style={styles.documentItemActions}>
                {doc.reviewed ? (
                  <TouchableOpacity
                    style={styles.documentActionButton}
                    onPress={() => handleMarkDocumentReviewed(doc.id, false)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="close-circle-outline" size={22} color={colors.textGray} />
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={styles.documentActionButton}
                    onPress={() => handleMarkDocumentReviewed(doc.id, true)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="checkmark-circle-outline" size={22} color={colors.primary} />
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={styles.documentActionButton}
                  onPress={() => handleDownloadDocument(doc)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="download-outline" size={20} color={colors.accent} />
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </View>
    );
  };

  const renderAppointmentsTab = () => (
    <View style={styles.section}>
      {appointments.length === 0 ? (
        <Text style={styles.emptyText}>Sin citas programadas</Text>
      ) : (
        appointments.map((appt: any) => (
          <View key={appt.id} style={styles.listItem}>
            <Ionicons name="calendar" size={20} color={colors.warning} />
            <View style={styles.listItemContent}>
              <Text style={styles.listItemTitle}>{appt.title}</Text>
              <Text style={styles.listItemSubtitle}>
                {format(new Date(appt.scheduled_at), "dd MMM yyyy 'a las' HH:mm", { locale: es })}
              </Text>
            </View>
            <View style={[styles.miniStatusBadge, { backgroundColor: colors.accent + '20' }]}>
              <Text style={[styles.miniStatusText, { color: colors.accent }]}>{appt.status}</Text>
            </View>
          </View>
        ))
      )}
    </View>
  );

  const renderActionsTab = () => (
    <View style={styles.actionsContainer}>
      <TouchableOpacity
        style={styles.actionButton}
        onPress={() => setShowRequestDocsModal(true)}
      >
        <View style={[styles.actionIconContainer, { backgroundColor: colors.primary + '15' }]}>
          <Ionicons name="document-text" size={24} color={colors.primary} />
        </View>
        <View style={styles.actionTextContainer}>
          <Text style={styles.actionTitle}>Solicitar Documentos</Text>
          <Text style={styles.actionDescription}>Enviar solicitud de documentos al cliente</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textGray} />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.actionButton}
        onPress={() => setShowAddNoteModal(true)}
      >
        <View style={[styles.actionIconContainer, { backgroundColor: colors.accent + '15' }]}>
          <Ionicons name="clipboard" size={24} color={colors.accent} />
        </View>
        <View style={styles.actionTextContainer}>
          <Text style={styles.actionTitle}>Agregar Nota</Text>
          <Text style={styles.actionDescription}>Añadir nota interna sobre el cliente</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textGray} />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.actionButton}
        onPress={() => router.push(`/_adminScreens/upload-return?userId=${id}&userName=${encodeURIComponent(user.name)}`)}
      >
        <View style={[styles.actionIconContainer, { backgroundColor: colors.success + '15' }]}>
          <Ionicons name="cloud-upload" size={24} color={colors.success} />
        </View>
        <View style={styles.actionTextContainer}>
          <Text style={styles.actionTitle}>Subir Declaración</Text>
          <Text style={styles.actionDescription}>Cargar nueva declaración de impuestos</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textGray} />
      </TouchableOpacity>

      {/* Delete Client Button */}
      <TouchableOpacity
        style={[styles.actionButton, styles.deleteActionButton]}
        onPress={handleDeleteClient}
        disabled={deleting}
      >
        <View style={[styles.actionIconContainer, { backgroundColor: '#ef444415' }]}>
          {deleting ? (
            <ActivityIndicator size="small" color="#ef4444" />
          ) : (
            <Ionicons name="trash-outline" size={24} color="#ef4444" />
          )}
        </View>
        <View style={styles.actionTextContainer}>
          <Text style={[styles.actionTitle, { color: '#ef4444' }]}>Eliminar Cliente</Text>
          <Text style={styles.actionDescription}>Eliminar permanentemente este cliente y sus datos</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#ef4444" />
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header with Gradient - extends to top */}
      <LinearGradient
        colors={[colors.primary, colors.secondary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerGradient}
      >
        <SafeAreaView edges={['top']}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={24} color={colors.textWhite} />
          </TouchableOpacity>
        </SafeAreaView>
        
        <View style={styles.headerContent}>
          <View style={styles.avatarContainer}>
            <LinearGradient
              colors={['rgba(255,255,255,0.3)', 'rgba(255,255,255,0.1)']}
              style={styles.avatarLarge}
            >
              {user.profile_picture ? (
                <Image source={{ uri: user.profile_picture }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarText}>{user.name.charAt(0).toUpperCase()}</Text>
              )}
            </LinearGradient>
          </View>
          <View style={styles.nameRow}>
            <Text style={styles.userName}>{user.name}</Text>
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => setShowEditProfileModal(true)}
            >
              <Ionicons name="create-outline" size={20} color={colors.background} />
            </TouchableOpacity>
          </View>
          <Text style={styles.userEmail}>{user.email}</Text>
          {user.phone && (
            <View style={styles.phoneRow}>
              <Ionicons name="call" size={14} color="rgba(255,255,255,0.9)" />
              <Text style={styles.userPhone}>{user.phone}</Text>
            </View>
          )}
          <Text style={styles.joinedText}>
            Miembro desde {format(new Date(user.created_at), 'dd MMM yyyy', { locale: es })}
          </Text>
        </View>
      </LinearGradient>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <SegmentedControl
          values={['General', 'Timeline', 'Documentos', 'Citas', 'Acciones']}
          selectedIndex={selectedTab}
          onChange={(event) => {
            setSelectedTab(event.nativeEvent.selectedSegmentIndex);
          }}
          style={styles.segmentedControl}
          tintColor={colors.primary}
          fontStyle={{ fontSize: 13, fontWeight: '600' }}
          activeFontStyle={{ fontSize: 13, fontWeight: '700' }}
        />
      </View>

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        showsVerticalScrollIndicator={false}
      >
        {selectedTab === 0 && renderOverviewTab()}
        {selectedTab === 1 && renderTimelineTab()}
        {selectedTab === 2 && renderDocumentsTab()}
        {selectedTab === 3 && renderAppointmentsTab()}
        {selectedTab === 4 && renderActionsTab()}
      </ScrollView>

      {/* Modals */}
      <RequestDocumentsModal
        visible={showRequestDocsModal}
        onClose={() => setShowRequestDocsModal(false)}
        clientId={id as string}
        clientName={user.name}
        onSuccess={() => loadClientData()}
      />

      <AddNoteModal
        visible={showAddNoteModal}
        onClose={() => setShowAddNoteModal(false)}
        clientId={id as string}
        clientName={user.name}
        onSuccess={() => loadClientData()}
      />

      <EditClientProfileModal
        visible={showEditProfileModal}
        onClose={() => setShowEditProfileModal(false)}
        clientData={user}
        onSuccess={() => loadClientData()}
      />
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundGray,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerGradient: {
    paddingBottom: 24,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    ...Platform.select({
      web: {
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)',
      },
      default: {
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 15,
      },
    }),
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  headerContent: {
    alignItems: 'center',
  },
  avatarContainer: {
    marginBottom: 12,
  },
  avatarLarge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  avatarImage: {
    width: 74,
    height: 74,
    borderRadius: 37,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.textWhite,
  },
  userName: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textWhite,
    marginBottom: 4,
    textAlign: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 4,
  },
  editButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userEmail: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.9)',
    marginBottom: 8,
    textAlign: 'center',
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  userPhone: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
  },
  joinedText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
  },
  tabsContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: colors.background,
  },
  segmentedControl: {
    height: 36,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  verifyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.success,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  verifyButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textWhite,
  },
  kycCard: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 16,
  },
  kycRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  kycLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textGray,
  },
  kycValue: {
    fontSize: 14,
    color: colors.text,
  },
  kycValueMultiline: {
    fontSize: 14,
    color: colors.text,
    textAlign: 'right',
    flex: 1,
    marginLeft: 12,
  },
  kycDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 12,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusComplete: {
    backgroundColor: colors.success + '20',
  },
  statusPending: {
    backgroundColor: colors.warning + '20',
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  statBox: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textGray,
    marginTop: 4,
  },
  timelineContainer: {
    flex: 1,
    minHeight: 300,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  listItemContent: {
    flex: 1,
    marginLeft: 12,
  },
  listItemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 2,
  },
  listItemSubtitle: {
    fontSize: 12,
    color: colors.textGray,
  },
  miniStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  miniStatusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  refundAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.success,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textGray,
    textAlign: 'center',
    paddingVertical: 40,
    backgroundColor: colors.background,
    borderRadius: 12,
  },
  actionsContainer: {
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  deleteActionButton: {
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#ef444430',
    backgroundColor: '#ef444408',
  },
  actionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionTextContainer: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  actionDescription: {
    fontSize: 13,
    color: colors.textGray,
  },
  documentItemCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  documentItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  documentItemInfo: {
    flex: 1,
  },
  documentItemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  documentActionButton: {
    padding: 4,
  },
  reviewedBadgeSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  reviewedBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.success,
  },
  // Year filter pills
  yearPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  yearPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  yearPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textGray,
  },
  yearPillTextActive: {
    color: '#FFF',
  },
});