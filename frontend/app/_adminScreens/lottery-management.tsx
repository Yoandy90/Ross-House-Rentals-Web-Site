import { useTranslation } from 'react-i18next';
/**
 * Lottery Management Screen - Modern Premium Design
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
  Platform,
  Dimensions,
  FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../../services/api';

const { width: screenWidth } = Dimensions.get('window');

interface Lottery {
  id: string;
  title: string;
  description: string;
  lottery_type: 'scratch_card' | 'bolita' | 'traditional';
  prize_type: 'service' | 'credits' | 'discount' | 'product';
  prize_value: string;
  prize_credits?: number;
  ticket_price: number;
  max_tickets_per_user: number;
  tickets_sold: number;
  participants_count: number;
  status: 'draft' | 'active' | 'completed' | 'cancelled';
  draw_date?: string;
  total_cards?: number;
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

export default function LotteryManagementScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lotteries, setLotteries] = useState<Lottery[]>([]);
  const [filteredLotteries, setFilteredLotteries] = useState<Lottery[]>([]);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [stats, setStats] = useState<Stats>({
    total: 0,
    active: 0,
    completed: 0,
    totalRevenue: 0,
    totalParticipants: 0,
  });

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    lottery_type: 'scratch_card' as 'scratch_card' | 'bolita' | 'traditional',
    prize_type: 'credits' as 'service' | 'credits' | 'discount' | 'product',
    prize_value: '',
    prize_credits: '',
    ticket_price: '',
    max_tickets_per_user: '10',
    total_cards: '1000',
  });

  useEffect(() => {
    loadLotteries();
  }, []);

  useEffect(() => {
    filterLotteries();
  }, [lotteries, activeFilter, searchQuery]);

  const loadLotteries = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const response = await api.get('/admin/lotteries');
      const lotteriesData = response.data.lotteries || [];
      setLotteries(lotteriesData);

      // Calculate stats
      const newStats: Stats = {
        total: lotteriesData.length,
        active: lotteriesData.filter((l: Lottery) => l.status === 'active').length,
        completed: lotteriesData.filter((l: Lottery) => l.status === 'completed').length,
        totalRevenue: lotteriesData.reduce((sum: number, l: Lottery) => 
          sum + (l.tickets_sold * l.ticket_price), 0),
        totalParticipants: lotteriesData.reduce((sum: number, l: Lottery) => 
          sum + l.participants_count, 0),
      };
      setStats(newStats);
    } catch (error) {
      console.error('Error loading lotteries:', error);
      Alert.alert('Error', 'No se pudieron cargar las loterías');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const filterLotteries = () => {
    let filtered = [...lotteries];

    if (activeFilter !== 'all') {
      filtered = filtered.filter(l => l.status === activeFilter);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(l => 
        l.title.toLowerCase().includes(query) ||
        l.description.toLowerCase().includes(query)
      );
    }

    setFilteredLotteries(filtered);
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'active':
        return { bg: '#ECFDF5', text: '#059669', label: 'Activa', icon: 'play-circle', gradient: ['#10B981', '#059669'] };
      case 'completed':
        return { bg: '#EEF2FF', text: '#4F46E5', label: 'Completada', icon: 'checkmark-circle', gradient: ['#6366F1', '#4F46E5'] };
      case 'cancelled':
        return { bg: '#FEF2F2', text: '#DC2626', label: 'Cancelada', icon: 'close-circle', gradient: ['#EF4444', '#DC2626'] };
      default:
        return { bg: '#FEF3C7', text: '#D97706', label: 'Borrador', icon: 'document', gradient: ['#F59E0B', '#D97706'] };
    }
  };

  const getLotteryTypeConfig = (type: string) => {
    switch (type) {
      case 'scratch_card':
        return { icon: 'card', label: 'Raspadita', color: '#F59E0B' };
      case 'bolita':
        return { icon: 'ellipse', label: 'Bolita', color: '#8B5CF6' };
      case 'traditional':
        return { icon: 'ticket', label: 'Tradicional', color: '#3B82F6' };
      default:
        return { icon: 'help', label: type, color: '#6B7280' };
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const handleCreateLottery = async () => {
    if (!formData.title || !formData.prize_value || !formData.ticket_price) {
      Alert.alert('Error', 'Completa todos los campos requeridos');
      return;
    }

    try {
      const payload = {
        title: formData.title,
        description: formData.description,
        lottery_type: formData.lottery_type,
        prize_type: formData.prize_type,
        prize_value: formData.prize_value,
        prize_credits: formData.prize_type === 'credits' ? parseInt(formData.prize_credits) : undefined,
        ticket_price: parseFloat(formData.ticket_price),
        max_tickets_per_user: parseInt(formData.max_tickets_per_user),
        total_cards: parseInt(formData.total_cards),
      };

      await api.post('/admin/lotteries', payload);
      Alert.alert('Éxito', 'Lotería creada correctamente');
      setShowCreateModal(false);
      loadLotteries();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'No se pudo crear');
    }
  };

  const handleActivate = async (lottery: Lottery) => {
    try {
      await api.put(`/admin/lotteries/${lottery.id}/status`, { status: 'active' });
      Alert.alert('Éxito', 'Lotería activada');
      loadLotteries();
    } catch (error) {
      Alert.alert('Error', 'No se pudo activar');
    }
  };

  const renderLotteryCard = ({ item }: { item: Lottery }) => {
    const statusConfig = getStatusConfig(item.status);
    const typeConfig = getLotteryTypeConfig(item.lottery_type);

    return (
      <TouchableOpacity 
        style={styles.lotteryCard}
        activeOpacity={0.7}
        onPress={() => {
          // Navigate to lottery details
        }}
      >
        <View style={styles.cardHeader}>
          <LinearGradient
            colors={statusConfig.gradient}
            style={styles.typeIconBg}
          >
            <Ionicons name={typeConfig.icon as any} size={24} color="#FFF" />
          </LinearGradient>
          <View style={styles.cardTitleSection}>
            <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
            <View style={styles.typeRow}>
              <Text style={[styles.typeLabel, { color: typeConfig.color }]}>
                {typeConfig.label}
              </Text>
              <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
                <Text style={[styles.statusText, { color: statusConfig.text }]}>
                  {statusConfig.label}
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.cardStats}>
          <View style={styles.statItem}>
            <Ionicons name="ticket-outline" size={16} color="#6B7280" />
            <Text style={styles.statValue}>{item.tickets_sold}</Text>
            <Text style={styles.statLabel}>Vendidos</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Ionicons name="people-outline" size={16} color="#6B7280" />
            <Text style={styles.statValue}>{item.participants_count}</Text>
            <Text style={styles.statLabel}>Participantes</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Ionicons name="cash-outline" size={16} color="#6B7280" />
            <Text style={styles.statValue}>{formatCurrency(item.ticket_price)}</Text>
            <Text style={styles.statLabel}>Precio</Text>
          </View>
        </View>

        <View style={styles.cardPrize}>
          <LinearGradient
            colors={['#FEF3C7', '#FDE68A']}
            style={styles.prizeBadge}
          >
            <Ionicons name="trophy" size={16} color="#D97706" />
            <Text style={styles.prizeText}>Premio: {item.prize_value}</Text>
          </LinearGradient>
        </View>

        <View style={styles.cardActions}>
          {item.status === 'draft' && (
            <TouchableOpacity 
              style={styles.actionBtn}
              onPress={() => handleActivate(item)}
            >
              <LinearGradient colors={['#10B981', '#059669']} style={styles.actionGradient}>
                <Ionicons name="play" size={16} color="#FFF" />
                <Text style={styles.actionText}>Activar</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[styles.actionBtn, styles.actionBtnOutline]}>
            <Ionicons name="stats-chart" size={16} color="#6C1110" />
            <Text style={styles.actionTextOutline}>Ver Stats</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const filters = [
    { type: 'all' as FilterType, label: 'Todas', count: stats.total, color: '#6C1110' },
    { type: 'active' as FilterType, label: 'Activas', count: stats.active, color: '#10B981' },
    { type: 'completed' as FilterType, label: 'Completadas', count: stats.completed, color: '#6366F1' },
    { type: 'draft' as FilterType, label: 'Borradores', count: stats.total - stats.active - stats.completed, color: '#F59E0B' },
  ];

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <LinearGradient colors={['#F59E0B', '#D97706']} style={styles.loadingGradient}>
          <ActivityIndicator size="large" color="#FFF" />
          <Text style={styles.loadingText}>Cargando loterías...</Text>
        </LinearGradient>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Premium Header */}
      <LinearGradient
        colors={['#F59E0B', '#D97706', '#B45309']}
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
              <Ionicons name="ticket" size={24} color="#FFF" />
              <Text style={styles.headerTitle}>Loterías</Text>
            </View>
            <Text style={styles.headerSubtitle}>{stats.total} juegos creados</Text>
          </View>
          
          <TouchableOpacity style={styles.addButton} onPress={() => setShowCreateModal(true)}>
            <Ionicons name="add" size={24} color="#FFF" />
          </TouchableOpacity>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{formatCurrency(stats.totalRevenue)}</Text>
            <Text style={styles.statLabel}>Recaudado</Text>
          </View>
          <View style={styles.statDividerHeader} />
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats.totalParticipants}</Text>
            <Text style={styles.statLabel}>Participantes</Text>
          </View>
          <View style={styles.statDividerHeader} />
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats.active}</Text>
            <Text style={styles.statLabel}>Activas</Text>
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

      {/* Lottery List */}
      <FlatList
        data={filteredLotteries}
        renderItem={renderLotteryCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadLotteries(true)} tintColor="#F59E0B" />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <LinearGradient colors={['#FEF3C7', '#FDE68A']} style={styles.emptyIconBg}>
              <Ionicons name="ticket-outline" size={48} color="#D97706" />
            </LinearGradient>
            <Text style={styles.emptyTitle}>No hay loterías</Text>
            <Text style={styles.emptyText}>Crea tu primera lotería</Text>
            <TouchableOpacity style={styles.emptyButton} onPress={() => setShowCreateModal(true)}>
              <LinearGradient colors={['#F59E0B', '#D97706']} style={styles.emptyButtonGradient}>
                <Ionicons name="add" size={20} color="#FFF" />
                <Text style={styles.emptyButtonText}>Nueva Lotería</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        }
      />

      {/* Create Modal */}
      <Modal visible={showCreateModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <LinearGradient colors={['#F59E0B', '#D97706']} style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nueva Lotería</Text>
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
                placeholder={t('admin.lotteryNamePlaceholder', 'Ej: Raspadita Navideña')}
              />

              <Text style={styles.inputLabel}>Descripción</Text>
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                value={formData.description}
                onChangeText={(text) => setFormData({...formData, description: text})}
                placeholder={t('admin.lotteryDescPlaceholder', 'Descripción del juego...')}
                multiline
              />

              <Text style={styles.inputLabel}>Tipo de Lotería</Text>
              <View style={styles.typeSelector}>
                {['scratch_card', 'bolita', 'traditional'].map((type) => {
                  const config = getLotteryTypeConfig(type);
                  return (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.typeOption,
                        formData.lottery_type === type && { borderColor: config.color, backgroundColor: `${config.color}15` }
                      ]}
                      onPress={() => setFormData({...formData, lottery_type: type as any})}
                    >
                      <Ionicons name={config.icon as any} size={20} color={config.color} />
                      <Text style={[styles.typeOptionText, { color: config.color }]}>{config.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.inputLabel}>Premio *</Text>
              <TextInput
                style={styles.input}
                value={formData.prize_value}
                onChangeText={(text) => setFormData({...formData, prize_value: text})}
                placeholder={t('admin.lotteryPrizePlaceholder', 'Ej: 100 créditos, Descuento 50%')}
              />

              <Text style={styles.inputLabel}>Precio del Ticket *</Text>
              <TextInput
                style={styles.input}
                value={formData.ticket_price}
                onChangeText={(text) => setFormData({...formData, ticket_price: text})}
                placeholder="5"
                keyboardType="numeric"
              />

              <TouchableOpacity style={styles.createBtn} onPress={handleCreateLottery}>
                <LinearGradient colors={['#F59E0B', '#D97706']} style={styles.createBtnGradient}>
                  <Ionicons name="add-circle" size={20} color="#FFF" />
                  <Text style={styles.createBtnText}>Crear Lotería</Text>
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
  
  // Stats
  statsRow: { flexDirection: 'row', marginHorizontal: 16, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 16, padding: 12 },
  statCard: { flex: 1, alignItems: 'center' },
  statNumber: { fontSize: 18, fontWeight: '800', color: '#FFF' },
  statLabel: { fontSize: 11, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
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
  lotteryCard: { backgroundColor: '#FFF', borderRadius: 18, marginBottom: 14, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 4 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  typeIconBg: { width: 50, height: 50, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  cardTitleSection: { flex: 1 },
  cardTitle: { fontSize: 17, fontWeight: '700', color: '#1F2937', marginBottom: 4 },
  typeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  typeLabel: { fontSize: 12, fontWeight: '600' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusText: { fontSize: 10, fontWeight: '700' },
  
  cardStats: { flexDirection: 'row', backgroundColor: '#F8FAFC', borderRadius: 12, padding: 12, marginBottom: 12 },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 16, fontWeight: '700', color: '#1F2937', marginTop: 4 },
  statDivider: { width: 1, backgroundColor: '#E5E7EB' },
  
  cardPrize: { marginBottom: 12 },
  prizeBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, gap: 8, alignSelf: 'flex-start' },
  prizeText: { fontSize: 13, fontWeight: '600', color: '#D97706' },
  
  cardActions: { flexDirection: 'row', gap: 10 },
  actionBtn: { flex: 1, borderRadius: 10, overflow: 'hidden' },
  actionGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, gap: 6 },
  actionText: { fontSize: 13, fontWeight: '600', color: '#FFF' },
  actionBtnOutline: { borderWidth: 1.5, borderColor: '#6C1110', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, gap: 6 },
  actionTextOutline: { fontSize: 13, fontWeight: '600', color: '#6C1110' },
  
  // Empty State
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
  typeSelector: { flexDirection: 'row', gap: 10 },
  typeOption: { flex: 1, alignItems: 'center', padding: 12, borderRadius: 12, borderWidth: 2, borderColor: '#E5E7EB', gap: 4 },
  typeOptionText: { fontSize: 12, fontWeight: '600' },
  createBtn: { marginTop: 24, marginBottom: 40, borderRadius: 14, overflow: 'hidden' },
  createBtnGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, gap: 8 },
  createBtnText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
});
