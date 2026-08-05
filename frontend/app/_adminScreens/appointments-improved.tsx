import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  Modal,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../../constants/colors';
import api from '../../services/api';
import { Picker } from '@react-native-picker/picker';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

const { width } = Dimensions.get('window');

interface Appointment {
  id: string;
  user_id: string;
  client_id?: string;
  client_name: string;
  client_email: string;
  scheduled_at: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  notes?: string;
  appointment_type: string;
  duration_minutes: number;
  created_at: string;
}

export default function AppointmentsImprovedScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const router = useRouter();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [clients, setClients] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [view, setView] = useState<'day' | 'week' | 'month'>('day');
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    client_id: '',
    date: '',
    time: '09:00',
    appointment_type: 'consultation',
    duration_minutes: 60,
    notes: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [appointmentsRes, clientsRes] = await Promise.all([
        api.get('/appointments'),  // Use LOCAL appointments (includes migrated Square)
        api.get('/admin/clients?limit=1000'),
      ]);
      
      const clientsData = Array.isArray(clientsRes.data) 
        ? clientsRes.data 
        : (clientsRes.data?.clients || []);
      
      // Local returns { appointments: [...] } or just [...]
      const appointmentsData = appointmentsRes.data?.appointments || appointmentsRes.data || [];
      // Map user_name to client_name for compatibility
      const mappedAppointments = (Array.isArray(appointmentsData) ? appointmentsData : []).map((apt: any) => ({
        ...apt,
        client_name: apt.client_name || apt.user_name || 'Cliente',
        client_email: apt.client_email || apt.user_email || '',
      }));
      setAppointments(mappedAppointments);
      setClients(clientsData);
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'No se pudieron cargar las citas');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getWeekDates = () => {
    const curr = new Date(selectedDate);
    const week = [];
    
    // Start from Monday
    const first = curr.getDate() - curr.getDay() + 1;
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(curr.setDate(first + i));
      week.push(new Date(date));
    }
    
    return week;
  };

  const getDayAppointments = (date: Date) => {
    return appointments.filter(apt => {
      const aptDate = new Date(apt.scheduled_at);
      return aptDate.toDateString() === date.toDateString();
    }).sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
  };

  const openCreateModal = () => {
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];
    
    setFormData({
      client_id: '',
      date: dateStr,
      time: '09:00',
      appointment_type: 'consultation',
      duration_minutes: 60,
      notes: '',
    });
    setSelectedAppointment(null);
    setShowModal(true);
  };

  const openEditModal = (appointment: Appointment) => {
    const aptDate = new Date(appointment.scheduled_at);
    const dateStr = aptDate.toISOString().split('T')[0];
    const timeStr = aptDate.toTimeString().slice(0, 5);

    setFormData({
      client_id: appointment.client_id || '',
      date: dateStr,
      time: timeStr,
      appointment_type: appointment.appointment_type,
      duration_minutes: appointment.duration_minutes,
      notes: appointment.notes || '',
    });
    setSelectedAppointment(appointment);
    setShowModal(true);
  };

  const handleSave = async () => {
    try {
      if (!formData.client_id || !formData.date || !formData.time) {
        Alert.alert('Error', 'Por favor completa todos los campos requeridos');
        return;
      }

      const scheduled_at = `${formData.date}T${formData.time}:00`;

      const payload = {
        client_id: formData.client_id,
        scheduled_at,
        appointment_type: formData.appointment_type,
        duration_minutes: formData.duration_minutes,
        notes: formData.notes,
      };

      if (selectedAppointment) {
        await api.put(`/admin/appointments/${selectedAppointment.id}`, payload);
        Alert.alert('Éxito', 'Cita actualizada correctamente');
      } else {
        await api.post('/admin/appointments', payload);
        Alert.alert('Éxito', 'Cita creada correctamente');
      }

      setShowModal(false);
      loadData();
    } catch (error: any) {
      console.error('Error saving appointment:', error);
      Alert.alert('Error', error.response?.data?.detail || 'No se pudo guardar la cita');
    }
  };

  const handleStatusChange = async (appointmentId: string, newStatus: string) => {
    try {
      await api.patch(`/admin/appointments/${appointmentId}`, { status: newStatus });
      Alert.alert('Éxito', 'Estado actualizado');
      loadData();
    } catch (error) {
      Alert.alert('Error', 'No se pudo actualizar el estado');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return '#3B82F6';
      case 'completed': return '#10B981';
      case 'cancelled': return '#EF4444';
      default: return colors.textSecondary;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'scheduled': return 'Programada';
      case 'completed': return 'Completada';
      case 'cancelled': return 'Cancelada';
      default: return status;
    }
  };

  const generateTimeSlots = () => {
    const slots = [];
    for (let hour = 7; hour < 21; hour++) {
      slots.push(`${hour.toString().padStart(2, '0')}:00`);
      slots.push(`${hour.toString().padStart(2, '0')}:30`);
    }
    return slots;
  };

  const renderDayView = () => {
    const dayAppointments = getDayAppointments(selectedDate);
    const timeSlots = generateTimeSlots();

    return (
      <View style={styles.dayView}>
        <View style={styles.dateSelector}>
          <TouchableOpacity
            onPress={() => {
              const newDate = new Date(selectedDate);
              newDate.setDate(newDate.getDate() - 1);
              setSelectedDate(newDate);
            }}
            style={styles.dateNavButton}
          >
            <Ionicons name="chevron-back" size={24} color={colors.primary} />
          </TouchableOpacity>

          <View style={styles.dateDisplay}>
            <Text style={[styles.dateDisplayText, { color: colors.text }]}>
              {selectedDate.toLocaleDateString('es-ES', { 
                weekday: 'long', 
                day: 'numeric', 
                month: 'long', 
                year: 'numeric' 
              })}
            </Text>
            <Text style={[styles.appointmentCount, { color: colors.textSecondary }]}>
              {dayAppointments.length} cita{dayAppointments.length !== 1 ? 's' : ''}
            </Text>
          </View>

          <TouchableOpacity
            onPress={() => {
              const newDate = new Date(selectedDate);
              newDate.setDate(newDate.getDate() + 1);
              setSelectedDate(newDate);
            }}
            style={styles.dateNavButton}
          >
            <Ionicons name="chevron-forward" size={24} color={colors.primary} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.timelineContainer}>
          {timeSlots.map((timeSlot) => {
            const appointments = dayAppointments.filter(apt => {
              const aptTime = formatTime(apt.scheduled_at);
              return aptTime === timeSlot;
            });

            return (
              <View key={timeSlot} style={[styles.timeSlotRow, { borderBottomColor: colors.border }]}>
                <View style={styles.timeSlotLabel}>
                  <Text style={[styles.timeSlotText, { color: colors.textSecondary }]}>
                    {timeSlot}
                  </Text>
                </View>

                <View style={styles.timeSlotContent}>
                  {appointments.length > 0 ? (
                    appointments.map(apt => (
                      <TouchableOpacity
                        key={apt.id}
                        style={[
                          styles.appointmentCard,
                          { 
                            backgroundColor: colors.card,
                            borderLeftColor: getStatusColor(apt.status),
                            borderLeftWidth: 4,
                          }
                        ]}
                        onPress={() => openEditModal(apt)}
                      >
                        <View style={styles.appointmentHeader}>
                          <View style={styles.appointmentInfo}>
                            <Text style={[styles.clientName, { color: colors.text }]}>
                              {apt.client_name}
                            </Text>
                            <Text style={[styles.appointmentType, { color: colors.textSecondary }]}>
                              {apt.appointment_type} • {apt.duration_minutes} min
                            </Text>
                          </View>
                          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(apt.status) + '20' }]}>
                            <Text style={[styles.statusText, { color: getStatusColor(apt.status) }]}>
                              {getStatusLabel(apt.status)}
                            </Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                    ))
                  ) : (
                    <View style={styles.emptySlot}>
                      <Text style={[styles.emptySlotText, { color: colors.textLight }]}>
                        Disponible
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            );
          })}
        </ScrollView>
      </View>
    );
  };

  const renderWeekView = () => {
    const weekDates = getWeekDates();

    return (
      <View style={styles.weekView}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {weekDates.map((date, index) => {
            const dayAppointments = getDayAppointments(date);
            const isSelected = date.toDateString() === selectedDate.toDateString();
            const isToday = date.toDateString() === new Date().toDateString();

            return (
              <TouchableOpacity
                key={index}
                style={[
                  styles.weekDayCard,
                  { 
                    backgroundColor: isSelected ? colors.primary : colors.card,
                    borderColor: isToday ? colors.primary : colors.border,
                    borderWidth: isToday ? 2 : 1,
                  }
                ]}
                onPress={() => setSelectedDate(date)}
              >
                <Text style={[
                  styles.weekDayName,
                  { color: isSelected ? '#fff' : colors.textSecondary }
                ]}>
                  {date.toLocaleDateString('es-ES', { weekday: 'short' })}
                </Text>
                <Text style={[
                  styles.weekDayNumber,
                  { color: isSelected ? '#fff' : colors.text }
                ]}>
                  {date.getDate()}
                </Text>
                <View style={[
                  styles.weekDayBadge,
                  { backgroundColor: isSelected ? 'rgba(255,255,255,0.3)' : colors.primary + '20' }
                ]}>
                  <Text style={[
                    styles.weekDayBadgeText,
                    { color: isSelected ? '#fff' : colors.primary }
                  ]}>
                    {dayAppointments.length}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <ScrollView style={styles.weekAppointmentsList}>
          {getDayAppointments(selectedDate).map(apt => (
            <TouchableOpacity
              key={apt.id}
              style={[styles.listAppointmentCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => openEditModal(apt)}
            >
              <View style={[styles.listTimeLabel, { backgroundColor: getStatusColor(apt.status) }]}>
                <Ionicons name="time" size={16} color="#fff" />
                <Text style={styles.listTimeText}>{formatTime(apt.scheduled_at)}</Text>
              </View>

              <View style={styles.listAppointmentContent}>
                <Text style={[styles.listClientName, { color: colors.text }]}>
                  {apt.client_name}
                </Text>
                <Text style={[styles.listAppointmentDetails, { color: colors.textSecondary }]}>
                  {apt.appointment_type} • {apt.duration_minutes} min
                </Text>
                {apt.notes && (
                  <Text style={[styles.listNotes, { color: colors.textLight }]} numberOfLines={2}>
                    {apt.notes}
                  </Text>
                )}
              </View>

              <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          ))}

          {getDayAppointments(selectedDate).length === 0 && (
            <View style={styles.emptyListState}>
              <Ionicons name="calendar-outline" size={64} color={colors.textLight} />
              <Text style={[styles.emptyListText, { color: colors.textLight }]}>
                No hay citas programadas para este día
              </Text>
            </View>
          )}
        </ScrollView>
      </View>
    );
  };

  const renderModal = () => (
    <Modal
      visible={showModal}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {selectedAppointment ? 'Editar Cita' : 'Nueva Cita'}
            </Text>
            <TouchableOpacity onPress={() => setShowModal(false)}>
              <Ionicons name="close" size={28} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            {/* Cliente */}
            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.text }]}>Cliente *</Text>
              <View style={[styles.pickerContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Picker
                  selectedValue={formData.client_id}
                  onValueChange={(value) => setFormData({ ...formData, client_id: value })}
                  style={[styles.picker, { color: colors.text }]}
                >
                  <Picker.Item label="Seleccionar cliente..." value="" />
                  {clients.map(client => (
                    <Picker.Item
                      key={client._id || client.id}
                      label={`${client.name} (${client.email})`}
                      value={client._id || client.id}
                    />
                  ))}
                </Picker>
              </View>
            </View>

            {/* Fecha */}
            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.text }]}>Fecha *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
                value={formData.date}
                onChangeText={(text) => setFormData({ ...formData, date: text })}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.textSecondary}
              />
            </View>

            {/* Hora */}
            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.text }]}>Hora *</Text>
              <View style={[styles.pickerContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Picker
                  selectedValue={formData.time}
                  onValueChange={(value) => setFormData({ ...formData, time: value })}
                  style={[styles.picker, { color: colors.text }]}
                >
                  {generateTimeSlots().map(time => (
                    <Picker.Item key={time} label={time} value={time} />
                  ))}
                </Picker>
              </View>
            </View>

            {/* Tipo */}
            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.text }]}>Tipo de Cita</Text>
              <View style={[styles.pickerContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Picker
                  selectedValue={formData.appointment_type}
                  onValueChange={(value) => setFormData({ ...formData, appointment_type: value })}
                  style={[styles.picker, { color: colors.text }]}
                >
                  <Picker.Item label="Consulta" value="consultation" />
                  <Picker.Item label={t('admin.taxPrepShort', 'Preparación Taxes')} value="tax_preparation" />
                  <Picker.Item label={t('admin.reviewLabel', 'Revisión')} value="review" />
                  <Picker.Item label="Seguimiento" value="follow_up" />
                </Picker>
              </View>
            </View>

            {/* Duración */}
            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.text }]}>Duración (minutos)</Text>
              <View style={[styles.pickerContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Picker
                  selectedValue={formData.duration_minutes}
                  onValueChange={(value) => setFormData({ ...formData, duration_minutes: value })}
                  style={[styles.picker, { color: colors.text }]}
                >
                  <Picker.Item label="30 minutos" value={30} />
                  <Picker.Item label="60 minutos" value={60} />
                  <Picker.Item label="90 minutos" value={90} />
                  <Picker.Item label="120 minutos" value={120} />
                </Picker>
              </View>
            </View>

            {/* Notas */}
            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.text }]}>Notas</Text>
              <TextInput
                style={[styles.textArea, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
                value={formData.notes}
                onChangeText={(text) => setFormData({ ...formData, notes: text })}
                placeholder="Notas adicionales..."
                placeholderTextColor={colors.textSecondary}
                multiline
                numberOfLines={4}
              />
            </View>
          </ScrollView>

          <View style={[styles.modalFooter, { borderTopColor: colors.border }]}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton, { backgroundColor: colors.border }]}
              onPress={() => setShowModal(false)}
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
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.text }]}>Cargando citas...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Citas</Text>
        <TouchableOpacity onPress={openCreateModal} style={styles.addButton}>
          <Ionicons name="add-circle" size={28} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* View Toggle */}
      <View style={[styles.viewToggle, { backgroundColor: colors.card }]}>
        <TouchableOpacity
          style={[
            styles.viewButton,
            view === 'day' && { backgroundColor: colors.primary }
          ]}
          onPress={() => setView('day')}
        >
          <Ionicons name="today" size={20} color={view === 'day' ? '#fff' : colors.textSecondary} />
          <Text style={[
            styles.viewButtonText,
            { color: view === 'day' ? '#fff' : colors.textSecondary }
          ]}>
            Día
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.viewButton,
            view === 'week' && { backgroundColor: colors.primary }
          ]}
          onPress={() => setView('week')}
        >
          <Ionicons name="calendar" size={20} color={view === 'week' ? '#fff' : colors.textSecondary} />
          <Text style={[
            styles.viewButtonText,
            { color: view === 'week' ? '#fff' : colors.textSecondary }
          ]}>
            Semana
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.viewButton,
            view === 'month' && { backgroundColor: colors.primary }
          ]}
          onPress={() => setView('month')}
        >
          <Ionicons name="grid" size={20} color={view === 'month' ? '#fff' : colors.textSecondary} />
          <Text style={[
            styles.viewButtonText,
            { color: view === 'month' ? '#fff' : colors.textSecondary }
          ]}>
            Mes
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {view === 'day' && renderDayView()}
        {view === 'week' && renderWeekView()}
      </ScrollView>

      {renderModal()}
    </SafeAreaView>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  addButton: {
    padding: 8,
  },
  viewToggle: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
  },
  viewButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
  },
  viewButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  // Day View
  dayView: {
    flex: 1,
  },
  dateSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  dateNavButton: {
    padding: 8,
  },
  dateDisplay: {
    alignItems: 'center',
  },
  dateDisplayText: {
    fontSize: 16,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  appointmentCount: {
    fontSize: 13,
    marginTop: 2,
  },
  timelineContainer: {
    flex: 1,
  },
  timeSlotRow: {
    flexDirection: 'row',
    minHeight: 60,
    borderBottomWidth: 1,
  },
  timeSlotLabel: {
    width: 70,
    paddingTop: 12,
    paddingLeft: 16,
  },
  timeSlotText: {
    fontSize: 13,
    fontWeight: '600',
  },
  timeSlotContent: {
    flex: 1,
    paddingRight: 16,
    paddingVertical: 8,
  },
  appointmentCard: {
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  appointmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  appointmentInfo: {
    flex: 1,
  },
  clientName: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  appointmentType: {
    fontSize: 13,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  emptySlot: {
    padding: 12,
  },
  emptySlotText: {
    fontSize: 13,
    fontStyle: 'italic',
  },
  // Week View
  weekView: {
    flex: 1,
  },
  weekDayCard: {
    width: 80,
    alignItems: 'center',
    padding: 12,
    marginHorizontal: 6,
    marginVertical: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  weekDayName: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  weekDayNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  weekDayBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  weekDayBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  weekAppointmentsList: {
    flex: 1,
    padding: 16,
  },
  listAppointmentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  listTimeLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 12,
  },
  listTimeText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  listAppointmentContent: {
    flex: 1,
  },
  listClientName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  listAppointmentDetails: {
    fontSize: 13,
    marginBottom: 4,
  },
  listNotes: {
    fontSize: 12,
    marginTop: 4,
  },
  emptyListState: {
    alignItems: 'center',
    paddingVertical: 64,
  },
  emptyListText: {
    fontSize: 16,
    marginTop: 16,
  },
  // Modal
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
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  pickerContainer: {
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  picker: {
    height: 50,
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
