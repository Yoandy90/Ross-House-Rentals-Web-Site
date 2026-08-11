import Constants from 'expo-constants';
import { Platform } from 'react-native';

const extra = Constants.expoConfig?.extra || {};

// Use the backend URL from environment variables
// In production (native builds), this will be the Railway backend
// In web preview, requests to /api/* are proxied to port 8001
const getApiUrl = (): string => {
  const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL || '';
  const apiUrl = process.env.EXPO_PUBLIC_API_URL || '';
  
  // Always prefer the dedicated API URL (Railway production) when available
  // This is critical because the preview proxy (port 8001) runs a different backend
  if (apiUrl) {
    return apiUrl;
  }
  
  // Fallback to preview proxy URL
  return backendUrl;
};

export const Config = {
  API_URL: getApiUrl(),
  STRIPE_PUBLISHABLE_KEY: process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || '',
  GOOGLE_MAPS_KEY: process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY || '',
  APP_NAME: 'Ross House Rentals',
  APP_VERSION: '1.0.0',
  SUPPORT_PHONE: '(806) 934-2018',
  SUPPORT_EMAIL: 'info@rosshouserentals.com',
} as const;
