/**
 * Credit Builder - Complete System
 * Onboarding Wizard + Progress Dashboard + Gamification
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Dimensions,
  Animated,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { apiCall } from '../src/utils/api';
import { useAuth } from '../src/contexts/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColors } from '../src/constants/theme';

const { width } = Dimensions.get('window');

// ═══════════════════════════════════════════════════════════════════
// INTERFACES
// ═══════════════════════════════════════════════════════════════════
interface CreditImpact {
  estimated_score_increase: number;
  months_reported: number;
  on_time_payments: number;
  late_payments: number;
  reporting_status: string;
  bureaus_reported: string[];
  next_report_date: string;
  credit_building_streak: number;
}

interface PaymentHistory {
  period: string;
  amount: number;
  due_date: string;
  paid_date: string;
  status: string;
  reported: boolean;
}

interface Badge {
  id: string;
  name: string;
  icon: string;
  description: string;
  earned: boolean;
  earned_date?: string;
}

// ═══════════════════════════════════════════════════════════════════
// ONBOARDING WIZARD COMPONENT
// ═══════════════════════════════════════════════════════════════════
const OnboardingWizard = ({ onComplete, onSkip }: { onComplete: () => void; onSkip: () => void }) => {
  const C = useColors();
  const wizardStyles = React.useMemo(() => createWizardStyles(C), [C]);
  const [currentStep, setCurrentStep] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const [rentAmount, setRentAmount] = useState(1200);

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 280, useNativeDriver: true }).start();
  }, [currentStep]);

  const nextStep = () => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 160, useNativeDriver: true }).start(() => {
      if (currentStep < 4) {
        setCurrentStep(currentStep + 1);
      } else {
        onComplete();
      }
    });
  };

  const prevStep = () => {
    if (currentStep > 0) setCurrentStep(currentStep - 1);
  };

  // Calculate potential savings
  const calculateSavings = (rent: number) => {
    const monthlyInterestSaved = rent * 0.02; // ~2% better rate
    return Math.round(monthlyInterestSaved * 60); // 5 years
  };

  const steps = [
    // Step 0: Intro
    {
      content: (
        <View style={wizardStyles.stepContainer}>
          <View style={wizardStyles.iconCircle}>
            <Ionicons name="trending-up" size={60} color="#10B981" />
          </View>
          <Text style={wizardStyles.mainTitle}>Tu Renta Puede Construir Tu Futuro</Text>
          <Text style={wizardStyles.subtitle}>
            ¿Sabías que pagar renta a tiempo puede aumentar tu puntaje de crédito?
          </Text>
          <View style={wizardStyles.statBox}>
            <Text style={wizardStyles.statNumber}>+40</Text>
            <Text style={wizardStyles.statLabel}>Puntos promedio en 6 meses</Text>
          </View>
        </View>
      ),
    },
    // Step 1: Benefits
    {
      content: (
        <View style={wizardStyles.stepContainer}>
          <Text style={wizardStyles.sectionTitle}>✨ Beneficios Exclusivos</Text>
          
          <View style={wizardStyles.benefitCard}>
            <View style={[wizardStyles.benefitIcon, { backgroundColor: 'rgba(239,68,68,0.15)' }]}>
              <Ionicons name="stats-chart" size={28} color="#EF4444" />
            </View>
            <View style={wizardStyles.benefitText}>
              <Text style={wizardStyles.benefitTitle}>Reportamos a los 3 Burós</Text>
              <Text style={wizardStyles.benefitDesc}>Equifax • TransUnion • Experian</Text>
            </View>
          </View>

          <View style={wizardStyles.benefitCard}>
            <View style={[wizardStyles.benefitIcon, { backgroundColor: 'rgba(59,130,246,0.15)' }]}>
              <Ionicons name="card" size={28} color="#3B82F6" />
            </View>
            <View style={wizardStyles.benefitText}>
              <Text style={wizardStyles.benefitTitle}>Mejor Acceso a Crédito</Text>
              <Text style={wizardStyles.benefitDesc}>Tarjetas, autos, hipotecas</Text>
            </View>
          </View>

          <View style={wizardStyles.benefitCard}>
            <View style={[wizardStyles.benefitIcon, { backgroundColor: 'rgba(16,185,129,0.15)' }]}>
              <Ionicons name="cash" size={28} color="#10B981" />
            </View>
            <View style={wizardStyles.benefitText}>
              <Text style={wizardStyles.benefitTitle}>Mejores Tasas de Interés</Text>
              <Text style={wizardStyles.benefitDesc}>Ahorra miles de dólares</Text>
            </View>
          </View>

          <View style={wizardStyles.benefitCard}>
            <View style={[wizardStyles.benefitIcon, { backgroundColor: 'rgba(168,85,247,0.15)' }]}>
              <Ionicons name="gift" size={28} color="#A855F7" />
            </View>
            <View style={wizardStyles.benefitText}>
              <Text style={wizardStyles.benefitTitle}>Sin Costo Adicional</Text>
              <Text style={wizardStyles.benefitDesc}>Incluido con tu renta</Text>
            </View>
          </View>
        </View>
      ),
    },
    // Step 2: How it works
    {
      content: (
        <View style={wizardStyles.stepContainer}>
          <Text style={wizardStyles.sectionTitle}>📱 Así de Fácil</Text>
          
          <View style={wizardStyles.timeline}>
            <View style={wizardStyles.timelineItem}>
              <View style={wizardStyles.timelineNumber}>
                <Text style={wizardStyles.timelineNumberText}>1</Text>
              </View>
              <View style={wizardStyles.timelineContent}>
                <Text style={wizardStyles.timelineTitle}>Te inscribes</Text>
                <Text style={wizardStyles.timelineDesc}>Solo toma 2 minutos</Text>
              </View>
              <Ionicons name="checkmark-circle" size={24} color="#10B981" />
            </View>

            <View style={wizardStyles.timelineLine} />

            <View style={wizardStyles.timelineItem}>
              <View style={wizardStyles.timelineNumber}>
                <Text style={wizardStyles.timelineNumberText}>2</Text>
              </View>
              <View style={wizardStyles.timelineContent}>
                <Text style={wizardStyles.timelineTitle}>Pagas tu renta</Text>
                <Text style={wizardStyles.timelineDesc}>Como siempre lo haces</Text>
              </View>
              <Ionicons name="card" size={24} color="#3B82F6" />
            </View>

            <View style={wizardStyles.timelineLine} />

            <View style={wizardStyles.timelineItem}>
              <View style={wizardStyles.timelineNumber}>
                <Text style={wizardStyles.timelineNumberText}>3</Text>
              </View>
              <View style={wizardStyles.timelineContent}>
                <Text style={wizardStyles.timelineTitle}>Reportamos automático</Text>
                <Text style={wizardStyles.timelineDesc}>Cada mes sin falta</Text>
              </View>
              <Ionicons name="sync" size={24} color="#F59E0B" />
            </View>

            <View style={wizardStyles.timelineLine} />

            <View style={wizardStyles.timelineItem}>
              <View style={wizardStyles.timelineNumber}>
                <Text style={wizardStyles.timelineNumberText}>4</Text>
              </View>
              <View style={wizardStyles.timelineContent}>
                <Text style={wizardStyles.timelineTitle}>Tu crédito crece</Text>
                <Text style={wizardStyles.timelineDesc}>¡Mes tras mes! 📈</Text>
              </View>
              <Ionicons name="trending-up" size={24} color="#10B981" />
            </View>
          </View>
        </View>
      ),
    },
    // Step 3: Calculator
    {
      content: (
        <View style={wizardStyles.stepContainer}>
          <Text style={wizardStyles.sectionTitle}>📊 Tu Potencial de Ahorro</Text>
          
          <View style={wizardStyles.calculatorCard}>
            <Text style={wizardStyles.calcLabel}>Tu renta mensual aproximada:</Text>
            <View style={wizardStyles.sliderContainer}>
              <TouchableOpacity 
                style={wizardStyles.sliderBtn}
                onPress={() => setRentAmount(Math.max(500, rentAmount - 100))}
              >
                <Ionicons name="remove" size={24} color="#fff" />
              </TouchableOpacity>
              <View style={wizardStyles.rentDisplay}>
                <Text style={wizardStyles.rentAmount}>${rentAmount.toLocaleString()}</Text>
              </View>
              <TouchableOpacity 
                style={wizardStyles.sliderBtn}
                onPress={() => setRentAmount(Math.min(5000, rentAmount + 100))}
              >
                <Ionicons name="add" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            <View style={wizardStyles.projectionBox}>
              <Text style={wizardStyles.projectionTitle}>En 12 meses de pagos a tiempo:</Text>
              
              <View style={wizardStyles.projectionRow}>
                <Ionicons name="arrow-up-circle" size={20} color="#10B981" />
                <Text style={wizardStyles.projectionText}>+35 a +50 puntos de crédito</Text>
              </View>
              
              <View style={wizardStyles.projectionRow}>
                <Ionicons name="cash" size={20} color="#F59E0B" />
                <Text style={wizardStyles.projectionText}>
                  Ahorro potencial: ${calculateSavings(rentAmount).toLocaleString()} en 5 años
                </Text>
              </View>
            </View>
          </View>

          <Text style={wizardStyles.disclaimer}>
            * Resultados varían según historial crediticio individual
          </Text>
        </View>
      ),
    },
    // Step 4: Testimonials + CTA
    {
      content: (
        <View style={wizardStyles.stepContainer}>
          <Text style={wizardStyles.sectionTitle}>🌟 Historias de Éxito</Text>
          
          <View style={wizardStyles.testimonialCard}>
            <View style={wizardStyles.stars}>
              {[1,2,3,4,5].map(i => (
                <Ionicons key={i} name="star" size={16} color="#F59E0B" />
              ))}
            </View>
            <Text style={wizardStyles.testimonialText}>
              &ldquo;Subí 52 puntos en 4 meses. Ahora califiqué para mi primera tarjeta de crédito con buen límite!&rdquo;
            </Text>
            <Text style={wizardStyles.testimonialAuthor}>— María G., Dumas TX</Text>
          </View>

          <View style={wizardStyles.testimonialCard}>
            <View style={wizardStyles.stars}>
              {[1,2,3,4,5].map(i => (
                <Ionicons key={i} name="star" size={16} color="#F59E0B" />
              ))}
            </View>
            <Text style={wizardStyles.testimonialText}>
              &ldquo;Pude refinanciar mi carro y bajé mi pago $80 al mes gracias a mejor crédito.&rdquo;
            </Text>
            <Text style={wizardStyles.testimonialAuthor}>— Carlos R., Amarillo TX</Text>
          </View>

          <View style={wizardStyles.ctaBox}>
            <Ionicons name="shield-checkmark" size={32} color="#10B981" />
            <Text style={wizardStyles.ctaTitle}>¡Estás a un paso!</Text>
            <Text style={wizardStyles.ctaDesc}>Tu primer reporte será el próximo mes</Text>
          </View>
        </View>
      ),
    },
  ];

  return (
    <View style={wizardStyles.container}>
      {/* Progress Dots */}
      <View style={wizardStyles.progressDots}>
        {steps.map((_, index) => (
          <View
            key={index}
            style={[
              wizardStyles.dot,
              index === currentStep && wizardStyles.dotActive,
              index < currentStep && wizardStyles.dotCompleted,
            ]}
          />
        ))}
      </View>

      {/* Content */}
      <Animated.View
        style={[
          wizardStyles.content,
          { opacity: fadeAnim },
        ]}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={wizardStyles.scrollContent}
        >
          {steps[currentStep].content}
        </ScrollView>
      </Animated.View>

      {/* Navigation */}
      <View style={wizardStyles.navigation}>
        {currentStep > 0 ? (
          <TouchableOpacity style={wizardStyles.backBtn} onPress={prevStep}>
            <Ionicons name="arrow-back" size={20} color="#9CA3AF" />
            <Text style={wizardStyles.backText}>Atrás</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={wizardStyles.backBtn} onPress={onSkip}>
            <Text style={wizardStyles.skipText}>Omitir</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={wizardStyles.nextBtn} onPress={nextStep}>
          <LinearGradient
            colors={currentStep === 4 ? ['#10B981', '#059669'] : ['#C9A227', '#B8860B']}
            style={wizardStyles.nextBtnGradient}
          >
            <Text style={wizardStyles.nextBtnText}>
              {currentStep === 4 ? '¡Inscribirme Ahora!' : 'Siguiente'}
            </Text>
            <Ionicons 
              name={currentStep === 4 ? 'checkmark-circle' : 'arrow-forward'} 
              size={20} 
              color="#fff" 
            />
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// ═══════════════════════════════════════════════════════════════════
// MAIN CREDIT BUILDER SCREEN
// ═══════════════════════════════════════════════════════════════════
export default function CreditBuilderScreen() {
  const C = useColors();
  const styles = React.useMemo(() => createStyles(C), [C]);
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [enrolled, setEnrolled] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [creditImpact, setCreditImpact] = useState<CreditImpact | null>(null);
  const [paymentHistory, setPaymentHistory] = useState<PaymentHistory[]>([]);
  const [badges, setBadges] = useState<Badge[]>([]);
  
  // Animations
  const streakAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  const fetchStatus = useCallback(async () => {
    try {
      const data = await apiCall('/rent-reporting/my-status');
      
      if (data.success) {
        setEnrolled(data.enrolled);
        if (data.enrolled) {
          setCreditImpact(data.credit_impact);
          setPaymentHistory(data.payment_history || []);
          setBadges(data.badges || generateBadges(data.credit_impact));
          
          // Animate progress
          Animated.timing(progressAnim, {
            toValue: (data.credit_impact?.months_reported || 0) / 12,
            duration: 1000,
            useNativeDriver: false,
          }).start();
          
          // Animate streak
          Animated.spring(streakAnim, {
            toValue: 1,
            friction: 3,
            useNativeDriver: true,
          }).start();
        } else {
          // Check if user has seen onboarding
          const seenOnboarding = await AsyncStorage.getItem('credit_builder_onboarding_seen');
          if (!seenOnboarding) {
            setShowOnboarding(true);
          }
        }
      }
    } catch (e) {
      console.error('Error fetching status:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Generate badges based on progress
  const generateBadges = (impact: CreditImpact | null): Badge[] => {
    if (!impact) return [];
    
    return [
      {
        id: 'first_report',
        name: 'Primer Reporte',
        icon: 'ribbon',
        description: 'Tu primer pago fue reportado',
        earned: impact.months_reported >= 1,
      },
      {
        id: 'streak_3',
        name: 'Racha de 3',
        icon: 'flame',
        description: '3 meses consecutivos a tiempo',
        earned: impact.credit_building_streak >= 3,
      },
      {
        id: 'streak_6',
        name: 'Medio Año',
        icon: 'trophy',
        description: '6 meses consecutivos a tiempo',
        earned: impact.credit_building_streak >= 6,
      },
      {
        id: 'perfect_year',
        name: 'Año Perfecto',
        icon: 'medal',
        description: '12 meses sin pagos tardíos',
        earned: impact.months_reported >= 12 && impact.late_payments === 0,
      },
      {
        id: 'all_bureaus',
        name: 'Triple Impacto',
        icon: 'shield-checkmark',
        description: 'Reportado a los 3 burós',
        earned: (impact.bureaus_reported?.length || 0) >= 3,
      },
    ];
  };

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleEnroll = async () => {
    setEnrolling(true);
    try {
      const data = await apiCall('/rent-reporting/enroll', {
        method: 'POST',
        body: { agree_to_terms: true },
      });
      
      if (data.success) {
        await AsyncStorage.setItem('credit_builder_onboarding_seen', 'true');
        Alert.alert(
          '🎉 ¡Felicidades!',
          'Te has inscrito exitosamente en Credit Builder. Tu primer reporte será el próximo mes.',
          [{ text: 'Entendido', onPress: fetchStatus }]
        );
        setShowOnboarding(false);
      } else {
        Alert.alert('Error', data.detail || 'No se pudo completar la inscripción');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Error de conexión');
    } finally {
      setEnrolling(false);
    }
  };

  const handleSkipOnboarding = async () => {
    await AsyncStorage.setItem('credit_builder_onboarding_seen', 'true');
    setShowOnboarding(false);
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchStatus();
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#C9A227" />
        <Text style={styles.loadingText}>Cargando...</Text>
      </View>
    );
  }

  // Show onboarding for non-enrolled users
  if (showOnboarding && !enrolled) {
    return (
      <SafeAreaView style={styles.container}>
        <LinearGradient colors={[C.surfaceLight, C.background]} style={styles.gradient}>
          <OnboardingWizard 
            onComplete={handleEnroll} 
            onSkip={handleSkipOnboarding}
          />
        </LinearGradient>
      </SafeAreaView>
    );
  }

  // Not enrolled - show simple enrollment CTA
  if (!enrolled) {
    return (
      <SafeAreaView style={styles.container}>
        <LinearGradient colors={[C.surfaceLight, C.background]} style={styles.gradient}>
          <ScrollView contentContainerStyle={styles.scrollContent}>
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                <Ionicons name="arrow-back" size={24} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Credit Builder</Text>
              <View style={{ width: 40 }} />
            </View>

            <View style={styles.enrollContainer}>
              <View style={styles.enrollIcon}>
                <Ionicons name="trending-up" size={80} color="#10B981" />
              </View>
              <Text style={styles.enrollTitle}>Construye Tu Crédito</Text>
              <Text style={styles.enrollSubtitle}>
                Reportamos tus pagos de renta a los 3 burós de crédito para ayudarte a construir historial.
              </Text>
              
              <TouchableOpacity 
                style={styles.enrollBtn}
                onPress={() => setShowOnboarding(true)}
              >
                <LinearGradient
                  colors={['#10B981', '#059669']}
                  style={styles.enrollBtnGradient}
                >
                  <Text style={styles.enrollBtnText}>Ver Beneficios</Text>
                  <Ionicons name="arrow-forward" size={20} color="#fff" />
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  // Enrolled - show dashboard
  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={[C.surfaceLight, C.background]} style={styles.gradient}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#C9A227" />
          }
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Credit Builder</Text>
            <View style={styles.statusBadge}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>Activo</Text>
            </View>
          </View>

          {/* Streak Card */}
          {creditImpact && creditImpact.credit_building_streak > 0 && (
            <Animated.View style={[
              styles.streakCard,
              { transform: [{ scale: streakAnim }] }
            ]}>
              <LinearGradient
                colors={['#F59E0B', '#D97706']}
                style={styles.streakGradient}
              >
                <View style={styles.streakContent}>
                  <Ionicons name="flame" size={40} color="#fff" />
                  <View style={styles.streakInfo}>
                    <Text style={styles.streakNumber}>{creditImpact.credit_building_streak}</Text>
                    <Text style={styles.streakLabel}>meses seguidos a tiempo</Text>
                  </View>
                </View>
                <Text style={styles.streakMotivation}>
                  {creditImpact.credit_building_streak >= 6 
                    ? '🏆 ¡Excelente racha!' 
                    : '¡Sigue así! 💪'}
                </Text>
              </LinearGradient>
            </Animated.View>
          )}

          {/* Credit Impact Card */}
          <View style={styles.impactCard}>
            <View style={styles.impactHeader}>
              <Text style={styles.impactTitle}>📊 Tu Impacto de Crédito</Text>
            </View>
            
            <View style={styles.impactStats}>
              <View style={styles.impactStat}>
                <Text style={styles.impactStatNumber}>
                  +{creditImpact?.estimated_score_increase || 0}
                </Text>
                <Text style={styles.impactStatLabel}>Puntos Est.</Text>
              </View>
              <View style={styles.impactDivider} />
              <View style={styles.impactStat}>
                <Text style={styles.impactStatNumber}>
                  {creditImpact?.months_reported || 0}
                </Text>
                <Text style={styles.impactStatLabel}>Meses</Text>
              </View>
              <View style={styles.impactDivider} />
              <View style={styles.impactStat}>
                <Text style={styles.impactStatNumber}>
                  {creditImpact?.on_time_payments || 0}
                </Text>
                <Text style={styles.impactStatLabel}>A Tiempo</Text>
              </View>
            </View>

            {/* Progress Bar */}
            <View style={styles.progressContainer}>
              <Text style={styles.progressLabel}>Progreso Anual</Text>
              <View style={styles.progressBar}>
                <Animated.View 
                  style={[
                    styles.progressFill,
                    { 
                      width: progressAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0%', '100%'],
                      })
                    }
                  ]} 
                />
              </View>
              <Text style={styles.progressText}>
                {creditImpact?.months_reported || 0}/12 meses
              </Text>
            </View>

            {/* Bureaus */}
            <View style={styles.bureausContainer}>
              <Text style={styles.bureausTitle}>Burós Reportados:</Text>
              <View style={styles.bureausList}>
                {['Equifax', 'TransUnion', 'Experian'].map((bureau) => (
                  <View key={bureau} style={styles.bureauBadge}>
                    <Ionicons 
                      name="checkmark-circle" 
                      size={16} 
                      color={creditImpact?.bureaus_reported?.includes(bureau) ? '#10B981' : '#4B5563'} 
                    />
                    <Text style={[
                      styles.bureauText,
                      creditImpact?.bureaus_reported?.includes(bureau) && styles.bureauTextActive
                    ]}>{bureau}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>

          {/* Badges Section */}
          <View style={styles.badgesSection}>
            <Text style={styles.sectionTitle}>🏅 Tus Logros</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {badges.map((badge) => (
                <View 
                  key={badge.id} 
                  style={[
                    styles.badgeCard,
                    !badge.earned && styles.badgeCardLocked
                  ]}
                >
                  <View style={[
                    styles.badgeIcon,
                    badge.earned && styles.badgeIconEarned
                  ]}>
                    <Ionicons 
                      name={badge.icon as any} 
                      size={32} 
                      color={badge.earned ? '#F59E0B' : '#4B5563'} 
                    />
                  </View>
                  <Text style={[
                    styles.badgeName,
                    !badge.earned && styles.badgeNameLocked
                  ]}>{badge.name}</Text>
                  {!badge.earned && (
                    <Ionicons name="lock-closed" size={12} color="#6B7280" />
                  )}
                </View>
              ))}
            </ScrollView>
          </View>

          {/* Payment History */}
          <View style={styles.historySection}>
            <Text style={styles.sectionTitle}>📋 Historial de Pagos</Text>
            {paymentHistory.length === 0 ? (
              <View style={styles.emptyHistory}>
                <Ionicons name="document-text-outline" size={40} color="#4B5563" />
                <Text style={styles.emptyText}>Tu historial aparecerá aquí</Text>
              </View>
            ) : (
              paymentHistory.slice(0, 6).map((payment, index) => (
                <View key={index} style={styles.historyItem}>
                  <View style={styles.historyLeft}>
                    <Ionicons 
                      name={payment.status === 'on_time' ? 'checkmark-circle' : 'alert-circle'}
                      size={24}
                      color={payment.status === 'on_time' ? '#10B981' : '#F59E0B'}
                    />
                    <View style={styles.historyInfo}>
                      <Text style={styles.historyPeriod}>{payment.period}</Text>
                      <Text style={styles.historyDate}>Pagado: {payment.paid_date}</Text>
                    </View>
                  </View>
                  <View style={styles.historyRight}>
                    <Text style={styles.historyAmount}>${payment.amount}</Text>
                    {payment.reported && (
                      <View style={styles.reportedBadge}>
                        <Text style={styles.reportedText}>Reportado</Text>
                      </View>
                    )}
                  </View>
                </View>
              ))
            )}
          </View>

          {/* Next Report Info */}
          {creditImpact?.next_report_date && (
            <View style={styles.nextReportCard}>
              <Ionicons name="calendar" size={24} color="#3B82F6" />
              <View style={styles.nextReportInfo}>
                <Text style={styles.nextReportLabel}>Próximo reporte:</Text>
                <Text style={styles.nextReportDate}>{creditImpact.next_report_date}</Text>
              </View>
            </View>
          )}

          {/* Tips */}
          <View style={styles.tipsSection}>
            <Text style={styles.sectionTitle}>💡 Consejos</Text>
            <View style={styles.tipCard}>
              <Ionicons name="bulb" size={20} color="#F59E0B" />
              <Text style={styles.tipText}>
                Paga antes del día 5 para asegurar que tu pago se reporte como &ldquo;a tiempo&rdquo;
              </Text>
            </View>
            <View style={styles.tipCard}>
              <Ionicons name="time" size={20} color="#3B82F6" />
              <Text style={styles.tipText}>
                Los pagos consistentes por 6+ meses tienen mayor impacto en tu crédito
              </Text>
            </View>
          </View>

        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

// ═══════════════════════════════════════════════════════════════════
// WIZARD STYLES
// ═══════════════════════════════════════════════════════════════════
const createWizardStyles = (C: any) => StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },
  progressDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingTop: 20,
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#374151',
  },
  dotActive: {
    width: 24,
    backgroundColor: '#C9A227',
  },
  dotCompleted: {
    backgroundColor: '#10B981',
  },
  content: {
    flex: 1,
    paddingTop: 20,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'stretch',
    width: '100%',
  },
  stepContainer: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingBottom: 120,
  },
  iconCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'rgba(16,185,129,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  mainTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: C.textPrimary,
    textAlign: 'center',
    marginBottom: 12,
    paddingHorizontal: 8,
    letterSpacing: -0.5,
    lineHeight: 32,
  },
  subtitle: {
    fontSize: 15,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 12,
    marginBottom: 24,
  },
  statBox: {
    backgroundColor: 'rgba(16,185,129,0.15)',
    paddingVertical: 18,
    paddingHorizontal: 32,
    borderRadius: 16,
    alignItems: 'center',
    alignSelf: 'center',
    maxWidth: '90%',
  },
  statNumber: {
    fontSize: 42,
    fontWeight: '700',
    color: '#10B981',
  },
  statLabel: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 4,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: C.textPrimary,
    marginBottom: 20,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  benefitCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surfaceLight,
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
    width: '100%',
  },
  benefitIcon: {
    width: 46,
    height: 46,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  benefitText: {
    flex: 1,
    marginLeft: 12,
    flexShrink: 1,
  },
  benefitTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: C.textPrimary,
    flexWrap: 'wrap',
  },
  benefitDesc: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
    flexWrap: 'wrap',
  },
  timeline: {
    width: '100%',
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  timelineNumber: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#C9A227',
    justifyContent: 'center',
    alignItems: 'center',
  },
  timelineNumberText: {
    fontSize: 15,
    fontWeight: '700',
    color: C.textPrimary,
  },
  timelineContent: {
    flex: 1,
    marginLeft: 12,
    flexShrink: 1,
  },
  timelineTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: C.textPrimary,
  },
  timelineDesc: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 1,
  },
  timelineLine: {
    width: 2,
    height: 16,
    backgroundColor: '#374151',
    marginLeft: 16,
  },
  calculatorCard: {
    backgroundColor: C.surfaceLight,
    padding: 18,
    borderRadius: 16,
    width: '100%',
  },
  calcLabel: {
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: 16,
  },
  sliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    marginBottom: 20,
  },
  sliderBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#374151',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rentDisplay: {
    paddingHorizontal: 16,
    minWidth: 140,
    alignItems: 'center',
  },
  rentAmount: {
    fontSize: 32,
    fontWeight: '700',
    color: '#10B981',
    textAlign: 'center',
  },
  projectionBox: {
    backgroundColor: 'rgba(16,185,129,0.1)',
    padding: 14,
    borderRadius: 12,
  },
  projectionTitle: {
    fontSize: 13,
    color: '#9CA3AF',
    marginBottom: 10,
    textAlign: 'center',
  },
  projectionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 8,
  },
  projectionText: {
    fontSize: 13,
    color: C.textPrimary,
    flex: 1,
    flexWrap: 'wrap',
    lineHeight: 18,
  },
  disclaimer: {
    fontSize: 11,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 14,
    paddingHorizontal: 16,
  },
  testimonialCard: {
    backgroundColor: C.surfaceLight,
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
    width: '100%',
  },
  stars: {
    flexDirection: 'row',
    marginBottom: 8,
    justifyContent: 'center',
  },
  testimonialText: {
    fontSize: 14,
    color: C.textPrimary,
    fontStyle: 'italic',
    lineHeight: 21,
    marginBottom: 8,
    textAlign: 'center',
  },
  testimonialAuthor: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  ctaBox: {
    backgroundColor: 'rgba(16,185,129,0.15)',
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 12,
    width: '100%',
  },
  ctaTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: C.textPrimary,
    marginTop: 8,
    textAlign: 'center',
  },
  ctaDesc: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 4,
    textAlign: 'center',
  },
  navigation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 4,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
  },
  backText: {
    fontSize: 15,
    color: '#9CA3AF',
    marginLeft: 4,
  },
  skipText: {
    fontSize: 15,
    color: '#6B7280',
  },
  nextBtn: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  nextBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 22,
    gap: 8,
  },
  nextBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: C.textPrimary,
  },
});

// ═══════════════════════════════════════════════════════════════════
// MAIN STYLES
// ═══════════════════════════════════════════════════════════════════
const createStyles = (C: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.background,
  },
  gradient: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: C.background,
  },
  loadingText: {
    color: '#9CA3AF',
    marginTop: 12,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: C.textPrimary,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16,185,129,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
    marginRight: 6,
  },
  statusText: {
    fontSize: 13,
    color: '#10B981',
    fontWeight: '600',
  },
  // Enrollment
  enrollContainer: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 40,
  },
  enrollIcon: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(16,185,129,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  enrollTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: C.textPrimary,
    marginBottom: 12,
    textAlign: 'center',
    paddingHorizontal: 8,
    letterSpacing: -0.5,
  },
  enrollSubtitle: {
    fontSize: 15,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
    paddingHorizontal: 4,
  },
  enrollBtn: {
    borderRadius: 12,
    overflow: 'hidden',
    width: '100%',
  },
  enrollBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  enrollBtnText: {
    fontSize: 18,
    fontWeight: '600',
    color: C.textPrimary,
  },
  // Streak Card
  streakCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  streakGradient: {
    padding: 20,
  },
  streakContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  streakInfo: {
    marginLeft: 16,
    flex: 1,
    flexShrink: 1,
  },
  streakNumber: {
    fontSize: 34,
    fontWeight: '700',
    color: C.textPrimary,
  },
  streakLabel: {
    fontSize: 13,
    color: C.textSecondary,
    flexWrap: 'wrap',
  },
  streakMotivation: {
    fontSize: 15,
    color: C.textPrimary,
    fontWeight: '600',
    marginTop: 12,
    textAlign: 'center',
  },
  // Impact Card
  impactCard: {
    backgroundColor: C.surfaceLight,
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  impactHeader: {
    marginBottom: 16,
  },
  impactTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: C.textPrimary,
  },
  impactStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  impactStat: {
    alignItems: 'center',
    flex: 1,
  },
  impactStatNumber: {
    fontSize: 28,
    fontWeight: '700',
    color: '#10B981',
    textAlign: 'center',
  },
  impactStatLabel: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 4,
    textAlign: 'center',
  },
  impactDivider: {
    width: 1,
    backgroundColor: '#374151',
  },
  progressContainer: {
    marginTop: 8,
  },
  progressLabel: {
    fontSize: 13,
    color: '#9CA3AF',
    marginBottom: 8,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#374151',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'right',
    marginTop: 4,
  },
  bureausContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#374151',
  },
  bureausTitle: {
    fontSize: 13,
    color: '#9CA3AF',
    marginBottom: 8,
  },
  bureausList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  bureauBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  bureauText: {
    fontSize: 13,
    color: '#6B7280',
  },
  bureauTextActive: {
    color: '#10B981',
  },
  // Badges
  badgesSection: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: C.textPrimary,
    marginBottom: 12,
  },
  badgeCard: {
    backgroundColor: C.surfaceLight,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginRight: 12,
    width: 100,
  },
  badgeCardLocked: {
    opacity: 0.5,
  },
  badgeIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#374151',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  badgeIconEarned: {
    backgroundColor: 'rgba(245,158,11,0.2)',
  },
  badgeName: {
    fontSize: 12,
    color: C.textPrimary,
    textAlign: 'center',
  },
  badgeNameLocked: {
    color: '#6B7280',
  },
  // History
  historySection: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  emptyHistory: {
    backgroundColor: C.surfaceLight,
    padding: 32,
    borderRadius: 12,
    alignItems: 'center',
  },
  emptyText: {
    color: '#6B7280',
    marginTop: 8,
  },
  historyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: C.surfaceLight,
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
  },
  historyLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  historyInfo: {
    marginLeft: 12,
  },
  historyPeriod: {
    fontSize: 15,
    fontWeight: '600',
    color: C.textPrimary,
  },
  historyDate: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  historyRight: {
    alignItems: 'flex-end',
  },
  historyAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: C.textPrimary,
  },
  reportedBadge: {
    backgroundColor: 'rgba(16,185,129,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  reportedText: {
    fontSize: 10,
    color: '#10B981',
    fontWeight: '600',
  },
  // Next Report
  nextReportCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(59,130,246,0.1)',
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  nextReportInfo: {
    marginLeft: 12,
  },
  nextReportLabel: {
    fontSize: 13,
    color: '#9CA3AF',
  },
  nextReportDate: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3B82F6',
  },
  // Tips
  tipsSection: {
    paddingHorizontal: 16,
  },
  tipCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: C.surfaceLight,
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
  },
  tipText: {
    flex: 1,
    fontSize: 14,
    color: '#D1D5DB',
    marginLeft: 12,
    lineHeight: 20,
  },
});
