/**
 * Pantalla para agregar cuenta bancaria ACH con Plaid
 * Integración completa con Plaid Link y Stripe
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../../constants/colors';
import { useRouter } from 'expo-router';
import { PlaidLinkButton, useACHPaymentMethod } from '../../components/PlaidLink';
import { useTranslation } from 'react-i18next';

export default function AddBankAccountScreen() {
  const colors = useThemeColors();
  const { t } = useTranslation();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  
  const { processing, addBankAccount } = useACHPaymentMethod();
  const [selectedAccount, setSelectedAccount] = useState<any>(null);

  const handlePlaidSuccess = async (publicToken: string, metadata: any) => {
    
    try {
      setSelectedAccount(metadata.accounts[0]);
      
      // Confirmar con el usuario antes de guardar
      Alert.alert(
        '✅ Banco Verificado',
        t('bankAccount.accountVerified', `Cuenta verificada exitosamente:\n\n`) +
        `${t('bankAccount.bankLabel', 'Banco')}: ${metadata.institution.name}\n` +
        `${t('bankAccount.accountLabel', 'Cuenta')}: ${metadata.accounts[0].name}\n` +
        `${t('bankAccount.typeLabel', 'Tipo')}: ${metadata.accounts[0].subtype === 'checking' ? t('bankAccount.checking', 'Corriente') : t('bankAccount.savings', 'Ahorros')}\n` +
        `${t('bankAccount.last4', 'Últimos 4')}: •••• ${metadata.accounts[0].mask}\n\n` +
        t('bankAccount.saveConfirmation', '¿Deseas guardar esta cuenta para pagos futuros?'),
        [
          {
            text: t('common.cancel', 'Cancelar'),
            style: 'cancel',
          },
          {
            text: t('bankAccount.yesSave', 'Sí, Guardar'),
            onPress: async () => {
              try {
                const success = await addBankAccount(publicToken, metadata, false);
                
                if (success) {
                  Alert.alert(
                    t('bankAccount.accountSavedTitle', '🎉 ¡Cuenta Guardada!'),
                    t('bankAccount.accountSavedMsg', 'Tu cuenta bancaria ha sido agregada exitosamente.\n\nAhora puedes usarla para pagos con ACH.\n\n💡 Ventajas de ACH:\n• Tarifas más bajas (0.8% vs 2.9%)\n• Sin tarjeta de crédito necesaria\n• Ideal para pagos grandes\n\n⏱️ Los pagos ACH tardan 5-7 días hábiles.'),
                    [
                      {
                        text: t('bankAccount.understood', 'Entendido'),
                        onPress: () => router.back(),
                      },
                    ]
                  );
                } else {
                  Alert.alert(t('common.error', 'Error'), t('bankAccount.saveFailed', t('addBankAccount.saveError', 'No se pudo guardar la cuenta')));
                }
              } catch (error: any) {
                Alert.alert(t('common.error', 'Error'), error.message);
              }
            },
          },
        ]
      );
    } catch (error) {
      console.error('❌ Error procesando cuenta:', error);
      Alert.alert(t('common.error', 'Error'), t('bankAccount.processFailed', 'No se pudo procesar la cuenta bancaria'));
    }
  };

  const handlePlaidExit = (error: any, metadata: any) => {
    if (error) {
      console.error('❌ Plaid Error:', error);
      
      if (error.error_code === 'INVALID_LINK_TOKEN') {
        Alert.alert(
          t('addBankAccount.configError', 'Error de Configuración'),
          t('addBankAccount.configErrorMessage', 'Hubo un problema con la configuración. Por favor, intenta de nuevo.')
        );
      } else if (error.error_code === 'INSTITUTION_NOT_RESPONDING') {
        Alert.alert(
          t('addBankAccount.bankUnavailable', 'Banco No Disponible'),
          t('addBankAccount.bankUnavailableMessage', 'Tu banco no está respondiendo en este momento. Intenta más tarde.')
        );
      }
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('addBankAccount.title')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Info Card */}
        <View style={styles.infoCard}>
          <Ionicons name="shield-checkmark" size={40} color={colors.success} />
          <View style={styles.infoTextContainer}>
            <Text style={styles.infoTitle}>Conexión Segura con Plaid</Text>
            <Text style={styles.infoText}>
              Usamos Plaid para conectar tu banco de forma segura. Ross Tax nunca
              ve tu contraseña bancaria.
            </Text>
          </View>
        </View>

        {/* Benefits */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ventajas de Pagar con ACH</Text>
          
          <View style={styles.benefitCard}>
            <Ionicons name="cash-outline" size={24} color={colors.success} />
            <View style={styles.benefitText}>
              <Text style={styles.benefitTitle}>Tarifas Más Bajas</Text>
              <Text style={styles.benefitDescription}>
                0.8% vs 2.9% de tarjetas de crédito
              </Text>
            </View>
          </View>

          <View style={styles.benefitCard}>
            <Ionicons name="infinite-outline" size={24} color={colors.success} />
            <View style={styles.benefitText}>
              <Text style={styles.benefitTitle}>Sin Expiración</Text>
              <Text style={styles.benefitDescription}>
                Las cuentas bancarias no expiran como las tarjetas
              </Text>
            </View>
          </View>

          <View style={styles.benefitCard}>
            <Ionicons name="trending-up-outline" size={24} color={colors.success} />
            <View style={styles.benefitText}>
              <Text style={styles.benefitTitle}>Ideal para Pagos Grandes</Text>
              <Text style={styles.benefitDescription}>
                Perfecta para suscripciones y servicios costosos
              </Text>
            </View>
          </View>

          <View style={styles.benefitCard}>
            <Ionicons name="lock-closed-outline" size={24} color={colors.success} />
            <View style={styles.benefitText}>
              <Text style={styles.benefitTitle}>100% Seguro</Text>
              <Text style={styles.benefitDescription}>
                Encriptación bancaria y verificación instantánea
              </Text>
            </View>
          </View>
        </View>

        {/* Process Steps */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cómo Funciona</Text>
          
          <View style={styles.stepCard}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>1</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Conecta tu Banco</Text>
              <Text style={styles.stepDescription}>
                Selecciona tu banco y autoriza la conexión
              </Text>
            </View>
          </View>

          <View style={styles.stepCard}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>2</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Verificación Instantánea</Text>
              <Text style={styles.stepDescription}>
                Plaid verifica tu cuenta al instante (sin micro-depósitos)
              </Text>
            </View>
          </View>

          <View style={styles.stepCard}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>3</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>¡Listo para Usar!</Text>
              <Text style={styles.stepDescription}>
                Usa tu cuenta para pagos ACH inmediatamente
              </Text>
            </View>
          </View>
        </View>

        {/* Important Notes */}
        <View style={styles.warningCard}>
          <Ionicons name="time-outline" size={24} color={colors.warning} />
          <View style={styles.warningTextContainer}>
            <Text style={styles.warningTitle}>Tiempo de Procesamiento</Text>
            <Text style={styles.warningText}>
              Los pagos ACH tardan 5-7 días hábiles en completarse. No son
              ideales para pagos urgentes.
            </Text>
          </View>
        </View>

        {/* Plaid Link Button */}
        <View style={styles.buttonContainer}>
          {processing ? (
            <View style={styles.processingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.processingText}>Guardando cuenta bancaria...</Text>
            </View>
          ) : (
            <PlaidLinkButton
              onSuccess={handlePlaidSuccess}
              onExit={handlePlaidExit}
              buttonText={t('addBankAccount.connectPlaid', 'Conectar con Plaid')}
            />
          )}
        </View>

        {/* Security Footer */}
        <View style={styles.securityFooter}>
          <Ionicons name="shield-checkmark" size={20} color={colors.textGray} />
          <Text style={styles.securityText}>
            Protegido por encriptación bancaria de nivel empresarial
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.backgroundGray,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 16,
      backgroundColor: colors.background,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backButton: {
      padding: 8,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
    },
    content: {
      flex: 1,
    },
    contentContainer: {
      padding: 16,
    },
    infoCard: {
      flexDirection: 'row',
      backgroundColor: colors.success + '15',
      padding: 20,
      borderRadius: 16,
      gap: 16,
      marginBottom: 24,
      alignItems: 'center',
    },
    infoTextContainer: {
      flex: 1,
    },
    infoTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 8,
    },
    infoText: {
      fontSize: 14,
      color: colors.textGray,
      lineHeight: 20,
    },
    section: {
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 16,
    },
    benefitCard: {
      flexDirection: 'row',
      backgroundColor: colors.background,
      padding: 16,
      borderRadius: 12,
      gap: 16,
      marginBottom: 12,
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 2,
    },
    benefitText: {
      flex: 1,
    },
    benefitTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4,
    },
    benefitDescription: {
      fontSize: 14,
      color: colors.textGray,
    },
    stepCard: {
      flexDirection: 'row',
      backgroundColor: colors.background,
      padding: 16,
      borderRadius: 12,
      gap: 16,
      marginBottom: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 2,
    },
    stepNumber: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepNumberText: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.textWhite,
    },
    stepContent: {
      flex: 1,
    },
    stepTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4,
    },
    stepDescription: {
      fontSize: 14,
      color: colors.textGray,
      lineHeight: 20,
    },
    warningCard: {
      flexDirection: 'row',
      backgroundColor: colors.warning + '15',
      padding: 16,
      borderRadius: 12,
      gap: 12,
      marginBottom: 24,
      alignItems: 'flex-start',
    },
    warningTextContainer: {
      flex: 1,
    },
    warningTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4,
    },
    warningText: {
      fontSize: 13,
      color: colors.textGray,
      lineHeight: 18,
    },
    buttonContainer: {
      marginBottom: 16,
    },
    processingContainer: {
      alignItems: 'center',
      padding: 32,
    },
    processingText: {
      marginTop: 16,
      fontSize: 16,
      color: colors.textGray,
    },
    securityFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 16,
    },
    securityText: {
      fontSize: 12,
      color: colors.textGray,
      textAlign: 'center',
    },
  });
