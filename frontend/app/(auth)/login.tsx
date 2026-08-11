import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator, ScrollView,
  Keyboard, StatusBar, Image, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../src/contexts/AuthContext';
import { BorderRadius, Shadows, useColors } from '../../src/constants/theme';
import CompleteProfileModal from '../../src/components/CompleteProfileModal';

type AuthMode = 'phone' | 'email';
type PhoneStep = 'number' | 'code';

export default function LoginScreen() {
  const C = useColors();
  const S = React.useMemo(() => createStyles(C), [C]);
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { loginWithEmail, adminLoginStep1, adminLoginStep2, signInWithOTP, sendOTP } = useAuth();

  const [mode, setMode] = useState<AuthMode>('phone');
  const [phoneStep, setPhoneStep] = useState<PhoneStep>('number');

  // Phone OTP
  const [phone, setPhone] = useState('');
  const [otpCode, setOtpCode] = useState(['', '', '', '', '', '']);
  const [countdown, setCountdown] = useState(0);
  const otpRefs = useRef<(TextInput | null)[]>([]);

  // Email
  const [adminChallenge, setAdminChallenge] = useState<{ id: string; masked: string } | null>(null);
  const [adminOtp, setAdminOtp] = useState('');
  const [adminVerifying, setAdminVerifying] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const isES = i18n.language === 'es';

  // Complete Profile Modal (for new users)
  const [showCompleteProfile, setShowCompleteProfile] = useState(false);
  const [formattedPhone, setFormattedPhone] = useState('');

  const toggleLang = () => {
    i18n.changeLanguage(isES ? 'en' : 'es');
  };

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // ── Phone Formatting ──
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
      Alert.alert('Error', t('auth.phone_invalid'));
      return;
    }
    setLoading(true);
    try {
      await sendOTP(digits);
      setPhoneStep('code');
      setCountdown(60);
      setOtpCode(['', '', '', '', '', '']);
      setTimeout(() => otpRefs.current[0]?.focus(), 300);
    } catch (e: any) {
      Alert.alert('Error', e.message || t('auth.otp_send_error'));
    } finally {
      setLoading(false);
    }
  };

  const verifyingRef = useRef(false);

  const handleVerifyOTP = async (codeOverride?: string) => {
    const code = codeOverride || otpCode.join('');
    if (code.length !== 6) return;
    // Prevent double calls (auto-verify + button click race condition)
    if (verifyingRef.current || loading) return;
    verifyingRef.current = true;
    setLoading(true);
    Keyboard.dismiss();
    try {
      const result = await signInWithOTP(cleanPhone(), code);
      
      // Check if new user needs to complete profile
      if (result.is_new_user && !result.profile_complete) {
        // Save formatted phone for the modal
        setFormattedPhone(phone);
        setShowCompleteProfile(true);
        setLoading(false);
        verifyingRef.current = false;
      } else {
        // Existing user or profile already complete - go to dashboard
        router.replace('/(tabs)');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || t('auth.otp_invalid'));
      setOtpCode(['', '', '', '', '', '']);
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
      setLoading(false);
      verifyingRef.current = false;
    }
  };

  // Handle profile completion
  const handleProfileComplete = (updatedUser: any) => {
    setShowCompleteProfile(false);
    router.replace('/(tabs)');
  };

  const handleOtpChange = (text: string, idx: number) => {
    // Handle paste of full code
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
      Alert.alert('Error', t('auth.fill_all_fields'));
      return;
    }
    setLoading(true);
    try {
      await loginWithEmail(email.trim(), password);
      router.replace('/(tabs)');
    } catch (err: any) {
      if ((err?.message || '') === 'admin_2fa_required') {
        // Cuenta admin → flujo con verificación en dos pasos (OTP)
        try {
          const res = await adminLoginStep1(email.trim(), password);
          if (res.step === 'complete') {
            router.replace('/(tabs)');
          } else if (res.step === 'otp_required' && res.challenge_id) {
            setAdminChallenge({ id: res.challenge_id, masked: res.masked || '' });
            setAdminOtp('');
          }
        } catch (e2: any) {
          Alert.alert('Error', e2?.message || t('auth.login_error'));
        }
      } else {
        Alert.alert('Error', err.message || t('auth.login_error'));
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Admin OTP (2FA) ──
  const handleAdminOtpVerify = async () => {
    if (!adminChallenge || adminOtp.trim().length !== 6) return;
    setAdminVerifying(true);
    try {
      await adminLoginStep2(adminChallenge.id, adminOtp.trim());
      setAdminChallenge(null);
      router.replace('/(tabs)');
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Código inválido');
    } finally {
      setAdminVerifying(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0) return;
    setLoading(true);
    try {
      await sendOTP(cleanPhone());
      setCountdown(60);
      setOtpCode(['', '', '', '', '', '']);
      Alert.alert('✅', t('auth.otp_resent'));
    } catch {
      Alert.alert('Error', t('auth.otp_send_error'));
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (m: AuthMode) => {
    setMode(m);
    setPhoneStep('number');
  };

  const webInput = Platform.OS === 'web' ? { outline: 'none', borderWidth: 0 } as any : {};

  return (
    <View style={S.root}>
      <StatusBar barStyle="light-content" />

      {/* ── Background Glow Effects ── */}
      <View style={S.bgGlow1} />
      <View style={S.bgGlow2} />
      <View style={S.gridLine1} />
      <View style={S.gridLine2} />

      <SafeAreaView style={S.safe} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={S.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Header Row: Back (on OTP step) + Language Toggle */}
            <View style={S.headerRow}>
              {mode === 'phone' && phoneStep === 'code' ? (
                <TouchableOpacity
                  onPress={() => { setPhoneStep('number'); setOtpCode(['', '', '', '', '', '']); }}
                  style={S.backBtn}
                >
                  <Ionicons name="arrow-back" size={24} color={C.white} />
                </TouchableOpacity>
              ) : (
                <View style={{ width: 40 }} />
              )}
              <TouchableOpacity
                style={S.langToggle}
                onPress={toggleLang}
                activeOpacity={0.7}
              >
                <Ionicons name="globe-outline" size={16} color={C.textMuted} />
                <View style={S.langOptions}>
                  <View style={[S.langOption, isES && S.langOptionActive]}>
                    <Text style={[S.langOptionText, isES && S.langOptionTextActive]}>ES</Text>
                  </View>
                  <View style={S.langDivider} />
                  <View style={[S.langOption, !isES && S.langOptionActive]}>
                    <Text style={[S.langOptionText, !isES && S.langOptionTextActive]}>EN</Text>
                  </View>
                </View>
              </TouchableOpacity>
            </View>

            {/* ── Official Ross House Rentals Logo ── */}
            <View style={S.logoWrap}>
              <View style={S.logoHaloOuter} />
              <View style={S.logoHaloInner} />
              <View style={S.logoGlowRed} />
              <Image
                source={C.background === '#F8FAFC' ? require('../../assets/images/ross_house_logo.png') : require('../../assets/images/ross_house_logo_white.png')}
                style={S.officialLogo}
                resizeMode="contain"
              />
            </View>

            {/* ── Title ── */}
            <Text style={S.title}>
              {mode === 'phone' && phoneStep === 'code'
                ? t('auth.verify_code')
                : t('auth.welcome_back')}
            </Text>
            <Text style={S.subtitle}>
              {mode === 'phone' && phoneStep === 'code'
                ? `${t('auth.code_sent_to')} +1 ${formatPhone(phone)}`
                : mode === 'phone'
                  ? t('auth.enter_phone_desc')
                  : t('auth.enter_credentials')}
            </Text>

            {/* ══════ PHONE NUMBER STEP ══════ */}
            {mode === 'phone' && phoneStep === 'number' && (
              <View style={S.formWrap}>
                <View style={S.darkField}>
                  <Text style={S.flagPrefix}>🇺🇸  +1</Text>
                  <View style={S.fieldDivider} />
                  <TextInput
                    style={[S.darkInput, webInput]}
                    value={formatPhone(phone)}
                    onChangeText={(val) => setPhone(val.replace(/\D/g, '').slice(0, 10))}
                    placeholder="(555) 123-4567"
                    placeholderTextColor={C.textMuted}
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
                  <LinearGradient
                    colors={['#C8102E', '#9B1B30']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[StyleSheet.absoluteFill, { borderRadius: 14 }]}
                  />
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <View style={S.btnInner}>
                      <Ionicons name="chatbubble-outline" size={20} color="#fff" />
                      <Text style={S.btnText}>{t('auth.send_code')}</Text>
                    </View>
                  )}
                </TouchableOpacity>

                <View style={S.divider}>
                  <View style={S.divLine} />
                  <Text style={S.divText}>o</Text>
                  <View style={S.divLine} />
                </View>

                <TouchableOpacity onPress={() => switchMode('email')} style={S.outlineBtn}>
                  <Ionicons name="mail-outline" size={20} color={C.textSecondary} />
                  <Text style={S.outlineBtnText}>{t('auth.login_with_email')}</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ══════ OTP CODE STEP ══════ */}
            {mode === 'phone' && phoneStep === 'code' && (
              <View style={S.formWrap}>
                <View style={S.otpRow}>
                  {otpCode.map((d, i) => (
                    <TextInput
                      key={i}
                      ref={r => { otpRefs.current[i] = r; }}
                      style={[S.otpBox, d ? S.otpBoxFilled : null, webInput]}
                      value={d}
                      onChangeText={text => handleOtpChange(text, i)}
                      onKeyPress={e => handleOtpKeyPress(e, i)}
                      keyboardType="number-pad"
                      maxLength={6}
                      textContentType="oneTimeCode"
                      selectTextOnFocus
                    />
                  ))}
                </View>

                {loading && (
                  <ActivityIndicator color={C.brandRed} style={{ marginTop: 16 }} />
                )}

                <View style={{ alignItems: 'center', marginTop: 20 }}>
                  {countdown > 0 ? (
                    <Text style={{ color: C.textSecondary, fontSize: 15 }}>
                      {t('auth.resend_in')}{' '}
                      <Text style={{ color: C.brandRed, fontWeight: '700' }}>{countdown}s</Text>
                    </Text>
                  ) : (
                    <TouchableOpacity onPress={handleResend} disabled={loading}>
                      <Text style={{ color: C.warmGold, fontSize: 15, fontWeight: '600' }}>
                        {t('auth.resend_code')}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>

                <TouchableOpacity
                  onPress={() => handleVerifyOTP()}
                  disabled={loading || otpCode.join('').length !== 6}
                  style={[S.primaryBtn, { marginTop: 24 }, (loading || otpCode.join('').length !== 6) && { opacity: 0.5 }]}
                >
                  <LinearGradient
                    colors={['#C8102E', '#9B1B30']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[StyleSheet.absoluteFill, { borderRadius: 14 }]}
                  />
                  <Text style={S.btnText}>{t('auth.verify')}</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ══════ EMAIL LOGIN ══════ */}
            {mode === 'email' && (
              <View style={S.formWrap}>
                <View style={S.darkField}>
                  <Ionicons name="mail-outline" size={20} color={C.textMuted} style={{ marginRight: 12 }} />
                  <TextInput
                    style={[S.darkInput, webInput]}
                    value={email}
                    onChangeText={setEmail}
                    placeholder="Email"
                    placeholderTextColor={C.textMuted}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoFocus
                  />
                </View>

                <View style={S.darkField}>
                  <Ionicons name="lock-closed-outline" size={20} color={C.textMuted} style={{ marginRight: 12 }} />
                  <TextInput
                    style={[S.darkInput, webInput]}
                    value={password}
                    onChangeText={setPassword}
                    placeholder={t('auth.password')}
                    placeholderTextColor={C.textMuted}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={22}
                      color={C.textMuted}
                    />
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  onPress={handleEmailLogin}
                  disabled={loading}
                  style={[S.primaryBtn, loading && { opacity: 0.5 }]}
                >
                  <LinearGradient
                    colors={['#C8102E', '#9B1B30']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[StyleSheet.absoluteFill, { borderRadius: 14 }]}
                  />
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={S.btnText}>{t('auth.login_button')}</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => router.push('/forgot-password')}
                  style={S.forgotBtn}
                >
                  <Text style={S.forgotText}>{t('auth.forgot_password')}</Text>
                </TouchableOpacity>

                <View style={S.divider}>
                  <View style={S.divLine} />
                  <Text style={S.divText}>o</Text>
                  <View style={S.divLine} />
                </View>

                <TouchableOpacity onPress={() => switchMode('phone')} style={S.outlineBtn}>
                  <Ionicons name="call-outline" size={20} color={C.textSecondary} />
                  <Text style={S.outlineBtnText}>{t('auth.login_with_phone')}</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ── Spacer ── */}
            <View style={{ flex: 1 }} />

            {/* ── Footer ── */}
            <View style={S.footer}>
              <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
                <Text style={S.footerText}>
                  {t('auth.no_account')}{' '}
                  <Text style={S.footerLink}>{t('auth.register')}</Text>
                </Text>
              </TouchableOpacity>
            </View>

          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* Complete Profile Modal for new users */}
      <CompleteProfileModal
        visible={showCompleteProfile}
        onComplete={handleProfileComplete}
        phone={formattedPhone}
      />

      {/* Admin 2FA (OTP) Modal */}
      <Modal visible={!!adminChallenge} transparent animationType="fade" onRequestClose={() => setAdminChallenge(null)}>
        <View style={S.otpModalWrap}>
          <View style={S.otpModalCard}>
            <Ionicons name="shield-checkmark" size={34} color={C.brandRed} style={{ alignSelf: 'center', marginBottom: 8 }} />
            <Text style={S.otpModalTitle}>Verificación de seguridad</Text>
            <Text style={S.otpModalSub}>
              Enviamos un código de 6 dígitos a {adminChallenge?.masked || 'tu correo'}
            </Text>
            <TextInput
              style={S.otpModalInput}
              value={adminOtp}
              onChangeText={(v) => setAdminOtp(v.replace(/[^0-9]/g, '').slice(0, 6))}
              keyboardType="number-pad"
              maxLength={6}
              placeholder="······"
              placeholderTextColor={C.textMuted}
              autoFocus
            />
            <TouchableOpacity
              style={[S.otpModalBtn, (adminOtp.length !== 6 || adminVerifying) && { opacity: 0.5 }]}
              onPress={handleAdminOtpVerify}
              disabled={adminOtp.length !== 6 || adminVerifying}
            >
              {adminVerifying
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={S.otpModalBtnText}>Verificar</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setAdminChallenge(null)} style={{ marginTop: 12, minHeight: 34, justifyContent: 'center' }}>
              <Text style={S.otpModalCancel}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (C: any) => StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },
  safe: { flex: 1, backgroundColor: 'transparent' },
  scroll: { flexGrow: 1, paddingHorizontal: 24 },

  // Background Glow Effects
  bgGlow1: {
    position: 'absolute',
    top: -60,
    right: -30,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: C.brandRed,
    opacity: 0.06,
  },
  bgGlow2: {
    position: 'absolute',
    bottom: '25%',
    left: -50,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: C.brandRed,
    opacity: 0.04,
  },
  gridLine1: {
    position: 'absolute',
    top: '35%',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: C.glass,
  },
  gridLine2: {
    position: 'absolute',
    top: '60%',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: C.glass,
  },

  // Header Row
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Language Toggle
  langToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: BorderRadius.full,
    backgroundColor: C.glass,
    borderWidth: 1,
    borderColor: C.glassBorder,
  },
  langOptions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  langOption: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  langOptionActive: {
    backgroundColor: C.brandRed,
  },
  langDivider: {
    width: 1,
    height: 14,
    backgroundColor: C.glassLight,
  },
  langOptionText: {
    fontSize: 12,
    fontWeight: '700',
    color: C.textMuted,
  },
  langOptionTextActive: {
    color: C.textPrimary,
  },

  // Official PNG Logo wrapper with premium ambient effects
  logoWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    marginBottom: -10,
    height: 200,
    position: 'relative',
  },
  logoHaloOuter: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: 'rgba(200,16,46,0.10)',
  },
  logoHaloInner: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 1,
    borderColor: 'rgba(200,16,46,0.18)',
  },
  logoGlowRed: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: C.brandRed,
    opacity: 0.10,
  },
  officialLogo: {
    width: 220,
    height: 180,
  },

  // Title
  title: {
    fontSize: 28, fontWeight: '800', color: C.textPrimary,
    textAlign: 'center', marginTop: 20,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15, color: C.textSecondary,
    textAlign: 'center', marginTop: 6, marginBottom: 32, lineHeight: 22,
  },

  // Form
  formWrap: { gap: 14 },

  // Glass input fields
  darkField: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.glass, borderRadius: 14,
    paddingHorizontal: 16, height: 56,
    borderWidth: 1, borderColor: C.glassBorder,
  },
  darkInput: {
    flex: 1, fontSize: 16, color: C.textPrimary,
    paddingVertical: 0, backgroundColor: 'transparent',
  },
  flagPrefix: { fontSize: 16, color: C.textPrimary, fontWeight: '600' },
  fieldDivider: { width: 1, height: 24, backgroundColor: C.glassLight, marginHorizontal: 12 },

  // Primary button (Gradient red)
  primaryBtn: {
    borderRadius: 14,
    height: 56, alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
    ...Shadows.button,
  },
  btnInner: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  btnText: { fontSize: 17, fontWeight: '700', color: C.textPrimary },

  // Outline button (Glass style)
  outlineBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderRadius: 14, height: 56, gap: 10,
    backgroundColor: C.glass,
    borderWidth: 1, borderColor: C.glassBorder,
  },
  outlineBtnText: { fontSize: 16, fontWeight: '600', color: C.textSecondary },

  // Divider
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 4 },
  divLine: { flex: 1, height: 1, backgroundColor: C.glassLight },
  divText: { color: C.textMuted, fontSize: 14, marginHorizontal: 16 },

  // OTP — Glass boxes
  otpRow: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginTop: 8 },
  otpBox: {
    width: 48, height: 58, borderRadius: 12,
    backgroundColor: C.glass, borderWidth: 2, borderColor: C.glassBorder,
    textAlign: 'center', fontSize: 24, fontWeight: '800', color: C.textPrimary,
  },
  otpBoxFilled: { borderColor: C.brandRed, backgroundColor: 'rgba(200,16,46,0.08)' },

  // Footer
  footer: { alignItems: 'center', paddingVertical: 24 },
  footerText: { fontSize: 15, color: C.textSecondary },
  footerLink: { color: C.brandRed, fontWeight: '700' },
  footerBrand: {
    color: C.textMuted, fontSize: 10, marginTop: 12, opacity: 0.4,
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  forgotBtn: { alignSelf: 'center', marginTop: 12, paddingVertical: 8, paddingHorizontal: 16 },
  forgotText: { fontSize: 13, color: C.brandRed, fontWeight: '600' },
  otpModalWrap: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 24 },
  otpModalCard: {
    backgroundColor: C.background === '#F8FAFC' ? '#FFFFFF' : '#16161A',
    borderRadius: 20, padding: 24, borderWidth: 1, borderColor: C.glassBorderLight,
  },
  otpModalTitle: { fontSize: 18, fontWeight: '800', color: C.textPrimary, textAlign: 'center' },
  otpModalSub: { fontSize: 13, color: C.textSecondary, textAlign: 'center', marginTop: 6, lineHeight: 19 },
  otpModalInput: {
    backgroundColor: C.glass, borderWidth: 1, borderColor: C.glassBorderLight, borderRadius: 14,
    fontSize: 26, fontWeight: '800', color: C.textPrimary, textAlign: 'center', letterSpacing: 10,
    paddingVertical: 14, marginTop: 18, minHeight: 56,
  },
  otpModalBtn: {
    backgroundColor: C.brandRed, borderRadius: 14, paddingVertical: 14, alignItems: 'center',
    justifyContent: 'center', marginTop: 14, minHeight: 48,
  },
  otpModalBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  otpModalCancel: { color: C.textMuted, fontSize: 13, textAlign: 'center', fontWeight: '600' },
});
