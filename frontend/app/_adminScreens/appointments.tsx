/**
 * Admin Appointments Screen - Modern Premium Design
 * Simplified view with premium UI matching other admin screens
 */
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  RefreshControl,
  Dimensions,
  FlatList,
  Linking,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../../services/api';
import { format, isToday, isTomorrow, isPast, addDays } from 'date-fns';
import { es } from 'date-fns/locale';

const { width: screenWidth } = Dimensions.get('window');

interface Appointment {
  id: string;
  user_id: string;
  client_id?: string;
  client_name: string;
  client_email: string;
  client_phone?: string;
  scheduled_at: string;
  status: 'scheduled' | 'completed' | 'cancelled' | 'no_show';
  notes?: string;
  appointment_type: string;
  duration_minutes: number;
  meeting_link?: string;
  created_at: string;
}

interface Stats {
  total: number;
  today: number;
  upcoming: number;
  completed: number;
  cancelled: number;
}

type FilterType = 'all' | 'today' | 'upcoming' | 'completed' | 'cancelled';

export default function AppointmentsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scrollY = useRef(new Animated.Value(0)).current;
  
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [filteredAppointments, setFilteredAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [stats, setStats] = useState<Stats>({
    total: 0,
    today: 0,
    upcoming: 0,
    completed: 0,
    cancelled: 0,
  });

  useEffect(() => {
    loadAppointments();
  }, []);

  useEffect(() => {
    filterAppointments();
  }, [appointments, activeFilter, searchQuery]);

  const loadAppointments = async () => {
    try {
      // Use local appointments from our database (includes migrated Square appointments)
      const response = await api.get('/appointments');
      const appointmentsData = response.data?.appointments || response.data || [];
      
      // Map user_name to client_name for compatibility
      const mappedAppointments = (Array.isArray(appointmentsData) ? appointmentsData : []).map((apt: any) => ({
        ...apt,
        client_name: apt.client_name || apt.user_name || 'Cliente',
        client_email: apt.client_email || apt.user_email || '',
      }));
      setAppointments(mappedAppointments);
      
      // Calculate stats
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = addDays(today, 1);
      
      const newStats: Stats = {
        total: mappedAppointments.length,
        today: mappedAppointments.filter((a: Appointment) => isToday(new Date(a.scheduled_at || a.date))).length,
        upcoming: mappedAppointments.filter((a: Appointment) => {
          const date = new Date(a.scheduled_at || a.date);
          return date >= today && (a.status === 'scheduled' || a.status === 'confirmed');
        }).length,
        completed: mappedAppointments.filter((a: Appointment) => a.status === 'completed').length,
        cancelled: mappedAppointments.filter((a: Appointment) => a.status === 'cancelled').length,
      };
      setStats(newStats);
    } catch (error) {
      console.error('Error loading appointments:', error);
      Alert.alert('Error', 'No se pudieron cargar las citas');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const filterAppointments = () => {
    let filtered = [...appointments];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Apply status filter
    switch (activeFilter) {
      case 'today':
        filtered = filtered.filter(a => isToday(new Date(a.scheduled_at)));
        break;
      case 'upcoming':
        filtered = filtered.filter(a => {
          const date = new Date(a.scheduled_at);
          return date >= today && a.status === 'scheduled';
        });
        break;
      case 'completed':
        filtered = filtered.filter(a => a.status === 'completed');
        break;
      case 'cancelled':
        filtered = filtered.filter(a => a.status === 'cancelled');
        break;
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(a => 
        a.client_name?.toLowerCase().includes(query) ||
        a.client_email?.toLowerCase().includes(query)
      );
    }

    // Sort by date (most recent first for past, soonest first for upcoming)
    filtered.sort((a, b) => {
      const dateA = new Date(a.scheduled_at);
      const dateB = new Date(b.scheduled_at);
      return dateA.getTime() - dateB.getTime();
    });

    setFilteredAppointments(filtered);
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadAppointments();
  };

  const getStatusConfig = (status: string, scheduledAt: string) => {
    const date = new Date(scheduledAt);
    const isPastDate = isPast(date) && !isToday(date);
    
    if (status === 'completed') {
      return { 
        bg: '#ECFDF5', 
        text: '#059669', 
        icon: 'checkmark-circle',
        gradient: ['#10B981', '#059669'],
        label: 'Completada'
      };
    }
    if (status === 'cancelled') {
      return { 
        bg: '#FEF2F2', 
        text: '#DC2626', 
        icon: 'close-circle',
        gradient: ['#EF4444', '#DC2626'],
        label: 'Cancelada'
      };
    }
    if (status === 'no_show') {
      return { 
        bg: '#FEF3C7', 
        text: '#D97706', 
        icon: 'alert-circle',
        gradient: ['#F59E0B', '#D97706'],
        label: 'No asistió'
      };
    }
    if (isToday(date)) {
      return { 
        bg: '#EEF2FF', 
        text: '#4F46E5', 
        icon: 'today',
        gradient: ['#6366F1', '#4F46E5'],
        label: 'Hoy'
      };
    }
    if (isTomorrow(date)) {
      return { 
        bg: '#F0FDFA', 
        text: '#0D9488', 
        icon: 'calendar',
        gradient: ['#14B8A6', '#0D9488'],
        label: 'Mañana'
      };
    }
    return { 
      bg: '#F3F4F6', 
      text: '#6B7280', 
      icon: 'calendar-outline',
      gradient: ['#9CA3AF', '#6B7280'],
      label: 'Programada'
    };
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: format(date, "EEE d MMM", { locale: es }),
      time: format(date, "h:mm a"),
    };
  };

  const handleCall = (phone?: string) => {
    if (!phone) {
      Alert.alert('Sin teléfono', 'No hay número de teléfono disponible');
      return;
    }
    Linking.openURL(`tel:${phone}`);
  };

  const handleWhatsApp = (phone?: string) => {
    if (!phone) {
      Alert.alert('Sin teléfono', 'No hay número de teléfono disponible');
      return;
    }
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    Linking.openURL(`whatsapp://send?phone=${cleanPhone}`);
  };

  const renderAppointment = ({ item }: { item: Appointment }) => {
    const statusConfig = getStatusConfig(item.status, item.scheduled_at);
    const { date, time } = formatDateTime(item.scheduled_at);
    
    // Check if appointment is today or scheduled (can complete service)
    const appointmentDate = new Date(item.scheduled_at);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const isAppointmentToday = appointmentDate >= today && appointmentDate < new Date(today.getTime() + 24 * 60 * 60 * 1000);
    const canCompleteService = (item.status === 'scheduled' || item.status === 'pending') && (isAppointmentToday || isPast(appointmentDate));

    return (
      <TouchableOpacity
        style={styles.appointmentCard}
        activeOpacity={0.7}
        onPress={() => {
          // Navigate to appointment details if needed
        }}
      >
        <View style={styles.cardContent}>
          {/* Left - Time Block */}
          <LinearGradient
            colors={statusConfig.gradient}
            style={styles.timeBlock}
          >
            <Ionicons name={statusConfig.icon as any} size={20} color="#FFF" />
            <Text style={styles.timeText}>{time}</Text>
            <Text style={styles.dateText}>{date}</Text>
          </LinearGradient>

          {/* Center - Client Info */}
          <View style={styles.clientInfo}>
            <Text style={styles.clientName} numberOfLines={1}>
              {item.client_name || 'Cliente'}
            </Text>
            <View style={styles.infoRow}>
              <Ionicons name="mail-outline" size={12} color="#9CA3AF" />
              <Text style={styles.infoText} numberOfLines={1}>
                {item.client_email || 'Sin email'}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="time-outline" size={12} color="#9CA3AF" />
              <Text style={styles.infoText}>{item.duration_minutes} min</Text>
              <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
                <Text style={[styles.statusText, { color: statusConfig.text }]}>
                  {statusConfig.label}
                </Text>
              </View>
            </View>
          </View>

          {/* Right - Actions */}
          <View style={styles.actions}>
            <TouchableOpacity 
              style={styles.actionBtn}
              onPress={() => handleCall(item.client_phone)}
            >
              <Ionicons name="call" size={18} color="#3B82F6" />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.actionBtn}
              onPress={() => handleWhatsApp(item.client_phone)}
            >
              <Ionicons name="logo-whatsapp" size={18} color="#25D366" />
            </TouchableOpacity>
          </View>
        </View>
        
        {/* Complete Service Button - Only show for today's or past scheduled appointments */}
        {canCompleteService && (
          <TouchableOpacity
            style={styles.completeServiceBtn}
            onPress={() => router.push({
              pathname: '/(admin)/completar-servicio',
              params: { appointmentId: item.id }
            })}
          >
            <LinearGradient
              colors={['#10B981', '#059669']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.completeServiceGradient}
            >
              <Ionicons name="checkmark-done" size={18} color="#FFF" />
              <Text style={styles.completeServiceText}>Completar Servicio</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  const filters = [
    { type: 'all' as FilterType, label: 'Todas', icon: 'list', count: stats.total, color: '#6C1110' },
    { type: 'today' as FilterType, label: 'Hoy', icon: 'today', count: stats.today, color: '#6366F1' },
    { type: 'upcoming' as FilterType, label: 'Próximas', icon: 'calendar', count: stats.upcoming, color: '#10B981' },
    { type: 'completed' as FilterType, label: 'Completadas', icon: 'checkmark-circle', count: stats.completed, color: '#059669' },
    { type: 'cancelled' as FilterType, label: 'Canceladas', icon: 'close-circle', count: stats.cancelled, color: '#EF4444' },
  ];

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <LinearGradient colors={['#6C1110', '#8B1A19']} style={styles.loadingGradient}>
          <ActivityIndicator size="large" color="#FFF" />
          <Text style={styles.loadingText}>Cargando citas...</Text>
        </LinearGradient>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Premium Header */}
      <LinearGradient
        colors={['#6C1110', '#8B1A19', '#A52422']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 12 }]}
      >
        {/* Decorative circles */}
        <View style={styles.headerDecoration}>
          <View style={[styles.decorCircle, styles.decorCircle1]} />
          <View style={[styles.decorCircle, styles.decorCircle2]} />
        </View>

        <View style={styles.headerTop}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="chevron-back" size={24} color="#FFF" />
          </TouchableOpacity>
          
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Citas</Text>
            <Text style={styles.headerSubtitle}>{stats.total} programadas</Text>
          </View>
          
          <TouchableOpacity 
            style={styles.addButton}
            onPress={() => router.push('/_adminScreens/schedule-appointment')}
          >
            <Ionicons name="add" size={24} color="#FFF" />
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#9CA3AF" />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar por cliente..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats.total}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCard}>
            <Text style={[styles.statNumber, { color: '#93C5FD' }]}>{stats.today}</Text>
            <Text style={styles.statLabel}>Hoy</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCard}>
            <Text style={[styles.statNumber, { color: '#86EFAC' }]}>{stats.upcoming}</Text>
            <Text style={styles.statLabel}>Próximas</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{filteredAppointments.length}</Text>
            <Text style={styles.statLabel}>Mostrando</Text>
          </View>
        </View>
      </LinearGradient>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <FlatList
          horizontal
          data={filters}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterList}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.filterTab,
                activeFilter === item.type && styles.filterTabActive,
                activeFilter === item.type && { borderColor: item.color },
              ]}
              onPress={() => setActiveFilter(item.type)}
            >
              <Ionicons 
                name={item.icon as any} 
                size={16} 
                color={activeFilter === item.type ? item.color : '#6B7280'} 
              />
              <Text style={[
                styles.filterTabText,
                activeFilter === item.type && { color: item.color, fontWeight: '700' }
              ]}>
                {item.label}
              </Text>
              <View style={[
                styles.filterBadge, 
                { backgroundColor: activeFilter === item.type ? item.color : '#E5E7EB' }
              ]}>
                <Text style={[
                  styles.filterBadgeText,
                  { color: activeFilter === item.type ? '#FFF' : '#6B7280' }
                ]}>
                  {item.count}
                </Text>
              </View>
            </TouchableOpacity>
          )}
          keyExtractor={(item) => item.type}
        />
      </View>

      {/* Appointments List */}
      <FlatList
        data={filteredAppointments}
        renderItem={renderAppointment}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            tintColor="#6C1110"
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <LinearGradient
              colors={['#FEF2F2', '#FEE2E2']}
              style={styles.emptyIconBg}
            >
              <Ionicons name="calendar-outline" size={48} color="#6C1110" />
            </LinearGradient>
            <Text style={styles.emptyTitle}>No hay citas</Text>
            <Text style={styles.emptyText}>
              Programa una nueva cita con el botón +
            </Text>
            <TouchableOpacity
              style={styles.emptyButton}
              onPress={() => router.push('/_adminScreens/schedule-appointment')}
            >
              <LinearGradient
                colors={['#6C1110', '#8B1A19']}
                style={styles.emptyButtonGradient}
              >
                <Ionicons name="add" size={20} color="#FFF" />
                <Text style={styles.emptyButtonText}>Nueva Cita</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F1F5F9',
  },
  loadingContainer: {
    flex: 1,
  },
  loadingGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#FFF',
    fontWeight: '500',
  },
  // Header
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
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
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
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 16,
    zIndex: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFF',
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Search
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 14,
    paddingHorizontal: 14,
    marginHorizontal: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    marginLeft: 10,
    fontSize: 15,
    color: '#1F2937',
  },
  // Stats
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    padding: 12,
  },
  statCard: {
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
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  // Filters
  filterContainer: {
    paddingVertical: 14,
  },
  filterList: {
    paddingHorizontal: 16,
    gap: 10,
  },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#FFF',
    borderWidth: 2,
    borderColor: 'transparent',
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  filterTabActive: {
    backgroundColor: '#FFF',
  },
  filterTabText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6B7280',
  },
  filterBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 24,
    alignItems: 'center',
  },
  filterBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  // List
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  // Appointment Card
  appointmentCard: {
    backgroundColor: '#FFF',
    borderRadius: 18,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
    overflow: 'hidden',
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeBlock: {
    width: 80,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFF',
    marginTop: 4,
  },
  dateText: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
    textTransform: 'capitalize',
  },
  clientInfo: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  clientName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 6,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  infoText: {
    fontSize: 12,
    color: '#6B7280',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 8,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  actions: {
    paddingRight: 12,
    gap: 8,
  },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIconBg: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 24,
  },
  emptyButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  emptyButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 8,
  },
  emptyButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFF',
  },
  // Complete Service Button
  completeServiceBtn: {
    marginTop: 0,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    overflow: 'hidden',
  },
  completeServiceGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  completeServiceText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  },
});
