import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
  Platform,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../../services/api';
import { format } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

interface TaxReturn {
  id: string;
  tax_year: string | number;
  status: string;
  status_display?: { label: string; color: string };
  federal_refund?: number;
  state_refund?: number;
  total_refund?: number;
  refund_amount?: number;
  tax_owed?: number;
  total_income?: number;
  accepted_at?: string;
  rejected_at?: string;
  filed_date?: string;
  created_at: string;
  has_federal_pdf?: boolean;
  has_state_pdf?: boolean;
  rejection_reason?: {
    title?: string;
    description?: string;
    action_required?: string;
  };
  notes?: string;
}

// Status pipeline steps
const STATUS_PIPELINE = [
  { key: 'completed', label: 'Preparada', icon: 'create-outline' },
  { key: 'submitted', label: 'Enviada', icon: 'send-outline' },
  { key: 'processing', label: 'En revisión', icon: 'hourglass-outline' },
  { key: 'accepted', label: 'Aceptada', icon: 'checkmark-circle-outline' },
];

function getStatusStep(status: string): number {
  switch (status) {
    case 'completed': return 0;
    case 'submitted': return 1;
    case 'processing': return 2;
    case 'accepted': return 3;
    default: return 0;
  }
}

function getStatusConfig(status: string) {
  switch (status) {
    case 'accepted':
      return { label: 'Aceptada por IRS', color: '#10B981', bgColor: '#ECFDF5', icon: 'checkmark-circle' as const };
    case 'rejected':
      return { label: 'Rechazada', color: '#EF4444', bgColor: '#FEF2F2', icon: 'close-circle' as const };
    case 'submitted':
      return { label: 'Enviada al IRS', color: '#3B82F6', bgColor: '#EFF6FF', icon: 'send' as const };
    case 'processing':
      return { label: 'En revisión IRS', color: '#8B5CF6', bgColor: '#F5F3FF', icon: 'hourglass' as const };
    case 'completed':
      return { label: 'Completada', color: '#10B981', bgColor: '#ECFDF5', icon: 'checkmark-circle' as const };
    default:
      return { label: 'Pendiente', color: '#F59E0B', bgColor: '#FFFBEB', icon: 'time' as const };
  }
}

export default function TaxReturnsUnified() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const dateLocale = i18n.language === 'es' ? es : enUS;
  const [taxReturns, setTaxReturns] = useState<TaxReturn[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    loadAllTaxReturns();
  }, []);

  const loadAllTaxReturns = async () => {
    try {
      const [statusResponse, completedResponse] = await Promise.all([
        api.get('/my-tax-returns').catch(() => ({ data: { tax_returns: [], total_refund: 0 } })),
        api.get('/tax-returns/completed').catch(() => ({ data: [] })),
      ]);

      const statusReturns = statusResponse.data.tax_returns || [];
      const completedReturns = completedResponse.data || [];

      const mergedMap = new Map<string, TaxReturn>();
      statusReturns.forEach((item: TaxReturn) => {
        mergedMap.set(String(item.tax_year), { ...item, has_federal_pdf: false, has_state_pdf: false });
      });
      completedReturns.forEach((item: any) => {
        const key = String(item.tax_year);
        const existing = mergedMap.get(key);
        if (existing) {
          mergedMap.set(key, { ...existing, ...item, status: existing.status || 'completed', has_federal_pdf: item.has_federal_pdf || false, has_state_pdf: item.has_state_pdf || false });
        } else {
          mergedMap.set(key, { ...item, status: 'completed' });
        }
      });

      setTaxReturns(Array.from(mergedMap.values()).sort((a, b) => Number(b.tax_year) - Number(a.tax_year)));
    } catch (error) {
      console.error('Error loading tax returns:', error);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadAllTaxReturns();
  }, []);

  const fmt = (v?: number) => v ? `$${v.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '$0.00';

  const fmtDate = (d?: string) => {
    if (!d) return '';
    try { return format(new Date(d), "d 'de' MMMM, yyyy", { locale: es }); } catch { return ''; }
  };

  const downloadPDF = async (returnId: string, docType: 'federal' | 'state', taxYear: number | string) => {
    setDownloading(`${returnId}-${docType}`);
    try {
      const response = await api.get(`/tax-returns/completed/${returnId}/download/${docType}`, { timeout: 60000 });
      const { pdf_data, filename } = response.data;
      if (!pdf_data) throw new Error('No PDF');

      if (Platform.OS === 'web') {
        const byteChars = atob(pdf_data);
        const byteArrays = [];
        for (let i = 0; i < byteChars.length; i += 512) {
          const slice = byteChars.slice(i, i + 512);
          const nums = new Array(slice.length);
          for (let j = 0; j < slice.length; j++) nums[j] = slice.charCodeAt(j);
          byteArrays.push(new Uint8Array(nums));
        }
        const blob = new Blob(byteArrays, { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url; link.download = filename;
        document.body.appendChild(link); link.click();
        document.body.removeChild(link); URL.revokeObjectURL(url);
      } else {
        const fileUri = `${FileSystem.documentDirectory}${filename}`;
        await FileSystem.writeAsStringAsync(fileUri, pdf_data, { encoding: 'base64' });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
        }
      }
    } catch (error: any) {
      Alert.alert('Error', error?.response?.status === 404 ? t('taxReturns.pdfNotAvailable', 'PDF aún no disponible') : t('taxReturns.downloadError', 'No se pudo descargar'));
    } finally {
      setDownloading(null);
    }
  };

  const renderStatusPipeline = (status: string) => {
    if (status === 'rejected') return null;
    const currentStep = getStatusStep(status);

    return (
      <View style={s.pipeline}>
        {STATUS_PIPELINE.map((step, idx) => {
          const isCompleted = idx <= currentStep;
          const isCurrent = idx === currentStep;
          const isLast = idx === STATUS_PIPELINE.length - 1;

          return (
            <View key={step.key} style={s.pipelineStep}>
              <View style={s.pipelineStepRow}>
                <View style={[
                  s.pipelineDot,
                  isCompleted && s.pipelineDotActive,
                  isCurrent && s.pipelineDotCurrent,
                ]}>
                  {isCompleted ? (
                    <Ionicons name={isCurrent ? step.icon : 'checkmark'} size={12} color="#FFF" />
                  ) : (
                    <View style={s.pipelineDotInner} />
                  )}
                </View>
                {!isLast && (
                  <View style={[s.pipelineLine, isCompleted && idx < currentStep && s.pipelineLineActive]} />
                )}
              </View>
              <Text style={[s.pipelineLabel, isCompleted && s.pipelineLabelActive, isCurrent && s.pipelineLabelCurrent]}>
                {step.label}
              </Text>
            </View>
          );
        })}
      </View>
    );
  };

  const renderCard = (item: TaxReturn) => {
    const config = getStatusConfig(item.status);
    const refund = item.total_refund || item.refund_amount || 0;
    const isRejected = item.status === 'rejected';
    const isPending = ['submitted', 'processing'].includes(item.status);
    const isAccepted = item.status === 'accepted';
    const hasPDF = item.has_federal_pdf || item.has_state_pdf;
    const isDown = downloading?.startsWith(item.id);

    return (
      <View key={`${item.id}-${item.tax_year}`} style={s.card}>
        {/* Card Top */}
        <View style={s.cardTop}>
          <View style={s.yearRow}>
            <Text style={s.yearLabel}>{t('taxReturns.taxYear', 'Año fiscal')}</Text>
            <Text style={s.yearValue}>{item.tax_year}</Text>
          </View>
          <View style={[s.statusChip, { backgroundColor: config.bgColor }]}>
            <Ionicons name={config.icon} size={14} color={config.color} />
            <Text style={[s.statusChipText, { color: config.color }]}>{config.label}</Text>
          </View>
        </View>

        {/* Progress Pipeline */}
        {!isRejected && renderStatusPipeline(item.status)}

        {/* Refund / Financial Info */}
        {(item.federal_refund || item.refund_amount || item.total_refund || 0) > 0 && (
          <View style={[s.refundBox, isAccepted && s.refundBoxAccepted, isPending && s.refundBoxPending]}>
            <View style={{ flex: 1 }}>
              <Text style={s.refundLabel}>
                {isAccepted ? 'Reembolso confirmado' : 'Reembolso'}
              </Text>
              {/* Show breakdown if state refund exists */}
              {item.state_refund && item.state_refund > 0 ? (
                <View>
                  <View style={s.refundBreakdownRow}>
                    <Text style={s.refundBreakdownLabel}>{t('taxReturns.federal', 'Federal')}</Text>
                    <Text style={[s.refundBreakdownValue, isAccepted && s.refundAmountAccepted]}>
                      {fmt(item.federal_refund || item.refund_amount || 0)}
                    </Text>
                  </View>
                  <View style={s.refundBreakdownRow}>
                    <Text style={s.refundBreakdownLabel}>{t('taxReturns.state', 'Estatal')}</Text>
                    <Text style={[s.refundBreakdownValue, isAccepted && s.refundAmountAccepted]}>
                      {fmt(item.state_refund)}
                    </Text>
                  </View>
                  <View style={[s.refundBreakdownRow, s.refundTotalRow]}>
                    <Text style={s.refundTotalLabel}>{t('taxReturns.total', 'Total')}</Text>
                    <Text style={[s.refundAmount, isAccepted && s.refundAmountAccepted]}>
                      {fmt(item.total_refund || (item.federal_refund || 0) + (item.state_refund || 0))}
                    </Text>
                  </View>
                </View>
              ) : (
                <Text style={[s.refundAmount, isAccepted && s.refundAmountAccepted]}>
                  {fmt(item.federal_refund || item.refund_amount || item.total_refund || 0)}
                </Text>
              )}
            </View>
            {isAccepted && (
              <View style={s.refundCheckIcon}>
                <Ionicons name="checkmark-circle" size={32} color="#10B981" />
              </View>
            )}
          </View>
        )}

        {/* Income summary */}
        {item.total_income != null && item.total_income > 0 && (
          <View style={s.incomeLine}>
            <Ionicons name="wallet-outline" size={16} color="#6B7280" />
            <Text style={s.incomeLabel}>{t('taxReturns.reportedIncome', 'Ingresos reportados')}</Text>
            <Text style={s.incomeValue}>{fmt(item.total_income)}</Text>
          </View>
        )}

        {/* Rejected */}
        {isRejected && item.rejection_reason && (
          <View style={s.rejectedBox}>
            <View style={s.rejectedHeader}>
              <Ionicons name="warning" size={20} color="#DC2626" />
              <Text style={s.rejectedTitle}>{item.rejection_reason.title || 'Rechazada por IRS'}</Text>
            </View>
            {item.rejection_reason.description && (
              <Text style={s.rejectedDesc}>{item.rejection_reason.description}</Text>
            )}
            {item.rejection_reason.action_required && (
              <View style={s.actionBox}>
                <Text style={s.actionLabel}>Acción requerida:</Text>
                <Text style={s.actionText}>{item.rejection_reason.action_required}</Text>
              </View>
            )}
            <TouchableOpacity style={s.callBtn} onPress={() => Linking.openURL('tel:+18069342018')}>
              <Ionicons name="call" size={16} color="#FFF" />
              <Text style={s.callBtnText}>Llamar a Ross Tax</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Actions */}
        <View style={s.cardActions}>
          {hasPDF && (
            <TouchableOpacity
              style={s.actionBtn}
              onPress={() => downloadPDF(item.id, 'federal', item.tax_year)}
              disabled={!!isDown}
            >
              {isDown ? (
                <ActivityIndicator size="small" color="#059669" />
              ) : (
                <>
                  <Ionicons name="download-outline" size={18} color="#059669" />
                  <Text style={s.actionBtnText}>Descargar PDF</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {isPending && (
            <TouchableOpacity
              style={[s.actionBtn, s.actionBtnBlue]}
              onPress={() => Linking.openURL('https://sa.www4.irs.gov/wmr/')}
            >
              <Ionicons name="search-outline" size={18} color="#3B82F6" />
              <Text style={[s.actionBtnText, { color: '#3B82F6' }]}>Ver estado en IRS</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Date footer */}
        <Text style={s.dateFooter}>
          {item.filed_date ? `Presentada el ${fmtDate(item.filed_date)}` : `Registrada el ${fmtDate(item.created_at)}`}
        </Text>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[s.container, { paddingTop: insets.top }]}>
        <View style={s.loadingBox}>
          <ActivityIndicator size="large" color="#059669" />
          <Text style={s.loadingText}>Cargando declaraciones...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={s.container}>
      {/* Header */}
      <LinearGradient
        colors={['#064E3B', '#065F46', '#047857']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[s.header, { paddingTop: insets.top + 12 }]}
      >
        <View style={s.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#FFF" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle}>Mis Declaraciones</Text>
            <Text style={s.headerSub}>{t('taxReturns.subtitle', 'Historial y estado de tus impuestos')}</Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#059669" />}
      >
        {taxReturns.length === 0 ? (
          <View style={s.emptyBox}>
            <View style={s.emptyIcon}>
              <Ionicons name="document-text-outline" size={48} color="#9CA3AF" />
            </View>
            <Text style={s.emptyTitle}>{t('taxReturns.noReturns', 'Sin declaraciones aún')}</Text>
            <Text style={s.emptyText}>
              Cuando completes tu declaración con Mi Reembolso, podrás ver su estado y descargar los documentos aquí.
            </Text>
            <TouchableOpacity
              style={s.emptyBtn}
              onPress={() => router.push('/(tabs)/taxes')}
            >
              <Text style={s.emptyBtnText}>Comenzar Mi Reembolso</Text>
              <Ionicons name="arrow-forward" size={18} color="#FFF" />
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Quick info banner */}
            <View style={s.infoBanner}>
              <Ionicons name="information-circle" size={18} color="#059669" />
              <Text style={s.infoBannerText}>
                Aquí puedes ver el progreso de cada declaración, descargar documentos y verificar tu reembolso con el IRS.
              </Text>
            </View>

            {taxReturns.map(renderCard)}
          </>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  loadingBox: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 15, color: '#6B7280' },

  // Header
  header: { paddingHorizontal: 20, paddingBottom: 20, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#FFF', letterSpacing: -0.3 },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 2 },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingTop: 20 },

  // Info Banner
  infoBanner: { flexDirection: 'row', backgroundColor: '#ECFDF5', borderRadius: 14, padding: 14, gap: 10, marginBottom: 16, alignItems: 'flex-start' },
  infoBannerText: { flex: 1, fontSize: 13, color: '#065F46', lineHeight: 19 },

  // Card
  card: { backgroundColor: '#FFF', borderRadius: 20, marginBottom: 16, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 4, borderWidth: 1, borderColor: 'rgba(0,0,0,0.04)' },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  yearRow: {},
  yearLabel: { fontSize: 11, color: '#9CA3AF', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  yearValue: { fontSize: 28, fontWeight: '900', color: '#1F2937', letterSpacing: -1 },
  statusChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, gap: 5 },
  statusChipText: { fontSize: 12, fontWeight: '700' },

  // Pipeline
  pipeline: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, paddingHorizontal: 4 },
  pipelineStep: { alignItems: 'center', flex: 1 },
  pipelineStepRow: { flexDirection: 'row', alignItems: 'center', width: '100%', justifyContent: 'center' },
  pipelineDot: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#E5E7EB', justifyContent: 'center', alignItems: 'center', zIndex: 1 },
  pipelineDotActive: { backgroundColor: '#10B981' },
  pipelineDotCurrent: { backgroundColor: '#059669', shadowColor: '#059669', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 6, elevation: 4 },
  pipelineDotInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#D1D5DB' },
  pipelineLine: { position: 'absolute', left: '60%', right: '-40%', height: 3, backgroundColor: '#E5E7EB', top: 10 },
  pipelineLineActive: { backgroundColor: '#10B981' },
  pipelineLabel: { fontSize: 10, color: '#9CA3AF', marginTop: 6, fontWeight: '600', textAlign: 'center' },
  pipelineLabelActive: { color: '#6B7280' },
  pipelineLabelCurrent: { color: '#059669', fontWeight: '700' },

  // Refund
  refundBox: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F9FAFB', borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  refundBoxAccepted: { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' },
  refundBoxPending: { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' },
  refundLabel: { fontSize: 12, color: '#6B7280', fontWeight: '600', marginBottom: 4 },
  refundAmount: { fontSize: 24, fontWeight: '900', color: '#1F2937' },
  refundAmountAccepted: { color: '#059669' },
  refundCheckIcon: {},
  refundBreakdownRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 3 },
  refundBreakdownLabel: { fontSize: 13, color: '#6B7280', fontWeight: '500' },
  refundBreakdownValue: { fontSize: 15, fontWeight: '700', color: '#374151' },
  refundTotalRow: { borderTopWidth: 1, borderTopColor: '#E5E7EB', marginTop: 4, paddingTop: 6 },
  refundTotalLabel: { fontSize: 14, color: '#1F2937', fontWeight: '700' },

  // Income
  incomeLine: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#F3F4F6', marginBottom: 4 },
  incomeLabel: { flex: 1, fontSize: 14, color: '#6B7280' },
  incomeValue: { fontSize: 14, fontWeight: '700', color: '#1F2937' },

  // Rejected
  rejectedBox: { backgroundColor: '#FEF2F2', borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#FECACA' },
  rejectedHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  rejectedTitle: { fontSize: 15, fontWeight: '700', color: '#DC2626' },
  rejectedDesc: { fontSize: 13, color: '#7F1D1D', lineHeight: 19, marginBottom: 8 },
  actionBox: { backgroundColor: '#FEE2E2', borderRadius: 10, padding: 12, marginBottom: 12 },
  actionLabel: { fontSize: 11, fontWeight: '700', color: '#991B1B', marginBottom: 4 },
  actionText: { fontSize: 13, color: '#7F1D1D' },
  callBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#DC2626', paddingVertical: 12, borderRadius: 10, gap: 6 },
  callBtnText: { fontSize: 14, fontWeight: '700', color: '#FFF' },

  // Actions
  cardActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#ECFDF5', paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: '#A7F3D0' },
  actionBtnBlue: { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' },
  actionBtnText: { fontSize: 13, fontWeight: '700', color: '#059669' },

  // Date footer
  dateFooter: { fontSize: 11, color: '#9CA3AF', textAlign: 'center', marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6' },

  // Empty
  emptyBox: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 24 },
  emptyIcon: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#1F2937', marginBottom: 8 },
  emptyText: { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  emptyBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#059669', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 14, gap: 8 },
  emptyBtnText: { fontSize: 15, fontWeight: '700', color: '#FFF' },
});
