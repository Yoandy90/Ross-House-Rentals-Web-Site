import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Switch, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../src/contexts/AuthContext';
import { Colors, Gradients, API_URL } from '../../src/constants/theme';

export default function RecurringPaymentsScreen() {
  const { t } = useTranslation();
  const { token } = useAuth();
  const [autopay, setAutopay] = useState(false);
  const [frequency, setFrequency] = useState<'weekly' | 'biweekly' | 'monthly'>('monthly');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchSettings(); }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch(`${API_URL}/api/loans/recurring-settings`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAutopay(data.autopay_enabled || false);
        setFrequency(data.frequency || 'monthly');
      }
    } catch {}
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/loans/recurring-settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ autopay_enabled: autopay, frequency }),
      });
      if (res.ok) {
        Alert.alert('\u2705', t('recurring.saved'));
      } else {
        Alert.alert(t('common.error'), t('recurring.saveError'));
      }
    } catch {
      Alert.alert(t('common.error'), t('common.connectionError'));
    }
    setSaving(false);
  };

  const frequencies = [
    { key: 'weekly', label: t('recurring.weekly'), desc: t('recurring.weeklyDesc') },
    { key: 'biweekly', label: t('recurring.biweekly'), desc: t('recurring.biweeklyDesc') },
    { key: 'monthly', label: t('recurring.monthly'), desc: t('recurring.monthlyDesc') },
  ];

  if (loading) return (
    <><Stack.Screen options={{ title: t('recurring.title') }} />
    <View style={[S.container, { justifyContent: 'center', alignItems: 'center' }]}>
      <ActivityIndicator color={Colors.primaryLight} size="large" />
    </View></>
  );

  return (
    <>
      <Stack.Screen options={{ title: t('recurring.title') }} />
      <SafeAreaView style={S.container} edges={['bottom']}>
        <ScrollView contentContainerStyle={S.scroll}>
          {/* Autopay Toggle */}
          <View style={S.card}>
            <View style={S.cardRow}>
              <View style={S.cardIcon}>
                <Ionicons name="repeat" size={22} color={Colors.primaryLight} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={S.cardTitle}>{t('recurring.autopay')}</Text>
                <Text style={S.cardSub}>{t('recurring.autopayDesc')}</Text>
              </View>
              <Switch
                value={autopay}
                onValueChange={setAutopay}
                trackColor={{ false: Colors.border, true: Colors.primary }}
                thumbColor="#fff"
              />
            </View>
          </View>

          {/* Frequency Selection */}
          {autopay && (
            <View style={S.section}>
              <Text style={S.sectionTitle}>{t('recurring.frequency')}</Text>
              {frequencies.map(f => (
                <TouchableOpacity
                  key={f.key}
                  style={[S.freqCard, frequency === f.key && S.freqCardActive]}
                  onPress={() => setFrequency(f.key as any)}
                  activeOpacity={0.7}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[S.freqLabel, frequency === f.key && S.freqLabelActive]}>{f.label}</Text>
                    <Text style={S.freqDesc}>{f.desc}</Text>
                  </View>
                  {frequency === f.key && (
                    <Ionicons name="checkmark-circle" size={24} color={Colors.primaryLight} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Info */}
          <View style={S.infoBox}>
            <Ionicons name="information-circle-outline" size={18} color={Colors.primaryLight} />
            <Text style={S.infoText}>
              {autopay ? t('recurring.enabledInfo') : t('recurring.disabledInfo')}
            </Text>
          </View>

          {/* Save */}
          <TouchableOpacity onPress={handleSave} disabled={saving} style={[S.saveBtn, saving && { opacity: 0.5 }]}>
            <LinearGradient colors={Gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={S.saveBtnGrad}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={S.saveBtnText}>{t('recurring.saveConfig')}</Text>}
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const S = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  scroll: { padding: 20, paddingBottom: 40 },
  card: {
    backgroundColor: Colors.card, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: Colors.border, marginBottom: 24,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  cardIcon: {
    width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(5, 150, 105, 0.1)',
    justifyContent: 'center', alignItems: 'center', marginRight: 14,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: Colors.text },
  cardSub: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: Colors.textMuted, letterSpacing: 1.5, marginBottom: 10, marginLeft: 4 },
  freqCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface,
    borderRadius: 14, padding: 16, marginBottom: 8, borderWidth: 1, borderColor: Colors.border,
  },
  freqCardActive: { borderColor: Colors.primary, backgroundColor: 'rgba(5, 150, 105, 0.06)' },
  freqLabel: { fontSize: 15, fontWeight: '600', color: Colors.text },
  freqLabelActive: { color: Colors.primaryLight },
  freqDesc: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  infoBox: {
    flexDirection: 'row', gap: 10, backgroundColor: 'rgba(5, 150, 105, 0.06)',
    borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(5, 150, 105, 0.15)', marginBottom: 20,
  },
  infoText: { flex: 1, fontSize: 13, color: Colors.textSecondary, lineHeight: 19 },
  saveBtn: { borderRadius: 14, overflow: 'hidden' },
  saveBtnGrad: { height: 52, justifyContent: 'center', alignItems: 'center', borderRadius: 14 },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});
