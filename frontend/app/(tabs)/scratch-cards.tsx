import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useThemeColors } from '../../constants/colors';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import CustomHeader from '../../components/CustomHeader';
import { Canvas, Path, Skia } from '@shopify/react-native-skia';
import api from '../../services/api';
import { useGamblingEnabled } from '../../hooks/useGamblingEnabled';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width - 40;
const CARD_HEIGHT = 300;

interface ScratchCard {
  id: string;
  name: string;
  price: number;
  prizes: string[];
  icon: string;
  colors: string[];
}

const AVAILABLE_CARDS: ScratchCard[] = [
  {
    id: 'basic',
    name: 'Raspadito Básico',
    price: 10,
    prizes: ['$5', '$10', '$25', '$50'],
    icon: 'ticket-outline',
    colors: ['#3B82F6', '#60A5FA'],
  },
  {
    id: 'premium',
    name: 'Raspadito Premium',
    price: 25,
    prizes: ['$10', '$25', '$50', '$100', '$250'],
    icon: 'trophy-outline',
    colors: ['#8B5CF6', '#A78BFA'],
  },
  {
    id: 'gold',
    name: 'Raspadito de Oro',
    price: 50,
    prizes: ['$25', '$50', '$100', '$250', '$500', '$1000'],
    icon: 'medal-outline',
    colors: ['#F59E0B', '#FBBF24'],
  },
];

export default function ScratchCardsScreen() {
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const { t } = useTranslation();
  const { loading: flagsLoading, enabled: gamblingEnabled } = useGamblingEnabled();
  
  const [selectedCard, setSelectedCard] = useState<ScratchCard | null>(null);
  const [activeGame, setActiveGame] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [scratching, setScratching] = useState(false);
  const [revealedPrize, setRevealedPrize] = useState<string | null>(null);
  const [balance, setBalance] = useState(0);

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

  const purchaseCard = async (card: ScratchCard) => {
    try {
      setLoading(true);
      
      // Call real backend using api service
      const response = await api.post('/scratch-cards/purchase', {
        card_type: card.id,
        price: card.price
      });
      
      const data = response.data;
      
      // Set game with real prize from backend
      setActiveGame({ 
        id: card.id, 
        prize: data.prize 
      });
      setSelectedCard(card);
      setRevealedPrize(null);
      
      // Update balance if provided by backend
      if (data.new_balance !== undefined) {
        setBalance(data.new_balance);
      }
      
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || 'Hubo un problema al comprar el raspadito';
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const revealCard = () => {
    if (!activeGame) return;
    
    setScratching(true);
    
    // Simulate scratching animation
    setTimeout(() => {
      setRevealedPrize(activeGame.prize);
      setScratching(false);
      
      // Show result
      setTimeout(() => {
        if (activeGame.prize !== 'Lose') {
          Alert.alert(
            '🎉 ¡Felicidades!',
            `¡Ganaste ${activeGame.prize}!`,
            [
              {
                text: 'Jugar de Nuevo',
                onPress: () => {
                  setActiveGame(null);
                  setSelectedCard(null);
                  setRevealedPrize(null);
                },
              },
            ]
          );
        } else {
          Alert.alert(
            'Sin Premio',
            'No ganaste esta vez. ¡Intenta de nuevo!',
            [
              {
                text: 'Jugar de Nuevo',
                onPress: () => {
                  setActiveGame(null);
                  setSelectedCard(null);
                  setRevealedPrize(null);
                },
              },
            ]
          );
        }
      }, 500);
    }, 2000);
  };

  if (activeGame && selectedCard) {
    return (
      <View style={styles.container}>
        <CustomHeader 
          title={t('scratchCards.singleTitle')}
          showBackButton={true}
          onBackPress={() => {
            setActiveGame(null);
            setSelectedCard(null);
            setRevealedPrize(null);
          }}
        />
        
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.gameContainer}
        >
          <View style={styles.gameHeader}>
            <Text style={styles.gameTitle}>{selectedCard.name}</Text>
            <Text style={styles.gameSubtitle}>¡Raspa para revelar tu premio!</Text>
          </View>

          <View style={styles.cardContainer}>
            <LinearGradient
              colors={selectedCard.colors}
              style={styles.scratchCard}
            >
              {!scratching && !revealedPrize && (
                <View style={styles.scratchOverlay}>
                  <Ionicons name="hand-left" size={48} color="#FFF" />
                  <Text style={styles.scratchText}>Toca para Raspar</Text>
                </View>
              )}
              
              {scratching && (
                <View style={styles.scratchingAnimation}>
                  <ActivityIndicator size="large" color="#FFF" />
                  <Text style={styles.scratchingText}>Raspando...</Text>
                </View>
              )}
              
              {revealedPrize && (
                <View style={styles.prizeReveal}>
                  {revealedPrize !== 'Lose' ? (
                    <>
                      <Ionicons name="trophy" size={64} color="#FFD700" />
                      <Text style={styles.prizeAmount}>{revealedPrize}</Text>
                      <Text style={styles.prizeLabel}>¡GANASTE!</Text>
                    </>
                  ) : (
                    <>
                      <Ionicons name="close-circle" size={64} color="#FF6B6B" />
                      <Text style={styles.noWinText}>Sin Premio</Text>
                      <Text style={styles.tryAgainText}>¡Intenta de nuevo!</Text>
                    </>
                  )}
                </View>
              )}
            </LinearGradient>
          </View>

          {!scratching && !revealedPrize && (
            <TouchableOpacity
              style={styles.scratchButton}
              onPress={revealCard}
            >
              <LinearGradient
                colors={['#10B981', '#059669']}
                style={styles.buttonGradient}
              >
                <Ionicons name="hand-left" size={24} color="#FFF" />
                <Text style={styles.scratchButtonText}>Raspar Ahora</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}

          <View style={styles.prizesInfo}>
            <Text style={styles.prizesTitle}>Premios Disponibles:</Text>
            <View style={styles.prizesList}>
              {selectedCard.prizes.map((prize, index) => (
                <View key={index} style={styles.prizeItem}>
                  <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                  <Text style={styles.prizeText}>{prize}</Text>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CustomHeader 
        title={t('scratchCards.title')}
        showBackButton={true}
      />
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.headerBanner}>
          <Ionicons name="ticket" size={32} color={colors.primary} />
          <Text style={styles.headerTitle}>{t('scratchCards.title', 'Raspaditos')}</Text>
          <Text style={styles.headerSubtitle}>
            Raspa y gana al instante
          </Text>
        </View>

        <View style={styles.cardsGrid}>
          {AVAILABLE_CARDS.map((card) => (
            <View key={card.id} style={styles.cardOption}>
              <LinearGradient
                colors={card.colors}
                style={styles.cardGradient}
              >
                <View style={styles.cardIcon}>
                  <Ionicons name={card.icon as any} size={38} color="#FFF" />
                </View>
                <Text style={styles.cardName}>{card.name}</Text>
                
                <View style={styles.cardPrizes}>
                  <Text style={styles.prizesLabel}>{t('scratchCards.upTo', 'Hasta')}</Text>
                  <Text style={styles.maxPrize}>
                    {card.prizes[card.prizes.length - 1]}
                  </Text>
                </View>

                <View style={styles.cardFooter}>
                  <View style={styles.priceTag}>
                    <Ionicons name="wallet" size={14} color="#FFF" />
                    <Text style={styles.priceText}>{card.price}</Text>
                  </View>
                  
                  <TouchableOpacity
                    style={styles.buyButton}
                    onPress={() => purchaseCard(card)}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <>
                        <Text style={styles.buyButtonText}>{t('scratchCards.play', 'Jugar')}</Text>
                        <Ionicons name="play" size={14} color="#FFF" />
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </LinearGradient>
            </View>
          ))}
        </View>

        <View style={styles.howToPlay}>
          <Text style={styles.howToPlayTitle}>¿Cómo Jugar?</Text>
          
          <View style={styles.step}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>1</Text>
            </View>
            <Text style={styles.stepText}>{t('scratchCards.step1', 'Selecciona tu raspadito favorito')}</Text>
          </View>

          <View style={styles.step}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>2</Text>
            </View>
            <Text style={styles.stepText}>{t('scratchCards.step2', 'Compra con tus créditos')}</Text>
          </View>

          <View style={styles.step}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>3</Text>
            </View>
            <Text style={styles.stepText}>¡Raspa y descubre tu premio!</Text>
          </View>

          <View style={styles.step}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>4</Text>
            </View>
            <Text style={styles.stepText}>{t('scratchCards.step3', 'Los premios se acreditan automáticamente')}</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  headerBanner: {
    alignItems: 'center',
    marginBottom: 20,
    paddingTop: 10,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: 8,
  },
  headerSubtitle: {
    fontSize: 14,
    color: colors.secondaryText,
    marginTop: 4,
    textAlign: 'center',
  },
  cardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  cardOption: {
    width: '48%',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  cardGradient: {
    padding: 14,
    minHeight: 200,
  },
  cardIcon: {
    alignSelf: 'center',
    marginBottom: 10,
  },
  cardName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFF',
    textAlign: 'center',
    marginBottom: 10,
    lineHeight: 20,
  },
  cardPrizes: {
    alignItems: 'center',
    marginBottom: 14,
  },
  prizesLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.9)',
    marginBottom: 4,
  },
  maxPrize: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFD700',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 'auto',
  },
  priceTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  priceText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFF',
  },
  buyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
    gap: 4,
  },
  buyButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFF',
  },
  howToPlay: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
  },
  howToPlayTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 20,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    gap: 15,
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumberText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFF',
  },
  stepText: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
  },
  // Game Screen Styles
  gameContainer: {
    padding: 20,
    alignItems: 'center',
  },
  gameHeader: {
    alignItems: 'center',
    marginBottom: 30,
  },
  gameTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
  },
  gameSubtitle: {
    fontSize: 16,
    color: colors.secondaryText,
    marginTop: 8,
  },
  cardContainer: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
  },
  scratchCard: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scratchOverlay: {
    alignItems: 'center',
  },
  scratchText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
    marginTop: 15,
  },
  scratchingAnimation: {
    alignItems: 'center',
  },
  scratchingText: {
    fontSize: 18,
    color: '#FFF',
    marginTop: 15,
  },
  prizeReveal: {
    alignItems: 'center',
  },
  prizeAmount: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#FFD700',
    marginTop: 15,
  },
  prizeLabel: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFF',
    marginTop: 10,
  },
  noWinText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFF',
    marginTop: 15,
  },
  tryAgainText: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 10,
  },
  scratchButton: {
    width: CARD_WIDTH,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 30,
  },
  buttonGradient: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 10,
  },
  scratchButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
  },
  prizesInfo: {
    width: '100%',
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
  },
  prizesTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 15,
  },
  prizesList: {
    gap: 10,
  },
  prizeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  prizeText: {
    fontSize: 16,
    color: colors.text,
  },
});
