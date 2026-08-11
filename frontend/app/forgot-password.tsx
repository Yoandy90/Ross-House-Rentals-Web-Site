import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { Spacing, FontSizes, BorderRadius, useColors } from '../src/constants/theme';
import { apiCall } from '../src/utils/api';

type Step = 'email' | 'code' | 'newPassword' | 'done';

export default function ForgotPasswordScreen() {
  const C = useColors();
  const styles = React.useMemo(() => createStyles(C), [C]);
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phoneMasked, setPhoneMasked] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSendCode = async () => {
    if (!email.trim()) { Alert.alert('Error', t('forgot.email_required')); return; }
    setLoading(true);
    try {
      const data = await apiCall('/auth/forgot-password', { method: 'POST', body: { email: email.trim() }, auth: false });
      if (data.success) {
        setPhoneMasked(data.phone_masked || '***');
        setStep('code');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyAndReset = async () => {
    if (!code.trim() || code.length !== 6) { Alert.alert('Error', t('forgot.code_invalid')); return; }
    if (!newPassword || newPassword.length < 6) { Alert.alert('Error', t('forgot.password_min')); return; }
    if (newPassword !== confirmPassword) { Alert.alert('Error', t('forgot.password_mismatch')); return; }

    setLoading(true);
    try {
      const data = await apiCall('/auth/reset-password', {
        method: 'POST',
        body: { email: email.trim(), code: code.trim(), new_password: newPassword },
        auth: false,
      });
      if (data.success) { setStep('done'); }
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 'email':
        return (
          <>
            <View style={styles.iconWrap}>
              <Ionicons name="lock-open-outline" size={48} color={C.brandRed} />
            </View>
            <Text style={styles.title}>{t('forgot.title')}</Text>
            <Text style={styles.desc}>{t('forgot.desc')}</Text>

            <View style={styles.inputContainer}>
              <Ionicons name="mail-outline" size={18} color={C.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder={t('forgot.email_placeholder')}
                placeholderTextColor={C.textDim}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <TouchableOpacity style={styles.primaryBtn} onPress={handleSendCode} disabled={loading}>
              <LinearGradient colors={['#E11D48', '#9B1B30']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.primaryGradient}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{t('forgot.send_code')}</Text>}
              </LinearGradient>
            </TouchableOpacity>
          </>
        );

      case 'code':
        return (
          <>
            <View style={styles.iconWrap}>
              <Ionicons name="chatbubble-outline" size={48} color={C.brandRed} />
            </View>
            <Text style={styles.title}>{t('forgot.verify_title')}</Text>
            <Text style={styles.desc}>{t('forgot.code_sent_to')} {phoneMasked}</Text>

            <View style={styles.inputContainer}>
              <Ionicons name="keypad-outline" size={18} color={C.textMuted} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { letterSpacing: 8, textAlign: 'center', fontSize: 22, fontWeight: '700' }]}
                value={code}
                onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                placeholderTextColor={C.textDim}
                keyboardType="number-pad"
                maxLength={6}
              />
            </View>

            {code.length === 6 && (
              <>
                <Text style={[styles.sectionLabel, { marginTop: Spacing.lg }]}>{t('forgot.new_password')}</Text>
                <View style={styles.inputContainer}>
                  <Ionicons name="lock-closed-outline" size={18} color={C.textMuted} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    placeholder={t('forgot.new_password_placeholder')}
                    placeholderTextColor={C.textDim}
                    secureTextEntry={!showPassword}
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                    <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color={C.textMuted} />
                  </TouchableOpacity>
                </View>

                <View style={[styles.inputContainer, { marginTop: 12 }]}>
                  <Ionicons name="lock-closed-outline" size={18} color={C.textMuted} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholder={t('forgot.confirm_password')}
                    placeholderTextColor={C.textDim}
                    secureTextEntry={!showPassword}
                  />
                </View>
              </>
            )}

            <TouchableOpacity style={styles.primaryBtn} onPress={handleVerifyAndReset} disabled={loading || code.length !== 6}>
              <LinearGradient colors={code.length === 6 ? ['#E11D48', '#9B1B30'] : ['#333', '#222']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.primaryGradient}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{t('forgot.reset_password')}</Text>}
              </LinearGradient>
            </TouchableOpacity>
          </>
        );

      case 'done':
        return (
          <>
            <View style={styles.iconWrap}>
              <Ionicons name="checkmark-circle" size={60} color={C.success} />
            </View>
            <Text style={styles.title}>{t('forgot.success_title')}</Text>
            <Text style={styles.desc}>{t('forgot.success_desc')}</Text>

            <TouchableOpacity style={styles.primaryBtn} onPress={() => router.replace('/(auth)/login')}>
              <LinearGradient colors={['#E11D48', '#9B1B30']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.primaryGradient}>
                <Text style={styles.primaryText}>{t('forgot.go_login')}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </>
        );
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.background }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView style={[styles.container, { paddingTop: insets.top }]} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Back */}
        <TouchableOpacity onPress={() => step === 'email' ? router.back() : setStep('email')} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={C.textPrimary} />
        </TouchableOpacity>

        {renderStep()}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (C: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  content: { paddingHorizontal: Spacing['2xl'], paddingBottom: 40 },
  backBtn: { width: 40, height: 44, justifyContent: 'center', marginBottom: Spacing.lg },
  iconWrap: { alignItems: 'center', marginBottom: Spacing.lg },
  title: { fontSize: FontSizes['2xl'], fontWeight: '800', color: C.textPrimary, textAlign: 'center', marginBottom: 8 },
  desc: { fontSize: FontSizes.sm, color: C.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: Spacing['2xl'] },
  sectionLabel: { fontSize: FontSizes.xs, color: C.textMuted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  inputContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: C.glass,
    borderRadius: BorderRadius.card, borderWidth: 1, borderColor: C.glassBorder,
    paddingHorizontal: 14, marginBottom: 12,
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, color: C.textPrimary, fontSize: FontSizes.base, paddingVertical: 16, fontWeight: '500' },
  primaryBtn: { marginTop: Spacing.lg, borderRadius: BorderRadius.card, overflow: 'hidden' },
  primaryGradient: { paddingVertical: 16, alignItems: 'center', borderRadius: BorderRadius.card },
  primaryText: { fontSize: FontSizes.base, fontWeight: '700', color: C.white },
});
