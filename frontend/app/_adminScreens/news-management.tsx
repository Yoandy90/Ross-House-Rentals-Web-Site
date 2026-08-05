import React, { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import AdminHeader from '../../components/admin/AdminHeader';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../../constants/colors';
import api from '../../services/api';
import { useTranslation } from 'react-i18next';

export default function NewsManagementScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  
  const [loading, setLoading] = useState(true);
  const [news, setNews] = useState([]);
  const [categories, setCategories] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingNews, setEditingNews] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    title_es: '',
    summary: '',
    summary_es: '',
    content: '',
    content_es: '',
    source: '',
    source_url: '',
    impact_level: 'medium',
    category: 'general',
    news_type: 'general',
  });

  const newsCategories = [
    { value: 'general', label: 'General' },
    { value: 'tax', label: 'Impuestos / Tax' },
    { value: 'irs', label: 'IRS' },
    { value: 'business', label: 'Negocios / Business' },
    { value: 'legal', label: 'Legal' },
    { value: 'financial', label: 'Finanzas / Financial' },
    { value: 'community', label: 'Comunidad / Community' },
    { value: 'other', label: 'Otros / Other' },
  ];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load news using api service
      const newsResponse = await api.get('/news/', { params: { limit: 100 } });
      const newsData = newsResponse.data;
      setNews(Array.isArray(newsData) ? newsData : []);

      // Load categories
      try {
        const catsResponse = await api.get('/news/categories');
        const catsData = catsResponse.data;
        setCategories(Array.isArray(catsData) ? catsData : []);
      } catch (catError) {
        console.log('Categories endpoint not available:', catError);
        setCategories([]);
      }
      
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'No se pudieron cargar las noticias');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.title || !formData.title_es) {
      Alert.alert('Error', 'Título en ambos idiomas es requerido');
      return;
    }

    try {
      const url = editingNews
        ? `/news/admin/${editingNews.id}`
        : '/news/admin/';
      
      const method = editingNews ? 'put' : 'post';

      const response = await api[method](url, formData);

      if (response.status === 200 || response.status === 201) {
        Alert.alert('Éxito', `Noticia ${editingNews ? 'actualizada' : 'creada'} exitosamente`);
        setShowModal(false);
        resetForm();
        loadData();
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || 'Error al guardar';
      Alert.alert('Error', errorMessage);
    }
  };

  const handleDelete = async (newsId: string) => {
    Alert.alert(
      'Confirmar',
      '¿Estás seguro de eliminar esta noticia?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/news/admin/${newsId}`);
              Alert.alert('Éxito', 'Noticia eliminada');
              loadData();
            } catch (error) {
              console.error('Error deleting:', error);
              Alert.alert('Error', 'No se pudo eliminar la noticia');
            }
          },
        },
      ]
    );
  };

  const openEditModal = (newsItem: any) => {
    setEditingNews(newsItem);
    setFormData({
      title: newsItem.title || '',
      title_es: newsItem.title_es || '',
      summary: newsItem.summary || '',
      summary_es: newsItem.summary_es || '',
      content: newsItem.content || '',
      content_es: newsItem.content_es || '',
      source: newsItem.source || '',
      source_url: newsItem.source_url || '',
      impact_level: newsItem.impact_level || 'medium',
      category: newsItem.category || 'general',
      news_type: newsItem.news_type || 'general',
    });
    setShowModal(true);
  };

  const openCreateModal = () => {
    resetForm();
    setShowModal(true);
  };

  const resetForm = () => {
    setEditingNews(null);
    setFormData({
      title: '',
      title_es: '',
      summary: '',
      summary_es: '',
      content: '',
      content_es: '',
      source: '',
      source_url: '',
      impact_level: 'medium',
      category: 'general',
      news_type: 'general',
    });
  };

  const getImpactColor = (level: string) => {
    switch (level) {
      case 'high': return '#dc2626';
      case 'medium': return '#f59e0b';
      case 'low': return '#10b981';
      default: return '#6b7280';
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <AdminHeader 
          title="Gestión de Noticias" 
          subtitle="Cargando..."
          rightAction={{
            icon: 'add-circle',
            onPress: openCreateModal
          }}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Cargando noticias...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AdminHeader 
        title="Gestión de Noticias" 
        subtitle={`${news.length} noticias registradas`}
        rightAction={{
          icon: 'add-circle',
          onPress: openCreateModal
        }}
      />

      {/* News List */}
      <ScrollView style={styles.content}>
        {news.map((item: any) => (
          <View key={item.id} style={styles.newsCard}>
            <View style={styles.newsHeader}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={[styles.impactBadge, { backgroundColor: getImpactColor(item.impact_level) }]}>
                  <Text style={styles.impactText}>{item.impact_level}</Text>
                </View>
                {item.category && (
                  <View style={[styles.categoryBadge]}>
                    <Text style={styles.categoryBadgeText}>
                      {newsCategories.find(c => c.value === item.category)?.label || item.category}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={styles.newsDate}>
                {new Date(item.published_at).toLocaleDateString()}
              </Text>
            </View>
            
            <Text style={styles.newsTitle}>{item.title}</Text>
            <Text style={styles.newsSummary} numberOfLines={2}>{item.summary}</Text>
            
            <View style={styles.newsMeta}>
              <Text style={styles.metaText}>👁 {item.views || 0} vistas</Text>
              {item.source && <Text style={styles.metaText}>📋 {item.source}</Text>}
            </View>

            <View style={styles.newsActions}>
              <TouchableOpacity
                style={styles.editButton}
                onPress={() => openEditModal(item)}
              >
                <Ionicons name="create-outline" size={18} color={colors.primary} />
                <Text style={[styles.actionText, { color: colors.primary }]}>Editar</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => handleDelete(item.id)}
              >
                <Ionicons name="trash-outline" size={18} color="#dc2626" />
                <Text style={[styles.actionText, { color: '#dc2626' }]}>Eliminar</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}

        {news.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="newspaper-outline" size={64} color={colors.textGray} />
            <Text style={styles.emptyText}>No hay noticias registradas</Text>
            <TouchableOpacity style={styles.emptyButton} onPress={openCreateModal}>
              <Text style={styles.emptyButtonText}>Crear Primera Noticia</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Modal */}
      <Modal visible={showModal} animationType="slide" onRequestClose={() => setShowModal(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {editingNews ? 'Editar Noticia' : 'Nueva Noticia'}
            </Text>
            <TouchableOpacity onPress={() => setShowModal(false)}>
              <Ionicons name="close" size={28} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {/* Título English */}
            <Text style={styles.label}>Título (English) *</Text>
            <TextInput
              style={styles.input}
              value={formData.title}
              onChangeText={(text) => setFormData({ ...formData, title: text })}
              placeholder="Enter title in English"
            />

            {/* Título Español */}
            <Text style={styles.label}>Título (Español) *</Text>
            <TextInput
              style={styles.input}
              value={formData.title_es}
              onChangeText={(text) => setFormData({ ...formData, title_es: text })}
              placeholder={t('admin.newsTitlePlaceholder', 'Ingrese título en español')}
            />

            {/* Summary English */}
            <Text style={styles.label}>Resumen (English)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={formData.summary}
              onChangeText={(text) => setFormData({ ...formData, summary: text })}
              placeholder="Enter summary"
              multiline
              numberOfLines={3}
            />

            {/* Summary Español */}
            <Text style={styles.label}>Resumen (Español)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={formData.summary_es}
              onChangeText={(text) => setFormData({ ...formData, summary_es: text })}
              placeholder="Ingrese resumen"
              multiline
              numberOfLines={3}
            />

            {/* Content English */}
            <Text style={styles.label}>Contenido (English)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={formData.content}
              onChangeText={(text) => setFormData({ ...formData, content: text })}
              placeholder="Enter full content"
              multiline
              numberOfLines={10}
            />

            {/* Content Español */}
            <Text style={styles.label}>Contenido (Español)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={formData.content_es}
              onChangeText={(text) => setFormData({ ...formData, content_es: text })}
              placeholder="Ingrese contenido completo"
              multiline
              numberOfLines={10}
            />

            {/* Source */}
            <Text style={styles.label}>Fuente</Text>
            <TextInput
              style={styles.input}
              value={formData.source}
              onChangeText={(text) => setFormData({ ...formData, source: text })}
              placeholder="IRS, Congressional Budget Office, etc."
            />

            {/* Categoría */}
            <Text style={styles.label}>Categoría de Noticia</Text>
            <View style={styles.categoryButtons}>
              {newsCategories.map((cat) => (
                <TouchableOpacity
                  key={cat.value}
                  style={[
                    styles.categoryButton,
                    formData.category === cat.value && styles.categoryButtonActive
                  ]}
                  onPress={() => setFormData({ ...formData, category: cat.value })}
                >
                  <Text style={[
                    styles.categoryButtonText,
                    formData.category === cat.value && styles.categoryButtonTextActive
                  ]}>
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Impact Level */}
            <Text style={styles.label}>Nivel de Impacto</Text>
            <View style={styles.impactButtons}>
              {['high', 'medium', 'low'].map((level) => (
                <TouchableOpacity
                  key={level}
                  style={[
                    styles.impactButton,
                    formData.impact_level === level && { backgroundColor: getImpactColor(level) }
                  ]}
                  onPress={() => setFormData({ ...formData, impact_level: level })}
                >
                  <Text style={[
                    styles.impactButtonText,
                    formData.impact_level === level && { color: '#fff' }
                  ]}>
                    {level.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Save Button */}
            <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
              <Text style={styles.saveButtonText}>
                {editingNews ? 'Actualizar Noticia' : 'Crear Noticia'}
              </Text>
            </TouchableOpacity>

            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
  },
  headerSubtitle: {
    fontSize: 14,
    color: colors.textGray,
    marginTop: 4,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 8,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  newsCard: {
    backgroundColor: colors.card,
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  newsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  impactBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  impactText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
    textTransform: 'uppercase',
  },
  categoryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: colors.primary,
    opacity: 0.8,
  },
  categoryBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
  },
  newsDate: {
    fontSize: 12,
    color: colors.textGray,
  },
  newsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  newsSummary: {
    fontSize: 14,
    color: colors.textGray,
    lineHeight: 20,
    marginBottom: 12,
  },
  newsMeta: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  metaText: {
    fontSize: 12,
    color: colors.textGray,
  },
  newsActions: {
    flexDirection: 'row',
    gap: 12,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#dc2626',
  },
  actionText: {
    fontSize: 13,
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: colors.textGray,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: colors.textGray,
    marginTop: 16,
    marginBottom: 24,
  },
  emptyButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: colors.text,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  categoryButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  categoryButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  categoryButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  categoryButtonTextActive: {
    color: '#fff',
  },
  impactButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  impactButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  impactButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
  },
  saveButton: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 24,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
