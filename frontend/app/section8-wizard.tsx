/**
 * Section 8 Voucher Wizard
 * Multi-step form for tenants to declare/update their HUD Housing Choice Voucher info.
 * The data is sent to /api/tenant/section8/declare and reviewed by admin.
 */
import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { apiCall } from '../src/utils/api';
import { useColors } from '../src/constants/theme';

const PHA_OPTIONS = [
  'Amarillo Housing Authority',
  'Houston Housing Authority',
  'Dallas Housing Authority',
  'HACA Austin',
  'Fort Worth Housing Solutions',
  'SAHA San Antonio',
  'Tarrant County HAO',
  'TDHCA Statewide',
  'Otra',
];

export default function Section8WizardScreen() {
  const C = useColors();
  const styles = React.useMemo(() => createStyles(C), [C]);
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [hasVoucher, setHasVoucher] = useState<boolean | null>(null);
  const [voucherNumber, setVoucherNumber] = useState('');
  const [pha, setPha] = useState('');
  const [voucherBedrooms, setVoucherBedrooms] = useState('2');
  const [voucherAmount, setVoucherAmount] = useState('');
  const [voucherExpiration, setVoucherExpiration] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(true);

  // Pre-fill from existing declaration if any
  useEffect(() => {
    (async () => {
      try {
        const d = await apiCall('/tenant/section8/status', { auth: true });
        if (d?.success) {
          if (d.is_section8) setHasVoucher(true);
          setVoucherNumber(d.voucher_number || '');
          setPha(d.pha || '');
          setVoucherBedrooms(String(d.voucher_bedrooms || 2));
          setVoucherAmount(String(d.voucher_amount || ''));
          setVoucherExpiration(d.voucher_expiration || '');
          setNotes(d.notes || '');
        }
      } catch (e) {
        // silent — first time, no existing
      } finally {
        setLoadingExisting(false);
      }
    })();
  }, []);

  const submit = async () => {
    setSubmitting(true);
    try {
      const payload = {
        has_voucher: !!hasVoucher,
        voucher_number: voucherNumber.trim(),
        pha: pha.trim(),
        voucher_bedrooms: parseInt(voucherBedrooms || '0', 10),
        voucher_amount: parseFloat(voucherAmount || '0'),
        voucher_expiration: voucherExpiration.trim(),
        notes: notes.trim(),
      };
      const res = await apiCall('/tenant/section8/declare', {
        method: 'POST', body: payload, auth: true,
      });
      if (res?.success) {
        Alert.alert(
          '✅ Información guardada',
          'Tu declaración de Section 8 fue enviada al admin. Te avisaremos cuando sea procesada.',
          [{ text: 'OK', onPress: () => router.back() }],
        );
      } else {
        Alert.alert('Error', res?.message || 'No se pudo guardar');
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Error de red');
    }
    setSubmitting(false);
  };

  if (loadingExisting) {
    return (
      <View style={[styles.center, { flex: 1, backgroundColor: '#0a1020' }]}>
        <ActivityIndicator size="large" color={C.warmGold || '#F59E0B'} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ title: 'Section 8 / Voucher HUD', headerShown: false }} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="chevron-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>🏛️ Section 8</Text>
          <Text style={styles.headerSub}>Paso {step} de 4</Text>
        </View>
      </View>

      {/* Progress */}
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${(step / 4) * 100}%` }]} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.content}>
          {/* STEP 1 — Has voucher? */}
          {step === 1 && (
            <View>
              <Text style={styles.stepTitle}>¿Tienes voucher Section 8?</Text>
              <Text style={styles.stepSub}>
                Si calificaste para el Housing Choice Voucher Program de HUD, podemos vincular tu voucher con tu contrato. El gobierno paga parte de tu renta directo al landlord.
              </Text>

              <TouchableOpacity
                style={[styles.bigOption, hasVoucher === true && styles.bigOptionActive]}
                onPress={() => setHasVoucher(true)}
              >
                <Text style={styles.bigOptionEmoji}>✅</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.bigOptionTitle}>Sí, tengo voucher activo</Text>
                  <Text style={styles.bigOptionSub}>Mi PHA ya me emitió el voucher</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.bigOption, hasVoucher === false && styles.bigOptionActive]}
                onPress={() => setHasVoucher(false)}
              >
                <Text style={styles.bigOptionEmoji}>❌</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.bigOptionTitle}>No tengo voucher</Text>
                  <Text style={styles.bigOptionSub}>Pago renta a precio de mercado</Text>
                </View>
              </TouchableOpacity>

              <View style={styles.infoBox}>
                <Text style={styles.infoTitle}>¿No tienes voucher pero crees que calificas?</Text>
                <Text style={styles.infoText}>
                  Llama a tu Public Housing Authority local. Para Amarillo TX: (806) 342-1670. El waitlist puede ser largo (6 meses a 5 años), pero el voucher cubre 70-100% de tu renta.
                </Text>
              </View>
            </View>
          )}

          {/* STEP 2 — PHA + Voucher number */}
          {step === 2 && hasVoucher && (
            <View>
              <Text style={styles.stepTitle}>Información del voucher</Text>
              <Text style={styles.stepSub}>Estos datos están en tu papel oficial de voucher</Text>

              <Text style={styles.label}>Public Housing Authority (PHA)</Text>
              <View style={styles.phaGrid}>
                {PHA_OPTIONS.map(p => (
                  <TouchableOpacity
                    key={p}
                    style={[styles.phaChip, pha === p && styles.phaChipActive]}
                    onPress={() => setPha(p)}
                  >
                    <Text style={[styles.phaChipText, pha === p && styles.phaChipTextActive]}>{p}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Número de voucher (opcional)</Text>
              <TextInput
                style={styles.input}
                value={voucherNumber}
                onChangeText={setVoucherNumber}
                placeholder="Ej. HCV-2024-12345"
                placeholderTextColor="#6B7280"
              />
            </View>
          )}

          {/* STEP 3 — Amount, bedrooms, expiration */}
          {step === 3 && hasVoucher && (
            <View>
              <Text style={styles.stepTitle}>Monto + Habitaciones aprobadas</Text>
              <Text style={styles.stepSub}>HUD aprobó cuánto puedes pagar de renta y para qué tamaño</Text>

              <Text style={styles.label}>Habitaciones aprobadas</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
                {['0', '1', '2', '3', '4'].map(n => (
                  <TouchableOpacity
                    key={n}
                    style={[styles.brChip, voucherBedrooms === n && styles.brChipActive]}
                    onPress={() => setVoucherBedrooms(n)}
                  >
                    <Text style={[styles.brChipText, voucherBedrooms === n && styles.brChipTextActive]}>{n} BR</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Monto máximo HUD pagará/mes (en USD)</Text>
              <TextInput
                style={styles.input}
                value={voucherAmount}
                onChangeText={setVoucherAmount}
                placeholder="Ej. 1070"
                placeholderTextColor="#6B7280"
                keyboardType="numeric"
              />

              <Text style={styles.label}>Fecha de expiración del voucher (YYYY-MM-DD)</Text>
              <TextInput
                style={styles.input}
                value={voucherExpiration}
                onChangeText={setVoucherExpiration}
                placeholder="2025-12-31"
                placeholderTextColor="#6B7280"
              />
              <Text style={styles.helpText}>
                Importante: si tu voucher vence antes de firmar lease, lo pierdes y vuelves al waitlist.
              </Text>
            </View>
          )}

          {/* STEP 4 — Notes + Review */}
          {step === 4 && (
            <View>
              <Text style={styles.stepTitle}>Resumen</Text>

              {!hasVoucher ? (
                <View style={styles.infoBox}>
                  <Text style={styles.infoTitle}>Sin voucher activo</Text>
                  <Text style={styles.infoText}>
                    Has declarado que no tienes voucher Section 8 actualmente. Si esto cambia, regresa a este wizard para actualizar.
                  </Text>
                </View>
              ) : (
                <>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>PHA</Text>
                    <Text style={styles.summaryValue}>{pha || '—'}</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Voucher #</Text>
                    <Text style={styles.summaryValue}>{voucherNumber || '—'}</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Habitaciones</Text>
                    <Text style={styles.summaryValue}>{voucherBedrooms} BR</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Monto HUD</Text>
                    <Text style={[styles.summaryValue, { color: '#10B981' }]}>
                      ${parseFloat(voucherAmount || '0').toLocaleString()}/mes
                    </Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Expira</Text>
                    <Text style={styles.summaryValue}>{voucherExpiration || '—'}</Text>
                  </View>
                </>
              )}

              <Text style={styles.label}>Notas adicionales (opcional)</Text>
              <TextInput
                style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Composición familiar, comentarios, ID del inspector..."
                placeholderTextColor="#6B7280"
                multiline
              />
            </View>
          )}
        </ScrollView>

        {/* Footer nav */}
        <View style={styles.footer}>
          {step > 1 && (
            <TouchableOpacity
              style={[styles.footerBtn, styles.footerBtnSecondary]}
              onPress={() => setStep(s => s - 1)}
            >
              <Text style={styles.footerBtnTextSec}>Atrás</Text>
            </TouchableOpacity>
          )}
          {step < 4 ? (
            <TouchableOpacity
              style={[
                styles.footerBtn, styles.footerBtnPrimary,
                ((step === 1 && hasVoucher === null) ||
                 (step === 2 && hasVoucher && !pha)) && { opacity: 0.4 }
              ]}
              disabled={
                (step === 1 && hasVoucher === null) ||
                (step === 2 && !!hasVoucher && !pha)
              }
              onPress={() => {
                // Skip steps 2-3 if no voucher
                if (step === 1 && !hasVoucher) setStep(4);
                else setStep(s => s + 1);
              }}
            >
              <Text style={styles.footerBtnTextPri}>Siguiente</Text>
              <Ionicons name="chevron-forward" size={18} color="#FFF" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.footerBtn, styles.footerBtnPrimary, submitting && { opacity: 0.6 }]}
              onPress={submit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={18} color="#FFF" />
                  <Text style={styles.footerBtnTextPri}>Enviar</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const createStyles = (C: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a1020' },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12, gap: 8,
    borderBottomWidth: 1, borderBottomColor: C.glassBorder,
  },
  headerBtn: { padding: 4 },
  headerTitle: { color: C.textPrimary, fontSize: 18, fontWeight: '800' },
  headerSub: { color: '#9CA3AF', fontSize: 12, marginTop: 2 },
  progressBar: { height: 3, backgroundColor: C.glassLight },
  progressFill: { height: 3, backgroundColor: '#10B981' },
  content: { padding: 20, paddingBottom: 100 },
  stepTitle: { color: C.textPrimary, fontSize: 24, fontWeight: '800', marginBottom: 8 },
  stepSub: { color: '#9CA3AF', fontSize: 14, marginBottom: 24, lineHeight: 20 },
  bigOption: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    padding: 18, borderRadius: 14, borderWidth: 2, borderColor: C.glassBorder,
    backgroundColor: C.glass, marginBottom: 12,
  },
  bigOptionActive: { borderColor: '#10B981', backgroundColor: 'rgba(16,185,129,0.1)' },
  bigOptionEmoji: { fontSize: 28 },
  bigOptionTitle: { color: C.textPrimary, fontSize: 16, fontWeight: '700' },
  bigOptionSub: { color: '#9CA3AF', fontSize: 12, marginTop: 2 },
  infoBox: {
    marginTop: 20, padding: 14, borderRadius: 12,
    backgroundColor: 'rgba(245,158,11,0.08)', borderLeftWidth: 3, borderLeftColor: '#F59E0B',
  },
  infoTitle: { color: '#FBBF24', fontSize: 13, fontWeight: '700', marginBottom: 4 },
  infoText: { color: '#D1D5DB', fontSize: 12, lineHeight: 18 },
  label: { color: '#9CA3AF', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 12, marginBottom: 6 },
  input: {
    backgroundColor: C.glass, borderWidth: 1, borderColor: C.glassBorder,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    color: C.textPrimary, fontSize: 14,
  },
  helpText: { color: '#6B7280', fontSize: 11, marginTop: 6, fontStyle: 'italic' },
  phaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  phaChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18, borderWidth: 1, borderColor: C.glassBorderLight, backgroundColor: C.glass },
  phaChipActive: { borderColor: '#10B981', backgroundColor: 'rgba(16,185,129,0.15)' },
  phaChipText: { color: '#D1D5DB', fontSize: 11, fontWeight: '600' },
  phaChipTextActive: { color: '#34D399', fontWeight: '700' },
  brChip: { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: C.glassBorderLight, alignItems: 'center' },
  brChipActive: { borderColor: '#10B981', backgroundColor: 'rgba(16,185,129,0.12)' },
  brChipText: { color: '#9CA3AF', fontSize: 13, fontWeight: '600' },
  brChipTextActive: { color: '#34D399', fontWeight: '800' },
  summaryRow: {
    flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: C.glassBorder,
  },
  summaryLabel: { color: '#9CA3AF', fontSize: 13 },
  summaryValue: { color: C.textPrimary, fontSize: 13, fontWeight: '700' },
  footer: {
    flexDirection: 'row', gap: 10,
    paddingHorizontal: 20, paddingVertical: 14,
    borderTopWidth: 1, borderTopColor: C.glassBorder,
    backgroundColor: '#0a1020',
  },
  footerBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    flexDirection: 'row', gap: 6,
  },
  footerBtnPrimary: { backgroundColor: '#10B981' },
  footerBtnSecondary: { backgroundColor: C.glassLight },
  footerBtnTextPri: { color: C.textPrimary, fontSize: 14, fontWeight: '700' },
  footerBtnTextSec: { color: '#D1D5DB', fontSize: 14, fontWeight: '600' },
});
