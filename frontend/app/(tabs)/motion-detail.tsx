/**
 * Motion Detail Screen - Client View
 * Shows details of a specific motion and allows document upload
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
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
  client_phone: string;
  current_address: string;
  a_number: string | null;
  notes: string | null;
  required_documents: RequiredDocument[];
  uploaded_documents: UploadedDocument[];
  status_history: StatusHistoryEntry[];
  created_at: string;
  updated_at: string | null;
}

interface RequiredDocument {
  document_type: string;
  name: string;
  description: string;
  required: boolean;
  uploaded: boolean;
  file_url: string | null;
  file_name: string | null;
}

interface UploadedDocument {
  id: string;
  document_type: string;
  name: string;
  file_url: string;
  file_name: string;
  uploaded_at: string;
  verified: boolean;
}

interface StatusHistoryEntry {
  status: string;
  changed_at: string;
  notes: string | null;
}

const STATUS_COLORS: { [key: string]: { bg: string; text: string } } = {
  new: { bg: '#DBEAFE', text: '#1E40AF' },
  in_review: { bg: '#FEF3C7', text: '#92400E' },
  drafting: { bg: '#EDE9FE', text: '#5B21B6' },
  legal_review: { bg: '#FCE7F3', text: '#9D174D' },
  submitted: { bg: '#D1FAE5', text: '#065F46' },
  awaiting_response: { bg: '#E0E7FF', text: '#3730A3' },
  approved: { bg: '#D1FAE5', text: '#065F46' },
  denied: { bg: '#FEE2E2', text: '#991B1B' },
  cancelled: { bg: '#F3F4F6', text: '#374151' },
};

const STATUS_MESSAGES: { [key: string]: string } = {
  new: 'Tu solicitud ha sido recibida y está en cola para revisión.',
  in_review: 'Nuestro equipo está revisando tu solicitud y documentos.',
  drafting: 'Estamos preparando tu moción con los datos proporcionados.',
  legal_review: 'Tu moción está siendo revisada por nuestro equipo legal.',
  submitted: '¡Tu moción ha sido presentada ante el tribunal!',
  awaiting_response: 'Esperando respuesta del tribunal de inmigración.',
  approved: '¡Felicidades! Tu moción ha sido aprobada.',
  denied: 'Lamentablemente, tu moción fue denegada. Contacta a nuestro equipo.',
  cancelled: 'Esta moción ha sido cancelada.',
};

export default function MotionDetailScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  
  const [motion, setMotion] = useState<Motion | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);

  const loadMotion = useCallback(async () => {
    if (!id) return;
    
    try {
      const response = await api.get(`/motions/my-motions/${id}`);
      setMotion(response.data);
    } catch (error) {
      console.error('Error loading motion:', error);
      Alert.alert(t('common.error', 'Error'), t('motionDetail.loadError', 'No se pudo cargar la información de la moción'));
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

  const handleDocumentUpload = async (docType: string) => {
    if (!motion) return;
    
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.[0]) {
        return;
      }

      const file = result.assets[0];
      setUploading(docType);

      const formData = new FormData();
      formData.append('document_type', docType);
      formData.append('file', {
        uri: file.uri,
        name: file.name,
        type: file.mimeType || 'application/octet-stream',
      } as any);

      await api.post(`/motions/my-motions/${motion.id}/document`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      Alert.alert(t('motionDetail.success', 'Éxito'), t('motionDetail.uploadSuccess', 'Documento subido correctamente'));
      loadMotion();
    } catch (error) {
      console.error('Error uploading document:', error);
      Alert.alert(t('common.error', 'Error'), t('motionDetail.uploadError', 'No se pudo subir el documento'));
    } finally {
      setUploading(null);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  };

  const getStatusInfo = (status: string) => {
    return STATUS_COLORS[status] || { bg: '#F3F4F6', text: '#374151' };
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6C1110" />
          <Text style={styles.loadingText}>{t('common.loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!motion) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Ionicons name="alert-circle" size={64} color="#EF4444" />
          <Text style={styles.errorText}>{t('motionDetail.notFound', 'Moción no encontrada')}</Text>
          <TouchableOpacity style={styles.backButtonLarge} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>{t('motionDetail.goBack', 'Volver')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const statusInfo = getStatusInfo(motion.status);
  const pendingDocs = motion.required_documents.filter(d => d.required && !d.uploaded);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{motion.motion_number}</Text>
          <Text style={styles.headerSubtitle}>{motion.motion_type_label}</Text>
        </View>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#6C1110']} />
        }
      >
        {/* Status Card */}
        <View style={[styles.statusCard, { backgroundColor: statusInfo.bg }]}>
          <View style={styles.statusHeader}>
            <View style={styles.statusBadge}>
              <Text style={[styles.statusLabel, { color: statusInfo.text }]}>
                {motion.status_label}
              </Text>
            </View>
          </View>
          <Text style={[styles.statusMessage, { color: statusInfo.text }]}>
            {STATUS_MESSAGES[motion.status] || 'Estado de tu moción'}
          </Text>
        </View>

        {/* Pending Documents Alert */}
        {pendingDocs.length > 0 && (
          <View style={styles.alertCard}>
            <Ionicons name="warning" size={24} color="#F59E0B" />
            <View style={styles.alertContent}>
              <Text style={styles.alertTitle}>Documentos Pendientes</Text>
              <Text style={styles.alertText}>
                Faltan {pendingDocs.length} documento(s) requerido(s) para procesar tu moción.
              </Text>
            </View>
          </View>
        )}

        {/* Documents Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('motionDetail.documents')}</Text>
          <View style={styles.documentsGrid}>
            {motion.required_documents.map((doc) => (
              <View key={doc.document_type} style={styles.documentCard}>
                <View style={styles.documentHeader}>
                  <View style={[
                    styles.documentStatus,
                    doc.uploaded ? styles.documentStatusComplete : styles.documentStatusPending,
                  ]}>
                    <Ionicons
                      name={doc.uploaded ? 'checkmark-circle' : 'ellipse-outline'}
                      size={20}
                      color={doc.uploaded ? '#10B981' : '#9CA3AF'}
                    />
                  </View>
                  <View style={styles.documentInfo}>
                    <Text style={styles.documentName}>
                      {doc.name}
                      {doc.required && <Text style={styles.requiredMark}> *</Text>}
                    </Text>
                    <Text style={styles.documentDesc}>{doc.description}</Text>
                  </View>
                </View>
                
                {!doc.uploaded ? (
                  <TouchableOpacity
                    style={styles.uploadButton}
                    onPress={() => handleDocumentUpload(doc.document_type)}
                    disabled={uploading === doc.document_type}
                  >
                    {uploading === doc.document_type ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Ionicons name="cloud-upload" size={18} color="#fff" />
                        <Text style={styles.uploadButtonText}>{t('motionDetail.upload', 'Subir')}</Text>
                      </>
                    )}
                  </TouchableOpacity>
                ) : (
                  <View style={styles.uploadedBadge}>
                    <Ionicons name="checkmark" size={16} color="#10B981" />
                    <Text style={styles.uploadedText}>{t('motionDetail.uploaded', 'Subido')}</Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        </View>

        {/* Info Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Información de la Solicitud</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Nombre:</Text>
              <Text style={styles.infoValue}>{motion.client_name}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>A-Number:</Text>
              <Text style={styles.infoValue}>{motion.a_number || 'No proporcionado'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Dirección:</Text>
              <Text style={styles.infoValue}>{motion.current_address}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Fecha de Solicitud:</Text>
              <Text style={styles.infoValue}>{formatDate(motion.created_at)}</Text>
            </View>
          </View>
        </View>

        {/* Timeline Section */}
        {motion.status_history.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('motionDetail.history', 'Historial')}</Text>
            <View style={styles.timeline}>
              {motion.status_history.slice().reverse().map((entry, index) => {
                const entryStatus = getStatusInfo(entry.status);
                return (
                  <View key={index} style={styles.timelineItem}>
                    <View style={[styles.timelineDot, { backgroundColor: entryStatus.text }]} />
                    {index < motion.status_history.length - 1 && (
                      <View style={styles.timelineLine} />
                    )}
                    <View style={styles.timelineContent}>
                      <Text style={styles.timelineTitle}>{entry.notes || entry.status}</Text>
                      <Text style={styles.timelineDate}>{formatDate(entry.changed_at)}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Help Section */}
        <View style={styles.helpCard}>
          <Ionicons name="help-buoy" size={32} color="#6C1110" />
          <Text style={styles.helpTitle}>¿Necesitas ayuda?</Text>
          <Text style={styles.helpText}>
            Si tienes preguntas sobre tu moción, nuestro equipo está aquí para ayudarte.
          </Text>
          <TouchableOpacity
            style={styles.contactButton}
            onPress={() => router.push('/(tabs)/support')}
          >
            <Ionicons name="chatbubbles" size={18} color="#fff" />
            <Text style={styles.contactButtonText}>Contactar Soporte</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
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
  errorText: {
    marginTop: 16,
    fontSize: 18,
    color: '#1F2937',
    fontWeight: '600',
  },
  backButtonLarge: {
    marginTop: 24,
    backgroundColor: '#6C1110',
    paddingHorizontal: 24,
    paddingVertical: 12,
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
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 4,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1F2937',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#6C1110',
  },
  content: {
    flex: 1,
  },
  statusCard: {
    margin: 16,
    padding: 20,
    borderRadius: 16,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusBadge: {
    backgroundColor: 'rgba(255,255,255,0.5)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  statusMessage: {
    fontSize: 15,
    lineHeight: 22,
  },
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  alertContent: {
    flex: 1,
  },
  alertTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#92400E',
  },
  alertText: {
    fontSize: 13,
    color: '#B45309',
    marginTop: 2,
  },
  section: {
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 12,
  },
  documentsGrid: {
    gap: 12,
  },
  documentCard: {
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
        elevation: 2,
      },
    }),
  },
  documentHeader: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  documentStatus: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  documentStatusComplete: {
    backgroundColor: '#D1FAE5',
  },
  documentStatusPending: {
    backgroundColor: '#F3F4F6',
  },
  documentInfo: {
    flex: 1,
  },
  documentName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
  },
  requiredMark: {
    color: '#EF4444',
  },
  documentDesc: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6C1110',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  uploadButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  uploadedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D1FAE5',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  uploadedText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10B981',
  },
  infoCard: {
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
        elevation: 2,
      },
    }),
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 14,
    color: '#6B7280',
    width: 120,
  },
  infoValue: {
    fontSize: 14,
    color: '#1F2937',
    flex: 1,
    fontWeight: '500',
  },
  timeline: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
  },
  timelineItem: {
    flexDirection: 'row',
    paddingBottom: 16,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 4,
  },
  timelineLine: {
    position: 'absolute',
    left: 5,
    top: 20,
    bottom: 0,
    width: 2,
    backgroundColor: '#E5E7EB',
  },
  timelineContent: {
    flex: 1,
    marginLeft: 16,
  },
  timelineTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1F2937',
  },
  timelineDate: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  helpCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    padding: 24,
    borderRadius: 16,
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
  helpTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginTop: 12,
  },
  helpText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6C1110',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  contactButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
});
