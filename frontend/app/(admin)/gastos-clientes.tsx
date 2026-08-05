import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Image,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import api from '../../services/api';

interface Receipt {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  has_image: boolean;
  category: string;
  merchant: string;
  amount: number;
  receipt_date: string;
  status: string;
  notes: string | null;
  admin_notes: string | null;
  ai_confidence: number;
  created_at: string;
  year: number;
  month: number;
  image_url?: string;
}

interface ClientSummary {
  user_id: string;
  user_name: string;
  user_email: string;
  total_amount: number;
  receipt_count: number;
  categories: { [key: string]: number };
  receipts: Receipt[];
}

const CATEGORY_COLORS: { [key: string]: string } = {
  'Gastos de Negocio': '#3B82F6',
  'Oficina/Suministros': '#8B5CF6',
  'Gastos Médicos': '#EF4444',
  'Educación': '#10B981',
  'Donaciones': '#F59E0B',
  'Transporte': '#6366F1',
  'Alimentación': '#EC4899',
  'Servicios': '#14B8A6',
  'Otros': '#6B7280',
};

const YEARS = [2024, 2025, 2026];

export default function GastosClientesScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [selectedYear, setSelectedYear] = useState(2026);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClient, setSelectedClient] = useState<ClientSummary | null>(null);
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);

  useEffect(() => {
    loadReceipts();
  }, [selectedYear]);

  const loadReceipts = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/admin/receipts?year=${selectedYear}`);
      setReceipts(response.data.receipts || []);
    } catch (error) {
      console.error('Error loading receipts:', error);
      Alert.alert('Error', 'No se pudieron cargar los gastos');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadReceipts();
  };

  // Group receipts by client
  const clientSummaries = useMemo(() => {
    const summaries: { [key: string]: ClientSummary } = {};
    
    receipts.forEach(receipt => {
      if (!summaries[receipt.user_id]) {
        summaries[receipt.user_id] = {
          user_id: receipt.user_id,
          user_name: receipt.user_name || 'Cliente',
          user_email: receipt.user_email || '',
          total_amount: 0,
          receipt_count: 0,
          categories: {},
          receipts: [],
        };
      }
      
      summaries[receipt.user_id].total_amount += receipt.amount || 0;
      summaries[receipt.user_id].receipt_count += 1;
      summaries[receipt.user_id].receipts.push(receipt);
      
      const category = receipt.category || 'Otros';
      if (!summaries[receipt.user_id].categories[category]) {
        summaries[receipt.user_id].categories[category] = 0;
      }
      summaries[receipt.user_id].categories[category] += receipt.amount || 0;
    });

    return Object.values(summaries).sort((a, b) => b.total_amount - a.total_amount);
  }, [receipts]);

  // Filter by search
  const filteredClients = useMemo(() => {
    if (!searchQuery) return clientSummaries;
    const query = searchQuery.toLowerCase();
    return clientSummaries.filter(client => 
      client.user_name.toLowerCase().includes(query) ||
      client.user_email.toLowerCase().includes(query)
    );
  }, [clientSummaries, searchQuery]);

  const totalAmount = useMemo(() => {
    return clientSummaries.reduce((sum, client) => sum + client.total_amount, 0);
  }, [clientSummaries]);

  const totalReceipts = useMemo(() => {
    return clientSummaries.reduce((sum, client) => sum + client.receipt_count, 0);
  }, [clientSummaries]);

  const formatCurrency = (amount: number) => {
    return `$${amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const renderReceiptModal = () => (
    <Modal
      visible={showReceiptModal}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowReceiptModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Detalle del Recibo</Text>
            <TouchableOpacity onPress={() => setShowReceiptModal(false)}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>
          
          {selectedReceipt && (
            <ScrollView style={styles.modalBody}>
              {selectedReceipt.has_image && selectedReceipt.image_url && (
                <Image
                  source={{ uri: selectedReceipt.image_url }}
                  style={styles.receiptImage}
                  resizeMode="contain"
                />
              )}
              
              <View style={styles.receiptDetail}>
                <Text style={styles.detailLabel}>Comercio</Text>
                <Text style={styles.detailValue}>{selectedReceipt.merchant || 'No especificado'}</Text>
              </View>
              
              <View style={styles.receiptDetail}>
                <Text style={styles.detailLabel}>Monto</Text>
                <Text style={[styles.detailValue, styles.amountText]}>
                  {formatCurrency(selectedReceipt.amount)}
                </Text>
              </View>
              
              <View style={styles.receiptDetail}>
                <Text style={styles.detailLabel}>Categoría</Text>
                <View style={[styles.categoryBadge, { backgroundColor: CATEGORY_COLORS[selectedReceipt.category] || '#6B7280' }]}>
                  <Text style={styles.categoryBadgeText}>{selectedReceipt.category}</Text>
                </View>
              </View>
              
              <View style={styles.receiptDetail}>
                <Text style={styles.detailLabel}>Fecha del Recibo</Text>
                <Text style={styles.detailValue}>{formatDate(selectedReceipt.receipt_date)}</Text>
              </View>
              
              <View style={styles.receiptDetail}>
                <Text style={styles.detailLabel}>Confianza IA</Text>
                <Text style={styles.detailValue}>{Math.round(selectedReceipt.ai_confidence * 100)}%</Text>
              </View>
              
              <View style={styles.receiptDetail}>
                <Text style={styles.detailLabel}>Estado</Text>
                <Text style={styles.detailValue}>{selectedReceipt.status}</Text>
              </View>
              
              {selectedReceipt.notes && (
                <View style={styles.receiptDetail}>
                  <Text style={styles.detailLabel}>Notas del Cliente</Text>
                  <Text style={styles.detailValue}>{selectedReceipt.notes}</Text>
                </View>
              )}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );

  const renderClientDetail = () => (
    <Modal
      visible={!!selectedClient}
      animationType="slide"
      transparent={false}
      onRequestClose={() => setSelectedClient(null)}
    >
      <View style={styles.detailContainer}>
        <LinearGradient colors={['#1a1a2e', '#16213e']} style={styles.detailHeader}>
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={() => setSelectedClient(null)}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.detailHeaderContent}>
            <Text style={styles.detailClientName}>{selectedClient?.user_name}</Text>
            <Text style={styles.detailClientEmail}>{selectedClient?.user_email}</Text>
          </View>
        </LinearGradient>
        
        {selectedClient && (
          <ScrollView style={styles.detailBody}>
            {/* Summary Card */}
            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Total Gastos</Text>
                  <Text style={styles.summaryAmount}>{formatCurrency(selectedClient.total_amount)}</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Recibos</Text>
                  <Text style={styles.summaryCount}>{selectedClient.receipt_count}</Text>
                </View>
              </View>
            </View>
            
            {/* Categories Breakdown */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>📊 Gastos por Categoría</Text>
              {Object.entries(selectedClient.categories)
                .sort(([,a], [,b]) => b - a)
                .map(([category, amount]) => (
                  <View key={category} style={styles.categoryRow}>
                    <View style={styles.categoryInfo}>
                      <View style={[styles.categoryDot, { backgroundColor: CATEGORY_COLORS[category] || '#6B7280' }]} />
                      <Text style={styles.categoryName}>{category}</Text>
                    </View>
                    <Text style={styles.categoryAmount}>{formatCurrency(amount)}</Text>
                  </View>
                ))}
            </View>
            
            {/* Receipts List */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>🧾 Recibos ({selectedClient.receipts.length})</Text>
              {selectedClient.receipts
                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                .map(receipt => (
                  <TouchableOpacity 
                    key={receipt.id} 
                    style={styles.receiptRow}
                    onPress={() => {
                      setSelectedReceipt(receipt);
                      setShowReceiptModal(true);
                    }}
                  >
                    <View style={styles.receiptInfo}>
                      <View style={[styles.categoryDot, { backgroundColor: CATEGORY_COLORS[receipt.category] || '#6B7280' }]} />
                      <View style={styles.receiptText}>
                        <Text style={styles.receiptMerchant}>{receipt.merchant || 'Sin comercio'}</Text>
                        <Text style={styles.receiptCategory}>{receipt.category}</Text>
                        <Text style={styles.receiptDate}>{formatDate(receipt.receipt_date)}</Text>
                      </View>
                    </View>
                    <View style={styles.receiptAmountContainer}>
                      <Text style={styles.receiptAmount}>{formatCurrency(receipt.amount)}</Text>
                      <Ionicons name="chevron-forward" size={16} color="#999" />
                    </View>
                  </TouchableOpacity>
                ))}
            </View>
          </ScrollView>
        )}
      </View>
      {renderReceiptModal()}
    </Modal>
  );

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6C1110" />
        <Text style={styles.loadingText}>Cargando gastos...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#1a1a2e', '#16213e']} style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Gastos de Clientes</Text>
          <Text style={styles.headerSubtitle}>{filteredClients.length} clientes con recibos</Text>
        </View>
      </LinearGradient>

      {/* Year Selector */}
      <View style={styles.yearSelector}>
        {YEARS.map(year => (
          <TouchableOpacity
            key={year}
            style={[styles.yearButton, selectedYear === year && styles.yearButtonActive]}
            onPress={() => setSelectedYear(year)}
          >
            <Text style={[styles.yearButtonText, selectedYear === year && styles.yearButtonTextActive]}>
              {year}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Stats Card */}
      <View style={styles.statsCard}>
        <View style={styles.statItem}>
          <Text style={styles.statAmount}>{formatCurrency(totalAmount)}</Text>
          <Text style={styles.statLabel}>Total {selectedYear}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statCount}>{totalReceipts}</Text>
          <Text style={styles.statLabel}>Recibos</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statCount}>{filteredClients.length}</Text>
          <Text style={styles.statLabel}>Clientes</Text>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#999" />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar cliente..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#999"
        />
        {searchQuery ? (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color="#999" />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Client List */}
      <ScrollView
        style={styles.clientList}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#6C1110']} />
        }
      >
        {filteredClients.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="receipt-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>No hay gastos registrados</Text>
            <Text style={styles.emptySubtext}>Los clientes aún no han subido recibos en {selectedYear}</Text>
          </View>
        ) : (
          filteredClients.map(client => (
            <TouchableOpacity
              key={client.user_id}
              style={styles.clientCard}
              onPress={() => setSelectedClient(client)}
            >
              <View style={styles.clientHeader}>
                <View style={styles.clientAvatar}>
                  <Text style={styles.clientInitial}>
                    {client.user_name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.clientInfo}>
                  <Text style={styles.clientName}>{client.user_name}</Text>
                  <Text style={styles.clientEmail}>{client.user_email}</Text>
                </View>
                <View style={styles.clientTotal}>
                  <Text style={styles.clientAmount}>{formatCurrency(client.total_amount)}</Text>
                  <Text style={styles.clientReceipts}>{client.receipt_count} recibos</Text>
                </View>
              </View>
              
              {/* Categories Preview */}
              <View style={styles.categoriesPreview}>
                {Object.entries(client.categories)
                  .sort(([,a], [,b]) => b - a)
                  .slice(0, 3)
                  .map(([category, amount]) => (
                    <View key={category} style={styles.categoryPreviewItem}>
                      <View style={[styles.categoryDot, { backgroundColor: CATEGORY_COLORS[category] || '#6B7280' }]} />
                      <Text style={styles.categoryPreviewText}>{category}</Text>
                      <Text style={styles.categoryPreviewAmount}>{formatCurrency(amount)}</Text>
                    </View>
                  ))}
                {Object.keys(client.categories).length > 3 && (
                  <Text style={styles.moreCategories}>
                    +{Object.keys(client.categories).length - 3} más
                  </Text>
                )}
              </View>
              
              <View style={styles.viewDetail}>
                <Text style={styles.viewDetailText}>Ver detalle</Text>
                <Ionicons name="chevron-forward" size={16} color="#6C1110" />
              </View>
            </TouchableOpacity>
          ))
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      {renderClientDetail()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 12,
    color: '#666',
    fontSize: 16,
  },
  header: {
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    padding: 8,
    marginRight: 12,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 4,
  },
  yearSelector: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 8,
  },
  yearButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#e0e0e0',
  },
  yearButtonActive: {
    backgroundColor: '#6C1110',
  },
  yearButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  yearButtonTextActive: {
    color: '#fff',
  },
  statsCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: 20,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: '#e0e0e0',
  },
  statAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#6C1110',
  },
  statCount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginTop: 12,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    color: '#333',
  },
  clientList: {
    flex: 1,
    paddingTop: 12,
  },
  clientCard: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  clientHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  clientAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#6C1110',
    justifyContent: 'center',
    alignItems: 'center',
  },
  clientInitial: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  clientInfo: {
    flex: 1,
    marginLeft: 12,
  },
  clientName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  clientEmail: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  clientTotal: {
    alignItems: 'flex-end',
  },
  clientAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#10B981',
  },
  clientReceipts: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  categoriesPreview: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  categoryPreviewItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  categoryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  categoryPreviewText: {
    flex: 1,
    fontSize: 14,
    color: '#555',
  },
  categoryPreviewAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  moreCategories: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  viewDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  viewDetailText: {
    fontSize: 14,
    color: '#6C1110',
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  // Detail Modal Styles
  detailContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  detailHeader: {
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailHeaderContent: {
    flex: 1,
  },
  detailClientName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
  },
  detailClientEmail: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 4,
  },
  detailBody: {
    flex: 1,
    padding: 20,
  },
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  summaryAmount: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#10B981',
  },
  summaryCount: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
  },
  sectionCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  categoryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryName: {
    fontSize: 15,
    color: '#333',
  },
  categoryAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  receiptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  receiptInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  receiptText: {
    flex: 1,
  },
  receiptMerchant: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333',
  },
  receiptCategory: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  receiptDate: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  receiptAmountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  receiptAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#10B981',
    marginRight: 8,
  },
  // Receipt Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  modalBody: {
    padding: 20,
  },
  receiptImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginBottom: 20,
    backgroundColor: '#f0f0f0',
  },
  receiptDetail: {
    marginBottom: 16,
  },
  detailLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 16,
    color: '#333',
  },
  amountText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#10B981',
  },
  categoryBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: 'flex-start',
  },
  categoryBadgeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
});
