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
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import api from '../../services/api';

interface Motion {
  id: string;
  motion_number: string;
  motion_type: string;
  motion_type_label: string;
  status: string;
  status_label: string;
  client_id: string;
  client_name: string;
  client_email: string;
  client_phone: string;
  current_address: string;
  a_number: string | null;
  current_court: string | null;
  new_address: string | null;
  destination_court: string | null;
  notes: string | null;
  admin_notes: string | null;
  priority: string;
  deadline: string | null;
  required_documents: RequiredDocument[];
  uploaded_documents: UploadedDocument[];
  status_history: StatusHistoryEntry[];
  created_at: string;
  created_by: string;
  created_by_name: string;
  updated_at: string | null;
  submitted_at: string | null;
  resolved_at: string | null;
}

interface RequiredDocument {
  document_type: string;
  name: string;
  description: string;
  required: boolean;
  uploaded: boolean;
  file_url: string | null;
  file_name: string | null;
  uploaded_at: string | null;
}

interface UploadedDocument {
  id: string;
  document_type: string;
  name: string;
  file_url: string;
  file_name: string;
  uploaded_by: string;
  uploaded_by_name: string;
  uploaded_at: string;
  verified: boolean;
  verified_by: string | null;
  verified_at: string | null;
}

interface StatusHistoryEntry {
  status: string;
  changed_at: string;
  changed_by: string;
  changed_by_name: string;
  notes: string | null;
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

const STATUS_OPTIONS = [
  { value: 'new', label: 'Nuevo Caso' },
  { value: 'in_review', label: 'En Revisión' },
  { value: 'drafting', label: 'Redactando Moción' },
  { value: 'legal_review', label: 'Revisión Legal' },
  { value: 'submitted', label: 'Presentada' },
  { value: 'awaiting_response', label: 'En Espera de Respuesta' },
  { value: 'approved', label: 'Aprobada' },
  { value: 'denied', label: 'Denegada' },
  { value: 'cancelled', label: 'Cancelada' },
];

export default function MotionDetailsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  
  const [motion, setMotion] = useState<Motion | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedDocType, setSelectedDocType] = useState<string | null>(null);
  const [adminNotes, setAdminNotes] = useState('');

  const loadMotion = useCallback(async () => {
    if (!id) return;
    
    try {
      const response = await api.get(`/motions/admin/${id}`);
      setMotion(response.data);
      setAdminNotes(response.data.admin_notes || '');
    } catch (error) {
      console.error('Error loading motion:', error);
      Alert.alert('Error', 'No se pudo cargar la moción');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    loadMotion();
  }, [loadMotion]);

  const onRefresh = () => {
    setRefreshing(true);
    loadMotion();
  };

  const handleUpdateStatus = async (newStatus: string) => {
    if (!motion) return;
    
    setUpdating(true);
    try {
      await api.put(`/motions/admin/${motion.id}`, {
        status: newStatus,
      });
      Alert.alert('Éxito', 'Estado actualizado correctamente');
      setShowStatusModal(false);
      loadMotion();
    } catch (error) {
      console.error('Error updating status:', error);
      Alert.alert('Error', 'No se pudo actualizar el estado');
    } finally {
      setUpdating(false);
    }
  };

  const handleSaveNotes = async () => {
    if (!motion) return;
    
    setUpdating(true);
    try {
      await api.put(`/motions/admin/${motion.id}`, {
        admin_notes: adminNotes,
      });
      Alert.alert('Éxito', 'Notas guardadas correctamente');
      loadMotion();
    } catch (error) {
      console.error('Error saving notes:', error);
      Alert.alert('Error', 'No se pudieron guardar las notas');
    } finally {
      setUpdating(false);
    }
  };

  const handleUploadDocument = async () => {
    if (!motion || !selectedDocType) return;
    
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });
      
      if (result.canceled || !result.assets?.[0]) {
        return;
      }
      
      const file = result.assets[0];
      
      setUploading(true);
      setShowUploadModal(false);
      
      const formData = new FormData();
      formData.append('document_type', selectedDocType);
      formData.append('file', {
        uri: file.uri,
        name: file.name,
        type: file.mimeType || 'application/octet-stream',
      } as any);
      
      await api.post(`/motions/admin/${motion.id}/document`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      Alert.alert('Éxito', 'Documento subido correctamente');
      loadMotion();
    } catch (error) {
      console.error('Error uploading document:', error);
      Alert.alert('Error', 'No se pudo subir el documento');
    } finally {
      setUploading(false);
      setSelectedDocType(null);
    }
  };

  const handleVerifyDocument = async (documentId: string) => {
    if (!motion) return;
    
    Alert.alert(
      'Verificar Documento',
      '¿Confirmar que el documento es válido?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Verificar',
          onPress: async () => {
            try {
              await api.post(`/motions/admin/${motion.id}/document/${documentId}/verify`);
              Alert.alert('Éxito', 'Documento verificado');
              loadMotion();
            } catch (error) {
              console.error('Error verifying document:', error);
              Alert.alert('Error', 'No se pudo verificar el documento');
            }
          },
        },
      ]
    );
  };

  const handleDeleteDocument = async (documentId: string) => {
    if (!motion) return;
    
    Alert.alert(
      'Eliminar Documento',
      '¿Estás seguro de eliminar este documento?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/motions/admin/${motion.id}/document/${documentId}`);
              Alert.alert('Éxito', 'Documento eliminado');
              loadMotion();
            } catch (error) {
              console.error('Error deleting document:', error);
              Alert.alert('Error', 'No se pudo eliminar el documento');
            }
          },
        },
      ]
    );
  };

  const handleViewDocument = async (fileUrl: string) => {
    try {
      const fullUrl = `${api.defaults.baseURL}${fileUrl}`;
      await Linking.openURL(fullUrl);
    } catch (error) {
      console.error('Error opening document:', error);
      Alert.alert('Error', 'No se pudo abrir el documento');
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6C1110" />
          <Text style={styles.loadingText}>Cargando moción...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!motion) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Ionicons name="alert-circle" size={64} color="#EF4444" />
          <Text style={styles.loadingText}>Moción no encontrada</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Volver</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const requiredDocsComplete = motion.required_documents.filter(d => d.required).every(d => d.uploaded);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{motion.motion_number}</Text>
          <Text style={styles.headerSubtitle}>{motion.motion_type_label}</Text>
        </View>
        <TouchableOpacity onPress={() => setShowStatusModal(true)}>
          <View style={[styles.statusBadgeLarge, { backgroundColor: STATUS_COLORS[motion.status] || '#6B7280' }]}>
            <Text style={styles.statusTextLarge}>{motion.status_label}</Text>
          </View>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#6C1110']} />
        }
      >
        {/* Client Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Información del Cliente</Text>
          <View style={styles.card}>
            <View style={styles.infoRow}>
              <Ionicons name="person" size={18} color="#6B7280" />
              <Text style={styles.infoLabel}>Nombre:</Text>
              <Text style={styles.infoValue}>{motion.client_name}</Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="mail" size={18} color="#6B7280" />
              <Text style={styles.infoLabel}>Email:</Text>
              <Text style={styles.infoValue}>{motion.client_email || '-'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="call" size={18} color="#6B7280" />
              <Text style={styles.infoLabel}>Teléfono:</Text>
              <Text style={styles.infoValue}>{motion.client_phone || '-'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="location" size={18} color="#6B7280" />
              <Text style={styles.infoLabel}>Dirección:</Text>
              <Text style={[styles.infoValue, { flex: 1 }]}>{motion.current_address}</Text>
            </View>
          </View>
        </View>

        {/* Case Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Información del Caso</Text>
          <View style={styles.card}>
            <View style={styles.infoRow}>
              <Ionicons name="document-text" size={18} color="#6B7280" />
              <Text style={styles.infoLabel}>A-Number:</Text>
              <Text style={styles.infoValue}>{motion.a_number || '-'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="business" size={18} color="#6B7280" />
              <Text style={styles.infoLabel}>Tribunal Actual:</Text>
              <Text style={styles.infoValue}>{motion.current_court || '-'}</Text>
            </View>
            {motion.motion_type === 'court_transfer' && (
              <>
                <View style={styles.infoRow}>
                  <Ionicons name="location" size={18} color="#6B7280" />
                  <Text style={styles.infoLabel}>Nueva Dirección:</Text>
                  <Text style={[styles.infoValue, { flex: 1 }]}>{motion.new_address || '-'}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Ionicons name="business" size={18} color="#6B7280" />
                  <Text style={styles.infoLabel}>Tribunal Destino:</Text>
                  <Text style={styles.infoValue}>{motion.destination_court || '-'}</Text>
                </View>
              </>
            )}
          </View>
        </View>

        {/* Documents */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Documentos Requeridos</Text>
            {!requiredDocsComplete && (
              <View style={styles.warningBadge}>
                <Ionicons name="warning" size={14} color="#F59E0B" />
                <Text style={styles.warningText}>Incompleto</Text>
              </View>
            )}
          </View>
          
          {motion.required_documents.map((doc, index) => (
            <View key={index} style={styles.documentCard}>
              <View style={styles.documentHeader}>
                <View style={styles.documentInfo}>
                  <View style={[styles.documentIcon, { backgroundColor: doc.uploaded ? '#10B98120' : '#EF444420' }]}>
                    <Ionicons
                      name={doc.uploaded ? 'checkmark-circle' : 'document-outline'}
                      size={20}
                      color={doc.uploaded ? '#10B981' : '#EF4444'}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.documentName}>{doc.name}</Text>
                    <Text style={styles.documentDesc}>{doc.description}</Text>
                    {doc.required && <Text style={styles.requiredTag}>Requerido</Text>}
                  </View>
                </View>
                
                {!doc.uploaded && (
                  <TouchableOpacity
                    style={styles.uploadButton}
                    onPress={() => {
                      setSelectedDocType(doc.document_type);
                      setShowUploadModal(true);
                    }}
                  >
                    <Ionicons name="cloud-upload" size={18} color="#fff" />
                  </TouchableOpacity>
                )}
              </View>
              
              {doc.uploaded && doc.file_url && (
                <View style={styles.uploadedInfo}>
                  <Text style={styles.uploadedText}>Archivo: {doc.file_name}</Text>
                  <Text style={styles.uploadedDate}>Subido: {formatDate(doc.uploaded_at)}</Text>
                </View>
              )}
            </View>
          ))}
        </View>

        {/* Uploaded Documents */}
        {motion.uploaded_documents.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Documentos Subidos</Text>
            
            {motion.uploaded_documents.map((doc) => (
              <View key={doc.id} style={styles.uploadedDocCard}>
                <View style={styles.uploadedDocHeader}>
                  <View style={styles.uploadedDocInfo}>
                    <Ionicons name="document" size={24} color="#6C1110" />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.uploadedDocName}>{doc.file_name}</Text>
                      <Text style={styles.uploadedDocMeta}>
                        Por: {doc.uploaded_by_name} • {formatDate(doc.uploaded_at)}
                      </Text>
                      {doc.verified && (
                        <View style={styles.verifiedBadge}>
                          <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                          <Text style={styles.verifiedText}>Verificado</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  
                  <View style={styles.docActions}>
                    <TouchableOpacity
                      style={styles.docActionButton}
                      onPress={() => handleViewDocument(doc.file_url)}
                    >
                      <Ionicons name="eye" size={18} color="#3B82F6" />
                    </TouchableOpacity>
                    {!doc.verified && (
                      <TouchableOpacity
                        style={styles.docActionButton}
                        onPress={() => handleVerifyDocument(doc.id)}
                      >
                        <Ionicons name="checkmark" size={18} color="#10B981" />
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={styles.docActionButton}
                      onPress={() => handleDeleteDocument(doc.id)}
                    >
                      <Ionicons name="trash" size={18} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Admin Notes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notas del Administrador</Text>
          <View style={styles.card}>
            <TextInput
              style={styles.notesInput}
              value={adminNotes}
              onChangeText={setAdminNotes}
              placeholder="Agregar notas internas sobre este caso..."
              multiline
              numberOfLines={4}
            />
            <TouchableOpacity
              style={[styles.saveNotesButton, updating && styles.buttonDisabled]}
              onPress={handleSaveNotes}
              disabled={updating}
            >
              {updating ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="save" size={18} color="#fff" />
                  <Text style={styles.saveNotesText}>Guardar Notas</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Status History */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Historial de Estados</Text>
          <View style={styles.card}>
            {motion.status_history.map((entry, index) => (
              <View key={index} style={styles.historyEntry}>
                <View style={[styles.historyDot, { backgroundColor: STATUS_COLORS[entry.status] || '#6B7280' }]} />
                <View style={styles.historyContent}>
                  <Text style={styles.historyStatus}>{entry.notes || entry.status}</Text>
                  <Text style={styles.historyMeta}>
                    {entry.changed_by_name} • {formatDate(entry.changed_at)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Status Change Modal */}
      <Modal
        visible={showStatusModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowStatusModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowStatusModal(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Cambiar Estado</Text>
            
            {STATUS_OPTIONS.map((status) => (
              <TouchableOpacity
                key={status.value}
                style={[
                  styles.statusOption,
                  motion.status === status.value && styles.statusOptionActive,
                ]}
                onPress={() => handleUpdateStatus(status.value)}
                disabled={updating}
              >
                <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[status.value] }]} />
                <Text style={[
                  styles.statusOptionText,
                  motion.status === status.value && styles.statusOptionTextActive,
                ]}>
                  {status.label}
                </Text>
                {motion.status === status.value && (
                  <Ionicons name="checkmark" size={20} color="#6C1110" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Upload Modal */}
      <Modal
        visible={showUploadModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowUploadModal(false);
          setSelectedDocType(null);
        }}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => {
            setShowUploadModal(false);
            setSelectedDocType(null);
          }}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Subir Documento</Text>
            <Text style={styles.modalSubtitle}>
              {motion.required_documents.find(d => d.document_type === selectedDocType)?.name}
            </Text>
            
            <TouchableOpacity
              style={styles.uploadModalButton}
              onPress={handleUploadDocument}
            >
              <Ionicons name="cloud-upload" size={24} color="#fff" />
              <Text style={styles.uploadModalButtonText}>Seleccionar Archivo</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => {
                setShowUploadModal(false);
                setSelectedDocType(null);
              }}
            >
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Uploading Overlay */}
      {uploading && (
        <View style={styles.uploadingOverlay}>
          <ActivityIndicator size="large" color="#6C1110" />
          <Text style={styles.uploadingText}>Subiendo documento...</Text>
        </View>
      )}
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
  backButton: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#6C1110',
    borderRadius: 8,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerCenter: {
    flex: 1,
    marginLeft: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#6C1110',
    marginTop: 2,
  },
  statusBadgeLarge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusTextLarge: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  content: {
    flex: 1,
  },
  section: {
    marginTop: 16,
    paddingHorizontal: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 12,
  },
  warningBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  warningText: {
    fontSize: 12,
    color: '#F59E0B',
    marginLeft: 4,
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
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
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 8,
    width: 90,
  },
  infoValue: {
    fontSize: 14,
    color: '#1F2937',
    fontWeight: '500',
  },
  documentCard: {
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
  documentHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  documentInfo: {
    flexDirection: 'row',
    flex: 1,
  },
  documentIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  documentName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
  },
  documentDesc: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  requiredTag: {
    fontSize: 11,
    color: '#EF4444',
    fontWeight: '600',
    marginTop: 4,
  },
  uploadButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#6C1110',
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadedInfo: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  uploadedText: {
    fontSize: 13,
    color: '#1F2937',
  },
  uploadedDate: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  uploadedDocCard: {
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
  uploadedDocHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  uploadedDocInfo: {
    flexDirection: 'row',
    flex: 1,
  },
  uploadedDocName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  uploadedDocMeta: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  verifiedText: {
    fontSize: 12,
    color: '#10B981',
    marginLeft: 4,
    fontWeight: '600',
  },
  docActions: {
    flexDirection: 'row',
    gap: 8,
  },
  docActionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  notesInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#1F2937',
    minHeight: 100,
    textAlignVertical: 'top',
  },
  saveNotesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6C1110',
    borderRadius: 8,
    paddingVertical: 12,
    marginTop: 12,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  saveNotesText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 8,
  },
  historyEntry: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  historyDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 4,
    marginRight: 12,
  },
  historyContent: {
    flex: 1,
  },
  historyStatus: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1F2937',
  },
  historyMeta: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 360,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 20,
    textAlign: 'center',
  },
  statusOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  statusOptionActive: {
    backgroundColor: '#FEF2F2',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 12,
  },
  statusOptionText: {
    fontSize: 15,
    color: '#4B5563',
    flex: 1,
  },
  statusOptionTextActive: {
    color: '#6C1110',
    fontWeight: '600',
  },
  uploadModalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6C1110',
    borderRadius: 12,
    paddingVertical: 16,
    marginBottom: 12,
  },
  uploadModalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 8,
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#6B7280',
  },
  uploadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6C1110',
    fontWeight: '500',
  },
});
