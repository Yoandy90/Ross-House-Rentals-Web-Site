/**
 * Hook para gestionar el onboarding de geolocalización
 * Maneja permisos, tracking y persistencia de preferencias
 */

import { useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import * as Location from 'expo-location';
import api from '../services/api';

const STORAGE_KEY = '@ross_tax_location_onboarding_asked';

export const useLocationOnboarding = () => {
  const [loading, setLoading] = useState(false);

  /**
   * Verificar si ya se preguntó sobre ubicación
   */
  const checkIfAlreadyAsked = async (): Promise<boolean> => {
    try {
      const asked = await AsyncStorage.getItem(STORAGE_KEY);
      return asked === 'true';
    } catch (error) {
      console.error('Error checking onboarding status:', error);
      return false;
    }
  };

  /**
   * Marcar como preguntado
   */
  const markAsAsked = async (): Promise<void> => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, 'true');
    } catch (error) {
      console.error('Error marking onboarding as asked:', error);
    }
  };

  /**
   * Cuando usuario acepta compartir ubicación
   */
  const handleAccept = async (): Promise<boolean> => {
    try {
      setLoading(true);
      console.log('🗺️ Usuario acepta compartir ubicación');

      // 1. Solicitar permisos
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert(
          'Permisos Denegados',
          'Para habilitar el tracking de ubicación, necesitamos tu permiso.\n\n' +
          'Puedes habilitarlo más tarde en Perfil → Geolocalización.',
          [{ text: 'Entendido' }]
        );
        await markAsAsked();
        return false;
      }

      console.log('✅ Permisos de ubicación concedidos');

      // 2. Obtener ubicación actual
      console.log('📍 Obteniendo ubicación inicial...');
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      // 3. Intentar obtener información de dirección
      let locationData: any = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy,
      };

      try {
        const [address] = await Location.reverseGeocodeAsync({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });

        if (address) {
          locationData = {
            ...locationData,
            city: address.city || undefined,
            state: address.region || undefined,
            country: address.country || 'US',
            postal_code: address.postalCode || undefined,
          };
        }
      } catch (geoError) {
        console.log('⚠️ Reverse geocoding failed:', geoError);
      }

      // 4. Intentar enviar ubicación al backend (opcional, no bloqueante)
      try {
        console.log('📤 Enviando ubicación al backend...');
        await api.post('/location/update', locationData);
        console.log('✅ Ubicación inicial enviada');

        // 5. Habilitar tracking automático en el backend
        console.log('🔄 Habilitando tracking automático...');
        await api.post('/location/toggle-tracking', { enabled: true });
        console.log('✅ Tracking automático habilitado');
      } catch (backendError) {
        console.log('⚠️ No se pudo enviar ubicación al backend (no crítico):', backendError);
        // No es crítico, continuamos
      }

      // 6. Guardar ubicación localmente en AsyncStorage
      try {
        await AsyncStorage.setItem('@user_location', JSON.stringify(locationData));
        console.log('✅ Ubicación guardada localmente');
      } catch (storageError) {
        console.log('⚠️ No se pudo guardar ubicación localmente:', storageError);
      }

      // 7. Marcar como preguntado
      await markAsAsked();

      // 8. Mostrar mensaje de éxito
      Alert.alert(
        '✅ ¡Ubicación Configurada!',
        `Ubicación obtenida: ${locationData.city || 'Sin ciudad'}, ${locationData.state || 'Sin estado'}\n\n` +
        'Gracias por compartir tu ubicación. Esto nos ayuda a ofrecerte un mejor servicio.',
        [{ text: 'Perfecto' }]
      );

      return true;
    } catch (error: any) {
      console.error('❌ Error en onboarding de ubicación:', error);
      
      Alert.alert(
        'Error',
        'No pudimos configurar tu ubicación en este momento. Intenta más tarde desde Perfil → Geolocalización.',
        [{ text: 'Entendido' }]
      );

      // Marcar como preguntado de todos modos para no molestar
      await markAsAsked();
      return false;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Cuando usuario rechaza compartir ubicación
   */
  const handleDecline = async (): Promise<void> => {
    try {
      console.log('⏭️ Usuario rechaza compartir ubicación');

      // Marcar como preguntado
      await markAsAsked();

      // Mensaje informativo
      Alert.alert(
        'Entendido',
        'Puedes habilitar la ubicación en cualquier momento desde Perfil → Geolocalización.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Error handling decline:', error);
      // Marcar de todos modos
      await markAsAsked();
    }
  };

  return {
    loading,
    checkIfAlreadyAsked,
    handleAccept,
    handleDecline,
  };
};
