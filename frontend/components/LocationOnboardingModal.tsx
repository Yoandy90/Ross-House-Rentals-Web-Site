/**
 * Modal de Onboarding para Geolocalización
 * Se muestra una vez después del primer registro
 */

import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../constants/colors';
import { BlurView } from 'expo-blur';

interface LocationOnboardingModalProps {
  visible: boolean;
  onAccept: () => Promise<void>;
  onDecline: () => void;
  loading?: boolean;
}

export const LocationOnboardingModal: React.FC<LocationOnboardingModalProps> = ({
  visible,
  onAccept,
  onDecline,
  loading = false,
}) => {
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDecline}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Icon */}
          <View style={styles.iconContainer}>
            <View style={styles.iconCircle}>
              <Ionicons name="location" size={48} color={colors.primary} />
            </View>
          </View>

          {/* Title */}
          <Text style={styles.title}>🗺️ Ayúdanos a Servirte Mejor</Text>

          {/* Description */}
          <Text style={styles.description}>
            ¿Quieres compartir tu ubicación con nosotros?
          </Text>

          {/* Benefits */}
          <View style={styles.benefitsContainer}>
            <View style={styles.benefitRow}>
              <Ionicons name="checkmark-circle" size={20} color={colors.success} />
              <Text style={styles.benefitText}>
                Detectar automáticamente cambios de domicilio
              </Text>
            </View>
            
            <View style={styles.benefitRow}>
              <Ionicons name="checkmark-circle" size={20} color={colors.success} />
              <Text style={styles.benefitText}>
                Mejorar nuestro servicio según tu ubicación
              </Text>
            </View>
            
            <View style={styles.benefitRow}>
              <Ionicons name="checkmark-circle" size={20} color={colors.success} />
              <Text style={styles.benefitText}>
                Actualizar tu información fiscal automáticamente
              </Text>
            </View>

            <View style={styles.benefitRow}>
              <Ionicons name="checkmark-circle" size={20} color={colors.success} />
              <Text style={styles.benefitText}>
                Puedes desactivarlo en cualquier momento
              </Text>
            </View>
          </View>

          {/* Privacy Note */}
          <View style={styles.privacyNote}>
            <Ionicons name="shield-checkmark" size={16} color={colors.textGray} />
            <Text style={styles.privacyText}>
              Tu privacidad es importante. Solo usamos tu ubicación para mejorar el servicio.
            </Text>
          </View>

          {/* Buttons */}
          <View style={styles.buttonsContainer}>
            <TouchableOpacity
              style={[styles.button, styles.primaryButton]}
              onPress={onAccept}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color={colors.textWhite} />
              ) : (
                <>
                  <Ionicons name="location" size={20} color={colors.textWhite} />
                  <Text style={styles.primaryButtonText}>Sí, Compartir</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.secondaryButton]}
              onPress={onDecline}
              disabled={loading}
            >
              <Text style={styles.secondaryButtonText}>Ahora No</Text>
            </TouchableOpacity>
          </View>

          {/* Info */}
          <Text style={styles.infoText}>
            Siempre puedes cambiar esta configuración en tu perfil
          </Text>
        </View>
      </View>
    </Modal>
  );
};

const createStyles = (colors: any) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    modalContainer: {
      backgroundColor: colors.background,
      borderRadius: 24,
      padding: 24,
      width: '100%',
      maxWidth: 400,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.3,
      shadowRadius: 20,
      elevation: 10,
    },
    iconContainer: {
      alignItems: 'center',
      marginBottom: 16,
    },
    iconCircle: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: colors.primary + '15',
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
      marginBottom: 12,
    },
    description: {
      fontSize: 16,
      color: colors.textGray,
      textAlign: 'center',
      marginBottom: 24,
      lineHeight: 22,
    },
    benefitsContainer: {
      marginBottom: 20,
      gap: 12,
    },
    benefitRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
    },
    benefitText: {
      flex: 1,
      fontSize: 14,
      color: colors.text,
      lineHeight: 20,
    },
    privacyNote: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      backgroundColor: colors.backgroundGray,
      padding: 12,
      borderRadius: 8,
      marginBottom: 24,
    },
    privacyText: {
      flex: 1,
      fontSize: 12,
      color: colors.textGray,
      lineHeight: 16,
    },
    buttonsContainer: {
      gap: 12,
      marginBottom: 16,
    },
    button: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 16,
      paddingHorizontal: 24,
      borderRadius: 12,
      gap: 8,
    },
    primaryButton: {
      backgroundColor: colors.primary,
    },
    primaryButtonText: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.textWhite,
    },
    secondaryButton: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: colors.border,
    },
    secondaryButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    infoText: {
      fontSize: 12,
      color: colors.textGray,
      textAlign: 'center',
      lineHeight: 16,
    },
  });
