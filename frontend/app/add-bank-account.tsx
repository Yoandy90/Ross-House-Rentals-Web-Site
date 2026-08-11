import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Spacing, FontSizes, BorderRadius, Shadows, useColors } from '../src/constants/theme';
import { apiCall } from '../src/utils/api';

export default function AddBankAccountScreen() {
  const C = useColors();
  const styles = React.useMemo(() => createStyles(C), [C]);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [holderName, setHolderName] = useState('');
  const [bankName, setBankName] = useState('');
  const [routing, setRouting] = useState('');
  const [account, setAccount] = useState('');
  const [confirmAccount, setConfirmAccount] = useState('');
  const [accountType, setAccountType] = useState<'checking' | 'savings'>('checking');
  const [makeDefault, setMakeDefault] = useState(true);
  const [showAccount, setShowAccount] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const validate = (): string | null => {
    if (!holderName.trim()) return 'Ingresa el nombre del titular de la cuenta';
    if (!/^\d{9}$/.test(routing)) return 'El routing number debe tener exactamente 9 dígitos';
    if (!/^\d{4,17}$/.test(account)) return 'El account number debe tener entre 4 y 17 dígitos';
    if (account !== confirmAccount) return 'Los account numbers no coinciden';
    return null;
  };

  const handleSubmit = async () => {
    const err = validate();
    if (err) {
      Alert.alert('Datos inválidos', err);
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiCall('/tenant/bank-accounts/add', {
        method: 'POST',
        body: {
          account_holder_name: holderName.trim(),
          bank_name: bankName.trim(),
          routing_number: routing,
          account_number: account,
          account_type: accountType,
          make_default: makeDefault,
        },
      });
      if (res?.success) {
        Alert.alert(
          '✅ Banco guardado',
          res.message || 'Tu cuenta bancaria fue guardada exitosamente.',
          [{ text: 'OK', onPress: () => router.back() }]
        );
      } else {
        Alert.alert('Error', res?.detail || 'No se pudo guardar');
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Error de red');
    }
    setSubmitting(false);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={28} color={C.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Agregar Banco (ACH)</Text>
        <View style={{ width: 28 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 60 : 0}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {/* Security badge */}
          <View style={styles.securityCard}>
            <Ionicons name="shield-checkmark" size={20} color="#10B981" />
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={styles.securityTitle}>Datos protegidos</Text>
              <Text style={styles.securityText}>
                Tu routing y account number se encriptan con AES-128 antes de guardarse. Solo el admin con PIN puede verlos.
              </Text>
            </View>
          </View>

          {/* Holder name */}
          <Field label="Nombre del Titular *">
            <TextInput
              style={styles.input}
              placeholder="Como aparece en el banco"
              placeholderTextColor={C.textMuted}
              value={holderName}
              onChangeText={setHolderName}
              autoCapitalize="words"
            />
          </Field>

          {/* Bank name */}
          <Field label="Banco (opcional)">
            <TextInput
              style={styles.input}
              placeholder="Ej: Bank of America, Wells Fargo..."
              placeholderTextColor={C.textMuted}
              value={bankName}
              onChangeText={setBankName}
              autoCapitalize="words"
            />
          </Field>

          {/* Routing */}
          <Field label="Routing Number (9 dígitos) *">
            <TextInput
              style={styles.input}
              placeholder="111000025"
              placeholderTextColor={C.textMuted}
              keyboardType="number-pad"
              maxLength={9}
              value={routing}
              onChangeText={t => setRouting(t.replace(/\D/g, ''))}
            />
          </Field>

          {/* Account */}
          <Field label="Account Number *">
            <View style={styles.inputRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Tu número de cuenta"
                placeholderTextColor={C.textMuted}
                keyboardType="number-pad"
                maxLength={17}
                secureTextEntry={!showAccount}
                value={account}
                onChangeText={t => setAccount(t.replace(/\D/g, ''))}
              />
              <TouchableOpacity onPress={() => setShowAccount(s => !s)} style={styles.eyeBtn}>
                <Ionicons name={showAccount ? 'eye-off-outline' : 'eye-outline'} size={20} color={C.textMuted} />
              </TouchableOpacity>
            </View>
          </Field>

          {/* Confirm account */}
          <Field label="Confirmar Account Number *">
            <TextInput
              style={styles.input}
              placeholder="Repite tu número de cuenta"
              placeholderTextColor={C.textMuted}
              keyboardType="number-pad"
              maxLength={17}
              value={confirmAccount}
              onChangeText={t => setConfirmAccount(t.replace(/\D/g, ''))}
            />
          </Field>

          {/* Account type */}
          <Field label="Tipo de Cuenta *">
            <View style={styles.typeRow}>
              <TypePill active={accountType === 'checking'} onPress={() => setAccountType('checking')} icon="cash-outline" label="Corriente" />
              <TypePill active={accountType === 'savings'} onPress={() => setAccountType('savings')} icon="wallet-outline" label="Ahorros" />
            </View>
          </Field>

          {/* Default switch */}
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.switchLabel}>Hacer principal</Text>
              <Text style={styles.switchSub}>Será el método predeterminado para autopago</Text>
            </View>
            <Switch
              value={makeDefault}
              onValueChange={setMakeDefault}
              thumbColor={makeDefault ? C.brandRed : '#777'}
              trackColor={{ false: '#444', true: 'rgba(196,30,58,0.5)' }}
            />
          </View>

          {/* Info note */}
          <View style={styles.infoCard}>
            <Ionicons name="information-circle-outline" size={16} color="#F59E0B" />
            <Text style={styles.infoText}>
              Stripe enviará 2 micro-depósitos a tu cuenta en 2-3 días hábiles. Deberás confirmarlos en la app antes de poder usarla.
            </Text>
          </View>

          {/* Submit */}
          <TouchableOpacity
            style={[styles.submitBtn, submitting && { opacity: 0.5 }]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="lock-closed" size={18} color="#fff" />
                <Text style={styles.submitText}>Guardar Banco</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const C = useColors();
  const styles = React.useMemo(() => createStyles(C), [C]);
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

function TypePill({ active, onPress, icon, label }: { active: boolean; onPress: () => void; icon: any; label: string }) {
  const C = useColors();
  const styles = React.useMemo(() => createStyles(C), [C]);
  return (
    <TouchableOpacity
      style={[styles.typePill, active && styles.typePillActive]}
      onPress={onPress}
    >
      <Ionicons name={icon} size={18} color={active ? '#fff' : C.textMuted} />
      <Text style={[styles.typePillText, active && { color: '#fff', fontWeight: '700' }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const createStyles = (C: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm,
    borderBottomWidth: 1, borderBottomColor: C.glassBorder,
  },
  backBtn: { padding: 4 },
  headerTitle: { color: C.text, fontSize: FontSizes.lg, fontWeight: '700' },
  content: { padding: Spacing.md, paddingBottom: Spacing.xl * 2 },
  securityCard: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: 'rgba(16,185,129,0.08)',
    borderColor: 'rgba(16,185,129,0.25)', borderWidth: 1,
    borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.lg,
  },
  securityTitle: { color: '#10B981', fontWeight: '700', fontSize: FontSizes.sm },
  securityText: { color: C.textMuted, fontSize: 11, marginTop: 2 },
  field: { marginBottom: Spacing.md },
  fieldLabel: { color: C.text, fontSize: FontSizes.sm, fontWeight: '600', marginBottom: 8 },
  input: {
    backgroundColor: C.cardBackground,
    borderRadius: BorderRadius.md, padding: 14,
    color: C.text, fontSize: FontSizes.md,
    borderWidth: 1, borderColor: C.glassBorder,
  },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  eyeBtn: { padding: 8 },
  typeRow: { flexDirection: 'row', gap: Spacing.sm },
  typePill: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 12, borderRadius: BorderRadius.md,
    backgroundColor: C.cardBackground,
    borderWidth: 1, borderColor: C.glassBorder,
  },
  typePillActive: { backgroundColor: C.brandRed, borderColor: C.brandRed },
  typePillText: { color: C.textMuted, fontSize: FontSizes.sm },
  switchRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.cardBackground, padding: 14,
    borderRadius: BorderRadius.md, marginBottom: Spacing.lg,
    borderWidth: 1, borderColor: C.glassBorder,
  },
  switchLabel: { color: C.text, fontSize: FontSizes.md, fontWeight: '600' },
  switchSub: { color: C.textMuted, fontSize: 11, marginTop: 2 },
  infoCard: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: 'rgba(245,158,11,0.08)',
    borderColor: 'rgba(245,158,11,0.25)', borderWidth: 1,
    borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.lg, gap: 8,
  },
  infoText: { color: C.textMuted, fontSize: 11, flex: 1 },
  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: C.brandRed,
    paddingVertical: 16, borderRadius: BorderRadius.lg,
  },
  submitText: { color: C.textPrimary, fontSize: FontSizes.md, fontWeight: '700' },
});
