import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Modal, TextInput, Image, Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../src/contexts/AuthContext';
import { apiCall } from '../src/utils/api';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import SignaturePad from '../src/components/SignaturePad';
import { useColors } from '../src/constants/theme';

interface RoomItem {
  name: string;
  condition: 'excellent' | 'good' | 'fair' | 'poor' | 'na';
  notes: string;
  photos: string[];
}

interface Room {
  room_name: string;
  items: RoomItem[];
}

interface Inspection {
  _id: string;
  property_id: string;
  property_name: string;
  property_address: string;
  tenant_id: string;
  tenant_name: string;
  tenant_email: string;
  inspection_type: 'move_in' | 'move_out' | 'routine';
  status: 'pending' | 'in_progress' | 'completed' | 'pending_signature' | 'disputed';
  scheduled_date: string;
  inspector_name: string;
  notes: string;
  rooms: Room[];
  admin_signature?: string;
  admin_signature_date?: string;
  tenant_signature?: string;
  tenant_signature_date?: string;
  pending_tenant_signature?: boolean;
}

const ROOMS = [
  { id: 'living_room', name: 'Sala', icon: 'tv-outline' },
  { id: 'kitchen', name: 'Cocina', icon: 'restaurant-outline' },
  { id: 'bathroom', name: 'Baño', icon: 'water-outline' },
  { id: 'bedroom_1', name: 'Recámara Principal', icon: 'bed-outline' },
  { id: 'bedroom_2', name: 'Recámara 2', icon: 'bed-outline' },
  { id: 'garage', name: 'Garage', icon: 'car-outline' },
  { id: 'exterior', name: 'Exterior', icon: 'home-outline' },
];

const ITEMS = [
  'Paredes', 'Piso', 'Techo', 'Ventanas', 'Puertas', 
  'Iluminación', 'Enchufes', 'Gabinetes', 'Limpieza General',
];

const CONDITIONS = {
  excellent: { label: 'Excelente', color: '#10b981', icon: 'checkmark-circle' },
  good: { label: 'Bueno', color: '#3b82f6', icon: 'thumbs-up' },
  fair: { label: 'Regular', color: '#f59e0b', icon: 'alert-circle' },
  poor: { label: 'Malo', color: '#ef4444', icon: 'close-circle' },
  na: { label: 'N/A', color: '#6b7280', icon: 'remove-circle' },
};

export default function AdminInspectionDetailScreen() {
  const C = useColors();
  const styles = React.useMemo(() => create_styles(C), [C]);
  const router = useRouter();
  const params = useLocalSearchParams();
  const inspectionId = Array.isArray(params.id) ? params.id[0] : params.id;
  const { user } = useAuth();
  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedRoom, setExpandedRoom] = useState<string | null>(null);
  const [showSignatureModal, setShowSignatureModal] = useState<'admin' | 'tenant' | null>(null);
  const [localRooms, setLocalRooms] = useState<Room[]>([]);

  const isAdmin = user?.role === 'admin';

  const fetchInspection = useCallback(async () => {
    if (!inspectionId) {
      setLoading(false);
      return;
    }
    try {
      const data = await apiCall(`/admin/inspections/${inspectionId}`);
      setInspection(data.inspection);
      setLocalRooms(data.inspection.rooms || initializeRooms());
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

  const initializeRooms = (): Room[] => {
    return ROOMS.map(room => ({
      room_name: room.id,
      items: ITEMS.map(item => ({
        name: item,
        condition: 'na' as const,
        notes: '',
        photos: [],
      })),
    }));
  };

  const updateItemCondition = (roomId: string, itemName: string, condition: string) => {
    setLocalRooms(prev => prev.map(room => {
      if (room.room_name !== roomId) return room;
      return {
        ...room,
        items: room.items.map(item => {
          if (item.name !== itemName) return item;
          return { ...item, condition: condition as any };
        }),
      };
    }));
  };

  const updateItemNotes = (roomId: string, itemName: string, notes: string) => {
    setLocalRooms(prev => prev.map(room => {
      if (room.room_name !== roomId) return room;
      return {
        ...room,
        items: room.items.map(item => {
          if (item.name !== itemName) return item;
          return { ...item, notes };
        }),
      };
    }));
  };

  const takePhoto = async (roomId: string, itemName: string) => {
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      const photoUri = `data:image/jpeg;base64,${result.assets[0].base64}`;
      setLocalRooms(prev => prev.map(room => {
        if (room.room_name !== roomId) return room;
        return {
          ...room,
          items: room.items.map(item => {
            if (item.name !== itemName) return item;
            return { ...item, photos: [...item.photos, photoUri] };
          }),
        };
      }));
    }
  };

  const saveInspection = async (newStatus?: string) => {
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/inspections/${id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rooms: localRooms,
          status: newStatus || inspection?.status,
        }),
      });
      
      if (res.ok) {
        Alert.alert('✅ Guardado', 'La inspección se ha actualizado correctamente');
        fetchInspection();
      } else {
        const data = await res.json();
        Alert.alert('Error', data.detail || 'No se pudo guardar');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  const handleSignature = async (signatureBase64: string) => {
    setSaving(true);
    try {
      const field = showSignatureModal === 'admin' ? 'admin_signature' : 'tenant_signature';
      const dateField = showSignatureModal === 'admin' ? 'admin_signature_date' : 'tenant_signature_date';
      
      const res = await fetch(`${API_URL}/api/admin/inspections/${id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          [field]: signatureBase64,
          [dateField]: new Date().toISOString(),
          // If both signatures are done, mark as completed
          status: (showSignatureModal === 'tenant' && inspection?.admin_signature) ? 'completed' : inspection?.status,
        }),
      });
      
      if (res.ok) {
        Alert.alert('✅ Firmado', 'La firma se ha guardado correctamente');
        setShowSignatureModal(null);
        fetchInspection();
      } else {
        const data = await res.json();
        Alert.alert('Error', data.detail || 'No se pudo guardar la firma');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  // Send inspection for remote signature by tenant
  const sendForRemoteSignature = async () => {
    if (!inspection?.admin_signature) {
      Alert.alert('Error', 'Primero debes firmar la inspección como administrador');
      return;
    }

    Alert.alert(
      '📱 Enviar para Firma Remota',
      `El inquilino "${inspection.tenant_name || 'asignado'}" recibirá una notificación en su app para revisar y firmar esta inspección desde su dispositivo.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Enviar',
          onPress: async () => {
            setSaving(true);
            try {
              const res = await fetch(`${API_URL}/api/admin/inspections/${id}/send-for-signature`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json',
                },
              });
              
              if (res.ok) {
                Alert.alert(
                  '✅ Enviado',
                  'El inquilino recibirá una notificación y podrá firmar desde su app.',
                  [{ text: 'OK', onPress: () => fetchInspection() }]
                );
              } else {
                const data = await res.json();
                Alert.alert('Error', data.detail || 'No se pudo enviar');
              }
            } catch (e: any) {
              Alert.alert('Error', e.message || 'Error de conexión');
            } finally {
              setSaving(false);
            }
          }
        }
      ]
    );
  };

  const downloadPDF = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/inspections/${id}/pdf`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      
      if (res.ok) {
        const data = await res.json();
        const filename = data.filename || `Inspeccion_${id}.pdf`;
        const fileUri = `${FileSystem.cacheDirectory}${filename}`;
        
        await FileSystem.writeAsStringAsync(fileUri, data.pdf_base64, {
          encoding: FileSystem.EncodingType.Base64,
        });
        
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri, {
            mimeType: 'application/pdf',
            dialogTitle: 'Compartir Inspección PDF',
          });
        } else {
          Alert.alert('✅ PDF Generado', `Archivo guardado: ${filename}`);
        }
      } else {
        const data = await res.json();
        Alert.alert('Error', data.detail || 'No se pudo generar el PDF');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Error generando PDF');
    } finally {
      setSaving(false);
    }
  };

  const sendEmail = async () => {
    const email = inspection?.tenant_email;
    if (!email) {
      Alert.alert('Error', 'El inquilino no tiene email registrado');
      return;
    }
    
    Alert.alert(
      '📧 Enviar por Email',
      `¿Enviar el reporte de inspección a ${email}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Enviar', onPress: () => doSendEmail(email) },
      ]
    );
  };

  const doSendEmail = async (email: string) => {
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/inspections/${id}/send-email`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });
      
      if (res.ok) {
        Alert.alert('✅ Email Enviado', `El reporte fue enviado a ${email}`);
      } else {
        const data = await res.json();
        Alert.alert('Error', data.detail || 'No se pudo enviar el email');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Error enviando email');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#C8102E" />
        </View>
      </SafeAreaView>
    );
  }

  if (!inspection) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>Inspección no encontrada</Text>
        </View>
      </SafeAreaView>
    );
  }

  const getRoomConfig = (roomId: string) => ROOMS.find(r => r.id === roomId) || { name: roomId, icon: 'cube-outline' };
  const getRoomProgress = (room: Room) => {
    const completed = room.items.filter(i => i.condition !== 'na').length;
    return { completed, total: room.items.length };
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={C.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle} numberOfLines={1}>{inspection.property_name || 'Inspección'}</Text>
          <Text style={styles.headerSubtitle}>{inspection.property_address}</Text>
        </View>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Info Card */}
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Ionicons name="person-outline" size={18} color={C.textMuted} />
            <Text style={styles.infoLabel}>Inquilino:</Text>
            <Text style={styles.infoValue}>{inspection.tenant_name}</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="calendar-outline" size={18} color={C.textMuted} />
            <Text style={styles.infoLabel}>Fecha:</Text>
            <Text style={styles.infoValue}>
              {inspection.scheduled_date ? new Date(inspection.scheduled_date).toLocaleDateString('es-ES') : 'Sin fecha'}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="clipboard-outline" size={18} color={C.textMuted} />
            <Text style={styles.infoLabel}>Tipo:</Text>
            <Text style={styles.infoValue}>
              {inspection.inspection_type === 'move_in' ? 'Move-In' : inspection.inspection_type === 'move_out' ? 'Move-Out' : 'Rutinaria'}
            </Text>
          </View>
        </View>

        {/* Rooms Checklist */}
        <Text style={styles.sectionTitle}>📋 Checklist por Habitación</Text>
        
        {localRooms.map(room => {
          const config = getRoomConfig(room.room_name);
          const progress = getRoomProgress(room);
          const isExpanded = expandedRoom === room.room_name;

          return (
            <View key={room.room_name} style={styles.roomCard}>
              <TouchableOpacity 
                style={styles.roomHeader}
                onPress={() => setExpandedRoom(isExpanded ? null : room.room_name)}
              >
                <View style={styles.roomIcon}>
                  <Ionicons name={config.icon as any} size={20} color="#C8102E" />
                </View>
                <View style={styles.roomInfo}>
                  <Text style={styles.roomName}>{config.name}</Text>
                  <Text style={styles.roomProgress}>{progress.completed}/{progress.total} items revisados</Text>
                </View>
                <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={20} color={C.textMuted} />
              </TouchableOpacity>

              {isExpanded && (
                <View style={styles.roomItems}>
                  {room.items.map((item, idx) => (
                    <View key={idx} style={styles.itemRow}>
                      <Text style={styles.itemName}>{item.name}</Text>
                      
                      {/* Condition Buttons */}
                      <View style={styles.conditionButtons}>
                        {Object.entries(CONDITIONS).map(([key, cfg]) => (
                          <TouchableOpacity
                            key={key}
                            style={[
                              styles.conditionBtn,
                              item.condition === key && { backgroundColor: cfg.color + '30', borderColor: cfg.color },
                            ]}
                            onPress={() => updateItemCondition(room.room_name, item.name, key)}
                          >
                            <Ionicons name={cfg.icon as any} size={14} color={item.condition === key ? cfg.color : '#666'} />
                          </TouchableOpacity>
                        ))}
                      </View>

                      {/* Photo & Notes */}
                      <View style={styles.itemActions}>
                        <TouchableOpacity 
                          style={styles.photoBtn}
                          onPress={() => takePhoto(room.room_name, item.name)}
                        >
                          <Ionicons name="camera-outline" size={16} color="#3b82f6" />
                          {item.photos.length > 0 && (
                            <View style={styles.photoBadge}>
                              <Text style={styles.photoBadgeText}>{item.photos.length}</Text>
                            </View>
                          )}
                        </TouchableOpacity>
                      </View>

                      {/* Notes Input */}
                      <TextInput
                        style={styles.notesInput}
                        placeholder="Notas..."
                        placeholderTextColor={C.textMuted}
                        value={item.notes}
                        onChangeText={(text) => updateItemNotes(room.room_name, item.name, text)}
                        multiline
                      />

                      {/* Photo Previews */}
                      {item.photos.length > 0 && (
                        <ScrollView horizontal style={styles.photosRow}>
                          {item.photos.map((photo, pIdx) => (
                            <Image key={pIdx} source={{ uri: photo }} style={styles.photoThumb} />
                          ))}
                        </ScrollView>
                      )}
                    </View>
                  ))}
                </View>
              )}
            </View>
          );
        })}

        {/* Signatures Section */}
        <Text style={styles.sectionTitle}>✍️ Firmas Digitales</Text>
        
        <View style={styles.signaturesCard}>
          {/* Admin Signature */}
          <View style={styles.signatureBox}>
            <View style={styles.signatureHeader}>
              <Ionicons name="person" size={18} color="#C8102E" />
              <Text style={styles.signatureLabel}>Inspector</Text>
            </View>
            {inspection.admin_signature ? (
              <View style={styles.signaturePreview}>
                <Image source={{ uri: inspection.admin_signature }} style={styles.signatureImage} resizeMode="contain" />
                <Text style={styles.signatureDate}>
                  Firmado: {inspection.admin_signature_date ? new Date(inspection.admin_signature_date).toLocaleString('es-ES') : ''}
                </Text>
              </View>
            ) : (
              <TouchableOpacity 
                style={styles.signButton}
                onPress={() => setShowSignatureModal('admin')}
                disabled={!isAdmin}
              >
                <LinearGradient colors={['#C8102E', '#9B1B30']} style={StyleSheet.absoluteFill} />
                <Ionicons name="create-outline" size={18} color="#fff" />
                <Text style={styles.signButtonText}>Firmar como Inspector</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Tenant Signature */}
          <View style={styles.signatureBox}>
            <View style={styles.signatureHeader}>
              <Ionicons name="home" size={18} color="#0ea5e9" />
              <Text style={styles.signatureLabel}>Inquilino</Text>
            </View>
            {inspection.tenant_signature ? (
              <View style={styles.signaturePreview}>
                <Image source={{ uri: inspection.tenant_signature }} style={styles.signatureImage} resizeMode="contain" />
                <Text style={styles.signatureDate}>
                  Firmado: {inspection.tenant_signature_date ? new Date(inspection.tenant_signature_date).toLocaleString('es-ES') : ''}
                </Text>
              </View>
            ) : inspection.pending_tenant_signature || inspection.status === 'pending_signature' ? (
              <View style={styles.pendingSignatureBox}>
                <View style={styles.pendingBadge}>
                  <Ionicons name="hourglass-outline" size={18} color="#ec4899" />
                  <Text style={styles.pendingText}>Esperando firma del inquilino</Text>
                </View>
                <Text style={styles.pendingSubtext}>
                  Se envió notificación al inquilino. Cuando firme desde su app, se completará automáticamente.
                </Text>
              </View>
            ) : (
              <View style={styles.signatureOptions}>
                <TouchableOpacity 
                  style={[styles.signButton, { opacity: inspection.admin_signature ? 1 : 0.5 }]}
                  onPress={() => setShowSignatureModal('tenant')}
                  disabled={!inspection.admin_signature}
                >
                  <LinearGradient colors={['#0ea5e9', '#0284c7']} style={StyleSheet.absoluteFill} />
                  <Ionicons name="create-outline" size={18} color="#fff" />
                  <Text style={styles.signButtonText}>
                    {inspection.admin_signature ? 'Firmar Aquí (Presencial)' : 'Esperando firma del inspector'}
                  </Text>
                </TouchableOpacity>
                
                {inspection.admin_signature && (
                  <TouchableOpacity 
                    style={styles.remoteSignButton}
                    onPress={sendForRemoteSignature}
                    disabled={saving}
                  >
                    <Ionicons name="phone-portrait-outline" size={18} color="#ec4899" />
                    <Text style={styles.remoteSignText}>Enviar para Firma Remota</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity 
            style={styles.saveButton}
            onPress={() => saveInspection()}
            disabled={saving}
          >
            <LinearGradient colors={['#10b981', '#059669']} style={StyleSheet.absoluteFill} />
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="save-outline" size={20} color="#fff" />
                <Text style={styles.saveButtonText}>Guardar Cambios</Text>
              </>
            )}
          </TouchableOpacity>

          {inspection.status !== 'completed' && inspection.admin_signature && inspection.tenant_signature && (
            <TouchableOpacity 
              style={styles.completeButton}
              onPress={() => saveInspection('completed')}
              disabled={saving}
            >
              <LinearGradient colors={['#8b5cf6', '#7c3aed']} style={StyleSheet.absoluteFill} />
              <Ionicons name="checkmark-done" size={20} color="#fff" />
              <Text style={styles.saveButtonText}>Marcar Completada</Text>
            </TouchableOpacity>
          )}

          {/* PDF & Email Actions */}
          <View style={styles.secondaryActions}>
            <TouchableOpacity 
              style={styles.pdfButton}
              onPress={downloadPDF}
              disabled={saving}
            >
              <Ionicons name="document-text-outline" size={20} color="#C8102E" />
              <Text style={styles.pdfButtonText}>Descargar PDF</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.emailButton}
              onPress={sendEmail}
              disabled={saving}
            >
              <Ionicons name="mail-outline" size={20} color="#3b82f6" />
              <Text style={styles.emailButtonText}>Enviar Email</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Signature Modal */}
      <Modal visible={showSignatureModal !== null} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <SignaturePad
            signerName={showSignatureModal === 'admin' ? (user?.first_name || 'Inspector') : inspection.tenant_name}
            signerRole={showSignatureModal || 'admin'}
            onSave={handleSignature}
            onCancel={() => setShowSignatureModal(null)}
          />
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const create_styles = (C: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: C.textMuted,
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.glassLight,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: C.glassLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: C.textPrimary,
  },
  headerSubtitle: {
    fontSize: 13,
    color: C.textMuted,
    marginTop: 2,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  infoCard: {
    backgroundColor: C.glass,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    gap: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  infoLabel: {
    fontSize: 13,
    color: C.textMuted,
  },
  infoValue: {
    fontSize: 14,
    color: C.textPrimary,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: C.textPrimary,
    marginBottom: 12,
    marginTop: 8,
  },
  roomCard: {
    backgroundColor: C.glass,
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
  },
  roomHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  roomIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(200,16,46,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  roomInfo: {
    flex: 1,
  },
  roomName: {
    fontSize: 15,
    fontWeight: '600',
    color: C.textPrimary,
  },
  roomProgress: {
    fontSize: 12,
    color: C.textMuted,
    marginTop: 2,
  },
  roomItems: {
    borderTopWidth: 1,
    borderTopColor: C.glassLight,
    padding: 16,
    gap: 16,
  },
  itemRow: {
    gap: 8,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
    color: C.textPrimary,
  },
  conditionButtons: {
    flexDirection: 'row',
    gap: 6,
  },
  conditionBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: C.glassLight,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  itemActions: {
    flexDirection: 'row',
    gap: 8,
  },
  photoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(59,130,246,0.1)',
    borderRadius: 8,
    gap: 4,
  },
  photoBadge: {
    backgroundColor: '#3b82f6',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  photoBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  notesInput: {
    backgroundColor: C.glass,
    borderRadius: 8,
    padding: 10,
    color: C.textPrimary,
    fontSize: 13,
    minHeight: 40,
  },
  photosRow: {
    flexDirection: 'row',
    marginTop: 8,
  },
  photoThumb: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 8,
  },
  signaturesCard: {
    gap: 16,
    marginBottom: 20,
  },
  signatureBox: {
    backgroundColor: C.glass,
    borderRadius: 16,
    padding: 16,
  },
  signatureHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  signatureLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: C.textPrimary,
  },
  signaturePreview: {
    alignItems: 'center',
  },
  signatureImage: {
    width: '100%',
    height: 80,
    backgroundColor: '#fff',
    borderRadius: 8,
  },
  signatureDate: {
    fontSize: 11,
    color: C.textMuted,
    marginTop: 8,
  },
  signButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: 12,
    overflow: 'hidden',
    gap: 8,
  },
  signButtonText: {
    color: C.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  actionButtons: {
    gap: 12,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    borderRadius: 14,
    overflow: 'hidden',
    gap: 8,
  },
  completeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    borderRadius: 14,
    overflow: 'hidden',
    gap: 8,
  },
  saveButtonText: {
    color: C.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  pdfButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(200,16,46,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(200,16,46,0.2)',
    gap: 8,
  },
  pdfButtonText: {
    color: '#C8102E',
    fontSize: 14,
    fontWeight: '600',
  },
  emailButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(59,130,246,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.2)',
    gap: 8,
  },
  emailButtonText: {
    color: '#3b82f6',
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    padding: 20,
  },
  // Remote signature styles
  signatureOptions: {
    gap: 10,
  },
  remoteSignButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(236,72,153,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(236,72,153,0.3)',
    gap: 8,
  },
  remoteSignText: {
    color: '#ec4899',
    fontSize: 14,
    fontWeight: '600',
  },
  pendingSignatureBox: {
    padding: 16,
    backgroundColor: 'rgba(236,72,153,0.08)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(236,72,153,0.2)',
  },
  pendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  pendingText: {
    color: '#ec4899',
    fontSize: 14,
    fontWeight: '600',
  },
  pendingSubtext: {
    color: C.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
});
