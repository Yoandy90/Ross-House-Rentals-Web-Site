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
  Platform,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useThemeColors } from '../../constants/colors';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import { useGamblingEnabled } from '../../hooks/useGamblingEnabled';

interface Lottery {
  id: string;
  title: string;
  description: string;
  lottery_type: 'scratch_card' | 'bolita' | 'traditional';
  prize_type?: string;
  prize_value?: string;
  prize_credits?: number;
  prize_pool?: number;
  ticket_price?: number;
  entry_cost?: number;
  status: string;
  tickets_sold: number;
  participants_count: number;
  draw_date?: string;
  bolita_number_range?: number;
  rules?: string[];
}

interface GameGuide {
  type: string;
  title: string;
  description: string;
  how_to_play: string[];
  prize_structure: { [key: string]: string };
  tips: string[];
  rules?: string[];
  history?: string;
}

export default function LotteryScreen() {
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const { t } = useTranslation();
  const { user } = useAuth();
  const router = useRouter();
  const { loading: flagsLoading, enabled: gamblingEnabled } = useGamblingEnabled();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lotteries, setLotteries] = useState<Lottery[]>([]);
  const [balance, setBalance] = useState(0);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [selectedGuide, setSelectedGuide] = useState<GameGuide | null>(null);
  const [guides, setGuides] = useState<GameGuide[]>([]);

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

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadLotteries(),
        loadBalance(),
        loadGuides(),
      ]);
    } catch (error) {
      console.error('Error loading lottery data:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const loadLotteries = async () => {
    try {
      const response = await api.get('/lotteries');
      setLotteries(response.data.lotteries || []);
    } catch (error: any) {
      console.error('Error loading lotteries:', error);
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

  const loadGuides = async () => {
    try {
      const response = await api.get('/lotteries/guides');
      setGuides(response.data.guides || []);
    } catch (error) {
      console.error('Error loading guides:', error);
    }
  };

  const getGameTypeIcon = (type: string) => {
    switch (type) {
      case 'scratch_card': return 'ticket';
      case 'bolita': return 'baseball';
      case 'traditional': return 'grid';
      default: return 'game-controller';
    }
  };

  const getGameTypeColor = (type: string) => {
    switch (type) {
      case 'scratch_card': return '#FFD700';
      case 'bolita': return '#FF6B6B';
      case 'traditional': return '#4ECDC4';
      default: return colors.primary;
    }
  };

  const getGameTypeTitle = (type: string) => {
    switch (type) {
      case 'scratch_card': return '🎫 Raspaditos';
      case 'bolita': return '🇨🇺 La Bolita';
      case 'traditional': return '🎰 Lotería Clásica';
      default: return t('lotteryScreen.game');
    }
  };

  const handleShowGuide = (type: string) => {
    const guide = guides.find(g => g.type === type);
    if (guide) {
      setSelectedGuide(guide);
      setShowGuideModal(true);
    }
  };

  const handlePlayGame = (lottery: Lottery) => {
    // Navigate to specific game screen based on type
    if (lottery.lottery_type === 'scratch_card') {
      router.push(`/scratch-card?id=${lottery.id}`);
    } else if (lottery.lottery_type === 'bolita') {
      // Si es bolita, ir a la pantalla especial de Bolita Cubana
      router.push(`/bolita-cubana` as any);
    } else if (lottery.lottery_type === 'traditional') {
      router.push(`/traditional-lottery?id=${lottery.id}`);
    }
  };

  const renderGameTypeCard = (type: 'scratch_card' | 'bolita' | 'traditional') => {
    const typeLotteries = lotteries.filter(l => l.lottery_type === type);
    const guide = guides.find(g => g.type === type);
    
    return (
      <View key={type} style={styles.gameTypeCard}>
        <LinearGradient
          colors={[getGameTypeColor(type), getGameTypeColor(type) + 'CC']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gameTypeHeader}
        >
          <View style={styles.gameTypeHeaderContent}>
            <View style={styles.gameTypeIconContainer}>
              <Ionicons name={getGameTypeIcon(type)} size={26} color="#FFF" />
            </View>
            <View style={styles.gameTypeHeaderText}>
              <Text style={styles.gameTypeTitle}>{getGameTypeTitle(type)}</Text>
              <Text style={styles.gameTypeSubtitle}>
                {typeLotteries.length} juego(s) disponible(s)
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.howToPlayButton}
            onPress={() => handleShowGuide(type)}
          >
            <Ionicons name="help-circle-outline" size={22} color="#FFF" />
          </TouchableOpacity>
        </LinearGradient>

        <View style={styles.gameTypeBody}>
          {guide && (
            <Text style={styles.gameTypeDescription}>{guide.description}</Text>
          )}

          {typeLotteries.length === 0 ? (
            <View style={styles.noGamesContainer}>
              <Ionicons name="information-circle-outline" size={32} color={colors.textGray} />
              <Text style={styles.noGamesText}>No hay juegos activos de este tipo</Text>
            </View>
          ) : (
            typeLotteries.map(renderLotteryItem)
          )}
        </View>
      </View>
    );
  };

  const renderLotteryItem = (lottery: Lottery) => (
    <View key={lottery.id} style={styles.lotteryItem}>
      <View style={styles.lotteryHeader}>
        <Text style={styles.lotteryTitle}>{lottery.title}</Text>
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>{lottery.status === 'active' ? t('lotteryScreen.active') : lottery.status}</Text>
        </View>
      </View>

      <Text style={styles.lotteryDescription} numberOfLines={2}>{lottery.description}</Text>

      <View style={styles.lotteryInfo}>
        <View style={styles.infoItem}>
          <Ionicons name="trophy-outline" size={16} color={colors.accent} />
          <Text style={styles.infoText}>
            {lottery.prize_value || `${lottery.prize_pool || lottery.prize_credits || 0} créditos`}
          </Text>
        </View>
        <View style={styles.infoItem}>
          <Ionicons name="pricetag-outline" size={16} color={colors.accent} />
          <Text style={styles.infoText}>
            {lottery.entry_cost || lottery.ticket_price || 0} créditos
          </Text>
        </View>
        <View style={styles.infoItem}>
          <Ionicons name="people-outline" size={16} color={colors.accent} />
          <Text style={styles.infoText}>{lottery.participants_count} jugadores</Text>
        </View>
      </View>

      {lottery.draw_date && (
        <View style={styles.drawDateContainer}>
          <Ionicons name="calendar-outline" size={14} color={colors.textGray} />
          <Text style={styles.drawDateText}>
            Sorteo: {new Date(lottery.draw_date).toLocaleDateString('es-ES')}
          </Text>
        </View>
      )}

      <TouchableOpacity
        style={styles.playButton}
        onPress={() => handlePlayGame(lottery)}
      >
        <LinearGradient
          colors={[colors.primary, colors.secondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.playButtonGradient}
        >
          <Ionicons name="play" size={20} color="#FFF" />
          <Text style={styles.playButtonText}>Jugar Ahora</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Cargando juegos...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      {/* Modern Header with Ross Tax Brand */}
      <View style={styles.modernHeader}>
        <View style={styles.headerContent}>
          <View style={styles.headerLeft}>
            <Ionicons name="game-controller" size={28} color="#FFF" style={styles.headerIcon} />
            <View>
              <Text style={styles.modernHeaderTitle}>Lotería</Text>
              <Text style={styles.modernHeaderSubtitle}>Juega y gana</Text>
            </View>
          </View>
          <View style={styles.headerBalanceCard}>
            <Ionicons name="wallet" size={16} color="#FFF" />
            <Text style={styles.headerBalanceText}>{balance}</Text>
          </View>
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
        {/* Game Types */}
        {renderGameTypeCard('bolita')}
        {renderGameTypeCard('traditional')}
      </ScrollView>

      {/* Guide Modal */}
      <Modal
        visible={showGuideModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowGuideModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {selectedGuide ? selectedGuide.title : 'Cómo Jugar'}
              </Text>
              <TouchableOpacity onPress={() => setShowGuideModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            {selectedGuide && (
              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                <Text style={styles.guideDescription}>{selectedGuide.description}</Text>

                {selectedGuide.history && (
                  <View style={styles.guideSection}>
                    <Text style={styles.guideSectionTitle}>📖 Historia</Text>
                    <Text style={styles.guideSectionText}>{selectedGuide.history}</Text>
                  </View>
                )}

                <View style={styles.guideSection}>
                  <Text style={styles.guideSectionTitle}>📝 Cómo Jugar</Text>
                  {selectedGuide.how_to_play.map((step, index) => (
                    <Text key={index} style={styles.guideStep}>{step}</Text>
                  ))}
                </View>

                <View style={styles.guideSection}>
                  <Text style={styles.guideSectionTitle}>💰 Estructura de Premios</Text>
                  {Object.entries(selectedGuide.prize_structure).map(([key, value]) => (
                    <View key={key} style={styles.prizeRow}>
                      <Text style={styles.prizeKey}>{key}:</Text>
                      <Text style={styles.prizeValue}>{value}</Text>
                    </View>
                  ))}
                </View>

                <View style={styles.guideSection}>
                  <Text style={styles.guideSectionTitle}>💡 Tips y Consejos</Text>
                  {selectedGuide.tips.map((tip, index) => (
                    <Text key={index} style={styles.guideTip}>{tip}</Text>
                  ))}
                </View>

                {selectedGuide.rules && selectedGuide.rules.length > 0 && (
                  <View style={styles.guideSection}>
                    <Text style={styles.guideSectionTitle}>📋 Reglas</Text>
                    {selectedGuide.rules.map((rule, index) => (
                      <Text key={index} style={styles.guideRule}>{rule}</Text>
                    ))}
                  </View>
                )}
              </ScrollView>
            )}

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowGuideModal(false)}
              >
                <LinearGradient
                  colors={[colors.primary, colors.secondary]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.closeButtonGradient}
                >
                  <Text style={styles.closeButtonText}>Entendido</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
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
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 6,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIcon: {
    marginRight: 0,
  },
  modernHeaderTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  modernHeaderSubtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.80)',
    fontWeight: '500',
  },
  headerBalanceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    gap: 6,
  },
  headerBalanceText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  balanceText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
  gameTypeCard: {
    backgroundColor: colors.background,
    borderRadius: 16,
    marginBottom: 18,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  gameTypeHeader: {
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  gameTypeHeaderContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  gameTypeIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gameTypeHeaderText: {
    flex: 1,
  },
  gameTypeTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFF',
    marginBottom: 3,
  },
  gameTypeSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  howToPlayButton: {
    padding: 6,
  },
  gameTypeBody: {
    padding: 14,
  },
  gameTypeDescription: {
    fontSize: 13,
    color: colors.textGray,
    lineHeight: 18,
    marginBottom: 14,
  },
  noGamesContainer: {
    alignItems: 'center',
    padding: 32,
  },
  noGamesText: {
    fontSize: 14,
    color: colors.textGray,
    marginTop: 8,
  },
  lotteryItem: {
    backgroundColor: colors.backgroundGray,
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
  },
  lotteryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  lotteryTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  statusBadge: {
    backgroundColor: colors.success + '20',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.success,
  },
  lotteryDescription: {
    fontSize: 13,
    color: colors.textGray,
    marginBottom: 12,
    lineHeight: 18,
  },
  lotteryInfo: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 12,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  infoText: {
    fontSize: 12,
    color: colors.text,
    fontWeight: '600',
  },
  drawDateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  drawDateText: {
    fontSize: 12,
    color: colors.textGray,
  },
  playButton: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  playButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 6,
  },
  playButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
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
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
  },
  modalBody: {
    padding: 20,
    maxHeight: 500,
  },
  guideDescription: {
    fontSize: 15,
    color: colors.text,
    lineHeight: 22,
    marginBottom: 20,
  },
  guideSection: {
    marginBottom: 24,
  },
  guideSectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
  },
  guideSectionText: {
    fontSize: 14,
    color: colors.textGray,
    lineHeight: 20,
  },
  guideStep: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 22,
    marginBottom: 8,
  },
  prizeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.backgroundGray,
  },
  prizeKey: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
  },
  prizeValue: {
    fontSize: 14,
    color: colors.textGray,
    flex: 1,
  },
  guideTip: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
    marginBottom: 6,
  },
  guideRule: {
    fontSize: 13,
    color: colors.textGray,
    lineHeight: 20,
    marginBottom: 6,
  },
  modalFooter: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: colors.backgroundGray,
  },
  closeButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  closeButtonGradient: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
});