import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  Platform,
  RefreshControl,
  Image,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import ImageCarousel from '../../components/ImageCarousel';
import { useThemeColors } from '../../constants/colors';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import { useGamblingEnabled } from '../../hooks/useGamblingEnabled';
import { useRouter } from 'expo-router';

interface Raffle {
  id: string;
  title: string;
  description: string;
  prize_type: 'service' | 'credits' | 'discount' | 'product';
  prize_value: string;
  prize_credits?: number;
  ticket_price: number;
  max_tickets_per_user: number;
  total_tickets?: number;
  tickets_sold: number;
  tickets_remaining?: number;
  participants_count: number;
  status: 'draft' | 'active' | 'full' | 'completed' | 'cancelled';
  end_date: string;
  winner_id?: string;
  winner_name?: string;
  image_url?: string;
  images?: string[];  // Array de URLs de imágenes
}

interface UserTicket {
  id: string;
  raffle_id: string;
  raffle_title: string;
  ticket_number: string;
  purchased_at: string;
  cost: number;
}

export default function RafflesScreen() {
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const { t } = useTranslation();
  const { user } = useAuth();
  const router = useRouter();
  const { loading: flagsLoading, enabled: gamblingEnabled } = useGamblingEnabled();
  const [raffles, setRaffles] = useState<Raffle[]>([]);
  const [myTickets, setMyTickets] = useState<UserTicket[]>([]);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedRaffle, setSelectedRaffle] = useState<Raffle | null>(null);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [quantity, setQuantity] = useState('1');
  const [purchasing, setPurchasing] = useState(false);
  
  // Image viewer state
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [selectedImages, setSelectedImages] = useState<{ uri: string }[]>([]);
  const [initialImageIndex, setInitialImageIndex] = useState(0);

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
        loadRaffles(),
        loadMyTickets(),
        loadBalance(),
      ]);
    } catch (error) {
      console.error('Error loading raffle data:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const loadRaffles = async () => {
    try {
      const response = await api.get('/raffles');
      setRaffles(response.data.raffles || []);
    } catch (error: any) {
      console.error('Error loading raffles:', error);
      if (Platform.OS === 'web') {
        Alert.alert('Aviso', 'Error al cargar sorteos');
      } else {
        Alert.alert(t('common.error', 'Error'), t('raffles.loadError', 'No se pudieron cargar los sorteos'));
      }
    }
  };

  const loadMyTickets = async () => {
    try {
      const response = await api.get('/raffles/my-tickets');
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

  const handleBuyTickets = (raffle: Raffle) => {
    setSelectedRaffle(raffle);
    setQuantity('1');
    setShowPurchaseModal(true);
  };

  const confirmPurchase = async () => {
    if (!selectedRaffle) return;

    const qty = parseInt(quantity);
    if (isNaN(qty) || qty < 1) {
      if (Platform.OS === 'web') {
        Alert.alert('Aviso', 'Por favor ingresa una cantidad válida');
      } else {
        Alert.alert(t('common.error', 'Error'), t('raffles.invalidQty', 'Por favor ingresa una cantidad válida'));
      }
      return;
    }

    const totalCost = selectedRaffle.ticket_price * qty;
    if (totalCost > balance) {
      if (Platform.OS === 'web') {
        Alert.alert('Aviso', `Saldo insuficiente. Necesitas ${totalCost} créditos pero solo tienes ${balance}`);
      } else {
        Alert.alert('Saldo Insuficiente', `Necesitas ${totalCost} créditos pero solo tienes ${balance}`);
      }
      return;
    }

    if (qty > selectedRaffle.max_tickets_per_user) {
      if (Platform.OS === 'web') {
        Alert.alert('Aviso', `Máximo ${selectedRaffle.max_tickets_per_user} boletos por persona`);
      } else {
        Alert.alert('Límite Excedido', `Máximo ${selectedRaffle.max_tickets_per_user} boletos por persona`);
      }
      return;
    }

    try {
      setPurchasing(true);
      const response = await api.post(`/raffles/${selectedRaffle.id}/buy`, {
        raffle_id: selectedRaffle.id,
        quantity: qty,
      });

      if (response.data.success) {
        setShowPurchaseModal(false);
        if (Platform.OS === 'web') {
          Alert.alert('Aviso', `¡Éxito! Compraste ${qty} boleto(s). Nuevo saldo: ${response.data.new_balance} créditos`);
        } else {
          Alert.alert('¡Éxito!', `Compraste ${qty} boleto(s). Nuevo saldo: ${response.data.new_balance} créditos`);
        }
        await loadData();
      }
    } catch (error: any) {
      console.error('Error purchasing tickets:', error);
      const message = error.response?.data?.detail || 'No se pudo completar la compra';
      if (Platform.OS === 'web') {
        Alert.alert('Aviso', `Error: ${message}`);
      } else {
        Alert.alert('Error', message);
      }
    } finally {
      setPurchasing(false);
    }
  };

  const openImageViewer = (raffle: Raffle) => {
    // Construir array de imágenes: primero la imagen principal, luego las adicionales
    const images: { uri: string }[] = [];
    
    // Agregar imagen principal si existe
    if (raffle.image_url) {
      images.push({ uri: raffle.image_url });
    }
    
    // Agregar imágenes adicionales si existen
    if (raffle.images && raffle.images.length > 0) {
      raffle.images.forEach(img => {
        // Evitar duplicados
        if (img !== raffle.image_url) {
          images.push({ uri: img });
        }
      });
    }
    
    // Solo abrir el visor si hay imágenes
    if (images.length > 0) {
      setSelectedImages(images);
      setInitialImageIndex(0);
      setImageViewerVisible(true);
    }
  };

  const getPrizeIcon = (prizeType: string) => {
    switch (prizeType) {
      case 'credits': return 'wallet';
      case 'service': return 'briefcase';
      case 'discount': return 'pricetag';
      case 'product': return 'gift';
      default: return 'gift';
    }
  };

  const getPrizeGradient = (prizeType: string): [string, string] => {
    switch (prizeType) {
      case 'credits': 
        return ['#F59E0B', '#EF4444']; // Orange to Red (money colors)
      case 'service': 
        return ['#3B82F6', '#8B5CF6']; // Blue to Purple (professional)
      case 'discount': 
        return ['#10B981', '#059669']; // Green (savings)
      case 'product': 
        return ['#EC4899', '#F43F5E']; // Pink to Rose (gift colors)
      default: 
        return [colors.primary, colors.secondary];
    }
  };

  const getPrizeTypeLabel = (prizeType: string) => {
    switch (prizeType) {
      case 'credits': return '💰 Créditos';
      case 'service': return '📋 Servicio';
      case 'discount': return '🏷️ Descuento';
      case 'product': return '🎁 Producto';
      default: return 'Premio';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return colors.success;
      case 'full': return colors.warning;
      case 'completed': return colors.textGray;
      default: return colors.textGray;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active': return 'Activo';
      case 'full': return 'Agotado';
      case 'completed': return 'Finalizado';
      default: return status;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const getMyTicketsForRaffle = (raffleId: string) => {
    return myTickets.filter(t => t.raffle_id === raffleId);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Cargando sorteos...</Text>
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
            <Ionicons name="gift" size={28} color="#FFF" style={styles.headerIcon} />
            <View>
              <Text style={styles.modernHeaderTitle}>{t('games.raffles.title')}</Text>
              <Text style={styles.modernHeaderSubtitle}>{t('raffles.subtitle', 'Gana premios increíbles')}</Text>
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

        {/* My Tickets Section */}
        {myTickets.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🎟️ {t('games.raffles.myTickets')} ({myTickets.length})</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.ticketsScroll}>
              {myTickets.map((ticket) => {
                // Find the raffle for this ticket to get prize_type
                const ticketRaffle = raffles.find(r => r.id === ticket.raffle_id);
                const [gradientStart] = ticketRaffle ? getPrizeGradient(ticketRaffle.prize_type) : [colors.primary];
                
                return (
                  <View key={ticket.id} style={[styles.ticketCard, { borderLeftColor: gradientStart }]}>
                    <View style={styles.ticketHeader}>
                      <View style={[styles.ticketIconBadge, { backgroundColor: gradientStart }]}>
                        <Ionicons 
                          name={ticketRaffle ? getPrizeIcon(ticketRaffle.prize_type) : 'ticket'} 
                          size={16} 
                          color="#FFF" 
                        />
                      </View>
                      <Text style={[styles.ticketNumber, { color: gradientStart }]}>#{ticket.ticket_number}</Text>
                    </View>
                    <Text style={styles.ticketRaffle} numberOfLines={2}>{ticket.raffle_title}</Text>
                    <View style={styles.ticketFooter}>
                      <Ionicons name="calendar-outline" size={12} color={colors.textGray} />
                      <Text style={styles.ticketDate}>{formatDate(ticket.purchased_at)}</Text>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Active Raffles */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>✨ {t('games.raffles.activeRaffles')}</Text>
          
          {raffles.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="gift-outline" size={64} color={colors.textGray} />
              <Text style={styles.emptyStateText}>{t('raffles.noRaffles', 'No hay sorteos activos en este momento')}</Text>
              <Text style={styles.emptyStateSubtext}>{t('raffles.noRafflesHint', 'Vuelve pronto para ver nuevos sorteos')}</Text>
            </View>
          ) : (
            raffles.map((raffle) => {
              const userTickets = getMyTicketsForRaffle(raffle.id);
              const hasTickets = userTickets.length > 0;
              const [gradientStart, gradientEnd] = getPrizeGradient(raffle.prize_type);
              
              return (
                <View key={raffle.id} style={styles.raffleCard}>
                  <LinearGradient
                    colors={[gradientStart, gradientEnd]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.raffleCardHeader}
                  >
                    {/* Prize Type Badge */}
                    <View style={styles.prizeTypeBadge}>
                      <Text style={styles.prizeTypeText}>{getPrizeTypeLabel(raffle.prize_type)}</Text>
                    </View>
                    
                    <View style={styles.raffleHeaderContent}>
                      <View style={styles.prizeIconContainer}>
                        <Ionicons name={getPrizeIcon(raffle.prize_type)} size={40} color="#FFF" />
                      </View>
                      <View style={styles.raffleHeaderText}>
                        <Text style={styles.raffleTitle}>{raffle.title}</Text>
                        <Text style={styles.rafflePrize}>🏆 {raffle.prize_value}</Text>
                      </View>
                    </View>
                    
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(raffle.status) }]}>
                      <Text style={styles.statusText}>{getStatusText(raffle.status)}</Text>
                    </View>
                  </LinearGradient>

                  {/* Prize Image */}
                  {raffle.image_url && raffle.prize_type === 'product' && (
                    <TouchableOpacity 
                      style={styles.prizeImageContainer}
                      onPress={() => openImageViewer(raffle)}
                      activeOpacity={0.9}
                    >
                      <Image
                        source={{ uri: raffle.image_url }}
                        style={styles.prizeImage}
                        resizeMode="cover"
                      />
                      <LinearGradient
                        colors={['transparent', 'rgba(0,0,0,0.3)']}
                        style={styles.imageOverlay}
                      />
                      {/* Indicador de múltiples fotos */}
                      {((raffle.images && raffle.images.length > 0) || raffle.image_url) && (
                        <View style={styles.imageCountBadge}>
                          <Ionicons name="images" size={16} color="#FFF" />
                          <Text style={styles.imageCountText}>
                            {(raffle.images?.length || 0) + (raffle.image_url ? 1 : 0)}
                          </Text>
                        </View>
                      )}
                      {/* Indicador de "tap to view" */}
                      <View style={styles.tapToViewBadge}>
                        <Ionicons name="expand" size={14} color="#FFF" />
                        <Text style={styles.tapToViewText}>{t('raffles.viewPhotos', 'Ver fotos')}</Text>
                      </View>
                    </TouchableOpacity>
                  )}

                  <View style={styles.raffleCardBody}>
                    <Text style={styles.raffleDescription}>{raffle.description}</Text>

                    <View style={styles.raffleStats}>
                      <View style={styles.statItem}>
                        <Ionicons name="people" size={16} color={colors.accent} />
                        <Text style={styles.statText}>{raffle.participants_count} participantes</Text>
                      </View>
                      <View style={styles.statItem}>
                        <Ionicons name="ticket" size={16} color={colors.accent} />
                        <Text style={styles.statText}>
                          {raffle.tickets_sold}/{raffle.total_tickets || '∞'} boletos
                        </Text>
                      </View>
                    </View>

                    {raffle.tickets_remaining !== null && (
                      <View style={styles.progressBarContainer}>
                        <View style={styles.progressBarBg}>
                          <View
                            style={[
                              styles.progressBarFill,
                              {
                                width: `${raffle.total_tickets ? (raffle.tickets_sold / raffle.total_tickets) * 100 : 0}%`,
                              },
                            ]}
                          />
                        </View>
                        <Text style={styles.progressText}>
                          {raffle.tickets_remaining} boletos disponibles
                        </Text>
                      </View>
                    )}

                    <View style={styles.raffleFooter}>
                      <View style={styles.priceInfo}>
                        <Ionicons name="pricetag" size={18} color={colors.primary} />
                        <Text style={styles.priceText}>{raffle.ticket_price} créditos/boleto</Text>
                      </View>
                      <Text style={styles.endDate}>Termina: {formatDate(raffle.end_date)}</Text>
                    </View>

                    {hasTickets && (
                      <View style={styles.myTicketsInfo}>
                        <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                        <Text style={styles.myTicketsText}>
                          Tienes {userTickets.length} boleto(s) para este sorteo
                        </Text>
                      </View>
                    )}

                    {raffle.status === 'active' && (
                      <TouchableOpacity
                        style={styles.buyButton}
                        onPress={() => handleBuyTickets(raffle)}
                        activeOpacity={0.8}
                      >
                        <LinearGradient
                          colors={[colors.primary, colors.secondary]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={styles.buyButtonGradient}
                        >
                          <Ionicons name="cart" size={20} color="#FFF" />
                          <Text style={styles.buyButtonText}>{t('games.raffles.buyTickets')}</Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    )}

                    {raffle.status === 'completed' && raffle.winner_name && (
                      <View style={styles.winnerInfo}>
                        <Ionicons name="trophy" size={20} color="#FFD700" />
                        <Text style={styles.winnerText}>Ganador: {raffle.winner_name}</Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Purchase Modal */}
      <Modal
        visible={showPurchaseModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setShowPurchaseModal(false);
        }}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <TouchableOpacity 
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => {
              setShowPurchaseModal(false);
            }}
          >
            <TouchableOpacity 
              activeOpacity={1}
              onPress={(e) => e.stopPropagation()}
            >
              <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Comprar Boletos</Text>
                <TouchableOpacity onPress={() => setShowPurchaseModal(false)}>
                  <Ionicons name="close" size={24} color={colors.text} />
                </TouchableOpacity>
              </View>

            {selectedRaffle && (
              <>
                <View style={styles.modalBody}>
                  <Text style={styles.modalRaffleTitle}>{selectedRaffle.title}</Text>
                  <Text style={styles.modalRafflePrize}>Premio: {selectedRaffle.prize_value}</Text>

                  <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>{t('raffles.ticketQty', 'Cantidad de boletos')}</Text>
                    <TextInput
                      style={styles.input}
                      value={quantity}
                      onChangeText={setQuantity}
                      keyboardType="number-pad"
                      placeholder="1"
                      maxLength={3}
                    />
                    <Text style={styles.inputHint}>
                      Máximo: {selectedRaffle.max_tickets_per_user} boletos por persona
                    </Text>
                  </View>

                  <View style={styles.costSummary}>
                    <View style={styles.costRow}>
                      <Text style={styles.costLabel}>Precio por boleto:</Text>
                      <Text style={styles.costValue}>{selectedRaffle.ticket_price} créditos</Text>
                    </View>
                    <View style={styles.costRow}>
                      <Text style={styles.costLabel}>Cantidad:</Text>
                      <Text style={styles.costValue}>{quantity || 0}</Text>
                    </View>
                    <View style={[styles.costRow, styles.costTotal]}>
                      <Text style={styles.costTotalLabel}>Total:</Text>
                      <Text style={styles.costTotalValue}>
                        {selectedRaffle.ticket_price * (parseInt(quantity) || 0)} créditos
                      </Text>
                    </View>
                    <View style={styles.costRow}>
                      <Text style={styles.costLabel}>Tu saldo:</Text>
                      <Text style={[styles.costValue, balance < selectedRaffle.ticket_price * (parseInt(quantity) || 0) && styles.insufficientBalance]}>
                        {balance} créditos
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.modalFooter}>
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => setShowPurchaseModal(false)}
                  >
                    <Text style={styles.cancelButtonText}>{t('raffles.cancel', 'Cancelar')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.confirmButton}
                    onPress={confirmPurchase}
                    disabled={purchasing}
                  >
                    <LinearGradient
                      colors={[colors.primary, colors.secondary]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.confirmButtonGradient}
                    >
                      {purchasing ? (
                        <ActivityIndicator size="small" color="#FFF" />
                      ) : (
                        <>
                          <Ionicons name="checkmark-circle" size={20} color="#FFF" />
                          <Text style={styles.confirmButtonText}>Confirmar Compra</Text>
                        </>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </>
            )}
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      {/* Image Carousel Modal */}
      <ImageCarousel
        images={selectedImages}
        visible={imageViewerVisible}
        initialIndex={initialImageIndex}
        onClose={() => setImageViewerVisible(false)}
      />
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
    gap: 0,
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
    alignSelf: 'center',
    gap: 6,
  },
  headerBalanceText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 14,
    color: colors.textGray,
    marginTop: 2,
  },
  balanceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  balanceText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
  },
  ticketsScroll: {
    gap: 12,
    paddingRight: 16,
  },
  ticketCard: {
    backgroundColor: colors.background,
    padding: 16,
    borderRadius: 12,
    width: 160,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  ticketHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  ticketIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ticketNumber: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.primary,
  },
  ticketRaffle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  ticketFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ticketDate: {
    fontSize: 11,
    color: colors.textGray,
  },
  emptyState: {
    alignItems: 'center',
    padding: 48,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginTop: 16,
    textAlign: 'center',
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: colors.textGray,
    marginTop: 8,
    textAlign: 'center',
  },
  raffleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    marginBottom: 20,
    marginHorizontal: 2,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 6,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  raffleCardHeader: {
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  prizeTypeBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
    zIndex: 10,
  },
  prizeTypeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1F2937',
  },
  raffleHeaderContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  prizeIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  raffleHeaderText: {
    flex: 1,
  },
  raffleTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFF',
    marginBottom: 3,
  },
  rafflePrize: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.95)',
  },
  statusBadge: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFF',
  },
  raffleCardBody: {
    padding: 16,
    backgroundColor: '#FFFFFF',
  },
  raffleDescription: {
    fontSize: 13,
    color: colors.textGray,
    lineHeight: 18,
    marginBottom: 12,
  },
  raffleStats: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 10,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statText: {
    fontSize: 12,
    color: colors.text,
    fontWeight: '600',
  },
  progressBarContainer: {
    marginBottom: 12,
  },
  progressBarBg: {
    height: 8,
    backgroundColor: colors.backgroundGray,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.success,
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    color: colors.textGray,
    textAlign: 'center',
  },
  raffleFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.backgroundGray,
    marginBottom: 12,
  },
  priceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  priceText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primary,
  },
  endDate: {
    fontSize: 12,
    color: colors.textGray,
  },
  myTicketsInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.success + '15',
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  myTicketsText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.success,
  },
  buyButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  buyButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  buyButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  winnerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFD70015',
    padding: 12,
    borderRadius: 12,
  },
  winnerText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#B8860B',
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
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
  },
  modalBody: {
    padding: 20,
  },
  modalRaffleTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 6,
  },
  modalRafflePrize: {
    fontSize: 14,
    color: colors.textGray,
    marginBottom: 20,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: colors.backgroundGray,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.backgroundGray,
  },
  inputHint: {
    fontSize: 12,
    color: colors.textGray,
    marginTop: 6,
  },
  costSummary: {
    backgroundColor: colors.backgroundGray,
    borderRadius: 12,
    padding: 16,
    gap: 10,
  },
  costRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  costLabel: {
    fontSize: 14,
    color: colors.textGray,
  },
  costValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  costTotal: {
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.background,
    marginTop: 4,
  },
  costTotalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  costTotalValue: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.primary,
  },
  insufficientBalance: {
    color: colors.error,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: colors.backgroundGray,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: colors.backgroundGray,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
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
  // Prize Image Styles
  prizeImageContainer: {
    width: '100%',
    height: 200,
    position: 'relative',
  },
  prizeImage: {
    width: '100%',
    height: '100%',
  },
  imageOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
  },
  // Image gallery badges
  imageCountBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 20,
  },
  imageCountText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  tapToViewBadge: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(108, 17, 16, 0.9)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  tapToViewText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '600',
  },
});