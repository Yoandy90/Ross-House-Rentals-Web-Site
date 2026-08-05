/**
 * Bolita Management Screen - Admin
 * Allows admin to:
 * 1. Enter winning numbers (Fijo, Corrido 1, Corrido 2)
 * 2. View draw history
 * 3. See pending bets and winners
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Modal,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import api from '../../services/api';
import AdminHeader from '../../components/admin/AdminHeader';

interface Draw {
  date: string;
  fijo: number;
  corridos: number[];
}

interface PendingBet {
  id: string;
  user_name: string;
  type: string;
  numbers: number[];
  amount: number;
  potential_win: number;
  created_at: string;
}

interface DrawStats {
  pending_bets: number;
  total_amount: number;
  potential_payout: number;
}

export default function BolitaManagementScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // Draw input
  const [fijo, setFijo] = useState('');
  const [corrido1, setCorrido1] = useState('');
  const [corrido2, setCorrido2] = useState('');
  
  // Data
  const [drawHistory, setDrawHistory] = useState<Draw[]>([]);
  const [pendingBets, setPendingBets] = useState<PendingBet[]>([]);
  const [stats, setStats] = useState<DrawStats>({ pending_bets: 0, total_amount: 0, potential_payout: 0 });
  
  // Modal
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load draw history
      const historyRes = await api.get('/bolita/history?limit=10');
      setDrawHistory(historyRes.data.draws || []);
      
      // Load pending bets (admin endpoint)
      try {
        const betsRes = await api.get('/admin/bolita/pending-bets');
        setPendingBets(betsRes.data.bets || []);
        setStats(betsRes.data.stats || { pending_bets: 0, total_amount: 0, potential_payout: 0 });
      } catch (e) {
        // Endpoint might not exist, calculate from history
        console.log('Could not load pending bets');
      }
      
    } catch (error) {
      console.error('Error loading bolita data:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, []);

  const validateNumbers = () => {
    const f = parseInt(fijo);
    const c1 = parseInt(corrido1);
    const c2 = parseInt(corrido2);
    
    if (isNaN(f) || isNaN(c1) || isNaN(c2)) {
      Alert.alert('Error', 'Todos los números son requeridos');
      return false;
    }
    
    if (f < 1 || f > 100 || c1 < 1 || c1 > 100 || c2 < 1 || c2 > 100) {
      Alert.alert('Error', 'Los números deben estar entre 1 y 100');
      return false;
    }
    
    if (f === c1 || f === c2 || c1 === c2) {
      Alert.alert('Error', 'Los tres números deben ser diferentes');
      return false;
    }
    
    return true;
  };

  const handleSubmitDraw = () => {
    if (!validateNumbers()) return;
    setShowConfirmModal(true);
  };

  const confirmDraw = async () => {
    setShowConfirmModal(false);
    setSubmitting(true);
    
    try {
      const response = await api.post('/bolita/admin/draw', {
        fijo: parseInt(fijo),
        corrido1: parseInt(corrido1),
        corrido2: parseInt(corrido2),
      });
      
      setLastResult(response.data);
      
      Alert.alert(
        '🎉 Sorteo Procesado',
        `Fijo: ${fijo}\nCorridos: ${corrido1}, ${corrido2}\n\n` +
        `Ganadores: ${response.data.winners_count}\n` +
        `Total pagado: ${response.data.total_winnings} créditos`,
        [{ text: 'OK', onPress: () => {
          setFijo('');
          setCorrido1('');
          setCorrido2('');
          loadData();
        }}]
      );
      
    } catch (error: any) {
      console.error('Error creating draw:', error);
      Alert.alert('Error', error.response?.data?.detail || 'No se pudo procesar el sorteo');
    } finally {
      setSubmitting(false);
    }
  };

  const getTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      'fijo': 'Fijo',
      'corrido': 'Corrido',
      'parley': 'Parley',
      'candado': 'Candado',
    };
    return types[type] || type;
  };

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      'fijo': '#EF4444',
      'corrido': '#3B82F6',
      'parley': '#8B5CF6',
      'candado': '#F59E0B',
    };
    return colors[type] || '#6B7280';
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <AdminHeader 
          title="Gestión Bolita" 
          subtitle="🎱 La Bolita Cubana"
          rightAction={{
            icon: 'refresh',
            onPress: onRefresh
          }}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6C1110" />
          <Text style={styles.loadingText}>Cargando datos...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AdminHeader 
        title="Gestión Bolita" 
        subtitle={`${stats.pending_bets} apuestas pendientes`}
        rightAction={{
          icon: 'refresh',
          onPress: onRefresh
        }}
      />

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#6C1110']} />
        }
      >
        {/* Stats Cards */}
        <View style={styles.statsContainer}>
          <View style={[styles.statCard, { backgroundColor: '#FEF3C7' }]}>
            <Ionicons name="ticket" size={24} color="#D97706" />
            <Text style={[styles.statNumber, { color: '#D97706' }]}>{stats.pending_bets}</Text>
            <Text style={styles.statLabel}>Apuestas Pendientes</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#DBEAFE' }]}>
            <Ionicons name="cash" size={24} color="#2563EB" />
            <Text style={[styles.statNumber, { color: '#2563EB' }]}>{stats.total_amount}</Text>
            <Text style={styles.statLabel}>Créditos Apostados</Text>
          </View>
        </View>

        {/* Enter Winning Numbers */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🎯 Ingresar Números Ganadores</Text>
          <Text style={styles.sectionSubtitle}>Ingresa los resultados del sorteo</Text>
          
          <View style={styles.numbersInputContainer}>
            {/* Fijo */}
            <View style={styles.numberInputWrapper}>
              <Text style={styles.numberLabel}>FIJO</Text>
              <TextInput
                style={[styles.numberInput, styles.fijoInput]}
                value={fijo}
                onChangeText={setFijo}
                keyboardType="number-pad"
                maxLength={3}
                placeholder="00"
                placeholderTextColor="#ccc"
              />
              <Text style={styles.numberHint}>1-100</Text>
            </View>
            
            {/* Corrido 1 */}
            <View style={styles.numberInputWrapper}>
              <Text style={styles.numberLabel}>CORRIDO 1</Text>
              <TextInput
                style={[styles.numberInput, styles.corridoInput]}
                value={corrido1}
                onChangeText={setCorrido1}
                keyboardType="number-pad"
                maxLength={3}
                placeholder="00"
                placeholderTextColor="#ccc"
              />
              <Text style={styles.numberHint}>1-100</Text>
            </View>
            
            {/* Corrido 2 */}
            <View style={styles.numberInputWrapper}>
              <Text style={styles.numberLabel}>CORRIDO 2</Text>
              <TextInput
                style={[styles.numberInput, styles.corridoInput]}
                value={corrido2}
                onChangeText={setCorrido2}
                keyboardType="number-pad"
                maxLength={3}
                placeholder="00"
                placeholderTextColor="#ccc"
              />
              <Text style={styles.numberHint}>1-100</Text>
            </View>
          </View>
          
          <TouchableOpacity
            style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
            onPress={handleSubmitDraw}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="trophy" size={22} color="#fff" />
                <Text style={styles.submitButtonText}>Procesar Sorteo</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Draw History */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📋 Historial de Sorteos</Text>
          
          {drawHistory.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="time-outline" size={48} color="#d1d5db" />
              <Text style={styles.emptyText}>No hay sorteos registrados</Text>
            </View>
          ) : (
            <View style={styles.historyList}>
              {drawHistory.map((draw, index) => (
                <View key={index} style={styles.historyItem}>
                  <View style={styles.historyDate}>
                    <Ionicons name="calendar-outline" size={16} color="#6b7280" />
                    <Text style={styles.historyDateText}>{formatDate(draw.date)}</Text>
                  </View>
                  <View style={styles.historyNumbers}>
                    <View style={[styles.numberBadge, styles.fijoBadge]}>
                      <Text style={styles.numberBadgeLabel}>FIJO</Text>
                      <Text style={styles.numberBadgeValue}>{draw.fijo}</Text>
                    </View>
                    <View style={[styles.numberBadge, styles.corridoBadge]}>
                      <Text style={styles.numberBadgeLabel}>C1</Text>
                      <Text style={styles.numberBadgeValue}>{draw.corridos[0]}</Text>
                    </View>
                    <View style={[styles.numberBadge, styles.corridoBadge]}>
                      <Text style={styles.numberBadgeLabel}>C2</Text>
                      <Text style={styles.numberBadgeValue}>{draw.corridos[1]}</Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Pending Bets Preview */}
        {pendingBets.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🎰 Apuestas Pendientes</Text>
            <View style={styles.pendingBetsList}>
              {pendingBets.slice(0, 5).map((bet, index) => (
                <View key={index} style={styles.pendingBetItem}>
                  <View style={[styles.betTypeBadge, { backgroundColor: getTypeColor(bet.type) + '20' }]}>
                    <Text style={[styles.betTypeText, { color: getTypeColor(bet.type) }]}>
                      {getTypeLabel(bet.type)}
                    </Text>
                  </View>
                  <Text style={styles.betNumbers}>{bet.numbers.join(', ')}</Text>
                  <Text style={styles.betAmount}>{bet.amount} cr</Text>
                </View>
              ))}
              {pendingBets.length > 5 && (
                <Text style={styles.moreText}>+{pendingBets.length - 5} más...</Text>
              )}
            </View>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Confirmation Modal */}
      <Modal
        visible={showConfirmModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowConfirmModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>⚠️ Confirmar Sorteo</Text>
            <Text style={styles.modalText}>
              ¿Estás seguro de procesar el sorteo con estos números?
            </Text>
            
            <View style={styles.modalNumbers}>
              <View style={[styles.modalNumberBadge, { backgroundColor: '#FEE2E2' }]}>
                <Text style={styles.modalNumberLabel}>FIJO</Text>
                <Text style={[styles.modalNumberValue, { color: '#DC2626' }]}>{fijo}</Text>
              </View>
              <View style={[styles.modalNumberBadge, { backgroundColor: '#DBEAFE' }]}>
                <Text style={styles.modalNumberLabel}>CORRIDO</Text>
                <Text style={[styles.modalNumberValue, { color: '#2563EB' }]}>{corrido1}</Text>
              </View>
              <View style={[styles.modalNumberBadge, { backgroundColor: '#DBEAFE' }]}>
                <Text style={styles.modalNumberLabel}>CORRIDO</Text>
                <Text style={[styles.modalNumberValue, { color: '#2563EB' }]}>{corrido2}</Text>
              </View>
            </View>
            
            <Text style={styles.modalWarning}>
              Esta acción procesará todas las apuestas pendientes y no se puede deshacer.
            </Text>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={() => setShowConfirmModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalConfirmButton]}
                onPress={confirmDraw}
              >
                <Text style={styles.modalConfirmText}>Confirmar</Text>
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
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#6C1110',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  refreshBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6b7280',
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
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 28,
    fontWeight: '700',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  section: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 16,
  },
  numbersInputContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 20,
  },
  numberInputWrapper: {
    flex: 1,
    alignItems: 'center',
  },
  numberLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 8,
  },
  numberInput: {
    width: '100%',
    height: 60,
    borderRadius: 12,
    borderWidth: 2,
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
  },
  fijoInput: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
    color: '#DC2626',
  },
  corridoInput: {
    borderColor: '#3B82F6',
    backgroundColor: '#EFF6FF',
    color: '#2563EB',
  },
  numberHint: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 4,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6C1110',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 14,
    color: '#9ca3af',
  },
  historyList: {
    gap: 12,
  },
  historyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  historyDate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  historyDateText: {
    fontSize: 13,
    color: '#6b7280',
  },
  historyNumbers: {
    flexDirection: 'row',
    gap: 8,
  },
  numberBadge: {
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  fijoBadge: {
    backgroundColor: '#FEE2E2',
  },
  corridoBadge: {
    backgroundColor: '#DBEAFE',
  },
  numberBadgeLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: '#6b7280',
  },
  numberBadgeValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1f2937',
  },
  pendingBetsList: {
    gap: 8,
    marginTop: 8,
  },
  pendingBetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  betTypeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 12,
  },
  betTypeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  betNumbers: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  betAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  moreText: {
    textAlign: 'center',
    color: '#6b7280',
    fontSize: 13,
    marginTop: 8,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 340,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 12,
  },
  modalText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 20,
  },
  modalNumbers: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 16,
  },
  modalNumberBadge: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  modalNumberLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#6b7280',
  },
  modalNumberValue: {
    fontSize: 24,
    fontWeight: '700',
  },
  modalWarning: {
    fontSize: 12,
    color: '#DC2626',
    textAlign: 'center',
    marginBottom: 20,
    fontStyle: 'italic',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalCancelButton: {
    backgroundColor: '#f3f4f6',
  },
  modalConfirmButton: {
    backgroundColor: '#6C1110',
  },
  modalCancelText: {
    color: '#6b7280',
    fontWeight: '600',
  },
  modalConfirmText: {
    color: '#fff',
    fontWeight: '600',
  },
});
