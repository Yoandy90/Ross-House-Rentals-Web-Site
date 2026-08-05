/**
 * Admin Invoices Management Screen - Modern Premium Design
 * Redesigned with gradients, stats cards and modern UI
 */
import React, { useState, useEffect, useRef } from 'react';
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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import api from '../../services/api';

const { width: screenWidth } = Dimensions.get('window');

interface Invoice {
  id: string;
  _id?: string;
  invoice_number: string;
  user_id: string;
  user_name?: string;
  user_email?: string;
  client_id?: string;
  client_name?: string;
  client_email?: string;
  subtotal: number;
  tax: number;
  total: number;
  status: string;
  due_date: string;
  created_at: string;
}

interface Stats {
  total: number;
  pending: number;
  paid: number;
  overdue: number;
  totalAmount: number;
  pendingAmount: number;
}

const AdminInvoices = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scrollY = useRef(new Animated.Value(0)).current;
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<string>('all');
  const [stats, setStats] = useState<Stats>({
    total: 0,
    pending: 0,
    paid: 0,
    overdue: 0,
    totalAmount: 0,
    pendingAmount: 0,
  });

  useEffect(() => {
    loadInvoices();
    loadStats();
  }, [filter]);

  const loadStats = async () => {
    try {
      // First try the stats endpoint
      const response = await api.get('/admin/invoices/stats');
      const data = response.data;
      
      // Check if total_amount exists (new backend), otherwise use total_revenue
      const totalAmt = data.total_amount ?? data.total_revenue ?? 0;
      
      setStats({
        total: data.total_invoices || 0,
        pending: data.pending_invoices || 0,
        paid: data.paid_invoices || 0,
        overdue: data.overdue_invoices || 0,
        totalAmount: totalAmt,
        pendingAmount: data.pending_amount || 0,
      });
    } catch (error) {
      console.error('Error loading invoice stats:', error);
      // Fallback: calculate from invoices if stats endpoint fails
    }
  };

  const loadInvoices = async () => {
    try {
      const params: any = { limit: 1000 }; // Increased limit to get all invoices
      if (filter !== 'all') {
        params.status = filter;
      }
      const response = await api.get('/admin/invoices', { params });
      const invoicesData = Array.isArray(response.data) ? response.data : (response.data.invoices || []);
      setInvoices(invoicesData);
      
      // If stats weren't loaded or had issues, calculate from invoices
      if (stats.totalAmount === 0 && invoicesData.length > 0) {
        const calculatedStats = {
          total: invoicesData.length,
          pending: invoicesData.filter((i: Invoice) => i.status === 'pending').length,
          paid: invoicesData.filter((i: Invoice) => i.status === 'paid').length,
          overdue: invoicesData.filter((i: Invoice) => i.status === 'overdue').length,
          totalAmount: invoicesData.reduce((sum: number, i: Invoice) => sum + (i.total || 0), 0),
          pendingAmount: invoicesData
            .filter((i: Invoice) => i.status === 'pending' || i.status === 'overdue')
            .reduce((sum: number, i: Invoice) => sum + (i.total || 0), 0),
        };
        setStats(calculatedStats);
      }
    } catch (error) {
      console.error('Error loading invoices:', error);
      Alert.alert('Error', 'No se pudieron cargar las facturas');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadInvoices();
    loadStats();
  };

  const getStatusConfig = (status: string) => {
    switch (status.toLowerCase()) {
      case 'paid':
        return { 
          bg: '#ECFDF5', 
          text: '#059669', 
          icon: 'checkmark-circle',
          gradient: ['#10B981', '#059669'],
          label: 'Pagada'
        };
      case 'pending':
        return { 
          bg: '#FEF3C7', 
          text: '#D97706', 
          icon: 'time',
          gradient: ['#F59E0B', '#D97706'],
          label: 'Pendiente'
        };
      case 'overdue':
        return { 
          bg: '#FEE2E2', 
          text: '#DC2626', 
          icon: 'alert-circle',
          gradient: ['#EF4444', '#DC2626'],
          label: 'Vencida'
        };
      case 'cancelled':
        return { 
          bg: '#F3F4F6', 
          text: '#6B7280', 
          icon: 'close-circle',
          gradient: ['#9CA3AF', '#6B7280'],
          label: 'Cancelada'
        };
      default:
        return { 
          bg: '#F3F4F6', 
          text: '#374151', 
          icon: 'document',
          gradient: ['#6B7280', '#4B5563'],
          label: status
        };
    }
  };

  const formatCurrency = (amount: number | null | undefined) => {
    if (amount === null || amount === undefined) return '$0';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('es-ES', {
        day: '2-digit',
        month: 'short',
      });
    } catch (error) {
      return 'N/A';
    }
  };

  const renderInvoiceCard = ({ item, index }: { item: Invoice; index: number }) => {
    const statusConfig = getStatusConfig(item.status);
    const invoiceId = item.id || item._id;

    return (
      <Animated.View
        style={[
          styles.invoiceCard,
          {
            opacity: 1,
            transform: [{ scale: 1 }],
          },
        ]}
      >
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => {
            router.push({
              pathname: '/_adminScreens/invoice-details',
              params: { invoiceId: invoiceId }
            });
          }}
        >
          <View style={styles.cardContent}>
            {/* Left Section - Icon & Info */}
            <View style={styles.cardLeft}>
              <LinearGradient
                colors={statusConfig.gradient}
                style={styles.invoiceIconBg}
              >
                <Ionicons name={statusConfig.icon as any} size={20} color="#FFF" />
              </LinearGradient>
              <View style={styles.invoiceInfo}>
                <Text style={styles.invoiceNumber}>{item.invoice_number}</Text>
                <Text style={styles.clientName} numberOfLines={1}>
                  {item.user_name || item.client_name || 'Sin nombre'}
                </Text>
                <View style={styles.dateRow}>
                  <Ionicons name="calendar-outline" size={12} color="#9CA3AF" />
                  <Text style={styles.dateText}>{formatDate(item.created_at)}</Text>
                </View>
              </View>
            </View>

            {/* Right Section - Amount & Status */}
            <View style={styles.cardRight}>
              <Text style={styles.amount}>{formatCurrency(item.total)}</Text>
              <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
                <Text style={[styles.statusText, { color: statusConfig.text }]}>
                  {statusConfig.label}
                </Text>
              </View>
            </View>
          </View>

          {/* Due Date Bar (for pending/overdue) */}
          {(item.status === 'pending' || item.status === 'overdue') && item.due_date && (
            <View style={[styles.dueBar, { backgroundColor: statusConfig.bg }]}>
              <Ionicons name="time-outline" size={14} color={statusConfig.text} />
              <Text style={[styles.dueText, { color: statusConfig.text }]}>
                Vence: {formatDate(item.due_date)}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const filters = [
    { label: 'Todas', value: 'all', count: stats.total, color: '#6C1110' },
    { label: 'Pendientes', value: 'pending', count: stats.pending, color: '#F59E0B' },
    { label: 'Pagadas', value: 'paid', count: stats.paid, color: '#10B981' },
    { label: 'Vencidas', value: 'overdue', count: stats.overdue, color: '#EF4444' },
  ];

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <LinearGradient
          colors={['#6C1110', '#8B1A19']}
          style={styles.loadingGradient}
        >
          <ActivityIndicator size="large" color="#FFF" />
          <Text style={styles.loadingText}>Cargando facturas...</Text>
        </LinearGradient>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Premium Header */}
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

        <View style={styles.headerTop}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="chevron-back" size={24} color="#FFF" />
          </TouchableOpacity>
          
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Facturas</Text>
            <Text style={styles.headerSubtitle}>{stats.total} registradas</Text>
          </View>
          
          <TouchableOpacity 
            style={styles.addButton}
            onPress={() => router.push('/_adminScreens/create-invoice')}
          >
            <Ionicons name="add" size={24} color="#FFF" />
          </TouchableOpacity>
        </View>

        {/* Stats Cards */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statAmount}>{formatCurrency(stats.totalAmount)}</Text>
            <Text style={styles.statLabel}>Total Facturado</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCard}>
            <Text style={[styles.statAmount, { color: '#FEF3C7' }]}>
              {formatCurrency(stats.pendingAmount)}
            </Text>
            <Text style={styles.statLabel}>Por Cobrar</Text>
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
                filter === item.value && styles.filterTabActive,
                filter === item.value && { borderColor: item.color },
              ]}
              onPress={() => setFilter(item.value)}
            >
              <Text
                style={[
                  styles.filterTabText,
                  filter === item.value && { color: item.color, fontWeight: '700' },
                ]}
              >
                {item.label}
              </Text>
              <View style={[
                styles.filterBadge, 
                { backgroundColor: filter === item.value ? item.color : '#E5E7EB' }
              ]}>
                <Text style={[
                  styles.filterBadgeText,
                  { color: filter === item.value ? '#FFF' : '#6B7280' }
                ]}>
                  {item.count}
                </Text>
              </View>
            </TouchableOpacity>
          )}
          keyExtractor={(item) => item.value}
        />
      </View>

      {/* Invoices List */}
      <FlatList
        data={invoices}
        renderItem={renderInvoiceCard}
        keyExtractor={(item) => item.id || item._id || Math.random().toString()}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            tintColor="#6C1110"
          />
        }
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <LinearGradient
              colors={['#FEF2F2', '#FEE2E2']}
              style={styles.emptyIconBg}
            >
              <Ionicons name="receipt-outline" size={48} color="#6C1110" />
            </LinearGradient>
            <Text style={styles.emptyTitle}>No hay facturas</Text>
            <Text style={styles.emptyText}>
              Crea tu primera factura usando el botón +
            </Text>
            <TouchableOpacity
              style={styles.emptyButton}
              onPress={() => router.push('/_adminScreens/create-invoice')}
            >
              <LinearGradient
                colors={['#6C1110', '#8B1A19']}
                style={styles.emptyButtonGradient}
              >
                <Ionicons name="add" size={20} color="#FFF" />
                <Text style={styles.emptyButtonText}>Crear Factura</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
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
  // Stats Row
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    paddingHorizontal: 24,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
  },
  statAmount: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFF',
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginHorizontal: 16,
  },
  // Filter Styles
  filterContainer: {
    paddingVertical: 16,
  },
  filterList: {
    paddingHorizontal: 16,
    gap: 10,
  },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#1E293B',
    borderWidth: 2,
    borderColor: '#334155',
    gap: 8,
  },
  filterTabActive: {
    backgroundColor: '#1E293B',
  },
  filterTabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#94A3B8',
  },
  filterBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 24,
    alignItems: 'center',
  },
  filterBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  // List Styles
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  // Invoice Card
  invoiceCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
    overflow: 'hidden',
  },
  cardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  invoiceIconBg: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  invoiceInfo: {
    flex: 1,
  },
  invoiceNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F1F5F9',
    marginBottom: 2,
  },
  clientName: {
    fontSize: 14,
    color: '#94A3B8',
    marginBottom: 4,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dateText: {
    fontSize: 12,
    color: '#64748B',
  },
  cardRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  amount: {
    fontSize: 20,
    fontWeight: '800',
    color: '#F1F5F9',
    marginBottom: 6,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  dueBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 6,
  },
  dueText: {
    fontSize: 12,
    fontWeight: '600',
  },
  // Empty State
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
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
    color: '#F1F5F9',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
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
});

export default AdminInvoices;
