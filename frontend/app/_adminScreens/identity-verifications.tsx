import { useTranslation } from 'react-i18next';
/**
 * Admin: Identity Verification Review Panel
 * Review and approve/reject client ID verification submissions
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Image,
  TextInput,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import api from '../../services/api';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface Verification {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  session_id: string;
  id_type: string;
  full_name: string;
  submitted_at: string;
  status: string;
}

const ID_TYPE_LABELS: Record<string, string> = {
  drivers_license: 'Licencia de conducir',
  passport: 'Pasaporte',
  state_id: 'ID Estatal',
};

export default function IdentityVerificationsAdmin() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [verifications, setVerifications] = useState<Verification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedVerification, setSelectedVerification] = useState<Verification | null>(null);
  const [images, setImages] = useState<{ id_photo: string; selfie: string } | null>(null);
  const [loadingImages, setLoadingImages] = useState(false);
  const [reviewNotes, setReviewNotes] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => { loadVerifications(); }, []);

  const loadVerifications = async () => {
    try {
      const res = await api.get('/tax-wizard/admin/identity-verifications/pending');
      setVerifications(res.data || []);
    } catch (e: any) {
      console.error('Error loading verifications:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const openReview = async (v: Verification) => {
    setSelectedVerification(v);
    setReviewNotes('');
    setImages(null);
    setModalVisible(true);
    
    try {
      setLoadingImages(true);
      const res = await api.get(`/tax-wizard/admin/identity-verifications/${v.id}/images`);
      if (res.data?.success) {
        setImages({
          id_photo: `data:image/jpeg;base64,${res.data.id_photo}`,
          selfie: `data:image/jpeg;base64,${res.data.selfie}`,
        });
      }
    } catch (e) {
      Alert.alert('Error', 'No se pudieron cargar las imágenes');
    } finally {
      setLoadingImages(false);
    }
  };

  const handleReview = async (approved: boolean) => {
    if (!selectedVerification) return;
    
    const action = approved ? 'aprobar' : 'rechazar';
    Alert.alert(
      `¿${approved ? 'Aprobar' : 'Rechazar'} verificación?`,
      `Estás a punto de ${action} la verificación de ${selectedVerification.user_name || selectedVerification.user_email}`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: approved ? 'Aprobar' : 'Rechazar', style: approved ? 'default' : 'destructive', onPress: async () => {
          try {
            setSubmittingReview(true);
            await api.post(`/tax-wizard/admin/identity-verifications/${selectedVerification.id}/review`, {
              approved,
              notes: reviewNotes,
            });
            Alert.alert('✅', `Verificación ${approved ? 'aprobada' : 'rechazada'}`);
            setModalVisible(false);
            loadVerifications();
          } catch (e: any) {
            Alert.alert('Error', e?.response?.data?.detail || 'Error al procesar');
          } finally {
            setSubmittingReview(false);
          }
        }},
      ]
    );
  };

  if (loading) {
    return (
      <View style={[s.container, { paddingTop: insets.top }]}>
        <View style={s.loadingBox}><ActivityIndicator size="large" color="#4F46E5" /></View>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <LinearGradient colors={['#4F46E5', '#6366F1']} style={[s.header, { paddingTop: insets.top + 12 }]}>
        <View style={s.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#FFF" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle}>Verificación de Identidad</Text>
            <Text style={s.headerSub}>{verifications.length} pendientes de revisión</Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadVerifications(); }} tintColor="#4F46E5" />}
      >
        {verifications.length === 0 ? (
          <View style={s.emptyBox}>
            <Ionicons name="shield-checkmark-outline" size={48} color="#9CA3AF" />
            <Text style={s.emptyTitle}>Sin verificaciones pendientes</Text>
            <Text style={s.emptyText}>Todas las verificaciones han sido procesadas</Text>
          </View>
        ) : (
          verifications.map(v => (
            <TouchableOpacity key={v.id} style={s.card} onPress={() => openReview(v)} activeOpacity={0.8}>
              <View style={s.cardTop}>
                <View style={s.cardAvatar}>
                  <Text style={s.cardAvatarText}>{(v.user_name || v.user_email || '?')[0].toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.cardName}>{v.user_name || 'Sin nombre'}</Text>
                  <Text style={s.cardEmail}>{v.user_email}</Text>
                </View>
                <View style={s.pendingBadge}>
                  <Text style={s.pendingBadgeText}>Pendiente</Text>
                </View>
              </View>
              <View style={s.cardDetails}>
                <View style={s.cardDetail}>
                  <Ionicons name="card-outline" size={14} color="#6B7280" />
                  <Text style={s.cardDetailText}>{ID_TYPE_LABELS[v.id_type] || v.id_type}</Text>
                </View>
                <View style={s.cardDetail}>
                  <Ionicons name="time-outline" size={14} color="#6B7280" />
                  <Text style={s.cardDetailText}>
                    {v.submitted_at ? format(new Date(v.submitted_at), "d MMM, h:mm a", { locale: es }) : ''}
                  </Text>
                </View>
              </View>
              <View style={s.cardAction}>
                <Text style={s.cardActionText}>Tocar para revisar →</Text>
              </View>
            </TouchableOpacity>
          ))
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Review Modal */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={[s.modalContainer, { paddingTop: insets.top }]}>
          <View style={s.modalHeader}>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Ionicons name="close" size={28} color="#1F2937" />
            </TouchableOpacity>
            <Text style={s.modalTitle}>Revisar verificación</Text>
            <View style={{ width: 28 }} />
          </View>

          <ScrollView style={s.modalScroll} contentContainerStyle={s.modalContent}>
            {/* User Info */}
            <View style={s.infoCard}>
              <Text style={s.infoLabel}>Cliente</Text>
              <Text style={s.infoValue}>{selectedVerification?.user_name || 'Sin nombre'}</Text>
              <Text style={s.infoSub}>{selectedVerification?.user_email}</Text>
            </View>

            <View style={s.infoCard}>
              <Text style={s.infoLabel}>Tipo de ID</Text>
              <Text style={s.infoValue}>{ID_TYPE_LABELS[selectedVerification?.id_type || ''] || selectedVerification?.id_type}</Text>
            </View>

            {/* Images */}
            {loadingImages ? (
              <View style={s.imagesLoading}><ActivityIndicator size="large" color="#4F46E5" /><Text style={s.loadingText}>Cargando imágenes...</Text></View>
            ) : images ? (
              <>
                <View style={s.imageSection}>
                  <Text style={s.imageLabel}>📄 Foto de ID</Text>
                  <Image source={{ uri: images.id_photo }} style={s.idImage} resizeMode="contain" />
                </View>
                <View style={s.imageSection}>
                  <Text style={s.imageLabel}>🤳 Selfie</Text>
                  <Image source={{ uri: images.selfie }} style={s.selfieImage} resizeMode="cover" />
                </View>
              </>
            ) : (
              <View style={s.imagesLoading}><Text style={s.loadingText}>No se encontraron imágenes</Text></View>
            )}

            {/* Notes */}
            <Text style={s.notesLabel}>Notas de revisión (opcional)</Text>
            <TextInput
              style={s.notesInput}
              value={reviewNotes}
              onChangeText={setReviewNotes}
              placeholder={t('admin.verificationNotesPlaceholder', 'Agregar notas sobre la verificación...')}
              multiline
              numberOfLines={3}
            />

            {/* Action Buttons */}
            <View style={s.actionButtons}>
              <TouchableOpacity style={s.rejectBtn} onPress={() => handleReview(false)} disabled={submittingReview}>
                {submittingReview ? <ActivityIndicator color="#FFF" /> : (
                  <><Ionicons name="close-circle" size={20} color="#FFF" /><Text style={s.rejectBtnText}>Rechazar</Text></>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={s.approveBtn} onPress={() => handleReview(true)} disabled={submittingReview}>
                {submittingReview ? <ActivityIndicator color="#FFF" /> : (
                  <><Ionicons name="checkmark-circle" size={20} color="#FFF" /><Text style={s.approveBtnText}>Aprobar</Text></>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  loadingBox: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  header: { paddingHorizontal: 20, paddingBottom: 20, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#FFF' },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 2 },

  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingTop: 20 },

  emptyBox: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#1F2937' },
  emptyText: { fontSize: 14, color: '#6B7280' },

  card: { backgroundColor: '#FFF', borderRadius: 18, padding: 18, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3, borderWidth: 1, borderColor: 'rgba(0,0,0,0.04)' },
  cardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  cardAvatar: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#EEF2FF', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  cardAvatarText: { fontSize: 18, fontWeight: '700', color: '#4F46E5' },
  cardName: { fontSize: 16, fontWeight: '700', color: '#1F2937' },
  cardEmail: { fontSize: 13, color: '#6B7280' },
  pendingBadge: { backgroundColor: '#FEF3C7', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  pendingBadgeText: { fontSize: 11, fontWeight: '700', color: '#92400E' },
  cardDetails: { flexDirection: 'row', gap: 16, marginBottom: 10 },
  cardDetail: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  cardDetailText: { fontSize: 13, color: '#6B7280' },
  cardAction: { borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 10 },
  cardActionText: { fontSize: 13, fontWeight: '600', color: '#4F46E5', textAlign: 'center' },

  // Modal
  modalContainer: { flex: 1, backgroundColor: '#FFF' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#1F2937' },
  modalScroll: { flex: 1 },
  modalContent: { padding: 20, paddingBottom: 40 },

  infoCard: { backgroundColor: '#F9FAFB', borderRadius: 14, padding: 14, marginBottom: 12 },
  infoLabel: { fontSize: 11, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  infoValue: { fontSize: 16, fontWeight: '700', color: '#1F2937' },
  infoSub: { fontSize: 13, color: '#6B7280', marginTop: 2 },

  imageSection: { marginBottom: 16 },
  imageLabel: { fontSize: 14, fontWeight: '700', color: '#1F2937', marginBottom: 10 },
  idImage: { width: '100%', height: 220, borderRadius: 14, backgroundColor: '#F3F4F6' },
  selfieImage: { width: 180, height: 180, borderRadius: 90, backgroundColor: '#F3F4F6', alignSelf: 'center' },
  imagesLoading: { alignItems: 'center', paddingVertical: 30, gap: 12 },
  loadingText: { fontSize: 14, color: '#6B7280' },

  notesLabel: { fontSize: 14, fontWeight: '600', color: '#1F2937', marginTop: 8, marginBottom: 8 },
  notesInput: { backgroundColor: '#F9FAFB', borderRadius: 14, padding: 14, fontSize: 14, color: '#1F2937', borderWidth: 1, borderColor: '#E5E7EB', minHeight: 80, textAlignVertical: 'top', marginBottom: 20 },

  actionButtons: { flexDirection: 'row', gap: 12 },
  rejectBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#EF4444', paddingVertical: 16, borderRadius: 14 },
  rejectBtnText: { fontSize: 15, fontWeight: '700', color: '#FFF' },
  approveBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#10B981', paddingVertical: 16, borderRadius: 14 },
  approveBtnText: { fontSize: 15, fontWeight: '700', color: '#FFF' },
});
