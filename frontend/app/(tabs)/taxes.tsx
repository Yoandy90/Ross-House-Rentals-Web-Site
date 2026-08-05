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
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../../services/api';
import { useTranslation } from 'react-i18next';

interface TaxWizardSession {
  id: string;
  tax_year: number;
  status: string;
  plan_type?: string;
  current_step?: string;
  refund_estimate?: {
    estimated_refund?: number;
    total_income?: number;
    total_tax?: number;
  };
  created_at?: string;
  updated_at?: string;
}

const STEP_LABELS: Record<string, string> = {
  discovery: 'Información personal',
  'filing-status': 'Estado civil',
  'personal-info': 'Datos personales',
  income: 'Ingresos',
  'w2-scanner': 'Escanear W-2',
  'w2-review': 'Revisar W-2',
  deductions: 'Deducciones',
  dependents: 'Dependientes',
  review: 'Revisión',
  'select-plan': 'Seleccionar plan',
  signature: 'Firma electrónica',
  payment: 'Pago',
  appointment: 'Cita',
  success: 'Completado',
};

const STEP_ORDER = [
  'discovery', 'filing-status', 'personal-info', 'income',
  'w2-scanner', 'w2-review', 'deductions', 'dependents',
  'review', 'select-plan', 'signature', 'payment', 'appointment', 'success'
];

function getStepProgress(step: string): number {
  const idx = STEP_ORDER.indexOf(step);
  if (idx === -1) return 0;
  return Math.round(((idx + 1) / STEP_ORDER.length) * 100);
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'completed': return '#10B981';
    case 'in_progress': return '#F59E0B';
    case 'pending_payment': return '#EF4444';
    case 'submitted': return '#3B82F6';
    default: return '#6B7280';
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'completed': return 'Completada';
    case 'in_progress': return 'En progreso';
    case 'pending_payment': return 'Pago pendiente';
    case 'submitted': return 'Enviada al IRS';
    case 'cancelled': return 'Cancelada';
    default: return status;
  }
}

export default function TaxesScreen() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [sessions, setSessions] = useState<TaxWizardSession[]>([]);
  const [taxReturns, setTaxReturns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const getStepLabel = (step: string): string => {
    return t(`taxes.steps.${step}`, step);
  };

  const getStatusLabelT = (status: string): string => {
    return t(`taxes.statuses.${status}`, status);
  };

  const loadData = useCallback(async () => {
    try {
      const [wizardRes, returnsRes] = await Promise.all([
        api.get('/tax-wizard/my-sessions').catch(() => ({ data: { sessions: [] } })),
        api.get('/tax-returns/completed').catch(() => ({ data: [] })),
      ]);

      const allSessions = wizardRes.data?.sessions || [];
      setSessions(allSessions);
      setTaxReturns(returnsRes.data || []);
    } catch (error) {
      console.error('Error loading tax data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const activeSession = sessions.find(
    (s) => s.status !== 'completed' && s.status !== 'cancelled'
  );
  const completedSessions = sessions.filter((s) => s.status === 'completed');

  const handleStartOrContinue = () => {
    if (activeSession) {
      const step = activeSession.current_step || 'discovery';
      router.push({
        pathname: `/tax-wizard/${step}` as any,
        params: { sessionId: activeSession.id },
      });
    } else {
      router.push('/tax-wizard/discovery');
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#059669" />
        <Text style={styles.loadingText}>{t('taxes.loadingTaxes')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#064E3B" />
      {/* Header - gradient extends behind status bar */}
      <LinearGradient
        colors={['#064E3B', '#065F46', '#047857']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 12 }]}
      >
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.headerTitle}>{t('taxes.myTaxes')}</Text>
            <Text style={styles.headerSubtitle}>{t('taxes.manageTaxReturns')}</Text>
          </View>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => router.push('/(tabs)/tax-returns')}
          >
            <Ionicons name="time-outline" size={22} color="#FFF" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#059669" />
        }
      >
        {/* Tax Wizard CTA - Hidden until Tax API is connected */}

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.quickActionCard}
            onPress={() => router.push('/(tabs)/documents')}
            activeOpacity={0.8}
          >
            <View style={[styles.quickActionIcon, { backgroundColor: '#EEF2FF' }]}>
              <Ionicons name="document-text" size={24} color="#4F46E5" />
            </View>
            <Text style={styles.quickActionTitle}>{t('taxes.viewDocuments')}</Text>
            <Text style={styles.quickActionSub}>{t('taxes.yourW2s')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickActionCard}
            onPress={() => Linking.openURL('https://sa.www4.irs.gov/wmr/')}
            activeOpacity={0.8}
          >
            <View style={[styles.quickActionIcon, { backgroundColor: '#ECFDF5' }]}>
              <Ionicons name="search" size={24} color="#059669" />
            </View>
            <Text style={styles.quickActionTitle}>{t('taxes.myRefundIRS')}</Text>
            <Text style={styles.quickActionSub}>{t('taxes.wheresMyRefund')}</Text>
          </TouchableOpacity>
        </View>

        {/* Tax History */}
        {(completedSessions.length > 0 || taxReturns.length > 0) && (
          <View style={styles.historySection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t('taxes.returnHistory')}</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/tax-returns')}>
                <Text style={styles.seeAllLink}>{t('taxes.seeAll')}</Text>
              </TouchableOpacity>
            </View>

            {taxReturns.slice(0, 3).map((tr: any, idx: number) => (
              <View key={tr.id || idx} style={styles.historyCard}>
                <View style={styles.historyIcon}>
                  <Ionicons name="checkmark-circle" size={24} color="#10B981" />
                </View>
                <View style={styles.historyInfo}>
                  <Text style={styles.historyTitle}>
                    {t('taxes.taxReturn', { year: tr.tax_year || '2025' })}
                  </Text>
                  <Text style={styles.historySubtitle}>
                    {tr.status === 'completed' ? t('taxes.filed') : tr.status}
                  </Text>
                </View>
                {tr.refund_amount > 0 && (
                  <Text style={styles.historyAmount}>
                    ${tr.refund_amount?.toLocaleString()}
                  </Text>
                )}
              </View>
            ))}

            {completedSessions.slice(0, 3).map((s, idx) => (
              <View key={s.id || idx} style={styles.historyCard}>
                <View style={styles.historyIcon}>
                  <Ionicons name="checkmark-circle" size={24} color="#10B981" />
                </View>
                <View style={styles.historyInfo}>
                  <Text style={styles.historyTitle}>
                    Mi Reembolso {s.tax_year}
                  </Text>
                  <Text style={styles.historySubtitle}>
                    {getStatusLabelT(s.status)} {s.plan_type === 'diy' ? `(${t('taxes.diy')})` : `(${t('taxes.assisted')})`}
                  </Text>
                </View>
                {s.refund_estimate?.estimated_refund != null && s.refund_estimate.estimated_refund > 0 && (
                  <Text style={styles.historyAmount}>
                    ${s.refund_estimate.estimated_refund.toLocaleString()}
                  </Text>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Smart Add-ons */}
        <View style={styles.addonsSection}>
          <Text style={styles.sectionTitle}>{t('taxes.taxTools')}</Text>

          <TouchableOpacity
            style={styles.addonCard}
            onPress={() => router.push('/(tabs)/tax-calculator')}
            activeOpacity={0.8}
          >
            <View style={[styles.addonIcon, { backgroundColor: '#FEF3C7' }]}>
              <Ionicons name="calculator" size={22} color="#D97706" />
            </View>
            <View style={styles.addonInfo}>
              <Text style={styles.addonTitle}>{t('taxes.taxCalculator')}</Text>
              <Text style={styles.addonSub}>{t('taxes.estimateRefund')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.addonCard}
            onPress={() => router.push('/(tabs)/education')}
            activeOpacity={0.8}
          >
            <View style={[styles.addonIcon, { backgroundColor: '#EDE9FE' }]}>
              <Ionicons name="book" size={22} color="#7C3AED" />
            </View>
            <View style={styles.addonInfo}>
              <Text style={styles.addonTitle}>{t('taxes.educationCenter')}</Text>
              <Text style={styles.addonSub}>{t('taxes.educationDesc')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.addonCard}
            onPress={() => router.push('/(tabs)/my-tax-estimates')}
            activeOpacity={0.8}
          >
            <View style={[styles.addonIcon, { backgroundColor: '#DBEAFE' }]}>
              <Ionicons name="trending-up" size={22} color="#2563EB" />
            </View>
            <View style={styles.addonInfo}>
              <Text style={styles.addonTitle}>{t('taxes.myEstimates')}</Text>
              <Text style={styles.addonSub}>{t('taxes.estimatesDesc')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#064E3B',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    gap: 12,
  },
  loadingText: {
    fontSize: 15,
    color: '#6B7280',
    fontWeight: '500',
  },
  // Header
  header: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // ScrollView
  scrollView: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    paddingTop: 20,
    paddingHorizontal: 16,
  },
  // Hero CTA
  heroCTA: {
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
    marginBottom: 20,
  },
  heroGradient: {
    padding: 22,
    borderRadius: 24,
    position: 'relative',
    overflow: 'hidden',
  },
  heroDecor1: {
    position: 'absolute',
    top: -30,
    right: -30,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  heroDecor2: {
    position: 'absolute',
    bottom: -20,
    left: -20,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  heroIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  heroIconText: {
    fontSize: 30,
  },
  heroTextContainer: {
    flex: 1,
  },
  heroLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFF',
    lineHeight: 24,
  },
  // Progress
  progressSection: {
    marginBottom: 16,
  },
  progressBarBg: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#FFF',
    borderRadius: 4,
  },
  progressLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '600',
  },
  // Refund badge
  refundBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    alignItems: 'center',
  },
  refundBadgeLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '600',
    marginBottom: 4,
  },
  refundBadgeAmount: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFF',
  },
  // Hero Button
  heroButtonRow: {
    alignItems: 'flex-start',
  },
  heroButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 14,
    paddingHorizontal: 24,
    paddingVertical: 14,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  heroButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#059669',
  },
  // Feature Tags
  featureTags: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 18,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.15)',
    paddingTop: 14,
  },
  featureTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  featureTagText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '600',
  },
  // Quick Actions
  quickActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  quickActionCard: {
    flex: 1,
    backgroundColor: '#FFF',
    borderRadius: 18,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  quickActionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  quickActionSub: {
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 16,
  },
  // History
  historySection: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    letterSpacing: -0.3,
  },
  seeAllLink: {
    fontSize: 14,
    fontWeight: '600',
    color: '#059669',
  },
  historyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
  },
  historyIcon: {
    marginRight: 14,
  },
  historyInfo: {
    flex: 1,
  },
  historyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 2,
  },
  historySubtitle: {
    fontSize: 13,
    color: '#6B7280',
  },
  historyAmount: {
    fontSize: 16,
    fontWeight: '800',
    color: '#059669',
  },
  // Add-ons
  addonsSection: {
    marginBottom: 24,
  },
  addonCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    marginTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
  },
  addonIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  addonInfo: {
    flex: 1,
  },
  addonTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 2,
  },
  addonSub: {
    fontSize: 12,
    color: '#6B7280',
  },
});
