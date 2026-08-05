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
  Alert,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../../constants/colors';
import CustomHeader from '../../components/CustomHeader';
import api from '../../services/api';
import { useRouter } from 'expo-router';

interface Subscription {
  id: string;
  user_id: string;
  product_id: string;
  product_name?: string;
  product_price?: number;
  status: string;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  stripe_subscription_id: string;
}

interface Product {
  id: string;
  name: string;
  price: number;
  billing_interval: string;
  payment_methods: {
    card: boolean;
    ach: boolean;
  };
}

interface User {
  _id: string;
  email: string;
  name: string;
}

interface PaymentMethod {
  id: string;
  type: string;
  last4: string;
  brand?: string;
  bank_name?: string;
}

export default function SubscriptionsManagementScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'search' | 'all'>('search');
  
  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userSubscriptions, setUserSubscriptions] = useState<Subscription[]>([]);
  
  // Products and payment methods
  const [products, setProducts] = useState<Product[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  
  // Modals
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingSubscription, setEditingSubscription] = useState<Subscription | null>(null);
  
  // Form state for create
  const [createForm, setCreateForm] = useState({
    product_id: '',
    payment_method_id: '',
    trial_days: '0',
  });
  
  // Form state for edit
  const [editForm, setEditForm] = useState({
    product_id: '',
    payment_method_id: '',
  });

  useEffect(() => {
    loadProducts();
    setLoading(false);
  }, []);

  useEffect(() => {
    if (selectedUser) {
      loadUserSubscriptions(selectedUser._id);
      loadUserPaymentMethods(selectedUser._id);
    }
  }, [selectedUser]);

  const loadProducts = async () => {
    try {
      const response = await api.get('/api/admin/subscriptions/products?include_inactive=false');
      setProducts(response.data.products || []);
    } catch (error) {
      console.error('Error loading products:', error);
    }
  };

  const loadUserSubscriptions = async (userId: string) => {
    try {
      const response = await api.get(`/api/admin/subscriptions/user/${userId}`);
      setUserSubscriptions(response.data.subscriptions || []);
    } catch (error) {
      console.error('Error loading subscriptions:', error);
    }
  };

  const loadUserPaymentMethods = async (userId: string) => {
    try {
      // Try to get payment methods
      const response = await api.get(`/api/payments/payment-methods`);
      setPaymentMethods(response.data || []);
    } catch (error) {
      console.error('Error loading payment methods:', error);
      setPaymentMethods([]);
    }
  };

  const searchUsers = async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    try {
      const response = await api.get(`/api/admin/clients?search=${encodeURIComponent(query)}&limit=20`);
      const users = response.data.clients || [];
      setSearchResults(users);
    } catch (error) {
      console.error('Error searching users:', error);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    if (selectedUser) {
      loadUserSubscriptions(selectedUser._id);
      loadUserPaymentMethods(selectedUser._id);
    }
    setRefreshing(false);
  };

  const openCreateModal = () => {
    if (!selectedUser) {
      Alert.alert('Error', 'Selecciona un usuario primero');
      return;
    }
    setCreateForm({
      product_id: products[0]?.id || '',
      payment_method_id: paymentMethods[0]?.id || '',
      trial_days: '0',
    });
    setCreateModalVisible(true);
  };

  const openEditModal = (subscription: Subscription) => {
    setEditingSubscription(subscription);
    setEditForm({
      product_id: subscription.product_id,
      payment_method_id: '',
    });
    setEditModalVisible(true);
  };

  const handleCreateSubscription = async () => {
    if (!selectedUser) return;

    try {
      if (!createForm.product_id || !createForm.payment_method_id) {
        Alert.alert('Error', 'Selecciona un producto y método de pago');
        return;
      }

      await api.post('/api/admin/subscriptions/create', {
        user_id: selectedUser._id,
        product_id: createForm.product_id,
        payment_method_id: createForm.payment_method_id,
        trial_days: parseInt(createForm.trial_days) || 0,
      });

      Alert.alert('Éxito', 'Suscripción creada correctamente');
      setCreateModalVisible(false);
      loadUserSubscriptions(selectedUser._id);
    } catch (error: any) {
      console.error('Error creating subscription:', error);
      Alert.alert('Error', error.response?.data?.detail || 'No se pudo crear la suscripción');
    }
  };

  const handleUpdateSubscription = async () => {
    if (!editingSubscription) return;

    try {
      const updates: any = {};
      if (editForm.product_id && editForm.product_id !== editingSubscription.product_id) {
        updates.product_id = editForm.product_id;
      }
      if (editForm.payment_method_id) {
        updates.payment_method_id = editForm.payment_method_id;
      }

      if (Object.keys(updates).length === 0) {
        Alert.alert('Info', 'No hay cambios para guardar');
        return;
      }

      await api.put(`/api/admin/subscriptions/${editingSubscription.id}`, updates);

      Alert.alert('Éxito', 'Suscripción actualizada correctamente');
      setEditModalVisible(false);
      if (selectedUser) {
        loadUserSubscriptions(selectedUser._id);
      }
    } catch (error: any) {
      console.error('Error updating subscription:', error);
      Alert.alert('Error', error.response?.data?.detail || 'No se pudo actualizar la suscripción');
    }
  };

  const handleCancelSubscription = (subscription: Subscription, immediate: boolean) => {
    Alert.alert(
      'Confirmar Cancelación',
      immediate
        ? '¿Cancelar la suscripción inmediatamente?'
        : '¿Cancelar al final del período actual?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Sí, Cancelar',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.post(`/api/admin/subscriptions/${subscription.id}/cancel?immediate=${immediate}`);
              Alert.alert('Éxito', 'Suscripción cancelada');
              if (selectedUser) {
                loadUserSubscriptions(selectedUser._id);
              }
            } catch (error: any) {
              Alert.alert('Error', 'No se pudo cancelar la suscripción');
            }
          },
        },
      ]
    );
  };

  const handleReactivateSubscription = async (subscription: Subscription) => {
    try {
      await api.post(`/api/admin/subscriptions/${subscription.id}/reactivate`);
      Alert.alert('Éxito', 'Suscripción reactivada');
      if (selectedUser) {
        loadUserSubscriptions(selectedUser._id);
      }
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'No se pudo reactivar');
    }
  };

  const getStatusColor = (status: string) => {
    const statusColors: any = {
      active: colors.success,
      canceled: colors.error,
      past_due: colors.warning,
      trialing: colors.info,
      incomplete: colors.warning,
    };
    return statusColors[status] || colors.textSecondary;
  };

  const getStatusLabel = (status: string) => {
    const labels: any = {
      active: 'Activa',
      canceled: 'Cancelada',
      past_due: 'Pago Vencido',
      trialing: 'Prueba',
      incomplete: 'Incompleta',
    };
    return labels[status] || status;
  };

  const renderTabBar = () => (
    <View style={[styles.tabBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
      <TouchableOpacity
        style={[styles.tab, activeTab === 'search' && { borderBottomColor: colors.primary, borderBottomWidth: 3 }]}
        onPress={() => setActiveTab('search')}
      >
        <Ionicons name="search" size={20} color={activeTab === 'search' ? colors.primary : colors.textSecondary} />
        <Text style={[styles.tabText, { color: activeTab === 'search' ? colors.primary : colors.textSecondary }]}>
          Buscar Usuario
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.tab, activeTab === 'all' && { borderBottomColor: colors.primary, borderBottomWidth: 3 }]}
        onPress={() => setActiveTab('all')}
      >
        <Ionicons name="list" size={20} color={activeTab === 'all' ? colors.primary : colors.textSecondary} />
        <Text style={[styles.tabText, { color: activeTab === 'all' ? colors.primary : colors.textSecondary }]}>
          Todas
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderSearchSection = () => (
    <View style={styles.searchSection}>
      <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Ionicons name="search" size={20} color={colors.textSecondary} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Buscar usuario por nombre o email..."
          placeholderTextColor={colors.textSecondary}
          value={searchQuery}
          onChangeText={(text) => {
            setSearchQuery(text);
            searchUsers(text);
          }}
        />
      </View>

      {searchResults.length > 0 && (
        <View style={[styles.searchResults, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {searchResults.map((user) => (
            <TouchableOpacity
              key={user._id}
              style={[styles.searchResultItem, { borderBottomColor: colors.border }]}
              onPress={() => {
                setSelectedUser(user);
                setSearchQuery('');
                setSearchResults([]);
              }}
            >
              <View>
                <Text style={[styles.resultName, { color: colors.text }]}>{user.name}</Text>
                <Text style={[styles.resultEmail, { color: colors.textSecondary }]}>{user.email}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {selectedUser && (
        <View style={[styles.selectedUser, { backgroundColor: colors.card, borderColor: colors.primary }]}>
          <View style={styles.selectedUserInfo}>
            <Ionicons name="person-circle" size={48} color={colors.primary} />
            <View style={styles.selectedUserDetails}>
              <Text style={[styles.selectedUserName, { color: colors.text }]}>{selectedUser.name}</Text>
              <Text style={[styles.selectedUserEmail, { color: colors.textSecondary }]}>{selectedUser.email}</Text>
            </View>
          </View>
          <TouchableOpacity
            style={[styles.createSubButton, { backgroundColor: colors.primary }]}
            onPress={openCreateModal}
          >
            <Ionicons name="add" size={20} color="#fff" />
            <Text style={styles.createSubButtonText}>Nueva Suscripción</Text>
          </TouchableOpacity>

          <View style={styles.subscriptionsList}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Suscripciones ({userSubscriptions.length})
            </Text>

            {userSubscriptions.length === 0 ? (
              <View style={styles.emptySubscriptions}>
                <Ionicons name="calendar-outline" size={48} color={colors.textLight} />
                <Text style={[styles.emptyText, { color: colors.textLight }]}>
                  Este usuario no tiene suscripciones
                </Text>
              </View>
            ) : (
              userSubscriptions.map(renderSubscriptionCard)
            )}
          </View>
        </View>
      )}
    </View>
  );

  const renderSubscriptionCard = (subscription: Subscription) => (
    <View key={subscription.id} style={[styles.subCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
      <View style={styles.subHeader}>
        <View style={styles.subInfo}>
          <Text style={[styles.subProductName, { color: colors.text }]}>
            {subscription.product_name || 'Producto'}
          </Text>
          <Text style={[styles.subPrice, { color: colors.primary }]}>
            ${subscription.product_price?.toFixed(2) || '0.00'}/mes
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(subscription.status) + '20' }]}>
          <Text style={[styles.statusText, { color: getStatusColor(subscription.status) }]}>
            {getStatusLabel(subscription.status)}
          </Text>
        </View>
      </View>

      <View style={styles.subDates}>
        <Text style={[styles.subDate, { color: colors.textSecondary }]}>
          Inicio: {new Date(subscription.current_period_start).toLocaleDateString('es-ES')}
        </Text>
        <Text style={[styles.subDate, { color: colors.textSecondary }]}>
          Fin: {new Date(subscription.current_period_end).toLocaleDateString('es-ES')}
        </Text>
      </View>

      {subscription.cancel_at_period_end && (
        <View style={[styles.cancelWarning, { backgroundColor: colors.warning + '20' }]}>
          <Ionicons name="warning" size={16} color={colors.warning} />
          <Text style={[styles.cancelWarningText, { color: colors.warning }]}>
            Se cancelará al final del período
          </Text>
        </View>
      )}

      <View style={styles.subActions}>
        <TouchableOpacity
          style={[styles.subActionButton, { backgroundColor: colors.info + '20' }]}
          onPress={() => openEditModal(subscription)}
        >
          <Ionicons name="create-outline" size={18} color={colors.info} />
          <Text style={[styles.subActionText, { color: colors.info }]}>Editar</Text>
        </TouchableOpacity>

        {subscription.cancel_at_period_end ? (
          <TouchableOpacity
            style={[styles.subActionButton, { backgroundColor: colors.success + '20' }]}
            onPress={() => handleReactivateSubscription(subscription)}
          >
            <Ionicons name="refresh" size={18} color={colors.success} />
            <Text style={[styles.subActionText, { color: colors.success }]}>Reactivar</Text>
          </TouchableOpacity>
        ) : subscription.status === 'active' ? (
          <>
            <TouchableOpacity
              style={[styles.subActionButton, { backgroundColor: colors.warning + '20' }]}
              onPress={() => handleCancelSubscription(subscription, false)}
            >
              <Ionicons name="time-outline" size={18} color={colors.warning} />
              <Text style={[styles.subActionText, { color: colors.warning }]}>Cancelar al fin</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.subActionButton, { backgroundColor: colors.error + '20' }]}
              onPress={() => handleCancelSubscription(subscription, true)}
            >
              <Ionicons name="close-circle-outline" size={18} color={colors.error} />
              <Text style={[styles.subActionText, { color: colors.error }]}>Cancelar ya</Text>
            </TouchableOpacity>
          </>
        ) : null}
      </View>
    </View>
  );

  const renderCreateModal = () => (
    <Modal
      visible={createModalVisible}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setCreateModalVisible(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Nueva Suscripción</Text>
            <TouchableOpacity onPress={() => setCreateModalVisible(false)}>
              <Ionicons name="close" size={28} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
              Para: {selectedUser?.name} ({selectedUser?.email})
            </Text>

            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.text }]}>Producto *</Text>
              {products.map((product) => (
                <TouchableOpacity
                  key={product.id}
                  style={[
                    styles.productOption,
                    { backgroundColor: colors.card, borderColor: colors.border },
                    createForm.product_id === product.id && { borderColor: colors.primary, borderWidth: 2 }
                  ]}
                  onPress={() => setCreateForm({ ...createForm, product_id: product.id })}
                >
                  <View style={styles.productOptionInfo}>
                    <Text style={[styles.productOptionName, { color: colors.text }]}>{product.name}</Text>
                    <Text style={[styles.productOptionPrice, { color: colors.primary }]}>
                      ${product.price.toFixed(2)}/{product.billing_interval}
                    </Text>
                  </View>
                  {createForm.product_id === product.id && (
                    <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.text }]}>Método de Pago *</Text>
              {paymentMethods.length === 0 ? (
                <Text style={[styles.noPaymentMethods, { color: colors.textSecondary }]}>
                  El usuario no tiene métodos de pago guardados
                </Text>
              ) : (
                paymentMethods.map((pm) => (
                  <TouchableOpacity
                    key={pm.id}
                    style={[
                      styles.paymentOption,
                      { backgroundColor: colors.card, borderColor: colors.border },
                      createForm.payment_method_id === pm.id && { borderColor: colors.primary, borderWidth: 2 }
                    ]}
                    onPress={() => setCreateForm({ ...createForm, payment_method_id: pm.id })}
                  >
                    <Ionicons
                      name={pm.type === 'card' ? 'card' : 'business'}
                      size={24}
                      color={pm.type === 'card' ? colors.success : colors.info}
                    />
                    <View style={styles.paymentOptionInfo}>
                      <Text style={[styles.paymentOptionType, { color: colors.text }]}>
                        {pm.type === 'card' ? `${pm.brand} ••••` : `${pm.bank_name} ••••`} {pm.last4}
                      </Text>
                    </View>
                    {createForm.payment_method_id === pm.id && (
                      <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
                    )}
                  </TouchableOpacity>
                ))
              )}
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.text }]}>Días de Prueba (Opcional)</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
                value={createForm.trial_days}
                onChangeText={(text) => setCreateForm({ ...createForm, trial_days: text })}
                placeholder="0"
                placeholderTextColor={colors.textSecondary}
                keyboardType="number-pad"
              />
            </View>
          </ScrollView>

          <View style={[styles.modalFooter, { borderTopColor: colors.border }]}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton, { backgroundColor: colors.border }]}
              onPress={() => setCreateModalVisible(false)}
            >
              <Text style={[styles.buttonText, { color: colors.text }]}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.saveButton, { backgroundColor: colors.primary }]}
              onPress={handleCreateSubscription}
            >
              <Text style={[styles.buttonText, { color: '#fff' }]}>Crear Suscripción</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  const renderEditModal = () => (
    <Modal
      visible={editModalVisible}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setEditModalVisible(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Editar Suscripción</Text>
            <TouchableOpacity onPress={() => setEditModalVisible(false)}>
              <Ionicons name="close" size={28} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.text }]}>Cambiar Plan</Text>
              {products.map((product) => (
                <TouchableOpacity
                  key={product.id}
                  style={[
                    styles.productOption,
                    { backgroundColor: colors.card, borderColor: colors.border },
                    editForm.product_id === product.id && { borderColor: colors.primary, borderWidth: 2 }
                  ]}
                  onPress={() => setEditForm({ ...editForm, product_id: product.id })}
                >
                  <View style={styles.productOptionInfo}>
                    <Text style={[styles.productOptionName, { color: colors.text }]}>{product.name}</Text>
                    <Text style={[styles.productOptionPrice, { color: colors.primary }]}>
                      ${product.price.toFixed(2)}/{product.billing_interval}
                    </Text>
                  </View>
                  {editForm.product_id === product.id && (
                    <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.text }]}>Cambiar Método de Pago (Opcional)</Text>
              {paymentMethods.map((pm) => (
                <TouchableOpacity
                  key={pm.id}
                  style={[
                    styles.paymentOption,
                    { backgroundColor: colors.card, borderColor: colors.border },
                    editForm.payment_method_id === pm.id && { borderColor: colors.primary, borderWidth: 2 }
                  ]}
                  onPress={() => setEditForm({ ...editForm, payment_method_id: pm.id })}
                >
                  <Ionicons
                    name={pm.type === 'card' ? 'card' : 'business'}
                    size={24}
                    color={pm.type === 'card' ? colors.success : colors.info}
                  />
                  <View style={styles.paymentOptionInfo}>
                    <Text style={[styles.paymentOptionType, { color: colors.text }]}>
                      {pm.type === 'card' ? `${pm.brand} ••••` : `${pm.bank_name} ••••`} {pm.last4}
                    </Text>
                  </View>
                  {editForm.payment_method_id === pm.id && (
                    <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          <View style={[styles.modalFooter, { borderTopColor: colors.border }]}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton, { backgroundColor: colors.border }]}
              onPress={() => setEditModalVisible(false)}
            >
              <Text style={[styles.buttonText, { color: colors.text }]}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.saveButton, { backgroundColor: colors.primary }]}
              onPress={handleUpdateSubscription}
            >
              <Text style={[styles.buttonText, { color: '#fff' }]}>Guardar Cambios</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <CustomHeader title="Gestión de Suscripciones" onBack={() => router.back()} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.text }]}>Cargando...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <CustomHeader title="Gestión de Suscripciones" onBack={() => router.back()} />
      
      {renderTabBar()}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {activeTab === 'search' && renderSearchSection()}
        
        {activeTab === 'all' && (
          <View style={styles.allSection}>
            <Text style={[styles.allText, { color: colors.textSecondary }]}>
              Funcionalidad "Todas las suscripciones" próximamente
            </Text>
          </View>
        )}
      </ScrollView>

      {renderCreateModal()}
      {renderEditModal()}
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
  searchSection: {
    gap: 16,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  searchResults: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  searchResultItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  resultName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  resultEmail: {
    fontSize: 14,
  },
  selectedUser: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
  },
  selectedUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 16,
  },
  selectedUserDetails: {
    flex: 1,
  },
  selectedUserName: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  selectedUserEmail: {
    fontSize: 14,
  },
  createSubButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 8,
    marginBottom: 20,
  },
  createSubButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  subscriptionsList: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  emptySubscriptions: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 14,
    marginTop: 12,
  },
  subCard: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  subHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  subInfo: {
    flex: 1,
  },
  subProductName: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  subPrice: {
    fontSize: 14,
    fontWeight: '600',
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  subDates: {
    marginBottom: 12,
  },
  subDate: {
    fontSize: 13,
    marginBottom: 4,
  },
  cancelWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  cancelWarningText: {
    fontSize: 13,
    fontWeight: '600',
  },
  subActions: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  subActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  subActionText: {
    fontSize: 13,
    fontWeight: '600',
  },
  allSection: {
    padding: 32,
    alignItems: 'center',
  },
  allText: {
    fontSize: 14,
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
    maxHeight: '85%',
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
  modalSubtitle: {
    fontSize: 14,
    marginBottom: 20,
  },
  modalBody: {
    padding: 20,
  },
  formGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  productOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
  productOptionInfo: {
    flex: 1,
  },
  productOptionName: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  productOptionPrice: {
    fontSize: 14,
    fontWeight: '500',
  },
  paymentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
  paymentOptionInfo: {
    flex: 1,
  },
  paymentOptionType: {
    fontSize: 15,
    fontWeight: '600',
  },
  noPaymentMethods: {
    fontSize: 14,
    textAlign: 'center',
    padding: 20,
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
