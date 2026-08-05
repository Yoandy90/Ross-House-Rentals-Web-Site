/**
 * Componente de Plaid Link para verificación bancaria ACH
 * Integra con Stripe para guardar cuenta bancaria
 * NOTA: Plaid requiere build nativo, no funciona en Expo Go
 * Para desarrollo, muestra botón de simulación
 */

import React, { useCallback } from 'react';
import { TouchableOpacity, Text, StyleSheet, View, ActivityIndicator, Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../constants/colors';
import api from '../services/api';

interface PlaidLinkButtonProps {
  onSuccess: (publicToken: string, metadata: any) => Promise<void>;
  onExit?: (error: any, metadata: any) => void;
  buttonText?: string;
  disabled?: boolean;
}

export const PlaidLinkButton: React.FC<PlaidLinkButtonProps> = ({
  onSuccess,
  onExit,
  buttonText = 'Conectar Cuenta Bancaria',
  disabled = false,
}) => {
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const [loading, setLoading] = React.useState(false);
  
  // Plaid Link no disponible en Expo Go - mostrar mensaje
  const handlePress = () => {
    Alert.alert(
      '🚧 Funcionalidad en Desarrollo',
      'La verificación bancaria con Plaid requiere un build nativo de la app.\n\n' +
      'Esta funcionalidad estará disponible en la versión de producción.\n\n' +
      'Por ahora, puedes usar tarjetas de crédito para pagos.',
      [{ text: 'Entendido' }]
    );
  };

  return (
    <TouchableOpacity
      style={[styles.button, disabled && styles.buttonDisabled]}
      disabled={disabled}
      onPress={handlePress}
    >
      <Ionicons name="card-outline" size={20} color={colors.textWhite} />
      <Text style={styles.buttonText}>{buttonText}</Text>
      <Ionicons name="information-circle" size={20} color={colors.textWhite} />
    </TouchableOpacity>
  );
};

/**
 * Hook personalizado para gestionar ACH payment methods
 */
export const useACHPaymentMethod = () => {
  const [processing, setProcessing] = React.useState(false);

  const addBankAccount = async (
    publicToken: string,
    metadata: any,
    setAsDefault: boolean = false
  ): Promise<boolean> => {
    try {
      setProcessing(true);
      console.log('💳 Guardando cuenta bancaria...');

      // En un flujo real con Plaid + Stripe, necesitarías:
      // 1. Intercambiar publicToken por accessToken con Plaid
      // 2. Usar el accessToken para crear un payment method en Stripe
      // 3. Guardar el payment method

      // Por ahora, simplemente confirmamos el SetupIntent
      const response = await api.post('/payments/payment-methods/ach/confirm', {
        setup_intent_id: metadata.link_session_id, // O el ID apropiado
        set_as_default: setAsDefault,
      });

      if (response.data.id) {
        console.log('✅ Cuenta bancaria guardada:', response.data);
        return true;
      }

      return false;
    } catch (error: any) {
      console.error('❌ Error guardando cuenta bancaria:', error.response?.data || error.message);
      throw new Error(
        error.response?.data?.detail || 'No se pudo guardar la cuenta bancaria'
      );
    } finally {
      setProcessing(false);
    }
  };

  return {
    processing,
    addBankAccount,
  };
};

const createStyles = (colors: any) =>
  StyleSheet.create({
    button: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      paddingVertical: 16,
      paddingHorizontal: 24,
      borderRadius: 12,
      gap: 8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    buttonDisabled: {
      opacity: 0.5,
    },
    buttonText: {
      flex: 1,
      fontSize: 16,
      fontWeight: '700',
      color: colors.textWhite,
      textAlign: 'center',
    },
    loadingContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.backgroundGray,
      paddingVertical: 16,
      paddingHorizontal: 24,
      borderRadius: 12,
      gap: 12,
    },
    loadingText: {
      fontSize: 14,
      color: colors.textGray,
    },
  });
