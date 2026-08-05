import React, { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import AdminHeader from '../../components/admin/AdminHeader';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import Constants from 'expo-constants';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8001';

interface DaySchedule {
  is_open: boolean;
  open_time: string | null;
  close_time: string | null;
}

interface WeekSchedule {
  [key: string]: DaySchedule;
}

export default function OfficeHoursAdmin() {
  const [schedule, setSchedule] = useState<WeekSchedule>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<any>(null);
  const [hasManualOverride, setHasManualOverride] = useState(false);
  
  // Time edit modal states
  const [showTimeModal, setShowTimeModal] = useState(false);
  const [editingTime, setEditingTime] = useState<{
    day: string;
    type: 'open_time' | 'close_time';
    currentValue: string;
  } | null>(null);
  const [timeInput, setTimeInput] = useState('');

  const days = [
    { key: 'monday', label: 'Lunes' },
    { key: 'tuesday', label: 'Martes' },
    { key: 'wednesday', label: 'Miércoles' },
    { key: 'thursday', label: 'Jueves' },
    { key: 'friday', label: 'Viernes' },
    { key: 'saturday', label: 'Sábado' },
    { key: 'sunday', label: 'Domingo' },
  ];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      await Promise.all([loadSchedule(), loadCurrentStatus()]);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const loadSchedule = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/office-hours/schedule`);
      setSchedule(response.data.schedule);
      setLoading(false);
    } catch (error) {
      console.error('Error loading schedule:', error);
      setLoading(false);
    }
  };

  const loadCurrentStatus = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/office-hours/status`);
      setCurrentStatus(response.data);
      setHasManualOverride(response.data.type === 'manual');
    } catch (error) {
      console.error('Error loading status:', error);
    }
  };

  const toggleDay = async (day: string) => {
    const updatedSchedule = {
      ...schedule,
      [day]: {
        ...schedule[day],
        is_open: !schedule[day]?.is_open,
      },
    };
    setSchedule(updatedSchedule);
    await saveSchedule(day, updatedSchedule[day]);
  };

  const updateTime = async (day: string, timeType: 'open_time' | 'close_time', time: string) => {
    const updatedSchedule = {
      ...schedule,
      [day]: {
        ...schedule[day],
        [timeType]: time,
      },
    };
    setSchedule(updatedSchedule);
    await saveSchedule(day, updatedSchedule[day]);
  };

  const saveSchedule = async (day: string, daySchedule: DaySchedule) => {
    try {
      const token = await AsyncStorage.getItem('session_token');
      
      console.log('=== SAVING SCHEDULE ===');
      console.log('Day:', day);
      console.log('Schedule:', daySchedule);
      console.log('API URL:', `${API_URL}/api/office-hours/schedule`);
      console.log('Token exists:', !!token);
      
      const payload = [
        {
          day,
          is_open: daySchedule.is_open,
          open_time: daySchedule.open_time,
          close_time: daySchedule.close_time,
        },
      ];
      
      console.log('Payload:', JSON.stringify(payload, null, 2));
      
      const response = await axios.put(
        `${API_URL}/api/office-hours/schedule`,
        payload,
        {
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );
      
      console.log('✅ Schedule saved successfully:', response.data);
      
      // Show success feedback
      if (Platform.OS !== 'web') {
        Alert.alert('Guardado', 'Horario actualizado correctamente');
      }
      
      // Reload schedule to ensure consistency
      await loadSchedule();
    } catch (error: any) {
      console.error('❌ Error saving schedule:', error);
      console.error('Error message:', error.message);
      console.error('Error response:', error.response?.data);
      console.error('Error status:', error.response?.status);
      
      const errorMessage = error.response?.data?.detail || error.message || 'No se pudo guardar el horario. Por favor intenta de nuevo.';
      
      if (Platform.OS !== 'web') {
        Alert.alert('Error', errorMessage);
      } else {
        alert(`Error: ${errorMessage}`);
      }
      
      // Reload schedule to revert local changes if save failed
      await loadSchedule();
    }
  };

  const handleManualOverride = async (isOpen: boolean) => {
    try {
      const token = await AsyncStorage.getItem('session_token');
      
      Alert.alert(
        isOpen ? 'Abrir Oficina' : 'Cerrar Oficina',
        `¿Estás seguro de ${isOpen ? 'abrir' : 'cerrar'} la oficina manualmente?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Confirmar',
            onPress: async () => {
              await axios.post(
                `${API_URL}/api/office-hours/manual-override`,
                {
                  is_open: isOpen,
                  reason: isOpen ? 'Abierto manualmente por administrador' : 'Cerrado manualmente por administrador',
                },
                {
                  headers: { Authorization: `Bearer ${token}` },
                }
              );
              
              Alert.alert('Éxito', `Oficina ${isOpen ? 'abierta' : 'cerrada'} manualmente`);
              await loadCurrentStatus();
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error with manual override:', error);
      Alert.alert('Error', 'No se pudo cambiar el estado');
    }
  };

  const clearManualOverride = async () => {
    try {
      const token = await AsyncStorage.getItem('session_token');
      await axios.delete(`${API_URL}/api/office-hours/manual-override`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      Alert.alert('Éxito', 'Vuelto al horario normal');
      await loadCurrentStatus();
    } catch (error) {
      console.error('Error clearing override:', error);
      Alert.alert('Error', 'No se pudo quitar el control manual');
    }
  };

  const openTimeEditModal = (day: string, type: 'open_time' | 'close_time', currentValue: string) => {
    setEditingTime({ day, type, currentValue });
    setTimeInput(currentValue);
    setShowTimeModal(true);
  };

  const handleTimeModalSubmit = async () => {
    if (editingTime && timeInput) {
      // Validate time format
      const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
      if (!timeRegex.test(timeInput)) {
        Alert.alert('Error', 'Formato de hora inválido. Use HH:MM (formato 24h)');
        return;
      }
      
      // Close modal first to show feedback
      setShowTimeModal(false);
      
      // Save the time
      await updateTime(editingTime.day, editingTime.type, timeInput);
      
      // Clean up state
      setEditingTime(null);
      setTimeInput('');
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <AdminHeader 
          title="Horarios de Oficina" 
          subtitle="Gestión de apertura y cierre"
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6C1110" />
          <Text style={styles.loadingText}>Cargando horarios...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AdminHeader 
        title="Horarios de Oficina" 
        subtitle="Gestión de apertura y cierre"
      />

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Current Status Card */}
        {currentStatus && (
          <View style={[styles.statusCard, currentStatus.is_open ? styles.openCard : styles.closedCard]}>
            <View style={styles.statusHeader}>
              <Ionicons
                name={currentStatus.is_open ? 'checkmark-circle' : 'close-circle'}
                size={32}
                color={currentStatus.is_open ? '#4CAF50' : '#F44336'}
              />
              <View style={styles.statusInfo}>
                <Text style={[styles.statusTitle, currentStatus.is_open ? styles.openText : styles.closedText]}>
                  {currentStatus.is_open ? 'OFICINA ABIERTA' : 'OFICINA CERRADA'}
                </Text>
                <Text style={styles.statusReason}>{currentStatus.reason}</Text>
                {currentStatus.current_time && (
                  <Text style={styles.statusTime}>Hora actual: {currentStatus.current_time}</Text>
                )}
              </View>
            </View>

            {hasManualOverride && (
              <TouchableOpacity style={styles.clearButton} onPress={clearManualOverride}>
                <Text style={styles.clearButtonText}>Volver a Horario Normal</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Manual Controls */}
        <View style={styles.controlsCard}>
          <Text style={styles.sectionTitle}>Control Manual</Text>
          <Text style={styles.sectionDescription}>
            Override temporal del horario establecido
          </Text>
          
          <View style={styles.controlButtons}>
            <TouchableOpacity
              style={[styles.controlButton, styles.openButton]}
              onPress={() => handleManualOverride(true)}
            >
              <Ionicons name="lock-open" size={24} color="#FFF" />
              <Text style={styles.controlButtonText}>Abrir Ahora</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.controlButton, styles.closeButton]}
              onPress={() => handleManualOverride(false)}
            >
              <Ionicons name="lock-closed" size={24} color="#FFF" />
              <Text style={styles.controlButtonText}>Cerrar Ahora</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Weekly Schedule */}
        <View style={styles.scheduleCard}>
          <Text style={styles.sectionTitle}>Horario Semanal</Text>
          <Text style={styles.sectionDescription}>
            Configura los días y horarios regulares
          </Text>

          {days.map((day) => {
            const daySchedule = schedule[day.key] || { is_open: false, open_time: null, close_time: null };
            
            return (
              <View key={day.key} style={styles.dayItem}>
                <View style={styles.dayHeader}>
                  <Text style={styles.dayLabel}>{day.label}</Text>
                  <Switch
                    value={daySchedule.is_open}
                    onValueChange={() => toggleDay(day.key)}
                    trackColor={{ false: '#ccc', true: '#6C1110' }}
                    thumbColor={daySchedule.is_open ? '#ED201D' : '#f4f3f4'}
                  />
                </View>

                {daySchedule.is_open && (
                  <View style={styles.timeRow}>
                    <View style={styles.timeInput}>
                      <Text style={styles.timeLabel}>Apertura:</Text>
                      <TouchableOpacity
                        style={styles.timeButton}
                        onPress={() => openTimeEditModal(day.key, 'open_time', daySchedule.open_time || '09:00')}
                      >
                        <Text style={styles.timeText}>{daySchedule.open_time || '09:00'}</Text>
                      </TouchableOpacity>
                    </View>

                    <View style={styles.timeInput}>
                      <Text style={styles.timeLabel}>Cierre:</Text>
                      <TouchableOpacity
                        style={styles.timeButton}
                        onPress={() => openTimeEditModal(day.key, 'close_time', daySchedule.close_time || '18:00')}
                      >
                        <Text style={styles.timeText}>{daySchedule.close_time || '18:00'}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* Time Edit Modal */}
      <Modal
        visible={showTimeModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowTimeModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {editingTime?.type === 'open_time' ? 'Hora de Apertura' : 'Hora de Cierre'}
            </Text>
            <Text style={styles.modalSubtitle}>Formato 24h (HH:MM)</Text>
            
            <TextInput
              style={styles.modalInput}
              value={timeInput}
              onChangeText={setTimeInput}
              placeholder="09:00"
              keyboardType="numbers-and-punctuation"
              autoFocus={Platform.OS === 'web'}
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => {
                  setShowTimeModal(false);
                  setEditingTime(null);
                  setTimeInput('');
                }}
              >
                <Text style={styles.modalButtonTextCancel}>Cancelar</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm]}
                onPress={handleTimeModalSubmit}
              >
                <Text style={styles.modalButtonTextConfirm}>Guardar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  header: {
    padding: 24,
    paddingTop: 60,
    paddingBottom: 20,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFF',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 4,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  statusCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 2,
  },
  openCard: {
    borderColor: '#4CAF50',
  },
  closedCard: {
    borderColor: '#F44336',
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  statusInfo: {
    flex: 1,
  },
  statusTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  openText: {
    color: '#4CAF50',
  },
  closedText: {
    color: '#F44336',
  },
  statusReason: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  statusTime: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  clearButton: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#FF9800',
    borderRadius: 8,
    alignItems: 'center',
  },
  clearButtonText: {
    color: '#FFF',
    fontWeight: '600',
  },
  controlsCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  sectionDescription: {
    fontSize: 13,
    color: '#666',
    marginBottom: 16,
  },
  controlButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  controlButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 12,
  },
  openButton: {
    backgroundColor: '#4CAF50',
  },
  closeButton: {
    backgroundColor: '#F44336',
  },
  controlButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  scheduleCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  dayItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dayLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  timeRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  timeInput: {
    flex: 1,
  },
  timeLabel: {
    fontSize: 13,
    color: '#666',
    marginBottom: 6,
  },
  timeButton: {
    padding: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  timeText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxWidth: 400,
    ...Platform.select({
      web: {
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.2,
        shadowRadius: 20,
        elevation: 10,
      },
    }),
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  modalButtonConfirm: {
    backgroundColor: '#ED201D',
  },
  modalButtonTextCancel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  modalButtonTextConfirm: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
