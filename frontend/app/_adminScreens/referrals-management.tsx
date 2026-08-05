import React, { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import AdminHeader from '../../components/admin/AdminHeader';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
  TextInput,
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import api from '../../services/api';

export default function ReferralsManagementScreen() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [referrals, setReferrals] = useState([]);
  const [filter, setFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('referrals'); // referrals, tiers, payouts
  
  // Tiers state
  const [tiers, setTiers] = useState([]);
  const [showTierModal, setShowTierModal] = useState(false);
  const [editingTier, setEditingTier] = useState<any>(null);
  const [tierForm, setTierForm] = useState({ min_referrals: '', max_referrals: '', reward_amount_usd: '' });
  
  // Payouts state
  const [payouts, setPayouts] = useState([]);

  useEffect(() => {
    loadData();
  }, [filter, activeTab]);

  const loadData = async () => {
    try {
      setLoading(true);

      if (activeTab === 'referrals') {
        // Load statistics
        const statsResponse = await api.get('/admin/referrals/stats');
        setStats(statsResponse.data);

        // Load referrals
        const referralsUrl = filter === 'all'
          ? '/admin/referrals'
          : `/admin/referrals?status=${filter}`;
        
        const referralsResponse = await api.get(referralsUrl);
        setReferrals(referralsResponse.data.referrals || []);
      } else if (activeTab === 'tiers') {
        // Load reward tiers
        const tiersResponse = await api.get('/admin/referrals/reward-tiers');
        setTiers(tiersResponse.data.tiers || []);
      } else if (activeTab === 'payouts') {
        // Load pending payouts
        const payoutsResponse = await api.get('/admin/referrals/pending-payouts');
        setPayouts(payoutsResponse.data.payouts || []);
      }

    } catch (error: any) {
      console.error('Error loading data:', error);
      Alert.alert('Error', error.response?.data?.detail || 'No se pudieron cargar los datos');
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteReferral = async (referral: any) => {
    if (!referral.appointment_id) {
      Alert.alert('Error', 'Este referido no tiene una cita asociada');
      return;
    }

    Alert.alert(
      'Completar Referido',
      `¿Marcar como completado?\n\n${referral.referred_name} será marcado como completado y ${referral.referrer_name} recibirá su recompensa.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Completar',
          style: 'default',
          onPress: async () => {
            try {
              const response = await api.post(
                `/admin/referrals/${referral.id}/complete?appointment_id=${referral.appointment_id}`
              );
              
              Alert.alert(
                '¡Éxito!',
                `Referido completado. ${referral.referrer_name} ganó $${response.data.reward_amount} USD`
              );
              
              loadData();
            } catch (error: any) {
              Alert.alert('Error', error.response?.data?.detail || 'No se pudo completar el referido');
            }
          }
        }
      ]
    );
  };

  const handleSaveTier = async () => {
    try {
      const data = {
        min_referrals: parseInt(tierForm.min_referrals),
        max_referrals: parseInt(tierForm.max_referrals),
        reward_amount_usd: parseFloat(tierForm.reward_amount_usd),
      };

      if (editingTier) {
        // Update
        await api.patch(`/admin/referrals/reward-tiers/${editingTier.id}`, data);
        Alert.alert('Éxito', 'Nivel actualizado correctamente');
      } else {
        // Create
        await api.post('/admin/referrals/reward-tiers', data);
        Alert.alert('Éxito', 'Nivel creado correctamente');
      }

      setShowTierModal(false);
      setEditingTier(null);
      setTierForm({ min_referrals: '', max_referrals: '', reward_amount_usd: '' });
      loadData();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'No se pudo guardar el nivel');
    }
  };

  const handleDeleteTier = async (tier: any) => {
    Alert.alert(
      'Eliminar Nivel',
      `¿Estás seguro de eliminar el nivel ${tier.min_referrals}-${tier.max_referrals}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/admin/referrals/reward-tiers/${tier.id}`);
              Alert.alert('Éxito', 'Nivel eliminado');
              loadData();
            } catch (error: any) {
              Alert.alert('Error', 'No se pudo eliminar el nivel');
            }
          }
        }
      ]
    );
  };

  const openTierModal = (tier?: any) => {
    if (tier) {
      setEditingTier(tier);
      setTierForm({
        min_referrals: tier.min_referrals.toString(),
        max_referrals: tier.max_referrals.toString(),
        reward_amount_usd: tier.reward_amount_usd.toString(),
      });
    } else {
      setEditingTier(null);
      setTierForm({ min_referrals: '', max_referrals: '', reward_amount_usd: '' });
    }
    setShowTierModal(true);
  };

  const renderFilterButtons = () => (
    <View style={styles.filterContainer}>
      <TouchableOpacity
        style={[styles.filterButton, filter === 'all' && styles.filterButtonActive]}
        onPress={() => setFilter('all')}
      >
        <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>
          Todos
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.filterButton, filter === 'pending' && styles.filterButtonActive]}
        onPress={() => setFilter('pending')}
      >
        <Text style={[styles.filterText, filter === 'pending' && styles.filterTextActive]}>
          Pendientes
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.filterButton, filter === 'completed' && styles.filterButtonActive]}
        onPress={() => setFilter('completed')}
      >
        <Text style={[styles.filterText, filter === 'completed' && styles.filterTextActive]}>
          Completados
        </Text>
      </TouchableOpacity>
    </View>
  );

  if (loading && !stats && activeTab === 'referrals') {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6C1110" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AdminHeader title="Programa de Referidos" />
      {/* Header */}
      <LinearGradient
        colors={['#6C1110', '#8B1918']}
        style={styles.header}
      >
        <Text style={styles.headerTitle}>Gestión de Referidos</Text>
        <Text style={styles.headerSubtitle}>Panel de administración</Text>
      </LinearGradient>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'referrals' && styles.tabActive]}
          onPress={() => setActiveTab('referrals')}
        >
          <Ionicons name="people" size={20} color={activeTab === 'referrals' ? '#6C1110' : '#666'} />
          <Text style={[styles.tabText, activeTab === 'referrals' && styles.tabTextActive]}>
            Referidos
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'tiers' && styles.tabActive]}
          onPress={() => setActiveTab('tiers')}
        >
          <Ionicons name="trophy" size={20} color={activeTab === 'tiers' ? '#6C1110' : '#666'} />
          <Text style={[styles.tabText, activeTab === 'tiers' && styles.tabTextActive]}>
            Niveles
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'payouts' && styles.tabActive]}
          onPress={() => setActiveTab('payouts')}
        >
          <Ionicons name="cash" size={20} color={activeTab === 'payouts' ? '#6C1110' : '#666'} />
          <Text style={[styles.tabText, activeTab === 'payouts' && styles.tabTextActive]}>
            Pagos
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        {/* REFERRALS TAB */}
        {activeTab === 'referrals' && (
          <>
            {/* Statistics Cards */}
            {stats && (
              <View style={styles.statsSection}>
                <Text style={styles.sectionTitle}>Estadísticas Generales</Text>

                <View style={styles.statsGrid}>
                  <View style={styles.statCard}>
                    <Ionicons name="code-outline" size={24} color="#6C1110" />
                    <Text style={styles.statValue}>{stats.total_codes}</Text>
                    <Text style={styles.statLabel}>Códigos Activos</Text>
                  </View>

                  <View style={styles.statCard}>
                    <Ionicons name="people-outline" size={24} color="#5DC1D9" />
                    <Text style={styles.statValue}>{stats.total_referrals}</Text>
                    <Text style={styles.statLabel}>Total Referidos</Text>
                  </View>

                  <View style={styles.statCard}>
                    <Ionicons name="time-outline" size={24} color="#FFC107" />
                    <Text style={styles.statValue}>{stats.pending_referrals}</Text>
                    <Text style={styles.statLabel}>Pendientes</Text>
                  </View>

                  <View style={styles.statCard}>
                    <Ionicons name="checkmark-circle-outline" size={24} color="#28A745" />
                    <Text style={styles.statValue}>{stats.completed_referrals}</Text>
                    <Text style={styles.statLabel}>Completados</Text>
                  </View>

                  <View style={[styles.statCard, styles.statCardWide]}>
                    <Ionicons name="trophy-outline" size={24} color="#ED201D" />
                    <Text style={styles.statValue}>${stats.total_rewards_usd?.toFixed(2)}</Text>
                    <Text style={styles.statLabel}>USD Otorgados</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Top Referrers */}
            {stats && stats.top_referrers && stats.top_referrers.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Top Referidores</Text>

                {stats.top_referrers.slice(0, 5).map((referrer: any, index: number) => (
                  <View key={index} style={styles.topReferrerCard}>
                    <View style={styles.rankBadge}>
                      <Text style={styles.rankText}>#{index + 1}</Text>
                    </View>
                    <View style={styles.topReferrerInfo}>
                      <Text style={styles.topReferrerName}>{referrer.user_name}</Text>
                      <Text style={styles.topReferrerEmail}>{referrer.user_email}</Text>
                      <Text style={styles.topReferrerCode}>Código: {referrer.code}</Text>
                    </View>
                    <View style={styles.topReferrerStats}>
                      <View style={styles.topStatRow}>
                        <Text style={styles.topStatValue}>{referrer.total_referrals}</Text>
                        <Text style={styles.topStatLabel}>Total</Text>
                      </View>
                      <View style={styles.topStatRow}>
                        <Text style={[styles.topStatValue, { color: '#28A745' }]}>
                          {referrer.completed_referrals}
                        </Text>
                        <Text style={styles.topStatLabel}>Exitosos</Text>
                      </View>
                      <View style={styles.topStatRow}>
                        <Text style={[styles.topStatValue, { color: '#ED201D' }]}>
                          ${referrer.total_earned_usd?.toFixed(0)}
                        </Text>
                        <Text style={styles.topStatLabel}>Ganado</Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Referrals List */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Lista de Referidos</Text>

              {renderFilterButtons()}

              {loading ? (
                <View style={styles.loadingList}>
                  <ActivityIndicator size="small" color="#6C1110" />
                </View>
              ) : referrals.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="file-tray-outline" size={60} color="#CCC" />
                  <Text style={styles.emptyText}>No hay referidos en esta categoría</Text>
                </View>
              ) : (
                referrals.map((referral: any, index: number) => (
                  <View key={index} style={styles.referralCard}>
                    <View style={styles.referralHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.referralLabel}>Referidor</Text>
                        <Text style={styles.referralName}>{referral.referrer_name}</Text>
                        <Text style={styles.referralEmail}>{referral.referrer_email}</Text>
                      </View>
                      <Ionicons name="arrow-forward" size={24} color="#999" />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.referralLabel}>Referido</Text>
                        <Text style={styles.referralName}>{referral.referred_name}</Text>
                        <Text style={styles.referralEmail}>{referral.referred_email}</Text>
                      </View>
                    </View>

                    <View style={styles.referralFooter}>
                      <View>
                        <Text style={styles.referralCodeText}>Código: {referral.code}</Text>
                        <Text style={styles.referralDate}>
                          {new Date(referral.created_at).toLocaleDateString()}
                        </Text>
                      </View>

                      <View style={styles.referralActions}>
                        <View style={[
                          styles.statusBadge,
                          referral.status === 'completed' ? styles.statusCompleted : styles.statusPending
                        ]}>
                          <Text style={styles.statusText}>
                            {referral.status === 'completed' ? 'Completado' : 'Pendiente'}
                          </Text>
                        </View>

                        {referral.status === 'pending' && (
                          <TouchableOpacity
                            style={styles.completeButton}
                            onPress={() => handleCompleteReferral(referral)}
                          >
                            <Ionicons name="checkmark-circle" size={20} color="#FFF" />
                            <Text style={styles.completeButtonText}>Completar</Text>
                          </TouchableOpacity>
                        )}

                        {referral.status === 'completed' && (
                          <Text style={styles.rewardText}>${referral.reward_amount_usd} USD</Text>
                        )}
                      </View>
                    </View>
                  </View>
                ))
              )}
            </View>
          </>
        )}

        {/* TIERS TAB */}
        {activeTab === 'tiers' && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Niveles de Recompensa</Text>
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => openTierModal()}
              >
                <Ionicons name="add-circle" size={24} color="#6C1110" />
                <Text style={styles.addButtonText}>Agregar</Text>
              </TouchableOpacity>
            </View>

            {loading ? (
              <ActivityIndicator size="small" color="#6C1110" />
            ) : tiers.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="trophy-outline" size={60} color="#CCC" />
                <Text style={styles.emptyText}>No hay niveles configurados</Text>
              </View>
            ) : (
              tiers.map((tier: any, index: number) => (
                <View key={tier.id} style={styles.tierCard}>
                  <View style={styles.tierLeft}>
                    <View style={styles.tierRank}>
                      <Text style={styles.tierRankText}>
                        {index === 0 ? '🥉' : index === 1 ? '🥈' : index === 2 ? '🥇' : index === 3 ? '💎' : '👑'}
                      </Text>
                    </View>
                    <View>
                      <Text style={styles.tierRange}>
                        {tier.min_referrals} - {tier.max_referrals} referidos
                      </Text>
                      <Text style={styles.tierAmount}>${tier.reward_amount_usd} USD por referido</Text>
                    </View>
                  </View>
                  <View style={styles.tierActions}>
                    <TouchableOpacity
                      style={styles.iconButton}
                      onPress={() => openTierModal(tier)}
                    >
                      <Ionicons name="create-outline" size={24} color="#6C1110" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.iconButton}
                      onPress={() => handleDeleteTier(tier)}
                    >
                      <Ionicons name="trash-outline" size={24} color="#DC3545" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {/* PAYOUTS TAB */}
        {activeTab === 'payouts' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Pagos Pendientes</Text>

            {loading ? (
              <ActivityIndicator size="small" color="#6C1110" />
            ) : payouts.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="checkmark-done-circle-outline" size={60} color="#28A745" />
                <Text style={styles.emptyText}>No hay pagos pendientes</Text>
              </View>
            ) : (
              <>
                <View style={styles.payoutSummary}>
                  <Text style={styles.payoutSummaryLabel}>Total a Pagar:</Text>
                  <Text style={styles.payoutSummaryAmount}>
                    ${payouts.reduce((sum: number, p: any) => sum + p.amount_usd, 0).toFixed(2)} USD
                  </Text>
                </View>

                {payouts.map((payout: any, index: number) => (
                  <View key={index} style={styles.payoutCard}>
                    <View style={styles.payoutInfo}>
                      <Text style={styles.payoutName}>{payout.referrer_name}</Text>
                      <Text style={styles.payoutEmail}>{payout.referrer_email}</Text>
                      <Text style={styles.payoutReferred}>
                        Referido: {payout.referred_name}
                      </Text>
                      <Text style={styles.payoutDate}>
                        {new Date(payout.created_at).toLocaleDateString()}
                      </Text>
                    </View>
                    <View style={styles.payoutAmount}>
                      <Text style={styles.payoutAmountText}>${payout.amount_usd}</Text>
                      <Text style={styles.payoutAmountLabel}>USD</Text>
                    </View>
                  </View>
                ))}
              </>
            )}
          </View>
        )}
      </ScrollView>

      {/* Tier Modal */}
      <Modal
        visible={showTierModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowTierModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {editingTier ? 'Editar Nivel' : 'Nuevo Nivel'}
            </Text>

            <Text style={styles.inputLabel}>Mínimo de Referidos</Text>
            <TextInput
              style={styles.input}
              value={tierForm.min_referrals}
              onChangeText={(text) => setTierForm({ ...tierForm, min_referrals: text })}
              keyboardType="numeric"
              placeholder="Ej: 1"
            />

            <Text style={styles.inputLabel}>Máximo de Referidos</Text>
            <TextInput
              style={styles.input}
              value={tierForm.max_referrals}
              onChangeText={(text) => setTierForm({ ...tierForm, max_referrals: text })}
              keyboardType="numeric"
              placeholder="Ej: 10"
            />

            <Text style={styles.inputLabel}>Recompensa (USD)</Text>
            <TextInput
              style={styles.input}
              value={tierForm.reward_amount_usd}
              onChangeText={(text) => setTierForm({ ...tierForm, reward_amount_usd: text })}
              keyboardType="numeric"
              placeholder="Ej: 10.00"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => {
                  setShowTierModal(false);
                  setEditingTier(null);
                }}
              >
                <Text style={styles.modalButtonText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSave]}
                onPress={handleSaveTier}
              >
                <Text style={[styles.modalButtonText, { color: '#FFF' }]}>Guardar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
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
    backgroundColor: '#F5F5F5',
  },
  header: {
    padding: 20,
    paddingTop: Platform.OS === 'web' ? 20 : 60,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFF',
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    marginTop: 4,
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#6C1110',
  },
  tabText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#6C1110',
    fontWeight: '700',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  statsSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addButtonText: {
    fontSize: 16,
    color: '#6C1110',
    fontWeight: '600',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: Platform.OS === 'web' ? '22%' : '45%',
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  statCardWide: {
    minWidth: Platform.OS === 'web' ? '48%' : '100%',
  },
  statValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 8,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  section: {
    marginBottom: 24,
  },
  topReferrerCard: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  rankBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#6C1110',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  rankText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  topReferrerInfo: {
    flex: 1,
  },
  topReferrerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  topReferrerEmail: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  topReferrerCode: {
    fontSize: 12,
    color: '#999',
  },
  topReferrerStats: {
    flexDirection: 'row',
    gap: 16,
  },
  topStatRow: {
    alignItems: 'center',
  },
  topStatValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#6C1110',
  },
  topStatLabel: {
    fontSize: 11,
    color: '#666',
  },
  filterContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  filterButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#DDD',
    alignItems: 'center',
  },
  filterButtonActive: {
    backgroundColor: '#6C1110',
    borderColor: '#6C1110',
  },
  filterText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  filterTextActive: {
    color: '#FFF',
  },
  loadingList: {
    padding: 40,
    alignItems: 'center',
  },
  emptyState: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 40,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 16,
    textAlign: 'center',
  },
  referralCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  referralHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  referralLabel: {
    fontSize: 11,
    color: '#999',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  referralName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  referralEmail: {
    fontSize: 12,
    color: '#666',
  },
  referralFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#EEE',
    paddingTop: 12,
  },
  referralCodeText: {
    fontSize: 13,
    color: '#6C1110',
    fontWeight: '600',
    marginBottom: 4,
  },
  referralDate: {
    fontSize: 12,
    color: '#999',
  },
  referralActions: {
    alignItems: 'flex-end',
    gap: 8,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusPending: {
    backgroundColor: '#FFC107',
  },
  statusCompleted: {
    backgroundColor: '#28A745',
  },
  statusText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  completeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#28A745',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  completeButtonText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600',
  },
  rewardText: {
    fontSize: 14,
    color: '#28A745',
    fontWeight: '700',
  },
  tierCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  tierLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  tierRank: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  tierRankText: {
    fontSize: 24,
  },
  tierRange: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  tierAmount: {
    fontSize: 14,
    color: '#28A745',
    fontWeight: '600',
  },
  tierActions: {
    flexDirection: 'row',
    gap: 12,
  },
  iconButton: {
    padding: 8,
  },
  payoutSummary: {
    backgroundColor: '#6C1110',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    alignItems: 'center',
  },
  payoutSummaryLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 8,
  },
  payoutSummaryAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFF',
  },
  payoutCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  payoutInfo: {
    flex: 1,
  },
  payoutName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  payoutEmail: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  payoutReferred: {
    fontSize: 13,
    color: '#999',
    marginBottom: 4,
  },
  payoutDate: {
    fontSize: 12,
    color: '#999',
  },
  payoutAmount: {
    alignItems: 'flex-end',
  },
  payoutAmountText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#28A745',
  },
  payoutAmountLabel: {
    fontSize: 12,
    color: '#666',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 24,
    textAlign: 'center',
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#F9F9F9',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: '#F0F0F0',
  },
  modalButtonSave: {
    backgroundColor: '#6C1110',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
});
