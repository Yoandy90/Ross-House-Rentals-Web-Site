/**
 * Admin More/Menu Screen - Dark Theme Premium Design
 * Matches login screen dark aesthetic for consistent UX
 */
import React, { useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: screenWidth } = Dimensions.get('window');

// Dark theme colors matching login screen
const C = {
  bg: '#0F172A',
  card: '#1E293B',
  border: '#334155',
  brand: '#C41E3A',
  brandLight: '#E74C5E',
  accent: '#22D3EE',
  white: '#F1F5F9',
  sub: '#94A3B8',
  muted: '#64748B',
};

interface MenuSection {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  gradient: string[];
  items: MenuItem[];
}

interface MenuItem {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: string;
  color: string;
  badge?: string;
}

const AdminMoreScreen = () => {
  const router = useRouter();
  const { signOut, user } = useAuth();
  const insets = useSafeAreaInsets();
  const isAssistant = user?.role === 'office_assistant' || user?.role === 'assistant';

  const handleLogout = () => {
    Alert.alert(
      'Cerrar Sesión',
      '¿Estás seguro que deseas cerrar sesión?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Salir',
          style: 'destructive',
          onPress: async () => {
            await signOut();
            router.replace('/(auth)/login');
          },
        },
      ]
    );
  };

  const assistantAllowedSections = ['Clientes', 'Calendario'];

  const allMenuSections: MenuSection[] = [
    {
      title: 'Clientes',
      icon: 'people',
      gradient: ['#3B82F6', '#1D4ED8'],
      items: [
        { id: 'create-client', label: 'Crear', icon: 'person-add', route: '/_adminScreens/create-client', color: '#10B981' },
        { id: 'client-details', label: 'Detalles', icon: 'person-circle', route: '/(admin)/clients', color: '#3B82F6' },
        { id: 'clients-modern', label: 'Vista Pro', icon: 'people-circle', route: '/_adminScreens/clients-modern', color: '#6366F1' },
      ],
    },
    {
      title: 'Calendario',
      icon: 'calendar',
      gradient: ['#8B5CF6', '#6D28D9'],
      items: [
        { id: 'appointments', label: 'Citas', icon: 'calendar', route: '/_adminScreens/appointments', color: '#8B5CF6' },
        { id: 'schedule', label: 'Agendar', icon: 'add-circle', route: '/_adminScreens/schedule-appointment', color: '#A855F7' },
        { id: 'calendar-view', label: 'Calendario', icon: 'calendar-number', route: '/_adminScreens/appointments-calendar', color: '#9333EA' },
        { id: 'calendar-manage', label: 'Gestión', icon: 'settings-outline', route: '/(admin)/calendario', color: '#DC2626', badge: 'NEW' },
        { id: 'hours', label: 'Horarios', icon: 'time', route: '/_adminScreens/office-hours', color: '#7C3AED' },
      ],
    },
    {
      title: 'Servicios',
      icon: 'briefcase',
      gradient: ['#C41E3A', '#8B1A19'],
      items: [
        { id: 'declaraciones', label: 'Declaraciones', icon: 'document-text', route: '/(admin)/declaraciones', color: '#10B981', badge: 'NEW' },
        { id: 'motions', label: 'Mociones', icon: 'documents', route: '/(admin)/motions', color: '#6366F1', badge: 'NEW' },
        { id: 'marketing', label: 'Marketing', icon: 'megaphone', route: '/(admin)/marketing', color: '#F59E0B', badge: 'NEW' },
        { id: 'new-order', label: 'Nueva Orden', icon: 'add-circle', route: '/_adminScreens/create-service', color: '#3B82F6' },
        { id: 'prices', label: 'Precios', icon: 'pricetag', route: '/_adminScreens/service-prices', color: '#0EA5E9' },
        { id: 'estimates', label: 'Estimados', icon: 'calculator', route: '/_adminScreens/tax-estimates', color: '#06B6D4' },
        { id: 'upload', label: 'Subir', icon: 'cloud-upload', route: '/_adminScreens/upload-return', color: '#14B8A6' },
      ],
    },
    {
      title: 'Documentos',
      icon: 'folder',
      gradient: ['#F59E0B', '#D97706'],
      items: [
        { id: 'docs', label: 'Archivos', icon: 'folder', route: '/_adminScreens/documents-management', color: '#F59E0B' },
        { id: 'receipts', label: 'Recibos', icon: 'receipt', route: '/_adminScreens/receipts-management', color: '#10B981' },
        { id: 'dashboard', label: 'Dashboard', icon: 'bar-chart', route: '/_adminScreens/receipts-dashboard', color: '#8B5CF6' },
        { id: 'legal', label: 'Legales', icon: 'document', route: '/_adminScreens/legal-management', color: '#D97706' },
        { id: 'edu', label: 'Educación', icon: 'school', route: '/_adminScreens/education-management', color: '#EA580C' },
        { id: 'news', label: 'Noticias', icon: 'newspaper', route: '/_adminScreens/news-management', color: '#DC2626' },
        { id: 'faqs', label: 'FAQs', icon: 'help-circle', route: '/_adminScreens/faqs-management', color: '#C026D3' },
      ],
    },
    {
      title: 'Comunicaciones',
      icon: 'chatbubbles',
      gradient: ['#25D366', '#128C7E'],
      items: [
        { id: 'leads', label: 'Leads', icon: 'people-circle', route: '/(admin)/leads', color: '#22C55E', badge: 'NEW' },
        { id: 'jobs', label: 'Trabajos', icon: 'briefcase', route: '/(admin)/job-applications', color: '#F59E0B' },
        { id: 'email', label: 'Email', icon: 'mail-open', route: '/_adminScreens/email-campaigns', color: '#C41E3A' },
        { id: 'push', label: 'Push', icon: 'notifications', route: '/_adminScreens/push-notifications', color: '#EC4899' },
        { id: 'sms', label: 'SMS', icon: 'chatbubbles', route: '/_adminScreens/sms-notifications', color: '#F43F5E' },
        { id: 'whatsapp', label: 'WhatsApp', icon: 'logo-whatsapp', route: '/(admin)/whatsapp-conversations', color: '#25D366' },
        { id: 'wa-config', label: 'WA Config', icon: 'settings', route: '/(admin)/whatsapp-settings', color: '#128C7E' },
        { id: 'wa-auto', label: 'WA Auto', icon: 'flash', route: '/(admin)/whatsapp-automation', color: '#075E54' },
        { id: 'templates', label: 'Plantillas', icon: 'mail', route: '/_adminScreens/notification-templates', color: '#F472B6' },
      ],
    },
    {
      title: 'Finanzas',
      icon: 'card',
      gradient: ['#10B981', '#059669'],
      items: [
        { id: 'baul', label: 'Baúl Seguro', icon: 'shield-checkmark', route: '/(admin)/baul-seguro', color: '#22D3EE', badge: 'NEW' },
        { id: 'gastos', label: 'Gastos', icon: 'receipt-outline', route: '/(admin)/gastos-clientes', color: '#C41E3A', badge: 'NEW' },
        { id: 'payment', label: 'Pagos', icon: 'card', route: '/_adminScreens/payment-methods', color: '#10B981' },
        { id: 'cards', label: 'Tarjetas', icon: 'lock-closed', route: '/_adminScreens/encrypted-cards', color: '#059669' },
        { id: 'stripe', label: 'Stripe', icon: 'card-outline', route: '/_adminScreens/stripe-settings', color: '#635BFF' },
        { id: 'refunds', label: 'Reembolsos', icon: 'cash', route: '/_adminScreens/refunds', color: '#EF4444' },
        { id: 'withdraw', label: 'Retiros', icon: 'wallet', route: '/_adminScreens/withdrawal-requests', color: '#F97316' },
      ],
    },
    {
      title: 'Créditos',
      icon: 'diamond',
      gradient: ['#8B5CF6', '#7C3AED'],
      items: [
        { id: 'c-dash', label: 'Dashboard', icon: 'diamond', route: '/_adminScreens/credits-dashboard', color: '#8B5CF6' },
        { id: 'packages', label: 'Paquetes', icon: 'cube', route: '/_adminScreens/credits-packages', color: '#7C3AED' },
        { id: 'adjust', label: 'Ajustes', icon: 'swap-horizontal', route: '/_adminScreens/credits-adjustments', color: '#6D28D9' },
        { id: 'history', label: 'Historial', icon: 'time', route: '/_adminScreens/credits-history', color: '#5B21B6' },
        { id: 'subs', label: 'Suscripciones', icon: 'repeat', route: '/_adminScreens/subscriptions-management', color: '#4C1D95' },
        { id: 'plans', label: 'Planes', icon: 'layers', route: '/_adminScreens/plans', color: '#7E22CE' },
      ],
    },
    {
      title: 'Juegos',
      icon: 'game-controller',
      gradient: ['#F59E0B', '#EAB308'],
      items: [
        { id: 'lottery', label: 'Lotería', icon: 'ticket', route: '/_adminScreens/lottery-management', color: '#F59E0B' },
        { id: 'raffles', label: 'Rifas', icon: 'gift', route: '/_adminScreens/raffles-management', color: '#EAB308' },
        { id: 'bolita', label: 'Bolita', icon: 'dice', route: '/_adminScreens/bolita-management', color: '#FBBF24' },
      ],
    },
    {
      title: 'Reportes',
      icon: 'analytics',
      gradient: ['#3B82F6', '#2563EB'],
      items: [
        { id: 'analytics', label: 'Analytics', icon: 'analytics', route: '/(admin)/analytics', color: '#C41E3A' },
        { id: 'exec', label: 'Ejecutivo', icon: 'pie-chart', route: '/_adminScreens/analytics-dashboard', color: '#10B981' },
        { id: 'search', label: 'Búsqueda', icon: 'search', route: '/_adminScreens/global-search', color: '#3B82F6' },
        { id: 'email-stats', label: 'Email Stats', icon: 'stats-chart', route: '/_adminScreens/email-analytics', color: '#C41E3A' },
        { id: 'feedback', label: 'Feedback', icon: 'star', route: '/_adminScreens/feedback-dashboard', color: '#FBBF24' },
        { id: 'reviews', label: 'Reseñas', icon: 'star', route: '/(admin)/reviews', color: '#F59E0B', badge: 'NEW' },
      ],
    },
    {
      title: 'Productos',
      icon: 'storefront',
      gradient: ['#10B981', '#34D399'],
      items: [
        { id: 'products', label: 'Productos', icon: 'storefront', route: '/_adminScreens/products-management', color: '#10B981' },
        { id: 'referrals', label: 'Referidos', icon: 'people', route: '/_adminScreens/referrals-management', color: '#059669' },
        { id: 'affiliate', label: 'Afiliados', icon: 'link', route: '/_adminScreens/affiliate-links', color: '#34D399' },
      ],
    },
    {
      title: 'AI & APIs',
      icon: 'bulb',
      gradient: ['#A855F7', '#9333EA'],
      items: [
        { id: 'ai-brain', label: 'AI Brain', icon: 'bulb', route: '/_adminScreens/ai-brain', color: '#8B5CF6' },
        { id: 'prompts', label: 'Prompts', icon: 'chatbubble-ellipses', route: '/_adminScreens/ai-prompts', color: '#A855F7' },
        { id: 'crm', label: 'Rise CRM', icon: 'sync', route: '/_adminScreens/rise-crm-sync', color: '#6366F1' },
        { id: 'api', label: 'APIs', icon: 'code-slash', route: '/_adminScreens/api-settings', color: '#3B82F6' },
      ],
    },
    {
      title: 'Sistema',
      icon: 'settings',
      gradient: ['#64748B', '#475569'],
      items: [
        { id: 'flags', label: 'Features', icon: 'flag', route: '/_adminScreens/feature-flags', color: '#EF4444' },
        { id: 'carousel', label: 'Carrusel', icon: 'images', route: '/_adminScreens/carousel-banners', color: '#8B5CF6' },
        { id: 'actions', label: 'Acciones', icon: 'grid', route: '/_adminScreens/quick-actions', color: '#EC4899' },
        { id: 'users', label: 'Usuarios', icon: 'people-circle', route: '/_adminScreens/users-management', color: '#64748B' },
        { id: 'adoption', label: 'Adopción', icon: 'phone-portrait', route: '/_adminScreens/app-adoption', color: '#475569' },
        { id: 'settings', label: 'Config', icon: 'settings', route: '/_adminScreens/settings', color: '#6B7280' },
        { id: 'version', label: 'Versiones', icon: 'git-branch', route: '/_adminScreens/version-management', color: '#334155' },
      ],
    },
  ];

  const menuSections = isAssistant 
    ? allMenuSections.filter(s => assistantAllowedSections.includes(s.title))
    : allMenuSections;

  const cardWidth = (screenWidth - 40 - 24) / 4;

  const renderMenuItem = (item: MenuItem) => (
    <TouchableOpacity
      key={item.id}
      style={[styles.menuCard, { width: cardWidth }]}
      onPress={() => router.push(item.route as any)}
      activeOpacity={0.7}
    >
      <View style={styles.menuCardInner}>
        <View style={[styles.menuIconContainer, { backgroundColor: item.color }]}>
          <Ionicons name={item.icon} size={18} color="#FFF" />
        </View>
        <Text style={styles.menuLabel} numberOfLines={1}>
          {item.label}
        </Text>
        {item.badge && (
          <View style={styles.itemBadge}>
            <Text style={styles.itemBadgeText}>{item.badge}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  const renderSection = (section: MenuSection, index: number) => (
    <View key={index} style={styles.section}>
      <View style={styles.sectionHeader}>
        <LinearGradient
          colors={section.gradient}
          style={styles.sectionIconBg}
        >
          <Ionicons name={section.icon} size={16} color="#FFF" />
        </LinearGradient>
        <Text style={styles.sectionTitle}>{section.title}</Text>
        <View style={styles.sectionLine} />
      </View>
      <View style={styles.menuGrid}>
        {section.items.map(renderMenuItem)}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Dark Premium Header */}
      <LinearGradient
        colors={['#1a0a0a', '#2d1215', '#1a0a0a']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 12 }]}
      >
        {/* Decorative circles */}
        <View style={styles.headerDecoration}>
          <View style={[styles.decorCircle, styles.decorCircle1]} />
          <View style={[styles.decorCircle, styles.decorCircle2]} />
        </View>

        <View style={styles.headerContent}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="chevron-back" size={24} color="#FFF" />
          </TouchableOpacity>
          
          <View style={styles.headerCenter}>
            <View style={styles.logoContainer}>
              <Ionicons name="grid" size={20} color="#FFF" />
            </View>
            <View>
              <Text style={styles.headerTitle}>Panel Admin</Text>
              <Text style={styles.headerSubtitle}>
                {user?.name || 'Administrador'}
              </Text>
            </View>
          </View>
          
          <TouchableOpacity 
            style={styles.logoutIconButton}
            onPress={handleLogout}
          >
            <Ionicons name="log-out-outline" size={22} color="#FFF" />
          </TouchableOpacity>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>12</Text>
            <Text style={styles.statLabel}>Secciones</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>70+</Text>
            <Text style={styles.statLabel}>Funciones</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>v1.0</Text>
            <Text style={styles.statLabel}>Versión</Text>
          </View>
        </View>
      </LinearGradient>

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {menuSections.map(renderSection)}

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <LinearGradient
            colors={['#EF4444', '#DC2626']}
            style={styles.logoutGradient}
          >
            <Ionicons name="log-out-outline" size={22} color="#FFF" />
            <Text style={styles.logoutText}>Cerrar Sesión</Text>
          </LinearGradient>
        </TouchableOpacity>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
  },
  // Header Styles
  header: {
    paddingBottom: 20,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    position: 'relative',
    overflow: 'hidden',
  },
  headerDecoration: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  decorCircle: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: 'rgba(196, 30, 58, 0.1)',
  },
  decorCircle1: {
    width: 180,
    height: 180,
    top: -60,
    right: -40,
  },
  decorCircle2: {
    width: 120,
    height: 120,
    bottom: -30,
    left: -20,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    zIndex: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  logoContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(196, 30, 58, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(196, 30, 58, 0.4)',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFF',
  },
  headerSubtitle: {
    fontSize: 12,
    color: C.sub,
  },
  logoutIconButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  // Stats Row
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    paddingHorizontal: 32,
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    borderRadius: 14,
    marginHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFF',
  },
  statLabel: {
    fontSize: 11,
    color: C.sub,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: C.border,
  },
  // Content Styles
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingTop: 20,
  },
  // Section Styles
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  sectionIconBg: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: C.white,
    letterSpacing: -0.3,
  },
  sectionLine: {
    flex: 1,
    height: 1,
    backgroundColor: C.border,
    marginLeft: 12,
  },
  // Menu Grid
  menuGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  menuCard: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  menuCardInner: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 80,
  },
  menuIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  menuLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: C.sub,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  itemBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: C.brand,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 6,
  },
  itemBadgeText: {
    fontSize: 7,
    fontWeight: '700',
    color: '#FFF',
  },
  // Logout Button
  logoutButton: {
    marginTop: 8,
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
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
    fontWeight: '700',
    color: '#FFF',
  },
  bottomPadding: {
    height: 100,
  },
});

export default AdminMoreScreen;
