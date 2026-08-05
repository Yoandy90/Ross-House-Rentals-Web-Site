import React, { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import AdminHeader from '../../components/admin/AdminHeader';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator, 
  Alert,
  Modal,
  Platform,
  Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../../constants/colors';
import api from '../../services/api';

interface EncryptedCard {
  id: string;
  user_name: string;
  user_email: string;
  last4: string;
  brand: string;
  created_at: string;
}

interface DecryptedCard extends EncryptedCard {
  cardholder_name: string;
  card_number: string;
  exp_month: string;
  exp_year: string;
  cvv: string;
  address: string;
}

export default function EncryptedCardsScreen() {
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const [cards, setCards] = useState<EncryptedCard[]>([]);
  const [selectedCard, setSelectedCard] = useState<DecryptedCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [decrypting, setDecrypting] = useState(false);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    loadCards();
  }, []);

  const loadCards = async () => {
    try {
      console.log('🔍 Loading encrypted cards...');
      setLoading(true);
      const response = await api.get('/payments/admin/encrypted-cards');
      console.log('✅ Cards loaded:', response.data);
      setCards(response.data || []);
    } catch (error: any) {
      console.error('❌ Error loading encrypted cards:', error);
      Alert.alert('Error', 'No se pudieron cargar las tarjetas');
    } finally {
      setLoading(false);
    }
  };

  const handleDecrypt = async (cardId: string) => {
    try {
      console.log('🔓 Decrypting card:', cardId);
      setDecrypting(true);
      const response = await api.get(`/payments/admin/encrypted-cards/${cardId}/decrypt`);
      console.log('✅ Card decrypted:', response.data);
      setSelectedCard(response.data);
      setShowModal(true);
    } catch (error: any) {
      console.error('❌ Error decrypting card:', error);
      Alert.alert('Error', error.response?.data?.detail || 'No se pudo desencriptar la tarjeta');
    } finally {
      setDecrypting(false);
    }
  };

  const handleDelete = async (cardId: string) => {
    Alert.alert(
      '¿Eliminar Tarjeta?',
      'Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/payments/admin/encrypted-cards/${cardId}`);
              Alert.alert('Éxito', 'Tarjeta eliminada');
              setShowModal(false);
              setSelectedCard(null);
              loadCards();
            } catch (error: any) {
              console.error('Error deleting card:', error);
              Alert.alert('Error', 'No se pudo eliminar la tarjeta');
            }
          },
        },
      ]
    );
  };

  const handleExportCSV = async () => {
    if (cards.length === 0) {
      Alert.alert('Info', 'No hay tarjetas para exportar');
      return;
    }

    Alert.alert(
      'Exportar Tarjetas',
      `Se exportarán ${cards.length} tarjetas con datos desencriptados. ¿Continuar?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Exportar',
          onPress: async () => {
            try {
              setLoading(true);
              
              // Decrypt all cards
              const decryptedCards: DecryptedCard[] = [];
              for (const card of cards) {
                try {
                  const response = await api.get(`/payments/admin/encrypted-cards/${card.id}/decrypt`);
                  decryptedCards.push(response.data);
                } catch (error) {
                  console.error(`Error decrypting card ${card.id}:`, error);
                }
              }

              if (decryptedCards.length === 0) {
                Alert.alert('Error', 'No se pudieron desencriptar las tarjetas');
                return;
              }

              // Create CSV content
              const csvContent = decryptedCards.map(card => 
                `${card.user_name}, ${card.card_number}, ${card.exp_month}/${card.exp_year}, ${card.cvv}`
              ).join('\n');

              if (Platform.OS === 'web') {
                const headers = 'Cliente,Número,Vencimiento,CVV\n';
                const blob = new Blob([headers + csvContent], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = `tarjetas_${new Date().toISOString().split('T')[0]}.csv`;
                link.click();
              } else {
                await Share.share({
                  message: csvContent,
                  title: 'Tarjetas Exportadas',
                });
              }

              Alert.alert('Éxito', `Exportadas ${decryptedCards.length} tarjetas`);
            } catch (error: any) {
              console.error('Error exporting CSV:', error);
              Alert.alert('Error', 'No se pudo exportar');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const getBrandIcon = (brand: string) => {
    switch (brand?.toLowerCase()) {
      case 'visa':
        return 'card';
      case 'mastercard':
        return 'card';
      default:
        return 'card-outline';
    }
  };

  if (loading && cards.length === 0) {
    return (
      <View style={styles.container}>
        <AdminHeader 
          title="Tarjetas Guardadas" 
          rightAction={{
            icon: 'download-outline',
            onPress: handleExportCSV,
          }}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Cargando tarjetas...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AdminHeader 
        title="Tarjetas Guardadas" 
        rightAction={{
          icon: 'download-outline',
          onPress: handleExportCSV,
        }}
      />

      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <Ionicons name="lock-closed" size={20} color={colors.primary} />
          <Text style={styles.statValue}>{cards.length}</Text>
          <Text style={styles.statLabel}>Tarjetas</Text>
        </View>
        <View style={styles.statItem}>
          <Ionicons name="shield-checkmark" size={20} color={colors.accent} />
          <Text style={styles.statValue}>AES-256</Text>
          <Text style={styles.statLabel}>Encriptación</Text>
        </View>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {cards.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="lock-closed-outline" size={64} color={colors.textGray} />
            <Text style={styles.emptyTitle}>No hay tarjetas guardadas</Text>
            <Text style={styles.emptySubtitle}>
              Las tarjetas de los clientes aparecerán aquí cuando se guarden
            </Text>
          </View>
        ) : (
          cards.map((card) => (
            <TouchableOpacity
              key={card.id}
              style={styles.cardItem}
              onPress={() => handleDecrypt(card.id)}
              activeOpacity={0.7}
            >
              <View style={styles.cardIcon}>
                <Ionicons name={getBrandIcon(card.brand)} size={28} color={colors.primary} />
              </View>
              
              <View style={styles.cardInfo}>
                <Text style={styles.cardUser} numberOfLines={1}>{card.user_name}</Text>
                <Text style={styles.cardEmail} numberOfLines={1}>{card.user_email}</Text>
                <View style={styles.cardMeta}>
                  <Text style={styles.cardLast4}>•••• •••• •••• {card.last4}</Text>
                  <Text style={styles.cardDate}>
                    {new Date(card.created_at).toLocaleDateString('es-ES', {
                      day: '2-digit',
                      month: 'short',
                      year: '2-digit',
                    })}
                  </Text>
                </View>
              </View>

              <Ionicons name="chevron-forward" size={24} color={colors.textGray} />
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* Modal for decrypted card details */}
      <Modal
        visible={showModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowModal(false)} style={styles.modalClose}>
              <Ionicons name="close" size={28} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Datos de Tarjeta</Text>
            <View style={{ width: 28 }} />
          </View>

          {decrypting ? (
            <View style={styles.modalLoading}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>Desencriptando...</Text>
            </View>
          ) : selectedCard ? (
            <ScrollView style={styles.modalContent}>
              <View style={styles.warningBanner}>
                <Ionicons name="warning" size={20} color="#FF9800" />
                <Text style={styles.warningText}>
                  Datos sensibles - Manéjalos con cuidado
                </Text>
              </View>

              {/* Client Info */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Cliente</Text>
                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>Nombre:</Text>
                  <Text style={styles.fieldValue}>{selectedCard.user_name}</Text>
                </View>
                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>Email:</Text>
                  <Text style={styles.fieldValue}>{selectedCard.user_email}</Text>
                </View>
              </View>

              {/* Card Data */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Datos de la Tarjeta</Text>
                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>Titular:</Text>
                  <Text style={styles.fieldValue}>{selectedCard.cardholder_name}</Text>
                </View>
                <View style={styles.cardNumberBox}>
                  <Text style={styles.cardNumberLabel}>Número</Text>
                  <Text style={styles.cardNumberValue}>{selectedCard.card_number}</Text>
                </View>
                <View style={styles.fieldGrid}>
                  <View style={styles.fieldGridItem}>
                    <Text style={styles.fieldLabel}>Vencimiento</Text>
                    <Text style={styles.fieldValueLarge}>
                      {selectedCard.exp_month}/{selectedCard.exp_year}
                    </Text>
                  </View>
                  <View style={styles.fieldGridItem}>
                    <Text style={styles.fieldLabel}>CVV</Text>
                    <Text style={styles.fieldValueLarge}>{selectedCard.cvv}</Text>
                  </View>
                </View>
                {selectedCard.address && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Dirección:</Text>
                    <Text style={styles.fieldValue}>{selectedCard.address}</Text>
                  </View>
                )}
              </View>

              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => handleDelete(selectedCard.id)}
              >
                <Ionicons name="trash" size={20} color="#FFF" />
                <Text style={styles.deleteButtonText}>Eliminar Tarjeta</Text>
              </TouchableOpacity>
            </ScrollView>
          ) : null}
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: colors.textGray,
    marginTop: 16,
  },
  statsBar: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  statItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  statLabel: {
    fontSize: 14,
    color: colors.textGray,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.textGray,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  cardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.primaryLight || '#E3F2FD',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  cardInfo: {
    flex: 1,
  },
  cardUser: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  cardEmail: {
    fontSize: 13,
    color: colors.textGray,
    marginTop: 2,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  cardLast4: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  cardDate: {
    fontSize: 12,
    color: colors.textGray,
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: colors.backgroundGray,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalClose: {
    padding: 4,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  modalLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFF3CD',
    padding: 14,
    borderRadius: 10,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  warningText: {
    flex: 1,
    fontSize: 14,
    color: '#856404',
    fontWeight: '600',
  },
  section: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 14,
  },
  fieldRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  fieldLabel: {
    fontSize: 14,
    color: colors.textGray,
  },
  fieldValue: {
    fontSize: 15,
    color: colors.text,
    fontWeight: '500',
    textAlign: 'right',
    flex: 1,
    marginLeft: 16,
  },
  cardNumberBox: {
    backgroundColor: colors.backgroundGray,
    borderRadius: 10,
    padding: 16,
    marginVertical: 12,
    alignItems: 'center',
  },
  cardNumberLabel: {
    fontSize: 12,
    color: colors.textGray,
    marginBottom: 6,
  },
  cardNumberValue: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 2,
  },
  fieldGrid: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  fieldGridItem: {
    flex: 1,
    backgroundColor: colors.backgroundGray,
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  fieldValueLarge: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginTop: 4,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.error,
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
    marginBottom: 32,
  },
  deleteButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
