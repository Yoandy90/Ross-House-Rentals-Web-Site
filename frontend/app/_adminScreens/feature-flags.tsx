/**
 * 🎮 Control Maestro - Premium Feature Management 2025
 * Toggle features with beautiful UI and confirmations
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import api from '../../services/api';

interface FeatureFlags {
  gambling_enabled: boolean;
  bolita_enabled: boolean;
  scratch_cards_enabled: boolean;
  raffles_enabled: boolean;
  show_free_plan: boolean;
  updated_at?: string;
  updated_by?: string;
}

interface FeatureConfig {
  key: keyof FeatureFlags;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  gradient: string[];
  warning?: string;
}

export default function FeatureFlagsPremiumScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [flags, setFlags] = useState<FeatureFlags>({
    gambling_enabled: false,
    bolita_enabled: false,
    scratch_cards_enabled: false,
    raffles_enabled: false,
    show_free_plan: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  const features: FeatureConfig[] = [
    {
      key: 'bolita_enabled',
      icon: 'dice',
      title: 'Bolita Tradicional',
      description: 'Juego de números con premio diario',
      gradient: ['#667eea', '#764ba2'],
    },
    {
      key: 'scratch_cards_enabled',
      icon: 'gift',
      title: 'Raspaditos',
      description: 'Tarjetas de rascar con premios instantáneos',
      gradient: ['#11998e', '#38ef7d'],
    },
    {
      key: 'raffles_enabled',
      icon: 'ticket',
      title: 'Rifas',
      description: 'Sorteos especiales con premios grandes',
      gradient: ['#F2994A', '#F2C94C'],
    },
  ];

  const subscriptionFeatures: FeatureConfig[] = [
    {
      key: 'show_free_plan',
      icon: 'wallet-outline',
      title: 'Mostrar Plan Básico Gratis',
      description: 'Muestra la opción de downgrade "Básico - Gratis" en las pantallas de suscripción',
      gradient: ['#6366F1', '#8B5CF6'],
      warning: 'Al activar, los usuarios podrán ver la opción de cambiar al plan gratuito',
    },
  ];

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 8, useNativeDriver: true }),
    ]).start();
    fetchFlags();
  }, []);

  const fetchFlags = useCallback(async () => {
    try {
      const response = await api.get('/admin/feature-flags');
      setFlags(response.data);
    } catch (error) {
      console.error('Error fetching flags:', error);
      Alert.alert('Error', 'No se pudieron cargar las configuraciones');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    fetchFlags();
  }, []);

  const handleMasterToggle = async () => {
    const newState = !flags.gambling_enabled;
    
    Alert.alert(
      newState ? '🎰 Activar Juegos' : '🔒 Desactivar Juegos',
      newState 
        ? '¿Deseas activar TODAS las funciones de juego?\n\nEsto habilitará bolita, raspaditos y rifas para todos los usuarios.'
        : '¿Deseas desactivar TODAS las funciones de juego?\n\nLos usuarios no podrán acceder a ningún juego.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: newState ? 'Activar Todo' : 'Desactivar Todo',
          style: newState ? 'default' : 'destructive',
          onPress: async () => {
            try {
              setSaving(true);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              const response = await api.post('/admin/feature-flags/toggle-gambling');
              setFlags(prev => ({
                ...prev,
                gambling_enabled: response.data.gambling_enabled,
                bolita_enabled: response.data.gambling_enabled,
                scratch_cards_enabled: response.data.gambling_enabled,
                raffles_enabled: response.data.gambling_enabled,
              }));
            } catch (error) {
              Alert.alert('Error', 'No se pudo cambiar la configuración');
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  };

  const handleToggleFlag = async (flagName: keyof FeatureFlags, newValue: boolean) => {
    const feature = features.find(f => f.key === flagName);
    
    Alert.alert(
      newValue ? `Activar ${feature?.title}` : `Desactivar ${feature?.title}`,
      newValue 
        ? `¿Deseas activar ${feature?.title}?`
        : `¿Deseas desactivar ${feature?.title}?\n\nLos usuarios no podrán acceder a esta función.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: newValue ? 'Activar' : 'Desactivar',
          style: newValue ? 'default' : 'destructive',
          onPress: async () => {
            try {
              setSaving(true);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              
              const updateData: Partial<FeatureFlags> = { [flagName]: newValue };
              
              if (flagName === 'gambling_enabled') {
                updateData.bolita_enabled = newValue;
                updateData.scratch_cards_enabled = newValue;
                updateData.raffles_enabled = newValue;
              }

              const response = await api.put('/admin/feature-flags', updateData);
              setFlags(response.data);
            } catch (error) {
              Alert.alert('Error', 'No se pudo actualizar la configuración');
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Nunca';
    return new Date(dateStr).toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const activeCount = [flags.bolita_enabled, flags.scratch_cards_enabled, flags.raffles_enabled].filter(Boolean).length;

  if (loading) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={['#1a1a2e', '#16213e']} style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>🎮 Control Maestro</Text>
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
          <Text style={styles.headerTitle}>🎮 Control Maestro</Text>
          <Text style={styles.headerSubtitle}>Gestión de funciones</Text>
        </View>
        <View style={styles.statusIndicator}>
          <View style={[styles.statusDot, { backgroundColor: flags.gambling_enabled ? '#10B981' : '#EF4444' }]} />
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#667eea" />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Master Control Card */}
        <Animated.View style={[styles.masterCard, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
          <LinearGradient
            colors={flags.gambling_enabled ? ['#10B981', '#059669'] : ['#EF4444', '#DC2626']}
            style={styles.masterGradient}
          >
            <View style={styles.masterContent}>
              <View style={styles.masterIcon}>
                <Ionicons 
                  name={flags.gambling_enabled ? 'game-controller' : 'lock-closed'} 
                  size={36} 
                  color="#fff" 
                />
              </View>
              <View style={styles.masterInfo}>
                <Text style={styles.masterTitle}>
                  {flags.gambling_enabled ? 'Juegos Activos' : 'Juegos Desactivados'}
                </Text>
                <Text style={styles.masterSubtitle}>
                  {flags.gambling_enabled 
                    ? `${activeCount} de 3 funciones habilitadas`
                    : 'Todas las funciones están bloqueadas'
                  }
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.masterToggle, saving && styles.masterToggleDisabled]}
                onPress={handleMasterToggle}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.masterToggleText}>
                    {flags.gambling_enabled ? 'DESACTIVAR' : 'ACTIVAR'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
            
            {/* Status Bar */}
            <View style={styles.statusBar}>
              <View style={styles.statusItem}>
                <Ionicons name="time-outline" size={16} color="rgba(255,255,255,0.7)" />
                <Text style={styles.statusText}>Actualizado: {formatDate(flags.updated_at)}</Text>
              </View>
            </View>
          </LinearGradient>
        </Animated.View>

        {/* Warning Banner */}
        <View style={styles.warningBanner}>
          <Ionicons name="warning" size={20} color="#F59E0B" />
          <Text style={styles.warningText}>
            Cambiar estas configuraciones afecta a todos los usuarios inmediatamente
          </Text>
        </View>

        {/* Feature Cards */}
        <Text style={styles.sectionTitle}>⚡ Funciones Individuales</Text>
        
        {features.map((feature, index) => (
          <Animated.View 
            key={feature.key}
            style={[
              styles.featureCard,
              { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }
            ]}
          >
            <LinearGradient
              colors={flags[feature.key] ? feature.gradient : ['#F3F4F6', '#E5E7EB']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.featureGradient}
            >
              <View style={[
                styles.featureIconBg,
                { backgroundColor: flags[feature.key] ? 'rgba(255,255,255,0.2)' : '#D1D5DB' }
              ]}>
                <Ionicons 
                  name={feature.icon} 
                  size={24} 
                  color={flags[feature.key] ? '#fff' : '#6B7280'} 
                />
              </View>
              
              <View style={styles.featureInfo}>
                <Text style={[
                  styles.featureTitle,
                  { color: flags[feature.key] ? '#fff' : '#1F2937' }
                ]}>
                  {feature.title}
                </Text>
                <Text style={[
                  styles.featureDescription,
                  { color: flags[feature.key] ? 'rgba(255,255,255,0.8)' : '#6B7280' }
                ]}>
                  {feature.description}
                </Text>
              </View>

              <View style={styles.featureToggle}>
                <View style={[
                  styles.statusBadge,
                  { backgroundColor: flags[feature.key] ? 'rgba(255,255,255,0.2)' : '#E5E7EB' }
                ]}>
                  <Text style={[
                    styles.statusBadgeText,
                    { color: flags[feature.key] ? '#fff' : '#6B7280' }
                  ]}>
                    {flags[feature.key] ? 'ON' : 'OFF'}
                  </Text>
                </View>
                <Switch
                  value={flags[feature.key]}
                  onValueChange={(value) => handleToggleFlag(feature.key, value)}
                  trackColor={{ false: '#D1D5DB', true: 'rgba(255,255,255,0.3)' }}
                  thumbColor={flags[feature.key] ? '#fff' : '#9CA3AF'}
                  disabled={saving || !flags.gambling_enabled}
                />
              </View>
            </LinearGradient>
          </Animated.View>
        ))}

        {/* Subscription Feature Cards */}
        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>💎 Control de Suscripciones</Text>
        
        {subscriptionFeatures.map((feature) => (
          <Animated.View 
            key={feature.key}
            style={[
              styles.featureCard,
              { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }
            ]}
          >
            <LinearGradient
              colors={flags[feature.key] ? feature.gradient : ['#F3F4F6', '#E5E7EB']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.featureGradient}
            >
              <View style={[
                styles.featureIconBg,
                { backgroundColor: flags[feature.key] ? 'rgba(255,255,255,0.2)' : '#D1D5DB' }
              ]}>
                <Ionicons 
                  name={feature.icon} 
                  size={24} 
                  color={flags[feature.key] ? '#fff' : '#6B7280'} 
                />
              </View>
              
              <View style={styles.featureInfo}>
                <Text style={[
                  styles.featureTitle,
                  { color: flags[feature.key] ? '#fff' : '#1F2937' }
                ]}>
                  {feature.title}
                </Text>
                <Text style={[
                  styles.featureDescription,
                  { color: flags[feature.key] ? 'rgba(255,255,255,0.8)' : '#6B7280' }
                ]}>
                  {feature.description}
                </Text>
                {feature.warning && (
                  <Text style={[
                    styles.featureDescription,
                    { color: flags[feature.key] ? '#fbbf24' : '#F59E0B', fontSize: 11, marginTop: 2 }
                  ]}>
                    ⚠️ {feature.warning}
                  </Text>
                )}
              </View>

              <View style={styles.featureToggle}>
                <View style={[
                  styles.statusBadge,
                  { backgroundColor: flags[feature.key] ? 'rgba(255,255,255,0.2)' : '#E5E7EB' }
                ]}>
                  <Text style={[
                    styles.statusBadgeText,
                    { color: flags[feature.key] ? '#fff' : '#6B7280' }
                  ]}>
                    {flags[feature.key] ? 'ON' : 'OFF'}
                  </Text>
                </View>
                <Switch
                  value={flags[feature.key]}
                  onValueChange={(value) => handleToggleFlag(feature.key, value)}
                  trackColor={{ false: '#D1D5DB', true: 'rgba(255,255,255,0.3)' }}
                  thumbColor={flags[feature.key] ? '#fff' : '#9CA3AF'}
                  disabled={saving}
                />
              </View>
            </LinearGradient>
          </Animated.View>
        ))}

        {/* Info Card */}
        <View style={styles.infoCard}>
          <View style={styles.infoHeader}>
            <Ionicons name="information-circle" size={24} color="#3B82F6" />
            <Text style={styles.infoTitle}>Información Importante</Text>
          </View>
          <View style={styles.infoList}>
            <View style={styles.infoItem}>
              <View style={styles.infoBullet} />
              <Text style={styles.infoText}>Las funciones requieren que el control maestro esté activo</Text>
            </View>
            <View style={styles.infoItem}>
              <View style={styles.infoBullet} />
              <Text style={styles.infoText}>Los cambios se aplican inmediatamente a todos los usuarios</Text>
            </View>
            <View style={styles.infoItem}>
              <View style={styles.infoBullet} />
              <Text style={styles.infoText}>Por defecto todo está desactivado para cumplir con App Store</Text>
            </View>
          </View>
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
  statusIndicator: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
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
  masterCard: {
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 16,
  },
  masterGradient: {
    padding: 20,
  },
  masterContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  masterIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  masterInfo: {
    flex: 1,
    marginLeft: 16,
  },
  masterTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  masterSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  masterToggle: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  masterToggleDisabled: {
    opacity: 0.6,
  },
  masterToggleText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.5,
  },
  statusBar: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.2)',
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    padding: 14,
    borderRadius: 12,
    marginBottom: 20,
    gap: 10,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    color: '#92400E',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 16,
  },
  featureCard: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 12,
  },
  featureGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  featureIconBg: {
    width: 50,
    height: 50,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureInfo: {
    flex: 1,
    marginLeft: 14,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  featureDescription: {
    fontSize: 13,
    marginTop: 2,
  },
  featureToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  infoCard: {
    backgroundColor: '#EFF6FF',
    borderRadius: 16,
    padding: 16,
    marginTop: 8,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E40AF',
  },
  infoList: {
    gap: 10,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  infoBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#3B82F6',
    marginTop: 6,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#1E40AF',
    lineHeight: 20,
  },
});
