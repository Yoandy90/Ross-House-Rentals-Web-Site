import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView,
  Platform, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Stack, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../src/contexts/AuthContext';
import { Colors, Gradients, API_URL } from '../../src/constants/theme';

export default function ChangePasswordScreen() {
  const { t } = useTranslation();
  const { token } = useAuth();
  const [current, setCurrent] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);

  const handleChange = async () => {
    if (!current || !newPass || !confirm) {
      Alert.alert(t('common.error'), t('changePassword.fillAll'));
      return;
    }
    if (newPass.length < 6) {
      Alert.alert(t('common.error'), t('changePassword.minLength'));
      return;
    }
    if (newPass !== confirm) {
      Alert.alert(t('common.error'), t('changePassword.mismatch'));
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ current_password: current, new_password: newPass }),
      });
      if (res.ok) {
        Alert.alert('\u2705', t('changePassword.changed'), [
          { text: t('common.ok'), onPress: () => router.back() },
        ]);
      } else {
        const err = await res.json();
        Alert.alert(t('common.error'), err.detail || t('changePassword.incorrectCurrent'));
      }
    } catch {
      Alert.alert(t('common.error'), t('common.connectionError'));
    }
    setLoading(false);
  };

  return (
    <>
      <Stack.Screen options={{ title: t('changePassword.title') }} />
      <SafeAreaView style={S.container} edges={['bottom']}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={S.scroll} keyboardShouldPersistTaps="handled">
            <View style={S.iconWrap}>
              <View style={S.iconCircle}>
                <Ionicons name="shield-checkmark" size={40} color={Colors.primaryLight} />
              </View>
              <Text style={S.description}>{t('changePassword.description')}</Text>
            </View>

            <View style={S.field}>
              <Text style={S.label}>{t('changePassword.currentPassword')}</Text>
              <View style={S.inputRow}>
                <Ionicons name="lock-closed-outline" size={18} color={Colors.textMuted} />
                <TextInput style={S.input} value={current} onChangeText={setCurrent} secureTextEntry={!showPasswords} placeholderTextColor={Colors.textMuted} placeholder={t('changePassword.currentPlaceholder')} autoCapitalize="none" />
              </View>
            </View>

            <View style={S.field}>
              <Text style={S.label}>{t('changePassword.newPassword')}</Text>
              <View style={S.inputRow}>
                <Ionicons name="key-outline" size={18} color={Colors.textMuted} />
                <TextInput style={S.input} value={newPass} onChangeText={setNewPass} secureTextEntry={!showPasswords} placeholderTextColor={Colors.textMuted} placeholder={t('changePassword.newPlaceholder')} autoCapitalize="none" />
              </View>
            </View>

            <View style={S.field}>
              <Text style={S.label}>{t('changePassword.confirmNew')}</Text>
              <View style={S.inputRow}>
                <Ionicons name="checkmark-circle-outline" size={18} color={Colors.textMuted} />
                <TextInput style={S.input} value={confirm} onChangeText={setConfirm} secureTextEntry={!showPasswords} placeholderTextColor={Colors.textMuted} placeholder={t('changePassword.confirmPlaceholder')} autoCapitalize="none" />
              </View>
            </View>

            <TouchableOpacity onPress={() => setShowPasswords(!showPasswords)} style={S.showToggle}>
              <Ionicons name={showPasswords ? 'eye-off-outline' : 'eye-outline'} size={18} color={Colors.textSecondary} />
              <Text style={S.showToggleText}>{showPasswords ? t('changePassword.hidePasswords') : t('changePassword.showPasswords')} {t('changePassword.passwords')}</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={handleChange} disabled={loading} style={[S.saveBtn, loading && { opacity: 0.5 }]}>
              <LinearGradient colors={Gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={S.saveBtnGradient}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={S.saveBtnText}>{t('changePassword.changeBtn')}</Text>}
              </LinearGradient>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
}

const S = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  scroll: { padding: 20, paddingTop: 10 },
  iconWrap: { alignItems: 'center', marginBottom: 24 },
  iconCircle: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(5, 150, 105, 0.08)',
    justifyContent: 'center', alignItems: 'center', marginBottom: 12,
  },
  description: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  field: { marginBottom: 16 },
  label: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary, marginBottom: 8, marginLeft: 4 },
  inputRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.surface, borderRadius: 14, paddingHorizontal: 16, height: 52,
    borderWidth: 1, borderColor: Colors.border,
  },
  input: { flex: 1, fontSize: 15, color: Colors.text },
  showToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-end', marginBottom: 16 },
  showToggleText: { fontSize: 13, color: Colors.textSecondary },
  saveBtn: { borderRadius: 14, overflow: 'hidden', marginTop: 8 },
  saveBtnGradient: { height: 52, justifyContent: 'center', alignItems: 'center', borderRadius: 14 },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});
