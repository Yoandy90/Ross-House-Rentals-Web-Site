import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
  TextInput,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import api from '../../services/api';
import { useTranslation } from 'react-i18next';

const COLORS = {
  primary: '#6C1110',
  secondary: '#D4AF37',
  background: '#1a1a1a',
  surface: '#2a2a2a',
  surfaceLight: '#3a3a3a',
  text: '#FFFFFF',
  textSecondary: '#888',
  success: '#4CAF50',
  warning: '#FF9800',
  error: '#f44336',
};

interface Plan {
  id: string;
  name: string;
  description: string;
  price: number;
  interval: 'weekly' | 'biweekly' | 'monthly' | 'yearly';
  features: string[];
  is_active: boolean;
  apple_product_id?: string;
  stripe_price_id?: string;
}

export default function AdminPlansScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    interval: 'monthly' as 'weekly' | 'biweekly' | 'monthly' | 'yearly',
    features: '',
    apple_product_id: '',
  });

  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    try {
      setLoading(true);
      const response = await api.get('/admin/plans');
      setPlans(response.data || []);
    } catch (error) {
      console.error('Error loading plans:', error);
      Alert.alert('Error', 'No se pudieron cargar los planes');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadPlans();
  };

  const getIntervalText = (interval: string) => {
    const map: Record<string, string> = {
      weekly: 'Semanal',
      biweekly: 'Quincenal',
      monthly: 'Mensual',
      yearly: 'Anual'
    };
    return map[interval] || interval;
  };

  const handleCreatePlan = () => {
    setFormData({
      name: '',
      description: '',
      price: '',
      interval: 'monthly',
      features: '',
      apple_product_id: '',
    });
    setEditingPlan(null);
    setShowModal(true);
  };

  const handleEditPlan = (plan: Plan) => {
    setFormData({
      name: plan.name,
      description: plan.description,
      price: plan.price.toString(),
      interval: plan.interval,
      features: plan.features?.join('\n') || '',
      apple_product_id: plan.apple_product_id || '',
    });
    setEditingPlan(plan);
    setShowModal(true);
  };

  const handleSavePlan = async () => {
    if (!formData.name.trim() || !formData.price) {
      Alert.alert('Error', 'Nombre y precio son requeridos');
      return;
    }

    const price = parseFloat(formData.price);
    if (isNaN(price) || price <= 0) {
      Alert.alert('Error', 'El precio debe ser un número válido mayor a 0');
      return;
    }

    const features = formData.features
      .split('\n')
      .map(f => f.trim())
      .filter(f => f.length > 0);

    setSaving(true);
    try {
      const payload = {
        name: formData.name,
        description: formData.description,
        price,
        interval: formData.interval,
        features,
        apple_product_id: formData.apple_product_id || null,
      };

      console.log('📝 Saving plan:', editingPlan ? 'UPDATE' : 'CREATE', payload);

      if (editingPlan) {
        console.log('📝 Updating plan ID:', editingPlan.id);
        const response = await api.patch(`/admin/plans/${editingPlan.id}`, payload);
        console.log('✅ Update response:', response.data);
        Alert.alert('Éxito', 'Plan actualizado correctamente');
      } else {
        console.log('📝 Creating new plan');
        const response = await api.post('/admin/plans', payload);
        console.log('✅ Create response:', response.data);
        Alert.alert('Éxito', 'Plan creado correctamente');
      }
      
      setShowModal(false);
      loadPlans();
    } catch (error: any) {
      console.error('❌ Error saving plan:', error);
      console.error('❌ Error response:', error.response?.data);
      console.error('❌ Error status:', error.response?.status);
      const errorMessage = error.response?.data?.detail || error.message || 'No se pudo guardar el plan';
      Alert.alert('Error', errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (plan: Plan) => {
    try {
      console.log('🔄 Toggling plan status:', plan.id, plan.name);
      const response = await api.patch(`/admin/plans/${plan.id}/toggle`);
      console.log('✅ Toggle response:', response.data);
      loadPlans();
    } catch (error: any) {
      console.error('❌ Error toggling plan:', error);
      console.error('❌ Error response:', error.response?.data);
      console.error('❌ Error status:', error.response?.status);
      Alert.alert('Error', error.response?.data?.detail || 'No se pudo cambiar el estado');
    }
  };

  const handleDeletePlan = (plan: Plan) => {
    Alert.alert(
      'Eliminar Plan',
      `¿Estás seguro que deseas eliminar "${plan.name}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('🗑️ Deleting plan:', plan.id, plan.name);
              const response = await api.delete(`/admin/plans/${plan.id}`);
              console.log('✅ Delete response:', response.data);
              Alert.alert('Éxito', 'Plan eliminado correctamente');
              loadPlans();
            } catch (error: any) {
              console.error('❌ Error deleting plan:', error);
              console.error('❌ Error response:', error.response?.data);
              console.error('❌ Error status:', error.response?.status);
              Alert.alert('Error', error.response?.data?.detail || 'No se pudo eliminar el plan');
            }
          }
        }
      ]
    );
  };

  const renderHeader = () => (
    <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
        <Ionicons name="arrow-back" size={24} color={COLORS.text} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Gestión de Planes</Text>
      <TouchableOpacity onPress={handleCreatePlan} style={styles.addButton}>
        <Ionicons name="add" size={24} color={COLORS.text} />
      </TouchableOpacity>
    </View>
  );

  const renderPlanCard = (plan: Plan) => (
    <View key={plan.id} style={[styles.planCard, !plan.is_active && styles.inactivePlan]}>
      <View style={styles.planHeader}>
        <View style={styles.planTitleRow}>
          <Text style={styles.planName}>{plan.name}</Text>
          <View style={[styles.statusBadge, { backgroundColor: plan.is_active ? COLORS.success : COLORS.error }]}>
            <Text style={styles.statusText}>{plan.is_active ? 'Activo' : 'Inactivo'}</Text>
          </View>
        </View>
        <Text style={styles.planPrice}>${plan.price.toFixed(2)}<Text style={styles.planInterval}>/{getIntervalText(plan.interval)}</Text></Text>
      </View>
      
      <Text style={styles.planDescription}>{plan.description}</Text>
      
      {plan.features && plan.features.length > 0 && (
        <View style={styles.featuresContainer}>
          {plan.features.map((feature, idx) => (
            <View key={idx} style={styles.featureRow}>
              <Ionicons name="checkmark-circle" size={16} color={COLORS.success} />
              <Text style={styles.featureText}>{feature}</Text>
            </View>
          ))}
        </View>
      )}

      {plan.apple_product_id && (
        <View style={styles.appleIdContainer}>
          <Ionicons name="logo-apple" size={14} color={COLORS.textSecondary} />
          <Text style={styles.appleIdText}>{plan.apple_product_id}</Text>
        </View>
      )}
      
      <View style={styles.actionsRow}>
        <TouchableOpacity 
          style={[styles.actionBtn, styles.editBtn]} 
          onPress={() => handleEditPlan(plan)}
        >
          <Ionicons name="pencil" size={18} color={COLORS.text} />
          <Text style={styles.actionBtnText}>Editar</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.actionBtn, plan.is_active ? styles.deactivateBtn : styles.activateBtn]} 
          onPress={() => handleToggleStatus(plan)}
        >
          <Ionicons name={plan.is_active ? "close-circle" : "checkmark-circle"} size={18} color={COLORS.text} />
          <Text style={styles.actionBtnText}>{plan.is_active ? 'Desactivar' : 'Activar'}</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.actionBtn, styles.deleteBtn]} 
          onPress={() => handleDeletePlan(plan)}
        >
          <Ionicons name="trash" size={18} color={COLORS.text} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderModal = () => (
    <Modal visible={showModal} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{editingPlan ? 'Editar Plan' : 'Nuevo Plan'}</Text>
            <TouchableOpacity onPress={() => setShowModal(false)}>
              <Ionicons name="close" size={24} color={COLORS.text} />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.modalBody}>
            <Text style={styles.inputLabel}>Nombre *</Text>
            <TextInput
              style={styles.input}
              value={formData.name}
              onChangeText={(text) => setFormData({...formData, name: text})}
              placeholder={t('admin.planNamePlaceholder', 'Ej: Plan Básico')}
              placeholderTextColor={COLORS.textSecondary}
            />
            
            <Text style={styles.inputLabel}>Descripción</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={formData.description}
              onChangeText={(text) => setFormData({...formData, description: text})}
              placeholder={t('admin.planDescPlaceholder', 'Descripción del plan')}
              placeholderTextColor={COLORS.textSecondary}
              multiline
              numberOfLines={3}
            />
            
            <Text style={styles.inputLabel}>Precio (USD) *</Text>
            <TextInput
              style={styles.input}
              value={formData.price}
              onChangeText={(text) => setFormData({...formData, price: text})}
              placeholder="29.99"
              placeholderTextColor={COLORS.textSecondary}
              keyboardType="decimal-pad"
            />
            
            <Text style={styles.inputLabel}>Período</Text>
            <View style={styles.intervalRow}>
              {(['monthly', 'yearly', 'weekly', 'biweekly'] as const).map((interval) => (
                <TouchableOpacity
                  key={interval}
                  style={[styles.intervalBtn, formData.interval === interval && styles.intervalBtnActive]}
                  onPress={() => setFormData({...formData, interval})}
                >
                  <Text style={[styles.intervalBtnText, formData.interval === interval && styles.intervalBtnTextActive]}>
                    {getIntervalText(interval)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            
            <Text style={styles.inputLabel}>Características (una por línea)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={formData.features}
              onChangeText={(text) => setFormData({...formData, features: text})}
              placeholder={t('admin.planFeaturesPlaceholder', "1 declaración incluida\n10% descuento\nSoporte por email")}
              placeholderTextColor={COLORS.textSecondary}
              multiline
              numberOfLines={4}
            />
            
            <Text style={styles.inputLabel}>Apple Product ID (para In-App Purchase)</Text>
            <TextInput
              style={styles.input}
              value={formData.apple_product_id}
              onChangeText={(text) => setFormData({...formData, apple_product_id: text})}
              placeholder="com.rosstax.plan.basic.monthly"
              placeholderTextColor={COLORS.textSecondary}
              autoCapitalize="none"
            />
          </ScrollView>
          
          <View style={styles.modalFooter}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowModal(false)}>
              <Text style={styles.cancelBtnText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.saveBtn, saving && styles.saveBtnDisabled]} 
              onPress={handleSavePlan}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color={COLORS.text} />
              ) : (
                <Text style={styles.saveBtnText}>Guardar</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {renderHeader()}
      
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
        }
      >
        {plans.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="layers-outline" size={64} color={COLORS.textSecondary} />
            <Text style={styles.emptyText}>No hay planes</Text>
            <TouchableOpacity style={styles.createFirstBtn} onPress={handleCreatePlan}>
              <Text style={styles.createFirstBtnText}>Crear primer plan</Text>
            </TouchableOpacity>
          </View>
        ) : (
          plans.map(renderPlanCard)
        )}
        
        <View style={{ height: 100 }} />
      </ScrollView>
      
      {renderModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surface,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  addButton: {
    backgroundColor: COLORS.primary,
    padding: 8,
    borderRadius: 20,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  planCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  inactivePlan: {
    opacity: 0.6,
  },
  planHeader: {
    marginBottom: 12,
  },
  planTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  planName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '600',
  },
  planPrice: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.secondary,
  },
  planInterval: {
    fontSize: 14,
    fontWeight: 'normal',
    color: COLORS.textSecondary,
  },
  planDescription: {
    color: COLORS.textSecondary,
    marginBottom: 12,
  },
  featuresContainer: {
    marginBottom: 12,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  featureText: {
    color: COLORS.text,
    marginLeft: 8,
    fontSize: 14,
  },
  appleIdContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceLight,
    padding: 8,
    borderRadius: 8,
    marginBottom: 12,
  },
  appleIdText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginLeft: 6,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  actionBtnText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '500',
  },
  editBtn: {
    backgroundColor: COLORS.surfaceLight,
  },
  activateBtn: {
    backgroundColor: COLORS.success,
  },
  deactivateBtn: {
    backgroundColor: COLORS.warning,
  },
  deleteBtn: {
    backgroundColor: COLORS.error,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: 16,
    marginTop: 16,
  },
  createFirstBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  createFirstBtnText: {
    color: COLORS.text,
    fontWeight: '600',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surface,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  modalBody: {
    padding: 16,
    maxHeight: 400,
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.surface,
  },
  inputLabel: {
    color: COLORS.text,
    marginBottom: 6,
    fontWeight: '500',
  },
  input: {
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    padding: 12,
    color: COLORS.text,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.surfaceLight,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  intervalRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  intervalBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.surfaceLight,
  },
  intervalBtnActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  intervalBtnText: {
    color: COLORS.textSecondary,
  },
  intervalBtnTextActive: {
    color: COLORS.text,
    fontWeight: '600',
  },
  cancelBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: COLORS.text,
    fontWeight: '600',
  },
  saveBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    color: COLORS.text,
    fontWeight: '600',
  },
});
