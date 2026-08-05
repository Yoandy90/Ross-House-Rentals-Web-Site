import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../../constants/colors';
import api from '../../services/api';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';

interface CreditPreferences {
  low_balance_threshold: number;
  email_notifications: boolean;
  push_notifications: boolean;
}

export default function CreditPreferencesScreen() {
  const colors = useThemeColors();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preferences, setPreferences] = useState<CreditPreferences>({
    low_balance_threshold: 50,
    email_notifications: true,
    push_notifications: true,
  });
  const [thresholdInput, setThresholdInput] = useState('50');

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      const response = await api.get('/credits/preferences');
      setPreferences(response.data);
      setThresholdInput(response.data.low_balance_threshold.toString());
    } catch (error) {
      console.error('Error loading preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const savePreferences = async () => {
    try {
      const threshold = parseInt(thresholdInput);
      
      if (isNaN(threshold) || threshold < 10 || threshold > 500) {
        Alert.alert(t('common.error', 'Error'), t('creditPreferences.thresholdError', 'El umbral debe estar entre 10 y 500 créditos'));
        return;
      }

      setSaving(true);
      
      await api.put('/credits/preferences', {
        low_balance_threshold: threshold,
        email_notifications: preferences.email_notifications,
        push_notifications: preferences.push_notifications,
      });

      Alert.alert(t('creditPreferences.saved', '✓ Guardado'), t('creditPreferences.savedMessage', 'Tus preferencias han sido actualizadas'));
      router.back();
    } catch (error) {
      console.error('Error saving preferences:', error);
      Alert.alert(t('common.error', 'Error'), t('creditPreferences.saveError', 'No se pudieron guardar las preferencias'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Cargando...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Compact Modern Header */}
      <View style={[styles.headerWrapper, { paddingTop: insets.top }]}>
        <LinearGradient
          colors={['#1e293b', '#334155']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <View style={styles.headerIconContainer}>
              <Ionicons name="options" size={18} color="#fff" />
            </View>
            <Text style={styles.headerTitle}>{t('creditPreferences.title', 'Preferencias')}</Text>
          </View>
          <View style={styles.headerRight} />
        </LinearGradient>
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Balance Alert Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconBadge, { backgroundColor: '#fef3c7' }]}>
              <Ionicons name="trending-down" size={20} color="#f59e0b" />
            </View>
            <View style={styles.cardHeaderText}>
              <Text style={styles.cardTitle}>Alerta de Saldo Bajo</Text>
              <Text style={styles.cardSubtitle}>{t('creditPreferences.lowBalanceAlert', 'Te avisamos cuando tu saldo sea bajo')}</Text>
            </View>
          </View>

          <View style={styles.thresholdContainer}>
            <Text style={styles.thresholdLabel}>{t('creditPreferences.alertThreshold', 'Umbral de alerta')}</Text>
            <View style={styles.thresholdInputRow}>
              <View style={styles.thresholdInputWrapper}>
                <TextInput
                  style={styles.thresholdInput}
                  value={thresholdInput}
                  onChangeText={setThresholdInput}
                  keyboardType="numeric"
                  placeholder="50"
                  placeholderTextColor="#9ca3af"
                />
                <Text style={styles.thresholdUnit}>créditos</Text>
              </View>
              <View style={styles.thresholdRange}>
                <Text style={styles.rangeText}>10 - 500</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Notifications Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconBadge, { backgroundColor: '#dbeafe' }]}>
              <Ionicons name="notifications" size={20} color="#3b82f6" />
            </View>
            <View style={styles.cardHeaderText}>
              <Text style={styles.cardTitle}>{t('creditPreferences.notifications', 'Notificaciones')}</Text>
              <Text style={styles.cardSubtitle}>{t('creditPreferences.notificationsHint', 'Elige cómo quieres ser notificado')}</Text>
            </View>
          </View>

          <View style={styles.notificationsList}>
            {/* Email Notifications */}
            <TouchableOpacity 
              style={styles.notificationItem}
              onPress={() => setPreferences({ ...preferences, email_notifications: !preferences.email_notifications })}
              activeOpacity={0.7}
            >
              <View style={styles.notificationLeft}>
                <View style={[styles.notificationIcon, { backgroundColor: '#fce7f3' }]}>
                  <Ionicons name="mail" size={18} color="#ec4899" />
                </View>
                <View style={styles.notificationInfo}>
                  <Text style={styles.notificationTitle}>{t('creditPreferences.email', 'Email')}</Text>
                  <Text style={styles.notificationDesc}>Compras mayores a $100</Text>
                </View>
              </View>
              <Switch
                value={preferences.email_notifications}
                onValueChange={(value) =>
                  setPreferences({ ...preferences, email_notifications: value })
                }
                trackColor={{ false: '#e5e7eb', true: '#86efac' }}
                thumbColor={preferences.email_notifications ? '#22c55e' : '#fff'}
                ios_backgroundColor="#e5e7eb"
              />
            </TouchableOpacity>

            {/* Push Notifications */}
            <TouchableOpacity 
              style={styles.notificationItem}
              onPress={() => setPreferences({ ...preferences, push_notifications: !preferences.push_notifications })}
              activeOpacity={0.7}
            >
              <View style={styles.notificationLeft}>
                <View style={[styles.notificationIcon, { backgroundColor: '#e0e7ff' }]}>
                  <Ionicons name="phone-portrait" size={18} color="#6366f1" />
                </View>
                <View style={styles.notificationInfo}>
                  <Text style={styles.notificationTitle}>{t('creditPreferences.push', 'Push')}</Text>
                  <Text style={styles.notificationDesc}>{t('creditPreferences.pushDesc', 'Alertas en tu dispositivo')}</Text>
                </View>
              </View>
              <Switch
                value={preferences.push_notifications}
                onValueChange={(value) =>
                  setPreferences({ ...preferences, push_notifications: value })
                }
                trackColor={{ false: '#e5e7eb', true: '#86efac' }}
                thumbColor={preferences.push_notifications ? '#22c55e' : '#fff'}
                ios_backgroundColor="#e5e7eb"
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Info Section */}
        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>¿Qué te notificamos?</Text>
          <View style={styles.infoGrid}>
            {[
              { icon: 'cart', label: 'Compras', color: '#10b981' },
              { icon: 'arrow-down', label: 'Uso de créditos', color: '#f59e0b' },
              { icon: 'alert-circle', label: 'Saldo bajo', color: '#ef4444' },
              { icon: 'refresh', label: 'Reembolsos', color: '#8b5cf6' },
            ].map((item, index) => (
              <View key={index} style={styles.infoItem}>
                <View style={[styles.infoItemIcon, { backgroundColor: item.color + '15' }]}>
                  <Ionicons name={item.icon as any} size={16} color={item.color} />
                </View>
                <Text style={styles.infoItemLabel}>{item.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={savePreferences}
          disabled={saving}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={saving ? ['#9ca3af', '#9ca3af'] : ['#22c55e', '#16a34a']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.saveButtonGradient}
          >
            {saving ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={22} color="#FFF" />
                <Text style={styles.saveButtonText}>Guardar Cambios</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>

        {/* Extra padding for scroll */}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  headerWrapper: {
    backgroundColor: '#1e293b',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  headerRight: {
    width: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: colors.textGray,
  },
  scrollContent: {
    padding: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 18,
  },
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardHeaderText: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 2,
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#6b7280',
  },
  thresholdContainer: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 14,
  },
  thresholdLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  thresholdInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  thresholdInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
  },
  thresholdInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  thresholdUnit: {
    fontSize: 13,
    color: '#9ca3af',
    marginLeft: 6,
  },
  thresholdRange: {
    backgroundColor: '#e0e7ff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
  },
  rangeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6366f1',
  },
  notificationsList: {
    gap: 4,
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  notificationLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
  },
  notificationIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationInfo: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 2,
  },
  notificationDesc: {
    fontSize: 13,
    color: '#6b7280',
  },
  infoSection: {
    marginBottom: 20,
  },
  infoTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  infoItemIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoItemLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#374151',
  },
  saveButton: {
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  saveButtonDisabled: {
    shadowOpacity: 0,
  },
  saveButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 10,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
});
