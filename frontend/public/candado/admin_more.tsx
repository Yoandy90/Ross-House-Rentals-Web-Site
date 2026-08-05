/**
 * Admin More/Menu Screen
 * Contains all additional admin options not in main tab bar
 * Organized in 3 columns with Spanish translations
 */
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import AdminHeader from '../../components/admin/AdminHeader';

const { width: screenWidth } = Dimensions.get('window');

interface MenuSection {
  title: string;
  items: MenuItem[];
}

interface MenuItem {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: string;
  color?: string;
}

const AdminMoreScreen = () => {
  const router = useRouter();
  const { signOut } = useAuth();

  const handleLogout = () => {
    Alert.alert(
      'Cerrar Sesión',
      '¿Estás seguro que deseas cerrar sesión?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Salir',
          onPress: async () => {
            await signOut();
            router.replace('/(auth)/login');
          },
        },
      ]
    );
  };

  const menuSections: MenuSection[] = [
    {
      title: 'Gestión de Clientes',
      items: [
        { id: 'create-client', label: 'Crear Cliente', icon: 'person-add', route: '/_adminScreens/create-client', color: '#10b981' },
        { id: 'client-details', label: 'Detalles de Cliente', icon: 'person-circle', route: '/_adminScreens/client-details', color: '#3b82f6' },
        { id: 'clients-modern', label: 'Vista Moderna', icon: 'people-circle', route: '/_adminScreens/clients-modern', color: '#6366f1' },
      ],
    },
    {
      title: 'Citas y Calendario',
      items: [
        { id: 'appointments', label: 'Gestión de Citas', icon: 'calendar', route: '/_adminScreens/appointments', color: '#8b5cf6' },
        { id: 'schedule-appointment', label: 'Agendar Cita', icon: 'calendar-outline', route: '/_adminScreens/schedule-appointment', color: '#a855f7' },
        { id: 'appointments-calendar', label: 'Calendario', icon: 'calendar-number', route: '/_adminScreens/appointments-calendar', color: '#9333ea' },
        { id: 'office-hours', label: 'Horarios', icon: 'time', route: '/_adminScreens/office-hours', color: '#7c3aed' },
      ],
    },
    {
      title: 'Servicios y Órdenes',
      items: [
        { id: 'service-orders', label: 'Proyectos', icon: 'briefcase', route: '/_adminScreens/service-orders', color: '#6C1110' },
        { id: 'create-service', label: 'Nueva Orden', icon: 'add-circle', route: '/_adminScreens/create-service', color: '#3b82f6' },
        { id: 'service-prices', label: 'Precios', icon: 'pricetag', route: '/_adminScreens/service-prices', color: '#0ea5e9' },
        { id: 'tax-estimates', label: 'Estimados', icon: 'calculator', route: '/_adminScreens/tax-estimates', color: '#06b6d4' },
        { id: 'upload-return', label: 'Subir Retorno', icon: 'cloud-upload', route: '/_adminScreens/upload-return', color: '#14b8a6' },
      ],
    },
    {
      title: 'Documentos y Contenido',
      items: [
        { id: 'documents', label: 'Documentos', icon: 'folder', route: '/_adminScreens/documents-management', color: '#f59e0b' },
        { id: 'legal', label: 'Legales', icon: 'document', route: '/_adminScreens/legal-management', color: '#d97706' },
        { id: 'education', label: 'Educación', icon: 'school', route: '/_adminScreens/education-management', color: '#ea580c' },
        { id: 'news', label: 'Noticias', icon: 'newspaper', route: '/_adminScreens/news-management', color: '#dc2626' },
        { id: 'faqs', label: 'FAQs', icon: 'help-circle', route: '/_adminScreens/faqs-management', color: '#c026d3' },
      ],
    },
    {
      title: 'Comunicaciones',
      items: [
        { id: 'email-campaigns', label: 'Campañas Email', icon: 'mail-open', route: '/_adminScreens/email-campaigns', color: '#6C1110' },
        { id: 'push-notifications', label: 'Push', icon: 'notifications', route: '/_adminScreens/push-notifications', color: '#ec4899' },
        { id: 'sms-notifications', label: 'SMS', icon: 'chatbubbles', route: '/_adminScreens/sms-notifications', color: '#f43f5e' },
        { id: 'whatsapp', label: 'WhatsApp', icon: 'logo-whatsapp', route: '/_adminScreens/whatsapp-conversations', color: '#25d366' },
        { id: 'notification-templates', label: 'Plantillas', icon: 'mail', route: '/_adminScreens/notification-templates', color: '#f472b6' },
      ],
    },
    {
      title: 'Finanzas y Pagos',
      items: [
        { id: 'payment-methods', label: 'Métodos de Pago', icon: 'card', route: '/_adminScreens/payment-methods', color: '#10b981' },
        { id: 'encrypted-cards', label: 'Tarjetas', icon: 'lock-closed', route: '/_adminScreens/encrypted-cards', color: '#059669' },
        { id: 'stripe-settings', label: 'Stripe', icon: 'card-outline', route: '/_adminScreens/stripe-settings', color: '#635bff' },
        { id: 'refunds', label: 'Reembolsos', icon: 'cash', route: '/_adminScreens/refunds', color: '#ef4444' },
        { id: 'withdrawal-requests', label: 'Retiros', icon: 'wallet', route: '/_adminScreens/withdrawal-requests', color: '#f97316' },
      ],
    },
    {
      title: 'Créditos y Suscripciones',
      items: [
        { id: 'credits-dashboard', label: 'Dashboard', icon: 'diamond', route: '/_adminScreens/credits-dashboard', color: '#8b5cf6' },
        { id: 'credits-packages', label: 'Paquetes', icon: 'cube', route: '/_adminScreens/credits-packages', color: '#7c3aed' },
        { id: 'credits-adjustments', label: 'Ajustes', icon: 'swap-horizontal', route: '/_adminScreens/credits-adjustments', color: '#6d28d9' },
        { id: 'credits-history', label: 'Historial', icon: 'time', route: '/_adminScreens/credits-history', color: '#5b21b6' },
        { id: 'subscriptions', label: 'Suscripciones', icon: 'repeat', route: '/_adminScreens/subscriptions-management', color: '#4c1d95' },
        { id: 'plans', label: 'Planes', icon: 'layers', route: '/_adminScreens/plans', color: '#7e22ce' },
      ],
    },
    {
      title: 'Juegos y Sorteos',
      items: [
        { id: 'lottery', label: 'Lotería', icon: 'ticket', route: '/_adminScreens/lottery-management', color: '#f59e0b' },
        { id: 'raffles', label: 'Rifas', icon: 'gift', route: '/_adminScreens/raffles-management', color: '#eab308' },
        { id: 'bolita', label: 'Bolita', icon: 'dice', route: '/_adminScreens/bolita-management', color: '#fbbf24' },
      ],
    },
    {
      title: 'Reportes y Analíticas',
      items: [
        { id: 'dashboard-charts', label: 'Dashboard Ejecutivo', icon: 'pie-chart', route: '/_adminScreens/dashboard-charts', color: '#10b981' },
        { id: 'global-search', label: 'Búsqueda Global', icon: 'search', route: '/_adminScreens/global-search', color: '#3b82f6' },
        { id: 'email-analytics', label: 'Analíticas Email', icon: 'stats-chart', route: '/_adminScreens/email-analytics', color: '#6C1110' },
        { id: 'analytics', label: 'Analíticas', icon: 'analytics', route: '/_adminScreens/analytics', color: '#06b6d4' },
        { id: 'analytics-dashboard', label: 'Dashboard Básico', icon: 'bar-chart', route: '/_adminScreens/analytics-dashboard', color: '#0891b2' },
        { id: 'feedback', label: 'Feedback', icon: 'star', route: '/_adminScreens/feedback-dashboard', color: '#fbbf24' },
      ],
    },
    {
      title: 'Productos y Referidos',
      items: [
        { id: 'products', label: 'Productos', icon: 'storefront', route: '/_adminScreens/products-management', color: '#10b981' },
        { id: 'referrals', label: 'Referidos', icon: 'people', route: '/_adminScreens/referrals-management', color: '#059669' },
        { id: 'affiliate-links', label: 'Afiliados', icon: 'link', route: '/_adminScreens/affiliate-links', color: '#34d399' },
      ],
    },
    {
      title: 'Integraciones y AI',
      items: [
        { id: 'ai-brain', label: 'AI Brain', icon: 'bulb', route: '/_adminScreens/ai-brain', color: '#8b5cf6' },
        { id: 'ai-prompts', label: 'Prompts IA', icon: 'chatbubble-ellipses', route: '/_adminScreens/ai-prompts', color: '#a855f7' },
        { id: 'rise-crm-sync', label: 'Rise CRM', icon: 'sync', route: '/_adminScreens/rise-crm-sync', color: '#6366f1' },
        { id: 'api-settings', label: 'Config. API', icon: 'code-slash', route: '/_adminScreens/api-settings', color: '#3b82f6' },
      ],
    },
    {
      title: 'Sistema',
      items: [
        { id: 'feature-flags', label: 'Control Juegos', icon: 'lock-closed', route: '/_adminScreens/feature-flags', color: '#ef4444' },
        { id: 'carousel-banners', label: 'Carrusel Home', icon: 'images', route: '/_adminScreens/carousel-banners', color: '#8B5CF6' },
        { id: 'quick-actions', label: 'Acciones Rápidas', icon: 'grid', route: '/_adminScreens/quick-actions', color: '#EC4899' },
        { id: 'users', label: 'Usuarios', icon: 'people-circle', route: '/_adminScreens/users-management', color: '#64748b' },
        { id: 'app-adoption', label: 'Adopción App', icon: 'phone-portrait', route: '/_adminScreens/app-adoption', color: '#475569' },
        { id: 'settings', label: 'Configuración', icon: 'settings', route: '/_adminScreens/settings', color: '#6b7280' },
        { id: 'version', label: 'Versiones', icon: 'git-branch', route: '/_adminScreens/version-management', color: '#334155' },
      ],
    },
  ];

  // Calculate card width for 3 columns
  const cardWidth = (screenWidth - 48 - 16) / 3; // 48 for padding, 16 for gaps

  return (
    <View style={styles.container}>
      <AdminHeader 
        title="Más Opciones" 
        subtitle="Panel de Administración"
        showBackButton={true}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {menuSections.map((section, sectionIndex) => (
          <View key={sectionIndex} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.menuGrid}>
              {section.items.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.menuCard, { width: cardWidth }]}
                  onPress={() => router.push(item.route as any)}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.menuIcon,
                      { backgroundColor: item.color ? `${item.color}15` : '#f3f4f6' },
                    ]}
                  >
                    <Ionicons
                      name={item.icon}
                      size={22}
                      color={item.color || '#6b7280'}
                    />
                  </View>
                  <Text style={styles.menuLabel} numberOfLines={2}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={22} color="#fff" />
          <Text style={styles.logoutText}>Cerrar Sesión</Text>
        </TouchableOpacity>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 12,
    marginLeft: 4,
  },
  menuGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  menuCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
    minHeight: 85,
    justifyContent: 'center',
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  menuLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#374151',
    textAlign: 'center',
    lineHeight: 14,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ef4444',
    borderRadius: 12,
    padding: 14,
    marginTop: 8,
    marginBottom: 16,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  logoutText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  bottomPadding: {
    height: 80,
  },
});

export default AdminMoreScreen;
