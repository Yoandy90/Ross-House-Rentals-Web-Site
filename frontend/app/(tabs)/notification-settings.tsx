import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../../constants/colors';
import api from '../../services/api';
import CustomHeader from '../../components/CustomHeader';
import { forceRegisterPushToken } from '../../services/notificationService';
import { useTranslation } from 'react-i18next';

interface NotificationPreferences {
  appointments: boolean;
  documents: boolean;
  tax_returns: boolean;
  chat: boolean;
  general: boolean;
}

export default function NotificationSettings() {
  const colors = useThemeColors();
  const { t } = useTranslation();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activating, setActivating] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    appointments: true,
    documents: true,
    tax_returns: true,
    chat: true,
    general: true,
  });

  useEffect(() => {
    loadPreferences();
    checkPushStatus();
  }, []);

  const checkPushStatus = async () => {
    try {
      const response = await api.get('/auth/me');
      setPushEnabled(!!response.data?.push_token);
    } catch (error) {
    }
  };

  const handleActivatePush = async () => {
    setActivating(true);
    try {
      const success = await forceRegisterPushToken();
      if (success) {
        setPushEnabled(true);
      }
    } catch (error) {
      console.error('Error activating push:', error);
    } finally {
      setActivating(false);
    }
  };

  const loadPreferences = async () => {
    try {
      const response = await api.get('/notifications/preferences');
      setPreferences(response.data);
    } catch (error) {
      console.error('Error loading preferences:', error);
      Alert.alert('Error', 'No se pudieron cargar las preferencias');
    } finally {
      setLoading(false);
    }
  };

  const updatePreference = async (key: keyof NotificationPreferences, value: boolean) => {
    const newPreferences = { ...preferences, [key]: value };
    setPreferences(newPreferences);

    setSaving(true);
    try {
      await api.put('/notifications/preferences', newPreferences);
    } catch (error) {
      console.error('Error updating preferences:', error);
      // Revert on error
      setPreferences(preferences);
      Alert.alert('Error', 'No se pudo actualizar la preferencia');
    } finally {
      setSaving(false);
    }
  };

  const notificationTypes = [
    {
      key: 'appointments' as keyof NotificationPreferences,
      title: 'Citas',
      description: 'Recordatorios de citas programadas y cambios',
      icon: 'calendar',
      color: colors.accent,
    },
    {
      key: 'documents' as keyof NotificationPreferences,
      title: 'Documentos',
      description: 'Cuando subes documentos o son procesados',
      icon: 'folder',
      color: colors.secondary,
    },
    {
      key: 'tax_returns' as keyof NotificationPreferences,
      title: 'Declaraciones',
      description: 'Cuando tus declaraciones están listas',
      icon: 'document-text',
      color: colors.primary,
    },
    {
      key: 'chat' as keyof NotificationPreferences,
      title: 'Chat',
      description: 'Mensajes nuevos de tus asesores',
      icon: 'chatbubbles',
      color: colors.info,
    },
    {
      key: 'general' as keyof NotificationPreferences,
      title: 'General',
      description: 'Anuncios y actualizaciones importantes',
      icon: 'notifications',
      color: colors.warning,
    },
  ];

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Cargando preferencias...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Custom Header */}
      <CustomHeader 
        title="Preferencias"
        showBack={true}
      />
      
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Push Notification Status */}
        {Platform.OS !== 'web' && (
          <View style={styles.pushSection}>
            <View style={styles.pushHeader}>
              <View style={[styles.iconContainer, { backgroundColor: pushEnabled ? '#10b98120' : '#f4433620' }]}>
                <Ionicons 
                  name={pushEnabled ? "notifications" : "notifications-off"} 
                  size={28} 
                  color={pushEnabled ? '#10b981' : '#f44336'} 
                />
              </View>
              <View style={styles.pushInfo}>
                <Text style={styles.pushTitle}>
                  {pushEnabled ? 'Notificaciones Activas' : 'Notificaciones Inactivas'}
                </Text>
                <Text style={styles.pushSubtitle}>
                  {pushEnabled 
                    ? 'Recibirás notificaciones push en este dispositivo' 
                    : 'Activa las notificaciones para no perderte nada'}
                </Text>
              </View>
            </View>
            {!pushEnabled && (
              <TouchableOpacity 
                style={styles.activateButton}
                onPress={handleActivatePush}
                disabled={activating}
              >
                {activating ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <>
                    <Ionicons name="notifications" size={20} color="#FFF" />
                    <Text style={styles.activateButtonText}>Activar Notificaciones</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Subtitle */}
        <View style={styles.header}>
          <Ionicons name="settings" size={48} color={colors.primary} />
          <Text style={styles.subtitle}>
            Controla qué notificaciones quieres recibir
          </Text>
        </View>

        {/* Notification Types */}
        <View style={styles.section}>
          {notificationTypes.map((type, index) => (
            <View
              key={type.key}
              style={[
                styles.preferenceItem,
                index === notificationTypes.length - 1 && styles.preferenceItemLast,
              ]}
            >
              <View style={[styles.iconContainer, { backgroundColor: type.color + '20' }]}>
                <Ionicons name={type.icon as any} size={24} color={type.color} />
              </View>
              
              <View style={styles.preferenceContent}>
                <Text style={styles.preferenceTitle}>{type.title}</Text>
                <Text style={styles.preferenceDescription}>{type.description}</Text>
              </View>

              <Switch
                value={preferences[type.key]}
                onValueChange={(value) => updatePreference(type.key, value)}
                trackColor={{ false: colors.border, true: type.color + '80' }}
                thumbColor={preferences[type.key] ? type.color : colors.backgroundGray}
                ios_backgroundColor={colors.border}
                disabled={saving}
              />
            </View>
          ))}
        </View>

        {/* Info Card */}
        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={24} color={colors.info} />
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>Sobre las Notificaciones</Text>
            <Text style={styles.infoText}>
              Las notificaciones te mantienen informado sobre eventos importantes. Puedes
              desactivarlas en cualquier momento desde esta pantalla.
            </Text>
          </View>
        </View>

        {/* System Settings */}
        <View style={styles.systemCard}>
          <Ionicons name="phone-portrait" size={20} color={colors.textGray} />
          <Text style={styles.systemText}>
            Para desactivar completamente las notificaciones, ve a la configuración de tu
            dispositivo.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundGray,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: colors.textGray,
  },
  // Push notification status section
  pushSection: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  pushHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pushInfo: {
    flex: 1,
    marginLeft: 12,
  },
  pushTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  pushSubtitle: {
    fontSize: 13,
    color: colors.textGray,
    marginTop: 2,
  },
  activateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10b981',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 16,
    gap: 8,
  },
  activateButtonText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
    paddingVertical: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginTop: 16,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: colors.textGray,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  section: {
    backgroundColor: colors.background,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
    marginBottom: 20,
  },
  preferenceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  preferenceItemLast: {
    borderBottomWidth: 0,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  preferenceContent: {
    flex: 1,
  },
  preferenceTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  preferenceDescription: {
    fontSize: 13,
    color: colors.textGray,
    lineHeight: 18,
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: colors.info + '15',
    borderRadius: 12,
    padding: 16,
    gap: 12,
    marginBottom: 16,
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.info,
    marginBottom: 6,
  },
  infoText: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.info,
  },
  systemCard: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 16,
    gap: 12,
    alignItems: 'center',
  },
  systemText: {
    flex: 1,
    fontSize: 12,
    color: colors.textGray,
    lineHeight: 16,
  },
});