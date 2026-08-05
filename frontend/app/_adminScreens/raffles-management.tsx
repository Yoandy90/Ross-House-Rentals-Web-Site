import { useTranslation } from 'react-i18next';
/**
 * Raffles Management Screen - Modern Premium Design
 * Redesigned with gradients, stats and modern UI
 */
import React, { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
  Dimensions,
  FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../../services/api';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const { width: screenWidth } = Dimensions.get('window');

interface Raffle {
  id: string;
  title: string;
  description: string;
  prize_type: 'service' | 'credits' | 'discount' | 'product';
  prize_value: string;
  prize_credits?: number;
  ticket_price: number;
  max_tickets_per_user: number;
  total_tickets?: number;
  tickets_sold: number;
  tickets_remaining?: number;
  participants_count: number;
  status: 'draft' | 'active' | 'full' | 'completed' | 'cancelled';
  end_date: string;
  winner_id?: string;
  winner_name?: string;
  created_at: string;
}

interface Stats {
  total: number;
  active: number;
  completed: number;
  totalRevenue: number;
  totalParticipants: number;
}

type FilterType = 'all' | 'active' | 'completed' | 'draft';

export default function RafflesManagementScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [raffles, setRaffles] = useState<Raffle[]>([]);
  const [filteredRaffles, setFilteredRaffles] = useState<Raffle[]>([]);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [stats, setStats] = useState<Stats>({
    total: 0,
    active: 0,
    completed: 0,
    totalRevenue: 0,
    totalParticipants: 0,
  });

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    prize_type: 'credits' as 'service' | 'credits' | 'discount' | 'product',
    prize_value: '',
    prize_credits: '',
    ticket_price: '',
    max_tickets_per_user: '10',
    total_tickets: '100',
    end_date: '',
  });

  useEffect(() => {
    loadRaffles();
  }, []);

  useEffect(() => {
    filterRaffles();
  }, [raffles, activeFilter]);

  const loadRaffles = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const response = await api.get('/admin/raffles');
      const rafflesData = response.data.raffles || [];
      setRaffles(rafflesData);

      const newStats: Stats = {
        total: rafflesData.length,
        active: rafflesData.filter((r: Raffle) => r.status === 'active').length,
        completed: rafflesData.filter((r: Raffle) => r.status === 'completed').length,
        totalRevenue: rafflesData.reduce((sum: number, r: Raffle) => 
          sum + (r.tickets_sold * r.ticket_price), 0),
        totalParticipants: rafflesData.reduce((sum: number, r: Raffle) => 
          sum + r.participants_count, 0),
      };
      setStats(newStats);
    } catch (error) {
      console.error('Error loading raffles:', error);
      Alert.alert('Error', 'No se pudieron cargar los sorteos');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const filterRaffles = () => {
    let filtered = [...raffles];
    if (activeFilter !== 'all') {
      filtered = filtered.filter(r => r.status === activeFilter);
    }
    setFilteredRaffles(filtered);
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'active':
        return { bg: '#ECFDF5', text: '#059669', label: 'Activo', icon: 'play-circle', gradient: ['#10B981', '#059669'] };
      case 'full':
        return { bg: '#FEF3C7', text: '#D97706', label: 'Lleno', icon: 'alert-circle', gradient: ['#F59E0B', '#D97706'] };
      case 'completed':
        return { bg: '#EEF2FF', text: '#4F46E5', label: 'Completado', icon: 'trophy', gradient: ['#6366F1', '#4F46E5'] };
      case 'cancelled':
        return { bg: '#FEF2F2', text: '#DC2626', label: 'Cancelado', icon: 'close-circle', gradient: ['#EF4444', '#DC2626'] };
      default:
        return { bg: '#F3F4F6', text: '#6B7280', label: 'Borrador', icon: 'document', gradient: ['#9CA3AF', '#6B7280'] };
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Sin fecha';
    try {
      return format(new Date(dateString), "d MMM yyyy", { locale: es });
    } catch {
      return dateString;
    }
  };

  const handleCreateRaffle = async () => {
    if (!formData.title || !formData.prize_value || !formData.ticket_price) {
      Alert.alert('Error', 'Completa todos los campos requeridos');
      return;
    }

    try {
      const payload = {
        title: formData.title,
        description: formData.description,
        prize_type: formData.prize_type,
        prize_value: formData.prize_value,
        prize_credits: formData.prize_type === 'credits' ? parseInt(formData.prize_credits) : undefined,
        ticket_price: parseFloat(formData.ticket_price),
        max_tickets_per_user: parseInt(formData.max_tickets_per_user),
        total_tickets: parseInt(formData.total_tickets),
        end_date: formData.end_date || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      };

      await api.post('/admin/raffles', payload);
      Alert.alert('Éxito', 'Sorteo creado correctamente');
      setShowCreateModal(false);
      loadRaffles();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'No se pudo crear');
    }
  };

  const handleActivate = async (raffle: Raffle) => {
    try {
      await api.put(`/admin/raffles/${raffle.id}/status`, { status: 'active' });
      Alert.alert('Éxito', 'Sorteo activado');
      loadRaffles();
    } catch (error) {
      Alert.alert('Error', 'No se pudo activar');
    }
  };

  const handleExecuteDraw = async (raffle: Raffle) => {
    Alert.alert(
      'Ejecutar Sorteo',
      `¿Estás seguro de ejecutar el sorteo "${raffle.title}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Ejecutar',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await api.post(`/admin/raffles/${raffle.id}/execute`);
              Alert.alert('🎉 ¡Sorteo Realizado!', `Ganador: ${response.data.winner?.name || 'No disponible'}`);
              loadRaffles();
            } catch (error) {
              Alert.alert('Error', 'No se pudo ejecutar el sorteo');
            }
          }
        }
      ]
    );
  };

  const renderRaffleCard = ({ item }: { item: Raffle }) => {
    const statusConfig = getStatusConfig(item.status);
    const progress = item.total_tickets ? (item.tickets_sold / item.total_tickets) * 100 : 0;

    return (
      <TouchableOpacity style={styles.raffleCard} activeOpacity={0.7}>
        <View style={styles.cardHeader}>
          <LinearGradient colors={statusConfig.gradient} style={styles.iconBg}>
            <Ionicons name="gift" size={24} color="#FFF" />
          </LinearGradient>
          <View style={styles.cardTitleSection}>
            <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
            <View style={styles.dateRow}>
              <Ionicons name="calendar-outline" size={12} color="#9CA3AF" />
              <Text style={styles.dateText}>Termina: {formatDate(item.end_date)}</Text>
            </View>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
            <Text style={[styles.statusText, { color: statusConfig.text }]}>{statusConfig.label}</Text>
          </View>
        </View>

        {/* Progress Bar */}
        <View style={styles.progressSection}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressLabel}>Boletos vendidos</Text>
            <Text style={styles.progressValue}>{item.tickets_sold} / {item.total_tickets || '∞'}</Text>
          </View>
          <View style={styles.progressBarBg}>
            <LinearGradient
              colors={['#8B5CF6', '#6D28D9']}
              style={[styles.progressBarFill, { width: `${Math.min(progress, 100)}%` }]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            />
          </View>
        </View>

        {/* Stats */}
        <View style={styles.cardStats}>
          <View style={styles.statItem}>
            <Ionicons name="people-outline" size={16} color="#8B5CF6" />
            <Text style={styles.statValue}>{item.participants_count}</Text>
            <Text style={styles.statLabel}>Participantes</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Ionicons name="cash-outline" size={16} color="#10B981" />
            <Text style={styles.statValue}>{formatCurrency(item.ticket_price)}</Text>
            <Text style={styles.statLabel}>Por boleto</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Ionicons name="wallet-outline" size={16} color="#F59E0B" />
            <Text style={styles.statValue}>{formatCurrency(item.tickets_sold * item.ticket_price)}</Text>
            <Text style={styles.statLabel}>Recaudado</Text>
          </View>
        </View>

        {/* Prize */}
        <View style={styles.prizeSection}>
          <LinearGradient colors={['#FEF3C7', '#FDE68A']} style={styles.prizeBadge}>
            <Ionicons name="trophy" size={16} color="#D97706" />
            <Text style={styles.prizeText}>Premio: {item.prize_value}</Text>
          </LinearGradient>
        </View>

        {/* Winner if completed */}
        {item.status === 'completed' && item.winner_name && (
          <View style={styles.winnerSection}>
            <LinearGradient colors={['#ECFDF5', '#D1FAE5']} style={styles.winnerBadge}>
              <Ionicons name="trophy" size={18} color="#059669" />
              <Text style={styles.winnerText}>🎉 Ganador: {item.winner_name}</Text>
            </LinearGradient>
          </View>
        )}

        {/* Actions */}
        <View style={styles.cardActions}>
          {item.status === 'draft' && (
            <TouchableOpacity style={styles.actionBtn} onPress={() => handleActivate(item)}>
              <LinearGradient colors={['#10B981', '#059669']} style={styles.actionGradient}>
                <Ionicons name="play" size={16} color="#FFF" />
                <Text style={styles.actionText}>Activar</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
          {item.status === 'active' && item.tickets_sold > 0 && (
            <TouchableOpacity style={styles.actionBtn} onPress={() => handleExecuteDraw(item)}>
              <LinearGradient colors={['#8B5CF6', '#6D28D9']} style={styles.actionGradient}>
                <Ionicons name="shuffle" size={16} color="#FFF" />
                <Text style={styles.actionText}>Sortear</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[styles.actionBtn, styles.actionBtnOutline]}>
            <Ionicons name="eye" size={16} color="#8B5CF6" />
            <Text style={styles.actionTextOutline}>Ver Boletos</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const filters = [
    { type: 'all' as FilterType, label: 'Todos', count: stats.total, color: '#8B5CF6' },
    { type: 'active' as FilterType, label: 'Activos', count: stats.active, color: '#10B981' },
    { type: 'completed' as FilterType, label: 'Completados', count: stats.completed, color: '#6366F1' },
    { type: 'draft' as FilterType, label: 'Borradores', count: stats.total - stats.active - stats.completed, color: '#F59E0B' },
  ];

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <LinearGradient colors={['#8B5CF6', '#6D28D9']} style={styles.loadingGradient}>
          <ActivityIndicator size="large" color="#FFF" />
          <Text style={styles.loadingText}>Cargando sorteos...</Text>
        </LinearGradient>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Premium Header */}
      <LinearGradient
        colors={['#8B5CF6', '#7C3AED', '#6D28D9']}
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
              <Ionicons name="gift" size={24} color="#FFF" />
              <Text style={styles.headerTitle}>Sorteos</Text>
            </View>
            <Text style={styles.headerSubtitle}>{stats.total} sorteos creados</Text>
          </View>
          
          <TouchableOpacity style={styles.addButton} onPress={() => setShowCreateModal(true)}>
            <Ionicons name="add" size={24} color="#FFF" />
          </TouchableOpacity>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{formatCurrency(stats.totalRevenue)}</Text>
            <Text style={styles.statLabelHeader}>Recaudado</Text>
          </View>
          <View style={styles.statDividerHeader} />
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats.totalParticipants}</Text>
            <Text style={styles.statLabelHeader}>Participantes</Text>
          </View>
          <View style={styles.statDividerHeader} />
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats.active}</Text>
            <Text style={styles.statLabelHeader}>Activos</Text>
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
              style={[styles.filterTab, activeFilter === item.type && { borderColor: item.color }]}
              onPress={() => setActiveFilter(item.type)}
            >
              <Text style={[styles.filterTabText, activeFilter === item.type && { color: item.color, fontWeight: '700' }]}>
                {item.label}
              </Text>
              <View style={[styles.filterBadge, { backgroundColor: activeFilter === item.type ? item.color : '#E5E7EB' }]}>
                <Text style={[styles.filterBadgeText, { color: activeFilter === item.type ? '#FFF' : '#6B7280' }]}>
                  {item.count}
                </Text>
              </View>
            </TouchableOpacity>
          )}
          keyExtractor={(item) => item.type}
        />
      </View>

      {/* Raffles List */}
      <FlatList
        data={filteredRaffles}
        renderItem={renderRaffleCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadRaffles(true)} tintColor="#8B5CF6" />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <LinearGradient colors={['#EDE9FE', '#DDD6FE']} style={styles.emptyIconBg}>
              <Ionicons name="gift-outline" size={48} color="#8B5CF6" />
            </LinearGradient>
            <Text style={styles.emptyTitle}>No hay sorteos</Text>
            <Text style={styles.emptyText}>Crea tu primer sorteo</Text>
            <TouchableOpacity style={styles.emptyButton} onPress={() => setShowCreateModal(true)}>
              <LinearGradient colors={['#8B5CF6', '#6D28D9']} style={styles.emptyButtonGradient}>
                <Ionicons name="add" size={20} color="#FFF" />
                <Text style={styles.emptyButtonText}>Nuevo Sorteo</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        }
      />

      {/* Create Modal */}
      <Modal visible={showCreateModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <LinearGradient colors={['#8B5CF6', '#6D28D9']} style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nuevo Sorteo</Text>
              <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                <Ionicons name="close" size={24} color="#FFF" />
              </TouchableOpacity>
            </LinearGradient>
            
            <ScrollView style={styles.modalBody}>
              <Text style={styles.inputLabel}>Título *</Text>
              <TextInput
                style={styles.input}
                value={formData.title}
                onChangeText={(text) => setFormData({...formData, title: text})}
                placeholder="Ej: Sorteo iPhone 15"
              />

              <Text style={styles.inputLabel}>Descripción</Text>
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                value={formData.description}
                onChangeText={(text) => setFormData({...formData, description: text})}
                placeholder={t('admin.raffleDescPlaceholder', 'Descripción del sorteo...')}
                multiline
              />

              <Text style={styles.inputLabel}>Premio *</Text>
              <TextInput
                style={styles.input}
                value={formData.prize_value}
                onChangeText={(text) => setFormData({...formData, prize_value: text})}
                placeholder="Ej: iPhone 15 Pro Max"
              />

              <View style={styles.row}>
                <View style={styles.halfInput}>
                  <Text style={styles.inputLabel}>Precio Boleto *</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.ticket_price}
                    onChangeText={(text) => setFormData({...formData, ticket_price: text})}
                    placeholder="10"
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.halfInput}>
                  <Text style={styles.inputLabel}>Total Boletos</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.total_tickets}
                    onChangeText={(text) => setFormData({...formData, total_tickets: text})}
                    placeholder="100"
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <TouchableOpacity style={styles.createBtn} onPress={handleCreateRaffle}>
                <LinearGradient colors={['#8B5CF6', '#6D28D9']} style={styles.createBtnGradient}>
                  <Ionicons name="add-circle" size={20} color="#FFF" />
                  <Text style={styles.createBtnText}>Crear Sorteo</Text>
                </LinearGradient>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F1F5F9' },
  loadingContainer: { flex: 1 },
  loadingGradient: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 16, fontSize: 16, color: '#FFF', fontWeight: '500' },
  
  // Header
  header: { paddingBottom: 20, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, overflow: 'hidden' },
  headerDecoration: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  decorCircle: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.1)' },
  decorCircle1: { width: 180, height: 180, top: -60, right: -40 },
  decorCircle2: { width: 120, height: 120, bottom: -30, left: -20 },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 16, zIndex: 1 },
  backButton: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#FFF' },
  headerSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  addButton: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  
  // Stats Header
  statsRow: { flexDirection: 'row', marginHorizontal: 16, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 16, padding: 12 },
  statCard: { flex: 1, alignItems: 'center' },
  statNumber: { fontSize: 18, fontWeight: '800', color: '#FFF' },
  statLabelHeader: { fontSize: 11, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  statDividerHeader: { width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.2)' },
  
  // Filters
  filterContainer: { paddingVertical: 14 },
  filterList: { paddingHorizontal: 16, gap: 10 },
  filterTab: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, backgroundColor: '#FFF', borderWidth: 2, borderColor: 'transparent', gap: 6 },
  filterTabText: { fontSize: 13, fontWeight: '500', color: '#6B7280' },
  filterBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, minWidth: 24, alignItems: 'center' },
  filterBadgeText: { fontSize: 11, fontWeight: '700' },
  
  // List
  listContent: { paddingHorizontal: 16, paddingBottom: 100 },
  
  // Card
  raffleCard: { backgroundColor: '#FFF', borderRadius: 18, marginBottom: 14, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 4 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  iconBg: { width: 50, height: 50, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  cardTitleSection: { flex: 1 },
  cardTitle: { fontSize: 17, fontWeight: '700', color: '#1F2937', marginBottom: 4 },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dateText: { fontSize: 12, color: '#9CA3AF' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 10, fontWeight: '700' },
  
  // Progress
  progressSection: { marginBottom: 14 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progressLabel: { fontSize: 12, color: '#6B7280' },
  progressValue: { fontSize: 12, fontWeight: '600', color: '#1F2937' },
  progressBarBg: { height: 8, backgroundColor: '#E5E7EB', borderRadius: 4, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 4 },
  
  // Stats
  cardStats: { flexDirection: 'row', backgroundColor: '#F8FAFC', borderRadius: 12, padding: 12, marginBottom: 12 },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 14, fontWeight: '700', color: '#1F2937', marginTop: 4 },
  statLabel: { fontSize: 10, color: '#9CA3AF', marginTop: 2 },
  statDivider: { width: 1, backgroundColor: '#E5E7EB' },
  
  // Prize
  prizeSection: { marginBottom: 12 },
  prizeBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, gap: 8, alignSelf: 'flex-start' },
  prizeText: { fontSize: 13, fontWeight: '600', color: '#D97706' },
  
  // Winner
  winnerSection: { marginBottom: 12 },
  winnerBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, gap: 8 },
  winnerText: { fontSize: 14, fontWeight: '600', color: '#059669' },
  
  // Actions
  cardActions: { flexDirection: 'row', gap: 10 },
  actionBtn: { flex: 1, borderRadius: 10, overflow: 'hidden' },
  actionGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, gap: 6 },
  actionText: { fontSize: 13, fontWeight: '600', color: '#FFF' },
  actionBtnOutline: { borderWidth: 1.5, borderColor: '#8B5CF6', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, gap: 6 },
  actionTextOutline: { fontSize: 13, fontWeight: '600', color: '#8B5CF6' },
  
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
  modalContent: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#FFF' },
  modalBody: { padding: 20 },
  inputLabel: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8, marginTop: 12 },
  input: { backgroundColor: '#F3F4F6', borderRadius: 12, padding: 14, fontSize: 15, color: '#1F2937' },
  inputMultiline: { minHeight: 80, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: 12 },
  halfInput: { flex: 1 },
  createBtn: { marginTop: 24, marginBottom: 40, borderRadius: 14, overflow: 'hidden' },
  createBtnGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, gap: 8 },
  createBtnText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
});
