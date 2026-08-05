/**
 * Admin Feature Flags Management Screen
 * Permite al admin activar/desactivar funciones de juego (gambling)
 * IMPORTANTE: Por defecto TODO está deshabilitado para cumplir con App Store
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
  Platform,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import api from '../../services/api';

interface FeatureFlags {
  gambling_enabled: boolean;
  bolita_enabled: boolean;
  scratch_cards_enabled: boolean;
  raffles_enabled: boolean;
  updated_at?: string;
  updated_by?: string;
}

export default function FeatureFlagsScreen() {
  const router = useRouter();
  const [flags, setFlags] = useState<FeatureFlags>({
    gambling_enabled: false,
    bolita_enabled: false,
    scratch_cards_enabled: false,
    raffles_enabled: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchFlags = useCallback(async () => {
    try {
      const response = await api.get('/api/admin/feature-flags');
      setFlags(response.data);
    } catch (error: any) {
      console.error('Error fetching flags:', error);
      Alert.alert('Error', 'No se pudieron cargar las configuraciones');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchFlags();
  }, [fetchFlags]);

  const handleToggleAll = async () => {
    try {
      setSaving(true);
      const response = await api.post('/api/admin/feature-flags/toggle-gambling');
      setFlags(prev => ({
        ...prev,
        gambling_enabled: response.data.gambling_enabled,
        bolita_enabled: response.data.gambling_enabled,
        scratch_cards_enabled: response.data.gambling_enabled,
        raffles_enabled: response.data.gambling_enabled,
      }));
      Alert.alert(
        'Éxito',
        response.data.gambling_enabled
          ? '🎰 Todas las funciones de juego han sido ACTIVADAS'
          : '🔒 Todas las funciones de juego han sido DESACTIVADAS'
      );
    } catch (error: any) {
      console.error('Error toggling all:', error);
      Alert.alert('Error', 'No se pudo cambiar la configuración');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleFlag = async (flagName: keyof FeatureFlags, newValue: boolean) => {
    try {
      setSaving(true);
      const updateData = { [flagName]: newValue };
      
      // If toggling main gambling flag, update all sub-flags
      if (flagName === 'gambling_enabled') {
        updateData.bolita_enabled = newValue;
        updateData.scratch_cards_enabled = newValue;
        updateData.raffles_enabled = newValue;
      }

      const response = await api.put('/api/admin/feature-flags', updateData);
      setFlags(response.data);
    } catch (error: any) {
      console.error('Error toggling flag:', error);
      Alert.alert('Error', 'No se pudo cambiar la configuración');
    } finally {
      setSaving(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchFlags();
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6C1110" />
        <Text style={styles.loadingText}>Cargando configuración...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <View style={styles.headerTextContainer}>
          <Text style={styles.headerTitle}>🔒 Control de Funciones</Text>
          <Text style={styles.headerSubtitle}>Candado para App Store</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Warning Banner */}
        <View style={styles.warningBanner}>
          <Ionicons name="warning" size={24} color="#f59e0b" />
          <View style={styles.warningContent}>
            <Text style={styles.warningTitle}>Importante para App Store</Text>
            <Text style={styles.warningText}>
              Apple rechaza apps con funciones de juego/apuestas. Mantén estas
              funciones DESACTIVADAS para la versión pública de la app.
            </Text>
          </View>
        </View>

        {/* Master Toggle */}
        <View style={styles.masterCard}>
          <View style={styles.masterHeader}>
            <View style={styles.masterIconContainer}>
              <Ionicons
                name={flags.gambling_enabled ? 'lock-open' : 'lock-closed'}
                size={32}
                color={flags.gambling_enabled ? '#10b981' : '#ef4444'}
              />
            </View>
            <View style={styles.masterTextContainer}>
              <Text style={styles.masterTitle}>Control Maestro</Text>
              <Text style={styles.masterSubtitle}>
                {flags.gambling_enabled
                  ? 'Funciones de juego ACTIVADAS'
                  : 'Funciones de juego DESACTIVADAS'}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={[
              styles.masterButton,
              flags.gambling_enabled ? styles.masterButtonActive : styles.masterButtonInactive,
            ]}
            onPress={handleToggleAll}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <Ionicons
                  name={flags.gambling_enabled ? 'close-circle' : 'checkmark-circle'}
                  size={24}
                  color="#FFF"
                />
                <Text style={styles.masterButtonText}>
                  {flags.gambling_enabled ? 'Desactivar Todo' : 'Activar Todo'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Individual Flags */}
        <Text style={styles.sectionTitle}>Funciones Individuales</Text>

        <View style={styles.flagCard}>
          <View style={styles.flagIcon}>
            <Ionicons name="game-controller" size={24} color="#8b5cf6" />
          </View>
          <View style={styles.flagContent}>
            <Text style={styles.flagTitle}>Juegos (Tab Principal)</Text>
            <Text style={styles.flagDescription}>
              Muestra u oculta el tab de "Juegos" en la barra de navegación
            </Text>
          </View>
          <Switch
            value={flags.gambling_enabled}
            onValueChange={(value) => handleToggleFlag('gambling_enabled', value)}
            trackColor={{ false: '#e5e7eb', true: '#86efac' }}
            thumbColor={flags.gambling_enabled ? '#10b981' : '#9ca3af'}
            disabled={saving}
          />
        </View>

        <View style={styles.flagCard}>
          <View style={styles.flagIcon}>
            <Ionicons name="gift" size={24} color="#6C1110" />
          </View>
          <View style={styles.flagContent}>
            <Text style={styles.flagTitle}>Rifas</Text>
            <Text style={styles.flagDescription}>
              Participa en rifas y sorteos con premios
            </Text>
          </View>
          <Switch
            value={flags.raffles_enabled}
            onValueChange={(value) => handleToggleFlag('raffles_enabled', value)}
            trackColor={{ false: '#e5e7eb', true: '#86efac' }}
            thumbColor={flags.raffles_enabled ? '#10b981' : '#9ca3af'}
            disabled={saving || !flags.gambling_enabled}
          />
        </View>

        <View style={styles.flagCard}>
          <View style={styles.flagIcon}>
            <Ionicons name="dice" size={24} color="#f59e0b" />
          </View>
          <View style={styles.flagContent}>
            <Text style={styles.flagTitle}>Bolita</Text>
            <Text style={styles.flagDescription}>
              Sistema de apuestas tipo lotería tradicional
            </Text>
          </View>
          <Switch
            value={flags.bolita_enabled}
            onValueChange={(value) => handleToggleFlag('bolita_enabled', value)}
            trackColor={{ false: '#e5e7eb', true: '#86efac' }}
            thumbColor={flags.bolita_enabled ? '#10b981' : '#9ca3af'}
            disabled={saving || !flags.gambling_enabled}
          />
        </View>

        <View style={styles.flagCard}>
          <View style={styles.flagIcon}>
            <Ionicons name="ticket" size={24} color="#ec4899" />
          </View>
          <View style={styles.flagContent}>
            <Text style={styles.flagTitle}>Raspaditos</Text>
            <Text style={styles.flagDescription}>
              Juegos de raspaditos virtuales con premios
            </Text>
          </View>
          <Switch
            value={flags.scratch_cards_enabled}
            onValueChange={(value) => handleToggleFlag('scratch_cards_enabled', value)}
            trackColor={{ false: '#e5e7eb', true: '#86efac' }}
            thumbColor={flags.scratch_cards_enabled ? '#10b981' : '#9ca3af'}
            disabled={saving || !flags.gambling_enabled}
          />
        </View>

        {/* Last Update Info */}
        {flags.updated_at && (
          <View style={styles.updateInfo}>
            <Ionicons name="time-outline" size={16} color="#9ca3af" />
            <Text style={styles.updateText}>
              Última actualización: {new Date(flags.updated_at).toLocaleString('es-ES')}
              {flags.updated_by && ` por ${flags.updated_by}`}
            </Text>
          </View>
        )}

        {/* Help Section */}
        <View style={styles.helpSection}>
          <Text style={styles.helpTitle}>¿Cómo funciona?</Text>
          <View style={styles.helpItem}>
            <Ionicons name="checkmark-circle" size={18} color="#10b981" />
            <Text style={styles.helpText}>
              <Text style={styles.helpBold}>ACTIVADO:</Text> Los usuarios pueden ver
              y usar las funciones de juego
            </Text>
          </View>
          <View style={styles.helpItem}>
            <Ionicons name="close-circle" size={18} color="#ef4444" />
            <Text style={styles.helpText}>
              <Text style={styles.helpBold}>DESACTIVADO:</Text> Las funciones están
              ocultas para todos los usuarios
            </Text>
          </View>
          <View style={styles.helpItem}>
            <Ionicons name="information-circle" size={18} color="#3b82f6" />
            <Text style={styles.helpText}>
              Los cambios se aplican inmediatamente a todos los usuarios
            </Text>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6b7280',
  },
  header: {
    backgroundColor: '#6C1110',
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 20,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFF',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  warningBanner: {
    flexDirection: 'row',
    backgroundColor: '#fef3c7',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
  },
  warningContent: {
    flex: 1,
    marginLeft: 12,
  },
  warningTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#92400e',
    marginBottom: 4,
  },
  warningText: {
    fontSize: 13,
    color: '#a16207',
    lineHeight: 18,
  },
  masterCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  masterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  masterIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  masterTextContainer: {
    flex: 1,
  },
  masterTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
  },
  masterSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  masterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
    gap: 8,
  },
  masterButtonActive: {
    backgroundColor: '#ef4444',
  },
  masterButtonInactive: {
    backgroundColor: '#10b981',
  },
  masterButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 12,
    marginLeft: 4,
  },
  flagCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  flagIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  flagContent: {
    flex: 1,
  },
  flagTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2937',
  },
  flagDescription: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
    lineHeight: 16,
  },
  updateInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 24,
    gap: 6,
  },
  updateText: {
    fontSize: 12,
    color: '#9ca3af',
  },
  helpSection: {
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    padding: 16,
  },
  helpTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 12,
  },
  helpItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
    gap: 8,
  },
  helpText: {
    flex: 1,
    fontSize: 13,
    color: '#4b5563',
    lineHeight: 18,
  },
  helpBold: {
    fontWeight: '700',
  },
});
