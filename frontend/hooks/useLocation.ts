/**
 * Hook personalizado para gestión de geolocalización
 * Captura y envía ubicación del usuario al backend
 */

import { useState, useEffect, useRef } from 'react';
import * as Location from 'expo-location';
import { Platform } from 'react-native';
import api from '../services/api';

interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  city?: string;
  state?: string;
  country?: string;
  postal_code?: string;
}

interface LocationState {
  location: LocationData | null;
  error: string | null;
  loading: boolean;
  permissionStatus: Location.PermissionStatus | null;
  trackingEnabled: boolean;
}

export const useLocation = (autoStart: boolean = false) => {
  const [state, setState] = useState<LocationState>({
    location: null,
    error: null,
    loading: false,
    permissionStatus: null,
    trackingEnabled: false,
  });

  const watchSubscription = useRef<Location.LocationSubscription | null>(null);
  const lastUpdateTime = useRef<number>(0);

  // Mínimo tiempo entre actualizaciones (5 minutos)
  const MIN_UPDATE_INTERVAL = 5 * 60 * 1000;

  /**
   * Solicitar permisos de ubicación
   */
  const requestPermissions = async (): Promise<boolean> => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));

      // Solicitar permisos
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      setState(prev => ({ 
        ...prev, 
        permissionStatus: status,
        loading: false 
      }));

      if (status !== 'granted') {
        setState(prev => ({ 
          ...prev, 
          error: 'Permiso de ubicación denegado' 
        }));
        return false;
      }

      return true;
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        error: `Error al solicitar permisos: ${error}`,
        loading: false 
      }));
      return false;
    }
  };

  /**
   * Obtener ubicación actual una vez
   */
  const getCurrentLocation = async (): Promise<LocationData | null> => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));

      // Verificar permisos
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') {
        const granted = await requestPermissions();
        if (!granted) return null;
      }

      // Obtener ubicación
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      // Intentar obtener información de la dirección (reverse geocoding)
      let addressInfo: LocationData = {
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
          addressInfo = {
            ...addressInfo,
            city: address.city || undefined,
            state: address.region || undefined,
            country: address.country || 'US',
            postal_code: address.postalCode || undefined,
          };
        }
      } catch (geoError) {
        console.log('⚠️ Reverse geocoding failed:', geoError);
        // Continuar sin información de dirección
      }

      setState(prev => ({ 
        ...prev, 
        location: addressInfo,
        loading: false 
      }));

      return addressInfo;
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        error: `Error al obtener ubicación: ${error}`,
        loading: false 
      }));
      return null;
    }
  };

  /**
   * Enviar ubicación al backend
   */
  const sendLocationToBackend = async (locationData: LocationData): Promise<boolean> => {
    try {
      const now = Date.now();
      
      // Evitar actualizaciones muy frecuentes
      if (now - lastUpdateTime.current < MIN_UPDATE_INTERVAL) {
        console.log('⏱️ Actualizaciones muy frecuentes, saltando envío');
        return false;
      }

      console.log('📍 Enviando ubicación al backend:', locationData);

      const response = await api.post('/location/update', locationData);

      if (response.data.success) {
        lastUpdateTime.current = now;
        console.log('✅ Ubicación enviada correctamente');
        return true;
      }

      return false;
    } catch (error: any) {
      console.error('❌ Error al enviar ubicación:', error.response?.data || error.message);
      return false;
    }
  };

  /**
   * Obtener y enviar ubicación actual
   */
  const updateLocation = async (): Promise<boolean> => {
    const location = await getCurrentLocation();
    if (location) {
      return await sendLocationToBackend(location);
    }
    return false;
  };

  /**
   * Iniciar tracking continuo de ubicación
   */
  const startTracking = async (): Promise<boolean> => {
    try {
      console.log('🚀 Iniciando tracking de ubicación...');

      // Verificar permisos
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') {
        const granted = await requestPermissions();
        if (!granted) return false;
      }

      // Detener tracking anterior si existe
      if (watchSubscription.current) {
        watchSubscription.current.remove();
      }

      // Iniciar watch de ubicación
      watchSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: MIN_UPDATE_INTERVAL, // Actualizar cada 5 minutos
          distanceInterval: 500, // O cuando se mueva 500 metros
        },
        async (location) => {
          console.log('📍 Nueva ubicación detectada');

          // Obtener información de dirección
          let addressInfo: LocationData = {
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
              addressInfo = {
                ...addressInfo,
                city: address.city || undefined,
                state: address.region || undefined,
                country: address.country || 'US',
                postal_code: address.postalCode || undefined,
              };
            }
          } catch (geoError) {
            console.log('⚠️ Reverse geocoding failed:', geoError);
          }

          // Actualizar estado local
          setState(prev => ({ ...prev, location: addressInfo }));

          // Enviar al backend
          await sendLocationToBackend(addressInfo);
        }
      );

      // Actualizar estado del backend
      try {
        await api.post('/location/toggle-tracking', { enabled: true });
      } catch (error) {
        console.error('Error al actualizar estado de tracking:', error);
      }

      setState(prev => ({ ...prev, trackingEnabled: true }));
      console.log('✅ Tracking iniciado');

      return true;
    } catch (error) {
      console.error('❌ Error al iniciar tracking:', error);
      setState(prev => ({ 
        ...prev, 
        error: `Error al iniciar tracking: ${error}`,
        trackingEnabled: false 
      }));
      return false;
    }
  };

  /**
   * Detener tracking de ubicación
   */
  const stopTracking = async () => {
    console.log('🛑 Deteniendo tracking de ubicación...');

    if (watchSubscription.current) {
      watchSubscription.current.remove();
      watchSubscription.current = null;
    }

    // Actualizar estado del backend
    try {
      await api.post('/location/toggle-tracking', { enabled: false });
    } catch (error) {
      console.error('Error al actualizar estado de tracking:', error);
    }

    setState(prev => ({ ...prev, trackingEnabled: false }));
    console.log('✅ Tracking detenido');
  };

  /**
   * Obtener historial de ubicaciones
   */
  const getLocationHistory = async (limit: number = 50) => {
    try {
      const response = await api.get(`/location/history?limit=${limit}`);
      return response.data.locations || [];
    } catch (error) {
      console.error('Error al obtener historial:', error);
      return [];
    }
  };

  /**
   * Auto-start tracking si está habilitado
   */
  useEffect(() => {
    if (autoStart) {
      requestPermissions().then((granted) => {
        if (granted) {
          startTracking();
        }
      });
    }

    // Cleanup al desmontar
    return () => {
      if (watchSubscription.current) {
        watchSubscription.current.remove();
      }
    };
  }, [autoStart]);

  return {
    ...state,
    requestPermissions,
    getCurrentLocation,
    updateLocation,
    startTracking,
    stopTracking,
    getLocationHistory,
  };
};
