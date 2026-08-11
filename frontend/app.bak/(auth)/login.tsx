import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView,
  Platform, ScrollView, ActivityIndicator, Alert, Keyboard, StatusBar, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../src/contexts/AuthContext';
import { Colors, Gradients, API_URL } from '../../src/constants/theme';
import { useBiometricAuth } from '../../src/hooks/useBiometricAuth';

type AuthMode = 'phone' | 'email';
type PhoneStep = 'number' | 'code';

export default function LoginScreen() {
  const { t } = useTranslation();
  const { login, loginWithOTP, loginWithToken } = useAuth();
  const biometric = useBiometricAuth();

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
  const biometricTriggered = React.useRef(false);

  // ── Biometric Login handler ──
  const handleBiometricLogin = React.useCallback(async () => {
    if (biometricTriggered.current) return;
    biometricTriggered.current = true;
    setLoading(true);
    try {
      const res = await biometric.authenticate();
      if (res.success) {
        // Case 1: New token-based flow
        if (res.token) {
          const lr = await loginWithToken(res.token);
          if (lr.success) { 
            router.replace('/(tabs)'); 
            return;
          } else { 
            // Token expired — disable and let user login manually
            await biometric.disable(); 
            Alert.alert(t('login.sessionExpired', 'Session expired'), t('login.sessionExpiredMsg', 'Your session has expired. Log in manually and Face ID will reactivate automatically.')); 
          }
        }
        // Case 2: Legacy password migration — login with password, then save token
        else if (res.legacyPassword && res.email) {
          const lr = await login(res.email, res.legacyPassword);
          if (lr.success && lr.token) {
            // Migrate: save the new token for future biometric logins
            await biometric.enableWithToken(res.email, lr.token);
            router.replace('/(tabs)'); 
            return;
          } else {
            await biometric.disable();
            Alert.alert(t('login.passwordChanged', 'Password changed'), t('login.passwordChangedMsg', 'Your password has been updated. Log in manually to reactivate Face ID.'));
          }
        }
        // Case 3: No stored data
        else {
          await biometric.disable();
          Alert.alert('Face ID', t('login.reactivateFaceId', 'You need to reactivate Face ID from your profile after logging in.'));
        }
      }
    } catch (e) {
      console.log('Biometric login error:', e);
    }
    setLoading(false);
    biometricTriggered.current = false;
  }, [biometric.authenticate, biometric.disable, biometric.enableWithToken, login, loginWithToken]);

  // ── Auto-trigger biometric on mount if enabled ──
  useEffect(() => {
    if (!biometric.isAvailable || !biometric.isEnabled || biometricTriggered.current) return;
    const timer = setTimeout(() => {
      handleBiometricLogin();
    }, 600);
    return () => clearTimeout(timer);
  }, [biometric.isAvailable, biometric.isEnabled]);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const formatPhone = (raw: string) => {
    const d = raw.replace(/\D/g, '').slice(0, 10);
    if (d.length <= 3) return d;
    if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  };
  const cleanPhone = () => phone.replace(/\D/g, '');

  // \u2500\u2500 OTP Handlers \u2500\u2500
  const handleSendOTP = async () => {
    const digits = cleanPhone();
    if (digits.length < 10) {
      Alert.alert(t('common.error'), t('auth.enterDigits'));
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/phone/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: digits }),
      });
      if (res.ok) {
        setPhoneStep('code');
        setCountdown(60);
        setOtpCode(['', '', '', '', '', '']);
        setTimeout(() => otpRefs.current[0]?.focus(), 300);
      } else {
        const err = await res.json();
        Alert.alert(t('common.error'), err.detail || t('auth.sendError'));
      }
    } catch (e) {
      Alert.alert(t('common.error'), t('common.connectionError'));
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
      const result = await loginWithOTP(cleanPhone(), code);
      if (result.success) {
        router.replace('/(tabs)');
      } else {
        Alert.alert(t('common.error'), result.error || t('auth.incorrectCode'));
        setOtpCode(['', '', '', '', '', '']);
        setTimeout(() => otpRefs.current[0]?.focus(), 100);
      }
    } catch (e) {
      Alert.alert(t('common.error'), t('auth.incorrectCode'));
      setOtpCode(['', '', '', '', '', '']);
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

  const handleResend = async () => {
    if (countdown > 0) return;
    setLoading(true);
    try {
      await fetch(`${API_URL}/api/auth/phone/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: cleanPhone() }),
      });
      setCountdown(60);
      setOtpCode(['', '', '', '', '', '']);
      Alert.alert('\u2705', t('auth.codeSent'));
    } catch {
      Alert.alert(t('common.error'), t('auth.resendError'));
    } finally {
      setLoading(false);
    }
  };

  // \u2500\u2500 Email Login \u2500\u2500
  const handleEmailLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert(t('common.error'), t('auth.fillAllFields'));
      return;
    }
    setLoading(true);
    const result = await login(email.trim().toLowerCase(), password);
    setLoading(false);
    if (result.success) {
      const freshToken = result.token || '';
      if (biometric.isAvailable && !biometric.isEnabled) {
        const bl = biometric.biometricType === 'face' ? 'Face ID' : 'Touch ID';
        Alert.alert(
          `Activar ${bl}`,
          `\u00bfDeseas usar ${bl} para iniciar sesi\u00f3n m\u00e1s r\u00e1pido?`,
          [
            { text: 'No ahora', style: 'cancel', onPress: () => router.replace('/(tabs)') },
            { text: 'Activar', onPress: async () => { await biometric.enableWithToken(email.trim().toLowerCase(), freshToken); router.replace('/(tabs)'); } },
          ]
        );
      } else {
        if (biometric.isEnabled) await biometric.enableWithToken(email.trim().toLowerCase(), freshToken);
        router.replace('/(tabs)');
      }
    } else {
      Alert.alert(t('common.error'), result.error || t('auth.wrongCredentials'));
    }
  };

  const switchMode = (m: AuthMode) => { setMode(m); setPhoneStep('number'); };

  return (
    <View style={S.root}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView style={S.safe} edges={['top', 'bottom']}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={S.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

            {/* Back button on OTP step */}
            {mode === 'phone' && phoneStep === 'code' && (
              <TouchableOpacity onPress={() => { setPhoneStep('number'); setOtpCode(['','','','','','']); }} style={S.backBtn}>
                <Ionicons name="arrow-back" size={24} color={Colors.text} />
              </TouchableOpacity>
            )}

            {/* Logo */}
            <View style={S.logoWrap}>
              <View style={S.logoGlow}>
                <View style={S.logoBorder}>
                  <Image
                    source={require('../../assets/app-icon.png')}
                    style={S.logoImage}
                  />
                </View>
              </View>
            </View>

            {/* \u2500\u2500 Title \u2500\u2500 */}
            <Text style={S.title}>
              {mode === 'phone' && phoneStep === 'code'
                ? t('auth.verifyCode')
                : t('auth.welcome')}
            </Text>
            <Text style={S.subtitle}>
              {mode === 'phone' && phoneStep === 'code'
                ? `${t('auth.codeSentTo')} +1 ${formatPhone(phone)}`
                : t('auth.accessPortal')}
            </Text>

            {/* \u2550\u2550\u2550\u2550\u2550\u2550 PHONE NUMBER \u2550\u2550\u2550\u2550\u2550\u2550 */}
            {mode === 'phone' && phoneStep === 'number' && (
              <View style={S.formWrap}>
                <View style={S.darkField}>
                  <Text style={S.flagPrefix}>US  +1</Text>
                  <View style={S.fieldDivider} />
                  <TextInput
                    style={S.darkInput}
                    value={formatPhone(phone)}
                    onChangeText={(text) => setPhone(text.replace(/\D/g, '').slice(0, 10))}
                    placeholder={t('auth.phonePlaceholder')}
                    placeholderTextColor={Colors.textMuted}
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
                  <LinearGradient colors={Gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={S.btnGradient}>
                    {loading ? <ActivityIndicator color="#fff" /> : (
                      <View style={S.btnInner}>
                        <Ionicons name="chatbubble-outline" size={20} color="#fff" />
                        <Text style={S.btnText}>{t('auth.sendSMS')}</Text>
                      </View>
                    )}
                  </LinearGradient>
                </TouchableOpacity>

                <View style={S.divider}>
                  <View style={S.divLine} />
                  <Text style={S.divText}>{t('auth.or')}</Text>
                  <View style={S.divLine} />
                </View>

                <TouchableOpacity onPress={() => switchMode('email')} style={S.outlineBtn}>
                  <Ionicons name="mail-outline" size={20} color={Colors.textSecondary} />
                  <Text style={S.outlineBtnText}>{t('auth.loginWithEmail')}</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* \u2550\u2550\u2550\u2550\u2550\u2550 OTP CODE \u2550\u2550\u2550\u2550\u2550\u2550 */}
            {mode === 'phone' && phoneStep === 'code' && (
              <View style={S.formWrap}>
                <View style={S.otpRow}>
                  {otpCode.map((d, i) => (
                    <TextInput
                      key={i}
                      ref={r => { otpRefs.current[i] = r; }}
                      style={[S.otpBox, d ? S.otpBoxFilled : null]}
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
                  <ActivityIndicator color={Colors.primary} style={{ marginTop: 16 }} />
                )}

                <View style={{ alignItems: 'center', marginTop: 20 }}>
                  {countdown > 0 ? (
                    <Text style={{ color: Colors.textSecondary, fontSize: 15 }}>
                      {t('auth.resendIn')}{' '}
                      <Text style={{ color: Colors.primary, fontWeight: '700' }}>{countdown}s</Text>
                    </Text>
                  ) : (
                    <TouchableOpacity onPress={handleResend} disabled={loading}>
                      <Text style={{ color: Colors.primaryLight, fontSize: 15, fontWeight: '600' }}>
                        {t('auth.resendCode')}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>

                <TouchableOpacity
                  onPress={() => handleVerifyOTP()}
                  disabled={loading || otpCode.join('').length !== 6}
                  style={[S.primaryBtn, { marginTop: 24 }, (loading || otpCode.join('').length !== 6) && { opacity: 0.5 }]}
                >
                  <LinearGradient colors={Gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={S.btnGradient}>
                    <Text style={S.btnText}>{t('auth.verify')}</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            )}

            {/* \u2550\u2550\u2550\u2550\u2550\u2550 EMAIL LOGIN \u2550\u2550\u2550\u2550\u2550\u2550 */}
            {mode === 'email' && (
              <View style={S.formWrap}>
                <View style={S.darkField}>
                  <Ionicons name="mail-outline" size={20} color={Colors.textMuted} style={{ marginRight: 12 }} />
                  <TextInput
                    style={S.darkInput}
                    value={email}
                    onChangeText={setEmail}
                    placeholder={t('auth.email')}
                    placeholderTextColor={Colors.textMuted}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoFocus
                  />
                </View>

                <View style={S.darkField}>
                  <Ionicons name="lock-closed-outline" size={20} color={Colors.textMuted} style={{ marginRight: 12 }} />
                  <TextInput
                    style={S.darkInput}
                    value={password}
                    onChangeText={setPassword}
                    placeholder={t('auth.password')}
                    placeholderTextColor={Colors.textMuted}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={22} color={Colors.textMuted} />
                  </TouchableOpacity>
                </View>

                <TouchableOpacity onPress={handleEmailLogin} disabled={loading} style={[S.primaryBtn, loading && { opacity: 0.5 }]}>
                  <LinearGradient colors={Gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={S.btnGradient}>
                    {loading ? <ActivityIndicator color="#fff" /> : (
                      <Text style={S.btnText}>{t('auth.login')}</Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>

                {/* Forgot Password */}
                <TouchableOpacity
                  onPress={async () => {
                    if (!email.trim()) {
                      Alert.alert('', t('auth.enterEmail'));
                      return;
                    }
                    try {
                      const res = await fetch(`${API_URL}/api/auth/forgot-password`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email: email.trim().toLowerCase() }),
                      });
                      if (res.ok) {
                        Alert.alert(t('auth.emailSent'), t('auth.resetInstructions'));
                      }
                    } catch {
                      Alert.alert(t('common.error'), t('common.connectionError'));
                    }
                  }}
                  style={{ alignSelf: 'flex-end', marginTop: 8 }}
                >
                  <Text style={{ color: Colors.primaryLight, fontSize: 13, fontWeight: '600' }}>
                    {t('auth.forgotPassword')}
                  </Text>
                </TouchableOpacity>

                <View style={S.divider}>
                  <View style={S.divLine} />
                  <Text style={S.divText}>{t('auth.or')}</Text>
                  <View style={S.divLine} />
                </View>

                <TouchableOpacity onPress={() => switchMode('phone')} style={S.outlineBtn}>
                  <Ionicons name="call-outline" size={20} color={Colors.textSecondary} />
                  <Text style={S.outlineBtnText}>{t('auth.loginWithPhone')}</Text>
                </TouchableOpacity>

                {/* Biometric Login Button */}
                {biometric.isAvailable && biometric.isEnabled && (
                  <TouchableOpacity onPress={handleBiometricLogin} disabled={loading} style={[S.outlineBtn, { marginTop: 10, borderColor: 'rgba(52,211,153,0.3)', backgroundColor: 'rgba(52,211,153,0.05)' }]}>
                    <Ionicons name={biometric.biometricType === 'face' ? 'scan-outline' : 'finger-print-outline'} size={22} color="#34D399" />
                    <Text style={[S.outlineBtnText, { color: '#34D399' }]}>
                      {biometric.biometricType === 'face' ? 'Iniciar con Face ID' : 'Iniciar con Touch ID'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* \u2500\u2500 Footer \u2500\u2500 */}
            <View style={S.footer}>
              <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
                <Text style={S.footerText}>
                  {t('auth.noAccount')}{' '}
                  <Text style={S.footerLink}>{t('auth.register')}</Text>
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
  root: { flex: 1, backgroundColor: Colors.bg },
  safe: { flex: 1, backgroundColor: Colors.bg },
  scroll: { flexGrow: 1, paddingHorizontal: 24, justifyContent: 'center' },

  backBtn: { marginTop: 8, marginBottom: -8, alignSelf: 'flex-start' },

  // Logo
  logoWrap: { alignItems: 'center', marginTop: 20 },
  logoGlow: {
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 12,
  },
  logoBorder: {
    width: 130,
    height: 130,
    borderRadius: 32,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },

  // Title
  title: { fontSize: 28, fontWeight: '800', color: Colors.text, textAlign: 'center', marginTop: 20 },
  subtitle: { fontSize: 15, color: Colors.textSecondary, textAlign: 'center', marginTop: 6, marginBottom: 32, lineHeight: 22 },

  // Form
  formWrap: { gap: 14 },

  // Dark input fields
  darkField: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface, borderRadius: 14,
    paddingHorizontal: 16, height: 56,
    borderWidth: 1, borderColor: Colors.border,
  },
  darkInput: {
    flex: 1, fontSize: 16, color: Colors.text,
    paddingVertical: 0, backgroundColor: 'transparent',
  },
  flagPrefix: { fontSize: 16, color: Colors.text, fontWeight: '600' },
  fieldDivider: { width: 1, height: 24, backgroundColor: Colors.border, marginHorizontal: 12 },

  // Primary button
  primaryBtn: { borderRadius: 14, overflow: 'hidden' },
  btnGradient: { height: 56, alignItems: 'center', justifyContent: 'center', borderRadius: 14 },
  btnInner: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  btnText: { fontSize: 17, fontWeight: '700', color: '#fff' },

  // Outline button
  outlineBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderRadius: 14, height: 56, gap: 10,
    borderWidth: 1, borderColor: Colors.border,
  },
  outlineBtnText: { fontSize: 16, fontWeight: '600', color: Colors.textSecondary },

  // Divider
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 4 },
  divLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  divText: { color: Colors.textMuted, fontSize: 14, marginHorizontal: 16 },

  // OTP
  otpRow: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginTop: 8 },
  otpBox: {
    width: 48, height: 58, borderRadius: 12,
    backgroundColor: Colors.surface, borderWidth: 2, borderColor: Colors.border,
    textAlign: 'center', fontSize: 24, fontWeight: '800', color: Colors.text,
  },
  otpBoxFilled: { borderColor: Colors.primary, backgroundColor: 'rgba(5, 150, 105, 0.1)' },

  // Footer
  footer: { alignItems: 'center', paddingVertical: 30 },
  footerText: { fontSize: 15, color: Colors.textSecondary },
  footerLink: { color: Colors.primaryLight, fontWeight: '700' },
});
