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
  Alert,
  Switch,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../../constants/colors';
import api from '../../services/api';
import { useTranslation } from 'react-i18next';

type ResourceType = 'faqs' | 'articles' | 'videos';

interface FAQ {
  id: string;
  question: string;
  answer: string;
  icon: string;
  order: number;
  active: boolean;
}

interface Article {
  id: string;
  title: string;
  description: string;
  read_time: string;
  category: string;
  content?: string;
  order: number;
  active: boolean;
}

interface Video {
  id: string;
  title: string;
  description: string;
  duration: string;
  url: string;
  thumbnail?: string;
  order: number;
  active: boolean;
}

export default function EducationManagement() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const [activeTab, setActiveTab] = useState<ResourceType>('faqs');
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [formData, setFormData] = useState<any>({});

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      let response;
      console.log('Loading data for tab:', activeTab);
      switch (activeTab) {
        case 'faqs':
          response = await api.get('/admin/education/faqs');
          console.log('FAQs loaded:', response.data?.length || 0);
          setFaqs(Array.isArray(response.data) ? response.data : []);
          break;
        case 'articles':
          response = await api.get('/admin/education/articles');
          console.log('Articles loaded:', response.data?.length || 0);
          setArticles(Array.isArray(response.data) ? response.data : []);
          break;
        case 'videos':
          response = await api.get('/admin/education/videos');
          console.log('Videos loaded:', response.data?.length || 0);
          setVideos(Array.isArray(response.data) ? response.data : []);
          break;
      }
    } catch (error: any) {
      console.error('Error loading education data:', error?.response?.data || error?.message || error);
      Alert.alert('Error', 'No se pudieron cargar los datos');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingItem(null);
    setFormData({
      question: '',
      answer: '',
      icon: 'help-circle-outline',
      title: '',
      description: '',
      read_time: '',
      category: '',
      content: '',
      duration: '',
      url: '',
      thumbnail: '',
      order: 0,
      active: true,
    });
    setShowModal(true);
  };

  const handleEdit = (item: any) => {
    setEditingItem(item);
    setFormData(item);
    setShowModal(true);
  };

  const handleSave = async () => {
    try {
      let endpoint = '';
      let data = {};

      switch (activeTab) {
        case 'faqs':
          endpoint = editingItem ? `/admin/education/faqs/${editingItem.id}` : '/admin/education/faqs';
          data = {
            question: formData.question,
            answer: formData.answer,
            icon: formData.icon,
            order: parseInt(formData.order) || 0,
            active: formData.active,
          };
          break;
        case 'articles':
          endpoint = editingItem ? `/admin/education/articles/${editingItem.id}` : '/admin/education/articles';
          data = {
            title: formData.title,
            description: formData.description,
            read_time: formData.read_time,
            category: formData.category,
            content: formData.content,
            order: parseInt(formData.order) || 0,
            active: formData.active,
          };
          break;
        case 'videos':
          endpoint = editingItem ? `/admin/education/videos/${editingItem.id}` : '/admin/education/videos';
          data = {
            title: formData.title,
            description: formData.description,
            duration: formData.duration,
            url: formData.url,
            thumbnail: formData.thumbnail,
            order: parseInt(formData.order) || 0,
            active: formData.active,
          };
          break;
      }

      if (editingItem) {
        await api.put(endpoint, data);
        Alert.alert('Éxito', 'Recurso actualizado');
      } else {
        await api.post(endpoint, data);
        Alert.alert('Éxito', 'Recurso creado');
      }

      setShowModal(false);
      loadData();
    } catch (error: any) {
      console.error('Error saving:', error);
      Alert.alert('Error', error.response?.data?.detail || 'No se pudo guardar');
    }
  };

  const handleDelete = async (id: string) => {
    Alert.alert(
      'Confirmar',
      '¿Estás seguro de eliminar este recurso?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              let endpoint = '';
              switch (activeTab) {
                case 'faqs':
                  endpoint = `/admin/education/faqs/${id}`;
                  break;
                case 'articles':
                  endpoint = `/admin/education/articles/${id}`;
                  break;
                case 'videos':
                  endpoint = `/admin/education/videos/${id}`;
                  break;
              }
              await api.delete(endpoint);
              Alert.alert('Éxito', 'Recurso eliminado');
              loadData();
            } catch (error) {
              Alert.alert('Error', 'No se pudo eliminar');
            }
          },
        },
      ]
    );
  };

  const toggleActive = async (item: any) => {
    try {
      let endpoint = '';
      switch (activeTab) {
        case 'faqs':
          endpoint = `/admin/education/faqs/${item.id}`;
          break;
        case 'articles':
          endpoint = `/admin/education/articles/${item.id}`;
          break;
        case 'videos':
          endpoint = `/admin/education/videos/${item.id}`;
          break;
      }
      await api.put(endpoint, { active: !item.active });
      loadData();
    } catch (error) {
      Alert.alert('Error', 'No se pudo actualizar el estado');
    }
  };

  const renderFAQItem = (faq: FAQ) => (
    <View key={faq.id} style={styles.itemCard}>
      <View style={styles.itemHeader}>
        <View style={styles.itemIconContainer}>
          <Ionicons name={faq.icon as any} size={20} color={colors.primary} />
        </View>
        <View style={styles.itemContent}>
          <Text style={styles.itemTitle}>{faq.question}</Text>
          <Text style={styles.itemSubtitle} numberOfLines={2}>{faq.answer}</Text>
        </View>
        <Switch
          value={faq.active}
          onValueChange={() => toggleActive(faq)}
          trackColor={{ false: '#ccc', true: colors.primary + '80' }}
          thumbColor={faq.active ? colors.primary : '#f4f3f4'}
        />
      </View>
      <View style={styles.itemActions}>
        <Text style={styles.orderText}>Orden: {faq.order}</Text>
        <View style={styles.actionButtons}>
          <TouchableOpacity onPress={() => handleEdit(faq)} style={styles.editButton}>
            <Ionicons name="create-outline" size={20} color={colors.info} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleDelete(faq.id)} style={styles.deleteButton}>
            <Ionicons name="trash-outline" size={20} color={colors.danger} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const renderArticleItem = (article: Article) => (
    <View key={article.id} style={styles.itemCard}>
      <View style={styles.itemHeader}>
        <View style={[styles.categoryBadge, { backgroundColor: colors.accent + '20' }]}>
          <Text style={[styles.categoryText, { color: colors.accent }]}>{article.category}</Text>
        </View>
        <View style={styles.itemContent}>
          <Text style={styles.itemTitle}>{article.title}</Text>
          <Text style={styles.itemSubtitle} numberOfLines={2}>{article.description}</Text>
          <Text style={styles.readTime}>⏱ {article.read_time}</Text>
        </View>
        <Switch
          value={article.active}
          onValueChange={() => toggleActive(article)}
          trackColor={{ false: '#ccc', true: colors.primary + '80' }}
          thumbColor={article.active ? colors.primary : '#f4f3f4'}
        />
      </View>
      <View style={styles.itemActions}>
        <Text style={styles.orderText}>Orden: {article.order}</Text>
        <View style={styles.actionButtons}>
          <TouchableOpacity onPress={() => handleEdit(article)} style={styles.editButton}>
            <Ionicons name="create-outline" size={20} color={colors.info} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleDelete(article.id)} style={styles.deleteButton}>
            <Ionicons name="trash-outline" size={20} color={colors.danger} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const renderVideoItem = (video: Video) => (
    <View key={video.id} style={styles.itemCard}>
      <View style={styles.itemHeader}>
        <View style={styles.videoThumbnail}>
          <Ionicons name="play-circle" size={32} color={colors.textWhite} />
        </View>
        <View style={styles.itemContent}>
          <Text style={styles.itemTitle}>{video.title}</Text>
          <Text style={styles.itemSubtitle} numberOfLines={2}>{video.description}</Text>
          <Text style={styles.readTime}>⏱ {video.duration}</Text>
        </View>
        <Switch
          value={video.active}
          onValueChange={() => toggleActive(video)}
          trackColor={{ false: '#ccc', true: colors.primary + '80' }}
          thumbColor={video.active ? colors.primary : '#f4f3f4'}
        />
      </View>
      <View style={styles.itemActions}>
        <Text style={styles.orderText}>Orden: {video.order}</Text>
        <View style={styles.actionButtons}>
          <TouchableOpacity onPress={() => handleEdit(video)} style={styles.editButton}>
            <Ionicons name="create-outline" size={20} color={colors.info} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleDelete(video.id)} style={styles.deleteButton}>
            <Ionicons name="trash-outline" size={20} color={colors.danger} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const renderForm = () => {
    switch (activeTab) {
      case 'faqs':
        return (
          <>
            <Text style={styles.label}>Pregunta *</Text>
            <TextInput
              style={styles.input}
              value={formData.question}
              onChangeText={(text) => setFormData({ ...formData, question: text })}
              placeholder={t('admin.faqQuestionPlaceholder', '¿Cuál es tu pregunta?')}
            />

            <Text style={styles.label}>Respuesta *</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={formData.answer}
              onChangeText={(text) => setFormData({ ...formData, answer: text })}
              placeholder={t('admin.faqAnswerPlaceholder', 'Escribe la respuesta aquí')}
              multiline
              numberOfLines={4}
            />

            <Text style={styles.label}>Ícono</Text>
            <TextInput
              style={styles.input}
              value={formData.icon}
              onChangeText={(text) => setFormData({ ...formData, icon: text })}
              placeholder="help-circle-outline"
            />
          </>
        );

      case 'articles':
        return (
          <>
            <Text style={styles.label}>Título *</Text>
            <TextInput
              style={styles.input}
              value={formData.title}
              onChangeText={(text) => setFormData({ ...formData, title: text })}
              placeholder={t('admin.articleTitlePlaceholder', 'Título del artículo')}
            />

            <Text style={styles.label}>Descripción *</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={formData.description}
              onChangeText={(text) => setFormData({ ...formData, description: text })}
              placeholder={t('admin.articleShortDescPlaceholder', 'Descripción breve')}
              multiline
              numberOfLines={3}
            />

            <View style={styles.rowInputs}>
              <View style={styles.halfInput}>
                <Text style={styles.label}>Categoría</Text>
                <TextInput
                  style={styles.input}
                  value={formData.category}
                  onChangeText={(text) => setFormData({ ...formData, category: text })}
                  placeholder="Deducciones"
                />
              </View>
              <View style={styles.halfInput}>
                <Text style={styles.label}>Tiempo de lectura</Text>
                <TextInput
                  style={styles.input}
                  value={formData.read_time}
                  onChangeText={(text) => setFormData({ ...formData, read_time: text })}
                  placeholder="10 min"
                />
              </View>
            </View>

            <Text style={styles.label}>Contenido completo</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={formData.content}
              onChangeText={(text) => setFormData({ ...formData, content: text })}
              placeholder={t('admin.articleContentPlaceholder', 'Contenido completo del artículo...')}
              multiline
              numberOfLines={6}
            />
          </>
        );

      case 'videos':
        return (
          <>
            <Text style={styles.label}>Título *</Text>
            <TextInput
              style={styles.input}
              value={formData.title}
              onChangeText={(text) => setFormData({ ...formData, title: text })}
              placeholder={t('admin.videoTitlePlaceholder', 'Título del video')}
            />

            <Text style={styles.label}>Descripción *</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={formData.description}
              onChangeText={(text) => setFormData({ ...formData, description: text })}
              placeholder={t('admin.videoDescPlaceholder', 'Descripción del video')}
              multiline
              numberOfLines={3}
            />

            <View style={styles.rowInputs}>
              <View style={styles.halfInput}>
                <Text style={styles.label}>Duración</Text>
                <TextInput
                  style={styles.input}
                  value={formData.duration}
                  onChangeText={(text) => setFormData({ ...formData, duration: text })}
                  placeholder="12:30"
                />
              </View>
              <View style={styles.halfInput}>
                <Text style={styles.label}>Orden</Text>
                <TextInput
                  style={styles.input}
                  value={String(formData.order)}
                  onChangeText={(text) => setFormData({ ...formData, order: text })}
                  placeholder="0"
                  keyboardType="number-pad"
                />
              </View>
            </View>

            <Text style={styles.label}>URL del Video *</Text>
            <TextInput
              style={styles.input}
              value={formData.url}
              onChangeText={(text) => setFormData({ ...formData, url: text })}
              placeholder="https://youtube.com/watch?v=..."
            />

            <Text style={styles.label}>URL del Thumbnail (opcional)</Text>
            <TextInput
              style={styles.input}
              value={formData.thumbnail}
              onChangeText={(text) => setFormData({ ...formData, thumbnail: text })}
              placeholder="https://..."
            />
          </>
        );
    }
  };

  return (
    <View style={styles.container}>
      <AdminHeader 
        title="Contenido Educativo" 
        subtitle="FAQs, Artículos y Videos"
        rightAction={{
          icon: 'add-circle',
          onPress: handleAdd
        }}
      />

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'faqs' && styles.tabActive]}
          onPress={() => setActiveTab('faqs')}
        >
          <Ionicons name="help-circle" size={20} color={activeTab === 'faqs' ? colors.primary : colors.textGray} />
          <Text style={[styles.tabText, activeTab === 'faqs' && styles.tabTextActive]}>FAQs</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'articles' && styles.tabActive]}
          onPress={() => setActiveTab('articles')}
        >
          <Ionicons name="book" size={20} color={activeTab === 'articles' ? colors.primary : colors.textGray} />
          <Text style={[styles.tabText, activeTab === 'articles' && styles.tabTextActive]}>Artículos</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'videos' && styles.tabActive]}
          onPress={() => setActiveTab('videos')}
        >
          <Ionicons name="play-circle" size={20} color={activeTab === 'videos' ? colors.primary : colors.textGray} />
          <Text style={[styles.tabText, activeTab === 'videos' && styles.tabTextActive]}>Videos</Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
        ) : (
          <>
            {activeTab === 'faqs' && faqs.map(renderFAQItem)}
            {activeTab === 'articles' && articles.map(renderArticleItem)}
            {activeTab === 'videos' && videos.map(renderVideoItem)}

            {((activeTab === 'faqs' && faqs.length === 0) ||
              (activeTab === 'articles' && articles.length === 0) ||
              (activeTab === 'videos' && videos.length === 0)) && (
              <View style={styles.emptyState}>
                <Ionicons name="folder-open-outline" size={64} color={colors.textGray} />
                <Text style={styles.emptyText}>No hay recursos todavía</Text>
                <Text style={styles.emptySubtext}>Presiona "Agregar" para crear uno nuevo</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Modal */}
      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowModal(false)} style={styles.closeButton}>
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {editingItem ? 'Editar' : 'Agregar'} {activeTab === 'faqs' ? 'FAQ' : activeTab === 'articles' ? 'Artículo' : 'Video'}
            </Text>
            <TouchableOpacity onPress={handleSave} style={styles.saveHeaderButton}>
              <Text style={styles.saveHeaderButtonText}>Guardar</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent} contentContainerStyle={styles.modalScrollContent}>
            {renderForm()}

            <View style={styles.rowInputs}>
              <View style={styles.halfInput}>
                <Text style={styles.label}>Orden</Text>
                <TextInput
                  style={styles.input}
                  value={String(formData.order)}
                  onChangeText={(text) => setFormData({ ...formData, order: text })}
                  placeholder="0"
                  keyboardType="number-pad"
                />
              </View>
              <View style={styles.halfInput}>
                <Text style={styles.label}>Activo</Text>
                <Switch
                  value={formData.active}
                  onValueChange={(value) => setFormData({ ...formData, active: value })}
                  trackColor={{ false: '#ccc', true: colors.primary + '80' }}
                  thumbColor={formData.active ? colors.primary : '#f4f3f4'}
                  style={styles.switch}
                />
              </View>
            </View>

            <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
              <Text style={styles.saveButtonText}>Guardar</Text>
            </TouchableOpacity>
          </ScrollView>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary + '15',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  addButtonText: {
    color: colors.primary,
    fontWeight: '600',
    fontSize: 14,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textGray,
  },
  tabTextActive: {
    color: colors.primary,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  loader: {
    marginTop: 40,
  },
  itemCard: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  itemIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemContent: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  itemSubtitle: {
    fontSize: 13,
    color: colors.textGray,
    lineHeight: 18,
  },
  itemActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  orderText: {
    fontSize: 12,
    color: colors.textGray,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  editButton: {
    padding: 8,
  },
  deleteButton: {
    padding: 8,
  },
  categoryBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  categoryText: {
    fontSize: 11,
    fontWeight: '600',
  },
  readTime: {
    fontSize: 12,
    color: colors.textGray,
    marginTop: 4,
  },
  videoThumbnail: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: colors.primary + '80',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.textGray,
    marginTop: 8,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.backgroundGray,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  closeButton: {
    padding: 4,
  },
  saveHeaderButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  saveHeaderButtonText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 14,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  modalContent: {
    flex: 1,
  },
  modalScrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    backgroundColor: colors.background,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: colors.text,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  rowInputs: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  switch: {
    marginTop: 8,
  },
  saveButton: {
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 32,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  saveButtonText: {
    color: colors.textWhite,
    fontSize: 16,
    fontWeight: '700',
  },
});