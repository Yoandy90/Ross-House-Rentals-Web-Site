import { useState, useEffect, useCallback } from 'react';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const BIOMETRIC_ENABLED_KEY = 'biometric_enabled';
const BIOMETRIC_TOKEN_KEY = 'biometric_token';
const BIOMETRIC_EMAIL_KEY = 'biometric_email';
// Legacy key from old code — used to store password instead of token
const BIOMETRIC_PASSWORD_KEY_LEGACY = 'biometric_password';

interface BiometricAuthReturn {
  isAvailable: boolean;
  biometricType: string | null;
  isEnabled: boolean;
  /** Prompt Face ID and return stored token if successful */
  authenticate: () => Promise<{ success: boolean; token?: string; email?: string; legacyPassword?: string; error?: string }>;
  /** Enable biometric — just needs Face ID confirmation + current session data */
  enableWithToken: (email: string, token: string) => Promise<boolean>;
  /** Prompt Face ID before enabling */
  promptAndEnable: (email: string, token: string) => Promise<boolean>;
  disable: () => Promise<void>;
}

export function useBiometricAuth(): BiometricAuthReturn {
  const [isAvailable, setIsAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState<string | null>(null);
  const [isEnabled, setIsEnabled] = useState(false);

  useEffect(() => {
    checkBiometrics();
  }, []);

  const checkBiometrics = async () => {
    try {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      setIsAvailable(compatible && enrolled);

      if (compatible && enrolled) {
        const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
        if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
          setBiometricType('face');
        } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
          setBiometricType('fingerprint');
        } else if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
          setBiometricType('iris');
        }
      }

      const enabled = await SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY);
      setIsEnabled(enabled === 'true');
    } catch (e) {
      console.log('Biometric check error:', e);
    }
  };

  const authenticate = useCallback(async () => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: Platform.OS === 'ios' ? 'Inicia sesión con Face ID' : 'Inicia sesión con huella digital',
        cancelLabel: 'Cancelar',
        fallbackLabel: 'Usar contraseña',
        disableDeviceFallback: false,
      });

      if (result.success) {
        // Try new token-based storage first
        let token = await SecureStore.getItemAsync(BIOMETRIC_TOKEN_KEY);
        const email = await SecureStore.getItemAsync(BIOMETRIC_EMAIL_KEY);

        // Migration: if no token but legacy password exists, try to login with it
        if (!token) {
          const legacyPassword = await SecureStore.getItemAsync(BIOMETRIC_PASSWORD_KEY_LEGACY);
          if (legacyPassword && email) {
            return { success: true, email: email || undefined, legacyPassword };
          }
          return { success: false, error: 'No stored session — please re-enable Face ID' };
        }
        return { success: true, token, email: email || undefined };
      }
      return { success: false, error: result.error || 'Authentication failed' };
    } catch (e: any) {
      return { success: false, error: e.message || 'Biometric error' };
    }
  }, []);

  /** Enable biometric without any prompt — just store data */
  const enableWithToken = useCallback(async (email: string, token: string) => {
    try {
      await SecureStore.setItemAsync(BIOMETRIC_EMAIL_KEY, email);
      await SecureStore.setItemAsync(BIOMETRIC_TOKEN_KEY, token);
      await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, 'true');
      setIsEnabled(true);
      return true;
    } catch (e) {
      console.log('Biometric enable error:', e);
      return false;
    }
  }, []);

  /** Prompt Face ID first, then enable if successful */
  const promptAndEnable = useCallback(async (email: string, token: string) => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: Platform.OS === 'ios'
          ? 'Confirma con Face ID para activar'
          : 'Confirma con huella digital para activar',
        cancelLabel: 'Cancelar',
        disableDeviceFallback: true,
      });

      if (result.success) {
        return await enableWithToken(email, token);
      }
      return false;
    } catch (e) {
      console.log('Biometric prompt error:', e);
      return false;
    }
  }, [enableWithToken]);

  const disable = useCallback(async () => {
    try {
      await SecureStore.deleteItemAsync(BIOMETRIC_EMAIL_KEY);
      await SecureStore.deleteItemAsync(BIOMETRIC_TOKEN_KEY);
      await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, 'false');
      setIsEnabled(false);
    } catch (e) {
      console.log('Biometric disable error:', e);
    }
  }, []);

  return {
    isAvailable,
    biometricType,
    isEnabled,
    authenticate,
    enableWithToken,
    promptAndEnable,
    disable,
  };
}
