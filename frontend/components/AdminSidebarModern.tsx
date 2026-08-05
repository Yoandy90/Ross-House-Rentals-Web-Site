import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  TextInput,
} from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { getRoleColors } from '../constants/roleColors';

interface MenuItem {
  id: string;
  label: string;
  icon: string;
  route?: string;
  items?: MenuItem[];
  badge?: number;
}

const MENU_ITEMS: MenuItem[] = [
  {
    id: 'overview',
    label: 'General',
    icon: 'apps-outline',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: 'grid-outline', route: '/(admin)/dashboard' },
      { id: 'analytics-dashboard', label: 'Analytics', icon: 'bar-chart-outline', route: '/(admin)/analytics-dashboard' },
      { id: 'adoption', label: 'Adopción App', icon: 'phone-portrait-outline', route: '/(admin)/app-adoption' },
    ]
  },
  {
    id: 'appointments',
    label: 'Citas',
    icon: 'calendar-outline',
    items: [
      { id: 'appointments-improved', label: 'Gestión de Citas', icon: 'calendar', route: '/(admin)/appointments-improved' },
      { id: 'appointments-calendar', label: 'Calendario', icon: 'calendar-outline', route: '/(admin)/appointments-calendar' },
      { id: 'appointment-types', label: 'Tipos de Citas', icon: 'list-outline', route: '/(admin)/appointment-types' },
      { id: 'office-hours', label: 'Horario Oficina', icon: 'time-outline', route: '/(admin)/office-hours' },
    ]
  },
  {
    id: 'clients',
    label: 'Clientes',
    icon: 'people-outline',
    items: [
      { id: 'clients-modern', label: 'Gestión de Clientes', icon: 'people', route: '/(admin)/clients-modern' },
      { id: 'tax-estimates', label: 'Estimados de Impuestos', icon: 'calculator', route: '/(admin)/tax-estimates' },
    ]
  },
  {
    id: 'documents',
    label: 'Documentos',
    icon: 'document-text-outline',
    items: [
      { id: 'documents', label: 'Gestión Documentos', icon: 'folder-open', route: '/(admin)/documents-management' },
      { id: 'upload-return', label: 'Subir Tax Return', icon: 'cloud-upload', route: '/(admin)/upload-return' },
    ]
  },
  {
    id: 'payments',
    label: 'Pagos',
    icon: 'card-outline',
    items: [
      { id: 'subscriptions-management', label: 'Gestión de Suscripciones', icon: 'settings-outline', route: '/(admin)/subscriptions-management' },
      { id: 'products-management', label: 'Productos', icon: 'albums-outline', route: '/(admin)/products-management' },
      { id: 'withdrawal-requests', label: 'Retiros', icon: 'cash-outline', route: '/(admin)/withdrawal-requests' },
    ]
  },
  {
    id: 'credits',
    label: 'Créditos',
    icon: 'wallet-outline',
    items: [
      { id: 'credits-dashboard', label: 'Dashboard', icon: 'speedometer', route: '/(admin)/credits-dashboard' },
      { id: 'credits-packages', label: 'Paquetes', icon: 'gift', route: '/(admin)/credits-packages' },
      { id: 'credits-history', label: 'Historial', icon: 'list', route: '/(admin)/credits-history' },
    ]
  },
  {
    id: 'communications',
    label: 'Comunicaciones',
    icon: 'chatbubbles-outline',
    items: [
      { id: 'push-notifications', label: 'Push Notifications', icon: 'notifications', route: '/(admin)/push-notifications' },
      { id: 'sms-notifications', label: 'SMS', icon: 'chatbox', route: '/(admin)/sms-notifications' },
      { id: 'whatsapp-conversations', label: 'WhatsApp', icon: 'logo-whatsapp', route: '/(admin)/whatsapp-conversations' },
      { id: 'ai-brain', label: 'Ross AI Brain', icon: 'brain', route: '/(admin)/ai-brain' },
    ]
  },
  {
    id: 'content',
    label: 'Contenido',
    icon: 'newspaper-outline',
    items: [
      { id: 'faqs', label: 'FAQs', icon: 'help-circle', route: '/(admin)/faqs-management' },
      { id: 'news', label: 'Noticias', icon: 'newspaper', route: '/(admin)/news-management' },
      { id: 'education', label: 'Educación', icon: 'school', route: '/(admin)/education-management' },
      { id: 'feedback', label: 'Reseñas', icon: 'star', route: '/(admin)/feedback-dashboard' },
    ]
  },
  {
    id: 'system',
    label: 'Sistema',
    icon: 'settings-outline',
    items: [
      { id: 'api-settings', label: 'API Settings', icon: 'key', route: '/(admin)/api-settings' },
      { id: 'users', label: 'Usuarios', icon: 'people-circle', route: '/(admin)/users-management' },
      { id: 'settings', label: 'Configuración', icon: 'cog', route: '/(admin)/settings' },
      { id: 'version', label: 'Versión App', icon: 'code', route: '/(admin)/version-management' },
      { id: 'legal', label: 'Legal', icon: 'document', route: '/(admin)/legal-management' },
    ]
  },
];

export default function AdminSidebarModern() {
  const router = useRouter();
  const pathname = usePathname();
  const { themeMode, setThemeMode } = useTheme();
  const { user, signOut } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [expandedSections, setExpandedSections] = useState<string[]>(['overview']);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Get role-based colors
  const roleColors = useMemo(() => getRoleColors(user?.role), [user?.role]);
  
  // Filter menu items based on user role
  const filteredMenu = useMemo(() => {
    if (user?.role === 'admin') {
      return MENU_ITEMS;
    }
    
    if (user?.role === 'office_assistant') {
      return MENU_ITEMS.filter(section => {
        if (section.id === 'payments') return false;
        if (section.id === 'credits') return false;
        if (section.id === 'system') return false;
        
        if (section.id === 'overview') {
          return {
            ...section,
            items: section.items?.filter(item => item.id === 'dashboard')
          };
        }
        
        return true;
      }).map(section => {
        if (section.id === 'overview') {
          return {
            ...section,
            items: section.items?.filter(item => item.id === 'dashboard')
          };
        }
        return section;
      });
    }
    
    return [];
  }, [user?.role]);

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev =>
      prev.includes(sectionId)
        ? prev.filter(id => id !== sectionId)
        : [...prev, sectionId]
    );
  };

  const isActive = (route?: string) => {
    if (!route) return false;
    return pathname === route || pathname?.startsWith(route + '/');
  };

  const filteredMenuItems = searchQuery
    ? filteredMenu.map(section => ({
        ...section,
        items: section.items?.filter(item =>
          item.label.toLowerCase().includes(searchQuery.toLowerCase())
        ),
      })).filter(section => section.items && section.items.length > 0)
    : filteredMenu;

  const handleLogout = async () => {
    try {
      await signOut();
      router.replace('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <View style={[styles.container, collapsed && styles.containerCollapsed]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          {!collapsed && (
            <View style={styles.logoContainer}>
              <View style={styles.logoIcon}>
                <Text style={styles.logoText}>RT</Text>
              </View>
              <View style={styles.logoInfo}>
                <Text style={styles.companyName}>Ross Tax</Text>
                <Text style={styles.companyTagline}>Admin Panel</Text>
              </View>
            </View>
          )}
          <TouchableOpacity
            style={styles.collapseButton}
            onPress={() => setCollapsed(!collapsed)}
          >
            <Ionicons
              name={collapsed ? 'chevron-forward' : 'chevron-back'}
              size={20}
              color="#64748B"
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Search Bar */}
      {!collapsed && (
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={16} color="#94A3B8" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery !== '' && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={16} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Navigation */}
      <ScrollView
        style={styles.navigation}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.navigationContent}
      >
        {filteredMenuItems.map((section) => (
          <View key={section.id} style={styles.section}>
            {/* Section Header */}
            <TouchableOpacity
              style={styles.sectionHeader}
              onPress={() => !collapsed && toggleSection(section.id)}
            >
              <View style={styles.sectionHeaderLeft}>
                <Ionicons name={section.icon as any} size={20} color="#475569" />
                {!collapsed && (
                  <Text style={styles.sectionLabel}>{section.label}</Text>
                )}
              </View>
              {!collapsed && section.items && (
                <Ionicons
                  name={expandedSections.includes(section.id) ? 'chevron-down' : 'chevron-forward'}
                  size={16}
                  color="#94A3B8"
                />
              )}
            </TouchableOpacity>

            {/* Section Items */}
            {(!collapsed && section.items && expandedSections.includes(section.id)) && (
              <View style={styles.sectionItems}>
                {section.items.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.menuItem,
                      isActive(item.route) && styles.menuItemActive,
                    ]}
                    onPress={() => item.route && router.push(item.route as any)}
                  >
                    <View style={styles.menuItemLeft}>
                      <Ionicons
                        name={item.icon as any}
                        size={18}
                        color={isActive(item.route) ? '#6C1110' : '#64748B'}
                      />
                      <Text
                        style={[
                          styles.menuItemLabel,
                          isActive(item.route) && styles.menuItemLabelActive,
                        ]}
                      >
                        {item.label}
                      </Text>
                    </View>
                    {item.badge !== undefined && item.badge > 0 && (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>{item.badge}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Collapsed Tooltip - show on hover */}
            {collapsed && section.items && (
              <View style={styles.collapsedTooltip}>
                <Text style={styles.tooltipText}>{section.label}</Text>
              </View>
            )}
          </View>
        ))}
      </ScrollView>

      {/* Footer - User Profile */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.userProfile} onPress={() => router.push('/(admin)/settings')}>
          <View style={styles.userAvatar}>
            <Text style={styles.userAvatarText}>
              {user?.name?.charAt(0)?.toUpperCase() || 'A'}
            </Text>
          </View>
          {!collapsed && (
            <View style={styles.userInfo}>
              <Text style={styles.userName} numberOfLines={1}>{user?.name || 'Admin'}</Text>
              <Text style={styles.userEmail} numberOfLines={1}>{user?.email}</Text>
            </View>
          )}
        </TouchableOpacity>

        {!collapsed && (
          <View style={styles.footerActions}>
            <TouchableOpacity
              style={styles.footerButton}
              onPress={() => setThemeMode(themeMode === 'light' ? 'dark' : 'light')}
            >
              <Ionicons
                name={themeMode === 'light' ? 'moon-outline' : 'sunny-outline'}
                size={18}
                color="#64748B"
              />
            </TouchableOpacity>
            <TouchableOpacity style={styles.footerButton} onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={18} color="#EF4444" />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 260,
    backgroundColor: '#FFFFFF',
    borderRightWidth: 1,
    borderRightColor: '#E2E8F0',
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    zIndex: 1000,
    ...Platform.select({
      web: {
        shadowColor: '#000',
        shadowOffset: { width: 2, height: 0 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      },
    }),
  },
  containerCollapsed: {
    width: 72,
  },
  header: {
    height: 70,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#6C1110',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  logoInfo: {
    gap: 2,
  },
  companyName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    lineHeight: 20,
  },
  companyTagline: {
    fontSize: 11,
    color: '#64748B',
    lineHeight: 14,
  },
  collapseButton: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 36,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginHorizontal: 16,
    marginVertical: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#1E293B',
    outlineStyle: 'none',
  } as any,
  navigation: {
    flex: 1,
  },
  navigationContent: {
    paddingBottom: 16,
  },
  section: {
    marginBottom: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 40,
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionItems: {
    gap: 2,
    paddingHorizontal: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 38,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginBottom: 2,
  },
  menuItemActive: {
    backgroundColor: '#FEF2F2',
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  menuItemLabel: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  menuItemLabelActive: {
    color: '#6C1110',
    fontWeight: '600',
  },
  badge: {
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  collapsedTooltip: {
    display: 'none',
  },
  tooltipText: {
    fontSize: 12,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    padding: 16,
  },
  userProfile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  userAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#6C1110',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userAvatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 2,
  },
  userEmail: {
    fontSize: 12,
    color: '#64748B',
  },
  footerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  footerButton: {
    flex: 1,
    height: 36,
    borderRadius: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
