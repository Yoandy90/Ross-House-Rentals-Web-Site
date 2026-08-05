import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import * as Linking from 'expo-linking';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import api from '../services/api';

interface ReferralContextType {
  referralCode: string | null;
  referrerName: string | null;
  setReferralCode: (code: string | null) => void;
  clearReferral: () => void;
  validateAndSetCode: (code: string) => Promise<boolean>;
}

const ReferralContext = createContext<ReferralContextType | undefined>(undefined);

const REFERRAL_STORAGE_KEY = '@ross_tax_referral_code';
const REFERRER_NAME_KEY = '@ross_tax_referrer_name';

export function ReferralProvider({ children }: { children: ReactNode }) {
  const [referralCode, setReferralCodeState] = useState<string | null>(null);
  const [referrerName, setReferrerName] = useState<string | null>(null);

  // Load saved referral code on startup
  useEffect(() => {
    loadSavedReferral();
    setupDeepLinkHandler();
  }, []);

  const loadSavedReferral = async () => {
    try {
      const savedCode = await AsyncStorage.getItem(REFERRAL_STORAGE_KEY);
      const savedName = await AsyncStorage.getItem(REFERRER_NAME_KEY);
      if (savedCode) {
        setReferralCodeState(savedCode);
        setReferrerName(savedName);
        console.log('📱 Loaded saved referral code:', savedCode);
      }
    } catch (error) {
      console.error('Error loading referral code:', error);
    }
  };

  const setupDeepLinkHandler = () => {
    // Handle deep link when app is already open
    const subscription = Linking.addEventListener('url', handleDeepLink);

    // Handle deep link that opened the app
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleDeepLink({ url });
      }
    });

    return () => {
      subscription.remove();
    };
  };

  const handleDeepLink = async (event: { url: string }) => {
    console.log('📱 Deep link received:', event.url);
    
    try {
      const url = event.url;
      
      // Parse the URL to extract referral code
      // Supports: rosstax://ref/CODE or https://rosstaxpreparation.com/ref/CODE
      let code: string | null = null;
      
      if (url.includes('/ref/')) {
        const parts = url.split('/ref/');
        if (parts.length > 1) {
          code = parts[1].split('?')[0].split('#')[0].trim();
        }
      }
      
      if (code) {
        console.log('📱 Referral code from deep link:', code);
        await validateAndSetCode(code);
      }
    } catch (error) {
      console.error('Error handling deep link:', error);
    }
  };

  const validateAndSetCode = async (code: string): Promise<boolean> => {
    try {
      const response = await api.get(`/referrals/validate/${code}`);
      
      if (response.data.valid) {
        await AsyncStorage.setItem(REFERRAL_STORAGE_KEY, code);
        if (response.data.referrer_name) {
          await AsyncStorage.setItem(REFERRER_NAME_KEY, response.data.referrer_name);
          setReferrerName(response.data.referrer_name);
        }
        setReferralCodeState(code);
        
        Alert.alert(
          '🎉 ¡Código de Referido Aplicado!',
          `El código de ${response.data.referrer_name || 'referido'} ha sido aplicado. ¡Recibirás un descuento en tu primera cita!`,
          [{ text: 'Entendido', style: 'default' }]
        );
        
        return true;
      } else {
        Alert.alert(
          '❌ Código Inválido',
          'El código de referido no es válido o ha expirado.',
          [{ text: 'OK', style: 'default' }]
        );
        return false;
      }
    } catch (error) {
      console.error('Error validating referral code:', error);
      return false;
    }
  };

  const setReferralCode = async (code: string | null) => {
    if (code) {
      await AsyncStorage.setItem(REFERRAL_STORAGE_KEY, code);
    } else {
      await AsyncStorage.removeItem(REFERRAL_STORAGE_KEY);
      await AsyncStorage.removeItem(REFERRER_NAME_KEY);
    }
    setReferralCodeState(code);
  };

  const clearReferral = async () => {
    await AsyncStorage.removeItem(REFERRAL_STORAGE_KEY);
    await AsyncStorage.removeItem(REFERRER_NAME_KEY);
    setReferralCodeState(null);
    setReferrerName(null);
  };

  return (
    <ReferralContext.Provider 
      value={{ 
        referralCode, 
        referrerName,
        setReferralCode, 
        clearReferral,
        validateAndSetCode
      }}
    >
      {children}
    </ReferralContext.Provider>
  );
}

export function useReferral() {
  const context = useContext(ReferralContext);
  if (context === undefined) {
    throw new Error('useReferral must be used within a ReferralProvider');
  }
  return context;
}
