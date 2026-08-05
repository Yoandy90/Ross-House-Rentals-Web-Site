import { useTranslation } from 'react-i18next';
/**
 * Service Orders Management Screen - Modern Premium Design
 * Redesigned with gradients, stats and modern UI
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Modal,
  Dimensions,
  FlatList,
  ScrollView,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import api from '../../services/api';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const { width: screenWidth } = Dimensions.get('window');

interface ServiceOrder {
  id: string;
  order_number: string;
  client_id: string;
  client_name: string;
  client_email: string;
  client_phone?: string;
  service_type: string;
  description: string;
  tax_year: number;
  status: string;
  priority: string;
  estimated_amount: number;
  notes: string;
  created_at: string;
  updated_at: string;
  assigned_to?: string;
  assigned_to_name?: string;
  payment_status?: string;
}

interface Stats {
  total: number;
  pending: number;
  in_progress: number;
  completed: number;
  cancelled: number;
}

type FilterType = 'all' | 'pending' | 'in_progress' | 'completed' | 'cancelled';

const ServiceOrdersManagement = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<ServiceOrder[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [selectedOrder, setSelectedOrder] = useState<ServiceOrder | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [stats, setStats] = useState<Stats>({
    total: 0,
    pending: 0,
    in_progress: 0,
    completed: 0,
    cancelled: 0,
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    filterOrders();
  }, [orders, searchQuery, activeFilter]);

  const loadData = async () => {
    try {
      setLoading(true);
      const response = await api.get('/admin/service-orders?limit=500');
      const ordersData = response.data.orders || response.data || [];
      setOrders(ordersData);

      const statsFromBackend = response.data.stats;
      if (statsFromBackend) {
        setStats(statsFromBackend);
      } else {
        const newStats: Stats = {
          total: ordersData.length,
          pending: ordersData.filter((o: ServiceOrder) => o.status === 'pending').length,
          in_progress: ordersData.filter((o: ServiceOrder) => o.status === 'in_progress').length,
          completed: ordersData.filter((o: ServiceOrder) => o.status === 'completed').length,
          cancelled: ordersData.filter((o: ServiceOrder) => o.status === 'cancelled').length,
        };
        setStats(newStats);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'No se pudieron cargar los trámites');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
  }, []);

  const filterOrders = () => {
    let filtered = [...orders];

    if (activeFilter !== 'all') {
      filtered = filtered.filter(o => o.status === activeFilter);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(o =>
        o.order_number?.toLowerCase().includes(query) ||
        o.client_name?.toLowerCase().includes(query) ||
        o.description?.toLowerCase().includes(query)
      );
    }

    // Sort by date (newest first)
    filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setFilteredOrders(filtered);
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      setUpdatingStatus(true);
      await api.patch(`/admin/service-orders/${orderId}`, { status: newStatus });
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
      Alert.alert('Éxito', 'Estado actualizado');
      setShowDetailModal(false);
    } catch (error) {
      Alert.alert('Error', 'No se pudo actualizar el estado');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'pending':
        return { bg: '#FEF3C7', text: '#D97706', label: 'Pendiente', icon: 'time', gradient: ['#F59E0B', '#D97706'] };
      case 'in_progress':
        return { bg: '#DBEAFE', text: '#2563EB', label: 'En Curso', icon: 'construct', gradient: ['#3B82F6', '#2563EB'] };
      case 'completed':
        return { bg: '#ECFDF5', text: '#059669', label: 'Completado', icon: 'checkmark-circle', gradient: ['#10B981', '#059669'] };
      case 'cancelled':
        return { bg: '#FEF2F2', text: '#DC2626', label: 'Cancelado', icon: 'close-circle', gradient: ['#EF4444', '#DC2626'] };
      default:
        return { bg: '#F3F4F6', text: '#6B7280', label: status, icon: 'help-circle', gradient: ['#9CA3AF', '#6B7280'] };
    }
  };

  const getPriorityConfig = (priority: string) => {
    switch (priority) {
      case 'high':
        return { color: '#EF4444', label: 'Alta', icon: 'flame' };
      case 'medium':
        return { color: '#F59E0B', label: 'Media', icon: 'alert-circle' };
      default:
        return { color: '#10B981', label: 'Normal', icon: 'checkmark' };
    }
  };

  const getServiceIcon = (serviceType: string) => {
    const type = serviceType?.toLowerCase() || '';
    if (type.includes('passport') || type.includes('pasaporte')) return 'document-text';
    if (type.includes('tax') || type.includes('impuesto')) return 'calculator';
    if (type.includes('itin')) return 'card';
    if (type.includes('translation') || type.includes('traducción')) return 'language';
    return 'briefcase';
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(amount || 0);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    try {
      return format(new Date(dateString), "d MMM", { locale: es });
    } catch {
      return dateString;
    }
  };

  const handleCall = (phone?: string) => {
    if (!phone) return Alert.alert('Sin teléfono', 'No hay número disponible');
    Linking.openURL(`tel:${phone}`);
  };

  const handleWhatsApp = (phone?: string) => {
    if (!phone) return Alert.alert('Sin teléfono', 'No hay número disponible');
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    Linking.openURL(`whatsapp://send?phone=${cleanPhone}`);
  };

  const renderOrderCard = ({ item }: { item: ServiceOrder }) => {
    const statusConfig = getStatusConfig(item.status);
    const priorityConfig = getPriorityConfig(item.priority);

    return (
      <TouchableOpacity
        style={styles.orderCard}
        activeOpacity={0.7}
        onPress={() => {
          setSelectedOrder(item);
          setShowDetailModal(true);
        }}
      >
        {/* Header */}
        <View style={styles.cardHeader}>
          <LinearGradient colors={statusConfig.gradient} style={styles.serviceIconBg}>
            <Ionicons name={getServiceIcon(item.service_type) as any} size={22} color="#FFF" />
          </LinearGradient>
          <View style={styles.cardTitleSection}>
            <Text style={styles.orderNumber}>{item.order_number || 'Sin número'}</Text>
            <Text style={styles.clientName} numberOfLines={1}>{item.client_name}</Text>
          </View>
          <View style={styles.cardBadges}>
            <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
              <Text style={[styles.statusText, { color: statusConfig.text }]}>{statusConfig.label}</Text>
            </View>
            {item.priority === 'high' && (
              <View style={styles.priorityBadge}>
                <Ionicons name="flame" size={12} color="#EF4444" />
              </View>
            )}
          </View>
        </View>

        {/* Service Info */}
        <View style={styles.serviceInfo}>
          <View style={styles.infoRow}>
            <Ionicons name="briefcase-outline" size={14} color="#6B7280" />
            <Text style={styles.infoText} numberOfLines={1}>{item.service_type || item.description}</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="calendar-outline" size={14} color="#6B7280" />
            <Text style={styles.infoText}>Año: {item.tax_year || 'N/A'}</Text>
            <Text style={styles.dateText}>Creado: {formatDate(item.created_at)}</Text>
          </View>
        </View>

        {/* Amount & Assigned */}
        <View style={styles.cardFooter}>
          <View style={styles.amountSection}>
            <Text style={styles.amountLabel}>Estimado</Text>
            <Text style={styles.amountValue}>{formatCurrency(item.estimated_amount)}</Text>
          </View>
          {item.assigned_to_name && (
            <View style={styles.assignedSection}>
              <View style={styles.assignedBadge}>
                <Ionicons name="person" size={12} color="#6366F1" />
                <Text style={styles.assignedText}>{item.assigned_to_name}</Text>
              </View>
            </View>
          )}
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
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
          <TouchableOpacity 
            style={[styles.actionBtn, styles.viewBtn]}
            onPress={() => {
              setSelectedOrder(item);
              setShowDetailModal(true);
            }}
          >
            <Ionicons name="eye" size={18} color="#FFF" />
            <Text style={styles.viewBtnText}>Ver</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const filters = [
    { type: 'all' as FilterType, label: 'Todos', count: stats.total, color: '#6C1110', icon: 'list' },
    { type: 'pending' as FilterType, label: 'Pendientes', count: stats.pending, color: '#F59E0B', icon: 'time' },
    { type: 'in_progress' as FilterType, label: 'En Curso', count: stats.in_progress, color: '#3B82F6', icon: 'construct' },
    { type: 'completed' as FilterType, label: 'Listos', count: stats.completed, color: '#10B981', icon: 'checkmark-circle' },
  ];

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <LinearGradient colors={['#6C1110', '#8B1A19']} style={styles.loadingGradient}>
          <ActivityIndicator size="large" color="#FFF" />
          <Text style={styles.loadingText}>Cargando trámites...</Text>
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
        <View style={styles.headerDecoration}>
          <View style={[styles.decorCircle, styles.decorCircle1]} />
          <View style={[styles.decorCircle, styles.decorCircle2]} />
        </View>

        <View style={styles.headerTop}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={24} color="#FFF" />
          </TouchableOpacity>
          
          <View style={styles.headerCenter}>
            <View style={styles.headerTitleRow}>
              <Ionicons name="briefcase" size={22} color="#FFF" />
              <Text style={styles.headerTitle}>Trámites</Text>
            </View>
            <Text style={styles.headerSubtitle}>Gestión de Servicios</Text>
          </View>
          
          <TouchableOpacity 
            style={styles.addButton}
            onPress={() => router.push('/_adminScreens/create-service')}
          >
            <Ionicons name="add" size={24} color="#FFF" />
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#9CA3AF" />
          <TextInput
            style={styles.searchInput}
            placeholder={t('admin.searchOrderPlaceholder', 'Buscar trámite o cliente...')}
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
            <Text style={[styles.statNumber, { color: '#FEF3C7' }]}>{stats.pending}</Text>
            <Text style={styles.statLabel}>Pendientes</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCard}>
            <Text style={[styles.statNumber, { color: '#93C5FD' }]}>{stats.in_progress}</Text>
            <Text style={styles.statLabel}>En Curso</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCard}>
            <Text style={[styles.statNumber, { color: '#86EFAC' }]}>{stats.completed}</Text>
            <Text style={styles.statLabel}>Listos</Text>
          </View>
        </View>
      </LinearGradient>

      {/* Filters */}
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

      {/* Orders List */}
      <FlatList
        data={filteredOrders}
        renderItem={renderOrderCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6C1110" />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <LinearGradient colors={['#FEF2F2', '#FEE2E2']} style={styles.emptyIconBg}>
              <Ionicons name="folder-open-outline" size={48} color="#6C1110" />
            </LinearGradient>
            <Text style={styles.emptyTitle}>No hay trámites</Text>
            <Text style={styles.emptyText}>Crea un nuevo trámite con el botón +</Text>
            <TouchableOpacity 
              style={styles.emptyButton}
              onPress={() => router.push('/_adminScreens/create-service')}
            >
              <LinearGradient colors={['#6C1110', '#8B1A19']} style={styles.emptyButtonGradient}>
                <Ionicons name="add" size={20} color="#FFF" />
                <Text style={styles.emptyButtonText}>Nuevo Trámite</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        }
      />

      {/* Detail Modal */}
      <Modal visible={showDetailModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <LinearGradient 
              colors={selectedOrder ? getStatusConfig(selectedOrder.status).gradient : ['#6C1110', '#8B1A19']} 
              style={styles.modalHeader}
            >
              <View>
                <Text style={styles.modalTitle}>{selectedOrder?.order_number}</Text>
                <Text style={styles.modalSubtitle}>{selectedOrder?.client_name}</Text>
              </View>
              <TouchableOpacity onPress={() => setShowDetailModal(false)}>
                <Ionicons name="close" size={24} color="#FFF" />
              </TouchableOpacity>
            </LinearGradient>
            
            {selectedOrder && (
              <ScrollView style={styles.modalBody}>
                {/* Service Info */}
                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Servicio</Text>
                  <Text style={styles.detailValue}>{selectedOrder.service_type || selectedOrder.description}</Text>
                </View>

                <View style={styles.detailRow}>
                  <View style={styles.detailHalf}>
                    <Text style={styles.detailLabel}>Año Fiscal</Text>
                    <Text style={styles.detailValue}>{selectedOrder.tax_year || 'N/A'}</Text>
                  </View>
                  <View style={styles.detailHalf}>
                    <Text style={styles.detailLabel}>Estimado</Text>
                    <Text style={styles.detailValue}>{formatCurrency(selectedOrder.estimated_amount)}</Text>
                  </View>
                </View>

                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Notas</Text>
                  <Text style={styles.detailValue}>{selectedOrder.notes || 'Sin notas'}</Text>
                </View>

                {/* Status Update */}
                <Text style={styles.statusUpdateTitle}>Cambiar Estado</Text>
                <View style={styles.statusButtons}>
                  {['pending', 'in_progress', 'completed', 'cancelled'].map((status) => {
                    const config = getStatusConfig(status);
                    const isActive = selectedOrder.status === status;
                    return (
                      <TouchableOpacity
                        key={status}
                        style={[
                          styles.statusButton,
                          isActive && { borderColor: config.text, backgroundColor: config.bg }
                        ]}
                        onPress={() => updateOrderStatus(selectedOrder.id, status)}
                        disabled={updatingStatus || isActive}
                      >
                        <Ionicons name={config.icon as any} size={18} color={config.text} />
                        <Text style={[styles.statusButtonText, { color: config.text }]}>
                          {config.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {updatingStatus && (
                  <ActivityIndicator style={{ marginTop: 16 }} color="#6C1110" />
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F1F5F9' },
  loadingContainer: { flex: 1 },
  loadingGradient: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 16, fontSize: 16, color: '#FFF', fontWeight: '500' },
  
  // Header
  header: { paddingBottom: 20, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, overflow: 'hidden' },
  headerDecoration: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  decorCircle: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.08)' },
  decorCircle1: { width: 180, height: 180, top: -60, right: -40 },
  decorCircle2: { width: 120, height: 120, bottom: -30, left: -20 },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 16, zIndex: 1 },
  backButton: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#FFF' },
  headerSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  addButton: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  
  // Search
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 14, paddingHorizontal: 14, marginHorizontal: 16, marginBottom: 16 },
  searchInput: { flex: 1, paddingVertical: 12, marginLeft: 10, fontSize: 15, color: '#1F2937' },
  
  // Stats
  statsRow: { flexDirection: 'row', marginHorizontal: 16, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 16, padding: 12 },
  statCard: { flex: 1, alignItems: 'center' },
  statNumber: { fontSize: 20, fontWeight: '800', color: '#FFF' },
  statLabel: { fontSize: 10, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  statDivider: { width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.2)' },
  
  // Filters
  filterContainer: { paddingVertical: 14 },
  filterList: { paddingHorizontal: 16, gap: 10 },
  filterTab: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 20, backgroundColor: '#FFF', borderWidth: 2, borderColor: 'transparent', gap: 6 },
  filterTabText: { fontSize: 12, fontWeight: '500', color: '#6B7280' },
  filterBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, minWidth: 22, alignItems: 'center' },
  filterBadgeText: { fontSize: 10, fontWeight: '700' },
  
  // List
  listContent: { paddingHorizontal: 16, paddingBottom: 100 },
  
  // Card
  orderCard: { backgroundColor: '#FFF', borderRadius: 18, marginBottom: 14, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 4 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  serviceIconBg: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  cardTitleSection: { flex: 1 },
  orderNumber: { fontSize: 16, fontWeight: '700', color: '#1F2937' },
  clientName: { fontSize: 14, color: '#6B7280', marginTop: 2 },
  cardBadges: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 10, fontWeight: '700' },
  priorityBadge: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#FEF2F2', justifyContent: 'center', alignItems: 'center' },
  
  serviceInfo: { backgroundColor: '#F8FAFC', borderRadius: 12, padding: 12, marginBottom: 12 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  infoText: { fontSize: 13, color: '#4B5563', flex: 1 },
  dateText: { fontSize: 12, color: '#9CA3AF' },
  
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  amountSection: {},
  amountLabel: { fontSize: 11, color: '#9CA3AF' },
  amountValue: { fontSize: 18, fontWeight: '700', color: '#1F2937' },
  assignedSection: {},
  assignedBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EEF2FF', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, gap: 6 },
  assignedText: { fontSize: 12, color: '#6366F1', fontWeight: '600' },
  
  quickActions: { flexDirection: 'row', gap: 10, borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 12 },
  actionBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  viewBtn: { flex: 1, backgroundColor: '#6C1110', flexDirection: 'row', gap: 6 },
  viewBtnText: { fontSize: 14, fontWeight: '600', color: '#FFF' },
  
  // Empty
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyIconBg: { width: 100, height: 100, borderRadius: 50, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#1F2937', marginBottom: 8 },
  emptyText: { fontSize: 14, color: '#6B7280', marginBottom: 24 },
  emptyButton: { borderRadius: 12, overflow: 'hidden' },
  emptyButtonGradient: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, gap: 8 },
  emptyButtonText: { fontSize: 15, fontWeight: '600', color: '#FFF' },
  
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#FFF' },
  modalSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  modalBody: { padding: 20 },
  
  detailSection: { marginBottom: 16 },
  detailLabel: { fontSize: 12, color: '#9CA3AF', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  detailValue: { fontSize: 16, color: '#1F2937', fontWeight: '500' },
  detailRow: { flexDirection: 'row', gap: 16, marginBottom: 16 },
  detailHalf: { flex: 1 },
  
  statusUpdateTitle: { fontSize: 14, fontWeight: '600', color: '#374151', marginTop: 16, marginBottom: 12 },
  statusButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statusButton: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 2, borderColor: '#E5E7EB', gap: 6 },
  statusButtonText: { fontSize: 13, fontWeight: '600' },
});

export default ServiceOrdersManagement;
