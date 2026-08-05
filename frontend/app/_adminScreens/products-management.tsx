import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  Switch,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../../constants/colors';
import AdminHeader from '../../components/admin/AdminHeader';
import api from '../../services/api';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  interval: 'weekly' | 'biweekly' | 'monthly' | 'yearly';
  features: string[];
  is_active: boolean;
  created_at: string;
  stripe_price_id?: string;
  stripe_product_id?: string;
}

export default function ProductsManagementScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [activeTab, setActiveTab] = useState<'active' | 'all'>('active');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    interval: 'monthly' as 'weekly' | 'biweekly' | 'monthly' | 'yearly',
    features: [''],
    is_active: true,
  });

  useEffect(() => {
    loadProducts();
  }, [activeTab]);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const include_inactive = activeTab === 'all';
      const response = await api.get(`/payments/admin/plans?include_inactive=${include_inactive}`);
      setProducts(response.data.products || []);
    } catch (error: any) {
      console.error('Error loading products:', error);
      Alert.alert('Error', 'No se pudieron cargar los productos');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadProducts();
  };

  const openCreateModal = () => {
    setEditingProduct(null);
    setFormData({
      name: '',
      description: '',
      price: '',
      interval: 'monthly',
      features: [''],
      is_active: true,
    });
    setModalVisible(true);
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      description: product.description || '',
      price: product.price.toString(),
      interval: product.interval,
      features: product.features.length > 0 ? product.features : [''],
      is_active: product.is_active,
    });
    setModalVisible(true);
  };

  const handleSave = async () => {
    try {
      // Validation
      if (!formData.name || !formData.price) {
        Alert.alert('Error', 'Nombre y precio son obligatorios');
        return;
      }

      const price = parseFloat(formData.price);
      if (isNaN(price) || price <= 0) {
        Alert.alert('Error', 'El precio debe ser un número válido mayor a 0');
        return;
      }

      const payload = {
        name: formData.name,
        description: formData.description,
        price: price,
        interval: formData.interval,
        features: formData.features.filter(f => f.trim() !== ''),
        is_active: formData.is_active,
      };

      if (editingProduct) {
        // Update
        await api.put(`/payments/admin/plans/${editingProduct.id}`, payload);
        Alert.alert('Éxito', 'Producto actualizado correctamente');
      } else {
        // Create
        await api.post('/payments/admin/plans', payload);
        Alert.alert('Éxito', 'Producto creado correctamente');
      }

      setModalVisible(false);
      loadProducts();
    } catch (error: any) {
      console.error('Error saving product:', error);
      Alert.alert('Error', error.response?.data?.detail || 'No se pudo guardar el producto');
    }
  };

  const handleDelete = (product: Product) => {
    Alert.alert(
      'Confirmar',
      `¿Desactivar el producto "${product.name}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desactivar',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/payments/admin/plans/${product.id}`);
              Alert.alert('Éxito', 'Producto desactivado');
              loadProducts();
            } catch (error: any) {
              Alert.alert('Error', 'No se pudo desactivar el producto');
            }
          },
        },
      ]
    );
  };

  const addFeature = () => {
    setFormData({
      ...formData,
      features: [...formData.features, ''],
    });
  };

  const removeFeature = (index: number) => {
    const newFeatures = formData.features.filter((_, i) => i !== index);
    setFormData({
      ...formData,
      features: newFeatures.length > 0 ? newFeatures : [''],
    });
  };

  const updateFeature = (index: number, value: string) => {
    const newFeatures = [...formData.features];
    newFeatures[index] = value;
    setFormData({ ...formData, features: newFeatures });
  };

  const getBillingLabel = (interval: string) => {
    const labels = {
      weekly: 'Semanal',
      biweekly: 'Quincenal',
      monthly: 'Mensual',
      yearly: 'Anual',
    };
    return labels[interval as keyof typeof labels] || interval;
  };

  const renderTabBar = () => (
    <View style={[styles.tabBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
      <TouchableOpacity
        style={[styles.tab, activeTab === 'active' && { borderBottomColor: colors.primary, borderBottomWidth: 3 }]}
        onPress={() => setActiveTab('active')}
      >
        <Ionicons name="checkmark-circle" size={20} color={activeTab === 'active' ? colors.primary : colors.textSecondary} />
        <Text style={[styles.tabText, { color: activeTab === 'active' ? colors.primary : colors.textSecondary }]}>
          Activos
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.tab, activeTab === 'all' && { borderBottomColor: colors.primary, borderBottomWidth: 3 }]}
        onPress={() => setActiveTab('all')}
      >
        <Ionicons name="list" size={20} color={activeTab === 'all' ? colors.primary : colors.textSecondary} />
        <Text style={[styles.tabText, { color: activeTab === 'all' ? colors.primary : colors.textSecondary }]}>
          Todos
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderProductCard = (product: Product) => (
    <View key={product.id} style={[styles.productCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.productHeader}>
        <View style={styles.productInfo}>
          <Text style={[styles.productName, { color: colors.text }]}>{product.name}</Text>
          <Text style={[styles.productPrice, { color: colors.primary }]}>
            ${product.price.toFixed(2)}/{getBillingLabel(product.interval)}
          </Text>
        </View>
        <View style={styles.productActions}>
          <TouchableOpacity onPress={() => openEditModal(product)} style={styles.actionButton}>
            <Ionicons name="create-outline" size={22} color={colors.primary} />
          </TouchableOpacity>
          {product.is_active && (
            <TouchableOpacity onPress={() => handleDelete(product)} style={styles.actionButton}>
              <Ionicons name="trash-outline" size={22} color={colors.error} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {product.description && (
        <Text style={[styles.productDescription, { color: colors.textSecondary }]}>{product.description}</Text>
      )}

      {product.features.length > 0 && (
        <View style={styles.featuresContainer}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Características:</Text>
          {product.features.map((feature, index) => (
            <View key={index} style={styles.featureItem}>
              <Ionicons name="checkmark-circle" size={16} color={colors.success} />
              <Text style={[styles.featureText, { color: colors.text }]}>{feature}</Text>
            </View>
          ))}
        </View>
      )}

      {!product.is_active && (
        <View style={[styles.inactiveBadge, { backgroundColor: colors.error + '15' }]}>
          <Ionicons name="close-circle" size={16} color={colors.error} />
          <Text style={[styles.inactiveBadgeText, { color: colors.error }]}>Inactivo</Text>
        </View>
      )}
    </View>
  );

  const renderModal = () => (
    <Modal
      visible={modalVisible}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setModalVisible(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {editingProduct ? 'Editar Producto' : 'Nuevo Producto'}
            </Text>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Ionicons name="close" size={28} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            {/* Nombre */}
            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.text }]}>Nombre *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
                value={formData.name}
                onChangeText={(text) => setFormData({ ...formData, name: text })}
                placeholder="Ej: Plan Premium"
                placeholderTextColor={colors.textSecondary}
              />
            </View>

            {/* Descripción */}
            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.text }]}>Descripción</Text>
              <TextInput
                style={[styles.input, styles.textArea, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
                value={formData.description}
                onChangeText={(text) => setFormData({ ...formData, description: text })}
                placeholder={t('admin.productDescPlaceholder', 'Descripción del producto')}
                placeholderTextColor={colors.textSecondary}
                multiline
                numberOfLines={3}
              />
            </View>

            {/* Precio */}
            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.text }]}>Precio (USD) *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
                value={formData.price}
                onChangeText={(text) => setFormData({ ...formData, price: text })}
                placeholder="29.99"
                placeholderTextColor={colors.textSecondary}
                keyboardType="decimal-pad"
              />
            </View>

            {/* Intervalo de facturación */}
            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.text }]}>Intervalo de Facturación *</Text>
              <View style={styles.intervalButtons}>
                {[
                  { key: 'weekly', label: 'Semanal' },
                  { key: 'biweekly', label: 'Quincenal' },
                  { key: 'monthly', label: 'Mensual' },
                  { key: 'yearly', label: 'Anual' },
                ].map((interval) => (
                  <TouchableOpacity
                    key={interval.key}
                    style={[
                      styles.intervalButton,
                      { borderColor: colors.border },
                      formData.interval === interval.key && { backgroundColor: colors.primary, borderColor: colors.primary }
                    ]}
                    onPress={() => setFormData({ ...formData, interval: interval.key as any })}
                  >
                    <Text style={[
                      styles.intervalButtonText,
                      { color: formData.interval === interval.key ? '#fff' : colors.text }
                    ]}>
                      {interval.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Features */}
            <View style={styles.formGroup}>
              <View style={styles.labelRow}>
                <Text style={[styles.label, { color: colors.text }]}>Características</Text>
                <TouchableOpacity onPress={addFeature} style={styles.addButton}>
                  <Ionicons name="add-circle" size={20} color={colors.primary} />
                  <Text style={[styles.addButtonText, { color: colors.primary }]}>Agregar</Text>
                </TouchableOpacity>
              </View>
              {formData.features.map((feature, index) => (
                <View key={index} style={styles.featureInputRow}>
                  <TextInput
                    style={[styles.featureInput, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
                    value={feature}
                    onChangeText={(text) => updateFeature(index, text)}
                    placeholder="Ej: Soporte 24/7"
                    placeholderTextColor={colors.textSecondary}
                  />
                  {formData.features.length > 1 && (
                    <TouchableOpacity onPress={() => removeFeature(index)}>
                      <Ionicons name="close-circle" size={24} color={colors.error} />
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>

            {/* Activo */}
            <View style={[styles.switchRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.switchLabel, { color: colors.text }]}>Producto Activo</Text>
              <Switch
                value={formData.is_active}
                onValueChange={(value) => setFormData({ ...formData, is_active: value })}
                trackColor={{ false: colors.border, true: colors.success }}
                thumbColor={formData.is_active ? '#fff' : '#f4f3f4'}
              />
            </View>
          </ScrollView>

          <View style={[styles.modalFooter, { borderTopColor: colors.border }]}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton, { backgroundColor: colors.border }]}
              onPress={() => setModalVisible(false)}
            >
              <Text style={[styles.buttonText, { color: colors.text }]}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.saveButton, { backgroundColor: colors.primary }]}
              onPress={handleSave}
            >
              <Text style={[styles.buttonText, { color: '#fff' }]}>Guardar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <AdminHeader title="Gestión de Productos" showBack />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.text }]}>Cargando productos...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AdminHeader title="Gestión de Productos" showBack />
      
      {renderTabBar()}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        <View style={styles.headerSection}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            {products.length} Producto{products.length !== 1 ? 's' : ''}
          </Text>
          <TouchableOpacity
            style={[styles.createButton, { backgroundColor: colors.primary }]}
            onPress={openCreateModal}
          >
            <Ionicons name="add" size={20} color="#fff" />
            <Text style={styles.createButtonText}>Nuevo Producto</Text>
          </TouchableOpacity>
        </View>

        {products.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="cube-outline" size={64} color={colors.textLight} />
            <Text style={[styles.emptyText, { color: colors.textLight }]}>
              {activeTab === 'active' ? 'No hay productos activos' : 'No hay productos'}
            </Text>
            <TouchableOpacity
              style={[styles.emptyButton, { backgroundColor: colors.primary }]}
              onPress={openCreateModal}
            >
              <Text style={styles.emptyButtonText}>Crear Primer Producto</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.productsGrid}>
            {products.map(renderProductCard)}
          </View>
        )}
      </ScrollView>

      {renderModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  headerSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  productsGrid: {
    gap: 16,
  },
  productCard: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  productHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  productPrice: {
    fontSize: 16,
    fontWeight: '600',
  },
  productActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    padding: 8,
  },
  productDescription: {
    fontSize: 14,
    marginBottom: 12,
    lineHeight: 20,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  featuresContainer: {
    marginTop: 8,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  featureText: {
    fontSize: 14,
    flex: 1,
  },
  inactiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  inactiveBadgeText: {
    fontSize: 13,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 16,
    marginBottom: 24,
  },
  emptyButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  emptyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  modalBody: {
    padding: 20,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  intervalButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  intervalButton: {
    flex: 1,
    minWidth: '45%',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  intervalButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
  },
  switchLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  featureInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  featureInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {},
  saveButton: {},
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
