import api from './api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as Device from 'expo-device';

export interface User {
  id: string;
  email: string;
  name: string;
  picture?: string;
  profile_picture?: string; // Campo real en el backend
  role: string;
  phone?: string;
}

export interface LoginResponse {
  session_token: string;
  user: User;
}

export interface TwoFactorRequiredResponse {
  requires_2fa: true;
  temp_token: string;
  phone_masked: string;
  message: string;
}

export interface TwoFactorVerifyResponse {
  success: boolean;
  session_token: string;
  user: User;
  device_token?: string;
  device_trusted_until?: string;
}

// Device token storage key for trusted devices
const DEVICE_TOKEN_KEY = '@ross_2fa_device_token';

function _getDeviceName(): string {
  try {
    const brand = Device.brand || '';
    const modelName = Device.modelName || '';
    const osName = Platform.OS === 'ios' ? 'iOS' : 'Android';
    if (brand && modelName) {
      return `${brand} ${modelName} (${osName})`;
    }
    return `${osName} ${Platform.OS === 'ios' ? 'iPhone' : 'Device'}`;
  } catch {
    return Platform.OS === 'ios' ? 'iPhone' : 'Android';
  }
}

export const authService = {
  async register(email: string, password: string, name: string, phone?: string, address?: any): Promise<LoginResponse> {
    const response = await api.post<LoginResponse>('/auth/register', {
      email,
      password,
      name,
      phone,
      address,
    });
    
    // Store session
    await AsyncStorage.setItem('session_token', response.data.session_token);
    await AsyncStorage.setItem('user', JSON.stringify(response.data.user));
    
    return response.data;
  },

  async login(email: string, password: string): Promise<LoginResponse | TwoFactorRequiredResponse> {
    // Include trusted device token if available
    const deviceToken = await AsyncStorage.getItem(DEVICE_TOKEN_KEY);
    const headers: any = {};
    if (deviceToken) {
      headers['X-Device-Token'] = deviceToken;
    }

    try {
      const response = await api.post('/auth/login', {
        email,
        password,
      }, { headers });
      
      // Check if 2FA is required (HTTP 202 with detail containing requires_2fa)
      if (response.status === 202 || response.data?.detail?.requires_2fa || response.data?.requires_2fa) {
        const detail = response.data?.detail || response.data;
        return {
          requires_2fa: true,
          temp_token: detail.temp_token,
          phone_masked: detail.phone_masked,
          message: detail.message,
        };
      }
      
      // Normal login success
      await AsyncStorage.setItem('session_token', response.data.session_token);
      await AsyncStorage.setItem('user', JSON.stringify(response.data.user));
      
      return response.data;
    } catch (error: any) {
      // Also check if 2FA is required in error response (some backends send 202 as error)
      if (error.response?.status === 202 || error.response?.data?.detail?.requires_2fa) {
        const detail = error.response?.data?.detail || error.response?.data;
        return {
          requires_2fa: true,
          temp_token: detail?.temp_token,
          phone_masked: detail?.phone_masked,
          message: detail?.message,
        };
      }
      throw error;
    }
  },

  async loginWithPhone(phone: string, password: string): Promise<LoginResponse | TwoFactorRequiredResponse> {
    // Include trusted device token if available
    const deviceToken = await AsyncStorage.getItem(DEVICE_TOKEN_KEY);
    const headers: any = {};
    if (deviceToken) {
      headers['X-Device-Token'] = deviceToken;
    }

    try {
      const response = await api.post('/auth/login', {
        phone,
        password,
      }, { headers });
      
      // Check if 2FA is required (HTTP 202)
      if (response.status === 202 || response.data?.detail?.requires_2fa || response.data?.requires_2fa) {
        const detail = response.data?.detail || response.data;
        return {
          requires_2fa: true,
          temp_token: detail.temp_token,
          phone_masked: detail.phone_masked,
          message: detail.message,
        };
      }
      
      // Normal login success
      await AsyncStorage.setItem('session_token', response.data.session_token);
      await AsyncStorage.setItem('user', JSON.stringify(response.data.user));
      
      return response.data;
    } catch (error: any) {
      // Also check if 2FA is required in error response
      if (error.response?.status === 202 || error.response?.data?.detail?.requires_2fa) {
        const detail = error.response?.data?.detail || error.response?.data;
        return {
          requires_2fa: true,
          temp_token: detail?.temp_token,
          phone_masked: detail?.phone_masked,
          message: detail?.message,
        };
      }
      throw error;
    }
  },

  async verify2FA(code: string, tempToken: string, rememberDevice: boolean = false): Promise<TwoFactorVerifyResponse> {
    const response = await api.post<TwoFactorVerifyResponse>('/auth/2fa/verify-login', {
      code,
      temp_token: tempToken,
      remember_device: rememberDevice,
      device_name: _getDeviceName(),
    });
    
    const data = response.data;
    
    // Store session
    await AsyncStorage.setItem('session_token', data.session_token);
    await AsyncStorage.setItem('user', JSON.stringify(data.user));
    
    // Store device token for trusted device (skip 2FA next time)
    if (data.device_token) {
      await AsyncStorage.setItem(DEVICE_TOKEN_KEY, data.device_token);
    }
    
    return data;
  },

  async resend2FACode(tempToken: string): Promise<any> {
    const response = await api.post('/auth/2fa/send-code', {
      temp_token: tempToken,
    });
    return response.data;
  },

  async processGoogleSession(sessionId: string): Promise<LoginResponse> {
    const response = await api.post<LoginResponse>('/auth/session-data', null, {
      headers: {
        'X-Session-ID': sessionId,
      },
    });
    
    // Store session
    await AsyncStorage.setItem('session_token', response.data.session_token);
    await AsyncStorage.setItem('user', JSON.stringify(response.data.user));
    
    return response.data;
  },

  async getMe(): Promise<User> {
    const response = await api.get<User>('/auth/me');
    await AsyncStorage.setItem('user', JSON.stringify(response.data));
    return response.data;
  },

  async logout(): Promise<void> {
    try {
      await api.post('/auth/logout');
    } catch (error) {
      // Silently ignore logout errors (token may have expired)
      console.log('Logout API call skipped (token may be expired)');
    } finally {
      await AsyncStorage.removeItem('session_token');
      await AsyncStorage.removeItem('user');
    }
  },

  async getStoredToken(): Promise<string | null> {
    return await AsyncStorage.getItem('session_token');
  },

  async getStoredUser(): Promise<User | null> {
    const userStr = await AsyncStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  },

  async storeToken(token: string): Promise<void> {
    await AsyncStorage.setItem('session_token', token);
  },

  // ── Phone OTP Auth (passwordless) ──────────────────
  async sendOTP(phone: string, countryCode: string = '+1'): Promise<any> {
    const response = await api.post('/auth/phone/send-otp', { phone, country_code: countryCode });
    return response.data;
  },

  async verifyOTP(phone: string, code: string, name?: string, countryCode: string = '+1'): Promise<LoginResponse> {
    const response = await api.post<LoginResponse>('/auth/phone/verify-otp', {
      phone, code, name, country_code: countryCode,
    });
    await AsyncStorage.setItem('session_token', response.data.session_token);
    await AsyncStorage.setItem('user', JSON.stringify(response.data.user));
    return response.data;
  },
};
