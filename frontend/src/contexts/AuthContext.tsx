import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Platform } from 'react-native';
import { apiCall, setToken, getToken, removeToken } from '../utils/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { registerForPushNotifications } from '../utils/pushNotifications';

export type UserRole = 'guest' | 'tenant' | 'landlord' | 'buyer' | 'admin';

interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  phone?: string;
  tenant_number?: string;
}

interface AuthContextType {
  user: User | null;
  viewAsTenant: boolean;
  toggleViewAsTenant: () => void;
  tenant: User | null; // backward compat
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, phone: string) => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  adminLoginStep1: (email: string, password: string) => Promise<{ step: string; challenge_id?: string; masked?: string; channel?: string }>;
  adminLoginStep2: (challengeId: string, code: string) => Promise<void>;
  signInWithOTP: (phone: string, code: string) => Promise<void>;
  sendOTP: (phone: string) => Promise<{ sms_sent: boolean; is_new_user: boolean; message: string }>;
  logout: () => Promise<void>;
  register: (data: {
    name: string;
    email: string;
    phone: string;
    role: UserRole;
    company_name?: string;
  }) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  viewAsTenant: false,
  toggleViewAsTenant: () => {},
  tenant: null,
  isLoading: true,
  isAuthenticated: false,
  login: async () => {},
  loginWithEmail: async () => {},
  signInWithOTP: async () => {},
  sendOTP: async () => ({ sms_sent: false, is_new_user: false, message: '' }),
  logout: async () => {},
  register: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [viewAsTenant, setViewAsTenant] = useState(false);

  useEffect(() => {
    checkAuth();
    AsyncStorage.getItem('view_as_tenant')
      .then((v) => setViewAsTenant(v === '1'))
      .catch(() => {});
  }, []);

  const toggleViewAsTenant = () => {
    setViewAsTenant((prev) => {
      const next = !prev;
      AsyncStorage.setItem('view_as_tenant', next ? '1' : '0').catch(() => {});
      return next;
    });
  };

  const checkAuth = async () => {
    try {
      const token = await getToken();
      if (token) {
        // Try marketplace profile first
        try {
          const data = await apiCall('/marketplace/me');
          if (data.success && data.user) {
            const role = (await AsyncStorage.getItem('user_role')) as UserRole || data.user.role || 'tenant';
            setUser({
              id: data.user.id || '',
              name: data.user.name,
              email: data.user.email,
              role: role,
              phone: data.user.phone || '',
              tenant_number: '',
            });
            return;
          }
        } catch {}

        // Fallback: try old tenant dashboard
        try {
          const data = await apiCall('/tenant/dashboard');
          if (data.success && data.tenant) {
            setUser({
              id: '',
              name: data.tenant.name,
              email: data.tenant.email,
              role: 'tenant',
              tenant_number: data.tenant.tenant_number || '',
            });
            return;
          }
        } catch {}

        await removeToken();
      }
    } catch {
      await removeToken();
    } finally {
      setIsLoading(false);
    }
  };

  const _setUserFromResponse = async (u: any) => {
    const role = u.role || 'tenant';
    await AsyncStorage.setItem('user_role', role);
    setUser({
      id: u.id,
      name: u.name,
      email: u.email,
      role: role as UserRole,
      phone: u.phone || '',
      tenant_number: u.tenant_number || '',
    });
    // Register push notifications after login
    registerForPushNotifications().catch(console.log);
  };

  // Legacy: email + phone login
  const login = async (email: string, phone: string) => {
    const data = await apiCall('/public/marketplace-login', {
      method: 'POST',
      body: { email, phone },
      auth: false,
    });

    if (data.success && data.token) {
      await setToken(data.token);
      await _setUserFromResponse(data.user);
    } else {
      throw new Error(data.detail || 'Login failed');
    }
  };

  // Email + password login
  const loginWithEmail = async (email: string, password: string) => {
    const data = await apiCall('/public/marketplace-login', {
      method: 'POST',
      body: { email, password },
      auth: false,
    });

    if (data.success && data.token) {
      await setToken(data.token);
      await _setUserFromResponse(data.user);
    } else {
      throw new Error(data.detail || 'Login failed');
    }
  };

  // Admin 2FA — paso 1: email + password (+ dispositivo de confianza si existe)
  const adminLoginStep1 = async (email: string, password: string) => {
    const trustedDeviceId = await AsyncStorage.getItem('admin_trusted_device').catch(() => null);
    const data = await apiCall('/admin/auth/login-step1', {
      method: 'POST',
      body: { email, password, trusted_device_id: trustedDeviceId || undefined },
      auth: false,
    });
    if (data.step === 'complete' && data.token) {
      // 2FA deshabilitado o dispositivo de confianza → sesión directa
      await setToken(data.token);
      await _setUserFromResponse(data.user);
      return { step: 'complete' };
    }
    return {
      step: data.step,
      challenge_id: data.challenge_id,
      masked: data.masked,
      channel: data.channel,
    };
  };

  // Admin 2FA — paso 2: verificar código OTP
  const adminLoginStep2 = async (challengeId: string, code: string) => {
    const data = await apiCall('/admin/auth/login-step2', {
      method: 'POST',
      body: { challenge_id: challengeId, code, remember_device: true },
      auth: false,
    });
    if (data.token) {
      if (data.trusted_device_id) {
        await AsyncStorage.setItem('admin_trusted_device', data.trusted_device_id).catch(() => {});
      }
      await setToken(data.token);
      await _setUserFromResponse(data.user);
    } else {
      throw new Error(data.detail || 'Código inválido');
    }
  };

  // Send OTP to phone
  const sendOTP = async (phone: string) => {
    const data = await apiCall('/rental/phone/send-otp', {
      method: 'POST',
      body: { phone, country_code: '+1' },
      auth: false,
    });
    return {
      sms_sent: data.sms_sent || false,
      is_new_user: data.is_new_user || false,
      message: data.message || '',
    };
  };

  // Verify OTP and login
  const signInWithOTP = async (phone: string, code: string): Promise<{
    is_new_user: boolean;
    profile_complete: boolean;
  }> => {
    const data = await apiCall('/rental/phone/verify-otp', {
      method: 'POST',
      body: { phone, code, country_code: '+1' },
      auth: false,
    });

    if (data.success && data.token) {
      await setToken(data.token);
      await _setUserFromResponse(data.user);
      return {
        is_new_user: data.is_new_user || false,
        profile_complete: data.profile_complete !== false,
      };
    } else {
      throw new Error(data.detail || 'OTP verification failed');
    }
  };

  const logout = async () => {
    await removeToken();
    await AsyncStorage.removeItem('user_role');
    await AsyncStorage.removeItem('view_as_tenant').catch(() => {});
    setViewAsTenant(false);
    setUser(null);
  };

  const register = async (data: {
    name: string;
    email: string;
    phone: string;
    role: UserRole;
    company_name?: string;
  }) => {
    const result = await apiCall('/public/marketplace-register', {
      method: 'POST',
      body: data,
      auth: false,
    });

    if (result.success && result.token) {
      await setToken(result.token);
      await _setUserFromResponse(result.user || { ...data, id: '' });
    } else {
      throw new Error(result.detail || 'Registration failed');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        viewAsTenant,
        toggleViewAsTenant,
        tenant: user, // backward compat
        isLoading,
        isAuthenticated: !!user,
        login,
        loginWithEmail,
        adminLoginStep1,
        adminLoginStep2,
        signInWithOTP,
        sendOTP,
        logout,
        register,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
