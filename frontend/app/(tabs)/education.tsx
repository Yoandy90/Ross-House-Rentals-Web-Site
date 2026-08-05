/**
 * Education Screen - Complete Redesign
 * Features:
 * - Modern card design with images
 * - Favorites/Bookmarks
 * - Progress tracking (completed articles)
 * - Video support (YouTube)
 * - Search and filters
 * - User progress stats
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  TextInput,
  Image,
  Dimensions,
  RefreshControl,
  Linking,
  Alert,
  StatusBar,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from 'expo-router';
import { WebView } from 'react-native-webview';
import { useThemeColors } from '../../constants/colors';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Default cover images for articles by category
const CATEGORY_IMAGES: { [key: string]: string } = {
  'basics': 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=400',
  'deductions': 'https://images.unsplash.com/photo-1554224154-26032ffc0d07?w=400',
  'credits': 'https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?w=400',
  'filing': 'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=400',
  'business': 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400',
  'default': 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=400',
};

interface Article {
  id: string;
  title: string;
  title_es: string;
  summary: string;
  summary_es: string;
  content: string;
  content_es: string;
  level: string;
  estimated_read_time: number;
  cover_image?: string;
  video_url?: string;
  category_id: string;
  views: number;
  likes: number;
  is_bookmarked?: boolean;
  is_completed?: boolean;
}

interface Category {
  id: string;
  name: string;
  name_es: string;
  icon: string;
  description?: string;
  article_count?: number;
}

interface UserProgress {
  completed_articles: string[];
  bookmarked_articles: string[];
  total_completed: number;
  total_bookmarked: number;
}

export default function EducationScreen() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [groupedArticles, setGroupedArticles] = useState<any[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [userProgress, setUserProgress] = useState<UserProgress | null>(null);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  
  // Article detail modal
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [articleLoading, setArticleLoading] = useState(false);

  const isSpanish = i18n.language === 'es';

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const loadData = async () => {
    try {
      // Load grouped articles
      const articlesRes = await api.get('/educational/articles/grouped');
      setGroupedArticles(articlesRes.data || []);
      
      // Extract categories
      const cats = (articlesRes.data || []).map((g: any) => g.category);
      setCategories(cats);
      
      // Load user progress if logged in
      if (user?.id) {
        try {
          const progressRes = await api.get(`/educational/user/${user.id}/progress`);
          setUserProgress(progressRes.data);
        } catch (e) {
        }
      }
    } catch (error) {
      console.error('Error loading education:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const openArticleDetail = async (article: Article) => {
    setSelectedArticle(article);
    setModalVisible(true);
    setArticleLoading(true);
    
    try {
      // Fetch full article details
      const response = await api.get(`/educational/articles/${article.id}`);
      setSelectedArticle(response.data);
    } catch (error) {
      console.error('Error loading article:', error);
    } finally {
      setArticleLoading(false);
    }
  };

  const closeArticleDetail = () => {
    setModalVisible(false);
    setSelectedArticle(null);
  };

  const toggleBookmark = async (articleId: string) => {
    if (!user?.id) {
      Alert.alert(t('education.loginRequired'), t('education.loginToSave'));
      return;
    }
    
    try {
      await api.post('/educational/article/bookmark', {
        article_id: articleId,
        user_id: user.id,
      });
      
      // Update local state
      setUserProgress(prev => {
        if (!prev) return { completed_articles: [], bookmarked_articles: [articleId], total_completed: 0, total_bookmarked: 1 };
        const isBookmarked = prev.bookmarked_articles.includes(articleId);
        return {
          ...prev,
          bookmarked_articles: isBookmarked 
            ? prev.bookmarked_articles.filter(id => id !== articleId)
            : [...prev.bookmarked_articles, articleId],
          total_bookmarked: isBookmarked ? prev.total_bookmarked - 1 : prev.total_bookmarked + 1,
        };
      });
    } catch (error) {
      console.error('Error toggling bookmark:', error);
    }
  };

  const markAsComplete = async (articleId: string) => {
    if (!user?.id) return;
    
    try {
      await api.post('/educational/article/complete', {
        article_id: articleId,
        user_id: user.id,
      });
      
      // Update local state
      setUserProgress(prev => {
        if (!prev) return { completed_articles: [articleId], bookmarked_articles: [], total_completed: 1, total_bookmarked: 0 };
        if (prev.completed_articles.includes(articleId)) return prev;
        return {
          ...prev,
          completed_articles: [...prev.completed_articles, articleId],
          total_completed: prev.total_completed + 1,
        };
      });
      
      Alert.alert(t('education.completedAlert'), t('education.articleMarkedRead'));
    } catch (error) {
      console.error('Error marking complete:', error);
    }
  };

  const likeArticle = async (articleId: string) => {
    if (!user?.id) return;
    
    try {
      await api.post('/educational/article/like', {
        article_id: articleId,
        user_id: user.id,
      });
    } catch (error) {
      console.error('Error liking article:', error);
    }
  };

  const getDifficultyColor = (level: string) => {
    switch(level) {
      case 'beginner': return '#10B981';
      case 'intermediate': return '#F59E0B';
      case 'advanced': return '#EF4444';
      default: return '#6B7280';
    }
  };

  const getDifficultyLabel = (level: string) => {
    switch(level) {
      case 'beginner': return t('educationScreen.beginner');
      case 'intermediate': return t('educationScreen.intermediate');
      case 'advanced': return t('educationScreen.advanced');
      default: return level;
    }
  };

  const isBookmarked = (articleId: string) => {
    return userProgress?.bookmarked_articles?.includes(articleId) || false;
  };

  const isCompleted = (articleId: string) => {
    return userProgress?.completed_articles?.includes(articleId) || false;
  };

  const getYouTubeVideoId = (url: string) => {
    const match = url?.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
    return match ? match[1] : null;
  };

  // Filter articles
  const getFilteredArticles = () => {
    let filtered = [...groupedArticles];
    
    if (selectedCategory) {
      filtered = filtered.filter(g => g.category.id === selectedCategory);
    }
    
    if (selectedLevel) {
      filtered = filtered.map(g => ({
        ...g,
        articles: g.articles.filter((a: Article) => a.level === selectedLevel)
      })).filter(g => g.articles.length > 0);
    }
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.map(g => ({
        ...g,
        articles: g.articles.filter((a: Article) => {
          const title = i18n.language === 'es' ? a.title_es : a.title;
          const summary = i18n.language === 'es' ? a.summary_es : a.summary;
          return title?.toLowerCase().includes(query) || summary?.toLowerCase().includes(query);
        })
      })).filter(g => g.articles.length > 0);
    }
    
    return filtered;
  };

  const totalArticles = groupedArticles.reduce((sum, g) => sum + g.articles.length, 0);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Cargando contenido...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={['#064E3B', '#065F46', '#047857']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <SafeAreaView edges={['top']}>
          <View style={styles.headerContent}>
            <View style={styles.headerTop}>
              <View style={styles.headerIconBg}>
                <Ionicons name="school" size={28} color="#fff" />
              </View>
              <View style={styles.headerTextContainer}>
                <Text style={styles.headerTitle}>
                  {t('education.title')}
                </Text>
                <Text style={styles.headerSubtitle}>
                  {totalArticles} {t('education.articlesAvailable')}
                </Text>
              </View>
            </View>

            {/* Progress Stats */}
            {userProgress && (
              <View style={styles.progressStats}>
                <View style={styles.progressItem}>
                  <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                  <Text style={styles.progressNumber}>{userProgress.total_completed || 0}</Text>
                  <Text style={styles.progressLabel}>{t('education.completed')}</Text>
                </View>
                <View style={styles.progressDivider} />
                <View style={styles.progressItem}>
                  <Ionicons name="bookmark" size={18} color="#F59E0B" />
                  <Text style={styles.progressNumber}>{userProgress.total_bookmarked || 0}</Text>
                  <Text style={styles.progressLabel}>{t('education.saved')}</Text>
                </View>
                <View style={styles.progressDivider} />
                <View style={styles.progressItem}>
                  <Ionicons name="library" size={18} color="#3B82F6" />
                  <Text style={styles.progressNumber}>{totalArticles}</Text>
                  <Text style={styles.progressLabel}>Total</Text>
                </View>
              </View>
            )}

            {/* Search Bar */}
            <View style={styles.searchContainer}>
              <Ionicons name="search" size={20} color="rgba(255,255,255,0.6)" />
              <TextInput
                style={styles.searchInput}
                placeholder={t('education.searchPlaceholder')}
                placeholderTextColor="rgba(255,255,255,0.5)"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={20} color="rgba(255,255,255,0.6)" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* Category Filters */}
      <View style={styles.filtersContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          <TouchableOpacity
            style={[styles.filterChip, !selectedCategory && styles.filterChipActive]}
            onPress={() => setSelectedCategory(null)}
          >
            <Text style={[styles.filterChipText, !selectedCategory && styles.filterChipTextActive]}>
              {t('education.all')}
            </Text>
          </TouchableOpacity>
          {categories.map(cat => (
            <TouchableOpacity
              key={cat.id}
              style={[styles.filterChip, selectedCategory === cat.id && styles.filterChipActive]}
              onPress={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)}
            >
              <Text style={styles.filterChipIcon}>{cat.icon}</Text>
              <Text style={[styles.filterChipText, selectedCategory === cat.id && styles.filterChipTextActive]}>
                {i18n.language === 'es' ? cat.name_es : cat.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Level Filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.levelFilterScroll}>
          {['beginner', 'intermediate', 'advanced'].map(level => (
            <TouchableOpacity
              key={level}
              style={[
                styles.levelChip,
                selectedLevel === level && { backgroundColor: getDifficultyColor(level) }
              ]}
              onPress={() => setSelectedLevel(selectedLevel === level ? null : level)}
            >
              <Text style={[
                styles.levelChipText,
                selectedLevel === level && styles.levelChipTextActive
              ]}>
                {getDifficultyLabel(level)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Articles List */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
        }
        showsVerticalScrollIndicator={false}
      >
        {getFilteredArticles().map((group: any) => (
          <View key={group.category.id} style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionIcon}>{group.category.icon}</Text>
              <Text style={styles.sectionTitle}>
                {i18n.language === 'es' ? group.category.name_es : group.category.name}
              </Text>
              <View style={styles.sectionBadge}>
                <Text style={styles.sectionBadgeText}>{group.articles.length}</Text>
              </View>
            </View>
            
            {group.articles.map((article: Article) => (
              <TouchableOpacity
                key={article.id}
                style={styles.articleCard}
                onPress={() => openArticleDetail(article)}
                activeOpacity={0.7}
              >
                {/* Cover Image */}
                <Image
                  source={{ uri: article.cover_image || CATEGORY_IMAGES[group.category.id] || CATEGORY_IMAGES.default }}
                  style={styles.articleImage}
                />
                
                {/* Video Badge */}
                {article.video_url && (
                  <View style={styles.videoBadge}>
                    <Ionicons name="play-circle" size={16} color="#fff" />
                    <Text style={styles.videoBadgeText}>Video</Text>
                  </View>
                )}
                
                {/* Completed Badge */}
                {isCompleted(article.id) && (
                  <View style={styles.completedBadge}>
                    <Ionicons name="checkmark-circle" size={16} color="#fff" />
                  </View>
                )}

                <View style={styles.articleContent}>
                  <Text style={styles.articleTitle} numberOfLines={2}>
                    {i18n.language === 'es' ? article.title_es : article.title}
                  </Text>
                  <Text style={styles.articleSummary} numberOfLines={2}>
                    {i18n.language === 'es' ? article.summary_es : article.summary}
                  </Text>
                  
                  <View style={styles.articleMeta}>
                    <View style={styles.articleMetaLeft}>
                      <View style={[styles.levelTag, { backgroundColor: getDifficultyColor(article.level) + '20' }]}>
                        <Text style={[styles.levelTagText, { color: getDifficultyColor(article.level) }]}>
                          {getDifficultyLabel(article.level)}
                        </Text>
                      </View>
                      {article.estimated_read_time && (
                        <Text style={styles.readTime}>
                          📖 {article.estimated_read_time} min
                        </Text>
                      )}
                    </View>
                    
                    <TouchableOpacity
                      style={styles.bookmarkButton}
                      onPress={(e) => {
                        e.stopPropagation();
                        toggleBookmark(article.id);
                      }}
                    >
                      <Ionicons
                        name={isBookmarked(article.id) ? 'bookmark' : 'bookmark-outline'}
                        size={22}
                        color={isBookmarked(article.id) ? '#F59E0B' : '#9CA3AF'}
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        ))}

        {getFilteredArticles().length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="search" size={48} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>
              {t('education.noArticlesFound')}
            </Text>
            <Text style={styles.emptyText}>
              {t('education.tryAnotherSearch')}
            </Text>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Article Detail Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        onRequestClose={closeArticleDetail}
        statusBarTranslucent={false}
      >
        <View style={[styles.modalContainer, { paddingTop: insets.top }]}>
          <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
          {selectedArticle && (
            <>
              {/* Modal Header */}
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={closeArticleDetail} style={styles.modalBackButton}>
                  <Ionicons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <View style={styles.modalHeaderActions}>
                  <TouchableOpacity
                    style={styles.modalActionButton}
                    onPress={() => toggleBookmark(selectedArticle.id)}
                  >
                    <Ionicons
                      name={isBookmarked(selectedArticle.id) ? 'bookmark' : 'bookmark-outline'}
                      size={24}
                      color={isBookmarked(selectedArticle.id) ? '#F59E0B' : colors.text}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.modalActionButton}
                    onPress={() => likeArticle(selectedArticle.id)}
                  >
                    <Ionicons name="heart-outline" size={24} color={colors.text} />
                  </TouchableOpacity>
                </View>
              </View>

              <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
                {/* Cover Image or Video */}
                {selectedArticle.video_url ? (
                  <View style={styles.videoContainer}>
                    <WebView
                      source={{ uri: `https://www.youtube.com/embed/${getYouTubeVideoId(selectedArticle.video_url)}` }}
                      style={styles.videoPlayer}
                      allowsFullscreenVideo
                    />
                  </View>
                ) : (
                  <Image
                    source={{ uri: selectedArticle.cover_image || CATEGORY_IMAGES.default }}
                    style={styles.modalCoverImage}
                  />
                )}

                <View style={styles.modalContent}>
                  {/* Meta Info */}
                  <View style={styles.modalMeta}>
                    <View style={[styles.levelTag, { backgroundColor: getDifficultyColor(selectedArticle.level) + '20' }]}>
                      <Text style={[styles.levelTagText, { color: getDifficultyColor(selectedArticle.level) }]}>
                        {getDifficultyLabel(selectedArticle.level)}
                      </Text>
                    </View>
                    {selectedArticle.estimated_read_time && (
                      <Text style={styles.modalReadTime}>
                        📖 {selectedArticle.estimated_read_time} min de lectura
                      </Text>
                    )}
                    <Text style={styles.modalViews}>
                      👁️ {selectedArticle.views || 0} vistas
                    </Text>
                  </View>

                  {/* Title */}
                  <Text style={styles.modalTitle}>
                    {i18n.language === 'es' ? selectedArticle.title_es : selectedArticle.title}
                  </Text>

                  {/* Summary */}
                  <Text style={styles.modalSummary}>
                    {i18n.language === 'es' ? selectedArticle.summary_es : selectedArticle.summary}
                  </Text>

                  {/* Content */}
                  {articleLoading ? (
                    <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 20 }} />
                  ) : (
                    <Text style={styles.modalBody}>
                      {i18n.language === 'es' ? selectedArticle.content_es : selectedArticle.content}
                    </Text>
                  )}

                  {/* Complete Button */}
                  {!isCompleted(selectedArticle.id) && (
                    <TouchableOpacity
                      style={styles.completeButton}
                      onPress={() => markAsComplete(selectedArticle.id)}
                    >
                      <Ionicons name="checkmark-circle" size={24} color="#fff" />
                      <Text style={styles.completeButtonText}>
                        {t('education.markComplete')}
                      </Text>
                    </TouchableOpacity>
                  )}

                  {isCompleted(selectedArticle.id) && (
                    <View style={styles.completedMessage}>
                      <Ionicons name="checkmark-done-circle" size={24} color="#10B981" />
                      <Text style={styles.completedMessageText}>
                        {t('education.alreadyCompleted')}
                      </Text>
                    </View>
                  )}
                </View>
              </ScrollView>
            </>
          )}
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
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.backgroundGray,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: colors.textGray,
  },
  // Header
  header: {
    paddingBottom: 16,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerIconBg: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTextContainer: {
    marginLeft: 14,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  // Progress Stats
  progressStats: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  progressItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  progressNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  progressLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
  },
  progressDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginHorizontal: 8,
  },
  // Search
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#fff',
  },
  // Filters
  filtersContainer: {
    backgroundColor: colors.background,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  filterScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.backgroundGray,
    gap: 6,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
  },
  filterChipIcon: {
    fontSize: 14,
  },
  filterChipText: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: '#fff',
  },
  levelFilterScroll: {
    paddingHorizontal: 16,
    paddingTop: 10,
    gap: 8,
  },
  levelChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: colors.backgroundGray,
  },
  levelChipText: {
    fontSize: 12,
    color: colors.textGray,
    fontWeight: '600',
  },
  levelChipTextActive: {
    color: '#fff',
  },
  // Scroll
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  // Sections
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  sectionIcon: {
    fontSize: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    flex: 1,
  },
  sectionBadge: {
    backgroundColor: colors.primary + '15',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  sectionBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  // Article Card
  articleCard: {
    backgroundColor: colors.background,
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  articleImage: {
    width: '100%',
    height: 140,
    backgroundColor: colors.backgroundGray,
  },
  videoBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EF4444',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  videoBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  completedBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: '#10B981',
    padding: 6,
    borderRadius: 20,
  },
  articleContent: {
    padding: 14,
  },
  articleTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 6,
  },
  articleSummary: {
    fontSize: 14,
    color: colors.textGray,
    lineHeight: 20,
    marginBottom: 12,
  },
  articleMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  articleMetaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  levelTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  levelTagText: {
    fontSize: 12,
    fontWeight: '600',
  },
  readTime: {
    fontSize: 12,
    color: colors.textGray,
  },
  bookmarkButton: {
    padding: 6,
  },
  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textGray,
    marginTop: 8,
  },
  // Modal
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalBackButton: {
    padding: 8,
  },
  modalHeaderActions: {
    flexDirection: 'row',
    gap: 8,
  },
  modalActionButton: {
    padding: 8,
  },
  modalScroll: {
    flex: 1,
  },
  videoContainer: {
    width: '100%',
    height: 220,
    backgroundColor: '#000',
  },
  videoPlayer: {
    flex: 1,
  },
  modalCoverImage: {
    width: '100%',
    height: 200,
    backgroundColor: colors.backgroundGray,
  },
  modalContent: {
    padding: 20,
  },
  modalMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  modalReadTime: {
    fontSize: 13,
    color: colors.textGray,
  },
  modalViews: {
    fontSize: 13,
    color: colors.textGray,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 12,
    lineHeight: 32,
  },
  modalSummary: {
    fontSize: 16,
    color: colors.textGray,
    lineHeight: 24,
    marginBottom: 20,
    fontStyle: 'italic',
  },
  modalBody: {
    fontSize: 16,
    color: colors.text,
    lineHeight: 26,
  },
  completeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#10B981',
    paddingVertical: 16,
    borderRadius: 14,
    marginTop: 32,
  },
  completeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  completedMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#10B98115',
    paddingVertical: 16,
    borderRadius: 14,
    marginTop: 32,
  },
  completedMessageText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#10B981',
  },
});
