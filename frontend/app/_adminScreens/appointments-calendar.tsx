import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'expo-router';
import AdminHeader from '../../components/admin/AdminHeader';
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
  FlatList,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useThemeColors } from '../../constants/colors';
import api from '../../services/api';
import { Picker } from '@react-native-picker/picker';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths, startOfWeek, endOfWeek, isToday } from 'date-fns';
import { es } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';

const { width } = Dimensions.get('window');

// Helper function to extract time from ISO string without timezone conversion
// This preserves the original Texas time (-06:00) stored in the database
const extractTimeFromISO = (isoString: string): string => {
  if (!isoString) return '00:00';
  
  // If it's already just a time like "13:30", return it
  if (/^\d{1,2}:\d{2}$/.test(isoString)) {
    return isoString;
  }
  
  // Try to extract time from ISO format like "2026-02-17T13:30:00-06:00"
  const timeMatch = isoString.match(/T(\d{2}):(\d{2})/);
  if (timeMatch) {
    return `${timeMatch[1]}:${timeMatch[2]}`;
  }
  
  // Fallback: use Date parsing (may have timezone issues)
  try {
    const date = new Date(isoString);
    return format(date, 'HH:mm');
  } catch {
    return '00:00';
  }
};

interface Appointment {
  id: string;
  _id?: string;
  user_id: string;
  client_id?: string;
  client_name: string;
  client_email: string;
  user_name?: string;
  scheduled_at: string;
  date?: string;
  time?: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  notes?: string;
  appointment_type: string;
  service_name?: string;
  duration_minutes: number;
  created_at: string;
}

export default function ModernAppointmentCalendar() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [clients, setClients] = useState<any[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [view, setView] = useState<'calendar' | 'list'>('calendar');

  // Form state
  const [formData, setFormData] = useState({
    client_id: '',
    scheduled_at: '',
    appointment_type: 'consultation',
    duration_minutes: 60,
    notes: '',
  });

  // Time slot state
  const [selectedTime, setSelectedTime] = useState<string>('09:00');

  // Generate available time slots (9 AM to 6 PM, every 30 minutes)
  const generateTimeSlots = () => {
    const slots = [];
    for (let hour = 9; hour < 18; hour++) {
      for (let minute of [0, 30]) {
        const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        slots.push(timeStr);
      }
    }
    return slots;
  };

  const timeSlots = generateTimeSlots();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      console.log('📅 Loading appointments from LOCAL system...');
      const [appointmentsRes, clientsRes] = await Promise.all([
        api.get('/appointments'),  // Use LOCAL appointments (includes migrated Square)
        api.get('/admin/clients?limit=1000'),
      ]);
      
      console.log('📅 Local appointments response:', JSON.stringify(appointmentsRes.data).substring(0, 200));
      
      const clientsData = Array.isArray(clientsRes.data) 
        ? clientsRes.data 
        : (clientsRes.data?.clients || []);
      
      // Local returns { appointments: [...] } or just [...]
      const appointmentsData = appointmentsRes.data?.appointments || appointmentsRes.data || [];
      console.log('📅 Local appointments count:', appointmentsData.length);
      
      // Map user_name to client_name for compatibility
      const mappedAppointments = (Array.isArray(appointmentsData) ? appointmentsData : []).map((apt: any) => ({
        ...apt,
        client_name: apt.client_name || apt.user_name || 'Cliente',
        client_email: apt.client_email || apt.user_email || '',
      }));
      setAppointments(mappedAppointments);
      setClients(clientsData);
    } catch (error) {
      console.error('❌ Error loading data:', error);
      Alert.alert('Error', 'No se pudieron cargar las citas');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // Get calendar days for current month
  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  // Get appointments for a specific day
  const getAppointmentsForDay = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    console.log(`📅 Filtering appointments for date: ${dateStr}, total appointments: ${appointments.length}`);
    
    const filtered = appointments.filter(apt => {
      // Get the date string from various possible fields
      const aptDateRaw = apt.date || apt.scheduled_at || '';
      if (!aptDateRaw) return false;
      
      // Extract just the date part (YYYY-MM-DD)
      const aptDateStr = String(aptDateRaw).substring(0, 10);
      
      const matches = aptDateStr === dateStr;
      if (matches) {
        console.log(`  ✅ Match: ${apt.user_name || apt.client_name} - ${aptDateStr}`);
      }
      return matches;
    });
    
    console.log(`📅 Found ${filtered.length} appointments for ${dateStr}`);
    return filtered;
  };

  // Get appointments for selected date
  const selectedDayAppointments = useMemo(() => {
    return getAppointmentsForDay(selectedDate).sort((a, b) => 
      new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
    );
  }, [selectedDate, appointments]);

  const handlePrevMonth = () => {
    setCurrentDate(subMonths(currentDate, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(addMonths(currentDate, 1));
  };

  const handleToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDate(today);
  };

  const handleCreateAppointment = () => {
    updateScheduledAt(selectedDate, selectedTime);
    setShowModal(true);
  };

  const handleCompleteAppointment = async (appointment: Appointment) => {
    Alert.alert(
      'Completar Cita',
      `¿Marcar como completada la cita con ${appointment.client_name}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Completar',
          style: 'default',
          onPress: async () => {
            try {
              await api.put(`/admin/appointments/${appointment.id}/status`, {
                status: 'completed'
              });
              Alert.alert('Éxito', 'Cita marcada como completada');
              loadData();
            } catch (error: any) {
              Alert.alert('Error', error.response?.data?.detail || 'No se pudo completar la cita');
            }
          }
        }
      ]
    );
  };

  const handleEditAppointment = (appointment: Appointment) => {
    Alert.alert(
      'Editar Cita',
      'La función de edición completa estará disponible próximamente. Por ahora puedes cancelar y crear una nueva cita.',
      [
        { text: 'OK', style: 'cancel' }
      ]
    );
  };

  const updateScheduledAt = (date: Date, time: string) => {
    if (!date || !time) return;
    
    const [hours, minutes] = time.split(':');
    const dateTime = new Date(date);
    dateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    
    setFormData(prev => ({
      ...prev,
      scheduled_at: dateTime.toISOString(),
    }));
  };

  const handleSubmit = async () => {
    try {
      if (!formData.client_id || !formData.scheduled_at) {
        Alert.alert('Error', 'Por favor completa todos los campos requeridos');
        return;
      }

      await api.post('/admin/appointments', formData);
      Alert.alert('Éxito', 'Cita creada correctamente');
      setShowModal(false);
      resetForm();
      loadData();
    } catch (error: any) {
      console.error('Error creating appointment:', error);
      Alert.alert('Error', error.response?.data?.detail || 'No se pudo crear la cita');
    }
  };

  const resetForm = () => {
    setFormData({
      client_id: '',
      scheduled_at: '',
      appointment_type: 'consultation',
      duration_minutes: 60,
      notes: '',
    });
    setSelectedTime('09:00');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return '#2196F3';
      case 'completed': return '#4CAF50';
      case 'cancelled': return '#F44336';
      default: return '#999';
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

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'consultation': return 'chatbubble-ellipses';
      case 'tax_preparation': return 'document-text';
      case 'follow_up': return 'refresh';
      case 'review': return 'eye';
      default: return 'calendar';
    }
  };

  const renderCalendarDay = (day: Date) => {
    const dayAppointments = getAppointmentsForDay(day);
    const isSelected = isSameDay(day, selectedDate);
    const isCurrentMonth = isSameMonth(day, currentDate);
    const isTodayDate = isToday(day);
    const hasAppointments = dayAppointments.length > 0;

    return (
      <TouchableOpacity
        key={day.toISOString()}
        style={[
          styles.calendarDay,
          isSelected && styles.calendarDaySelected,
          !isCurrentMonth && styles.calendarDayOutside,
          isTodayDate && !isSelected && styles.calendarDayToday,
        ]}
        onPress={() => setSelectedDate(day)}
      >
        <Text
          style={[
            styles.calendarDayText,
            !isCurrentMonth && styles.calendarDayTextOutside,
            isSelected && styles.calendarDayTextSelected,
            isTodayDate && !isSelected && styles.calendarDayTextToday,
          ]}
        >
          {format(day, 'd')}
        </Text>
        {hasAppointments && (
          <View style={[
            styles.appointmentDot,
            isSelected && styles.appointmentDotSelected
          ]}>
            <Text style={styles.appointmentDotText}>{dayAppointments.length}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderAppointmentCard = ({ item }: { item: Appointment }) => (
    <View style={styles.appointmentCard}>
      <View style={styles.appointmentCardLeft}>
        <View style={[styles.appointmentTime, { backgroundColor: getStatusColor(item.status) + '15' }]}>
          <Text style={[styles.appointmentTimeText, { color: getStatusColor(item.status) }]}>
            {item.time || extractTimeFromISO(item.scheduled_at)}
          </Text>
          <Text style={styles.appointmentDuration}>{item.duration_minutes}min</Text>
        </View>
      </View>

      <View style={styles.appointmentCardRight}>
        <View style={styles.appointmentHeader}>
          <View style={styles.appointmentTitleRow}>
            <Ionicons name={getTypeIcon(item.appointment_type)} size={18} color={colors.primary} />
            <Text style={styles.appointmentClientName} numberOfLines={1}>{item.client_name}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
            <View style={[styles.statusDot, { backgroundColor: getStatusColor(item.status) }]} />
            <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
              {getStatusLabel(item.status)}
            </Text>
          </View>
        </View>

        <View style={styles.appointmentDetails}>
          <View style={styles.detailRow}>
            <Ionicons name="mail-outline" size={14} color={colors.textGray} />
            <Text style={styles.detailText} numberOfLines={1}>{item.client_email}</Text>
          </View>
          {item.notes && (
            <View style={styles.detailRow}>
              <Ionicons name="document-text-outline" size={14} color={colors.textGray} />
              <Text style={styles.detailText} numberOfLines={2}>{item.notes}</Text>
            </View>
          )}
        </View>

        <View style={styles.appointmentActions}>
          <TouchableOpacity 
            style={[styles.actionButton, styles.actionButtonSecondary]}
            onPress={() => handleEditAppointment(item)}
          >
            <Ionicons name="create-outline" size={16} color={colors.primary} />
            <Text style={[styles.actionButtonText, { color: colors.primary }]}>Editar</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.actionButton, styles.actionButtonSuccess]}
            onPress={() => handleCompleteAppointment(item)}
            disabled={item.status === 'completed'}
          >
            <Ionicons name="checkmark-circle-outline" size={16} color={item.status === 'completed' ? '#CCC' : '#4CAF50'} />
            <Text style={[styles.actionButtonText, { color: item.status === 'completed' ? '#CCC' : '#4CAF50' }]}>
              {item.status === 'completed' ? 'Completada' : 'Completar'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <AdminHeader 
          title="Calendario de Citas" 
          subtitle="Gestión"
          rightAction={{
            icon: 'add-circle',
            onPress: handleCreateAppointment
          }}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Cargando citas...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AdminHeader 
        title="Calendario de Citas" 
        subtitle={`${appointments.length} citas registradas`}
        rightAction={{
          icon: 'add-circle',
          onPress: handleCreateAppointment
        }}
      />
      
      {/* View Toggle Bar */}
      <View style={styles.viewToggleBar}>
        <TouchableOpacity
          style={[styles.viewToggleButton, view === 'calendar' && styles.viewToggleButtonActive]}
          onPress={() => setView('calendar')}
        >
          <Ionicons name="calendar-outline" size={18} color={view === 'calendar' ? '#FFF' : colors.primary} />
          <Text style={[styles.viewToggleText, view === 'calendar' && styles.viewToggleTextActive]}>Calendario</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.viewToggleButton, view === 'list' && styles.viewToggleButtonActive]}
          onPress={() => setView('list')}
        >
          <Ionicons name="list" size={18} color={view === 'list' ? '#FFF' : colors.primary} />
          <Text style={[styles.viewToggleText, view === 'list' && styles.viewToggleTextActive]}>Lista</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {view === 'calendar' ? (
          <>
            {/* Calendar View */}
            <View style={styles.calendarContainer}>
              {/* Month Navigation */}
              <View style={styles.monthNav}>
                <TouchableOpacity onPress={handlePrevMonth} style={styles.navButton}>
                  <Ionicons name="chevron-back" size={24} color={colors.primary} />
                </TouchableOpacity>
                
                <View style={styles.monthInfo}>
                  <Text style={styles.monthText}>
                    {format(currentDate, 'MMMM yyyy', { locale: es })}
                  </Text>
                  <TouchableOpacity onPress={handleToday} style={styles.todayButton}>
                    <Text style={styles.todayButtonText}>Hoy</Text>
                  </TouchableOpacity>
                </View>
                
                <TouchableOpacity onPress={handleNextMonth} style={styles.navButton}>
                  <Ionicons name="chevron-forward" size={24} color={colors.primary} />
                </TouchableOpacity>
              </View>

              {/* Weekday Headers */}
              <View style={styles.weekDays}>
                {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map((day) => (
                  <View key={day} style={styles.weekDay}>
                    <Text style={styles.weekDayText}>{day}</Text>
                  </View>
                ))}
              </View>

              {/* Calendar Grid */}
              <View style={styles.calendarGrid}>
                {calendarDays.map(renderCalendarDay)}
              </View>
            </View>

            {/* Selected Date Info */}
            <View style={styles.selectedDateContainer}>
              <View style={styles.selectedDateHeader}>
                <View style={styles.selectedDateLeft}>
                  <Text style={styles.selectedDateTitle}>
                    {format(selectedDate, 'EEEE, d MMMM', { locale: es })}
                  </Text>
                  <Text style={styles.selectedDateSubtitle}>
                    {selectedDayAppointments.length} {selectedDayAppointments.length === 1 ? 'cita' : 'citas'}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.addAppointmentButton}
                  onPress={handleCreateAppointment}
                >
                  <Ionicons name="add" size={20} color="#FFF" />
                  <Text style={styles.addAppointmentButtonText}>Nueva Cita</Text>
                </TouchableOpacity>
              </View>

              {/* Appointments List */}
              {selectedDayAppointments.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="calendar-outline" size={64} color={colors.textGray} />
                  <Text style={styles.emptyStateText}>No hay citas para este día</Text>
                  <Text style={styles.emptyStateSubtext}>
                    Toca "Nueva Cita" para agendar una
                  </Text>
                </View>
              ) : (
                <View style={styles.appointmentsList}>
                  {selectedDayAppointments.map(apt => (
                    <View key={apt.id}>
                      {renderAppointmentCard({ item: apt })}
                    </View>
                  ))}
                </View>
              )}
            </View>
          </>
        ) : (
          /* List View - All upcoming appointments */
          <View style={styles.listViewContainer}>
            <View style={styles.listViewHeader}>
              <Text style={styles.listViewTitle}>Todas las Citas</Text>
              <Text style={styles.listViewSubtitle}>
                {appointments.length} {appointments.length === 1 ? 'cita' : 'citas'} en total
              </Text>
            </View>
            
            {appointments.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="calendar-outline" size={64} color={colors.textGray} />
                <Text style={styles.emptyStateText}>No hay citas</Text>
                <Text style={styles.emptyStateSubtext}>
                  Las citas programadas aparecerán aquí
                </Text>
              </View>
            ) : (
              <View style={styles.appointmentsList}>
                {[...appointments]
                  .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())
                  .map(apt => (
                    <View key={apt.id} style={styles.listAppointmentItem}>
                      <View style={styles.listDateBadge}>
                        <Text style={styles.listDateDay}>
                          {format(new Date(apt.scheduled_at), 'd', { locale: es })}
                        </Text>
                        <Text style={styles.listDateMonth}>
                          {format(new Date(apt.scheduled_at), 'MMM', { locale: es })}
                        </Text>
                      </View>
                      <View style={styles.listAppointmentContent}>
                        {renderAppointmentCard({ item: apt })}
                      </View>
                    </View>
                  ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Create Appointment Modal */}
      <Modal
        visible={showModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nueva Cita</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Ionicons name="close" size={28} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {/* Cliente */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>Cliente *</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={formData.client_id}
                    onValueChange={(value) => setFormData({ ...formData, client_id: value })}
                    style={styles.picker}
                  >
                    <Picker.Item label="Seleccionar cliente" value="" />
                    {clients.map((client) => (
                      <Picker.Item
                        key={client.id || client._id}
                        label={client.name}
                        value={client.id || client._id}
                      />
                    ))}
                  </Picker>
                </View>
              </View>

              {/* Fecha */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>Fecha</Text>
                <Text style={styles.inputReadonly}>
                  {format(selectedDate, 'dd/MM/yyyy', { locale: es })}
                </Text>
              </View>

              {/* Hora */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>Hora *</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={selectedTime}
                    onValueChange={(value) => {
                      setSelectedTime(value);
                      updateScheduledAt(selectedDate, value);
                    }}
                    style={styles.picker}
                  >
                    {timeSlots.map((time) => (
                      <Picker.Item key={time} label={time} value={time} />
                    ))}
                  </Picker>
                </View>
              </View>

              {/* Tipo */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>Tipo de Cita</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={formData.appointment_type}
                    onValueChange={(value) => setFormData({ ...formData, appointment_type: value })}
                    style={styles.picker}
                  >
                    <Picker.Item label="Consulta" value="consultation" />
                    <Picker.Item label={t('admin.taxPrepLabel', 'Preparación de Impuestos')} value="tax_preparation" />
                    <Picker.Item label="Seguimiento" value="follow_up" />
                    <Picker.Item label={t('admin.reviewLabel', 'Revisión')} value="review" />
                  </Picker>
                </View>
              </View>

              {/* Duración */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>Duración (minutos)</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={formData.duration_minutes}
                    onValueChange={(value) => setFormData({ ...formData, duration_minutes: value })}
                    style={styles.picker}
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
                <Text style={styles.label}>Notas</Text>
                <TextInput
                  style={styles.textArea}
                  value={formData.notes}
                  onChangeText={(text) => setFormData({ ...formData, notes: text })}
                  placeholder="Agregar notas sobre la cita..."
                  placeholderTextColor={colors.textGray}
                  multiline
                  numberOfLines={4}
                />
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => setShowModal(false)}
              >
                <Text style={styles.modalButtonTextCancel}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSubmit]}
                onPress={handleSubmit}
              >
                <Text style={styles.modalButtonTextSubmit}>Crear Cita</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 16,
    color: colors.textGray,
  },
  // Header
  header: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  headerTextContainer: {
    gap: 2,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFF',
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
  },
  headerRight: {
    flexDirection: 'row',
    gap: 12,
  },
  headerButton: {
    padding: 4,
  },
  // View Toggle Bar
  viewToggleBar: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 4,
  },
  viewToggleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    gap: 6,
  },
  viewToggleButtonActive: {
    backgroundColor: colors.primary,
  },
  viewToggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  viewToggleTextActive: {
    color: '#FFF',
  },
  // Content
  content: {
    flex: 1,
  },
  // Calendar
  calendarContainer: {
    backgroundColor: '#FFF',
    padding: 16,
  },
  monthNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  navButton: {
    padding: 8,
  },
  monthInfo: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  monthText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    textTransform: 'capitalize',
  },
  todayButton: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: colors.primary + '15',
  },
  todayButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  weekDays: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  weekDay: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  weekDayText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textGray,
    textTransform: 'uppercase',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarDay: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    marginBottom: 4,
    position: 'relative',
  },
  calendarDaySelected: {
    backgroundColor: colors.primary,
  },
  calendarDayToday: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  calendarDayOutside: {
    opacity: 0.3,
  },
  calendarDayText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  calendarDayTextSelected: {
    color: '#FFF',
    fontWeight: '700',
  },
  calendarDayTextToday: {
    color: colors.primary,
    fontWeight: '700',
  },
  calendarDayTextOutside: {
    color: colors.textGray,
  },
  appointmentDot: {
    position: 'absolute',
    bottom: 2,
    backgroundColor: colors.accent,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  appointmentDotSelected: {
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  appointmentDotText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFF',
  },
  // Selected Date
  selectedDateContainer: {
    backgroundColor: '#FFF',
    marginTop: 12,
    padding: 16,
  },
  selectedDateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  selectedDateLeft: {
    flex: 1,
  },
  selectedDateTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    textTransform: 'capitalize',
  },
  selectedDateSubtitle: {
    fontSize: 14,
    color: colors.textGray,
    marginTop: 2,
  },
  addAppointmentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  addAppointmentButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  },
  // Appointments List
  appointmentsList: {
    gap: 12,
  },
  appointmentCard: {
    flexDirection: 'row',
    backgroundColor: '#F9F9F9',
    borderRadius: 12,
    padding: 12,
    gap: 12,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  appointmentCardLeft: {
    width: 70,
  },
  appointmentTime: {
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
  },
  appointmentTimeText: {
    fontSize: 16,
    fontWeight: '700',
  },
  appointmentDuration: {
    fontSize: 11,
    color: colors.textGray,
    marginTop: 2,
  },
  appointmentCardRight: {
    flex: 1,
    gap: 8,
  },
  appointmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  appointmentTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  appointmentClientName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    flex: 1,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  appointmentDetails: {
    gap: 4,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailText: {
    fontSize: 13,
    color: colors.textGray,
    flex: 1,
  },
  appointmentActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
  },
  actionButtonSecondary: {
    borderColor: colors.primary + '40',
    backgroundColor: colors.primary + '10',
  },
  actionButtonSuccess: {
    borderColor: '#4CAF50' + '40',
    backgroundColor: '#4CAF50' + '10',
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: colors.textGray,
    marginTop: 8,
  },
  // List View Styles
  listViewContainer: {
    padding: 16,
  },
  listViewHeader: {
    marginBottom: 20,
  },
  listViewTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
  },
  listViewSubtitle: {
    fontSize: 14,
    color: colors.textGray,
    marginTop: 4,
  },
  listAppointmentItem: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  listDateBadge: {
    width: 50,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary + '15',
    borderRadius: 10,
    paddingVertical: 8,
  },
  listDateDay: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.primary,
  },
  listDateMonth: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
    textTransform: 'uppercase',
  },
  listAppointmentContent: {
    flex: 1,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
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
    color: colors.text,
    marginBottom: 8,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#F9F9F9',
  },
  picker: {
    height: 50,
  },
  inputReadonly: {
    padding: 14,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    fontSize: 15,
    color: colors.text,
  },
  textArea: {
    padding: 14,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#F9F9F9',
    fontSize: 15,
    color: colors.text,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: '#F5F5F5',
  },
  modalButtonSubmit: {
    backgroundColor: colors.primary,
  },
  modalButtonTextCancel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  modalButtonTextSubmit: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
});
