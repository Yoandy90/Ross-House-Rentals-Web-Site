import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Linking,
  Platform,
  Image,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../constants/colors';
import api from '../services/api';
import Constants from 'expo-constants';

// Get the actual app version from expo-constants (reads from app.json)
const APP_VERSION = Constants.expoConfig?.version || Constants.manifest?.version || '1.0.0';
const NOTIFICATION_COUNT_KEY = 'update_notification_count';
const LAST_NOTIFICATION_KEY = 'last_update_notification';

interface VersionInfo {
  current_version: string;
  minimum_version: string;
  force_update: boolean;
  update_message: string;
  ios_url: string;
  android_url: string;
}

export function VersionChecker() {
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const [showModal, setShowModal] = useState(false);
  const [forceUpdate, setForceUpdate] = useState(false);
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);
  const [notificationCount, setNotificationCount] = useState(0);

  useEffect(() => {
    checkVersion();
  }, []);

  const checkVersion = async () => {
    try {
      // Get version info from server
      const response = await api.get('/app-version');
      const serverVersion: VersionInfo = response.data;
      
      setVersionInfo(serverVersion);

      // Compare versions
      const needsUpdate = compareVersions(APP_VERSION, serverVersion.current_version) < 0;
      const isBelowMinimum = compareVersions(APP_VERSION, serverVersion.minimum_version) < 0;

      if (isBelowMinimum || serverVersion.force_update) {
        // Force update immediately
        setForceUpdate(true);
        setShowModal(true);
      } else if (needsUpdate) {
        // Check notification count
        const count = await getNotificationCount();
        
        if (count >= 2) {
          // Force update after 2 notifications
          setForceUpdate(true);
          setShowModal(true);
        } else {
          // Show notification
          const lastNotification = await AsyncStorage.getItem(LAST_NOTIFICATION_KEY);
          const now = Date.now();
          const dayInMs = 24 * 60 * 60 * 1000;

          // Show notification once per day
          if (!lastNotification || now - parseInt(lastNotification) > dayInMs) {
            setShowModal(true);
            await incrementNotificationCount();
            await AsyncStorage.setItem(LAST_NOTIFICATION_KEY, now.toString());
          }
        }
      } else {
        // Reset counter if version is up to date
        await AsyncStorage.removeItem(NOTIFICATION_COUNT_KEY);
        await AsyncStorage.removeItem(LAST_NOTIFICATION_KEY);
      }
    } catch (error) {
      console.error('Error checking version:', error);
    }
  };

  const compareVersions = (v1: string, v2: string): number => {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);

    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const p1 = parts1[i] || 0;
      const p2 = parts2[i] || 0;

      if (p1 < p2) return -1;
      if (p1 > p2) return 1;
    }

    return 0;
  };

  const getNotificationCount = async (): Promise<number> => {
    try {
      const count = await AsyncStorage.getItem(NOTIFICATION_COUNT_KEY);
      const num = count ? parseInt(count) : 0;
      setNotificationCount(num);
      return num;
    } catch {
      return 0;
    }
  };

  const incrementNotificationCount = async () => {
    try {
      const count = await getNotificationCount();
      const newCount = count + 1;
      await AsyncStorage.setItem(NOTIFICATION_COUNT_KEY, newCount.toString());
      setNotificationCount(newCount);
    } catch (error) {
      console.error('Error incrementing notification count:', error);
    }
  };

  const handleUpdate = () => {
    if (!versionInfo) return;

    const url = Platform.OS === 'ios' ? versionInfo.ios_url : versionInfo.android_url;
    Linking.openURL(url);
  };

  const handleDismiss = () => {
    if (!forceUpdate) {
      setShowModal(false);
    }
  };

  if (!showModal || !versionInfo) {
    return null;
  }

  return (
    <Modal
      visible={showModal}
      transparent
      animationType="fade"
      onRequestClose={handleDismiss}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <View style={styles.iconContainer}>
            <Ionicons name="cloud-download" size={64} color={colors.primary} />
          </View>

          <Text style={styles.title}>
            {forceUpdate ? '¡Actualización Requerida!' : 'Nueva Actualización Disponible'}
          </Text>

          <Text style={styles.message}>
            {versionInfo.update_message}
          </Text>

          <View style={styles.versionInfo}>
            <View style={styles.versionRow}>
              <Text style={styles.versionLabel}>Versión actual:</Text>
              <Text style={styles.versionText}>{APP_VERSION}</Text>
            </View>
            <View style={styles.versionRow}>
              <Text style={styles.versionLabel}>Nueva versión:</Text>
              <Text style={[styles.versionText, styles.versionHighlight]}>
                {versionInfo.current_version}
              </Text>
            </View>
          </View>

          {forceUpdate && (
            <View style={styles.warningBox}>
              <Ionicons name="warning" size={20} color={colors.error} />
              <Text style={styles.warningText}>
                Esta actualización es obligatoria para continuar usando la app
              </Text>
            </View>
          )}

          {!forceUpdate && notificationCount > 0 && (
            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                {notificationCount === 1
                  ? 'Próxima vez será obligatorio actualizar'
                  : 'Esta es tu última oportunidad antes de la actualización forzada'}
              </Text>
            </View>
          )}

          <TouchableOpacity style={styles.updateButton} onPress={handleUpdate}>
            <Ionicons name="download" size={20} color={colors.textWhite} />
            <Text style={styles.updateButtonText}>Actualizar Ahora</Text>
          </TouchableOpacity>

          {!forceUpdate && (
            <TouchableOpacity style={styles.dismissButton} onPress={handleDismiss}>
              <Text style={styles.dismissButtonText}>Más Tarde</Text>
            </TouchableOpacity>
          )}

          {forceUpdate && (
            <Text style={styles.forceUpdateNote}>
              No puedes usar la app sin actualizar
            </Text>
          )}
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContainer: {
    backgroundColor: colors.background,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 12,
  },
  message: {
    fontSize: 15,
    color: colors.textGray,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  versionInfo: {
    width: '100%',
    backgroundColor: colors.backgroundGray,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  versionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  versionLabel: {
    fontSize: 14,
    color: colors.textGray,
  },
  versionText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  versionHighlight: {
    color: colors.primary,
    fontSize: 16,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.error + '15',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    gap: 10,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    color: colors.error,
    fontWeight: '600',
  },
  infoBox: {
    backgroundColor: colors.warning + '15',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
  },
  infoText: {
    fontSize: 13,
    color: colors.warning,
    fontWeight: '600',
    textAlign: 'center',
  },
  updateButton: {
    flexDirection: 'row',
    width: '100%',
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
  },
  updateButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textWhite,
  },
  dismissButton: {
    width: '100%',
    padding: 12,
    alignItems: 'center',
  },
  dismissButtonText: {
    fontSize: 15,
    color: colors.textGray,
    fontWeight: '600',
  },
  forceUpdateNote: {
    fontSize: 12,
    color: colors.textGray,
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 8,
  },
});
