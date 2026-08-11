import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { apiCall } from '../../src/utils/api';
import { useStripeSheet } from '../../src/components/useStripeSheet';

import { Card } from '../../src/components/ui/Card';
import { Button } from '../../src/components/ui/Button';
import { Badge } from '../../src/components/ui/Badge';
import { Spacing, FontSizes, BorderRadius, useColors } from '../../src/constants/theme';
import { formatCurrency } from '../../src/utils/formatters';

export default function PayRentScreen() {
  const C = useColors();
  const styles = React.useMemo(() => createStyles(C), [C]);
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const lang = i18n.language;
  const { available: stripeAvailable, initPaymentSheet, presentPaymentSheet } = useStripeSheet();

  const [loading, setLoading] = useState(true);
  const [contract, setContract] = useState<any>(null);
  const [pendingPayment, setPendingPayment] = useState<any>(null);
  const [paymentConfig, setPaymentConfig] = useState<any>(null);
  const [stripeLoading, setStripeLoading] = useState(false);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [dash, config] = await Promise.all([
        apiCall('/tenant/dashboard').catch(() => null),
        apiCall('/tenant/payment-config').catch(() => null),
      ]);
      if (dash?.contract) setContract(dash.contract);
      // Prefer the latest pending payment (it has the real amount + late fees)
      if (dash?.payments && Array.isArray(dash.payments)) {
        const pending = dash.payments.find((p: any) =>
          (p.status || '').toLowerCase() === 'pending' ||
          (p.status || '').toLowerCase() === 'late' ||
          (p.status || '').toLowerCase() === 'partial'
        );
        if (pending) setPendingPayment(pending);
      }
      if (config) setPaymentConfig(config);
    } catch (err) {
      console.log('Pay data fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStripePayment = async () => {
    setStripeLoading(true);
    try {
      // 1) Preguntar al servidor qué procesador está ACTIVO (stripe/square/clover)
      const checkout = await apiCall('/tenant/create-checkout-payment', {
        method: 'POST',
        body: { late_fee: lateFee },
      });

      // 2) Square / Clover → Hosted Checkout en el navegador (sin rebuild)
      if (checkout.processor && checkout.processor !== 'stripe') {
        if (!checkout.url) throw new Error(lang === 'es' ? 'No se pudo iniciar el checkout' : 'Could not start checkout');
        await WebBrowser.openBrowserAsync(checkout.url);
        // Al volver del navegador, verificar el estado del pago
        let completed = false;
        for (let i = 0; i < 6; i++) {
          const st = await apiCall(`/tenant/checkout-payment-status/${checkout.payment_id}`).catch(() => null);
          if (st?.completed) { completed = true; break; }
          await new Promise(res => setTimeout(res, 2500));
        }
        if (completed) {
          Alert.alert(
            lang === 'es' ? '✅ Pago exitoso' : '✅ Payment successful',
            lang === 'es'
              ? `Tu pago de renta de ${formatCurrency(checkout.amount)} fue procesado.`
              : `Your rent payment of ${formatCurrency(checkout.amount)} was processed.`
          );
          fetchData();
        } else {
          Alert.alert(
            lang === 'es' ? 'Pago en proceso' : 'Payment processing',
            lang === 'es'
              ? 'Si completaste el pago, se reflejará en unos minutos. Si lo cancelaste, puedes intentar de nuevo.'
              : 'If you completed the payment it will be reflected in a few minutes. If you canceled, you can try again.'
          );
        }
        return;
      }

      // 3) Stripe (procesador activo) → flujo nativo existente
      const result = await apiCall('/tenant/create-stripe-payment', {
        method: 'POST',
        body: {
          amount: rentAmount,
          payment_id: pendingPayment?.id,
          rent_amount: Number(pendingPayment?.amount || contract?.rent_amount || 0),
          late_fee: lateFee,
          period_month: pendingPayment?.period_month,
          period_year: pendingPayment?.period_year,
        },
      });
      if (!result.success || !result.client_secret) {
        throw new Error(result.detail || (lang === 'es' ? 'No se pudo iniciar el pago' : 'Could not start payment'));
      }
      if (!stripeAvailable) {
        Alert.alert(
          lang === 'es' ? 'Pago con tarjeta' : 'Card payment',
          lang === 'es'
            ? 'El pago con tarjeta está disponible en la app móvil (iOS/Android).'
            : 'Card payment is available in the mobile app (iOS/Android).'
        );
        return;
      }
      const init = await initPaymentSheet({
        paymentIntentClientSecret: result.client_secret,
        merchantDisplayName: 'Ross House Rentals LLC',
        customerId: result.customer_id || undefined,
        customerEphemeralKeySecret: result.ephemeral_key || undefined,
        allowsDelayedPaymentMethods: false,
        returnURL: 'rosslending://stripe-redirect',
        defaultBillingDetails: {
          name: contract?.tenant_name || '',
          email: pendingPayment?.tenant_email || contract?.tenant_email || '',
        },
      });
      if (init.error) throw new Error(init.error.message);
      const present = await presentPaymentSheet();
      if (present.error) {
        if (present.error.code !== 'Canceled') throw new Error(present.error.message);
        return;
      }
      const confirm = await apiCall('/tenant/confirm-stripe-payment', {
        method: 'POST',
        body: { payment_intent_id: result.payment_intent_id },
      });
      if (confirm.success) {
        Alert.alert(
          lang === 'es' ? '✅ Pago exitoso' : '✅ Payment successful',
          lang === 'es'
            ? `Tu pago de renta de ${formatCurrency(result.amount)} fue procesado.`
            : `Your rent payment of ${formatCurrency(result.amount)} was processed.`
        );
        fetchData();
      }
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setStripeLoading(false);
    }
  };

  const methods = paymentConfig?.payment_methods || {};
  // Prefer the pending payment's total (rent + late fee). Fallback to contract.
  const pendingTotal = pendingPayment
    ? (Number(pendingPayment.amount || 0) + Number(pendingPayment.late_fee || 0))
    : 0;
  const rentAmount = pendingTotal > 0 ? pendingTotal : (contract?.rent_amount || contract?.monthly_rent || 0);
  const lateFee = Number(pendingPayment?.late_fee || 0);

  if (loading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={C.brandRed} />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top }]}
      contentContainerStyle={styles.content}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={C.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>{t('pay.title')}</Text>
      </View>

      {/* Amount Card */}
      <Card accentColor={C.brandRed} style={styles.amountCard}>
        <Text style={styles.amountLabel}>{t('pay.amount_due')}</Text>
        <Text style={styles.amount}>{formatCurrency(rentAmount)}</Text>
        {lateFee > 0 && (
          <View style={{ marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="alert-circle" size={14} color="#F59E0B" />
            <Text style={{ color: '#F59E0B', fontSize: 12, fontWeight: '600' }}>
              {lang === 'es'
                ? `Incluye recargo por mora: ${formatCurrency(lateFee)}`
                : `Includes late fee: ${formatCurrency(lateFee)}`}
            </Text>
          </View>
        )}
        {pendingPayment?.period_month && pendingPayment?.period_year && (
          <Text style={{ color: C.textMuted, fontSize: 11, marginTop: 4 }}>
            {lang === 'es' ? 'Período: ' : 'Period: '}{pendingPayment.period_month} {pendingPayment.period_year}
          </Text>
        )}
        {contract?.property_address && (
          <View style={styles.addressRow}>
            <Ionicons name="location-outline" size={14} color={C.textMuted} />
            <Text style={styles.addressText}>{contract.property_address}</Text>
          </View>
        )}
      </Card>

      {/* Payment Methods */}
      <Text style={styles.sectionHeader}>{t('pay.select_method')}</Text>

      {/* Stripe - Card Payment */}
      {paymentConfig?.stripe_enabled && (
        <TouchableOpacity style={styles.methodCard} activeOpacity={0.8} onPress={handleStripePayment}>
          <View style={[styles.methodAccent, { backgroundColor: '#635BFF' }]} />
          <View style={[styles.methodOrb, { backgroundColor: '#635BFF', opacity: 0.1 }]} />
          <View style={styles.methodContent}>
            <View style={[styles.methodIcon, { backgroundColor: 'rgba(99,91,255,0.12)' }]}>
              <Ionicons name="card" size={24} color="#635BFF" />
            </View>
            <View style={styles.methodInfo}>
              <Text style={styles.methodTitle}>{t('pay.credit_card')}</Text>
              <Text style={styles.methodDesc}>Visa, Mastercard, Amex</Text>
            </View>
            {stripeLoading ? (
              <ActivityIndicator size="small" color="#635BFF" />
            ) : (
              <View style={styles.methodArrow}>
                <Ionicons name="chevron-forward" size={20} color={C.textMuted} />
              </View>
            )}
          </View>
        </TouchableOpacity>
      )}

      {/* Zelle */}
      {methods.zelle?.enabled && (
        <TouchableOpacity style={styles.methodCard} activeOpacity={0.8} onPress={() => {
          Alert.alert(
            'Zelle',
            `${t('pay.send_to')}:\n\n${methods.zelle.name || 'Ross House Rentals'}\n${methods.zelle.email || ''}\n${methods.zelle.phone || ''}\n\n${t('pay.include_name')}`,
            [
              { text: t('common.cancel'), style: 'cancel' },
              { text: t('pay.open_bank'), onPress: () => {} },
            ]
          );
        }}>
          <View style={[styles.methodAccent, { backgroundColor: '#6D1ED4' }]} />
          <View style={[styles.methodOrb, { backgroundColor: '#6D1ED4', opacity: 0.1 }]} />
          <View style={styles.methodContent}>
            <View style={[styles.methodIcon, { backgroundColor: 'rgba(109,30,212,0.12)' }]}>
              <Ionicons name="flash" size={24} color="#6D1ED4" />
            </View>
            <View style={styles.methodInfo}>
              <Text style={styles.methodTitle}>Zelle</Text>
              <Text style={styles.methodDesc}>{methods.zelle.email || methods.zelle.phone || ''}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={C.textMuted} />
          </View>
        </TouchableOpacity>
      )}

      {/* CashApp */}
      {methods.cashapp?.enabled && (
        <TouchableOpacity style={styles.methodCard} activeOpacity={0.8} onPress={() => {
          Alert.alert('CashApp', `${t('pay.send_to')}:\n${methods.cashapp.tag || '$RossHouseRentals'}`);
        }}>
          <View style={[styles.methodAccent, { backgroundColor: '#00C244' }]} />
          <View style={[styles.methodOrb, { backgroundColor: '#00C244', opacity: 0.1 }]} />
          <View style={styles.methodContent}>
            <View style={[styles.methodIcon, { backgroundColor: 'rgba(0,194,68,0.12)' }]}>
              <Ionicons name="logo-usd" size={24} color="#00C244" />
            </View>
            <View style={styles.methodInfo}>
              <Text style={styles.methodTitle}>CashApp</Text>
              <Text style={styles.methodDesc}>{methods.cashapp.tag || ''}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={C.textMuted} />
          </View>
        </TouchableOpacity>
      )}

      {/* Money Order */}
      {methods.money_order?.enabled && (
        <TouchableOpacity style={styles.methodCard} activeOpacity={0.8} onPress={() => {
          Alert.alert(
            lang === 'es' ? 'Money Order / Efectivo' : 'Money Order / Cash',
            `${t('pay.payable_to')}:\n${methods.money_order.payable_to || 'Ross House Rentals LLC'}\n\n${t('pay.deliver_to')}:\n${methods.money_order.address || ''}`,
          );
        }}>
          <View style={[styles.methodAccent, { backgroundColor: C.warmGold }]} />
          <View style={[styles.methodOrb, { backgroundColor: C.warmGold, opacity: 0.1 }]} />
          <View style={styles.methodContent}>
            <View style={[styles.methodIcon, { backgroundColor: 'rgba(245,166,35,0.12)' }]}>
              <Ionicons name="cash" size={24} color={C.warmGold} />
            </View>
            <View style={styles.methodInfo}>
              <Text style={styles.methodTitle}>Money Order / {lang === 'es' ? 'Efectivo' : 'Cash'}</Text>
              <Text style={styles.methodDesc}>{methods.money_order.address || ''}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={C.textMuted} />
          </View>
        </TouchableOpacity>
      )}

      {/* Bank Transfer */}
      {methods.bank_transfer?.enabled && (
        <TouchableOpacity style={styles.methodCard} activeOpacity={0.8} onPress={() => {
          Alert.alert(
            lang === 'es' ? 'Transferencia Bancaria' : 'Bank Transfer',
            `${methods.bank_transfer.bank_name || ''}\n${methods.bank_transfer.account_name || ''}`,
          );
        }}>
          <View style={[styles.methodAccent, { backgroundColor: C.info }]} />
          <View style={[styles.methodOrb, { backgroundColor: C.info, opacity: 0.1 }]} />
          <View style={styles.methodContent}>
            <View style={[styles.methodIcon, { backgroundColor: 'rgba(59,130,246,0.12)' }]}>
              <Ionicons name="business" size={24} color={C.info} />
            </View>
            <View style={styles.methodInfo}>
              <Text style={styles.methodTitle}>{lang === 'es' ? 'Transferencia Bancaria' : 'Bank Transfer'}</Text>
              <Text style={styles.methodDesc}>{methods.bank_transfer.bank_name || ''}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={C.textMuted} />
          </View>
        </TouchableOpacity>
      )}

      {/* No payment methods configured */}
      {!paymentConfig?.stripe_enabled && !methods.zelle?.enabled && !methods.cashapp?.enabled && !methods.money_order?.enabled && (
        <View style={styles.emptyContainer}>
          <Ionicons name="wallet-outline" size={48} color={C.textMuted} />
          <Text style={styles.emptyTitle}>{t('pay.no_methods')}</Text>
          <Text style={styles.emptyDesc}>{t('pay.no_methods_desc')}</Text>
        </View>
      )}

      {/* Note */}
      <View style={styles.noteCard}>
        <Ionicons name="information-circle" size={18} color={C.info} />
        <Text style={styles.noteText}>{t('pay.note')}</Text>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const createStyles = (C: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  content: { paddingHorizontal: Spacing.base },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.background },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: Spacing.md,
  },
  backBtn: { width: 44, height: 44, justifyContent: 'center' },
  title: { fontSize: FontSizes['2xl'], fontWeight: '800', color: C.textPrimary, letterSpacing: -0.5 },
  amountCard: { marginBottom: Spacing.lg },
  amountLabel: {
    fontSize: FontSizes.xs, color: C.textMuted, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 1.2,
  },
  amount: { fontSize: 40, fontWeight: '800', color: C.brandRed, marginTop: 4, letterSpacing: -1 },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  addressText: { fontSize: FontSizes.sm, color: C.textMuted },
  sectionHeader: {
    fontSize: FontSizes.xs, color: C.textMuted, fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 1,
    marginBottom: Spacing.md,
  },
  methodCard: {
    backgroundColor: C.surface, borderRadius: BorderRadius.card,
    marginBottom: Spacing.sm, overflow: 'hidden',
    borderWidth: 1, borderColor: C.border, position: 'relative',
  },
  methodAccent: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 3,
    borderTopLeftRadius: BorderRadius.card, borderTopRightRadius: BorderRadius.card,
  },
  methodOrb: {
    position: 'absolute', top: -20, right: -20,
    width: 72, height: 72, borderRadius: 36,
  },
  methodContent: {
    flexDirection: 'row', alignItems: 'center',
    padding: Spacing.base, gap: 14,
  },
  methodIcon: {
    width: 48, height: 48, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
  },
  methodInfo: { flex: 1 },
  methodTitle: { fontSize: FontSizes.base, fontWeight: '600', color: C.textPrimary },
  methodDesc: { fontSize: FontSizes.xs, color: C.textMuted, marginTop: 1 },
  methodArrow: {},
  emptyContainer: { alignItems: 'center', paddingVertical: 40 },
  emptyTitle: { fontSize: FontSizes.md, color: C.textPrimary, fontWeight: '600', marginTop: 12 },
  emptyDesc: { fontSize: FontSizes.sm, color: C.textMuted, marginTop: 4, textAlign: 'center' },
  noteCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: 'rgba(59,130,246,0.08)', borderRadius: BorderRadius.md,
    padding: Spacing.md, marginTop: Spacing.lg,
    borderWidth: 1, borderColor: 'rgba(59,130,246,0.15)',
  },
  noteText: { fontSize: FontSizes.xs, color: C.info, flex: 1, lineHeight: 16 },
});
