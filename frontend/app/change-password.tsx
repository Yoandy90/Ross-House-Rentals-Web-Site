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

export default function ChangePasswordScreen() {
  const C = useColors();
  const styles = React.useMemo(() => createStyles(C), [C]);
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);

  const handleChange = async () => {
    if (!newPassword || newPassword.length < 6) {
      Alert.alert('Error', t('change_password.min_length'));
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Error', t('change_password.mismatch'));
      return;
    }

    setLoading(true);
    try {
      const body: any = { new_password: newPassword };
      if (currentPassword) body.current_password = currentPassword;

      const data = await apiCall('/auth/change-password', { method: 'PUT', body });
      if (data.success) {
        Alert.alert('✅', data.message || t('change_password.success'), [
          { text: 'OK', onPress: () => router.back() },
        ]);
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || t('change_password.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.background }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView style={[styles.container, { paddingTop: insets.top }]} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={C.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.title}>{t('change_password.title')}</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.iconWrap}>
          <Ionicons name="shield-checkmark-outline" size={48} color={C.brandRed} />
        </View>

        {/* Current Password */}
        <Text style={styles.label}>{t('change_password.current')}</Text>
        <View style={styles.inputContainer}>
          <Ionicons name="lock-open-outline" size={18} color={C.textMuted} style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            value={currentPassword}
            onChangeText={setCurrentPassword}
            placeholder={t('change_password.current_placeholder')}
            placeholderTextColor={C.textDim}
            secureTextEntry={!showPasswords}
          />
        </View>

        <Text style={styles.hint}>{t('change_password.current_hint')}</Text>

        {/* New Password */}
        <Text style={[styles.label, { marginTop: Spacing.lg }]}>{t('change_password.new')}</Text>
        <View style={styles.inputContainer}>
          <Ionicons name="lock-closed-outline" size={18} color={C.textMuted} style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder={t('change_password.new_placeholder')}
            placeholderTextColor={C.textDim}
            secureTextEntry={!showPasswords}
          />
          <TouchableOpacity onPress={() => setShowPasswords(!showPasswords)}>
            <Ionicons name={showPasswords ? 'eye-off' : 'eye'} size={20} color={C.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Confirm */}
        <Text style={[styles.label, { marginTop: Spacing.md }]}>{t('change_password.confirm')}</Text>
        <View style={styles.inputContainer}>
          <Ionicons name="lock-closed-outline" size={18} color={C.textMuted} style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder={t('change_password.confirm_placeholder')}
            placeholderTextColor={C.textDim}
            secureTextEntry={!showPasswords}
          />
        </View>

        {newPassword.length > 0 && newPassword.length < 6 && (
          <Text style={styles.errorText}>{t('change_password.min_length')}</Text>
        )}

        {/* Save Button */}
        <TouchableOpacity style={[styles.saveBtn, loading && { opacity: 0.6 }]} onPress={handleChange} disabled={loading}>
          <LinearGradient colors={['#E11D48', '#9B1B30']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.saveGradient}>
            {loading ? <ActivityIndicator color="#fff" /> : (
              <>
                <Ionicons name="checkmark-circle" size={20} color={C.white} />
                <Text style={styles.saveText}>{t('change_password.save')}</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>

        <View style={{ height: 60 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (C: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  content: { paddingHorizontal: Spacing.base, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.md },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  title: { fontSize: FontSizes['2xl'], fontWeight: '800', color: C.textPrimary, letterSpacing: -0.5 },
  iconWrap: { alignItems: 'center', marginVertical: Spacing.lg },
  label: { fontSize: FontSizes.xs, color: C.textMuted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  hint: { fontSize: FontSizes.xs, color: C.textMuted, marginTop: -4, marginBottom: Spacing.sm, fontStyle: 'italic' },
  inputContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: C.glass,
    borderRadius: BorderRadius.card, borderWidth: 1, borderColor: C.glassBorder, paddingHorizontal: 14,
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, color: C.textPrimary, fontSize: FontSizes.base, paddingVertical: 16, fontWeight: '500' },
  errorText: { color: '#EF4444', fontSize: FontSizes.xs, marginTop: 4 },
  saveBtn: { marginTop: Spacing['2xl'], borderRadius: BorderRadius.card, overflow: 'hidden' },
  saveGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderRadius: BorderRadius.card },
  saveText: { fontSize: FontSizes.base, fontWeight: '700', color: C.white },
});
