/**
 * Hook para verificar feature flags
 * Controla qué funciones están habilitadas en la app
 */
import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api';

interface FeatureFlags {
  gambling_enabled: boolean;
  bolita_enabled: boolean;
  scratch_cards_enabled: boolean;
  raffles_enabled: boolean;
}

const DEFAULT_FLAGS: FeatureFlags = {
  gambling_enabled: false,
  bolita_enabled: false,
  scratch_cards_enabled: false,
  raffles_enabled: false,
};

const CACHE_KEY = 'feature_flags_cache';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export function useFeatureFlags() {
  const [flags, setFlags] = useState<FeatureFlags>(DEFAULT_FLAGS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFlags = useCallback(async (forceRefresh = false) => {
    try {
      // Check cache first
      if (!forceRefresh) {
        const cached = await AsyncStorage.getItem(CACHE_KEY);
        if (cached) {
          const { data, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < CACHE_DURATION) {
            setFlags(data);
            setLoading(false);
            return data;
          }
        }
      }

      // Fetch from API
      const response = await api.get('/api/feature-flags');
      const data = response.data;

      // Cache the result
      await AsyncStorage.setItem(
        CACHE_KEY,
        JSON.stringify({ data, timestamp: Date.now() })
      );

      setFlags(data);
      setError(null);
      return data;
    } catch (err: any) {
      console.error('Error fetching feature flags:', err);
      setError(err.message || 'Error al cargar configuración');
      // Return cached or default flags on error
      return DEFAULT_FLAGS;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFlags();
  }, [fetchFlags]);

  const isGamblingEnabled = flags.gambling_enabled;
  const isBolitaEnabled = flags.bolita_enabled;
  const isScratchCardsEnabled = flags.scratch_cards_enabled;
  const isRafflesEnabled = flags.raffles_enabled;

  return {
    flags,
    loading,
    error,
    refetch: () => fetchFlags(true),
    isGamblingEnabled,
    isBolitaEnabled,
    isScratchCardsEnabled,
    isRafflesEnabled,
  };
}

export default useFeatureFlags;
