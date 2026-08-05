/**
 * Appointment Types Management Screen
 * Admin panel para gestionar tipos de citas (motivos)
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
  ScrollView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import api from '../../services/api';

interface AppointmentType {
  id: string;
  title: string;
  duration_minutes: number;
  icon: string;
  is_active: boolean;
  order: number;
}

export default function AppointmentTypesManagement() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [types, setTypes] = useState<AppointmentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<AppointmentType | null>(null);
  
  // Form state
  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState('60');
  const [icon, setIcon] = useState('calendar');
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    loadTypes();
  }, []);

  const loadTypes = async () => {
    try {
      setLoading(true);
      const response = await api.get('/admin/appointment-types?include_inactive=true');
      setTypes(response.data);
    } catch (error) {
      console.error('Error loading types:', error);
      Alert.alert('Error', 'No se pudieron cargar los tipos de cita');
    } finally {
      setLoading(false);
    }
  };

  const openModal = (type?: AppointmentType) => {
    if (type) {
      setEditing(type);
      setTitle(type.title);
      setDuration(type.duration_minutes.toString());
      setIcon(type.icon);
      setIsActive(type.is_active);
    } else {
      setEditing(null);
      setTitle('');
      setDuration('60');
      setIcon('calendar');
      setIsActive(true);
    }
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setEditing(null);
    setTitle('');
    setDuration('60');
    setIcon('calendar');
    setIsActive(true);
  };

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'El título es requerido');
      return;
    }

    const durationNum = parseInt(duration);
    if (isNaN(durationNum) || durationNum <= 0) {
      Alert.alert('Error', 'La duración debe ser un número válido mayor a 0');
      return;
    }

    try {
      const payload = {
        title: title.trim(),
        duration_minutes: durationNum,
        icon,
        is_active: isActive,
        order: editing ? editing.order : types.length,
      };

      if (editing) {
        await api.put(`/admin/appointment-types/${editing.id}`, payload);
        Alert.alert('Éxito', 'Tipo de cita actualizado correctamente');
      } else {
        await api.post('/admin/appointment-types', payload);
        Alert.alert('Éxito', 'Tipo de cita creado correctamente');
      }

      closeModal();
      loadTypes();
    } catch (error: any) {
      console.error('Error saving type:', error);
      Alert.alert('Error', error.response?.data?.detail || 'No se pudo guardar el tipo de cita');
    }
  };

  const handleDelete = (type: AppointmentType) => {
    Alert.alert(
      'Confirmar',
      `¿Deseas desactivar "${type.title}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desactivar',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/admin/appointment-types/${type.id}`);
              Alert.alert('Éxito', 'Tipo de cita desactivado');
              loadTypes();
            } catch (error) {
              Alert.alert('Error', 'No se pudo desactivar el tipo de cita');
            }
          },
        },
      ]
    );
  };

  const renderType = ({ item }: { item: AppointmentType }) => (
    <View style={[styles.card, !item.is_active && styles.cardInactive]}>
      <View style={styles.cardContent}>
        <Ionicons 
          name={item.icon as any} 
          size={32} 
          color={item.is_active ? '#1a1a2e' : '#9ca3af'} 
        />
        <View style={styles.cardInfo}>
          <Text style={[styles.cardTitle, !item.is_active && styles.textInactive]}>
            {item.title}
          </Text>
          <Text style={styles.cardDuration}>{item.duration_minutes} minutos</Text>
          {!item.is_active && (
            <Text style={styles.inactiveLabel}>Inactivo</Text>
          )}
        </View>
      </View>
      <View style={styles.cardActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => openModal(item)}
        >
          <Ionicons name="create-outline" size={20} color="#3b82f6" />
        </TouchableOpacity>
        {item.is_active && (
          <TouchableOpacity
            style={[styles.actionButton, { marginLeft: 8 }]}
            onPress={() => handleDelete(item)}
          >
            <Ionicons name="trash-outline" size={20} color="#ef4444" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1a1a2e" />
        <Text style={styles.loadingText}>Cargando tipos de cita...</Text>
      </View>
    );
  }

  return (
    <>
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: insets.top + 80,
          backgroundColor: '#1a1a2e',
          zIndex: -1,
        }}
      />
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <LinearGradient
          colors={['#1a1a2e', '#1a1a2e']}
          style={[styles.headerGradient, { paddingTop: insets.top }]}
        >
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
            >
              <Ionicons name="arrow-back" size={24} color="#ffffff" />
            </TouchableOpacity>
            <View style={styles.headerTitleContainer}>
              <Ionicons
                name="calendar-outline"
                size={24}
                color="#ffffff"
                style={{ marginRight: 8 }}
              />
              <Text style={styles.headerTitle}>Tipos de Cita</Text>
            </View>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => openModal()}
            >
              <Ionicons name="add-circle" size={28} color="#fff" />
            </TouchableOpacity>
          </View>
        </LinearGradient>

        <FlatList
          data={types}
          keyExtractor={(item) => item.id}
          renderItem={renderType}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="calendar-outline" size={64} color="#9ca3af" />
              <Text style={styles.emptyText}>No hay tipos de cita configurados</Text>
              <TouchableOpacity
                style={styles.emptyButton}
                onPress={() => openModal()}
              >
                <Text style={styles.emptyButtonText}>Crear Primer Tipo</Text>
              </TouchableOpacity>
            </View>
          }
        />

        {/* Modal */}
        <Modal
          visible={modalVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={closeModal}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>
                    {editing ? 'Editar Tipo de Cita' : 'Nuevo Tipo de Cita'}
                  </Text>
                  <TouchableOpacity onPress={closeModal}>
                    <Ionicons name="close" size={24} color="#1f2937" />
                  </TouchableOpacity>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.label}>Título *</Text>
                  <TextInput
                    style={styles.input}
                    value={title}
                    onChangeText={setTitle}
                    placeholder="Ej: Consulta Inicial"
                    placeholderTextColor="#9ca3af"
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.label}>Duración (minutos) *</Text>
                  <TextInput
                    style={styles.input}
                    value={duration}
                    onChangeText={setDuration}
                    placeholder="60"
                    keyboardType="number-pad"
                    placeholderTextColor="#9ca3af"
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.label}>Ícono</Text>
                  <View style={styles.iconRow}>
                    {['calendar', 'person', 'document-text', 'layers', 'refresh', 'help-circle'].map((iconName) => (
                      <TouchableOpacity
                        key={iconName}
                        style={[
                          styles.iconButton,
                          icon === iconName && styles.iconButtonActive,
                        ]}
                        onPress={() => setIcon(iconName)}
                      >
                        <Ionicons name={iconName as any} size={24} color={icon === iconName ? '#3b82f6' : '#6b7280'} />
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <View style={styles.switchRow}>
                    <Text style={styles.label}>Activo</Text>
                    <TouchableOpacity
                      style={[styles.switch, isActive && styles.switchActive]}
                      onPress={() => setIsActive(!isActive)}
                    >
                      <View style={[styles.switchThumb, isActive && styles.switchThumbActive]} />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.modalButtonCancel]}
                    onPress={closeModal}
                  >
                    <Text style={styles.modalButtonTextCancel}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.modalButtonSave]}
                    onPress={handleSave}
                  >
                    <Text style={styles.modalButtonTextSave}>Guardar</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  headerGradient: {
    paddingBottom: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    backgroundColor: '#1a1a2e',
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginLeft: 12,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  addButton: {
    padding: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6b7280',
  },
  listContent: {
    padding: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardInactive: {
    opacity: 0.6,
    backgroundColor: '#f9fafb',
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  cardInfo: {
    marginLeft: 16,
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  textInactive: {
    color: '#9ca3af',
  },
  cardDuration: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  inactiveLabel: {
    fontSize: 12,
    color: '#ef4444',
    marginTop: 4,
    fontWeight: '600',
  },
  cardActions: {
    flexDirection: 'row',
  },
  actionButton: {
    padding: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 16,
    color: '#6b7280',
    marginTop: 16,
  },
  emptyButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  emptyButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#1f2937',
  },
  iconRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  iconButton: {
    width: 50,
    height: 50,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    marginBottom: 8,
  },
  iconButtonActive: {
    borderColor: '#3b82f6',
    backgroundColor: '#eff6ff',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  switch: {
    width: 50,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#d1d5db',
    padding: 2,
    justifyContent: 'center',
  },
  switchActive: {
    backgroundColor: '#3b82f6',
  },
  switchThumb: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  switchThumbActive: {
    transform: [{ translateX: 20 }],
  },
  modalActions: {
    flexDirection: 'row',
    marginTop: 24,
  },
  modalButton: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: '#f3f4f6',
    marginRight: 8,
  },
  modalButtonSave: {
    backgroundColor: '#3b82f6',
    marginLeft: 8,
  },
  modalButtonTextCancel: {
    color: '#6b7280',
    fontSize: 16,
    fontWeight: '600',
  },
  modalButtonTextSave: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
