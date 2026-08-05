/**
 * Subscription Plans Screen with In-App Purchases
 * For iOS App Store compliance
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  RefreshControl,
  DeviceEventEmitter,
  Linking,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import iapService, { IAPProduct, IAP_PRODUCT_IDS, IAP_SUBSCRIPTION_UPDATED_EVENT, IAP_BALANCE_UPDATED_EVENT } from '../../services/iapService';
import api from '../../services/api';

interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  price: number;
  interval: string;
  features: string[];
  is_popular?: boolean;
  apple_product_id?: string;
  iapProduct?: IAPProduct;
}

const colors = {
  primary: '#10B981',
  secondary: '#4682B4',
  success: '#10b981',
  background: '#f5f7fa',
  card: '#ffffff',
  text: '#1f2937',
  textLight: '#6b7280',
  border: '#e5e7eb',
};

export default function SubscriptionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [currentSubscription, setCurrentSubscription] = useState<any>(null);
  const [iapProducts, setIapProducts] = useState<IAPProduct[]>([]);

  useEffect(() => {
    loadData();
    // Also sync from Apple when component mounts
    syncFromApple();
  }, []);

  // Sync subscription state from Apple (silently, no alerts)
  const syncFromApple = async () => {
    if (Platform.OS === 'ios') {
      try {
        await iapService.initialize();
        // Call restore to sync all purchases (silent mode - no alerts)
        const result = await iapService.restorePurchases(false);
        if (result.success) {
          // Reload data after sync
          setTimeout(loadData, 1000);
        }
      } catch (error) {
      }
    }
  };

  // Refresh data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadData();
      // Also sync from Apple when screen gains focus
      syncFromApple();
    }, [])
  );

  // Listen for IAP subscription update events - for auto-refresh after purchases
  useEffect(() => {
    
    // Listen for subscription updates
    const subscriptionListener = DeviceEventEmitter.addListener(
      IAP_SUBSCRIPTION_UPDATED_EVENT,
      () => {
        // Reload subscription data immediately and with delays
        loadData();
        setTimeout(loadData, 1000);
        setTimeout(loadData, 3000);
        setTimeout(loadData, 5000);
      }
    );

    // Also listen for balance updates (subscriptions might include credits)
    const balanceListener = DeviceEventEmitter.addListener(
      IAP_BALANCE_UPDATED_EVENT,
      () => {
        loadData();
        setTimeout(loadData, 2000);
      }
    );

    return () => {
      subscriptionListener.remove();
      balanceListener.remove();
    };
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load plans from backend
      const plansResponse = await api.get('/payments/plans');
      const backendPlans = plansResponse.data || [];

      // Load current subscription
      try {
        const subResponse = await api.get('/payments/subscription');
        setCurrentSubscription(subResponse.data);
      } catch (e) {
        // No subscription
      }

      // On iOS, load IAP products
      if (Platform.OS === 'ios') {
        await iapService.initialize();
        const products = await iapService.getProducts();
        setIapProducts(products);

        // Match IAP products with backend plans
        const enrichedPlans = backendPlans.map((plan: SubscriptionPlan) => {
          const iapProduct = products.find(p => p.productId === plan.apple_product_id);
          return { ...plan, iapProduct };
        });
        setPlans(enrichedPlans);
      } else {
        setPlans(backendPlans);
      }
    } catch (error) {
      console.error('Error loading subscription data:', error);
      Alert.alert('Error', 'No se pudieron cargar los planes');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handlePurchase = async (plan: SubscriptionPlan) => {
    // Use In-App Purchase on iOS
    if (Platform.OS === 'ios' && plan.apple_product_id) {
      setPurchasing(plan.id);
      
      try {
        // Initialize IAP if needed
        await iapService.initialize();
        
        // Start the purchase flow
        const result = await iapService.purchaseSubscription(plan.apple_product_id);
        
        if (!result.success && result.error) {
          Alert.alert('Error', result.error);
        }
        // Success is handled by the purchase listener in iapService
        // But we also refresh here just in case
        
      } catch (error: any) {
        console.error('Purchase error:', error);
        Alert.alert(
          'Error de Compra',
          error.message || 'No se pudo completar la compra. Por favor intenta de nuevo.'
        );
      } finally {
        setPurchasing(null);
        // Force refresh data after any purchase attempt (success or fail)
        // Multiple refreshes to ensure we catch the update
        setTimeout(() => loadData(), 1000);
        setTimeout(() => loadData(), 3000);
        setTimeout(() => loadData(), 6000);
      }
    } else {
      // Fallback to web for non-iOS or if no apple_product_id
      const webSubscriptionUrl = 'https://rosstaxpreparation.com/suscripcion';
      
      Alert.alert(
        t('subscriptions.webSubscription', '💳 Suscripción Web'),
        t('subscriptions.redirectMessage', 'Para completar tu suscripción, serás redirigido a nuestra página de pagos segura.'),
        [
          { text: t('common.cancel', 'Cancelar'), style: 'cancel' },
          { 
            text: t('subscriptions.continuePayment', 'Continuar al Pago'),
            onPress: async () => {
              try {
                const { Linking } = require('react-native');
                await Linking.openURL(webSubscriptionUrl);
              } catch (error) {
                Alert.alert(t('common.error', 'Error'), t('subscriptions.browserError', 'No se pudo abrir el navegador. Por favor visita rosstaxpreparation.com/suscripcion'));
              }
            }
          }
        ]
      );
    }
  };

  const handleRestorePurchases = async () => {
    if (Platform.OS !== 'ios') {
      Alert.alert('Info', 'La restauración de compras solo está disponible en iOS');
      return;
    }

    setPurchasing('restore');
    try {
      await iapService.restorePurchases();
      await loadData(); // Refresh data
    } finally {
      setPurchasing(null);
    }
  };

  const renderPlanCard = (plan: SubscriptionPlan) => {
    const isCurrentPlan = currentSubscription?.plan_id === plan.id;
    const isPurchasing = purchasing === plan.id;
    const displayPrice = plan.iapProduct?.price || `$${plan.price.toFixed(2)}`;

    return (
      <View 
        key={plan.id}
        style={[
          styles.planCard,
          plan.is_popular && styles.popularCard,
          isCurrentPlan && styles.currentPlanCard
        ]}
      >
        {plan.is_popular && (
          <View style={styles.popularBadge}>
            <Text style={styles.popularBadgeText}>MÁS POPULAR</Text>
          </View>
        )}

        {isCurrentPlan && (
          <View style={styles.currentBadge}>
            <Ionicons name="checkmark-circle" size={16} color="#fff" />
            <Text style={styles.currentBadgeText}>Plan Actual</Text>
          </View>
        )}

        <Text style={styles.planName}>{plan.name}</Text>
        <Text style={styles.planDescription}>{plan.description}</Text>

        <View style={styles.priceContainer}>
          <Text style={styles.priceAmount}>{displayPrice}</Text>
          <Text style={styles.priceInterval}>
            /{plan.interval === 'monthly' ? 'mes' : 'año'}
          </Text>
        </View>

        <View style={styles.featuresContainer}>
          {plan.features?.map((feature, index) => (
            <View key={index} style={styles.featureRow}>
              <Ionicons name="checkmark-circle" size={18} color={colors.success} />
              <Text style={styles.featureText}>{feature}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={[
            styles.purchaseButton,
            plan.is_popular && styles.purchaseButtonPopular,
            isCurrentPlan && styles.purchaseButtonDisabled
          ]}
          onPress={() => handlePurchase(plan)}
          disabled={isCurrentPlan || isPurchasing}
        >
          {isPurchasing ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.purchaseButtonText}>
              {isCurrentPlan ? 'Plan Actual' : 'Suscribirse'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Cargando planes...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <LinearGradient
        colors={['#10B981', '#059669']}
        style={[styles.header, { paddingTop: insets.top }]}
      >
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Planes de Suscripción</Text>
          {currentSubscription ? (
            <Text style={styles.headerSubtitle}>
              Plan Actual: {currentSubscription.plan_name || 'Activo'} ✓
            </Text>
          ) : (
            <Text style={styles.headerSubtitle}>Elige el plan perfecto para ti</Text>
          )}
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadData();
            }}
          />
        }
      >
        {/* Premium Features Banner */}
        <View style={styles.webPaymentBanner}>
          <View style={styles.bannerIconContainer}>
            <Ionicons name="star" size={24} color="#10b981" />
          </View>
          <View style={styles.bannerTextContainer}>
            <Text style={styles.bannerTitle}>⭐ Beneficios Premium</Text>
            <Text style={styles.bannerDescription}>
              Suscríbete para acceder a todas las funciones premium de Ross Tax Preparation. Pago seguro a través de Apple.
            </Text>
          </View>
        </View>

        {plans.map(renderPlanCard)}

        {/* Restore Purchases Button (iOS only) */}
        {Platform.OS === 'ios' && (
          <TouchableOpacity
            style={styles.restoreButton}
            onPress={handleRestorePurchases}
            disabled={purchasing === 'restore'}
          >
            {purchasing === 'restore' ? (
              <ActivityIndicator color={colors.primary} size="small" />
            ) : (
              <>
                <Ionicons name="refresh" size={18} color={colors.primary} />
                <Text style={styles.restoreButtonText}>Restaurar Compras</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {/* Manage/Cancel Subscription Button (iOS only) */}
        {Platform.OS === 'ios' && currentSubscription && (
          <TouchableOpacity
            style={styles.manageButton}
            onPress={() => {
              // This opens the Apple Subscription management page
              Linking.openURL('https://apps.apple.com/account/subscriptions');
            }}
          >
            <Ionicons name="settings-outline" size={18} color={colors.textLight} />
            <Text style={styles.manageButtonText}>Administrar o Cancelar Suscripción</Text>
          </TouchableOpacity>
        )}

        {/* Terms and Privacy - Apple App Store Requirements */}
        <View style={styles.legalContainer}>
          <Text style={styles.legalTitle}>Información de Suscripción</Text>
          
          {Platform.OS === 'ios' && (
            <View style={styles.subscriptionInfoBox}>
              <Text style={styles.subscriptionInfoText}>
                • El pago se cargará a tu cuenta de Apple ID al confirmar la compra
              </Text>
              <Text style={styles.subscriptionInfoText}>
                • La suscripción se renueva automáticamente a menos que desactives la renovación al menos 24 horas antes del fin del período actual
              </Text>
              <Text style={styles.subscriptionInfoText}>
                • Tu cuenta será cargada por la renovación dentro de las 24 horas previas al fin del período actual
              </Text>
              <Text style={styles.subscriptionInfoText}>
                • Puedes administrar y cancelar tus suscripciones en los Ajustes de tu cuenta de Apple después de la compra
              </Text>
            </View>
          )}
          
          <Text style={styles.legalText}>
            Al suscribirte, aceptas nuestros{' '}
            <Text style={styles.legalLink} onPress={() => Linking.openURL('https://www.rosstaxpreparation.com/terms')}>
              Términos y Condiciones (EULA)
            </Text>
            {' '}y nuestra{' '}
            <Text style={styles.legalLink} onPress={() => Linking.openURL('https://www.rosstaxpreparation.com/privacy')}>
              Política de Privacidad
            </Text>
          </Text>
          
          <Text style={styles.legalTextSmall}>
            Uso sujeto a los Términos de Apple Media Services:{'\n'}
            https://www.apple.com/legal/internet-services/itunes/
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: colors.textLight,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
    marginBottom: 8,
  },
  headerContent: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  planCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  popularCard: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  currentPlanCard: {
    borderColor: colors.success,
    backgroundColor: '#f0fdf4',
  },
  popularBadge: {
    position: 'absolute',
    top: -12,
    right: 20,
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  popularBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  currentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.success,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 12,
    gap: 4,
  },
  currentBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  planName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 4,
  },
  planDescription: {
    fontSize: 14,
    color: colors.textLight,
    marginBottom: 16,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 16,
  },
  priceAmount: {
    fontSize: 36,
    fontWeight: 'bold',
    color: colors.primary,
  },
  priceInterval: {
    fontSize: 16,
    color: colors.textLight,
    marginLeft: 4,
  },
  featuresContainer: {
    marginBottom: 20,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 10,
  },
  featureText: {
    fontSize: 14,
    color: colors.text,
    flex: 1,
  },
  purchaseButton: {
    backgroundColor: colors.secondary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  purchaseButtonPopular: {
    backgroundColor: colors.primary,
  },
  purchaseButtonDisabled: {
    backgroundColor: colors.success,
  },
  purchaseButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  restoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  restoreButtonText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '500',
  },
  manageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginTop: 8,
    gap: 8,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    marginHorizontal: 4,
  },
  manageButtonText: {
    color: colors.textLight,
    fontSize: 14,
    fontWeight: '500',
  },
  legalContainer: {
    marginTop: 20,
    paddingHorizontal: 10,
  },
  legalText: {
    fontSize: 12,
    color: colors.textLight,
    textAlign: 'center',
    lineHeight: 18,
  },
  legalLink: {
    color: colors.primary,
    textDecorationLine: 'underline',
  },
  legalTextSmall: {
    fontSize: 11,
    color: colors.textLight,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 16,
  },
  legalTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  subscriptionInfoBox: {
    backgroundColor: '#f0f9ff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  subscriptionInfoText: {
    fontSize: 12,
    color: '#0369a1',
    lineHeight: 18,
    marginBottom: 6,
  },
  webPaymentBanner: {
    flexDirection: 'row',
    backgroundColor: '#ecfdf5',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#a7f3d0',
    alignItems: 'flex-start',
  },
  bannerIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#d1fae5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  bannerTextContainer: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#065f46',
    marginBottom: 4,
  },
  bannerDescription: {
    fontSize: 13,
    color: '#047857',
    lineHeight: 18,
  },
});
