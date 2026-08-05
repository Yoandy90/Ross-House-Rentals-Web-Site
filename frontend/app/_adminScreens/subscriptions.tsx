import React, { useState, useEffect } from 'react';

import AdminHeader from '../../components/admin/AdminHeader';
import { useRouter } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../../constants/colors';
import api from '../../services/api';


interface RevenueStats {
  active_subscriptions: number;
  monthly_revenue: number;
  mrr: number;
  month: string;
}

interface Subscription {
  id: string;
  user_id: string;
  plan_id: string;
  status: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  user_email: string;
  user_name: string;
  plan_name: string;
  created_at: string;
}

export default function AdminSubscriptionsScreen() {
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<RevenueStats | null>(null);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [filteredSubscriptions, setFilteredSubscriptions] = useState<Subscription[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    filterSubscriptions();
  }, [searchQuery, filterStatus, subscriptions]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load revenue stats
      const statsResponse = await api.get('/payments/admin/revenue-stats');
      setStats(statsResponse.data);
      
      // Load all subscriptions
      const subsResponse = await api.get('/payments/admin/subscriptions');
      setSubscriptions(subsResponse.data);
    } catch (error: any) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const filterSubscriptions = () => {
    let filtered = [...subscriptions];
    
    // Filter by status
    if (filterStatus !== 'all') {
      filtered = filtered.filter(sub => sub.status === filterStatus);
    }
    
    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(sub => 
        sub.user_email.toLowerCase().includes(query) ||
        sub.user_name.toLowerCase().includes(query) ||
        sub.plan_name.toLowerCase().includes(query)
      );
    }
    
    setFilteredSubscriptions(filtered);
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      active: colors.success,
      canceled: colors.error,
      past_due: colors.warning,
      trialing: colors.info,
      incomplete: colors.textGray,
    };
    return colors[status] || colors.textGray;
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      active: 'Activa',
      canceled: 'Cancelada',
      past_due: 'Pago Atrasado',
      trialing: 'Prueba',
      incomplete: 'Incompleta',
    };
    return labels[status] || status;
  };

  const renderStatsCard = () => {
    if (!stats) return null;

    return (
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Ionicons name="people" size={28} color={colors.primary} />
          <Text style={styles.statValue}>{stats.active_subscriptions}</Text>
          <Text style={styles.statLabel}>Suscripciones Activas</Text>
        </View>
        
        <View style={styles.statCard}>
          <Ionicons name="cash" size={28} color={colors.success} />
          <Text style={styles.statValue}>${stats.monthly_revenue.toFixed(2)}</Text>
          <Text style={styles.statLabel}>Ingresos del Mes</Text>
        </View>
        
        <View style={styles.statCard}>
          <Ionicons name="trending-up" size={28} color={colors.info} />
          <Text style={styles.statValue}>${stats.mrr.toFixed(2)}</Text>
          <Text style={styles.statLabel}>MRR</Text>
          <Text style={styles.statSubtext}>(Ingreso Mensual Recurrente)</Text>
        </View>
      </View>
    );
  };

  const renderFilterButtons = () => {
    const filters = [
      { key: 'all', label: 'Todas' },
      { key: 'active', label: 'Activas' },
      { key: 'past_due', label: 'Atrasadas' },
      { key: 'canceled', label: 'Canceladas' },
    ];

    return (
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.filterContainer}
      >
        {filters.map(filter => (
          <TouchableOpacity
            key={filter.key}
            style={[
              styles.filterButton,
              filterStatus === filter.key && styles.filterButtonActive
            ]}
            onPress={() => setFilterStatus(filter.key)}
          >
            <Text style={[
              styles.filterButtonText,
              filterStatus === filter.key && styles.filterButtonTextActive
            ]}>
              {filter.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    );
  };

  const renderSubscriptionCard = (subscription: Subscription) => {
    return (
      <View key={subscription.id} style={styles.subscriptionCard}>
        <View style={styles.subscriptionHeader}>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{subscription.user_name}</Text>
            <Text style={styles.userEmail}>{subscription.user_email}</Text>
          </View>
          <View style={[
            styles.statusBadge,
            { backgroundColor: getStatusColor(subscription.status) + '20' }
          ]}>
            <Text style={[
              styles.statusText,
              { color: getStatusColor(subscription.status) }
            ]}>
              {getStatusLabel(subscription.status)}
            </Text>
          </View>
        </View>

        <View style={styles.subscriptionBody}>
          <View style={styles.infoRow}>
            <Ionicons name="pricetag-outline" size={16} color={colors.textGray} />
            <Text style={styles.infoLabel}>Plan:</Text>
            <Text style={styles.infoValue}>{subscription.plan_name}</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Ionicons name="calendar-outline" size={16} color={colors.textGray} />
            <Text style={styles.infoLabel}>Renovación:</Text>
            <Text style={styles.infoValue}>
              {new Date(subscription.current_period_end).toLocaleDateString()}
            </Text>
          </View>
          
          {subscription.cancel_at_period_end && (
            <View style={styles.warningBanner}>
              <Ionicons name="warning" size={16} color={colors.warning} />
              <Text style={styles.warningText}>
                Cancelada - Activa hasta el fin del período
              </Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
      <AdminHeader title="Suscripciones" />
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Gestión de Suscripciones</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Cargando suscripciones...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Gestión de Suscripciones</Text>
        <TouchableOpacity 
          style={styles.plansButton}
          onPress={() => router.push('/(admin)/plans')}
        >
          <Ionicons name="settings-outline" size={20} color={colors.primary} />
          <Text style={styles.plansButtonText}>Planes</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Revenue Stats */}
        {renderStatsCard()}

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={colors.textGray} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar por cliente o plan..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor={colors.textGray}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color={colors.textGray} />
            </TouchableOpacity>
          )}
        </View>

        {/* Filter Buttons */}
        {renderFilterButtons()}

        {/* Subscriptions List */}
        <View style={styles.subscriptionsSection}>
          <Text style={styles.sectionTitle}>
            {filteredSubscriptions.length} Suscripciones
          </Text>
          
          {filteredSubscriptions.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="document-text-outline" size={48} color={colors.textLight} />
              <Text style={styles.emptyText}>No se encontraron suscripciones</Text>
            </View>
          ) : (
            filteredSubscriptions.map(sub => renderSubscriptionCard(sub))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundGray,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  plansButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: colors.primary + '15',
    borderRadius: 8,
  },
  plansButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: colors.textGray,
  },
  scrollView: {
    flex: 1,
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textGray,
    marginTop: 4,
    textAlign: 'center',
  },
  statSubtext: {
    fontSize: 10,
    color: colors.textLight,
    marginTop: 2,
    textAlign: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
  },
  filterContainer: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  filterButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: colors.background,
    borderRadius: 20,
    marginRight: 8,
  },
  filterButtonActive: {
    backgroundColor: colors.primary,
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textGray,
  },
  filterButtonTextActive: {
    color: colors.textWhite,
  },
  subscriptionsSection: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
  },
  subscriptionCard: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  subscriptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 13,
    color: colors.textGray,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  subscriptionBody: {
    gap: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoLabel: {
    fontSize: 14,
    color: colors.textGray,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warning + '15',
    padding: 10,
    borderRadius: 8,
    marginTop: 8,
    gap: 8,
  },
  warningText: {
    fontSize: 13,
    color: colors.warning,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 16,
    color: colors.textLight,
    marginTop: 12,
  },
});