/**
 * useAutoSave Hook for React Native
 * Provides debounced auto-save functionality with visual feedback
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../services/api';

interface UseAutoSaveOptions {
  sessionId: string | undefined;
  endpoint: string;
  debounceMs?: number;
  transformData?: (data: any) => any;
}

interface AutoSaveState {
  status: 'idle' | 'saving' | 'saved' | 'error';
  lastSaved: Date | null;
  error: string | null;
}

export function useAutoSave<T extends Record<string, any>>({
  sessionId,
  endpoint,
  debounceMs = 1500,
  transformData,
}: UseAutoSaveOptions) {
  const [autoSaveState, setAutoSaveState] = useState<AutoSaveState>({
    status: 'idle',
    lastSaved: null,
    error: null,
  });
  
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastDataRef = useRef<string>('');

  const saveData = useCallback(async (data: T) => {
    if (!sessionId) return;
    
    const dataString = JSON.stringify(data);
    
    // Don't save if data hasn't changed
    if (dataString === lastDataRef.current) return;
    
    // Clear any pending save
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Debounce the save
    timeoutRef.current = setTimeout(async () => {
      try {
        setAutoSaveState(prev => ({ ...prev, status: 'saving', error: null }));
        
        const payload = transformData ? transformData(data) : data;
        await api.post(`/tax-wizard/session/${sessionId}/${endpoint}`, payload);
        
        lastDataRef.current = dataString;
        setAutoSaveState({
          status: 'saved',
          lastSaved: new Date(),
          error: null,
        });

        // Reset status after 2 seconds
        setTimeout(() => {
          setAutoSaveState(prev => 
            prev.status === 'saved' ? { ...prev, status: 'idle' } : prev
          );
        }, 2000);
      } catch (error: any) {
        console.error('Auto-save error:', error);
        setAutoSaveState({
          status: 'error',
          lastSaved: null,
          error: error.response?.data?.detail || 'Error al guardar',
        });
      }
    }, debounceMs);
  }, [sessionId, endpoint, debounceMs, transformData]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    autoSaveState,
    triggerSave: saveData,
  };
}

export type { AutoSaveState };
