import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';
import { Platform } from 'react-native';

import es from '../locales/es.json';
import en from '../locales/en.json';

const LANGUAGE_KEY = 'app_language';

// Detect device language - with error handling for iOS 26.x compatibility
const getDeviceLanguage = () => {
  try {
    const locales = Localization.getLocales();
    const deviceLocale = locales?.[0]?.languageCode || 'es';
    return deviceLocale === 'en' ? 'en' : 'es'; // Default to Spanish if not English
  } catch (error) {
    console.warn('⚠️ Localization.getLocales() failed, defaulting to Spanish:', error);
    return 'es'; // Safe fallback for iOS 26.x
  }
};

// Initialize language with platform check
const initLanguage = async () => {
  try {
    // Only use AsyncStorage on native platforms
    if (Platform.OS !== 'web') {
      const savedLanguage = await AsyncStorage.getItem(LANGUAGE_KEY);
      return savedLanguage || getDeviceLanguage();
    } else {
      // On web, use localStorage
      if (typeof window !== 'undefined' && window.localStorage) {
        const savedLanguage = window.localStorage.getItem(LANGUAGE_KEY);
        return savedLanguage || getDeviceLanguage();
      }
      return getDeviceLanguage();
    }
  } catch (error) {
    console.error('Error loading language:', error);
    return 'es'; // Default to Spanish
  }
};

i18n
  .use(initReactI18next)
  .init({
    compatibilityJSON: 'v3',
    resources: {
      es: { translation: es },
      en: { translation: en },
    },
    lng: 'es', // Default language - Spanish (overridden by saved preference)
    fallbackLng: 'es', // Fallback to Spanish
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false, // Important: avoid suspense issues with async language load
    },
  });

// Load saved language on init (safely) - NO forced override
if (typeof window !== 'undefined' || Platform.OS !== 'web') {
  initLanguage().then((language) => {
    if (language && language !== i18n.language) {
      i18n.changeLanguage(language);
      console.log('🌐 Language loaded from storage:', language);
    }
  }).catch((error) => {
    console.error('Error initializing language:', error);
  });
}

export const changeLanguage = async (language: string) => {
  try {
    // Save based on platform
    if (Platform.OS !== 'web') {
      await AsyncStorage.setItem(LANGUAGE_KEY, language);
    } else {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(LANGUAGE_KEY, language);
      }
    }
    await i18n.changeLanguage(language);
  } catch (error) {
    console.error('Error changing language:', error);
  }
};

export const getCurrentLanguage = () => i18n.language;

export default i18n;
