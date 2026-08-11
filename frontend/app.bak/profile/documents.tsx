import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Platform,
  ActivityIndicator, Alert, RefreshControl, Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../src/contexts/AuthContext';
import { Colors, API_URL } from '../../src/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

// DOC_TYPES keys only — labels use t() inside the component
const DOC_TYPE_KEYS = [
  { key: 'photo_id', icon: '🪪', required: true },
  { key: 'proof_address', icon: '🏠', required: true },
  { key: 'pay_stub', icon: '💰', required: true },
  { key: 'bank_statement', icon: '🏦', required: false },
  { key: 'selfie', icon: '🤳', required: false },
  { key: 'other', icon: '📄', required: false },
];

export default function DocumentsScreen() {
  const { token } = useAuth();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  // Build DOC_TYPES with translations inside the component where t() is available
  const DOC_TYPES = DOC_TYPE_KEYS.map(d => ({
    ...d,
    label: t(`docsScreen.${d.key === 'bank_statement' ? 'bankStatement' : d.key === 'photo_id' ? 'photoId' : d.key === 'proof_address' ? 'proofAddress' : d.key === 'pay_stub' ? 'payStub' : d.key === 'other' ? 'otherDoc' : d.key}`, d.key.replace(/_/g, ' ')),
    desc: t(`docsScreen.${d.key === 'bank_statement' ? 'bankStatementDesc' : d.key === 'photo_id' ? 'photoIdDesc' : d.key === 'proof_address' ? 'proofAddressDesc' : d.key === 'pay_stub' ? 'payStubDesc' : d.key === 'other' ? 'otherDocDesc' : d.key + 'Desc'}`, ''),
  }));
  const [documents, setDocuments] = useState<any[]>([]);
  const [requiredDocs, setRequiredDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [allUploaded, setAllUploaded] = useState(false);

  const fetchDocs = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/documents/my-documents`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setDocuments(data.documents || []);
        setRequiredDocs(data.required_docs || []);
        setAllUploaded(data.all_required_uploaded || false);
      }
    } catch (e) {
      console.error('Error fetching docs:', e);
    }
    setLoading(false);
  }, [token]);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  const pickImage = async (docType: string, useCamera: boolean) => {
    try {
      // Request permissions
      if (useCamera) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(t('docsScreen.permCamera'), t('docsScreen.permCameraMsg'));
          return;
        }
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(t('docsScreen.permCamera'), t('docsScreen.permGalleryMsg'));
          return;
        }
      }

      const result = useCamera
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            quality: 0.7,
            base64: true,
            allowsEditing: true,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 0.7,
            base64: true,
            allowsEditing: true,
          });

      if (result.canceled || !result.assets?.[0]?.base64) return;

      setUploading(docType);

      const asset = result.assets[0];
      const res = await fetch(`${API_URL}/api/documents/upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          doc_type: docType,
          file_data: asset.base64,
          file_name: `${docType}_${Date.now()}`,
        }),
      });

      if (res.ok) {
        Alert.alert('✅ Documento Subido', t('docsScreen.docUploadedMsg'));
        fetchDocs();
      } else {
        const err = await res.json();
        Alert.alert(t('common.error', 'Error'), err.detail || t('docsScreen.couldNotUpload', 'Could not upload document'));
      }
    } catch (e) {
      console.error('Upload error:', e);
      Alert.alert(t('common.error', 'Error'), t('docsScreen.uploadError', 'An error occurred while uploading the document'));
    }
    setUploading(null);
  };

  const showUploadOptions = (docType: string) => {
    Alert.alert(
      t('docsScreen.uploadDoc'),
      t('docsScreen.uploadQuestion'),
      [
        { text: t('docsScreen.takePhoto'), onPress: () => pickImage(docType, true) },
        { text: t('docsScreen.gallery'), onPress: () => pickImage(docType, false) },
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
      ]
    );
  };

  const deleteDoc = async (docId: string) => {
    Alert.alert(t('docsScreen.deleteDoc'), t('docsScreen.deleteConfirm'), [
      { text: t('common.cancel', 'Cancel'), style: 'cancel' },
      {
        text: 'Eliminar', style: 'destructive', onPress: async () => {
          try {
            await fetch(`${API_URL}/api/documents/${docId}`, {
              method: 'DELETE',
              headers: { 'Authorization': `Bearer ${token}` },
            });
            fetchDocs();
          } catch (e) {
            console.error(e);
          }
        }
      },
    ]);
  };

  const onRefresh = async () => { setRefreshing(true); await fetchDocs(); setRefreshing(false); };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved': return { label: t('docsScreen.approved'), color: Colors.success, icon: 'checkmark-circle' };
      case 'rejected': return { label: t('docsScreen.rejected'), color: Colors.error, icon: 'close-circle' };
      default: return { label: t('docsScreen.inReview'), color: Colors.accent, icon: 'time' };
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primaryLight} />
          <Text style={styles.loadingText}>Cargando documentos...</Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primaryLight} />}
    >
      {/* Status Banner */}
      <LinearGradient
        colors={allUploaded ? ['#059669', '#047857'] : ['#D97706', '#B45309']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={styles.statusBanner}
      >
        <Text style={styles.statusIcon}>{allUploaded ? '✅' : '📋'}</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.statusTitle}>
            {allUploaded ? t('docsScreen.allComplete') : t('docsScreen.required')}
          </Text>
          <Text style={styles.statusSubtitle}>
            {allUploaded
              ? t('docsScreen.allCompleteDesc')
              : t('docsScreen.requiredDesc')}
          </Text>
        </View>
      </LinearGradient>

      {/* Required Documents */}
      <Text style={styles.sectionTitle}>{t('docs.requiredDocs')}</Text>
      {DOC_TYPES.filter(d => d.required).map(docType => {
        const existing = documents.find(d => d.doc_type === docType.key);
        const isUploading = uploading === docType.key;
        const status = existing ? getStatusBadge(existing.status) : null;

        return (
          <View key={docType.key} style={[styles.docCard, existing && styles.docCardUploaded]}>
            <View style={styles.docHeader}>
              <Text style={styles.docIcon}>{docType.icon}</Text>
              <View style={{ flex: 1 }}>
                <View style={styles.docTitleRow}>
                  <Text style={styles.docTitle}>{docType.label}</Text>
                  <Text style={styles.requiredBadge}>Requerido</Text>
                </View>
                <Text style={styles.docDesc}>{docType.desc}</Text>
              </View>
            </View>

            {existing ? (
              <View style={styles.uploadedSection}>
                <View style={styles.statusRow}>
                  <Ionicons name={status?.icon as any} size={18} color={status?.color} />
                  <Text style={[styles.statusLabel, { color: status?.color }]}>{status?.label}</Text>
                  <Text style={styles.uploadDate}>{new Date(existing.uploaded_at).toLocaleDateString()}</Text>
                </View>
                {existing.review_notes ? (
                  <Text style={styles.reviewNotes}>💬 {existing.review_notes}</Text>
                ) : null}
                <View style={styles.actionRow}>
                  {existing.status === 'rejected' && (
                    <TouchableOpacity style={styles.reuploadBtn} onPress={() => showUploadOptions(docType.key)}>
                      <Ionicons name="reload" size={16} color={Colors.accent} />
                      <Text style={styles.reuploadText}>Re-subir</Text>
                    </TouchableOpacity>
                  )}
                  {existing.status !== 'approved' && (
                    <TouchableOpacity onPress={() => deleteDoc(existing._id)}>
                      <Ionicons name="trash-outline" size={18} color={Colors.error} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.uploadBtn}
                onPress={() => showUploadOptions(docType.key)}
                disabled={isUploading}
              >
                {isUploading ? (
                  <ActivityIndicator size="small" color={Colors.white} />
                ) : (
                  <>
                    <Ionicons name="cloud-upload" size={20} color={Colors.white} />
                    <Text style={styles.uploadBtnText}>{t('docs.upload')}</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        );
      })}

      {/* Optional Documents */}
      <Text style={[styles.sectionTitle, { marginTop: 24 }]}>{t('docs.optionalDocs')}</Text>
      <Text style={styles.sectionSubtitle}>Sube documentos adicionales para acelerar tu aprobación</Text>

      {DOC_TYPES.filter(d => !d.required).map(docType => {
        const existing = documents.find(d => d.doc_type === docType.key);
        const isUploading = uploading === docType.key;
        const status = existing ? getStatusBadge(existing.status) : null;

        return (
          <View key={docType.key} style={[styles.docCard, existing && styles.docCardUploaded]}>
            <View style={styles.docHeader}>
              <Text style={styles.docIcon}>{docType.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.docTitle}>{docType.label}</Text>
                <Text style={styles.docDesc}>{docType.desc}</Text>
              </View>
              {existing ? (
                <View style={[styles.miniStatusBadge, { backgroundColor: status?.color + '20' }]}>
                  <Ionicons name={status?.icon as any} size={14} color={status?.color} />
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.miniUploadBtn}
                  onPress={() => showUploadOptions(docType.key)}
                  disabled={isUploading}
                >
                  {isUploading ? (
                    <ActivityIndicator size="small" color={Colors.primaryLight} />
                  ) : (
                    <Ionicons name="add" size={20} color={Colors.primaryLight} />
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>
        );
      })}

      {/* Info Banner */}
      <View style={styles.infoBanner}>
        <Ionicons name="shield-checkmark" size={22} color={Colors.info} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.infoTitle}>🔒 Tus documentos están protegidos</Text>
          <Text style={styles.infoText}>
            Toda la información se transmite encriptada y solo es accesible por personal autorizado de Ross Lending Solutions.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 100 },
  loadingText: { color: Colors.textSecondary, fontSize: 14, marginTop: 12 },

  statusBanner: {
    flexDirection: 'row', alignItems: 'center', marginHorizontal: 16,
    marginTop: 8, padding: 16, borderRadius: 16, gap: 12,
  },
  statusIcon: { fontSize: 28 },
  statusTitle: { color: Colors.white, fontSize: 16, fontWeight: '700' },
  statusSubtitle: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 2 },

  sectionTitle: { color: Colors.text, fontSize: 18, fontWeight: '700', marginHorizontal: 16, marginTop: 20, marginBottom: 4 },
  sectionSubtitle: { color: Colors.textMuted, fontSize: 12, marginHorizontal: 16, marginBottom: 12 },

  docCard: {
    backgroundColor: Colors.surface, borderRadius: 16, marginHorizontal: 16,
    marginTop: 10, padding: 16, borderWidth: 1, borderColor: Colors.border,
  },
  docCardUploaded: { borderColor: Colors.primary + '40' },

  docHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  docIcon: { fontSize: 28 },
  docTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  docTitle: { color: Colors.text, fontSize: 15, fontWeight: '600' },
  docDesc: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },

  requiredBadge: {
    backgroundColor: Colors.error + '20', color: Colors.error,
    fontSize: 10, fontWeight: '700', paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 4, overflow: 'hidden',
  },

  uploadBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 12,
    marginTop: 12,
  },
  uploadBtnText: { color: Colors.white, fontWeight: '700', fontSize: 14 },

  uploadedSection: { marginTop: 10 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusLabel: { fontSize: 13, fontWeight: '600' },
  uploadDate: { color: Colors.textMuted, fontSize: 11, marginLeft: 'auto' },
  reviewNotes: { color: Colors.textSecondary, fontSize: 12, marginTop: 6, fontStyle: 'italic' },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
  reuploadBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  reuploadText: { color: Colors.accent, fontSize: 13, fontWeight: '600' },

  miniUploadBtn: {
    width: 36, height: 36, borderRadius: 18, borderWidth: 1.5,
    borderColor: Colors.primary + '60', justifyContent: 'center', alignItems: 'center',
  },
  miniStatusBadge: {
    width: 32, height: 32, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center',
  },

  infoBanner: {
    flexDirection: 'row', backgroundColor: Colors.info + '10', borderRadius: 16,
    marginHorizontal: 16, marginTop: 24, padding: 16, borderWidth: 1,
    borderColor: Colors.info + '20',
  },
  infoTitle: { color: Colors.text, fontSize: 13, fontWeight: '600' },
  infoText: { color: Colors.textMuted, fontSize: 11, marginTop: 4, lineHeight: 16 },
});
