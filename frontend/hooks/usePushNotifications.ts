/**
 * Hook para gestionar notificaciones push
 * Maneja registro de tokens, permisos y recepción de notificaciones
 */

import { useState, useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import api from '../services/api';

// Configurar cómo se manejan las notificaciones cuando la app está en foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

interface NotificationState {
  expoPushToken: string | null;
  notification: Notifications.Notification | null;
  permissionStatus: Notifications.PermissionStatus | null;
  isEnabled: boolean;
  loading: boolean;
  error: string | null;
}

export const usePushNotifications = () => {
  const [state, setState] = useState<NotificationState>({
    expoPushToken: null,
    notification: null,
    permissionStatus: null,
    isEnabled: false,
    loading: false,
    error: null,
  });

  const notificationListener = useRef<Notifications.Subscription>();
  const responseListener = useRef<Notifications.Subscription>();

  /**
   * Registrar token de notificaciones push
   */
  const registerForPushNotificationsAsync = async (): Promise<string | null> => {
    let token: string | null = null;

    if (!Device.isDevice) {
//       console.log('⚠️ Push notifications no funcionan en simulador');
      setState(prev => ({
        ...prev,
        error: 'Push notifications requieren un dispositivo físico',
      }));
      return null;
    }

    try {
      // Obtener permisos existentes
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      // Si no hay permisos, solicitarlos
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      setState(prev => ({ ...prev, permissionStatus: finalStatus }));

      if (finalStatus !== 'granted') {
//         console.log('❌ Permisos de notificaciones denegados');
        setState(prev => ({
          ...prev,
          error: 'Permisos de notificaciones denegados',
        }));
        return null;
      }

      // Obtener token de Expo
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: 'your-project-id', // TODO: Configurar en app.json
      });

      token = tokenData.data;
//       console.log('✅ Push token obtenido:', token);

      // Configurar canal de notificaciones para Android
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
        });
      }

      setState(prev => ({ ...prev, expoPushToken: token }));
      return token;
    } catch (error) {
      console.error('❌ Error al obtener push token:', error);
      setState(prev => ({
        ...prev,
        error: `Error al obtener push token: ${error}`,
      }));
      return null;
    }
  };

  /**
   * Enviar token al backend
   */
  const sendTokenToBackend = async (token: string): Promise<boolean> => {
    try {
      const response = await api.post('/notifications/register-token', {
        push_token: token,
        device_type: Platform.OS,
        push_enabled: true,
      });

      if (response.data.success) {
//         console.log('✅ Token registrado en backend');
        setState(prev => ({ ...prev, isEnabled: true }));
        return true;
      }

      return false;
    } catch (error: any) {
      console.error('❌ Error al enviar token al backend:', error.response?.data || error.message);
      setState(prev => ({
        ...prev,
        error: 'Error al registrar notificaciones',
      }));
      return false;
    }
  };

  /**
   * Inicializar notificaciones push
   */
  const initializePushNotifications = async (): Promise<boolean> => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    // Registrar y obtener token
    const token = await registerForPushNotificationsAsync();

    if (!token) {
      setState(prev => ({ ...prev, loading: false }));
      return false;
    }

    // Enviar token al backend
    const success = await sendTokenToBackend(token);
    setState(prev => ({ ...prev, loading: false }));

    return success;
  };

  /**
   * Deshabilitar notificaciones push
   */
  const disablePushNotifications = async (): Promise<boolean> => {
    try {
      const response = await api.post('/notifications/register-token', {
        push_token: null,
        push_enabled: false,
      });

      if (response.data.success) {
//         console.log('✅ Notificaciones deshabilitadas');
        setState(prev => ({ ...prev, isEnabled: false, expoPushToken: null }));
        return true;
      }

      return false;
    } catch (error) {
      console.error('❌ Error al deshabilitar notificaciones:', error);
      return false;
    }
  };

  /**
   * Obtener estado actual de notificaciones
   */
  const checkNotificationStatus = async () => {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      setState(prev => ({ ...prev, permissionStatus: status }));
      
      if (status === 'granted') {
        // Verificar si hay token registrado
        const tokenData = await Notifications.getExpoPushTokenAsync({
          projectId: 'your-project-id',
        });
        
        setState(prev => ({
          ...prev,
          expoPushToken: tokenData.data,
          isEnabled: true,
        }));
      }
    } catch (error) {
      console.error('Error al verificar estado de notificaciones:', error);
    }
  };

  /**
   * Enviar notificación de prueba
   */
  const sendTestNotification = async () => {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "📬 Notificación de Prueba",
          body: '¡Las notificaciones están funcionando correctamente!',
          data: { type: 'test' },
        },
        trigger: { seconds: 2 },
      });
      
//       console.log('✅ Notificación de prueba programada');
      return true;
    } catch (error) {
      console.error('❌ Error al enviar notificación de prueba:', error);
      return false;
    }
  };

  /**
   * Inicializar listeners al montar
   */
  useEffect(() => {
    // Listener para notificaciones recibidas mientras app está abierta
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
//       console.log('📬 Notificación recibida:', notification);
      setState(prev => ({ ...prev, notification }));
    });

    // Listener para cuando el usuario toca una notificación
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
//       console.log('👆 Usuario tocó notificación:', response);
      
      // Aquí puedes manejar la navegación según el tipo de notificación
      const data = response.notification.request.content.data;
      
      if (data?.type) {
//         console.log('Tipo de notificación:', data.type);
        // TODO: Implementar navegación según tipo
        // Ejemplo: router.push(`/${data.type}/${data.id}`);
      }
    });

    // Verificar estado actual
    checkNotificationStatus();

    // Cleanup al desmontar
    return () => {
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, []);

  return {
    ...state,
    initializePushNotifications,
    disablePushNotifications,
    sendTestNotification,
    checkNotificationStatus,
  };
};

/**
 * Tipos de notificaciones soportadas
 */
export enum NotificationType {
  DOCUMENT_REQUEST = 'document_request',
  CREDITS_ADDED = 'credits_added',
  REFERRAL_REWARD = 'referral_reward',
  APPOINTMENT_REMINDER = 'appointment_reminder',
  MONEY_REQUEST = 'money_request',
  MONEY_RECEIVED = 'money_received',
  WITHDRAWAL_APPROVED = 'withdrawal_approved',
  RAFFLE_WIN = 'raffle_win',
  LOTTERY_WIN = 'lottery_win',
  SUBSCRIPTION_EXPIRING = 'subscription_expiring',
}
