/**
 * AutoSaveIndicator Component for React Native
 * Shows visual feedback for auto-save status
 */
import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { AutoSaveState } from '../hooks/useAutoSave';

interface Props {
  state: AutoSaveState;
  style?: any;
}

export function AutoSaveIndicator({ state, style }: Props) {
  if (state.status === 'idle') return null;

  return (
    <View style={[styles.container, style]}>
      {state.status === 'saving' && (
        <>
          <ActivityIndicator size="small" color="#fff" />
          <Text style={styles.text}>Guardando...</Text>
        </>
      )}
      {state.status === 'saved' && (
        <>
          <Ionicons name="checkmark-circle" size={16} color="#86efac" />
          <Text style={[styles.text, styles.savedText]}>Guardado</Text>
        </>
      )}
      {state.status === 'error' && (
        <>
          <Ionicons name="alert-circle" size={16} color="#fca5a5" />
          <Text style={[styles.text, styles.errorText]}>Error</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 12,
  },
  text: {
    fontSize: 12,
    color: '#fff',
  },
  savedText: {
    color: '#86efac',
  },
  errorText: {
    color: '#fca5a5',
  },
});
