import { useEffect, useState } from 'react';
import { InteractionManager } from 'react-native';

/**
 * Hook para optimizar la carga de pantallas
 * Difiere la carga de contenido pesado hasta después de las animaciones
 */
export function useOptimizedScreen() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      setIsReady(true);
    });

    return () => task.cancel();
  }, []);

  return isReady;
}

/**
 * Hook para cachear datos de API
 */
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

export function useCachedData<T>(
  key: string,
  fetchFn: () => Promise<T>,
  enabled: boolean = true
): { data: T | null; loading: boolean; error: Error | null; refetch: () => void } {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Verificar caché
      const cached = cache.get(key);
      if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        setData(cached.data);
        setLoading(false);
        return;
      }

      // Fetch nuevo
      const result = await fetchFn();
      cache.set(key, { data: result, timestamp: Date.now() });
      setData(result);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (enabled) {
      fetchData();
    }
  }, [key, enabled]);

  return { data, loading, error, refetch: fetchData };
}

// Función para limpiar caché
export function clearCache(key?: string) {
  if (key) {
    cache.delete(key);
  } else {
    cache.clear();
  }
}
