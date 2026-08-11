import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, Switch, RefreshControl, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { Spacing, FontSizes, BorderRadius, Shadows, useColors } from '../src/constants/theme';
import { apiCall } from '../src/utils/api';
import { useAuth } from '../src/contexts/AuthContext';
import StripeCardInput from '../src/components/StripeCardInput';

type PaymentMethod = {
  id: string;
  type: string;
  brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
  is_default: boolean;
};

type AutoPayConfig = {
  enabled: boolean;
  payment_method_id: string;
  day_of_month: number;
} | null;

const CARD_ICONS: Record<string, string> = {
  visa: '💳',
  mastercard: '💳',
  amex: '💳',
  discover: '💳',
};

const CARD_COLORS: Record<string, string[]> = {
  visa: ['#1A1F71', '#2D3494'],
  mastercard: ['#EB001B', '#F79E1B'],
  amex: ['#006FCF', '#0080FF'],
  discover: ['#FF6600', '#FF8833'],
  default: ['#333340', '#22222A'],
};

export default function PaymentMethodsScreen() {
  const C = useColors();
  const styles = React.useMemo(() => createStyles(C), [C]);
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();

  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [autopay, setAutopay] = useState<AutoPayConfig>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [addingCard, setAddingCard] = useState(false);
  const [showCardForm, setShowCardForm] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [togglingAutopay, setTogglingAutopay] = useState(false);
  const [selectedDay, setSelectedDay] = useState(1);

  const isTenant = user?.role === 'tenant';

  const fetchData = useCallback(async () => {
    try {
      const data = await apiCall('/tenant/payment-methods');
      setMethods(data.payment_methods || []);
      if (data.autopay) {
        setAutopay(data.autopay);
        setSelectedDay(data.autopay.day_of_month || 1);
      }
    } catch (err: any) {
      console.log('Error loading payment methods:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, []);

  const onRefresh = () => { setRefreshing(true); fetchData(); };

  const handleAddCard = async () => {
    setAddingCard(true);
    try {
      const data = await apiCall('/tenant/payment-methods/setup', { method: 'POST' });
      if (!data.success || !data.client_secret) {
        Alert.alert('Error', 'No se pudo iniciar la configuración de pago.');
        setAddingCard(false);
        return;
      }
      setClientSecret(data.client_secret);
      setShowCardForm(true);
      setAddingCard(false);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'No se pudo agregar la tarjeta.');
      setAddingCard(false);
    }
  };

  const handleRemoveCard = (pm: PaymentMethod) => {
    Alert.alert(
      t('payment_methods.remove_title'),
      `${t('payment_methods.remove_confirm')} •••• ${pm.last4}?`,
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await apiCall(`/tenant/payment-methods/${pm.id}`, { method: 'DELETE' });
              setMethods(prev => prev.filter(m => m.id !== pm.id));
              if (autopay?.payment_method_id === pm.id) {
                setAutopay({ enabled: false, payment_method_id: '', day_of_month: 1 });
              }
            } catch (err: any) {
              Alert.alert('Error', err.message);
            }
          },
        },
      ]
    );
  };

  const handleToggleAutopay = async (enabled: boolean) => {
    if (enabled && methods.length === 0) {
      Alert.alert(
        t('payment_methods.autopay'),
        t('payment_methods.need_card_first')
      );
      return;
    }

    setTogglingAutopay(true);
    try {
      const pmId = enabled ? methods[0]?.id || '' : '';
      await apiCall('/tenant/autopay/configure', {
        method: 'POST',
        body: {
          enabled,
          payment_method_id: pmId,
          day_of_month: selectedDay,
        },
      });
      setAutopay({
        enabled,
        payment_method_id: pmId,
        day_of_month: selectedDay,
      });
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setTogglingAutopay(false);
    }
  };

  const renderCardItem = (pm: PaymentMethod) => {
    const colors = CARD_COLORS[pm.brand.toLowerCase()] || CARD_COLORS.default;
    const isAutopayCard = autopay?.payment_method_id === pm.id;

    return (
      <View key={pm.id} style={styles.cardContainer}>
        <LinearGradient
          colors={colors as any}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.cardGradient}
        >
          <View style={styles.cardTop}>
            <Text style={styles.cardBrand}>{pm.brand.toUpperCase()}</Text>
            {isAutopayCard && (
              <View style={styles.autopayBadge}>
                <Ionicons name="repeat" size={10} color={C.white} />
                <Text style={styles.autopayBadgeText}>AUTOPAGO</Text>
              </View>
            )}
          </View>

          <Text style={styles.cardNumber}>•••• •••• •••• {pm.last4}</Text>

          <View style={styles.cardBottom}>
            <View>
              <Text style={styles.cardExpLabel}>{t('payment_methods.expires')}</Text>
              <Text style={styles.cardExpValue}>
                {String(pm.exp_month).padStart(2, '0')}/{String(pm.exp_year).slice(-2)}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.removeBtn}
              onPress={() => handleRemoveCard(pm)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="trash-outline" size={18} color="rgba(255,255,255,0.7)" />
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={C.brandRed} />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top }]}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.brandRed} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={C.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>{t('payment_methods.title')}</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Cards */}
      <Text style={styles.sectionTitle}>{t('payment_methods.saved_cards')}</Text>

      {methods.length === 0 ? (
        <View style={styles.emptyCard}>
          <View style={styles.emptyIconContainer}>
            <Ionicons name="card-outline" size={48} color={C.textMuted} />
          </View>
          <Text style={styles.emptyTitle}>{t('payment_methods.no_cards')}</Text>
          <Text style={styles.emptyDesc}>{t('payment_methods.no_cards_desc')}</Text>
        </View>
      ) : (
        methods.map(renderCardItem)
      )}

      {/* Add Card Button */}
      <TouchableOpacity
        style={styles.addCardButton}
        onPress={handleAddCard}
        disabled={addingCard}
        activeOpacity={0.7}
      >
        <LinearGradient
          colors={['rgba(200,16,46,0.15)', 'rgba(200,16,46,0.05)']}
          style={styles.addCardGradient}
        >
          {addingCard && !showCardForm ? (
            <ActivityIndicator size="small" color={C.brandRed} />
          ) : (
            <>
              <Ionicons name="add-circle-outline" size={22} color={C.brandRed} />
              <Text style={styles.addCardText}>{t('payment_methods.add_card')}</Text>
            </>
          )}
        </LinearGradient>
      </TouchableOpacity>

      {/* Add Bank Account (ACH) Button */}
      <TouchableOpacity
        style={[styles.addCardButton, { marginTop: Spacing.sm }]}
        onPress={() => router.push('/add-bank-account')}
        activeOpacity={0.7}
      >
        <LinearGradient
          colors={['rgba(59,130,246,0.15)', 'rgba(59,130,246,0.05)']}
          style={styles.addCardGradient}
        >
          <Ionicons name="business-outline" size={22} color="#3B82F6" />
          <Text style={[styles.addCardText, { color: '#3B82F6' }]}>Agregar Banco (ACH)</Text>
        </LinearGradient>
      </TouchableOpacity>

      {/* Stripe Card Input Form */}
      {showCardForm && clientSecret && (
        <StripeCardInput
          clientSecret={clientSecret}
          onSuccess={() => {
            setShowCardForm(false);
            setClientSecret(null);
            Alert.alert('¡Tarjeta Agregada!', 'Tu método de pago ha sido guardado exitosamente.');
            fetchData();
          }}
          onCancel={() => {
            setShowCardForm(false);
            setClientSecret(null);
          }}
        />
      )}

      {/* Auto-Pay Section (Tenant only) */}
      {isTenant && (
        <>
          <Text style={[styles.sectionTitle, { marginTop: Spacing['2xl'] }]}>
            {t('payment_methods.autopay')}
          </Text>

          <View style={styles.autopayCard}>
            <View style={styles.autopayRow}>
              <View style={styles.autopayInfo}>
                <View style={styles.autopayIconWrap}>
                  <Ionicons name="repeat" size={20} color={C.brandRed} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.autopayTitle}>{t('payment_methods.autopay_rent')}</Text>
                  <Text style={styles.autopayDesc}>{t('payment_methods.autopay_desc')}</Text>
                </View>
              </View>
              <Switch
                value={autopay?.enabled || false}
                onValueChange={handleToggleAutopay}
                trackColor={{ false: '#333', true: 'rgba(200,16,46,0.4)' }}
                thumbColor={autopay?.enabled ? C.brandRed : '#666'}
                disabled={togglingAutopay}
              />
            </View>

            {autopay?.enabled && (
              <View style={styles.autopayDetails}>
                <View style={styles.divider} />
                <View style={styles.autopayDetailRow}>
                  <Ionicons name="calendar-outline" size={16} color={C.textSecondary} />
                  <Text style={styles.autopayDetailText}>
                    {t('payment_methods.pay_day')}: {t('payment_methods.day')} {autopay.day_of_month}
                  </Text>
                </View>
                {methods.length > 0 && (
                  <View style={styles.autopayDetailRow}>
                    <Ionicons name="card-outline" size={16} color={C.textSecondary} />
                    <Text style={styles.autopayDetailText}>
                      {t('payment_methods.using_card')}: •••• {methods.find(m => m.id === autopay.payment_method_id)?.last4 || methods[0]?.last4 || '----'}
                    </Text>
                  </View>
                )}
                <View style={styles.autopayDetailRow}>
                  <Ionicons name="checkmark-circle" size={16} color={C.success} />
                  <Text style={[styles.autopayDetailText, { color: C.success }]}>
                    {t('payment_methods.autopay_active')}
                  </Text>
                </View>
              </View>
            )}
          </View>

          <View style={styles.infoBox}>
            <Ionicons name="information-circle-outline" size={18} color={C.info} />
            <Text style={styles.infoText}>{t('payment_methods.autopay_info')}</Text>
          </View>
        </>
      )}

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const createStyles = (C: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  content: { paddingHorizontal: Spacing.base, paddingBottom: 40 },
  loadingContainer: { flex: 1, backgroundColor: C.background, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: Spacing.md,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  title: { fontSize: FontSizes['2xl'], fontWeight: '800', color: C.textPrimary, letterSpacing: -0.5 },
  sectionTitle: {
    fontSize: FontSizes.xs, color: C.textMuted, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: Spacing.sm, marginTop: Spacing.base,
  },

  // Card Styles
  cardContainer: { marginBottom: Spacing.md, borderRadius: BorderRadius.card, overflow: 'hidden', ...Shadows.card },
  cardGradient: { padding: Spacing.lg, borderRadius: BorderRadius.card, minHeight: 180 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardBrand: { color: C.textSecondary, fontSize: FontSizes.sm, fontWeight: '700', letterSpacing: 1 },
  autopayBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,0,0,0.3)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10,
  },
  autopayBadgeText: { color: C.white, fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },
  cardNumber: { color: C.white, fontSize: FontSizes.xl, fontWeight: '600', marginTop: 30, letterSpacing: 3 },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 20 },
  cardExpLabel: { color: C.textMuted, fontSize: 9, textTransform: 'uppercase', letterSpacing: 1 },
  cardExpValue: { color: C.white, fontSize: FontSizes.base, fontWeight: '600', marginTop: 2 },
  removeBtn: { padding: 8, borderRadius: BorderRadius.full, backgroundColor: 'rgba(0,0,0,0.2)' },

  // Empty
  emptyCard: {
    backgroundColor: C.glass, borderRadius: BorderRadius.card,
    borderWidth: 1, borderColor: C.glassBorder, borderStyle: 'dashed',
    padding: Spacing['2xl'], alignItems: 'center',
  },
  emptyIconContainer: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: C.glass,
    justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.base,
  },
  emptyTitle: { fontSize: FontSizes.md, fontWeight: '600', color: C.textSecondary, marginBottom: 6 },
  emptyDesc: { fontSize: FontSizes.sm, color: C.textMuted, textAlign: 'center', lineHeight: 20 },

  // Add Card
  addCardButton: { marginTop: Spacing.md, borderRadius: BorderRadius.card, overflow: 'hidden' },
  addCardGradient: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    paddingVertical: 16, borderRadius: BorderRadius.card,
    borderWidth: 1, borderColor: 'rgba(200,16,46,0.2)',
  },
  addCardText: { fontSize: FontSizes.base, fontWeight: '600', color: C.brandRed },

  // Auto-Pay
  autopayCard: {
    backgroundColor: C.glass, borderRadius: BorderRadius.card,
    borderWidth: 1, borderColor: C.glassBorder, padding: Spacing.base,
  },
  autopayRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  autopayInfo: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, marginRight: 12 },
  autopayIconWrap: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(200,16,46,0.10)',
    justifyContent: 'center', alignItems: 'center',
  },
  autopayTitle: { fontSize: FontSizes.base, fontWeight: '600', color: C.textPrimary },
  autopayDesc: { fontSize: FontSizes.xs, color: C.textMuted, marginTop: 2 },
  autopayDetails: { marginTop: Spacing.sm },
  divider: { height: 1, backgroundColor: C.glassLight, marginVertical: Spacing.sm },
  autopayDetailRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  autopayDetailText: { fontSize: FontSizes.sm, color: C.textSecondary },

  // Info box
  infoBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: Spacing.md,
    backgroundColor: 'rgba(59,130,246,0.06)', borderRadius: BorderRadius.card,
    padding: Spacing.md, borderWidth: 1, borderColor: 'rgba(59,130,246,0.1)',
  },
  infoText: { flex: 1, fontSize: FontSizes.xs, color: C.textSecondary, lineHeight: 18 },

  // Stripe Card Form
  stripeFormCard: {
    marginTop: Spacing.md,
    backgroundColor: C.glass,
    borderRadius: BorderRadius.card,
    borderWidth: 1,
    borderColor: 'rgba(200,16,46,0.15)',
    padding: Spacing.base,
  },
  stripeFormHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  stripeFormTitle: {
    fontSize: FontSizes.base,
    fontWeight: '700',
    color: C.textPrimary,
  },
  stripeCardField: {
    width: '100%',
    height: 50,
    marginVertical: Spacing.sm,
  },
  stripeFormActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: Spacing.md,
  },
  stripeFormCancel: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: C.glassLight,
    borderWidth: 1,
    borderColor: C.glassBorder,
  },
  stripeFormCancelText: {
    color: C.textMuted,
    fontWeight: '600',
    fontSize: FontSizes.base,
  },
  stripeFormConfirm: {
    flex: 2,
    height: 48,
    borderRadius: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    overflow: 'hidden',
  },
  stripeFormConfirmText: {
    color: C.textPrimary,
    fontWeight: '700',
    fontSize: FontSizes.base,
  },
  stripeSecureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: Spacing.md,
  },
  stripeSecureText: {
    fontSize: 10,
    color: C.textDim,
    fontWeight: '500',
  },
});
