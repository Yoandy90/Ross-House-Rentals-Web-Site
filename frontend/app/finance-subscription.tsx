/**
 * Finance Subscription Plans - Planes para Mis Finanzas (Personal)
 * Dark theme matching Mi Caso USA design
 */
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Platform, Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import iapService, { IAP_PRODUCT_IDS, IAP_SUBSCRIPTION_UPDATED_EVENT } from '../services/iapService';
import { DeviceEventEmitter } from 'react-native';

const C = {
  bg: '#0A0E1A', card: '#141B2D', border: '#1E293B',
  text: '#F8FAFC', sub: '#94A3B8', muted: '#64748B',
  brand: '#C41E3A', accent: '#06B6D4', green: '#10B981',
  gold: '#D4A017', purple: '#8B5CF6',
};

export default function FinanceSubscriptionScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [currentPlan, setCurrentPlan] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState('finance_pro');
  const [purchasing, setPurchasing] = useState('');
  const [isYearly, setIsYearly] = useState(false);
  const [showFreePlan, setShowFreePlan] = useState(false);

  const loadSubscription = async () => {
    try {
      const res = await api.get('/payments/subscription');
      const sub = res.data;
      if (sub && (sub.status === 'active' || sub.subscription?.status === 'active' || sub.has_subscription)) {
        const planId = sub.plan_id || sub.subscription?.plan_id || '';
        const productId = sub.apple_product_id || sub.subscription?.apple_product_id || '';
        if (planId.includes('receipt') || planId.includes('finance') || planId === 'pro' ||
            productId === 'com.rosstax.plan.receipts.monthly') {
          setCurrentPlan('finance_pro');
        }
      }
    } catch {}
    setLoading(false);
  };

  const loadFeatureFlags = async () => {
    try {
      const res = await api.get('/feature-flags');
      if (res.data) {
        setShowFreePlan(res.data.show_free_plan === true);
      }
    } catch {
      setShowFreePlan(false);
    }
  };

  useEffect(() => {
    loadSubscription();
    loadFeatureFlags();
  }, []);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(IAP_SUBSCRIPTION_UPDATED_EVENT, () => loadSubscription());
    return () => sub.remove();
  }, []);

  const allPlans = [
    {
      id: 'finance_free', name: 'Básico', price: 0, yearlyPrice: 0,
      period: 'Gratis siempre', icon: 'wallet-outline',
      features: [
        { text: '1 cuenta bancaria', included: true },
        { text: '5 transacciones recientes', included: true },
        { text: '3 categorías de gasto', included: true },
        { text: 'Tendencias mensuales', included: false },
        { text: 'Categorías ilimitadas', included: false },
        { text: 'Exportar datos', included: false },
      ],
    },
    {
      id: 'finance_pro', name: 'Finanzas Pro', price: 9.99, yearlyPrice: 99.99,
      period: '/mes', popular: true, icon: 'diamond-outline',
      features: [
        { text: 'Cuentas ilimitadas', included: true },
        { text: 'Transacciones ilimitadas', included: true },
        { text: 'Todas las categorías', included: true },
        { text: 'Tendencias de 6 meses', included: true },
        { text: 'Exportar a CSV', included: true },
        { text: 'Score de salud financiera', included: true },
      ],
    },
  ];

  // Filter plans based on admin feature flag
  const plans = showFreePlan ? allPlans : allPlans.filter(p => p.id !== 'finance_free');

  const handleSubscribe = async (planId: string) => {
    if (planId === 'finance_free') {
      if (currentPlan === 'finance_pro') {
        Alert.alert('Cambiar a Básico',
          'Para cancelar tu suscripción Pro, ve a Ajustes de tu iPhone → Apple ID → Suscripciones.',
          [
            { text: 'Abrir Ajustes', onPress: () => Linking.openURL('https://apps.apple.com/account/subscriptions') },
            { text: 'OK', style: 'cancel' },
          ]);
      }
      return;
    }
    if (currentPlan === 'finance_pro') {
      Alert.alert('Plan Activo', 'Ya estás suscrito a Finanzas Pro.');
      return;
    }
    setPurchasing(planId);
    try {
      if (Platform.OS !== 'ios') {
        Alert.alert('Próximamente', 'Compras disponibles pronto en Android. Llama al (806) 934-2018.',
          [{ text: 'Llamar', onPress: () => Linking.openURL('tel:+18069342018') }, { text: 'OK', style: 'cancel' }]);
        return;
      }
      const result = await iapService.purchaseSubscription(IAP_PRODUCT_IDS.RECEIPTS_PRO_MONTHLY);
      if (result.success) {
        setCurrentPlan('finance_pro');
        Alert.alert('✅ ¡Bienvenido a Pro!', 'Tu suscripción está activa. Disfruta de todas las funciones.');
      } else if (result.error && result.error !== 'Compra cancelada') {
        Alert.alert('Error', result.error || 'Error en la compra');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Error al procesar la compra');
    } finally {
      setPurchasing('');
    }
  };

  if (loading) {
    return (
      <View style={[S.root, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={C.brand} size="large" />
      </View>
    );
  }

  return (
    <View style={S.root}>
      <View style={[S.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={S.closeBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={S.headerTitle}>Finanzas Personales</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
      >
        {currentPlan && (
          <View style={S.activeBanner}>
            <Ionicons name="checkmark-circle" size={20} color={C.green} />
            <Text style={{ color: C.green, fontWeight: '700', fontSize: 14, marginLeft: 8 }}>
              Suscripción Pro activa
            </Text>
          </View>
        )}

        {/* Title */}
        <View style={{ alignItems: 'center', marginBottom: 24 }}>
          <Text style={{ fontSize: 40, marginBottom: 8 }}>💰</Text>
          <Text style={{ fontSize: 22, fontWeight: '900', color: C.text, textAlign: 'center' }}>
            Controla Tus Finanzas
          </Text>
          <Text style={{ fontSize: 14, color: C.sub, textAlign: 'center', marginTop: 6, lineHeight: 20 }}>
            Conecta tu banco, categoriza gastos y mejora tu salud financiera.
          </Text>
        </View>

        {/* Features box */}
        <View style={S.featuresBox}>
          <FeatureRow icon="card" text="Conexión bancaria automática" />
          <FeatureRow icon="pie-chart" text="Categorización inteligente" />
          <FeatureRow icon="trending-up" text="Tendencias y análisis" />
          <FeatureRow icon="download" text="Exportar datos CSV" />
        </View>

        {/* Monthly/Yearly Toggle */}
        <View style={S.toggleContainer}>
          <TouchableOpacity onPress={() => setIsYearly(false)} style={[S.toggleBtn, !isYearly && S.toggleActive]}>
            <Text style={[S.toggleText, !isYearly && S.toggleTextActive]}>Mensual</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setIsYearly(true)} style={[S.toggleBtn, isYearly && S.toggleActive]}>
            <Text style={[S.toggleText, isYearly && S.toggleTextActive]}>Anual</Text>
            <View style={S.saveBadge}>
              <Text style={S.saveBadgeText}>-17%</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Plan Cards */}
        {plans.map((plan) => {
          const isActive = currentPlan === plan.id;
          const isSelected = selectedPlan === plan.id;
          const price = isYearly ? plan.yearlyPrice : plan.price;
          const period = plan.id === 'finance_free' ? '' : isYearly ? '/año' : '/mes';

          return (
            <TouchableOpacity
              key={plan.id}
              onPress={() => {
                setSelectedPlan(plan.id);
                // If user has active Pro and taps Básico, trigger cancel flow
                if (currentPlan === 'finance_pro' && plan.id === 'finance_free') {
                  handleSubscribe('finance_free');
                }
              }}
              activeOpacity={0.8}
            >
              <View style={[S.planCard, isSelected && S.planCardSelected, isActive && S.planCardActive]}>
                {plan.popular && !isActive && (
                  <View style={S.popularBadge}>
                    <Text style={S.popularText}>POPULAR</Text>
                  </View>
                )}
                {isActive && (
                  <View style={[S.popularBadge, { backgroundColor: C.green }]}>
                    <Text style={S.popularText}>ACTIVO</Text>
                  </View>
                )}

                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Ionicons name={plan.icon as any} size={20} color={isActive ? C.green : C.accent} />
                      <Text style={{ fontSize: 16, fontWeight: '800', color: C.text }}>{plan.name}</Text>
                    </View>
                    <Text style={{ fontSize: 12, color: C.sub, marginTop: 4 }}>
                      {plan.id === 'finance_free' ? 'Funciones básicas gratis' : 'Todas las funciones premium'}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontSize: 24, fontWeight: '900', color: isActive ? C.green : plan.price === 0 ? C.sub : C.accent }}>
                      {price === 0 ? 'Gratis' : `$${price}`}
                    </Text>
                    {period ? <Text style={{ fontSize: 11, color: C.muted }}>{period}</Text> : null}
                  </View>
                </View>

                {isSelected && (
                  <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.border }}>
                    {plan.features.map((f, i) => (
                      <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                        <Ionicons
                          name={f.included ? 'checkmark-circle' : 'close-circle'}
                          size={16}
                          color={f.included ? C.green : '#EF4444'}
                        />
                        <Text style={{ fontSize: 13, color: f.included ? C.sub : C.muted, marginLeft: 8 }}>{f.text}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        })}

        {/* Subscribe Button */}
        {!currentPlan && (
          <TouchableOpacity
            onPress={() => handleSubscribe(selectedPlan)}
            activeOpacity={0.8}
            disabled={!!purchasing}
          >
            <LinearGradient
              colors={selectedPlan === 'finance_free' ? [C.muted, '#475569'] : [C.brand, '#E74C5E']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={[S.subscribeBtn, !!purchasing && { opacity: 0.5 }]}
            >
              {purchasing ? (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={[S.subscribeBtnText, { marginLeft: 10 }]}>Procesando...</Text>
                </View>
              ) : (
                <Text style={S.subscribeBtnText}>
                  {selectedPlan === 'finance_free' ? 'Continuar con Básico' : 'Suscribirse Ahora'}
                </Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* Manage / Cancel Subscription Button (visible when active) */}
        {currentPlan === 'finance_pro' && (
          <TouchableOpacity
            onPress={() => {
              Alert.alert(
                'Gestionar Suscripción',
                'Puedes cancelar o cambiar tu plan desde los Ajustes de tu iPhone → Apple ID → Suscripciones.',
                [
                  {
                    text: 'Abrir Ajustes de Suscripciones',
                    onPress: () => Linking.openURL('https://apps.apple.com/account/subscriptions'),
                  },
                  { text: 'Cancelar', style: 'cancel' },
                ]
              );
            }}
            activeOpacity={0.8}
            style={{
              marginTop: 16,
              paddingVertical: 14,
              borderRadius: 14,
              borderWidth: 1.5,
              borderColor: '#EF4444',
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <Ionicons name="settings-outline" size={18} color="#EF4444" />
            <Text style={{ color: '#EF4444', fontSize: 15, fontWeight: '700' }}>
              Gestionar Suscripción
            </Text>
          </TouchableOpacity>
        )}

        {/* Restore */}
        <TouchableOpacity
          onPress={async () => {
            try {
              const res = await iapService.restorePurchases(true);
              if (res.success) { setCurrentPlan('finance_pro'); }
            } catch {}
          }}
          style={{ alignItems: 'center', paddingVertical: 14, marginTop: 8 }}
        >
          <Text style={{ fontSize: 13, color: C.sub, textDecorationLine: 'underline' }}>
            Restaurar Compras
          </Text>
        </TouchableOpacity>

        <Text style={{ fontSize: 11, color: C.muted, textAlign: 'center', marginTop: 12, lineHeight: 16 }}>
          La suscripción se renueva automáticamente. Puedes cancelar en cualquier momento desde la configuración de tu dispositivo.
        </Text>
      </ScrollView>
    </View>
  );
}

function FeatureRow({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
      <Ionicons name={icon as any} size={20} color={C.accent} />
      <Text style={{ fontSize: 14, color: C.text, marginLeft: 10, fontWeight: '500' }}>{text}</Text>
    </View>
  );
}

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 8 },
  closeBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center', borderRadius: 20, backgroundColor: '#1E293B' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: C.text },
  activeBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#0D2818', borderRadius: 12, paddingVertical: 10, marginBottom: 16,
    borderWidth: 1, borderColor: '#1A4D2E',
  },
  featuresBox: { backgroundColor: C.card, borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: C.border },
  toggleContainer: { flexDirection: 'row', backgroundColor: C.card, borderRadius: 12, padding: 4, marginBottom: 20, borderWidth: 1, borderColor: C.border },
  toggleBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10, flexDirection: 'row', justifyContent: 'center' },
  toggleActive: { backgroundColor: C.brand },
  toggleText: { fontSize: 14, fontWeight: '600', color: C.muted },
  toggleTextActive: { color: '#fff' },
  saveBadge: { backgroundColor: C.green, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, marginLeft: 6 },
  saveBadgeText: { fontSize: 10, fontWeight: '800', color: '#fff' },
  planCard: { backgroundColor: C.card, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 2, borderColor: C.border },
  planCardSelected: { borderColor: C.accent },
  planCardActive: { borderColor: C.green, backgroundColor: '#0D1F17' },
  popularBadge: { position: 'absolute', top: -10, right: 16, backgroundColor: C.gold, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8 },
  popularText: { fontSize: 10, fontWeight: '800', color: '#000' },
  subscribeBtn: { borderRadius: 14, paddingVertical: 18, alignItems: 'center', marginTop: 20 },
  subscribeBtnText: { fontSize: 17, fontWeight: '800', color: '#fff' },
});
