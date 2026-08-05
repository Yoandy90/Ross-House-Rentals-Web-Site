import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useThemeColors } from '../constants/colors';

interface NativePaymentModalProps {
  visible: boolean;
  amount: number;
  onClose: () => void;
  onSuccess: () => void;
  stripePublishableKey: string;
}

export default function NativePaymentModal({
  visible,
  amount,
  onClose,
}: NativePaymentModalProps) {
  const colors = useThemeColors();
  const styles = createStyles(colors);

  return (
    <Modal visible={visible} animationType="slide" transparent={true}>
      <View style={styles.modalContainer}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Header */}
            <LinearGradient colors={[colors.primary, colors.primary + 'DD']} style={styles.header}>
              <View style={styles.headerContent}>
                <Ionicons name="wallet" size={32} color="#FFFFFF" />
                <View style={styles.headerTextContainer}>
                  <Text style={styles.headerTitle}>Agregar Créditos</Text>
                  <Text style={styles.headerSubtitle}>Disponible en app móvil</Text>
                </View>
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                  <Ionicons name="close" size={28} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </LinearGradient>

            {/* Content */}
            <ScrollView style={styles.formContainer} showsVerticalScrollIndicator={false}>
              {/* Amount Display */}
              <View style={styles.amountCard}>
                <Text style={styles.amountLabel}>Total a pagar</Text>
                <Text style={styles.amountValue}>${amount.toFixed(2)} USD</Text>
                <Text style={styles.amountSubtext}>{amount} créditos</Text>
              </View>

              {/* Web Message */}
              <View style={styles.webMessageCard}>
                <Ionicons name="phone-portrait-outline" size={64} color={colors.primary} />
                <Text style={styles.webMessageTitle}>Pagos Disponibles en App Móvil</Text>
                <Text style={styles.webMessageText}>
                  Para agregar créditos a tu cuenta, por favor utiliza la aplicación móvil de Ross Tax en tu iPhone o dispositivo Android.
                </Text>
                <View style={styles.featuresList}>
                  <View style={styles.featureItem}>
                    <Ionicons name="shield-checkmark" size={20} color={colors.primary} />
                    <Text style={styles.featureText}>Pagos seguros con Stripe</Text>
                  </View>
                  <View style={styles.featureItem}>
                    <Ionicons name="card" size={20} color={colors.primary} />
                    <Text style={styles.featureText}>Acepta tarjetas de crédito/débito</Text>
                  </View>
                  <View style={styles.featureItem}>
                    <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                    <Text style={styles.featureText}>Créditos instantáneos</Text>
                  </View>
                </View>
              </View>

              {/* Close Button */}
              <TouchableOpacity style={styles.closeButtonBottom} onPress={onClose}>
                <Text style={styles.closeButtonText}>Cerrar</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    modalContainer: {
      flex: 1,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: colors.background,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      maxHeight: '90%',
      overflow: 'hidden',
    },
    header: {
      paddingTop: 24,
      paddingBottom: 20,
      paddingHorizontal: 20,
    },
    headerContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
    },
    headerTextContainer: {
      flex: 1,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: '#FFFFFF',
      marginBottom: 4,
    },
    headerSubtitle: {
      fontSize: 14,
      color: '#FFFFFF',
      opacity: 0.9,
    },
    closeButton: {
      padding: 4,
    },
    formContainer: {
      padding: 20,
    },
    amountCard: {
      backgroundColor: colors.primary + '10',
      borderRadius: 16,
      padding: 24,
      alignItems: 'center',
      marginBottom: 24,
      borderWidth: 2,
      borderColor: colors.primary + '30',
    },
    amountLabel: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 8,
    },
    amountValue: {
      fontSize: 36,
      fontWeight: '700',
      color: colors.primary,
      marginBottom: 4,
    },
    amountSubtext: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    webMessageCard: {
      backgroundColor: colors.backgroundGray,
      borderRadius: 16,
      padding: 32,
      alignItems: 'center',
      marginBottom: 24,
    },
    webMessageTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
      marginTop: 16,
      marginBottom: 12,
      textAlign: 'center',
    },
    webMessageText: {
      fontSize: 15,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
      marginBottom: 24,
    },
    featuresList: {
      width: '100%',
      gap: 16,
    },
    featureItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    featureText: {
      fontSize: 14,
      color: colors.text,
      fontWeight: '500',
    },
    closeButtonBottom: {
      padding: 16,
      alignItems: 'center',
      backgroundColor: colors.backgroundGray,
      borderRadius: 12,
    },
    closeButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.textSecondary,
    },
  });
