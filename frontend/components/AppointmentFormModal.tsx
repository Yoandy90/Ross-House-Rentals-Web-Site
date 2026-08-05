import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Calendar } from 'react-native-calendars';
import { useThemeColors } from '../constants/colors';
import api from '../services/api';
import { useLocalSearchParams } from 'expo-router';

interface AppointmentFormModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  hasKycPriority: boolean;
  existingAppointment?: any;
  isReschedule?: boolean;
}

const APPOINTMENT_TYPES = [
  { id: 'initial', label: 'Consulta Inicial', icon: 'person-add', duration: 60 },
  { id: 'tax_prep', label: 'Preparación de Impuestos', icon: 'document-text', duration: 90 },
  { id: 'review', label: 'Revisión de Documentos', icon: 'checkmark-done', duration: 45 },
  { id: 'follow_up', label: 'Seguimiento', icon: 'refresh', duration: 30 },
  { id: 'other', label: 'Otro', icon: 'ellipsis-horizontal', duration: 60 },
];

export default function AppointmentFormModal({
  visible,
  onClose,
  onSuccess,
  hasKycPriority,
}: AppointmentFormModalProps) {
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const params = useLocalSearchParams();
  const [selectedType, setSelectedType] = useState('initial');
  const [selectedDate, setSelectedDate] = useState('');
  const [availableSlots, setAvailableSlots] = useState<any[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<any>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [referralDiscount, setReferralDiscount] = useState(0);

  const selectedAppointmentType = APPOINTMENT_TYPES.find(t => t.id === selectedType);

  // Check for referral code in URL params
  useEffect(() => {
    if (params.ref && typeof params.ref === 'string') {
      validateReferralCode(params.ref);
    }
  }, [params.ref]);

  const validateReferralCode = async (code: string) => {
    try {
      const response = await api.post('/referrals/validate', { code: code.toUpperCase() });
      if (response.data.valid) {
        setReferralCode(code.toUpperCase());
        setReferralDiscount(5); // $5 discount
        Alert.alert(
          '¡Código de Referido Válido! 🎉',
          `Has recibido $5 de descuento en tu primera declaración de impuestos.`
        );
      }
    } catch (error) {
      console.log('Referral code validation failed:', error);
    }
  };

  // Get date range for calendar (today to max_advance_days)
  const today = new Date();
  const maxDate = new Date();
  maxDate.setDate(today.getDate() + 60); // Default 60 days

  const minDateString = today.toISOString().split('T')[0];
  const maxDateString = maxDate.toISOString().split('T')[0];

  // Load available slots when date is selected
  useEffect(() => {
    if (selectedDate) {
      loadAvailableSlots();
    }
  }, [selectedDate]);

  const loadAvailableSlots = async () => {
    console.log('Loading slots for date:', selectedDate);
    setLoadingSlots(true);
    setSelectedSlot(null);
    try {
      const response = await api.get(`/availability/slots?date=${selectedDate}`);
      console.log('Slots response:', response.data);
      console.log('Number of slots:', response.data?.length);
      setAvailableSlots(response.data);
    } catch (error: any) {
      console.error('Error loading slots:', error);
      console.error('Error details:', error.response?.data);
      Alert.alert('Error', 'No se pudieron cargar los horarios disponibles');
      setAvailableSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleSubmit = async () => {
    console.log('🟢 handleSubmit called');
    console.log('Selected slot:', selectedSlot);
    console.log('Referral code:', referralCode);
    
    if (!selectedSlot) {
      alert('Error: Por favor selecciona una fecha y hora');
      return;
    }

    setLoading(true);
    try {
      // Use the datetime string directly from the slot to avoid timezone conversion
      const scheduledDateTime = selectedSlot.datetime;
      console.log('📅 Creating appointment for:', scheduledDateTime);
      console.log('📅 Selected slot time:', selectedSlot.time);
      console.log('📅 Selected date:', selectedDate);

      const appointmentData: any = {
        title: selectedAppointmentType?.label || 'Cita',
        description: description.trim() || undefined,
        scheduled_at: scheduledDateTime,
        duration_minutes: selectedAppointmentType?.duration || 60,
        status: 'scheduled',
      };

      // Add referral code if present
      if (referralCode) {
        appointmentData.referral_code = referralCode;
      }

      const response = await api.post('/appointments', appointmentData);

      console.log('✅ Appointment created:', response.data);
      
      // For display purposes, create a Date object
      const displayDate = new Date(scheduledDateTime);

      const message = `¡Cita Agendada!\n\nTu cita ha sido programada para el ${displayDate.toLocaleDateString('es-ES', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })} a las ${selectedSlot.time}${referralDiscount > 0 ? `\n\n🎉 ¡Descuento de $${referralDiscount} aplicado en tu declaración!` : ''}${!hasKycPriority ? '\n\nRecuerda: Completa tu verificación KYC para obtener prioridad en futuras citas.' : ''}`;
      
      alert(message);
      
      onSuccess();
      onClose();
      resetForm();
    } catch (error: any) {
      console.error('❌ Error creating appointment:', error);
      console.error('Error details:', error.response?.data);
      alert('Error: ' + (error.response?.data?.detail || 'No se pudo crear la cita. Por favor intenta nuevamente.'));
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedType('initial');
    setSelectedDate('');
    setAvailableSlots([]);
    setSelectedSlot(null);
    setDescription('');
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay} pointerEvents="box-none">
        <View style={styles.modalContainer} pointerEvents="auto">
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Agendar Cita</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          {/* Priority Badge */}
          {hasKycPriority && (
            <View style={styles.priorityBanner}>
              <Ionicons name="star" size={16} color={colors.warning} />
              <Text style={styles.priorityText}>Cliente con Prioridad KYC</Text>
            </View>
          )}

          {/* Referral Discount Badge */}
          {referralDiscount > 0 && (
            <View style={styles.referralBanner}>
              <Ionicons name="gift" size={16} color="#28A745" />
              <Text style={styles.referralText}>¡Descuento de ${referralDiscount} aplicado! 🎉</Text>
            </View>
          )}

          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
            {/* Appointment Type */}
            <Text style={styles.sectionLabel}>Tipo de Cita</Text>
            <View style={styles.typeGrid}>
              {APPOINTMENT_TYPES.map((type) => (
                <TouchableOpacity
                  key={type.id}
                  style={[
                    styles.typeCard,
                    selectedType === type.id && styles.typeCardSelected,
                  ]}
                  onPress={() => setSelectedType(type.id)}
                >
                  <Ionicons
                    name={type.icon as any}
                    size={24}
                    color={selectedType === type.id ? colors.primary : colors.textGray}
                  />
                  <Text
                    style={[
                      styles.typeLabel,
                      selectedType === type.id && styles.typeLabelSelected,
                    ]}
                  >
                    {type.label}
                  </Text>
                  <Text style={styles.typeDuration}>{type.duration} min</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Date Selection with Calendar */}
            <Text style={styles.sectionLabel}>Selecciona una Fecha</Text>
            <View style={styles.calendarContainer}>
              <Calendar
                minDate={minDateString}
                maxDate={maxDateString}
                onDayPress={(day) => {
                  setSelectedDate(day.dateString);
                }}
                markedDates={{
                  [selectedDate]: {
                    selected: true,
                    selectedColor: colors.primary,
                  },
                }}
                theme={{
                  backgroundColor: colors.background,
                  calendarBackground: colors.background,
                  textSectionTitleColor: colors.text,
                  selectedDayBackgroundColor: colors.primary,
                  selectedDayTextColor: colors.textWhite,
                  todayTextColor: colors.accent,
                  dayTextColor: colors.text,
                  textDisabledColor: colors.textLight,
                  monthTextColor: colors.text,
                  arrowColor: colors.primary,
                }}
              />
            </View>

            {/* Available Time Slots */}
            {selectedDate && (
              <>
                <Text style={styles.sectionLabel}>
                  Horarios Disponibles - {new Date(selectedDate).toLocaleDateString('es-ES', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                  })}
                </Text>

                {loadingSlots ? (
                  <View style={styles.loadingSlotsContainer}>
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text style={styles.loadingSlotsText}>Cargando horarios...</Text>
                  </View>
                ) : availableSlots.length === 0 ? (
                  <View style={styles.noSlotsContainer}>
                    <Ionicons name="calendar-outline" size={48} color={colors.textGray} />
                    <Text style={styles.noSlotsText}>No hay horarios disponibles para esta fecha</Text>
                    <Text style={styles.noSlotsSubtext}>Por favor selecciona otro día</Text>
                  </View>
                ) : (
                  <View style={styles.slotsGrid}>
                    {availableSlots.map((slot, index) => (
                      <TouchableOpacity
                        key={index}
                        style={[
                          styles.slotButton,
                          !slot.available && styles.slotButtonUnavailable,
                          selectedSlot?.time === slot.time && styles.slotButtonSelected,
                        ]}
                        onPress={() => slot.available && setSelectedSlot(slot)}
                        disabled={!slot.available}
                      >
                        <Ionicons
                          name="time"
                          size={16}
                          color={
                            !slot.available
                              ? colors.textLight
                              : selectedSlot?.time === slot.time
                              ? colors.textWhite
                              : colors.primary
                          }
                        />
                        <Text
                          style={[
                            styles.slotButtonText,
                            !slot.available && styles.slotButtonTextUnavailable,
                            selectedSlot?.time === slot.time && styles.slotButtonTextSelected,
                          ]}
                        >
                          {slot.time}
                        </Text>
                        {!slot.available && (
                          <Ionicons name="close-circle" size={14} color={colors.error} />
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </>
            )}

            {/* Description */}
            <Text style={styles.sectionLabel}>Detalles Adicionales (Opcional)</Text>
            <TextInput
              style={styles.descriptionInput}
              placeholder="Describe brevemente el motivo de tu cita..."
              placeholderTextColor={colors.textLight}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              maxLength={300}
            />
            <Text style={styles.charCount}>{description.length}/300</Text>
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onClose}
              disabled={loading}
            >
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.submitButton, 
                loading && styles.submitButtonDisabled
              ]}
              onPress={() => {
                console.log('🟢 AGENDAR CITA PRESSED');
                handleSubmit();
              }}
              disabled={loading}
              activeOpacity={0.7}
            >
              {loading ? (
                <ActivityIndicator size="small" color={colors.textWhite} />
              ) : (
                <>
                  <Ionicons name="checkmark" size={20} color={colors.textWhite} />
                  <Text style={styles.submitButtonText}>Agendar Cita</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  closeButton: {
    padding: 4,
  },
  priorityBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warning + '15',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.warning + '30',
  },
  priorityText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.warning,
  },
  referralBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#28A74530',
  },
  referralText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#28A745',
  },
  scrollView: {
    padding: 20,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
    marginTop: 8,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  typeCard: {
    width: '47%',
    backgroundColor: colors.backgroundGray,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  typeCardSelected: {
    backgroundColor: colors.primary + '10',
    borderColor: colors.primary,
  },
  typeLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textGray,
    marginTop: 8,
    textAlign: 'center',
  },
  typeLabelSelected: {
    color: colors.primary,
  },
  typeDuration: {
    fontSize: 11,
    color: colors.textLight,
    marginTop: 4,
  },
  calendarContainer: {
    backgroundColor: colors.background,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 20,
  },
  loadingSlotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  loadingSlotsText: {
    fontSize: 14,
    color: colors.textGray,
  },
  noSlotsContainer: {
    alignItems: 'center',
    padding: 32,
  },
  noSlotsText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginTop: 12,
    textAlign: 'center',
  },
  noSlotsSubtext: {
    fontSize: 13,
    color: colors.textGray,
    marginTop: 4,
    textAlign: 'center',
  },
  slotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  slotButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary + '10',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.primary + '30',
    gap: 6,
    minWidth: '30%',
    justifyContent: 'center',
  },
  slotButtonUnavailable: {
    backgroundColor: colors.backgroundGray,
    borderColor: colors.border,
    opacity: 0.5,
  },
  slotButtonSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  slotButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  slotButtonTextUnavailable: {
    color: colors.textLight,
  },
  slotButtonTextSelected: {
    color: colors.textWhite,
  },
  descriptionInput: {
    backgroundColor: colors.backgroundGray,
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    color: colors.text,
    minHeight: 100,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: colors.border,
  },
  charCount: {
    fontSize: 12,
    color: colors.textGray,
    textAlign: 'right',
    marginTop: 6,
    marginBottom: 16,
  },
  footer: {
    flexDirection: 'row',
    padding: 20,
    paddingTop: 12,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.backgroundGray,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  submitButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.primary,
    gap: 8,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textWhite,
  },
});