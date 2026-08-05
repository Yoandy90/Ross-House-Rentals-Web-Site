import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Linking,
  Dimensions,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';

const { width } = Dimensions.get('window');

interface RefundTrackerData {
  id: string;
  tax_year: string;
  refund_amount: number;
  current_stage: string;
  current_stage_label: string;
  current_stage_label_en: string;
  current_stage_icon: string;
  stage_index: number;
  total_stages: number;
  progress_percent: number;
  filing_type: string;
  refund_method: string;
  filed_date: string;
  estimated_refund_date: string;
  days_since_filed: number;
  days_until_estimate: number;
  status: string;
  stages: StageData[];
  irs_check_url: string;
}

interface StageData {
  stage: string;
  label: string;
  label_en: string;
  icon: string;
  completed: boolean;
  date: string | null;
}

interface FormData {
  id: string;
  form_type: string;
  tax_year: string;
  status: string;
  total_amount: number;
  payer_name: string;
  copy_b_available: boolean;
  copy_b_emailed: boolean;
  created_at: string;
}

interface InvoiceData {
  id: string;
  invoice_number: string;
  total: number;
  status: string;
  due_date: string;
}

interface TaxSummaryData {
  tax_year: string;
  total_wages: number;
  total_federal_withheld: number;
  total_1099_income: number;
  w2_count: number;
  parsed_at: string;
}

interface DashboardData {
  forms: FormData[];
  forms_count: number;
  refund_trackers: RefundTrackerData[];
  invoices: InvoiceData[];
  tax_summary: TaxSummaryData[];
}

export default function TaxDashboard() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { t, i18n } = useTranslation();
  const isEn = i18n.language === 'en';

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);

  const loadDashboard = useCallback(async () => {
    try {
      setError(false);
      const response = await api.get('/client/tax-dashboard');
      setDashboard(response.data);
    } catch (err: any) {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadDashboard();
    }, [loadDashboard])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadDashboard();
  }, [loadDashboard]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getStageLabel = (stage: StageData) => {
    const key = `taxDashboard.refundTracker.stages.${stage.stage}`;
    const translated = t(key);
    return translated !== key ? translated : (isEn ? stage.label_en : stage.label);
  };

  const getFormStatusColor = (status: string) => {
    switch (status) {
      case 'accepted': return '#10B981';
      case 'submitted': return '#3B82F6';
      case 'rejected': return '#EF4444';
      case 'corrected': return '#F59E0B';
      default: return '#6B7280';
    }
  };

  const getInvoiceStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return '#10B981';
      case 'pending': return '#F59E0B';
      case 'cancelled': return '#EF4444';
      default: return '#6B7280';
    }
  };

  // Loading state
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <LinearGradient colors={['#065F46', '#10B981']} style={[styles.headerGradient, { paddingTop: insets.top }]}>
          <View style={[styles.headerContent, { paddingTop: 16 }]}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{t('taxDashboard.title')}</Text>
            <View style={{ width: 40 }} />
          </View>
        </LinearGradient>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#10B981" />
          <Text style={styles.loadingText}>{t('taxDashboard.loading')}</Text>
        </View>
      </View>
    );
  }

  const hasData = dashboard && (
    (dashboard.refund_trackers && dashboard.refund_trackers.length > 0) ||
    (dashboard.forms && dashboard.forms.length > 0) ||
    (dashboard.tax_summary && dashboard.tax_summary.length > 0)
  );

  return (
    <View style={[styles.container, { paddingTop: 0 }]}>
      {/* Header */}
      <LinearGradient colors={['#065F46', '#10B981']} style={styles.headerGradient}>
        <View style={[styles.headerContent, { paddingTop: insets.top + 16 }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>{t('taxDashboard.title')}</Text>
            <Text style={styles.headerSubtitle}>{t('taxDashboard.subtitle')}</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#10B981" />
        }
        showsVerticalScrollIndicator={false}
      >
        {error && (
          <View style={styles.errorBanner}>
            <Ionicons name="warning-outline" size={20} color="#EF4444" />
            <Text style={styles.errorText}>{t('taxDashboard.errorLoading')}</Text>
          </View>
        )}

        {/* Form 4506-C Quick Access */}
        <TouchableOpacity
          style={{
            flexDirection: 'row', alignItems: 'center', backgroundColor: '#EEF2FF',
            borderRadius: 14, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#C7D2FE',
          }}
          onPress={() => router.push('/(tabs)/form-4506c')}
          activeOpacity={0.7}
        >
          <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: '#4338CA', justifyContent: 'center', alignItems: 'center' }}>
            <Ionicons name="create" size={22} color="#fff" />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: '#1E1B4B' }}>
              {t('form4506c.title', 'Autorización IRS')}
            </Text>
            <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
              Form 4506-C — {t('form4506c.subtitle', 'Firma electrónica')}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#4338CA" />
        </TouchableOpacity>

        {!hasData && !error ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <Ionicons name="document-text-outline" size={64} color="#D1D5DB" />
            </View>
            <Text style={styles.emptyTitle}>{t('taxDashboard.noData')}</Text>
            <Text style={styles.emptyDescription}>{t('taxDashboard.noDataDesc')}</Text>
          </View>
        ) : (
          <>
            {/* ===== REFUND TRACKER SECTION ===== */}
            {dashboard?.refund_trackers && dashboard.refund_trackers.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="cash-outline" size={22} color="#10B981" />
                  <Text style={styles.sectionTitle}>{t('taxDashboard.refundTracker.title')}</Text>
                </View>

                {dashboard.refund_trackers.map((tracker) => (
                  <View key={tracker.id} style={styles.refundCard}>
                    {/* Refund Amount Header */}
                    <LinearGradient
                      colors={['#065F46', '#059669']}
                      style={styles.refundHeader}
                    >
                      <View style={styles.refundHeaderRow}>
                        <View>
                          <Text style={styles.refundYearLabel}>
                            {t('taxDashboard.refundTracker.taxYear')} {tracker.tax_year}
                          </Text>
                          <Text style={styles.refundAmount}>
                            {formatCurrency(tracker.refund_amount)}
                          </Text>
                        </View>
                        <View style={styles.refundBadge}>
                          <Text style={styles.refundBadgeText}>
                            {tracker.current_stage_icon} {isEn ? tracker.current_stage_label_en : tracker.current_stage_label}
                          </Text>
                        </View>
                      </View>

                      {/* Progress Bar */}
                      <View style={styles.progressBarContainer}>
                        <View style={styles.progressBarBg}>
                          <View
                            style={[
                              styles.progressBarFill,
                              { width: `${tracker.progress_percent}%` },
                            ]}
                          />
                        </View>
                        <Text style={styles.progressText}>{tracker.progress_percent}%</Text>
                      </View>
                    </LinearGradient>

                    {/* Timeline */}
                    <View style={styles.timeline}>
                      {tracker.stages.map((stage, idx) => (
                        <View key={stage.stage} style={styles.timelineItem}>
                          <View style={styles.timelineLeft}>
                            <View
                              style={[
                                styles.timelineDot,
                                stage.completed
                                  ? styles.timelineDotCompleted
                                  : styles.timelineDotPending,
                              ]}
                            >
                              {stage.completed && (
                                <Ionicons name="checkmark" size={12} color="#fff" />
                              )}
                            </View>
                            {idx < tracker.stages.length - 1 && (
                              <View
                                style={[
                                  styles.timelineLine,
                                  stage.completed
                                    ? styles.timelineLineCompleted
                                    : styles.timelineLinePending,
                                ]}
                              />
                            )}
                          </View>
                          <View style={styles.timelineContent}>
                            <Text
                              style={[
                                styles.timelineLabel,
                                stage.completed && styles.timelineLabelCompleted,
                              ]}
                            >
                              {stage.icon} {getStageLabel(stage)}
                            </Text>
                            {stage.date && (
                              <Text style={styles.timelineDate}>{stage.date}</Text>
                            )}
                          </View>
                        </View>
                      ))}
                    </View>

                    {/* Refund Details */}
                    <View style={styles.refundDetails}>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>
                          {t('taxDashboard.refundTracker.filedOn')}
                        </Text>
                        <Text style={styles.detailValue}>{tracker.filed_date}</Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>
                          {t('taxDashboard.refundTracker.estimatedDate')}
                        </Text>
                        <Text style={styles.detailValueHighlight}>
                          {tracker.estimated_refund_date}
                        </Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>
                          {t('taxDashboard.refundTracker.filingType')}
                        </Text>
                        <Text style={styles.detailValue}>
                          {tracker.filing_type === 'e-file'
                            ? t('taxDashboard.refundTracker.eFile')
                            : t('taxDashboard.refundTracker.paperFiling')}
                        </Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>
                          {t('taxDashboard.refundTracker.refundMethod')}
                        </Text>
                        <Text style={styles.detailValue}>
                          {tracker.refund_method === 'direct_deposit'
                            ? t('taxDashboard.refundTracker.directDeposit')
                            : t('taxDashboard.refundTracker.check')}
                        </Text>
                      </View>
                      {tracker.days_until_estimate > 0 && (
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>
                            {t('taxDashboard.refundTracker.daysRemaining')}
                          </Text>
                          <Text style={styles.detailValueHighlight}>
                            ~{tracker.days_until_estimate}
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* IRS Check Button */}
                    <TouchableOpacity
                      style={styles.irsButton}
                      onPress={() => Linking.openURL(tracker.irs_check_url)}
                    >
                      <Ionicons name="open-outline" size={18} color="#fff" />
                      <Text style={styles.irsButtonText}>
                        {t('taxDashboard.refundTracker.checkIRS')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            {/* ===== 1099 FORMS SECTION ===== */}
            {dashboard?.forms && dashboard.forms.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="documents-outline" size={22} color="#3B82F6" />
                  <Text style={styles.sectionTitle}>{t('taxDashboard.forms.title')}</Text>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{dashboard.forms_count}</Text>
                  </View>
                </View>

                {dashboard.forms.map((form) => (
                  <View key={form.id} style={styles.formCard}>
                    <View style={styles.formCardHeader}>
                      <View style={styles.formTypeContainer}>
                        <Text style={styles.formType}>{form.form_type}</Text>
                        <Text style={styles.formYear}>{form.tax_year}</Text>
                      </View>
                      <View
                        style={[
                          styles.statusBadge,
                          { backgroundColor: getFormStatusColor(form.status) + '20' },
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusBadgeText,
                            { color: getFormStatusColor(form.status) },
                          ]}
                        >
                          {t(`taxDashboard.forms.statuses.${form.status}`, form.status)}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.formDetails}>
                      {form.payer_name ? (
                        <View style={styles.formDetailRow}>
                          <Ionicons name="business-outline" size={16} color="#6B7280" />
                          <Text style={styles.formDetailText}>{form.payer_name}</Text>
                        </View>
                      ) : null}
                      {form.total_amount > 0 && (
                        <View style={styles.formDetailRow}>
                          <Ionicons name="cash-outline" size={16} color="#6B7280" />
                          <Text style={styles.formDetailText}>
                            {formatCurrency(form.total_amount)}
                          </Text>
                        </View>
                      )}
                    </View>

                    <View style={styles.formActions}>
                      {form.copy_b_available && (
                        <View style={styles.copyBBadge}>
                          <Ionicons name="document-attach-outline" size={14} color="#10B981" />
                          <Text style={styles.copyBText}>{t('taxDashboard.forms.copyB')}</Text>
                        </View>
                      )}
                      {form.copy_b_emailed && (
                        <View style={styles.emailedBadge}>
                          <Ionicons name="mail-outline" size={14} color="#3B82F6" />
                          <Text style={styles.emailedText}>{t('taxDashboard.forms.emailed')}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* ===== TAX SUMMARY SECTION ===== */}
            {dashboard?.tax_summary && dashboard.tax_summary.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="bar-chart-outline" size={22} color="#8B5CF6" />
                  <Text style={styles.sectionTitle}>{t('taxDashboard.taxSummary.title')}</Text>
                </View>

                {dashboard.tax_summary.map((summary, idx) => (
                  <View key={idx} style={styles.summaryCard}>
                    <Text style={styles.summaryYear}>
                      {t('taxDashboard.taxSummary.yearLabel')} {summary.tax_year}
                    </Text>
                    <View style={styles.summaryGrid}>
                      <View style={styles.summaryItem}>
                        <Text style={styles.summaryLabel}>
                          {t('taxDashboard.taxSummary.totalWages')}
                        </Text>
                        <Text style={styles.summaryValue}>
                          {formatCurrency(summary.total_wages)}
                        </Text>
                      </View>
                      <View style={styles.summaryItem}>
                        <Text style={styles.summaryLabel}>
                          {t('taxDashboard.taxSummary.federalWithheld')}
                        </Text>
                        <Text style={[styles.summaryValue, { color: '#EF4444' }]}>
                          {formatCurrency(summary.total_federal_withheld)}
                        </Text>
                      </View>
                      <View style={styles.summaryItem}>
                        <Text style={styles.summaryLabel}>
                          {t('taxDashboard.taxSummary.income1099')}
                        </Text>
                        <Text style={styles.summaryValue}>
                          {formatCurrency(summary.total_1099_income)}
                        </Text>
                      </View>
                      <View style={styles.summaryItem}>
                        <Text style={styles.summaryLabel}>
                          {t('taxDashboard.taxSummary.w2Count')}
                        </Text>
                        <Text style={styles.summaryValue}>{summary.w2_count}</Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* ===== INVOICES SECTION ===== */}
            {dashboard?.invoices && dashboard.invoices.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="receipt-outline" size={22} color="#F59E0B" />
                  <Text style={styles.sectionTitle}>{t('taxDashboard.invoices.title')}</Text>
                </View>

                {dashboard.invoices.map((invoice) => (
                  <View key={invoice.id} style={styles.invoiceCard}>
                    <View style={styles.invoiceLeft}>
                      <Text style={styles.invoiceNumber}>{invoice.invoice_number}</Text>
                      <Text style={styles.invoiceDue}>
                        {t('taxDashboard.invoices.dueDate')}: {invoice.due_date}
                      </Text>
                    </View>
                    <View style={styles.invoiceRight}>
                      <Text style={styles.invoiceTotal}>
                        {formatCurrency(invoice.total)}
                      </Text>
                      <View
                        style={[
                          styles.invoiceStatusBadge,
                          { backgroundColor: getInvoiceStatusColor(invoice.status) + '20' },
                        ]}
                      >
                        <Text
                          style={[
                            styles.invoiceStatusText,
                            { color: getInvoiceStatusColor(invoice.status) },
                          ]}
                        >
                          {t(`taxDashboard.invoices.status.${invoice.status}`, invoice.status)}
                        </Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}

            <View style={{ height: 40 }} />
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
  },
  headerGradient: {
    paddingBottom: 24,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 100,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorText: {
    fontSize: 14,
    color: '#EF4444',
    marginLeft: 8,
    flex: 1,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: 32,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F9FAFB',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 12,
  },
  emptyDescription: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginLeft: 8,
    flex: 1,
  },
  badge: {
    backgroundColor: '#10B981',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
    minWidth: 28,
    alignItems: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },

  // ===== Refund Tracker =====
  refundCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  refundHeader: {
    padding: 20,
  },
  refundHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  refundYearLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '600',
  },
  refundAmount: {
    fontSize: 32,
    fontWeight: '800',
    color: '#fff',
    marginTop: 4,
  },
  refundBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  refundBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  progressBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
  },
  progressBarBg: {
    flex: 1,
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#34D399',
    borderRadius: 4,
  },
  progressText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 10,
  },

  // Timeline
  timeline: {
    padding: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  timelineItem: {
    flexDirection: 'row',
    minHeight: 44,
  },
  timelineLeft: {
    width: 30,
    alignItems: 'center',
  },
  timelineDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  timelineDotCompleted: {
    backgroundColor: '#10B981',
  },
  timelineDotPending: {
    backgroundColor: '#E5E7EB',
    borderWidth: 2,
    borderColor: '#D1D5DB',
  },
  timelineLine: {
    flex: 1,
    width: 2,
    minHeight: 20,
  },
  timelineLineCompleted: {
    backgroundColor: '#10B981',
  },
  timelineLinePending: {
    backgroundColor: '#E5E7EB',
  },
  timelineContent: {
    flex: 1,
    paddingLeft: 12,
    paddingBottom: 16,
  },
  timelineLabel: {
    fontSize: 14,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  timelineLabelCompleted: {
    color: '#111827',
    fontWeight: '600',
  },
  timelineDate: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },

  // Refund Details
  refundDetails: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  detailLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  detailValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '600',
  },
  detailValueHighlight: {
    fontSize: 14,
    color: '#10B981',
    fontWeight: '700',
  },

  // IRS Button
  irsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E40AF',
    margin: 20,
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  irsButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },

  // ===== Forms =====
  formCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  formCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  formTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  formType: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  formYear: {
    fontSize: 13,
    color: '#6B7280',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusBadge: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  formDetails: {
    gap: 6,
  },
  formDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  formDetailText: {
    fontSize: 14,
    color: '#374151',
  },
  formActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  copyBBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  copyBText: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '600',
  },
  emailedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  emailedText: {
    fontSize: 12,
    color: '#3B82F6',
    fontWeight: '600',
  },

  // ===== Tax Summary =====
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  summaryYear: {
    fontSize: 15,
    fontWeight: '700',
    color: '#8B5CF6',
    marginBottom: 12,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  summaryItem: {
    width: '50%',
    paddingVertical: 8,
    paddingRight: 8,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },

  // ===== Invoices =====
  invoiceCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  invoiceLeft: {
    flex: 1,
  },
  invoiceNumber: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  invoiceDue: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  invoiceRight: {
    alignItems: 'flex-end',
  },
  invoiceTotal: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  invoiceStatusBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 4,
  },
  invoiceStatusText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
