import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  Keyboard, Dimensions, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Stack, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Colors, Gradients } from '../../src/constants/theme';

const { width: SW } = Dimensions.get('window');
const THRESHOLD = 1800;
const ADMIN_FEE = 100;
const PRESET_AMOUNTS = [300, 500, 1000, 1500, 2000, 3000, 5000];
const PRESET_MONTHS = [1, 2, 3, 6, 9, 12];

const SUB_F_TIERS = [
  { min: 0, max: 270, rate: 20, label: '$0 – $270', period: 'mensual' },
  { min: 270, max: 1800, rate: 15, label: '$270.01 – $1,800', period: 'mensual' },
];
const SUB_E_TIERS = [
  { min: 0, max: 500, rate: 30, label: '$0 – $500', period: 'APR' },
  { min: 500, max: 1050, rate: 24, label: '$500.01 – $1,050', period: 'APR' },
  { min: 1050, max: 99999, rate: 18, label: '$1,050.01+', period: 'APR' },
];

function calculateSubF(principal: number, months: number) {
  const monthlyRate = principal <= 270 ? 0.20 : 0.15;
  const monthlyInterest = principal * monthlyRate;
  const totalInterest = monthlyInterest * months;
  const adminFee = Math.min(100, principal * 0.25);
  const totalToPay = principal + totalInterest + adminFee;
  const monthly = months > 0 ? totalToPay / months : totalToPay;
  return {
    subchapter: 'F' as const, principal, monthlyRate,
    totalInterest: Math.round(totalInterest * 100) / 100,
    adminFee: Math.round(adminFee * 100) / 100,
    totalToPay: Math.round(totalToPay * 100) / 100,
    monthly: Math.round(monthly * 100) / 100, months,
  };
}

function calculateSubE(principal: number, months: number) {
  const years = months / 12;
  let totalInterest = 0;
  const t1 = Math.min(principal, 500);
  if (t1 > 0) totalInterest += t1 * 0.30 * years;
  if (principal > 500) totalInterest += Math.min(principal - 500, 550) * 0.24 * years;
  if (principal > 1050) totalInterest += (principal - 1050) * 0.18 * years;
  totalInterest = Math.round(totalInterest * 100) / 100;
  const adminFee = ADMIN_FEE;
  const totalToPay = principal + totalInterest + adminFee;
  const monthly = months > 0 ? Math.round((totalToPay / months) * 100) / 100 : totalToPay;
  return {
    subchapter: 'E' as const, principal, totalInterest, adminFee,
    totalToPay: Math.round(totalToPay * 100) / 100, monthly, months,
  };
}

function calculateHybrid(principal: number, months: number) {
  return principal <= THRESHOLD ? calculateSubF(principal, months) : calculateSubE(principal, months);
}

function fmt(n: number) { return `$${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`; }

export default function CalculatorScreen() {
  const { t } = useTranslation();
  const [amount, setAmount] = useState('1000');
  const [months, setMonths] = useState('3');
  const [result, setResult] = useState<any>(null);

  const calculate = useCallback(() => {
    const P = parseFloat(amount.replace(/[^0-9.]/g, '')) || 0;
    const n = parseInt(months) || 0;
    if (P < 100 || n < 1) { setResult(null); return; }
    setResult(calculateHybrid(P, n));
  }, [amount, months]);

  useEffect(() => { calculate(); }, [calculate]);

  return (
    <>
      <Stack.Screen options={{ title: t('calc.title', 'Calculator') }} />
      <SafeAreaView style={S.container} edges={['bottom']}>
        <ScrollView contentContainerStyle={S.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          <View style={S.section}>
            <Text style={S.label}>{t('calc.loanAmount', 'Loan Amount')}</Text>
            <View style={S.amountDisplay}>
              <Text style={S.amountPrefix}>$</Text>
              <TextInput style={S.amountInput} value={amount}
                onChangeText={(v) => setAmount(v.replace(/[^0-9]/g, ''))}
                placeholder="1,000" placeholderTextColor={Colors.textMuted}
                keyboardType="number-pad" onBlur={() => Keyboard.dismiss()} />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
              <View style={S.presetRow}>
                {PRESET_AMOUNTS.map(a => {
                  const isActive = amount === String(a);
                  return (
                    <TouchableOpacity key={a} style={[S.presetChip, isActive && S.presetChipActiveF]}
                      onPress={() => setAmount(String(a))}>
                      <Text style={[S.presetChipText, isActive && S.presetChipTextActiveF]}>
                        ${a >= 1000 ? `${(a/1000).toFixed(a % 1000 === 0 ? 0 : 1)}k` : a}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
            <Text style={S.rangeHint}>{t('calc.range', 'From $100 to $5,000')}</Text>
          </View>

          <View style={S.section}>
            <Text style={S.label}>{t('calc.term', 'Term')}</Text>
            <View style={S.monthsGrid}>
              {PRESET_MONTHS.map(m => {
                const isActive = months === String(m);
                return (
                  <TouchableOpacity key={m} style={[S.monthBtn, isActive && S.monthBtnActiveF]}
                    onPress={() => setMonths(String(m))}>
                    <Text style={[S.monthBtnNum, isActive && S.monthBtnNumActiveF]}>{m}</Text>
                    <Text style={[S.monthBtnLabel, isActive && S.monthBtnLabelActiveF]}>
                      {m === 1 ? t('calc.month', 'month') : t('calc.months', 'months')}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {result && (
            <LinearGradient colors={['#0a2e1f', '#0d3b26']} style={S.resultCard}>
              <View style={S.resultHero}>
                <Text style={S.resultHeroLabel}>{t('calc.estMonthly', 'Estimated Monthly Payment')}</Text>
                <Text style={[S.resultHeroAmount, { color: '#34D399' }]}>{fmt(result.monthly)}</Text>
                <Text style={S.resultHeroSub}>
                  {t('calc.forMonths', 'for {{n}} {{unit}}', { n: result.months, unit: result.months === 1 ? t('calc.month', 'month') : t('calc.months', 'months') })}
                </Text>
              </View>

              <View style={S.weeklyRow}>
                <Ionicons name="calendar-outline" size={14} color="rgba(255,255,255,0.5)" />
                <Text style={S.weeklyLabel}>{t('calc.estWeekly', 'Estimated weekly payment:')}</Text>
                <Text style={[S.weeklyAmount, { color: '#34D399' }]}>
                  {fmt(Math.round(result.monthly * 12 / 52 * 100) / 100)}
                </Text>
              </View>

              <View style={S.breakdown}>
                <View style={S.breakdownRow}>
                  <View style={S.breakdownLeft}>
                    <Ionicons name="cash-outline" size={16} color="#34D399" />
                    <Text style={S.breakdownLabel}>{t('calc.amountRequested', 'Amount requested')}</Text>
                  </View>
                  <Text style={S.breakdownValue}>{fmt(result.principal)}</Text>
                </View>
                <View style={S.breakdownRow}>
                  <View style={S.breakdownLeft}>
                    <Ionicons name="document-text-outline" size={16} color="#F59E0B" />
                    <Text style={S.breakdownLabel}>{t('calc.adminFee', 'Administrative fee')}</Text>
                  </View>
                  <Text style={[S.breakdownValue, { color: '#F59E0B' }]}>+{fmt(result.adminFee)}</Text>
                </View>
                <View style={S.breakdownRow}>
                  <View style={S.breakdownLeft}>
                    <Ionicons name="trending-up-outline" size={16} color="#EF4444" />
                    <Text style={S.breakdownLabel}>{t('calc.totalInterest', 'Total interest')}</Text>
                  </View>
                  <Text style={[S.breakdownValue, { color: '#EF4444' }]}>+{fmt(result.totalInterest)}</Text>
                </View>
                <View style={S.breakdownDivider} />
                <View style={S.breakdownRow}>
                  <View style={S.breakdownLeft}>
                    <Ionicons name="wallet-outline" size={16} color="#fff" />
                    <Text style={[S.breakdownLabel, { color: '#fff', fontWeight: '700' }]}>{t('calc.totalToPay', 'Total to pay')}</Text>
                  </View>
                  <Text style={[S.breakdownValue, { color: '#fff', fontSize: 18 }]}>{fmt(result.totalToPay)}</Text>
                </View>
              </View>

              <View style={[S.subBadge, { backgroundColor: 'rgba(5,150,105,0.1)', borderColor: 'rgba(5,150,105,0.2)' }]}>
                <Ionicons name="shield-checkmark-outline" size={14} color="#34D399" />
                <Text style={[S.subBadgeText, { color: '#34D399' }]}>{t('calc.regulated', 'Regulated Lender — Texas')}</Text>
              </View>
            </LinearGradient>
          )}

          <View style={S.infoBox}>
            <Ionicons name="information-circle-outline" size={16} color={Colors.primaryLight} />
            <Text style={S.infoText}>{t('calc.disclaimer', 'This is an estimate. The final amount may vary based on your approved application. Ross Lending Solutions is a regulated lender in the state of Texas.')}</Text>
          </View>

          <TouchableOpacity onPress={() => router.push('/(tabs)/apply')} activeOpacity={0.8}>
            <LinearGradient colors={Gradients.primary as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={S.ctaBtn}>
              <Text style={S.ctaBtnText}>{t('calc.applyLoan', 'Apply for Loan')}</Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
          <View style={{ height: 30 }} />
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const S = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  scroll: { padding: 20, paddingTop: 10, paddingBottom: 40 },
  section: { marginBottom: 24 },
  label: { fontSize: 14, fontWeight: '700', color: Colors.textSecondary, marginBottom: 10 },
  amountDisplay: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: 16, paddingHorizontal: 20, height: 64, borderWidth: 1, borderColor: Colors.border },
  amountPrefix: { fontSize: 28, fontWeight: '800', color: Colors.primaryLight, marginRight: 8 },
  amountInput: { flex: 1, fontSize: 32, fontWeight: '800', color: Colors.text },
  rangeHint: { fontSize: 11, color: Colors.textMuted, marginTop: 6, textAlign: 'center' },
  presetRow: { flexDirection: 'row', gap: 8, paddingRight: 20 },
  presetChip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, flexDirection: 'row', alignItems: 'center', gap: 4 },
  presetChipActiveF: { backgroundColor: 'rgba(5,150,105,0.15)', borderColor: '#059669' },
  presetChipText: { fontSize: 14, fontWeight: '700', color: Colors.textSecondary },
  presetChipTextActiveF: { color: '#059669' },
  monthsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  monthBtn: { width: (SW - 80) / 3, paddingVertical: 14, borderRadius: 14, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' },
  monthBtnActiveF: { backgroundColor: 'rgba(5,150,105,0.15)', borderColor: '#059669' },
  monthBtnNum: { fontSize: 20, fontWeight: '800', color: Colors.textSecondary },
  monthBtnNumActiveF: { color: '#059669' },
  monthBtnLabel: { fontSize: 10, color: Colors.textMuted, marginTop: 2 },
  monthBtnLabelActiveF: { color: '#059669' },
  resultCard: { borderRadius: 20, padding: 24, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(5,150,105,0.3)' },
  resultHero: { alignItems: 'center', marginBottom: 16 },
  resultHeroLabel: { fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  resultHeroAmount: { fontSize: 44, fontWeight: '800', marginTop: 4 },
  resultHeroSub: { fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 2 },
  weeklyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, marginBottom: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  weeklyLabel: { fontSize: 12, color: 'rgba(255,255,255,0.4)' },
  weeklyAmount: { fontSize: 16, fontWeight: '800' },
  breakdown: {},
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 },
  breakdownLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  breakdownLabel: { fontSize: 13, color: 'rgba(255,255,255,0.6)' },
  breakdownValue: { fontSize: 14, fontWeight: '700', color: 'rgba(255,255,255,0.8)' },
  breakdownDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 6 },
  subBadge: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 16, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  subBadgeText: { fontSize: 11, fontWeight: '600' },
  infoBox: { flexDirection: 'row', gap: 10, backgroundColor: 'rgba(5,150,105,0.06)', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: 'rgba(5,150,105,0.15)', marginBottom: 16 },
  infoText: { flex: 1, fontSize: 11, color: Colors.textSecondary, lineHeight: 16 },
  ctaBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 16, height: 54 },
  ctaBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});
