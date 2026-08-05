import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'expo-router';
import AdminHeader from '../../components/admin/AdminHeader';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  Platform,
  Dimensions,
  Linking,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useThemeColors } from '../../constants/colors';
import api from '../../services/api';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';

const { width } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';

interface Client {
  id: string;
  name: string;
  email: string;
  phone?: string;
  type: 'individual' | 'business';
  status: string;
  last_update: string;
  metrics: {
    documents: number;
    appointments: number;
    next_appointment?: string;
  };
}

export default function ClientsModern() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'status'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    loadClients();
  }, [searchQuery, statusFilter, typeFilter, page]);

  const loadClients = async () => {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '50',
      });
      
      if (searchQuery) params.append('search', searchQuery);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (typeFilter !== 'all') params.append('type', typeFilter);

      const response = await api.get(`/admin/clients?${params.toString()}`);
      let clientData = response.data.clients || [];
      
      // Client-side sorting
      clientData = sortClients(clientData, sortBy, sortOrder);
      
      setClients(clientData);
    } catch (error) {
      console.error('Error loading clients:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const sortClients = (data: Client[], by: string, order: string) => {
    return [...data].sort((a, b) => {
      let comparison = 0;
      
      if (by === 'name') {
        comparison = a.name.localeCompare(b.name);
      } else if (by === 'date') {
        comparison = new Date(a.last_update).getTime() - new Date(b.last_update).getTime();
      } else if (by === 'status') {
        comparison = a.status.localeCompare(b.status);
      }
      
      return order === 'asc' ? comparison : -comparison;
    });
  };

  const handleSort = (by: 'name' | 'date' | 'status') => {
    if (sortBy === by) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(by);
      setSortOrder('asc');
    }
    
    const sorted = sortClients(clients, by, sortOrder === 'asc' ? 'desc' : 'asc');
    setClients(sorted);
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadClients();
  }, [searchQuery, statusFilter, typeFilter, page]);

  const openWhatsApp = (phone: string, clientName: string) => {
    if (!phone) {
      Alert.alert('Error', 'Cliente no tiene teléfono registrado');
      return;
    }
    
    const message = `Hola ${clientName}, soy de Ross Tax Preparation. ¿En qué puedo ayudarte?`;
    const url = `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
    
    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'No se pudo abrir WhatsApp');
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new': return '#2196F3';
      case 'in_progress': return '#FF9800';
      case 'awaiting_docs': return '#9C27B0';
      case 'completed': return '#4CAF50';
      case 'on_hold': return '#F44336';
      default: return '#999';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'new': return 'Nuevo';
      case 'in_progress': return 'En Proceso';
      case 'awaiting_docs': return 'Esperando Docs';
      case 'completed': return 'Completado';
      case 'on_hold': return 'En Espera';
      default: return status;
    }
  };

  const renderTableHeader = () => (
    <View style={styles.tableHeader}>
      <TouchableOpacity 
        style={[styles.headerCell, styles.headerCellName]} 
        onPress={() => handleSort('name')}
      >
        <Text style={styles.headerText}>Cliente</Text>
        {sortBy === 'name' && (
          <Ionicons 
            name={sortOrder === 'asc' ? 'chevron-up' : 'chevron-down'} 
            size={16} 
            color="#FFF" 
          />
        )}
      </TouchableOpacity>
      
      <View style={[styles.headerCell, styles.headerCellContact]}>
        <Text style={styles.headerText}>Contacto</Text>
      </View>
      
      <TouchableOpacity 
        style={[styles.headerCell, styles.headerCellStatus]} 
        onPress={() => handleSort('status')}
      >
        <Text style={styles.headerText}>Estado</Text>
        {sortBy === 'status' && (
          <Ionicons 
            name={sortOrder === 'asc' ? 'chevron-up' : 'chevron-down'} 
            size={16} 
            color="#FFF" 
          />
        )}
      </TouchableOpacity>
      
      <View style={[styles.headerCell, styles.headerCellMetrics]}>
        <Text style={styles.headerText}>Métricas</Text>
      </View>
      
      <TouchableOpacity 
        style={[styles.headerCell, styles.headerCellDate]} 
        onPress={() => handleSort('date')}
      >
        <Text style={styles.headerText}>Actualización</Text>
        {sortBy === 'date' && (
          <Ionicons 
            name={sortOrder === 'asc' ? 'chevron-up' : 'chevron-down'} 
            size={16} 
            color="#FFF" 
          />
        )}
      </TouchableOpacity>
      
      <View style={[styles.headerCell, styles.headerCellActions]}>
        <Text style={styles.headerText}>Acciones</Text>
      </View>
    </View>
  );

  const renderClientRow = ({ item, index }: { item: Client; index: number }) => (
    <TouchableOpacity
      style={[styles.tableRow, index % 2 === 0 && styles.tableRowEven]}
      onPress={() => router.push(`/(admin)/client-details?id=${item.id}`)}
      activeOpacity={0.7}
    >
      {/* Cliente */}
      <View style={[styles.cell, styles.cellName]}>
        <View style={styles.avatarSmall}>
          <LinearGradient
            colors={[colors.primary, colors.secondary]}
            style={styles.avatarSmallGradient}
          >
            <Text style={styles.avatarSmallText}>{item.name.charAt(0).toUpperCase()}</Text>
          </LinearGradient>
        </View>
        <View style={styles.nameContainer}>
          <Text style={styles.clientNameText} numberOfLines={1}>{item.name}</Text>
          <View style={styles.typeIndicator}>
            <Ionicons 
              name={item.type === 'business' ? 'briefcase' : 'person'} 
              size={12} 
              color={colors.textGray} 
            />
            <Text style={styles.typeText}>
              {item.type === 'business' ? 'Negocio' : 'Individual'}
            </Text>
          </View>
        </View>
      </View>

      {/* Contacto */}
      <View style={[styles.cell, styles.cellContact]}>
        <Text style={styles.emailText} numberOfLines={1}>{item.email}</Text>
        {item.phone && (
          <Text style={styles.phoneText} numberOfLines={1}>{item.phone}</Text>
        )}
      </View>

      {/* Estado */}
      <View style={[styles.cell, styles.cellStatus]}>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
          <View style={[styles.statusDot, { backgroundColor: getStatusColor(item.status) }]} />
          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
            {getStatusLabel(item.status)}
          </Text>
        </View>
      </View>

      {/* Métricas */}
      <View style={[styles.cell, styles.cellMetrics]}>
        <View style={styles.metricItem}>
          <Ionicons name="document-text" size={14} color={colors.accent} />
          <Text style={styles.metricValue}>{item.metrics.documents}</Text>
        </View>
        <View style={styles.metricItem}>
          <Ionicons name="calendar" size={14} color={colors.primary} />
          <Text style={styles.metricValue}>{item.metrics.appointments}</Text>
        </View>
      </View>

      {/* Fecha */}
      <View style={[styles.cell, styles.cellDate]}>
        <Text style={styles.dateText}>
          {format(new Date(item.last_update), 'dd/MM/yyyy', { locale: es })}
        </Text>
        <Text style={styles.timeText}>
          {format(new Date(item.last_update), 'HH:mm', { locale: es })}
        </Text>
      </View>

      {/* Acciones */}
      <View style={[styles.cell, styles.cellActions]}>
        <View style={styles.actionsRow}>
          {item.phone && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={(e) => {
                e.stopPropagation();
                openWhatsApp(item.phone!, item.name);
              }}
            >
              <Ionicons name="logo-whatsapp" size={18} color="#25D366" />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push(`/(admin)/client-details?id=${item.id}`)}
          >
            <Ionicons name="eye-outline" size={18} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <AdminHeader 
          title="Gestión de Clientes" 
          subtitle="Cargando..."
          rightAction={{
            icon: 'add-circle',
            onPress: () => router.push('/(admin)/clients')
          }}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Cargando clientes...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AdminHeader 
        title="Gestión de Clientes" 
        subtitle={`${clients.length} clientes registrados`}
        rightAction={{
          icon: 'add-circle',
          onPress: () => router.push('/(admin)/clients')
        }}
      />

      {/* Search & Filters */}
      <View style={styles.controlsContainer}>
        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={colors.textGray} />
          <TextInput
            style={styles.searchInput}
            placeholder={t('admin.searchNameEmailPlaceholder', 'Buscar por nombre, email o teléfono...')}
            placeholderTextColor={colors.textGray}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color={colors.textGray} />
            </TouchableOpacity>
          )}
        </View>

        {/* Filters */}
        <View style={styles.filtersRow}>
          <View style={styles.filterGroup}>
            <Text style={styles.filterLabel}>Estado:</Text>
            <View style={styles.filterChipsContainer}>
              {['all', 'new', 'in_progress', 'awaiting_docs', 'completed'].map((status) => (
                <TouchableOpacity
                  key={status}
                  style={[
                    styles.filterChip,
                    statusFilter === status && styles.filterChipActive,
                  ]}
                  onPress={() => setStatusFilter(status)}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      statusFilter === status && styles.filterChipTextActive,
                    ]}
                  >
                    {status === 'all' ? 'Todos' : getStatusLabel(status)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </View>

      {/* Table */}
      <View style={styles.tableContainer}>
        {renderTableHeader()}
        <FlatList
          data={clients}
          renderItem={renderClientRow}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.tableContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={64} color={colors.textGray} />
              <Text style={styles.emptyText}>No hay clientes</Text>
              <Text style={styles.emptySubtext}>
                {searchQuery ? 'Intenta con otra búsqueda' : 'Agrega tu primer cliente'}
              </Text>
            </View>
          }
        />
      </View>
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 16,
    color: colors.textGray,
  },
  // Header
  header: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerTextContainer: {
    gap: 2,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFF',
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
  },
  addButton: {
    padding: 4,
  },
  // Controls
  controlsContainer: {
    backgroundColor: '#FFF',
    padding: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
  },
  filtersRow: {
    gap: 8,
  },
  filterGroup: {
    gap: 8,
  },
  filterLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  filterChipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  filterChipActive: {
    backgroundColor: colors.primary + '15',
    borderColor: colors.primary,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textGray,
  },
  filterChipTextActive: {
    color: colors.primary,
  },
  // Table
  tableContainer: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 2,
    borderBottomColor: colors.secondary,
  },
  headerCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
  },
  headerCellName: {
    flex: 2.5,
  },
  headerCellContact: {
    flex: 2,
  },
  headerCellStatus: {
    flex: 1.5,
  },
  headerCellMetrics: {
    flex: 1.2,
  },
  headerCellDate: {
    flex: 1.3,
  },
  headerCellActions: {
    flex: 1,
  },
  headerText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFF',
    textTransform: 'uppercase',
  },
  tableContent: {
    paddingBottom: 20,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    backgroundColor: '#FFF',
  },
  tableRowEven: {
    backgroundColor: '#FAFAFA',
  },
  cell: {
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  cellName: {
    flex: 2.5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cellContact: {
    flex: 2,
    gap: 4,
  },
  cellStatus: {
    flex: 1.5,
  },
  cellMetrics: {
    flex: 1.2,
    gap: 6,
  },
  cellDate: {
    flex: 1.3,
    gap: 2,
  },
  cellActions: {
    flex: 1,
  },
  // Avatar
  avatarSmall: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
  },
  avatarSmallGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarSmallText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  // Name
  nameContainer: {
    flex: 1,
    gap: 2,
  },
  clientNameText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  typeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  typeText: {
    fontSize: 11,
    color: colors.textGray,
  },
  // Contact
  emailText: {
    fontSize: 13,
    color: colors.text,
  },
  phoneText: {
    fontSize: 12,
    color: colors.textGray,
  },
  // Status
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  // Metrics
  metricItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metricValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  // Date
  dateText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  timeText: {
    fontSize: 11,
    color: colors.textGray,
  },
  // Actions
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Empty
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.textGray,
    marginTop: 8,
  },
});
