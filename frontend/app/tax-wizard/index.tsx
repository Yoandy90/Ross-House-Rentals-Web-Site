/**
 * Mi Reembolso - Service Selection Screen
 * Step 0: Choose service level (Full Service, Assisted, DIY)
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  StatusBar,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../../services/api';
import { useTranslation } from 'react-i18next';

const { width } = Dimensions.get('window');

interface ServiceLevel {
  id: string;
  name: string;
  name_es: string;
  tagline: string;
  description: string;
  features: string[];
  price_from: number;
  price_range: string;
  recommended_for: string;
  icon: string;
  color: string;
}

export default function TaxWizardIndex() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [serviceLevels, setServiceLevels] = useState<ServiceLevel[]>([]);
  const [selectedLevel, setSelectedLevel] = useState<string | null>(null);
  const [startingSession, setStartingSession] = useState(false);
  const [existingSession, setExistingSession] = useState<any>(null);
  
  // Year selection
  const currentYear = new Date().getFullYear();
  const availableYears = [currentYear, currentYear - 1, currentYear - 2];
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [showYearPicker, setShowYearPicker] = useState(false);
  
  // History of previous sessions
  const [previousSessions, setPreviousSessions] = useState<any[]>([]);

  useEffect(() => {
    loadData();
  }, [selectedYear]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load service levels
      const levelsResponse = await api.get('/tax-wizard/service-levels');
      if (levelsResponse.data.success) {
        setServiceLevels(levelsResponse.data.service_levels);
      }

      // Check for existing session for selected year
      try {
        const sessionResponse = await api.get('/tax-wizard/my-session', {
          params: { tax_year: selectedYear }
        });
        if (sessionResponse.data.has_session) {
          setExistingSession(sessionResponse.data.session);
          setSelectedLevel(sessionResponse.data.session.service_level);
        } else {
          setExistingSession(null);
          setSelectedLevel(null);
        }
      } catch (e) {
        setExistingSession(null);
      }
      
      // Load history of all sessions (for all years)
      try {
        const historyResponse = await api.get('/tax-wizard/my-sessions');
        if (historyResponse.data.success) {
          setPreviousSessions(historyResponse.data.sessions || []);
        }
      } catch (e) {
        // No history
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartWizard = async () => {
    if (!selectedLevel) return;

    setStartingSession(true);
    try {
      
      // Start or get existing session
      const startResponse = await api.post('/tax-wizard/start', {
        tax_year: selectedYear
      });


      if (startResponse.data.success) {
        const sessionId = startResponse.data.session_id;

        // Select service level
        await api.post(`/tax-wizard/session/${sessionId}/service-level?service_level=${selectedLevel}`);

        // Check if we should offer prefill from previous year
        await checkAndOfferPrefill(sessionId);
      } else {
        console.error('❌ Start wizard failed:', startResponse.data);
        Alert.alert(t('common.error'), t('services.errorStarting'));
      }
    } catch (error: any) {
      console.error('❌ Error starting wizard:', error);
      console.error('❌ Error details:', error.response?.data || error.message);
      
      // Show user-friendly error message with proper string conversion
      let errorMessage = 'Error de conexión. Por favor verifica tu conexión e intenta de nuevo.';
      
      if (error.response?.data?.detail) {
        // Handle string or object detail
        const detail = error.response.data.detail;
        errorMessage = typeof detail === 'string' ? detail : JSON.stringify(detail);
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      Alert.alert('Error', errorMessage);
    } finally {
      setStartingSession(false);
    }
  };

  // Check if previous year has completed session and offer prefill
  const checkAndOfferPrefill = async (sessionId: string) => {
    try {
      // Check if there's data from previous year
      const prevYear = selectedYear - 1;
      const prevSessionExists = previousSessions.some(
        s => s.tax_year === prevYear && (s.status === 'completed' || s.progress_percentage > 30)
      );
      
      if (prevSessionExists) {
        Alert.alert(
          `📋 ${t('services.previousYearData')}`,
          t('services.previousYearDesc', { year: prevYear }),
          [
            {
              text: t('wizard.startFresh'),
              style: 'cancel',
              onPress: () => {
                router.push({
                  pathname: '/tax-wizard/discovery',
                  params: { sessionId }
                });
              }
            },
            {
              text: t('wizard.useData'),
              onPress: async () => {
                try {
                  const response = await api.post(`/tax-wizard/session/${sessionId}/prefill-from-previous`);
                  if (response.data.prefilled) {
                    Alert.alert(
                      `✅ ${t('services.dataCopied')}`,
                      t('services.dataCopiedDesc', { year: prevYear }),
                      [
                        {
                          text: t('wizard.continue'),
                          onPress: () => {
                            router.push({
                              pathname: '/tax-wizard/discovery',
                              params: { sessionId }
                            });
                          }
                        }
                      ]
                    );
                  } else {
                    router.push({
                      pathname: '/tax-wizard/discovery',
                      params: { sessionId }
                    });
                  }
                } catch (error) {
                  console.error('Error prefilling:', error);
                  router.push({
                    pathname: '/tax-wizard/discovery',
                    params: { sessionId }
                  });
                }
              }
            }
          ]
        );
      } else {
        router.push({
          pathname: '/tax-wizard/discovery',
          params: { sessionId }
        });
      }
    } catch (error) {
      router.push({
        pathname: '/tax-wizard/discovery',
        params: { sessionId }
      });
    }
  };

  const handleContinueSession = () => {
    if (existingSession) {
      // Navigate to the current step
      const stepRoutes: { [key: string]: string } = {
        'service_selection': '/tax-wizard',
        'personal_info': '/tax-wizard/personal-info',
        'filing_status': '/tax-wizard/filing-status',
        'income': '/tax-wizard/income',
        'dependents': '/tax-wizard/dependents',
        'deductions': '/tax-wizard/deductions',
        'review': '/tax-wizard/review',
        'recommendation': '/tax-wizard/recommendation',
      };
      const route = stepRoutes[existingSession.current_step] || '/tax-wizard/personal-info';
      router.push({
        pathname: route,
        params: { sessionId: existingSession.id }
      });
    }
  };

  const getIconName = (icon: string): keyof typeof Ionicons.glyphMap => {
    const iconMap: { [key: string]: keyof typeof Ionicons.glyphMap } = {
      'star': 'star',
      'users': 'people',
      'zap': 'flash',
    };
    return iconMap[icon] || 'checkmark-circle';
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#065F46" />
        <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
          <LinearGradient colors={['#065F46', '#065F46']} style={styles.statusBarBg} />
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#10B981" />
            <Text style={styles.loadingText}>{t('auth.loading')}</Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#065F46" />
      <LinearGradient
        colors={['#065F46', '#047857', '#10B981']}
        style={styles.header}
      >
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>{t('services.getYourRefund')}</Text>
          {/* Year Selector */}
          <TouchableOpacity 
            style={styles.yearSelector}
            onPress={() => setShowYearPicker(!showYearPicker)}
          >
            <Ionicons name="calendar" size={18} color="#fff" />
            <Text style={styles.yearSelectorText}>{t('services.fiscalYear', { year: selectedYear })}</Text>
            <Ionicons name={showYearPicker ? "chevron-up" : "chevron-down"} size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Year Picker Dropdown */}
      {showYearPicker && (
        <View style={styles.yearPickerDropdown}>
          {availableYears.map((year) => (
            <TouchableOpacity
              key={year}
              style={[
                styles.yearPickerOption,
                selectedYear === year && styles.yearPickerOptionSelected
              ]}
              onPress={() => {
                setSelectedYear(year);
                setShowYearPicker(false);
              }}
            >
              <Text style={[
                styles.yearPickerOptionText,
                selectedYear === year && styles.yearPickerOptionTextSelected
              ]}>
                {year}
              </Text>
              {selectedYear === year && (
                <Ionicons name="checkmark" size={20} color="#10B981" />
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Progress indicator for existing session */}
        {existingSession && (
          <TouchableOpacity style={styles.continueCard} onPress={handleContinueSession}>
            <View style={styles.continueIcon}>
              <Ionicons name="play-circle" size={32} color="#10B981" />
            </View>
            <View style={styles.continueContent}>
              <Text style={styles.continueTitle}>{t('services.continueReturn2', { year: selectedYear })}</Text>
              <Text style={styles.continueSubtitle}>
                {t('services.progress')}: {existingSession.progress_percentage}%
              </Text>
              <View style={styles.progressBar}>
                <View 
                  style={[styles.progressFill, { width: `${existingSession.progress_percentage}%` }]} 
                />
              </View>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#6B7280" />
          </TouchableOpacity>
        )}

        {/* History of Previous Years */}
        {previousSessions.length > 0 && (
          <View style={styles.historySection}>
            <Text style={styles.historySectionTitle}>{t('services.returnHistoryTitle')}</Text>
            {previousSessions
              .filter(s => s.tax_year !== selectedYear)
              .slice(0, 3)
              .map((session) => (
                <TouchableOpacity
                  key={session.id}
                  style={styles.historyCard}
                  onPress={() => {
                    setSelectedYear(session.tax_year);
                  }}
                >
                  <View style={styles.historyCardLeft}>
                    <Text style={styles.historyYear}>{session.tax_year}</Text>
                    <View style={[
                      styles.historyStatusBadge,
                      { backgroundColor: session.status === 'completed' ? '#D1FAE5' : '#FEF3C7' }
                    ]}>
                      <Text style={[
                        styles.historyStatusText,
                        { color: session.status === 'completed' ? '#065F46' : '#92400E' }
                      ]}>
                        {session.status === 'completed' ? t('wizard.completed') : `${session.progress_percentage}%`}
                      </Text>
                    </View>
                  </View>
                  {session.refund_estimate?.estimated_refund && (
                    <Text style={[
                      styles.historyRefund,
                      { color: session.refund_estimate.is_refund ? '#10B981' : '#EF4444' }
                    ]}>
                      {session.refund_estimate.is_refund ? '+' : '-'}$
                      {Math.abs(session.refund_estimate.estimated_refund).toLocaleString()}
                    </Text>
                  )}
                </TouchableOpacity>
              ))}
          </View>
        )}

        <Text style={styles.sectionTitle}>{t('services.chooseServiceLevel')}</Text>
        <Text style={styles.sectionSubtitle}>
          {t('services.chooseServiceDesc')}
        </Text>

        {serviceLevels.map((level) => (
          <TouchableOpacity
            key={level.id}
            style={[
              styles.serviceCard,
              selectedLevel === level.id && styles.serviceCardSelected,
              { borderColor: selectedLevel === level.id ? level.color : '#E5E7EB' }
            ]}
            onPress={() => setSelectedLevel(level.id)}
          >
            <View style={styles.serviceHeader}>
              <View style={[styles.serviceIcon, { backgroundColor: level.color + '20' }]}>
                <Ionicons name={getIconName(level.icon)} size={28} color={level.color} />
              </View>
              <View style={styles.serviceInfo}>
                <Text style={styles.serviceName}>{i18n.language === 'es' ? level.name_es : level.name}</Text>
                <Text style={styles.serviceTagline}>{level.tagline}</Text>
              </View>
              {selectedLevel === level.id && (
                <View style={[styles.checkMark, { backgroundColor: level.color }]}>
                  <Ionicons name="checkmark" size={16} color="#fff" />
                </View>
              )}
            </View>

            <Text style={styles.serviceDescription}>{level.description}</Text>

            <View style={styles.featuresList}>
              {level.features.slice(0, 3).map((feature, index) => (
                <View key={index} style={styles.featureItem}>
                  <Ionicons name="checkmark-circle" size={16} color={level.color} />
                  <Text style={styles.featureText}>{feature}</Text>
                </View>
              ))}
            </View>

            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>{t('services.fromPrice')}</Text>
              <Text style={[styles.priceValue, { color: level.color }]}>
                ${level.price_from.toFixed(2)}
              </Text>
            </View>

            <Text style={styles.recommendedFor}>
              {t('services.recommendedFor')} {level.recommended_for}
            </Text>
          </TouchableOpacity>
        ))}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Bottom CTA */}
      <View style={styles.bottomCTA}>
        <TouchableOpacity
          style={[
            styles.startButton,
            !selectedLevel && styles.startButtonDisabled
          ]}
          onPress={handleStartWizard}
          disabled={!selectedLevel || startingSession}
        >
          {startingSession ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={styles.startButtonText}>{t('services.startDeclaration')}</Text>
              <Ionicons name="arrow-forward" size={20} color="#fff" />
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
  safeArea: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  statusBarBg: {
    height: 50,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 30,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  headerContent: {
    marginTop: 10,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  content: {
    flex: 1,
    padding: 20,
    backgroundColor: '#F9FAFB',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -20,
  },
  continueCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  continueIcon: {
    marginRight: 12,
  },
  continueContent: {
    flex: 1,
  },
  continueTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  continueSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  progressBar: {
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    marginTop: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 3,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 15,
    color: '#6B7280',
    marginBottom: 20,
  },
  serviceCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  serviceCardSelected: {
    shadowOpacity: 0.15,
    elevation: 5,
  },
  serviceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  serviceIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  serviceInfo: {
    flex: 1,
  },
  serviceName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  serviceTagline: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  checkMark: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  serviceDescription: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 20,
    marginBottom: 16,
  },
  featuresList: {
    marginBottom: 16,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  featureText: {
    fontSize: 14,
    color: '#374151',
    marginLeft: 8,
    flex: 1,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  priceLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginRight: 6,
  },
  priceValue: {
    fontSize: 24,
    fontWeight: '700',
  },
  recommendedFor: {
    fontSize: 12,
    color: '#9CA3AF',
    fontStyle: 'italic',
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
  startButton: {
    backgroundColor: '#10B981',
    borderRadius: 14,
    padding: 18,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  startButtonDisabled: {
    backgroundColor: '#D1D5DB',
  },
  startButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
    marginRight: 8,
  },
  // Year Selector Styles
  yearSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  yearSelectorText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    marginHorizontal: 8,
  },
  yearPickerDropdown: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginTop: -10,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
    zIndex: 100,
  },
  yearPickerOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  yearPickerOptionSelected: {
    backgroundColor: '#F0FDF4',
  },
  yearPickerOptionText: {
    fontSize: 16,
    color: '#374151',
  },
  yearPickerOptionTextSelected: {
    fontWeight: '600',
    color: '#065F46',
  },
  // History Styles
  historySection: {
    marginBottom: 24,
  },
  historySectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  historyCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  historyCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  historyYear: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  historyStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  historyStatusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  historyRefund: {
    fontSize: 16,
    fontWeight: '700',
  },
});
