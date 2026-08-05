import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors } from '../constants/colors';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { useTranslation } from 'react-i18next';

interface Lottery {
  id: string;
  title: string;
  description: string;
  ticket_price: number;
  prize_value: string;
  max_tickets_per_user: number;
}

interface Ticket {
  id: string;
  ticket_number: string;
  revealed: boolean;
  is_winner: boolean;
  prize_won?: string;
  prize_credits?: number;
}

export default function ScratchCardScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const params = useLocalSearchParams();
  const { user } = useAuth();
  const [lottery, setLottery] = useState<Lottery | null>(null);
  const [myTickets, setMyTickets] = useState<Ticket[]>([]);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [revealing, setRevealing] = useState<string | null>(null);

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

  const handleBuyTicket = async () => {
    if (!lottery) return;

    if (balance < lottery.ticket_price) {
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
        selected_numbers: null,
        quantity: 1,
      });

      if (response.data.success) {
        await loadData();
        if (Platform.OS === 'web') {
          Alert.alert('Aviso', '¡Raspadito comprado! Presiona para revelar tu premio');
        } else {
          Alert.alert('¡Éxito!', '¡Raspadito comprado! Presiona para revelar tu premio');
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

  const handleRevealTicket = async (ticketId: string) => {
    try {
      setRevealing(ticketId);
      const response = await api.post(`/lotteries/scratch-cards/${ticketId}/reveal`);

      if (response.data.success) {
        await loadData();
        
        if (response.data.is_winner && !response.data.already_revealed) {
          if (Platform.OS === 'web') {
            Alert.alert('Aviso', `🎉 ¡GANASTE!\n\n${response.data.prize_won}\n+${response.data.prize_credits} créditos`);
          } else {
            Alert.alert(
              '🎉 ¡GANASTE!',
              `${response.data.prize_won}\n+${response.data.prize_credits} créditos`,
              [{ text: '¡Genial!', style: 'default' }]
            );
          }
        } else if (!response.data.is_winner && !response.data.already_revealed) {
          if (Platform.OS === 'web') {
            Alert.alert('Aviso', 'Esta vez no tuviste suerte. ¡Intenta de nuevo!');
          } else {
            Alert.alert('Sin premio', 'Esta vez no tuviste suerte. ¡Intenta de nuevo!');
          }
        }
      }
    } catch (error: any) {
      console.error('Error revealing ticket:', error);
      const message = error.response?.data?.detail || 'No se pudo revelar el boleto';
      if (Platform.OS === 'web') {
        Alert.alert('Aviso', `Error: ${message}`);
      } else {
        Alert.alert('Error', message);
      }
    } finally {
      setRevealing(null);
    }
  };

  const renderTicketCard = (ticket: Ticket) => {
    const isRevealing = revealing === ticket.id;
    
    return (
      <TouchableOpacity
        key={ticket.id}
        style={[
          styles.ticketCard,
          ticket.revealed && styles.ticketCardRevealed,
          ticket.is_winner && ticket.revealed && styles.ticketCardWinner,
        ]}
        onPress={() => !ticket.revealed && handleRevealTicket(ticket.id)}
        disabled={ticket.revealed || isRevealing}
        activeOpacity={0.7}
      >
        {!ticket.revealed ? (
          <LinearGradient
            colors={['#FFD700', '#FFA500']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.unrevealedCard}
          >
            <Ionicons name="gift" size={48} color="#FFF" />
            <Text style={styles.scratchText}>
              {isRevealing ? 'Revelando...' : '¡Presiona para\nrevelar!'}
            </Text>
            <View style={styles.ticketNumberBadge}>
              <Text style={styles.ticketNumberText}>#{ticket.ticket_number}</Text>
            </View>
          </LinearGradient>
        ) : (
          <View style={styles.revealedCard}>
            {ticket.is_winner ? (
              <>
                <Ionicons name="trophy" size={64} color="#FFD700" />
                <Text style={styles.winnerText}>🎉 ¡GANASTE!</Text>
                <Text style={styles.prizeText}>{ticket.prize_won}</Text>
                <Text style={styles.creditsText}>+{ticket.prize_credits} créditos</Text>
              </>
            ) : (
              <>
                <Ionicons name="close-circle" size={64} color={Colors.textGray} />
                <Text style={styles.noWinText}>Sin premio</Text>
                <Text style={styles.tryAgainText}>¡Intenta de nuevo!</Text>
              </>
            )}
            <View style={styles.ticketNumberBadge}>
              <Text style={styles.ticketNumberText}>#{ticket.ticket_number}</Text>
            </View>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Cargando raspaditos...</Text>
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

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backIconButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.headerTextContainer}>
          <Text style={styles.headerTitle}>🎫 {lottery.title}</Text>
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
            <Ionicons name="pricetag" size={20} color={Colors.primary} />
            <Text style={styles.infoLabel}>Precio:</Text>
            <Text style={styles.infoValue}>{lottery.ticket_price} créditos</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="trophy" size={20} color="#FFD700" />
            <Text style={styles.infoLabel}>Premio:</Text>
            <Text style={styles.infoValue}>{lottery.prize_value}</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="ticket" size={20} color={Colors.accent} />
            <Text style={styles.infoLabel}>Mis boletos:</Text>
            <Text style={styles.infoValue}>{myTickets.length}/{lottery.max_tickets_per_user}</Text>
          </View>
        </View>

        {/* Buy Button */}
        <TouchableOpacity
          style={styles.buyButton}
          onPress={handleBuyTicket}
          disabled={purchasing || myTickets.length >= lottery.max_tickets_per_user}
        >
          <LinearGradient
            colors={['#FFD700', '#FFA500']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.buyButtonGradient}
          >
            {purchasing ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <>
                <Ionicons name="cart" size={24} color="#FFF" />
                <Text style={styles.buyButtonText}>
                  {myTickets.length >= lottery.max_tickets_per_user
                    ? 'Límite alcanzado'
                    : `Comprar Raspadito (${lottery.ticket_price} créditos)`}
                </Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>

        {/* My Tickets */}
        {myTickets.length > 0 && (
          <View style={styles.ticketsSection}>
            <Text style={styles.sectionTitle}>Mis Raspaditos</Text>
            <Text style={styles.sectionSubtitle}>
              {myTickets.filter(t => !t.revealed).length} sin revelar
            </Text>
            <View style={styles.ticketsGrid}>
              {myTickets.map(renderTicketCard)}
            </View>
          </View>
        )}

        {myTickets.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="ticket-outline" size={64} color={Colors.textGray} />
            <Text style={styles.emptyStateText}>No tienes raspaditos</Text>
            <Text style={styles.emptyStateSubtext}>Compra uno para empezar a jugar</Text>
          </View>
        )}
      </ScrollView>
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
  buyButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 24,
  },
  buyButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 12,
  },
  buyButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  ticketsSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: Colors.textGray,
    marginBottom: 16,
  },
  ticketsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  ticketCard: {
    width: '48%',
    aspectRatio: 1,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: Colors.background,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  ticketCardRevealed: {
    shadowOpacity: 0.1,
  },
  ticketCardWinner: {
    borderWidth: 3,
    borderColor: '#FFD700',
  },
  unrevealedCard: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  scratchText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
    textAlign: 'center',
    marginTop: 12,
  },
  revealedCard: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    backgroundColor: Colors.background,
  },
  winnerText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFD700',
    marginTop: 12,
  },
  prizeText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginTop: 8,
    textAlign: 'center',
  },
  creditsText: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.success,
    marginTop: 4,
  },
  noWinText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textGray,
    marginTop: 12,
  },
  tryAgainText: {
    fontSize: 13,
    color: Colors.textGray,
    marginTop: 4,
  },
  ticketNumberBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  ticketNumberText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFF',
  },
  emptyState: {
    alignItems: 'center',
    padding: 48,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: Colors.textGray,
    marginTop: 8,
  },
});