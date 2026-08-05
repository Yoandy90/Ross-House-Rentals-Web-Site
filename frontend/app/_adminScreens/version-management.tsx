/**
 * 📱 Version Management - Premium Control Panel 2025
 * Manage app versions with beautiful UI
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Switch,
  Animated,
  Dimensions,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import api from '../../services/api';
import Constants from 'expo-constants';

const { width: screenWidth } = Dimensions.get('window');

interface VersionConfig {
  current_version: string;
  minimum_version: string;
  force_update: boolean;
  update_message: string;
  ios_url: string;
  android_url: string;
}

export default function VersionManagementPremiumScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<VersionConfig>({
    current_version: '1.0.0',
    minimum_version: '1.0.0',
    force_update: false,
    update_message: 'Una nueva versión está disponible con mejoras y correcciones',
    ios_url: 'https://apps.apple.com/app/ross-tax/id6755496120',
    android_url: 'https://play.google.com/store/apps/details?id=com.rosstax.wallet',
  });
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const localVersion = Constants.expoConfig?.version || '1.0.0';

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const response = await api.get('/app-version');
      if (response.data) {
        setConfig(prev => ({ ...prev, ...response.data }));
      }
    } catch (error) {
      console.error('Error loading config:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    if (!config.current_version || !config.minimum_version) {
      Alert.alert('Error', 'Por favor completa los campos de versión');
      return;
    }

    Alert.alert(
      '💾 Guardar Cambios',
      'Los usuarios serán notificados de la actualización en su próximo inicio de sesión.\n\n¿Deseas continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Guardar',
          onPress: async () => {
            setSaving(true);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            try {
              await api.post('/admin/app-version', config);
              Alert.alert('✅ Éxito', 'Configuración guardada correctamente');
            } catch (error) {
              Alert.alert('Error', 'No se pudo guardar la configuración');
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  };

  const updateField = (field: keyof VersionConfig, value: any) => {
    setConfig(prev => ({ ...prev, [field]: value }));
  };

  const compareVersions = (v1: string, v2: string): number => {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const p1 = parts1[i] || 0;
      const p2 = parts2[i] || 0;
      if (p1 > p2) return 1;
      if (p1 < p2) return -1;
    }
    return 0;
  };

  const versionStatus = compareVersions(localVersion, config.current_version);
  const isUpToDate = versionStatus >= 0;

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <LinearGradient colors={['#1a1a2e', '#16213e']} style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>📱 Versiones</Text>
          <View style={{ width: 40 }} />
        </LinearGradient>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#667eea" />
          <Text style={styles.loadingText}>Cargando configuración...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Premium Header */}
      <LinearGradient colors={['#1a1a2e', '#16213e', '#0f3460']} style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>📱 Control de Versiones</Text>
          <Text style={styles.headerSubtitle}>Gestión de actualizaciones</Text>
        </View>
        <TouchableOpacity 
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={saveConfig}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Ionicons name="save" size={22} color="#fff" />
          )}
        </TouchableOpacity>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Status Card */}
        <Animated.View style={[styles.statusCard, { opacity: fadeAnim }]}>
          <LinearGradient
            colors={isUpToDate ? ['#10B981', '#059669'] : ['#F59E0B', '#D97706']}
            style={styles.statusGradient}
          >
            <View style={styles.statusIcon}>
              <Ionicons 
                name={isUpToDate ? 'checkmark-circle' : 'alert-circle'} 
                size={40} 
                color="#fff" 
              />
            </View>
            <View style={styles.statusInfo}>
              <Text style={styles.statusTitle}>
                {isUpToDate ? 'App Actualizada' : 'Actualización Disponible'}
              </Text>
              <Text style={styles.statusSubtitle}>
                Tu versión: {localVersion} • Última: {config.current_version}
              </Text>
            </View>
          </LinearGradient>
        </Animated.View>

        {/* Version Cards */}
        <View style={styles.versionGrid}>
          {/* Current Version */}
          <View style={styles.versionCard}>
            <LinearGradient colors={['#3B82F6', '#1D4ED8']} style={styles.versionGradient}>
              <Ionicons name="rocket" size={28} color="#fff" />
              <Text style={styles.versionLabel}>Versión Actual</Text>
              <Text style={styles.versionNumber}>{config.current_version}</Text>
              <Text style={styles.versionHint}>En tiendas</Text>
            </LinearGradient>
          </View>

          {/* Minimum Version */}
          <View style={styles.versionCard}>
            <LinearGradient colors={['#8B5CF6', '#7C3AED']} style={styles.versionGradient}>
              <Ionicons name="shield-checkmark" size={28} color="#fff" />
              <Text style={styles.versionLabel}>Versión Mínima</Text>
              <Text style={styles.versionNumber}>{config.minimum_version}</Text>
              <Text style={styles.versionHint}>Requerida</Text>
            </LinearGradient>
          </View>
        </View>

        {/* Edit Section */}
        <Text style={styles.sectionTitle}>✏️ Configuración</Text>

        {/* Current Version Input */}
        <View style={styles.inputCard}>
          <View style={styles.inputHeader}>
            <View style={[styles.inputIcon, { backgroundColor: '#DBEAFE' }]}>
              <Ionicons name="rocket-outline" size={20} color="#3B82F6" />
            </View>
            <View style={styles.inputLabelContainer}>
              <Text style={styles.inputLabel}>Versión Actual (Tiendas)</Text>
              <Text style={styles.inputHint}>Actualiza cuando subas una nueva versión</Text>
            </View>
          </View>
          <TextInput
            style={styles.input}
            value={config.current_version}
            onChangeText={(value) => updateField('current_version', value)}
            placeholder="1.0.0"
            placeholderTextColor="#9CA3AF"
            keyboardType="decimal-pad"
          />
        </View>

        {/* Minimum Version Input */}
        <View style={styles.inputCard}>
          <View style={styles.inputHeader}>
            <View style={[styles.inputIcon, { backgroundColor: '#EDE9FE' }]}>
              <Ionicons name="shield-outline" size={20} color="#8B5CF6" />
            </View>
            <View style={styles.inputLabelContainer}>
              <Text style={styles.inputLabel}>Versión Mínima Requerida</Text>
              <Text style={styles.inputHint}>Usuarios con versión menor serán forzados a actualizar</Text>
            </View>
          </View>
          <TextInput
            style={styles.input}
            value={config.minimum_version}
            onChangeText={(value) => updateField('minimum_version', value)}
            placeholder="1.0.0"
            placeholderTextColor="#9CA3AF"
            keyboardType="decimal-pad"
          />
        </View>

        {/* Force Update Toggle */}
        <View style={styles.toggleCard}>
          <View style={styles.toggleContent}>
            <View style={[styles.inputIcon, { backgroundColor: config.force_update ? '#FEE2E2' : '#F3F4F6' }]}>
              <Ionicons 
                name="warning" 
                size={20} 
                color={config.force_update ? '#EF4444' : '#6B7280'} 
              />
            </View>
            <View style={styles.toggleInfo}>
              <Text style={styles.toggleTitle}>Forzar Actualización</Text>
              <Text style={styles.toggleSubtitle}>
                {config.force_update 
                  ? 'Los usuarios DEBEN actualizar para usar la app'
                  : 'Los usuarios pueden omitir la actualización'
                }
              </Text>
            </View>
            <Switch
              value={config.force_update}
              onValueChange={(value) => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                updateField('force_update', value);
              }}
              trackColor={{ false: '#D1D5DB', true: '#FCA5A5' }}
              thumbColor={config.force_update ? '#EF4444' : '#9CA3AF'}
            />
          </View>
          {config.force_update && (
            <View style={styles.warningBanner}>
              <Ionicons name="alert-circle" size={16} color="#DC2626" />
              <Text style={styles.warningText}>
                ⚠️ Los usuarios no podrán usar la app sin actualizar
              </Text>
            </View>
          )}
        </View>

        {/* Update Message */}
        <View style={styles.inputCard}>
          <View style={styles.inputHeader}>
            <View style={[styles.inputIcon, { backgroundColor: '#D1FAE5' }]}>
              <Ionicons name="chatbubble-ellipses-outline" size={20} color="#10B981" />
            </View>
            <View style={styles.inputLabelContainer}>
              <Text style={styles.inputLabel}>Mensaje de Actualización</Text>
              <Text style={styles.inputHint}>Se mostrará a los usuarios</Text>
            </View>
          </View>
          <TextInput
            style={[styles.input, styles.inputMultiline]}
            value={config.update_message}
            onChangeText={(value) => updateField('update_message', value)}
            placeholder="Describe las novedades..."
            placeholderTextColor="#9CA3AF"
            multiline
            numberOfLines={3}
          />
        </View>

        {/* Store Links */}
        <Text style={styles.sectionTitle}>🏪 Links de Tiendas</Text>

        {/* iOS Link */}
        <View style={styles.linkCard}>
          <View style={styles.linkHeader}>
            <View style={[styles.linkIcon, { backgroundColor: '#1F2937' }]}>
              <Ionicons name="logo-apple" size={22} color="#fff" />
            </View>
            <View style={styles.linkInfo}>
              <Text style={styles.linkTitle}>App Store (iOS)</Text>
              <Text style={styles.linkUrl} numberOfLines={1}>{config.ios_url}</Text>
            </View>
            <TouchableOpacity 
              style={styles.linkButton}
              onPress={() => Linking.openURL(config.ios_url)}
            >
              <Ionicons name="open-outline" size={18} color="#3B82F6" />
            </TouchableOpacity>
          </View>
          <TextInput
            style={styles.input}
            value={config.ios_url}
            onChangeText={(value) => updateField('ios_url', value)}
            placeholder="https://apps.apple.com/..."
            placeholderTextColor="#9CA3AF"
            autoCapitalize="none"
          />
        </View>

        {/* Android Link */}
        <View style={styles.linkCard}>
          <View style={styles.linkHeader}>
            <View style={[styles.linkIcon, { backgroundColor: '#3DDC84' }]}>
              <Ionicons name="logo-android" size={22} color="#fff" />
            </View>
            <View style={styles.linkInfo}>
              <Text style={styles.linkTitle}>Play Store (Android)</Text>
              <Text style={styles.linkUrl} numberOfLines={1}>{config.android_url}</Text>
            </View>
            <TouchableOpacity 
              style={styles.linkButton}
              onPress={() => Linking.openURL(config.android_url)}
            >
              <Ionicons name="open-outline" size={18} color="#3B82F6" />
            </TouchableOpacity>
          </View>
          <TextInput
            style={styles.input}
            value={config.android_url}
            onChangeText={(value) => updateField('android_url', value)}
            placeholder="https://play.google.com/..."
            placeholderTextColor="#9CA3AF"
            autoCapitalize="none"
          />
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveFullButton, saving && styles.saveFullButtonDisabled]}
          onPress={saveConfig}
          disabled={saving}
        >
          <LinearGradient
            colors={saving ? ['#9CA3AF', '#6B7280'] : ['#667eea', '#764ba2']}
            style={styles.saveFullGradient}
          >
            {saving ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons name="save" size={22} color="#fff" />
                <Text style={styles.saveFullText}>Guardar Cambios</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>

        {/* Info Card */}
        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={20} color="#3B82F6" />
          <Text style={styles.infoText}>
            Los cambios se aplicarán inmediatamente. Los usuarios verán la notificación de actualización en su próximo inicio de sesión.
          </Text>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  saveButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#6B7280',
  },
  statusCard: {
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 16,
  },
  statusGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
  },
  statusIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusInfo: {
    flex: 1,
    marginLeft: 16,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  statusSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  versionGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  versionCard: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  versionGradient: {
    padding: 16,
    alignItems: 'center',
  },
  versionLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 10,
  },
  versionNumber: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    marginTop: 4,
  },
  versionHint: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 16,
  },
  inputCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  inputHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  inputIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputLabelContainer: {
    flex: 1,
    marginLeft: 12,
  },
  inputLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
  },
  inputHint: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  input: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1F2937',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  inputMultiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  toggleCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  toggleContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  toggleInfo: {
    flex: 1,
    marginLeft: 12,
  },
  toggleTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
  },
  toggleSubtitle: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    padding: 12,
    borderRadius: 10,
    marginTop: 12,
    gap: 8,
  },
  warningText: {
    flex: 1,
    fontSize: 12,
    color: '#DC2626',
  },
  linkCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  linkHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  linkIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  linkInfo: {
    flex: 1,
    marginLeft: 12,
  },
  linkTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
  },
  linkUrl: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  linkButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveFullButton: {
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 8,
    marginBottom: 16,
  },
  saveFullButtonDisabled: {
    opacity: 0.7,
  },
  saveFullGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    gap: 10,
  },
  saveFullText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#EFF6FF',
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#1E40AF',
    lineHeight: 20,
  },
});
