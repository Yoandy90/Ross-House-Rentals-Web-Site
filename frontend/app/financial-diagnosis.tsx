/**
 * Financial Diagnosis Screen - Free financial health check
 * Shows spending patterns, potential tax deductions, and bookkeeping subscription CTA
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Dimensions, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import api from '../services/api';

const { width } = Dimensions.get('window');

const C = {
  bg: '#F8FAFC', card: '#FFFFFF', text: '#1C1C1E', sub: '#636366',
  muted: '#AEAEB2', border: '#E5E5EA', brand: '#8B1A1A',
  success: '#34C759', blue: '#007AFF', orange: '#FF9500', red: '#FF3B30',
};

interface Diagnosis {
  success: boolean;
  has_bank_connected: boolean;
  message?: string;
  period?: { months_analyzed: number; transaction_count: number };
  summary?: {
    total_income: number; total_expenses: number; net_profit: number;
    avg_monthly_income: number; avg_monthly_expenses: number; expense_ratio: number;
  };
  health?: { score: number; label: string; color: string };
  deductions?: {
    total_deductible_found: number; estimated_tax_savings: number;
    annual_projection_savings: number;
    categories: Array<{
      category: string; label: string; icon: string;
      total_spent: number; deductible_amount: number; transaction_count: number;
    }>;
  };
  top_expenses?: Array<{ category: string; icon?: string; total: number; count: number; percentage: number }>;
  monthly_breakdown?: Array<{ month: string; income: number; expenses: number; net: number }>;
  annual_projection?: {
    income: number; expenses: number; net_profit: number;
    potential_deductions: number; potential_tax_savings: number;
  };
  recommendations?: Array<{ icon: string; title: string; message: string; priority: string }>;
  cta?: {
    plan_name: string; monthly_price: number; first_month_price: number;
    includes_taxes: boolean; tagline: string; value_proposition: string;
  };
}

export default function FinancialDiagnosisScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const isEn = i18n.language === 'en';

  const [loading, setLoading] = useState(true);
  const [diagnosis, setDiagnosis] = useState<Diagnosis | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadDiagnosis = useCallback(async () => {
    try {
      const res = await api.get('/financial-diagnosis/generate');
      setDiagnosis(res.data);
    } catch (err: any) {
      console.error('Error loading diagnosis:', err);
      setDiagnosis({
        success: false,
        has_bank_connected: false,
        message: isEn
          ? 'Could not generate your diagnosis. Please connect your bank first.'
          : 'No pudimos generar tu diagnóstico. Conecta tu banco primero.',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isEn]);

  useEffect(() => { loadDiagnosis(); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      // First, sync latest transactions from Plaid
      await api.post('/plaid/transactions/sync', { force_refresh: false });
    } catch (e) {
      // Sync might fail if no bank connected - that's ok
      console.log('Sync skipped:', e);
    }
    // Then regenerate diagnosis with fresh data
    loadDiagnosis();
  };

  const formatMoney = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  const handleSubscribe = () => {
    Alert.alert(
      isEn ? '🎉 Special Offer!' : '🎉 ¡Oferta Especial!',
      isEn
        ? 'Start your professional bookkeeping for just $1 the first month. Includes FREE tax preparation!\n\nWe\'ll contact you shortly to activate your plan.'
        : '¡Comienza tu contabilidad profesional por solo $1 el primer mes! Incluye preparación de taxes GRATIS.\n\nTe contactaremos pronto para activar tu plan.',
      [
        { text: isEn ? 'Cancel' : 'Cancelar', style: 'cancel' },
        {
          text: isEn ? 'Subscribe $1' : 'Suscribir $1',
          onPress: async () => {
            try {
              await api.post('/my-business/subscribe', {
                plan: 'bookkeeping_pro',
                plan_name: 'Bookkeeping Pro',
                amount: 149,
                trial_amount: 1,
                source: 'financial_diagnosis',
              });
              Alert.alert('✅', isEn ? 'Request sent! We\'ll activate your plan soon.' : '¡Solicitud enviada! Activaremos tu plan pronto.');
            } catch (e) {
              Alert.alert('✅', isEn ? 'We\'ll contact you to activate your plan.' : 'Te contactaremos para activar tu plan.');
            }
          }
        }
      ]
    );
  };

  if (loading) {
    return (
      <View style={[s.loadingContainer, { paddingTop: insets.top + 60 }]}>
        <ActivityIndicator size="large" color={C.brand} />
        <Text style={s.loadingText}>
          {isEn ? 'Analyzing your finances...' : 'Analizando tus finanzas...'}
        </Text>
      </View>
    );
  }

  // No bank connected or error
  if (!diagnosis?.success) {
    return (
      <View style={s.container}>
        <LinearGradient colors={['#1a1a2e', '#16213e']} style={[s.header, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>
            {isEn ? 'Financial Diagnosis' : 'Diagnóstico Financiero'}
          </Text>
        </LinearGradient>
        <View style={s.emptyState}>
          <Text style={{ fontSize: 64, marginBottom: 16 }}>🏦</Text>
          <Text style={s.emptyTitle}>
            {isEn ? 'Connect your bank to start' : 'Conecta tu banco para comenzar'}
          </Text>
          <Text style={s.emptyDesc}>
            {diagnosis?.message || (isEn
              ? 'We need access to your bank transactions to generate your free financial diagnosis.'
              : 'Necesitamos acceso a tus transacciones bancarias para generar tu diagnóstico financiero gratuito.'
            )}
          </Text>
          <TouchableOpacity style={s.connectBtn} onPress={() => router.push('/my-business' as any)}>
            <Ionicons name="link-outline" size={20} color="#FFF" />
            <Text style={s.connectBtnText}>
              {isEn ? 'Connect Bank Account' : 'Conectar Cuenta Bancaria'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const d = diagnosis;

  return (
    <View style={s.container}>
      {/* Header */}
      <LinearGradient colors={['#1a1a2e', '#16213e']} style={[s.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>
          {isEn ? 'Your Financial Diagnosis' : 'Tu Diagnóstico Financiero'}
        </Text>
        <Text style={s.headerSub}>
          {isEn ? 'FREE' : 'GRATIS'} • {d.period?.transaction_count || 0} {isEn ? 'transactions' : 'transacciones'} • {d.period?.months_analyzed || 3} {isEn ? 'months' : 'meses'}
        </Text>
      </LinearGradient>

      <ScrollView
        style={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Health Score */}
        {d.health && (
          <View style={s.healthCard}>
            <View style={s.healthCircleContainer}>
              <View style={[s.healthCircle, { borderColor: d.health.color }]}>
                <Text style={[s.healthScore, { color: d.health.color }]}>{d.health.score}</Text>
              </View>
              <Text style={[s.healthLabel, { color: d.health.color }]}>{d.health.label}</Text>
            </View>
            <View style={s.healthMeta}>
              <Text style={s.healthTitle}>
                {isEn ? 'Financial Health Score' : 'Puntaje de Salud Financiera'}
              </Text>
              <Text style={s.healthDesc}>
                {d.health.score >= 70
                  ? (isEn ? 'Your finances look healthy!' : '¡Tus finanzas se ven saludables!')
                  : d.health.score >= 50
                  ? (isEn ? 'There\'s room for improvement.' : 'Hay espacio para mejorar.')
                  : (isEn ? 'Your finances need attention.' : 'Tus finanzas necesitan atención.')
                }
              </Text>
            </View>
          </View>
        )}

        {/* Summary Cards */}
        {d.summary && (
          <View style={s.summaryRow}>
            <View style={[s.summaryCard, { borderLeftColor: C.success }]}>
              <Text style={s.summaryLabel}>{isEn ? 'Income' : 'Ingresos'}</Text>
              <Text style={[s.summaryValue, { color: C.success }]}>{formatMoney(d.summary.total_income)}</Text>
              <Text style={s.summaryMeta}>~{formatMoney(d.summary.avg_monthly_income)}/{isEn ? 'mo' : 'mes'}</Text>
            </View>
            <View style={[s.summaryCard, { borderLeftColor: C.red }]}>
              <Text style={s.summaryLabel}>{isEn ? 'Expenses' : 'Gastos'}</Text>
              <Text style={[s.summaryValue, { color: C.red }]}>{formatMoney(d.summary.total_expenses)}</Text>
              <Text style={s.summaryMeta}>~{formatMoney(d.summary.avg_monthly_expenses)}/{isEn ? 'mo' : 'mes'}</Text>
            </View>
          </View>
        )}

        {/* 💰 TAX SAVINGS HIGHLIGHT */}
        {d.deductions && d.deductions.estimated_tax_savings > 0 && (
          <LinearGradient colors={['#065F46', '#047857']} style={s.savingsCard}>
            <View style={s.savingsHeader}>
              <Text style={{ fontSize: 32 }}>💰</Text>
              <View style={{ marginLeft: 12, flex: 1 }}>
                <Text style={s.savingsTitle}>
                  {isEn ? 'Potential Tax Savings Found!' : '¡Ahorros en Impuestos Encontrados!'}
                </Text>
                <Text style={s.savingsSubtitle}>
                  {isEn ? 'Based on your last 3 months' : 'Basado en tus últimos 3 meses'}
                </Text>
              </View>
            </View>
            <View style={s.savingsNumbers}>
              <View style={s.savingsBlock}>
                <Text style={s.savingsAmount}>{formatMoney(d.deductions.total_deductible_found)}</Text>
                <Text style={s.savingsCaption}>
                  {isEn ? 'Deductible expenses' : 'Gastos deducibles'}
                </Text>
              </View>
              <View style={[s.savingsBlock, { borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.2)' }]}>
                <Text style={s.savingsAmount}>{formatMoney(d.deductions.annual_projection_savings)}</Text>
                <Text style={s.savingsCaption}>
                  {isEn ? 'Savings/year (projected)' : 'Ahorro/año (proyectado)'}
                </Text>
              </View>
            </View>
            {/* Deduction categories */}
            {d.deductions.categories.length > 0 && (
              <View style={s.deductionsList}>
                {d.deductions.categories.slice(0, 5).map((cat, i) => (
                  <View key={i} style={s.deductionRow}>
                    <Text style={s.deductionIcon}>{cat.icon}</Text>
                    <Text style={s.deductionLabel}>{cat.label}</Text>
                    <Text style={s.deductionAmount}>{formatMoney(cat.deductible_amount)}</Text>
                  </View>
                ))}
              </View>
            )}
          </LinearGradient>
        )}

        {/* Top Expenses */}
        {d.top_expenses && d.top_expenses.length > 0 && (
          <View style={s.sectionCard}>
            <Text style={s.sectionTitle}>
              {isEn ? '📊 Where Your Money Goes' : '📊 A Dónde Va Tu Dinero'}
            </Text>
            {d.top_expenses.slice(0, 6).map((exp, i) => (
              <View key={i} style={s.expenseRow}>
                <Text style={s.expenseIcon}>{exp.icon || '📌'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.expenseCategory}>{exp.category}</Text>
                  <View style={s.expenseBar}>
                    <View style={[s.expenseBarFill, { width: `${Math.min(exp.percentage, 100)}%` }]} />
                  </View>
                </View>
                <View style={{ alignItems: 'flex-end', marginLeft: 12 }}>
                  <Text style={s.expenseAmount}>{formatMoney(exp.total)}</Text>
                  <Text style={s.expensePercent}>{exp.percentage}%</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Recommendations */}
        {d.recommendations && d.recommendations.length > 0 && (
          <View style={s.sectionCard}>
            <Text style={s.sectionTitle}>
              {isEn ? '💡 Recommendations' : '💡 Recomendaciones'}
            </Text>
            {d.recommendations.map((rec, i) => (
              <View key={i} style={[s.recCard, rec.priority === 'high' ? s.recHigh : null]}>
                <Text style={{ fontSize: 24 }}>{rec.icon}</Text>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={s.recTitle}>{rec.title}</Text>
                  <Text style={s.recMessage}>{rec.message}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* CTA - Subscribe */}
        {d.cta && (
          <LinearGradient colors={['#8B1A1A', '#6C1110']} style={s.ctaCard}>
            <Text style={s.ctaEmoji}>🚀</Text>
            <Text style={s.ctaTitle}>{d.cta.tagline}</Text>
            <Text style={s.ctaValue}>{d.cta.value_proposition}</Text>
            <View style={s.ctaPricing}>
              <View style={s.ctaPriceBox}>
                <Text style={s.ctaPriceLabel}>{isEn ? '1st month' : '1er mes'}</Text>
                <Text style={s.ctaPriceBig}>${d.cta.first_month_price}</Text>
              </View>
              <Text style={s.ctaThen}>{isEn ? 'then' : 'luego'}</Text>
              <View style={s.ctaPriceBox}>
                <Text style={s.ctaPriceLabel}>{isEn ? 'monthly' : 'mensual'}</Text>
                <Text style={s.ctaPriceBig}>${d.cta.monthly_price}</Text>
              </View>
            </View>
            <View style={s.ctaIncludes}>
              <Text style={s.ctaIncludeItem}>✓ {isEn ? 'Professional bookkeeping' : 'Contabilidad profesional'}</Text>
              <Text style={s.ctaIncludeItem}>✓ {isEn ? 'Auto bank sync' : 'Sincronización bancaria automática'}</Text>
              <Text style={s.ctaIncludeItem}>✓ {isEn ? 'Monthly P&L reports' : 'Reportes mensuales P&L'}</Text>
              <Text style={s.ctaIncludeItem}>✓ {isEn ? 'Unlimited receipts' : 'Recibos ilimitados'}</Text>
              <Text style={s.ctaIncludeItem}>✓ {isEn ? 'FREE tax preparation' : 'Preparación de taxes GRATIS'}</Text>
              <Text style={s.ctaIncludeItem}>✓ {isEn ? '30-day money-back guarantee' : 'Garantía de 30 días'}</Text>
            </View>
            <TouchableOpacity style={s.ctaButton} onPress={handleSubscribe}>
              <Text style={s.ctaButtonText}>
                {isEn ? 'Start for $1 →' : 'Comenzar por $1 →'}
              </Text>
            </TouchableOpacity>
            <Text style={s.ctaGuarantee}>
              {isEn ? '🔒 Cancel anytime. No commitments.' : '🔒 Cancela cuando quieras. Sin compromisos.'}
            </Text>
          </LinearGradient>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  loadingContainer: { flex: 1, backgroundColor: C.bg, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 16, fontSize: 15, color: C.sub },
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  backBtn: { marginBottom: 12, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#FFF' },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 4, fontWeight: '600' },
  scroll: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },

  // Empty state
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32, paddingTop: 60 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: C.text, textAlign: 'center', marginBottom: 12 },
  emptyDesc: { fontSize: 14, color: C.sub, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  connectBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.brand, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 14 },
  connectBtnText: { color: '#FFF', fontWeight: '700', fontSize: 15 },

  // Health card
  healthCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: 20, padding: 20, marginBottom: 16, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 },
  healthCircleContainer: { alignItems: 'center', width: 90 },
  healthCircle: { width: 72, height: 72, borderRadius: 36, borderWidth: 4, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FAFAFA' },
  healthScore: { fontSize: 28, fontWeight: '900' },
  healthLabel: { fontSize: 10, fontWeight: '700', marginTop: 6, textAlign: 'center' },
  healthMeta: { flex: 1, marginLeft: 14 },
  healthTitle: { fontSize: 15, fontWeight: '700', color: C.text },
  healthDesc: { fontSize: 12, color: C.sub, marginTop: 4, lineHeight: 17 },

  // Summary
  summaryRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  summaryCard: { flex: 1, backgroundColor: C.card, borderRadius: 16, padding: 16, borderLeftWidth: 4, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4 },
  summaryLabel: { fontSize: 11, fontWeight: '600', color: C.muted, textTransform: 'uppercase' },
  summaryValue: { fontSize: 22, fontWeight: '800', marginTop: 4 },
  summaryMeta: { fontSize: 11, color: C.sub, marginTop: 2 },

  // Savings card
  savingsCard: { borderRadius: 20, padding: 20, marginBottom: 16 },
  savingsHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  savingsTitle: { fontSize: 16, fontWeight: '800', color: '#FFF' },
  savingsSubtitle: { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  savingsNumbers: { flexDirection: 'row', marginBottom: 16 },
  savingsBlock: { flex: 1, alignItems: 'center', paddingHorizontal: 8 },
  savingsAmount: { fontSize: 24, fontWeight: '900', color: '#FFF' },
  savingsCaption: { fontSize: 10, color: 'rgba(255,255,255,0.7)', marginTop: 4, textAlign: 'center' },
  deductionsList: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.15)', paddingTop: 12 },
  deductionRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  deductionIcon: { fontSize: 16, width: 28 },
  deductionLabel: { flex: 1, fontSize: 12, color: 'rgba(255,255,255,0.9)', fontWeight: '500' },
  deductionAmount: { fontSize: 13, fontWeight: '700', color: '#FFF' },

  // Expenses
  sectionCard: { backgroundColor: C.card, borderRadius: 20, padding: 20, marginBottom: 16, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: C.text, marginBottom: 16 },
  expenseRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  expenseIcon: { fontSize: 20, marginRight: 10, width: 28 },
  expenseCategory: { fontSize: 12, fontWeight: '600', color: C.text, marginBottom: 4 },
  expenseBar: { height: 6, backgroundColor: '#F1F5F9', borderRadius: 3, overflow: 'hidden' },
  expenseBarFill: { height: '100%', backgroundColor: C.brand, borderRadius: 3 },
  expenseAmount: { fontSize: 13, fontWeight: '700', color: C.text },
  expensePercent: { fontSize: 10, color: C.muted },

  // Recommendations
  recCard: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#F8FAFC', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#E2E8F0' },
  recHigh: { backgroundColor: '#FFF7ED', borderColor: '#FED7AA' },
  recTitle: { fontSize: 13, fontWeight: '700', color: C.text },
  recMessage: { fontSize: 12, color: C.sub, lineHeight: 17, marginTop: 3 },

  // CTA
  ctaCard: { borderRadius: 24, padding: 28, marginBottom: 16, alignItems: 'center' },
  ctaEmoji: { fontSize: 40, marginBottom: 12 },
  ctaTitle: { fontSize: 20, fontWeight: '900', color: '#FFF', textAlign: 'center' },
  ctaValue: { fontSize: 13, color: 'rgba(255,255,255,0.85)', textAlign: 'center', marginTop: 8, lineHeight: 18 },
  ctaPricing: { flexDirection: 'row', alignItems: 'center', marginTop: 20, marginBottom: 20 },
  ctaPriceBox: { alignItems: 'center', paddingHorizontal: 20 },
  ctaPriceLabel: { fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: '600' },
  ctaPriceBig: { fontSize: 36, fontWeight: '900', color: '#FFF' },
  ctaThen: { fontSize: 12, color: 'rgba(255,255,255,0.5)', marginHorizontal: 8 },
  ctaIncludes: { alignSelf: 'stretch', marginBottom: 20 },
  ctaIncludeItem: { fontSize: 13, color: 'rgba(255,255,255,0.9)', paddingVertical: 3, fontWeight: '500' },
  ctaButton: { backgroundColor: '#FFF', paddingHorizontal: 40, paddingVertical: 16, borderRadius: 14, width: '100%', alignItems: 'center' },
  ctaButtonText: { fontSize: 17, fontWeight: '800', color: C.brand },
  ctaGuarantee: { fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 12, textAlign: 'center' },
});
