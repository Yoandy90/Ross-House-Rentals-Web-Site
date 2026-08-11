import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Modal, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../src/contexts/AuthContext';
import { apiCall } from '../src/utils/api';
import { useColors } from '../src/constants/theme';
import SignaturePad from '../src/components/SignaturePad';

interface RoomItem {
  name: string;
  condition: 'excellent' | 'good' | 'fair' | 'poor' | 'na';
  notes: string;
}

interface Room {
  room_name: string;
  items: RoomItem[];
}

interface Inspection {
  _id: string;
  property_name: string;
  property_address: string;
  inspection_type: 'move_in' | 'move_out' | 'routine';
  status: string;
  scheduled_date: string;
  inspector_name?: string;
  general_notes?: string;
  rooms: Room[];
  admin_signature?: string;
  admin_signature_date?: string;
  tenant_signature?: string;
  tenant_comments?: string;
}

const CONDITIONS: Record<string, { label: string; color: string; icon: keyof typeof Ionicons.glyphMap }> = {
  excellent: { label: 'Excelente', color: '#10b981', icon: 'checkmark-circle' },
  good: { label: 'Bueno', color: '#3b82f6', icon: 'thumbs-up' },
  fair: { label: 'Regular', color: '#f59e0b', icon: 'alert-circle' },
  poor: { label: 'Malo', color: '#ef4444', icon: 'close-circle' },
  na: { label: 'N/A', color: '#6b7280', icon: 'remove-circle' },
};

const TYPE_LABELS: Record<string, string> = {
  move_in: 'Inspección Move-In',
  move_out: 'Inspección Move-Out',
  routine: 'Inspección Rutinaria',
};

export default function TenantInspectionSignScreen() {
  const C = useColors();
  const styles = React.useMemo(() => createStyles(C), [C]);
  const router = useRouter();
  const params = useLocalSearchParams();
  const inspectionId = Array.isArray(params.id) ? params.id[0] : params.id;
  const { user } = useAuth();
  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedRoom, setExpandedRoom] = useState<string | null>(null);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [comments, setComments] = useState('');
  const [declineReason, setDeclineReason] = useState('');

  const fetchInspection = useCallback(async () => {
    if (!inspectionId) {
      setLoading(false);
      return;
    }
    try {
      const data = await apiCall(`/tenant/inspections/${inspectionId}`);
      setInspection(data.inspection);
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'No se pudo cargar la inspección');
    } finally {
      setLoading(false);
    }
  }, [inspectionId]);

  useEffect(() => {
    fetchInspection();
  }, [fetchInspection]);

  const handleSign = async (signatureBase64: string) => {
    setSaving(true);
    try {
      const result = await apiCall(`/tenant/inspections/${inspectionId}/sign`, {
        method: 'POST',
        body: {
          signature: signatureBase64,
          comments: comments.trim() || undefined,
        },
      });

      if (result.success !== false) {
        Alert.alert(
          '✅ Inspección Firmada',
          'Tu firma ha sido registrada correctamente.',
          [{ text: 'OK', onPress: () => router.back() }]
        );
      } else {
        Alert.alert('Error', result.detail || 'No se pudo guardar la firma');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Error de conexión');
    } finally {
      setSaving(false);
      setShowSignatureModal(false);
    }
  };

  const handleDecline = async () => {
    if (!declineReason.trim()) {
      Alert.alert('Error', 'Por favor indica el motivo del rechazo');
      return;
    }

    setSaving(true);
    try {
      const result = await apiCall(`/tenant/inspections/${inspectionId}/decline`, {
        method: 'POST',
        body: { reason: declineReason.trim() },
      });

      if (result.success !== false) {
        Alert.alert(
          'Inspección Rechazada',
          'El administrador será notificado de tu objeción.',
          [{ text: 'OK', onPress: () => router.back() }]
        );
      } else {
        Alert.alert('Error', result.detail || 'No se pudo procesar');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Error de conexión');
    } finally {
      setSaving(false);
      setShowDeclineModal(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={C.brandRed} />
      </View>
    );
  }

  if (!inspection) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={{ color: C.textPrimary }}>Inspección no encontrada</Text>
      </View>
    );
  }

  const alreadySigned = !!inspection.tenant_signature;

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={['rgba(200,16,46,0.08)', 'transparent']}
        style={styles.bgGradient}
      />

      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>{TYPE_LABELS[inspection.inspection_type]}</Text>
            <Text style={styles.headerSubtitle}>{inspection.property_name}</Text>
          </View>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Property Info */}
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Ionicons name="location-outline" size={18} color="#888" />
              <Text style={styles.infoText}>{inspection.property_address}</Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="calendar-outline" size={18} color="#888" />
              <Text style={styles.infoText}>
                {new Date(inspection.scheduled_date).toLocaleDateString('es-MX', {
                  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
                })}
              </Text>
            </View>
            {inspection.inspector_name && (
              <View style={styles.infoRow}>
                <Ionicons name="person-outline" size={18} color="#888" />
                <Text style={styles.infoText}>Inspector: {inspection.inspector_name}</Text>
              </View>
            )}
          </View>

          {/* Signature Status */}
          <View style={styles.signatureCard}>
            <Text style={styles.sectionTitle}>Estado de Firmas</Text>
            <View style={styles.signatureRow}>
              <View style={styles.signatureItem}>
                <Ionicons
                  name={inspection.admin_signature ? 'checkmark-circle' : 'ellipse-outline'}
                  size={24}
                  color={inspection.admin_signature ? '#10b981' : '#444'}
                />
                <Text style={styles.signatureLabel}>Administrador</Text>
                {inspection.admin_signature_date && (
                  <Text style={styles.signatureDate}>
                    {new Date(inspection.admin_signature_date).toLocaleDateString('es-MX')}
                  </Text>
                )}
              </View>
              <View style={styles.signatureDivider} />
              <View style={styles.signatureItem}>
                <Ionicons
                  name={inspection.tenant_signature ? 'checkmark-circle' : 'ellipse-outline'}
                  size={24}
                  color={inspection.tenant_signature ? '#10b981' : '#ec4899'}
                />
                <Text style={styles.signatureLabel}>
                  {alreadySigned ? 'Tu Firma' : 'Pendiente'}
                </Text>
              </View>
            </View>
          </View>

          {/* Rooms Checklist */}
          <Text style={styles.sectionTitle}>Detalle de Inspección</Text>
          {(inspection.rooms || []).map((room, idx) => (
            <View key={idx} style={styles.roomCard}>
              <TouchableOpacity
                style={styles.roomHeader}
                onPress={() => setExpandedRoom(expandedRoom === room.room_name ? null : room.room_name)}
              >
                <Text style={styles.roomName}>{room.room_name}</Text>
                <Ionicons
                  name={expandedRoom === room.room_name ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color="#888"
                />
              </TouchableOpacity>

              {expandedRoom === room.room_name && (
                <View style={styles.roomItems}>
                  {(room.items || []).map((item, iIdx) => {
                    const cond = CONDITIONS[item.condition] || CONDITIONS.na;
                    return (
                      <View key={iIdx} style={styles.itemRow}>
                        <Text style={styles.itemName}>{item.name}</Text>
                        <View style={[styles.conditionBadge, { backgroundColor: `${cond.color}20` }]}>
                          <Ionicons name={cond.icon} size={14} color={cond.color} />
                          <Text style={[styles.conditionText, { color: cond.color }]}>
                            {cond.label}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          ))}

          {/* General Notes */}
          {inspection.general_notes && (
            <View style={styles.notesCard}>
              <Text style={styles.notesTitle}>Notas del Inspector</Text>
              <Text style={styles.notesText}>{inspection.general_notes}</Text>
            </View>
          )}

          {/* Comments Input (if not signed yet) */}
          {!alreadySigned && (
            <View style={styles.commentsSection}>
              <Text style={styles.commentsTitle}>Agregar Comentarios (Opcional)</Text>
              <TextInput
                style={styles.commentsInput}
                placeholder="Escribe cualquier observación o desacuerdo..."
                placeholderTextColor="#666"
                multiline
                numberOfLines={3}
                value={comments}
                onChangeText={setComments}
              />
            </View>
          )}

          <View style={{ height: 120 }} />
        </ScrollView>

        {/* Action Buttons */}
        {!alreadySigned && (
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.declineBtn}
              onPress={() => setShowDeclineModal(true)}
            >
              <Ionicons name="close-circle-outline" size={20} color="#ef4444" />
              <Text style={styles.declineBtnText}>Rechazar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.signBtn}
              onPress={() => setShowSignatureModal(true)}
            >
              <Ionicons name="create-outline" size={20} color="#fff" />
              <Text style={styles.signBtnText}>Firmar Inspección</Text>
            </TouchableOpacity>
          </View>
        )}

        {alreadySigned && (
          <View style={styles.footer}>
            <View style={styles.signedBadge}>
              <Ionicons name="checkmark-circle" size={24} color="#10b981" />
              <Text style={styles.signedText}>Ya has firmado esta inspección</Text>
            </View>
          </View>
        )}
      </SafeAreaView>

      {/* Signature Modal */}
      <Modal visible={showSignatureModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.signatureModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Firma Digital</Text>
              <TouchableOpacity onPress={() => setShowSignatureModal(false)}>
                <Ionicons name="close" size={24} color="#888" />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSubtitle}>
              Firma en el recuadro para confirmar que revisaste la inspección
            </Text>
            <SignaturePad
              onSave={handleSign}
              onClear={() => {}}
            />
            {saving && (
              <View style={styles.savingOverlay}>
                <ActivityIndicator size="large" color="#ec4899" />
                <Text style={styles.savingText}>Guardando firma...</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Decline Modal */}
      <Modal visible={showDeclineModal} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.declineModal}>
            <Text style={styles.modalTitle}>Rechazar Inspección</Text>
            <Text style={styles.declineInfo}>
              Por favor indica el motivo por el cual no estás de acuerdo con esta inspección.
              El administrador será notificado.
            </Text>
            <TextInput
              style={styles.declineInput}
              placeholder="Describe tu objeción..."
              placeholderTextColor="#666"
              multiline
              numberOfLines={4}
              value={declineReason}
              onChangeText={setDeclineReason}
            />
            <View style={styles.declineActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setShowDeclineModal(false)}
              >
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmDeclineBtn}
                onPress={handleDecline}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.confirmDeclineBtnText}>Confirmar Rechazo</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (C: any) => StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0e15' },
  bgGradient: { ...StyleSheet.absoluteFillObject },
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0e15' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: C.glassLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: C.textPrimary },
  headerSubtitle: { fontSize: 14, color: '#888', marginTop: 2 },

  scrollView: { flex: 1 },
  content: { paddingHorizontal: 16 },

  infoCard: {
    backgroundColor: C.glass,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    gap: 10,
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  infoText: { fontSize: 14, color: '#ccc', flex: 1 },

  signatureCard: {
    backgroundColor: C.glass,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: C.textPrimary, marginBottom: 12 },
  signatureRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  signatureItem: { alignItems: 'center', gap: 6 },
  signatureLabel: { fontSize: 13, color: '#aaa' },
  signatureDate: { fontSize: 11, color: '#666' },
  signatureDivider: { width: 1, height: 40, backgroundColor: 'rgba(255,255,255,0.1)' },

  roomCard: {
    backgroundColor: C.glass,
    borderRadius: 12,
    marginBottom: 10,
    overflow: 'hidden',
  },
  roomHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
  },
  roomName: { fontSize: 15, fontWeight: '600', color: C.textPrimary },
  roomItems: {
    borderTopWidth: 1,
    borderTopColor: C.glassBorder,
    padding: 12,
    gap: 8,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemName: { fontSize: 14, color: '#aaa' },
  conditionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  conditionText: { fontSize: 12, fontWeight: '600' },

  notesCard: {
    backgroundColor: C.glass,
    borderRadius: 12,
    padding: 14,
    marginTop: 10,
  },
  notesTitle: { fontSize: 14, fontWeight: '600', color: C.textPrimary, marginBottom: 8 },
  notesText: { fontSize: 14, color: '#aaa', lineHeight: 20 },

  commentsSection: { marginTop: 16 },
  commentsTitle: { fontSize: 14, fontWeight: '600', color: C.textPrimary, marginBottom: 8 },
  commentsInput: {
    backgroundColor: C.glassLight,
    borderRadius: 12,
    padding: 14,
    color: C.textPrimary,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: 'top',
  },

  footer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
    backgroundColor: 'rgba(10,14,21,0.95)',
    borderTopWidth: 1,
    borderTopColor: C.glassBorder,
  },
  declineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
  },
  declineBtnText: { fontSize: 15, fontWeight: '600', color: '#ef4444' },
  signBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#ec4899',
  },
  signBtnText: { fontSize: 15, fontWeight: '700', color: C.textPrimary },

  signedBadge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
    backgroundColor: 'rgba(16,185,129,0.1)',
    borderRadius: 12,
  },
  signedText: { fontSize: 15, fontWeight: '600', color: '#10b981' },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  signatureModal: {
    backgroundColor: C.surfaceLight,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: C.textPrimary },
  modalSubtitle: { fontSize: 14, color: C.textMuted, marginBottom: 16 },

  savingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 24,
  },
  savingText: { fontSize: 14, color: C.textPrimary, marginTop: 10 },

  declineModal: {
    backgroundColor: C.surfaceLight,
    margin: 20,
    borderRadius: 20,
    padding: 20,
  },
  declineInfo: { fontSize: 14, color: C.textMuted, marginTop: 8, marginBottom: 16, lineHeight: 20 },
  declineInput: {
    backgroundColor: C.glassLight,
    borderRadius: 12,
    padding: 14,
    color: C.textPrimary,
    fontSize: 14,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  declineActions: { flexDirection: 'row', gap: 12 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: C.glassLight,
    alignItems: 'center',
  },
  cancelBtnText: { fontSize: 15, fontWeight: '600', color: '#aaa' },
  confirmDeclineBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#ef4444',
    alignItems: 'center',
  },
  confirmDeclineBtnText: { fontSize: 15, fontWeight: '700', color: C.textPrimary },
});
