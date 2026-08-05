/**
 * Tax Wizard - Recommendation Screen
 * Final screen showing service recommendation and next steps
 */
import React, { useState, useEffect, useRef } from 'react';
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
import CelebrationOverlay, { CelebrationRef } from '../../components/CelebrationOverlay';
import { useTranslation } from 'react-i18next';

export default function RecommendationScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const [loading, setLoading] = useState(true);
  const [sessionData, setSessionData] = useState<any>({});
  const celebrationRef = useRef<CelebrationRef>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    if (!sessionId) return;
    try {
      const response = await api.get(`/tax-wizard/session/${sessionId}`);
      if (response.data.success) {
        setSessionData(response.data.session);
        // Trigger celebration if there's a refund
        const refund = response.data.session?.refund_estimate;
        if (refund?.is_refund && refund?.estimated_refund > 0) {
          setTimeout(() => {
            celebrationRef.current?.celebrate(
              `$${Math.abs(refund.estimated_refund).toLocaleString()}`,
              '¡Tu Reembolso Estimado!'
            );
          }, 800);
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getServiceInfo = (level: string) => {
    const services: { [key: string]: { name: string; icon: keyof typeof Ionicons.glyphMap; color: string; description: string } } = {
      'full_service': {
        name: 'Servicio Completo',
        icon: 'star',
        color: '#10B981',
        description: 'Nuestros expertos prepararán tu declaración completa. Solo necesitas subir tus documentos.',
      },
      'assisted': {
        name: 'Servicio Asistido',
        icon: 'people',
        color: '#3B82F6',
        description: 'Tú ingresas la información y un experto revisa todo antes de enviar.',
      },
      'diy': {
        name: 'Hazlo Tú Mismo',
        icon: 'flash',
        color: '#8B5CF6',
        description: 'Completa tu declaración con nuestra guía paso a paso.',
      },
    };
    return services[level] || services['assisted'];
  };

  const handleBookAppointment = () => {
    router.push('/(tabs)/book-appointment');
  };

  const handleUploadDocuments = () => {
    router.push('/(tabs)/documents');
  };

  const handleGoHome = () => {
    router.replace('/(tabs)');
  };

  if (loading) {
    return (
      <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#065F46" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#10B981" />
        </View>
      </View>
    );
  }

  const serviceInfo = getServiceInfo(sessionData.service_level || 'assisted');
  const refundEstimate = sessionData.refund_estimate;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#065F46" />
      <CelebrationOverlay ref={celebrationRef} />
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Success Header */}
        <View style={styles.successHeader}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark-circle" size={64} color="#10B981" />
          </View>
          <Text style={styles.successTitle}>{t('services.declarationReady')}</Text>
          <Text style={styles.successSubtitle}>
            {t('services.declarationReadyDesc')}
          </Text>
        </View>

        {/* Refund Card */}
        <LinearGradient
          colors={['#065F46', '#047857']}
          style={styles.refundCard}
        >
          <Text style={styles.refundLabel}>{t('services.estimatedRefund')}</Text>
          <Text style={styles.refundAmount}>
            {refundEstimate?.is_refund ? '+' : '-'}${Math.abs(refundEstimate?.estimated_refund || 0).toLocaleString()}
          </Text>
          <View style={styles.refundNote}>
            <Ionicons name="information-circle" size={16} color="rgba(255,255,255,0.7)" />
            <Text style={styles.refundNoteText}>
              {t('services.estimationBased')}
            </Text>
          </View>
        </LinearGradient>

        {/* Service Selected */}
        <View style={styles.serviceCard}>
          <View style={[styles.serviceIconContainer, { backgroundColor: serviceInfo.color + '20' }]}>
            <Ionicons name={serviceInfo.icon} size={32} color={serviceInfo.color} />
          </View>
          <Text style={styles.serviceName}>{serviceInfo.name}</Text>
          <Text style={styles.serviceDescription}>{serviceInfo.description}</Text>
          <View style={styles.priceContainer}>
            <Text style={styles.priceLabel}>{t('services.totalCost')}</Text>
            <Text style={styles.priceValue}>${sessionData.total_price?.toFixed(2) || '0.00'}</Text>
          </View>
        </View>

        {/* Next Steps */}
        <Text style={styles.sectionTitle}>{t('services.nextSteps')}</Text>

        <View style={styles.stepCard}>
          <View style={styles.stepNumber}>
            <Text style={styles.stepNumberText}>1</Text>
          </View>
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>{t('services.uploadDocuments')}</Text>
            <Text style={styles.stepDescription}>
              {t('services.uploadDocumentsDesc')}
            </Text>
          </View>
          <TouchableOpacity style={styles.stepAction} onPress={handleUploadDocuments}>
            <Text style={styles.stepActionText}>{t('services.upload')}</Text>
            <Ionicons name="arrow-forward" size={16} color="#10B981" />
          </TouchableOpacity>
        </View>

        {sessionData.appointment_required && (
          <View style={styles.stepCard}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>2</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>{t('services.scheduleAppointment')}</Text>
              <Text style={styles.stepDescription}>
                {t('services.scheduleAppointmentDesc')}
              </Text>
            </View>
            <TouchableOpacity style={styles.stepAction} onPress={handleBookAppointment}>
              <Text style={styles.stepActionText}>{t('services.schedule')}</Text>
              <Ionicons name="arrow-forward" size={16} color="#10B981" />
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.stepCard}>
          <View style={styles.stepNumber}>
            <Text style={styles.stepNumberText}>{sessionData.appointment_required ? '3' : '2'}</Text>
          </View>
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>{t('services.makePayment')}</Text>
            <Text style={styles.stepDescription}>
              {t('services.makePaymentDesc')}
            </Text>
          </View>
        </View>

        <View style={styles.stepCard}>
          <View style={styles.stepNumber}>
            <Text style={styles.stepNumberText}>{sessionData.appointment_required ? '4' : '3'}</Text>
          </View>
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>{t('services.receiveRefund')}</Text>
            <Text style={styles.stepDescription}>
              {t('services.receiveRefundDesc')}
            </Text>
          </View>
        </View>

        {/* Documents Required */}
        {sessionData.documents_required?.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>{t('services.documentsRequired')}</Text>
            <View style={styles.documentsCard}>
              {sessionData.documents_required.map((doc: string, index: number) => (
                <View key={index} style={styles.documentItem}>
                  <Ionicons name="document-text-outline" size={20} color="#6B7280" />
                  <Text style={styles.documentText}>{doc}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Contact Support */}
        <View style={styles.supportCard}>
          <Ionicons name="chatbubbles" size={24} color="#3B82F6" />
          <View style={styles.supportContent}>
            <Text style={styles.supportTitle}>{t('services.haveQuestions')}</Text>
            <Text style={styles.supportText}>
              {t('services.teamReady')}
            </Text>
          </View>
          <TouchableOpacity 
            style={styles.supportButton}
            onPress={() => router.push('/(tabs)/support')}
          >
            <Text style={styles.supportButtonText}>{t('services.contact')}</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Bottom CTA */}
      <View style={styles.bottomCTA}>
        <TouchableOpacity style={styles.homeButton} onPress={handleGoHome}>
          <Ionicons name="home" size={20} color="#fff" />
          <Text style={styles.homeButtonText}>{t('services.goHome')}</Text>
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
  content: {
    backgroundColor: '#F9FAFB',
    flex: 1,
    padding: 20,
  },
  successHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  successIcon: {
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  successSubtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
  },
  refundCard: {
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
  },
  refundLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 8,
  },
  refundAmount: {
    fontSize: 48,
    fontWeight: '700',
    color: '#fff',
  },
  refundNote: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
  },
  refundNoteText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginLeft: 6,
  },
  serviceCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  serviceIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  serviceName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  serviceDescription: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  priceLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginRight: 8,
  },
  priceValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#10B981',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
  },
  stepCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  stepNumberText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  stepDescription: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  stepAction: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#F0FDF4',
    borderRadius: 8,
  },
  stepActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10B981',
    marginRight: 4,
  },
  documentsCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  documentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  documentText: {
    fontSize: 14,
    color: '#374151',
    marginLeft: 12,
  },
  supportCard: {
    backgroundColor: '#EFF6FF',
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  supportContent: {
    flex: 1,
    marginLeft: 12,
  },
  supportTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E40AF',
  },
  supportText: {
    fontSize: 13,
    color: '#3B82F6',
    marginTop: 2,
  },
  supportButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  supportButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
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
  homeButton: {
    backgroundColor: '#10B981',
    borderRadius: 14,
    padding: 18,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  homeButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 10,
  },
});
