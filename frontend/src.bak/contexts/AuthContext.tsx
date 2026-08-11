import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import { AppState, AppStateStatus } from 'react-native';
import { API_URL } from '../constants/theme';

interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  name?: string;
  phone: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  token: string;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string; token?: string }>;
  loginWithOTP: (phone: string, code: string) => Promise<{ success: boolean; error?: string }>;
  loginWithToken: (storedToken: string) => Promise<{ success: boolean; error?: string }>;
  register: (data: RegisterData) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

interface RegisterData {
  name: string;
  email: string;
  phone?: string;
  password: string;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: '',
  isLoading: true,
  isAuthenticated: false,
  login: async () => ({ success: false }),
  loginWithOTP: async () => ({ success: false }),
  loginWithToken: async () => ({ success: false }),
  register: async () => ({ success: false }),
  logout: async () => {},
  refreshUser: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // ─── Load stored session on mount ───
  useEffect(() => {
    loadStoredSession();
  }, []);

  // ─── Re-validate token when app comes to foreground ───
  useEffect(() => {
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === 'active' && token) {
        validateToken(token);
      }
    };
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [token]);

  const loadStoredSession = async () => {
    try {
      const storedToken = await SecureStore.getItemAsync('lending_token');
      if (storedToken) {
        const valid = await validateToken(storedToken);
        if (!valid) {
          await SecureStore.deleteItemAsync('lending_token');
        }
      }
    } catch (e) {
      console.log('Session load error:', e);
    }
    setIsLoading(false);
  };

  const validateToken = async (tkn: string): Promise<boolean> => {
    try {
      const res = await fetch(`${API_URL}/api/auth/me`, {
        headers: { 'Authorization': `Bearer ${tkn}` },
      });
      if (res.ok) {
        const userData = await res.json();
        setUser(userData);
        setToken(tkn);
        return true;
      } else {
        // Token expired or invalid — force logout
        console.log('Token invalid/expired, clearing session');
        setUser(null);
        setToken('');
        await SecureStore.deleteItemAsync('lending_token');
        return false;
      }
    } catch (e) {
      // Network error — keep session (offline scenario)
      console.log('Network error validating token, keeping session');
      if (tkn && !token) {
        setToken(tkn);
      }
      return true;
    }
  };

  const refreshUser = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        const userData = await res.json();
        setUser(userData);
      }
    } catch (e) {
      console.log('Refresh user error:', e);
    }
  }, [token]);

  const login = async (email: string, password: string) => {
    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (res.ok) {
        const data = await res.json();
        const sessionToken = data.session_token;
        await SecureStore.setItemAsync('lending_token', sessionToken);
        setToken(sessionToken);
        setUser(data.user);
        return { success: true, token: sessionToken };
      } else {
        const err = await res.json().catch(() => ({}));
        return { success: false, error: err.detail || 'Credenciales incorrectas' };
      }
    } catch (e) {
      return { success: false, error: 'Error de conexión. Intenta de nuevo.' };
    }
  };

  const loginWithOTP = async (phone: string, code: string) => {
    try {
      const res = await fetch(`${API_URL}/api/auth/phone/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code }),
      });

      if (res.ok) {
        const data = await res.json();
        const sessionToken = data.session_token;
        await SecureStore.setItemAsync('lending_token', sessionToken);
        setToken(sessionToken);
        setUser(data.user);
        return { success: true };
      } else {
        const err = await res.json().catch(() => ({}));
        return { success: false, error: err.detail || 'Código incorrecto' };
      }
    } catch (e) {
      return { success: false, error: 'Error de conexión. Intenta de nuevo.' };
    }
  };

  const loginWithToken = async (storedToken: string) => {
    try {
      const valid = await validateToken(storedToken);
      if (valid) {
        await SecureStore.setItemAsync('lending_token', storedToken);
        return { success: true };
      } else {
        return { success: false, error: 'Sesión expirada. Inicia sesión manualmente.' };
      }
    } catch (e) {
      return { success: false, error: 'Error de conexión. Intenta de nuevo.' };
    }
  };

  const register = async (data: RegisterData) => {
    try {
      const res = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        const responseData = await res.json();
        const sessionToken = responseData.session_token;
        await SecureStore.setItemAsync('lending_token', sessionToken);
        setToken(sessionToken);
        setUser(responseData.user);
        return { success: true };
      } else {
        const err = await res.json().catch(() => ({}));
        return { success: false, error: err.detail || 'Error al crear la cuenta' };
      }
    } catch (e) {
      return { success: false, error: 'Error de conexión. Intenta de nuevo.' };
    }
  };

  const logout = async () => {
    await SecureStore.deleteItemAsync('lending_token');
    setUser(null);
    setToken('');
  };

  return (
    <AuthContext.Provider value={{
      user, token, isLoading, isAuthenticated: !!user,
      login, loginWithOTP, loginWithToken, register, logout, refreshUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
