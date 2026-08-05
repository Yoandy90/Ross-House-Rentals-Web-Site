import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../constants/colors';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import api from '../services/api';

interface QuickActionsModalProps {
  visible: boolean;
  onClose: () => void;
}

interface FeatureFlags {
  gambling_enabled: boolean;
  bolita_enabled: boolean;
  scratch_cards_enabled: boolean;
  raffles_enabled: boolean;
  loans_enabled: boolean;
}

export function QuickActionsModal({ visible, onClose }: QuickActionsModalProps) {
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const { t } = useTranslation();
  const [featureFlags, setFeatureFlags] = useState<FeatureFlags>({
    gambling_enabled: false,
    bolita_enabled: false,
    scratch_cards_enabled: false,
    raffles_enabled: false,
    loans_enabled: false,
  });

  // Fetch feature flags when modal opens
  useEffect(() => {
    const fetchFlags = async () => {
      try {
        const response = await api.get('/feature-flags');
        if (response.data) {
          setFeatureFlags(response.data);
        }
      } catch (error) {
        console.log('Error fetching feature flags:', error);
      }
    };
    
    if (visible) {
      fetchFlags();
    }
  }, [visible]);

  const handleTakePhoto = async () => {
    onClose();
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert('Permiso Requerido', 'Necesitamos permiso para acceder a la cámara');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.7,
    });

    if (!result.canceled) {
      // Navigate to documents with image
      router.push({
        pathname: '/(tabs)/documents',
        params: { capturedImage: result.assets[0].uri },
      });
    }
  };

  const handleUploadDocument = async () => {
    onClose();
    router.push('/(tabs)/documents');
  };

  const handleScheduleAppointment = () => {
    onClose();
    router.push('/(tabs)/appointments');
  };

  const handleViewTaxReturns = () => {
    onClose();
    router.push('/(tabs)/tax-returns');
  };

  const handleEducation = () => {
    onClose();
    router.push('/(tabs)/education');
  };

  const handleGames = () => {
    onClose();
    router.push('/(tabs)/games');
  };

  const handleLoans = () => {
    onClose();
    router.push('loans');
  };

  // Build actions list dynamically based on feature flags
  const baseActions = [
    {
      id: 'camera',
      title: 'Escanear Documento',
      subtitle: 'Tomar foto con cámara',
      icon: 'camera',
      color: colors.primary,
      onPress: handleTakePhoto,
    },
    {
      id: 'upload',
      title: 'Subir Documento',
      subtitle: 'Desde galería o archivos',
      icon: 'cloud-upload',
      color: colors.accent,
      onPress: handleUploadDocument,
    },
    {
      id: 'appointment',
      title: 'Agendar Cita',
      subtitle: 'Nueva cita con asesor',
      icon: 'calendar',
      color: colors.secondary,
      onPress: handleScheduleAppointment,
    },
  ];

  // Add loans action only if feature is enabled
  if (featureFlags.loans_enabled) {
    baseActions.push({
      id: 'loans',
      title: 'Préstamos',
      subtitle: 'Simula y solicita',
      icon: 'cash',
      color: '#10B981',
      onPress: handleLoans,
    });
  }

  // Add games action only if gambling is enabled
  if (featureFlags.gambling_enabled) {
    baseActions.push({
      id: 'games',
      title: t('games.menuTitle'),
      subtitle: t('games.menuSubtitle'),
      icon: 'game-controller',
      color: '#8B5CF6',
      onPress: handleGames,
    });
  }

  // Always show these
  baseActions.push(
    {
      id: 'returns',
      title: 'Mis Declaraciones',
      subtitle: 'Ver y descargar',
      icon: 'document-text',
      color: colors.success,
      onPress: handleViewTaxReturns,
    },
    {
      id: 'education',
      title: 'Recursos Educativos',
      subtitle: 'FAQ y guías',
      icon: 'school',
      color: colors.info,
      onPress: handleEducation,
    }
  );

  const actions = baseActions;

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.content} onPress={(e) => e.stopPropagation()}>
            {/* Handle Bar */}
            <View style={styles.handleBar} />
            
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>Acciones Rápidas</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close-circle" size={28} color={colors.textGray} />
              </TouchableOpacity>
            </View>

            {/* Actions Grid - Wrapped in ScrollView */}
            <View style={styles.scrollContainer}>
              <View style={styles.actionsGrid}>
                {actions.map((action) => (
                  <TouchableOpacity
                    key={action.id}
                    style={styles.actionCard}
                    onPress={action.onPress}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.actionIcon, { backgroundColor: action.color + '20' }]}>
                      <Ionicons name={action.icon as any} size={32} color={action.color} />
                    </View>
                    <Text style={styles.actionTitle}>{action.title}</Text>
                    <Text style={styles.actionSubtitle}>{action.subtitle}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Info */}
              <View style={styles.infoBox}>
                <Ionicons name="information-circle" size={16} color={colors.info} />
                <Text style={styles.infoText}>
                  Acceso directo a las funciones más utilizadas
                </Text>
              </View>
            </View>
          </Pressable>
      </Pressable>
    </Modal>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  content: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
    paddingBottom: 40, // Extra padding for safe area
    paddingHorizontal: 20,
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 20,
  },
  handleBar: {
    width: 40,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginVertical: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
  },
  closeButton: {
    padding: 4,
  },
  scrollContainer: {
    maxHeight: '100%',
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  actionCard: {
    width: '47%',
    backgroundColor: colors.backgroundGray,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    minHeight: 140,
  },
  actionIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  actionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 4,
  },
  actionSubtitle: {
    fontSize: 11,
    color: colors.textGray,
    textAlign: 'center',
    lineHeight: 14,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.info + '10',
    padding: 12,
    borderRadius: 12,
    gap: 8,
    marginBottom: 10,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: colors.textGray,
    lineHeight: 16,
  },
});
