/**
 * Mi Negocio - Business Dashboard
 * Onboarding → Plan Selection → Dashboard
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
  Dimensions,
  Platform,
  Alert,
  FlatList,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../../services/api';
import { useTranslation } from 'react-i18next';
// Plaid Link SDK types (native only - import conditionally)
type PlaidLinkSuccess = { publicToken: string; metadata?: any };
type PlaidLinkExit = { error?: any };

import {
  plaidCreate,
  plaidOpen,
  isPlaidAvailable,
  PlaidIOSPresentation,
  PlaidLogLevel,
} from '../../utils/plaidLink';

import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');
const MONTHS_ES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

const C = {
  bg: '#F2F2F7',
  card: '#FFFFFF',
  text: '#1C1C1E',
  sub: '#636366',
  muted: '#AEAEB2',
  border: '#E5E5EA',
  brand: '#8B1A1A',
  brandSoft: '#FFF1F0',
  success: '#34C759',
  successSoft: '#E8F9ED',
  warning: '#FF9500',
  blue: '#007AFF',
  blueSoft: '#EFF6FF',
  purple: '#AF52DE',
};

const BOOKKEEPING_PLANS = [
  {
    id: 'bookkeeping_pro',
    name: 'Bookkeeping Pro',
    emoji: '📊',
    price: 149,
    originalPrice: 199,
    firstMonth: 1,
    color: '#34C759',
    features: [
      'Conexión bancaria automática',
      'Categorización inteligente con IA',
      'Reporte P&L mensual',
      'Recibos ilimitados',
      '1 cuenta bancaria',
      'Soporte por chat',
      '🎁 Taxes GRATIS',
    ],
    ideal: 'Freelancers y negocios',
  },
  {
    id: 'growth',
    name: 'Crecimiento',
    emoji: '📈',
    price: 249,
    firstMonth: 1,
    color: '#007AFF',
    popular: true,
    features: [
      'Todo del Bookkeeping Pro',
      'Hasta 3 cuentas bancarias',
      'P&L + Balance + Cash Flow',
      'Sales Tax tracking',
      'KPIs y gráficos avanzados',
      'Soporte prioritario',
      '🎁 Taxes GRATIS',
    ],
    ideal: 'Negocios en crecimiento',
  },
  {
    id: 'enterprise',
    name: 'Empresarial',
    emoji: '🏢',
    price: 449,
    firstMonth: 1,
    color: '#AF52DE',
    features: [
      'Todo del Plan Crecimiento',
      'Cuentas bancarias ilimitadas',
      'Payroll / Nómina',
      'Llamadas con especialista fiscal',
      'Análisis financiero trimestral',
      'Proyecciones de flujo de caja',
      '🎁 Taxes avanzados GRATIS',
    ],
    ideal: 'Empresas establecidas',
  },
];

const ONBOARDING_SLIDES = [
  {
    emoji: '📊',
    title: 'Tu negocio en un solo lugar',
    desc: 'Controla ingresos, gastos y tendencias financieras desde tu teléfono. Todo actualizado en tiempo real.',
  },
  {
    emoji: '🏦',
    title: 'Conecta tu banco',
    desc: 'Importa transacciones automáticamente conectando tu cuenta bancaria de forma segura con Plaid.',
  },
  {
    emoji: '📱',
    title: 'Elige tu plan',
    desc: 'Selecciona el plan que mejor se adapte a tu negocio. Desde freelancers hasta empresas establecidas.',
  },
];

interface DashboardData {
  month_income: number;
  month_expenses: number;
  month_net: number;
  ytd_income: number;
  ytd_expenses: number;
  total_transactions_month: number;
  receipts_this_month: number;
  pending_receipts: number;
  top_categories: Array<{ category: string; amount: number }>;
  monthly_trend: Array<{ month: number; income: number; expenses: number }>;
}

export default function MyBusinessScreen() {
  const { t, i18n: i18nInstance } = useTranslation();
  const isEn = i18nInstance.language?.startsWith('en');
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // State
  const [phase, setPhase] = useState<'loading' | 'onboarding' | 'plans' | 'dashboard'>('loading');
  const [onboardingPage, setOnboardingPage] = useState(0);
  const [subscription, setSubscription] = useState<any>(null);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [linkedAccounts, setLinkedAccounts] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<FlatList>(null);

  useEffect(() => {
    checkUserStatus();
  }, []);

  const checkUserStatus = async () => {
    try {
      setLoading(true);
      // Check if onboarding was completed
      const onboarded = await AsyncStorage.getItem('@bk_onboarded');

      // Check subscription status
      let sub = null;
      try {
        const subRes = await api.get('/my-business/subscription');
        sub = subRes.data;
        setSubscription(sub);
      } catch (e) { /* no subscription */ }

      if (!onboarded) {
        setPhase('onboarding');
      } else if (!sub || !sub.has_subscription) {
        setPhase('plans');
      } else {
        setSubscription(sub.subscription || sub);
        setPhase('dashboard');
        loadDashboard();
        loadAccounts();
      }
    } catch (e) {
      console.error('Status check error:', e);
      // Default to onboarding on error
      const onboarded = await AsyncStorage.getItem('@bk_onboarded');
      setPhase(onboarded ? 'plans' : 'onboarding');
    } finally {
      setLoading(false);
    }
  };

  const loadDashboard = async () => {
    try {
      const res = await api.get('/plaid/dashboard-summary?context=business');
      setDashboard(res.data);
    } catch (e) {
      console.error('Dashboard load error:', e);
    }
  };

  const loadAccounts = async () => {
    try {
      const res = await api.get('/plaid/accounts?context=business');
      if (res.data.items) {
        setLinkedAccounts(res.data.items);
      }
    } catch (e) { /* no accounts yet */ }
  };

  const completeOnboarding = async () => {
    await AsyncStorage.setItem('@bk_onboarded', 'true');
    setPhase('plans');
  };

  const selectPlan = async (plan: typeof BOOKKEEPING_PLANS[0]) => {
    Alert.alert(
      `Plan ${plan.name}`,
      `$${plan.price}/mes\n\n¿Deseas suscribirte a este plan?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Suscribirse',
          onPress: async () => {
            try {
              await api.post('/my-business/subscribe', {
                plan_id: plan.id,
                plan_name: plan.name,
                price: plan.price,
              });
              setSubscription({ plan_id: plan.id, plan_name: plan.name, price: plan.price, status: 'active' });
              setPhase('dashboard');
              loadDashboard();
            } catch (e: any) {
              Alert.alert('Error', e.response?.data?.detail || 'No se pudo procesar');
            }
          },
        },
      ]
    );
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadDashboard(), loadAccounts()]);
    setRefreshing(false);
  };

  const [plaidLoading, setPlaidLoading] = useState(false);

  const connectBank = async () => {
    if (!isPlaidAvailable) {
      Alert.alert(
        '📱 Solo en iOS/Android',
        'La conexión bancaria con Plaid solo está disponible en la aplicación nativa de iOS o Android. Por favor, usa la app de tu teléfono.',
      );
      return;
    }

    // ── Verify active business subscription before connecting ──
    try {
      const subCheck = await api.get('/my-business/subscription');
      const sub = subCheck.data;
      if (!sub || !sub.has_subscription) {
        Alert.alert(
          '🔒 Suscripción Requerida',
          'Para conectar tu banco en Mi Negocio necesitas una suscripción activa de negocio.',
          [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Ver Planes', onPress: () => router.push('/business-subscription' as any) },
          ]
        );
        return;
      }
      const status = sub.subscription?.status || sub.status || '';
      if (status === 'expired' || status === 'cancelled') {
        Alert.alert(
          '⚠️ Suscripción Expirada',
          'Tu suscripción de negocio ha expirado. Renueva para seguir usando la conexión bancaria.',
          [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Renovar', onPress: () => router.push('/business-subscription' as any) },
          ]
        );
        return;
      }
    } catch (e) {
      Alert.alert(
        '🔒 Suscripción Requerida',
        'Para conectar tu banco en Mi Negocio necesitas una suscripción activa de negocio.',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Ver Planes', onPress: () => router.push('/business-subscription' as any) },
        ]
      );
      return;
    }

    try {
      setPlaidLoading(true);

      // 1. Get link token from our backend
      const res = await api.post('/plaid/create-link-token');
      if (!res.data.link_token) {
        Alert.alert('Error', 'No se recibió el token de conexión bancaria. Intenta más tarde.');
        setPlaidLoading(false);
        return;
      }

      // 2. Create Plaid Link handler with v12 direct config
      await plaidCreate({
        token: res.data.link_token,
        noLoadingState: false,
        logLevel: PlaidLogLevel.ERROR,
      });

      // 3. Open Plaid Link UI with callbacks
      plaidOpen({
        onSuccess: async (success: any) => {
          setPlaidLoading(false);
          try {
            const exchangeRes = await api.post('/plaid/exchange-token', {
              public_token: success.publicToken,
              institution: success.metadata?.institution,
              context: 'business',
            });
            if (exchangeRes.data.success) {
              Alert.alert(
                '✅ ¡Conectado!',
                `${exchangeRes.data.institution_name} vinculada exitosamente.\n\nSe encontraron ${exchangeRes.data.accounts?.length || 0} cuentas.`
              );
              loadAccounts();
            }
          } catch (e) {
            Alert.alert('Error', 'No se pudo vincular la cuenta. Intenta de nuevo.');
          }
        },
        onExit: (exit: any) => {
          setPlaidLoading(false);
          // Only show error alert if there was an actual error, not user cancellation
          if (exit.error) {
            const errorCode = exit.error.errorCode || exit.error.error_code || '';
            const errorMsg = exit.error.errorMessage || exit.error.display_message || '';
            console.log('Plaid Link exit error:', JSON.stringify(exit.error));
            
            // Don't show alert for user-initiated cancellations
            if (errorCode !== 'USER_EXIT' && errorCode !== 'user_exit') {
              Alert.alert(
                'Error de conexión',
                errorMsg || 'Hubo un problema al conectar tu banco. Verifica tu conexión a internet e intenta de nuevo.'
              );
            }
          }
          // If no error, user simply closed the modal — don't show any alert
        },
        iOSPresentationStyle: PlaidIOSPresentation.MODAL,
        logLevel: PlaidLogLevel.ERROR,
      });

    } catch (e: any) {
      setPlaidLoading(false);
      console.error('Plaid connect error:', e);
      Alert.alert('Error', 'No se pudo iniciar la conexión bancaria. Intenta más tarde.');
    }
  };

  // ── Update bank auth permissions (for existing connections) ──
  const updateBankAuth = async () => {
    if (!isPlaidAvailable) {
      Alert.alert('📱 Solo en iOS/Android', 'Esta función solo está disponible en la app nativa.');
      return;
    }

    setPlaidLoading(true);
    try {
      const res = await api.post('/plaid/update-link-token', { context: 'business' });
      if (!res.data.link_token) { setPlaidLoading(false); return; }
      await plaidCreate({ token: res.data.link_token, noLoadingState: false, logLevel: PlaidLogLevel.ERROR });
      plaidOpen({
        onSuccess: async () => {
          setPlaidLoading(false);
          Alert.alert('✅ Permisos Actualizados', 'Los permisos bancarios se actualizaron correctamente.');
          loadAccounts();
          loadDashboard();
        },
        onExit: () => { setPlaidLoading(false); },
        iOSPresentationStyle: PlaidIOSPresentation.MODAL,
        logLevel: PlaidLogLevel.ERROR,
      });
    } catch (e) {
      setPlaidLoading(false);
      Alert.alert('Error', 'No se pudo iniciar la actualización de permisos.');
    }
  };

  // ─── RENDER: Loading ───
  if (loading) {
    return (
      <View style={[s.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={C.brand} />
      </View>
    );
  }

  // ─── RENDER: Onboarding ───
  if (phase === 'onboarding') {
    return (
      <View style={[s.container, { paddingTop: insets.top }]}>
        <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 30 }}>
          <Text style={{ fontSize: 60, textAlign: 'center' }}>{ONBOARDING_SLIDES[onboardingPage].emoji}</Text>
          <Text style={s.onbTitle}>{ONBOARDING_SLIDES[onboardingPage].title}</Text>
          <Text style={s.onbDesc}>{ONBOARDING_SLIDES[onboardingPage].desc}</Text>

          {/* Dots */}
          <View style={s.dotsRow}>
            {ONBOARDING_SLIDES.map((_, i) => (
              <View key={i} style={[s.dot, i === onboardingPage && s.dotActive]} />
            ))}
          </View>
        </View>

        <View style={[s.onbFooter, { paddingBottom: insets.bottom + 16 }]}>
          {onboardingPage < 2 ? (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <TouchableOpacity onPress={completeOnboarding} style={s.onbSkipBtn}>
                <Text style={s.onbSkipText}>Saltar</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setOnboardingPage(p => p + 1)} style={s.onbNextBtn}>
                <Text style={s.onbNextText}>Siguiente</Text>
                <Ionicons name="arrow-forward" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity onPress={completeOnboarding} style={[s.onbNextBtn, { flex: 1, justifyContent: 'center' }]}>
              <Text style={s.onbNextText}>Comenzar</Text>
              <Ionicons name="rocket" size={18} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  // ─── RENDER: Plan Selection ───
  if (phase === 'plans') {
    return (
      <View style={s.container}>
        {/* Header con gradiente */}
        <LinearGradient
          colors={['#0A1628', '#132240', '#1A2F55']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ paddingHorizontal: 20, paddingTop: insets.top + 16, paddingBottom: 24, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 }}
        >
          <Text style={{ fontSize: 26, fontWeight: '900', color: '#FFFFFF', textAlign: 'center' }}>
            {isEn ? 'Choose Your Plan' : 'Elige tu Plan'}
          </Text>
          <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', textAlign: 'center', marginTop: 6 }}>
            Bookkeeping profesional + Taxes GRATIS
          </Text>
        </LinearGradient>

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 20 }} showsVerticalScrollIndicator={false}>
          {/* Free Diagnosis Banner */}
          <TouchableOpacity
            style={{ backgroundColor: '#EFF6FF', borderWidth: 1.5, borderColor: '#BFDBFE', borderRadius: 16, padding: 16, marginBottom: 16, flexDirection: 'row', alignItems: 'center' }}
            onPress={() => router.push('/financial-diagnosis' as any)}
            activeOpacity={0.7}
          >
            <Text style={{ fontSize: 32, marginRight: 12 }}>🔍</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#1E40AF' }}>Diagnóstico Financiero GRATIS</Text>
              <Text style={{ fontSize: 12, color: '#3B82F6', marginTop: 2 }}>Descubre cuánto podrías ahorrar en impuestos →</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#3B82F6" />
          </TouchableOpacity>

          {/* Trial Banner */}
          <View style={{ backgroundColor: '#F0FDF4', borderWidth: 1.5, borderColor: '#BBF7D0', borderRadius: 16, padding: 14, marginBottom: 16, alignItems: 'center' }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: '#166534' }}>🎉 Primer mes por solo $1</Text>
            <Text style={{ fontSize: 12, color: '#15803D', marginTop: 2 }}>Prueba sin riesgo • Cancela cuando quieras</Text>
          </View>

          {BOOKKEEPING_PLANS.map((plan) => (
            <View key={plan.id} style={[s.planCard, plan.popular && { borderWidth: 2, borderColor: plan.color }]}>
              {plan.popular && (
                <View style={[s.planPopular, { backgroundColor: plan.color }]}>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: '#fff' }}>MÁS POPULAR</Text>
                </View>
              )}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Text style={{ fontSize: 36 }}>{plan.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 18, fontWeight: '700', color: C.text }}>{plan.name}</Text>
                  <Text style={{ fontSize: 12, color: C.sub }}>{plan.ideal}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontSize: 28, fontWeight: '800', color: plan.color }}>${plan.price}</Text>
                  <Text style={{ fontSize: 11, color: C.sub }}>/mes</Text>
                </View>
              </View>

              <View style={{ marginTop: 14, gap: 6 }}>
                {plan.features.map((f, i) => (
                  <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Ionicons name="checkmark-circle" size={16} color={plan.color} />
                    <Text style={{ fontSize: 13, color: C.text, flex: 1 }}>{f}</Text>
                  </View>
                ))}
              </View>

              <TouchableOpacity
                style={[s.planBtn, { backgroundColor: plan.color }]}
                onPress={() => selectPlan(plan)}
                activeOpacity={0.8}
              >
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>Elegir {plan.name}</Text>
              </TouchableOpacity>
            </View>
          ))}

          {/* Apple Subscription Terms Footer */}
          <View style={{ marginTop: 16, paddingHorizontal: 8, alignItems: 'center' }}>
            <Text style={{ fontSize: 10, color: C.muted, textAlign: 'center', lineHeight: 15 }}>
              {isEn
                ? 'Payment will be charged to your Apple ID account at confirmation of purchase. Subscription automatically renews unless auto-renew is turned off at least 24 hours before the end of the current period. Manage subscriptions in Settings > Apple ID > Subscriptions.'
                : 'El pago se cargará a tu cuenta de Apple ID al confirmar la compra. La suscripción se renueva automáticamente a menos que desactives la renovación al menos 24 horas antes del fin del período actual. Administra tus suscripciones en Ajustes > Apple ID > Suscripciones.'
              }
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 12 }}>
              <TouchableOpacity onPress={() => router.push('/terms' as any)}>
                <Text style={{ fontSize: 10, color: C.blue, fontWeight: '600' }}>
                  {isEn ? 'Terms of Service' : 'Términos de Servicio'}
                </Text>
              </TouchableOpacity>
              <Text style={{ fontSize: 10, color: C.muted }}>•</Text>
              <TouchableOpacity onPress={() => router.push('/privacy' as any)}>
                <Text style={{ fontSize: 10, color: C.blue, fontWeight: '600' }}>
                  {isEn ? 'Privacy Policy' : 'Política de Privacidad'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </View>
    );
  }

  // ─── RENDER: Dashboard ───
  const d = dashboard;
  const monthName = d ? MONTHS_ES[(d as any).month ? (d as any).month - 1 : new Date().getMonth()] : MONTHS_ES[new Date().getMonth()];
  const monthNet = d?.month_net || 0;
  const hasConnection = d?.has_active_connection || linkedAccounts.length > 0;
  const maxCatAmt = d?.top_categories?.length ? Math.max(...d.top_categories.map((c: any) => c.amount)) : 1;

  return (
    <View style={s.container}>
      {/* Dark Professional Header */}
      <LinearGradient
        colors={['#0A1628', '#132240', '#1A2F55']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[s.headerGradient, { paddingTop: insets.top + 8 }]}
      >
        <View style={s.header}>
          <View>
            <Text style={s.headerTitle}>Mi Negocio</Text>
            <Text style={s.headerSub}>{subscription?.plan_name || 'Dashboard'}</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              style={s.headerIcon}
              onPress={() => router.push('/business-subscription' as any)}
            >
              <Ionicons name="card-outline" size={20} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={s.headerIcon} onPress={onRefresh}>
              <Ionicons name="refresh" size={20} color="rgba(255,255,255,0.8)" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Hero Financial Summary - inside header */}
        <View style={{ paddingHorizontal: 16, paddingBottom: 20, paddingTop: 4 }}>
          <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 }}>Balance Neto · {monthName}</Text>
          <Text style={{ fontSize: 34, fontWeight: '900', color: monthNet >= 0 ? '#4ADE80' : '#F87171', marginTop: 4 }}>
            {monthNet >= 0 ? '+' : ''}{monthNet < 0 ? '-' : ''}${Math.abs(monthNet).toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </Text>
          <View style={{ flexDirection: 'row', gap: 20, marginTop: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', fontWeight: '600' }}>INGRESOS</Text>
              <Text style={{ fontSize: 18, fontWeight: '700', color: '#4ADE80', marginTop: 2 }}>${(d?.month_income || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
            </View>
            <View style={{ width: 1, backgroundColor: 'rgba(255,255,255,0.15)' }} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', fontWeight: '600' }}>GASTOS</Text>
              <Text style={{ fontSize: 18, fontWeight: '700', color: '#F87171', marginTop: 2 }}>${(d?.month_expenses || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
            </View>
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 80 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.brand} />}
      >
        {/* YTD Summary Bar */}
        <View style={[s.statCard, { marginBottom: 14, backgroundColor: '#F8FAFC' }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <Ionicons name="calendar-outline" size={16} color="#6366F1" />
            <Text style={{ fontSize: 13, fontWeight: '700', color: C.text }}>Acumulado del Año (YTD)</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 16 }}>
            <View style={{ flex: 1, backgroundColor: '#ECFDF5', borderRadius: 10, padding: 10 }}>
              <Text style={{ fontSize: 10, fontWeight: '600', color: '#059669' }}>INGRESOS YTD</Text>
              <Text style={{ fontSize: 16, fontWeight: '800', color: '#059669', marginTop: 2 }}>${(d?.ytd_income || 0).toLocaleString()}</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: '#FEF2F2', borderRadius: 10, padding: 10 }}>
              <Text style={{ fontSize: 10, fontWeight: '600', color: '#DC2626' }}>GASTOS YTD</Text>
              <Text style={{ fontSize: 16, fontWeight: '800', color: '#DC2626', marginTop: 2 }}>${(d?.ytd_expenses || 0).toLocaleString()}</Text>
            </View>
          </View>
        </View>

        {/* Connected Accounts */}
        <View style={[s.statCard, { marginBottom: 14 }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: C.text }}>🏦 Cuentas Conectadas</Text>
            <TouchableOpacity onPress={connectBank} disabled={plaidLoading} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: plaidLoading ? '#E5E5EA' : '#EEF2FF', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 }}>
              {plaidLoading ? (
                <ActivityIndicator size="small" color="#6366F1" />
              ) : (
                <>
                  <Ionicons name="add" size={16} color="#6366F1" />
                  <Text style={{ fontSize: 12, fontWeight: '600', color: '#6366F1' }}>Conectar</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
          {linkedAccounts.length > 0 ? (
            <>
              {linkedAccounts.map((item, idx) => (
                <View key={idx} style={{ paddingVertical: 10, borderTopWidth: idx > 0 ? 1 : 0, borderTopColor: C.border }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="business-outline" size={16} color="#6366F1" />
                      </View>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: C.text }}>{item.institution_name}</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => {
                        Alert.alert(
                          'Desconectar',
                          `¿Deseas desconectar ${item.institution_name}?`,
                          [
                            { text: 'Cancelar', style: 'cancel' },
                            {
                              text: 'Desconectar',
                              style: 'destructive',
                              onPress: async () => {
                                try {
                                  await api.delete(`/plaid/accounts/${item.item_id}`);
                                  loadAccounts();
                                } catch (e) {
                                  Alert.alert('Error', 'No se pudo desconectar');
                                }
                              },
                            },
                          ]
                        );
                      }}
                    >
                      <Ionicons name="close-circle-outline" size={18} color={C.muted} />
                    </TouchableOpacity>
                  </View>
                  {item.accounts?.map((acct: any, j: number) => (
                    <View key={j} style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4, marginLeft: 40 }}>
                      <Text style={{ fontSize: 12, color: C.sub }}>{acct.name} •••{acct.mask}</Text>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: C.text }}>${acct.current_balance?.toLocaleString() || '0'}</Text>
                    </View>
                  ))}
                </View>
              ))}
              <TouchableOpacity
                onPress={async () => {
                  try {
                    Alert.alert('Sincronizando...', 'Importando transacciones nuevas');
                    const res = await api.post('/plaid/sync-transactions', { context: 'business' });
                    const d = res.data;
                    const total = d.total_changes || d.transactions_added || 0;
                    if (total > 0) {
                      const parts = [];
                      if (d.transactions_added > 0) parts.push(`${d.transactions_added} nuevas`);
                      if (d.transactions_modified > 0) parts.push(`${d.transactions_modified} actualizadas`);
                      if (d.transactions_removed > 0) parts.push(`${d.transactions_removed} eliminadas`);
                      Alert.alert('✅ Sincronizado', parts.join(', '));
                    } else {
                      Alert.alert('✅ Al día', d.message || 'No hay transacciones nuevas. Los bancos pueden tardar 24-48h.');
                    }
                    loadDashboard();
                  } catch (e) {
                    Alert.alert('Error', 'No se pudieron sincronizar las transacciones');
                  }
                }}
                onLongPress={() => {
                  Alert.alert(
                    '🔄 Forzar Sincronización',
                    'Esto reinicia el cursor de Plaid y vuelve a descargar todas las transacciones. ¿Continuar?',
                    [
                      { text: 'Cancelar', style: 'cancel' },
                      { text: 'Forzar', style: 'destructive', onPress: async () => {
                        try {
                          Alert.alert('Sincronizando...', 'Descargando todas las transacciones');
                          const res = await api.post('/plaid/sync-transactions', { context: 'business', force_refresh: true });
                          const d = res.data;
                          Alert.alert('✅ Forzado', `${d.transactions_added || 0} transacciones importadas`);
                          loadDashboard();
                        } catch (e) {
                          Alert.alert('Error', 'No se pudieron sincronizar');
                        }
                      }}
                    ]
                  );
                }}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, marginTop: 6, borderTopWidth: 1, borderTopColor: C.border }}
              >
                <Ionicons name="sync" size={16} color="#6366F1" />
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#6366F1' }}>Sincronizar Transacciones</Text>
              </TouchableOpacity>
            </>
          ) : (
            <View style={{ alignItems: 'center', paddingVertical: 16 }}>
              <Text style={{ fontSize: 32 }}>🔗</Text>
              <Text style={{ fontSize: 13, color: C.sub, marginTop: 6, textAlign: 'center' }}>
                Conecta tu primera cuenta bancaria para importar transacciones automáticamente
              </Text>
            </View>
          )}
        </View>

        {/* Quick Actions - Modern Grid */}
        <Text style={{ fontSize: 15, fontWeight: '700', color: C.text, marginBottom: 10 }}>⚡ Acciones Rápidas</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
          {[
            { icon: 'document-text-outline', label: isEn ? 'Invoices' : 'Facturas', color: '#8B1A1A', bg: '#FFF1F0', route: '/business-invoices' },
            { icon: 'car-outline', label: isEn ? 'Mileage' : 'Millas', color: '#FF9500', bg: '#FFF8EC', route: '/business-mileage' },
            { icon: 'receipt-outline', label: isEn ? 'Receipts' : 'Recibos', color: '#F59E0B', bg: '#FFFBEB', route: '/business-receipts', badge: d?.pending_receipts },
            { icon: 'list-outline', label: isEn ? 'Transactions' : 'Transacciones', color: '#3B82F6', bg: '#EFF6FF', route: '/business-transactions' },
            { icon: 'speedometer-outline', label: isEn ? 'Trucker Tools' : 'Camionero', color: '#1E40AF', bg: '#EFF6FF', route: '/trucker-tools' },
            { icon: 'bar-chart-outline', label: isEn ? 'Reports' : 'Reportes', color: '#8B5CF6', bg: '#F5F3FF', route: '/reports' },
          ].map((action) => (
            <TouchableOpacity
              key={action.label}
              style={s.quickAction}
              onPress={() => {
                try { router.push(action.route as any); } catch {}
              }}
              activeOpacity={0.7}
            >
              <View style={[s.quickActionIcon, { backgroundColor: action.bg }]}>
                <Ionicons name={action.icon as any} size={22} color={action.color} />
                {action.badge ? (
                  <View style={s.badge}>
                    <Text style={s.badgeText}>{action.badge}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={s.quickActionLabel}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Top Categories with Progress Bars */}
        {d?.top_categories && d.top_categories.length > 0 && (
          <View style={[s.statCard, { marginBottom: 14 }]}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: C.text, marginBottom: 12 }}>📊 Top Gastos del Mes</Text>
            {d.top_categories.slice(0, 5).map((cat: any, idx: number) => {
              const pct = maxCatAmt > 0 ? (cat.amount / maxCatAmt) * 100 : 0;
              const colors = ['#3B82F6', '#8B5CF6', '#F59E0B', '#EF4444', '#10B981'];
              const color = colors[idx % colors.length];
              return (
                <View key={idx} style={{ marginBottom: idx < 4 ? 12 : 0 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: C.text }}>{cat.category}</Text>
                    <Text style={{ fontSize: 13, fontWeight: '800', color }}>${cat.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
                  </View>
                  <View style={{ height: 6, backgroundColor: '#F1F5F9', borderRadius: 3, overflow: 'hidden' }}>
                    <View style={{ width: `${pct}%`, height: '100%', backgroundColor: color, borderRadius: 3 } as any} />
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Monthly Trend Mini Chart */}
        {d?.monthly_trend && d.monthly_trend.length > 0 && (
          <View style={[s.statCard]}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: C.text, marginBottom: 12 }}>📊 Tendencia Mensual</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              {d.monthly_trend.slice(-6).map((m, idx) => {
                const maxVal = Math.max(...d.monthly_trend.slice(-6).map(t => Math.max(t.income, t.expenses)), 1);
                const incH = Math.max((m.income / maxVal) * 60, 4);
                const expH = Math.max((m.expenses / maxVal) * 60, 4);
                return (
                  <View key={idx} style={{ alignItems: 'center', flex: 1 }}>
                    <View style={{ flexDirection: 'row', gap: 3, alignItems: 'flex-end', height: 65 }}>
                      <View style={{ width: 10, height: incH, backgroundColor: C.success, borderRadius: 4 }} />
                      <View style={{ width: 10, height: expH, backgroundColor: '#EF4444', borderRadius: 4 }} />
                    </View>
                    <Text style={{ fontSize: 9, color: C.muted, marginTop: 4 }}>{MONTHS_ES[m.month - 1] || ''}</Text>
                  </View>
                );
              })}
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.success }} />
                <Text style={{ fontSize: 10, color: C.sub }}>Ingresos</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444' }} />
                <Text style={{ fontSize: 10, color: C.sub }}>Gastos</Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },

  // Header
  headerGradient: { },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, paddingBottom: 16 },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#FFFFFF' },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  headerIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },

  // Stats
  statCard: {
    backgroundColor: C.card, borderRadius: 16, padding: 16,
    ...Platform.select({ ios: { shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 3 } }, android: { elevation: 2 } }),
  },

  // Quick Actions
  quickAction: { width: (width - 62) / 3, alignItems: 'center', marginBottom: 6 },
  quickActionIcon: { width: 50, height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 6, position: 'relative' },
  quickActionLabel: { fontSize: 11, color: C.text, fontWeight: '500', textAlign: 'center' },
  badge: { position: 'absolute', top: -4, right: -4, backgroundColor: '#EF4444', borderRadius: 8, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontSize: 9, fontWeight: '700', color: '#fff' },

  // Onboarding
  onbTitle: { fontSize: 28, fontWeight: '800', color: C.text, textAlign: 'center', marginTop: 24 },
  onbDesc: { fontSize: 16, color: C.sub, textAlign: 'center', marginTop: 12, lineHeight: 24 },
  dotsRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 30 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.border },
  dotActive: { width: 24, backgroundColor: C.brand },
  onbFooter: { paddingHorizontal: 20, paddingTop: 12 },
  onbSkipBtn: { paddingVertical: 14, paddingHorizontal: 20 },
  onbSkipText: { fontSize: 15, color: C.sub, fontWeight: '600' },
  onbNextBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.brand, paddingVertical: 14, paddingHorizontal: 24, borderRadius: 14 },
  onbNextText: { fontSize: 15, fontWeight: '700', color: '#fff' },

  // Plans
  planCard: {
    backgroundColor: C.card, borderRadius: 20, padding: 20, marginBottom: 14, position: 'relative', overflow: 'hidden',
    ...Platform.select({ ios: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } }, android: { elevation: 3 } }),
  },
  planPopular: { position: 'absolute', top: 0, right: 0, paddingHorizontal: 12, paddingVertical: 4, borderBottomLeftRadius: 12 },
  planBtn: { marginTop: 16, paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
});
