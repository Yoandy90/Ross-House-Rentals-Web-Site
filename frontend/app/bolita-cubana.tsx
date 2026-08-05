import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Alert,
  TextInput,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useThemeColors } from '../constants/colors';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { useTranslation } from 'react-i18next';
import { useGamblingEnabled } from '../hooks/useGamblingEnabled';

type BetType = 'fijo' | 'corrido' | 'candado' | 'parley';

interface Bet {
  type: BetType;
  numbers: number[];
  amount: number;
}

interface DrawResult {
  date: string;
  fijo: number;
  corridos: number[];
}

export default function BolitaCubanaScreen() {
  const colors = useThemeColors();
  const { t } = useTranslation();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const { user } = useAuth();
  const router = useRouter();
  const { loading: flagsLoading, enabled: gamblingEnabled } = useGamblingEnabled();
  
  const [loading, setLoading] = useState(false);

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
  const [refreshing, setRefreshing] = useState(false);
  const [balance, setBalance] = useState(0);
  const [selectedNumbers, setSelectedNumbers] = useState<number[]>([]);
  const [betAmount, setBetAmount] = useState('1');
  const [selectedBetType, setSelectedBetType] = useState<BetType>('fijo');
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [history, setHistory] = useState<DrawResult[]>([]);
  const [myBets, setMyBets] = useState<Bet[]>([]);
  const [cart, setCart] = useState<Bet[]>([]);
  const [showCartModal, setShowCartModal] = useState(false);

  useEffect(() => {
    loadBalance();
    loadHistory();
  }, []);

  const loadBalance = async () => {
    try {
      const response = await api.get('/credits/balance');
      setBalance(response.data.balance || 0);
    } catch (error) {
      console.error('Error loading balance:', error);
    }
  };

  const loadHistory = async () => {
    try {
      const response = await api.get('/bolita/history');
      setHistory(response.data.history || []);
    } catch (error) {
      console.error('Error loading history:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadBalance(), loadHistory()]);
    setRefreshing(false);
  };

  const getBetTypeInfo = (type: BetType) => {
    switch (type) {
      case 'fijo':
        return { 
          title: 'Número Fijo', 
          payout: '$85 por $1', 
          desc: 'Selecciona los números que quieras ($1 c/u)',
          max: 100,
          icon: 'star'
        };
      case 'corrido':
        return { 
          title: 'Números Corridos', 
          payout: '$25 por $1', 
          desc: 'Selecciona los números que quieras ($1 c/u)',
          max: 100,
          icon: 'shuffle'
        };
      case 'candado':
        return { 
          title: 'Candado', 
          payout: '$1,000 por $1', 
          desc: 'Selecciona 3 números (deben salir todos)',
          max: 3,
          icon: 'lock-closed'
        };
      case 'parley':
        return { 
          title: 'Parley', 
          payout: '$400 por $1', 
          desc: 'Selecciona 2 números (deben salir ambos)',
          max: 2,
          icon: 'git-merge'
        };
    }
  };

  const handleNumberSelect = (num: number) => {
    const info = getBetTypeInfo(selectedBetType);
    
    if (selectedNumbers.includes(num)) {
      setSelectedNumbers(selectedNumbers.filter(n => n !== num));
    } else {
      if (selectedNumbers.length < info.max) {
        setSelectedNumbers([...selectedNumbers, num]);
      } else {
        Alert.alert(
          'Límite alcanzado',
          `Para ${info.title} solo puedes seleccionar ${info.max} número(s)`
        );
      }
    }
  };

  const handleBetTypeChange = (type: BetType) => {
    setSelectedBetType(type);
    setSelectedNumbers([]);
  };

  const calculatePotentialWin = () => {
    const amountPerNumber = parseFloat(betAmount) || 0;
    
    if (selectedNumbers.length === 0) {
      return 0;
    }
    
    switch (selectedBetType) {
      case 'fijo': 
        // Si sale 1 de tus números como fijo
        // Ganas: monto por ese número × 85
        return amountPerNumber * 85;
        
      case 'corrido':
        // Si sale 1 de tus números como corrido
        // Ganas: monto por ese número × 25
        // Si salen 2 de tus números (en el sorteo salen 2 corridos)
        // Ganas: monto × 25 × 2 = monto × 50
        const numCount = selectedNumbers.length;
        if (numCount >= 2) {
          // Potencial máximo: 2 números ganadores
          return amountPerNumber * 25 * 2;
        } else {
          // Solo 1 número seleccionado
          return amountPerNumber * 25;
        }
        
      case 'candado':
        // Deben salir los 3 números
        return amountPerNumber * 1000;
        
      case 'parley':
        // Deben salir los 2 números
        return amountPerNumber * 400;
    }
    
    return 0;
  };

  const handleAddToCart = () => {
    const info = getBetTypeInfo(selectedBetType);
    const amountPerNumber = parseFloat(betAmount) || 0;

    if (selectedNumbers.length === 0) {
      Alert.alert('Error', 'Debes seleccionar al menos un número');
      return;
    }

    // Validar cantidad según tipo
    if (selectedBetType === 'candado' && selectedNumbers.length !== 3) {
      Alert.alert('Error', 'Para Candado debes seleccionar exactamente 3 números');
      return;
    }

    if (selectedBetType === 'parley' && selectedNumbers.length !== 2) {
      Alert.alert('Error', 'Para Parley debes seleccionar exactamente 2 números');
      return;
    }

    if (amountPerNumber <= 0) {
      Alert.alert('Error', 'El monto debe ser mayor a 0');
      return;
    }

    // Calcular monto total
    let totalAmount;
    if (selectedBetType === 'fijo' || selectedBetType === 'corrido') {
      // Para fijo y corrido: cada número cuesta el monto indicado
      totalAmount = selectedNumbers.length * amountPerNumber;
    } else {
      // Para candado y parley: es un monto único
      totalAmount = amountPerNumber;
    }

    // Agregar al carrito
    const newBet: Bet = {
      type: selectedBetType,
      numbers: [...selectedNumbers],
      amount: totalAmount,
    };

    setCart([...cart, newBet]);
    setSelectedNumbers([]);
    setBetAmount('1');
    
    const numCount = selectedNumbers.length;
    const detailMessage = (selectedBetType === 'fijo' || selectedBetType === 'corrido') 
      ? `${numCount} número(s) × $${amountPerNumber} = $${totalAmount}`
      : `$${totalAmount}`;
    
    Alert.alert(
      '✅ Agregado al carrito',
      `${info.title}\nNúmeros: ${newBet.numbers.join(', ')}\n${detailMessage}`,
      [{ text: 'OK' }]
    );
  };

  const handlePlaceBet = async () => {
    const info = getBetTypeInfo(selectedBetType);
    const amountPerNumber = parseFloat(betAmount) || 0;
    

    if (selectedNumbers.length === 0) {
      Alert.alert('Error', 'Debes seleccionar al menos un número');
      return;
    }

    // Validar cantidad según tipo
    if (selectedBetType === 'candado' && selectedNumbers.length !== 3) {
      Alert.alert('Error', 'Para Candado debes seleccionar exactamente 3 números');
      return;
    }

    if (selectedBetType === 'parley' && selectedNumbers.length !== 2) {
      Alert.alert('Error', 'Para Parley debes seleccionar exactamente 2 números');
      return;
    }

    if (amountPerNumber <= 0) {
      Alert.alert('Error', 'El monto debe ser mayor a 0');
      return;
    }

    // Calcular monto total
    let totalAmount;
    if (selectedBetType === 'fijo' || selectedBetType === 'corrido') {
      totalAmount = selectedNumbers.length * amountPerNumber;
    } else {
      totalAmount = amountPerNumber;
    }

    if (totalAmount > balance) {
      Alert.alert(
        'Saldo insuficiente', 
        `Necesitas ${totalAmount} créditos pero solo tienes ${balance}. ¿Deseas recargar tu saldo?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { 
            text: 'Recargar Saldo', 
            onPress: () => router.push('/(tabs)/credits' as any)
          }
        ]
      );
      return;
    }

    try {
      
      setLoading(true);
      const response = await api.post('/bolita/bet', {
        type: selectedBetType,
        numbers: selectedNumbers,
        amount: totalAmount,
      });


      const detailMessage = (selectedBetType === 'fijo' || selectedBetType === 'corrido')
        ? `${selectedNumbers.length} número(s) × $${amountPerNumber} = $${totalAmount}`
        : `$${totalAmount}`;

      Alert.alert(
        '¡Apuesta realizada!',
        `${info.title}\nNúmeros: ${selectedNumbers.join(', ')}\n${detailMessage}`,
        [{ text: 'OK', onPress: () => {
          setSelectedNumbers([]);
          setBetAmount('1');
          loadBalance();
        }}]
      );
    } catch (error: any) {
      console.error('❌ Bet error:', error);
      console.error('Error response:', error.response);
      Alert.alert('Error', error.response?.data?.detail || error.message || 'No se pudo realizar la apuesta');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmCart = async () => {
    if (cart.length === 0) {
      Alert.alert('Carrito vacío', 'Agrega al menos una apuesta al carrito');
      return;
    }

    const totalAmount = cart.reduce((sum, bet) => sum + bet.amount, 0);

    if (totalAmount > balance) {
      Alert.alert(
        'Saldo insuficiente',
        `Necesitas ${totalAmount} créditos pero solo tienes ${balance}. ¿Deseas recargar tu saldo?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Recargar Saldo',
            onPress: () => {
              setShowCartModal(false);
              router.push('/(tabs)/credits' as any);
            }
          }
        ]
      );
      return;
    }

    try {
      setLoading(true);
      const response = await api.post('/bolita/bet/multiple', {
        bets: cart.map(bet => ({
          type: bet.type,
          numbers: bet.numbers,
          amount: bet.amount,
        }))
      });

      setCart([]);
      setShowCartModal(false);
      
      Alert.alert(
        '🎉 ¡Apuestas Realizadas!',
        `${response.data.bets_placed} apuestas procesadas\nTotal: $${response.data.total_amount}\nNuevo saldo: ${response.data.balance} créditos`,
        [{ text: 'Genial', onPress: () => loadBalance() }]
      );
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'No se pudo procesar las apuestas');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveFromCart = (index: number) => {
    const newCart = cart.filter((_, i) => i !== index);
    setCart(newCart);
  };

  const calculateCartTotal = () => {
    return cart.reduce((sum, bet) => sum + bet.amount, 0);
  };

  const calculateCartPotentialWin = () => {
    return cart.reduce((sum, bet) => {
      let multiplier = 0;
      switch (bet.type) {
        case 'fijo': multiplier = 85; break;
        case 'corrido': multiplier = 25; break;
        case 'candado': multiplier = 1000; break;
        case 'parley': multiplier = 400; break;
      }
      return sum + (bet.amount * multiplier);
    }, 0);
  };

  const renderNumberGrid = () => {
    const numbers = Array.from({ length: 100 }, (_, i) => i + 1);
    
    return (
      <View style={styles.numberGrid}>
        {numbers.map((num) => (
          <TouchableOpacity
            key={num}
            style={[
              styles.numberButton,
              selectedNumbers.includes(num) && styles.numberButtonSelected,
            ]}
            onPress={() => handleNumberSelect(num)}
          >
            <Text style={[
              styles.numberText,
              selectedNumbers.includes(num) && styles.numberTextSelected,
            ]}>
              {num}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderBetTypeSelector = () => {
    const types: BetType[] = ['fijo', 'corrido', 'candado', 'parley'];
    
    return (
      <View style={styles.betTypeContainer}>
        {types.map((type) => {
          const info = getBetTypeInfo(type);
          const isSelected = selectedBetType === type;
          
          return (
            <TouchableOpacity
              key={type}
              style={[
                styles.betTypeCard,
                isSelected && styles.betTypeCardSelected,
              ]}
              onPress={() => handleBetTypeChange(type)}
            >
              <Ionicons 
                name={info.icon as any} 
                size={24} 
                color={isSelected ? '#FFF' : colors.primary} 
              />
              <Text style={[
                styles.betTypeTitle,
                isSelected && styles.betTypeTitleSelected,
              ]}>
                {info.title}
              </Text>
              <Text style={[
                styles.betTypePayout,
                isSelected && styles.betTypePayoutSelected,
              ]}>
                {info.payout}
              </Text>
              <Text style={[
                styles.betTypeDesc,
                isSelected && styles.betTypeDescSelected,
              ]}>
                {info.desc}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>🇨🇺 La Bolita Cubana</Text>
          <Text style={styles.headerSubtitle}>Juego de azar tradicional</Text>
        </View>
        <TouchableOpacity 
          style={styles.cartButton}
          onPress={() => setShowCartModal(true)}
        >
          <Ionicons name="cart" size={24} color="#FFF" />
          {cart.length > 0 && (
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>{cart.length}</Text>
            </View>
          )}
        </TouchableOpacity>
        <View style={styles.headerBalanceCard}>
          <Ionicons name="wallet" size={16} color="#FFF" />
          <Text style={styles.headerBalanceText}>{balance}</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {/* Info Buttons */}
        <View style={styles.infoButtonsContainer}>
          <TouchableOpacity 
            style={styles.infoButton}
            onPress={() => setShowRulesModal(true)}
          >
            <Ionicons name="information-circle-outline" size={20} color={colors.primary} />
            <Text style={styles.infoButtonText}>Cómo Jugar</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.infoButton}
            onPress={() => setShowHistoryModal(true)}
          >
            <Ionicons name="time-outline" size={20} color={colors.primary} />
            <Text style={styles.infoButtonText}>Historial</Text>
          </TouchableOpacity>
        </View>

        {/* Bet Type Selector */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tipo de Apuesta</Text>
          {renderBetTypeSelector()}
        </View>

        {/* Selected Numbers */}
        {selectedNumbers.length > 0 && (
          <View style={styles.selectedNumbersCard}>
            <Text style={styles.selectedNumbersTitle}>Números Seleccionados:</Text>
            <View style={styles.selectedNumbersList}>
              {selectedNumbers.map((num) => (
                <View key={num} style={styles.selectedNumberChip}>
                  <Text style={styles.selectedNumberChipText}>{num}</Text>
                  <TouchableOpacity onPress={() => handleNumberSelect(num)}>
                    <Ionicons name="close-circle" size={18} color="#FFF" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Number Grid */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Selecciona tus Números (1-100)
          </Text>
          {renderNumberGrid()}
        </View>

        {/* Bet Amount */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Monto de Apuesta (créditos)</Text>
          <View style={styles.amountInputContainer}>
            <TouchableOpacity 
              style={styles.amountButton}
              onPress={() => setBetAmount((Math.max(1, parseFloat(betAmount || '1') - 1)).toString())}
            >
              <Ionicons name="remove" size={20} color={colors.primary} />
            </TouchableOpacity>
            <TextInput
              style={styles.amountInput}
              value={betAmount}
              onChangeText={setBetAmount}
              keyboardType="numeric"
              placeholder="1"
            />
            <TouchableOpacity 
              style={styles.amountButton}
              onPress={() => setBetAmount((parseFloat(betAmount || '0') + 1).toString())}
            >
              <Ionicons name="add" size={20} color={colors.primary} />
            </TouchableOpacity>
          </View>
          <View style={styles.quickAmountButtons}>
            {[1, 5, 10, 20, 50].map((amount) => (
              <TouchableOpacity
                key={amount}
                style={styles.quickAmountButton}
                onPress={() => setBetAmount(amount.toString())}
              >
                <Text style={styles.quickAmountText}>{amount}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Cost and Potential Win */}
        {selectedNumbers.length > 0 && (
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Números seleccionados:</Text>
              <Text style={styles.summaryValue}>{selectedNumbers.length}</Text>
            </View>
            {(selectedBetType === 'fijo' || selectedBetType === 'corrido') && (
              <>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Costo por número:</Text>
                  <Text style={styles.summaryValue}>${parseFloat(betAmount) || 0}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Costo total:</Text>
                  <Text style={styles.summaryValueBold}>
                    ${selectedNumbers.length * (parseFloat(betAmount) || 0)}
                  </Text>
                </View>
              </>
            )}
            <View style={[styles.summaryRow, styles.summaryRowHighlight]}>
              <Text style={styles.potentialWinLabel}>💰 Ganancia Potencial:</Text>
              <Text style={styles.potentialWinAmount}>${calculatePotentialWin()}</Text>
            </View>
            {selectedBetType === 'corrido' && selectedNumbers.length >= 2 && (
              <Text style={styles.summaryNote}>
                * Máximo si salen 2 de tus números
              </Text>
            )}
          </View>
        )}

        {/* Bet Action Buttons */}
        <View style={styles.betActionsContainer}>
          <TouchableOpacity
            style={[styles.addToCartButton]}
            onPress={handleAddToCart}
          >
            <Ionicons name="cart-outline" size={20} color={colors.primary} />
            <Text style={styles.addToCartText}>Agregar al Carrito</Text>
          </TouchableOpacity>

          <View style={[styles.placeBetButton, loading && styles.placeBetButtonDisabled]}>
            <TouchableOpacity
              onPress={handlePlaceBet}
              disabled={loading}
              style={{ flex: 1 }}
            >
              <LinearGradient
                colors={['#0066CC', '#0052A3']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.placeBetGradient}
              >
                {loading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <>
                    <Ionicons name="flash" size={20} color="#FFF" />
                    <Text style={styles.placeBetText}>Apostar Ahora</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
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
              <Text style={styles.modalTitle}>🇨🇺 Cómo Jugar La Bolita</Text>
              <TouchableOpacity onPress={() => setShowRulesModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <Text style={styles.rulesText}>
                <Text style={styles.rulesBold}>La Bolita Cubana</Text> es un emocionante juego de azar tradicional.
              </Text>
              
              <View style={styles.ruleSection}>
                <Text style={styles.ruleSectionTitle}>⭐ Número Fijo</Text>
                <Text style={styles.ruleText}>• Selecciona los números que quieras (1-100)</Text>
                <Text style={styles.ruleText}>• Cada número cuesta $1 (o el monto que elijas)</Text>
                <Text style={styles.ruleText}>• Ejemplo: 5 números × $2 = $10 total</Text>
                <Text style={styles.ruleText}>• Si sale alguno de tus números como FIJO, ganas $85 por cada $1</Text>
              </View>

              <View style={styles.ruleSection}>
                <Text style={styles.ruleSectionTitle}>🔀 Números Corridos</Text>
                <Text style={styles.ruleText}>• Selecciona los números que quieras (1-100)</Text>
                <Text style={styles.ruleText}>• Cada número cuesta $1 (o el monto que elijas)</Text>
                <Text style={styles.ruleText}>• Ejemplo: 7 números × $1 = $7 total</Text>
                <Text style={styles.ruleText}>• Si sale alguno de tus números como CORRIDO, ganas $25 por cada $1</Text>
              </View>

              <View style={styles.ruleSection}>
                <Text style={styles.ruleSectionTitle}>🔒 Candado</Text>
                <Text style={styles.ruleText}>• Selecciona 3 números específicos</Text>
                <Text style={styles.ruleText}>• Deben salir LOS TRES números para ganar</Text>
                <Text style={styles.ruleText}>• Premio: $1,000 por cada $1 apostado</Text>
              </View>

              <View style={styles.ruleSection}>
                <Text style={styles.ruleSectionTitle}>🎯 Parley</Text>
                <Text style={styles.ruleText}>• Selecciona 2 números específicos</Text>
                <Text style={styles.ruleText}>• Deben salir AMBOS números para ganar</Text>
                <Text style={styles.ruleText}>• Premio: $400 por cada $1 apostado</Text>
              </View>

              <View style={styles.ruleSection}>
                <Text style={styles.ruleSectionTitle}>📅 Sorteo</Text>
                <Text style={styles.ruleText}>• Se realiza un sorteo diario</Text>
                <Text style={styles.ruleText}>• Se extraen 3 números: 1 fijo y 2 corridos</Text>
                <Text style={styles.ruleText}>• Los resultados determinan las ganancias</Text>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* History Modal */}
      <Modal
        visible={showHistoryModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowHistoryModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>📊 Historial de Sorteos</Text>
              <TouchableOpacity onPress={() => setShowHistoryModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {history.length === 0 ? (
                <Text style={styles.noHistoryText}>No hay sorteos registrados aún</Text>
              ) : (
                history.map((draw, index) => (
                  <View key={index} style={styles.historyItem}>
                    <Text style={styles.historyDate}>{draw.date}</Text>
                    <View style={styles.historyNumbers}>
                      <View style={styles.historyNumberChip}>
                        <Text style={styles.historyNumberLabel}>Fijo</Text>
                        <Text style={styles.historyNumberValue}>{draw.fijo}</Text>
                      </View>
                      <View style={styles.historyNumberChip}>
                        <Text style={styles.historyNumberLabel}>Corridos</Text>
                        <Text style={styles.historyNumberValue}>
                          {draw.corridos.join(', ')}
                        </Text>
                      </View>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Cart Modal */}
      <Modal
        visible={showCartModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCartModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>🛒 Tu Carrito de Apuestas</Text>
              <TouchableOpacity onPress={() => setShowCartModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {cart.length === 0 ? (
                <View style={styles.emptyCartContainer}>
                  <Ionicons name="cart-outline" size={64} color={colors.textGray} />
                  <Text style={styles.emptyCartText}>Tu carrito está vacío</Text>
                  <Text style={styles.emptyCartSubtext}>Agrega apuestas para continuar</Text>
                </View>
              ) : (
                <>
                  {cart.map((bet, index) => {
                    const info = getBetTypeInfo(bet.type);
                    const potentialWin = bet.amount * (
                      bet.type === 'fijo' ? 85 :
                      bet.type === 'corrido' ? 25 :
                      bet.type === 'candado' ? 1000 :
                      400
                    );
                    
                    return (
                      <View key={index} style={styles.cartItem}>
                        <View style={styles.cartItemHeader}>
                          <View style={styles.cartItemIcon}>
                            <Ionicons name={info.icon as any} size={20} color={colors.primary} />
                          </View>
                          <View style={styles.cartItemInfo}>
                            <Text style={styles.cartItemTitle}>{info.title}</Text>
                            <Text style={styles.cartItemNumbers}>
                              Números: {bet.numbers.join(', ')}
                            </Text>
                          </View>
                          <TouchableOpacity 
                            style={styles.cartItemRemove}
                            onPress={() => handleRemoveFromCart(index)}
                          >
                            <Ionicons name="trash-outline" size={20} color="#FF4757" />
                          </TouchableOpacity>
                        </View>
                        <View style={styles.cartItemFooter}>
                          <View style={styles.cartItemAmount}>
                            <Text style={styles.cartItemAmountLabel}>Apuesta:</Text>
                            <Text style={styles.cartItemAmountValue}>${bet.amount}</Text>
                          </View>
                          <View style={styles.cartItemPotential}>
                            <Text style={styles.cartItemPotentialLabel}>Ganancia potencial:</Text>
                            <Text style={styles.cartItemPotentialValue}>${potentialWin}</Text>
                          </View>
                        </View>
                      </View>
                    );
                  })}

                  {/* Cart Summary */}
                  <View style={styles.cartSummary}>
                    <View style={styles.cartSummaryRow}>
                      <Text style={styles.cartSummaryLabel}>Total de apuestas:</Text>
                      <Text style={styles.cartSummaryValue}>{cart.length}</Text>
                    </View>
                    <View style={styles.cartSummaryRow}>
                      <Text style={styles.cartSummaryLabel}>Total a pagar:</Text>
                      <Text style={styles.cartSummaryValue}>${calculateCartTotal()} créditos</Text>
                    </View>
                    <View style={styles.cartSummaryRow}>
                      <Text style={styles.cartSummaryLabel}>Ganancia potencial:</Text>
                      <Text style={[styles.cartSummaryValue, styles.cartSummaryHighlight]}>
                        ${calculateCartPotentialWin()}
                      </Text>
                    </View>
                    <View style={styles.cartBalanceRow}>
                      <Text style={styles.cartBalanceLabel}>Tu saldo actual:</Text>
                      <Text style={[
                        styles.cartBalanceValue,
                        calculateCartTotal() > balance ? styles.cartBalanceInsufficient : styles.cartBalanceSufficient
                      ]}>
                        {balance} créditos
                      </Text>
                    </View>
                  </View>

                  {/* Cart Actions */}
                  <View style={[styles.confirmCartButton, loading && styles.confirmCartButtonDisabled]}>
                    <TouchableOpacity
                      onPress={handleConfirmCart}
                      disabled={loading}
                      style={{ flex: 1 }}
                    >
                      <LinearGradient
                        colors={['#4CAF50', '#45a049']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.confirmCartGradient}
                      >
                        {loading ? (
                          <ActivityIndicator color="#FFF" />
                        ) : (
                          <>
                            <Ionicons name="checkmark-circle" size={24} color="#FFF" />
                            <Text style={styles.confirmCartText}>Confirmar Todas las Apuestas</Text>
                          </>
                        )}
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity
                    style={styles.clearCartButton}
                    onPress={() => {
                      Alert.alert(
                        'Vaciar Carrito',
                        '¿Estás seguro de que quieres eliminar todas las apuestas del carrito?',
                        [
                          { text: 'Cancelar', style: 'cancel' },
                          { text: 'Sí, vaciar', onPress: () => setCart([]), style: 'destructive' }
                        ]
                      );
                    }}
                  >
                    <Text style={styles.clearCartText}>Vaciar Carrito</Text>
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
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
  header: {
    backgroundColor: '#0066CC',
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 8,
  },
  headerContent: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFF',
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  headerBalanceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    gap: 6,
  },
  headerBalanceText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  infoButtonsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  infoButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  infoButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
  },
  betTypeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  betTypeCard: {
    flex: 1,
    minWidth: '47%',
    backgroundColor: colors.background,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  betTypeCardSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  betTypeTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginTop: 8,
    textAlign: 'center',
  },
  betTypeTitleSelected: {
    color: '#FFF',
  },
  betTypePayout: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.accent,
    marginTop: 4,
  },
  betTypePayoutSelected: {
    color: '#FFF',
  },
  betTypeDesc: {
    fontSize: 10,
    color: colors.textGray,
    marginTop: 4,
    textAlign: 'center',
  },
  betTypeDescSelected: {
    color: 'rgba(255, 255, 255, 0.9)',
  },
  selectedNumbersCard: {
    backgroundColor: colors.primary + '15',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  selectedNumbersTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  selectedNumbersList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  selectedNumberChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    gap: 6,
  },
  selectedNumberChipText: {
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
    width: '9%',
    aspectRatio: 1,
    backgroundColor: colors.background,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.backgroundGray,
  },
  numberButtonSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  numberText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
  },
  numberTextSelected: {
    color: '#FFF',
    fontWeight: '700',
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 4,
    gap: 8,
  },
  amountButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: colors.backgroundGray,
    justifyContent: 'center',
    alignItems: 'center',
  },
  amountInput: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    padding: 12,
  },
  quickAmountButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  quickAmountButton: {
    flex: 1,
    backgroundColor: colors.background,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.backgroundGray,
  },
  quickAmountText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  summaryCard: {
    backgroundColor: colors.background,
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryRowHighlight: {
    backgroundColor: '#4CAF50',
    marginHorizontal: -16,
    marginBottom: -16,
    marginTop: 8,
    padding: 16,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  summaryLabel: {
    fontSize: 14,
    color: colors.textGray,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  summaryValueBold: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  summaryNote: {
    fontSize: 11,
    color: colors.textGray,
    fontStyle: 'italic',
    marginTop: 4,
  },
  potentialWinLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  potentialWinAmount: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFF',
  },
  betActionsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  addToCartButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  addToCartText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primary,
  },
  placeBetButton: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  placeBetButtonDisabled: {
    opacity: 0.5,
  },
  placeBetGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  placeBetText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFF',
  },
  cartButton: {
    position: 'relative',
    padding: 8,
    marginRight: 8,
  },
  cartBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: '#FF4757',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  cartBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFF',
  },
  emptyCartContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyCartText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginTop: 16,
  },
  emptyCartSubtext: {
    fontSize: 14,
    color: colors.textGray,
    marginTop: 4,
  },
  cartItem: {
    backgroundColor: colors.backgroundGray,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  cartItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  cartItemIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  cartItemInfo: {
    flex: 1,
  },
  cartItemTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  cartItemNumbers: {
    fontSize: 13,
    color: colors.textGray,
    marginTop: 2,
  },
  cartItemRemove: {
    padding: 8,
  },
  cartItemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.background,
  },
  cartItemAmount: {
    flex: 1,
  },
  cartItemAmountLabel: {
    fontSize: 11,
    color: colors.textGray,
  },
  cartItemAmountValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginTop: 2,
  },
  cartItemPotential: {
    flex: 1,
    alignItems: 'flex-end',
  },
  cartItemPotentialLabel: {
    fontSize: 11,
    color: colors.textGray,
  },
  cartItemPotentialValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4CAF50',
    marginTop: 2,
  },
  cartSummary: {
    backgroundColor: colors.primary + '10',
    padding: 16,
    borderRadius: 12,
    marginTop: 12,
    marginBottom: 20,
  },
  cartSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  cartSummaryLabel: {
    fontSize: 14,
    color: colors.text,
  },
  cartSummaryValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  cartSummaryHighlight: {
    color: '#4CAF50',
    fontSize: 16,
  },
  cartBalanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.backgroundGray,
  },
  cartBalanceLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  cartBalanceValue: {
    fontSize: 14,
    fontWeight: '800',
  },
  cartBalanceSufficient: {
    color: '#4CAF50',
  },
  cartBalanceInsufficient: {
    color: '#FF4757',
  },
  confirmCartButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
  },
  confirmCartButtonDisabled: {
    opacity: 0.5,
  },
  confirmCartGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  confirmCartText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  clearCartButton: {
    backgroundColor: colors.backgroundGray,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  clearCartText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textGray,
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
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.backgroundGray,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  modalBody: {
    padding: 20,
  },
  rulesText: {
    fontSize: 14,
    color: colors.textGray,
    lineHeight: 20,
    marginBottom: 20,
  },
  rulesBold: {
    fontWeight: '700',
    color: colors.text,
  },
  ruleSection: {
    marginBottom: 20,
  },
  ruleSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  ruleText: {
    fontSize: 13,
    color: colors.textGray,
    lineHeight: 20,
    marginBottom: 4,
  },
  noHistoryText: {
    fontSize: 14,
    color: colors.textGray,
    textAlign: 'center',
    padding: 40,
  },
  historyItem: {
    backgroundColor: colors.backgroundGray,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  historyDate: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
  },
  historyNumbers: {
    flexDirection: 'row',
    gap: 12,
  },
  historyNumberChip: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  historyNumberLabel: {
    fontSize: 11,
    color: colors.textGray,
    marginBottom: 4,
  },
  historyNumberValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
  },
});
