/**
 * Notifications Screen - Ultra Modern Premium Design with Dark Mode
 * Displays all user notifications with category filtering
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Animated,
  Dimensions,
  FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import api from '../../services/api';
import { format } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';
import { useThemeColors } from '../../constants/colors';

const { width } = Dimensions.get('window');

interface Notification {
  id: string;
  title: string;
  body: string;
  type: string;
  read: boolean;
  created_at: string;
  data?: any;
}

type CategoryType = 'all' | 'invoices' | 'appointments' | 'documents' | 'messages';

export default function NotificationsScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const dateLocale = i18n.language === 'es' ? es : enUS;
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<CategoryType>('all');
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadNotifications();
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, []);

  const loadNotifications = async () => {
    try {
      const response = await api.get('/notifications');
      const sortedNotifications = response.data.sort((a: Notification, b: Notification) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setNotifications(sortedNotifications);
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadNotifications();
  }, []);

  const markAsRead = async (notificationId: string) => {
    try {
      await api.post(`/notifications/${notificationId}/read`);
      setNotifications(notifications.map(n => 
        n.id === notificationId ? { ...n, read: true } : n
      ));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.post('/notifications/read-all');
      setNotifications(notifications.map(n => ({ ...n, read: true })));
      Alert.alert('✅ Listo', 'Todas las notificaciones marcadas como leídas');
    } catch (error) {
      console.error('Error marking all as read:', error);
      Alert.alert('Error', 'No se pudieron marcar las notificaciones');
    }
  };

  const getCategoryFromType = (type: string): CategoryType => {
    if (type.includes('invoice') || type.includes('payment') || type.includes('credit')) return 'invoices';
    if (type.includes('appointment') || type.includes('cita') || type.includes('calendar')) return 'appointments';
    if (type.includes('document') || type.includes('tax') || type.includes('doc')) return 'documents';
    if (type.includes('chat') || type.includes('message')) return 'messages';
    return 'all';
  };

  const getFilteredNotifications = () => {
    if (activeCategory === 'all') return notifications;
    return notifications.filter(n => getCategoryFromType(n.type) === activeCategory);
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'appointments': return 'calendar';
      case 'documents': return 'folder';
      case 'tax_returns': return 'document-text';
      case 'chat': return 'chatbubbles';
      case 'credit_purchase': return 'cart';
      case 'credit_bonus': return 'gift';
      case 'credit_usage': return 'card';
      case 'credit_low_balance': return 'warning';
      case 'credit_refund': return 'arrow-undo';
      case 'credit_pending_payment': return 'time';
      case 'credit_payment_failed': return 'close-circle';
      default: return 'notifications';
    }
  };

  const getIconConfig = (type: string) => {
    const category = getCategoryFromType(type);
    switch (category) {
      case 'invoices':
        return { color: colors.warning, bg: colors.warningLight, gradient: ['#F59E0B', '#D97706'] as [string, string] };
      case 'appointments':
        return { color: colors.info, bg: colors.infoLight, gradient: ['#3B82F6', '#2563EB'] as [string, string] };
      case 'documents':
        return { color: colors.purple, bg: colors.purpleLight, gradient: ['#8B5CF6', '#7C3AED'] as [string, string] };
      case 'messages':
        return { color: colors.success, bg: colors.successLight, gradient: ['#10B981', '#059669'] as [string, string] };
      default:
        return { color: colors.primary, bg: colors.successLight, gradient: ['#059669', '#047857'] as [string, string] };
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;
  
  // Calculate category counts
  const categoryCounts = {
    invoices: notifications.filter(n => getCategoryFromType(n.type) === 'invoices').length,
    appointments: notifications.filter(n => getCategoryFromType(n.type) === 'appointments').length,
    documents: notifications.filter(n => getCategoryFromType(n.type) === 'documents').length,
    messages: notifications.filter(n => getCategoryFromType(n.type) === 'messages').length,
  };

  const categories = [
    { id: 'invoices' as CategoryType, label: 'Facturas', icon: 'receipt', color: colors.warning, count: categoryCounts.invoices },
    { id: 'appointments' as CategoryType, label: 'Citas', icon: 'calendar', color: colors.info, count: categoryCounts.appointments },
    { id: 'documents' as CategoryType, label: 'Docs', icon: 'document-text', color: colors.purple, count: categoryCounts.documents },
    { id: 'messages' as CategoryType, label: 'Mensajes', icon: 'chatbubble', color: colors.success, count: categoryCounts.messages },
  ];

  const filteredNotifications = getFilteredNotifications();

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <LinearGradient colors={['#064E3B', '#059669']} style={styles.loadingGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <Ionicons name="notifications" size={48} color="#FFF" />
          <Text style={styles.loadingText}>{t('notifications.loading', 'Cargando notificaciones...')}</Text>
        </LinearGradient>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Premium Header */}
      <LinearGradient
        colors={['#064E3B', '#059669', '#10B981']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 8 }]}
      >
        <View style={styles.headerDecoration}>
          <View style={[styles.decorCircle, styles.decorCircle1]} />
          <View style={[styles.decorCircle, styles.decorCircle2]} />
        </View>

        {/* Header Top */}
        <View style={styles.headerTop}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={24} color="#FFF" />
          </TouchableOpacity>
          
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>{t('notifications.title')}</Text>
            <Text style={styles.headerSubtitle}>
              {unreadCount > 0 ? `${unreadCount} ${t('notifications.pending')}` : t('notifications.allCaughtUp')}
            </Text>
          </View>
          
          {unreadCount > 0 ? (
            <TouchableOpacity style={styles.markAllButton} onPress={markAllAsRead}>
              <Ionicons name="checkmark-done" size={20} color="#FFF" />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 40 }} />
          )}
        </View>

        {/* Category Cards */}
        <View style={styles.categoriesContainer}>
          {categories.map((category) => (
            <TouchableOpacity
              key={category.id}
              style={[
                styles.categoryCard,
                activeCategory === category.id && styles.categoryCardActive
              ]}
              onPress={() => setActiveCategory(activeCategory === category.id ? 'all' : category.id)}
              activeOpacity={0.7}
            >
              <View style={[styles.categoryIconBg, { backgroundColor: `${category.color}30` }]}>
                <Ionicons name={category.icon as any} size={18} color={category.color} />
              </View>
              <Text style={styles.categoryCount}>{category.count}</Text>
              <Text style={styles.categoryLabel}>{category.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </LinearGradient>

      {/* Notifications List */}
      <FlatList
        data={filteredNotifications}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        renderItem={({ item, index }) => {
          const iconConfig = getIconConfig(item.type);
          
          return (
            <Animated.View
              style={[
                styles.notificationWrapper,
                {
                  opacity: fadeAnim,
                  transform: [{
                    translateY: fadeAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [20, 0],
                    }),
                  }],
                },
              ]}
            >
              <TouchableOpacity
                style={[
                  styles.notificationCard,
                  !item.read && styles.notificationUnread
                ]}
                onPress={() => !item.read && markAsRead(item.id)}
                activeOpacity={0.8}
              >
                {/* Unread Indicator */}
                {!item.read && (
                  <View style={styles.unreadStrip}>
                    <LinearGradient colors={iconConfig.gradient} style={styles.unreadGradient} />
                  </View>
                )}

                <View style={styles.notificationContent}>
                  <View style={styles.notificationHeader}>
                    <LinearGradient colors={iconConfig.gradient} style={styles.notificationIconBg}>
                      <Ionicons name={getIcon(item.type) as any} size={20} color="#FFF" />
                    </LinearGradient>
                    
                    <View style={styles.notificationTitleSection}>
                      <Text style={styles.notificationTitle} numberOfLines={1}>
                        {item.title}
                      </Text>
                      <Text style={styles.notificationTime}>
                        {format(new Date(item.created_at), "d MMM, HH:mm", { locale: dateLocale })}
                      </Text>
                    </View>
                    
                    {!item.read && (
                      <View style={[styles.unreadBadge, { backgroundColor: iconConfig.color }]}>
                        <Text style={styles.unreadBadgeText}>{t('notifications.new', 'Nuevo')}</Text>
                      </View>
                    )}
                  </View>

                  <Text style={styles.notificationBody} numberOfLines={2}>
                    {item.body}
                  </Text>
                </View>
              </TouchableOpacity>
            </Animated.View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <LinearGradient colors={[colors.successLight, colors.successLight]} style={styles.emptyIconBg}>
                <Ionicons name="notifications-off-outline" size={56} color={colors.primary} />
              </LinearGradient>
            </View>
            <Text style={styles.emptyTitle}>{t('notifications.noNotifications')}</Text>
            <Text style={styles.emptyText}>
              {t('notifications.noPendingNotifications', 'No tienes notificaciones pendientes')}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingContainer: { flex: 1 },
  loadingGradient: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 16, fontSize: 16, color: '#FFF', fontWeight: '500' },
  
  // Header
  header: { paddingBottom: 16, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, overflow: 'hidden' },
  headerDecoration: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  decorCircle: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.08)' },
  decorCircle1: { width: 200, height: 200, top: -80, right: -50 },
  decorCircle2: { width: 150, height: 150, bottom: -40, left: -30 },
  
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 16, zIndex: 1 },
  backButton: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#FFF', letterSpacing: -0.5 },
  headerSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  markAllButton: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  
  // Categories
  categoriesContainer: { flexDirection: 'row', paddingHorizontal: 12, gap: 8 },
  categoryCard: { 
    flex: 1, 
    backgroundColor: 'rgba(255,255,255,0.15)', 
    borderRadius: 16, 
    padding: 12, 
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  categoryCardActive: { backgroundColor: 'rgba(255,255,255,0.25)', borderColor: 'rgba(255,255,255,0.4)' },
  categoryIconBg: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
  categoryCount: { fontSize: 18, fontWeight: '800', color: '#FFF' },
  categoryLabel: { fontSize: 10, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  
  // List
  listContent: { padding: 16, paddingBottom: 100 },
  
  // Notification Card
  notificationWrapper: { marginBottom: 12 },
  notificationCard: { 
    backgroundColor: colors.cardBackground, 
    borderRadius: 18, 
    overflow: 'hidden',
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 3 }, 
    shadowOpacity: 0.08, 
    shadowRadius: 8, 
    elevation: 3,
    borderWidth: 1,
    borderColor: colors.border,
  },
  notificationUnread: { backgroundColor: colors.warningLight },
  unreadStrip: { position: 'absolute', top: 0, left: 0, bottom: 0, width: 4 },
  unreadGradient: { flex: 1 },
  
  notificationContent: { padding: 16 },
  notificationHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  notificationIconBg: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  notificationTitleSection: { flex: 1 },
  notificationTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  notificationTime: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  unreadBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  unreadBadgeText: { fontSize: 10, fontWeight: '700', color: '#FFF' },
  
  notificationBody: { fontSize: 14, color: colors.textSecondary, lineHeight: 20, paddingLeft: 56 },
  
  // Empty State
  emptyState: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 30 },
  emptyIconContainer: { marginBottom: 20 },
  emptyIconBg: { width: 120, height: 120, borderRadius: 40, justifyContent: 'center', alignItems: 'center' },
  emptyTitle: { fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: 8 },
  emptyText: { fontSize: 15, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },
});
