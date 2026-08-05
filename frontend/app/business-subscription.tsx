/**
 * Business Subscription Plans - Planes exclusivos para Mi Negocio
 * Dark theme matching Mi Caso USA design
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Platform, TextInput, KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import api from '../services/api';

const C = {
  bg: '#0A0E1A', card: '#141B2D', border: '#1E293B',
  text: '#F8FAFC', sub: '#94A3B8', muted: '#64748B',
  brand: '#C41E3A', accent: '#06B6D4', green: '#10B981',
  gold: '#D4A017', purple: '#8B5CF6',
};

interface BusinessPlan {
  id: string; name: string; price: number; description: string;
  features: string[]; popular?: boolean; icon: string;
}

const PLANS: BusinessPlan[] = [
  {
    id: 'bookkeeping_pro', name: 'Bookkeeping Pro', price: 149,
    description: 'Contabilidad profesional + Taxes GRATIS',
    icon: 'leaf-outline',
    features: [
      'Conexión bancaria automática (Plaid)',
      'Categorización inteligente con IA',
      'Reporte P&L mensual',
      'Recibos ilimitados',
      '1 cuenta bancaria',
      'Soporte por chat',
      '🎁 Preparación de taxes GRATIS',
    ],
  },
  {
    id: 'crecimiento', name: 'Plan Crecimiento', price: 249, popular: true,
    description: 'Para negocios en expansión',
    icon: 'trending-up-outline',
    features: [
      'Todo del Bookkeeping Pro',
      'Hasta 3 cuentas bancarias',
      'Sales Tax tracking',
      'Balance Sheet mensual',
      'KPIs y gráficos avanzados',
      'Soporte prioritario',
      '🎁 Preparación de taxes GRATIS',
    ],
  },
  {
    id: 'empresarial', name: 'Plan Empresarial', price: 449,
    description: 'Solución completa para empresas',
    icon: 'business-outline',
    features: [
      'Todo del Plan Crecimiento',
      'Cuentas bancarias ilimitadas',
      'Payroll / Nómina',
      'Llamadas con especialista fiscal',
      'Análisis financiero trimestral',
      'Proyecciones de flujo de caja',
      'Soporte dedicado 24/7',
      '🎁 Preparación avanzada de taxes GRATIS',
    ],
  },
];

export default function BusinessSubscriptionScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();
  const [currentPlan, setCurrentPlan] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<string>('crecimiento');
  const [showContactForm, setShowContactForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    business_name: '', business_type: '', contact_name: '', contact_phone: '', notes: '',
  });

  const loadSubscription = useCallback(async () => {
    try {
      const res = await api.get('/my-business/subscription');
      if (res.data?.has_subscription) {
        setCurrentPlan(res.data.plan_id || res.data.plan_name || 'active');
      }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { loadSubscription(); }, [loadSubscription]);

  const handleSelectPlan = (planId: string) => {
    if (currentPlan) {
      Alert.alert('Plan Activo', 'Ya tienes un plan de negocio activo. Contacta soporte para cambiar.');
      return;
    }
    setSelectedPlan(planId);
    setShowContactForm(true);
  };

  const handleSubmitRequest = async () => {
    if (!formData.business_name.trim() || !formData.contact_phone.trim()) {
      Alert.alert('Error', 'Nombre del negocio y teléfono son requeridos.');
      return;
    }
    setSubmitting(true);
    try {
      const plan = PLANS.find(p => p.id === selectedPlan);
      await api.post('/my-business/subscription/request', {
        plan_id: selectedPlan, plan_name: plan?.name, plan_price: plan?.price, ...formData,
      });
      Alert.alert('✅ Solicitud Enviada', 'Nuestro equipo te contactará en las próximas 24 horas para activar tu plan.');
      setShowContactForm(false);
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail || 'Error al enviar solicitud');
    } finally {
      setSubmitting(false);
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
        <Text style={S.headerTitle}>Planes de Negocio</Text>
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
              Plan activo
            </Text>
          </View>
        )}

        {/* Title */}
        <View style={{ alignItems: 'center', marginBottom: 24 }}>
          <Text style={{ fontSize: 40, marginBottom: 8 }}>💼</Text>
          <Text style={{ fontSize: 22, fontWeight: '900', color: C.text, textAlign: 'center' }}>
            Impulsa Tu Negocio
          </Text>
          <Text style={{ fontSize: 14, color: C.sub, textAlign: 'center', marginTop: 6, lineHeight: 20 }}>
            Contabilidad profesional, reportes financieros y preparación de taxes incluida.
          </Text>
        </View>

        {/* Features box */}
        <View style={S.featuresBox}>
          <FeatureRow icon="calculator" text="Contabilidad automática con IA" />
          <FeatureRow icon="analytics" text="Reportes P&L y Balance Sheet" />
          <FeatureRow icon="receipt" text="Preparación de taxes GRATIS" />
          <FeatureRow icon="headset" text="Soporte dedicado" />
        </View>

        {/* Plan Cards */}
        {PLANS.map((plan) => {
          const isActive = currentPlan === plan.id;
          const isSelected = selectedPlan === plan.id;

          return (
            <TouchableOpacity
              key={plan.id}
              onPress={() => setSelectedPlan(plan.id)}
              activeOpacity={0.8}
              disabled={!!isActive}
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
                    <Text style={{ fontSize: 12, color: C.sub, marginTop: 4 }}>{plan.description}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontSize: 24, fontWeight: '900', color: isActive ? C.green : C.accent }}>
                      ${plan.price}
                    </Text>
                    <Text style={{ fontSize: 11, color: C.muted }}>/mes</Text>
                  </View>
                </View>

                {isSelected && (
                  <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.border }}>
                    {plan.features.map((f, i) => (
                      <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                        <Ionicons name="checkmark-circle" size={16} color={C.green} />
                        <Text style={{ fontSize: 13, color: C.sub, marginLeft: 8 }}>{f}</Text>
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
          <TouchableOpacity onPress={() => handleSelectPlan(selectedPlan)} activeOpacity={0.8}>
            <LinearGradient colors={[C.brand, '#E74C5E']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={S.subscribeBtn}>
              <Text style={S.subscribeBtnText}>Solicitar Plan</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* Contact Form */}
        {showContactForm && (
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={S.contactForm}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: C.text, marginBottom: 16 }}>
                📋 Solicitar {PLANS.find(p => p.id === selectedPlan)?.name}
              </Text>
              <FormField label="Nombre del Negocio *" value={formData.business_name}
                onChange={(v: string) => setFormData({...formData, business_name: v})} placeholder="Mi Negocio LLC" />
              <FormField label="Tipo de Negocio" value={formData.business_type}
                onChange={(v: string) => setFormData({...formData, business_type: v})} placeholder="Restaurante, Limpieza, etc." />
              <FormField label="Nombre de Contacto" value={formData.contact_name}
                onChange={(v: string) => setFormData({...formData, contact_name: v})} placeholder="Tu nombre" />
              <FormField label="Teléfono *" value={formData.contact_phone}
                onChange={(v: string) => setFormData({...formData, contact_phone: v})} placeholder="(555) 123-4567" keyboard="phone-pad" />
              <FormField label="Notas Adicionales" value={formData.notes}
                onChange={(v: string) => setFormData({...formData, notes: v})} placeholder="Algo que debamos saber..." multiline />

              <TouchableOpacity onPress={handleSubmitRequest} disabled={submitting} activeOpacity={0.8}>
                <LinearGradient colors={[C.brand, '#E74C5E']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={[S.subscribeBtn, submitting && { opacity: 0.5 }]}>
                  {submitting ? <ActivityIndicator color="#fff" /> :
                    <Text style={S.subscribeBtnText}>Enviar Solicitud</Text>}
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => setShowContactForm(false)} style={{ alignItems: 'center', marginTop: 12 }}>
                <Text style={{ color: C.sub, fontSize: 14 }}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        )}

        {/* Call to action */}
        <TouchableOpacity onPress={() => {
          const url = Platform.OS === 'ios' ? 'tel:+18069342018' : 'tel:8069342018';
          Alert.alert('Llamar a Ross Tax', '(806) 934-2018', [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Llamar', onPress: () => require('react-native').Linking.openURL(url) },
          ]);
        }} style={S.callBtn}>
          <Ionicons name="call-outline" size={18} color={C.sub} />
          <Text style={{ color: C.sub, fontSize: 13, marginLeft: 6 }}>¿Preguntas? Llama al (806) 934-2018</Text>
        </TouchableOpacity>
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

function FormField({ label, value, onChange, placeholder, keyboard, multiline }: any) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ fontSize: 13, fontWeight: '600', color: C.sub, marginBottom: 6 }}>{label}</Text>
      <TextInput
        style={[S.formInput, multiline && { height: 80, textAlignVertical: 'top' },
          Platform.OS === 'web' && { outline: 'none' } as any]}
        value={value} onChangeText={onChange} placeholder={placeholder}
        placeholderTextColor={C.muted} keyboardType={keyboard || 'default'}
        multiline={multiline} numberOfLines={multiline ? 3 : 1}
      />
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
  planCard: { backgroundColor: C.card, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 2, borderColor: C.border },
  planCardSelected: { borderColor: C.accent },
  planCardActive: { borderColor: C.green, backgroundColor: '#0D1F17' },
  popularBadge: { position: 'absolute', top: -10, right: 16, backgroundColor: C.gold, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8 },
  popularText: { fontSize: 10, fontWeight: '800', color: '#000' },
  subscribeBtn: { borderRadius: 14, paddingVertical: 18, alignItems: 'center', marginTop: 20 },
  subscribeBtnText: { fontSize: 17, fontWeight: '800', color: '#fff' },
  contactForm: { backgroundColor: C.card, borderRadius: 16, padding: 20, marginTop: 16, borderWidth: 1, borderColor: C.border },
  formInput: {
    backgroundColor: '#0F172A', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: C.text, borderWidth: 1, borderColor: C.border,
  },
  callBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 20, paddingVertical: 12 },
});
