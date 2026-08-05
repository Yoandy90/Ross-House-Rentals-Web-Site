import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
  Linking,
  Dimensions,
  AppState,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { useThemeColors } from '../../constants/colors';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import * as Notifications from 'expo-notifications';

const { width } = Dimensions.get('window');
const BACKEND_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

interface InvoiceItem {
  description: string;
  quantity: number;
  unit_price: number;
}

interface Invoice {
  id: string;
  _id?: string;
  invoice_number: string;
  user_id: string;
  service_name: string;
  items: InvoiceItem[];
  subtotal: number;
  tax: number;
  total: number;
  status: 'pending' | 'paid' | 'overdue' | 'cancelled';
  created_at: string;
  due_date?: string;
  paid_at?: string;
  notes?: string;
}

export default function InvoicesScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<string>('all');

  // Refresh invoices when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchInvoices();
    }, [])
  );

  // Listen for push notifications about invoices
  useEffect(() => {
    const notificationListener = Notifications.addNotificationReceivedListener(notification => {
      const data = notification.request.content.data;
      if (data?.type === 'invoice' || data?.action === 'new_invoice') {
        // Refresh invoices when a new invoice notification is received
        fetchInvoices();
      }
    });

    const responseListener = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      if (data?.type === 'invoice' && data?.invoice_id) {
        // If user taps on invoice notification, navigate to payment
        router.push({
          pathname: '/payment-invoice',
          params: {
            invoiceId: data.invoice_id as string,
            invoiceNumber: data.invoice_number as string || '',
            amount: data.amount as string || '0',
          }
        });
      }
    });

    // Also listen for app state changes to refresh when coming back
    const appStateListener = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        fetchInvoices();
      }
    });

    return () => {
      notificationListener.remove();
      responseListener.remove();
      appStateListener.remove();
    };
  }, [router]);

  const fetchInvoices = async () => {
    try {
      const token = await AsyncStorage.getItem('session_token');
      if (!token) {
        Alert.alert(t('common.error'), 'No se encontró sesión activa.');
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const response = await api.get('/invoices/my-invoices');

      setInvoices(response.data || []);
    } catch (error: any) {
      console.error('Error fetching invoices:', error);
      // Only show alert if not a network/timeout issue
      if (error.response) {
        Alert.alert(t('common.error'), error.response?.data?.detail || 'Error cargando facturas');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const downloadPDF = async (invoice: Invoice) => {
    // Navigate to invoice detail screen instead of downloading PDF
    const invoiceId = invoice.id || invoice._id;
    router.push({
      pathname: '/invoice-detail',
      params: {
        invoiceId: invoiceId || '',
        invoiceNumber: invoice.invoice_number || '',
        amount: (invoice.total || 0).toString(),
        status: invoice.status || 'paid',
        serviceType: invoice.service_name || '',
        createdAt: invoice.created_at || '',
        paidAt: invoice.paid_at || '',
      }
    });
  };

  const handlePayInvoice = async (invoice: Invoice) => {
    router.push({
      pathname: '/payment-invoice',
      params: {
        invoiceId: invoice.id || invoice._id,
        invoiceNumber: invoice.invoice_number,
        amount: invoice.total.toString(),
      }
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return '#10b981';
      case 'pending': return '#f59e0b';
      case 'overdue': return '#ef4444';
      case 'cancelled': return '#6b7280';
      default: return '#6b7280';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid': return 'checkmark-circle';
      case 'pending': return 'time';
      case 'overdue': return 'alert-circle';
      case 'cancelled': return 'close-circle';
      default: return 'help-circle';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const filteredInvoices = invoices.filter(inv => {
    if (selectedFilter === 'all') return true;
    return inv.status === selectedFilter;
  });

  const stats = {
    total: invoices.length,
    pending: invoices.filter(i => i.status === 'pending').length,
    paid: invoices.filter(i => i.status === 'paid').length,
    overdue: invoices.filter(i => i.status === 'overdue').length,
    totalAmount: invoices.reduce((sum, i) => sum + i.total, 0),
    pendingAmount: invoices.filter(i => i.status === 'pending').reduce((sum, i) => sum + i.total, 0),
  };

  const renderInvoice = ({ item }: { item: Invoice }) => {
    const statusColor = getStatusColor(item.status);
    const statusIcon = getStatusIcon(item.status);
    const isUrgent = item.status === 'overdue';
    const isPending = item.status === 'pending' || item.status === 'overdue';

    return (
      <TouchableOpacity 
        style={[
          styles.invoiceCard,
          isUrgent && styles.invoiceCardUrgent
        ]}
        activeOpacity={0.9}
        onPress={() => isPending ? handlePayInvoice(item) : downloadPDF(item)}
      >
        {/* Urgent Banner */}
        {isUrgent && (
          <View style={styles.urgentBanner}>
            <Ionicons name="warning" size={14} color="#fff" />
            <Text style={styles.urgentBannerText}>¡Factura Vencida! Paga ahora para evitar cargos adicionales</Text>
          </View>
        )}
        
        <View style={styles.cardRow}>
          {/* Status indicator bar */}
          <View style={[styles.statusBar, { backgroundColor: statusColor }]} />
          
          <View style={styles.cardContent}>
          {/* Header Row */}
          <View style={styles.cardHeader}>
            <View style={styles.invoiceInfo}>
              <Text style={styles.invoiceNumber}>{item.invoice_number}</Text>
              <Text style={styles.serviceName} numberOfLines={1}>{item.service_name}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: statusColor + '15' }]}>
              <Ionicons name={statusIcon as any} size={14} color={statusColor} />
              <Text style={[styles.statusText, { color: statusColor }]}>
                {item.status === 'paid' ? t('invoices.status.paid') : 
                 item.status === 'pending' ? t('invoices.status.pending') : 
                 item.status === 'overdue' ? t('invoices.status.overdue') : t('invoices.status.cancelled')}
              </Text>
            </View>
          </View>

          {/* Amount */}
          <View style={styles.amountRow}>
            <Text style={styles.amountLabel}>Total</Text>
            <Text style={[styles.amountValue, isUrgent && { color: '#ef4444' }]}>${item.total.toFixed(2)}</Text>
          </View>

          {/* Date Info */}
          <View style={styles.dateRow}>
            <View style={styles.dateItem}>
              <Ionicons name="calendar-outline" size={14} color="#64748b" />
              <Text style={styles.dateText}>Creada: {formatDate(item.created_at)}</Text>
            </View>
            {item.due_date && (item.status === 'pending' || item.status === 'overdue') && (
              <View style={styles.dateItem}>
                <Ionicons name="time-outline" size={14} color={isUrgent ? '#ef4444' : '#f59e0b'} />
                <Text style={[styles.dateText, { color: isUrgent ? '#ef4444' : '#f59e0b', fontWeight: isUrgent ? '600' : '400' }]}>
                  {isUrgent ? `⚠️ ${t('invoices.overdue')}: ` : `${t('invoices.dueDate')}: `}{formatDate(item.due_date)}
                </Text>
              </View>
            )}
            {item.paid_at && item.status === 'paid' && (
              <View style={styles.dateItem}>
                <Ionicons name="checkmark-circle-outline" size={14} color="#10b981" />
                <Text style={[styles.dateText, { color: '#10b981' }]}>
                  Pagada: {formatDate(item.paid_at)}
                </Text>
              </View>
            )}
          </View>

          {/* Actions */}
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={styles.downloadButton}
              onPress={(e) => {
                e.stopPropagation();
                downloadPDF(item);
              }}
              disabled={downloadingId === (item.id || item._id)}
            >
              {downloadingId === (item.id || item._id) ? (
                <ActivityIndicator size="small" color="#6C1110" />
              ) : (
                <>
                  <Ionicons name="document-text-outline" size={18} color="#6C1110" />
                  <Text style={styles.downloadText}>PDF</Text>
                </>
              )}
            </TouchableOpacity>

            {isPending && (
              <TouchableOpacity
                style={[styles.payButton, isUrgent && styles.payButtonUrgent]}
                onPress={(e) => {
                  e.stopPropagation();
                  handlePayInvoice(item);
                }}
              >
                <Ionicons name="card-outline" size={18} color="#fff" />
                <Text style={styles.payButtonText}>
                  {isUrgent ? `🔥 ${t('invoices.payNow')}` : t('invoices.payNow')}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconContainer}>
        <Ionicons name="receipt-outline" size={60} color="#6C1110" />
      </View>
      <Text style={styles.emptyTitle}>No tienes facturas</Text>
      <Text style={styles.emptyDescription}>
        Cuando solicites un servicio, tus facturas aparecerán aquí
      </Text>
    </View>
  );

  const FilterButton = ({ filter, label, count }: { filter: string; label: string; count: number }) => (
    <TouchableOpacity
      style={[
        styles.filterButton,
        selectedFilter === filter && styles.filterButtonActive
      ]}
      onPress={() => setSelectedFilter(filter)}
    >
      <Text style={[
        styles.filterText,
        selectedFilter === filter && styles.filterTextActive
      ]}>
        {label}
      </Text>
      {count > 0 && (
        <View style={[
          styles.filterBadge,
          selectedFilter === filter && styles.filterBadgeActive
        ]}>
          <Text style={[
            styles.filterBadgeText,
            selectedFilter === filter && styles.filterBadgeTextActive
          ]}>
            {count}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Header with Wave */}
      <View style={styles.headerContainer}>
        <LinearGradient
          colors={['#8B0000', '#DC143C', '#4682B4']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.gradientHeader, { paddingTop: insets.top }]}
        >
          {/* Header Title */}
          <View style={styles.headerContent}>
            <View style={styles.headerTextContainer}>
              <Text style={styles.headerTitle}>Mis Facturas</Text>
              <Text style={styles.headerSubtitle}>
                {stats.total} facturas • ${stats.totalAmount.toFixed(2)} total
              </Text>
            </View>
          </View>

          {/* Stats Cards */}
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Ionicons name="time" size={20} color="#f59e0b" />
              <Text style={styles.statValue}>{stats.pending}</Text>
              <Text style={styles.statLabel}>Pendientes</Text>
            </View>
            <View style={styles.statCard}>
              <Ionicons name="checkmark-circle" size={20} color="#10b981" />
              <Text style={styles.statValue}>{stats.paid}</Text>
              <Text style={styles.statLabel}>Pagadas</Text>
            </View>
            <View style={styles.statCard}>
              <Ionicons name="cash" size={20} color="#fff" />
              <Text style={styles.statValue}>${stats.pendingAmount.toFixed(0)}</Text>
              <Text style={styles.statLabel}>Por Pagar</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Wave Shape */}
        <Svg
          height="40"
          width="100%"
          viewBox="0 0 1440 120"
          style={styles.wave}
          preserveAspectRatio="none"
        >
          <Defs>
            <SvgLinearGradient id="waveGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <Stop offset="0%" stopColor="#8B0000" />
              <Stop offset="50%" stopColor="#DC143C" />
              <Stop offset="100%" stopColor="#4682B4" />
            </SvgLinearGradient>
          </Defs>
          <Path
            fill="url(#waveGradient)"
            d="M0,64L80,69.3C160,75,320,85,480,80C640,75,800,53,960,48C1120,43,1280,53,1360,58.7L1440,64L1440,0L1360,0C1280,0,1120,0,960,0C800,0,640,0,480,0C320,0,160,0,80,0L0,0Z"
          />
        </Svg>
      </View>

      {/* Filters */}
      <View style={styles.filtersContainer}>
        <FilterButton filter="all" label={t('common.all')} count={stats.total} />
        <FilterButton filter="pending" label={t('invoices.status.pending')} count={stats.pending} />
        <FilterButton filter="paid" label={t('invoices.status.paid')} count={stats.paid} />
        <FilterButton filter="overdue" label={t('invoices.status.overdue')} count={stats.overdue} />
      </View>

      {/* Invoice List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6C1110" />
          <Text style={styles.loadingText}>Cargando facturas...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredInvoices}
          renderItem={renderInvoice}
          keyExtractor={(item) => item.id || item._id || item.invoice_number}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={renderEmpty}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                fetchInvoices();
              }}
              colors={['#6C1110']}
              tintColor="#6C1110"
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  headerContainer: {
    backgroundColor: '#f8fafc',
  },
  gradientHeader: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 20,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginTop: 4,
  },
  statLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  wave: {
    marginTop: -1,
  },
  filtersContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    backgroundColor: '#f1f5f9',
  },
  filterButtonActive: {
    backgroundColor: '#6C1110',
  },
  filterText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748b',
  },
  filterTextActive: {
    color: '#fff',
  },
  filterBadge: {
    backgroundColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 6,
  },
  filterBadgeActive: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  filterBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
  },
  filterBadgeTextActive: {
    color: '#fff',
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  invoiceCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    overflow: 'hidden',
  },
  invoiceCardUrgent: {
    borderWidth: 2,
    borderColor: '#ef4444',
    shadowColor: '#ef4444',
    shadowOpacity: 0.2,
  },
  urgentBanner: {
    backgroundColor: '#ef4444',
    paddingVertical: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  urgentBannerText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  cardRow: {
    flexDirection: 'row',
    flex: 1,
  },
  statusBar: {
    width: 4,
  },
  cardContent: {
    flex: 1,
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  invoiceInfo: {
    flex: 1,
    marginRight: 12,
  },
  invoiceNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
  },
  serviceName: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    marginBottom: 12,
  },
  amountLabel: {
    fontSize: 14,
    color: '#64748b',
  },
  amountValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#6C1110',
  },
  dateRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 12,
  },
  dateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dateText: {
    fontSize: 12,
    color: '#64748b',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#6C1110',
    gap: 6,
  },
  downloadText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6C1110',
  },
  payButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#10b981',
    gap: 6,
  },
  payButtonUrgent: {
    backgroundColor: '#ef4444',
  },
  payButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748b',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 40,
  },
  emptyIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#fef2f2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
  },
});
