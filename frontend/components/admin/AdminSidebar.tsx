/**
 * Admin Sidebar for Web Version
 * Similar to Rise CRM layout
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { Link } from 'expo-router';

interface SidebarProps {
  collapsed?: boolean;
}

export default function AdminSidebar({ collapsed = false }: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(collapsed);

  // Solo renderizar en web
  if (Platform.OS !== 'web') {
    return null;
  }

  const menuItems = [
    {
      section: 'Principal',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: 'stats-chart', route: '/(admin)' },
        { id: 'clients', label: 'Clientes', icon: 'people', route: '/(admin)/clients' },
        { id: 'invoices', label: 'Facturas', icon: 'receipt', route: '/(admin)/invoices' },
        { id: 'chat', label: 'Chat', icon: 'chatbubbles', route: '/(admin)/chat' },
      ],
    },
    {
      section: 'Gestión',
      items: [
        { id: 'appointments', label: 'Citas', icon: 'calendar', route: '/_adminScreens/appointments' },
        { id: 'documents', label: 'Documentos', icon: 'folder', route: '/_adminScreens/documents-management' },
        { id: 'create-service', label: 'Crear Orden', icon: 'document-text', route: '/_adminScreens/create-service' },
      ],
    },
    {
      section: 'Comunicaciones',
      items: [
        { id: 'email-campaigns', label: 'Email Campaigns', icon: 'mail-open', route: '/_adminScreens/email-campaigns' },
        { id: 'email-analytics', label: 'Email Analytics', icon: 'analytics', route: '/_adminScreens/email-analytics' },
        { id: 'push', label: 'Push Notifications', icon: 'notifications', route: '/_adminScreens/push-notifications' },
        { id: 'sms', label: 'SMS', icon: 'chatbubbles', route: '/_adminScreens/sms-notifications' },
        { id: 'whatsapp', label: 'WhatsApp', icon: 'logo-whatsapp', route: '/_adminScreens/whatsapp-conversations' },
        { id: 'ai-brain', label: 'IA Asistente', icon: 'bulb', route: '/_adminScreens/ai-brain' },
      ],
    },
    {
      section: 'Más',
      items: [
        { id: 'more', label: 'Todas las Opciones', icon: 'menu', route: '/(admin)/more' },
        { id: 'settings', label: 'Configuración', icon: 'settings', route: '/_adminScreens/settings' },
      ],
    },
  ];

  const handleLogout = async () => {
    await signOut();
    router.replace('/(auth)/login');
  };

  return (
    <View style={[styles.sidebar, isCollapsed && styles.sidebarCollapsed]}>
      {/* Header */}
      <View style={styles.header}>
        {!isCollapsed && (
          <View style={styles.logoContainer}>
            <View style={styles.logo}>
              <Text style={styles.logoText}>RT</Text>
            </View>
            <Text style={styles.title}>Ross Tax Admin</Text>
          </View>
        )}
        <TouchableOpacity
          style={styles.collapseBtn}
          onPress={() => setIsCollapsed(!isCollapsed)}
        >
          <Ionicons
            name={isCollapsed ? 'chevron-forward' : 'chevron-back'}
            size={20}
            color="#6b7280"
          />
        </TouchableOpacity>
      </View>

      {/* User Info */}
      {!isCollapsed && (
        <View style={styles.userInfo}>
          <View style={styles.userAvatar}>
            <Text style={styles.userAvatarText}>
              {user?.name?.charAt(0).toUpperCase() || 'A'}
            </Text>
          </View>
          <View style={styles.userDetails}>
            <Text style={styles.userName}>{user?.name || 'Admin'}</Text>
            <Text style={styles.userRole}>Administrador</Text>
          </View>
        </View>
      )}

      {/* Menu */}
      <ScrollView style={styles.menu} showsVerticalScrollIndicator={false}>
        {menuItems.map((section, idx) => (
          <View key={idx} style={styles.section}>
            {!isCollapsed && (
              <Text style={styles.sectionTitle}>{section.section}</Text>
            )}
            {section.items.map((item) => {
              const isActive = pathname === item.route || pathname?.startsWith(item.route + '/');
              const handlePress = () => {
                console.log('Navigating to:', item.route);
                try {
                  router.push(item.route as any);
                } catch (error) {
                  console.error('Navigation error:', error);
                }
              };
              
              return (
                <Pressable
                  key={item.id}
                  style={({ pressed, hovered }: any) => [
                    styles.menuItem,
                    isActive && styles.menuItemActive,
                    isCollapsed && styles.menuItemCollapsed,
                    (hovered || pressed) && styles.menuItemHover,
                  ]}
                  onPress={handlePress}
                >
                  <Ionicons
                    name={item.icon as any}
                    size={20}
                    color={isActive ? '#6C1110' : '#6b7280'}
                  />
                  {!isCollapsed && (
                    <Text
                      style={[
                        styles.menuItemText,
                        isActive && styles.menuItemTextActive,
                      ]}
                    >
                      {item.label}
                    </Text>
                  )}
                </Pressable>
              );
            })}
          </View>
        ))}
      </ScrollView>

      {/* Logout */}
      <TouchableOpacity
        style={[styles.logoutBtn, isCollapsed && styles.logoutBtnCollapsed]}
        onPress={handleLogout}
      >
        <Ionicons name="log-out-outline" size={20} color="#ef4444" />
        {!isCollapsed && <Text style={styles.logoutText}>Cerrar Sesión</Text>}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    width: 280,
    backgroundColor: '#ffffff',
    borderRightWidth: 1,
    borderRightColor: '#e5e7eb',
    height: '100vh',
    position: 'fixed' as any,
    left: 0,
    top: 0,
    zIndex: 1000,
  },
  sidebarCollapsed: {
    width: 80,
  },
  header: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  logo: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#6C1110',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1f2937',
  },
  collapseBtn: {
    padding: 8,
  },
  userInfo: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#6C1110',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userAvatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2937',
  },
  userRole: {
    fontSize: 13,
    color: '#6b7280',
  },
  menu: {
    flex: 1,
    paddingTop: 8,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9ca3af',
    textTransform: 'uppercase',
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    gap: 12,
    marginHorizontal: 12,
    borderRadius: 8,
    cursor: 'pointer' as any,
  },
  menuItemCollapsed: {
    justifyContent: 'center',
    paddingHorizontal: 0,
  },
  menuItemActive: {
    backgroundColor: '#fef2f2',
  },
  menuItemText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  menuItemTextActive: {
    color: '#6C1110',
    fontWeight: '600',
  },
  menuItemHover: {
    backgroundColor: '#f9fafb',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    marginHorizontal: 12,
    marginBottom: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    cursor: 'pointer' as any,
  },
  logoutBtnCollapsed: {
    justifyContent: 'center',
    paddingHorizontal: 0,
  },
  logoutText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#ef4444',
  },
});
