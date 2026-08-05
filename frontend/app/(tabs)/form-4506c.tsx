/**
 * Form 4506-C - Client E-Signature Screen
 * IRS Transcript Authorization
 */
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Dimensions,
  Platform,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import {
  GestureDetector,
  Gesture,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import api from '../../services/api';
import { useTranslation } from 'react-i18next';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CANVAS_WIDTH = SCREEN_WIDTH - 64;
const CANVAS_HEIGHT = 160;

interface PendingForm {
  id: string;
  form_id: string;
  taxpayer_name: string;
  transcript_types: string[];
  tax_years: string[];
  created_at: string;
  expires_at: string;
  third_party_name: string;
}

interface FormDetail {
  id: string;
  form_id: string;
  taxpayer_name: string;
  spouse_name: string;
  taxpayer_ssn_last4: string;
  client_email: string;
  current_address: { street: string; city: string; state: string; zip: string };
  transcript_types: string[];
  tax_years: string[];
  filing_status: string;
  third_party_name: string;
  signature_status: string;
  notes: string;
}

interface SignedForm {
  id: string;
  form_id: string;
  taxpayer_name: string;
  transcript_types: string[];
  tax_years: string[];
  signed_at: string;
  expires_at: string;
  signature_type: string;
}

export default function Form4506CScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pending, setPending] = useState<PendingForm[]>([]);
  const [signed, setSigned] = useState<SignedForm[]>([]);

  // Sign flow
  const [selectedForm, setSelectedForm] = useState<FormDetail | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [paths, setPaths] = useState<string[]>([]);
  const [currentPath, setCurrentPath] = useState<string>('');
  const [signing, setSigning] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [pendingRes, signedRes] = await Promise.all([
        api.get('/client/form-4506c/pending'),
        api.get('/client/form-4506c/signed'),
      ]);
      setPending(Array.isArray(pendingRes.data) ? pendingRes.data : []);
      setSigned(Array.isArray(signedRes.data) ? signedRes.data : []);
    } catch (err) {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadData();
    }, [loadData])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const openSignFlow = async (formId: string) => {
    try {
      const res = await api.get(`/client/form-4506c/${formId}`);
      setSelectedForm(res.data);
      setAgreed(false);
      setPaths([]);
      setCurrentPath('');
      setShowSuccess(false);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.detail || 'Error loading form');
    }
  };

  // Gesture for signature
  const panGesture = Gesture.Pan()
    .onStart((e) => {
      setCurrentPath(`M${e.x},${e.y}`);
    })
    .onUpdate((e) => {
      setCurrentPath((prev) => `${prev} L${e.x},${e.y}`);
    })
    .onEnd(() => {
      if (currentPath) {
        setPaths((prev) => [...prev, currentPath]);
        setCurrentPath('');
      }
    })
    .minDistance(1);

  const clearSignature = () => {
    setPaths([]);
    setCurrentPath('');
  };

  const hasSignature = paths.length > 0 || currentPath.length > 0;

  // Convert SVG paths to a simple base64 representation
  const getSignatureData = (): string => {
    return `svg:${JSON.stringify([...paths, currentPath].filter(Boolean))}`;
  };

  const handleSubmitSignature = async () => {
    if (!selectedForm) return;
    if (!agreed) {
      Alert.alert('', t('form4506c.agreeConsent'));
      return;
    }
    if (!hasSignature) {
      Alert.alert('', t('form4506c.signHere'));
      return;
    }

    try {
      setSigning(true);
      await api.post(`/client/form-4506c/${selectedForm.form_id}/sign`, {
        type: 'canvas',
        image_data: getSignatureData(),
        device_info: Platform.OS,
      });
      setShowSuccess(true);
      await loadData();
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.detail || 'Error signing form');
    } finally {
      setSigning(false);
    }
  };

  const getTypeLabel = (type: string) => {
    const key = `form4506c.types.${type}`;
    const translated = t(key);
    return translated !== key ? translated : type;
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      return new Date(dateStr).toLocaleDateString();
    } catch {
      return dateStr;
    }
  };

  // ═══════ SUCCESS SCREEN ═══════
  if (showSuccess) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.successContainer}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark-circle" size={80} color="#10B981" />
          </View>
          <Text style={styles.successTitle}>{t('form4506c.signSuccess')}</Text>
          <Text style={styles.successDesc}>{t('form4506c.signSuccessDesc')}</Text>
          <TouchableOpacity
            style={styles.successButton}
            onPress={() => {
              setSelectedForm(null);
              setShowSuccess(false);
            }}
          >
            <Text style={styles.successButtonText}>OK</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ═══════ SIGN FLOW ═══════
  if (selectedForm) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={[styles.container, { paddingTop: 0 }]}>
          <LinearGradient colors={['#312E81', '#4338CA']} style={styles.headerGradient}>
            <View style={[styles.headerContent, { paddingTop: insets.top + 12 }]}>
              <TouchableOpacity
                onPress={() => setSelectedForm(null)}
                style={styles.backButton}
              >
                <Ionicons name="arrow-back" size={24} color="#fff" />
              </TouchableOpacity>
              <View style={styles.headerCenter}>
                <Text style={styles.headerTitle}>Form 4506-C</Text>
                <Text style={styles.headerSubtitle}>{t('form4506c.reviewAndSign')}</Text>
              </View>
              <View style={{ width: 40 }} />
            </View>
          </LinearGradient>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* IRS Banner */}
            <View style={styles.irsBanner}>
              <Ionicons name="shield-checkmark" size={20} color="#1E40AF" />
              <Text style={styles.irsBannerText}>
                IRS Form 4506-C — IVES Request for Transcript
              </Text>
            </View>

            {/* Form Details */}
            <View style={styles.detailCard}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>{t('form4506c.transcriptTypes')}</Text>
                <View style={styles.chipContainer}>
                  {selectedForm.transcript_types.map((type) => (
                    <View key={type} style={styles.chip}>
                      <Text style={styles.chipText}>{getTypeLabel(type)}</Text>
                    </View>
                  ))}
                </View>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>{t('form4506c.taxYears')}</Text>
                <Text style={styles.detailValue}>{selectedForm.tax_years.join(', ')}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>{t('form4506c.thirdParty')}</Text>
                <Text style={styles.detailValue}>{selectedForm.third_party_name}</Text>
              </View>
              {selectedForm.current_address?.street ? (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{t('form4506c.addressLine', 'Dirección')}</Text>
                  <Text style={styles.detailValue}>
                    {selectedForm.current_address.street}, {selectedForm.current_address.city}{' '}
                    {selectedForm.current_address.state} {selectedForm.current_address.zip}
                  </Text>
                </View>
              ) : null}
            </View>

            {/* Consent */}
            <View style={styles.consentCard}>
              <View style={styles.consentHeader}>
                <Ionicons name="warning" size={20} color="#D97706" />
                <Text style={styles.consentTitle}>{t('form4506c.consentTitle')}</Text>
              </View>
              <Text style={styles.consentText}>{t('form4506c.consentText')}</Text>
              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() => setAgreed(!agreed)}
                activeOpacity={0.7}
              >
                <View style={[styles.checkbox, agreed && styles.checkboxChecked]}>
                  {agreed && <Ionicons name="checkmark" size={16} color="#fff" />}
                </View>
                <Text style={styles.checkboxLabel}>{t('form4506c.agreeConsent')}</Text>
              </TouchableOpacity>
            </View>

            {/* Signature Canvas */}
            <View style={styles.signatureSection}>
              <Text style={styles.signatureLabel}>{t('form4506c.signHere')} ✍️</Text>
              <View style={styles.canvasContainer}>
                <GestureDetector gesture={panGesture}>
                  <View style={styles.canvas}>
                    <Svg width={CANVAS_WIDTH} height={CANVAS_HEIGHT}>
                      {paths.map((path, i) => (
                        <Path
                          key={i}
                          d={path}
                          stroke="#000"
                          strokeWidth={2.5}
                          fill="none"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      ))}
                      {currentPath ? (
                        <Path
                          d={currentPath}
                          stroke="#000"
                          strokeWidth={2.5}
                          fill="none"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      ) : null}
                    </Svg>
                    {!hasSignature && (
                      <View style={styles.canvasPlaceholder}>
                        <Text style={styles.canvasPlaceholderText}>✍️</Text>
                      </View>
                    )}
                  </View>
                </GestureDetector>
                <View style={styles.signatureLine} />
              </View>

              <View style={styles.signatureActions}>
                <TouchableOpacity style={styles.clearButton} onPress={clearSignature}>
                  <Ionicons name="trash-outline" size={18} color="#EF4444" />
                  <Text style={styles.clearButtonText}>{t('form4506c.clearSignature')}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Submit */}
            <TouchableOpacity
              style={[
                styles.submitButton,
                (!agreed || !hasSignature) && styles.submitButtonDisabled,
              ]}
              onPress={handleSubmitSignature}
              disabled={!agreed || !hasSignature || signing}
              activeOpacity={0.8}
            >
              {signing ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={22} color="#fff" />
                  <Text style={styles.submitButtonText}>
                    {t('form4506c.submitSignature')}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <Text style={styles.securityNote}>
              🔒 SHA-256 encrypted • ESIGN Act compliant • Valid 120 days
            </Text>

            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </GestureHandlerRootView>
    );
  }

  // ═══════ MAIN LIST SCREEN ═══════
  return (
    <View style={[styles.container, { paddingTop: 0 }]}>
      <LinearGradient colors={['#312E81', '#4338CA']} style={styles.headerGradient}>
        <View style={[styles.headerContent, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>{t('form4506c.title')}</Text>
            <Text style={styles.headerSubtitle}>{t('form4506c.subtitle')}</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4338CA" />
        }
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.centerContent}>
            <ActivityIndicator size="large" color="#4338CA" />
          </View>
        ) : (
          <>
            {/* Pending */}
            {pending.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View style={styles.pendingBadge}>
                    <Text style={styles.pendingBadgeText}>{pending.length}</Text>
                  </View>
                  <Text style={styles.sectionTitle}>{t('form4506c.pendingTitle')}</Text>
                </View>

                {pending.map((form) => (
                  <TouchableOpacity
                    key={form.form_id}
                    style={styles.pendingCard}
                    onPress={() => openSignFlow(form.form_id)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.pendingCardTop}>
                      <View style={styles.pendingIconContainer}>
                        <Ionicons name="document-text" size={28} color="#4338CA" />
                      </View>
                      <View style={styles.pendingCardInfo}>
                        <Text style={styles.pendingCardTitle}>Form 4506-C</Text>
                        <Text style={styles.pendingCardSubtitle}>
                          {form.transcript_types.map(getTypeLabel).join(', ')}
                        </Text>
                        <Text style={styles.pendingCardYears}>
                          {t('form4506c.taxYears')}: {form.tax_years.join(', ')}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.pendingCardBottom}>
                      <Text style={styles.pendingCardDate}>
                        {t('form4506c.expiresOn')}: {formatDate(form.expires_at)}
                      </Text>
                      <View style={styles.signButton}>
                        <Ionicons name="create-outline" size={16} color="#fff" />
                        <Text style={styles.signButtonText}>{t('form4506c.reviewAndSign')}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Signed */}
            {signed.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{t('form4506c.signedTitle')}</Text>
                {signed.map((form) => (
                  <View key={form.form_id} style={styles.signedCard}>
                    <View style={styles.signedCardLeft}>
                      <Ionicons name="checkmark-circle" size={24} color="#10B981" />
                    </View>
                    <View style={styles.signedCardCenter}>
                      <Text style={styles.signedCardTitle}>
                        {form.transcript_types.map(getTypeLabel).join(', ')}
                      </Text>
                      <Text style={styles.signedCardMeta}>
                        {form.tax_years.join(', ')} • {t('form4506c.signedOn')}: {formatDate(form.signed_at)}
                      </Text>
                    </View>
                    <View style={styles.signedTypeBadge}>
                      <Text style={styles.signedTypeText}>
                        {form.signature_type === 'topaz' ? '🖊️' : '✍️'}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Empty State */}
            {pending.length === 0 && signed.length === 0 && (
              <View style={styles.emptyState}>
                <View style={styles.emptyIconContainer}>
                  <Ionicons name="document-text-outline" size={64} color="#C7D2FE" />
                </View>
                <Text style={styles.emptyTitle}>{t('form4506c.noPending')}</Text>
                <Text style={styles.emptyDesc}>{t('form4506c.noPendingDesc')}</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F3FF' },
  headerGradient: { paddingBottom: 24 },
  headerContent: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 8 },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#fff' },
  headerSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 100 },
  centerContent: { paddingTop: 60, alignItems: 'center' },

  // Sections
  section: { marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#1E1B4B', marginLeft: 8 },
  pendingBadge: { backgroundColor: '#EF4444', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3, minWidth: 28, alignItems: 'center' },
  pendingBadgeText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  // Pending Card
  pendingCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12,
    borderLeftWidth: 4, borderLeftColor: '#4338CA',
    ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 12 }, android: { elevation: 4 } }),
  },
  pendingCardTop: { flexDirection: 'row', marginBottom: 12 },
  pendingIconContainer: { width: 50, height: 50, borderRadius: 12, backgroundColor: '#EEF2FF', justifyContent: 'center', alignItems: 'center' },
  pendingCardInfo: { flex: 1, marginLeft: 12 },
  pendingCardTitle: { fontSize: 16, fontWeight: '700', color: '#1E1B4B' },
  pendingCardSubtitle: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  pendingCardYears: { fontSize: 12, color: '#9CA3AF', marginTop: 4 },
  pendingCardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 12 },
  pendingCardDate: { fontSize: 12, color: '#9CA3AF' },
  signButton: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#4338CA', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  signButtonText: { color: '#fff', fontSize: 13, fontWeight: '600' },

  // Signed Card
  signedCard: {
    backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 8,
    flexDirection: 'row', alignItems: 'center',
    ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 6 }, android: { elevation: 2 } }),
  },
  signedCardLeft: { marginRight: 12 },
  signedCardCenter: { flex: 1 },
  signedCardTitle: { fontSize: 14, fontWeight: '600', color: '#111827' },
  signedCardMeta: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  signedTypeBadge: { paddingHorizontal: 8 },
  signedTypeText: { fontSize: 18 },

  // Empty State
  emptyState: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 32 },
  emptyIconContainer: { width: 120, height: 120, borderRadius: 60, backgroundColor: '#EEF2FF', justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#1E1B4B', textAlign: 'center', marginBottom: 12 },
  emptyDesc: { fontSize: 15, color: '#6B7280', textAlign: 'center', lineHeight: 22 },

  // ═══════ Sign Flow ═══════
  irsBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#DBEAFE', borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#93C5FD' },
  irsBannerText: { fontSize: 13, fontWeight: '600', color: '#1E40AF', flex: 1 },

  detailCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16,
    ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 8 }, android: { elevation: 2 } }),
  },
  detailRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  detailLabel: { fontSize: 12, color: '#6B7280', marginBottom: 4 },
  detailValue: { fontSize: 14, fontWeight: '600', color: '#111827' },
  chipContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  chip: { backgroundColor: '#EEF2FF', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  chipText: { fontSize: 12, color: '#4338CA', fontWeight: '600' },

  consentCard: {
    backgroundColor: '#FFFBEB', borderRadius: 16, padding: 16, marginBottom: 16,
    borderWidth: 1, borderColor: '#FDE68A',
  },
  consentHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  consentTitle: { fontSize: 15, fontWeight: '700', color: '#92400E' },
  consentText: { fontSize: 13, color: '#78350F', lineHeight: 20 },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', marginTop: 16, gap: 10 },
  checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: '#D97706', justifyContent: 'center', alignItems: 'center' },
  checkboxChecked: { backgroundColor: '#D97706', borderColor: '#D97706' },
  checkboxLabel: { fontSize: 13, color: '#78350F', flex: 1, fontWeight: '600' },

  signatureSection: { marginBottom: 16 },
  signatureLabel: { fontSize: 15, fontWeight: '700', color: '#1E1B4B', marginBottom: 8 },
  canvasContainer: {
    backgroundColor: '#fff', borderRadius: 16, padding: 4, borderWidth: 2, borderColor: '#C7D2FE', borderStyle: 'dashed',
    ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 8 }, android: { elevation: 2 } }),
  },
  canvas: { width: CANVAS_WIDTH, height: CANVAS_HEIGHT, backgroundColor: '#FAFAFF', borderRadius: 12, overflow: 'hidden' },
  canvasPlaceholder: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' },
  canvasPlaceholderText: { fontSize: 40, opacity: 0.2 },
  signatureLine: { height: 1, backgroundColor: '#C7D2FE', marginHorizontal: 16, marginTop: -20, marginBottom: 16 },
  signatureActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 },
  clearButton: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8 },
  clearButtonText: { fontSize: 13, color: '#EF4444', fontWeight: '600' },

  submitButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#4338CA', paddingVertical: 16, borderRadius: 14, marginBottom: 12,
  },
  submitButtonDisabled: { opacity: 0.4 },
  submitButtonText: { color: '#fff', fontSize: 17, fontWeight: '700' },

  securityNote: { fontSize: 11, color: '#9CA3AF', textAlign: 'center' },

  // Success
  successContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  successIcon: { marginBottom: 24 },
  successTitle: { fontSize: 22, fontWeight: '700', color: '#065F46', textAlign: 'center', marginBottom: 12 },
  successDesc: { fontSize: 15, color: '#6B7280', textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  successButton: { backgroundColor: '#10B981', paddingHorizontal: 40, paddingVertical: 14, borderRadius: 12 },
  successButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
