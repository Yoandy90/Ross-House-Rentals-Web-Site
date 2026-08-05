import { useTranslation } from 'react-i18next';
/**
 * Admin Google Reviews Screen - Mobile App
 * Manage Google Reviews from mobile with AI-powered responses
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
  Linking,
  Dimensions,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width: screenWidth } = Dimensions.get('window');
const API_BASE = process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface Review {
  id: string;
  author_name: string;
  rating: number;
  text: string;
  review_date: string;
  profile_photo_url?: string;
  response_status: 'pending' | 'responded';
  suggested_response?: string;
  admin_response?: string;
  responded_at?: string;
}

interface ReviewStats {
  total: number;
  pending: number;
  responded: number;
  avg_rating: number;
}

const AdminReviewsScreen = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [stats, setStats] = useState<ReviewStats>({ total: 0, pending: 0, responded: 0, avg_rating: 5 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'responded'>('all');
  const [expandedReview, setExpandedReview] = useState<string | null>(null);
  const [generatingResponse, setGeneratingResponse] = useState<string | null>(null);
  const [googleTotal, setGoogleTotal] = useState<number | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newReview, setNewReview] = useState({ author_name: '', rating: 5, text: '' });
  const [addingReview, setAddingReview] = useState(false);

  const loadReviews = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('session_token');
      if (!token) return;

      const response = await fetch(`${API_BASE}/api/admin/google-reviews?status=${filter === 'all' ? '' : filter}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setReviews(data.reviews || []);
        setStats(data.stats || { total: 0, pending: 0, responded: 0, avg_rating: 5 });
        if (data.google_total) {
          setGoogleTotal(data.google_total);
        }
      }
    } catch (error) {
      console.error('Error loading reviews:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter]);

  useEffect(() => {
    loadReviews();
  }, [loadReviews]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadReviews();
  };

  const syncReviews = async () => {
    setSyncing(true);
    try {
      const token = await AsyncStorage.getItem('session_token');
      if (!token) return;

      const response = await fetch(`${API_BASE}/api/admin/google-reviews/sync`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.new_count > 0) {
          Alert.alert('✅ Éxito', `${data.new_count} reseñas nuevas importadas de Google`);
        } else {
          Alert.alert('ℹ️ Info', 'No hay reseñas nuevas disponibles (la API de Google solo devuelve 5 a la vez)');
        }
        if (data.google_total) {
          setGoogleTotal(data.google_total);
        }
        loadReviews();
      } else {
        Alert.alert('Error', 'No se pudo sincronizar');
      }
    } catch (error) {
      Alert.alert('Error', 'Error de conexión');
    } finally {
      setSyncing(false);
    }
  };

  const addReviewManually = async () => {
    if (!newReview.author_name || !newReview.text) {
      Alert.alert('Error', 'Por favor completa el nombre y el texto de la reseña');
      return;
    }

    setAddingReview(true);
    try {
      const token = await AsyncStorage.getItem('session_token');
      if (!token) return;

      const response = await fetch(`${API_BASE}/api/admin/google-reviews`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newReview)
      });

      if (response.ok) {
        Alert.alert('✅ Éxito', 'Reseña agregada correctamente');
        setShowAddModal(false);
        setNewReview({ author_name: '', rating: 5, text: '' });
        loadReviews();
      } else {
        Alert.alert('Error', 'No se pudo agregar la reseña');
      }
    } catch (error) {
      Alert.alert('Error', 'Error de conexión');
    } finally {
      setAddingReview(false);
    }
  };

  const generateAIResponse = async (review: Review) => {
    setGeneratingResponse(review.id);
    try {
      const token = await AsyncStorage.getItem('session_token');
      if (!token) return;

      const response = await fetch(`${API_BASE}/api/admin/google-reviews/${review.id}/generate-response`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        // Update the review in state with new suggested response
        setReviews(prev => prev.map(r => 
          r.id === review.id ? { ...r, suggested_response: data.response } : r
        ));
        Alert.alert('✅ Respuesta Generada', 'La respuesta con IA está lista para copiar');
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudo generar la respuesta');
    } finally {
      setGeneratingResponse(null);
    }
  };

  const copyToClipboard = async (text: string) => {
    await Clipboard.setStringAsync(text);
    Alert.alert('✅ Copiado', 'Respuesta copiada al portapapeles');
  };

  const markAsResponded = async (reviewId: string) => {
    try {
      const token = await AsyncStorage.getItem('session_token');
      if (!token) return;

      const response = await fetch(`${API_BASE}/api/admin/google-reviews/${reviewId}/respond`, {
        method: 'PUT',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ response_text: 'Respondido via Google Business' })
      });

      if (response.ok) {
        loadReviews();
        Alert.alert('✅ Marcada', 'Reseña marcada como respondida');
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudo marcar como respondida');
    }
  };

  const openGoogleBusiness = () => {
    Linking.openURL('https://business.google.com/reviews');
  };

  const renderStars = (rating: number) => {
    return [...Array(5)].map((_, i) => (
      <Ionicons
        key={i}
        name={i < rating ? 'star' : 'star-outline'}
        size={16}
        color={i < rating ? '#FBBF24' : '#94A3B8'}
      />
    ));
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const filteredReviews = reviews.filter(r => {
    if (filter === 'pending') return r.response_status === 'pending';
    if (filter === 'responded') return r.response_status === 'responded';
    return true;
  });

  const FilterButton = ({ value, label, count }: { value: typeof filter; label: string; count: number }) => (
    <TouchableOpacity
      style={[styles.filterButton, filter === value && styles.filterButtonActive]}
      onPress={() => setFilter(value)}
    >
      <Text style={[styles.filterButtonText, filter === value && styles.filterButtonTextActive]}>
        {label}
      </Text>
      <View style={[styles.filterBadge, filter === value && styles.filterBadgeActive]}>
        <Text style={[styles.filterBadgeText, filter === value && styles.filterBadgeTextActive]}>
          {count}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={['#1a1a2e', '#16213e']}
        style={[styles.header, { paddingTop: insets.top + 12 }]}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>⭐ Reseñas Google</Text>
            <Text style={styles.headerSubtitle}>Gestiona tus reseñas con IA</Text>
          </View>
          <TouchableOpacity 
            onPress={syncReviews} 
            style={styles.syncButton}
            disabled={syncing}
          >
            {syncing ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Ionicons name="sync" size={22} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Stats Cards */}
      <View style={styles.statsContainer}>
        <View style={[styles.statCard, { backgroundColor: '#FEF3C7' }]}>
          <Ionicons name="star" size={24} color="#F59E0B" />
          <Text style={styles.statValue}>{stats.avg_rating.toFixed(1)}</Text>
          <Text style={styles.statLabel}>Promedio</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#DBEAFE' }]}>
          <Ionicons name="chatbubbles" size={24} color="#3B82F6" />
          <Text style={styles.statValue}>{stats.total}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#FEE2E2' }]}>
          <Ionicons name="time" size={24} color="#EF4444" />
          <Text style={styles.statValue}>{stats.pending}</Text>
          <Text style={styles.statLabel}>Pendientes</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#D1FAE5' }]}>
          <Ionicons name="checkmark-circle" size={24} color="#10B981" />
          <Text style={styles.statValue}>{stats.responded}</Text>
          <Text style={styles.statLabel}>Respondidas</Text>
        </View>
      </View>

      {/* Missing Reviews Alert */}
      {googleTotal && googleTotal > stats.total && (
        <View style={styles.alertBanner}>
          <View style={styles.alertContent}>
            <Ionicons name="alert-circle" size={24} color="#F59E0B" />
            <View style={styles.alertTextContainer}>
              <Text style={styles.alertTitle}>
                {googleTotal - stats.total} reseñas pendientes de importar
              </Text>
              <Text style={styles.alertSubtitle}>
                Google tiene {googleTotal} reseñas, solo {stats.total} en el sistema
              </Text>
            </View>
          </View>
          <TouchableOpacity 
            style={styles.addManualButton}
            onPress={() => setShowAddModal(true)}
          >
            <Ionicons name="add-circle" size={20} color="#fff" />
            <Text style={styles.addManualButtonText}>Agregar</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Filters */}
      <View style={styles.filtersContainer}>
        <FilterButton value="all" label="Todas" count={stats.total} />
        <FilterButton value="pending" label="Pendientes" count={stats.pending} />
        <FilterButton value="responded" label="Respondidas" count={stats.responded} />
      </View>

      {/* Open Google Button */}
      <TouchableOpacity style={styles.googleButton} onPress={openGoogleBusiness}>
        <LinearGradient
          colors={['#4285F4', '#3367D6']}
          style={styles.googleButtonGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
          <Ionicons name="logo-google" size={20} color="#fff" />
          <Text style={styles.googleButtonText}>Abrir Google Business</Text>
          <Ionicons name="open-outline" size={18} color="#fff" />
        </LinearGradient>
      </TouchableOpacity>

      {/* Reviews List */}
      <ScrollView
        style={styles.reviewsList}
        contentContainerStyle={styles.reviewsListContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#6C1110" />
        }
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#6C1110" />
            <Text style={styles.loadingText}>Cargando reseñas...</Text>
          </View>
        ) : filteredReviews.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="star-outline" size={64} color="#CBD5E1" />
            <Text style={styles.emptyTitle}>No hay reseñas</Text>
            <Text style={styles.emptySubtitle}>
              Sincroniza para obtener las últimas reseñas de Google
            </Text>
            <TouchableOpacity style={styles.syncNowButton} onPress={syncReviews}>
              <Text style={styles.syncNowButtonText}>Sincronizar Ahora</Text>
            </TouchableOpacity>
          </View>
        ) : (
          filteredReviews.map((review) => (
            <TouchableOpacity
              key={review.id}
              style={styles.reviewCard}
              onPress={() => setExpandedReview(expandedReview === review.id ? null : review.id)}
              activeOpacity={0.9}
            >
              {/* Review Header */}
              <View style={styles.reviewHeader}>
                <View style={styles.reviewAuthor}>
                  <View style={styles.avatarContainer}>
                    <Text style={styles.avatarText}>
                      {review.author_name?.charAt(0)?.toUpperCase() || '?'}
                    </Text>
                  </View>
                  <View style={styles.authorInfo}>
                    <Text style={styles.authorName}>{review.author_name}</Text>
                    <Text style={styles.reviewDate}>{formatDate(review.review_date)}</Text>
                  </View>
                </View>
                <View style={styles.ratingContainer}>
                  <View style={styles.starsRow}>{renderStars(review.rating)}</View>
                  <View style={[
                    styles.statusBadge,
                    review.response_status === 'responded' ? styles.statusResponded : styles.statusPending
                  ]}>
                    <Text style={[
                      styles.statusText,
                      review.response_status === 'responded' ? styles.statusTextResponded : styles.statusTextPending
                    ]}>
                      {review.response_status === 'responded' ? '✓ Respondida' : '⏳ Pendiente'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Review Text */}
              <Text style={styles.reviewText} numberOfLines={expandedReview === review.id ? undefined : 3}>
                "{review.text}"
              </Text>

              {/* Expanded Content */}
              {expandedReview === review.id && (
                <View style={styles.expandedContent}>
                  {/* Suggested Response */}
                  {review.suggested_response && (
                    <View style={styles.suggestedResponseContainer}>
                      <View style={styles.suggestedHeader}>
                        <Ionicons name="sparkles" size={18} color="#8B5CF6" />
                        <Text style={styles.suggestedLabel}>Respuesta Sugerida (IA)</Text>
                      </View>
                      <Text style={styles.suggestedText}>{review.suggested_response}</Text>
                      <TouchableOpacity
                        style={styles.copyButton}
                        onPress={() => copyToClipboard(review.suggested_response!)}
                      >
                        <Ionicons name="copy-outline" size={18} color="#fff" />
                        <Text style={styles.copyButtonText}>Copiar Respuesta</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* Action Buttons */}
                  <View style={styles.actionButtons}>
                    {!review.suggested_response && (
                      <TouchableOpacity
                        style={styles.generateButton}
                        onPress={() => generateAIResponse(review)}
                        disabled={generatingResponse === review.id}
                      >
                        {generatingResponse === review.id ? (
                          <ActivityIndicator color="#fff" size="small" />
                        ) : (
                          <>
                            <Ionicons name="sparkles" size={18} color="#fff" />
                            <Text style={styles.generateButtonText}>Generar con IA</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    )}
                    
                    {review.response_status === 'pending' && (
                      <TouchableOpacity
                        style={styles.markRespondedButton}
                        onPress={() => {
                          Alert.alert(
                            'Marcar como Respondida',
                            '¿Ya respondiste esta reseña en Google?',
                            [
                              { text: 'Cancelar', style: 'cancel' },
                              { text: 'Sí, marcar', onPress: () => markAsResponded(review.id) }
                            ]
                          );
                        }}
                      >
                        <Ionicons name="checkmark-circle-outline" size={18} color="#10B981" />
                        <Text style={styles.markRespondedText}>Marcar Respondida</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              )}

              {/* Expand Indicator */}
              <View style={styles.expandIndicator}>
                <Ionicons
                  name={expandedReview === review.id ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color="#94A3B8"
                />
              </View>
            </TouchableOpacity>
          ))
        )}
        
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Add Review Modal */}
      {showAddModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.addReviewModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Agregar Reseña Manual</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalContent}>
              <Text style={styles.inputLabel}>Nombre del cliente *</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="person-outline" size={20} color="#94A3B8" />
                <TextInput
                  style={styles.textInput}
                  placeholder="Nombre"
                  value={newReview.author_name}
                  onChangeText={(text) => setNewReview({...newReview, author_name: text})}
                />
              </View>

              <Text style={styles.inputLabel}>Calificación</Text>
              <View style={styles.ratingSelector}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <TouchableOpacity
                    key={star}
                    onPress={() => setNewReview({...newReview, rating: star})}
                  >
                    <Ionicons
                      name={star <= newReview.rating ? 'star' : 'star-outline'}
                      size={32}
                      color={star <= newReview.rating ? '#FBBF24' : '#CBD5E1'}
                    />
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>Texto de la reseña *</Text>
              <TextInput
                style={styles.textArea}
                placeholder={t('admin.writeReviewPlaceholder', 'Escribe la reseña...')}
                value={newReview.text}
                onChangeText={(text) => setNewReview({...newReview, text: text})}
                multiline
                numberOfLines={4}
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowAddModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveButton, addingReview && styles.saveButtonDisabled]}
                onPress={addReviewManually}
                disabled={addingReview}
              >
                {addingReview ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Ionicons name="add-circle" size={20} color="#fff" />
                    <Text style={styles.saveButtonText}>Agregar</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: 20,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleContainer: {
    flex: 1,
    marginLeft: 16,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  syncButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 10,
  },
  statCard: {
    flex: 1,
    padding: 12,
    borderRadius: 16,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
    marginTop: 6,
  },
  statLabel: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  filtersContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 12,
  },
  filterButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
  },
  filterButtonActive: {
    backgroundColor: '#6C1110',
    borderColor: '#6C1110',
  },
  filterButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  filterButtonTextActive: {
    color: '#fff',
  },
  filterBadge: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  filterBadgeActive: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  filterBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  filterBadgeTextActive: {
    color: '#fff',
  },
  googleButton: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  googleButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 10,
  },
  googleButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  reviewsList: {
    flex: 1,
  },
  reviewsListContent: {
    paddingHorizontal: 16,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748B',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 8,
    textAlign: 'center',
  },
  syncNowButton: {
    marginTop: 20,
    backgroundColor: '#6C1110',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  syncNowButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  reviewCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  reviewAuthor: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#6C1110',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  authorInfo: {
    marginLeft: 12,
    flex: 1,
  },
  authorName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
  },
  reviewDate: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  ratingContainer: {
    alignItems: 'flex-end',
  },
  starsRow: {
    flexDirection: 'row',
    gap: 2,
  },
  statusBadge: {
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusPending: {
    backgroundColor: '#FEF3C7',
  },
  statusResponded: {
    backgroundColor: '#D1FAE5',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  statusTextPending: {
    color: '#D97706',
  },
  statusTextResponded: {
    color: '#059669',
  },
  reviewText: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 22,
    fontStyle: 'italic',
  },
  expandedContent: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  suggestedResponseContainer: {
    backgroundColor: '#F5F3FF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  suggestedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  suggestedLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#7C3AED',
  },
  suggestedText: {
    fontSize: 13,
    color: '#4C1D95',
    lineHeight: 20,
    marginBottom: 12,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#8B5CF6',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 8,
  },
  copyButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  generateButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6C1110',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
  },
  generateButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  markRespondedButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D1FAE5',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
  },
  markRespondedText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#059669',
  },
  expandIndicator: {
    alignItems: 'center',
    marginTop: 8,
  },
  // Alert Banner styles
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FEF3C7',
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  alertContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  alertTextContainer: {
    marginLeft: 10,
    flex: 1,
  },
  alertTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400E',
  },
  alertSubtitle: {
    fontSize: 12,
    color: '#B45309',
    marginTop: 2,
  },
  addManualButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F59E0B',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  addManualButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
  // Modal styles
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  addReviewModal: {
    backgroundColor: '#fff',
    borderRadius: 20,
    width: '100%',
    maxWidth: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
  },
  modalContent: {
    padding: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 8,
    marginTop: 12,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
  },
  textInput: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    fontSize: 16,
    color: '#1E293B',
  },
  textArea: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    fontSize: 16,
    color: '#1E293B',
    minHeight: 100,
    textAlignVertical: 'top',
  },
  ratingSelector: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 8,
  },
  modalActions: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748B',
  },
  saveButton: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 14,
    backgroundColor: '#6C1110',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});

export default AdminReviewsScreen;
