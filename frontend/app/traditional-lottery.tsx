import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useThemeColors } from '../constants/colors';
import api from '../services/api';
import { useGamblingEnabled } from '../hooks/useGamblingEnabled';

interface LotteryTicket {
  id: string;
  lottery_id: string;
  numbers: number[];
  bet_type: 'straight' | 'box' | 'combo';
  cost: number;
  purchased_at: string;
}

export default function TraditionalLotteryDetail() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const colors = useThemeColors();
  const { t } = useTranslation();
  const styles = createStyles(colors);
  const { loading: flagsLoading, enabled: gamblingEnabled } = useGamblingEnabled();

  const [lottery, setLottery] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedNumbers, setSelectedNumbers] = useState<number[]>([]);
  const [betType, setBetType] = useState<'straight' | 'box' | 'combo'>('straight');
  const [numberOfDraws, setNumberOfDraws] = useState(1);
  const [purchasing, setPurchasing] = useState(false);
  const [myTickets, setMyTickets] = useState<LotteryTicket[]>([]);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [quickPickCount, setQuickPickCount] = useState(5);

  if (flagsLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!gamblingEnabled) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, backgroundColor: colors.background }}>
        <Ionicons name="game-controller-outline" size={64} color={colors.textSecondary} />
        <Text style={{ fontSize: 20, fontWeight: 'bold', color: colors.text, marginTop: 16, textAlign: 'center' }}>
          {t('games.unavailable', 'No disponible')}
        </Text>
        <Text style={{ fontSize: 14, color: colors.textSecondary, marginTop: 8, textAlign: 'center' }}>
          {t('games.unavailableDesc', 'Esta sección no está habilitada en este momento.')}
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ marginTop: 24, backgroundColor: colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 }}
        >
          <Text style={{ color: '#fff', fontWeight: '600' }}>{t('common.goBack', 'Volver')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Rango de números según la lotería (por defecto 1-49)
  const minNumber = lottery?.min_number || 1;
  const maxNumber = lottery?.max_number || 49;
  const numbersToSelect = lottery?.numbers_per_ticket || 6;

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      if (!id) {
        Alert.alert('Error', 'No se encontró la lotería');
        router.back();
        return;
      }

      const [lotteryRes, ticketsRes] = await Promise.all([
        api.get(`/lotteries/${id}`),
        api.get(`/lotteries/my-tickets?lottery_id=${id}`).catch(() => ({ data: { tickets: [] } }))
      ]);
      
      setLottery(lotteryRes.data);
      setMyTickets(ticketsRes.data.tickets || []);
    } catch (error: any) {
      console.error('Error loading data:', error);
      Alert.alert('Error', error.response?.data?.detail || 'No se pudo cargar el juego');
    } finally {
      setLoading(false);
    }
  };

  const toggleNumber = (num: number) => {
    if (selectedNumbers.includes(num)) {
      setSelectedNumbers(selectedNumbers.filter(n => n !== num));
    } else {
      if (selectedNumbers.length < numbersToSelect) {
        setSelectedNumbers([...selectedNumbers, num].sort((a, b) => a - b));
      } else {
        if (Platform.OS === 'web') {
          Alert.alert('Aviso', `Solo puedes seleccionar ${numbersToSelect} números`);
        } else {
          Alert.alert('Límite alcanzado', `Solo puedes seleccionar ${numbersToSelect} números`);
        }
      }
    }
  };

  const quickPick = () => {
    const numbers: number[] = [];
    while (numbers.length < numbersToSelect) {
      const random = Math.floor(Math.random() * (maxNumber - minNumber + 1)) + minNumber;
      if (!numbers.includes(random)) {
        numbers.push(random);
      }
    }
    setSelectedNumbers(numbers.sort((a, b) => a - b));
  };

  const clearSelection = () => {
    setSelectedNumbers([]);
  };

  const calculateCost = () => {
    if (selectedNumbers.length !== numbersToSelect) return 0;
    
    let baseCost = lottery?.ticket_price || 5;
    
    // Multiplicadores por tipo de apuesta
    switch (betType) {
      case 'straight': // Apuesta directa (1x)
        return baseCost * numberOfDraws;
      case 'box': // Cualquier orden (3x)
        return baseCost * 3 * numberOfDraws;
      case 'combo': // Todas las combinaciones (6x)
        return baseCost * 6 * numberOfDraws;
      default:
        return baseCost * numberOfDraws;
    }
  };

  const handlePurchase = async () => {
    if (selectedNumbers.length !== numbersToSelect) {
      if (Platform.OS === 'web') {
        Alert.alert('Aviso', `Debes seleccionar ${numbersToSelect} números`);
      } else {
        Alert.alert('Selección incompleta', `Debes seleccionar ${numbersToSelect} números`);
      }
      return;
    }

    const cost = calculateCost();
    
    const confirmMessage = `¿Confirmar compra?

Números: ${selectedNumbers.join(', ')}
Tipo: ${getBetTypeName()}
Sorteos: ${numberOfDraws}
Costo: ${cost} créditos`;

    const confirmed = Platform.OS === 'web' 
      ? window.confirm(confirmMessage)
      : await new Promise((resolve) => {
          Alert.alert(
            'Confirmar compra',
            confirmMessage,
            [
              { text: 'Cancelar', onPress: () => resolve(false), style: 'cancel' },
              { text: 'Confirmar', onPress: () => resolve(true) }
            ]
          );
        });

    if (!confirmed) return;

    try {
      setPurchasing(true);
      
      const response = await api.post(`/lotteries/${id}/buy`, {
        lottery_id: id,
        numbers: selectedNumbers,
        bet_type: betType,
        number_of_draws: numberOfDraws,
        cost: cost
      });

      if (Platform.OS === 'web') {
        Alert.alert('Aviso', '¡Boleto comprado con éxito! 🎉');
      } else {
        Alert.alert('¡Éxito!', '¡Boleto comprado con éxito! 🎉');
      }
      
      // Recargar datos y limpiar selección
      await loadData();
      clearSelection();
      setNumberOfDraws(1);
      
    } catch (error: any) {
      console.error('Error purchasing ticket:', error);
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

  const getBetTypeName = () => {
    switch (betType) {
      case 'straight': return 'Orden Exacto';
      case 'box': return 'Cualquier Orden';
      case 'combo': return 'Combinación';
      default: return betType;
    }
  };

  const getBetTypeDescription = () => {
    switch (betType) {
      case 'straight': 
        return 'Los números deben salir en el orden exacto que seleccionaste';
      case 'box': 
        return 'Los números pueden salir en cualquier orden';
      case 'combo': 
        return 'Todas las combinaciones posibles de tus números';
      default: 
        return '';
    }
  };

  const renderNumberGrid = () => {
    const numbers = [];
    for (let i = minNumber; i <= maxNumber; i++) {
      numbers.push(i);
    }

    return (
      <View style={styles.numberGrid}>
        {numbers.map((num) => {
          const isSelected = selectedNumbers.includes(num);
          return (
            <TouchableOpacity
              key={num}
              style={[
                styles.numberButton,
                isSelected && styles.numberButtonSelected
              ]}
              onPress={() => toggleNumber(num)}
            >
              <Text style={[
                styles.numberText,
                isSelected && styles.numberTextSelected
              ]}>
                {num}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  const renderMyTickets = () => {
    if (myTickets.length === 0) return null;

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🎫 Mis Boletos ({myTickets.length})</Text>
        {myTickets.map((ticket) => (
          <View key={ticket.id} style={styles.ticketCard}>
            <View style={styles.ticketHeader}>
              <View style={styles.ticketNumbers}>
                {ticket.numbers.map((num, idx) => (
                  <View key={idx} style={styles.ticketNumberBubble}>
                    <Text style={styles.ticketNumberText}>{num}</Text>
                  </View>
                ))}
              </View>
              <View style={styles.ticketInfo}>
                <Text style={styles.ticketType}>{ticket.bet_type}</Text>
                <Text style={styles.ticketCost}>{ticket.cost} créditos</Text>
              </View>
            </View>
            <Text style={styles.ticketDate}>
              {new Date(ticket.purchased_at).toLocaleDateString('es-MX', {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </Text>
          </View>
        ))}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Cargando juego...</Text>
      </View>
    );
  }

  if (!lottery) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>No se encontró la lotería</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Modern Header */}
      <View style={styles.modernHeader}>
        <TouchableOpacity onPress={() => router.back()} style={styles.modernBackButton}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.modernHeaderTitle}>{lottery.title}</Text>
          <Text style={styles.headerSubtitle}>{lottery.description}</Text>
          <TouchableOpacity
            style={styles.rulesButton}
            onPress={() => setShowRulesModal(true)}
          >
            <Ionicons name="information-circle" size={20} color="#FFF" />
            <Text style={styles.rulesButtonText}>Cómo Jugar</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Info Card */}
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Ionicons name="calendar" size={20} color={colors.primary} />
            <Text style={styles.infoText}>
              Próximo sorteo: {new Date(lottery.draw_date).toLocaleDateString('es-MX')}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="trophy" size={20} color="#FFD700" />
            <Text style={styles.infoText}>Premio: {lottery.prize_value}</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="cash" size={20} color="#4ECDC4" />
            <Text style={styles.infoText}>Costo: {lottery.ticket_price} créditos/boleto</Text>
          </View>
        </View>

        {/* Bet Type Selector */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tipo de Apuesta</Text>
          <View style={styles.betTypeContainer}>
            {[
              { value: 'straight' as const, label: 'Orden Exacto', multiplier: '1x' },
              { value: 'box' as const, label: 'Cualquier Orden', multiplier: '3x' },
              { value: 'combo' as const, label: 'Combinación', multiplier: '6x' }
            ].map((type) => (
              <TouchableOpacity
                key={type.value}
                style={[
                  styles.betTypeButton,
                  betType === type.value && styles.betTypeButtonActive
                ]}
                onPress={() => setBetType(type.value)}
              >
                <Text style={[
                  styles.betTypeLabel,
                  betType === type.value && styles.betTypeLabelActive
                ]}>
                  {type.label}
                </Text>
                <Text style={[
                  styles.betTypeMultiplier,
                  betType === type.value && styles.betTypeMultiplierActive
                ]}>
                  {type.multiplier}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.betTypeDescription}>{getBetTypeDescription()}</Text>
        </View>

        {/* Number Selection */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              Selecciona {numbersToSelect} Números ({selectedNumbers.length}/{numbersToSelect})
            </Text>
            <View style={styles.actionButtons}>
              <TouchableOpacity style={styles.quickPickButton} onPress={quickPick}>
                <Ionicons name="shuffle" size={16} color="#FFF" />
                <Text style={styles.quickPickText}>Aleatorio</Text>
              </TouchableOpacity>
              {selectedNumbers.length > 0 && (
                <TouchableOpacity style={styles.clearButton} onPress={clearSelection}>
                  <Ionicons name="close-circle" size={16} color={colors.error} />
                  <Text style={styles.clearText}>Limpiar</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {selectedNumbers.length > 0 && (
            <View style={styles.selectedNumbersContainer}>
              <Text style={styles.selectedLabel}>Tus números:</Text>
              <View style={styles.selectedNumbers}>
                {selectedNumbers.map((num) => (
                  <View key={num} style={styles.selectedNumberBubble}>
                    <Text style={styles.selectedNumberText}>{num}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {renderNumberGrid()}
        </View>

        {/* Number of Draws */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Número de Sorteos</Text>
          <View style={styles.drawsContainer}>
            {[1, 2, 3, 5, 10].map((count) => (
              <TouchableOpacity
                key={count}
                style={[
                  styles.drawButton,
                  numberOfDraws === count && styles.drawButtonActive
                ]}
                onPress={() => setNumberOfDraws(count)}
              >
                <Text style={[
                  styles.drawButtonText,
                  numberOfDraws === count && styles.drawButtonTextActive
                ]}>{count}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* My Tickets */}
        {renderMyTickets()}

        {/* Purchase Button */}
        {selectedNumbers.length === numbersToSelect && (
          <View style={styles.purchaseSection}>
            <View style={styles.costSummary}>
              <Text style={styles.costLabel}>Costo Total:</Text>
              <Text style={styles.costValue}>{calculateCost()} créditos</Text>
            </View>
            <TouchableOpacity
              style={styles.purchaseButton}
              onPress={handlePurchase}
              disabled={purchasing}
            >
              <LinearGradient
                colors={['#6C1110', '#8B1110']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.purchaseGradient}
              >
                {purchasing ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={24} color="#FFF" />
                    <Text style={styles.purchaseButtonText}>Comprar Boleto</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Rules Modal */}
      <Modal
        visible={showRulesModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowRulesModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>📖 Cómo Jugar</Text>
              <TouchableOpacity onPress={() => setShowRulesModal(false)}>
                <Ionicons name="close" size={28} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll}>
              <Text style={styles.ruleTitle}>🎯 Objetivo</Text>
              <Text style={styles.ruleText}>
                Selecciona {numbersToSelect} números entre {minNumber} y {maxNumber}. Si tus números coinciden con los del sorteo, ¡ganas!
              </Text>

              <Text style={styles.ruleTitle}>🎲 Tipos de Apuesta</Text>
              <Text style={styles.ruleText}>
                <Text style={styles.bold}>Orden Exacto:</Text> Los números deben salir en el orden exacto (1x)
              </Text>
              <Text style={styles.ruleText}>
                <Text style={styles.bold}>Cualquier Orden:</Text> Los números pueden salir en cualquier orden (3x)
              </Text>
              <Text style={styles.ruleText}>
                <Text style={styles.bold}>Combinación:</Text> Todas las combinaciones posibles (6x)
              </Text>

              <Text style={styles.ruleTitle}>💰 Premios</Text>
              <Text style={styles.ruleText}>
                El premio depende del tipo de apuesta y el número de aciertos. ¡Cuantos más números aciertes, mayor será tu premio!
              </Text>

              <Text style={styles.ruleTitle}>🎟️ Múltiples Sorteos</Text>
              <Text style={styles.ruleText}>
                Puedes comprar boletos para múltiples sorteos consecutivos (1, 2, 3, 5 o 10 sorteos).
              </Text>
            </ScrollView>
            <TouchableOpacity
              style={styles.closeModalButton}
              onPress={() => setShowRulesModal(false)}
            >
              <Text style={styles.closeModalButtonText}>Entendido</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundGray,
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
  modernHeader: {
    backgroundColor: '#6C1110',
    paddingTop: 60,
    paddingBottom: 30,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  modernBackButton: {
    position: 'absolute',
    top: 60,
    left: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  headerContent: {
    alignItems: 'center',
    marginTop: 8,
  },
  modernHeaderTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 4,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.85)',
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 12,
  },
  rulesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    gap: 6,
  },
  rulesButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  infoCard: {
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoText: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '500',
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  quickPickButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    gap: 4,
  },
  quickPickText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundGray,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    gap: 4,
  },
  clearText: {
    color: colors.error,
    fontSize: 12,
    fontWeight: '600',
  },
  betTypeContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  betTypeButton: {
    flex: 1,
    backgroundColor: colors.backgroundGray,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  betTypeButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  betTypeLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  betTypeLabelActive: {
    color: '#FFF',
  },
  betTypeMultiplier: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
  },
  betTypeMultiplierActive: {
    color: '#FFF',
  },
  betTypeDescription: {
    fontSize: 12,
    color: colors.textGray,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  selectedNumbersContainer: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  selectedLabel: {
    fontSize: 12,
    color: colors.textGray,
    marginBottom: 8,
    fontWeight: '600',
  },
  selectedNumbers: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  selectedNumberBubble: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedNumberText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  numberGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  numberButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border,
  },
  numberButtonSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  numberText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  numberTextSelected: {
    color: '#FFF',
    fontWeight: '700',
  },
  drawsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  drawButton: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  drawButtonActive: {
    backgroundColor: colors.secondary,
    borderColor: colors.secondary,
  },
  drawButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  drawButtonTextActive: {
    color: '#FFF',
    fontWeight: '700',
  },
  ticketCard: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  ticketHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  ticketNumbers: {
    flexDirection: 'row',
    gap: 6,
  },
  ticketNumberBubble: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ticketNumberText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
  },
  ticketInfo: {
    alignItems: 'flex-end',
  },
  ticketType: {
    fontSize: 12,
    color: colors.textGray,
    fontWeight: '500',
  },
  ticketCost: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '700',
  },
  ticketDate: {
    fontSize: 11,
    color: colors.textGray,
  },
  purchaseSection: {
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: 16,
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  costSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  costLabel: {
    fontSize: 16,
    color: colors.text,
    fontWeight: '600',
  },
  costValue: {
    fontSize: 24,
    color: colors.primary,
    fontWeight: '700',
  },
  purchaseButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  purchaseGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  purchaseButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
  },
  modalScroll: {
    marginBottom: 20,
  },
  ruleTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  ruleText: {
    fontSize: 14,
    color: colors.textGray,
    lineHeight: 20,
    marginBottom: 8,
  },
  bold: {
    fontWeight: '700',
    color: colors.text,
  },
  closeModalButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  closeModalButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
});
