/**
 * Admin Clients Management Screen - Modern Premium Design
 * Redesigned with gradients, stats and modern UI
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Linking,
  Dimensions,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import api from '../../services/api';

const { width } = Dimensions.get('window');

interface Client {
  id: string;
  _id?: string;
  name: string;
  email: string;
  full_name?: string;
  phone?: string;
  created_at: string;
  is_active?: boolean;
  status?: string;
  has_app?: boolean;
}

type FilterType = 'all' | 'active' | 'inactive' | 'with_app';

const AdminClients = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scrollY = useRef(new Animated.Value(0)).current;
  const [clients, setClients] = useState<Client[]>([]);
  const [filteredClients, setFilteredClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [stats, setStats] = useState({ total: 0, withApp: 0, active: 0, inactive: 0 });
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadClients(true);
    }, [])
  );

  useEffect(() => {
    filterClients();
  }, [searchQuery, clients, activeFilter]);

  const loadClients = async (reset = false) => {
    try {
      const page = reset ? 1 : currentPage;
      if (reset) setCurrentPage(1);
      
      const response = await api.get(`/admin/clients?page=${page}&limit=50`);
      const clientsList = response.data.clients || [];
      const pagination = response.data.pagination || {};
      
      if (reset) {
        setClients(clientsList);
      } else {
        setClients(prev => [...prev, ...clientsList]);
      }
      
      setHasMore(page < (pagination.total_pages || 1));
      
      // Calculate stats from all data
      const total = pagination.total || clientsList.length;
      const withApp = clientsList.filter((c: Client) => c.has_app).length;
      const active = clientsList.filter((c: Client) => c.is_active !== false).length;
      const inactive = clientsList.filter((c: Client) => c.is_active === false).length;
      setStats({ total, withApp, active, inactive });
      
    } catch (error) {
      console.error('Error loading clients:', error);
      Alert.alert('Error', 'No se pudieron cargar los clientes');
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  };

  const filterClients = () => {
    let filtered = [...clients];
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(client => {
        const name = (client.name || client.full_name || '').toLowerCase();
        const email = (client.email || '').toLowerCase();
        const phone = (client.phone || '').toLowerCase();
        return name.includes(query) || email.includes(query) || phone.includes(query);
      });
    }
    
    switch (activeFilter) {
      case 'active':
        filtered = filtered.filter(c => c.is_active !== false);
        break;
      case 'inactive':
        filtered = filtered.filter(c => c.is_active === false);
        break;
      case 'with_app':
        filtered = filtered.filter(c => c.has_app === true);
        break;
    }
    
    setFilteredClients(filtered);
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadClients(true);
  };

  const handleLoadMore = () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    setCurrentPage(prev => prev + 1);
    loadClients(false);
  };

  const handleCall = (phone: string) => {
    if (!phone) {
      Alert.alert('Sin teléfono', 'Este cliente no tiene número registrado');
      return;
    }
    Linking.openURL(`tel:${phone}`);
  };

  const handleWhatsApp = (phone: string) => {
    if (!phone) {
      Alert.alert('Sin teléfono', 'Este cliente no tiene número registrado');
      return;
    }
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    Linking.openURL(`whatsapp://send?phone=${cleanPhone}`);
  };

  const handleSchedule = (client: Client) => {
    router.push({
      pathname: '/_adminScreens/schedule-appointment',
      params: { 
        clientId: client.id || client._id,
        clientName: client.name || client.full_name 
      }
    });
  };

  const handleClientPress = (client: Client) => {
    router.push({
      pathname: '/_adminScreens/client-details',
      params: { clientId: client.id || client._id }
    });
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  };

  const getInitials = (name: string) => {
    if (!name) return '?';
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const getAvatarGradient = (name: string): string[] => {
    const gradients = [
      ['#6366F1', '#4F46E5'],
      ['#8B5CF6', '#7C3AED'],
      ['#EC4899', '#DB2777'],
      ['#F43F5E', '#E11D48'],
      ['#F97316', '#EA580C'],
      ['#EAB308', '#CA8A04'],
      ['#22C55E', '#16A34A'],
      ['#14B8A6', '#0D9488'],
      ['#06B6D4', '#0891B2'],
      ['#3B82F6', '#2563EB'],
    ];
    const index = name ? name.charCodeAt(0) % gradients.length : 0;
    return gradients[index];
  };

  const renderClient = ({ item }: { item: Client }) => {
    const name = item.name || item.full_name || 'Sin nombre';
    const isActive = item.is_active !== false;
    
    return (
      <TouchableOpacity 
        style={styles.clientCard}
        onPress={() => handleClientPress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.clientMain}>
          {/* Avatar with Gradient */}
          <LinearGradient
            colors={getAvatarGradient(name)}
            style={styles.avatar}
          >
            <Text style={styles.avatarText}>{getInitials(name)}</Text>
            {item.has_app && (
              <View style={styles.appBadge}>
                <Ionicons name="phone-portrait" size={8} color="#fff" />
              </View>
            )}
          </LinearGradient>
          
          {/* Info */}
          <View style={styles.clientInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.clientName} numberOfLines={1}>{name}</Text>
              <View style={[
                styles.statusBadge, 
                { backgroundColor: isActive ? '#ECFDF5' : '#FEF2F2' }
              ]}>
                <View style={[
                  styles.statusDot,
                  { backgroundColor: isActive ? '#10B981' : '#EF4444' }
                ]} />
                <Text style={[
                  styles.statusText, 
                  { color: isActive ? '#059669' : '#DC2626' }
                ]}>
                  {isActive ? 'Activo' : 'Inactivo'}
                </Text>
              </View>
            </View>
            
            <View style={styles.contactInfo}>
              <View style={styles.contactRow}>
                <Ionicons name="mail" size={12} color="#9CA3AF" />
                <Text style={styles.contactText} numberOfLines={1}>{item.email}</Text>
              </View>
              
              {item.phone && (
                <View style={styles.contactRow}>
                  <Ionicons name="call" size={12} color="#9CA3AF" />
                  <Text style={styles.contactText}>{item.phone}</Text>
                </View>
              )}
            </View>
          </View>
        </View>
        
        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => handleCall(item.phone || '')}
          >
            <LinearGradient colors={['#3B82F6', '#2563EB']} style={styles.actionGradient}>
              <Ionicons name="call" size={16} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => handleWhatsApp(item.phone || '')}
          >
            <LinearGradient colors={['#25D366', '#128C7E']} style={styles.actionGradient}>
              <Ionicons name="logo-whatsapp" size={16} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => handleSchedule(item)}
          >
            <LinearGradient colors={['#8B5CF6', '#7C3AED']} style={styles.actionGradient}>
              <Ionicons name="calendar" size={16} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => handleClientPress(item)}
          >
            <LinearGradient colors={['#6C1110', '#8B1A19']} style={styles.actionGradient}>
              <Ionicons name="chevron-forward" size={16} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const filters = [
    { type: 'all' as FilterType, label: 'Todos', icon: 'people', count: stats.total, color: '#6C1110' },
    { type: 'active' as FilterType, label: 'Activos', icon: 'checkmark-circle', count: stats.active, color: '#10B981' },
    { type: 'with_app' as FilterType, label: 'Con App', icon: 'phone-portrait', count: stats.withApp, color: '#3B82F6' },
    { type: 'inactive' as FilterType, label: 'Inactivos', icon: 'close-circle', count: stats.inactive, color: '#EF4444' },
  ];

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <LinearGradient colors={['#6C1110', '#8B1A19']} style={styles.loadingGradient}>
          <ActivityIndicator size="large" color="#FFF" />
          <Text style={styles.loadingText}>Cargando clientes...</Text>
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
            <Text style={styles.headerTitle}>Clientes</Text>
            <Text style={styles.headerSubtitle}>{stats.total} registrados</Text>
          </View>
          
          <TouchableOpacity 
            style={styles.addButton}
            onPress={() => router.push('/_adminScreens/create-client')}
          >
            <Ionicons name="person-add" size={20} color="#FFF" />
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#9CA3AF" />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar cliente..."
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
            <Text style={[styles.statNumber, { color: '#86EFAC' }]}>{stats.active}</Text>
            <Text style={styles.statLabel}>Activos</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCard}>
            <Text style={[styles.statNumber, { color: '#93C5FD' }]}>{stats.withApp}</Text>
            <Text style={styles.statLabel}>Con App</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{filteredClients.length}</Text>
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
                { backgroundColor: activeFilter === item.type ? item.color : '#334155' }
              ]}>
                <Text style={[
                  styles.filterBadgeText,
                  { color: activeFilter === item.type ? '#FFF' : '#94A3B8' }
                ]}>
                  {item.count}
                </Text>
              </View>
            </TouchableOpacity>
          )}
          keyExtractor={(item) => item.type}
        />
      </View>

      {/* Client List */}
      <FlatList
        data={filteredClients}
        renderItem={renderClient}
        keyExtractor={(item) => item.id || item._id || Math.random().toString()}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={handleRefresh} 
            tintColor="#6C1110" 
          />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.3}
        ListFooterComponent={loadingMore ? (
          <ActivityIndicator style={styles.loadingMore} color="#6C1110" />
        ) : null}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <LinearGradient
              colors={['#FEF2F2', '#FEE2E2']}
              style={styles.emptyIconBg}
            >
              <Ionicons name="people-outline" size={48} color="#6C1110" />
            </LinearGradient>
            <Text style={styles.emptyText}>No se encontraron clientes</Text>
            <Text style={styles.emptySubtext}>
              {searchQuery ? 'Intenta con otra búsqueda' : 'Agrega tu primer cliente'}
            </Text>
            <TouchableOpacity
              style={styles.emptyButton}
              onPress={() => router.push('/_adminScreens/create-client')}
            >
              <LinearGradient colors={['#6C1110', '#8B1A19']} style={styles.emptyButtonGradient}>
                <Ionicons name="person-add" size={18} color="#FFF" />
                <Text style={styles.emptyButtonText}>Agregar Cliente</Text>
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
    backgroundColor: '#1E293B',
    borderRadius: 14,
    paddingHorizontal: 14,
    marginHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    marginLeft: 10,
    fontSize: 15,
    color: '#F1F5F9',
  },
  // Stats Row
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
    backgroundColor: '#1E293B',
    borderWidth: 2,
    borderColor: '#334155',
    gap: 6,
  },
  filterTabActive: {
    backgroundColor: '#1E293B',
  },
  filterTabText: {
    fontSize: 13,
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
    fontSize: 11,
    fontWeight: '700',
  },
  // List
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  // Client Card
  clientCard: {
    backgroundColor: '#1E293B',
    borderRadius: 18,
    marginBottom: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  clientMain: {
    flexDirection: 'row',
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
  },
  appBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#22C55E',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  clientInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  clientName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F1F5F9',
    flex: 1,
    marginRight: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  contactInfo: {
    gap: 4,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  contactText: {
    fontSize: 13,
    color: '#94A3B8',
    flex: 1,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#334155',
    gap: 10,
  },
  actionButton: {
    borderRadius: 10,
    overflow: 'hidden',
  },
  actionGradient: {
    width: 38,
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingMore: {
    paddingVertical: 20,
  },
  // Empty State
  emptyContainer: {
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
  emptyText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F1F5F9',
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#94A3B8',
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

export default AdminClients;
