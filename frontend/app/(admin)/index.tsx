/**
 * Admin Dashboard - Dark Theme Premium Design
 * Matches login screen dark aesthetic for consistent UX
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Dimensions,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

const { width } = Dimensions.get('window');

// Dark theme colors matching login screen
const C = {
  bg: '#0F172A',
  card: '#1E293B',
  cardAlt: '#162032',
  border: '#334155',
  brand: '#C41E3A',
  brandLight: '#E74C5E',
  accent: '#22D3EE',
  white: '#F1F5F9',
  sub: '#94A3B8',
  muted: '#64748B',
  input: '#1E293B',
  success: '#10B981',
  warning: '#F59E0B',
  info: '#3B82F6',
  purple: '#8B5CF6',
};

interface Message {
  id: string;
  client_name: string;
  message: string;
  time: string;
  unread: boolean;
  avatar?: string;
}

interface Appointment {
  id: string;
  client_name: string;
  time: string;
  service: string;
  status: 'pending' | 'completed' | 'cancelled';
}

interface Invoice {
  id: string;
  client_name: string;
  amount: number;
  status: 'pending' | 'paid' | 'overdue';
  due_date: string;
}

interface DashboardData {
  stats: {
    total_revenue: number;
    monthly_revenue: number;
    total_clients: number;
    pending_invoices: number;
    pending_amount: number;
  };
  messages: Message[];
  appointments: Appointment[];
  invoices: Invoice[];
}

const AdminDashboard = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [aiQuery, setAiQuery] = useState('');
  const [data, setData] = useState<DashboardData>({
    stats: {
      total_revenue: 0,
      monthly_revenue: 0,
      total_clients: 0,
      pending_invoices: 0,
      pending_amount: 0,
    },
    messages: [],
    appointments: [],
    invoices: [],
  });

  useFocusEffect(
    useCallback(() => {
      loadDashboardData();
    }, [])
  );

  const loadDashboardData = async () => {
    try {
      const [invoiceStats, clientsRes, messagesRes, appointmentsRes] = await Promise.allSettled([
        api.get('/admin/invoices/stats'),
        api.get('/admin/clients?limit=1'),
        api.get('/admin/notifications/summary'),
        api.get('/admin/appointments/today'),
      ]);

      const invoiceData = invoiceStats.status === 'fulfilled' ? invoiceStats.value.data : {};
      const clientData = clientsRes.status === 'fulfilled' ? clientsRes.value.data : {};
      const totalClients = clientData.pagination?.total || clientData.clients?.length || 0;

      const messagesData = messagesRes.status === 'fulfilled' ? messagesRes.value.data : {};
      const recentMessages: Message[] = (messagesData.recent_items || []).map((item: any) => ({
        id: item.id || Math.random().toString(),
        client_name: item.from_name || 'Cliente',
        message: item.message || '',
        time: formatTimeAgo(item.time),
        unread: true,
      }));

      const appointmentsData = appointmentsRes.status === 'fulfilled' ? appointmentsRes.value.data : {};
      const todayAppointments: Appointment[] = (appointmentsData.appointments || []).map((apt: any) => ({
        id: apt.id || apt._id,
        client_name: apt.customer_name || apt.client_name || 'Cliente',
        time: formatAppointmentTime(apt.start_at || apt.start_time),
        service: apt.service_name || 'Consulta',
        status: apt.status === 'completed' ? 'completed' : 'pending',
      }));

      setData({
        stats: {
          total_revenue: invoiceData.total_revenue || 0,
          monthly_revenue: invoiceData.monthly_revenue || 0,
          total_clients: totalClients,
          pending_invoices: invoiceData.pending || 0,
          pending_amount: invoiceData.pending_amount || 0,
        },
        messages: recentMessages,
        appointments: todayAppointments,
        invoices: [],
      });
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const formatTimeAgo = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `hace ${diffMins}m`;
    if (diffHours < 24) return `hace ${diffHours}h`;
    return `hace ${diffDays}d`;
  };

  const formatAppointmentTime = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  };

  const formatCurrency = (amount: number) => {
    if (amount >= 1000) {
      return `$${(amount / 1000).toFixed(1)}K`;
    }
    return `$${amount.toFixed(0)}`;
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadDashboardData();
  };

  const handleAISubmit = () => {
    if (aiQuery.trim()) {
      router.push({
        pathname: '/_adminScreens/ai-brain',
        params: { query: aiQuery }
      });
      setAiQuery('');
    }
  };

  const userName = user?.name?.split(' ')[0] || 'Admin';
  const greeting = getGreeting();

  function getGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return 'Buenos días';
    if (hour < 18) return 'Buenas tardes';
    return 'Buenas noches';
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={C.brand} />
        <Text style={styles.loadingText}>Cargando...</Text>
      </View>
    );
  }

  const unreadCount = data.messages.filter(m => m.unread).length;

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={['#1a0a0a', '#2d1215', '#1a0a0a']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 10 }]}
      >
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.greeting}>{greeting}, {userName} 👋</Text>
            <Text style={styles.date}>
              {new Date().toLocaleDateString('es-ES', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })}
            </Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity 
              style={styles.headerButton}
              onPress={() => router.push('/_adminScreens/admin-notifications')}
            >
              <Ionicons name="notifications-outline" size={24} color={C.white} />
              {unreadCount > 0 && (
                <View style={styles.notifBadge}>
                  <Text style={styles.notifBadgeText}>{unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Quick Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{formatCurrency(data.stats.total_revenue)}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{data.stats.total_clients}</Text>
            <Text style={styles.statLabel}>Clientes</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, data.stats.pending_invoices > 0 && styles.statValueWarning]}>
              {data.stats.pending_invoices}
            </Text>
            <Text style={styles.statLabel}>Pendientes</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{formatCurrency(data.stats.monthly_revenue)}</Text>
            <Text style={styles.statLabel}>Este Mes</Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.brand} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Messages Section */}
        <View style={styles.section}>
          <TouchableOpacity 
            style={styles.sectionHeader}
            onPress={() => router.push('/(admin)/chat')}
          >
            <View style={styles.sectionTitleRow}>
              <View style={[styles.sectionIcon, { backgroundColor: 'rgba(217, 119, 6, 0.15)' }]}>
                <Ionicons name="chatbubbles" size={20} color="#d97706" />
              </View>
              <Text style={styles.sectionTitle}>Mensajes</Text>
              {unreadCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unreadCount}</Text>
                </View>
              )}
            </View>
            <View style={styles.seeAllButton}>
              <Text style={styles.seeAllText}>Ver todo</Text>
              <Ionicons name="chevron-forward" size={16} color={C.accent} />
            </View>
          </TouchableOpacity>

          {data.messages.length > 0 ? (
            <View style={styles.cardList}>
              {data.messages.slice(0, 3).map((msg) => (
                <TouchableOpacity 
                  key={msg.id} 
                  style={styles.messageCard}
                  onPress={() => router.push('/(admin)/chat')}
                >
                  <View style={styles.messageAvatar}>
                    <Text style={styles.avatarText}>
                      {msg.client_name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.messageContent}>
                    <View style={styles.messageHeader}>
                      <Text style={styles.messageName}>{msg.client_name}</Text>
                      <Text style={styles.messageTime}>{msg.time}</Text>
                    </View>
                    <Text style={styles.messageText} numberOfLines={1}>
                      {msg.message}
                    </Text>
                  </View>
                  {msg.unread && <View style={styles.unreadDot} />}
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="chatbubble-outline" size={32} color={C.muted} />
              <Text style={styles.emptyText}>No hay mensajes nuevos</Text>
            </View>
          )}
        </View>

        {/* Appointments Section */}
        <View style={styles.section}>
          <TouchableOpacity 
            style={styles.sectionHeader}
            onPress={() => router.push('/_adminScreens/appointments-calendar')}
          >
            <View style={styles.sectionTitleRow}>
              <View style={[styles.sectionIcon, { backgroundColor: 'rgba(37, 99, 235, 0.15)' }]}>
                <Ionicons name="calendar" size={20} color={C.info} />
              </View>
              <Text style={styles.sectionTitle}>Citas de Hoy</Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{data.appointments.length}</Text>
              </View>
            </View>
            <View style={styles.seeAllButton}>
              <Text style={styles.seeAllText}>Ver todo</Text>
              <Ionicons name="chevron-forward" size={16} color={C.accent} />
            </View>
          </TouchableOpacity>

          {data.appointments.length > 0 ? (
            <View style={styles.cardList}>
              {data.appointments.slice(0, 4).map((apt) => (
                <View key={apt.id} style={styles.appointmentCard}>
                  <View style={styles.appointmentTime}>
                    <Text style={styles.timeText}>{apt.time}</Text>
                  </View>
                  <View style={styles.appointmentInfo}>
                    <Text style={styles.appointmentName}>{apt.client_name}</Text>
                    <Text style={styles.appointmentService}>{apt.service}</Text>
                  </View>
                  <View style={[
                    styles.statusBadge,
                    apt.status === 'completed' ? styles.statusCompleted : styles.statusPending
                  ]}>
                    <Ionicons 
                      name={apt.status === 'completed' ? 'checkmark' : 'time-outline'} 
                      size={14} 
                      color={apt.status === 'completed' ? C.success : C.warning} 
                    />
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="calendar-outline" size={32} color={C.muted} />
              <Text style={styles.emptyText}>No hay citas para hoy</Text>
            </View>
          )}

          <TouchableOpacity 
            style={styles.addButton}
            onPress={() => router.push('/_adminScreens/schedule-appointment')}
          >
            <Ionicons name="add" size={20} color={C.accent} />
            <Text style={styles.addButtonText}>Agendar cita</Text>
          </TouchableOpacity>
        </View>

        {/* Invoices Section */}
        <View style={styles.section}>
          <TouchableOpacity 
            style={styles.sectionHeader}
            onPress={() => router.push('/(admin)/invoices')}
          >
            <View style={styles.sectionTitleRow}>
              <View style={[styles.sectionIcon, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                <Ionicons name="receipt" size={20} color={C.success} />
              </View>
              <Text style={styles.sectionTitle}>Facturas</Text>
            </View>
            <View style={styles.seeAllButton}>
              <Text style={styles.seeAllText}>Ver todo</Text>
              <Ionicons name="chevron-forward" size={16} color={C.accent} />
            </View>
          </TouchableOpacity>

          <View style={styles.invoiceSummary}>
            <View style={styles.invoiceStat}>
              <Text style={styles.invoiceStatValue}>{data.stats.pending_invoices}</Text>
              <Text style={styles.invoiceStatLabel}>Pendientes</Text>
            </View>
            <View style={styles.invoiceStatDivider} />
            <View style={styles.invoiceStat}>
              <Text style={[styles.invoiceStatValue, { color: C.warning }]}>
                {formatCurrency(data.stats.pending_amount)}
              </Text>
              <Text style={styles.invoiceStatLabel}>Por cobrar</Text>
            </View>
          </View>

          <TouchableOpacity 
            style={styles.addButton}
            onPress={() => router.push('/_adminScreens/create-invoice')}
          >
            <Ionicons name="add" size={20} color={C.accent} />
            <Text style={styles.addButtonText}>Nueva factura</Text>
          </TouchableOpacity>
        </View>

        {/* Identity Verification Section */}
        <View style={styles.section}>
          <TouchableOpacity 
            style={styles.sectionHeader}
            onPress={() => router.push('/_adminScreens/identity-verifications')}
          >
            <View style={styles.sectionTitleRow}>
              <View style={[styles.sectionIcon, { backgroundColor: 'rgba(99, 102, 241, 0.15)' }]}>
                <Ionicons name="shield-checkmark" size={20} color="#6366f1" />
              </View>
              <Text style={styles.sectionTitle}>Verificación de Identidad</Text>
            </View>
            <View style={styles.seeAllButton}>
              <Text style={styles.seeAllText}>Revisar</Text>
              <Ionicons name="chevron-forward" size={16} color={C.accent} />
            </View>
          </TouchableOpacity>
        </View>

        {/* AI Assistant Section */}
        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <View style={[styles.sectionIcon, { backgroundColor: 'rgba(147, 51, 234, 0.15)' }]}>
              <Ionicons name="sparkles" size={20} color={C.purple} />
            </View>
            <Text style={styles.sectionTitle}>Asistente IA</Text>
          </View>
          
          <View style={styles.aiCard}>
            <Text style={styles.aiSubtitle}>
              Pregúntame sobre clientes, citas, facturas o cualquier cosa
            </Text>
            <View style={styles.aiInputContainer}>
              <TextInput
                style={styles.aiInput}
                placeholder="Escribe tu pregunta..."
                placeholderTextColor={C.muted}
                value={aiQuery}
                onChangeText={setAiQuery}
                onSubmitEditing={handleAISubmit}
                returnKeyType="send"
              />
              <TouchableOpacity 
                style={[styles.aiSendButton, !aiQuery.trim() && styles.aiSendButtonDisabled]}
                onPress={handleAISubmit}
                disabled={!aiQuery.trim()}
              >
                <Ionicons name="send" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
            <View style={styles.aiSuggestions}>
              {['¿Cuántos clientes tengo?', '¿Citas de mañana?', '¿Facturas pendientes?'].map((suggestion, i) => (
                <TouchableOpacity 
                  key={i}
                  style={styles.aiSuggestionChip}
                  onPress={() => setAiQuery(suggestion)}
                >
                  <Text style={styles.aiSuggestionText}>{suggestion}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity 
            style={styles.quickAction}
            onPress={() => router.push('/_adminScreens/create-client')}
          >
            <View style={[styles.quickActionIcon, { backgroundColor: C.success }]}>
              <Ionicons name="person-add" size={22} color="#fff" />
            </View>
            <Text style={styles.quickActionText}>Nuevo Cliente</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.quickAction}
            onPress={() => router.push('/(admin)/clients')}
          >
            <View style={[styles.quickActionIcon, { backgroundColor: C.info }]}>
              <Ionicons name="people" size={22} color="#fff" />
            </View>
            <Text style={styles.quickActionText}>Clientes</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.quickAction}
            onPress={() => router.push('/_adminScreens/settings')}
          >
            <View style={[styles.quickActionIcon, { backgroundColor: C.purple }]}>
              <Ionicons name="settings" size={22} color="#fff" />
            </View>
            <Text style={styles.quickActionText}>Configuración</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: C.bg,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: C.sub,
  },
  header: {
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  greeting: {
    fontSize: 22,
    fontWeight: '700',
    color: C.white,
  },
  date: {
    fontSize: 14,
    color: C.sub,
    marginTop: 4,
    textTransform: 'capitalize',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  notifBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: C.brand,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notifBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: C.card,
    borderRadius: 16,
    padding: 16,
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: C.border,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: C.white,
  },
  statValueWarning: {
    color: C.warning,
  },
  statLabel: {
    fontSize: 12,
    color: C.sub,
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    backgroundColor: C.border,
    marginHorizontal: 8,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sectionIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: C.white,
  },
  badge: {
    backgroundColor: C.brand,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 8,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  seeAllText: {
    fontSize: 14,
    color: C.accent,
    fontWeight: '500',
  },
  cardList: {
    backgroundColor: C.card,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.border,
  },
  messageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  messageAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.brand,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  messageContent: {
    flex: 1,
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  messageName: {
    fontSize: 15,
    fontWeight: '600',
    color: C.white,
  },
  messageTime: {
    fontSize: 12,
    color: C.muted,
  },
  messageText: {
    fontSize: 14,
    color: C.sub,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: C.accent,
    marginLeft: 8,
  },
  appointmentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  appointmentTime: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 12,
  },
  timeText: {
    fontSize: 14,
    fontWeight: '700',
    color: C.info,
  },
  appointmentInfo: {
    flex: 1,
  },
  appointmentName: {
    fontSize: 15,
    fontWeight: '600',
    color: C.white,
  },
  appointmentService: {
    fontSize: 13,
    color: C.sub,
    marginTop: 2,
  },
  statusBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusCompleted: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  statusPending: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
  },
  emptyState: {
    backgroundColor: C.card,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  emptyText: {
    fontSize: 14,
    color: C.muted,
    marginTop: 8,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(34, 211, 238, 0.1)',
    borderRadius: 12,
    padding: 14,
    marginTop: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(34, 211, 238, 0.2)',
  },
  addButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: C.accent,
  },
  invoiceSummary: {
    flexDirection: 'row',
    backgroundColor: C.card,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: C.border,
  },
  invoiceStat: {
    flex: 1,
    alignItems: 'center',
  },
  invoiceStatValue: {
    fontSize: 28,
    fontWeight: '700',
    color: C.white,
  },
  invoiceStatLabel: {
    fontSize: 13,
    color: C.sub,
    marginTop: 4,
  },
  invoiceStatDivider: {
    width: 1,
    backgroundColor: C.border,
    marginHorizontal: 16,
  },
  aiCard: {
    backgroundColor: C.card,
    borderRadius: 16,
    padding: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  aiSubtitle: {
    fontSize: 14,
    color: C.sub,
    marginBottom: 12,
  },
  aiInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.bg,
    borderRadius: 12,
    paddingLeft: 16,
    paddingRight: 4,
    borderWidth: 1,
    borderColor: C.border,
  },
  aiInput: {
    flex: 1,
    fontSize: 15,
    color: C.white,
    paddingVertical: 12,
  },
  aiSendButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: C.brand,
    justifyContent: 'center',
    alignItems: 'center',
  },
  aiSendButtonDisabled: {
    backgroundColor: 'rgba(196, 30, 58, 0.4)',
  },
  aiSuggestions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  aiSuggestionChip: {
    backgroundColor: 'rgba(148, 163, 184, 0.1)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: C.border,
  },
  aiSuggestionText: {
    fontSize: 13,
    color: C.sub,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  quickAction: {
    flex: 1,
    backgroundColor: C.card,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  quickActionText: {
    fontSize: 12,
    fontWeight: '600',
    color: C.sub,
    textAlign: 'center',
  },
});

export default AdminDashboard;
