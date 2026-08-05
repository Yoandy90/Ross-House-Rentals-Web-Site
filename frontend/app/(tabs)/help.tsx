import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import CustomHeader from '../../components/CustomHeader';
import api from '../../services/api';

interface FAQ {
  id: string;
  category_id: string;
  question: string;
  question_es: string;
  answer: string;
  answer_es: string;
  views: number;
  helpful_count: number;
  not_helpful_count: number;
}

interface Category {
  id: string;
  name: string;
  name_es: string;
  icon: string;
}

interface GroupedFAQ {
  category: Category;
  faqs: FAQ[];
  count: number;
}

export default function HelpScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [groupedFAQs, setGroupedFAQs] = useState<GroupedFAQ[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FAQ[]>([]);
  const [expandedFAQ, setExpandedFAQ] = useState<string | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  useEffect(() => {
    loadFAQs();
  }, []);

  const loadFAQs = async () => {
    try {
      setLoading(true);
      const response = await api.get('/faqs/grouped');
      setGroupedFAQs(response.data || []);
    } catch (error: any) {
      console.error('❌ Error loading FAQs:', error?.message || error);
      console.error('❌ Error details:', error?.response?.data || 'No details');
      // Set empty array to show empty state
      setGroupedFAQs([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    try {
      const response = await api.post('/faqs/search', {
        query,
        language: i18n.language === 'es' ? 'es' : 'en',
        limit: 10,
      });
      setSearchResults(response.data || []);
    } catch (error: any) {
      console.error('Error searching FAQs:', error?.message || error);
      setSearchResults([]);
    }
  };

  const handleFAQPress = async (faqId: string) => {
    if (expandedFAQ === faqId) {
      setExpandedFAQ(null);
    } else {
      setExpandedFAQ(faqId);
      // Increment view count
      try {
        await api.get(`/faqs/${faqId}`);
      } catch (error: any) {
        console.error('Error tracking FAQ view:', error?.message || error);
      }
    }
  };

  const handleFeedback = async (faqId: string, helpful: boolean) => {
    try {
      await api.post('/faqs/feedback', { faq_id: faqId, helpful });
    } catch (error: any) {
      console.error('Error submitting feedback:', error?.message || error);
    }
  };

  const toggleCategory = (categoryId: string) => {
    setExpandedCategory(expandedCategory === categoryId ? null : categoryId);
  };

  const getLocalizedText = (item: FAQ | Category, field: 'question' | 'answer' | 'name') => {
    const lang = i18n.language === 'es' ? 'es' : 'en';
    if (field === 'question') {
      return lang === 'es' ? (item as FAQ).question_es : (item as FAQ).question;
    } else if (field === 'answer') {
      return lang === 'es' ? (item as FAQ).answer_es : (item as FAQ).answer;
    } else if (field === 'name') {
      return lang === 'es' ? (item as Category).name_es : (item as Category).name;
    }
    return '';
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#dc2626" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CustomHeader title={t('help.title', 'Help & FAQs')} showBack={true} />

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder={t('help.search_placeholder', 'Search for help...')}
          value={searchQuery}
          onChangeText={handleSearch}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => {
            setSearchQuery('');
            setSearchResults([]);
          }}>
            <Ionicons name="close-circle" size={20} color="#666" />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView style={styles.content}>
        {searchQuery.length >= 2 && searchResults.length > 0 ? (
          // Search Results
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {t('help.search_results', 'Search Results')} ({searchResults.length})
            </Text>
            {searchResults.map((faq) => (
              <View key={faq.id} style={styles.faqCard}>
                <TouchableOpacity
                  style={styles.faqHeader}
                  onPress={() => handleFAQPress(faq.id)}
                >
                  <View style={styles.faqTitleContainer}>
                    <Text style={styles.faqQuestion}>{getLocalizedText(faq, 'question')}</Text>
                  </View>
                  <Ionicons
                    name={expandedFAQ === faq.id ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color="#666"
                  />
                </TouchableOpacity>
                {expandedFAQ === faq.id && (
                  <View style={styles.faqContent}>
                    <Text style={styles.faqAnswer}>{getLocalizedText(faq, 'answer')}</Text>
                    <View style={styles.feedbackContainer}>
                      <Text style={styles.feedbackQuestion}>{t('help.was_helpful', 'Was this helpful?')}</Text>
                      <View style={styles.feedbackButtons}>
                        <TouchableOpacity
                          style={styles.feedbackButton}
                          onPress={() => handleFeedback(faq.id, true)}
                        >
                          <Ionicons name="thumbs-up" size={18} color="#10b981" />
                          <Text style={styles.feedbackText}>{t('help.yes', 'Yes')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.feedbackButton}
                          onPress={() => handleFeedback(faq.id, false)}
                        >
                          <Ionicons name="thumbs-down" size={18} color="#dc2626" />
                          <Text style={styles.feedbackText}>{t('help.no', 'No')}</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                )}
              </View>
            ))}
          </View>
        ) : searchQuery.length >= 2 && searchResults.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="search-outline" size={64} color="#ccc" />
            <Text style={styles.emptyStateText}>{t('help.no_results', 'No results found')}</Text>
            <Text style={styles.emptyStateSubtext}>
              {t('help.try_different', 'Try a different search term')}
            </Text>
          </View>
        ) : groupedFAQs.length === 0 ? (
          // Empty state when no FAQs loaded
          <View style={styles.emptyState}>
            <Ionicons name="help-circle-outline" size={64} color="#ccc" />
            <Text style={styles.emptyStateText}>No hay preguntas disponibles</Text>
            <Text style={styles.emptyStateSubtext}>
              Por favor, intenta de nuevo más tarde
            </Text>
            <TouchableOpacity 
              style={styles.retryButton}
              onPress={loadFAQs}
            >
              <Text style={styles.retryButtonText}>Reintentar</Text>
            </TouchableOpacity>
          </View>
        ) : (
          // Grouped FAQs by Category
          groupedFAQs.map((group) => (
            <View key={group.category.id} style={styles.categorySection}>
              <TouchableOpacity
                style={styles.categoryHeader}
                onPress={() => toggleCategory(group.category.id)}
              >
                <View style={styles.categoryTitleContainer}>
                  <Text style={styles.categoryIcon}>{group.category.icon}</Text>
                  <Text style={styles.categoryTitle}>{getLocalizedText(group.category, 'name')}</Text>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{group.count}</Text>
                  </View>
                </View>
                <Ionicons
                  name={expandedCategory === group.category.id ? 'chevron-up' : 'chevron-down'}
                  size={24}
                  color="#666"
                />
              </TouchableOpacity>

              {expandedCategory === group.category.id && (
                <View style={styles.categoryContent}>
                  {group.faqs.map((faq) => (
                    <View key={faq.id} style={styles.faqCard}>
                      <TouchableOpacity
                        style={styles.faqHeader}
                        onPress={() => handleFAQPress(faq.id)}
                      >
                        <View style={styles.faqTitleContainer}>
                          <Text style={styles.faqQuestion}>{getLocalizedText(faq, 'question')}</Text>
                        </View>
                        <Ionicons
                          name={expandedFAQ === faq.id ? 'chevron-up' : 'chevron-down'}
                          size={20}
                          color="#666"
                        />
                      </TouchableOpacity>
                      {expandedFAQ === faq.id && (
                        <View style={styles.faqContent}>
                          <Text style={styles.faqAnswer}>{getLocalizedText(faq, 'answer')}</Text>
                          <View style={styles.feedbackContainer}>
                            <Text style={styles.feedbackQuestion}>{t('help.was_helpful', 'Was this helpful?')}</Text>
                            <View style={styles.feedbackButtons}>
                              <TouchableOpacity
                                style={styles.feedbackButton}
                                onPress={() => handleFeedback(faq.id, true)}
                              >
                                <Ionicons name="thumbs-up" size={18} color="#10b981" />
                                <Text style={styles.feedbackText}>{t('help.yes', 'Yes')}</Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={styles.feedbackButton}
                                onPress={() => handleFeedback(faq.id, false)}
                              >
                                <Ionicons name="thumbs-down" size={18} color="#dc2626" />
                                <Text style={styles.feedbackText}>{t('help.no', 'No')}</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        </View>
                      )}
                    </View>
                  ))}
                </View>
              )}
            </View>
          ))
        )}

        {/* Contact Support Section */}
        <View style={styles.supportSection}>
          <Text style={styles.supportTitle}>{t('help.still_need_help', 'Still need help?')}</Text>
          <Text style={styles.supportText}>
            {t('help.contact_us', 'Contact our support team')}
          </Text>
          <View style={styles.supportButtons}>
            <TouchableOpacity
              style={styles.supportButton}
              onPress={() => router.push('/(tabs)/support')}
            >
              <Ionicons name="chatbubble-ellipses" size={20} color="#dc2626" />
              <Text style={styles.supportButtonText}>{t('help.chat_support', 'Chat con Soporte')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.supportButton}
              onPress={() => {
                const emailUrl = 'mailto:info@rosstaxpreparation.com?subject=Ayuda%20-%20Ross%20Tax%20Preparation';
                Linking.canOpenURL(emailUrl).then(supported => {
                  if (supported) {
                    Linking.openURL(emailUrl);
                  } else {
                    // Fallback - try to open in browser
                    window.location.href = emailUrl;
                  }
                }).catch(err => {
                  console.error('Error opening email:', err);
                  window.location.href = emailUrl;
                });
              }}
            >
              <Ionicons name="mail" size={20} color="#dc2626" />
              <Text style={styles.supportButtonText}>{t('help.email_us', 'Envíanos un email')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.supportButton}
              onPress={() => {
                const phoneUrl = 'tel:+18069342018';
                Linking.canOpenURL(phoneUrl).then(supported => {
                  if (supported) {
                    Linking.openURL(phoneUrl);
                  } else {
                    window.location.href = phoneUrl;
                  }
                }).catch(err => {
                  console.error('Error opening phone:', err);
                  window.location.href = phoneUrl;
                });
              }}
            >
              <Ionicons name="call" size={20} color="#dc2626" />
              <Text style={styles.supportButtonText}>{t('help.call_us', 'Llámanos')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    backgroundColor: '#10B981',
    padding: 20,
    paddingTop: 60,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    margin: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 12,
  },
  categorySection: {
    marginBottom: 16,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  categoryTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  categoryIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  categoryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    flex: 1,
  },
  badge: {
    backgroundColor: '#fee2e2',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#dc2626',
  },
  categoryContent: {
    marginTop: 8,
  },
  faqCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  faqHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  faqTitleContainer: {
    flex: 1,
    marginRight: 12,
  },
  faqQuestion: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1f2937',
  },
  faqContent: {
    padding: 16,
    paddingTop: 0,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  faqAnswer: {
    fontSize: 14,
    color: '#4b5563',
    lineHeight: 22,
    marginBottom: 16,
  },
  feedbackContainer: {
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    paddingTop: 12,
  },
  feedbackQuestion: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 8,
  },
  feedbackButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  feedbackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  feedbackText: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#9ca3af',
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 8,
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#dc2626',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  supportSection: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    marginTop: 24,
    marginBottom: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  supportTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
  },
  supportText: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 16,
    textAlign: 'center',
  },
  supportButtons: {
    flexDirection: 'column',
    gap: 12,
    width: '100%',
  },
  supportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#dc2626',
  },
  supportButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#dc2626',
  },
});
