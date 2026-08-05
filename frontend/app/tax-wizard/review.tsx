/**
 * Mi Reembolso - Review Screen
 * Step 6: Final review before submission
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../../services/api';
import { useTranslation } from 'react-i18next';

interface ReviewData {
  personal_info?: any;
  filing_status?: string;
  income?: any;
  dependents?: any[];
  deductions_credits?: any;
  refund_estimate?: any;
  service_level?: string;
}

export default function ReviewScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sessionData, setSessionData] = useState<ReviewData>({});
  const [recommendation, setRecommendation] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    if (!sessionId) return;
    try {
      // First, save the review to get recommendations
      await api.post(`/tax-wizard/session/${sessionId}/review`, {
        has_prior_year_return: true,
        has_health_insurance: true,
        received_stimulus: true,
        has_crypto: false,
        has_foreign_accounts: false,
        has_rental_property: false,
        additional_notes: '',
      });

      // Then get the full session
      const response = await api.get(`/tax-wizard/session/${sessionId}`);
      if (response.data.success) {
        setSessionData(response.data.session);
        setRecommendation({
          service: response.data.session.recommended_service,
          reason: response.data.session.recommended_reason,
          complexity: response.data.session.case_complexity,
          price: response.data.session.total_price,
          breakdown: response.data.session.price_breakdown,
        });
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getFilingStatusLabel = (status: string) => {
    const labels: { [key: string]: string } = {
      'single': t('wizard.review.single'),
      'married_filing_jointly': t('wizard.review.marriedJoint'),
      'married_filing_separately': t('wizard.review.marriedSeparate'),
      'head_of_household': t('wizard.review.headOfHousehold'),
      'qualifying_widow': t('wizard.review.qualifyingWidow'),
    };
    return labels[status] || status;
  };

  const getServiceLevelLabel = (level: string) => {
    const labels: { [key: string]: string } = {
      'full_service': t('wizard.review.fullService'),
      'assisted': t('wizard.review.assisted'),
      'diy': t('wizard.review.diy'),
    };
    return labels[level] || level;
  };

  const getComplexityLabel = (complexity: string) => {
    const labels: { [key: string]: { label: string; color: string } } = {
      'simple': { label: 'Simple', color: '#10B981' },
      'medium': { label: 'Medio', color: '#F59E0B' },
      'complex': { label: 'Complejo', color: '#EF4444' },
    };
    return labels[complexity] || { label: complexity, color: '#6B7280' };
  };

  const handleConfirm = async () => {
    setSaving(true);
    try {
      // Confirm the recommendation
      const response = await api.post(`/tax-wizard/session/${sessionId}/confirm-service`, null, {
        params: { service_level: recommendation?.service || sessionData.service_level || 'assisted' }
      });

      if (response.data.success) {
        // Go to plan selection
        router.push({
          pathname: '/tax-wizard/select-plan',
          params: { sessionId }
        });
      }
    } catch (error) {
      console.error('Error confirming:', error);
      Alert.alert(t('common.error'), t('wizard.review.couldNotConfirm'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#065F46" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#10B981" />
          <Text style={styles.loadingText}>Calculando tu reembolso...</Text>
        </View>
      </View>
    );
  }

  const refundEstimate = sessionData.refund_estimate;
  const complexity = getComplexityLabel(recommendation?.complexity || 'medium');

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#065F46" />
      {/* Header */}
      <LinearGradient colors={['#065F46', '#10B981']} style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity 
            onPress={() => router.push({
              pathname: '/tax-wizard/deductions',
              params: { sessionId }
            })} 
            style={styles.backBtn}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>Revisión Final</Text>
            <Text style={styles.headerStep}>Paso 6 de 6</Text>
          </View>
        </View>
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: '100%' }]} />
          </View>
        </View>
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Refund Estimate - BIG */}
        <View style={styles.bigEstimateCard}>
          <Text style={styles.bigEstimateLabel}>Tu Reembolso Estimado</Text>
          <Text style={[
            styles.bigEstimateAmount,
            { color: refundEstimate?.is_refund ? '#10B981' : '#EF4444' }
          ]}>
            {refundEstimate?.is_refund ? '+' : '-'}${Math.abs(refundEstimate?.estimated_refund || 0).toLocaleString()}
          </Text>
          <View style={styles.estimateDetails}>
            <View style={styles.estimateRow}>
              <Text style={styles.estimateDetailLabel}>Ingreso Total</Text>
              <Text style={styles.estimateDetailValue}>
                ${(refundEstimate?.total_income || 0).toLocaleString()}
              </Text>
            </View>
            <View style={styles.estimateRow}>
              <Text style={styles.estimateDetailLabel}>Impuesto Retenido</Text>
              <Text style={styles.estimateDetailValue}>
                ${(refundEstimate?.total_withheld || 0).toLocaleString()}
              </Text>
            </View>
            <View style={styles.estimateRow}>
              <Text style={styles.estimateDetailLabel}>Créditos Aplicados</Text>
              <Text style={[styles.estimateDetailValue, { color: '#10B981' }]}>
                +${(refundEstimate?.total_credits || 0).toLocaleString()}
              </Text>
            </View>
          </View>
        </View>

        {/* Case Complexity */}
        <View style={styles.complexityCard}>
          <View style={styles.complexityHeader}>
            <Ionicons name="analytics" size={24} color={complexity.color} />
            <Text style={styles.complexityTitle}>Complejidad del Caso</Text>
          </View>
          <View style={[styles.complexityBadge, { backgroundColor: complexity.color + '20' }]}>
            <Text style={[styles.complexityText, { color: complexity.color }]}>
              {complexity.label}
            </Text>
          </View>
          {recommendation?.reason && (
            <Text style={styles.complexityReason}>{recommendation.reason}</Text>
          )}
        </View>

        {/* Summary Sections */}
        <Text style={styles.sectionTitle}>Resumen de tu Declaración</Text>

        {/* Personal Info */}
        <TouchableOpacity
          style={styles.summaryCard}
          onPress={() => router.push({ pathname: '/tax-wizard/personal-info', params: { sessionId } })}
        >
          <View style={styles.summaryIcon}>
            <Ionicons name="person" size={22} color="#10B981" />
          </View>
          <View style={styles.summaryContent}>
            <Text style={styles.summaryTitle}>Información Personal</Text>
            <Text style={styles.summaryValue}>
              {sessionData.personal_info?.first_name} {sessionData.personal_info?.last_name}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
        </TouchableOpacity>

        {/* Filing Status */}
        <TouchableOpacity
          style={styles.summaryCard}
          onPress={() => router.push({ pathname: '/tax-wizard/filing-status', params: { sessionId } })}
        >
          <View style={styles.summaryIcon}>
            <Ionicons name="people" size={22} color="#3B82F6" />
          </View>
          <View style={styles.summaryContent}>
            <Text style={styles.summaryTitle}>Estado Civil</Text>
            <Text style={styles.summaryValue}>
              {getFilingStatusLabel(sessionData.filing_status || '')}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
        </TouchableOpacity>

        {/* Income */}
        <TouchableOpacity
          style={styles.summaryCard}
          onPress={() => router.push({ pathname: '/tax-wizard/income', params: { sessionId } })}
        >
          <View style={styles.summaryIcon}>
            <Ionicons name="cash" size={22} color="#F59E0B" />
          </View>
          <View style={styles.summaryContent}>
            <Text style={styles.summaryTitle}>Ingresos</Text>
            <Text style={styles.summaryValue}>
              ${(sessionData.income?.total_income || 0).toLocaleString()}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
        </TouchableOpacity>

        {/* Dependents */}
        <TouchableOpacity
          style={styles.summaryCard}
          onPress={() => router.push({ pathname: '/tax-wizard/dependents', params: { sessionId } })}
        >
          <View style={styles.summaryIcon}>
            <Ionicons name="heart" size={22} color="#EC4899" />
          </View>
          <View style={styles.summaryContent}>
            <Text style={styles.summaryTitle}>Dependientes</Text>
            <Text style={styles.summaryValue}>
              {(sessionData.dependents?.length || 0)} dependiente(s)
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
        </TouchableOpacity>

        {/* Deductions */}
        <TouchableOpacity
          style={styles.summaryCard}
          onPress={() => router.push({ pathname: '/tax-wizard/deductions', params: { sessionId } })}
        >
          <View style={styles.summaryIcon}>
            <Ionicons name="receipt" size={22} color="#8B5CF6" />
          </View>
          <View style={styles.summaryContent}>
            <Text style={styles.summaryTitle}>Deducciones</Text>
            <Text style={styles.summaryValue}>
              {sessionData.deductions_credits?.use_standard_deduction ? 'Estándar ($14,600)' : 'Detalladas'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
        </TouchableOpacity>

        {/* Price Breakdown */}
        {recommendation?.price && (
          <View style={styles.priceCard}>
            <Text style={styles.priceTitle}>Costo del Servicio</Text>
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>
                {getServiceLevelLabel(recommendation.service)}
              </Text>
              <Text style={styles.priceValue}>
                ${recommendation.price?.toFixed(2)}
              </Text>
            </View>
            {recommendation.breakdown && Object.entries(recommendation.breakdown).map(([key, value]) => (
              <View key={key} style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>{key}</Text>
                <Text style={styles.breakdownValue}>${(value as number).toFixed(2)}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Bottom CTA */}
      <View style={styles.bottomCTA}>
        <TouchableOpacity
          style={styles.confirmButton}
          onPress={handleConfirm}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={24} color="#fff" />
              <Text style={styles.confirmButtonText}>Confirmar y Continuar</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#065F46',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  headerTextContainer: {
    flex: 1,
    marginLeft: 8,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
  },
  headerStep: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  progressContainer: {
    marginTop: 16,
  },
  progressBar: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 3,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#fff',
    borderRadius: 3,
  },
  content: {
    backgroundColor: '#F9FAFB',
    flex: 1,
    padding: 20,
  },
  bigEstimateCard: {
    backgroundColor: '#065F46',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
  },
  bigEstimateLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 8,
  },
  bigEstimateAmount: {
    fontSize: 48,
    fontWeight: '700',
    color: '#fff',
  },
  estimateDetails: {
    marginTop: 20,
    width: '100%',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.2)',
  },
  estimateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  estimateDetailLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
  },
  estimateDetailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  complexityCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  complexityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  complexityTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginLeft: 10,
  },
  complexityBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 12,
  },
  complexityText: {
    fontSize: 14,
    fontWeight: '600',
  },
  complexityReason: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
  },
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  summaryIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  summaryContent: {
    flex: 1,
  },
  summaryTitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginTop: 2,
  },
  priceCard: {
    backgroundColor: '#FEF3C7',
    borderRadius: 14,
    padding: 16,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  priceTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#92400E',
    marginBottom: 12,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#FCD34D',
    marginBottom: 8,
  },
  priceLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  priceValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#92400E',
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  breakdownLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  breakdownValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  bottomCTA: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    padding: 20,
    paddingBottom: 34,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  confirmButton: {
    backgroundColor: '#10B981',
    borderRadius: 14,
    padding: 18,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 10,
  },
});
