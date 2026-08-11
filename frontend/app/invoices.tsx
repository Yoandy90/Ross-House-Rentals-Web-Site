import React, { useCallback, useEffect, useState } from 'react';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { apiCall } from '../src/utils/api';
import { Spacing, FontSizes, BorderRadius, Shadows, useColors } from '../src/constants/theme';

interface InvoiceItem {
  id: string;
  type: 'rent' | 'utility';
  utility_type?: string;
  label: string;
  subtitle?: string;
  period: string;
  amount: number;
  paid: boolean;
  paid_at: string | null;
  due_date: string | null;
  status: 'paid' | 'pending' | string;
  has_pdf: boolean;
  pdf_endpoint: string | null;
  source: string;
  icon: string;
  color: string;
}

interface HistorySummary {
  total_paid: number;
  total_pending: number;
  paid_count: number;
  pending_count: number;
}

interface HistoryResponse {
  items: InvoiceItem[];
  total_count: number;
  summary: HistorySummary;
  filters: {
    available_years: string[];
    available_types: string[];
    available_statuses: string[];
  };
}

export default function InvoicesHistoryScreen() {
  const C = useColors();
  const styles = React.useMemo(() => createStyles(C), [C]);
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [data, setData] = useState<HistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [yearFilter, setYearFilter] = useState<string | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'rent' | 'utility'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'pending'>('all');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (yearFilter !== 'all') params.append('year', yearFilter);
      if (typeFilter !== 'all') params.append('type', typeFilter);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      const qs = params.toString();
      const path = `/tenant/invoices/history${qs ? `?${qs}` : ''}`;
      const res = await apiCall(path);
      if (res) setData(res);
    } catch (err) {
      console.log('Invoices history fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [yearFilter, typeFilter, statusFilter]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchHistory();
  };

  const downloadPdf = async (invoice: InvoiceItem) => {
    if (!invoice.has_pdf) {
      Alert.alert(
        'PDF no disponible',
        'La descarga de PDF para facturas de servicios estará disponible próximamente.'
      );
      return;
    }
    setDownloadingId(invoice.id);
    try {
      const res = await apiCall(`/tenant/invoices/${invoice.id}/pdf`);
      if (!res?.success || !res?.pdf_base64) {
        throw new Error(res?.detail || 'No se pudo generar el PDF');
      }
      if (Platform.OS === 'web') {
        // On web, open data URL in a new tab
        const dataUrl = `data:application/pdf;base64,${res.pdf_base64}`;
        if (typeof window !== 'undefined') {
          window.open(dataUrl, '_blank');
        }
      } else {
        // On native, write to cache and use Sharing.shareAsync
        const fileUri = `${FileSystem.cacheDirectory}${res.filename}`;
        await FileSystem.writeAsStringAsync(fileUri, res.pdf_base64, {
          encoding: FileSystem.EncodingType.Base64,
        });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri, {
            mimeType: 'application/pdf',
            UTI: 'com.adobe.pdf',
            dialogTitle: res.filename,
          });
        } else {
          Alert.alert('PDF generado', `Guardado en ${fileUri}`);
        }
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'No se pudo descargar el PDF');
    } finally {
      setDownloadingId(null);
    }
  };

  const formatCurrency = (n: number) => `$${n.toFixed(2)}`;
  const formatDateShort = (iso: string | null) => {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleDateString('es-MX', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return iso.slice(0, 10);
    }
  };

  const formatPeriodLabel = (period: string) => {
    if (!period) return '';
    const [y, m] = period.split('-');
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    if (!m) return y || period;
    return `${months[parseInt(m, 10) - 1] || m} ${y}`;
  };

  if (loading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={C.brandRed} />
      </View>
    );
  }

  const items = data?.items || [];
  const availableYears = data?.filters?.available_years || [];

  return (
    <View style={styles.root}>
      <ScrollView
        style={[styles.container, { paddingTop: insets.top }]}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.brandRed} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={C.textPrimary} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Historial de Facturas</Text>
            <Text style={styles.headerSub}>Renta + servicios · Descarga PDFs</Text>
          </View>
        </View>

        {/* Summary card */}
        {data?.summary && (
          <View style={styles.summaryCard}>
            <LinearGradient
              colors={['rgba(16,185,129,0.10)', 'rgba(16,185,129,0.02)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Pagado</Text>
                <Text style={[styles.summaryValue, { color: '#10B981' }]}>
                  {formatCurrency(data.summary.total_paid)}
                </Text>
                <Text style={styles.summaryHint}>{data.summary.paid_count} factura(s)</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Pendiente</Text>
                <Text style={[styles.summaryValue, { color: '#F59E0B' }]}>
                  {formatCurrency(data.summary.total_pending)}
                </Text>
                <Text style={styles.summaryHint}>{data.summary.pending_count} factura(s)</Text>
              </View>
            </View>
          </View>
        )}

        {/* Filters */}
        <View style={styles.filtersBlock}>
          {/* Type segmented control */}
          <View style={styles.segmented}>
            {[
              { key: 'all', label: 'Todo', icon: 'apps-outline' },
              { key: 'rent', label: 'Renta', icon: 'home' },
              { key: 'utility', label: 'Servicios', icon: 'flash' },
            ].map((f) => {
              const isActive = typeFilter === f.key;
              return (
                <TouchableOpacity
                  key={f.key}
                  style={[styles.segment, isActive && styles.segmentActive]}
                  onPress={() => setTypeFilter(f.key as any)}
                  activeOpacity={0.85}
                >
                  <Ionicons
                    name={f.icon as any}
                    size={14}
                    color={isActive ? C.white : C.textMuted}
                    style={{ marginRight: 6 }}
                  />
                  <Text style={[styles.segmentText, isActive && styles.segmentTextActive]}>
                    {f.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Status segmented control */}
          <View style={[styles.segmented, { marginTop: 10 }]}>
            {[
              { key: 'all', label: 'Todos', color: C.brandRed },
              { key: 'paid', label: 'Pagados', color: '#10B981' },
              { key: 'pending', label: 'Pendientes', color: '#F59E0B' },
            ].map((f) => {
              const isActive = statusFilter === f.key;
              return (
                <TouchableOpacity
                  key={f.key}
                  style={[
                    styles.segment,
                    isActive && {
                      backgroundColor: f.color,
                      borderColor: f.color,
                    },
                  ]}
                  onPress={() => setStatusFilter(f.key as any)}
                  activeOpacity={0.85}
                >
                  <Text style={[
                    styles.segmentText,
                    isActive && styles.segmentTextActive,
                  ]}>
                    {f.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Year quick chips (only if multiple years) */}
          {availableYears.length > 1 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.yearRow}
              style={{ marginTop: 10 }}
            >
              <TouchableOpacity
                style={[styles.yearChip, yearFilter === 'all' && styles.yearChipActive]}
                onPress={() => setYearFilter('all')}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="calendar-outline"
                  size={12}
                  color={yearFilter === 'all' ? C.brandRed : C.textMuted}
                  style={{ marginRight: 4 }}
                />
                <Text style={[styles.yearChipText, yearFilter === 'all' && styles.yearChipTextActive]}>
                  Todos
                </Text>
              </TouchableOpacity>
              {availableYears.map((y) => (
                <TouchableOpacity
                  key={y}
                  style={[styles.yearChip, yearFilter === y && styles.yearChipActive]}
                  onPress={() => setYearFilter(y)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.yearChipText, yearFilter === y && styles.yearChipTextActive]}>
                    {y}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>

        {/* List */}
        <Text style={styles.filterSection}>
          {items.length} {items.length === 1 ? 'factura' : 'facturas'}
        </Text>

        {items.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Ionicons name="document-text-outline" size={48} color={C.textDim} />
            </View>
            <Text style={styles.emptyTitle}>Sin facturas</Text>
            <Text style={styles.emptyDesc}>
              No encontramos facturas con los filtros seleccionados. Prueba a cambiar los filtros o
              haz pull-to-refresh.
            </Text>
          </View>
        ) : (
          items.map((inv) => {
            const isDownloading = downloadingId === inv.id;
            return (
              <View key={inv.id} style={styles.invoiceCard} testID={`invoice-${inv.id}`}>
                <View style={[styles.invoiceIcon, { backgroundColor: `${inv.color}15` }]}>
                  <Ionicons name={inv.icon as any} size={20} color={inv.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.invoiceTopRow}>
                    <Text style={styles.invoiceLabel}>{inv.label}</Text>
                    <View style={[
                      styles.statusBadge,
                      inv.paid ? styles.statusBadgePaid : styles.statusBadgePending,
                    ]}>
                      <Text style={[
                        styles.statusBadgeText,
                        { color: inv.paid ? '#10B981' : '#F59E0B' },
                      ]}>
                        {inv.paid ? 'Pagado' : 'Pendiente'}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.invoicePeriod}>{formatPeriodLabel(inv.period)}</Text>
                  {inv.subtitle ? (
                    <Text style={styles.invoiceSubtitle} numberOfLines={1}>{inv.subtitle}</Text>
                  ) : null}
                  {inv.paid && inv.paid_at ? (
                    <Text style={styles.invoiceDate}>Pagado el {formatDateShort(inv.paid_at)}</Text>
                  ) : !inv.paid && inv.due_date ? (
                    <Text style={[styles.invoiceDate, { color: '#F59E0B' }]}>Vence el {formatDateShort(inv.due_date)}</Text>
                  ) : null}
                </View>
                <View style={styles.invoiceRight}>
                  <Text style={styles.invoiceAmount}>{formatCurrency(inv.amount)}</Text>
                  {inv.has_pdf ? (
                    <TouchableOpacity
                      testID={`download-pdf-${inv.id}`}
                      style={styles.downloadBtn}
                      onPress={() => downloadPdf(inv)}
                      disabled={isDownloading}
                      activeOpacity={0.7}
                    >
                      {isDownloading ? (
                        <ActivityIndicator size="small" color={C.brandRed} />
                      ) : (
                        <>
                          <Ionicons name="download-outline" size={14} color={C.brandRed} />
                          <Text style={styles.downloadBtnText}>PDF</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  ) : (
                    <Text style={styles.pdfUnavailable}>—</Text>
                  )}
                </View>
              </View>
            );
          })
        )}

        <View style={{ height: 80 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (C: any) => StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },
  container: { flex: 1 },
  content: { paddingHorizontal: Spacing.base },
  center: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: C.background,
  },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: Spacing.base,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: C.glassLight,
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: {
    fontSize: FontSizes.xl, fontWeight: '800',
    color: C.textPrimary, letterSpacing: -0.5,
  },
  headerSub: { fontSize: FontSizes.xs, color: C.textMuted, marginTop: 2 },

  // Summary
  summaryCard: {
    position: 'relative', overflow: 'hidden',
    backgroundColor: C.glass,
    borderRadius: BorderRadius.card,
    borderWidth: 1, borderColor: C.glassBorder,
    padding: Spacing.base, marginBottom: Spacing.lg,
    ...Shadows.subtle,
  },
  summaryRow: {
    flexDirection: 'row', alignItems: 'center',
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryDivider: {
    width: 1, height: 50,
    backgroundColor: C.glassLight,
  },
  summaryLabel: {
    fontSize: 10, fontWeight: '700',
    color: C.textMuted, letterSpacing: 1,
    textTransform: 'uppercase',
  },
  summaryValue: {
    fontSize: 24, fontWeight: '800',
    letterSpacing: -0.5, marginTop: 4,
  },
  summaryHint: {
    fontSize: 11, color: C.textDim,
    marginTop: 2,
  },

  // Filters
  filtersBlock: {
    marginTop: Spacing.md,
    marginBottom: Spacing.md,
  },
  segmented: {
    flexDirection: 'row',
    backgroundColor: C.glass,
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: C.glassBorder,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 9,
    backgroundColor: 'transparent',
    borderWidth: 0,
    borderColor: 'transparent',
  },
  segmentActive: {
    backgroundColor: C.brandRed,
    borderColor: C.brandRed,
  },
  segmentText: {
    fontSize: FontSizes.sm,
    color: C.textMuted,
    fontWeight: '700',
  },
  segmentTextActive: {
    color: C.white,
  },
  yearRow: {
    gap: 8,
    paddingRight: Spacing.base,
  },
  yearChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: C.glass,
    borderWidth: 1,
    borderColor: C.glassBorder,
  },
  yearChipActive: {
    backgroundColor: 'rgba(200,16,46,0.15)',
    borderColor: C.brandRed,
  },
  yearChipText: {
    fontSize: FontSizes.xs,
    color: C.textMuted,
    fontWeight: '700',
  },
  yearChipTextActive: {
    color: C.brandRed,
  },

  // Legacy filter chip (kept for invoice list section header)
  filterSection: {
    fontSize: FontSizes.xs, color: C.textMuted,
    fontWeight: '700', textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginTop: Spacing.md, marginBottom: 8,
  },
  filterRow: { gap: 8, paddingVertical: 4, paddingRight: Spacing.base },
  filterChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: C.glass,
    borderWidth: 1, borderColor: C.glassBorder,
  },
  filterChipActive: {
    backgroundColor: 'rgba(200,16,46,0.15)',
    borderColor: C.brandRed,
  },
  filterChipText: {
    fontSize: FontSizes.sm, color: C.textMuted,
    fontWeight: '600',
  },
  filterChipTextActive: { color: C.brandRed },

  // Invoice card
  invoiceCard: {
    flexDirection: 'row', alignItems: 'flex-start',
    gap: 12,
    backgroundColor: C.glass,
    borderRadius: BorderRadius.md,
    padding: Spacing.md, marginBottom: 8,
    borderWidth: 1, borderColor: C.glassBorder,
  },
  invoiceIcon: {
    width: 44, height: 44, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
  },
  invoiceTopRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', gap: 8,
  },
  invoiceLabel: {
    fontSize: FontSizes.base, fontWeight: '700',
    color: C.textPrimary, flex: 1,
  },
  invoicePeriod: {
    fontSize: FontSizes.xs, color: C.textMuted,
    marginTop: 3, fontWeight: '600',
  },
  invoiceSubtitle: {
    fontSize: 11, color: C.textDim,
    marginTop: 2,
  },
  invoiceDate: {
    fontSize: 10, color: C.textDim,
    marginTop: 2, fontStyle: 'italic',
  },
  invoiceRight: { alignItems: 'flex-end', gap: 6 },
  invoiceAmount: {
    fontSize: FontSizes.md, fontWeight: '800',
    color: C.textPrimary,
  },
  statusBadge: {
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 8,
  },
  statusBadgePaid: { backgroundColor: 'rgba(16,185,129,0.12)' },
  statusBadgePending: { backgroundColor: 'rgba(245,158,11,0.12)' },
  statusBadgeText: { fontSize: 10, fontWeight: '800' },

  // Download
  downloadBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(200,16,46,0.10)',
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(200,16,46,0.20)',
    minWidth: 60, justifyContent: 'center',
  },
  downloadBtnText: {
    fontSize: 11, fontWeight: '800',
    color: C.brandRed, letterSpacing: 0.2,
  },
  pdfUnavailable: {
    fontSize: 11, color: C.textDim,
    fontStyle: 'italic',
  },

  // Empty
  emptyState: {
    alignItems: 'center', paddingVertical: 40,
  },
  emptyIcon: {
    width: 80, height: 80, borderRadius: 24,
    backgroundColor: C.glass,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: { fontSize: FontSizes.lg, fontWeight: '700', color: C.textPrimary },
  emptyDesc: {
    fontSize: FontSizes.sm, color: C.textMuted,
    textAlign: 'center', marginTop: 8,
    maxWidth: 320, lineHeight: 20,
  },
});
