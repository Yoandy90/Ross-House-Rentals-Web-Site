import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, RefreshControl, Alert, Image,
  StyleSheet, ActivityIndicator, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { Colors, Gradients } from '../../src/constants/theme';
import { useTranslation } from 'react-i18next';

// Lazy imports to prevent native module crashes
let ImagePicker: any = null;
let LinearGradient: any = null;

const loadNativeModules = async () => {
  try { if (!ImagePicker) ImagePicker = await import('expo-image-picker'); } catch (e) { console.warn('ImagePicker not available:', e); }
  try { if (!LinearGradient) LinearGradient = (await import('expo-linear-gradient')).LinearGradient; } catch (e) { console.warn('LinearGradient not available:', e); }
};

const API_URL = process.env.EXPO_PUBLIC_API_URL || '';
const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

// LOAN_TYPE_FRIENDLY uses t() so must be inside the component
const LOAN_TYPE_FRIENDLY_DEFAULTS: Record<string, string> = {
  personal: 'Personal Loan',
  installation: 'Installment Loan',
  tax_advance: 'Tax Advance',
  subchapter__e: 'Personal Loan',
  subchapter_e: 'Personal Loan',
};

const DOC_TYPE_ICONS: Record<string, string> = {
  photo_id: 'id-card-outline',
  pay_stub: 'document-text-outline',
  proof_address: 'home-outline',
  bank_statement: 'card-outline',
  selfie: 'camera-outline',
  tax_return: 'receipt-outline',
  reference: 'person-outline',
  other: 'attach-outline',
};

export default function ApplicationStatusScreen() {
  const { t } = useTranslation();
  const { appId } = useLocalSearchParams<{ appId?: string }>();
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedApp, setSelectedApp] = useState<any>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [modulesReady, setModulesReady] = useState(false);

  // Load native modules safely
  useEffect(() => {
    loadNativeModules().then(() => setModulesReady(true)).catch(() => setModulesReady(true));
  }, []);

  // Dynamic translation maps
  const STATUS_MAP: Record<string, { label: string; icon: string; color: string; desc: string }> = {
    pending: { label: t('applicationStatus.pending'), icon: 'time-outline', color: Colors.accent, desc: t('applicationStatus.pendingDesc') },
    info_requested: { label: t('applicationStatus.infoRequested'), icon: 'document-attach-outline', color: '#6366F1', desc: t('applicationStatus.infoRequestedDesc') },
    docs_submitted: { label: t('applicationStatus.docsSubmitted'), icon: 'checkmark-done-outline', color: '#818CF8', desc: t('applicationStatus.docsSubmittedDesc') },
    approved: { label: t('applicationStatus.approved'), icon: 'checkmark-circle', color: Colors.success, desc: t('applicationStatus.approvedDesc') },
    rejected: { label: t('applicationStatus.rejected'), icon: 'close-circle', color: Colors.error, desc: t('applicationStatus.rejectedDesc') },
  };

  const getDocLabel = (docType: string) => {
    const key = `applicationStatus.doc${docType.charAt(0).toUpperCase() + docType.slice(1).replace(/_([a-z])/g, (_, c) => c.toUpperCase())}`;
    const translated = t(key);
    return translated !== key ? translated : (DOC_TYPE_ICONS[docType] ? docType.replace(/_/g, ' ') : docType);
  };

  const getToken = async () => {
    try {
      const SecureStore = require('expo-secure-store');
      return await SecureStore.getItemAsync('lending_token');
    } catch { return null; }
  };

  const fetchApplications = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) {
        console.log('[application-status] No token found');
        setLoading(false);
        setRefreshing(false);
        return;
      }
      const res = await fetch(`${API_URL}/api/loans/my-applications`, {
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        const data = await res.json();
        const apps = data.applications || [];
        setApplications(apps);
        // If appId was passed via navigation, select that specific application
        if (apps.length > 0 && !selectedApp) {
          if (appId) {
            const target = apps.find((a: any) => a._id === appId);
            setSelectedApp(target || apps[0]);
          } else {
            // Fallback: select by status priority (same logic as dashboard)
            const active = apps.find((a: any) => a.status === 'info_requested')
              || apps.find((a: any) => a.status === 'docs_submitted')
              || apps.find((a: any) => a.status === 'pending')
              || apps.find((a: any) => a.status === 'approved');
            setSelectedApp(active || apps[0]);
          }
        }
      } else {
        console.log('[application-status] API error:', res.status);
      }
    } catch (e) { console.error('[application-status] Fetch error:', e); }
    setLoading(false);
    setRefreshing(false);
  }, [appId]);

  useEffect(() => { fetchApplications(); }, [fetchApplications]);

  const onRefresh = () => { setRefreshing(true); fetchApplications(); };

  // Upload a document
  const handleUploadDocument = async (appId: string, docType: string) => {
    try {
      if (!ImagePicker) {
        await loadNativeModules();
        if (!ImagePicker) {
          Alert.alert('Error', 'Camera module not available');
          return;
        }
      }
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('common.permissions', 'Permissions'), t('docs.needPhotoAccess', 'We need photo access to upload documents.'));
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.7,
        base64: true,
        allowsEditing: true,
      });

      if (result.canceled || !result.assets[0]?.base64) return;

      setUploading(docType);
      const token = await getToken();
      const res = await fetch(`${API_URL}/api/loans/applications/${appId}/upload-document`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doc_type: docType,
          file_data: `data:image/jpeg;base64,${result.assets[0].base64}`,
          file_name: `${docType}_${Date.now()}.jpg`,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        Alert.alert('✅ Documento Subido', data.all_required_uploaded
          ? '¡Todos los documentos han sido enviados! Te notificaremos cuando sean revisados.'
          : 'Documento subido exitosamente.');
        await fetchApplications();
        // Update selectedApp
        const updated = applications.find(a => a._id === appId);
        if (updated) setSelectedApp(updated);
      } else {
        Alert.alert('Error', 'No se pudo subir el documento. Intenta de nuevo.');
      }
    } catch (e) {
      console.error(e);
      Alert.alert('Error', t('docsScreen.uploadError', 'An error occurred uploading the document.'));
    }
    setUploading(null);
  };

  // Take a photo with camera
  const handleTakePhoto = async (appId: string, docType: string) => {
    try {
      if (!ImagePicker) {
        await loadNativeModules();
        if (!ImagePicker) {
          Alert.alert('Error', 'Camera module not available');
          return;
        }
      }
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permisos', t('docsScreen.permCameraMsg', 'We need camera access.'));
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        quality: 0.7,
        base64: true,
        allowsEditing: true,
      });

      if (result.canceled || !result.assets[0]?.base64) return;

      setUploading(docType);
      const token = await getToken();
      const res = await fetch(`${API_URL}/api/loans/applications/${appId}/upload-document`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doc_type: docType,
          file_data: `data:image/jpeg;base64,${result.assets[0].base64}`,
          file_name: `${docType}_photo_${Date.now()}.jpg`,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        Alert.alert('✅', data.all_required_uploaded
          ? t('applicationStatus.allDocsUploaded', '¡Todos los documentos han sido enviados!')
          : t('applicationStatus.photoUploaded', 'Foto subida exitosamente.'));
        await fetchApplications();
      }
    } catch (e) {
      Alert.alert('Error', t('applicationStatus.photoError', 'No se pudo tomar la foto.'));
    }
    setUploading(null);
  };

  // Show upload options for a document
  const showUploadOptions = (appId: string, docType: string) => {
    Alert.alert(
      t('applicationStatus.upload', 'Subir Documento'),
      t('applicationStatus.howUpload', t('docsScreen.uploadQuestion', 'How would you like to upload your document?')),
      [
        { text: t('applicationStatus.takePhoto', '📷 Tomar Foto'), onPress: () => handleTakePhoto(appId, docType) },
        { text: t('applicationStatus.gallery', '🖼️ Galería'), onPress: () => handleUploadDocument(appId, docType) },
        { text: t('applicationStatus.cancel', 'Cancelar'), style: 'cancel' },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={S.container}>
        <View style={S.loadingWrap}>
          <ActivityIndicator size="large" color={Colors.primaryLight} />
          <Text style={S.loadingText}>{t('applicationStatus.loading', 'Cargando solicitudes...')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (applications.length === 0) {
    return (
      <SafeAreaView style={S.container}>
        <View style={S.header}>
          <TouchableOpacity onPress={() => router.back()} style={S.backBtn}>
            <Ionicons name="arrow-back" size={22} color={Colors.text} />
          </TouchableOpacity>
          <Text style={S.headerTitle}>{t('applicationStatus.title')}</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={S.emptyWrap}>
          <View style={S.emptyIconWrap}>
            <Ionicons name="document-text-outline" size={48} color={Colors.textMuted} />
          </View>
          <Text style={S.emptyTitle}>{t('applicationStatus.noApps', 'Sin Solicitudes')}</Text>
          <Text style={S.emptyDesc}>{t('applicationStatus.noAppsDesc', 'Aún no has enviado una solicitud de préstamo.')}</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/apply')} style={!LinearGradient ? [S.applyBtn, { backgroundColor: Colors.primary }] : undefined}>
            {LinearGradient ? (
              <LinearGradient colors={Gradients.primary as any} style={S.applyBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                <Ionicons name="add-circle-outline" size={20} color="#fff" />
                <Text style={S.applyBtnText}>{t('applicationStatus.applyLoan', 'Solicitar Préstamo')}</Text>
              </LinearGradient>
            ) : (
              <View style={[S.applyBtn, { backgroundColor: Colors.primary }]}>
                <Ionicons name="add-circle-outline" size={20} color="#fff" />
                <Text style={S.applyBtnText}>{t('applicationStatus.applyLoan', 'Solicitar Préstamo')}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const app = selectedApp || applications[0];
  if (!app) {
    return (
      <SafeAreaView style={S.container}>
        <View style={S.loadingWrap}>
          <ActivityIndicator size="large" color={Colors.primaryLight} />
        </View>
      </SafeAreaView>
    );
  }
  const status = STATUS_MAP[app.status] || STATUS_MAP.pending;
  
  // Default documents to request when status is info_requested but no specific docs listed
  const DEFAULT_REQUIRED_DOCS = [
    { doc_type: 'photo_id', status: 'pending' },
    { doc_type: 'pay_stub', status: 'pending' },
    { doc_type: 'proof_address', status: 'pending' },
    { doc_type: 'bank_statement', status: 'pending' },
    { doc_type: 'selfie', status: 'pending' },
  ];
  
  const required = (app.required_documents && app.required_documents.length > 0)
    ? app.required_documents
    : (['info_requested', 'pending'].includes(app.status) ? DEFAULT_REQUIRED_DOCS : []);
  const uploaded = app.uploaded_documents || [];

  return (
    <SafeAreaView style={S.container}>
      {/* Header */}
      <View style={S.header}>
        <TouchableOpacity onPress={() => router.back()} style={S.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={S.headerTitle}>{t('applicationStatus.title')}</Text>
        <TouchableOpacity onPress={onRefresh} style={S.backBtn}>
          <Ionicons name="refresh-outline" size={22} color={Colors.textMuted} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={S.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primaryLight} />}
      >
        {/* Status Banner */}
        <View style={[S.statusBanner, { borderColor: status.color + '30' }]}>
          <View style={[S.statusIconWrap, { backgroundColor: status.color + '15' }]}>
            <Ionicons name={status.icon as any} size={32} color={status.color} />
          </View>
          <Text style={[S.statusLabel, { color: status.color }]}>{status.label}</Text>
          <Text style={S.statusDesc}>{status.desc}</Text>

          {/* Amount and term — clean 2-column layout, no internal type */}
          <View style={S.amountRow}>
            <View style={[S.amountBlock, { flex: 3 }]}>
              <Text style={S.amountLabel}>{t('applicationStatus.amountRequested')}</Text>
              <Text style={S.amountValue} numberOfLines={1} adjustsFontSizeToFit>{fmt(parseFloat(app.amount_requested || app.amount || '0'))}</Text>
            </View>
            <View style={[S.amountBlock, { flex: 2 }]}>
              <Text style={S.amountLabel}>{t('applicationStatus.term')}</Text>
              <Text style={S.amountValueSmall}>{app.preferred_term || '?'} {t('applicationStatus.months')}</Text>
            </View>
          </View>
        </View>

        {/* Document Requests Section */}
        {(app.status === 'info_requested' || app.status === 'docs_submitted' || app.status === 'pending') && required.length > 0 && (
          <View style={S.section}>
            <View style={S.sectionHeader}>
              <Ionicons name="document-attach-outline" size={20} color="#6366F1" />
              <Text style={S.sectionTitle}>{t('applicationStatus.docsSection')}</Text>
            </View>
            <Text style={S.sectionSubtitle}>
              {app.status === 'info_requested'
                ? t('applicationStatus.uploadDocsDesc', 'Sube los documentos solicitados para continuar con tu solicitud.')
                : t('applicationStatus.docsSectionDesc')}
            </Text>

            {required.map((req: any) => {
              const docIcon = DOC_TYPE_ICONS[req.doc_type] || 'attach-outline';
              const docLabel = getDocLabel(req.doc_type);
              const uploadedDoc = uploaded.find((u: any) => u.doc_type === req.doc_type);
              const isUploading = uploading === req.doc_type;

              return (
                <View key={req.doc_type} style={[S.docCard, uploadedDoc && S.docCardUploaded]}>
                  <View style={S.docCardLeft}>
                    <View style={[S.docIconWrap,
                      uploadedDoc?.status === 'approved' && { backgroundColor: Colors.success + '15' },
                      uploadedDoc?.status === 'rejected' && { backgroundColor: Colors.error + '15' },
                    ]}>
                      <Ionicons name={docIcon as any} size={22}
                        color={uploadedDoc?.status === 'approved' ? Colors.success
                          : uploadedDoc?.status === 'rejected' ? Colors.error
                          : uploadedDoc ? '#818CF8' : Colors.textMuted} />
                    </View>
                    <View style={S.docCardInfo}>
                      <Text style={S.docCardTitle}>{docLabel}</Text>
                      <Text style={S.docCardStatus}>
                        {uploadedDoc?.status === 'approved' ? `✅ ${t('applicationStatus.docApproved', 'Aprobado')}`
                          : uploadedDoc?.status === 'rejected' ? `❌ ${t('applicationStatus.docRejected', 'Rechazado — Sube de nuevo')}`
                          : uploadedDoc ? `📤 ${t('applicationStatus.docSent', 'Enviado — En revisión')}`
                          : `⏳ ${t('applicationStatus.docPending', 'Pendiente')}`}
                      </Text>
                    </View>
                  </View>

                  {/* Upload button */}
                  {(!uploadedDoc || uploadedDoc.status === 'rejected') && (
                    <TouchableOpacity
                      onPress={() => showUploadOptions(app._id, req.doc_type)}
                      disabled={isUploading}
                      style={S.uploadBtn}
                    >
                      {isUploading ? (
                        <ActivityIndicator size="small" color={Colors.primaryLight} />
                      ) : (
                        <>
                          <Ionicons name="cloud-upload-outline" size={18} color={Colors.primaryLight} />
                          <Text style={S.uploadBtnText}>Subir</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}

                  {uploadedDoc && uploadedDoc.status !== 'rejected' && (
                    <View style={[S.statusDot,
                      { backgroundColor: uploadedDoc.status === 'approved' ? Colors.success : '#818CF8' }
                    ]} />
                  )}
                </View>
              );
            })}

            {/* Progress indicator */}
            <View style={S.progressRow}>
              <View style={S.progressBar}>
                <View style={[S.progressFill, {
                  width: `${required.length > 0
                    ? (uploaded.filter((u: any) => u.status !== 'rejected').length / required.length) * 100
                    : 0}%`
                }]} />
              </View>
              <Text style={S.progressText}>
                {uploaded.filter((u: any) => u.status !== 'rejected').length}/{required.length} subidos
              </Text>
            </View>
          </View>
        )}

        {/* Status Timeline */}
        {app.status_history?.length > 0 && (
          <View style={S.section}>
            <View style={S.sectionHeader}>
              <Ionicons name="time-outline" size={20} color={Colors.accent} />
              <Text style={S.sectionTitle}>Historial</Text>
            </View>
            {app.status_history.map((h: any, i: number) => {
              const hStatus = STATUS_MAP[h.status] || STATUS_MAP.pending;
              return (
                <View key={i} style={S.timelineItem}>
                  <View style={[S.timelineDot, { backgroundColor: hStatus.color }]} />
                  {i < app.status_history.length - 1 && <View style={S.timelineLine} />}
                  <View style={S.timelineContent}>
                    <Text style={[S.timelineLabel, { color: hStatus.color }]}>{hStatus.label}</Text>
                    <Text style={S.timelineDate}>
                      {h.at ? new Date(h.at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}
                    </Text>
                    {h.notes ? <Text style={S.timelineNotes}>{h.notes}</Text> : null}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Help Section */}
        <View style={S.helpSection}>
          <Ionicons name="help-circle-outline" size={20} color={Colors.textMuted} />
          <Text style={S.helpText}>{t('applicationStatus.helpText')}</Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: Colors.text },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  loadingText: { fontSize: 13, color: Colors.textMuted },
  scroll: { padding: 16 },

  // Status Banner
  statusBanner: { backgroundColor: Colors.surface, borderRadius: 20, padding: 24, borderWidth: 1, alignItems: 'center', marginBottom: 16 },
  statusIconWrap: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  statusLabel: { fontSize: 20, fontWeight: '800', marginBottom: 4 },
  statusDesc: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', lineHeight: 18, marginBottom: 20 },
  amountRow: { flexDirection: 'row', gap: 12, width: '100%' },
  amountBlock: { flex: 1, backgroundColor: Colors.card, borderRadius: 14, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  amountLabel: { fontSize: 10, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, fontWeight: '600' },
  amountValue: { fontSize: 26, fontWeight: '800', color: Colors.primaryLight },
  amountValueSmall: { fontSize: 16, fontWeight: '700', color: Colors.text },

  // Sections
  section: { backgroundColor: Colors.surface, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: Colors.border },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: Colors.text },
  sectionSubtitle: { fontSize: 12, color: Colors.textSecondary, marginBottom: 12, lineHeight: 17 },

  // Document Cards
  docCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, backgroundColor: Colors.card, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, marginBottom: 8 },
  docCardUploaded: { borderColor: '#818CF820' },
  docCardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  docIconWrap: { width: 44, height: 44, borderRadius: 12, backgroundColor: Colors.elevated, alignItems: 'center', justifyContent: 'center' },
  docCardInfo: { flex: 1 },
  docCardTitle: { fontSize: 13, fontWeight: '600', color: Colors.text, marginBottom: 2 },
  docCardStatus: { fontSize: 11, color: Colors.textMuted },
  uploadBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: Colors.primaryLight + '15', borderRadius: 10, borderWidth: 1, borderColor: Colors.primaryLight + '30' },
  uploadBtnText: { fontSize: 12, fontWeight: '700', color: Colors.primaryLight },
  statusDot: { width: 10, height: 10, borderRadius: 5 },

  // Progress
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  progressBar: { flex: 1, height: 6, backgroundColor: Colors.card, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: Colors.primaryLight, borderRadius: 3 },
  progressText: { fontSize: 11, fontWeight: '600', color: Colors.textMuted },

  // Timeline
  timelineItem: { flexDirection: 'row', gap: 12, marginBottom: 16, position: 'relative' as const },
  timelineDot: { width: 12, height: 12, borderRadius: 6, marginTop: 3 },
  timelineLine: { position: 'absolute' as const, left: 5, top: 15, bottom: -12, width: 2, backgroundColor: Colors.border },
  timelineContent: { flex: 1 },
  timelineLabel: { fontSize: 13, fontWeight: '700' },
  timelineDate: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  timelineNotes: { fontSize: 11, color: Colors.textSecondary, marginTop: 4, fontStyle: 'italic' as const },

  // Empty State
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12 },
  emptyIconWrap: { width: 80, height: 80, borderRadius: 24, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.text },
  emptyDesc: { fontSize: 13, color: Colors.textMuted, textAlign: 'center' },
  applyBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 14 },
  applyBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },

  // Help
  helpSection: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 12 },
  helpText: { fontSize: 11, color: Colors.textMuted, flex: 1, lineHeight: 16 },
});
