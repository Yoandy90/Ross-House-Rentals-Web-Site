import { useTranslation } from 'react-i18next';
/**
 * Tramites Tab - Admin View - Unified Screen
 * Main screen for managing service orders/projects
 * Includes detail modal and status management
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  FlatList,
  Linking,
  Animated,
  TextInput,
  Modal,
  ScrollView,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import api from '../../services/api';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const { width } = Dimensions.get('window');

interface ServiceOrder {
  id: string;
  order_number: string;
  user_id: string;
  client_id?: string;
  user_name?: string;
  client_name?: string;
  user_email?: string;
  client_email?: string;
  client_phone?: string;
  service_type: string;
  description: string;
  tax_year: number;
  status: string;
  priority: string;
  estimated_amount?: number;
  notes?: string;
  created_at: string;
  updated_at?: string;
  assigned_to_name?: string;
}

interface Stats {
  total: number;
  pending: number;
  in_progress: number;
  completed: number;
}

type FilterType = 'all' | 'pending' | 'in_progress' | 'completed';

// Animated Counter Component - Fixed to avoid iOS crash with addListener
const AnimatedCounter = ({ value, style }: { value: number; style?: any }) => {
  const [displayValue, setDisplayValue] = useState(0);
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Update display to target value after animation completes
    // Avoids addListener which causes iOS crash with Reanimated 3.17.x
    animatedValue.setValue(displayValue);
    Animated.timing(animatedValue, {
      toValue: value,
      duration: 800,
      useNativeDriver: false,
    }).start(() => {
      setDisplayValue(value);
    });
  }, [value]);

  return <Text style={style}>{displayValue}</Text>;
};

export default function TramitesScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<ServiceOrder[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, pending: 0, in_progress: 0, completed: 0 });
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<ServiceOrder | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadOrders();
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, []);

  useEffect(() => {
    filterOrders();
  }, [orders, activeFilter, searchQuery]);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const response = await api.get('/admin/service-orders?limit=500');
      const ordersData = response.data.orders || [];
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
        };
        setStats(newStats);
      }
    } catch (error) {
      console.error('Error loading orders:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadOrders();
  }, []);

  const filterOrders = () => {
    let filtered = [...orders];
    
    // Filter by status
    if (activeFilter !== 'all') {
      filtered = filtered.filter(o => o.status === activeFilter);
    }
    
    // Filter by search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(o => 
        (o.client_name || o.user_name || '').toLowerCase().includes(query) ||
        (o.order_number || '').toLowerCase().includes(query) ||
        (o.service_type || '').toLowerCase().includes(query)
      );
    }
    
    // Sort by date
    filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setFilteredOrders(filtered);
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    setUpdatingStatus(true);
    try {
      await api.patch(`/admin/service-orders/${orderId}`, { status: newStatus });
      
      // Update local state
      setOrders(prev => prev.map(o => 
        o.id === orderId ? { ...o, status: newStatus } : o
      ));
      
      if (selectedOrder?.id === orderId) {
        setSelectedOrder(prev => prev ? { ...prev, status: newStatus } : null);
      }
      
      // Update stats
      await loadOrders();
      
      Alert.alert('✅ Actualizado', 'El estado se ha actualizado correctamente');
    } catch (error) {
      Alert.alert('Error', 'No se pudo actualizar el estado');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'pending':
        return { label: 'Pendiente', color: '#F59E0B', bg: '#FEF3C7', text: '#B45309', gradient: ['#F59E0B', '#D97706'], icon: 'time' };
      case 'in_progress':
        return { label: 'En Progreso', color: '#3B82F6', bg: '#DBEAFE', text: '#1D4ED8', gradient: ['#3B82F6', '#2563EB'], icon: 'construct' };
      case 'completed':
        return { label: 'Completado', color: '#10B981', bg: '#D1FAE5', text: '#047857', gradient: ['#10B981', '#059669'], icon: 'checkmark-circle' };
      case 'cancelled':
        return { label: 'Cancelado', color: '#EF4444', bg: '#FEE2E2', text: '#B91C1C', gradient: ['#EF4444', '#DC2626'], icon: 'close-circle' };
      case 'pending_payment':
        return { label: 'Pago Pendiente', color: '#8B5CF6', bg: '#EDE9FE', text: '#6D28D9', gradient: ['#8B5CF6', '#7C3AED'], icon: 'card' };
      case 'paid':
        return { label: 'Pagado', color: '#10B981', bg: '#D1FAE5', text: '#047857', gradient: ['#10B981', '#059669'], icon: 'checkmark-done' };
      case 'processing':
        return { label: 'Procesando', color: '#0EA5E9', bg: '#E0F2FE', text: '#0369A1', gradient: ['#0EA5E9', '#0284C7'], icon: 'sync' };
      case 'on_hold':
        return { label: 'En Espera', color: '#F97316', bg: '#FFF7ED', text: '#C2410C', gradient: ['#F97316', '#EA580C'], icon: 'pause' };
      default:
        // Try to format unknown statuses nicely
        const formattedLabel = status
          .replace(/_/g, ' ')
          .replace(/\b\w/g, l => l.toUpperCase());
        return { label: formattedLabel, color: '#6B7280', bg: '#F3F4F6', text: '#374151', gradient: ['#9CA3AF', '#6B7280'], icon: 'help-circle' };
    }
  };

  // Translate service types to Spanish
  const getServiceTypeName = (serviceType: string): string => {
    const translations: { [key: string]: string } = {
      'passport_cuban': 'Pasaporte Cubano',
      'passport_us': 'Pasaporte USA',
      'tax_return': 'Declaración de Impuestos',
      'tax_preparation': 'Preparación de Impuestos',
      'itin_application': 'Solicitud de ITIN',
      'itin': 'Solicitud de ITIN',
      'translation': 'Traducción',
      'notary': 'Notaría',
      'consultation': 'Consulta',
      'immigration': 'Trámites de Inmigración',
      'travel_planning': 'Planificación de Viaje',
      'other': 'Otro Servicio',
    };
    
    // Check if there's a direct translation
    const key = serviceType.toLowerCase().replace(/\s+/g, '_');
    if (translations[key]) {
      return translations[key];
    }
    
    // If the service type already looks like a proper name, return it
    if (serviceType.includes(' ') && !serviceType.includes('_')) {
      return serviceType;
    }
    
    // Format unknown service types
    return serviceType
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  };

  const getPriorityConfig = (priority: string) => {
    switch (priority) {
      case 'high':
        return { label: 'Alta', color: '#EF4444', icon: 'flame' };
      case 'medium':
        return { label: 'Media', color: '#F59E0B', icon: 'remove' };
      default:
        return { label: 'Baja', color: '#10B981', icon: 'arrow-down' };
    }
  };

  const formatCurrency = (amount: number | undefined) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(amount || 0);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    try {
      return format(new Date(dateString), "d MMM yyyy", { locale: es });
    } catch {
      return dateString;
    }
  };

  const formatDateShort = (dateString: string) => {
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

  const getServiceIcon = (serviceType: string) => {
    const type = (serviceType || '').toLowerCase();
    if (type.includes('passport') || type.includes('pasaporte')) return 'document-text';
    if (type.includes('tax') || type.includes('impuesto')) return 'calculator';
    if (type.includes('itin')) return 'card';
    if (type.includes('translation') || type.includes('traduccion')) return 'language';
    if (type.includes('notary') || type.includes('notarial')) return 'ribbon';
    return 'briefcase';
  };

  const renderOrderCard = ({ item, index }: { item: ServiceOrder; index: number }) => {
    const statusConfig = getStatusConfig(item.status);
    const clientName = item.client_name || item.user_name || 'Sin cliente';

    return (
      <Animated.View
        style={[
          styles.cardContainer,
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
          style={styles.orderCard}
          activeOpacity={0.8}
          onPress={() => {
            setSelectedOrder(item);
            setShowDetailModal(true);
          }}
        >
          {/* Priority Indicator */}
          {item.priority === 'high' && (
            <View style={styles.priorityStrip}>
              <LinearGradient colors={['#EF4444', '#DC2626']} style={styles.priorityGradient} />
            </View>
          )}

          {/* Card Header */}
          <View style={styles.cardHeader}>
            <LinearGradient colors={statusConfig.gradient} style={styles.statusIconContainer}>
              <Ionicons name={getServiceIcon(item.service_type) as any} size={22} color="#FFF" />
            </LinearGradient>
            
            <View style={styles.cardTitleSection}>
              <View style={styles.titleRow}>
                <Text style={styles.orderNumber}>{item.order_number || 'Sin número'}</Text>
                {item.priority === 'high' && (
                  <View style={styles.priorityBadge}>
                    <Ionicons name="flame" size={12} color="#EF4444" />
                  </View>
                )}
              </View>
              <Text style={styles.clientName} numberOfLines={1}>{clientName}</Text>
            </View>
            
            <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
              <View style={[styles.statusDot, { backgroundColor: statusConfig.color }]} />
              <Text style={[styles.statusText, { color: statusConfig.text }]}>{statusConfig.label}</Text>
            </View>
          </View>

          {/* Service Info */}
          <View style={styles.serviceInfo}>
            <View style={styles.serviceRow}>
              <Ionicons name="briefcase-outline" size={14} color="#6B7280" />
              <Text style={styles.serviceText} numberOfLines={1}>
                {getServiceTypeName(item.service_type || item.description || 'Sin servicio')}
              </Text>
            </View>
          </View>

          {/* Details Grid */}
          <View style={styles.detailsGrid}>
            <View style={styles.detailItem}>
              <View style={styles.detailIconBg}>
                <Ionicons name="calendar" size={14} color="#6366F1" />
              </View>
              <Text style={styles.detailLabel}>Año</Text>
              <Text style={styles.detailValue}>{item.tax_year || 'N/A'}</Text>
            </View>
            
            <View style={styles.detailDivider} />
            
            <View style={styles.detailItem}>
              <View style={[styles.detailIconBg, { backgroundColor: '#ECFDF5' }]}>
                <Ionicons name="cash" size={14} color="#10B981" />
              </View>
              <Text style={styles.detailLabel}>Monto</Text>
              <Text style={styles.detailValue}>{formatCurrency(item.estimated_amount)}</Text>
            </View>
            
            <View style={styles.detailDivider} />
            
            <View style={styles.detailItem}>
              <View style={[styles.detailIconBg, { backgroundColor: '#FEF3C7' }]}>
                <Ionicons name="time" size={14} color="#F59E0B" />
              </View>
              <Text style={styles.detailLabel}>Creado</Text>
              <Text style={styles.detailValue}>{formatDateShort(item.created_at)}</Text>
            </View>
          </View>

          {/* Card Footer */}
          <View style={styles.cardFooter}>
            <View style={styles.quickActions}>
              {item.client_phone && (
                <>
                  <TouchableOpacity 
                    style={styles.actionBtn}
                    onPress={() => handleCall(item.client_phone)}
                  >
                    <Ionicons name="call" size={16} color="#3B82F6" />
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.actionBtn}
                    onPress={() => handleWhatsApp(item.client_phone)}
                  >
                    <Ionicons name="logo-whatsapp" size={16} color="#25D366" />
                  </TouchableOpacity>
                </>
              )}
            </View>
            
            <TouchableOpacity 
              style={styles.viewButton}
              onPress={() => {
                setSelectedOrder(item);
                setShowDetailModal(true);
              }}
            >
              <Text style={styles.viewButtonText}>Ver detalles</Text>
              <Ionicons name="arrow-forward" size={14} color="#6C1110" />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const filters = [
    { type: 'all' as FilterType, label: 'Total', count: stats.total, color: '#6C1110', icon: 'layers', gradient: ['#6C1110', '#8B1A19'] },
    { type: 'pending' as FilterType, label: 'Pendientes', count: stats.pending, color: '#F59E0B', icon: 'time', gradient: ['#F59E0B', '#D97706'] },
    { type: 'in_progress' as FilterType, label: 'En Curso', count: stats.in_progress, color: '#3B82F6', icon: 'construct', gradient: ['#3B82F6', '#2563EB'] },
    { type: 'completed' as FilterType, label: 'Listos', count: stats.completed, color: '#10B981', icon: 'checkmark-circle', gradient: ['#10B981', '#059669'] },
  ];

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <LinearGradient colors={['#1C3B72', '#2D5BA8']} style={styles.loadingGradient}>
          <View style={styles.loadingContent}>
            <ActivityIndicator size="large" color="#FFF" />
            <Text style={styles.loadingText}>Cargando trámites...</Text>
          </View>
        </LinearGradient>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Premium Header */}
      <LinearGradient
        colors={['#1C3B72', '#2D5BA8', '#3D6BC8']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 8 }]}
      >
        <View style={styles.headerDecoration}>
          <View style={[styles.decorCircle, styles.decorCircle1]} />
          <View style={[styles.decorCircle, styles.decorCircle2]} />
          <View style={[styles.decorCircle, styles.decorCircle3]} />
        </View>

        {/* Header Top */}
        <View style={styles.headerTop}>
          <View style={styles.headerTitleRow}>
            <View style={styles.headerIconBg}>
              <Ionicons name="folder-open" size={20} color="#FFF" />
            </View>
            <View>
              <Text style={styles.headerTitle}>Trámites</Text>
              <Text style={styles.headerSubtitle}>Gestión de servicios</Text>
            </View>
          </View>
          
          <View style={styles.headerActions}>
            <TouchableOpacity 
              style={styles.headerBtn}
              onPress={() => setShowSearch(!showSearch)}
            >
              <Ionicons name={showSearch ? "close" : "search"} size={20} color="#FFF" />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.headerBtn}
              onPress={onRefresh}
            >
              <Ionicons name="refresh" size={20} color="#FFF" />
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.headerBtn, styles.addBtn]}
              onPress={() => router.push('/_adminScreens/create-service')}
            >
              <Ionicons name="add" size={22} color="#1C3B72" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Search Bar */}
        {showSearch && (
          <View style={styles.searchContainer}>
            <View style={styles.searchBox}>
              <Ionicons name="search" size={18} color="#9CA3AF" />
              <TextInput
                style={styles.searchInput}
                placeholder={t('admin.searchNumberPlaceholder', 'Buscar por cliente, número...')}
                placeholderTextColor="#9CA3AF"
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={18} color="#9CA3AF" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Stats Cards */}
        <View style={styles.statsContainer}>
          {filters.map((filter) => (
            <TouchableOpacity
              key={filter.type}
              style={[
                styles.statCard,
                activeFilter === filter.type && styles.statCardActive
              ]}
              onPress={() => setActiveFilter(filter.type)}
              activeOpacity={0.7}
            >
              <View style={[styles.statIconBg, { backgroundColor: `${filter.color}20` }]}>
                <Ionicons name={filter.icon as any} size={16} color={filter.color} />
              </View>
              <AnimatedCounter value={filter.count} style={styles.statNumber} />
              <Text style={styles.statLabel}>{filter.label}</Text>
              {activeFilter === filter.type && (
                <View style={[styles.activeIndicator, { backgroundColor: filter.color }]} />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </LinearGradient>

      {/* Orders List */}
      <FlatList
        data={filteredOrders}
        renderItem={renderOrderCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1C3B72" />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <LinearGradient colors={['#EEF2FF', '#E0E7FF']} style={styles.emptyIconBg}>
                <Ionicons name="folder-open-outline" size={48} color="#6366F1" />
              </LinearGradient>
            </View>
            <Text style={styles.emptyTitle}>
              {searchQuery ? 'Sin resultados' : 'Sin trámites'}
            </Text>
            <Text style={styles.emptyText}>
              {searchQuery 
                ? `No se encontraron trámites para "${searchQuery}"`
                : 'Crea el primer trámite para comenzar'
              }
            </Text>
            {!searchQuery && (
              <TouchableOpacity 
                style={styles.emptyButton}
                onPress={() => router.push('/_adminScreens/create-service')}
              >
                <LinearGradient colors={['#1C3B72', '#2D5BA8']} style={styles.emptyButtonGradient}>
                  <Ionicons name="add-circle" size={20} color="#FFF" />
                  <Text style={styles.emptyButtonText}>Nuevo Trámite</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
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
              <View style={styles.modalHeaderContent}>
                <Text style={styles.modalTitle}>{selectedOrder?.order_number || 'Orden'}</Text>
                <Text style={styles.modalSubtitle}>{selectedOrder?.client_name || selectedOrder?.user_name}</Text>
              </View>
              <TouchableOpacity 
                style={styles.modalCloseBtn}
                onPress={() => setShowDetailModal(false)}
              >
                <Ionicons name="close" size={24} color="#FFF" />
              </TouchableOpacity>
            </LinearGradient>
            
            {selectedOrder && (
              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                {/* Contact Actions */}
                <View style={styles.contactActions}>
                  <TouchableOpacity 
                    style={styles.contactBtn}
                    onPress={() => handleCall(selectedOrder.client_phone)}
                  >
                    <LinearGradient colors={['#3B82F6', '#2563EB']} style={styles.contactBtnGradient}>
                      <Ionicons name="call" size={20} color="#FFF" />
                      <Text style={styles.contactBtnText}>Llamar</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.contactBtn}
                    onPress={() => handleWhatsApp(selectedOrder.client_phone)}
                  >
                    <LinearGradient colors={['#25D366', '#128C7E']} style={styles.contactBtnGradient}>
                      <Ionicons name="logo-whatsapp" size={20} color="#FFF" />
                      <Text style={styles.contactBtnText}>WhatsApp</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>

                {/* Service Info */}
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Servicio</Text>
                  <Text style={styles.modalSectionValue}>{getServiceTypeName(selectedOrder.service_type || selectedOrder.description || 'Sin servicio')}</Text>
                </View>

                <View style={styles.modalRow}>
                  <View style={styles.modalHalf}>
                    <Text style={styles.modalSectionTitle}>Año Fiscal</Text>
                    <Text style={styles.modalSectionValue}>{selectedOrder.tax_year || 'N/A'}</Text>
                  </View>
                  <View style={styles.modalHalf}>
                    <Text style={styles.modalSectionTitle}>Monto Estimado</Text>
                    <Text style={styles.modalSectionValue}>{formatCurrency(selectedOrder.estimated_amount)}</Text>
                  </View>
                </View>

                <View style={styles.modalRow}>
                  <View style={styles.modalHalf}>
                    <Text style={styles.modalSectionTitle}>Creado</Text>
                    <Text style={styles.modalSectionValue}>{formatDate(selectedOrder.created_at)}</Text>
                  </View>
                  <View style={styles.modalHalf}>
                    <Text style={styles.modalSectionTitle}>Email</Text>
                    <Text style={styles.modalSectionValue} numberOfLines={1}>
                      {selectedOrder.client_email || selectedOrder.user_email || 'N/A'}
                    </Text>
                  </View>
                </View>

                {selectedOrder.notes && (
                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionTitle}>Notas</Text>
                    <Text style={styles.modalSectionValue}>{selectedOrder.notes}</Text>
                  </View>
                )}

                {/* Status Update */}
                <Text style={styles.statusUpdateTitle}>Cambiar Estado</Text>
                <View style={styles.statusButtons}>
                  {['pending', 'in_progress', 'pending_payment', 'completed', 'cancelled'].map((status) => {
                    const config = getStatusConfig(status);
                    const isActive = selectedOrder.status === status;
                    return (
                      <TouchableOpacity
                        key={status}
                        style={[
                          styles.statusButton,
                          isActive && { borderColor: config.color, backgroundColor: config.bg }
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

                <View style={{ height: 40 }} />
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  loadingContainer: { flex: 1 },
  loadingGradient: { flex: 1 },
  loadingContent: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 16, fontSize: 16, color: '#FFF', fontWeight: '500' },
  
  // Header
  header: { paddingBottom: 16, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, overflow: 'hidden' },
  headerDecoration: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  decorCircle: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.06)' },
  decorCircle1: { width: 200, height: 200, top: -80, right: -50 },
  decorCircle2: { width: 150, height: 150, bottom: -40, left: -30 },
  decorCircle3: { width: 80, height: 80, top: 40, left: width / 2 - 40 },
  
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 16, zIndex: 1 },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerIconBg: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#FFF', letterSpacing: -0.5 },
  headerSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 1 },
  
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  addBtn: { backgroundColor: '#1E293B' },
  
  // Search
  searchContainer: { paddingHorizontal: 20, marginBottom: 12 },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E293B', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, gap: 10 },
  searchInput: { flex: 1, fontSize: 15, color: '#1F2937' },
  
  // Stats
  statsContainer: { flexDirection: 'row', paddingHorizontal: 12, gap: 8 },
  statCard: { 
    flex: 1, 
    backgroundColor: 'rgba(255,255,255,0.12)', 
    borderRadius: 16, 
    padding: 12, 
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  statCardActive: { backgroundColor: 'rgba(255,255,255,0.25)', borderColor: 'rgba(255,255,255,0.3)' },
  statIconBg: { width: 32, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
  statNumber: { fontSize: 20, fontWeight: '800', color: '#FFF' },
  statLabel: { fontSize: 9, color: 'rgba(255,255,255,0.8)', marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 },
  activeIndicator: { position: 'absolute', bottom: 6, width: 20, height: 3, borderRadius: 2 },
  
  // List
  listContent: { padding: 16, paddingBottom: 100 },
  
  // Card
  cardContainer: { marginBottom: 12 },
  orderCard: { 
    backgroundColor: '#1E293B', 
    borderRadius: 20, 
    padding: 16, 
    borderWidth: 1,
    borderColor: '#334155',
    overflow: 'hidden',
  },
  
  priorityStrip: { position: 'absolute', top: 0, left: 0, right: 0, height: 3 },
  priorityGradient: { flex: 1 },
  
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  statusIconContainer: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  cardTitleSection: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  orderNumber: { fontSize: 16, fontWeight: '700', color: '#F1F5F9' },
  priorityBadge: { backgroundColor: 'rgba(254, 226, 226, 0.15)', padding: 4, borderRadius: 6 },
  clientName: { fontSize: 13, color: '#94A3B8', marginTop: 3 },
  
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, gap: 6 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: '700' },
  
  serviceInfo: { backgroundColor: '#0F172A', borderRadius: 12, padding: 10, marginBottom: 12, borderWidth: 1, borderColor: '#334155' },
  serviceRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  serviceText: { fontSize: 13, color: '#94A3B8', flex: 1 },
  
  detailsGrid: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  detailItem: { flex: 1, alignItems: 'center' },
  detailIconBg: { width: 28, height: 28, borderRadius: 8, backgroundColor: 'rgba(99, 102, 241, 0.15)', justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  detailLabel: { fontSize: 10, color: '#64748B', marginBottom: 2 },
  detailValue: { fontSize: 13, fontWeight: '600', color: '#F1F5F9' },
  detailDivider: { width: 1, height: 40, backgroundColor: '#334155' },
  
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, borderTopWidth: 1, borderTopColor: '#334155' },
  quickActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  actionBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#0F172A', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#334155' },
  viewButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(196, 30, 58, 0.15)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, gap: 6 },
  viewButtonText: { fontSize: 13, fontWeight: '600', color: '#C41E3A' },
  
  // Empty
  emptyState: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 30 },
  emptyIconContainer: { marginBottom: 20 },
  emptyIconBg: { width: 100, height: 100, borderRadius: 30, justifyContent: 'center', alignItems: 'center' },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#F1F5F9', marginBottom: 8 },
  emptyText: { fontSize: 14, color: '#94A3B8', textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  emptyButton: { borderRadius: 14, overflow: 'hidden' },
  emptyButtonGradient: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 14, gap: 8 },
  emptyButtonText: { fontSize: 15, fontWeight: '700', color: '#FFF' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  modalHeaderContent: { flex: 1 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#FFF' },
  modalSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  modalCloseBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  modalBody: { padding: 20 },

  // Contact Actions
  contactActions: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  contactBtn: { flex: 1, borderRadius: 12, overflow: 'hidden' },
  contactBtnGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, gap: 8 },
  contactBtnText: { fontSize: 15, fontWeight: '600', color: '#FFF' },

  // Modal Sections
  modalSection: { marginBottom: 16 },
  modalSectionTitle: { fontSize: 12, color: '#9CA3AF', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  modalSectionValue: { fontSize: 16, color: '#1F2937', fontWeight: '500' },
  modalRow: { flexDirection: 'row', gap: 16, marginBottom: 16 },
  modalHalf: { flex: 1 },

  // Status Update
  statusUpdateTitle: { fontSize: 14, fontWeight: '700', color: '#374151', marginTop: 8, marginBottom: 12 },
  statusButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statusButton: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 2, borderColor: '#E5E7EB', gap: 6 },
  statusButtonText: { fontSize: 13, fontWeight: '600' },
});
