import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors } from '../constants/colors';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { useGamblingEnabled } from '../hooks/useGamblingEnabled';

interface Lottery {
  id: string;
  title: string;
  description: string;
  ticket_price: number;
  prize_value: string;
  prize_credits?: number;
  max_tickets_per_user: number;
  draw_date?: string;
  bolita_number_range: number;
  status: string;
  winning_numbers?: number[];
}

interface Ticket {
  id: string;
  ticket_number: string;
  selected_numbers: number[];
  is_winner: boolean;
  prize_won?: string;
}

export default function BolitaScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const params = useLocalSearchParams();
  const { user } = useAuth();
  const { loading: flagsLoading, enabled: gamblingEnabled } = useGamblingEnabled();
  const [lottery, setLottery] = useState<Lottery | null>(null);
  const [myTickets, setMyTickets] = useState<Ticket[]>([]);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [selectedNumber, setSelectedNumber] = useState<number | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  if (flagsLoading) {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </SafeAreaView>
    );
  }

  if (!gamblingEnabled) {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 }}>
        <Ionicons name="game-controller-outline" size={64} color="#999" />
        <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#333', marginTop: 16, textAlign: 'center' }}>
          {t('games.unavailable', 'No disponible')}
        </Text>
        <Text style={{ fontSize: 14, color: '#666', marginTop: 8, textAlign: 'center' }}>
          {t('games.unavailableDesc', 'Esta sección no está habilitada en este momento.')}
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ marginTop: 24, backgroundColor: Colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 }}
        >
          <Text style={{ color: '#fff', fontWeight: '600' }}>{t('common.goBack', 'Volver')}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadLottery(),
        loadMyTickets(),
        loadBalance(),
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadLottery = async () => {
    try {
      const response = await api.get(`/lotteries/${params.id}`);
      setLottery(response.data);
    } catch (error) {
      console.error('Error loading lottery:', error);
    }
  };

  const loadMyTickets = async () => {
    try {
      const response = await api.get('/lotteries/my-tickets', {
        params: { lottery_id: params.id }
      });
      setMyTickets(response.data.tickets || []);
    } catch (error) {
      console.error('Error loading tickets:', error);
    }
  };

  const loadBalance = async () => {
    try {
      const response = await api.get('/credits/balance');
      setBalance(response.data.balance || 0);
    } catch (error) {
      console.error('Error loading balance:', error);
    }
  };

  const handleNumberSelect = (number: number) => {
    setSelectedNumber(number);
    setShowConfirmModal(true);
  };

  const handleConfirmPurchase = async () => {
    if (!lottery || selectedNumber === null) return;

    if (balance < lottery.ticket_price) {
      setShowConfirmModal(false);
      if (Platform.OS === 'web') {
        Alert.alert('Aviso', `Saldo insuficiente. Necesitas ${lottery.ticket_price} créditos`);
      } else {
        Alert.alert('Saldo Insuficiente', `Necesitas ${lottery.ticket_price} créditos`);
      }
      return;
    }

    try {
      setPurchasing(true);
      const response = await api.post(`/lotteries/${lottery.id}/buy`, {
        lottery_id: lottery.id,
        selected_numbers: [selectedNumber],
        quantity: 1,
      });

      if (response.data.success) {
        setShowConfirmModal(false);
        setSelectedNumber(null);
        await loadData();
        
        if (Platform.OS === 'web') {
          Alert.alert('Aviso', `¡Boleto comprado! Número: ${selectedNumber}\n¡Buena suerte!`);
        } else {
          Alert.alert('¡Éxito!', `¡Boleto comprado! Número: ${selectedNumber}\n¡Buena suerte!`);
        }
      }
    } catch (error: any) {
      console.error('Error buying ticket:', error);
      const message = error.response?.data?.detail || 'No se pudo comprar el boleto';
      if (Platform.OS === 'web') {
        Alert.alert('Aviso', `Error: ${message}`);
      } else {
        Alert.alert('Error', message);
      }
    } finally {
      setPurchasing(false);
    }
  };

  const renderNumberButton = (number: number) => {
    const hasTicket = myTickets.some(t => t.selected_numbers[0] === number);
    const isWinner = myTickets.some(t => t.selected_numbers[0] === number && t.is_winner);
    
    return (
      <TouchableOpacity
        key={number}
        style={[
          styles.numberButton,
          hasTicket && styles.numberButtonOwned,
          isWinner && styles.numberButtonWinner,
        ]}
        onPress={() => handleNumberSelect(number)}
        activeOpacity={0.7}
      >
        <Text style={[
          styles.numberText,
          hasTicket && styles.numberTextOwned,
          isWinner && styles.numberTextWinner,
        ]}>
          {number.toString().padStart(2, '0')}
        </Text>
        {hasTicket && (
          <View style={styles.ownedBadge}>
            <Ionicons name="checkmark" size={12} color="#FFF" />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderTicketCard = (ticket: Ticket) => (
    <View key={ticket.id} style={[
      styles.ticketCard,
      ticket.is_winner && styles.ticketCardWinner,
    ]}>
      <View style={styles.ticketHeader}>
        <View style={styles.ticketNumberCircle}>
          <Text style={styles.ticketNumberText}>
            {ticket.selected_numbers[0].toString().padStart(2, '0')}
          </Text>
        </View>
        <View style={styles.ticketInfo}>
          <Text style={styles.ticketLabel}>Boleto: #{ticket.ticket_number}</Text>
          {ticket.is_winner ? (
            <>
              <Text style={styles.winnerLabel}>🎉 ¡GANADOR!</Text>
              <Text style={styles.prizeLabel}>{ticket.prize_won}</Text>
            </>
          ) : lottery?.status === 'completed' ? (
            <Text style={styles.lostLabel}>No ganó esta vez</Text>
          ) : (
            <Text style={styles.pendingLabel}>Esperando sorteo...</Text>
          )}
        </View>
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Cargando La Bolita...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!lottery) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={64} color={Colors.error} />
          <Text style={styles.errorText}>Juego no encontrado</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Volver</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const maxNumber = lottery.bolita_number_range || 100;
  const numbers = Array.from({ length: maxNumber }, (_, i) => i);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backIconButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.headerTextContainer}>
          <Text style={styles.headerTitle}>🇨🇺 {lottery.title}</Text>
          <Text style={styles.headerSubtitle}>{lottery.description}</Text>
        </View>
        <View style={styles.balanceCard}>
          <Ionicons name="wallet" size={16} color={Colors.primary} />
          <Text style={styles.balanceText}>{balance}</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Game Info */}
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Ionicons name="pricetag" size={20} color="#FF6B6B" />
            <Text style={styles.infoLabel}>Precio:</Text>
            <Text style={styles.infoValue}>{lottery.ticket_price} créditos</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="trophy" size={20} color="#FFD700" />
            <Text style={styles.infoLabel}>Premio:</Text>
            <Text style={styles.infoValue}>{lottery.prize_value}</Text>
          </View>
          {lottery.draw_date && (
            <View style={styles.infoRow}>
              <Ionicons name="calendar" size={20} color={Colors.accent} />
              <Text style={styles.infoLabel}>Sorteo:</Text>
              <Text style={styles.infoValue}>
                {new Date(lottery.draw_date).toLocaleDateString('es-ES')}
              </Text>
            </View>
          )}
          <View style={styles.infoRow}>
            <Ionicons name="ticket" size={20} color={Colors.accent} />
            <Text style={styles.infoLabel}>Mis boletos:</Text>
            <Text style={styles.infoValue}>{myTickets.length}/{lottery.max_tickets_per_user}</Text>
          </View>
        </View>

        {/* Winning Number (if drawn) */}
        {lottery.status === 'completed' && lottery.winning_numbers && lottery.winning_numbers.length > 0 && (
          <View style={styles.winningNumberCard}>
            <Text style={styles.winningNumberLabel}>🏆 Número Ganador</Text>
            <View style={styles.winningNumberCircle}>
              <Text style={styles.winningNumberText}>
                {lottery.winning_numbers[0].toString().padStart(2, '0')}
              </Text>
            </View>
          </View>
        )}

        {/* Instructions */}
        <View style={styles.instructionsCard}>
          <Ionicons name="information-circle" size={24} color={Colors.accent} />
          <View style={styles.instructionsText}>
            <Text style={styles.instructionsTitle}>Cómo jugar:</Text>
            <Text style={styles.instructionsDescription}>
              Selecciona tu número de la suerte del 0 al {maxNumber - 1}. 
              {myTickets.length > 0 && ' Los números en verde son tuyos.'}
            </Text>
          </View>
        </View>

        {/* Number Grid */}
        <View style={styles.numbersSection}>
          <Text style={styles.sectionTitle}>Selecciona tu número</Text>
          <View style={styles.numbersGrid}>
            {numbers.map(renderNumberButton)}
          </View>
        </View>

        {/* My Tickets */}
        {myTickets.length > 0 && (
          <View style={styles.ticketsSection}>
            <Text style={styles.sectionTitle}>Mis Boletos ({myTickets.length})</Text>
            <View style={styles.ticketsList}>
              {myTickets.map(renderTicketCard)}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Confirm Purchase Modal */}
      <Modal
        visible={showConfirmModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowConfirmModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Confirmar Compra</Text>
              <TouchableOpacity onPress={() => setShowConfirmModal(false)}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <View style={styles.selectedNumberDisplay}>
                <Text style={styles.selectedNumberLabel}>Número seleccionado:</Text>
                <View style={styles.selectedNumberCircle}>
                  <Text style={styles.selectedNumberText}>
                    {selectedNumber !== null ? selectedNumber.toString().padStart(2, '0') : '--'}
                  </Text>
                </View>
              </View>

              <View style={styles.purchaseSummary}>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Precio:</Text>
                  <Text style={styles.summaryValue}>{lottery.ticket_price} créditos</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Tu saldo:</Text>
                  <Text style={[
                    styles.summaryValue,
                    balance < lottery.ticket_price && styles.insufficientBalance
                  ]}>
                    {balance} créditos
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowConfirmModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmButton}
                onPress={handleConfirmPurchase}
                disabled={purchasing}
              >
                <LinearGradient
                  colors={['#FF6B6B', '#FF8E8E']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.confirmButtonGradient}
                >
                  {purchasing ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle" size={20} color="#FFF" />
                      <Text style={styles.confirmButtonText}>Comprar</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundGray,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 16,
    color: Colors.textGray,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 16,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
  },
  backButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 16,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.backgroundGray,
    gap: 12,
  },
  backIconButton: {
    padding: 8,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  headerSubtitle: {
    fontSize: 13,
    color: Colors.textGray,
    marginTop: 2,
  },
  balanceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundGray,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    gap: 6,
  },
  balanceText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  infoCard: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    gap: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoLabel: {
    fontSize: 14,
    color: Colors.textGray,
    flex: 1,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  winningNumberCard: {
    backgroundColor: '#FFD70020',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  winningNumberLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#B8860B',
    marginBottom: 12,
  },
  winningNumberCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFD700',
    justifyContent: 'center',
    alignItems: 'center',
  },
  winningNumberText: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFF',
  },
  instructionsCard: {
    flexDirection: 'row',
    backgroundColor: Colors.accent + '15',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    gap: 12,
  },
  instructionsText: {
    flex: 1,
  },
  instructionsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 4,
  },
  instructionsDescription: {
    fontSize: 13,
    color: Colors.textGray,
    lineHeight: 18,
  },
  numbersSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 12,
  },
  numbersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  numberButton: {
    width: '18%',
    aspectRatio: 1,
    backgroundColor: Colors.background,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.backgroundGray,
  },
  numberButtonOwned: {
    backgroundColor: '#4ECDC4',
    borderColor: '#4ECDC4',
  },
  numberButtonWinner: {
    backgroundColor: '#FFD700',
    borderColor: '#FFD700',
  },
  numberText: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  numberTextOwned: {
    color: '#FFF',
  },
  numberTextWinner: {
    color: '#FFF',
  },
  ownedBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ticketsSection: {
    marginBottom: 24,
  },
  ticketsList: {
    gap: 12,
  },
  ticketCard: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#4ECDC4',
  },
  ticketCardWinner: {
    borderLeftColor: '#FFD700',
    backgroundColor: '#FFD70010',
  },
  ticketHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  ticketNumberCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FF6B6B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ticketNumberText: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFF',
  },
  ticketInfo: {
    flex: 1,
  },
  ticketLabel: {
    fontSize: 12,
    color: Colors.textGray,
    marginBottom: 4,
  },
  winnerLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFD700',
  },
  prizeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginTop: 2,
  },
  lostLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textGray,
  },
  pendingLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.accent,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: Colors.background,
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.backgroundGray,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
  },
  modalBody: {
    padding: 20,
  },
  selectedNumberDisplay: {
    alignItems: 'center',
    marginBottom: 24,
  },
  selectedNumberLabel: {
    fontSize: 14,
    color: Colors.textGray,
    marginBottom: 12,
  },
  selectedNumberCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#FF6B6B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedNumberText: {
    fontSize: 40,
    fontWeight: '800',
    color: '#FFF',
  },
  purchaseSummary: {
    backgroundColor: Colors.backgroundGray,
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 14,
    color: Colors.textGray,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  insufficientBalance: {
    color: Colors.error,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: Colors.backgroundGray,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: Colors.backgroundGray,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  confirmButton: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  confirmButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
});
