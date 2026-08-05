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
  TextInput,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AdminHeader from '../../components/admin/AdminHeader';
import { useThemeColors } from '../../constants/colors';
import api from '../../services/api';
import { useTranslation } from 'react-i18next';

interface Package {
  _id?: string;
  id?: string;
  name: string;
  description: string;
  amount_usd: number;
  base_credits: number;
  bonus_percentage: number;
  total_credits: number;
  is_active: boolean;
  sort_order: number;
}

export default function AdminCreditsPackages() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [packages, setPackages] = useState<Package[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingPackage, setEditingPackage] = useState<Package | null>(null);
  const [processing, setProcessing] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    amount_usd: '',
    base_credits: '',
    bonus_percentage: '',
    sort_order: '0',
  });

  useEffect(() => {
    loadPackages();
  }, []);

  const loadPackages = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const response = await api.get('/admin/credits/packages');
      setPackages(response.data || []);
    } catch (error) {
      console.error('Error loading packages:', error);
      Alert.alert('Error', 'No se pudieron cargar los paquetes');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    loadPackages(true);
  };

  const openCreateModal = () => {
    setEditingPackage(null);
    setFormData({
      name: '',
      description: '',
      amount_usd: '',
      base_credits: '',
      bonus_percentage: '0',
      sort_order: '0',
    });
    setModalVisible(true);
  };

  const openEditModal = (pkg: Package) => {
    setEditingPackage(pkg);
    setFormData({
      name: pkg.name,
      description: pkg.description,
      amount_usd: pkg.amount_usd.toString(),
      base_credits: pkg.base_credits.toString(),
      bonus_percentage: pkg.bonus_percentage.toString(),
      sort_order: pkg.sort_order.toString(),
    });
    setModalVisible(true);
  };

  const handleSave = async () => {
    // Validation
    if (!formData.name.trim()) {
      Alert.alert('Error', 'El nombre es requerido');
      return;
    }
    if (!formData.amount_usd || parseFloat(formData.amount_usd) <= 0) {
      Alert.alert('Error', 'El precio debe ser mayor a 0');
      return;
    }
    if (!formData.base_credits || parseFloat(formData.base_credits) <= 0) {
      Alert.alert('Error', 'Los créditos base deben ser mayores a 0');
      return;
    }

    try {
      setProcessing(true);

      const data = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        amount_usd: parseFloat(formData.amount_usd),
        base_credits: parseFloat(formData.base_credits),
        bonus_percentage: parseFloat(formData.bonus_percentage) || 0,
        sort_order: parseInt(formData.sort_order) || 0,
      };

      if (editingPackage) {
        // Update existing package
        const packageId = editingPackage._id || editingPackage.id;
        await api.patch(`/admin/credits/packages/${packageId}`, data);
        Alert.alert('¡Éxito!', 'Paquete actualizado correctamente');
      } else {
        // Create new package
        await api.post('/admin/credits/packages', data);
        Alert.alert('¡Éxito!', 'Paquete creado correctamente');
      }

      setModalVisible(false);
      loadPackages();
    } catch (error: any) {
      console.error('Error saving package:', error);
      const errorMsg = error.response?.data?.detail || 'Error al guardar el paquete';
      Alert.alert('Error', errorMsg);
    } finally {
      setProcessing(false);
    }
  };

  const handleToggleStatus = async (pkg: Package) => {
    const packageId = pkg._id || pkg.id;
    const newStatus = !pkg.is_active;
    
    Alert.alert(
      'Cambiar Estado',
      `¿Deseas ${newStatus ? 'activar' : 'desactivar'} este paquete?\n\n${pkg.name}`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              setProcessing(true);
              await api.patch(`/admin/credits/packages/${packageId}`, {
                is_active: newStatus,
              });
              Alert.alert('¡Éxito!', `Paquete ${newStatus ? 'activado' : 'desactivado'}`);
              loadPackages();
            } catch (error: any) {
              console.error('Error toggling status:', error);
              Alert.alert('Error', 'No se pudo cambiar el estado del paquete');
            } finally {
              setProcessing(false);
            }
          },
        },
      ]
    );
  };

  const formatCurrency = (amount: number) => {
    return `$${amount.toFixed(2)}`;
  };

  const calculateTotalCredits = () => {
    const base = parseFloat(formData.base_credits) || 0;
    const bonus = parseFloat(formData.bonus_percentage) || 0;
    return base + (base * bonus / 100);
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <AdminHeader 
          title="Paquetes de Créditos" 
          subtitle="Cargando..."
          rightAction={{
            icon: 'add-circle',
            onPress: openCreateModal
          }}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Cargando paquetes...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AdminHeader 
        title="Paquetes de Créditos" 
        subtitle={`${packages.length} paquetes`}
        rightAction={{
          icon: 'add-circle',
          onPress: openCreateModal
        }}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
            {packages.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="pricetag-outline" size={64} color={colors.textGray} />
                <Text style={styles.emptyStateTitle}>Sin Paquetes</Text>
                <Text style={styles.emptyStateText}>
                  Crea el primer paquete de créditos
                </Text>
              </View>
            ) : (
              packages.map((pkg) => {
                const packageId = pkg._id || pkg.id || '';
                return (
                  <View key={packageId} style={styles.packageCard}>
                    <View style={styles.packageHeader}>
                      <View style={styles.packageInfo}>
                        <Text style={styles.packageName}>{pkg.name}</Text>
                        <Text style={styles.packageDescription}>{pkg.description}</Text>
                      </View>
                      <View
                        style={[
                          styles.statusBadge,
                          {
                            backgroundColor: pkg.is_active
                              ? colors.success + '15'
                              : colors.textGray + '15',
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusText,
                            { color: pkg.is_active ? colors.success : colors.textGray },
                          ]}
                        >
                          {pkg.is_active ? 'Activo' : 'Inactivo'}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.packageDetails}>
                      <View style={styles.detailRow}>
                        <Ionicons name="cash" size={18} color={colors.primary} />
                        <Text style={styles.detailLabel}>Precio:</Text>
                        <Text style={styles.detailValue}>{formatCurrency(pkg.amount_usd)}</Text>
                      </View>

                      <View style={styles.detailRow}>
                        <Ionicons name="sparkles" size={18} color={colors.accent} />
                        <Text style={styles.detailLabel}>Créditos base:</Text>
                        <Text style={styles.detailValue}>{pkg.base_credits}</Text>
                      </View>

                      {pkg.bonus_percentage > 0 && (
                        <View style={styles.detailRow}>
                          <Ionicons name="gift" size={18} color={colors.success} />
                          <Text style={styles.detailLabel}>Bonus:</Text>
                          <Text style={styles.detailValue}>{pkg.bonus_percentage}%</Text>
                        </View>
                      )}

                      <View style={styles.detailRow}>
                        <Ionicons name="checkmark-circle" size={18} color={colors.info} />
                        <Text style={styles.detailLabel}>Total créditos:</Text>
                        <Text style={[styles.detailValue, styles.totalCredits]}>
                          {pkg.total_credits}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.packageActions}>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.editButton]}
                        onPress={() => openEditModal(pkg)}
                        disabled={processing}
                      >
                        <Ionicons name="create" size={20} color={colors.primary} />
                        <Text style={styles.editButtonText}>Editar</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.actionButton,
                          pkg.is_active ? styles.deactivateButton : styles.activateButton,
                        ]}
                        onPress={() => handleToggleStatus(pkg)}
                        disabled={processing}
                      >
                        <Ionicons
                          name={pkg.is_active ? 'close-circle' : 'checkmark-circle'}
                          size={20}
                          color={pkg.is_active ? colors.error : colors.success}
                        />
                        <Text
                          style={[
                            styles.toggleButtonText,
                            {
                              color: pkg.is_active ? colors.error : colors.success,
                            },
                          ]}
                        >
                          {pkg.is_active ? 'Desactivar' : 'Activar'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>

      {/* Create/Edit Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <ScrollView>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {editingPackage ? 'Editar Paquete' : 'Crear Paquete'}
                </Text>
                <TouchableOpacity onPress={() => setModalVisible(false)}>
                  <Ionicons name="close" size={24} color={colors.text} />
                </TouchableOpacity>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Nombre: *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ej: Paquete Premium"
                  value={formData.name}
                  onChangeText={(text) => setFormData({ ...formData, name: text })}
                  editable={!processing}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Descripción:</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder={t('admin.packageDescPlaceholder', 'Descripción del paquete')}
                  value={formData.description}
                  onChangeText={(text) => setFormData({ ...formData, description: text })}
                  multiline
                  numberOfLines={3}
                  editable={!processing}
                />
              </View>

              <View style={styles.formRow}>
                <View style={[styles.formGroup, styles.halfWidth]}>
                  <Text style={styles.label}>Precio (USD): *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="0.00"
                    value={formData.amount_usd}
                    onChangeText={(text) => setFormData({ ...formData, amount_usd: text })}
                    keyboardType="decimal-pad"
                    editable={!processing}
                  />
                </View>

                <View style={[styles.formGroup, styles.halfWidth]}>
                  <Text style={styles.label}>Créditos Base: *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="0"
                    value={formData.base_credits}
                    onChangeText={(text) => setFormData({ ...formData, base_credits: text })}
                    keyboardType="numeric"
                    editable={!processing}
                  />
                </View>
              </View>

              <View style={styles.formRow}>
                <View style={[styles.formGroup, styles.halfWidth]}>
                  <Text style={styles.label}>Bonus (%):</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="0"
                    value={formData.bonus_percentage}
                    onChangeText={(text) => setFormData({ ...formData, bonus_percentage: text })}
                    keyboardType="numeric"
                    editable={!processing}
                  />
                </View>

                <View style={[styles.formGroup, styles.halfWidth]}>
                  <Text style={styles.label}>Orden:</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="0"
                    value={formData.sort_order}
                    onChangeText={(text) => setFormData({ ...formData, sort_order: text })}
                    keyboardType="numeric"
                    editable={!processing}
                  />
                </View>
              </View>

              {/* Preview */}
              <View style={styles.previewCard}>
                <Text style={styles.previewLabel}>Total de créditos:</Text>
                <Text style={styles.previewValue}>{calculateTotalCredits().toFixed(0)}</Text>
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => setModalVisible(false)}
                  disabled={processing}
                >
                  <Text style={styles.cancelButtonText}>Cancelar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalButton, styles.saveButton]}
                  onPress={handleSave}
                  disabled={processing}
                >
                  {processing ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <Text style={styles.saveButtonText}>
                      {editingPackage ? 'Actualizar' : 'Crear'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
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
  layout: {
    flex: 1,
    flexDirection: 'row',
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary + '15',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: colors.textGray,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: colors.textGray,
    textAlign: 'center',
  },
  packageCard: {
    backgroundColor: '#FFF',
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  packageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  packageInfo: {
    flex: 1,
  },
  packageName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 4,
  },
  packageDescription: {
    fontSize: 14,
    color: colors.textGray,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  packageDetails: {
    gap: 8,
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: colors.textGray,
    flex: 1,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  totalCredits: {
    fontSize: 16,
    color: colors.primary,
  },
  packageActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
  },
  editButton: {
    backgroundColor: colors.primary + '15',
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  activateButton: {
    backgroundColor: colors.success + '15',
  },
  deactivateButton: {
    backgroundColor: colors.error + '15',
  },
  toggleButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 20,
    width: '90%',
    maxWidth: 500,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
  },
  formGroup: {
    marginBottom: 16,
  },
  formRow: {
    flexDirection: 'row',
    gap: 12,
  },
  halfWidth: {
    flex: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: colors.text,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  previewCard: {
    backgroundColor: colors.primary + '10',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    alignItems: 'center',
  },
  previewLabel: {
    fontSize: 14,
    color: colors.textGray,
    marginBottom: 8,
  },
  previewValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.primary,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  saveButton: {
    backgroundColor: colors.primary,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
});