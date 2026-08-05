/**
 * Admin Receipts Management Screen - Modern Design
 * View and manage client expense receipts with image preview
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  RefreshControl,
  FlatList,
  Modal,
  TextInput,
  Platform,
  Dimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import api from '../../services/api';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Receipt {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  has_image: boolean;
  image?: string;
  category: string | null;
  merchant: string | null;
  amount: number | null;
  receipt_date: string | null;
  status: string;
  notes: string | null;
  admin_notes: string | null;
  ai_confidence: number | null;
  created_at: string;
  reviewed_by: string | null;
  year: number;
  month: number;
}

const CATEGORIES = [
  'Gastos Médicos',
  'Comida/Restaurantes',
  'Transporte',
  'Oficina/Suministros',
  'Utilidades',
  'Vivienda',
  'Educación',
  'Donaciones',
  'Gastos de Negocio',
  'Otros',
];

const CATEGORY_CONFIG: Record<string, { icon: string; color: string; bg: string }> = {
  'Gastos Médicos': { icon: 'medkit', color: '#DC2626', bg: '#FEE2E2' },
  'Comida/Restaurantes': { icon: 'restaurant', color: '#EA580C', bg: '#FFEDD5' },
  'Transporte': { icon: 'car', color: '#2563EB', bg: '#DBEAFE' },
  'Oficina/Suministros': { icon: 'briefcase', color: '#7C3AED', bg: '#EDE9FE' },
  'Utilidades': { icon: 'flash', color: '#CA8A04', bg: '#FEF9C3' },
  'Vivienda': { icon: 'home', color: '#059669', bg: '#D1FAE5' },
  'Educación': { icon: 'school', color: '#0891B2', bg: '#CFFAFE' },
  'Donaciones': { icon: 'heart', color: '#DB2777', bg: '#FCE7F3' },
  'Gastos de Negocio': { icon: 'business', color: '#4F46E5', bg: '#E0E7FF' },
  'Otros': { icon: 'ellipsis-horizontal', color: '#6B7280', bg: '#F3F4F6' },
  'Sin clasificar': { icon: 'help-circle', color: '#9CA3AF', bg: '#F9FAFB' },
};

export default function AdminReceipts() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [stats, setStats] = useState({ total_pending: 0, total_this_year: 0, showing: 0, total_amount: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'classified' | 'reviewed'>('all');
  const [viewMode, setViewMode] = useState<'list' | 'category'>('list');
  const [receiptImage, setReceiptImage] = useState<string | null>(null);
  const [loadingImage, setLoadingImage] = useState(false);
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  
  // Edit form state
  const [editForm, setEditForm] = useState({
    category: '',
    merchant: '',
    amount: '',
    receipt_date: '',
    admin_notes: '',
  });

  useEffect(() => {
    loadReceipts();
  }, [filter]);

  // Load thumbnails for receipts with images
  useEffect(() => {
    const loadThumbnails = async () => {
      const receiptsWithImages = receipts.filter(r => r.has_image && !thumbnails[r.id]);
      for (const receipt of receiptsWithImages.slice(0, 10)) { // Load first 10
        try {
          const response = await api.get(`/admin/receipts/${receipt.id}/image`);
          if (response.data?.image) {
            setThumbnails(prev => ({ ...prev, [receipt.id]: response.data.image }));
          }
        } catch (error) {
          // Ignore errors for thumbnails
        }
      }
    };
    if (receipts.length > 0) {
      loadThumbnails();
    }
  }, [receipts]);

  const loadReceipts = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filter === 'pending') params.append('status', 'pending');
      if (filter === 'classified') params.append('status', 'classified');
      if (filter === 'reviewed') params.append('status', 'reviewed');
      
      const response = await api.get(`/admin/receipts?${params.toString()}`);
      setReceipts(response.data.receipts || []);
      setStats(response.data.stats || { total_pending: 0, total_this_year: 0, showing: 0, total_amount: 0 });
    } catch (error) {
      console.error('Error loading receipts:', error);
      Alert.alert('Error', 'No se pudieron cargar los recibos');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadReceipts();
  }, [filter]);

  const loadReceiptImage = async (receiptId: string) => {
    try {
      setLoadingImage(true);
      const response = await api.get(`/admin/receipts/${receiptId}/image`);
      if (response.data?.image) {
        setReceiptImage(response.data.image);
      }
    } catch (error) {
      console.error('Error loading image:', error);
    } finally {
      setLoadingImage(false);
    }
  };

  const openDetail = async (receipt: Receipt) => {
    setSelectedReceipt(receipt);
    setReceiptImage(null);
    setShowDetailModal(true);
    if (receipt.has_image) {
      loadReceiptImage(receipt.id);
    }
  };

  const openEdit = (receipt: Receipt) => {
    setEditForm({
      category: receipt.category || '',
      merchant: receipt.merchant || '',
      amount: receipt.amount?.toString() || '',
      receipt_date: receipt.receipt_date || '',
      admin_notes: receipt.admin_notes || '',
    });
    setShowEditModal(true);
  };

  const saveChanges = async () => {
    if (!selectedReceipt) return;
    
    try {
      setSaving(true);
      await api.put(`/admin/receipts/${selectedReceipt.id}`, {
        category: editForm.category || null,
        merchant: editForm.merchant || null,
        amount: editForm.amount ? parseFloat(editForm.amount) : null,
        receipt_date: editForm.receipt_date || null,
        admin_notes: editForm.admin_notes || null,
        status: 'classified',
      });
      
      Alert.alert('✅ Guardado', 'Los cambios se han guardado correctamente');
      setShowEditModal(false);
      setShowDetailModal(false);
      loadReceipts();
    } catch (error) {
      Alert.alert('Error', 'No se pudieron guardar los cambios');
    } finally {
      setSaving(false);
    }
  };

  const markAsReviewed = async () => {
    if (!selectedReceipt) return;
    
    try {
      setSaving(true);
      await api.put(`/admin/receipts/${selectedReceipt.id}`, { status: 'reviewed' });
      Alert.alert('✅ Revisado', 'El recibo ha sido marcado como revisado');
      setShowDetailModal(false);
      loadReceipts();
    } catch (error) {
      Alert.alert('Error', 'No se pudo actualizar el recibo');
    } finally {
      setSaving(false);
    }
  };

  const deleteReceipt = async () => {
    if (!selectedReceipt) return;
    
    Alert.alert(
      '¿Eliminar Recibo?',
      'Esta acción no se puede deshacer',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/admin/receipts/${selectedReceipt.id}`);
              Alert.alert('Eliminado', 'El recibo ha sido eliminado');
              setShowDetailModal(false);
              loadReceipts();
            } catch (error) {
              Alert.alert('Error', 'No se pudo eliminar el recibo');
            }
          },
        },
      ]
    );
  };

  const formatCurrency = (amount: number | null) => {
    if (!amount) return '$0.00';
    return `$${amount.toFixed(2)}`;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Sin fecha';
    try {
      return format(new Date(dateStr), "d MMM yyyy", { locale: es });
    } catch {
      return dateStr;
    }
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'pending':
        return { label: 'Pendiente', color: '#F59E0B', bg: '#FEF3C7', icon: 'time' };
      case 'classified':
        return { label: 'Clasificado', color: '#3B82F6', bg: '#DBEAFE', icon: 'checkmark-circle' };
      case 'reviewed':
        return { label: 'Revisado', color: '#10B981', bg: '#D1FAE5', icon: 'checkmark-done' };
      default:
        return { label: status, color: '#6B7280', bg: '#F3F4F6', icon: 'help-circle' };
    }
  };

  const getCategoryConfig = (category: string | null) => {
    return CATEGORY_CONFIG[category || 'Sin clasificar'] || CATEGORY_CONFIG['Sin clasificar'];
  };

  // Group receipts by category
  const groupedReceipts = React.useMemo(() => {
    const groups: Record<string, { receipts: Receipt[]; total: number }> = {};
    
    receipts.forEach((receipt) => {
      const cat = receipt.category || 'Sin clasificar';
      if (!groups[cat]) {
        groups[cat] = { receipts: [], total: 0 };
      }
      groups[cat].receipts.push(receipt);
      groups[cat].total += receipt.amount || 0;
    });
    
    // Sort by total amount descending
    return Object.entries(groups).sort((a, b) => b[1].total - a[1].total);
  }, [receipts]);

  const renderReceipt = ({ item, index }: { item: Receipt; index: number }) => {
    const statusConfig = getStatusConfig(item.status);
    const categoryConfig = getCategoryConfig(item.category);
    const clientName = item.user_name && item.user_name !== 'Ross Tax Preparation' 
      ? item.user_name 
      : item.user_email?.split('@')[0] || 'Cliente';
    const thumbnail = thumbnails[item.id];

    return (
      <TouchableOpacity
        style={styles.receiptCard}
        onPress={() => openDetail(item)}
        activeOpacity={0.7}
      >
        {/* Left: Thumbnail or Category Icon */}
        {thumbnail ? (
          <Image source={{ uri: thumbnail }} style={styles.receiptThumbnail} />
        ) : (
          <View style={[styles.receiptIconContainer, { backgroundColor: categoryConfig.bg }]}>
            {item.has_image ? (
              <Ionicons name="image" size={24} color={categoryConfig.color} />
            ) : (
              <Ionicons name={categoryConfig.icon as any} size={24} color={categoryConfig.color} />
            )}
          </View>
        )}

        {/* Center: Info */}
        <View style={styles.receiptInfo}>
          <View style={styles.receiptHeader}>
            <Text style={styles.receiptMerchant} numberOfLines={1}>
              {item.merchant || item.category || 'Sin clasificar'}
            </Text>
            {item.ai_confidence && item.ai_confidence > 80 && (
              <View style={styles.aiBadge}>
                <Ionicons name="sparkles" size={10} color="#7C3AED" />
                <Text style={styles.aiText}>{Math.round(item.ai_confidence)}%</Text>
              </View>
            )}
          </View>
          
          <View style={styles.receiptSubInfo}>
            <Ionicons name="person-outline" size={12} color="#6B7280" />
            <Text style={styles.receiptClient} numberOfLines={1}>{clientName}</Text>
          </View>
          
          <View style={styles.receiptMeta}>
            <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
              <View style={[styles.statusDot, { backgroundColor: statusConfig.color }]} />
              <Text style={[styles.statusText, { color: statusConfig.color }]}>
                {statusConfig.label}
              </Text>
            </View>
            <Text style={styles.receiptDate}>{formatDate(item.receipt_date || item.created_at)}</Text>
          </View>
        </View>

        {/* Right: Amount */}
        <View style={styles.receiptRight}>
          <Text style={[styles.receiptAmount, { color: item.amount ? '#059669' : '#9CA3AF' }]}>
            {formatCurrency(item.amount)}
          </Text>
          <Ionicons name="chevron-forward" size={16} color="#D1D5DB" />
        </View>
      </TouchableOpacity>
    );
  };

  const FilterButton = ({ value, label, count }: { value: typeof filter; label: string; count?: number }) => (
    <TouchableOpacity
      style={[styles.filterButton, filter === value && styles.filterButtonActive]}
      onPress={() => setFilter(value)}
    >
      <Text style={[styles.filterText, filter === value && styles.filterTextActive]}>
        {label}
      </Text>
      {count !== undefined && count > 0 && (
        <View style={[styles.filterBadge, filter === value && styles.filterBadgeActive]}>
          <Text style={[styles.filterBadgeText, filter === value && styles.filterBadgeTextActive]}>
            {count}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );

  // Category Section Component for grouped view
  const CategorySection = ({ category, data }: { category: string; data: { receipts: Receipt[]; total: number } }) => {
    const [expanded, setExpanded] = useState(true);
    const config = getCategoryConfig(category);
    
    return (
      <View style={styles.categorySection}>
        <TouchableOpacity 
          style={[styles.categorySectionHeader, { backgroundColor: config.bg }]}
          onPress={() => setExpanded(!expanded)}
          activeOpacity={0.7}
        >
          <View style={[styles.categorySectionIcon, { backgroundColor: config.color + '20' }]}>
            <Ionicons name={config.icon as any} size={20} color={config.color} />
          </View>
          <View style={styles.categorySectionInfo}>
            <Text style={[styles.categorySectionTitle, { color: config.color }]}>{category}</Text>
            <Text style={styles.categorySectionMeta}>
              {data.receipts.length} recibo{data.receipts.length !== 1 ? 's' : ''} • {formatCurrency(data.total)}
            </Text>
          </View>
          <Ionicons 
            name={expanded ? 'chevron-up' : 'chevron-down'} 
            size={20} 
            color={config.color} 
          />
        </TouchableOpacity>
        
        {expanded && (
          <View style={styles.categorySectionItems}>
            {data.receipts.map((item) => {
              const thumbnail = thumbnails[item.id];
              const statusConfig = getStatusConfig(item.status);
              return (
                <TouchableOpacity 
                  key={item.id}
                  style={styles.categorySectionItem}
                  onPress={() => openDetail(item)}
                  activeOpacity={0.7}
                >
                  {thumbnail ? (
                    <Image source={{ uri: thumbnail }} style={styles.categoryItemThumb} />
                  ) : (
                    <View style={[styles.categoryItemIcon, { backgroundColor: '#F3F4F6' }]}>
                      <Ionicons name={item.has_image ? 'image' : 'receipt-outline'} size={16} color="#9CA3AF" />
                    </View>
                  )}
                  <View style={styles.categoryItemInfo}>
                    <Text style={styles.categoryItemMerchant} numberOfLines={1}>
                      {item.merchant || 'Sin comercio'}
                    </Text>
                    <Text style={styles.categoryItemDate}>
                      {formatDate(item.receipt_date || item.created_at)}
                    </Text>
                  </View>
                  <View style={styles.categoryItemRight}>
                    <Text style={[styles.categoryItemAmount, { color: item.amount ? '#059669' : '#9CA3AF' }]}>
                      {formatCurrency(item.amount)}
                    </Text>
                    <View style={[styles.categoryItemStatus, { backgroundColor: statusConfig.bg }]}>
                      <View style={[styles.statusDot, { backgroundColor: statusConfig.color }]} />
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      {/* Modern Header */}
      <LinearGradient
        colors={['#1E3A5F', '#2D5A87', '#1E3A5F']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top }]}
      >
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <View style={styles.headerTitleSection}>
            <Text style={styles.headerTitle}>Recibos de Gastos</Text>
            <Text style={styles.headerSubtitle}>{stats.showing} de {stats.total_this_year} este año</Text>
          </View>
          <TouchableOpacity onPress={onRefresh} style={styles.refreshButton}>
            <Ionicons name="refresh" size={20} color="#FFF" />
          </TouchableOpacity>
        </View>

        {/* Stats Cards */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <View style={[styles.statIconBg, { backgroundColor: 'rgba(245, 158, 11, 0.2)' }]}>
              <Ionicons name="time" size={18} color="#F59E0B" />
            </View>
            <Text style={styles.statValue}>{stats.total_pending}</Text>
            <Text style={styles.statLabel}>Pendientes</Text>
          </View>
          
          <View style={styles.statCard}>
            <View style={[styles.statIconBg, { backgroundColor: 'rgba(16, 185, 129, 0.2)' }]}>
              <Ionicons name="cash" size={18} color="#10B981" />
            </View>
            <Text style={styles.statValue}>{formatCurrency(stats.total_amount)}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          
          <View style={styles.statCard}>
            <View style={[styles.statIconBg, { backgroundColor: 'rgba(59, 130, 246, 0.2)' }]}>
              <Ionicons name="documents" size={18} color="#3B82F6" />
            </View>
            <Text style={styles.statValue}>{stats.total_this_year}</Text>
            <Text style={styles.statLabel}>Este Año</Text>
          </View>
        </View>
      </LinearGradient>

      {/* Filters & View Toggle */}
      <View style={styles.controlsRow}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          style={styles.filtersContainer}
          contentContainerStyle={styles.filtersContent}
        >
          <FilterButton value="all" label="Todos" />
          <FilterButton value="pending" label="Pendientes" count={stats.total_pending} />
          <FilterButton value="classified" label="Clasificados" />
          <FilterButton value="reviewed" label="Revisados" />
        </ScrollView>
        
        {/* View Mode Toggle */}
        <View style={styles.viewToggleContainer}>
          <TouchableOpacity
            style={[styles.viewToggleBtn, viewMode === 'list' && styles.viewToggleBtnActive]}
            onPress={() => setViewMode('list')}
          >
            <Ionicons name="list" size={18} color={viewMode === 'list' ? '#FFF' : '#6B7280'} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.viewToggleBtn, viewMode === 'category' && styles.viewToggleBtnActive]}
            onPress={() => setViewMode('category')}
          >
            <Ionicons name="grid" size={18} color={viewMode === 'category' ? '#FFF' : '#6B7280'} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Receipts List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1E3A5F" />
          <Text style={styles.loadingText}>Cargando recibos...</Text>
        </View>
      ) : receipts.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconBg}>
            <Ionicons name="receipt-outline" size={48} color="#9CA3AF" />
          </View>
          <Text style={styles.emptyTitle}>No hay recibos</Text>
          <Text style={styles.emptyText}>
            {filter === 'all' 
              ? 'Los clientes aún no han subido recibos'
              : `No hay recibos ${filter === 'pending' ? 'pendientes' : filter === 'classified' ? 'clasificados' : 'revisados'}`
            }
          </Text>
        </View>
      ) : viewMode === 'list' ? (
        <FlatList
          data={receipts}
          renderItem={renderReceipt}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1E3A5F" />
          }
        />
      ) : (
        <ScrollView 
          style={styles.categoryView}
          contentContainerStyle={styles.categoryViewContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1E3A5F" />
          }
        >
          {groupedReceipts.map(([category, data]) => (
            <CategorySection key={category} category={category} data={data} />
          ))}
          <View style={{ height: 100 }} />
        </ScrollView>
      )}

      {/* Detail Modal */}
      <Modal visible={showDetailModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedReceipt && (
              <>
                {/* Modal Header */}
                <LinearGradient
                  colors={[getCategoryConfig(selectedReceipt.category).color, getCategoryConfig(selectedReceipt.category).color + 'DD']}
                  style={styles.modalHeader}
                >
                  <View style={styles.modalHeaderContent}>
                    <Text style={styles.modalTitle}>
                      {selectedReceipt.merchant || selectedReceipt.category || 'Recibo'}
                    </Text>
                    <Text style={styles.modalSubtitle}>
                      {selectedReceipt.user_name !== 'Ross Tax Preparation' 
                        ? selectedReceipt.user_name 
                        : selectedReceipt.user_email}
                    </Text>
                  </View>
                  <TouchableOpacity 
                    style={styles.modalCloseBtn}
                    onPress={() => setShowDetailModal(false)}
                  >
                    <Ionicons name="close" size={24} color="#FFF" />
                  </TouchableOpacity>
                </LinearGradient>

                <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                  {/* Receipt Image */}
                  {selectedReceipt.has_image && (
                    <View style={styles.imageSection}>
                      {loadingImage ? (
                        <View style={styles.imagePlaceholder}>
                          <ActivityIndicator size="small" color="#1E3A5F" />
                          <Text style={styles.imageLoadingText}>Cargando imagen...</Text>
                        </View>
                      ) : receiptImage ? (
                        <Image
                          source={{ uri: receiptImage }}
                          style={styles.receiptImage}
                          resizeMode="contain"
                        />
                      ) : (
                        <View style={styles.imagePlaceholder}>
                          <Ionicons name="image-outline" size={32} color="#9CA3AF" />
                          <Text style={styles.imageLoadingText}>Sin imagen</Text>
                        </View>
                      )}
                    </View>
                  )}

                  {/* Amount */}
                  <View style={styles.amountSection}>
                    <Text style={styles.amountLabel}>Monto</Text>
                    <Text style={styles.amountValue}>{formatCurrency(selectedReceipt.amount)}</Text>
                  </View>

                  {/* Details Grid */}
                  <View style={styles.detailsGrid}>
                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel}>📁 Categoría</Text>
                      <Text style={styles.detailValue}>{selectedReceipt.category || 'Sin clasificar'}</Text>
                    </View>
                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel}>📅 Fecha</Text>
                      <Text style={styles.detailValue}>{formatDate(selectedReceipt.receipt_date)}</Text>
                    </View>
                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel}>👤 Cliente</Text>
                      <Text style={styles.detailValue} numberOfLines={1}>
                        {selectedReceipt.user_name !== 'Ross Tax Preparation' 
                          ? selectedReceipt.user_name 
                          : selectedReceipt.user_email?.split('@')[0]}
                      </Text>
                    </View>
                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel}>📧 Email</Text>
                      <Text style={styles.detailValue} numberOfLines={1}>{selectedReceipt.user_email || 'N/A'}</Text>
                    </View>
                  </View>

                  {/* AI Confidence */}
                  {selectedReceipt.ai_confidence && (
                    <View style={styles.aiSection}>
                      <View style={styles.aiHeader}>
                        <Ionicons name="sparkles" size={16} color="#7C3AED" />
                        <Text style={styles.aiTitle}>Clasificación IA</Text>
                      </View>
                      <View style={styles.aiBar}>
                        <View style={[styles.aiProgress, { width: `${selectedReceipt.ai_confidence}%` }]} />
                      </View>
                      <Text style={styles.aiPercent}>{Math.round(selectedReceipt.ai_confidence)}% confianza</Text>
                    </View>
                  )}

                  {/* Notes */}
                  {(selectedReceipt.notes || selectedReceipt.admin_notes) && (
                    <View style={styles.notesSection}>
                      {selectedReceipt.notes && (
                        <View style={styles.noteItem}>
                          <Text style={styles.noteLabel}>Notas del cliente</Text>
                          <Text style={styles.noteText}>{selectedReceipt.notes}</Text>
                        </View>
                      )}
                      {selectedReceipt.admin_notes && (
                        <View style={styles.noteItem}>
                          <Text style={styles.noteLabel}>Notas admin</Text>
                          <Text style={styles.noteText}>{selectedReceipt.admin_notes}</Text>
                        </View>
                      )}
                    </View>
                  )}

                  {/* Actions */}
                  <View style={styles.actionButtons}>
                    <TouchableOpacity 
                      style={styles.actionBtn}
                      onPress={() => openEdit(selectedReceipt)}
                    >
                      <LinearGradient colors={['#3B82F6', '#2563EB']} style={styles.actionBtnGradient}>
                        <Ionicons name="create" size={18} color="#FFF" />
                        <Text style={styles.actionBtnText}>Editar</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                    
                    {selectedReceipt.status !== 'reviewed' && (
                      <TouchableOpacity 
                        style={styles.actionBtn}
                        onPress={markAsReviewed}
                        disabled={saving}
                      >
                        <LinearGradient colors={['#10B981', '#059669']} style={styles.actionBtnGradient}>
                          <Ionicons name="checkmark-done" size={18} color="#FFF" />
                          <Text style={styles.actionBtnText}>Revisar</Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    )}
                    
                    <TouchableOpacity 
                      style={styles.actionBtnDelete}
                      onPress={deleteReceipt}
                    >
                      <Ionicons name="trash-outline" size={18} color="#EF4444" />
                    </TouchableOpacity>
                  </View>

                  <View style={{ height: 40 }} />
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Edit Modal */}
      <Modal visible={showEditModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.editModalContent}>
            <View style={styles.editModalHeader}>
              <Text style={styles.editModalTitle}>Editar Recibo</Text>
              <TouchableOpacity onPress={() => setShowEditModal(false)}>
                <Ionicons name="close" size={24} color="#374151" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.editForm}>
              {/* Category Picker */}
              <Text style={styles.inputLabel}>Categoría</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryPicker}>
                {CATEGORIES.map((cat) => {
                  const config = getCategoryConfig(cat);
                  const isSelected = editForm.category === cat;
                  return (
                    <TouchableOpacity
                      key={cat}
                      style={[styles.categoryOption, isSelected && { borderColor: config.color, backgroundColor: config.bg }]}
                      onPress={() => setEditForm({ ...editForm, category: cat })}
                    >
                      <Ionicons name={config.icon as any} size={16} color={config.color} />
                      <Text style={[styles.categoryOptionText, { color: config.color }]} numberOfLines={1}>
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Merchant */}
              <Text style={styles.inputLabel}>Comercio</Text>
              <TextInput
                style={styles.input}
                value={editForm.merchant}
                onChangeText={(text) => setEditForm({ ...editForm, merchant: text })}
                placeholder="Ej: Walmart, Amazon, etc."
                placeholderTextColor="#9CA3AF"
              />

              {/* Amount */}
              <Text style={styles.inputLabel}>Monto ($)</Text>
              <TextInput
                style={styles.input}
                value={editForm.amount}
                onChangeText={(text) => setEditForm({ ...editForm, amount: text })}
                placeholder="0.00"
                placeholderTextColor="#9CA3AF"
                keyboardType="decimal-pad"
              />

              {/* Date */}
              <Text style={styles.inputLabel}>Fecha del recibo</Text>
              <TextInput
                style={styles.input}
                value={editForm.receipt_date}
                onChangeText={(text) => setEditForm({ ...editForm, receipt_date: text })}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#9CA3AF"
              />

              {/* Admin Notes */}
              <Text style={styles.inputLabel}>Notas (admin)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={editForm.admin_notes}
                onChangeText={(text) => setEditForm({ ...editForm, admin_notes: text })}
                placeholder="Notas internas..."
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={3}
              />

              {/* Save Button */}
              <TouchableOpacity style={styles.saveButton} onPress={saveChanges} disabled={saving}>
                <LinearGradient colors={['#1E3A5F', '#2D5A87']} style={styles.saveButtonGradient}>
                  {saving ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <>
                      <Ionicons name="checkmark" size={20} color="#FFF" />
                      <Text style={styles.saveButtonText}>Guardar Cambios</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  
  // Header
  header: { paddingBottom: 16 },
  headerTop: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  backButton: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  headerTitleSection: { flex: 1, marginLeft: 12 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#FFF' },
  headerSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  refreshButton: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  
  // Stats
  statsContainer: { flexDirection: 'row', paddingHorizontal: 16, gap: 10, marginTop: 8 },
  statCard: { flex: 1, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 14, padding: 12, alignItems: 'center' },
  statIconBg: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
  statValue: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  statLabel: { fontSize: 10, color: 'rgba(255,255,255,0.7)', marginTop: 2, textTransform: 'uppercase' },
  
  // Controls Row
  controlsRow: { flexDirection: 'row', alignItems: 'center', paddingRight: 16 },
  
  // Filters
  filtersContainer: { flex: 1, maxHeight: 50 },
  filtersContent: { paddingHorizontal: 16, paddingVertical: 10, gap: 8, flexDirection: 'row' },
  filterButton: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#E5E7EB', flexDirection: 'row', alignItems: 'center', gap: 6 },
  filterButtonActive: { backgroundColor: '#1E3A5F' },
  filterText: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  filterTextActive: { color: '#FFF' },
  filterBadge: { backgroundColor: '#9CA3AF', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 },
  filterBadgeActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
  filterBadgeText: { fontSize: 10, fontWeight: '700', color: '#FFF' },
  filterBadgeTextActive: { color: '#FFF' },
  
  // View Toggle
  viewToggleContainer: { flexDirection: 'row', backgroundColor: '#E5E7EB', borderRadius: 10, padding: 3 },
  viewToggleBtn: { width: 36, height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  viewToggleBtnActive: { backgroundColor: '#1E3A5F' },
  
  // Loading
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 14, color: '#6B7280' },
  
  // Empty
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyIconBg: { width: 80, height: 80, borderRadius: 24, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#374151', marginBottom: 8 },
  emptyText: { fontSize: 14, color: '#6B7280', textAlign: 'center' },
  
  // List
  listContent: { padding: 16, paddingBottom: 100 },
  
  // Category View
  categoryView: { flex: 1 },
  categoryViewContent: { padding: 16 },
  categorySection: { marginBottom: 16, borderRadius: 16, overflow: 'hidden', backgroundColor: '#FFF', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  categorySectionHeader: { flexDirection: 'row', alignItems: 'center', padding: 14 },
  categorySectionIcon: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  categorySectionInfo: { flex: 1, marginLeft: 12 },
  categorySectionTitle: { fontSize: 15, fontWeight: '700' },
  categorySectionMeta: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  categorySectionItems: { borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  categorySectionItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: '#F9FAFB' },
  categoryItemThumb: { width: 40, height: 40, borderRadius: 8 },
  categoryItemIcon: { width: 40, height: 40, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  categoryItemInfo: { flex: 1, marginLeft: 12 },
  categoryItemMerchant: { fontSize: 14, fontWeight: '600', color: '#374151' },
  categoryItemDate: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  categoryItemRight: { alignItems: 'flex-end', gap: 4 },
  categoryItemAmount: { fontSize: 14, fontWeight: '700' },
  categoryItemStatus: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6 },
  
  // Receipt Card (thumbnail)
  receiptThumbnail: { width: 50, height: 50, borderRadius: 14 },
  
  // Receipt Card
  receiptCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 16, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  receiptIconContainer: { width: 50, height: 50, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  receiptInfo: { flex: 1, marginLeft: 12 },
  receiptHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  receiptMerchant: { fontSize: 15, fontWeight: '600', color: '#1F2937', flex: 1 },
  aiBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EDE9FE', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, gap: 3 },
  aiText: { fontSize: 10, fontWeight: '600', color: '#7C3AED' },
  receiptSubInfo: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  receiptClient: { fontSize: 12, color: '#6B7280', flex: 1 },
  receiptMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, gap: 4 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 10, fontWeight: '600' },
  receiptDate: { fontSize: 11, color: '#9CA3AF' },
  receiptRight: { alignItems: 'flex-end', gap: 4 },
  receiptAmount: { fontSize: 16, fontWeight: '700' },
  
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  modalHeaderContent: { flex: 1 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#FFF' },
  modalSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  modalCloseBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  modalBody: { padding: 20 },
  
  // Image Section
  imageSection: { marginBottom: 20, borderRadius: 16, overflow: 'hidden', backgroundColor: '#F9FAFB' },
  receiptImage: { width: '100%', height: 250, borderRadius: 16 },
  imagePlaceholder: { height: 150, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F3F4F6', borderRadius: 16 },
  imageLoadingText: { fontSize: 12, color: '#9CA3AF', marginTop: 8 },
  
  // Amount Section
  amountSection: { alignItems: 'center', marginBottom: 20, paddingVertical: 16, backgroundColor: '#F0FDF4', borderRadius: 16 },
  amountLabel: { fontSize: 12, color: '#6B7280', marginBottom: 4 },
  amountValue: { fontSize: 32, fontWeight: '800', color: '#059669' },
  
  // Details Grid
  detailsGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 16 },
  detailItem: { width: '50%', paddingVertical: 10, paddingHorizontal: 4 },
  detailLabel: { fontSize: 11, color: '#9CA3AF', marginBottom: 4 },
  detailValue: { fontSize: 14, fontWeight: '600', color: '#374151' },
  
  // AI Section
  aiSection: { backgroundColor: '#FAF5FF', borderRadius: 14, padding: 14, marginBottom: 16 },
  aiHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  aiTitle: { fontSize: 13, fontWeight: '600', color: '#7C3AED' },
  aiBar: { height: 8, backgroundColor: '#E9D5FF', borderRadius: 4, overflow: 'hidden' },
  aiProgress: { height: '100%', backgroundColor: '#7C3AED', borderRadius: 4 },
  aiPercent: { fontSize: 12, color: '#7C3AED', marginTop: 6, textAlign: 'right' },
  
  // Notes Section
  notesSection: { marginBottom: 16 },
  noteItem: { backgroundColor: '#F9FAFB', borderRadius: 12, padding: 12, marginBottom: 8 },
  noteLabel: { fontSize: 11, color: '#6B7280', marginBottom: 4 },
  noteText: { fontSize: 13, color: '#374151' },
  
  // Action Buttons
  actionButtons: { flexDirection: 'row', gap: 10, marginTop: 8 },
  actionBtn: { flex: 1, borderRadius: 12, overflow: 'hidden' },
  actionBtnGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, gap: 6 },
  actionBtnText: { fontSize: 14, fontWeight: '600', color: '#FFF' },
  actionBtnDelete: { width: 50, height: 50, borderRadius: 12, backgroundColor: '#FEE2E2', justifyContent: 'center', alignItems: 'center' },
  
  // Edit Modal
  editModalContent: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '85%' },
  editModalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  editModalTitle: { fontSize: 18, fontWeight: '700', color: '#1F2937' },
  editForm: { padding: 20 },
  inputLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8, marginTop: 12 },
  input: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#1F2937' },
  textArea: { height: 80, textAlignVertical: 'top' },
  categoryPicker: { marginBottom: 8 },
  categoryOption: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 2, borderColor: '#E5E7EB', marginRight: 8, gap: 6 },
  categoryOptionText: { fontSize: 12, fontWeight: '600' },
  saveButton: { marginTop: 24, borderRadius: 14, overflow: 'hidden' },
  saveButtonGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, gap: 8 },
  saveButtonText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
});
