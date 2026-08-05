import React, { createContext, useState, useContext, useEffect } from 'react';
import { authService, User, TwoFactorRequiredResponse } from '../services/auth';
import * as Linking from 'expo-linking';
import { useRouter, useSegments, useRootNavigationState } from 'expo-router';
import { setSessionExpiredHandler } from '../services/api';
import { Alert } from 'react-native';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<any>;
  signInWithPhone: (phone: string, password: string) => Promise<any>;
  signInWithOTP: (phone: string, code: string, name?: string) => Promise<any>;
  signUp: (email: string, password: string, name: string, phone?: string, address?: any) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
  updateUser: (userData: User) => void;
  signInWithApple: (token: string, userData: User) => Promise<void>;
  verify2FA: (code: string, tempToken: string, rememberDevice?: boolean) => Promise<any>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    initAuth();
    
    // Set up session expired handler
    setSessionExpiredHandler(() => {
      console.log('⚠️ Session expired - redirecting to login');
      setUser(null);
      Alert.alert(
        'Sesión expirada',
        'Tu sesión ha expirado. Por favor inicia sesión de nuevo.',
        [{ text: 'OK', onPress: () => router.replace('/(auth)/login') }]
      );
    });
  }, []);

  const initAuth = async () => {
    try {
//       console.log('🔐 Auth: Initializing...');
      
      // Check for session_id in URL (Google OAuth)
      const url = await Linking.getInitialURL();
      if (url) {
//         console.log('🔗 Auth: Found URL:', url);
        const { queryParams } = Linking.parse(url);
        const sessionId = queryParams?.session_id as string;
        
        if (sessionId) {
//           console.log('🔑 Auth: Processing Google session...');
          const response = await authService.processGoogleSession(sessionId);
          setUser(response.user);
//           console.log('✅ Auth: Google session processed');
          // Clear session_id from URL
          router.replace('/home');
          return;
        }
      }

      // Check for stored session
      const token = await authService.getStoredToken();
//       console.log('🔑 Auth: Stored token:', token ? 'Found' : 'Not found');
      
      if (token) {
        try {
//           console.log('📡 Auth: Fetching user data...');
          const userData = await authService.getMe();
          setUser(userData);
//           console.log('✅ Auth: User loaded:', userData.email);
        } catch (error) {
          console.error('❌ Auth: Failed to get user data, clearing token');
          // Clear invalid token
          await authService.logout();
          setUser(null);
        }
      } else {
//         console.log('ℹ️ Auth: No stored session');
        setUser(null);
      }
    } catch (error) {
      console.error('❌ Auth init error:', error);
      setUser(null);
    } finally {
//       console.log('✅ Auth: Initialization complete, loading:', false);
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    const response = await authService.login(email, password);
    // If 2FA is required, return the response without setting user
    if ('requires_2fa' in response && response.requires_2fa) {
      return response;
    }
    setUser((response as any).user);
    return response;
  };

  const signInWithPhone = async (phone: string, password: string) => {
    const response = await authService.loginWithPhone(phone, password);
    // If 2FA is required, return the response without setting user
    if ('requires_2fa' in response && response.requires_2fa) {
      return response;
    }
    setUser((response as any).user);
    return response;
  };

  const signInWithOTP = async (phone: string, code: string, name?: string) => {
    const response = await authService.verifyOTP(phone, code, name);
    setUser(response.user);
    return response;
  };

  const verify2FA = async (code: string, tempToken: string, rememberDevice: boolean = false) => {
    const response = await authService.verify2FA(code, tempToken, rememberDevice);
    setUser(response.user);
    return response;
  };

  const signUp = async (email: string, password: string, name: string, phone?: string, address?: any) => {
    const response = await authService.register(email, password, name, phone, address);
    setUser(response.user);
  };

  const signOut = async () => {
    try {
//       console.log('🚪 Iniciando cierre de sesión...');
      
      // Clear user state first
      setUser(null);
      
      // Clear storage and API logout
      await authService.logout();
      
//       console.log('✅ Sesión cerrada, navegando a login...');
      
      // Force navigation to login screen
      router.replace('/(auth)/login');
      
    } catch (error) {
      console.error('Error during signOut:', error);
      // Ensure user is cleared even on error
      setUser(null);
      // Still try to navigate
      router.replace('/(auth)/login');
    }
  };

  const refreshUser = async () => {
    try {
      const userData = await authService.getMe();
      setUser(userData);
    } catch (error) {
      console.error('Refresh user error:', error);
      setUser(null);
    }
  };

  const updateUser = (userData: User) => {
    setUser(userData);
  };

  const signInWithApple = async (token: string, userData: User) => {
    // Store the token
    await authService.storeToken(token);
    // Set user data
    setUser(userData);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signInWithPhone, signInWithOTP, signUp, signOut, refreshUser, updateUser, signInWithApple, verify2FA }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
