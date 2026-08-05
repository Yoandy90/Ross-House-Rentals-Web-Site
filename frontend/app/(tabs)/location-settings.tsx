/**
 * Pantalla de configuración de geolocalización
 * Permite al usuario habilitar/deshabilitar tracking de ubicación
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../../constants/colors';
import { useTranslation } from 'react-i18next';
import { useLocation } from '../../hooks/useLocation';
import { useRouter } from 'expo-router';

export default function LocationSettingsScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();

  const {
    location,
    loading,
    error,
    permissionStatus,
    trackingEnabled,
    requestPermissions,
    getCurrentLocation,
    updateLocation,
    startTracking,
    stopTracking,
  } = useLocation();

  const [isUpdating, setIsUpdating] = useState(false);
  const [hasAutoStarted, setHasAutoStarted] = useState(false);

  // Auto-solicitar permisos y activar tracking al cargar la pantalla
  useEffect(() => {
    const autoEnableLocation = async () => {
      if (hasAutoStarted) return;
      setHasAutoStarted(true);

      
      // Solicitar permisos automáticamente
      const granted = await requestPermissions();
      
      if (granted) {
        // Si se otorgan permisos, activar tracking automáticamente
        const trackingStarted = await startTracking();
        if (trackingStarted) {
        }
      }
    };

    autoEnableLocation();
  }, [hasAutoStarted]);

  const handleToggleTracking = async (value: boolean) => {
    if (value) {
      // Habilitar tracking
      const success = await startTracking();
      if (!success) {
        Alert.alert(
          'Error',
          'No se pudo iniciar el tracking de ubicación. Verifica los permisos.'
        );
      } else {
        Alert.alert(
          '✅ Tracking Activado',
          'Tu ubicación se actualizará automáticamente cada 5 minutos o cuando te muevas significativamente.'
        );
      }
    } else {
      // Deshabilitar tracking
      await stopTracking();
      Alert.alert(
        'Tracking Desactivado',
        'Ya no se rastreará tu ubicación automáticamente.'
      );
    }
  };

  const handleManualUpdate = async () => {
    setIsUpdating(true);
    const success = await updateLocation();
    setIsUpdating(false);

    if (success) {
      Alert.alert(
        '✅ Ubicación Actualizada',
        'Tu ubicación ha sido enviada al servidor correctamente.'
      );
    } else {
      Alert.alert(
        'Error',
        'No se pudo actualizar la ubicación. Intenta de nuevo.'
      );
    }
  };

  const handleRequestPermissions = async () => {
    const granted = await requestPermissions();
    if (granted) {
      Alert.alert(
        'Permisos Concedidos',
        'Ahora puedes usar las funciones de ubicación.'
      );
    } else {
      Alert.alert(
        'Permisos Denegados',
        'Para usar esta función, necesitas habilitar los permisos de ubicación en la configuración de tu dispositivo.'
      );
    }
  };

  return (
    <View style={styles.container}>
      {/* Header Moderno */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerTextContainer}>
          <Text style={styles.headerTitle}>📍 Geolocalización</Text>
          <Text style={styles.headerSubtitle}>Configura tu ubicación</Text>
        </View>
      </View>

      <ScrollView style={styles.content}>
        {/* Info Card */}
        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={24} color={colors.primary} />
          <Text style={styles.infoText}>
            Esta función permite a Ross Tax conocer tu ubicación para mejorar el
            servicio y detectar automáticamente cuando cambias de dirección.
          </Text>
        </View>

        {/* Permission Status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Estado de Permisos</Text>
          <View style={styles.card}>
            <View style={styles.statusRow}>
              <Ionicons
                name={
                  permissionStatus === 'granted'
                    ? 'checkmark-circle'
                    : 'alert-circle'
                }
                size={24}
                color={
                  permissionStatus === 'granted'
                    ? colors.success
                    : colors.warning
                }
              />
              <View style={styles.statusTextContainer}>
                <Text style={styles.statusLabel}>Permisos de Ubicación</Text>
                <Text style={styles.statusValue}>
                  {permissionStatus === 'granted'
                    ? 'Concedido'
                    : permissionStatus === 'denied'
                    ? 'Denegado'
                    : 'No solicitado'}
                </Text>
              </View>
            </View>

            {permissionStatus !== 'granted' && (
              <TouchableOpacity
                style={styles.button}
                onPress={handleRequestPermissions}
              >
                <Text style={styles.buttonText}>Solicitar Permisos</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Tracking Toggle */}
        {permissionStatus === 'granted' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Tracking Automático</Text>
            <View style={styles.card}>
              <View style={styles.switchRow}>
                <View style={styles.switchInfo}>
                  <Text style={styles.switchLabel}>Habilitar Tracking</Text>
                  <Text style={styles.switchDescription}>
                    Actualizar ubicación automáticamente
                  </Text>
                </View>
                <Switch
                  value={trackingEnabled}
                  onValueChange={handleToggleTracking}
                  trackColor={{ false: colors.border, true: colors.primary + '60' }}
                  thumbColor={trackingEnabled ? colors.primary : colors.textGray}
                />
              </View>

              {trackingEnabled && (
                <View style={styles.trackingInfo}>
                  <Ionicons name="time-outline" size={16} color={colors.textGray} />
                  <Text style={styles.trackingInfoText}>
                    Se actualiza cada 5 minutos o al moverte 500m
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Current Location */}
        {permissionStatus === 'granted' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Ubicación Actual</Text>
            <View style={styles.card}>
              {loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={colors.primary} />
                  <Text style={styles.loadingText}>Obteniendo ubicación...</Text>
                </View>
              ) : location ? (
                <View style={styles.locationInfo}>
                  <View style={styles.locationRow}>
                    <Ionicons name="location" size={20} color={colors.primary} />
                    <View style={styles.locationDetails}>
                      <Text style={styles.locationLabel}>Coordenadas</Text>
                      <Text style={styles.locationValue}>
                        {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                      </Text>
                    </View>
                  </View>

                  {location.city && (
                    <View style={styles.locationRow}>
                      <Ionicons name="business" size={20} color={colors.primary} />
                      <View style={styles.locationDetails}>
                        <Text style={styles.locationLabel}>Ciudad</Text>
                        <Text style={styles.locationValue}>{location.city}</Text>
                      </View>
                    </View>
                  )}

                  {location.state && (
                    <View style={styles.locationRow}>
                      <Ionicons name="map" size={20} color={colors.primary} />
                      <View style={styles.locationDetails}>
                        <Text style={styles.locationLabel}>Estado</Text>
                        <Text style={styles.locationValue}>{location.state}</Text>
                      </View>
                    </View>
                  )}

                  {location.accuracy && (
                    <View style={styles.locationRow}>
                      <Ionicons name="radio" size={20} color={colors.primary} />
                      <View style={styles.locationDetails}>
                        <Text style={styles.locationLabel}>Precisión</Text>
                        <Text style={styles.locationValue}>
                          ±{Math.round(location.accuracy)}m
                        </Text>
                      </View>
                    </View>
                  )}
                </View>
              ) : (
                <Text style={styles.noLocationText}>
                  No hay ubicación disponible
                </Text>
              )}

              <TouchableOpacity
                style={[styles.button, isUpdating && styles.buttonDisabled]}
                onPress={handleManualUpdate}
                disabled={isUpdating}
              >
                {isUpdating ? (
                  <ActivityIndicator size="small" color={colors.textWhite} />
                ) : (
                  <>
                    <Ionicons name="refresh" size={20} color={colors.textWhite} />
                    <Text style={styles.buttonText}>Actualizar Ahora</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Error Message */}
        {error && (
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle" size={24} color={colors.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Privacy Info */}
        <View style={styles.privacyCard}>
          <Ionicons name="shield-checkmark" size={24} color={colors.success} />
          <View style={styles.privacyTextContainer}>
            <Text style={styles.privacyTitle}>Tu Privacidad es Importante</Text>
            <Text style={styles.privacyText}>
              • Tu ubicación solo se usa para mejorar el servicio{'\n'}
              • Puedes desactivar el tracking en cualquier momento{'\n'}
              • Los datos se almacenan de forma segura{'\n'}
              • No compartimos tu ubicación con terceros
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#f8fafc',
    },
    header: {
      backgroundColor: '#6C1110',
      paddingTop: 60,
      paddingBottom: 20,
      paddingHorizontal: 20,
      flexDirection: 'row',
      alignItems: 'center',
    },
    backButton: {
      marginRight: 16,
      padding: 4,
    },
    headerTextContainer: {
      flex: 1,
    },
    headerTitle: {
      fontSize: 28,
      fontWeight: 'bold',
      color: '#fff',
      marginBottom: 4,
    },
    headerSubtitle: {
      fontSize: 14,
      color: 'rgba(255,255,255,0.9)',
    },
    content: {
      flex: 1,
    },
    infoCard: {
      flexDirection: 'row',
      backgroundColor: colors.primary + '15',
      margin: 16,
      padding: 16,
      borderRadius: 12,
      gap: 12,
    },
    infoText: {
      flex: 1,
      fontSize: 14,
      color: colors.text,
      lineHeight: 20,
    },
    section: {
      marginHorizontal: 16,
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 12,
    },
    card: {
      backgroundColor: colors.background,
      borderRadius: 12,
      padding: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    statusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 16,
    },
    statusTextContainer: {
      flex: 1,
    },
    statusLabel: {
      fontSize: 14,
      color: colors.textGray,
      marginBottom: 4,
    },
    statusValue: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    switchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    switchInfo: {
      flex: 1,
    },
    switchLabel: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4,
    },
    switchDescription: {
      fontSize: 14,
      color: colors.textGray,
    },
    trackingInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    trackingInfoText: {
      fontSize: 13,
      color: colors.textGray,
    },
    loadingContainer: {
      alignItems: 'center',
      padding: 24,
    },
    loadingText: {
      marginTop: 12,
      fontSize: 14,
      color: colors.textGray,
    },
    locationInfo: {
      gap: 16,
      marginBottom: 16,
    },
    locationRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
    },
    locationDetails: {
      flex: 1,
    },
    locationLabel: {
      fontSize: 13,
      color: colors.textGray,
      marginBottom: 4,
    },
    locationValue: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
    },
    noLocationText: {
      textAlign: 'center',
      fontSize: 14,
      color: colors.textGray,
      marginVertical: 24,
    },
    button: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      paddingVertical: 14,
      paddingHorizontal: 20,
      borderRadius: 8,
      gap: 8,
    },
    buttonDisabled: {
      opacity: 0.5,
    },
    buttonText: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.textWhite,
    },
    errorCard: {
      flexDirection: 'row',
      backgroundColor: colors.error + '15',
      margin: 16,
      padding: 16,
      borderRadius: 12,
      gap: 12,
    },
    errorText: {
      flex: 1,
      fontSize: 14,
      color: colors.error,
      lineHeight: 20,
    },
    privacyCard: {
      flexDirection: 'row',
      backgroundColor: colors.success + '10',
      margin: 16,
      padding: 16,
      borderRadius: 12,
      gap: 12,
      marginBottom: 32,
    },
    privacyTextContainer: {
      flex: 1,
    },
    privacyTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 8,
    },
    privacyText: {
      fontSize: 13,
      color: colors.textGray,
      lineHeight: 20,
    },
  });
