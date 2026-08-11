import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, TextInput, Platform,
  KeyboardAvoidingView, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { Colors, API_URL } from '../../src/constants/theme';
import { CardField, useStripe, useConfirmSetupIntent } from '../../src/components/StripeComponents';
import { useTranslation } from 'react-i18next';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const fmt = (n: number) => `$${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;

type DisbursementMethod = 'cash' | 'zelle' | 'ach' | 'visa_direct';

interface MethodInfo {
  label: string;
  fee: number;
  speed: string;
  icon: string;
}

const METHOD_ICONS: Record<DisbursementMethod, string> = {
  cash: 'cash-outline',
  zelle: 'phone-portrait-outline',
  ach: 'business-outline',
  visa_direct: 'flash-outline',
};

export default function DisbursementScreen() {
  const { user, token } = useAuth();
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ loanId: string; amount: string; loanNumber: string }>();
  const { createToken } = useStripe();
  const { confirmSetupIntent } = useConfirmSetupIntent();

  const [methods, setMethods] = useState<Record<DisbursementMethod, MethodInfo>>({} as any);
  const [selected, setSelected] = useState<DisbursementMethod>('ach');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [cardComplete, setCardComplete] = useState(false);
  const [stripeAccountStatus, setStripeAccountStatus] = useState<any>(null);

  // Form data
  const [bankName, setBankName] = useState('');
  const [routingNumber, setRoutingNumber] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountType, setAccountType] = useState<'checking' | 'savings'>('checking');
  const [zelleEmail, setZelleEmail] = useState(user?.email || '');
  const [zellePhone, setZellePhone] = useState('');

  const loanAmount = parseFloat(params.amount || '0');
  const fee = methods[selected]?.fee || 0;
  const netAmount = loanAmount - fee;

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };

  useEffect(() => {
    fetchMethods();
    checkStripeAccount();
  }, []);

  const fetchMethods = async () => {
    try {
      const res = await fetch(`${API_URL}/disbursement/methods`, { headers });
      if (res.ok) {
        const data = await res.json();
        setMethods(data.methods || {});
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const checkStripeAccount = async () => {
    try {
      const res = await fetch(`${API_URL}/stripe/account-status`, { headers });
      if (res.ok) {
        const data = await res.json();
        setStripeAccountStatus(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSubmit = async () => {
    if (!params.loanId) return;
    setSubmitting(true);

    try {
      let body: any = { disbursement_method: selected };

      if (selected === 'ach') {
        if (!routingNumber || !accountNumber) {
          Alert.alert(t('common.error', 'Error'), t('disbursement.enterRouting', 'Enter routing and account number'));
          setSubmitting(false);
          return;
        }
        body = {
          ...body,
          routing_number: routingNumber,
          account_number: accountNumber,
          account_type: accountType,
          bank_name: bankName,
        };
      } else if (selected === 'visa_direct') {
        // First create connected account + tokenize card
        try {
          const tokenResult = await createToken({ type: 'Card' });
          if (tokenResult.error) {
            Alert.alert('Error', tokenResult.error.message || 'Error al procesar tarjeta');
            setSubmitting(false);
            return;
          }
          if (!tokenResult.token) {
            Alert.alert('Error', 'No se pudo tokenizar la tarjeta');
            setSubmitting(false);
            return;
          }

          // Create connected account if needed
          const acctRes = await fetch(`${API_URL}/stripe/create-connected-account`, {
            method: 'POST', headers,
            body: JSON.stringify({ email: user?.email, name: user?.name || user?.email }),
          });
          const acctData = await acctRes.json();
          if (!acctRes.ok) {
            Alert.alert(t('common.error', 'Error'), acctData.detail || t('disbursement.errorCreatingAccount', 'Error creating account'));
            setSubmitting(false);
            return;
          }

          // Add debit card
          const cardRes = await fetch(`${API_URL}/stripe/add-debit-card`, {
            method: 'POST', headers,
            body: JSON.stringify({ email: user?.email, card_token: tokenResult.token.id }),
          });
          const cardData = await cardRes.json();
          if (!cardRes.ok) {
            Alert.alert('Error', cardData.detail || 'Error al agregar tarjeta');
            setSubmitting(false);
            return;
          }

          body = {
            ...body,
            card_last4: cardData.card_last4 || tokenResult.token.card?.last4 || '',
            card_brand: cardData.card_brand || tokenResult.token.card?.brand || '',
            card_token: tokenResult.token.id,
            plaid_verified: false,
          };
        } catch (cardError: any) {
          Alert.alert('Error', cardError.message || 'Error al procesar tarjeta');
          setSubmitting(false);
          return;
        }
      } else if (selected === 'zelle') {
        if (!zelleEmail && !zellePhone) {
          Alert.alert(t('common.error', 'Error'), t('disbursement.enterZelle', 'Enter your Zelle email or phone'));
          setSubmitting(false);
          return;
        }
        body = {
          ...body,
          zelle_email: zelleEmail,
          zelle_phone: zellePhone,
        };
      }

      // Submit disbursement selection
      const res = await fetch(`${API_URL}/my-loans/${params.loanId}/select-disbursement`, {
        method: 'POST', headers,
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        Alert.alert(
          '✅ ¡Listo!',
          data.message || t('disbursement.methodSelected', 'Disbursement method selected successfully.'),
          [{ text: 'OK', onPress: () => router.back() }]
        );
      } else {
        Alert.alert(t('common.error', 'Error'), data.detail || t('disbursement.couldNotProcess', 'Could not process request'));
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || t('common.connectionError', 'Connection error'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={24} color={Colors.text} />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>Recibir Dinero</Text>
              <Text style={styles.headerSubtitle}>Préstamo #{params.loanNumber}</Text>
            </View>
          </View>

          {/* Amount Card */}
          <LinearGradient
            colors={['#1a56db', '#3b82f6']}
            style={styles.amountCard}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Text style={styles.amountLabel}>Monto Aprobado</Text>
            <Text style={styles.amountValue}>{fmt(loanAmount)}</Text>
            {fee > 0 && (
              <View style={styles.feeRow}>
                <Text style={styles.feeText}>Fee depósito instantáneo: -{fmt(fee)}</Text>
                <Text style={styles.netText}>Recibirás: {fmt(netAmount)}</Text>
              </View>
            )}
          </LinearGradient>

          {/* Method Cards */}
          <Text style={styles.sectionTitle}>Selecciona método de depósito</Text>
          <View style={styles.methodsGrid}>
            {(Object.entries(methods) as [DisbursementMethod, MethodInfo][]).map(([key, method]) => (
              <TouchableOpacity
                key={key}
                style={[styles.methodCard, selected === key && styles.methodCardActive]}
                onPress={() => setSelected(key)}
                activeOpacity={0.7}
              >
                <View style={styles.methodHeader}>
                  <View style={[styles.methodIcon, selected === key && styles.methodIconActive]}>
                    <Ionicons
                      name={METHOD_ICONS[key] as any}
                      size={20}
                      color={selected === key ? '#fff' : Colors.primary}
                    />
                  </View>
                  {method.fee > 0 ? (
                    <View style={styles.feeBadge}>
                      <Text style={styles.feeBadgeText}>${method.fee.toFixed(2)}</Text>
                    </View>
                  ) : (
                    <View style={styles.freeBadge}>
                      <Text style={styles.freeBadgeText}>GRATIS</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.methodName, selected === key && styles.methodNameActive]}>
                  {method.label}
                </Text>
                <Text style={styles.methodSpeed}>{method.speed}</Text>
                {key === 'visa_direct' && (
                  <Text style={styles.methodNote}>⚡ Tarjeta de débito requerida</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>

          {/* Form Section */}
          {selected === 'ach' && (
            <View style={styles.formSection}>
              <Text style={styles.formTitle}>🏧 Información Bancaria</Text>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Nombre del Banco</Text>
                <TextInput
                  style={styles.input}
                  value={bankName}
                  onChangeText={setBankName}
                  placeholder="Ej: Chase, Bank of America"
                  placeholderTextColor="#999"
                />
              </View>
              <View style={styles.inputRow}>
                <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.inputLabel}>Tipo de Cuenta</Text>
                  <View style={styles.segmentedRow}>
                    <TouchableOpacity
                      style={[styles.segBtn, accountType === 'checking' && styles.segBtnActive]}
                      onPress={() => setAccountType('checking')}
                    >
                      <Text style={[styles.segText, accountType === 'checking' && styles.segTextActive]}>Checking</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.segBtn, accountType === 'savings' && styles.segBtnActive]}
                      onPress={() => setAccountType('savings')}
                    >
                      <Text style={[styles.segText, accountType === 'savings' && styles.segTextActive]}>Savings</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Número de Ruta (Routing)</Text>
                <TextInput
                  style={styles.input}
                  value={routingNumber}
                  onChangeText={setRoutingNumber}
                  placeholder="9 dígitos"
                  placeholderTextColor="#999"
                  keyboardType="number-pad"
                  maxLength={9}
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Número de Cuenta</Text>
                <TextInput
                  style={styles.input}
                  value={accountNumber}
                  onChangeText={setAccountNumber}
                  placeholder="Número de cuenta"
                  placeholderTextColor="#999"
                  keyboardType="number-pad"
                />
              </View>
            </View>
          )}

          {selected === 'visa_direct' && (
            <View style={styles.formSection}>
              <Text style={styles.formTitle}>⚡ Tarjeta de Débito</Text>
              <View style={styles.securityNote}>
                <Ionicons name="shield-checkmark" size={16} color="#f59e0b" />
                <Text style={styles.securityText}>
                  La tarjeta debe estar vinculada a tu cuenta bancaria verificada
                </Text>
              </View>
              <CardField
                postalCodeEnabled={false}
                placeholders={{ number: '4242 4242 4242 4242' }}
                cardStyle={{
                  backgroundColor: '#ffffff',
                  textColor: '#1a1a2e',
                  borderWidth: 1,
                  borderColor: '#e2e8f0',
                  borderRadius: 12,
                  fontSize: 16,
                  placeholderColor: '#94a3b8',
                }}
                style={styles.cardField}
                onCardChange={(details) => {
                  setCardComplete(details.complete);
                }}
              />
              {stripeAccountStatus?.has_card && (
                <View style={styles.existingCard}>
                  <Ionicons name="card" size={16} color={Colors.primary} />
                  <Text style={styles.existingCardText}>
                    Tarjeta guardada: ****{stripeAccountStatus.card_last4} ({stripeAccountStatus.card_brand})
                  </Text>
                </View>
              )}
            </View>
          )}

          {selected === 'zelle' && (
            <View style={styles.formSection}>
              <Text style={styles.formTitle}>📱 Datos de Zelle</Text>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Email de Zelle</Text>
                <TextInput
                  style={styles.input}
                  value={zelleEmail}
                  onChangeText={setZelleEmail}
                  placeholder="tu@email.com"
                  placeholderTextColor="#999"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Teléfono (opcional)</Text>
                <TextInput
                  style={styles.input}
                  value={zellePhone}
                  onChangeText={setZellePhone}
                  placeholder="(555) 123-4567"
                  placeholderTextColor="#999"
                  keyboardType="phone-pad"
                />
              </View>
            </View>
          )}

          {selected === 'cash' && (
            <View style={styles.formSection}>
              <Text style={styles.formTitle}>💵 Efectivo</Text>
              <View style={styles.cashNote}>
                <Ionicons name="location" size={20} color={Colors.primary} />
                <Text style={styles.cashNoteText}>
                  Visita nuestra oficina para recoger tu efectivo.{'\n'}
                  Horario: Lunes a Viernes, 9AM - 5PM
                </Text>
              </View>
            </View>
          )}

          {/* Summary */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Monto aprobado</Text>
              <Text style={styles.summaryValue}>{fmt(loanAmount)}</Text>
            </View>
            {fee > 0 && (
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: '#f59e0b' }]}>Fee instantáneo</Text>
                <Text style={[styles.summaryValue, { color: '#f59e0b' }]}>-{fmt(fee)}</Text>
              </View>
            )}
            <View style={[styles.summaryRow, styles.summaryTotal]}>
              <Text style={styles.totalLabel}>Recibirás</Text>
              <Text style={styles.totalValue}>{fmt(netAmount)}</Text>
            </View>
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={submitting || (selected === 'visa_direct' && !cardComplete)}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={submitting ? ['#94a3b8', '#64748b'] : ['#1a56db', '#3b82f6']}
              style={styles.submitGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={22} color="#fff" />
                  <Text style={styles.submitText}>Confirmar — Recibir {fmt(netAmount)}</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <Text style={styles.disclaimer}>
            Al confirmar, autorizas a Ross Lending Solutions LLC a depositar los fondos usando el método seleccionado.
          </Text>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20,
    paddingTop: 12, paddingBottom: 16,
  },
  backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center', marginRight: 8 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: Colors.text },
  headerSubtitle: { fontSize: 13, color: Colors.textMuted, marginTop: 2 },

  amountCard: {
    marginHorizontal: 20, borderRadius: 20, padding: 24, marginBottom: 24,
  },
  amountLabel: { fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: '600' },
  amountValue: { fontSize: 36, fontWeight: '900', color: '#fff', marginTop: 4 },
  feeRow: { marginTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.2)', paddingTop: 12 },
  feeText: { fontSize: 12, color: 'rgba(255,255,255,0.7)' },
  netText: { fontSize: 16, fontWeight: '800', color: '#fff', marginTop: 4 },

  sectionTitle: {
    fontSize: 16, fontWeight: '700', color: Colors.text, marginHorizontal: 20, marginBottom: 12,
  },
  methodsGrid: {
    flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 10, marginBottom: 24,
  },
  methodCard: {
    width: (SCREEN_WIDTH - 52) / 2, backgroundColor: '#fff', borderRadius: 16,
    padding: 16, borderWidth: 2, borderColor: '#e2e8f0',
  },
  methodCardActive: { borderColor: '#1a56db', backgroundColor: '#eff6ff' },
  methodHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  methodIcon: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: '#eff6ff',
    justifyContent: 'center', alignItems: 'center',
  },
  methodIconActive: { backgroundColor: '#1a56db' },
  feeBadge: { backgroundColor: '#fef3c7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  feeBadgeText: { fontSize: 11, fontWeight: '700', color: '#92400e' },
  freeBadge: { backgroundColor: '#d1fae5', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  freeBadgeText: { fontSize: 11, fontWeight: '700', color: '#065f46' },
  methodName: { fontSize: 13, fontWeight: '700', color: Colors.text },
  methodNameActive: { color: '#1a56db' },
  methodSpeed: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  methodNote: { fontSize: 10, color: '#f59e0b', marginTop: 6 },

  formSection: {
    marginHorizontal: 20, backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 20,
    borderWidth: 1, borderColor: '#e2e8f0',
  },
  formTitle: { fontSize: 16, fontWeight: '700', color: Colors.text, marginBottom: 16 },
  inputGroup: { marginBottom: 16 },
  inputLabel: { fontSize: 12, fontWeight: '600', color: Colors.textMuted, marginBottom: 6 },
  input: {
    backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: Colors.text,
  },
  inputRow: { flexDirection: 'row' },
  segmentedRow: { flexDirection: 'row', gap: 8 },
  segBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: '#f1f5f9',
    alignItems: 'center',
  },
  segBtnActive: { backgroundColor: '#1a56db' },
  segText: { fontSize: 13, fontWeight: '600', color: Colors.textMuted },
  segTextActive: { color: '#fff' },

  cardField: { width: '100%', height: 50, marginVertical: 12 },
  securityNote: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fef3c7',
    padding: 12, borderRadius: 10, marginBottom: 16,
  },
  securityText: { fontSize: 12, color: '#92400e', flex: 1 },
  existingCard: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8,
    padding: 10, backgroundColor: '#eff6ff', borderRadius: 8,
  },
  existingCardText: { fontSize: 12, color: '#1a56db', fontWeight: '600' },

  cashNote: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#f0fdf4',
    padding: 16, borderRadius: 12,
  },
  cashNoteText: { fontSize: 13, color: '#166534', flex: 1, lineHeight: 20 },

  summaryCard: {
    marginHorizontal: 20, backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 20,
    borderWidth: 1, borderColor: '#e2e8f0',
  },
  summaryRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10,
  },
  summaryLabel: { fontSize: 14, color: Colors.textMuted },
  summaryValue: { fontSize: 14, fontWeight: '600', color: Colors.text },
  summaryTotal: {
    marginTop: 10, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#e2e8f0', marginBottom: 0,
  },
  totalLabel: { fontSize: 16, fontWeight: '700', color: Colors.text },
  totalValue: { fontSize: 22, fontWeight: '900', color: '#1a56db' },

  submitBtn: { marginHorizontal: 20, marginBottom: 12 },
  submitBtnDisabled: { opacity: 0.5 },
  submitGradient: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    paddingVertical: 18, borderRadius: 14,
  },
  submitText: { fontSize: 16, fontWeight: '800', color: '#fff' },
  disclaimer: {
    fontSize: 11, color: Colors.textMuted, textAlign: 'center', paddingHorizontal: 40, lineHeight: 16,
  },
});
