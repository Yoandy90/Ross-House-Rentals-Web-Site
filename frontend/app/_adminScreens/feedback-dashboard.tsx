import React, { useState, useEffect, useCallback } from 'react';
import AdminHeader from '../../components/admin/AdminHeader';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useThemeColors } from '../../constants/colors';
import api from '../../services/api';

export default function FeedbackDashboard() {
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [feedbackList, setFeedbackList] = useState<any[]>([]);
  const [filter, setFilter] = useState('all'); // all, pending, approved, published

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Load feedbacks with stats - using correct endpoint with 's'
      const response = await api.get('/admin/feedbacks', {
        params: filter !== 'all' ? { status: filter } : {}
      });
      
      // Set stats from response
      if (response.data.stats) {
        setStats({
          total_reviews: response.data.stats.total || 0,
          average_rating: response.data.stats.average_rating || 0,
          response_rate: 0,
          pending_count: response.data.stats.pending || 0,
          five_star: 0,
          four_star: 0,
          three_star: 0,
          two_star: 0,
          one_star: 0,
        });
      }
      
      // Set feedback list
      setFeedbackList(response.data.feedbacks || []);
    } catch (error) {
      console.error('Error loading feedback:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const renderStars = (rating: number) => {
    return (
      <View style={styles.starsRow}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Ionicons
            key={star}
            name={star <= rating ? 'star' : 'star-outline'}
            size={16}
            color={star <= rating ? '#FFD700' : '#ddd'}
          />
        ))}
      </View>
    );
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.container}>
        <AdminHeader title="Feedback de Clientes" showBack />
        <View style={styles.loadingContent}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Cargando feedback...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AdminHeader title="Feedback de Clientes" showBack />
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
          {/* Header */}
          <LinearGradient
            colors={['#4ECDC4', '#44A08D']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.header}
          >
            <View style={styles.headerContent}>
              <View>
                <Text style={styles.headerTitle}>Dashboard de Reseñas</Text>
                <Text style={styles.headerSubtitle}>
                  Gestión y análisis de feedback
                </Text>
              </View>
              <Ionicons name="star" size={48} color="rgba(255,255,255,0.9)" />
            </View>
          </LinearGradient>

          {/* Stats Cards */}
          {stats && (
            <View style={styles.statsContainer}>
              <View style={styles.statsRow}>
                <View style={styles.statCard}>
                  <Ionicons name="star" size={32} color="#FFD700" />
                  <Text style={styles.statValue}>{stats.average_rating.toFixed(1)}</Text>
                  <Text style={styles.statLabel}>Promedio</Text>
                </View>
                
                <View style={styles.statCard}>
                  <Ionicons name="chatbubbles" size={32} color={colors.primary} />
                  <Text style={styles.statValue}>{stats.total_reviews}</Text>
                  <Text style={styles.statLabel}>Total Reseñas</Text>
                </View>
                
                <View style={styles.statCard}>
                  <Ionicons name="checkmark-circle" size={32} color="#51cf66" />
                  <Text style={styles.statValue}>{stats.response_rate}%</Text>
                  <Text style={styles.statLabel}>Tasa Respuesta</Text>
                </View>
                
                <View style={styles.statCard}>
                  <Ionicons name="time" size={32} color="#ff6b6b" />
                  <Text style={styles.statValue}>{stats.pending_count}</Text>
                  <Text style={styles.statLabel}>Pendientes</Text>
                </View>
              </View>

              {/* Rating Distribution */}
              <View style={styles.distributionCard}>
                <Text style={styles.distributionTitle}>Distribución de Calificaciones</Text>
                {[5, 4, 3, 2, 1].map((rating) => {
                  const count = stats[`${['five', 'four', 'three', 'two', 'one'][5 - rating]}_star`] || 0;
                  const percentage = stats.total_reviews > 0 ? (count / stats.total_reviews) * 100 : 0;
                  
                  return (
                    <View key={rating} style={styles.distributionRow}>
                      <Text style={styles.distributionLabel}>{rating} ⭐</Text>
                      <View style={styles.distributionBar}>
                        <View 
                          style={[
                            styles.distributionFill, 
                            { width: `${percentage}%`, backgroundColor: colors.primary }
                          ]} 
                        />
                      </View>
                      <Text style={styles.distributionCount}>{count}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* Filters */}
          <View style={styles.filtersContainer}>
            {['all', 'pending', 'approved', 'published'].map((f) => (
              <TouchableOpacity
                key={f}
                style={[styles.filterButton, filter === f && styles.filterButtonActive]}
                onPress={() => setFilter(f)}
              >
                <Text style={[styles.filterButtonText, filter === f && styles.filterButtonTextActive]}>
                  {f === 'all' && 'Todas'}
                  {f === 'pending' && 'Pendientes'}
                  {f === 'approved' && 'Aprobadas'}
                  {f === 'published' && 'Publicadas'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Feedback List */}
          <View style={styles.feedbackList}>
            {feedbackList.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="chatbubble-outline" size={64} color={colors.textGray} />
                <Text style={styles.emptyText}>No hay reseñas {filter !== 'all' && `(${filter})`}</Text>
              </View>
            ) : (
              feedbackList.map((feedback) => (
                <View key={feedback.id} style={styles.feedbackCard}>
                  <View style={styles.feedbackHeader}>
                    <View style={styles.feedbackUser}>
                      <Ionicons name="person-circle" size={40} color={colors.primary} />
                      <View style={styles.feedbackUserInfo}>
                        <Text style={styles.feedbackUserName}>{feedback.user_name}</Text>
                        <Text style={styles.feedbackDate}>
                          {new Date(feedback.created_at).toLocaleDateString('es', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </Text>
                      </View>
                    </View>
                    {renderStars(feedback.rating)}
                  </View>

                  {feedback.comment && (
                    <Text style={styles.feedbackComment}>&ldquo;{feedback.comment}&rdquo;</Text>
                  )}

                  <View style={styles.feedbackFooter}>
                    <View style={styles.feedbackBadges}>
                      <View style={[
                        styles.statusBadge,
                        feedback.status === 'approved' && styles.statusBadgeApproved,
                        feedback.status === 'pending' && styles.statusBadgePending,
                        feedback.status === 'published' && styles.statusBadgePublished,
                      ]}>
                        <Text style={styles.statusBadgeText}>
                          {feedback.status === 'pending' && '⏳ Pendiente'}
                          {feedback.status === 'approved' && '✓ Aprobada'}
                          {feedback.status === 'published' && '🌐 Publicada'}
                        </Text>
                      </View>
                      
                      {feedback.publish_to_google && (
                        <View style={styles.googleBadge}>
                          <Ionicons name="logo-google" size={12} color="white" />
                          <Text style={styles.googleBadgeText}>Google</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              ))
            )}
          </View>
        </ScrollView>
    </View>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      flex: 1,
    },
    loadingContent: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingText: {
      marginTop: 12,
      color: colors.textSecondary,
    },
    header: {
      padding: 24,
    },
    headerContent: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    headerTitle: {
      fontSize: 28,
      fontWeight: '800',
      color: 'white',
    },
    headerSubtitle: {
      fontSize: 14,
      color: 'rgba(255,255,255,0.9)',
      marginTop: 4,
    },
    statsContainer: {
      padding: 20,
    },
    statsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 16,
      marginBottom: 20,
    },
    statCard: {
      flex: 1,
      minWidth: 150,
      backgroundColor: colors.background,
      padding: 20,
      borderRadius: 16,
      alignItems: 'center',
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
        },
        android: {
          elevation: 4,
        },
        web: {
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        },
      }),
    },
    statValue: {
      fontSize: 32,
      fontWeight: '800',
      color: colors.text,
      marginTop: 8,
    },
    statLabel: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 4,
    },
    distributionCard: {
      backgroundColor: colors.background,
      padding: 20,
      borderRadius: 16,
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
        },
        android: {
          elevation: 4,
        },
      }),
    },
    distributionTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 16,
    },
    distributionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
      gap: 12,
    },
    distributionLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      width: 40,
    },
    distributionBar: {
      flex: 1,
      height: 20,
      backgroundColor: colors.backgroundGray,
      borderRadius: 10,
      overflow: 'hidden',
    },
    distributionFill: {
      height: '100%',
      borderRadius: 10,
    },
    distributionCount: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
      width: 30,
      textAlign: 'right',
    },
    filtersContainer: {
      flexDirection: 'row',
      padding: 20,
      gap: 12,
      flexWrap: 'wrap',
    },
    filterButton: {
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    filterButtonActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    filterButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    filterButtonTextActive: {
      color: 'white',
    },
    feedbackList: {
      padding: 20,
      gap: 16,
    },
    emptyState: {
      padding: 40,
      alignItems: 'center',
    },
    emptyText: {
      fontSize: 16,
      color: colors.textGray,
      marginTop: 16,
    },
    feedbackCard: {
      backgroundColor: colors.background,
      padding: 20,
      borderRadius: 16,
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
        },
        android: {
          elevation: 4,
        },
      }),
    },
    feedbackHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    feedbackUser: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    feedbackUserInfo: {
      gap: 2,
    },
    feedbackUserName: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
    },
    feedbackDate: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    starsRow: {
      flexDirection: 'row',
      gap: 2,
    },
    feedbackComment: {
      fontSize: 15,
      color: colors.text,
      lineHeight: 22,
      fontStyle: 'italic',
      marginBottom: 12,
    },
    feedbackFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 8,
    },
    feedbackBadges: {
      flexDirection: 'row',
      gap: 8,
    },
    statusBadge: {
      paddingVertical: 4,
      paddingHorizontal: 12,
      borderRadius: 12,
      backgroundColor: colors.backgroundGray,
    },
    statusBadgePending: {
      backgroundColor: '#fff3cd',
    },
    statusBadgeApproved: {
      backgroundColor: '#d1e7dd',
    },
    statusBadgePublished: {
      backgroundColor: '#cfe2ff',
    },
    statusBadgeText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.text,
    },
    googleBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: 4,
      paddingHorizontal: 12,
      borderRadius: 12,
      backgroundColor: '#4285F4',
    },
    googleBadgeText: {
      fontSize: 12,
      fontWeight: '600',
      color: 'white',
    },
  });
