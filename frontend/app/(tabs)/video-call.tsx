import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../../constants/colors';
import { WebView } from 'react-native-webview';
import { useTranslation } from 'react-i18next';

export default function VideoCallScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const { t } = useTranslation();
  const styles = createStyles(colors);
  const params = useLocalSearchParams();
  const webViewRef = useRef<WebView>(null);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const roomId = params.roomId as string;
  const appointmentTitle = params.title as string || t('videoCall.title', 'Videollamada');
  const userName = params.userName as string || t('videoCall.user', 'Usuario');

  useEffect(() => {
    if (!roomId) {
      Alert.alert('Error', 'No se encontró el ID de la sala de videollamada');
      router.back();
      return;
    }
  }, [roomId]);

  const jitsiUrl = `https://meet.jit.si/${roomId}#config.prejoinPageEnabled=false&config.startWithAudioMuted=false&config.startWithVideoMuted=false&userInfo.displayName="${encodeURIComponent(userName)}"&config.subject="${encodeURIComponent(appointmentTitle)}"`;

  const handleWebViewLoad = () => {
    setLoading(false);
  };

  const handleWebViewError = () => {
    setLoading(false);
    setError(true);
    Alert.alert(
      'Error',
      t('videoCall.connectionError', 'No se pudo conectar a la videollamada. Por favor verifica tu conexión a internet.'),
      [
        {
          text: t('videoCall.retry', 'Reintentar'),
          onPress: () => {
            setError(false);
            setLoading(true);
            webViewRef.current?.reload();
          },
        },
        {
          text: t('videoCall.goBack', 'Volver'),
          onPress: () => router.back(),
          style: 'cancel',
        },
      ]
    );
  };

  const handleNavigationStateChange = (navState: any) => {
    // Detect when user leaves the call
    if (navState.url && !navState.url.includes('meet.jit.si')) {
      Alert.alert(
        t('videoCall.callEnded', 'Videollamada finalizada'),
        t('videoCall.returnToApp', '¿Deseas volver a la app?'),
        [
          {
            text: 'Sí',
            onPress: () => router.back(),
          },
        ]
      );
    }
  };

  const handleExit = () => {
    Alert.alert(
      t('videoCall.exitTitle', 'Salir de la videollamada'),
      t('videoCall.exitConfirm', '¿Estás seguro de que deseas salir?'),
      [
        {
          text: t('common.cancel', 'Cancelar'),
          style: 'cancel',
        },
        {
          text: t('videoCall.exit', 'Salir'),
          onPress: () => router.back(),
          style: 'destructive',
        },
      ]
    );
  };

  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={80} color={colors.error} />
          <Text style={styles.errorTitle}>{t('videoCall.connectionError')}</Text>
          <Text style={styles.errorText}>
            {t('videoCall.connectionErrorDesc')}
          </Text>
          <View style={styles.errorButtons}>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => {
                setError(false);
                setLoading(true);
                webViewRef.current?.reload();
              }}
            >
              <Ionicons name="refresh" size={20} color={colors.textWhite} />
              <Text style={styles.retryButtonText}>{t('videoCall.retry')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
            >
              <Text style={styles.backButtonText}>{t('videoCall.goBack')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>{t('videoCall.connecting')}</Text>
          <Text style={styles.loadingSubtext}>{appointmentTitle}</Text>
        </View>
      )}
      
      <WebView
        ref={webViewRef}
        source={{ uri: jitsiUrl }}
        style={styles.webview}
        onLoad={handleWebViewLoad}
        onError={handleWebViewError}
        onNavigationStateChange={handleNavigationStateChange}
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={false}
        mixedContentMode="always"
        allowsFullscreenVideo={true}
        userAgent="Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1"
      />

      {/* Exit Button */}
      <TouchableOpacity
        style={styles.exitButton}
        onPress={handleExit}
      >
        <Ionicons name="close-circle" size={36} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#000',
    },
    loadingContainer: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.background,
      zIndex: 10,
    },
    loadingText: {
      marginTop: 20,
      fontSize: 16,
      color: colors.text,
      textAlign: 'center',
      fontWeight: '600',
    },
    loadingSubtext: {
      marginTop: 8,
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    errorContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
      backgroundColor: colors.background,
    },
    errorTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
      marginTop: 20,
      marginBottom: 12,
    },
    errorText: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
      marginBottom: 30,
    },
    errorButtons: {
      gap: 12,
      width: '100%',
      maxWidth: 300,
    },
    retryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.primary,
      paddingVertical: 14,
      borderRadius: 12,
    },
    retryButtonText: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.textWhite,
    },
    backButton: {
      alignItems: 'center',
      paddingVertical: 14,
    },
    backButtonText: {
      fontSize: 16,
      color: colors.textSecondary,
      fontWeight: '600',
    },
    webview: {
      flex: 1,
      backgroundColor: '#000',
    },
    exitButton: {
      position: 'absolute',
      top: 50,
      right: 20,
      width: 50,
      height: 50,
      borderRadius: 25,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 5,
      zIndex: 100,
    },
  });
