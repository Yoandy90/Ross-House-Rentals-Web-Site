import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform, Alert } from 'react-native';
import api from './api';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function registerForPushNotificationsAsync(): Promise<string | undefined> {
  let token: string | undefined;
  let tokenType = 'expo';

//   console.log('🔔 Starting push notification registration...');
//   console.log('📱 Is physical device:', Device.isDevice);
//   console.log('📱 Platform:', Platform.OS);

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
      sound: 'default',
    });
  }

  // Check and request permissions
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
//   console.log('📋 Existing permission status:', existingStatus);
  
  let finalStatus = existingStatus;
  
  if (existingStatus !== 'granted') {
//     console.log('🔔 Requesting notification permissions...');
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
//     console.log('📋 New permission status:', status);
  }
  
  if (finalStatus !== 'granted') {
//     console.log('⚠️ Notification permissions not granted');
    return undefined;
  }

//   console.log('✅ Notification permissions granted');
    
  // Get push token - For iOS, prefer Expo token which handles APNs translation
  // For Android, prefer device token (FCM)
  try {
    if (Platform.OS === 'ios') {
      // iOS: Use Expo Push Token (handles APNs internally)
//       console.log('🍎 iOS detected - Getting Expo push token...');
      
      // Add delay for iOS 18.3+ TurboModule initialization to prevent SIGABRT crashes
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      try {
        const expoToken = await Notifications.getExpoPushTokenAsync({
          projectId: 'deba5612-9639-451d-9c1c-272d68cc992c'
        });
        token = expoToken.data;
        tokenType = 'expo';
//         console.log('✅ Expo push token obtained:', token);
      } catch (expoError: any) {
//         console.log('⚠️ Expo token failed, retrying after delay:', expoError.message);
        
        // Retry with longer delay for iOS 18.3+ TurboModule race condition
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        try {
          const expoToken = await Notifications.getExpoPushTokenAsync({
            projectId: 'deba5612-9639-451d-9c1c-272d68cc992c'
          });
          token = expoToken.data;
          tokenType = 'expo';
//           console.log('✅ Expo push token obtained on retry:', token);
        } catch (retryError: any) {
//           console.log('⚠️ Retry failed, falling back to device token:', retryError.message);
          // Final fallback to device token
          try {
            const deviceToken = await Notifications.getDevicePushTokenAsync();
            token = deviceToken.data;
            tokenType = 'apns';
//             console.log('✅ APNs token obtained:', token?.substring(0, 40) + '...');
          } catch (deviceError: any) {
//             console.log('❌ Device token also failed, notifications unavailable:', deviceError.message);
            return undefined;
          }
        }
      }
    } else {
      // Android: Use device token (FCM)
//       console.log('🤖 Android detected - Getting FCM token...');
      const deviceToken = await Notifications.getDevicePushTokenAsync();
      token = deviceToken.data;
      tokenType = 'fcm';
//       console.log('✅ FCM token obtained:', token?.substring(0, 50) + '...');
    }
  } catch (error: any) {
    console.error('❌ Error getting push token:', error.message);
    return undefined;
  }

  // Register token in backend
  if (token) {
    try {
//       console.log('🔄 Registering token in backend...');
      const response = await api.post('/notifications/register-token', null, {
        params: { token, token_type: tokenType }
      });
//       console.log('✅ Token registered successfully:', response.data);
    } catch (error: any) {
      console.error('❌ Error registering token:', error.response?.data || error.message);
    }
  } else {
//     console.log('⚠️ No token to register');
  }

  return token;
}

// Manual function to force token registration (can be called from settings)
export async function forceRegisterPushToken(): Promise<boolean> {
  try {
//     console.log('🔄 Force registering push token...');
    
    // First check permissions status
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
//     console.log('📋 Current permission status:', existingStatus);
    
    if (existingStatus !== 'granted') {
//       console.log('🔔 Requesting permissions...');
      const { status } = await Notifications.requestPermissionsAsync();
//       console.log('📋 New permission status:', status);
      
      if (status !== 'granted') {
        Alert.alert(
          '⚠️ Permisos Requeridos',
          'Para recibir notificaciones, debes habilitarlas en Ajustes > Ross Tax > Notificaciones',
          [{ text: 'OK' }]
        );
        return false;
      }
    }
    
    // Get push token based on platform
    let token: string | undefined;
    let tokenType = 'expo';
    
    try {
      if (Platform.OS === 'ios') {
        // iOS: Use Expo Push Token (handles APNs internally)
//         console.log('🍎 iOS detected - Getting Expo push token...');
        const expoToken = await Notifications.getExpoPushTokenAsync({
          projectId: 'deba5612-9639-451d-9c1c-272d68cc992c'
        });
        token = expoToken.data;
        tokenType = 'expo';
//         console.log('✅ Expo push token obtained:', token);
      } else {
        // Android: Use FCM token
//         console.log('🤖 Android detected - Getting FCM token...');
        const deviceToken = await Notifications.getDevicePushTokenAsync();
        token = deviceToken.data;
        tokenType = 'fcm';
//         console.log('✅ FCM token obtained:', token?.substring(0, 40) + '...');
      }
    } catch (tokenError: any) {
      console.error('❌ Token error:', tokenError.message);
      Alert.alert('❌ Error', 'No se pudo obtener token:\n' + tokenError.message);
      return false;
    }
    
    if (!token) {
      Alert.alert('⚠️ Error', 'No se pudo obtener el token del dispositivo');
      return false;
    }
    
    // Register in backend
    try {
//       console.log('🔄 Registering token in backend...', { tokenType, token: token.substring(0, 30) });
      const response = await api.post('/notifications/register-token', null, {
        params: { token, token_type: tokenType }
      });
//       console.log('✅ Backend response:', response.data);
      
      Alert.alert(
        '✅ Notificaciones Activadas',
        `Token registrado correctamente.\n\nTipo: ${tokenType.toUpperCase()}\nToken: ${token.substring(0, 50)}...`,
        [{ text: 'OK' }]
      );
      return true;
    } catch (apiError: any) {
      console.error('❌ Backend registration error:', apiError);
      Alert.alert('❌ Error de Registro', apiError.response?.data?.detail || apiError.message);
      return false;
    }
    
  } catch (error: any) {
    console.error('❌ Force register error:', error);
    Alert.alert('❌ Error', error.message || 'Error desconocido');
    return false;
  }
}

export async function scheduleAppointmentReminder(
  appointmentId: string,
  appointmentDate: Date,
  title: string
) {
  // Schedule notification 24 hours before appointment
  const reminderTime = new Date(appointmentDate);
  reminderTime.setHours(reminderTime.getHours() - 24);

  if (reminderTime > new Date()) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Recordatorio de Cita',
        body: `Tienes una cita mañana: ${title}`,
        data: { appointmentId, type: 'appointment_reminder' },
        sound: true,
      },
      trigger: {
        date: reminderTime,
      },
    });
  }

  // Schedule notification 1 hour before appointment
  const hourReminder = new Date(appointmentDate);
  hourReminder.setHours(hourReminder.getHours() - 1);

  if (hourReminder > new Date()) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Recordatorio de Cita',
        body: `Tu cita es en 1 hora: ${title}`,
        data: { appointmentId, type: 'appointment_reminder' },
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: {
        date: hourReminder,
      },
    });
  }
}

export async function cancelAppointmentReminders(appointmentId: string) {
  const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
  
  for (const notification of scheduledNotifications) {
    if (notification.content.data?.appointmentId === appointmentId) {
      await Notifications.cancelScheduledNotificationAsync(notification.identifier);
    }
  }
}

export function setupNotificationListeners(
  onNotificationReceived: (notification: Notifications.Notification) => void,
  onNotificationResponse: (response: Notifications.NotificationResponse) => void
) {
  // Listener for when notification is received while app is foregrounded
  const notificationListener = Notifications.addNotificationReceivedListener(
    onNotificationReceived
  );

  // Listener for when user taps on notification
  const responseListener = Notifications.addNotificationResponseReceivedListener(
    onNotificationResponse
  );

  return () => {
    Notifications.removeNotificationSubscription(notificationListener);
    Notifications.removeNotificationSubscription(responseListener);
  };
}

export async function sendLocalNotification(title: string, body: string, data?: any) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data: data || {},
      sound: true,
    },
    trigger: null, // Send immediately
  });
}

export async function sendChatNotification(
  senderName: string,
  message: string,
  conversationId: string,
  vibrate: boolean = true
) {
  // Vibrate if enabled
  if (vibrate && Platform.OS === 'ios') {
    // iOS haptic feedback
    const { Haptics } = await import('expo-haptics');
    await Haptics.notificationAsync(
      Haptics.NotificationFeedbackType.Success
    );
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      title: `💬 ${senderName}`,
      body: message,
      data: { 
        type: 'chat_message',
        conversationId,
        sender: senderName,
      },
      sound: 'default',
      priority: Notifications.AndroidNotificationPriority.HIGH,
      vibrate: vibrate ? [0, 250, 250, 250] : undefined,
    },
    trigger: null, // Send immediately
  });
}

export async function setBadgeCount(count: number) {
  await Notifications.setBadgeCountAsync(count);
}
