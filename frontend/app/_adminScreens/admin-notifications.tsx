/**
 * Admin Notifications Screen - Ultra Modern Premium Design
 * Admin dashboard for notifications and alerts
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../../services/api';

const { width } = Dimensions.get('window');

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  data?: any;
  is_read: boolean;
  created_at: string;
  priority?: string;
}

interface Stats {
  pending_invoices: number;
  pending_appointments: number;
  pending_documents: number;
  unread_messages: number;
}

export default function AdminNotificationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<Stats>({
    pending_invoices: 0,
    pending_appointments: 0,
    pending_documents: 0,
    unread_messages: 0,
  });
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadData();
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, []);

  const loadData = async () => {
    try {
      let pendingInvoices = 0;
      let todayAppointments = 0;
      let unreadChats = 0;
      let pendingDocs = 0;
      
      // Load analytics data
      try {
        const chartsResponse = await api.get('/admin/analytics/charts');
        if (chartsResponse.data) {
          pendingInvoices = Number(chartsResponse.data.invoices?.pending_count) || 0;
          todayAppointments = Number(chartsResponse.data.today_appointments) || 0;
        }
      } catch (e) {
        console.log('Charts endpoint not available');
      }

      // Get unread messages count
      try {
        const chatsResponse = await api.get('/admin/chats');
        if (chatsResponse.data && Array.isArray(chatsResponse.data)) {
          unreadChats = chatsResponse.data.filter((c: any) => c.unread_count > 0).length;
        }
      } catch (e) {
        console.log('Chats endpoint not available');
      }

      // Get pending invoices
      let invoicesList: any[] = [];
      try {
        const invoicesResponse = await api.get('/admin/invoices?status=pending');
        invoicesList = invoicesResponse.data || [];
        pendingInvoices = invoicesList.length;
      } catch (e) {
        console.log('Invoices endpoint not available');
      }

      // Get pending documents
      try {
        const docsResponse = await api.get('/admin/documents?status=pending_review');
        if (docsResponse.data && Array.isArray(docsResponse.data)) {
          pendingDocs = docsResponse.data.length;
        }
      } catch (e) {
        console.log('Documents endpoint not available');
      }

      // Ensure all values are valid numbers
      setStats({
        pending_invoices: isNaN(pendingInvoices) ? 0 : pendingInvoices,
        pending_appointments: isNaN(todayAppointments) ? 0 : todayAppointments,
        pending_documents: isNaN(pendingDocs) ? 0 : pendingDocs,
        unread_messages: isNaN(unreadChats) ? 0 : unreadChats,
      });

      // Create notifications from real data
      const realNotifications: Notification[] = [];
      
      // Add each pending invoice
      invoicesList.forEach((invoice: any, index: number) => {
        realNotifications.push({
          id: `inv-${invoice.id || invoice._id || index}`,
          type: 'invoice',
          title: `Factura ${invoice.invoice_number || '#' + (index + 1)}`,
          message: `$${(invoice.total || 0).toFixed(2)} - ${invoice.user_name || invoice.service_name || 'Cliente'}`,
          data: invoice,
          is_read: false,
          created_at: invoice.created_at || new Date().toISOString(),
          priority: invoice.status === 'overdue' ? 'high' : 'medium',
        });
      });

      // Add appointment notification
      if (todayAppointments > 0) {
        realNotifications.unshift({
          id: 'apt-today',
          type: 'appointment',
          title: 'Citas de Hoy',
          message: `Tienes ${todayAppointments} cita(s) programada(s) para hoy`,
          is_read: false,
          created_at: new Date().toISOString(),
          priority: 'high',
        });
      }

      // Add unread messages notification
      if (unreadChats > 0) {
        realNotifications.unshift({
          id: 'msg-unread',
          type: 'message',
          title: 'Mensajes sin Leer',
          message: `Tienes ${unreadChats} conversación(es) con mensajes nuevos`,
          is_read: false,
          created_at: new Date().toISOString(),
          priority: 'high',
        });
      }

      setNotifications(realNotifications);
    } catch (error: any) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, []);

  const getTypeConfig = (type: string) => {
    switch (type) {
      case 'invoice':
        return { icon: 'receipt', color: '#F59E0B', bg: '#FEF3C7', gradient: ['#F59E0B', '#D97706'] };
      case 'appointment':
        return { icon: 'calendar', color: '#3B82F6', bg: '#DBEAFE', gradient: ['#3B82F6', '#2563EB'] };
      case 'document':
        return { icon: 'document-text', color: '#8B5CF6', bg: '#EDE9FE', gradient: ['#8B5CF6', '#7C3AED'] };
      case 'message':
        return { icon: 'chatbubble', color: '#10B981', bg: '#D1FAE5', gradient: ['#10B981', '#059669'] };
      case 'payment':
        return { icon: 'card', color: '#10B981', bg: '#D1FAE5', gradient: ['#10B981', '#059669'] };
      case 'client':
        return { icon: 'person', color: '#6366F1', bg: '#E0E7FF', gradient: ['#6366F1', '#4F46E5'] };
      default:
        return { icon: 'notifications', color: '#6B7280', bg: '#F3F4F6', gradient: ['#6B7280', '#4B5563'] };
    }
  };

  const handleNotificationPress = (notification: Notification) => {
    switch (notification.type) {
      case 'invoice':
        router.push('/(admin)/invoices');
        break;
      case 'appointment':
        router.push('/_adminScreens/appointments');
        break;
      case 'document':
        router.push('/_adminScreens/document-review');
        break;
      case 'message':
        router.push('/(admin)/chat');
        break;
      default:
        Alert.alert(notification.title, notification.message);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 60) return `Hace ${minutes} min`;
    if (hours < 24) return `Hace ${hours}h`;
    if (days < 7) return `Hace ${days}d`;
    return date.toLocaleDateString('es-ES', { month: 'short', day: 'numeric' });
  };

  const getFilteredNotifications = () => {
    if (!activeFilter) return notifications;
    return notifications.filter(n => n.type === activeFilter);
  };

  // Safe calculation of total pending
  const totalPending = (
    (stats.pending_invoices || 0) + 
    (stats.pending_appointments || 0) + 
    (stats.pending_documents || 0) + 
    (stats.unread_messages || 0)
  );

  const categories = [
    { id: 'invoice', label: 'Facturas', icon: 'receipt', color: '#F59E0B', count: stats.pending_invoices || 0 },
    { id: 'appointment', label: 'Citas', icon: 'calendar', color: '#3B82F6', count: stats.pending_appointments || 0 },
    { id: 'document', label: 'Docs', icon: 'document-text', color: '#8B5CF6', count: stats.pending_documents || 0 },
    { id: 'message', label: 'Mensajes', icon: 'chatbubble', color: '#10B981', count: stats.unread_messages || 0 },
  ];

  const filteredNotifications = getFilteredNotifications();

  const renderNotification = ({ item, index }: { item: Notification; index: number }) => {
    const typeConfig = getTypeConfig(item.type);

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
          style={[styles.notificationCard, !item.is_read && styles.unreadCard]}
          onPress={() => handleNotificationPress(item)}
          activeOpacity={0.8}
        >
          {/* Priority Indicator */}
          {item.priority === 'high' && (
            <View style={styles.priorityStrip}>
              <LinearGradient colors={['#EF4444', '#DC2626']} style={styles.priorityGradient} />
            </View>
          )}

          <View style={styles.notificationContent}>
            <View style={styles.notificationHeader}>
              <LinearGradient colors={typeConfig.gradient} style={styles.iconContainer}>
                <Ionicons name={typeConfig.icon as any} size={20} color="#FFF" />
              </LinearGradient>
              
              <View style={styles.titleSection}>
                <View style={styles.titleRow}>
                  <Text style={styles.notificationTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  {item.priority === 'high' && (
                    <View style={styles.urgentBadge}>
                      <Text style={styles.urgentText}>Urgente</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.notificationTime}>{formatDate(item.created_at)}</Text>
              </View>
              
              <Ionicons name="chevron-forward" size={18} color="#D1D5DB" />
            </View>

            <Text style={styles.notificationMessage} numberOfLines={2}>
              {item.message}
            </Text>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <LinearGradient colors={['#6C1110', '#3B82F6']} style={styles.loadingGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <ActivityIndicator size="large" color="#FFF" />
          <Text style={styles.loadingText}>Cargando notificaciones...</Text>
        </LinearGradient>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Premium Header */}
      <LinearGradient
        colors={['#6C1110', '#8B1A19', '#3B82F6']}
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
            <Text style={styles.headerTitle}>Notificaciones</Text>
            <Text style={styles.headerSubtitle}>
              {totalPending > 0 ? `${totalPending} pendientes` : 'Todo al día'}
            </Text>
          </View>
          
          <TouchableOpacity style={styles.markAllButton}>
            <Ionicons name="checkmark-done" size={20} color="#FFF" />
          </TouchableOpacity>
        </View>

        {/* Category Cards */}
        <View style={styles.categoriesContainer}>
          {categories.map((category) => (
            <TouchableOpacity
              key={category.id}
              style={[
                styles.categoryCard,
                activeFilter === category.id && styles.categoryCardActive
              ]}
              onPress={() => setActiveFilter(activeFilter === category.id ? null : category.id)}
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
        renderItem={renderNotification}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6C1110" />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <LinearGradient colors={['#FEE2E2', '#FECACA']} style={styles.emptyIconBg}>
                <Ionicons name="notifications-off-outline" size={56} color="#6C1110" />
              </LinearGradient>
            </View>
            <Text style={styles.emptyTitle}>Sin notificaciones</Text>
            <Text style={styles.emptyText}>
              No tienes notificaciones pendientes
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
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
    backgroundColor: '#FFF', 
    borderRadius: 18, 
    overflow: 'hidden',
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 3 }, 
    shadowOpacity: 0.08, 
    shadowRadius: 8, 
    elevation: 3,
  },
  unreadCard: { backgroundColor: '#FFFBEB' },
  priorityStrip: { position: 'absolute', top: 0, left: 0, right: 0, height: 3 },
  priorityGradient: { flex: 1 },
  
  notificationContent: { padding: 16 },
  notificationHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  iconContainer: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  titleSection: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  notificationTitle: { fontSize: 15, fontWeight: '700', color: '#1F2937', flex: 1 },
  urgentBadge: { backgroundColor: '#FEE2E2', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  urgentText: { fontSize: 10, fontWeight: '700', color: '#EF4444' },
  notificationTime: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  
  notificationMessage: { fontSize: 14, color: '#6B7280', lineHeight: 20, paddingLeft: 56 },
  
  // Empty State
  emptyState: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 30 },
  emptyIconContainer: { marginBottom: 20 },
  emptyIconBg: { width: 120, height: 120, borderRadius: 40, justifyContent: 'center', alignItems: 'center' },
  emptyTitle: { fontSize: 22, fontWeight: '700', color: '#1F2937', marginBottom: 8 },
  emptyText: { fontSize: 15, color: '#6B7280', textAlign: 'center', lineHeight: 22 },
});
