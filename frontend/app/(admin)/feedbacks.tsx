/**
 * Feedbacks Management Screen
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import api from '../../services/api';

export default function FeedbacksScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadFeedbacks();
  }, []);

  const loadFeedbacks = async () => {
    try {
      const response = await api.get('/admin/feedbacks');
      setFeedbacks(response.data.feedbacks || response.data || []);
    } catch (error) {
      console.error('Error loading feedbacks:', error);
      setFeedbacks([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const renderStars = (rating: number) => {
    return Array(5).fill(0).map((_, i) => (
      <Ionicons key={i} name={i < rating ? 'star' : 'star-outline'} size={16} color="#F59E0B" />
    ));
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6C1110" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#F59E0B', '#D97706']}
        style={[styles.header, { paddingTop: insets.top + 8 }]}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Ionicons name="chatbubble-ellipses" size={24} color="#FFF" />
            <Text style={styles.headerTitle}>Feedbacks</Text>
          </View>
          <View style={styles.statBadge}>
            <Text style={styles.statText}>{feedbacks.length}</Text>
          </View>
        </View>
      </LinearGradient>

      <FlatList
        data={feedbacks}
        keyExtractor={(item, index) => item.id || item._id || index.toString()}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadFeedbacks} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="chatbubble-outline" size={64} color="#D1D5DB" />
            <Text style={styles.emptyText}>No hay feedbacks todavía</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.feedbackCard}>
            <View style={styles.feedbackHeader}>
              <View style={styles.userInfo}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{(item.user_name || 'U').charAt(0)}</Text>
                </View>
                <View>
                  <Text style={styles.userName}>{item.user_name || 'Usuario'}</Text>
                  <Text style={styles.userEmail}>{item.user_email || ''}</Text>
                </View>
              </View>
              <View style={styles.ratingContainer}>
                {renderStars(item.rating || 0)}
              </View>
            </View>
            <Text style={styles.feedbackText}>{item.message || item.comment || 'Sin comentario'}</Text>
            <Text style={styles.feedbackDate}>{item.created_at || ''}</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { paddingBottom: 16, borderBottomLeftRadius: 20, borderBottomRightRadius: 20 },
  headerContent: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#FFF' },
  statBadge: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  statText: { color: '#FFF', fontWeight: '700' },
  listContent: { padding: 16 },
  feedbackCard: { backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8 },
  feedbackHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  userInfo: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#6C1110', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarText: { color: '#FFF', fontWeight: '700', fontSize: 16 },
  userName: { fontSize: 15, fontWeight: '600', color: '#1F2937' },
  userEmail: { fontSize: 12, color: '#6B7280' },
  ratingContainer: { flexDirection: 'row', gap: 2 },
  feedbackText: { fontSize: 14, color: '#4B5563', lineHeight: 20 },
  feedbackDate: { fontSize: 11, color: '#9CA3AF', marginTop: 8 },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 16, color: '#6B7280', marginTop: 16 },
});
