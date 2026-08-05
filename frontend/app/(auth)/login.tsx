import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator, ScrollView,
  Keyboard, Image, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { authService } from '../../services/auth';
import api from '../../services/api';

type AuthMode = 'phone' | 'email';
type PhoneStep = 'number' | 'code';

const C = {
  bg: '#0F172A',
  card: '#1E293B',
  border: '#334155',
  brand: '#C41E3A',
  brandLight: '#E74C5E',
  accent: '#22D3EE',
  white: '#F1F5F9',
  sub: '#94A3B8',
  muted: '#64748B',
  input: '#1E293B',
};

export default function LoginScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { signIn, signInWithOTP } = useAuth();

  const [mode, setMode] = useState<AuthMode>('phone');
  const [phoneStep, setPhoneStep] = useState<PhoneStep>('number');

  // Phone OTP
  const [phone, setPhone] = useState('');
  const [otpCode, setOtpCode] = useState(['', '', '', '', '', '']);
  const [countdown, setCountdown] = useState(0);
  const otpRefs = useRef<(TextInput | null)[]>([]);

  // Email
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (countdown > 0) {
      const t = setTimeout(() => setCountdown(c => c - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [countdown]);

  const formatPhone = (raw: string) => {
    const d = raw.replace(/\D/g, '').slice(0, 10);
    if (d.length <= 3) return d;
    if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  };
  const cleanPhone = () => phone.replace(/\D/g, '');

  // ── OTP Handlers ──
  const handleSendOTP = async () => {
    const digits = cleanPhone();
    if (digits.length < 10) {
      Alert.alert('Error', t('auth.phone_invalid') || 'Ingresa un número de 10 dígitos');
      return;
    }
    setLoading(true);
    try {
      await authService.sendOTP(digits);
      setPhoneStep('code');
      setCountdown(60);
      setOtpCode(['', '', '', '', '', '']);
      setTimeout(() => otpRefs.current[0]?.focus(), 300);
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail || t('auth.otp_send_error') || 'Error enviando código.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (codeOverride?: string) => {
    const code = codeOverride || otpCode.join('');
    if (code.length !== 6) return;
    setLoading(true);
    Keyboard.dismiss();
    try {
      await signInWithOTP(cleanPhone(), code);
      // Navigate after successful OTP login
      try {
        const me = await api.get('/auth/me');
        if (me.data.role === 'admin' || me.data.role === 'office_assistant')
          router.replace(Platform.OS === 'web' ? '/(admin)/dashboard' : '/(admin)');
        else router.replace('/(tabs)/');
      } catch { router.replace('/(tabs)/'); }
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail || t('auth.otp_invalid') || 'Código incorrecto.');
      setOtpCode(['', '', '', '', '', '']);
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (text: string, idx: number) => {
    if (text.length > 1) {
      const digits = text.replace(/\D/g, '').slice(0, 6);
      if (digits.length === 6) {
        setOtpCode(digits.split(''));
        otpRefs.current[5]?.focus();
        setTimeout(() => handleVerifyOTP(digits), 200);
        return;
      }
    }
    const arr = [...otpCode];
    arr[idx] = text.replace(/\D/g, '').slice(-1);
    setOtpCode(arr);
    if (text && idx < 5) otpRefs.current[idx + 1]?.focus();
    if (text && idx === 5) {
      const full = arr.join('');
      if (full.length === 6) setTimeout(() => handleVerifyOTP(full), 200);
    }
  };

  const handleOtpKeyPress = (e: any, idx: number) => {
    if (e.nativeEvent.key === 'Backspace' && !otpCode[idx] && idx > 0)
      otpRefs.current[idx - 1]?.focus();
  };

  // ── Email Login ──
  const handleEmailLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', t('auth.fillAllFields') || 'Completa todos los campos');
      return;
    }
    setLoading(true);
    try {
      const resp = await signIn(email.trim(), password);
      if (resp && 'requires_2fa' in resp && resp.requires_2fa) {
        Alert.alert('2FA', resp.message || 'Verificación requerida');
        return;
      }
      try {
        const me = await api.get('/auth/me');
        if (me.data.role === 'admin' || me.data.role === 'office_assistant')
          router.replace(Platform.OS === 'web' ? '/(admin)/dashboard' : '/(admin)');
        else router.replace('/(tabs)/');
      } catch { router.replace('/(tabs)/'); }
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.detail || t('auth.loginError') || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0) return;
    setLoading(true);
    try {
      await authService.sendOTP(cleanPhone());
      setCountdown(60);
      setOtpCode(['', '', '', '', '', '']);
      Alert.alert('✅', t('auth.otp_resent') || 'Código reenviado');
    } catch {
      Alert.alert('Error', t('auth.otp_send_error') || 'Error reenviando');
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (m: AuthMode) => { setMode(m); setPhoneStep('number'); };

  // ── Helpers ──
  const webInput = Platform.OS === 'web' ? { outline: 'none', borderWidth: 0 } as any : {};

  return (
    <View style={S.root}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView style={S.safe} edges={['top', 'bottom']}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={S.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

            {/* Back button on OTP step */}
            {mode === 'phone' && phoneStep === 'code' && (
              <TouchableOpacity onPress={() => { setPhoneStep('number'); setOtpCode(['','','','','','']); }} style={S.backBtn}>
                <Ionicons name="arrow-back" size={24} color={C.white} />
              </TouchableOpacity>
            )}

            {/* ── Logo ── */}
            <View style={S.logoWrap}>
              <View style={S.logoCircle}>
                <Image source={require('../../assets/ross-logo.png')} style={S.logoImg} resizeMode="contain" />
              </View>
            </View>

            {/* ── Title ── */}
            <Text style={S.title}>
              {mode === 'phone' && phoneStep === 'code'
                ? (t('auth.verify_code') || 'Verificar Código')
                : (t('auth.welcomeBack') || 'Bienvenido')}
            </Text>
            <Text style={S.subtitle}>
              {mode === 'phone' && phoneStep === 'code'
                ? `${t('auth.code_sent_to') || 'Enviamos un código a'} +1 ${formatPhone(phone)}`
                : mode === 'phone'
                  ? (t('auth.enter_phone_desc') || 'Inicia sesión para gestionar tus impuestos')
                  : (t('auth.enterCredentials') || 'Inicia sesión para gestionar tus impuestos')}
            </Text>

            {/* ══════ PHONE NUMBER ══════ */}
            {mode === 'phone' && phoneStep === 'number' && (
              <View style={S.formWrap}>
                <View style={S.darkField}>
                  <Text style={S.flagPrefix}>🇺🇸  +1</Text>
                  <View style={S.fieldDivider} />
                  <TextInput
                    style={[S.darkInput, webInput]}
                    value={formatPhone(phone)}
                    onChangeText={(t) => setPhone(t.replace(/\D/g, '').slice(0, 10))}
                    placeholder="(555) 123-4567"
                    placeholderTextColor={C.muted}
                    keyboardType="phone-pad"
                    maxLength={14}
                    autoFocus
                  />
                </View>

                <TouchableOpacity
                  onPress={handleSendOTP}
                  disabled={loading || cleanPhone().length < 10}
                  style={[S.primaryBtn, (loading || cleanPhone().length < 10) && { opacity: 0.5 }]}
                >
                  {loading ? <ActivityIndicator color="#fff" /> : (
                    <View style={S.btnInner}>
                      <Ionicons name="chatbubble-outline" size={20} color="#fff" />
                      <Text style={S.btnText}>{t('auth.send_code') || 'Enviar Código SMS'}</Text>
                    </View>
                  )}
                </TouchableOpacity>

                <View style={S.divider}>
                  <View style={S.divLine} />
                  <Text style={S.divText}>o</Text>
                  <View style={S.divLine} />
                </View>

                <TouchableOpacity onPress={() => switchMode('email')} style={S.outlineBtn}>
                  <Ionicons name="mail-outline" size={20} color={C.sub} />
                  <Text style={S.outlineBtnText}>{t('auth.login_with_email') || 'Iniciar con Email'}</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ══════ OTP CODE ══════ */}
            {mode === 'phone' && phoneStep === 'code' && (
              <View style={S.formWrap}>
                <View style={S.otpRow}>
                  {otpCode.map((d, i) => (
                    <TextInput
                      key={i}
                      ref={r => { otpRefs.current[i] = r; }}
                      style={[S.otpBox, d ? S.otpBoxFilled : null, webInput]}
                      value={d}
                      onChangeText={t => handleOtpChange(t, i)}
                      onKeyPress={e => handleOtpKeyPress(e, i)}
                      keyboardType="number-pad"
                      maxLength={6}
                      textContentType="oneTimeCode"
                      selectTextOnFocus
                    />
                  ))}
                </View>

                {loading && (
                  <ActivityIndicator color={C.brand} style={{ marginTop: 16 }} />
                )}

                <View style={{ alignItems: 'center', marginTop: 20 }}>
                  {countdown > 0 ? (
                    <Text style={{ color: C.sub, fontSize: 15 }}>
                      {t('auth.resend_in') || 'Reenviar en'}{' '}
                      <Text style={{ color: C.brand, fontWeight: '700' }}>{countdown}s</Text>
                    </Text>
                  ) : (
                    <TouchableOpacity onPress={handleResend} disabled={loading}>
                      <Text style={{ color: C.accent, fontSize: 15, fontWeight: '600' }}>
                        {t('auth.resend_code') || 'Reenviar código'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>

                <TouchableOpacity
                  onPress={() => handleVerifyOTP()}
                  disabled={loading || otpCode.join('').length !== 6}
                  style={[S.primaryBtn, { marginTop: 24 }, (loading || otpCode.join('').length !== 6) && { opacity: 0.5 }]}
                >
                  <Text style={S.btnText}>{t('auth.verify') || 'Verificar'}</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ══════ EMAIL LOGIN ══════ */}
            {mode === 'email' && (
              <View style={S.formWrap}>
                <View style={S.darkField}>
                  <Ionicons name="mail-outline" size={20} color={C.muted} style={{ marginRight: 12 }} />
                  <TextInput
                    style={[S.darkInput, webInput]}
                    value={email}
                    onChangeText={setEmail}
                    placeholder="Email"
                    placeholderTextColor={C.muted}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoFocus
                  />
                </View>

                <View style={S.darkField}>
                  <Ionicons name="lock-closed-outline" size={20} color={C.muted} style={{ marginRight: 12 }} />
                  <TextInput
                    style={[S.darkInput, webInput]}
                    value={password}
                    onChangeText={setPassword}
                    placeholder={t('auth.password') || 'Contraseña'}
                    placeholderTextColor={C.muted}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={22} color={C.muted} />
                  </TouchableOpacity>
                </View>

                <TouchableOpacity onPress={handleEmailLogin} disabled={loading} style={[S.primaryBtn, loading && { opacity: 0.5 }]}>
                  {loading ? <ActivityIndicator color="#fff" /> : (
                    <Text style={S.btnText}>{t('auth.loginButton2') || 'Iniciar Sesión'}</Text>
                  )}
                </TouchableOpacity>

                <View style={S.divider}>
                  <View style={S.divLine} />
                  <Text style={S.divText}>o</Text>
                  <View style={S.divLine} />
                </View>

                <TouchableOpacity onPress={() => switchMode('phone')} style={S.outlineBtn}>
                  <Ionicons name="call-outline" size={20} color={C.sub} />
                  <Text style={S.outlineBtnText}>{t('auth.login_with_phone') || 'Iniciar con Teléfono'}</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ── Spacer ── */}
            <View style={{ flex: 1 }} />

            {/* ── Footer ── */}
            <View style={S.footer}>
              <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
                <Text style={S.footerText}>
                  {t('auth.dontHaveAccount') || '¿No tienes cuenta?'}{' '}
                  <Text style={S.footerLink}>{t('auth.register') || 'Regístrate'}</Text>
                </Text>
              </TouchableOpacity>
            </View>

          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  safe: { flex: 1, backgroundColor: C.bg },
  scroll: { flexGrow: 1, paddingHorizontal: 24 },

  backBtn: { marginTop: 8, marginBottom: -8, alignSelf: 'flex-start' },

  // Logo
  logoWrap: { alignItems: 'center', marginTop: 40 },
  logoCircle: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 8,
  },
  logoImg: { width: 78, height: 78 },

  // Title
  title: { fontSize: 28, fontWeight: '800', color: C.white, textAlign: 'center', marginTop: 20 },
  subtitle: { fontSize: 15, color: C.sub, textAlign: 'center', marginTop: 6, marginBottom: 32, lineHeight: 22 },

  // Form
  formWrap: { gap: 14 },

  // Dark input fields (like Mi Caso USA)
  darkField: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.input, borderRadius: 14,
    paddingHorizontal: 16, height: 56,
    borderWidth: 1, borderColor: C.border,
  },
  darkInput: {
    flex: 1, fontSize: 16, color: C.white,
    paddingVertical: 0, backgroundColor: 'transparent',
  },
  flagPrefix: { fontSize: 16, color: C.white, fontWeight: '600' },
  fieldDivider: { width: 1, height: 24, backgroundColor: C.border, marginHorizontal: 12 },

  // Primary button (Ross Tax red)
  primaryBtn: {
    backgroundColor: C.brand, borderRadius: 14,
    height: 56, alignItems: 'center', justifyContent: 'center',
    shadowColor: C.brand, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  btnInner: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  btnText: { fontSize: 17, fontWeight: '700', color: '#fff' },

  // Outline button
  outlineBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderRadius: 14, height: 56, gap: 10,
    borderWidth: 1, borderColor: C.border,
  },
  outlineBtnText: { fontSize: 16, fontWeight: '600', color: C.sub },

  // Divider
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 4 },
  divLine: { flex: 1, height: 1, backgroundColor: C.border },
  divText: { color: C.muted, fontSize: 14, marginHorizontal: 16 },

  // OTP
  otpRow: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginTop: 8 },
  otpBox: {
    width: 48, height: 58, borderRadius: 12,
    backgroundColor: C.input, borderWidth: 2, borderColor: C.border,
    textAlign: 'center', fontSize: 24, fontWeight: '800', color: C.white,
  },
  otpBoxFilled: { borderColor: C.brand, backgroundColor: '#2A1520' },

  // Footer
  footer: { alignItems: 'center', paddingVertical: 30 },
  footerText: { fontSize: 15, color: C.sub },
  footerLink: { color: C.accent, fontWeight: '700' },
});
