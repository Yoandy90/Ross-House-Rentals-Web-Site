import React, { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import AdminHeader from '../../components/admin/AdminHeader';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../../constants/colors';
import api from '../../services/api';

interface Transaction {
  id: string;
  user_id: string;
  transaction_type: string;
  amount: number;
  balance_after: number;
  description: string;
  created_at: string;
  service_name?: string;
  payment_amount_usd?: number;
  admin_id?: string;
  admin_reason?: string;
}

interface User {
  id: string;
  email: string;
  name: string;
}

export default function AdminCreditsHistoryScreen() {
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [users, setUsers] = useState<{ [key: string]: User }>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load all transactions and statistics
      const [statsRes, usersRes] = await Promise.all([
        api.get('/admin/credits/statistics'),
        api.get('/admin/clients?limit=1000'),
      ]);

      setStats(statsRes.data);
      
      // Create user lookup map
      const userMap: { [key: string]: User } = {};
      if (usersRes.data.clients) {
        usersRes.data.clients.forEach((user: any) => {
          userMap[user._id || user.id] = {
            id: user._id || user.id,
            email: user.email,
            name: user.name || user.full_name || 'Usuario',
          };
        });
      }
      setUsers(userMap);

      // Load transactions from all users
      await loadAllTransactions();
      
    } catch (error) {
      console.error('Error loading admin credits data:', error);
      Alert.alert('Error', 'No se pudieron cargar los datos');
    } finally {
      setLoading(false);
    }
  };

  const loadAllTransactions = async () => {
    try {
      // Get all users' transactions
      const allTransactions: Transaction[] = [];
      
      // For now, we'll need to create an admin endpoint that returns all transactions
      // Temporary: Load from credit_transactions collection directly via a new endpoint
      const response = await api.get('/admin/credits/all-transactions');
      
      if (response.data.transactions) {
        setTransactions(response.data.transactions);
      }
    } catch (error) {
      console.error('Error loading all transactions:', error);
    }
  };

  const getFilteredTransactions = () => {
    let filtered = transactions;

    // Filter by type
    if (filterType !== 'all') {
      filtered = filtered.filter(t => t.transaction_type === filterType);
    }

    // Filter by search query (email or name)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(t => {
        const user = users[t.user_id];
        if (!user) return false;
        return (
          user.email.toLowerCase().includes(query) ||
          user.name.toLowerCase().includes(query)
        );
      });
    }

    return filtered;
  };

  const getTransactionColor = (type: string) => {
    switch (type) {
      case 'purchase':
      case 'bonus':
      case 'admin_add':
        return colors.success;
      case 'usage':
      case 'admin_deduct':
        return colors.error;
      case 'refund':
        return colors.warning;
      default:
        return colors.textGray;
    }
  };

  const getTransactionLabel = (type: string) => {
    switch (type) {
      case 'purchase': return 'Compra';
      case 'bonus': return 'Bonus';
      case 'usage': return 'Uso';
      case 'refund': return 'Reembolso';
      case 'admin_add': return 'Admin +';
      case 'admin_deduct': return 'Admin -';
      default: return type;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const renderStatCard = (title: string, value: string | number, icon: string, color: string) => (
    <View style={[styles.statCard, { borderLeftColor: color }]}>
      <Ionicons name={icon as any} size={24} color={color} />
      <View style={styles.statContent}>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statLabel}>{title}</Text>
      </View>
    </View>
  );

  const renderTransactionRow = (transaction: Transaction, index: number) => {
    const user = users[transaction.user_id];
    const color = getTransactionColor(transaction.transaction_type);
    const isPositive = transaction.amount > 0;

    return (
      <View key={transaction.id} style={[styles.tableRow, index % 2 === 0 && styles.tableRowEven]}>
        <View style={styles.tableCell}>
          <Text style={styles.cellText}>{formatDate(transaction.created_at)}</Text>
        </View>
        <View style={styles.tableCell}>
          <Text style={styles.cellText} numberOfLines={1}>
            {user ? user.email : 'Desconocido'}
          </Text>
        </View>
        <View style={styles.tableCell}>
          <View style={[styles.typeBadge, { backgroundColor: color + '20' }]}>
            <Text style={[styles.typeBadgeText, { color }]}>
              {getTransactionLabel(transaction.transaction_type)}
            </Text>
          </View>
        </View>
        <View style={styles.tableCell}>
          <Text style={[styles.amountText, { color: isPositive ? colors.success : colors.error }]}>
            {isPositive ? '+' : ''}{(transaction.amount || 0).toFixed(0)}
          </Text>
        </View>
        <View style={styles.tableCell}>
          <Text style={styles.cellText}>
            {transaction.balance_after !== null && transaction.balance_after !== undefined 
              ? transaction.balance_after.toFixed(0) 
              : 'N/A'}
          </Text>
        </View>
        <View style={[styles.tableCell, styles.tableCellLarge]}>
          <Text style={styles.cellTextDescription} numberOfLines={2}>
            {transaction.description || 'Sin descripción'}
          </Text>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <AdminHeader title="Historial de Créditos" showBack />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Cargando datos...</Text>
        </View>
      </View>
    );
  }

  const filteredTransactions = getFilteredTransactions();

  return (
    <View style={styles.container}>
      <AdminHeader title="Historial de Créditos" showBack />

      <ScrollView style={styles.scrollView}>
        {/* Statistics Cards */}
        {stats && (
          <View style={styles.statsContainer}>
            {renderStatCard(
              'Total Vendido',
              `$${stats.total_purchased_usd?.toFixed(0) || 0}`,
              'cash',
              colors.success
            )}
            {renderStatCard(
              'Créditos Activos',
              stats.total_balance_all_users?.toFixed(0) || 0,
              'wallet',
              colors.primary
            )}
            {renderStatCard(
              'Créditos Usados',
              stats.total_credits_used?.toFixed(0) || 0,
              'arrow-down-circle',
              colors.error
            )}
            {renderStatCard(
              'Usuarios con Créditos',
              stats.active_users_with_balance || 0,
              'people',
              colors.secondary
            )}
          </View>
        )}

        {/* Search and Filters */}
        <View style={styles.controlsContainer}>
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color={colors.textGray} />
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar por email o nombre..."
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={20} color={colors.textGray} />
              </TouchableOpacity>
            )}
          </View>

          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.filtersScroll}
          >
            <TouchableOpacity
              style={[styles.filterChip, filterType === 'all' && styles.filterChipActive]}
              onPress={() => setFilterType('all')}
            >
              <Text style={[styles.filterChipText, filterType === 'all' && styles.filterChipTextActive]}>
                Todas ({transactions.length})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterChip, filterType === 'purchase' && styles.filterChipActive]}
              onPress={() => setFilterType('purchase')}
            >
              <Text style={[styles.filterChipText, filterType === 'purchase' && styles.filterChipTextActive]}>
                Compras
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterChip, filterType === 'usage' && styles.filterChipActive]}
              onPress={() => setFilterType('usage')}
            >
              <Text style={[styles.filterChipText, filterType === 'usage' && styles.filterChipTextActive]}>
                Usos
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterChip, filterType === 'bonus' && styles.filterChipActive]}
              onPress={() => setFilterType('bonus')}
            >
              <Text style={[styles.filterChipText, filterType === 'bonus' && styles.filterChipTextActive]}>
                Bonos
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* Table */}
        <View style={styles.tableContainer}>
          {/* Table Header */}
          <View style={styles.tableHeader}>
            <View style={styles.tableCell}>
              <Text style={styles.tableHeaderText}>Fecha</Text>
            </View>
            <View style={styles.tableCell}>
              <Text style={styles.tableHeaderText}>Usuario</Text>
            </View>
            <View style={styles.tableCell}>
              <Text style={styles.tableHeaderText}>Tipo</Text>
            </View>
            <View style={styles.tableCell}>
              <Text style={styles.tableHeaderText}>Monto</Text>
            </View>
            <View style={styles.tableCell}>
              <Text style={styles.tableHeaderText}>Balance</Text>
            </View>
            <View style={[styles.tableCell, styles.tableCellLarge]}>
              <Text style={styles.tableHeaderText}>Descripción</Text>
            </View>
          </View>

          {/* Table Body */}
          {filteredTransactions.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="document-text-outline" size={48} color={colors.textGray} />
              <Text style={styles.emptyStateText}>
                {searchQuery ? 'No se encontraron resultados' : 'No hay transacciones'}
              </Text>
            </View>
          ) : (
            filteredTransactions.map((transaction, index) => 
              renderTransactionRow(transaction, index)
            )
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
    backgroundColor: '#FFF',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: colors.textGray,
  },
  scrollView: {
    flex: 1,
  },
  statsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: 200,
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statContent: {
    flex: 1,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
    color: colors.textGray,
  },
  controlsContainer: {
    backgroundColor: '#FFF',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundGray,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
  },
  filtersScroll: {
    marginTop: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textGray,
  },
  filterChipTextActive: {
    color: '#FFF',
  },
  tableContainer: {
    margin: 16,
    backgroundColor: '#FFF',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: colors.backgroundGray,
    padding: 12,
    borderBottomWidth: 2,
    borderBottomColor: colors.border,
  },
  tableRow: {
    flexDirection: 'row',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tableRowEven: {
    backgroundColor: colors.backgroundGray + '40',
  },
  tableCell: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 4,
    minWidth: 100,
  },
  tableCellLarge: {
    flex: 2,
    minWidth: 200,
  },
  tableHeaderText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: colors.text,
  },
  cellText: {
    fontSize: 13,
    color: colors.text,
  },
  cellTextDescription: {
    fontSize: 12,
    color: colors.textGray,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  amountText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyStateText: {
    marginTop: 12,
    fontSize: 14,
    color: colors.textGray,
  },
});