import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Alert, ScrollView, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../constants/colors';
import { LinearGradient } from 'expo-linear-gradient';
import { usePathname, useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';

interface MenuItem {
  id: string;
  label: string;
  icon: string;
  route: string;
}

interface MenuCategory {
  id: string;
  label: string;
  icon: string;
  items: MenuItem[];
}

const menuCategories: MenuCategory[] = [
  {
    id: 'overview',
    label: 'General',
    icon: 'apps-outline',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: 'grid-outline', route: '/(admin)/dashboard' },
      { id: 'analytics-dashboard', label: 'Analytics Dashboard', icon: 'bar-chart-outline', route: '/(admin)/analytics-dashboard' },
      { id: 'analytics', label: 'Analíticas', icon: 'stats-chart-outline', route: '/(admin)/analytics' },
      { id: 'adoption', label: 'Adopción App', icon: 'phone-portrait-outline', route: '/(admin)/app-adoption' },
    ]
  },
  {
    id: 'clients-management',
    label: 'Gestión de Clientes',
    icon: 'people-outline',
    items: [
      { id: 'clients', label: 'Clientes', icon: 'people-outline', route: '/(admin)/clients-modern' },
      { id: 'documents', label: 'Documentos', icon: 'folder-open-outline', route: '/(admin)/documents-management' },
      { id: 'upload', label: 'Subir Declaración', icon: 'cloud-upload-outline', route: '/(admin)/upload-return' },
    ]
  },
  {
    id: 'appointments',
    label: 'Citas',
    icon: 'calendar-outline',
    items: [
      { id: 'appointments-improved', label: '✨ Citas Mejoradas', icon: 'calendar', route: '/(admin)/appointments-improved' },
      { id: 'appointments-calendar', label: 'Calendario', icon: 'calendar-outline', route: '/(admin)/appointments-calendar' },
      { id: 'appointments', label: 'Lista de Citas', icon: 'list-outline', route: '/(admin)/appointments' },
      { id: 'availability', label: 'Disponibilidad', icon: 'time-outline', route: '/(admin)/availability-settings' },
    ]
  },
  {
    id: 'payments',
    label: 'Pagos y Facturación',
    icon: 'card-outline',
    items: [
      { id: 'subscriptions', label: 'Suscripciones Activas', icon: 'card-outline', route: '/(admin)/subscriptions' },
      { id: 'subscriptions-management', label: 'Gestión de Suscripciones', icon: 'settings-outline', route: '/(admin)/subscriptions-management' },
      { id: 'products-management', label: 'Gestión de Productos', icon: 'albums-outline', route: '/(admin)/products-management' },
      { id: 'withdrawal-requests', label: 'Solicitudes de Retiro', icon: 'cash-outline', route: '/(admin)/withdrawal-requests' },
      { id: 'payment-methods', label: 'Métodos de Pago', icon: 'wallet-outline', route: '/(admin)/payment-methods' },
      { id: 'encrypted-cards', label: 'Tarjetas Guardadas', icon: 'lock-closed-outline', route: '/(admin)/encrypted-cards' },
      { id: 'stripe-settings', label: 'Configuración Stripe', icon: 'card-outline', route: '/(admin)/stripe-settings' },
    ]
  },
  {
    id: 'credits',
    label: 'Sistema de Créditos',
    icon: 'wallet-outline',
    items: [
      { id: 'credits-dashboard', label: 'Dashboard de Créditos', icon: 'stats-chart-outline', route: '/(admin)/credits-dashboard' },
      { id: 'credits-history', label: 'Historial de Créditos', icon: 'time-outline', route: '/(admin)/credits-history' },
      { id: 'credits-packages', label: 'Paquetes de Créditos', icon: 'cube-outline', route: '/(admin)/credits-packages' },
      { id: 'credits-adjustments', label: 'Ajustes de Créditos', icon: 'create-outline', route: '/(admin)/credits-adjustments' },
      { id: 'service-prices', label: 'Precios de Servicios', icon: 'pricetags-outline', route: '/(admin)/service-prices' },
      { id: 'refunds', label: 'Gestión de Reembolsos', icon: 'receipt-outline', route: '/(admin)/refunds' },
    ]
  },
  {
    id: 'financial',
    label: 'Servicios Financieros',
    icon: 'cash-outline',
    items: [
      { id: 'loans', label: 'Préstamos', icon: 'cash-outline', route: '/(admin)/loans-management' },
    ]
  },
  {
    id: 'gamification',
    label: 'Gamificación',
    icon: 'trophy-outline',
    items: [
      { id: 'raffles', label: 'Sorteos', icon: 'gift-outline', route: '/(admin)/raffles-management' },
      { id: 'lottery', label: 'Lotería', icon: 'ticket-outline', route: '/(admin)/lottery-management' },
      { id: 'referrals', label: 'Programa de Referidos', icon: 'share-social-outline', route: '/(admin)/referrals-management' },
    ]
  },
  {
    id: 'content-marketing',
    label: 'Contenido y Comunicación',
    icon: 'documents-outline',
    items: [
      { id: 'faqs', label: 'FAQs', icon: 'help-circle-outline', route: '/(admin)/faqs-management' },
      { id: 'education', label: 'Contenido Educativo', icon: 'book-outline', route: '/(admin)/education-management' },
      { id: 'news', label: 'Noticias', icon: 'newspaper-outline', route: '/(admin)/news-management' },
      { id: 'affiliate-links', label: 'Enlaces de Afiliados', icon: 'link-outline', route: '/(admin)/affiliate-links' },
    ]
  },
  {
    id: 'notifications',
    label: 'Notificaciones',
    icon: 'notifications-outline',
    items: [
      { id: 'push-notifications', label: 'Notificaciones Push', icon: 'notifications-outline', route: '/(admin)/push-notifications' },
      { id: 'sms-notifications', label: 'SMS a Clientes', icon: 'chatbubbles-outline', route: '/(admin)/sms-notifications' },
      { id: 'whatsapp', label: 'WhatsApp', icon: 'logo-whatsapp', route: '/(admin)/whatsapp-conversations' },
      { id: 'notification-templates', label: 'Plantillas', icon: 'mail-outline', route: '/(admin)/notification-templates' },
    ]
  },
  {
    id: 'ai-tools',
    label: 'IA y Automatización',
    icon: 'sparkles-outline',
    items: [
      { id: 'ai-brain', label: '🧠 AI Brain', icon: 'bulb-outline', route: '/(admin)/ai-brain' },
    ]
  },
  {
    id: 'integrations',
    label: 'Integraciones',
    icon: 'git-network-outline',
    items: [
      { id: 'rise-crm', label: 'Rise CRM Sync', icon: 'sync-outline', route: '/(admin)/rise-sync-panel' },
    ]
  },
  {
    id: 'office',
    label: 'Oficina',
    icon: 'business-outline',
    items: [
      { id: 'office-hours', label: 'Horarios de Oficina', icon: 'time-outline', route: '/(admin)/office-hours' },
    ]
  },
  {
    id: 'system',
    label: 'Sistema',
    icon: 'settings-outline',
    items: [
      { id: 'legal', label: 'Legal', icon: 'shield-checkmark-outline', route: '/(admin)/legal-management' },
      { id: 'versions', label: 'Versiones', icon: 'git-branch-outline', route: '/(admin)/version-management' },
      { id: 'settings', label: 'Configuración', icon: 'settings-outline', route: '/(admin)/settings' },
    ]
  }
];

export default function AdminSidebar() {
  const colors = useThemeColors();
  const router = useRouter();
  const pathname = usePathname();
  const { signOut } = useAuth();
  const [expandedCategories, setExpandedCategories] = React.useState<string[]>(['overview']);

  const styles = React.useMemo(() => createStyles(colors), [colors]);

  const isActive = (route: string) => {
    return pathname === route;
  };

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => 
      prev.includes(categoryId) 
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const handleLogout = () => {
    if (Platform.OS === 'web') {
      // For web, confirm before logout
      if (window.confirm('¿Deseas cerrar sesión?')) {
        signOut();
        router.replace('/(auth)/login');
      }
    } else {
      // For mobile, use Alert
      Alert.alert('Cerrar Sesión', '¿Deseas salir del panel de administrador?', [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Salir',
          onPress: async () => {
            await signOut();
            router.replace('/(auth)/login');
          },
        },
      ]);
    }
  };

  return (
    <View style={styles.sidebar}>
      {/* Logo Header - Simplified */}
      <View style={styles.logoContainer}>
        <View style={styles.logoContent}>
          <Image 
            source={require('../assets/ross-logo.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
        </View>
        <View style={styles.divider} />
      </View>

      {/* Menu Items */}
      <ScrollView 
        style={styles.menuContainer}
        contentContainerStyle={styles.menuContent}
        showsVerticalScrollIndicator={false}
      >
        {menuCategories.map((category) => {
          const isExpanded = expandedCategories.includes(category.id);
          const hasActiveItem = category.items.some(item => isActive(item.route));
          
          return (
            <View key={category.id} style={styles.categoryContainer}>
              {/* Category Header */}
              <TouchableOpacity
                style={styles.categoryHeader}
                onPress={() => toggleCategory(category.id)}
                activeOpacity={0.7}
              >
                <View style={styles.categoryHeaderContent}>
                  <View style={[styles.categoryIconContainer, hasActiveItem && styles.categoryIconContainerActive]}>
                    <Ionicons
                      name={category.icon as any}
                      size={16}
                      color={hasActiveItem ? colors.primary : colors.textGray}
                    />
                  </View>
                  <Text style={[styles.categoryLabel, hasActiveItem && styles.categoryLabelActive]}>
                    {category.label}
                  </Text>
                </View>
                <Ionicons
                  name={isExpanded ? 'chevron-down' : 'chevron-forward'}
                  size={20}
                  color={colors.textGray}
                />
              </TouchableOpacity>

              {/* Category Items */}
              {isExpanded && (
                <View style={styles.categoryItems}>
                  {category.items.map((item) => {
                    const active = isActive(item.route);
                    return (
                      <TouchableOpacity
                        key={item.id}
                        style={[styles.menuItem, active && styles.menuItemActive]}
                        onPress={() => router.push(item.route as any)}
                        activeOpacity={0.7}
                      >
                        {active && (
                          <LinearGradient
                            colors={[colors.primary + '20', colors.secondary + '20']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.activeBackground}
                          />
                        )}
                        <View style={styles.menuItemContent}>
                          <View style={[styles.iconContainer, active && styles.iconContainerActive]}>
                            <Ionicons
                              name={item.icon as any}
                              size={18}
                              color={active ? colors.primary : colors.textGray}
                            />
                          </View>
                          <Text style={[styles.menuText, active && styles.menuTextActive]}>
                            {item.label}
                          </Text>
                        </View>
                        {active && <View style={styles.activeIndicator} />}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <View style={styles.footerDivider} />
        
        {/* Logout Button */}
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
          activeOpacity={0.7}
        >
          <View style={styles.logoutContent}>
            <View style={styles.logoutIconContainer}>
              <Ionicons name="log-out-outline" size={20} color={colors.error} />
            </View>
            <Text style={styles.logoutText}>Cerrar Sesión</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.footerInfo}>
          <Ionicons name="shield-checkmark" size={16} color={colors.success} />
          <Text style={styles.footerText}>Sistema Seguro</Text>
        </View>
        <Text style={styles.versionText}>v2.0.1</Text>
      </View>
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  sidebar: {
    width: 280,
    backgroundColor: colors.background,
    borderRightWidth: 1,
    borderRightColor: colors.border + '30',
    ...Platform.select({
      web: {
        position: 'fixed' as any,
        left: 0,
        top: 0,
        bottom: 0,
        zIndex: 100,
        boxShadow: '4px 0 24px rgba(0, 0, 0, 0.08)',
      },
      default: {
        elevation: 8,
      },
    }),
  },
  logoContainer: {
    paddingVertical: 16,
  },
  logoContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  logoImage: {
    width: 160,
    height: 60,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border + '30',
    marginTop: 20,
    marginHorizontal: 20,
  },
  menuContainer: {
    flex: 1,
  },
  menuContent: {
    paddingTop: 8,
    paddingHorizontal: 12,
    paddingBottom: 16,
  },
  categoryContainer: {
    marginBottom: 8,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 2,
  },
  categoryHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoryIconContainer: {
    width: 26,
    height: 26,
    borderRadius: 7,
    backgroundColor: colors.backgroundGray,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryIconContainerActive: {
    backgroundColor: colors.primary + '15',
  },
  categoryLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textGray,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  categoryLabelActive: {
    color: colors.primary,
  },
  categoryItems: {
    paddingLeft: 8,
  },
  menuItem: {
    position: 'relative',
    marginBottom: 2,
    borderRadius: 10,
    overflow: 'hidden',
  },
  menuItemActive: {
    // Active styles handled by gradient
  },
  activeBackground: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  menuItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 10,
  },
  iconContainer: {
    width: 28,
    height: 28,
    borderRadius: 7,
    backgroundColor: colors.backgroundGray,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainerActive: {
    backgroundColor: colors.primary + '15',
  },
  menuText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textGray,
    flex: 1,
  },
  menuTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  activeIndicator: {
    position: 'absolute',
    right: 0,
    top: '50%',
    marginTop: -12,
    width: 4,
    height: 24,
    borderTopLeftRadius: 4,
    borderBottomLeftRadius: 4,
    backgroundColor: colors.primary,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border + '20',
  },
  footerDivider: {
    height: 1,
    backgroundColor: colors.border + '10',
    marginBottom: 10,
  },
  logoutButton: {
    marginBottom: 12,
    borderRadius: 10,
    overflow: 'hidden',
  },
  logoutContent: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.error + '10',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.error + '30',
  },
  logoutIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 7,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  logoutText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.error,
  },
  footerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  footerText: {
    fontSize: 11,
    color: colors.textGray,
    fontWeight: '600',
  },
  versionText: {
    fontSize: 10,
    color: colors.textGray,
    opacity: 0.6,
    textAlign: 'center',
  },
});
