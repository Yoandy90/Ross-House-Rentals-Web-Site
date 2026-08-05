import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Platform,
  Animated,
  Dimensions,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Keyboard,
  Share,
  DeviceEventEmitter,
} from 'react-native';
import { IAP_BALANCE_UPDATED_EVENT } from '../../services/iapService';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { useThemeColors } from '../../constants/colors';
import api from '../../services/api';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { BarChart } from 'react-native-gifted-charts';
// Conditional import for native-only Stripe module
// Temporarily disabled for web compatibility
// TODO: Create separate .native.tsx and .web.tsx files for platform-specific code
let CreditPurchaseModal: any = null;
// if (Platform.OS !== 'web') {
//   CreditPurchaseModal = require('../../components/CreditPurchaseModal').CreditPurchaseModal;
// }
import { TransferModal } from '../../components/TransferModal';
import { RequestModal } from '../../components/RequestModal';
import { WithdrawalModal } from '../../components/WithdrawalModal';
import { StripeCheckoutModal } from '../../components/StripeCheckoutModal';
import NativePaymentModal from '../../components/NativePaymentModalNew';
import { MobilePaymentModal } from '../../components/MobilePaymentModal';
import { CustomStripePaymentModal } from '../../components/CustomStripePaymentModal';
import { ReceiveMoneyModal } from '../../components/ReceiveMoneyModal';
import CustomHeader from '../../components/CustomHeader';

const { width } = Dimensions.get('window');

interface CreditPackage {
  id: string;
  name: string;
  description: string;
  amount_usd: number;
  base_credits: number;
  bonus_percentage: number;
  bonus_credits: number;
  total_credits: number;
  is_featured: boolean;
}

interface CreditBalance {
  balance: number;
  lifetime_purchased: number;
  lifetime_earned_credits: number;
  lifetime_spent: number;
  first_purchase_completed: boolean;
}

export default function CreditsWalletScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [balance, setBalance] = useState<CreditBalance | null>(null);
  const [isFirstPurchase, setIsFirstPurchase] = useState(false);
  const [firstPurchaseBonus, setFirstPurchaseBonus] = useState(0);
  const [stripePublishableKey, setStripePublishableKey] = useState<string | null>(null);
  const [purchaseModalVisible, setPurchaseModalVisible] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<CreditPackage | null>(null);
  const [transferModalVisible, setTransferModalVisible] = useState(false);
  const [requestModalVisible, setRequestModalVisible] = useState(false);
  const [customAmountModalVisible, setCustomAmountModalVisible] = useState(false);
  const [withdrawalModalVisible, setWithdrawalModalVisible] = useState(false);
  const [stripeCheckoutModalVisible, setStripeCheckoutModalVisible] = useState(false);
  const [nativePaymentModalVisible, setNativePaymentModalVisible] = useState(false);
  const [mobilePaymentModalVisible, setMobilePaymentModalVisible] = useState(false);
  const [stripeCheckoutUrl, setStripeCheckoutUrl] = useState('');
  const [customAmount, setCustomAmount] = useState('100'); // Default value of 100
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [balanceVisible, setBalanceVisible] = useState(true);
  const [receiveModalVisible, setReceiveModalVisible] = useState(false);
  const [chartData, setChartData] = useState<any[]>([]);
  const [chartPeriod, setChartPeriod] = useState<'week' | 'month'>('week');
  const [monthlyStats, setMonthlyStats] = useState({ income: 0, expenses: 0 });

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const balanceCountAnim = useRef(new Animated.Value(0)).current;
  const lastBalanceRef = useRef(0);
  const isRefreshingRef = useRef(false);
  
  // State for animated balance display (fixes iOS crash with Animated.Text)
  const [displayBalance, setDisplayBalance] = useState('0.00');

  // Memoized loadData function for event listeners - with debounce
  const refreshBalance = useCallback(async () => {
    // Prevent multiple simultaneous refreshes
    if (isRefreshingRef.current) {
      return;
    }
    
    isRefreshingRef.current = true;
    
    try {
      const balanceRes = await api.get('/credits/balance');
      const newBalance = balanceRes.data.balance || 0;
      
      // Only update if balance actually changed
      if (newBalance !== lastBalanceRef.current) {
        
        // Animate from current value to new value (not from 0)
        balanceCountAnim.setValue(lastBalanceRef.current);
        Animated.timing(balanceCountAnim, {
          toValue: newBalance,
          duration: 800,
          useNativeDriver: false,
        }).start(() => {
          // Update display balance after animation completes (safer than listener)
          setDisplayBalance(newBalance.toFixed(2));
        });
        
        lastBalanceRef.current = newBalance;
        setBalance(balanceRes.data);
      }
      
      // Refresh transactions too
      const transactionsRes = await api.get('/credits/history?limit=30');
      const transactions = transactionsRes.data.transactions || [];
      setRecentTransactions(transactions.slice(0, 5));
      processChartData(transactions);
    } catch (error) {
      console.error('❌ [Credits] Error refreshing balance:', error);
    } finally {
      isRefreshingRef.current = false;
    }
  }, []);

  useEffect(() => {
    loadData();
  }, []);

  // Listen for IAP balance update events - SINGLE refresh with debounce
  useEffect(() => {
    let refreshTimeout: NodeJS.Timeout | null = null;
    
    const subscription = DeviceEventEmitter.addListener(
      IAP_BALANCE_UPDATED_EVENT,
      (data) => {
        
        // Clear any pending refresh
        if (refreshTimeout) {
          clearTimeout(refreshTimeout);
        }
        
        // Single delayed refresh to allow backend to process
        refreshTimeout = setTimeout(() => {
          refreshBalance();
        }, 1500);
      }
    );

    return () => {
      if (refreshTimeout) {
        clearTimeout(refreshTimeout);
      }
      subscription.remove();
    };
  }, [refreshBalance]);

  useEffect(() => {
    if (!loading) {
      // Entrance animations
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
      ]).start();

      // Set balance directly without animation on initial load
      if (balance && lastBalanceRef.current === 0) {
        // First time - just set the value directly, no animation
        balanceCountAnim.setValue(balance.balance);
        lastBalanceRef.current = balance.balance;
        setDisplayBalance(balance.balance.toFixed(2));
      }
    }
  }, [loading, balance]);

  // NOTE: Removed addListener - causes iOS crash with Reanimated 3.17.x
  // displayBalance is now updated directly in animation callbacks

  const loadData = async () => {
    try {
      setLoading(true);
      
      const [packagesRes, balanceRes, transactionsRes] = await Promise.all([
        api.get('/credits/packages'),
        api.get('/credits/balance'),
        api.get('/credits/history?limit=30'), // Más transacciones para el gráfico
      ]);

      setPackages(packagesRes.data.packages || []);
      setBalance(balanceRes.data);
      setIsFirstPurchase(packagesRes.data.is_first_purchase || false);
      setFirstPurchaseBonus(packagesRes.data.first_purchase_bonus_percentage || 0);
      setStripePublishableKey(packagesRes.data.stripe_publishable_key);
      
      const transactions = transactionsRes.data.transactions || [];
      setRecentTransactions(transactions.slice(0, 5)); // Solo mostrar 5 en la lista
      
      // Procesar datos para el gráfico
      processChartData(transactions);
      
    } catch (error: any) {
      console.error('Error loading credits:', error);
      
      // Manejo de error más específico
      let errorMessage = t('credits.loadError', 'No se pudieron cargar los créditos');
      if (error.response) {
        if (error.response.status === 401) {
          errorMessage = t('credits.sessionExpired', 'Sesión expirada. Por favor inicia sesión nuevamente');
        } else if (error.response.status >= 500) {
          errorMessage = t('credits.serverError', 'Error del servidor. Intenta de nuevo más tarde');
        }
      } else if (error.request) {
        errorMessage = t('credits.noConnection', 'Sin conexión al servidor. Verifica tu conexión a internet');
      }
      
      if (__DEV__) {
      }
      
      if (!error.request) {
        Alert.alert('Error', errorMessage);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Procesar datos para el gráfico
  const processChartData = (transactions: any[]) => {
    const days = chartPeriod === 'week' ? 7 : 30;
    const dayLabels = chartPeriod === 'week' 
      ? ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
      : Array.from({ length: 30 }, (_, i) => (i + 1).toString());
    
    // Agrupar transacciones por día
    const today = new Date();
    const dailyData: { [key: string]: { income: number; expenses: number } } = {};
    
    // Inicializar días
    for (let i = 0; i < days; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const key = date.toISOString().split('T')[0];
      dailyData[key] = { income: 0, expenses: 0 };
    }
    
    // Sumar transacciones
    let totalIncome = 0;
    let totalExpenses = 0;
    
    transactions.forEach(t => {
      const date = new Date(t.created_at).toISOString().split('T')[0];
      if (dailyData[date]) {
        if (['purchase', 'bonus', 'transfer_received', 'refund'].includes(t.transaction_type)) {
          dailyData[date].income += Math.abs(t.amount);
          totalIncome += Math.abs(t.amount);
        } else {
          dailyData[date].expenses += Math.abs(t.amount);
          totalExpenses += Math.abs(t.amount);
        }
      }
    });
    
    setMonthlyStats({ income: totalIncome, expenses: totalExpenses });
    
    // Convertir a formato de gráfico (orden cronológico)
    const sortedDates = Object.keys(dailyData).sort();
    const chartDataFormatted = sortedDates.slice(-7).map((date, index) => {
      const dayIndex = new Date(date).getDay();
      const adjustedIndex = dayIndex === 0 ? 6 : dayIndex - 1; // Ajustar para que Lunes sea 0
      return {
        value: dailyData[date].expenses,
        label: dayLabels[adjustedIndex],
        frontColor: dailyData[date].expenses > 0 ? '#EF4444' : '#E5E7EB',
        topLabelComponent: () => (
          dailyData[date].expenses > 0 ? (
            <Text style={{ fontSize: 10, color: '#6B7280', marginBottom: 4 }}>
              ${dailyData[date].expenses.toFixed(0)}
            </Text>
          ) : null
        ),
      };
    });
    
    setChartData(chartDataFormatted);
  };

  useEffect(() => {
    if (recentTransactions.length > 0) {
      // Re-procesar cuando cambie el período
      processChartData(recentTransactions);
    }
  }, [chartPeriod]);

  // Separate function to reload just the balance
  const loadBalance = async () => {
    try {
      const balanceRes = await api.get('/credits/balance');
      setBalance(balanceRes.data);
    } catch (error) {
      console.error('Error reloading balance:', error);
    }
  };

  // iOS-only function to purchase credits via Apple In-App Purchase
  // This ensures compliance with App Store Guideline 3.1.1
  // ONLY 4 products: 50, 100, 200, 500 credits
  const purchaseCreditsWithIAP = async (amount: number) => {
    const productIdMap: { [key: number]: string } = {
      50: 'com.rosstax.credits.50',
      100: 'com.rosstax.credits.100',
      200: 'com.rosstax.credits.200',
      500: 'com.rosstax.credits.500',
    };

    const productId = productIdMap[amount];
    if (!productId) {
      Alert.alert(t('common.error', 'Error'), t('credits.amountUnavailable', 'Monto no disponible. Por favor selecciona otra opción.'));
      return;
    }

    try {
      const iapService = require('../../services/iapService').default;
      const initialized = await iapService.initialize();
      
      if (!initialized) {
        Alert.alert(
          t('credits.purchaseUnavailable', 'Compras No Disponibles'),
          t('credits.appStoreError', 'No se pudo conectar con la App Store. Por favor verifica tu conexión a internet e intenta de nuevo.'),
          [{ text: 'OK' }]
        );
        return;
      }
      
      const result = await iapService.purchaseCredits(productId);
      
      if (!result.success && result.error) {
        Alert.alert('Error', result.error);
      } else if (result.success) {
        // Show success message
        Alert.alert(
          t('credits.purchaseSuccess', '¡Compra Exitosa!'),
          `Se han añadido ${amount} créditos a tu cuenta.`,
          [{ text: 'OK' }]
        );
        // Reload data immediately and after delay to ensure balance updates
        loadData();
        setTimeout(() => loadData(), 2000);
        setTimeout(() => loadData(), 5000);
      }
    } catch (error: any) {
      console.error('IAP Error:', error);
      Alert.alert(
        t('credits.purchaseError', 'Error de Compra'),
        t('credits.purchaseFailedMessage', 'No se pudo completar la compra. Por favor intenta de nuevo.'),
        [{ text: 'OK' }]
      );
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handlePurchase = async (pkg: CreditPackage) => {
    setSelectedPackage(pkg);
    
    // On iOS, ONLY use Apple In-App Purchase (App Store requirement)
    if (Platform.OS === 'ios') {
      const iapProductId = getIAPProductIdForCredits(pkg.total_credits);
      if (iapProductId) {
        try {
          const iapService = require('../../services/iapService').default;
          await iapService.initialize();
          const result = await iapService.purchaseCredits(iapProductId);
          if (result.success) {
            setTimeout(() => loadData(), 2000);
          }
        } catch (error: any) {
          Alert.alert('Error', error.message || 'No se pudo completar la compra');
        }
      } else {
        Alert.alert(
          t('credits.packageUnavailable', 'Paquete No Disponible'),
          t('credits.packageUnavailableMessage', 'Este paquete de créditos no está disponible actualmente. Por favor selecciona otro paquete.'),
          [{ text: 'OK' }]
        );
      }
      return;
    }
    
    // Non-iOS platforms can use Stripe
    setPurchaseModalVisible(true);
  };

  // Helper to map credit amounts to IAP product IDs
  // ONLY 4 valid products in App Store Connect: 50, 100, 200, 500
  const getIAPProductIdForCredits = (credits: number): string | null => {
    // Map to exact matching product IDs only
    const productMap: { [key: number]: string } = {
      50: 'com.rosstax.credits.50',
      100: 'com.rosstax.credits.100',
      200: 'com.rosstax.credits.200',
      500: 'com.rosstax.credits.500',
    };
    return productMap[credits] || null;
  };

  const handleCustomAmountPurchase = async () => {
    // On iOS, custom amounts are NOT allowed - must use predefined IAP packages
    if (Platform.OS === 'ios') {
      Alert.alert(
        t('credits.customAmounts', 'Montos Personalizados'),
        t('credits.iosCustomMessage', 'En iOS, por favor selecciona uno de los paquetes de créditos disponibles.'),
        [{ text: 'OK' }]
      );
      setCustomAmountModalVisible(false);
      return;
    }
    
    
    const amount = parseFloat(customAmount);
    if (isNaN(amount) || amount < 10) {
      if (Platform.OS === 'web') {
        Alert.alert('Aviso', t('wallet.minAmountError'));
      } else {
        Alert.alert(t('common.error'), t('wallet.minAmountError'));
      }
      return;
    }
    if (amount > 1000) {
      if (Platform.OS === 'web') {
        Alert.alert('Aviso', t('wallet.maxAmountError'));
      } else {
        Alert.alert(t('common.error'), t('wallet.maxAmountError'));
      }
      return;
    }

    // Close custom amount modal
    setCustomAmountModalVisible(false);
    
    // iOS MUST use In-App Purchase - do not show Stripe modal
    if (Platform.OS === 'ios') {
      // This should never be reached due to earlier checks, but just in case
      Alert.alert(
        'Error',
        t('credits.iosUsePackages', 'Por favor usa los paquetes de créditos disponibles para comprar en iOS.'),
        [{ text: 'OK' }]
      );
      return;
    }
    
    // Non-iOS platforms can use Stripe
    if (Platform.OS === 'web') {
      setNativePaymentModalVisible(true);
    } else if (Platform.OS === 'android') {
      setMobilePaymentModalVisible(true);
    }
  };

  const handlePurchaseSuccess = () => {
    loadData();
    // Show success animation
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 1.1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const renderBalanceWidget = () => {
    // Note: Removed Animated.Text interpolate - causes iOS crash (RCTTextView didMoveToWindow)
    // Using displayBalance state instead, updated via animation listener
    
    return (
      <Animated.View
        style={[
          styles.balanceWidgetContainer,
          {
            opacity: fadeAnim,
            transform: [
              { translateY: slideAnim },
              { scale: scaleAnim }
            ],
          },
        ]}
      >
        <LinearGradient
          colors={['#1a1a2e', '#16213e', '#0f3460']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.balanceWidget}
        >
          {/* Glassmorphism overlay circles */}
          <View style={styles.glassCircle1} />
          <View style={styles.glassCircle2} />
          <View style={styles.glassCircle3} />
          
          {/* Header with wallet icon */}
          <View style={styles.walletHeader}>
            <View style={styles.walletBadge}>
              <LinearGradient
                colors={['rgba(255,255,255,0.2)', 'rgba(255,255,255,0.05)']}
                style={styles.walletBadgeGradient}
              >
                <Ionicons name="wallet" size={18} color="#fff" />
                <Text style={styles.walletBadgeText}>Ross Tax Wallet</Text>
              </LinearGradient>
            </View>
            <TouchableOpacity 
              style={styles.eyeButton}
              onPress={() => setBalanceVisible(!balanceVisible)}
              activeOpacity={0.7}
            >
              <Ionicons 
                name={balanceVisible ? "eye-outline" : "eye-off-outline"} 
                size={22} 
                color="rgba(255, 255, 255, 0.7)" 
              />
            </TouchableOpacity>
          </View>

          {/* Main Balance Display - Using Text instead of Animated.Text to prevent iOS crash */}
          <View style={styles.balanceMainDisplay}>
            <Text style={styles.balanceLabel}>{t('wallet.availableBalance', 'Available Balance')}</Text>
            <View style={styles.balanceRow}>
              <Text style={styles.balanceDollarSign}>$</Text>
              <Text style={styles.balanceAmount}>
                {balanceVisible ? displayBalance : '••••••'}
              </Text>
            </View>
            <Text style={styles.balanceCurrencyLabel}>USD • Créditos disponibles</Text>
          </View>

          {/* Stats Pills */}
          <View style={styles.statsPillsContainer}>
            <View style={styles.statPill}>
              <View style={[styles.statPillIcon, { backgroundColor: 'rgba(74, 222, 128, 0.2)' }]}>
                <Ionicons name="trending-up" size={14} color="#4ade80" />
              </View>
              <View>
                <Text style={styles.statPillValue}>+${balance?.lifetime_earned_credits?.toFixed(0) || 0}</Text>
                <Text style={styles.statPillLabel}>{t('wallet.earned', 'Ganados')}</Text>
              </View>
            </View>
            <View style={styles.statPillDivider} />
            <View style={styles.statPill}>
              <View style={[styles.statPillIcon, { backgroundColor: 'rgba(248, 113, 113, 0.2)' }]}>
                <Ionicons name="cart" size={14} color="#f87171" />
              </View>
              <View>
                <Text style={styles.statPillValue}>-${balance?.lifetime_spent?.toFixed(0) || 0}</Text>
                <Text style={styles.statPillLabel}>{t('wallet.spent', 'Gastados')}</Text>
              </View>
            </View>
          </View>

          {/* Card Footer */}
          <View style={styles.cardFooter}>
            <View style={styles.cardChipModern}>
              <LinearGradient
                colors={['#FFD700', '#FFA500']}
                style={styles.chipGradient}
              >
                <View style={styles.chipLines}>
                  <View style={styles.chipLine} />
                  <View style={styles.chipLine} />
                  <View style={styles.chipLine} />
                </View>
              </LinearGradient>
            </View>
            <View style={styles.cardNumberContainer}>
              <Text style={styles.cardNumber}>•••• •••• •••• {user?.id?.slice(-4) || '0000'}</Text>
              <Text style={styles.cardHolder}>{user?.full_name || user?.name || 'Usuario'}</Text>
            </View>
          </View>
        </LinearGradient>
      </Animated.View>
    );
  };

  const renderPackageCard = (pkg: CreditPackage, index: number) => {
    const extraBonus = isFirstPurchase ? pkg.total_credits * (firstPurchaseBonus / 100) : 0;
    const totalCredits = pkg.total_credits + extraBonus;

    return (
      <Animated.View
        key={pkg.id}
        style={[
          styles.rechargeOption,
          pkg.is_featured && styles.rechargeOptionFeatured,
          {
            opacity: fadeAnim,
            transform: [
              {
                translateY: slideAnim.interpolate({
                  inputRange: [0, 50],
                  outputRange: [0, 50 + index * 20],
                }),
              },
            ],
          },
        ]}
      >
        {pkg.is_featured && (
          <View style={styles.popularBadge}>
            <Ionicons name="star" size={12} color="#FFD700" />
            <Text style={styles.popularBadgeText}>MÁS POPULAR</Text>
          </View>
        )}

        <View style={styles.rechargeHeader}>
          <View style={styles.rechargePriceBox}>
            <Text style={styles.rechargeDollarSign}>$</Text>
            <Text style={styles.rechargePrice}>{pkg.amount_usd}</Text>
          </View>
        </View>

        <View style={styles.rechargeCreditsBox}>
          <View style={styles.rechargeArrow}>
            <Ionicons name="arrow-down" size={20} color={colors.primary} />
          </View>
          <Text style={styles.rechargeCreditsNumber}>{totalCredits.toFixed(0)}</Text>
          <Text style={styles.rechargeCreditsLabel}>créditos</Text>
        </View>

        {pkg.bonus_credits > 0 && (
          <View style={styles.rechargeBonusChip}>
            <Ionicons name="gift" size={12} color="#10B981" />
            <Text style={styles.rechargeBonusText}>
              +{pkg.bonus_credits} bonus
            </Text>
          </View>
        )}

        {isFirstPurchase && extraBonus > 0 && (
          <View style={styles.rechargeFirstPurchaseChip}>
            <Ionicons name="sparkles" size={12} color="#8B5CF6" />
            <Text style={styles.rechargeFirstPurchaseText}>
              +{extraBonus.toFixed(0)} por 1ª compra
            </Text>
          </View>
        )}

        <TouchableOpacity 
          style={[
            styles.rechargeButton,
            pkg.is_featured && styles.rechargeButtonFeatured
          ]}
          onPress={() => handlePurchase(pkg)}
          activeOpacity={0.8}
        >
          <Text style={[
            styles.rechargeButtonText,
            pkg.is_featured && styles.rechargeButtonTextFeatured
          ]}>
            Recargar
          </Text>
          <Ionicons 
            name="arrow-forward" 
            size={18} 
            color={pkg.is_featured ? "#FFF" : colors.primary} 
          />
        </TouchableOpacity>
      </Animated.View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>{t('wallet.loadingWallet', 'Loading your wallet...')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Custom Header */}
      <CustomHeader 
        title={t('wallet.myWallet', 'My Wallet')}
        rightIcon="settings-outline"
        onRightIconPress={() => router.push('/credit-preferences')}
      />
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >

        {/* Balance Widget */}
        {renderBalanceWidget()}

        {/* Quick Actions - Modern Grid Design */}
        <View style={styles.quickActionsSection}>
          <Text style={styles.sectionTitle}>{t('wallet.quickActions', 'Quick Actions')}</Text>
          <View style={styles.quickActionsGrid}>
            {/* Añadir Dinero - On iOS, this opens IAP purchase flow */}
            <TouchableOpacity 
              style={styles.quickActionCard}
              onPress={async () => {
                
                // On iOS, MUST use Apple In-App Purchase per App Store Guidelines 3.1.1
                if (Platform.OS === 'ios') {
                  // Show a simple picker with IAP-compatible amounts
                  // ONLY 4 products: 50, 100, 200, 500 credits
                  Alert.alert(
                    t('wallet.buyCredits', 'Comprar Créditos'),
                    t('wallet.selectAmount', 'Selecciona la cantidad de créditos que deseas comprar:'),
                    [
                      { text: '$50 (50 créditos)', onPress: () => purchaseCreditsWithIAP(50) },
                      { text: '$100 (100 créditos)', onPress: () => purchaseCreditsWithIAP(100) },
                      { text: '$200 (200 créditos)', onPress: () => purchaseCreditsWithIAP(200) },
                      { text: '$500 (500 créditos)', onPress: () => purchaseCreditsWithIAP(500) },
                      { text: t('common.cancel', 'Cancelar'), style: 'cancel' },
                    ]
                  );
                  return;
                }
                
                // Non-iOS platforms can use the custom amount modal (with Stripe)
                setCustomAmountModalVisible(true);
              }}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#10B981', '#059669']}
                style={styles.quickActionGradient}
              >
                <Ionicons name="add-circle" size={28} color="#fff" />
              </LinearGradient>
              <Text style={styles.quickActionTitle}>{t('wallet.add', 'Añadir')}</Text>
              <Text style={styles.quickActionSubtitle}>{t('wallet.addFunds', 'Fondos')}</Text>
            </TouchableOpacity>

            {/* Enviar */}
            <TouchableOpacity 
              style={styles.quickActionCard}
              onPress={() => setTransferModalVisible(true)}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#3B82F6', '#2563EB']}
                style={styles.quickActionGradient}
              >
                <Ionicons name="send" size={26} color="#fff" />
              </LinearGradient>
              <Text style={styles.quickActionTitle}>{t('wallet.send', 'Enviar')}</Text>
              <Text style={styles.quickActionSubtitle}>{t('wallet.toAnotherUser', 'A usuario')}</Text>
            </TouchableOpacity>

            {/* Historial */}
            <TouchableOpacity 
              style={styles.quickActionCard}
              onPress={() => router.push('/(tabs)/credit-history')}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#8B5CF6', '#7C3AED']}
                style={styles.quickActionGradient}
              >
                <Ionicons name="time" size={26} color="#fff" />
              </LinearGradient>
              <Text style={styles.quickActionTitle}>{t('credits.history', 'Historial')}</Text>
              <Text style={styles.quickActionSubtitle}>{t('credits.movements', 'Movimientos')}</Text>
            </TouchableOpacity>

            {/* Pagar Servicios */}
            <TouchableOpacity 
              style={styles.quickActionCard}
              onPress={() => router.push('/(tabs)/services')}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#F59E0B', '#D97706']}
                style={styles.quickActionGradient}
              >
                <Ionicons name="receipt" size={26} color="#fff" />
              </LinearGradient>
              <Text style={styles.quickActionTitle}>{t('credits.pay', 'Pagar')}</Text>
              <Text style={styles.quickActionSubtitle}>{t('credits.services', 'Servicios')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Earn Credits Banner - Using Brand Color */}
        <TouchableOpacity 
          style={styles.earnBanner}
          onPress={() => router.push('/(tabs)/referrals')}
          activeOpacity={0.9}
        >
          <LinearGradient
            colors={['#6C1110', '#8B1515', '#6C1110']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.earnBannerGradient}
          >
            <View style={styles.earnBannerContent}>
              <View style={styles.earnBannerIcon}>
                <Ionicons name="gift" size={32} color="#fff" />
              </View>
              <View style={styles.earnBannerText}>
                <Text style={styles.earnBannerTitle}>{t('wallet.earnFreeCredits', 'Earn Free Credits!')}</Text>
                <Text style={styles.earnBannerSubtitle}>{t('wallet.inviteFriends', 'Invite friends and earn $10 for each one')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color="#fff" />
            </View>
          </LinearGradient>
        </TouchableOpacity>

        {/* Transactions Header with See All */}
        <View style={styles.transactionsHeader}>
          <View>
            <Text style={styles.transactionsTitle}>{t('wallet.recentActivity')}</Text>
            <Text style={styles.transactionsSubtitle}>Últimas 5 transacciones</Text>
          </View>
          <TouchableOpacity 
            onPress={() => router.push('/(tabs)/credit-history')}
            activeOpacity={0.7}
            style={styles.seeAllButtonContainer}
          >
            <Text style={styles.seeAllButton}>Ver Todo</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Recent Transactions Preview */}
        <View style={styles.transactionsPreview}>
          {recentTransactions.length === 0 ? (
            <View style={styles.emptyTransactions}>
              <Ionicons name="receipt-outline" size={48} color={colors.textGray} />
              <Text style={styles.emptyText}>{t('credits.noRecentTransactions', 'No hay transacciones recientes')}</Text>
            </View>
          ) : (
            recentTransactions.map((transaction, index) => {
              // Determine icon and color based on transaction type
              let iconName = 'swap-horizontal';
              let iconColor = colors.textGray;
              let bgColor = colors.backgroundGray;
              let amountColor = colors.textDark;
              let amountSign = '';
              
              if (transaction.transaction_type === 'purchase' || transaction.transaction_type === 'bonus') {
                iconName = 'arrow-down-circle';
                iconColor = '#10B981';
                bgColor = '#10B98120';
                amountSign = '+';
                amountColor = '#10B981';
              } else if (transaction.transaction_type === 'usage' || transaction.transaction_type === 'transfer_sent') {
                iconName = 'arrow-up-circle';
                iconColor = '#EF4444';
                bgColor = '#EF444420';
                amountSign = '-';
                amountColor = '#EF4444';
              } else if (transaction.transaction_type === 'transfer_received' || transaction.transaction_type === 'refund') {
                iconName = 'arrow-down-circle';
                iconColor = '#10B981';
                bgColor = '#10B98120';
                amountSign = '+';
                amountColor = '#10B981';
              } else if (transaction.transaction_type === 'withdrawal') {
                iconName = 'cash-outline';
                iconColor = '#F59E0B';
                bgColor = '#F59E0B20';
                amountSign = '-';
                amountColor = '#F59E0B';
              }
              
              // Format date
              const date = new Date(transaction.created_at);
              const today = new Date();
              const isToday = date.toDateString() === today.toDateString();
              const timeStr = date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
              const dateStr = isToday ? `Hoy ${timeStr}` : date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
              
              // Get transaction title
              const titles: any = {
                purchase: t('credits.txPurchase', 'Compra de Créditos'),
                usage: t('credits.txUsage', 'Uso de Créditos'),
                bonus: t('credits.txBonus', 'Bono'),
                transfer_sent: t('credits.txTransferSent', 'Transferencia Enviada'),
                transfer_received: t('credits.txTransferReceived', 'Transferencia Recibida'),
                refund: t('credits.txRefund', 'Reembolso'),
                withdrawal: t('credits.txWithdrawal', 'Retiro'),
                documents_completion_bonus: t('credits.txDocsBonus', 'Bonus por Documentos'),
                referral_bonus: t('credits.txReferralBonus', 'Bonus por Referido'),
                welcome_bonus: t('credits.txWelcomeBonus', 'Bonus de Bienvenida'),
                registration_bonus: t('credits.txRegistrationBonus', 'Bonus de Registro'),
                appointment_bonus: t('credits.txAppointmentBonus', 'Bonus por Cita'),
                review_bonus: t('credits.txReviewBonus', 'Bonus por Reseña'),
                loyalty_bonus: t('credits.txLoyaltyBonus', 'Bonus de Lealtad'),
                promotion: t('credits.txPromotion', 'Promoción'),
                credit_purchase: 'Compra de Créditos',
                apple_iap: 'Compra de Créditos',
              };
              const title = titles[transaction.transaction_type] || 
                           (transaction.description ? transaction.description.split(' - ')[0] : transaction.transaction_type);
              
              return (
                <View key={transaction.id || index} style={styles.transactionItem}>
                  <View style={[styles.transactionIcon, { backgroundColor: bgColor }]}>
                    <Ionicons name={iconName} size={24} color={iconColor} />
                  </View>
                  <View style={styles.transactionDetails}>
                    <Text style={styles.transactionTitle}>{title}</Text>
                    <Text style={styles.transactionTime}>{dateStr}</Text>
                    {transaction.description && (
                      <Text style={styles.transactionDescription}>{transaction.description}</Text>
                    )}
                  </View>
                  <Text style={[styles.transactionAmount, { color: amountColor }]}>
                    {amountSign}${Math.abs(transaction.amount).toFixed(2)}
                  </Text>
                </View>
              );
            })
          )}
        </View>

        {/* Info Banner */}
        <View style={styles.infoBanner}>
          <Ionicons name="information-circle" size={20} color={colors.accent} />
          <Text style={styles.infoBannerText}>
            1 crédito = $1 USD • Sin expiración • Reembolsos flexibles
          </Text>
        </View>

        {/* Bottom spacer */}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Transfer Modal */}
      <TransferModal
        visible={transferModalVisible}
        onClose={() => setTransferModalVisible(false)}
        onSuccess={handlePurchaseSuccess}
        currentBalance={balance?.balance || 0}
      />

      {/* Request Modal */}
      <RequestModal
        visible={requestModalVisible}
        onClose={() => setRequestModalVisible(false)}
        onSuccess={handlePurchaseSuccess}
      />

      {/* Purchase Modal - Only on Native Platforms */}
      {selectedPackage && Platform.OS !== 'web' && CreditPurchaseModal && (
        <CreditPurchaseModal
          visible={purchaseModalVisible}
          package={selectedPackage}
          stripePublishableKey={stripePublishableKey || ''}
          isFirstPurchase={isFirstPurchase}
          firstPurchaseBonus={firstPurchaseBonus}
          onClose={() => {
            setPurchaseModalVisible(false);
            setSelectedPackage(null);
          }}
          onSuccess={handlePurchaseSuccess}
        />
      )}

      {/* Custom Amount Modal - ONLY for non-iOS platforms */}
      {/* iOS MUST use Apple In-App Purchase per App Store Guideline 3.1.1 */}
      {Platform.OS !== 'ios' && (
      <Modal
        visible={customAmountModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          Keyboard.dismiss();
          setCustomAmountModalVisible(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity 
            activeOpacity={1} 
            style={styles.modalDismissArea}
            onPress={() => {
              Keyboard.dismiss();
              setCustomAmountModalVisible(false);
            }}
          />
          <View style={styles.rechargeModalContent}>
            {/* Header */}
            <View style={styles.rechargeModalHeader}>
              <View>
                <Text style={styles.rechargeModalTitle}>Añadir Dinero</Text>
                <Text style={styles.rechargeModalSubtitle}>{t('credits.enterAmount', 'Ingresa el monto a recargar')}</Text>
              </View>
              <TouchableOpacity onPress={() => {
                Keyboard.dismiss();
                setCustomAmountModalVisible(false);
              }}>
                <Ionicons name="close-circle" size={32} color={colors.textGray} />
              </TouchableOpacity>
            </View>

            <ScrollView 
              style={styles.rechargeModalBody}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Amount Input - Grande y Central */}
              <View style={styles.rechargeAmountInput}>
                <Text style={styles.rechargeDollarSignLarge}>$</Text>
                <TextInput
                  style={styles.rechargeInputLarge}
                  value={customAmount}
                  onChangeText={setCustomAmount}
                  placeholder="0"
                  keyboardType="decimal-pad"
                  placeholderTextColor="#D1D5DB"
                  maxLength={6}
                />
                <Text style={styles.rechargeUsdLabel}>USD</Text>
              </View>

              {/* Preview rápido */}
              {customAmount && parseFloat(customAmount) > 0 && (
                <View style={styles.rechargeQuickPreview}>
                  <Ionicons name="wallet-outline" size={18} color={colors.primary} />
                  <Text style={styles.rechargeQuickPreviewText}>
                    Recibirás <Text style={styles.rechargeQuickPreviewBold}>{parseFloat(customAmount).toFixed(0)} créditos</Text>
                  </Text>
                </View>
              )}

              {/* Montos Sugeridos */}
              <View style={styles.rechargeSuggestedSection}>
                <Text style={styles.rechargeSuggestedTitle}>{t('credits.suggestedAmounts', 'Montos sugeridos')}</Text>
                <View style={styles.rechargeSuggestedGrid}>
                  {[50, 100, 200, 500].map((amount) => (
                    <TouchableOpacity
                      key={amount}
                      style={[
                        styles.rechargeSuggestedButton,
                        customAmount === amount.toString() && styles.rechargeSuggestedButtonActive
                      ]}
                      onPress={() => {
                        setCustomAmount(amount.toString());
                        Keyboard.dismiss();
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={[
                        styles.rechargeSuggestedText,
                        customAmount === amount.toString() && styles.rechargeSuggestedTextActive
                      ]}>
                        ${amount}
                      </Text>
                      <Text style={[
                        styles.rechargeSuggestedCredits,
                        customAmount === amount.toString() && styles.rechargeSuggestedCreditsActive
                      ]}>
                        {amount} {amount === 1 ? t('wallet.credit') : t('wallet.credits')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Info compacta */}
              <View style={styles.rechargeInfoCompact}>
                <Text style={styles.rechargeInfoTextCompact}>
                  Mínimo $10 • Máximo $1,000 • 1 crédito = $1
                </Text>
              </View>
            </ScrollView>

            {/* Footer con botón de continuar - FIXED */}
            <View style={styles.rechargeModalFooter}>
              <TouchableOpacity
                style={[
                  styles.rechargeContinueButton,
                  (!customAmount || parseFloat(customAmount) < 10) && styles.rechargeContinueButtonDisabled
                ]}
                onPress={async () => {
                  Keyboard.dismiss();
                  
                  // On iOS, try to use IAP for predefined amounts
                  if (Platform.OS === 'ios') {
                    const amount = parseFloat(customAmount);
                    const iapProductId = getIAPProductIdForCredits(amount);
                    
                    if (iapProductId) {
                      try {
                        setCustomAmountModalVisible(false);
                        
                        const iapService = require('../../services/iapService').default;
                        const initialized = await iapService.initialize();
                        
                        if (!initialized) {
                          Alert.alert(
                            'Compras No Disponibles',
                            'No se pudo conectar con la App Store. Por favor verifica tu conexión a internet e intenta de nuevo.',
                            [{ text: 'OK' }]
                          );
                          return;
                        }
                        
                        // Start the purchase - result will come through the purchase listener
                        const result = await iapService.purchaseCredits(iapProductId);
                        
                        // Note: purchaseCredits returns immediately after starting the purchase
                        // The actual completion is handled by the purchase listener in iapService
                        // which will show success/error alerts and update the balance
                        
                        if (!result.success && result.error) {
                          Alert.alert('Error', result.error);
                        } else {
                          // Reload data after a delay to get updated balance
                          setTimeout(() => loadData(), 3000);
                        }
                      } catch (error: any) {
                        console.error('IAP Error:', error);
                        Alert.alert(
                          'Error de Compra',
                          'No se pudo completar la compra. Por favor intenta de nuevo.',
                          [{ text: 'OK' }]
                        );
                      }
                      return;
                    } else {
                      // Amount doesn't match any IAP product
                      Alert.alert(
                        'Monto No Disponible',
                        'Por favor selecciona uno de los montos sugeridos: $10, $20, $50, $100, $180, $200, $250 o $500.',
                        [{ text: 'OK' }]
                      );
                      return;
                    }
                  }
                  
                  await handleCustomAmountPurchase();
                }}
                disabled={!customAmount || parseFloat(customAmount) < 10}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={(!customAmount || parseFloat(customAmount) < 10) 
                    ? ['#9CA3AF', '#6B7280'] 
                    : [colors.primary, colors.secondary]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.rechargeContinueGradient}
                >
                  <Text style={styles.rechargeContinueText}>
                    {customAmount && parseFloat(customAmount) >= 10 
                      ? `Continuar con $${parseFloat(customAmount).toFixed(2)}`
                      : 'Ingresa un monto válido'}
                  </Text>
                  <Ionicons name="arrow-forward-circle" size={24} color="#FFF" />
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      )}

      {/* Withdrawal Modal */}
      <WithdrawalModal
        visible={withdrawalModalVisible}
        onClose={() => setWithdrawalModalVisible(false)}
        onSuccess={handlePurchaseSuccess}
        currentBalance={balance?.balance || 0}
      />

      {/* Receive Money Modal */}
      <ReceiveMoneyModal
        visible={receiveModalVisible}
        onClose={() => setReceiveModalVisible(false)}
        userEmail={user?.email || ''}
        onSuccess={() => {
          // Recargar el balance cuando se apruebe una solicitud
          loadBalance();
        }}
      />

      {/* Stripe Checkout Modal */}
      <StripeCheckoutModal
        visible={stripeCheckoutModalVisible}
        checkoutUrl={stripeCheckoutUrl}
        onClose={() => {
          setStripeCheckoutModalVisible(false);
          setStripeCheckoutUrl('');
        }}
        onSuccess={handlePurchaseSuccess}
      />

      {/* Native Payment Modal (Web only) */}
      {Platform.OS === 'web' && (
        <NativePaymentModal
          visible={nativePaymentModalVisible}
          amount={parseFloat(customAmount) || 0}
          onClose={() => setNativePaymentModalVisible(false)}
          onSuccess={handlePurchaseSuccess}
          stripePublishableKey={stripePublishableKey || ''}
        />
      )}

      {/* Mobile Payment Modal (Android ONLY - Stripe Checkout) */}
      {/* iOS MUST use Apple In-App Purchase per App Store Guidelines 3.1.1 */}
      {Platform.OS === 'android' && (
        <MobilePaymentModal
          visible={mobilePaymentModalVisible}
          amount={parseFloat(customAmount) || 0}
          onClose={() => setMobilePaymentModalVisible(false)}
          onSuccess={handlePurchaseSuccess}
          stripePublishableKey={stripePublishableKey || ''}
        />
      )}
    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundGray,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: colors.textGray,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 120,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
  },
  headerSubtitle: {
    fontSize: 14,
    color: colors.textGray,
    marginTop: 4,
  },
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Balance Widget - Modern Design
  balanceWidgetContainer: {
    marginBottom: 24,
  },
  balanceWidget: {
    borderRadius: 24,
    padding: 24,
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 12,
    minHeight: 200,
  },
  decorativeCircle1: {
    position: 'absolute',
    top: -60,
    right: -60,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  decorativeCircle2: {
    position: 'absolute',
    bottom: -30,
    left: -30,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  decorativeCircle3: {
    position: 'absolute',
    top: 40,
    left: 60,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  walletHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  walletLogoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  walletLogoText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  eyeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  balanceMainDisplay: {
    marginBottom: 20,
  },
  balanceLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 4,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  balanceDollarSign: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
    marginRight: 2,
  },
  balanceAmount: {
    fontSize: 48,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  balanceCurrency: {
    fontSize: 16,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.7)',
    marginLeft: 8,
  },
  walletQuickStats: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  walletStatItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  walletStatDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    marginHorizontal: 12,
  },
  walletStatValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  walletStatLabel: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardChip: {
    width: 40,
    height: 28,
    backgroundColor: 'rgba(255, 215, 0, 0.6)',
    borderRadius: 4,
    justifyContent: 'center',
    padding: 4,
    gap: 3,
  },
  chipLine: {
    height: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 1,
  },
  cardNumber: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.7)',
    letterSpacing: 2,
  },

  // New glassmorphism styles
  glassCircle1: {
    position: 'absolute',
    top: -80,
    right: -80,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  glassCircle2: {
    position: 'absolute',
    bottom: -40,
    left: -40,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  glassCircle3: {
    position: 'absolute',
    top: 60,
    left: 80,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },

  // Wallet badge styles
  walletBadge: {
    borderRadius: 24,
    overflow: 'hidden',
  },
  walletBadgeGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  walletBadgeText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },

  // Currency label
  balanceCurrencyLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.6)',
    marginTop: 4,
  },

  // Stats pills container
  statsPillsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  statPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statPillIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  statPillValue: {
    fontSize: 15,
    fontWeight: '800',
    color: '#fff',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  statPillLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 2,
  },
  statPillDivider: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    marginHorizontal: 16,
  },

  // Modern card chip
  cardChipModern: {
    width: 48,
    height: 32,
    borderRadius: 6,
    overflow: 'hidden',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  chipGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 6,
  },
  chipLines: {
    gap: 3,
  },

  // Card number container
  cardNumberContainer: {
    alignItems: 'flex-end',
  },
  cardHolder: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.5)',
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  cardBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardInfoLeft: {
    flexDirection: 'row',
    gap: 24,
  },
  cardInfoItem: {
    flexDirection: 'column',
  },
  maskedCardLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.6)',
    marginBottom: 4,
  },
  maskedCardNumber: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cornerCutout: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 145,
    height: 55,
    backgroundColor: 'transparent',
    borderTopLeftRadius: 28,
    zIndex: 1,
  },
  buttonShadowLayer: {
    position: 'absolute',
    bottom: 3,
    right: 3,
    width: 139,
    height: 49,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    borderTopLeftRadius: 26,
    borderBottomRightRadius: 24,
    zIndex: 2,
  },
  addMoneyButtonCorner: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 145,
    height: 55,
    borderTopLeftRadius: 28,
    borderBottomRightRadius: 24,
    overflow: 'hidden',
    zIndex: 10,
    borderWidth: 0,
  },
  buttonGradient: {
    paddingHorizontal: 20,
    paddingVertical: 11,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addMoneyButtonCornerText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Quick Actions - Modern Grid
  quickActionsSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 16,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  quickActionCard: {
    width: '47%',
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    marginBottom: 4,
  },
  quickActionGradient: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  quickActionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 2,
  },
  quickActionSubtitle: {
    fontSize: 11,
    color: colors.textGray,
  },

  // Earn Banner - Using Brand Color
  earnBanner: {
    marginBottom: 24,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#6C1110',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  earnBannerGradient: {
    padding: 16,
  },
  earnBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  earnBannerIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  earnBannerText: {
    flex: 1,
  },
  earnBannerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 2,
  },
  earnBannerSubtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.9)',
  },

  // Legacy Quick Actions (keep for compatibility)
  quickActionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
    gap: 8,
  },

  // Stats Container - Nuevo
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  statIconBg: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textGray,
    textAlign: 'center',
  },

  // Chart Section
  chartSection: {
    backgroundColor: colors.background,
    borderRadius: 20,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 2,
  },
  chartSubtitle: {
    fontSize: 12,
    color: colors.textGray,
  },
  chartPeriodButtons: {
    flexDirection: 'row',
    backgroundColor: colors.backgroundGray,
    borderRadius: 8,
    padding: 2,
  },
  periodButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  periodButtonActive: {
    backgroundColor: colors.primary,
  },
  periodButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textGray,
  },
  periodButtonTextActive: {
    color: '#FFFFFF',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
    paddingVertical: 12,
    backgroundColor: colors.backgroundGray,
    borderRadius: 12,
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  summaryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  summaryLabel: {
    fontSize: 13,
    color: colors.textGray,
    fontWeight: '500',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  chartContainer: {
    alignItems: 'center',
    paddingTop: 8,
  },
  noChartData: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  noChartDataText: {
    fontSize: 13,
    color: colors.textGray,
    marginTop: 12,
  },
  quickActionButton: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  quickActionIconSimple: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  quickActionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
  },

  // Transactions Section
  transactionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  transactionsTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  transactionsSubtitle: {
    fontSize: 13,
    color: colors.textGray,
    marginTop: 2,
  },
  seeAllButtonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  seeAllButton: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.accent,
  },
  transactionsPreview: {
    backgroundColor: colors.background,
    borderRadius: 20,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  emptyTransactions: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textGray,
    marginTop: 12,
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.backgroundGray,
  },
  transactionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  transactionDetails: {
    flex: 1,
  },
  transactionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 2,
  },
  transactionTime: {
    fontSize: 12,
    color: colors.textGray,
  },
  transactionDescription: {
    fontSize: 11,
    color: colors.textGray,
    marginTop: 2,
    fontStyle: 'italic',
  },
  transactionAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: '#10B981',
    marginRight: 8,
  },
  transactionType: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textGray,
  },
  
  // Info Banner
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(108, 17, 16, 0.15)',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    gap: 8,
  },
  infoBannerText: {
    flex: 1,
    fontSize: 13,
    color: '#6C1110',
    lineHeight: 18,
  },

  // Packages Section
  packagesSection: {
    marginTop: 8,
  },
  packagesSectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: colors.textGray,
    marginBottom: 16,
  },
  firstPurchaseAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFD70015',
    padding: 14,
    borderRadius: 12,
    marginBottom: 16,
    gap: 10,
  },
  firstPurchaseAlertText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#FFD700',
  },
  packagesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  
  // Recharge Options (new style)
  rechargeOption: {
    width: '47%',
    backgroundColor: colors.background,
    borderRadius: 20,
    padding: 20,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  rechargeOptionFeatured: {
    borderColor: colors.primary,
    borderWidth: 2.5,
  },
  popularBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFD70020',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    gap: 4,
  },
  popularBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFD700',
  },
  rechargeHeader: {
    marginBottom: 12,
  },
  rechargePriceBox: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  rechargeDollarSign: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
  },
  rechargePrice: {
    fontSize: 40,
    fontWeight: '800',
    color: colors.text,
    marginLeft: 2,
  },
  rechargeCreditsBox: {
    alignItems: 'center',
    backgroundColor: colors.backgroundGray,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 12,
    width: '100%',
    marginBottom: 12,
  },
  rechargeArrow: {
    marginBottom: 8,
  },
  rechargeCreditsNumber: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.primary,
  },
  rechargeCreditsLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textGray,
    marginTop: 2,
  },
  rechargeBonusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B98115',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    gap: 4,
    marginBottom: 6,
  },
  rechargeBonusText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#10B981',
  },
  rechargeFirstPurchaseChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#8B5CF615',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    gap: 4,
    marginBottom: 12,
  },
  rechargeFirstPurchaseText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8B5CF6',
  },
  rechargeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.backgroundGray,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    width: '100%',
    gap: 6,
  },
  rechargeButtonFeatured: {
    backgroundColor: colors.primary,
  },
  rechargeButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primary,
  },
  rechargeButtonTextFeatured: {
    color: '#FFF',
  },
  // Custom Amount Button
  customAmountButton: {
    marginTop: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  customAmountGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    gap: 16,
  },
  customAmountIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  customAmountTextContainer: {
    flex: 1,
  },
  customAmountTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 4,
  },
  customAmountSubtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  // Custom Amount Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalDismissArea: {
    flex: 1,
  },
  customModalContent: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
  },
  customModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.backgroundGray,
  },
  customModalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
  },
  customModalBody: {
    padding: 20,
  },
  customModalDescription: {
    fontSize: 14,
    color: colors.textGray,
    marginBottom: 24,
    textAlign: 'center',
  },
  customInputContainer: {
    marginBottom: 20,
  },
  customInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundGray,
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderWidth: 2,
    borderColor: 'rgba(108, 17, 16, 0.3)',
  },
  dollarSign: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.primary,
    marginRight: 8,
  },
  customInput: {
    flex: 1,
    fontSize: 32,
    fontWeight: '800',
    color: colors.text,
    padding: 0,
  },
  usdLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textGray,
    marginLeft: 8,
  },
  customInfoBox: {
    flexDirection: 'row',
    backgroundColor: 'rgba(108, 17, 16, 0.15)',
    padding: 16,
    borderRadius: 12,
    gap: 12,
    marginBottom: 20,
  },
  customInfoTextContainer: {
    flex: 1,
  },
  customInfoText: {
    fontSize: 13,
    color: colors.text,
    lineHeight: 20,
  },
  customPreviewBox: {
    backgroundColor: 'rgba(108, 17, 16, 0.15)',
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  customPreviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  customPreviewLabel: {
    fontSize: 14,
    color: colors.textGray,
    fontWeight: '600',
  },
  customPreviewValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  customPreviewCredits: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.primary,
  },
  customModalFooter: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: colors.backgroundGray,
  },
  customCancelButton: {
    flex: 1,
    backgroundColor: colors.backgroundGray,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customCancelButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  customConfirmButton: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  customConfirmGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  customConfirmButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  
  // Recharge Modal Styles - Estilo Recarga de Teléfono
  rechargeModalContent: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  rechargeModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.backgroundGray,
  },
  rechargeModalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 2,
  },
  rechargeModalSubtitle: {
    fontSize: 13,
    color: colors.textGray,
    fontWeight: '500',
  },
  rechargeModalBody: {
    padding: 20,
    paddingTop: 16,
    maxHeight: 380,
  },
  rechargeAmountInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    paddingVertical: 8,
  },
  rechargeDollarSignLarge: {
    fontSize: 42,
    fontWeight: '800',
    color: colors.primary,
    marginRight: 6,
  },
  rechargeInputLarge: {
    fontSize: 56,
    fontWeight: '800',
    color: colors.text,
    padding: 0,
    minWidth: 90,
    textAlign: 'center',
  },
  rechargeUsdLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textGray,
    marginLeft: 6,
  },
  rechargeQuickPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(108, 17, 16, 0.1)',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginBottom: 18,
  },
  rechargeQuickPreviewText: {
    fontSize: 13,
    color: colors.textGray,
    fontWeight: '500',
  },
  rechargeQuickPreviewBold: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '800',
  },
  rechargeSuggestedSection: {
    marginBottom: 16,
  },
  rechargeSuggestedTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 10,
  },
  rechargeSuggestedGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  rechargeSuggestedButton: {
    flex: 1,
    minWidth: '47%',
    backgroundColor: colors.backgroundGray,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
  },
  rechargeSuggestedButtonActive: {
    backgroundColor: 'rgba(108, 17, 16, 0.15)',
    borderColor: colors.primary,
  },
  rechargeSuggestedText: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 2,
  },
  rechargeSuggestedTextActive: {
    color: colors.primary,
  },
  rechargeSuggestedCredits: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textGray,
  },
  rechargeSuggestedCreditsActive: {
    color: 'rgba(108, 17, 16, 0.8)',
  },
  rechargeInfoCompact: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  rechargeInfoTextCompact: {
    fontSize: 11,
    color: colors.textGray,
    fontWeight: '500',
    textAlign: 'center',
  },
  rechargeModalFooter: {
    padding: 18,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.backgroundGray,
    backgroundColor: colors.background,
  },
  rechargeContinueButton: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  rechargeContinueButtonDisabled: {
    opacity: 0.5,
  },
  rechargeContinueGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 10,
  },
  rechargeContinueText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  
  // Receive Modal Styles
  receiveModalContent: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
  },
  receiveModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.backgroundGray,
  },
  receiveModalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
  },
  receiveModalDescription: {
    fontSize: 14,
    color: colors.textGray,
    marginBottom: 24,
    textAlign: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  userInfoCard: {
    backgroundColor: colors.backgroundGray,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 24,
  },
  userInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  userInfoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textGray,
  },
  userInfoValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  receiveInstructions: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  receiveInstructionsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 16,
  },
  instructionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 12,
  },
  instructionNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  instructionNumberText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFF',
  },
  instructionText: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  receiveModalActions: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: colors.backgroundGray,
  },
  shareButton: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  shareButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  shareButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  closeModalButton: {
    flex: 1,
    backgroundColor: colors.backgroundGray,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeModalButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
});