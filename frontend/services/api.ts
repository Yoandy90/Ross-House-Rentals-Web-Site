import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import i18n from '../i18n/config';
import { Alert } from 'react-native';

const getBackendUrl = () => {
  const easBackendUrl = process.env.EXPO_PUBLIC_BACKEND_URL;
  if (easBackendUrl) return easBackendUrl;

  const configBackendUrl = Constants.expoConfig?.extra?.backendUrl;
  if (configBackendUrl) return configBackendUrl;

  return 'http://localhost:8001';
};

const API_URL = getBackendUrl();

const api = axios.create({
  baseURL: `${API_URL}/api`,
  timeout: 60000,
  maxContentLength: 20 * 1024 * 1024,
  maxBodyLength: 20 * 1024 * 1024,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Session expired callback - set by AuthContext
let onSessionExpired: (() => void) | null = null;
export const setSessionExpiredHandler = (handler: () => void) => {
  onSessionExpired = handler;
};

// Add auth token and language to requests
api.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('session_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    config.headers['Accept-Language'] = i18n.language || 'es';
    return config;
  },
  (error) => Promise.reject(error)
);

// Handle 401 errors - redirect to login
let isHandling401 = false;
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401 && !isHandling401) {
      isHandling401 = true;
      await AsyncStorage.removeItem('session_token');
      await AsyncStorage.removeItem('user');
      
      if (onSessionExpired) {
        onSessionExpired();
      }
      
      // Reset flag after a delay to prevent multiple alerts
      setTimeout(() => { isHandling401 = false; }, 3000);
    }
    return Promise.reject(error);
  }
);

export default api;
