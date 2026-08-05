/**
 * Admin Carousel Banners Management Screen
 * Gestión de banners del carrusel del Home
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
  Platform,
  RefreshControl,
  Modal,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../../services/api';

interface Banner {
  id: string;
  title: string;
  subtitle: string;
  description?: string;
  gradient_colors: string[];
  icon: string;
  button_text?: string;
  button_action?: string;
  order: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

const AVAILABLE_ICONS = [
  'gift-outline', 'document-text-outline', 'cash-outline', 'share-social-outline',
  'game-controller-outline', 'wallet-outline', 'newspaper-outline', 'school-outline',
  'megaphone-outline', 'trophy-outline', 'star-outline', 'heart-outline',
  'calendar-outline', 'people-outline', 'card-outline', 'calculator-outline',
];

const GRADIENT_PRESETS = [
  { name: 'Rojo', colors: ['#6C1110', '#ED201D'] },
  { name: 'Verde', colors: ['#10B981', '#059669'] },
  { name: 'Azul', colors: ['#3B82F6', '#1D4ED8'] },
  { name: 'Morado', colors: ['#7C3AED', '#EC4899'] },
  { name: 'Naranja', colors: ['#D97706', '#B45309'] },
  { name: 'Turquesa', colors: ['#4ECDC4', '#44A08D'] },
  { name: 'Rosa', colors: ['#EC4899', '#DB2777'] },
  { name: 'Gris', colors: ['#4B5563', '#1F2937'] },
];

export default function CarouselBannersScreen() {
  const router = useRouter();
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);
  
  // Form state
  const [formTitle, setFormTitle] = useState('');
  const [formSubtitle, setFormSubtitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formIcon, setFormIcon] = useState('gift-outline');
  const [formGradient, setFormGradient] = useState(['#6C1110', '#ED201D']);
  const [formButtonText, setFormButtonText] = useState('');
  const [formButtonAction, setFormButtonAction] = useState('');

  const fetchBanners = useCallback(async () => {
    try {
      const response = await api.get('/api/admin/carousel-banners');
      setBanners(response.data.banners || []);
    } catch (error: any) {
      console.error('Error fetching banners:', error);
      Alert.alert('Error', 'No se pudieron cargar los banners');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchBanners();
  }, [fetchBanners]);

  const handleToggle = async (bannerId: string) => {
    try {
      setSaving(true);
      await api.patch(`/api/admin/carousel-banners/${bannerId}/toggle`);
      await fetchBanners();
    } catch (error: any) {
      console.error('Error toggling banner:', error);
      Alert.alert('Error', 'No se pudo cambiar el estado del banner');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (banner: Banner) => {
    Alert.alert(
      'Eliminar Banner',
      `¿Estás seguro de eliminar "${banner.title}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              setSaving(true);
              await api.delete(`/api/admin/carousel-banners/${banner.id}`);
              await fetchBanners();
              Alert.alert('Éxito', 'Banner eliminado');
            } catch (error: any) {
              console.error('Error deleting banner:', error);
              Alert.alert('Error', 'No se pudo eliminar el banner');
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  };

  const openModal = (banner?: Banner) => {
    if (banner) {
      setEditingBanner(banner);
      setFormTitle(banner.title);
      setFormSubtitle(banner.subtitle);
      setFormDescription(banner.description || '');
      setFormIcon(banner.icon);
      setFormGradient(banner.gradient_colors);
      setFormButtonText(banner.button_text || '');
      setFormButtonAction(banner.button_action || '');
    } else {
      setEditingBanner(null);
      setFormTitle('');
      setFormSubtitle('');
      setFormDescription('');
      setFormIcon('gift-outline');
      setFormGradient(['#6C1110', '#ED201D']);
      setFormButtonText('Ver más');
      setFormButtonAction('/(tabs)/services');
    }
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!formTitle.trim() || !formSubtitle.trim()) {
      Alert.alert('Error', 'El título y subtítulo son requeridos');
      return;
    }

    try {
      setSaving(true);
      const bannerData = {
        title: formTitle,
        subtitle: formSubtitle,
        description: formDescription,
        icon: formIcon,
        gradient_colors: formGradient,
        button_text: formButtonText,
        button_action: formButtonAction,
        order: editingBanner?.order || banners.length,
        is_active: true,
      };

      if (editingBanner) {
        await api.put(`/api/admin/carousel-banners/${editingBanner.id}`, bannerData);
        Alert.alert('Éxito', 'Banner actualizado');
      } else {
        await api.post('/api/admin/carousel-banners', bannerData);
        Alert.alert('Éxito', 'Banner creado');
      }

      setModalVisible(false);
      await fetchBanners();
    } catch (error: any) {
      console.error('Error saving banner:', error);
      Alert.alert('Error', 'No se pudo guardar el banner');
    } finally {
      setSaving(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchBanners();
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6C1110" />
        <Text style={styles.loadingText}>Cargando banners...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <View style={styles.headerTextContainer}>
          <Text style={styles.headerTitle}>🎠 Carrusel Home</Text>
          <Text style={styles.headerSubtitle}>Gestiona los banners del inicio</Text>
        </View>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => openModal()}
        >
          <Ionicons name="add" size={24} color="#FFF" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{banners.length}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statNumber, { color: '#10B981' }]}>
              {banners.filter(b => b.is_active).length}
            </Text>
            <Text style={styles.statLabel}>Activos</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statNumber, { color: '#EF4444' }]}>
              {banners.filter(b => !b.is_active).length}
            </Text>
            <Text style={styles.statLabel}>Ocultos</Text>
          </View>
        </View>

        {/* Banner List */}
        <Text style={styles.sectionTitle}>Banners del Carrusel</Text>
        
        {banners.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="images-outline" size={48} color="#9CA3AF" />
            <Text style={styles.emptyText}>No hay banners configurados</Text>
            <TouchableOpacity
              style={styles.emptyButton}
              onPress={() => openModal()}
            >
              <Text style={styles.emptyButtonText}>Crear primer banner</Text>
            </TouchableOpacity>
          </View>
        ) : (
          banners.map((banner, index) => (
            <View key={banner.id} style={styles.bannerCard}>
              <LinearGradient
                colors={banner.gradient_colors || ['#6C1110', '#ED201D']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.bannerPreview}
              >
                <Ionicons 
                  name={banner.icon as any || 'gift-outline'} 
                  size={32} 
                  color="#FFF" 
                />
                <View style={styles.bannerPreviewText}>
                  <Text style={styles.bannerPreviewTitle} numberOfLines={1}>
                    {banner.title}
                  </Text>
                  <Text style={styles.bannerPreviewSubtitle} numberOfLines={1}>
                    {banner.subtitle}
                  </Text>
                </View>
              </LinearGradient>
              
              <View style={styles.bannerControls}>
                <View style={styles.bannerInfo}>
                  <Text style={styles.bannerOrder}>#{index + 1}</Text>
                  <Text style={styles.bannerAction}>{banner.button_action || 'Sin ruta'}</Text>
                </View>
                
                <View style={styles.bannerActions}>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => openModal(banner)}
                  >
                    <Ionicons name="pencil" size={20} color="#3B82F6" />
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleDelete(banner)}
                  >
                    <Ionicons name="trash" size={20} color="#EF4444" />
                  </TouchableOpacity>
                  
                  <Switch
                    value={banner.is_active}
                    onValueChange={() => handleToggle(banner.id)}
                    trackColor={{ false: '#E5E7EB', true: '#86EFAC' }}
                    thumbColor={banner.is_active ? '#10B981' : '#9CA3AF'}
                    disabled={saving}
                  />
                </View>
              </View>
            </View>
          ))
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Create/Edit Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Text style={styles.modalCancel}>Cancelar</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {editingBanner ? 'Editar Banner' : 'Nuevo Banner'}
            </Text>
            <TouchableOpacity onPress={handleSave} disabled={saving}>
              {saving ? (
                <ActivityIndicator size="small" color="#6C1110" />
              ) : (
                <Text style={styles.modalSave}>Guardar</Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {/* Preview */}
            <LinearGradient
              colors={formGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.previewBanner}
            >
              <Ionicons name={formIcon as any} size={40} color="#FFF" />
              <View style={{ marginLeft: 12, flex: 1 }}>
                <Text style={styles.previewTitle}>{formTitle || 'Título'}</Text>
                <Text style={styles.previewSubtitle}>{formSubtitle || 'Subtítulo'}</Text>
              </View>
            </LinearGradient>

            {/* Form Fields */}
            <Text style={styles.formLabel}>Título *</Text>
            <TextInput
              style={styles.input}
              value={formTitle}
              onChangeText={setFormTitle}
              placeholder="Ej: Promoción Especial"
              placeholderTextColor="#9CA3AF"
            />

            <Text style={styles.formLabel}>Subtítulo *</Text>
            <TextInput
              style={styles.input}
              value={formSubtitle}
              onChangeText={setFormSubtitle}
              placeholder="Ej: 50% de descuento"
              placeholderTextColor="#9CA3AF"
            />

            <Text style={styles.formLabel}>Descripción</Text>
            <TextInput
              style={[styles.input, { height: 80 }]}
              value={formDescription}
              onChangeText={setFormDescription}
              placeholder="Descripción opcional..."
              placeholderTextColor="#9CA3AF"
              multiline
            />

            <Text style={styles.formLabel}>Texto del Botón</Text>
            <TextInput
              style={styles.input}
              value={formButtonText}
              onChangeText={setFormButtonText}
              placeholder="Ej: Ver más"
              placeholderTextColor="#9CA3AF"
            />

            <Text style={styles.formLabel}>Ruta de Navegación</Text>
            <TextInput
              style={styles.input}
              value={formButtonAction}
              onChangeText={setFormButtonAction}
              placeholder="Ej: /(tabs)/services"
              placeholderTextColor="#9CA3AF"
            />

            {/* Icon Selection */}
            <Text style={styles.formLabel}>Icono</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.iconGrid}>
                {AVAILABLE_ICONS.map((icon) => (
                  <TouchableOpacity
                    key={icon}
                    style={[
                      styles.iconOption,
                      formIcon === icon && styles.iconOptionSelected,
                    ]}
                    onPress={() => setFormIcon(icon)}
                  >
                    <Ionicons
                      name={icon as any}
                      size={24}
                      color={formIcon === icon ? '#FFF' : '#6B7280'}
                    />
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {/* Gradient Selection */}
            <Text style={styles.formLabel}>Color</Text>
            <View style={styles.gradientGrid}>
              {GRADIENT_PRESETS.map((preset) => (
                <TouchableOpacity
                  key={preset.name}
                  style={[
                    styles.gradientOption,
                    JSON.stringify(formGradient) === JSON.stringify(preset.colors) && 
                      styles.gradientOptionSelected,
                  ]}
                  onPress={() => setFormGradient(preset.colors)}
                >
                  <LinearGradient
                    colors={preset.colors}
                    style={styles.gradientPreview}
                  />
                  <Text style={styles.gradientName}>{preset.name}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={{ height: 50 }} />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  header: {
    backgroundColor: '#6C1110',
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 20,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFF',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statNumber: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1F2937',
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 16,
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#FFF',
    borderRadius: 16,
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 12,
  },
  emptyButton: {
    marginTop: 16,
    backgroundColor: '#6C1110',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyButtonText: {
    color: '#FFF',
    fontWeight: '600',
  },
  bannerCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  bannerPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  bannerPreviewText: {
    flex: 1,
    marginLeft: 12,
  },
  bannerPreviewTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  bannerPreviewSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 2,
  },
  bannerControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: '#F9FAFB',
  },
  bannerInfo: {
    flex: 1,
  },
  bannerOrder: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  bannerAction: {
    fontSize: 12,
    color: '#6B7280',
  },
  bannerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalCancel: {
    fontSize: 16,
    color: '#6B7280',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  modalSave: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6C1110',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  previewBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 16,
    marginBottom: 24,
  },
  previewTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
  },
  previewSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 4,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: '#1F2937',
  },
  iconGrid: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 8,
  },
  iconOption: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconOptionSelected: {
    backgroundColor: '#6C1110',
  },
  gradientGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 8,
  },
  gradientOption: {
    alignItems: 'center',
    padding: 8,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  gradientOptionSelected: {
    borderColor: '#6C1110',
  },
  gradientPreview: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  gradientName: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
});
