/**
 * Mi Reembolso - Plan Selection Screen
 * Choose between DIY Express and Assisted Premium
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../../services/api';
import { useTranslation } from 'react-i18next';

interface PlanOption {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  description: string;
  features: { text: string; included: boolean }[];
  recommended?: boolean;
  badge?: string;
  badgeColor?: string;
}

const PLANS: PlanOption[] = [
  {
    id: 'diy',
    name: 'DIY Express',
    price: 49,
    originalPrice: 79,
    description: 'Hazlo tú mismo y ahorra',
    badge: '💰 Más Económico',
    badgeColor: '#F59E0B',
    features: [
      { text: 'Wizard guiado paso a paso', included: true },
      { text: 'Cálculos automáticos precisos', included: true },
      { text: 'Firma electrónica incluida', included: true },
      { text: 'Transmisión directa al IRS', included: true },
      { text: 'Seguimiento de reembolso', included: true },
      { text: 'Soporte por chat', included: true },
      { text: 'Revisión de experto', included: false },
      { text: 'Llamada personalizada', included: false },
    ],
  },
  {
    id: 'assisted',
    name: 'Asistido Premium',
    price: 149,
    originalPrice: 199,
    description: 'Un experto revisa tu declaración',
    recommended: true,
    badge: '⭐ Recomendado',
    badgeColor: '#10B981',
    features: [
      { text: 'Todo lo de DIY Express', included: true },
      { text: 'Revisión por preparador certificado', included: true },
      { text: 'Llamada de 30 min para dudas', included: true },
      { text: 'Maximización de deducciones', included: true },
      { text: 'Garantía de precisión', included: true },
      { text: 'Representación ante el IRS', included: true },
      { text: 'Soporte prioritario', included: true },
      { text: 'Correcciones ilimitadas', included: true },
    ],
  },
];

export default function SelectPlanScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();

  // Create translated plans
  const translatedPlans = React.useMemo(() => PLANS.map(plan => ({
    ...plan,
    name: plan.id === 'diy' ? t('wizard.selectPlan.diyTitle') : t('wizard.selectPlan.assistedTitle'),
    description: plan.id === 'diy' ? t('wizard.selectPlan.diyDesc') : t('wizard.selectPlan.assistedDesc'),
    badge: plan.id === 'diy' ? `💰 ${t('wizard.selectPlan.diyTitle')}` : `⭐ ${t('wizard.selectPlan.assistedTitle')}`,
    features: plan.features.map((f, i) => ({
      ...f,
      text: t(`wizard.selectPlan.${plan.id === 'diy' ? 'diy' : 'assisted'}Feature${i + 1}`, f.text),
    })),
  })), [t]);
  const [selectedPlan, setSelectedPlan] = useState<string | null>('assisted');
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [refundEstimate, setRefundEstimate] = useState<number>(0);

  useEffect(() => {
    loadSession();
  }, []);

  const loadSession = async () => {
    try {
      const response = await api.get(`/tax-wizard/session/${sessionId}`);
      if (response.data?.refund_estimate?.estimated_refund) {
        setRefundEstimate(response.data.refund_estimate.estimated_refund);
      }
    } catch (error) {
      console.error('Error loading session:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPlan = async () => {
    if (!selectedPlan || !sessionId) return;

    setProcessing(true);
    try {
      const plan = PLANS.find(p => p.id === selectedPlan);
      await api.post(`/tax-wizard/session/${sessionId}/select-plan`, {
        plan_type: selectedPlan,
        plan_price: plan?.price || 0,
      });

      if (selectedPlan === 'diy') {
        // DIY flow: ID verification → signature → payment
        router.push({
          pathname: '/tax-wizard/id-verification',
          params: { sessionId }
        });
      } else {
        router.push({
          pathname: '/tax-wizard/appointment',
          params: { sessionId }
        });
      }
    } catch (error) {
      console.error('Error selecting plan:', error);
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#065F46" />
        <ActivityIndicator size="large" color="#10B981" />
        <Text style={styles.loadingText}>Cargando opciones...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#065F46" />
      
      {/* Header */}
      <LinearGradient colors={['#065F46', '#10B981']} style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Elige tu Plan</Text>
        <Text style={styles.headerSubtitle}>Selecciona cómo quieres presentar tu declaración</Text>
        
        {refundEstimate > 0 && (
          <View style={styles.refundBadge}>
            <Text style={styles.refundLabel}>Tu reembolso estimado</Text>
            <Text style={styles.refundAmount}>${refundEstimate.toLocaleString()}</Text>
          </View>
        )}
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Plan Cards */}
        {translatedPlans.map((plan) => {
          const isSelected = selectedPlan === plan.id;
          
          return (
            <TouchableOpacity
              key={plan.id}
              onPress={() => setSelectedPlan(plan.id)}
              style={[
                styles.planCard,
                isSelected && styles.planCardSelected,
                plan.recommended && styles.planCardRecommended
              ]}
              activeOpacity={0.9}
            >
              {/* Badge */}
              {plan.badge && (
                <View style={[styles.badge, { backgroundColor: plan.badgeColor }]}>
                  <Text style={styles.badgeText}>{plan.badge}</Text>
                </View>
              )}

              {/* Plan Header */}
              <View style={styles.planHeader}>
                <Text style={styles.planName}>{plan.name}</Text>
                <Text style={styles.planDescription}>{plan.description}</Text>
              </View>

              {/* Price */}
              <View style={styles.priceContainer}>
                <Text style={styles.price}>${plan.price}</Text>
                {plan.originalPrice && (
                  <Text style={styles.originalPrice}>${plan.originalPrice}</Text>
                )}
                <Text style={styles.priceNote}>Pago único</Text>
              </View>

              {/* Features */}
              <View style={styles.featuresContainer}>
                {plan.features.map((feature, idx) => (
                  <View key={idx} style={styles.featureRow}>
                    <Ionicons
                      name={feature.included ? 'checkmark-circle' : 'close-circle'}
                      size={20}
                      color={feature.included ? '#10B981' : '#D1D5DB'}
                    />
                    <Text style={[
                      styles.featureText,
                      !feature.included && styles.featureTextDisabled
                    ]}>
                      {feature.text}
                    </Text>
                  </View>
                ))}
              </View>

              {/* Selection Indicator */}
              <View style={[
                styles.selectionIndicator,
                isSelected && styles.selectionIndicatorActive
              ]}>
                {isSelected && <Ionicons name="checkmark" size={20} color="#fff" />}
                <Text style={[
                  styles.selectionText,
                  isSelected && styles.selectionTextActive
                ]}>
                  {isSelected ? t('wizard.selected') : t('wizard.select')}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}

        {/* Help Section */}
        <View style={styles.helpCard}>
          <Ionicons name="bulb-outline" size={24} color="#3B82F6" />
          <View style={styles.helpContent}>
            <Text style={styles.helpTitle}>¿No sabes cuál elegir?</Text>
            <Text style={styles.helpText}>
              <Text style={styles.helpBold}>DIY Express:</Text> Si tu situación es simple (solo W-2){'\n'}
              <Text style={styles.helpBold}>Asistido:</Text> Si tienes negocio o es tu primera vez
            </Text>
          </View>
        </View>

        {/* Continue Button */}
        <TouchableOpacity
          style={[styles.continueButton, (!selectedPlan || processing) && styles.buttonDisabled]}
          onPress={handleSelectPlan}
          disabled={!selectedPlan || processing}
        >
          {processing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={styles.continueButtonText}>
                {t('wizard.continueWith', { plan: selectedPlan === 'diy' ? t('wizard.selectPlan.diyTitle') : t('wizard.selectPlan.assistedTitle') })}
              </Text>
              <Ionicons name="arrow-forward" size={20} color="#fff" />
            </>
          )}
        </TouchableOpacity>

        {/* Guarantee */}
        <View style={styles.guarantee}>
          <Ionicons name="shield-checkmark" size={20} color="#F59E0B" />
          <Text style={styles.guaranteeText}>
            Garantía de satisfacción o te devolvemos tu dinero
          </Text>
        </View>

        <View style={{ height: 40 }} />
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
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
  },
  header: {
    paddingTop: 50,
    paddingBottom: 24,
    paddingHorizontal: 20,
  },
  backBtn: {
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#D1FAE5',
  },
  refundBadge: {
    marginTop: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  refundLabel: {
    fontSize: 12,
    color: '#D1FAE5',
  },
  refundAmount: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  planCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    position: 'relative',
    overflow: 'hidden',
  },
  planCardSelected: {
    borderColor: '#10B981',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  planCardRecommended: {
    marginTop: 8,
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomLeftRadius: 12,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  planHeader: {
    marginBottom: 16,
  },
  planName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  planDescription: {
    fontSize: 14,
    color: '#6B7280',
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 20,
  },
  price: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#10B981',
  },
  originalPrice: {
    fontSize: 18,
    color: '#9CA3AF',
    textDecorationLine: 'line-through',
    marginLeft: 8,
  },
  priceNote: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 8,
  },
  featuresContainer: {
    marginBottom: 20,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  featureText: {
    fontSize: 14,
    color: '#374151',
    marginLeft: 10,
    flex: 1,
  },
  featureTextDisabled: {
    color: '#9CA3AF',
  },
  selectionIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingVertical: 14,
  },
  selectionIndicatorActive: {
    backgroundColor: '#10B981',
  },
  selectionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
    marginLeft: 8,
  },
  selectionTextActive: {
    color: '#fff',
  },
  helpCard: {
    flexDirection: 'row',
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  helpContent: {
    flex: 1,
    marginLeft: 12,
  },
  helpTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E40AF',
    marginBottom: 4,
  },
  helpText: {
    fontSize: 13,
    color: '#3B82F6',
    lineHeight: 20,
  },
  helpBold: {
    fontWeight: '600',
  },
  continueButton: {
    flexDirection: 'row',
    backgroundColor: '#10B981',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  continueButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginRight: 8,
  },
  guarantee: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFBEB',
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  guaranteeText: {
    fontSize: 12,
    color: '#92400E',
    marginLeft: 8,
  },
});
