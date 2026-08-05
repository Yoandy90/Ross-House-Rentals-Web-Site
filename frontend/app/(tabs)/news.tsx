import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Modal } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import CustomHeader from '../../components/CustomHeader';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8001';

export default function NewsScreen() {
  const { t, i18n } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [news, setNews] = useState([]);
  const [filter, setFilter] = useState('all');
  const [selectedNews, setSelectedNews] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    loadNews();
  }, [filter]);

  const loadNews = async () => {
    try {
      const url = filter === 'high' 
        ? `${BACKEND_URL}/api/news/high-impact`
        : `${BACKEND_URL}/api/news/?limit=20`;
      const response = await fetch(url);
      const data = await response.json();
      setNews(data);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const getImpactColor = (level: string) => {
    const colors = { high: '#dc2626', medium: '#f59e0b', low: '#10b981' };
    return colors[level] || '#6b7280';
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Hoy';
    if (diffDays === 1) return 'Ayer';
    if (diffDays < 7) return `Hace ${diffDays} días`;
    return date.toLocaleDateString('es-ES', { month: 'short', day: 'numeric' });
  };

  const openNewsDetail = (newsItem: any) => {
    setSelectedNews(newsItem);
    setModalVisible(true);
  };

  const closeNewsDetail = () => {
    setModalVisible(false);
    setSelectedNews(null);
  };

  if (loading) {
    return <View style={styles.container}><ActivityIndicator size="large" color="#dc2626" /></View>;
  }

  return (
    <View style={styles.container}>
      <CustomHeader title={t('profile.news')} showBack={true} />

      <View style={styles.filters}>
        <TouchableOpacity
          style={[styles.filterChip, filter === 'all' && styles.filterChipActive]}
          onPress={() => setFilter('all')}
        >
          <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>Todas</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterChip, filter === 'high' && styles.filterChipActive]}
          onPress={() => setFilter('high')}
        >
          <Text style={[styles.filterText, filter === 'high' && styles.filterTextActive]}>Alto Impacto</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {news.map((item) => (
          <TouchableOpacity key={item.id} onPress={() => openNewsDetail(item)}>
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={[styles.impactBadge, { backgroundColor: getImpactColor(item.impact_level) }]}>
                  <Text style={styles.impactText}>{item.impact_level}</Text>
                </View>
                <Text style={styles.date}>{formatDate(item.published_at)}</Text>
              </View>
              <Text style={styles.title}>{i18n.language === 'es' ? item.title_es : item.title}</Text>
              {item.summary && (
                <Text style={styles.summary} numberOfLines={2}>
                  {i18n.language === 'es' ? item.summary_es : item.summary}
                </Text>
              )}
              <View style={styles.meta}>
                <Text style={styles.metaText}>👁 {item.views} vistas</Text>
                {item.source && <Text style={styles.metaText}>📋 {item.source}</Text>}
              </View>
              <View style={styles.readMoreContainer}>
                <Text style={styles.readMoreText}>
                  {t('newsScreen.readMore')} →
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Modal para mostrar contenido completo */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        onRequestClose={closeNewsDetail}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={closeNewsDetail} style={styles.closeButton}>
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.modalHeaderTitle}>
              {i18n.language === 'es' ? 'Noticia Completa' : 'Full Article'}
            </Text>
          </View>

          {selectedNews && (
            <ScrollView style={styles.modalContent}>
              <View style={[styles.impactBadge, { backgroundColor: getImpactColor(selectedNews.impact_level), alignSelf: 'flex-start', marginBottom: 12 }]}>
                <Text style={styles.impactText}>{selectedNews.impact_level}</Text>
              </View>
              
              <Text style={styles.modalTitle}>
                {i18n.language === 'es' ? selectedNews.title_es : selectedNews.title}
              </Text>
              
              <View style={styles.modalMeta}>
                <Text style={styles.modalMetaText}>📅 {formatDate(selectedNews.published_at)}</Text>
                <Text style={styles.modalMetaText}>👁 {selectedNews.views} vistas</Text>
                {selectedNews.source && (
                  <Text style={styles.modalMetaText}>📋 {selectedNews.source}</Text>
                )}
              </View>

              {selectedNews.summary && (
                <View style={styles.summaryBox}>
                  <Text style={styles.summaryBoxLabel}>
                    {i18n.language === 'es' ? 'Resumen:' : 'Summary:'}
                  </Text>
                  <Text style={styles.summaryBoxText}>
                    {i18n.language === 'es' ? selectedNews.summary_es : selectedNews.summary}
                  </Text>
                </View>
              )}

              <View style={styles.contentBox}>
                <Text style={styles.contentText}>
                  {i18n.language === 'es' ? selectedNews.content_es : selectedNews.content}
                </Text>
              </View>

              {selectedNews.effective_date && (
                <View style={styles.effectiveDateBox}>
                  <Text style={styles.effectiveDateLabel}>
                    {i18n.language === 'es' ? 'Fecha efectiva:' : 'Effective date:'}
                  </Text>
                  <Text style={styles.effectiveDateText}>
                    {new Date(selectedNews.effective_date).toLocaleDateString('es-ES', { 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })}
                  </Text>
                </View>
              )}
            </ScrollView>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { backgroundColor: '#6C1110', padding: 20, paddingTop: 60 },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: '#fff', marginBottom: 8 },
  headerSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.9)' },
  filters: { flexDirection: 'row', padding: 16, gap: 12 },
  filterChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb' },
  filterChipActive: { backgroundColor: '#6C1110', borderColor: '#6C1110' },
  filterText: { fontSize: 14, fontWeight: '500', color: '#666' },
  filterTextActive: { color: '#fff' },
  content: { flex: 1, paddingHorizontal: 16 },
  card: { backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  impactBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  impactText: { fontSize: 11, fontWeight: '600', color: '#fff', textTransform: 'uppercase' },
  date: { fontSize: 12, color: '#9ca3af' },
  title: { fontSize: 18, fontWeight: '600', color: '#1f2937', marginBottom: 8 },
  summary: { fontSize: 14, color: '#6b7280', lineHeight: 20, marginBottom: 8 },
  meta: { flexDirection: 'row', gap: 16, borderTopWidth: 1, borderTopColor: '#f3f4f6', paddingTop: 8, marginBottom: 8 },
  metaText: { fontSize: 12, color: '#9ca3af' },
  readMoreContainer: { alignItems: 'flex-end' },
  readMoreText: { fontSize: 14, color: '#6C1110', fontWeight: '600' },
  
  // Modal styles
  modalContainer: { flex: 1, backgroundColor: '#fff' },
  modalHeader: { backgroundColor: '#6C1110', padding: 20, paddingTop: 60, flexDirection: 'row', alignItems: 'center' },
  closeButton: { marginRight: 16 },
  modalHeaderTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff', flex: 1 },
  modalContent: { flex: 1, padding: 20 },
  modalTitle: { fontSize: 24, fontWeight: 'bold', color: '#1f2937', marginBottom: 16, lineHeight: 32 },
  modalMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  modalMetaText: { fontSize: 13, color: '#6b7280' },
  summaryBox: { backgroundColor: '#fef3c7', padding: 16, borderRadius: 12, marginBottom: 20, borderLeftWidth: 4, borderLeftColor: '#f59e0b' },
  summaryBoxLabel: { fontSize: 14, fontWeight: '700', color: '#92400e', marginBottom: 8, textTransform: 'uppercase' },
  summaryBoxText: { fontSize: 15, color: '#78350f', lineHeight: 22 },
  contentBox: { marginBottom: 24 },
  contentText: { fontSize: 16, color: '#374151', lineHeight: 26, textAlign: 'justify' },
  effectiveDateBox: { backgroundColor: '#f0fdf4', padding: 16, borderRadius: 12, marginTop: 16, borderLeftWidth: 4, borderLeftColor: '#10b981' },
  effectiveDateLabel: { fontSize: 13, fontWeight: '700', color: '#065f46', marginBottom: 4, textTransform: 'uppercase' },
  effectiveDateText: { fontSize: 15, color: '#047857', fontWeight: '600' },
});
