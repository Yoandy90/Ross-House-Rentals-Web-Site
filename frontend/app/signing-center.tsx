import React, { useEffect, useState, useCallback, useRef } from 'react';
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
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, G, Line, Circle } from 'react-native-svg';
import { apiCall } from '../src/utils/api';
import { Spacing, FontSizes, BorderRadius, Shadows, useColors } from '../src/constants/theme';
import { GaugeChart, MiniStatCard } from '../src/components/ui/GaugeChart';

// ─── Types ─────────────────────────────────────────────
interface PendingDoc {
  id: string;
  type: 'contract' | 'document';
  title: string;
  description: string;
  status: 'pending' | 'signed' | 'waiting';
  needs_my_signature: boolean;
  signed_by_me: boolean;
  property_address?: string;
  created_at: string;
  parties?: { tenant?: string; landlord?: string };
  signatures?: { admin?: boolean; tenant?: boolean; landlord?: boolean };
}

// ─── Signature Canvas ──────────────────────────────────
function SignatureCanvas({
  visible,
  onClose,
  onSave,
  signerName,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (data: string, method: string) => void;
  signerName: string;
}) {
  const C = useColors();
  const CS = React.useMemo(() => createCS(C), [C]);
  const { t } = useTranslation();
  const [paths, setPaths] = useState<{ x: number; y: number }[][]>([]);
  const [currentPath, setCurrentPath] = useState<{ x: number; y: number }[]>([]);
  const [isTopazConnected] = useState(false); // Would detect Topaz pad on web
  const canvasRef = useRef<View>(null);

  const isWeb = Platform.OS === 'web';

  const handleTouchStart = (e: any) => {
    const touch = e.nativeEvent;
    setCurrentPath([{ x: touch.locationX, y: touch.locationY }]);
  };

  const handleTouchMove = (e: any) => {
    const touch = e.nativeEvent;
    setCurrentPath(prev => [...prev, { x: touch.locationX, y: touch.locationY }]);
  };

  const handleTouchEnd = () => {
    if (currentPath.length > 1) {
      setPaths(prev => [...prev, currentPath]);
    }
    setCurrentPath([]);
  };

  const clearSignature = () => {
    setPaths([]);
    setCurrentPath([]);
  };

  const allPaths = [...paths, ...(currentPath.length > 0 ? [currentPath] : [])];
  const hasSignature = paths.length > 0;

  const pathToSvgD = (points: { x: number; y: number }[]) => {
    if (points.length < 2) return '';
    return points.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(' ');
  };

  const handleSave = () => {
    if (!hasSignature) {
      Alert.alert('Error', t('signatures.draw_first'));
      return;
    }
    // Generate SVG string as signature data
    const svgPaths = paths.map(p => pathToSvgD(p)).join(' ');
    const svgData = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 340 200"><path d="${svgPaths}" stroke="#C8102E" stroke-width="2.5" fill="none" stroke-linecap="round"/></svg>`;
    const base64 = btoa(svgData);
    onSave(`data:image/svg+xml;base64,${base64}`, isTopazConnected ? 'topaz' : 'touch');
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={CS.overlay}>
        <View style={CS.container}>
          <LinearGradient
            colors={['rgba(20,20,24,0.98)', 'rgba(12,12,14,0.98)']}
            style={StyleSheet.absoluteFill}
          />

          {/* Header */}
          <View style={CS.header}>
            <TouchableOpacity onPress={onClose} style={CS.closeBtn}>
              <Ionicons name="close" size={22} color={C.white} />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={CS.headerTitle}>{t('signatures.sign_document')}</Text>
              <Text style={CS.headerSub}>{signerName}</Text>
            </View>
            {isWeb && (
              <View style={[CS.methodBadge, isTopazConnected ? CS.topazBadge : CS.touchBadge]}>
                <Ionicons
                  name={isTopazConnected ? 'hardware-chip-outline' : 'finger-print-outline'}
                  size={14}
                  color={isTopazConnected ? '#635BFF' : C.textMuted}
                />
                <Text style={[CS.methodText, isTopazConnected && { color: '#635BFF' }]}>
                  {isTopazConnected ? 'Topaz' : 'Touch'}
                </Text>
              </View>
            )}
          </View>

          {/* Signature Area */}
          <View style={CS.canvasWrap}>
            <View style={CS.canvasLabel}>
              <Ionicons name="create-outline" size={14} color={C.textMuted} />
              <Text style={CS.canvasLabelText}>{t('signatures.draw_here')}</Text>
            </View>

            <View
              ref={canvasRef}
              style={CS.canvas}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              {...(isWeb ? {
                onMouseDown: handleTouchStart,
                onMouseMove: (e: any) => {
                  if (currentPath.length > 0) handleTouchMove(e);
                },
                onMouseUp: handleTouchEnd,
              } as any : {})}
            >
              <Svg width="100%" height="100%" viewBox="0 0 340 200">
                {/* Guide line */}
                <Line x1="20" y1="160" x2="320" y2="160" stroke="rgba(255,255,255,0.06)" strokeWidth="1" strokeDasharray="4,4" />
                <Circle cx="25" cy="160" r="2" fill="rgba(200,16,46,0.3)" />

                {/* Signature paths */}
                {allPaths.map((path, i) => (
                  <Path
                    key={i}
                    d={pathToSvgD(path)}
                    stroke={C.brandRed}
                    strokeWidth={2.5}
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ))}
              </Svg>

              {!hasSignature && currentPath.length === 0 && (
                <View style={CS.placeholder}>
                  <Ionicons name="create" size={40} color="rgba(255,255,255,0.06)" />
                </View>
              )}
            </View>
          </View>

          {/* Topaz Status for Web */}
          {isWeb && (
            <View style={CS.topazRow}>
              <View style={[CS.topazDot, { backgroundColor: isTopazConnected ? C.success : C.textDim }]} />
              <Text style={CS.topazStatus}>
                {isTopazConnected
                  ? 'Topaz Pad conectado — firme en el pad'
                  : 'Topaz no detectado — use firma táctil'}
              </Text>
            </View>
          )}

          {/* Actions */}
          <View style={CS.actions}>
            <TouchableOpacity style={CS.clearBtn} onPress={clearSignature}>
              <Ionicons name="refresh" size={18} color={C.textMuted} />
              <Text style={CS.clearBtnText}>{t('signatures.clear')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[CS.saveBtn, !hasSignature && { opacity: 0.4 }]}
              onPress={handleSave}
              disabled={!hasSignature}
            >
              <LinearGradient
                colors={['#C8102E', '#9B1B30']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[StyleSheet.absoluteFill, { borderRadius: 14 }]}
              />
              <Ionicons name="checkmark-circle" size={20} color="#fff" />
              <Text style={CS.saveBtnText}>{t('signatures.confirm_sign')}</Text>
            </TouchableOpacity>
          </View>

          {/* Legal Text */}
          <Text style={CS.legalText}>
            {t('signatures.legal_text')}
          </Text>
        </View>
      </View>
    </Modal>
  );
}

// Canvas styles
const createCS = (C: any) => StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  container: {
    backgroundColor: C.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: 40,
    overflow: 'hidden',
    position: 'relative',
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  closeBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: C.glass,
    borderWidth: 1, borderColor: C.glassBorder,
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: FontSizes.lg, fontWeight: '800', color: C.white, letterSpacing: -0.3 },
  headerSub: { fontSize: FontSizes.xs, color: C.textMuted, marginTop: 1 },
  methodBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: BorderRadius.full, borderWidth: 1,
  },
  touchBadge: { backgroundColor: C.glass, borderColor: C.glassBorder },
  topazBadge: { backgroundColor: 'rgba(99,91,255,0.08)', borderColor: 'rgba(99,91,255,0.20)' },
  methodText: { fontSize: 11, fontWeight: '700', color: C.textMuted },
  canvasWrap: { marginBottom: 16 },
  canvasLabel: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  canvasLabelText: { fontSize: FontSizes.xs, color: C.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  canvas: {
    height: 200, borderRadius: 16,
    backgroundColor: C.glass,
    borderWidth: 1.5, borderColor: 'rgba(200,16,46,0.15)',
    overflow: 'hidden', position: 'relative',
  },
  placeholder: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center', alignItems: 'center',
  },
  topazRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  topazDot: { width: 8, height: 8, borderRadius: 4 },
  topazStatus: { fontSize: FontSizes.xs, color: C.textMuted },
  actions: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  clearBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    flex: 1, height: 52, borderRadius: 14,
    backgroundColor: C.glass,
    borderWidth: 1, borderColor: C.glassBorder,
  },
  clearBtnText: { fontSize: FontSizes.sm, color: C.textMuted, fontWeight: '600' },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    flex: 2, height: 52, borderRadius: 14, overflow: 'hidden',
    ...Shadows.button,
  },
  saveBtnText: { fontSize: FontSizes.md, color: C.textPrimary, fontWeight: '700' },
  legalText: {
    fontSize: 10, color: C.textDim, textAlign: 'center', lineHeight: 14,
  },
});

// ═══════════════════════════════════════════════════════
//  Main Signing Center Screen
// ═══════════════════════════════════════════════════════
export default function SigningCenterScreen() {
  const C = useColors();
  const S = React.useMemo(() => createS(C), [C]);
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [docs, setDocs] = useState<PendingDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [signingDoc, setSigningDoc] = useState<PendingDoc | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchDocs = useCallback(async () => {
    try {
      const data = await apiCall('/signatures/pending');
      setDocs(data.documents || []);
    } catch (err) {
      console.log('Signatures fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchDocs(); }, []);
  const onRefresh = () => { setRefreshing(true); fetchDocs(); };

  const pendingCount = docs.filter(d => d.needs_my_signature).length;
  const signedCount = docs.filter(d => d.signed_by_me).length;

  const handleSign = async (signatureData: string, method: string) => {
    if (!signingDoc) return;
    setSubmitting(true);
    try {
      await apiCall('/signatures/sign', {
        method: 'POST',
        body: {
          document_id: signingDoc.id,
          document_type: signingDoc.type,
          signature_data: signatureData,
          method: method,
          device_info: `${Platform.OS} - ${Platform.Version || 'web'}`,
        },
      });
      Alert.alert('✅', t('signatures.signed_success'));
      setSigningDoc(null);
      fetchDocs(); // Refresh
    } catch (err: any) {
      Alert.alert('Error', err.message || t('signatures.sign_error'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={[S.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={C.brandRed} />
      </View>
    );
  }

  return (
    <View style={S.root}>
      <View style={S.bgGlow1} />
      <View style={S.bgGlow2} />

      <ScrollView
        style={[S.container, { paddingTop: insets.top }]}
        contentContainerStyle={S.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.brandRed} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={S.header}>
          <TouchableOpacity onPress={() => router.back()} style={S.backBtn}>
            <Ionicons name="arrow-back" size={22} color={C.textPrimary} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={S.headerTitle}>{t('signatures.center_title')}</Text>
            <Text style={S.headerSub}>{t('signatures.center_subtitle')}</Text>
          </View>
        </View>

        {/* Gauge: Signing Progress */}
        <GaugeChart
          value={signedCount}
          maxValue={Math.max(docs.length, 1)}
          label={t('signatures.signed')}
          icon="create"
          iconColor={C.success}
          gradientStart="#059669"
          gradientEnd="#10B981"
          formatValue={(v) => `${v}`}
          formatMax={(v) => `${v}`}
          size={200}
        />
        <View style={{ height: 10 }} />

        {/* Mini Stats */}
        <View style={S.miniRow}>
          <MiniStatCard
            icon="alert-circle"
            iconColor={C.brandRed}
            value={pendingCount}
            label={t('signatures.pending')}
          />
          <MiniStatCard
            icon="checkmark-circle"
            iconColor={C.success}
            value={signedCount}
            label={t('signatures.completed')}
          />
        </View>

        {/* Topaz Info Banner */}
        {Platform.OS === 'web' && (
          <View style={S.topazBanner}>
            <LinearGradient
              colors={['rgba(99,91,255,0.08)', 'rgba(99,91,255,0.02)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[StyleSheet.absoluteFill, { borderRadius: BorderRadius.card }]}
            />
            <View style={S.topazBannerIcon}>
              <Ionicons name="hardware-chip-outline" size={22} color="#635BFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={S.topazBannerTitle}>Topaz Signature Pad</Text>
              <Text style={S.topazBannerDesc}>{t('signatures.topaz_desc')}</Text>
            </View>
          </View>
        )}

        {/* Document List */}
        <Text style={S.sectionLabel}>{t('signatures.documents')}</Text>

        {docs.length === 0 ? (
          <View style={S.emptyContainer}>
            <View style={S.emptyIcon}>
              <Ionicons name="document-text-outline" size={48} color={C.textMuted} />
            </View>
            <Text style={S.emptyTitle}>{t('signatures.no_documents')}</Text>
            <Text style={S.emptyDesc}>{t('signatures.no_documents_desc')}</Text>
          </View>
        ) : (
          docs.map((doc, i) => (
            <TouchableOpacity
              key={doc.id}
              style={S.docCard}
              onPress={() => {
                if (doc.needs_my_signature) {
                  setSigningDoc(doc);
                }
              }}
              activeOpacity={doc.needs_my_signature ? 0.7 : 1}
            >
              <View style={[
                S.docAccent,
                { backgroundColor: doc.needs_my_signature ? C.brandRed : doc.signed_by_me ? C.success : C.textDim }
              ]} />

              <View style={S.docRow}>
                <View style={[
                  S.docIcon,
                  {
                    backgroundColor: doc.needs_my_signature
                      ? 'rgba(200,16,46,0.10)'
                      : doc.signed_by_me
                        ? 'rgba(16,185,129,0.10)'
                        : 'rgba(255,255,255,0.03)',
                  }
                ]}>
                  <Ionicons
                    name={doc.type === 'contract' ? 'document-text' : 'receipt'}
                    size={22}
                    color={doc.needs_my_signature ? C.brandRed : doc.signed_by_me ? C.success : C.textMuted}
                  />
                </View>

                <View style={S.docInfo}>
                  <Text style={S.docTitle} numberOfLines={1}>{doc.title}</Text>
                  <Text style={S.docDesc} numberOfLines={1}>{doc.description}</Text>
                  {doc.property_address && (
                    <View style={S.docAddressRow}>
                      <Ionicons name="location-outline" size={11} color={C.textDim} />
                      <Text style={S.docAddress} numberOfLines={1}>{doc.property_address}</Text>
                    </View>
                  )}
                </View>

                <View style={S.docRight}>
                  {doc.needs_my_signature ? (
                    <View style={S.signBadge}>
                      <Text style={S.signBadgeText}>{t('signatures.sign_now')}</Text>
                    </View>
                  ) : doc.signed_by_me ? (
                    <Ionicons name="checkmark-circle" size={24} color={C.success} />
                  ) : (
                    <Ionicons name="time-outline" size={22} color={C.textDim} />
                  )}
                </View>
              </View>

              {/* Signature status dots */}
              {doc.signatures && (
                <View style={S.sigDotsRow}>
                  {Object.entries(doc.signatures).map(([role, isSigned]) => (
                    <View key={role} style={S.sigDot}>
                      <View style={[S.sigDotCircle, { backgroundColor: isSigned ? C.success : 'rgba(255,255,255,0.06)' }]} />
                      <Text style={S.sigDotLabel}>{role}</Text>
                    </View>
                  ))}
                </View>
              )}
            </TouchableOpacity>
          ))
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Signature Modal */}
      <SignatureCanvas
        visible={!!signingDoc}
        onClose={() => setSigningDoc(null)}
        onSave={handleSign}
        signerName={signingDoc?.title || ''}
      />
    </View>
  );
}

// ─── Main Styles ──────────────────────────────────────
const createS = (C: any) => StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },
  container: { flex: 1 },
  content: { paddingHorizontal: Spacing.base },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.background },

  bgGlow1: {
    position: 'absolute', top: -60, right: -40, width: 200, height: 200,
    borderRadius: 100, backgroundColor: '#635BFF', opacity: 0.04,
  },
  bgGlow2: {
    position: 'absolute', bottom: '30%', left: -50, width: 160, height: 160,
    borderRadius: 80, backgroundColor: C.brandRed, opacity: 0.03,
  },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: Spacing.md,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: C.glass,
    borderWidth: 1, borderColor: C.glassBorder,
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: FontSizes['2xl'], fontWeight: '800', color: C.textPrimary, letterSpacing: -0.5 },
  headerSub: { fontSize: FontSizes.xs, color: C.textMuted },

  miniRow: { flexDirection: 'row', gap: 10, marginBottom: Spacing.md },

  topazBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: BorderRadius.card, padding: Spacing.base,
    borderWidth: 1, borderColor: 'rgba(99,91,255,0.15)',
    marginBottom: Spacing.md, overflow: 'hidden', position: 'relative',
  },
  topazBannerIcon: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: 'rgba(99,91,255,0.12)',
    justifyContent: 'center', alignItems: 'center',
  },
  topazBannerTitle: { fontSize: FontSizes.sm, fontWeight: '700', color: '#635BFF' },
  topazBannerDesc: { fontSize: FontSizes.xs, color: C.textMuted, marginTop: 2 },

  sectionLabel: {
    fontSize: FontSizes.xs, fontWeight: '700', color: C.textMuted,
    textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 12, marginTop: 4,
  },

  emptyContainer: { alignItems: 'center', paddingTop: 40 },
  emptyIcon: {
    width: 80, height: 80, borderRadius: 24,
    backgroundColor: C.glass,
    borderWidth: 1, borderColor: C.glassBorder,
    justifyContent: 'center', alignItems: 'center',
  },
  emptyTitle: { fontSize: FontSizes.lg, fontWeight: '700', color: C.textPrimary, marginTop: 16 },
  emptyDesc: { fontSize: FontSizes.sm, color: C.textMuted, marginTop: 6, textAlign: 'center', maxWidth: 260 },

  // Document Cards
  docCard: {
    backgroundColor: C.glass,
    borderRadius: BorderRadius.card,
    borderWidth: 1, borderColor: C.glassBorder,
    marginBottom: 10, overflow: 'hidden', position: 'relative',
    padding: Spacing.base,
  },
  docAccent: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 2,
  },
  docRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  docIcon: {
    width: 48, height: 48, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
  },
  docInfo: { flex: 1 },
  docTitle: { fontSize: FontSizes.base, fontWeight: '700', color: C.textPrimary },
  docDesc: { fontSize: FontSizes.xs, color: C.textMuted, marginTop: 2 },
  docAddressRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  docAddress: { fontSize: 10, color: C.textDim },
  docRight: { alignItems: 'center' },

  signBadge: {
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(200,16,46,0.10)',
    borderWidth: 1, borderColor: 'rgba(200,16,46,0.20)',
  },
  signBadgeText: { fontSize: 11, fontWeight: '700', color: C.brandRed },

  sigDotsRow: {
    flexDirection: 'row', gap: 16, marginTop: 12, paddingTop: 10,
    borderTopWidth: 1, borderTopColor: C.glassBorder,
  },
  sigDot: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sigDotCircle: { width: 8, height: 8, borderRadius: 4 },
  sigDotLabel: { fontSize: 10, color: C.textDim, fontWeight: '600', textTransform: 'capitalize' },
});
