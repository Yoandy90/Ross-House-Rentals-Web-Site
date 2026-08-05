/**
 * Schedule Appointment Screen - Modern Design
 * Visual calendar with available time slots
 * Supports both registered and unregistered clients
 * Synced with Square
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Modal,
  FlatList,
  Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
import api from '../../services/api';

interface Client {
  id?: string;
  _id?: string;
  name?: string;
  full_name?: string;
  email: string;
  phone?: string;
}

interface TimeSlot {
  time: string;
  available: boolean;
  label: string;
}

interface DayInfo {
  date: Date;
  day: number;
  isToday: boolean;
  isSelected: boolean;
  isPast: boolean;
  isCurrentMonth: boolean;
}

// Default fallback types (used if Square services can't be loaded)
const DEFAULT_APPOINTMENT_TYPES = [
  { id: 'consultation', label: 'Consultoría', icon: '💼', duration: 60 },
  { id: 'tax_preparation', label: 'Preparación de Impuestos', icon: '📋', duration: 120 },
  { id: 'document_review', label: 'Revisión de Documentos', icon: '📄', duration: 45 },
  { id: 'follow_up', label: 'Seguimiento', icon: '🔄', duration: 30 },
  { id: 'other', label: 'Otro', icon: '📝', duration: 60 },
];

// Icon mapping for Square service names
const getServiceIcon = (serviceName: string): string => {
  const name = serviceName.toLowerCase();
  if (name.includes('tax') || name.includes('impuesto')) return '📋';
  if (name.includes('itin')) return '🆔';
  if (name.includes('consult')) return '💼';
  if (name.includes('document') || name.includes('review')) return '📄';
  if (name.includes('follow') || name.includes('seguimiento')) return '🔄';
  if (name.includes('notary') || name.includes('notari')) return '📜';
  if (name.includes('translation') || name.includes('traducción')) return '🌐';
  if (name.includes('passport') || name.includes('pasaporte')) return '🛂';
  return '📝';
};

interface AppointmentType {
  id: string;
  label: string;
  icon: string;
  duration: number;
  squareServiceId?: string;
}

// Business hours synced with Square - Ross Offices
// SUN: 10:00 - 21:00, MON-FRI: 10:00 - 14:00, SAT: 10:00 - 18:00
const BUSINESS_HOURS_BY_DAY: { [key: number]: { start: number; end: number } } = {
  0: { start: 10, end: 21 },  // Sunday
  1: { start: 10, end: 14 },  // Monday
  2: { start: 10, end: 14 },  // Tuesday
  3: { start: 10, end: 14 },  // Wednesday
  4: { start: 10, end: 14 },  // Thursday
  5: { start: 10, end: 14 },  // Friday
  6: { start: 10, end: 18 },  // Saturday
};

const SLOT_INTERVAL = 30; // minutes

const ScheduleAppointment = () => {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  
  const [loading, setLoading] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [loadingServices, setLoadingServices] = useState(true);
  const [clients, setClients] = useState<Client[]>([]);
  const [showClientPicker, setShowClientPicker] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  
  // Client Mode: registered or new
  const [isNewClient, setIsNewClient] = useState(false);
  
  // Form state for registered client
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  
  // Form state for new client
  const [newClientData, setNewClientData] = useState({
    name: '',
    email: '',
    phone: '',
  });
  
  // Appointment types from Square
  const [appointmentTypes, setAppointmentTypes] = useState<AppointmentType[]>(DEFAULT_APPOINTMENT_TYPES);
  
  // Appointment state
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<AppointmentType>(DEFAULT_APPOINTMENT_TYPES[0]);
  const [notes, setNotes] = useState('');
  const [notifyClient, setNotifyClient] = useState(true);
  
  // Calendar state
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [bookedSlots, setBookedSlots] = useState<string[]>([]);

  // Track if services have been loaded
  const servicesLoadedRef = React.useRef(false);

  // Load Square services on mount with timeout
  const loadSquareServices = async () => {
    // Prevent multiple calls
    if (servicesLoadedRef.current) return;
    servicesLoadedRef.current = true;
    
    console.log('🔄 Loading Square services...');
    
    try {
      // Simple API call with axios timeout
      const response = await api.get('/services/available', { timeout: 10000 });
      
      const services = response.data?.services || [];
      console.log(`📋 Got ${services.length} services from API`);
      
      if (services.length > 0) {
        const mappedTypes: AppointmentType[] = services.map((svc: any) => ({
          id: svc.id,
          label: svc.name || svc.full_name,
          icon: getServiceIcon(svc.name || ''),
          duration: svc.duration_minutes || 30,
          squareServiceId: svc.id,
        }));
        
        setAppointmentTypes(mappedTypes);
        setSelectedType(mappedTypes[0]);
        console.log(`✅ Loaded ${mappedTypes.length} services from Square`);
      } else {
        // Use defaults if no services from Square
        setAppointmentTypes(DEFAULT_APPOINTMENT_TYPES);
        setSelectedType(DEFAULT_APPOINTMENT_TYPES[0]);
      }
    } catch (error: any) {
      console.error('❌ Error loading Square services:', error?.message || error);
      // Use defaults on error
      setAppointmentTypes(DEFAULT_APPOINTMENT_TYPES);
      setSelectedType(DEFAULT_APPOINTMENT_TYPES[0]);
    } finally {
      setLoadingServices(false);
    }
  };

  // Initial load effect - runs only once
  useEffect(() => {
    loadClients();
    loadSquareServices();
  }, []);

  // Handle pre-selected client from params
  useEffect(() => {
    if (params.clientId && params.clientName) {
      setSelectedClient({
        id: params.clientId as string,
        name: params.clientName as string,
        email: '',
      });
    }
  }, [params.clientId, params.clientName]);

  useEffect(() => {
    loadAvailableSlots(selectedDate);
  }, [selectedDate]);

  const loadClients = async () => {
    try {
      const response = await api.get('/admin/clients?limit=500');
      setClients(response.data.clients || []);
    } catch (error) {
      console.error('Error loading clients:', error);
    }
  };

  const getBusinessHoursForDate = (date: Date) => {
    const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
    return BUSINESS_HOURS_BY_DAY[dayOfWeek] || { start: 10, end: 14 };
  };

  const loadAvailableSlots = async (date: Date) => {
    setLoadingSlots(true);
    try {
      const dateStr = date.toISOString().split('T')[0];
      
      // Use LOCAL availability system
      const response = await api.get(`/public/available-slots?date=${dateStr}`);
      const localSlots = response.data || [];
      
      if (localSlots.length === 0) {
        // No availability - office is closed for this day
        setAvailableSlots([]);
        setBookedSlots([]);
      } else {
        // Convert response to our TimeSlot format
        const slots: TimeSlot[] = localSlots.map((slot: any) => ({
          time: slot.time,
          label: formatTimeLabel(
            parseInt(slot.time.split(':')[0]), 
            parseInt(slot.time.split(':')[1])
          ),
          available: slot.available,
        }));
        
        setAvailableSlots(slots);
        setBookedSlots(
          localSlots.filter((s: any) => !s.available).map((s: any) => s.time)
        );
      }
    } catch (error) {
      console.error('Error loading slots:', error);
      // On error, show no slots available (safer than showing fake availability)
      setAvailableSlots([]);
      setBookedSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  };

  const formatTimeLabel = (hour: number, min: number) => {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:${min.toString().padStart(2, '0')} ${period}`;
  };

  const formatPhone = (text: string) => {
    const cleaned = text.replace(/\D/g, '');
    const match = cleaned.match(/^(\d{0,3})(\d{0,3})(\d{0,4})$/);
    if (match) {
      return [match[1], match[2], match[3]].filter(Boolean).join('-');
    }
    return text;
  };

  const generateCalendarDays = (): DayInfo[] => {
    const days: DayInfo[] = [];
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPadding = firstDay.getDay();
    
    for (let i = 0; i < startPadding; i++) {
      const date = new Date(year, month, -startPadding + i + 1);
      days.push({
        date,
        day: date.getDate(),
        isToday: false,
        isSelected: false,
        isPast: true,
        isCurrentMonth: false,
      });
    }
    
    for (let i = 1; i <= lastDay.getDate(); i++) {
      const date = new Date(year, month, i);
      date.setHours(0, 0, 0, 0);
      const isPast = date < today;
      const isToday = date.getTime() === today.getTime();
      const isSelected = date.toDateString() === selectedDate.toDateString();
      
      days.push({
        date,
        day: i,
        isToday,
        isSelected,
        isPast,
        isCurrentMonth: true,
      });
    }
    
    return days;
  };

  const handleDateSelect = (dayInfo: DayInfo) => {
    if (dayInfo.isPast && !dayInfo.isToday) return;
    if (!dayInfo.isCurrentMonth) return;
    setSelectedDate(dayInfo.date);
    setSelectedTime(null);
  };

  const handleTimeSelect = (slot: TimeSlot) => {
    if (!slot.available) return;
    setSelectedTime(slot.time);
  };

  const validateForm = (): boolean => {
    if (isNewClient) {
      if (!newClientData.name.trim()) {
        Alert.alert('Error', 'Por favor ingresa el nombre del cliente');
        return false;
      }
      if (!newClientData.phone.trim()) {
        Alert.alert('Error', 'Por favor ingresa el teléfono del cliente');
        return false;
      }
    } else {
      if (!selectedClient) {
        Alert.alert('Error', 'Por favor selecciona un cliente');
        return false;
      }
    }
    if (!selectedTime) {
      Alert.alert('Error', 'Por favor selecciona un horario');
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      const dateStr = selectedDate.toISOString().split('T')[0];
      
      // Prepare client data
      let clientData: any = {};
      if (isNewClient) {
        clientData = {
          user_name: newClientData.name,
          user_email: newClientData.email,
          user_phone: newClientData.phone.replace(/\D/g, ''),
          user_id: '', // No ID for new clients
        };
      } else {
        clientData = {
          user_id: selectedClient!.id || selectedClient!._id,
          user_name: selectedClient!.name || selectedClient!.full_name,
          user_email: selectedClient!.email,
          user_phone: selectedClient!.phone,
        };
      }

      const appointmentData = {
        ...clientData,
        date: dateStr,
        time: selectedTime,
        scheduled_at: `${dateStr}T${selectedTime}:00`,
        service_name: selectedType.label,
        appointment_type: selectedType.id,
        duration: selectedType.duration,
        duration_minutes: selectedType.duration,
        notes: notes,
        notify_client: notifyClient,
      };

      await api.post('/admin/appointments', appointmentData);
      
      const clientName = isNewClient ? newClientData.name : (selectedClient!.name || selectedClient!.full_name);
      
      Alert.alert(
        '✅ Cita Agendada',
        `Cita programada para ${clientName}\n${selectedDate.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })} a las ${selectedTime}\n\n${notifyClient ? '📧 Se enviarán notificaciones al cliente' : ''}\n🔄 Sincronizado con Square`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error: any) {
      console.error('Error creating appointment:', error);
      const errorMsg = error.response?.data?.detail || 'No se pudo crear la cita';
      Alert.alert('Error', errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const filteredClients = clients.filter(client => {
    if (!clientSearch.trim()) return true;
    const name = (client.name || client.full_name || '').toLowerCase();
    const email = (client.email || '').toLowerCase();
    return name.includes(clientSearch.toLowerCase()) || email.includes(clientSearch.toLowerCase());
  });

  const renderClientItem = ({ item }: { item: Client }) => (
    <TouchableOpacity
      style={styles.clientItem}
      onPress={() => {
        setSelectedClient(item);
        setShowClientPicker(false);
        setClientSearch('');
      }}
    >
      <View style={styles.clientAvatar}>
        <Text style={styles.clientAvatarText}>
          {(item.name || item.full_name || '?')[0].toUpperCase()}
        </Text>
      </View>
      <View style={styles.clientItemInfo}>
        <Text style={styles.clientItemName}>{item.name || item.full_name}</Text>
        <Text style={styles.clientItemEmail}>{item.email}</Text>
      </View>
    </TouchableOpacity>
  );

  const calendarDays = generateCalendarDays();
  const weekDays = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={['#1e1b4b', '#312e81']}
        style={[styles.header, { paddingTop: insets.top + 10 }]}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Agendar Cita</Text>
          <View style={styles.squareBadge}>
            <Text style={styles.squareBadgeText}>Square</Text>
          </View>
        </View>
      </LinearGradient>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Client Type Toggle */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              <Ionicons name="person" size={18} color="#6366f1" /> Cliente
            </Text>
            
            <View style={styles.toggleContainer}>
              <TouchableOpacity
                style={[styles.toggleButton, !isNewClient && styles.toggleButtonActive]}
                onPress={() => setIsNewClient(false)}
              >
                <Ionicons name="people" size={18} color={!isNewClient ? '#fff' : '#6b7280'} />
                <Text style={[styles.toggleText, !isNewClient && styles.toggleTextActive]}>
                  Cliente Registrado
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleButton, isNewClient && styles.toggleButtonActive]}
                onPress={() => setIsNewClient(true)}
              >
                <Ionicons name="person-add" size={18} color={isNewClient ? '#fff' : '#6b7280'} />
                <Text style={[styles.toggleText, isNewClient && styles.toggleTextActive]}>
                  Nuevo Cliente
                </Text>
              </TouchableOpacity>
            </View>

            {!isNewClient ? (
              // Registered Client Selector
              <TouchableOpacity 
                style={styles.selector}
                onPress={() => setShowClientPicker(true)}
              >
                {selectedClient ? (
                  <View style={styles.selectedClient}>
                    <View style={styles.miniAvatar}>
                      <Text style={styles.miniAvatarText}>
                        {(selectedClient.name || selectedClient.full_name || '?')[0].toUpperCase()}
                      </Text>
                    </View>
                    <Text style={styles.selectedClientName}>
                      {selectedClient.name || selectedClient.full_name}
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.selectorPlaceholder}>Seleccionar cliente...</Text>
                )}
                <Ionicons name="chevron-down" size={20} color="#9ca3af" />
              </TouchableOpacity>
            ) : (
              // New Client Form
              <View style={styles.newClientForm}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Nombre *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Nombre completo"
                    placeholderTextColor="#9ca3af"
                    value={newClientData.name}
                    onChangeText={(text) => setNewClientData(prev => ({ ...prev, name: text }))}
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Teléfono *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="123-456-7890"
                    placeholderTextColor="#9ca3af"
                    keyboardType="phone-pad"
                    value={newClientData.phone}
                    onChangeText={(text) => setNewClientData(prev => ({ ...prev, phone: formatPhone(text) }))}
                    maxLength={12}
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Email (opcional)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="email@ejemplo.com"
                    placeholderTextColor="#9ca3af"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={newClientData.email}
                    onChangeText={(text) => setNewClientData(prev => ({ ...prev, email: text }))}
                  />
                </View>
              </View>
            )}
          </View>

          {/* Appointment Type */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              <Ionicons name="briefcase" size={18} color="#6366f1" /> Tipo de Cita
            </Text>
            <View style={styles.typeGrid}>
              {appointmentTypes.map((type) => (
                <TouchableOpacity
                  key={type.id}
                  style={[
                    styles.typeCard,
                    selectedType.id === type.id && styles.typeCardSelected,
                  ]}
                  onPress={() => setSelectedType(type)}
                >
                  <Text style={styles.typeIcon}>{type.icon}</Text>
                  <Text style={[
                    styles.typeLabel,
                    selectedType.id === type.id && styles.typeLabelSelected,
                  ]} numberOfLines={2}>
                    {type.label}
                  </Text>
                  <Text style={styles.typeDuration}>{type.duration} min</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Calendar */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              <Ionicons name="calendar" size={18} color="#6366f1" /> Fecha
            </Text>
            
            <View style={styles.calendarContainer}>
              <View style={styles.monthNav}>
                <TouchableOpacity 
                  onPress={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
                  style={styles.monthNavButton}
                >
                  <Ionicons name="chevron-back" size={24} color="#6366f1" />
                </TouchableOpacity>
                <Text style={styles.monthTitle}>
                  {currentMonth.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
                </Text>
                <TouchableOpacity 
                  onPress={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
                  style={styles.monthNavButton}
                >
                  <Ionicons name="chevron-forward" size={24} color="#6366f1" />
                </TouchableOpacity>
              </View>

              <View style={styles.weekDaysRow}>
                {weekDays.map((day) => (
                  <Text key={day} style={styles.weekDayText}>{day}</Text>
                ))}
              </View>

              <View style={styles.calendarGrid}>
                {calendarDays.map((dayInfo, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.dayCell,
                      dayInfo.isToday && styles.dayCellToday,
                      dayInfo.isSelected && styles.dayCellSelected,
                      (dayInfo.isPast || !dayInfo.isCurrentMonth) && styles.dayCellDisabled,
                    ]}
                    onPress={() => handleDateSelect(dayInfo)}
                    disabled={(dayInfo.isPast && !dayInfo.isToday) || !dayInfo.isCurrentMonth}
                  >
                    <Text style={[
                      styles.dayText,
                      dayInfo.isToday && styles.dayTextToday,
                      dayInfo.isSelected && styles.dayTextSelected,
                      (dayInfo.isPast || !dayInfo.isCurrentMonth) && styles.dayTextDisabled,
                    ]}>
                      {dayInfo.day}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          {/* Time Slots */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              <Ionicons name="time" size={18} color="#6366f1" /> Horario Disponible
            </Text>
            
            {loadingSlots ? (
              <View style={styles.loadingSlots}>
                <ActivityIndicator color="#6366f1" />
                <Text style={styles.loadingSlotsText}>Cargando horarios...</Text>
              </View>
            ) : (
              <View style={styles.slotsGrid}>
                {availableSlots.map((slot) => (
                  <TouchableOpacity
                    key={slot.time}
                    style={[
                      styles.slotButton,
                      !slot.available && styles.slotButtonUnavailable,
                      selectedTime === slot.time && styles.slotButtonSelected,
                    ]}
                    onPress={() => handleTimeSelect(slot)}
                    disabled={!slot.available}
                  >
                    <Text style={[
                      styles.slotText,
                      !slot.available && styles.slotTextUnavailable,
                      selectedTime === slot.time && styles.slotTextSelected,
                    ]}>
                      {slot.label}
                    </Text>
                    {!slot.available && (
                      <Text style={styles.slotOccupied}>Ocupado</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Notes */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              <Ionicons name="document-text" size={18} color="#6366f1" /> Notas
            </Text>
            <TextInput
              style={styles.notesInput}
              placeholder="Notas adicionales sobre la cita..."
              placeholderTextColor="#9ca3af"
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={3}
            />
          </View>

          {/* Notifications Toggle */}
          <View style={styles.notifyContainer}>
            <View style={styles.notifyInfo}>
              <Ionicons name="notifications" size={22} color="#6366f1" />
              <View>
                <Text style={styles.notifyTitle}>Notificar al Cliente</Text>
                <Text style={styles.notifySubtitle}>Enviar email y SMS con detalles</Text>
              </View>
            </View>
            <Switch
              value={notifyClient}
              onValueChange={setNotifyClient}
              trackColor={{ false: '#e5e7eb', true: '#c7d2fe' }}
              thumbColor={notifyClient ? '#6366f1' : '#9ca3af'}
            />
          </View>

          {/* Summary */}
          {selectedTime && (isNewClient ? newClientData.name : selectedClient) && (
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>📋 Resumen de la Cita</Text>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Cliente:</Text>
                <Text style={styles.summaryValue}>
                  {isNewClient ? newClientData.name : (selectedClient!.name || selectedClient!.full_name)}
                  {isNewClient && <Text style={styles.newBadge}> (Nuevo)</Text>}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Fecha:</Text>
                <Text style={styles.summaryValue}>
                  {selectedDate.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Hora:</Text>
                <Text style={styles.summaryValue}>{selectedTime}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Tipo:</Text>
                <Text style={styles.summaryValue}>{selectedType.icon} {selectedType.label}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Duración:</Text>
                <Text style={styles.summaryValue}>{selectedType.duration} minutos</Text>
              </View>
              <View style={styles.syncInfo}>
                <Ionicons name="sync" size={16} color="#22c55e" />
                <Text style={styles.syncText}>Se sincronizará con Square automáticamente</Text>
              </View>
            </View>
          )}

          {/* Submit Button */}
          <TouchableOpacity
            style={[
              styles.submitButton,
              ((!isNewClient && !selectedClient) || (isNewClient && !newClientData.name) || !selectedTime) && styles.submitButtonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={((!isNewClient && !selectedClient) || (isNewClient && !newClientData.name) || !selectedTime) || loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={24} color="#fff" />
                <Text style={styles.submitButtonText}>Confirmar Cita</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Client Picker Modal */}
      <Modal
        visible={showClientPicker}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={[styles.modalContainer, { paddingTop: insets.top }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Seleccionar Cliente</Text>
            <TouchableOpacity onPress={() => setShowClientPicker(false)}>
              <Ionicons name="close" size={28} color="#374151" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.modalSearch}>
            <Ionicons name="search" size={20} color="#9ca3af" />
            <TextInput
              style={styles.modalSearchInput}
              placeholder="Buscar cliente..."
              placeholderTextColor="#9ca3af"
              value={clientSearch}
              onChangeText={setClientSearch}
            />
          </View>

          <FlatList
            data={filteredClients}
            renderItem={renderClientItem}
            keyExtractor={(item) => item.id || item._id || Math.random().toString()}
            contentContainerStyle={styles.clientList}
            ListEmptyComponent={
              <View style={styles.emptyClients}>
                <Ionicons name="people-outline" size={48} color="#d1d5db" />
                <Text style={styles.emptyClientsText}>No se encontraron clientes</Text>
                <TouchableOpacity 
                  style={styles.createClientButton}
                  onPress={() => {
                    setShowClientPicker(false);
                    setIsNewClient(true);
                  }}
                >
                  <Ionicons name="add" size={20} color="#6366f1" />
                  <Text style={styles.createClientButtonText}>Crear cliente nuevo</Text>
                </TouchableOpacity>
              </View>
            }
          />
        </View>
      </Modal>
    </View>
  );
};

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
    justifyContent: 'space-between',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  squareBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  squareBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    padding: 4,
    marginBottom: 12,
  },
  toggleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  toggleButtonActive: {
    backgroundColor: '#6366f1',
  },
  toggleText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
  },
  toggleTextActive: {
    color: '#fff',
  },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  selectorPlaceholder: {
    fontSize: 15,
    color: '#9ca3af',
  },
  selectedClient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  miniAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniAvatarText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  selectedClientName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1f2937',
  },
  newClientForm: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  inputGroup: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: '#1f2937',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  typeCard: {
    width: '31%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
  typeCardSelected: {
    borderColor: '#6366f1',
    backgroundColor: '#eef2ff',
  },
  typeIcon: {
    fontSize: 24,
    marginBottom: 6,
  },
  typeLabel: {
    fontSize: 11,
    color: '#6b7280',
    textAlign: 'center',
    fontWeight: '500',
  },
  typeLabelSelected: {
    color: '#6366f1',
  },
  typeDuration: {
    fontSize: 10,
    color: '#9ca3af',
    marginTop: 4,
  },
  calendarContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  monthNavButton: {
    padding: 8,
  },
  monthTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    textTransform: 'capitalize',
  },
  weekDaysRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  weekDayText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    color: '#9ca3af',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
  },
  dayCellToday: {
    backgroundColor: '#fef3c7',
  },
  dayCellSelected: {
    backgroundColor: '#6366f1',
  },
  dayCellDisabled: {
    opacity: 0.3,
  },
  dayText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  dayTextToday: {
    color: '#d97706',
    fontWeight: '700',
  },
  dayTextSelected: {
    color: '#fff',
    fontWeight: '700',
  },
  dayTextDisabled: {
    color: '#9ca3af',
  },
  loadingSlots: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    gap: 10,
  },
  loadingSlotsText: {
    fontSize: 14,
    color: '#6b7280',
  },
  slotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  slotButton: {
    width: '23%',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  slotButtonUnavailable: {
    backgroundColor: '#fee2e2',
    borderColor: '#fecaca',
  },
  slotButtonSelected: {
    backgroundColor: '#6366f1',
    borderColor: '#6366f1',
  },
  slotText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#374151',
  },
  slotTextUnavailable: {
    color: '#dc2626',
    textDecorationLine: 'line-through',
  },
  slotTextSelected: {
    color: '#fff',
  },
  slotOccupied: {
    fontSize: 9,
    color: '#dc2626',
    marginTop: 2,
  },
  notesInput: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    color: '#1f2937',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  notifyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  notifyInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  notifyTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2937',
  },
  notifySubtitle: {
    fontSize: 12,
    color: '#6b7280',
  },
  summaryCard: {
    backgroundColor: '#eef2ff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#c7d2fe',
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4338ca',
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
    textTransform: 'capitalize',
  },
  newBadge: {
    color: '#22c55e',
    fontWeight: '600',
  },
  syncInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#c7d2fe',
  },
  syncText: {
    fontSize: 12,
    color: '#22c55e',
    fontWeight: '500',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6366f1',
    borderRadius: 16,
    padding: 18,
    gap: 10,
  },
  submitButtonDisabled: {
    backgroundColor: '#c7d2fe',
  },
  submitButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
  },
  modalSearch: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    margin: 16,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  modalSearchInput: {
    flex: 1,
    paddingVertical: 12,
    marginLeft: 10,
    fontSize: 15,
    color: '#1f2937',
  },
  clientList: {
    paddingHorizontal: 16,
  },
  clientItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
  },
  clientAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  clientAvatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  clientItemInfo: {
    flex: 1,
  },
  clientItemName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2937',
  },
  clientItemEmail: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  emptyClients: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyClientsText: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 12,
    marginBottom: 16,
  },
  createClientButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eef2ff',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  createClientButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6366f1',
  },
  loadingContainer: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#6b7280',
  },
});

export default ScheduleAppointment;
