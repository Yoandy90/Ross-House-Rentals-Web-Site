import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useThemeColors } from '../../constants/colors';
import api from '../../services/api';
import CustomHeader from '../../components/CustomHeader';
import { useTranslation } from 'react-i18next';

interface Invoice {
  id: string;
  invoice_number: string;
  service_type: string;
  description?: string;
  amount: number;
  status: string;
  payment_link?: string;
  created_at: string;
  paid_at?: string;
  due_date?: string;
}

export default function MisFacturas() {
  const colors = useThemeColors();
  const { t } = useTranslation();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [totalPending, setTotalPending] = useState(0);
  const [totalAmountPending, setTotalAmountPending] = useState(0);

  useEffect(() => {
    loadInvoices();
  }, []);

  const loadInvoices = async () => {
    try {
      const response = await api.get('/my-invoices');
      if (response.data.success) {
        setInvoices(response.data.invoices || []);
        setTotalPending(response.data.total_pending || 0);
        setTotalAmountPending(response.data.total_amount_pending || 0);
      }
    } catch (error) {
      console.error('Error loading invoices:', error);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadInvoices();
  }, []);

  const formatCurrency = (value: number) => {
    return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-MX', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'paid':
        return { label: t('misFacturas.paid'), color: '#10B981', bg: '#D1FAE5', icon: 'checkmark-circle' };
      case 'pending':
        return { label: t('common.pending', 'Pendiente'), color: '#F59E0B', bg: '#FEF3C7', icon: 'time' };
      case 'overdue':
        return { label: t('misFacturas.overdue'), color: '#EF4444', bg: '#FEE2E2', icon: 'alert-circle' };
      default:
        return { label: status, color: '#6B7280', bg: '#F3F4F6', icon: 'help-circle' };
    }
  };

  const handlePay = async (invoice: Invoice) => {
    if (invoice.payment_link) {
      Linking.openURL(invoice.payment_link);
    } else {
      // Generate payment link
      try {
        const response = await api.post(`/invoices/${invoice.id}/payment-link`);
        if (response.data.success && response.data.payment_url) {
          Linking.openURL(response.data.payment_url);
        }
      } catch (error) {
        Alert.alert('Error', 'No se pudo generar el link de pago. Por favor intente más tarde.');
      }
    }
  };

  const renderInvoice = ({ item }: { item: Invoice }) => {
    const statusConfig = getStatusConfig(item.status);
    const isPending = item.status === 'pending' || item.status === 'overdue';

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.invoiceInfo}>
            <Text style={styles.invoiceNumber}>#{item.invoice_number}</Text>
            <Text style={styles.serviceType}>{item.service_type}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
            <Ionicons name={statusConfig.icon as any} size={14} color={statusConfig.color} />
            <Text style={[styles.statusText, { color: statusConfig.color }]}>
              {statusConfig.label}
            </Text>
          </View>
        </View>

        <View style={styles.amountSection}>
          <Text style={styles.amountLabel}>Monto Total</Text>
          <Text style={[styles.amount, { color: isPending ? '#1F2937' : '#10B981' }]}>
            {formatCurrency(item.amount)}
          </Text>
        </View>

        <View style={styles.detailsRow}>
          <View style={styles.detailItem}>
            <Ionicons name="calendar-outline" size={14} color="#6B7280" />
            <Text style={styles.detailText}>Creada: {formatDate(item.created_at)}</Text>
          </View>
          {item.due_date && (
            <View style={styles.detailItem}>
              <Ionicons name="hourglass-outline" size={14} color="#6B7280" />
              <Text style={styles.detailText}>Vence: {formatDate(item.due_date)}</Text>
            </View>
          )}
          {item.paid_at && (
            <View style={styles.detailItem}>
              <Ionicons name="checkmark-done" size={14} color="#10B981" />
              <Text style={[styles.detailText, { color: '#10B981' }]}>
                Pagada: {formatDate(item.paid_at)}
              </Text>
            </View>
          )}
        </View>

        {isPending && (
          <TouchableOpacity
            style={styles.payButton}
            onPress={() => handlePay(item)}
          >
            <LinearGradient
              colors={['#10B981', '#059669']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.payButtonGradient}
            >
              <Ionicons name="card" size={20} color="#fff" />
              <Text style={styles.payButtonText}>Pagar Ahora</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <CustomHeader title={t('misFacturas.title')} showBack />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Cargando facturas...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <CustomHeader title="Mis Facturas" showBack />
      
      {/* Summary Card */}
      {totalPending > 0 && (
        <LinearGradient
          colors={['#F59E0B', '#D97706']}
          style={styles.summaryCard}
        >
          <View style={styles.summaryContent}>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Facturas Pendientes</Text>
                <Text style={styles.summaryValue}>{totalPending}</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Total por Pagar</Text>
                <Text style={styles.summaryAmount}>{formatCurrency(totalAmountPending)}</Text>
              </View>
            </View>
          </View>
        </LinearGradient>
      )}

      <FlatList
        data={invoices}
        renderItem={renderInvoice}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <LinearGradient
              colors={['#F3F4F6', '#E5E7EB']}
              style={styles.emptyIconBg}
            >
              <Ionicons name="receipt-outline" size={48} color="#9CA3AF" />
            </LinearGradient>
            <Text style={styles.emptyTitle}>Sin Facturas</Text>
            <Text style={styles.emptyText}>
              No tienes facturas registradas. Aparecerán aquí después de tu servicio.
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  summaryCard: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 20,
    overflow: 'hidden',
  },
  summaryContent: {
    flex: 1,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  summaryLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  summaryAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  invoiceInfo: {
    flex: 1,
  },
  invoiceNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  serviceType: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  amountSection: {
    padding: 16,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  amountLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  amount: {
    fontSize: 32,
    fontWeight: 'bold',
    marginTop: 4,
  },
  detailsRow: {
    padding: 12,
    gap: 8,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailText: {
    fontSize: 13,
    color: '#6B7280',
  },
  payButton: {
    marginTop: 0,
  },
  payButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  payButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
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
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
  },
});
