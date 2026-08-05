import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../../services/api';

interface QuickAction {
  id: string;
  title: string;
  title_es: string;
  subtitle: string;
  subtitle_es: string;
  icon: string;
  colors: string[];
  route: string;
  order: number;
  visible: boolean;
}

const AVAILABLE_ICONS = [
  'calendar', 'folder', 'add-circle', 'briefcase', 'card', 
  'document-text', 'share-social', 'cash', 'cube', 'wallet',
  'receipt', 'calculator', 'home', 'person', 'settings',
  'notifications', 'mail', 'chatbubble', 'heart', 'star',
  'trophy', 'gift', 'car', 'airplane', 'globe'
];

const COLOR_PRESETS = [
  { name: 'Rosa', colors: ['#EC4899', '#EC4899CC'] },
  { name: 'Morado', colors: ['#8B5CF6', '#8B5CF6CC'] },
  { name: 'Naranja', colors: ['#FF6B35', '#FF6B35CC'] },
  { name: 'Rojo Oscuro', colors: ['#6C1110', '#8B1A18'] },
  { name: 'Verde', colors: ['#10B981', '#059669'] },
  { name: 'Azul', colors: ['#3B82F6', '#3B82F6CC'] },
  { name: 'Azul Marino', colors: ['#1E90FF', '#0066CC'] },
  { name: 'Púrpura', colors: ['#9C27B0', '#7B1FA2'] },
  { name: 'Amarillo', colors: ['#F59E0B', '#D97706'] },
  { name: 'Rojo', colors: ['#EF4444', '#DC2626'] },
];

export default function QuickActionsAdminScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [actions, setActions] = useState<QuickAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [selectedAction, setSelectedAction] = useState<QuickAction | null>(null);
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    title: '',
    title_es: '',
    subtitle: '',
    subtitle_es: '',
    icon: 'star',
    colors: ['#3B82F6', '#3B82F6CC'],
    route: '',
    order: 0,
    visible: true,
  });

  useEffect(() => {
    loadActions();
  }, []);

  const loadActions = async () => {
    try {
      const response = await api.get('/admin/quick-actions');
      setActions(response.data || []);
    } catch (error: any) {
      console.error('Error loading quick actions:', error);
      Alert.alert('Error', 'No se pudieron cargar las acciones rápidas');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleToggleVisibility = async (action: QuickAction) => {
    setTogglingId(action.id);
    try {
      const response = await api.patch(`/admin/quick-actions/${action.id}/toggle`);
      if (response.data) {
        setActions(prev => prev.map(a => 
          a.id === action.id ? { ...a, visible: response.data.visible } : a
        ));
      }
    } catch (error: any) {
      console.error('Error toggling visibility:', error);
      Alert.alert('Error', 'No se pudo cambiar la visibilidad');
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (action: QuickAction) => {
    Alert.alert(
      'Eliminar Acción',
      `¿Estás seguro de que quieres eliminar "${action.title_es}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/admin/quick-actions/${action.id}`);
              setActions(prev => prev.filter(a => a.id !== action.id));
              Alert.alert('Éxito', 'Acción eliminada correctamente');
            } catch (error: any) {
              console.error('Error deleting action:', error);
              Alert.alert('Error', 'No se pudo eliminar la acción');
            }
          }
        }
      ]
    );
  };

  const handleEdit = (action: QuickAction) => {
    setSelectedAction(action);
    setFormData({
      title: action.title,
      title_es: action.title_es,
      subtitle: action.subtitle,
      subtitle_es: action.subtitle_es,
      icon: action.icon,
      colors: action.colors,
      route: action.route,
      order: action.order,
      visible: action.visible,
    });
    setEditModalVisible(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedAction) return;
    
    setSaving(true);
    try {
      const response = await api.put(`/admin/quick-actions/${selectedAction.id}`, formData);
      setActions(prev => prev.map(a => 
        a.id === selectedAction.id ? response.data : a
      ));
      setEditModalVisible(false);
      Alert.alert('Éxito', 'Acción actualizada correctamente');
    } catch (error: any) {
      console.error('Error updating action:', error);
      Alert.alert('Error', 'No se pudo actualizar la acción');
    } finally {
      setSaving(false);
    }
  };

  const handleAddNew = () => {
    setFormData({
      title: '',
      title_es: '',
      subtitle: '',
      subtitle_es: '',
      icon: 'star',
      colors: ['#3B82F6', '#3B82F6CC'],
      route: '',
      order: actions.length + 1,
      visible: true,
    });
    setAddModalVisible(true);
  };

  const handleSaveNew = async () => {
    if (!formData.title || !formData.title_es || !formData.route) {
      Alert.alert('Error', 'Por favor completa todos los campos requeridos');
      return;
    }
    
    setSaving(true);
    try {
      const response = await api.post('/admin/quick-actions', formData);
      setActions(prev => [...prev, response.data]);
      setAddModalVisible(false);
      Alert.alert('Éxito', 'Acción creada correctamente');
    } catch (error: any) {
      console.error('Error creating action:', error);
      Alert.alert('Error', 'No se pudo crear la acción');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    Alert.alert(
      'Restablecer Acciones',
      '¿Estás seguro de que quieres restablecer todas las acciones rápidas a los valores predeterminados?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Restablecer',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.post('/admin/quick-actions/reset');
              loadActions();
              Alert.alert('Éxito', 'Acciones restablecidas correctamente');
            } catch (error: any) {
              console.error('Error resetting actions:', error);
              Alert.alert('Error', 'No se pudieron restablecer las acciones');
            }
          }
        }
      ]
    );
  };

  const visibleCount = actions.filter(a => a.visible).length;
  const hiddenCount = actions.filter(a => !a.visible).length;

  const renderActionCard = (action: QuickAction) => (
    <View key={action.id} style={[styles.actionCard, !action.visible && styles.actionCardHidden]}>
      <View style={styles.actionHeader}>
        <View style={[styles.iconPreview, { backgroundColor: action.colors[0] }]}>
          <Ionicons name={action.icon as any} size={20} color="#FFF" />
        </View>
        <View style={styles.actionInfo}>
          <Text style={styles.actionTitle}>{action.title_es}</Text>
          <Text style={styles.actionSubtitle}>{action.subtitle_es}</Text>
          <Text style={styles.actionRoute}>Ruta: {action.route}</Text>
        </View>
        <View style={styles.toggleContainer}>
          {togglingId === action.id ? (
            <ActivityIndicator size="small" color="#6C1110" />
          ) : (
            <Switch
              value={action.visible}
              onValueChange={() => handleToggleVisibility(action)}
              trackColor={{ false: '#ccc', true: '#6C1110' }}
              thumbColor={action.visible ? '#fff' : '#f4f3f4'}
              ios_backgroundColor="#ccc"
            />
          )}
        </View>
      </View>
      <View style={styles.actionActions}>
        <TouchableOpacity 
          style={[styles.actionButton, styles.editButton]}
          onPress={() => handleEdit(action)}
        >
          <Ionicons name="pencil" size={16} color="#FFF" />
          <Text style={styles.buttonText}>Editar</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.actionButton, styles.deleteButton]}
          onPress={() => handleDelete(action)}
        >
          <Ionicons name="trash" size={16} color="#FFF" />
          <Text style={styles.buttonText}>Eliminar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderFormModal = (isEdit: boolean) => (
    <Modal
      visible={isEdit ? editModalVisible : addModalVisible}
      animationType="slide"
      transparent={true}
      onRequestClose={() => isEdit ? setEditModalVisible(false) : setAddModalVisible(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.modalTitle}>
              {isEdit ? 'Editar Acción Rápida' : 'Nueva Acción Rápida'}
            </Text>
            
            <Text style={styles.inputLabel}>Título (Inglés) *</Text>
            <TextInput
              style={styles.input}
              value={formData.title}
              onChangeText={(text) => setFormData(prev => ({ ...prev, title: text }))}
              placeholder="Appointments"
            />
            
            <Text style={styles.inputLabel}>Título (Español) *</Text>
            <TextInput
              style={styles.input}
              value={formData.title_es}
              onChangeText={(text) => setFormData(prev => ({ ...prev, title_es: text }))}
              placeholder="Citas"
            />
            
            <Text style={styles.inputLabel}>Subtítulo (Inglés)</Text>
            <TextInput
              style={styles.input}
              value={formData.subtitle}
              onChangeText={(text) => setFormData(prev => ({ ...prev, subtitle: text }))}
              placeholder="Schedule now"
            />
            
            <Text style={styles.inputLabel}>Subtítulo (Español)</Text>
            <TextInput
              style={styles.input}
              value={formData.subtitle_es}
              onChangeText={(text) => setFormData(prev => ({ ...prev, subtitle_es: text }))}
              placeholder="Agendar ahora"
            />
            
            <Text style={styles.inputLabel}>Ruta de Navegación *</Text>
            <TextInput
              style={styles.input}
              value={formData.route}
              onChangeText={(text) => setFormData(prev => ({ ...prev, route: text }))}
              placeholder="/(tabs)/appointments"
            />
            
            <Text style={styles.inputLabel}>Icono</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.iconPicker}>
              {AVAILABLE_ICONS.map(icon => (
                <TouchableOpacity
                  key={icon}
                  style={[
                    styles.iconOption,
                    formData.icon === icon && styles.iconOptionSelected
                  ]}
                  onPress={() => setFormData(prev => ({ ...prev, icon }))}
                >
                  <Ionicons name={icon as any} size={24} color={formData.icon === icon ? '#FFF' : '#333'} />
                </TouchableOpacity>
              ))}
            </ScrollView>
            
            <Text style={styles.inputLabel}>Color</Text>
            <View style={styles.colorPicker}>
              {COLOR_PRESETS.map((preset, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={[
                    styles.colorOption,
                    { backgroundColor: preset.colors[0] },
                    formData.colors[0] === preset.colors[0] && styles.colorOptionSelected
                  ]}
                  onPress={() => setFormData(prev => ({ ...prev, colors: preset.colors }))}
                />
              ))}
            </View>
            
            <Text style={styles.inputLabel}>Orden</Text>
            <TextInput
              style={styles.input}
              value={formData.order.toString()}
              onChangeText={(text) => setFormData(prev => ({ ...prev, order: parseInt(text) || 0 }))}
              keyboardType="number-pad"
              placeholder="1"
            />
            
            <View style={styles.switchRow}>
              <Text style={styles.inputLabel}>Visible</Text>
              <Switch
                value={formData.visible}
                onValueChange={(value) => setFormData(prev => ({ ...prev, visible: value }))}
                trackColor={{ false: '#ccc', true: '#6C1110' }}
                thumbColor="#fff"
              />
            </View>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => isEdit ? setEditModalVisible(false) : setAddModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={isEdit ? handleSaveEdit : handleSaveNew}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <Text style={styles.saveButtonText}>Guardar</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={['#8B0000', '#DC143C', '#4682B4']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.header, { paddingTop: insets.top + 10 }]}
        >
          <View style={styles.headerContent}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Acciones Rápidas</Text>
            <View style={{ width: 40 }} />
          </View>
        </LinearGradient>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6C1110" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={['#8B0000', '#DC143C', '#4682B4']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.header, { paddingTop: insets.top + 10 }]}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>Acciones Rápidas</Text>
            <Text style={styles.headerSubtitle}>
              {visibleCount} visibles • {hiddenCount} ocultas
            </Text>
          </View>
          <TouchableOpacity onPress={handleReset} style={styles.resetButton}>
            <Ionicons name="refresh" size={22} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Ionicons name="eye" size={18} color="#10b981" />
            <Text style={styles.statValue}>{visibleCount}</Text>
            <Text style={styles.statLabel}>Visibles</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="eye-off" size={18} color="#f59e0b" />
            <Text style={styles.statValue}>{hiddenCount}</Text>
            <Text style={styles.statLabel}>Ocultas</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="grid" size={18} color="#fff" />
            <Text style={styles.statValue}>{actions.length}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
        </View>
      </LinearGradient>
      
      {/* Add Button */}
      <TouchableOpacity style={styles.addButton} onPress={handleAddNew}>
        <Ionicons name="add-circle" size={24} color="#FFF" />
        <Text style={styles.addButtonText}>Agregar Nueva Acción</Text>
      </TouchableOpacity>
      
      {/* Actions List */}
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={() => {
              setRefreshing(true);
              loadActions();
            }}
            colors={['#6C1110']}
            tintColor="#6C1110"
          />
        }
      >
        {actions.filter(a => a.visible).length > 0 && (
          <>
            <Text style={styles.sectionTitle}>
              <Ionicons name="eye" size={14} color="#10b981" /> Acciones Visibles
            </Text>
            {actions.filter(a => a.visible).map(renderActionCard)}
          </>
        )}
        
        {actions.filter(a => !a.visible).length > 0 && (
          <>
            <Text style={styles.sectionTitle}>
              <Ionicons name="eye-off" size={14} color="#f59e0b" /> Acciones Ocultas
            </Text>
            {actions.filter(a => !a.visible).map(renderActionCard)}
          </>
        )}
        
        <View style={{ height: 100 }} />
      </ScrollView>
      
      {/* Modals */}
      {renderFormModal(true)}
      {renderFormModal(false)}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
  },
  resetButton: {
    padding: 8,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginTop: 4,
  },
  statLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6C1110',
    marginHorizontal: 16,
    marginVertical: 12,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    shadowColor: '#6C1110',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  addButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 16,
    marginBottom: 10,
  },
  actionCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  actionCardHidden: {
    opacity: 0.7,
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
  },
  actionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconPreview: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionInfo: {
    flex: 1,
    marginLeft: 14,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
  },
  actionSubtitle: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  actionRoute: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 4,
  },
  toggleContainer: {
    width: 60,
    alignItems: 'flex-end',
  },
  actionActions: {
    flexDirection: 'row',
    marginTop: 14,
    gap: 10,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  editButton: {
    backgroundColor: '#3b82f6',
  },
  deleteButton: {
    backgroundColor: '#ef4444',
  },
  buttonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '90%',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 24,
    textAlign: 'center',
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    marginTop: 14,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  iconPicker: {
    flexDirection: 'row',
    marginTop: 8,
  },
  iconOption: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  iconOptionSelected: {
    backgroundColor: '#6C1110',
  },
  colorPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 10,
  },
  colorOption: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 3,
    borderColor: 'transparent',
  },
  colorOptionSelected: {
    borderColor: '#1e293b',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 18,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 28,
    gap: 14,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f1f5f9',
  },
  cancelButtonText: {
    color: '#64748b',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#6C1110',
  },
  saveButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
