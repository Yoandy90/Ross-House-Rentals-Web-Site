import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView,
  Platform, ScrollView, ActivityIndicator, Alert, StatusBar, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../src/contexts/AuthContext';
import { Colors, Gradients } from '../../src/constants/theme';

export default function RegisterScreen() {
  const { t } = useTranslation();
  const { register } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const formatPhone = (raw: string) => {
    const d = raw.replace(/\D/g, '').slice(0, 10);
    if (d.length <= 3) return d;
    if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  };

  const handleRegister = async () => {
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !password) {
      Alert.alert(t('common.error'), t('auth.allFieldsRequired', 'Todos los campos son requeridos'));
      return;
    }
    if (password.length < 6) {
      Alert.alert(t('common.error'), t('auth.passwordMinLength'));
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert(t('common.error'), t('auth.passwordMismatch'));
      return;
    }

    setLoading(true);
    const result = await register({
      name: `${firstName.trim()} ${lastName.trim()}`,
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.replace(/\D/g, '') || undefined,
      password,
    });
    setLoading(false);

    if (result.success) {
      router.replace('/(tabs)');
    } else {
      Alert.alert(t('common.error'), result.error || t('auth.createAccountError'));
    }
  };

  return (
    <View style={S.root}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView style={S.safe} edges={['top', 'bottom']}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={S.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

            {/* Back button */}
            <TouchableOpacity onPress={() => router.back()} style={S.backBtn}>
              <Ionicons name="arrow-back" size={24} color={Colors.text} />
            </TouchableOpacity>

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
            <Text style={S.title}>{t('auth.createAccount')}</Text>
            <Text style={S.subtitle}>{t('auth.registerSubtitle')}</Text>

            {/* \u2500\u2500 Form \u2500\u2500 */}
            <View style={S.formWrap}>
              {/* First Name */}
              <View style={S.darkField}>
                <Ionicons name="person-outline" size={20} color={Colors.textMuted} style={{ marginRight: 12 }} />
                <TextInput
                  style={S.darkInput}
                  value={firstName}
                  onChangeText={setFirstName}
                  placeholder={t('auth.firstName', 'Nombre')}
                  placeholderTextColor={Colors.textMuted}
                  autoCapitalize="words"
                />
              </View>

              {/* Last Name */}
              <View style={S.darkField}>
                <Ionicons name="person-outline" size={20} color={Colors.textMuted} style={{ marginRight: 12 }} />
                <TextInput
                  style={S.darkInput}
                  value={lastName}
                  onChangeText={setLastName}
                  placeholder={t('auth.lastName', 'Apellido(s)')}
                  placeholderTextColor={Colors.textMuted}
                  autoCapitalize="words"
                />
              </View>

              {/* Email */}
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
                />
              </View>

              {/* Phone */}
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
                />
              </View>

              {/* Password */}
              <View style={S.darkField}>
                <Ionicons name="lock-closed-outline" size={20} color={Colors.textMuted} style={{ marginRight: 12 }} />
                <TextInput
                  style={S.darkInput}
                  value={password}
                  onChangeText={setPassword}
                  placeholder={t('auth.passwordMin')}
                  placeholderTextColor={Colors.textMuted}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={22} color={Colors.textMuted} />
                </TouchableOpacity>
              </View>

              {/* Confirm Password */}
              <View style={S.darkField}>
                <Ionicons name="shield-checkmark-outline" size={20} color={Colors.textMuted} style={{ marginRight: 12 }} />
                <TextInput
                  style={S.darkInput}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder={t('auth.confirmPassword')}
                  placeholderTextColor={Colors.textMuted}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                />
              </View>

              {/* Submit Button */}
              <TouchableOpacity onPress={handleRegister} disabled={loading} style={[S.primaryBtn, loading && { opacity: 0.5 }]}>
                <LinearGradient colors={Gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={S.btnGradient}>
                  {loading ? <ActivityIndicator color="#fff" /> : (
                    <View style={S.btnInner}>
                      <Ionicons name="checkmark-circle-outline" size={22} color="#fff" />
                      <Text style={S.btnText}>{t('auth.createAccount')}</Text>
                    </View>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>

            {/* \u2500\u2500 Footer \u2500\u2500 */}
            <View style={S.footer}>
              <TouchableOpacity onPress={() => router.back()}>
                <Text style={S.footerText}>
                  {t('auth.hasAccount')}{' '}
                  <Text style={S.footerLink}>{t('auth.loginLink')}</Text>
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
  logoWrap: { alignItems: 'center', marginTop: 10 },
  logoGlow: {
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 12,
  },
  logoBorder: {
    width: 120,
    height: 120,
    borderRadius: 30,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },

  // Title
  title: { fontSize: 26, fontWeight: '800', color: Colors.text, textAlign: 'center', marginTop: 16 },
  subtitle: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', marginTop: 6, marginBottom: 24 },

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
  primaryBtn: { borderRadius: 14, overflow: 'hidden', marginTop: 4 },
  btnGradient: { height: 56, alignItems: 'center', justifyContent: 'center', borderRadius: 14 },
  btnInner: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  btnText: { fontSize: 17, fontWeight: '700', color: '#fff' },

  // Footer
  footer: { alignItems: 'center', paddingVertical: 24 },
  footerText: { fontSize: 15, color: Colors.textSecondary },
  footerLink: { color: Colors.primaryLight, fontWeight: '700' },
});
