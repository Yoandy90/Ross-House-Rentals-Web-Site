import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../../constants/colors';
import api from '../../services/api';
import { useTranslation } from 'react-i18next';
import { useGamblingEnabled } from '../../hooks/useGamblingEnabled';

interface CharadaNumero {
  numero: number;
  nombre: string;
  emoji: string;
}

export default function BolitaDetail() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const colors = useThemeColors();
  const { t } = useTranslation();
  const styles = createStyles(colors);
  const { loading: flagsLoading, enabled: gamblingEnabled } = useGamblingEnabled();

  if (flagsLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!gamblingEnabled) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: 32 }]}>
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

  const [lottery, setLottery] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [charada, setCharada] = useState<CharadaNumero[]>([]);
  const [selectedNumber, setSelectedNumber] = useState<number | null>(null);
  const [numberInput, setNumberInput] = useState('');
  const [selectedNumbers, setSelectedNumbers] = useState<number[]>([]);
  const [betType, setBetType] = useState<'fijo' | 'corrido' | 'parley'>('fijo');
  const [searchQuery, setSearchQuery] = useState('');
  const [dreamResults, setDreamResults] = useState<CharadaNumero[]>([]);
  const [showCharada, setShowCharada] = useState(false);
  const [showDreamBook, setShowDreamBook] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [myTickets, setMyTickets] = useState<any[]>([]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Check if ID exists
      if (!id) {
        console.error('No lottery ID provided');
        Alert.alert(t('common.error', 'Error'), t('bolitaDetail.notFound', 'No se encontró la lotería'));
        router.back();
        return;
      }

      
      const [lotteryRes, charadaRes, ticketsRes] = await Promise.all([
        api.get(`/lotteries/${id}`),
        api.get('/charada'),
        api.get(`/lotteries/my-tickets?lottery_id=${id}`).catch(() => ({ data: { tickets: [] } }))
      ]);
      
      
      setLottery(lotteryRes.data);
      setCharada(charadaRes.data.charada || []);
      setMyTickets(ticketsRes.data.tickets || []);
    } catch (error: any) {
      console.error('Error loading data:', error);
      console.error('Error details:', error.response?.data || error.message);
      Alert.alert(t('common.error', 'Error'), error.response?.data?.detail || t('bolitaDetail.loadError', 'No se pudo cargar el juego'));
    } finally {
      setLoading(false);
    }
  };

  // Cambiar tipo de apuesta limpia la selección
  useEffect(() => {
    setSelectedNumber(null);
    setSelectedNumbers([]);
    setNumberInput('');
  }, [betType]);

  useEffect(() => {
    loadData();
  }, [id]);

  const searchDream = async () => {
    
    if (!searchQuery || searchQuery.length < 2) {
      Alert.alert(t('bolitaDetail.notice', 'Aviso'), t('bolitaDetail.searchMinChars', 'Escribe al menos 2 letras para buscar'));
      return;
    }

    try {
      const response = await api.get(`/libro-suenos/buscar?palabra=${searchQuery}`);
      
      if (response.data.numeros && response.data.numeros.length > 0) {
        setDreamResults(response.data.numeros);
        setShowDreamBook(true);
      } else {
        Alert.alert(t('bolitaDetail.searchNotFound', 'No encontrado'), `${t('bolitaDetail.searchNotFound', 'No se encontraron números para')} "${searchQuery}"`);
      }
    } catch (error: any) {
      console.error('❌ Error searching dream:', error);
      console.error('Error details:', error.response?.data);
      Alert.alert(t('common.error', 'Error'), error.response?.data?.detail || t('bolitaDetail.dreamBookError', 'No se pudo buscar en el libro de sueños'));
    }
  };

  const selectNumber = (numero: number) => {
    if (betType === 'fijo') {
      // Fijo: solo un número
      setSelectedNumber(numero);
      setSelectedNumbers([]);
    } else if (betType === 'corrido') {
      // Corrido: múltiples números (hasta 5)
      if (selectedNumbers.includes(numero)) {
        setSelectedNumbers(selectedNumbers.filter(n => n !== numero));
      } else if (selectedNumbers.length < 5) {
        setSelectedNumbers([...selectedNumbers, numero]);
      } else {
        Alert.alert(t('bolitaDetail.limitReached', 'Límite alcanzado'), t('bolitaDetail.corridoLimit', 'Máximo 5 números para Corrido'));
      }
    } else if (betType === 'parley') {
      // Parley: exactamente 2 números
      if (selectedNumbers.includes(numero)) {
        setSelectedNumbers(selectedNumbers.filter(n => n !== numero));
      } else if (selectedNumbers.length < 2) {
        setSelectedNumbers([...selectedNumbers, numero]);
      } else {
        Alert.alert(t('bolitaDetail.limitReached', 'Límite alcanzado'), t('bolitaDetail.parleyLimit', 'Parley requiere exactamente 2 números. Primero deselecciona uno.'));
      }
    }
    setShowCharada(false);
    setShowDreamBook(false);
  };

  const buyTicket = async () => {
    
    let numbersToPlay: number[] = [];
    let mensaje = '';
    let costo = lottery.entry_cost || 1;

    if (betType === 'fijo') {
      if (selectedNumber === null) {
        Alert.alert(t('bolitaDetail.selectNumber', 'Selecciona un número'), t('bolitaDetail.selectFijo', 'Debes elegir un número del 1 al 99 para apuesta Fijo'));
        return;
      }
      numbersToPlay = [selectedNumber];
      const numeroInfo = charada.find(n => n.numero === selectedNumber);
      mensaje = numeroInfo 
        ? `Fijo al ${selectedNumber} (${numeroInfo.emoji} ${numeroInfo.nombre})`
        : `Fijo al ${selectedNumber}`;
    } else if (betType === 'corrido') {
      if (selectedNumbers.length === 0) {
        Alert.alert(t('bolitaDetail.selectNumbers', 'Selecciona números'), t('bolitaDetail.selectCorrido', 'Debes elegir al menos 1 número para apuesta Corrido'));
        return;
      }
      numbersToPlay = selectedNumbers;
      costo = costo * selectedNumbers.length;
      mensaje = `Corrido a ${selectedNumbers.length} números: ${selectedNumbers.sort((a, b) => a - b).join(', ')}`;
    } else if (betType === 'parley') {
      if (selectedNumbers.length !== 2) {
        Alert.alert(t('bolitaDetail.select2Numbers', 'Selecciona 2 números'), t('bolitaDetail.selectParley', 'Parley requiere exactamente 2 números'));
        return;
      }
      numbersToPlay = selectedNumbers;
      costo = costo * 1.5; // Parley cuesta 1.5x
      mensaje = `Parley: ${selectedNumbers[0]} y ${selectedNumbers[1]}`;
    }

    Alert.alert(
      'Confirmar compra',
      `${mensaje}\nTipo: ${betType.toUpperCase()}\nCosto: ${costo} crédito${costo > 1 ? 's' : ''}`,
      [
        { text: t('common.cancel', 'Cancelar'), style: 'cancel' },
        {
          text: 'Comprar',
          onPress: async () => {
            try {
              setPurchasing(true);
              await api.post(`/lotteries/${id}/buy`, {
                lottery_id: id,
                quantity: 1,
                selected_numbers: numbersToPlay,
                bet_type: betType
              });
              
              Alert.alert('¡Éxito!', `Compraste tu apuesta ${betType.toUpperCase()}. ¡Buena suerte! 🍀`);
              loadData();
              setSelectedNumber(null);
              setSelectedNumbers([]);
            } catch (error: any) {
              const message = error.response?.data?.detail || 'No se pudo comprar el ticket';
              Alert.alert('Error', message);
            } finally {
              setPurchasing(false);
            }
          }
        }
      ]
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // Show loading while data is being fetched
  if (loading || !lottery) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ color: colors.text, marginTop: 16 }}>Cargando...</Text>
      </View>
    );
  }

  const selectedInfo = selectedNumber !== null ? charada.find(n => n.numero === selectedNumber) : null;
  
  // Debug

  return (
    <View style={styles.container}>
      {/* Modern Header with Gradient-like effect */}
      <View style={styles.modernHeader}>
        <TouchableOpacity onPress={() => router.back()} style={styles.modernBackButton}>
          <Ionicons name="arrow-back" size={24} color={colors.textWhite} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerSubtitle}>Tradición Cubana</Text>
          <Text style={styles.modernHeaderTitle}>La Bolita Cubana</Text>
          <Text style={styles.headerPrize}>🏆 Premio: {lottery.prize_pool || 0} Créditos</Text>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Intro */}
        <View style={styles.introCard}>
          <Text style={styles.introTitle}>{lottery.title}</Text>
          <Text style={styles.introDescription}>{lottery.description}</Text>
          
          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>{t('bolitaDetail.prize')}</Text>
              <Text style={styles.infoValue}>{lottery.prize_pool || 0} 💰</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>{t('bolitaDetail.cost', 'Costo')}</Text>
              <Text style={styles.infoValue}>{lottery.entry_cost || 1} 🎫</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>{t('bolitaDetail.players', 'Jugadores')}</Text>
              <Text style={styles.infoValue}>{lottery.participants_count || 0} 👥</Text>
            </View>
          </View>

          {/* Número Ganador */}
          {lottery.winning_numbers && lottery.winning_numbers.length > 0 && (
            <View style={styles.winningNumberContainer}>
              <Text style={styles.winningNumberLabel}>🏆 Número Ganador</Text>
              <View style={styles.winningNumberDisplay}>
                {lottery.winning_numbers.map((num: number, index: number) => {
                  const winnerInfo = charada.find(n => n.numero === num);
                  return (
                    <View key={index} style={styles.winningNumberCard}>
                      <Text style={styles.winningNumberValue}>{num}</Text>
                      {winnerInfo && (
                        <>
                          <Text style={styles.winningNumberEmoji}>{winnerInfo.emoji}</Text>
                          <Text style={styles.winningNumberName}>{winnerInfo.nombre}</Text>
                        </>
                      )}
                    </View>
                  );
                })}
              </View>
            </View>
          )}
        </View>

        {/* Mis tickets */}
        {myTickets.length > 0 && (
          <View style={styles.myTicketsCard}>
            <Text style={styles.sectionTitle}>🎫 Mis Números</Text>
            <View style={styles.ticketsGrid}>
              {myTickets.map((ticket, index) => {
                const numero = ticket.selected_numbers?.[0];
                const info = charada.find(n => n.numero === numero);
                const isWinner = ticket.is_winner || false;
                const prizeWon = ticket.prize_won;
                
                return (
                  <View 
                    key={index} 
                    style={[
                      styles.myTicket,
                      isWinner && styles.myTicketWinner
                    ]}
                  >
                    <View style={styles.ticketHeader}>
                      <Text style={[
                        styles.myTicketNumber,
                        isWinner && styles.myTicketNumberWinner
                      ]}>
                        {numero}
                      </Text>
                      {isWinner && (
                        <View style={styles.winnerBadge}>
                          <Text style={styles.winnerBadgeText}>🏆 GANADOR</Text>
                        </View>
                      )}
                    </View>
                    {info && (
                      <Text style={styles.myTicketEmoji}>{info.emoji}</Text>
                    )}
                    {info && (
                      <Text style={styles.myTicketName}>{info.nombre}</Text>
                    )}
                    {isWinner && prizeWon && (
                      <View style={styles.prizeContainer}>
                        <Text style={styles.prizeLabel}>Premio:</Text>
                        <Text style={styles.prizeValue}>{prizeWon}</Text>
                      </View>
                    )}
                    {ticket.bet_type && (
                      <Text style={styles.ticketBetType}>
                        {ticket.bet_type.toUpperCase()}
                      </Text>
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Tipos de apuesta - Diseño moderno */}
        <View style={styles.modernSection}>
          <Text style={styles.modernSectionTitle}>Elige tu Jugada</Text>
          
          <TouchableOpacity
            style={[styles.modernBetButton, betType === 'fijo' && styles.modernBetButtonActive]}
            onPress={() => setBetType('fijo')}
          >
            <View style={styles.modernBetContent}>
              <Text style={[styles.modernBetTitle, betType === 'fijo' && styles.modernBetTitleActive]}>
                🎯 Fijo
              </Text>
              <Text style={[styles.modernBetDescription, betType === 'fijo' && styles.modernBetDescriptionActive]}>
                Un número exacto - Mayor probabilidad
              </Text>
            </View>
            <View style={[styles.modernBetPriceBadge, betType === 'fijo' && styles.modernBetPriceBadgeActive]}>
              <Text style={[styles.modernBetPrice, betType === 'fijo' && styles.modernBetPriceActive]}>
                ${lottery?.entry_cost || 1}
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.modernBetButton, betType === 'corrido' && styles.modernBetButtonActive]}
            onPress={() => setBetType('corrido')}
          >
            <View style={styles.modernBetContent}>
              <Text style={[styles.modernBetTitle, betType === 'corrido' && styles.modernBetTitleActive]}>
                🎲 Corrido
              </Text>
              <Text style={[styles.modernBetDescription, betType === 'corrido' && styles.modernBetDescriptionActive]}>
                Hasta 5 números - Más opciones de ganar
              </Text>
            </View>
            <View style={[styles.modernBetPriceBadge, betType === 'corrido' && styles.modernBetPriceBadgeActive]}>
              <Text style={[styles.modernBetPrice, betType === 'corrido' && styles.modernBetPriceActive]}>
                ${lottery?.entry_cost || 1} c/u
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.modernBetButton, betType === 'parley' && styles.modernBetButtonActive]}
            onPress={() => setBetType('parley')}
          >
            <View style={styles.modernBetContent}>
              <Text style={[styles.modernBetTitle, betType === 'parley' && styles.modernBetTitleActive]}>
                💎 Parley
              </Text>
              <Text style={[styles.modernBetDescription, betType === 'parley' && styles.modernBetDescriptionActive]}>
                2 números combinados - Premio especial
              </Text>
            </View>
            <View style={[styles.modernBetPriceBadge, betType === 'parley' && styles.modernBetPriceBadgeActive]}>
              <Text style={[styles.modernBetPrice, betType === 'parley' && styles.modernBetPriceActive]}>
                ${Math.ceil((lottery?.entry_cost || 1) * 1.5)}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Selector de número - Diseño moderno con grid */}
        <View style={styles.modernSection}>
          <Text style={styles.modernSectionTitle}>
            {betType === 'fijo' && 'Elige tu Número'}
            {betType === 'corrido' && 'Elige tus Números (hasta 5)'}
            {betType === 'parley' && 'Elige 2 Números'}
          </Text>
          
          {/* Mostrar números seleccionados */}
          {(betType === 'fijo' && selectedNumber !== null) || 
           ((betType === 'corrido' || betType === 'parley') && selectedNumbers.length > 0) ? (
            <View style={styles.selectedNumbersContainer}>
              <Text style={styles.selectedLabel}>Seleccionados:</Text>
              <View style={styles.selectedNumbersDisplay}>
                {betType === 'fijo' && selectedNumber !== null && (
                  <View style={styles.selectedNumberBubble}>
                    <Text style={styles.selectedNumberBubbleText}>{selectedNumber}</Text>
                    {selectedInfo && <Text style={styles.selectedNumberEmoji}>{selectedInfo.emoji}</Text>}
                  </View>
                )}
                {(betType === 'corrido' || betType === 'parley') && selectedNumbers.map((num) => {
                  const info = charada.find(n => n.numero === num);
                  return (
                    <View key={num} style={styles.selectedNumberBubble}>
                      <Text style={styles.selectedNumberBubbleText}>{num}</Text>
                      {info && <Text style={styles.selectedNumberEmoji}>{info.emoji}</Text>}
                      <TouchableOpacity 
                        style={styles.removeNumberButton}
                        onPress={() => selectNumber(num)}
                      >
                        <Ionicons name="close" size={16} color={colors.textWhite} />
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
              <TouchableOpacity 
                style={styles.clearSelectionButton}
                onPress={() => {
                  setSelectedNumber(null);
                  setSelectedNumbers([]);
                }}
              >
                <Text style={styles.clearSelectionText}>{t('bolitaDetail.clearSelection', 'Limpiar selección')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={styles.selectionHint}>
              {betType === 'fijo' && 'Toca un número del 0 al 99'}
              {betType === 'corrido' && 'Selecciona de 1 a 5 números'}
              {betType === 'parley' && 'Selecciona exactamente 2 números'}
            </Text>
          )}

          {/* Quick Picks */}
          <View style={styles.quickPicksSection}>
            <Text style={styles.quickPicksTitle}>Selección Rápida</Text>
            <View style={styles.quickPicksGrid}>
              <TouchableOpacity 
                style={styles.quickPickButton}
                onPress={() => {
                  const random = Math.floor(Math.random() * 100);
                  selectNumber(random);
                }}
              >
                <Ionicons name="flash" size={20} color={colors.primary} />
                <Text style={styles.quickPickText}>{t('bolitaDetail.random', 'Aleatorio')}</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.quickPickButton}
                onPress={() => setShowCharada(true)}
              >
                <Ionicons name="book" size={20} color={colors.primary} />
                <Text style={styles.quickPickText}>La Charada</Text>
              </TouchableOpacity>
              
              {betType === 'corrido' && (
                <TouchableOpacity 
                  style={styles.quickPickButton}
                  onPress={() => {
                    const randoms = [];
                    while (randoms.length < 5) {
                      const r = Math.floor(Math.random() * 100);
                      if (!randoms.includes(r)) randoms.push(r);
                    }
                    randoms.forEach(num => selectNumber(num));
                  }}
                >
                  <Ionicons name="dice" size={20} color={colors.primary} />
                  <Text style={styles.quickPickText}>5 Random</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Grid de números 0-99 */}
          <View style={styles.numbersGridContainer}>
            <Text style={styles.numbersGridTitle}>O elige manualmente:</Text>
            <ScrollView 
              style={styles.numbersGridScroll}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled={true}
            >
              <View style={styles.numbersGrid}>
                {Array.from({ length: 99 }, (_, i) => i + 1).map((num) => {
                  const isSelected = betType === 'fijo' 
                    ? selectedNumber === num
                    : selectedNumbers.includes(num);
                  const info = charada.find(n => n.numero === num);
                  
                  return (
                    <TouchableOpacity
                      key={num}
                      style={[
                        styles.numberGridButton,
                        isSelected && styles.numberGridButtonSelected
                      ]}
                      onPress={() => selectNumber(num)}
                    >
                      <Text style={[
                        styles.numberGridText,
                        isSelected && styles.numberGridTextSelected
                      ]}>
                        {num}
                      </Text>
                      {info && (
                        <Text style={styles.numberGridEmoji}>{info.emoji}</Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        </View>

        {/* Buscador de sueños */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>📖 Libro de Sueños</Text>
          <Text style={styles.sectionSubtitle}>¿Soñaste algo? Busca su número aquí</Text>
          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="Ej: caballo, agua, dinero..."
              placeholderTextColor={colors.textLight}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={searchDream}
            />
            <TouchableOpacity onPress={searchDream} style={styles.searchButton}>
              <Ionicons name="search" size={20} color={colors.textWhite} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Botones de acción */}
        <View style={styles.actionsCard}>
          <TouchableOpacity 
            style={styles.charadaButton}
            onPress={() => setShowCharada(true)}
          >
            <Ionicons name="list" size={20} color={colors.textWhite} />
            <Text style={styles.charadaButtonText}>Ver La Charada Completa</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[
              styles.buyButton, 
              (purchasing || 
               (betType === 'fijo' && selectedNumber === null) ||
               (betType === 'corrido' && selectedNumbers.length === 0) ||
               (betType === 'parley' && selectedNumbers.length !== 2)
              ) && styles.buyButtonDisabled,
            ]}
            onPress={() => {
              if (purchasing) {
                return;
              }
              if (betType === 'fijo' && selectedNumber === null) {
                Alert.alert(t('bolitaDetail.selectNumber', 'Selecciona un número'), t('bolitaDetail.selectToPlay', 'Debes elegir un número para jugar'));
                return;
              }
              if (betType === 'corrido' && selectedNumbers.length === 0) {
                Alert.alert(t('bolitaDetail.selectNumbers', 'Selecciona números'), t('bolitaDetail.selectAtLeast', 'Debes elegir al menos un número'));
                return;
              }
              if (betType === 'parley' && selectedNumbers.length !== 2) {
                Alert.alert(t('bolitaDetail.parley2Title', 'Parley requiere 2 números'), t('bolitaDetail.parley2', 'Debes elegir exactamente 2 números'));
                return;
              }
              buyTicket();
            }}
            activeOpacity={0.7}
          >
            {purchasing ? (
              <ActivityIndicator color={colors.textWhite} />
            ) : (
              <>
                <Ionicons name="cart" size={20} color={colors.textWhite} />
                <Text style={styles.buyButtonText}>
                  {betType === 'fijo' && selectedNumber !== null && `Comprar Número ${selectedNumber}`}
                  {betType === 'corrido' && selectedNumbers.length > 0 && `Comprar ${selectedNumbers.length} Números`}
                  {betType === 'parley' && selectedNumbers.length === 2 && `Comprar Parley`}
                  {((betType === 'fijo' && selectedNumber === null) || 
                    (betType === 'corrido' && selectedNumbers.length === 0) || 
                    (betType === 'parley' && selectedNumbers.length !== 2)) && 'Selecciona número(s)'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Reglas */}
        <View style={styles.rulesCard}>
          <Text style={styles.sectionTitle}>📋 Reglas del Juego</Text>
          {lottery.rules?.map((rule: string, index: number) => (
            <View key={index} style={styles.ruleItem}>
              <Text style={styles.ruleBullet}>•</Text>
              <Text style={styles.ruleText}>{rule}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Modal de La Charada */}
      <Modal
        visible={showCharada}
        animationType="slide"
        onRequestClose={() => setShowCharada(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>🐴 La Charada China</Text>
            <TouchableOpacity onPress={() => setShowCharada(false)}>
              <Ionicons name="close" size={28} color={colors.text} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalContent}>
            <View style={styles.charadaList}>
              {charada.map((item) => (
                <TouchableOpacity
                  key={item.numero}
                  style={styles.charadaItemCard}
                  onPress={() => selectNumber(item.numero)}
                >
                  <View style={styles.charadaItemHeader}>
                    <Text style={styles.charadaEmoji}>{item.emoji}</Text>
                    <View style={styles.charadaItemInfo}>
                      <View style={styles.charadaItemTitleRow}>
                        <Text style={styles.charadaNumero}>{item.numero}</Text>
                        <Text style={styles.charadaNombre}>{item.nombre}</Text>
                      </View>
                      {item.significados && item.significados.length > 0 && (
                        <View style={styles.charadaSignificados}>
                          <Text style={styles.charadaSignificadosLabel}>También:</Text>
                          <Text style={styles.charadaSignificadosText}>
                            {item.significados.join(' • ')}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Modal de resultados de sueños */}
      <Modal
        visible={showDreamBook}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowDreamBook(false)}
      >
        <View style={styles.dreamModalOverlay}>
          <View style={styles.dreamModalContent}>
            <Text style={styles.dreamModalTitle}>
              Números para "{searchQuery}"
            </Text>
            <ScrollView style={styles.dreamResults}>
              {dreamResults.map((item) => (
                <TouchableOpacity
                  key={item.numero}
                  style={styles.dreamResultItem}
                  onPress={() => selectNumber(item.numero)}
                >
                  <View style={styles.dreamResultHeader}>
                    <Text style={styles.dreamResultEmoji}>{item.emoji}</Text>
                    <View style={styles.dreamResultInfo}>
                      <View style={styles.dreamResultTitleRow}>
                        <Text style={styles.dreamResultNumero}>{item.numero}</Text>
                        <Text style={styles.dreamResultNombre}>{item.nombre}</Text>
                      </View>
                      {item.significados && item.significados.length > 0 && (
                        <View style={styles.dreamSignificados}>
                          <Text style={styles.dreamSignificadosLabel}>También:</Text>
                          <View style={styles.dreamSignificadosList}>
                            {item.significados.map((sig: string, idx: number) => (
                              <Text key={idx} style={styles.dreamSignificadoItem}>
                                {sig}{idx < item.significados.length - 1 ? ' • ' : ''}
                              </Text>
                            ))}
                          </View>
                        </View>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity 
              style={styles.dreamCloseButton}
              onPress={() => setShowDreamBook(false)}
            >
              <Text style={styles.dreamCloseText}>{t('bolitaDetail.close', 'Cerrar')}</Text>
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
    backgroundColor: colors.background,
  },
  modernHeader: {
    backgroundColor: colors.primary,
    paddingTop: 50,
    paddingBottom: 24,
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
    top: 50,
    left: 20,
    padding: 8,
    zIndex: 10,
  },
  headerContent: {
    alignItems: 'center',
    marginTop: 8,
  },
  headerSubtitle: {
    fontSize: 12,
    color: colors.textWhite + 'CC',
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  modernHeaderTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.textWhite,
    marginBottom: 8,
  },
  headerPrize: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textWhite,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.backgroundCard,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  introCard: {
    backgroundColor: colors.backgroundCard,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  introTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  introDescription: {
    fontSize: 14,
    color: colors.textGray,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  infoItem: {
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 12,
    color: colors.textGray,
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  myTicketsCard: {
    backgroundColor: colors.backgroundCard,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  ticketsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  myTicket: {
    backgroundColor: colors.success + '20',
    borderWidth: 2,
    borderColor: colors.success,
    borderRadius: 8,
    padding: 12,
    minWidth: 90,
    alignItems: 'center',
  },
  myTicketWinner: {
    backgroundColor: '#FFD700' + '30',
    borderColor: '#FFD700',
    borderWidth: 3,
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
  },
  ticketHeader: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 4,
  },
  myTicketNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.success,
  },
  myTicketNumberWinner: {
    fontSize: 24,
    color: '#FFD700',
  },
  myTicketEmoji: {
    fontSize: 16,
    marginTop: 4,
  },
  myTicketName: {
    fontSize: 10,
    color: colors.textGray,
    marginTop: 2,
    textAlign: 'center',
  },
  winnerBadge: {
    backgroundColor: '#FFD700',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 4,
  },
  winnerBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#000',
  },
  prizeContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    width: '100%',
    alignItems: 'center',
  },
  prizeLabel: {
    fontSize: 10,
    color: colors.textGray,
    marginBottom: 2,
  },
  prizeValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFD700',
  },
  ticketBetType: {
    fontSize: 9,
    color: colors.textLight,
    marginTop: 4,
    fontStyle: 'italic',
  },
  winningNumberContainer: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#FFD700' + '20',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  winningNumberLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 12,
  },
  winningNumberDisplay: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  winningNumberCard: {
    backgroundColor: '#FFD700',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    minWidth: 80,
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  winningNumberValue: {
    fontSize: 32,
    fontWeight: '700',
    color: '#000',
  },
  winningNumberEmoji: {
    fontSize: 28,
    marginTop: 4,
  },
  winningNumberName: {
    fontSize: 12,
    color: '#000',
    marginTop: 4,
    textAlign: 'center',
    fontWeight: '600',
  },
  card: {
    backgroundColor: colors.backgroundCard,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: colors.textGray,
    marginBottom: 12,
  },
  searchContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    backgroundColor: colors.backgroundGray,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: colors.text,
  },
  searchButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    padding: 12,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 50,
  },
  selectedNumberCard: {
    alignItems: 'center',
    padding: 24,
    backgroundColor: colors.primary + '10',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  selectedNumberLarge: {
    fontSize: 64,
    fontWeight: '700',
    color: colors.primary,
  },
  selectedEmoji: {
    fontSize: 48,
    marginTop: 8,
  },
  selectedName: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    marginTop: 8,
  },
  changeButton: {
    marginTop: 16,
    padding: 8,
  },
  changeButtonText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  numberInputContainer: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberInput: {
    backgroundColor: colors.backgroundGray,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    fontSize: 24,
    textAlign: 'center',
    color: colors.text,
    fontWeight: '700',
    width: 100,
    height: 56,
  },
  confirmNumberButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    padding: 12,
    justifyContent: 'center',
    alignItems: 'center',
    width: 56,
    height: 56,
  },
  confirmNumberButtonDisabled: {
    opacity: 0.3,
    backgroundColor: colors.textGray,
  },
  actionsCard: {
    gap: 12,
    marginBottom: 16,
  },
  charadaButton: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  charadaButtonText: {
    color: colors.textWhite,
    fontSize: 16,
    fontWeight: '600',
  },
  buyButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buyButtonDisabled: {
    opacity: 0.5,
  },
  buyButtonText: {
    color: colors.textWhite,
    fontSize: 16,
    fontWeight: '700',
  },
  rulesCard: {
    backgroundColor: colors.backgroundCard,
    borderRadius: 12,
    padding: 16,
    marginBottom: 32,
  },
  ruleItem: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  ruleBullet: {
    fontSize: 16,
    color: colors.primary,
    marginRight: 8,
  },
  ruleText: {
    flex: 1,
    fontSize: 14,
    color: colors.textGray,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  modalContent: {
    flex: 1,
  },
  charadaList: {
    padding: 16,
  },
  charadaItemCard: {
    backgroundColor: colors.backgroundGray,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  charadaItemHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  charadaItemInfo: {
    flex: 1,
  },
  charadaItemTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  charadaEmoji: {
    fontSize: 36,
  },
  charadaNumero: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
    backgroundColor: colors.primary + '20',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
  },
  charadaNombre: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
  },
  charadaSignificados: {
    marginTop: 4,
  },
  charadaSignificadosLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.secondaryText,
    marginBottom: 3,
  },
  charadaSignificadosText: {
    fontSize: 13,
    color: colors.text,
    opacity: 0.8,
    lineHeight: 18,
  },
  dreamModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dreamModalContent: {
    backgroundColor: colors.backgroundCard,
    borderRadius: 16,
    padding: 20,
    width: '85%',
    maxHeight: '70%',
  },
  dreamModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 16,
    textAlign: 'center',
  },
  dreamResults: {
    gap: 12,
  },
  dreamResultItem: {
    padding: 16,
    backgroundColor: colors.backgroundGray,
    borderRadius: 12,
    marginBottom: 12,
  },
  dreamResultHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  dreamResultInfo: {
    flex: 1,
  },
  dreamResultTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  dreamResultEmoji: {
    fontSize: 36,
  },
  dreamResultNumero: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.primary,
    backgroundColor: colors.primary + '20',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
  },
  dreamResultNombre: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
  },
  dreamSignificados: {
    marginTop: 4,
  },
  dreamSignificadosLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.secondaryText,
    marginBottom: 4,
  },
  dreamSignificadosList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  dreamSignificadoItem: {
    fontSize: 14,
    color: colors.text,
    opacity: 0.8,
  },
  dreamCloseButton: {
    marginTop: 16,
    padding: 12,
    backgroundColor: colors.primary,
    borderRadius: 8,
    alignItems: 'center',
  },
  dreamCloseText: {
    color: colors.textWhite,
    fontSize: 16,
    fontWeight: '600',
  },
  betTypeContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  betTypeButton: {
    flex: 1,
    backgroundColor: colors.backgroundGray,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  betTypeButtonActive: {
    backgroundColor: colors.primary + '15',
    borderColor: colors.primary,
  },
  betTypeButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textGray,
    marginBottom: 4,
  },
  betTypeButtonTextActive: {
    color: colors.primary,
  },
  betTypeDescription: {
    fontSize: 11,
    color: colors.textLight,
    marginBottom: 2,
  },
  betTypePrice: {
    fontSize: 10,
    color: colors.textLight,
    fontWeight: '600',
  },
  modernSection: {
    marginBottom: 20,
  },
  modernSectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 16,
  },
  modernBetButton: {
    backgroundColor: colors.textWhite,
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 2,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  modernBetButtonActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '08',
    shadowOpacity: 0.12,
    elevation: 4,
  },
  modernBetContent: {
    flex: 1,
  },
  modernBetTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  modernBetTitleActive: {
    color: colors.primary,
  },
  modernBetDescription: {
    fontSize: 13,
    color: colors.textGray,
  },
  modernBetDescriptionActive: {
    color: colors.text,
  },
  modernBetPriceBadge: {
    backgroundColor: colors.backgroundGray,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    minWidth: 60,
    alignItems: 'center',
  },
  modernBetPriceBadgeActive: {
    backgroundColor: colors.primary,
  },
  modernBetPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  modernBetPriceActive: {
    color: colors.textWhite,
  },
  selectedMultipleContainer: {
    marginBottom: 12,
  },
  selectedNumbersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  selectedNumberChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary + '15',
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: 8,
    padding: 8,
    gap: 8,
  },
  chipContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  chipNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
  },
  chipEmoji: {
    fontSize: 16,
  },
  helperText: {
    fontSize: 12,
    color: colors.textLight,
    fontStyle: 'italic',
  },
  selectedNumbersContainer: {
    backgroundColor: colors.primary + '10',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  selectedLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  selectedNumbersDisplay: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  selectedNumberBubble: {
    backgroundColor: colors.primary,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  selectedNumberBubbleText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textWhite,
  },
  selectedNumberEmoji: {
    fontSize: 16,
  },
  removeNumberButton: {
    marginLeft: 4,
    padding: 2,
  },
  clearSelectionButton: {
    alignSelf: 'flex-start',
  },
  clearSelectionText: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  selectionHint: {
    fontSize: 14,
    color: colors.textGray,
    textAlign: 'center',
    marginBottom: 16,
    fontStyle: 'italic',
  },
  quickPicksSection: {
    marginBottom: 20,
  },
  quickPicksTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  quickPicksGrid: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  quickPickButton: {
    flex: 1,
    minWidth: 100,
    backgroundColor: colors.textWhite,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    gap: 6,
    borderWidth: 2,
    borderColor: colors.border,
  },
  quickPickText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  numbersGridContainer: {
    marginTop: 8,
  },
  numbersGridTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  numbersGridScroll: {
    maxHeight: 400,
  },
  numbersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingBottom: 16,
  },
  numberGridButton: {
    width: '18%',
    aspectRatio: 1,
    backgroundColor: colors.textWhite,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },
  numberGridButtonSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  numberGridText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  numberGridTextSelected: {
    color: colors.textWhite,
  },
  numberGridEmoji: {
    fontSize: 12,
    marginTop: 2,
  },
});
