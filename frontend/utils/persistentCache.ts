/**
 * Sistema de caché persistente usando AsyncStorage
 * Mantiene los datos incluso después de cerrar la app
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class PersistentCache {
  private prefix = 'app_cache_';
  private defaultTTL = 5 * 60 * 1000; // 5 minutos
  private memoryCache: Map<string, CacheEntry<any>> = new Map();

  private getKey(key: string): string {
    return `${this.prefix}${key}`;
  }

  async get<T>(key: string): Promise<T | null> {
    // Primero revisar memoria (más rápido)
    const memEntry = this.memoryCache.get(key);
    if (memEntry && Date.now() - memEntry.timestamp < memEntry.ttl) {
      return memEntry.data as T;
    }

    // Si no está en memoria, buscar en AsyncStorage
    try {
      const stored = await AsyncStorage.getItem(this.getKey(key));
      if (!stored) return null;

      const entry: CacheEntry<T> = JSON.parse(stored);
      
      // Verificar si expiró
      if (Date.now() - entry.timestamp > entry.ttl) {
        await this.delete(key);
        return null;
      }

      // Guardar en memoria para próximas lecturas
      this.memoryCache.set(key, entry);
      return entry.data;
    } catch (error) {
      console.log('Cache read error:', error);
      return null;
    }
  }

  // Versión síncrona que solo lee de memoria (para carga inicial rápida)
  getSync<T>(key: string): T | null {
    const memEntry = this.memoryCache.get(key);
    if (memEntry && Date.now() - memEntry.timestamp < memEntry.ttl) {
      return memEntry.data as T;
    }
    return null;
  }

  async set<T>(key: string, data: T, ttl: number = this.defaultTTL): Promise<void> {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl,
    };

    // Guardar en memoria
    this.memoryCache.set(key, entry);

    // Guardar en AsyncStorage (en background)
    try {
      await AsyncStorage.setItem(this.getKey(key), JSON.stringify(entry));
    } catch (error) {
      console.log('Cache write error:', error);
    }
  }

  async delete(key: string): Promise<void> {
    this.memoryCache.delete(key);
    try {
      await AsyncStorage.removeItem(this.getKey(key));
    } catch (error) {
      console.log('Cache delete error:', error);
    }
  }

  async clear(): Promise<void> {
    this.memoryCache.clear();
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(k => k.startsWith(this.prefix));
      if (cacheKeys.length > 0) {
        await AsyncStorage.multiRemove(cacheKeys);
      }
    } catch (error) {
      console.log('Cache clear error:', error);
    }
  }

  // Precargar caché desde AsyncStorage a memoria
  async preload(keys: string[]): Promise<void> {
    try {
      const storageKeys = keys.map(k => this.getKey(k));
      const results = await AsyncStorage.multiGet(storageKeys);
      
      results.forEach(([storageKey, value], index) => {
        if (value) {
          try {
            const entry = JSON.parse(value);
            if (Date.now() - entry.timestamp < entry.ttl) {
              this.memoryCache.set(keys[index], entry);
            }
          } catch (e) {
            // Ignorar errores de parsing
          }
        }
      });
      
      console.log('📦 Cache preloaded:', this.memoryCache.size, 'items');
    } catch (error) {
      console.log('Cache preload error:', error);
    }
  }
}

export const persistentCache = new PersistentCache();

// Keys de caché predefinidas
export const CACHE_KEYS = {
  DASHBOARD_STATS: 'dashboard_stats',
  CLIENTS_LIST: 'clients_list',
  CONVERSATIONS_LIST: 'conversations_list',
  INVOICES_LIST: 'invoices_list',
  USER_PROFILE: 'user_profile',
  MESSAGES: 'chat_messages_',
};
