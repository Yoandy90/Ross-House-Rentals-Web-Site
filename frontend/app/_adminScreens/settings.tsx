/**
 * ⚙️ Configuración Admin - Premium Settings 2025
 * Modern settings screen with grouped sections
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../../contexts/AuthContext';
import Constants from 'expo-constants';

interface SettingItem {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  route?: string;
  color: string;
  badge?: string;
  action?: () => void;
}

interface SettingSection {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  items: SettingItem[];
}

export default function AdminSettingsPremiumScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [appVersion] = useState(Constants.expoConfig?.version || '1.0.0');

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, []);

  const handleLogout = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      '🚪 Cerrar Sesión',
      '¿Estás seguro de que deseas salir de tu cuenta?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar Sesión',
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.removeItem('session_token');
            if (logout) logout();
            router.replace('/(auth)/login');
          },
        },
      ]
    );
  };

  const sections: SettingSection[] = [
    {
      title: 'Sistema',
      icon: 'settings-outline',
      items: [
        {
          id: 'business',
          icon: 'business',
          title: 'Información Empresa',
          subtitle: 'Datos de Ross Tax Preparation',
          route: '/_adminScreens/api-settings',
          color: '#3B82F6',
        },
        {
          id: 'payments',
          icon: 'card',
          title: 'Métodos de Pago',
          subtitle: 'Stripe y procesadores',
          route: '/_adminScreens/stripe-settings',
          color: '#8B5CF6',
        },
        {
          id: 'usps',
          icon: 'mail',
          title: 'USPS Configuración',
          subtitle: 'Envíos y tracking',
          route: '/_adminScreens/shipments',
          color: '#EF4444',
        },
        {
          id: 'whatsapp',
          icon: 'logo-whatsapp',
          title: 'WhatsApp Business',
          subtitle: 'Configuración de mensajes',
          route: '/(admin)/whatsapp-settings',
          color: '#25D366',
        },
      ],
    },
    {
      title: 'Notificaciones',
      icon: 'notifications-outline',
      items: [
        {
          id: 'push',
          icon: 'notifications',
          title: 'Push Notifications',
          subtitle: 'Alertas en dispositivo',
          route: '/_adminScreens/push-notifications',
          color: '#F59E0B',
        },
        {
          id: 'sms',
          icon: 'chatbubbles',
          title: 'SMS / Twilio',
          subtitle: 'Mensajes de texto',
          route: '/_adminScreens/sms-notifications',
          color: '#10B981',
        },
        {
          id: 'templates',
          icon: 'document-text',
          title: 'Plantillas',
          subtitle: 'Diseños de mensajes',
          route: '/_adminScreens/notification-templates',
          color: '#6366F1',
        },
      ],
    },
    {
      title: 'Integraciones',
      icon: 'extension-puzzle-outline',
      items: [
        {
          id: 'square',
          icon: 'calendar',
          title: 'Square Appointments',
          subtitle: 'Sincronización de citas',
          route: '/_adminScreens/availability-settings',
          color: '#000000',
        },
        {
          id: 'google',
          icon: 'logo-google',
          title: 'Google Calendar',
          subtitle: 'Sincronizar calendario',
          route: '/_adminScreens/api-settings',
          color: '#4285F4',
        },
        {
          id: 'sendgrid',
          icon: 'send',
          title: 'SendGrid Email',
          subtitle: 'Correos masivos',
          route: '/_adminScreens/api-settings',
          color: '#1A82E2',
        },
      ],
    },
    {
      title: 'Aplicación',
      icon: 'apps-outline',
      items: [
        {
          id: 'features',
          icon: 'game-controller',
          title: 'Control Maestro',
          subtitle: 'Activar/desactivar funciones',
          route: '/_adminScreens/feature-flags',
          color: '#EC4899',
          badge: 'Nuevo',
        },
        {
          id: 'adoption',
          icon: 'trending-up',
          title: 'Adopción de App',
          subtitle: 'Métricas de uso',
          route: '/_adminScreens/app-adoption',
          color: '#14B8A6',
        },
        {
          id: 'about',
          icon: 'information-circle',
          title: 'Acerca de',
          subtitle: `Ross Tax v${appVersion}`,
          route: '/_adminScreens/app-adoption',
          color: '#6B7280',
        },
      ],
    },
  ];

  const handlePress = (item: SettingItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (item.action) {
      item.action();
    } else if (item.route) {
      router.push(item.route as any);
    }
  };

  return (
    <View style={styles.container}>
      {/* Premium Header */}
      <LinearGradient colors={['#1a1a2e', '#16213e', '#0f3460']} style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>⚙️ Configuración</Text>
          <Text style={styles.headerSubtitle}>Ajustes del sistema</Text>
        </View>
        <View style={{ width: 40 }} />
      </LinearGradient>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Card */}
        <Animated.View style={[styles.profileCard, { opacity: fadeAnim }]}>
          <LinearGradient
            colors={['#667eea', '#764ba2']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.profileGradient}
          >
            <View style={styles.profileAvatar}>
              <Text style={styles.profileAvatarText}>
                {user?.name?.charAt(0)?.toUpperCase() || 'A'}
              </Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{user?.name || 'Administrador'}</Text>
              <Text style={styles.profileEmail}>{user?.email || 'admin@rosstax.com'}</Text>
            </View>
            <View style={styles.profileBadge}>
              <Ionicons name="shield-checkmark" size={14} color="#10B981" />
              <Text style={styles.profileBadgeText}>Admin</Text>
            </View>
          </LinearGradient>
        </Animated.View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity 
            style={styles.quickAction}
            onPress={() => router.push('/_adminScreens/email-analytics' as any)}
          >
            <LinearGradient colors={['#3B82F6', '#1D4ED8']} style={styles.quickActionGradient}>
              <Ionicons name="mail" size={22} color="#fff" />
            </LinearGradient>
            <Text style={styles.quickActionText}>Email</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.quickAction}
            onPress={() => router.push('/(admin)/analytics' as any)}
          >
            <LinearGradient colors={['#10B981', '#059669']} style={styles.quickActionGradient}>
              <Ionicons name="stats-chart" size={22} color="#fff" />
            </LinearGradient>
            <Text style={styles.quickActionText}>Analytics</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.quickAction}
            onPress={() => router.push('/(admin)/reviews' as any)}
          >
            <LinearGradient colors={['#F59E0B', '#D97706']} style={styles.quickActionGradient}>
              <Ionicons name="star" size={22} color="#fff" />
            </LinearGradient>
            <Text style={styles.quickActionText}>Reseñas</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.quickAction}
            onPress={() => router.push('/_adminScreens/ai-brain' as any)}
          >
            <LinearGradient colors={['#8B5CF6', '#7C3AED']} style={styles.quickActionGradient}>
              <Ionicons name="sparkles" size={22} color="#fff" />
            </LinearGradient>
            <Text style={styles.quickActionText}>AI</Text>
          </TouchableOpacity>
        </View>

        {/* Settings Sections */}
        {sections.map((section, sectionIndex) => (
          <Animated.View 
            key={section.title} 
            style={[styles.section, { opacity: fadeAnim }]}
          >
            <View style={styles.sectionHeader}>
              <Ionicons name={section.icon} size={18} color="#6B7280" />
              <Text style={styles.sectionTitle}>{section.title}</Text>
            </View>
            
            <View style={styles.sectionContent}>
              {section.items.map((item, itemIndex) => (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.settingItem,
                    itemIndex === section.items.length - 1 && styles.settingItemLast,
                  ]}
                  onPress={() => handlePress(item)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.settingIcon, { backgroundColor: item.color + '15' }]}>
                    <Ionicons name={item.icon} size={20} color={item.color} />
                  </View>
                  <View style={styles.settingInfo}>
                    <View style={styles.settingTitleRow}>
                      <Text style={styles.settingTitle}>{item.title}</Text>
                      {item.badge && (
                        <View style={styles.settingBadge}>
                          <Text style={styles.settingBadgeText}>{item.badge}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.settingSubtitle}>{item.subtitle}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />
                </TouchableOpacity>
              ))}
            </View>
          </Animated.View>
        ))}

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <LinearGradient
            colors={['#FEE2E2', '#FECACA']}
            style={styles.logoutGradient}
          >
            <Ionicons name="log-out-outline" size={22} color="#DC2626" />
            <Text style={styles.logoutText}>Cerrar Sesión</Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Ross Tax Preparation LLC</Text>
          <Text style={styles.footerVersion}>Versión {appVersion}</Text>
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
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  profileCard: {
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 20,
  },
  profileGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
  },
  profileAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileAvatarText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
  },
  profileInfo: {
    flex: 1,
    marginLeft: 14,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  profileEmail: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  profileBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
  },
  profileBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  quickAction: {
    alignItems: 'center',
    flex: 1,
  },
  quickActionGradient: {
    width: 50,
    height: 50,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickActionText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 8,
    fontWeight: '500',
  },
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 4,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  settingItemLast: {
    borderBottomWidth: 0,
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingInfo: {
    flex: 1,
    marginLeft: 12,
  },
  settingTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  settingTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
  },
  settingSubtitle: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 2,
  },
  settingBadge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  settingBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6366F1',
  },
  logoutButton: {
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 8,
  },
  logoutGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 10,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#DC2626',
  },
  footer: {
    alignItems: 'center',
    marginTop: 24,
    paddingVertical: 16,
  },
  footerText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  footerVersion: {
    fontSize: 12,
    color: '#D1D5DB',
    marginTop: 4,
  },
});
