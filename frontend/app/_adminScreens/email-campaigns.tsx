import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../../services/api';
import AdminHeader from '../../components/admin/AdminHeader';

const colors = {
  primary: '#6C1110',
  secondary: '#4682B4',
  success: '#4CAF50',
  warning: '#FFA726',
  danger: '#EF5350',
  background: '#F5F7FA',
  card: '#FFFFFF',
  text: '#2C3E50',
  textGray: '#7F8C8D',
  border: '#E0E0E0',
};

const statusConfig = {
  draft: { label: 'Borrador', color: colors.textGray, icon: 'document-outline' },
  scheduled: { label: 'Programada', color: colors.secondary, icon: 'time-outline' },
  sending: { label: 'Enviando', color: colors.warning, icon: 'send-outline' },
  completed: { label: 'Completada', color: colors.success, icon: 'checkmark-circle' },
  cancelled: { label: 'Cancelada', color: colors.danger, icon: 'close-circle' },
};

export default function EmailCampaignsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [campaigns, setCampaigns] = useState([]);
  const [selectedFilter, setSelectedFilter] = useState('all');

  useEffect(() => {
    fetchCampaigns();
  }, [selectedFilter]);

  const fetchCampaigns = async () => {
    try {
      const statusParam = selectedFilter !== 'all' ? `?status=${selectedFilter}` : '';
      
      const response = await api.get(`/admin/campaigns/list${statusParam}`);
      setCampaigns(response.data.campaigns || []);
    } catch (error) {
      console.error('Error fetching campaigns:', error);
      // Don't show alert - endpoint might not exist yet
      setCampaigns([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchCampaigns();
  };

  const handleSendCampaign = async (campaignId: string, campaignName: string) => {
    Alert.alert(
      'Confirmar Envío',
      `¿Estás seguro de enviar la campaña "${campaignName}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Enviar',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.post(`/admin/campaigns/${campaignId}/send`);
              Alert.alert('Éxito', 'Campaña enviada correctamente');
              fetchCampaigns();
            } catch (error: any) {
              Alert.alert('Error', error.response?.data?.detail || 'No se pudo enviar la campaña');
            }
          },
        },
      ]
    );
  };

  const handleDeleteCampaign = async (campaignId: string, campaignName: string) => {
    Alert.alert(
      'Confirmar Eliminación',
      `¿Estás seguro de eliminar "${campaignName}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.post(`/admin/campaigns/${campaignId}/cancel`);
              Alert.alert('Éxito', 'Campaña cancelada');
              fetchCampaigns();
            } catch (error) {
              Alert.alert('Error', 'No se pudo cancelar la campaña');
            }
          },
        },
      ]
    );
  };

  const FilterButton = ({ status, label, icon }) => (
    <TouchableOpacity
      style={[
        styles.filterButton,
        selectedFilter === status && styles.filterButtonActive,
      ]}
      onPress={() => setSelectedFilter(status)}
    >
      <Ionicons
        name={icon}
        size={18}
        color={selectedFilter === status ? colors.primary : colors.textGray}
      />
      <Text
        style={[
          styles.filterButtonText,
          selectedFilter === status && styles.filterButtonTextActive,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  const CampaignCard = ({ campaign }) => {
    const status = statusConfig[campaign.status] || statusConfig.draft;
    const stats = campaign.stats || {};

    return (
      <TouchableOpacity
        style={styles.campaignCard}
        onPress={() => router.push(`/_adminScreens/campaign-details?id=${campaign._id}`)}
      >
        <View style={styles.campaignHeader}>
          <View style={styles.campaignTitleContainer}>
            <Text style={styles.campaignName} numberOfLines={1}>
              {campaign.name}
            </Text>
            <View style={[styles.statusBadge, { backgroundColor: status.color + '20' }]}>
              <Ionicons name={status.icon} size={14} color={status.color} />
              <Text style={[styles.statusText, { color: status.color }]}>
                {status.label}
              </Text>
            </View>
          </View>
          
          {campaign.status === 'draft' && (
            <TouchableOpacity
              style={styles.sendButton}
              onPress={() => handleSendCampaign(campaign._id, campaign.name)}
            >
              <Ionicons name="send" size={20} color={colors.primary} />
            </TouchableOpacity>
          )}
        </View>

        <Text style={styles.campaignSubject} numberOfLines={2}>
          📧 {campaign.subject}
        </Text>

        {campaign.scheduled_at && (
          <View style={styles.scheduleInfo}>
            <Ionicons name="calendar-outline" size={16} color={colors.textGray} />
            <Text style={styles.scheduleText}>
              {new Date(campaign.scheduled_at).toLocaleString('es-ES', {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          </View>
        )}

        {stats.total_recipients > 0 && (
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Ionicons name="people-outline" size={16} color={colors.secondary} />
              <Text style={styles.statText}>{stats.total_recipients}</Text>
            </View>
            {stats.sent > 0 && (
              <>
                <View style={styles.statItem}>
                  <Ionicons name="mail-outline" size={16} color={colors.success} />
                  <Text style={styles.statText}>{stats.sent}</Text>
                </View>
                <View style={styles.statItem}>
                  <Ionicons name="eye-outline" size={16} color={colors.warning} />
                  <Text style={styles.statText}>{stats.opened}</Text>
                </View>
              </>
            )}
          </View>
        )}

        <View style={styles.campaignFooter}>
          <Text style={styles.footerText}>
            Creada: {new Date(campaign.created_at).toLocaleDateString('es-ES')}
          </Text>
          
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => router.push(`/_adminScreens/campaign-details?id=${campaign._id}`)}
            >
              <Ionicons name="stats-chart-outline" size={20} color={colors.secondary} />
            </TouchableOpacity>
            
            {campaign.status === 'scheduled' && (
              <TouchableOpacity
                style={styles.iconButton}
                onPress={() => handleDeleteCampaign(campaign._id, campaign.name)}
              >
                <Ionicons name="close-circle-outline" size={20} color={colors.danger} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <AdminHeader title="Campañas de Email" subtitle="Cargando..." />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Cargando campañas...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AdminHeader 
        title="Campañas de Email" 
        subtitle={`${campaigns.length} campañas`}
        rightAction={{
          icon: 'refresh',
          onPress: onRefresh
        }}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Create Button */}
        <TouchableOpacity
          style={styles.createButton}
          onPress={() => router.push('/_adminScreens/campaign-create')}
        >
          <LinearGradient
            colors={[colors.primary, '#8B0000']}
            style={styles.createButtonGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Ionicons name="add-circle" size={28} color="#FFF" />
            <Text style={styles.createButtonText}>Crear Nueva Campaña</Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* Filters */}
        <View style={styles.filtersSection}>
          <Text style={styles.sectionTitle}>Filtrar por estado</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filtersScroll}
          >
            <FilterButton status="all" label="Todas" icon="apps-outline" />
            <FilterButton status="draft" label="Borradores" icon="document-outline" />
            <FilterButton status="scheduled" label="Programadas" icon="time-outline" />
            <FilterButton status="completed" label="Completadas" icon="checkmark-circle" />
          </ScrollView>
        </View>

        {/* Campaigns List */}
        <View style={styles.campaignsSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Campañas</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{campaigns.length}</Text>
            </View>
          </View>

          {campaigns.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="mail-outline" size={64} color={colors.textGray} />
              <Text style={styles.emptyStateTitle}>No hay campañas</Text>
              <Text style={styles.emptyStateText}>
                {selectedFilter === 'all'
                  ? 'Crea tu primera campaña de email'
                  : `No hay campañas con estado "${statusConfig[selectedFilter]?.label}"`}
              </Text>
              <TouchableOpacity
                style={styles.emptyStateButton}
                onPress={() => router.push('/_adminScreens/campaign-create')}
              >
                <Text style={styles.emptyStateButtonText}>Crear Campaña</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.campaignsList}>
              {campaigns.map((campaign) => (
                <CampaignCard key={campaign._id} campaign={campaign} />
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#1a1a2e',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
  },
  refreshButton: {
    padding: 8,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  createButton: {
    marginBottom: 24,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  createButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    gap: 12,
  },
  createButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
  },
  filtersSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
  },
  filtersScroll: {
    flexDirection: 'row',
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.border,
    marginRight: 8,
    gap: 6,
  },
  filterButtonActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '10',
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textGray,
  },
  filterButtonTextActive: {
    color: colors.primary,
  },
  campaignsSection: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  badge: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 8,
  },
  badgeText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  campaignsList: {
    gap: 16,
  },
  campaignCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  campaignHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  campaignTitleContainer: {
    flex: 1,
    marginRight: 8,
  },
  campaignName: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 6,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  sendButton: {
    padding: 8,
    backgroundColor: colors.primary + '15',
    borderRadius: 12,
  },
  campaignSubject: {
    fontSize: 14,
    color: colors.text,
    marginBottom: 12,
    lineHeight: 20,
  },
  scheduleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 6,
  },
  scheduleText: {
    fontSize: 13,
    color: colors.textGray,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  campaignFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  footerText: {
    fontSize: 12,
    color: colors.textGray,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  iconButton: {
    padding: 6,
  },
  emptyState: {
    alignItems: 'center',
    padding: 48,
    backgroundColor: colors.card,
    borderRadius: 16,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: colors.textGray,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  emptyStateButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  emptyStateButtonText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
  },
});
