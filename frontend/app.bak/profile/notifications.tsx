import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Switch, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Notifications from 'expo-notifications';
import { Colors, API_URL } from '../../src/constants/theme';
import { useAuth } from '../../src/contexts/AuthContext';

export default function NotificationsScreen() {
  const { t } = useTranslation();
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [payments, setPayments] = useState(true);
  const [reminders, setReminders] = useState(true);
  const [promotions, setPromotions] = useState(false);

  const fetchPreferences = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/notifications/preferences`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPayments(data.push_enabled !== false);
        setReminders(data.appointment_reminders !== false);
        setPromotions(data.promotions === true);
      }
    } catch (e) {
      console.log('Error fetching notification prefs:', e);
    }
    setLoading(false);
  }, [token]);

  useEffect(() => {
    checkPermission();
    if (token) fetchPreferences();
    else setLoading(false);
  }, [token, fetchPreferences]);

  const checkPermission = async () => {
    const { status } = await Notifications.getPermissionsAsync();
    setPushEnabled(status === 'granted');
  };

  const togglePush = async (value: boolean) => {
    if (value) {
      const { status } = await Notifications.requestPermissionsAsync();
      setPushEnabled(status === 'granted');
      if (status !== 'granted') {
        Alert.alert(t('notifications.title'), t('notifications.enableInSettings'));
      }
    } else {
      Alert.alert(t('notifications.title'), t('notifications.disableNote'));
    }
  };

  const updatePreference = async (key: string, value: boolean) => {
    try {
      await fetch(`${API_URL}/api/notifications/preferences`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ [key]: value }),
      });
    } catch (e) {
      console.log('Error updating pref:', e);
    }
  };

  const togglePayments = (v: boolean) => { setPayments(v); updatePreference('push_enabled', v); };
  const toggleReminders = (v: boolean) => { setReminders(v); updatePreference('appointment_reminders', v); };
  const togglePromotions = (v: boolean) => { setPromotions(v); updatePreference('promotions', v); };

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ title: t('notifications.title') }} />
        <SafeAreaView style={S.container} edges={['bottom']}>
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color={Colors.primaryLight} />
          </View>
        </SafeAreaView>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: t('notifications.title') }} />
      <SafeAreaView style={S.container} edges={['bottom']}>
        <ScrollView contentContainerStyle={S.scroll}>
          <View style={S.section}>
            <Text style={S.sectionTitle}>{t('notifications.general')}</Text>
            <NotifRow
              icon="notifications-outline"
              label={t('notifications.pushNotifications')}
              sub={t('notifications.pushDesc')}
              value={pushEnabled}
              onChange={togglePush}
            />
          </View>

          <View style={S.section}>
            <Text style={S.sectionTitle}>{t('notifications.categories')}</Text>
            <NotifRow icon="cash-outline" label={t('notifications.payments')} sub={t('notifications.paymentsDesc')} value={payments} onChange={togglePayments} />
            <NotifRow icon="calendar-outline" label={t('notifications.reminders')} sub={t('notifications.remindersDesc')} value={reminders} onChange={toggleReminders} />
            <NotifRow icon="megaphone-outline" label={t('notifications.promotions')} sub={t('notifications.promotionsDesc')} value={promotions} onChange={togglePromotions} />
          </View>

          <View style={S.infoBox}>
            <Ionicons name="information-circle-outline" size={20} color={Colors.primaryLight} />
            <Text style={S.infoText}>{t('notifications.recommendedInfo')}</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

function NotifRow({ icon, label, sub, value, onChange }: { icon: any; label: string; sub: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={S.row}>
      <View style={S.rowIcon}>
        <Ionicons name={icon} size={20} color={Colors.primaryLight} />
      </View>
      <View style={S.rowContent}>
        <Text style={S.rowLabel}>{label}</Text>
        <Text style={S.rowSub}>{sub}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: Colors.border, true: Colors.primary }}
        thumbColor={'#fff'}
      />
    </View>
  );
}

const S = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  scroll: { padding: 20, paddingTop: 10 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: Colors.textMuted, letterSpacing: 1.5, marginBottom: 10, marginLeft: 4 },
  row: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card,
    borderRadius: 14, padding: 14, marginBottom: 8,
    borderWidth: 1, borderColor: Colors.border,
  },
  rowIcon: {
    width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(5, 150, 105, 0.1)',
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  rowContent: { flex: 1 },
  rowLabel: { fontSize: 15, fontWeight: '600', color: Colors.text },
  rowSub: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  infoBox: {
    flexDirection: 'row', gap: 10, backgroundColor: 'rgba(5, 150, 105, 0.06)',
    borderRadius: 14, padding: 14, borderWidth: 1, borderColor: 'rgba(5, 150, 105, 0.15)',
  },
  infoText: { flex: 1, fontSize: 13, color: Colors.textSecondary, lineHeight: 19 },
});
