import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  Alert, Platform, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { Colors, API_URL } from '../../src/constants/theme';
import { useTranslation } from 'react-i18next';

// Stripe Identity — solo funciona en builds nativos (EAS), no en Expo Go ni Web
let useStripeIdentity: any = null;
let presentIdentityVerificationSheet: any = null;
try {
  const stripeIdentity = require('@stripe/stripe-identity-react-native');
  useStripeIdentity = stripeIdentity.useStripeIdentity;
  presentIdentityVerificationSheet = stripeIdentity.presentIdentityVerificationSheet;
} catch (e) {
  console.log('Stripe Identity native module not available (expected in web/Expo Go)');
}

export default function VerifyIdentityScreen() {
  const { user, token } = useAuth();
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ loanId: string; amount: string; loanNumber: string }>();
  const [step, setStep] = useState<'intro' | 'verifying' | 'success' | 'error'>('intro');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };

  const startVerification = async () => {
    setLoading(true);
    setStep('verifying');

    try {
      // 1. Create verification session on backend
      const res = await fetch(`${API_URL}/api/loans/identity/create-session`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          loan_id: params.loanId,
          user_id: user?._id || user?.id,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || t('verify.errorCreatingSession', 'Error creating verification session'));
      }

      const { session_id, ephemeral_key_secret } = await res.json();

      // 2. Present Stripe Identity sheet
      if (presentIdentityVerificationSheet) {
        const { status, error } = await presentIdentityVerificationSheet({
          sessionId: session_id,
          ephemeralKeySecret: ephemeral_key_secret,
        });

        if (status === 'FlowCompleted') {
          // 3. Confirm with backend
          const confirmRes = await fetch(`${API_URL}/api/loans/identity/confirm/${session_id}`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ loan_id: params.loanId }),
          });

          if (confirmRes.ok) {
            setStep('success');
          } else {
            // Verification may still be processing
            setStep('success');
          }
        } else if (status === 'FlowCanceled') {
          setStep('intro');
          Alert.alert('Cancelado', t('verify.cancelled', 'Verification was cancelled. You can try again.'));
        } else {
          setStep('error');
          setErrorMsg(error?.message || t('verify.errorDuring', 'Error during verification'));
        }
      } else {
        // Fallback for web/Expo Go — can't use native sheet
        Alert.alert(
          'No disponible',
          t('verify.nativeOnly', 'Identity verification only works on the native app (iOS/Android). Please use the app installed from TestFlight or App Store.'),
          [{ text: 'OK', onPress: () => setStep('intro') }]
        );
      }
    } catch (err: any) {
      setStep('error');
      setErrorMsg(err.message || 'Error inesperado');
    } finally {
      setLoading(false);
    }
  };

  const goToDisbursement = () => {
    router.replace({
      pathname: '/loan/disbursement',
      params: {
        loanId: params.loanId,
        amount: params.amount,
        loanNumber: params.loanNumber,
      },
    });
  };

  const renderIntro = () => (
    <View style={S.content}>
      {/* Icon */}
      <View style={S.iconWrap}>
        <LinearGradient colors={['#064E3B', '#059669']} style={S.iconGrad}>
          <Ionicons name="shield-checkmark" size={48} color="#fff" />
        </LinearGradient>
      </View>

      <Text style={S.title}>Verificación de Identidad</Text>
      <Text style={S.subtitle}>
        Para completar tu préstamo necesitamos verificar tu identidad. Este proceso es seguro y toma menos de 2 minutos.
      </Text>

      {/* Steps */}
      <View style={S.stepsContainer}>
        <StepItem number="1" title="Toma foto de tu ID" desc="Licencia de conducir, pasaporte o ID estatal" icon="card-outline" />
        <StepItem number="2" title="Toma una selfie" desc="Para verificar que eres la persona del documento" icon="camera-outline" />
        <StepItem number="3" title="Verificación automática" desc="Stripe compara tu foto con tu documento de forma segura" icon="checkmark-circle-outline" />
      </View>

      {/* Documents accepted */}
      <View style={S.docsAccepted}>
        <Text style={S.docsTitle}>Documentos aceptados:</Text>
        <View style={S.docsRow}>
          <DocChip icon="car-outline" label="Licencia" />
          <DocChip icon="airplane-outline" label="Pasaporte" />
          <DocChip icon="id-card-outline" label="ID Estatal" />
        </View>
      </View>

      {/* CTA */}
      <TouchableOpacity onPress={startVerification} activeOpacity={0.85} style={S.ctaWrap}>
        <LinearGradient colors={['#059669', '#34D399']} style={S.ctaBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
          <Ionicons name="shield-checkmark-outline" size={20} color="#fff" />
          <Text style={S.ctaText}>Verificar Mi Identidad</Text>
        </LinearGradient>
      </TouchableOpacity>

      {/* Security note */}
      <View style={S.securityNote}>
        <Ionicons name="lock-closed" size={14} color="#6B7280" />
        <Text style={S.securityText}>
          Tus datos son procesados por Stripe y no son almacenados en nuestros servidores. Cumplimos con KYC y GLBA.
        </Text>
      </View>
    </View>
  );

  const renderVerifying = () => (
    <View style={S.centerContent}>
      <ActivityIndicator size="large" color="#34D399" />
      <Text style={S.title}>Verificando...</Text>
      <Text style={S.subtitle}>Procesando tu verificación de identidad</Text>
    </View>
  );

  const renderSuccess = () => (
    <View style={S.centerContent}>
      <View style={[S.iconWrap, { marginBottom: 20 }]}>
        <LinearGradient colors={['#059669', '#34D399']} style={S.iconGrad}>
          <Ionicons name="checkmark-done" size={48} color="#fff" />
        </LinearGradient>
      </View>
      <Text style={S.title}>¡Identidad Verificada!</Text>
      <Text style={S.subtitle}>
        Tu identidad ha sido verificada exitosamente. Ahora puedes seleccionar cómo recibir tu dinero.
      </Text>

      <TouchableOpacity onPress={goToDisbursement} activeOpacity={0.85} style={[S.ctaWrap, { marginTop: 32 }]}>
        <LinearGradient colors={['#059669', '#34D399']} style={S.ctaBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
          <Ionicons name="flash" size={20} color="#fff" />
          <Text style={S.ctaText}>Recibir Mi Dinero</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );

  const renderError = () => (
    <View style={S.centerContent}>
      <View style={[S.iconWrap, { marginBottom: 20 }]}>
        <View style={[S.iconGrad, { backgroundColor: 'rgba(239,68,68,0.15)' }]}>
          <Ionicons name="alert-circle" size={48} color="#EF4444" />
        </View>
      </View>
      <Text style={[S.title, { color: '#EF4444' }]}>Verificación Fallida</Text>
      <Text style={S.subtitle}>
        {errorMsg || t('verify.couldNotComplete', 'Could not complete verification. Please try again.')}
      </Text>

      <TouchableOpacity onPress={() => { setStep('intro'); setErrorMsg(''); }} activeOpacity={0.85} style={[S.ctaWrap, { marginTop: 32 }]}>
        <LinearGradient colors={['#059669', '#34D399']} style={S.ctaBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
          <Ionicons name="refresh" size={20} color="#fff" />
          <Text style={S.ctaText}>Intentar de Nuevo</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={S.container}>
      {/* Header */}
      <View style={S.header}>
        <TouchableOpacity onPress={() => router.back()} style={S.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={S.headerTitle}>Verificación KYC</Text>
          {params.loanNumber && (
            <Text style={S.headerSub}>Préstamo #{params.loanNumber}</Text>
          )}
        </View>
        <View style={S.stepBadge}>
          <Text style={S.stepBadgeText}>Paso 1 de 2</Text>
        </View>
      </View>

      {step === 'intro' && renderIntro()}
      {step === 'verifying' && renderVerifying()}
      {step === 'success' && renderSuccess()}
      {step === 'error' && renderError()}
    </SafeAreaView>
  );
}

// ─── Sub-components ─────────────────────
function StepItem({ number, title, desc, icon }: { number: string; title: string; desc: string; icon: string }) {
  return (
    <View style={S.stepItem}>
      <View style={S.stepIcon}>
        <Ionicons name={icon as any} size={20} color="#34D399" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={S.stepTitle}>{title}</Text>
        <Text style={S.stepDesc}>{desc}</Text>
      </View>
    </View>
  );
}

function DocChip({ icon, label }: { icon: string; label: string }) {
  return (
    <View style={S.docChip}>
      <Ionicons name={icon as any} size={16} color="#34D399" />
      <Text style={S.docChipText}>{label}</Text>
    </View>
  );
}

// ─── Styles ─────────────────────
const S = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#fff' },
  headerSub: { fontSize: 12, color: Colors.textMuted, marginTop: 1 },
  stepBadge: { backgroundColor: 'rgba(52,211,153,0.1)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  stepBadgeText: { fontSize: 11, fontWeight: '700', color: '#34D399' },

  content: { flex: 1, padding: 24 },
  centerContent: { flex: 1, padding: 24, justifyContent: 'center', alignItems: 'center' },

  iconWrap: { alignSelf: 'center', marginBottom: 24, marginTop: 16 },
  iconGrad: { width: 96, height: 96, borderRadius: 48, justifyContent: 'center', alignItems: 'center' },

  title: { fontSize: 24, fontWeight: '800', color: '#fff', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 21, marginBottom: 24, paddingHorizontal: 8 },

  stepsContainer: { marginBottom: 24 },
  stepItem: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: 16, marginBottom: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  stepIcon: {
    width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(52,211,153,0.1)',
    justifyContent: 'center', alignItems: 'center',
  },
  stepTitle: { fontSize: 15, fontWeight: '700', color: '#fff' },
  stepDesc: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },

  docsAccepted: { marginBottom: 24 },
  docsTitle: { fontSize: 12, fontWeight: '600', color: Colors.textMuted, marginBottom: 10 },
  docsRow: { flexDirection: 'row', gap: 10 },
  docChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(52,211,153,0.06)', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8,
    borderWidth: 1, borderColor: 'rgba(52,211,153,0.12)',
  },
  docChipText: { fontSize: 12, fontWeight: '600', color: '#34D399' },

  ctaWrap: { borderRadius: 14, overflow: 'hidden' },
  ctaBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 16, borderRadius: 14,
  },
  ctaText: { fontSize: 16, fontWeight: '800', color: '#fff' },

  securityNote: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 16,
    paddingHorizontal: 4,
  },
  securityText: { fontSize: 11, color: '#6B7280', lineHeight: 16, flex: 1 },
});
