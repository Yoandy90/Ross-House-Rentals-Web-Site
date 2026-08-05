import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../../constants/colors';
import CustomHeader from '../../components/CustomHeader';
import CustomPicker from '../../components/CustomPicker';
import api from '../../services/api';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, isSameDay, isToday, isSameMonth } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import { useAuth } from '../../contexts/AuthContext';
import { useReferral } from '../../contexts/ReferralContext';
import { useTranslation } from 'react-i18next';

interface TimeSlot {
  time: string;
  datetime: string;
  available: boolean;
}

export default function BookAppointmentScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const { t, i18n } = useTranslation();
  const dateLocale = i18n.language === 'es' ? es : enUS;
  const styles = createStyles(colors);
  const { user } = useAuth();
  const { referralCode: savedReferralCode, referrerName } = useReferral();

  const [appointmentType, setAppointmentType] = useState<'in_person' | 'video_call'>('in_person');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [validatingReferral, setValidatingReferral] = useState(false);
  const [referralValid, setReferralValid] = useState<boolean | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [booking, setBooking] = useState(false);
  const [duration, setDuration] = useState(30);
  const [quantity, setQuantity] = useState(1);
  const [services, setServices] = useState<{id: string; name: string; duration_minutes: number}[]>([]);
  const [selectedService, setSelectedService] = useState<{id: string; name: string; duration_minutes: number} | null>(null);
  const [loadingServices, setLoadingServices] = useState(true);
  const [officeStatus, setOfficeStatus] = useState<{
    is_open: boolean;
    reason: string;
    hours?: { open: string; close: string };
  } | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);

  // Contacts and attendees state - Initialize with user's data
  const [savedContacts, setSavedContacts] = useState<any[]>([]);
  const [attendees, setAttendees] = useState<any[]>([
    { 
      name: user?.name || user?.full_name || '', 
      phone: user?.phone || '', 
      email: user?.email || '', 
      user_contact_id: null, 
      is_primary_user: true 
    }
  ]);

  const appointmentTypes = [
    {
      value: 'in_person',
      label: t('bookAppointment.inPerson'),
      description: t('bookAppointment.visitOffice', 'Visita nuestra oficina'),
      icon: 'business',
      duration: 60,
    },
    {
      value: 'video_call',
      label: t('bookAppointment.videoCall'),
      description: t('bookAppointment.virtualMeeting', 'Reunión virtual por internet'),
      icon: 'videocam',
      duration: 60,
    },
  ];

  // Predefined appointment types
  const predefinedTypes = [
    { title: t('bookAppointment.initialConsult', 'Consulta Inicial'), icon: 'person', duration: 60 },
    { title: t('bookAppointment.taxPrep', 'Preparación de Impuestos'), icon: 'document-text', duration: 90 },
    { title: t('bookAppointment.docReview', 'Revisión de Documentos'), icon: 'layers', duration: 45 },
    { title: t('bookAppointment.followUp', 'Seguimiento'), icon: 'refresh', duration: 30 },
    { title: t('bookAppointment.other', 'Otro'), icon: 'ellipsis-horizontal', duration: 60 },
  ];

  // Generate calendar days
  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { locale: es });
    const end = endOfWeek(endOfMonth(currentMonth), { locale: es });
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  // Load time slots when date is selected
  useEffect(() => {
    if (selectedDate && user) {
      loadTimeSlots(selectedDate);
    }
  }, [selectedDate, user]);

  // Load office status on mount (only if user is authenticated)
  useEffect(() => {
    if (user) {
      loadOfficeStatus();
      loadServices();
    }
  }, [user]);

  // Load services from Square
  const loadServices = async () => {
    try {
      setLoadingServices(true);
      const response = await api.get('/services/available');
      const svcList = response.data?.services || [];
      setServices(svcList);
      if (svcList.length > 0) {
        setSelectedService(svcList[0]);
        setDuration(svcList[0].duration_minutes);
      }
    } catch (error) {
      console.error('Error loading services:', error);
      // Fallback
      const fallback = [{ id: 'default', name: t('bookAppointment.taxConsult', 'Consulta de Impuestos'), duration_minutes: 30 }];
      setServices(fallback);
      setSelectedService(fallback[0]);
    } finally {
      setLoadingServices(false);
    }
  };

  // Pre-fill referral code if it came from a deep link
  useEffect(() => {
    if (savedReferralCode && !referralCode) {
      setReferralCode(savedReferralCode);
      setReferralValid(true);
    }
  }, [savedReferralCode]);

  const loadOfficeStatus = async () => {
    try {
      setLoadingStatus(true);
      const response = await api.get('/office-hours/status');
      setOfficeStatus(response.data);
    } catch (error) {
      console.error('Error loading office status:', error);
    } finally {
      setLoadingStatus(false);
    }
  };

  const validateReferralCode = async (code: string) => {
    if (!code || code.length < 3) {
      setReferralValid(null);
      return;
    }
    
    try {
      setValidatingReferral(true);
      const response = await api.get(`/referrals/validate/${code}`);
      setReferralValid(response.data.valid);
      if (response.data.valid) {
        Alert.alert('✅ Código Válido', `Código de ${response.data.referrer_name || 'referido'} aplicado. ¡Recibirás un descuento!`);
      }
    } catch (error) {
      setReferralValid(false);
    } finally {
      setValidatingReferral(false);
    }
  };

  const loadTimeSlots = async (date: Date) => {
    try {
      setLoadingSlots(true);
      const dateStr = format(date, 'yyyy-MM-dd');
      
      // Use the public available-slots endpoint which checks Square bookings
      const response = await api.get(`/public/available-slots?date=${dateStr}`);
      const slots = (response.data || []).map((slot: any) => ({
        time: slot.time,
        datetime: slot.datetime || `${dateStr}T${slot.time}:00-06:00`,
        available: slot.available
      }));
      setTimeSlots(slots);
    } catch (error) {
      console.error('Error loading time slots:', error);
      Alert.alert(t('common.error', 'Error'), t('bookAppointment.loadSlotsError', 'No se pudieron cargar los horarios disponibles'));
      setTimeSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    setSelectedTime(null);
  };

  const handlePreviousMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
    setSelectedDate(null);
    setSelectedTime(null);
  };

  const handleNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
    setSelectedDate(null);
    setSelectedTime(null);
  };

  const bookAppointment = async () => {
    // Validar asistentes
    const validAttendees = attendees.filter(a => a.name.trim());
    if (validAttendees.length === 0) {
      Alert.alert(t('common.error', 'Error'), t('bookAppointment.addAtLeastOne', 'Debes agregar al menos una persona con nombre'));
      return;
    }

    // Validar que cada asistente tenga al menos teléfono o email
    for (const attendee of validAttendees) {
      if (!attendee.phone && !attendee.email) {
        Alert.alert('Error', `${attendee.name} necesita al menos teléfono o email`);
        return;
      }
    }

    if (!title.trim()) {
      Alert.alert(t('common.error', 'Error'), t('bookAppointment.selectReason', 'Por favor selecciona o ingresa un motivo para la cita'));
      return;
    }

    if (!selectedDate || !selectedTime) {
      Alert.alert(t('common.error', 'Error'), t('bookAppointment.selectDateAndTime', 'Por favor selecciona una fecha y hora'));
      return;
    }

    try {
      setBooking(true);

      const selectedSlot = timeSlots.find((s) => s.time === selectedTime);
      if (!selectedSlot) {
        throw new Error(t('bookAppointment.invalidTime', 'Horario no válido'));
      }

      // Format datetime for Square (ISO format with timezone)
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const baseStartAt = selectedSlot.datetime || `${dateStr}T${selectedTime}:00-06:00`;
      
      // Create appointments for each person (consecutive slots)
      const createdAppointments = [];
      
      for (let i = 0; i < quantity; i++) {
        // Calculate start time for this slot by adding duration minutes
        // Parse the base time and add minutes manually to preserve timezone
        let startAt: string;
        
        if (i === 0) {
          // First slot uses the original time
          startAt = baseStartAt;
        } else {
          // Parse the original time and add minutes
          const [timePart] = selectedTime.split(':');
          const baseHour = parseInt(timePart);
          const baseMinute = parseInt(selectedTime.split(':')[1] || '0');
          
          // Add duration * i minutes
          const totalMinutes = baseMinute + (duration * i);
          const newHour = baseHour + Math.floor(totalMinutes / 60);
          const newMinute = totalMinutes % 60;
          
          // Format with leading zeros
          const hourStr = newHour.toString().padStart(2, '0');
          const minuteStr = newMinute.toString().padStart(2, '0');
          
          startAt = `${dateStr}T${hourStr}:${minuteStr}:00-06:00`;
        }
        
        
        // Get attendee info for this slot (use first attendee info if not enough attendees)
        const attendeeIndex = Math.min(i, validAttendees.length - 1);
        const currentAttendee = validAttendees[attendeeIndex];

        // Create appointment in local database (Square dependency removed)
        const appointmentData = {
          title: quantity > 1 ? `${title.trim()} (${i + 1}/${quantity})` : title.trim(),
          description: quantity > 1 
            ? `${description.trim() || ''} - ${currentAttendee?.name || 'Persona ' + (i + 1)}`
            : (description.trim() || null),
          scheduled_at: startAt,
          duration_minutes: duration,
          appointment_type: appointmentType,
          status: 'scheduled',
          referral_code: referralCode.trim() || null,
          source: 'app',
          group_booking_id: quantity > 1 ? `group_${Date.now()}` : null,
          person_index: quantity > 1 ? i + 1 : null,
          total_persons: quantity > 1 ? quantity : null,
          user_name: currentAttendee?.name || user?.name || user?.full_name,
          user_email: currentAttendee?.email || user?.email,
          user_phone: currentAttendee?.phone || user?.phone
        };

        const response = await api.post('/appointments', appointmentData);
        createdAppointments.push(response.data);
      }
      
      // Build success message
      let message = '';
      if (quantity > 1) {
        message = `Se han agendado ${quantity} citas consecutivas para el ${format(selectedDate, 'PPPP', { locale: es })} comenzando a las ${selectedTime}.`;
      } else if (appointmentType === 'video_call') {
        message = `Tu videollamada ha sido agendada para el ${format(selectedDate, 'PPPP', { locale: es })} a las ${selectedTime}.`;
        if (createdAppointments[0]?.meeting_link) {
          message += `\n\nLink de videollamada: ${createdAppointments[0].meeting_link}`;
        }
      } else {
        message = `Tu cita presencial ha sido agendada para el ${format(selectedDate, 'PPPP', { locale: es })} a las ${selectedTime}.`;
      }
      
      message += '\n\n✅ Reservado exitosamente';

      Alert.alert(
        quantity > 1 ? `✅ ¡${quantity} Citas Agendadas!` : '✅ ¡Cita Agendada!',
        message,
        [
          {
            text: t('bookAppointment.viewAppointments', 'Ver Mis Citas'),
            onPress: () => router.replace('/appointments'),
          },
          {
            text: 'OK',
            style: 'default',
            onPress: () => router.replace('/appointments'),
          },
        ]
      );
      
      // Refresh time slots to update availability immediately
      if (selectedDate) {
        loadTimeSlots(selectedDate);
      }
    } catch (error: any) {
      // Refresh slots in case of conflict (slot was taken by someone else)
      if (selectedDate) {
        loadTimeSlots(selectedDate);
      }
      Alert.alert(
        'Error',
        error.response?.data?.detail || t('bookAppointment.bookingError', 'No se pudo agendar la cita. Por favor intenta de nuevo.')
      );
    } finally {
      setBooking(false);
    }
  };

  const isPastDay = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  };

  // Funciones de manejo de asistentes (igual que admin)
  const loadSavedContacts = async () => {
    try {
      const response = await api.get('/contacts');
      setSavedContacts(response.data.contacts || []);
    } catch (error) {
      console.error('Error loading contacts:', error);
    }
  };

  const addAttendee = () => {
    if (attendees.length < 10) {
      setAttendees([...attendees, { name: '', phone: '', email: '', user_contact_id: null, is_primary_user: false }]);
    }
  };

  const removeAttendee = (index: number) => {
    if (attendees.length > 1) {
      const newAttendees = attendees.filter((_, i) => i !== index);
      setAttendees(newAttendees);
    }
  };

  const updateAttendee = (index: number, field: string, value: any) => {
    const newAttendees = [...attendees];
    newAttendees[index] = { ...newAttendees[index], [field]: value };
    setAttendees(newAttendees);
  };

  const selectContact = (index: number, contact: any) => {
    const newAttendees = [...attendees];
    newAttendees[index] = {
      name: contact.name,
      phone: contact.phone || '',
      email: contact.email || '',
      user_contact_id: contact.id,
      is_primary_user: false
    };
    setAttendees(newAttendees);
  };

  // Cargar contactos al montar
  useEffect(() => {
    loadSavedContacts();
  }, []);

  return (
    <View style={styles.container}>
      <CustomHeader
        title={t('bookAppointment.title')}
        showBackButton={true}
        onBackPress={() => router.back()}
      />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Office Status Indicator */}
        {officeStatus && (
          <View style={[
            styles.officeStatusBanner,
            { backgroundColor: officeStatus.is_open ? '#10B981' : '#EF4444' }
          ]}>
            <Ionicons 
              name={officeStatus.is_open ? 'checkmark-circle' : 'close-circle'} 
              size={20} 
              color="#FFF" 
            />
            <Text style={styles.officeStatusText}>
              {officeStatus.is_open 
                ? `Oficina Abierta${officeStatus.hours ? ` • ${officeStatus.hours.open} - ${officeStatus.hours.close}` : ''}`
                : `Oficina Cerrada • ${officeStatus.reason || t('bookAppointment.afterHours', 'Fuera de horario')}`
              }
            </Text>
          </View>
        )}

        {/* Appointment Type Selector */}
        <Text style={styles.sectionTitle}>Tipo de Cita *</Text>
        <View style={styles.typeContainer}>
          {appointmentTypes.map((type) => (
            <TouchableOpacity
              key={type.value}
              style={[
                styles.typeCard,
                appointmentType === type.value && styles.typeCardActive,
              ]}
              onPress={() => setAppointmentType(type.value as 'in_person' | 'video_call')}
              activeOpacity={0.7}
            >
              <View style={styles.typeHeader}>
                <Ionicons
                  name={type.icon as any}
                  size={32}
                  color={appointmentType === type.value ? colors.primary : colors.textSecondary}
                />
                {appointmentType === type.value && (
                  <View style={styles.checkBadge}>
                    <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
                  </View>
                )}
              </View>
              <Text style={[styles.typeLabel, appointmentType === type.value && styles.typeLabelActive]}>
                {type.label}
              </Text>
              <Text style={styles.typeDescription}>{type.description}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {appointmentType === 'video_call' && (
          <View style={styles.infoBox}>
            <Ionicons name="information-circle" size={20} color="#FFFFFF" />
            <Text style={styles.infoText}>
              Recibirás un enlace de videollamada por notificación. No necesitas descargar ninguna aplicación.
            </Text>
          </View>
        )}

        {/* Motivo de la Cita - Square Services */}
        {loadingServices ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.loadingText}>Cargando servicios...</Text>
          </View>
        ) : (
          <CustomPicker
            label={t('bookAppointment.serviceType', 'Tipo de Servicio')}
            value={selectedService?.id || ''}
            onValueChange={(value) => {
              const svc = services.find(s => s.id === value);
              if (svc) {
                setSelectedService(svc);
                setTitle(svc.name);
                setDuration(svc.duration_minutes);
              }
            }}
            options={services.map((svc) => ({
              label: `${svc.name} (${svc.duration_minutes} min)`,
              value: svc.id,
            }))}
            placeholder="Selecciona el tipo de servicio..."
            icon="calendar"
            required={true}
            searchable={false}
          />
        )}

        {/* Custom title if "Otro" is selected */}
        {title === 'Otro' && (
          <TextInput
            style={styles.input}
            placeholder="Describe el motivo de tu cita..."
            placeholderTextColor={colors.textSecondary}
            value={description}
            onChangeText={(text) => {
              setDescription(text);
              if (text.trim()) setTitle(text.trim());
            }}
          />
        )}

        {/* Duration Display (Informativa) */}
        {title && (
          <View style={styles.durationInfoContainer}>
            <View style={styles.durationInfoHeader}>
              <Ionicons name="time-outline" size={24} color={colors.primary} />
              <Text style={styles.durationInfoTitle}>Duración de la Cita</Text>
            </View>
            <View style={styles.durationInfoCard}>
              <Text style={styles.durationInfoValue}>{duration} minutos</Text>
              <Text style={styles.durationInfoSubtitle}>
                Asignado automáticamente por el administrador según el tipo de servicio
              </Text>
            </View>
          </View>
        )}

        {/* Quantity Selector */}
        <Text style={styles.sectionTitle}>Cantidad de Citas</Text>
        <Text style={styles.hint}>¿Necesitas agendar para varios miembros de tu familia o grupo?</Text>
        <View style={styles.quantityContainer}>
          <TouchableOpacity
            style={styles.quantityButton}
            onPress={() => setQuantity(Math.max(1, quantity - 1))}
            disabled={quantity <= 1}
          >
            <Ionicons name="remove" size={24} color={quantity <= 1 ? colors.textGray : colors.primary} />
          </TouchableOpacity>
          <View style={styles.quantityDisplay}>
            <Text style={styles.quantityNumber}>{quantity}</Text>
            <Text style={styles.quantityLabel}>
              {quantity === 1 ? 'persona' : 'personas'}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.quantityButton}
            onPress={() => setQuantity(Math.min(10, quantity + 1))}
            disabled={quantity >= 10}
          >
            <Ionicons name="add" size={24} color={quantity >= 10 ? colors.textGray : colors.primary} />
          </TouchableOpacity>
        </View>
        {quantity > 1 && (
          <View style={styles.infoBox}>
            <Ionicons name="information-circle" size={18} color="#FFFFFF" />
            <Text style={styles.infoText}>
              Se crearán {quantity} citas consecutivas de {duration} minutos cada una
            </Text>
          </View>
        )}

        {/* Description */}
        {title && title !== 'Otro' && (
          <>
            <Text style={styles.sectionTitle}>Notas Adicionales (Opcional)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Detalles adicionales sobre tu cita..."
              placeholderTextColor={colors.textSecondary}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
            />
            
            {/* Referral Code Section */}
            <Text style={styles.sectionTitle}>Código de Referido (Opcional)</Text>
            <View style={styles.referralContainer}>
              <TextInput
                style={[styles.input, styles.referralInput, referralValid === true && styles.inputValid, referralValid === false && styles.inputInvalid]}
                placeholder="Ej: ABC-12345"
                placeholderTextColor={colors.textSecondary}
                value={referralCode}
                onChangeText={(text) => {
                  setReferralCode(text.toUpperCase());
                  setReferralValid(null);
                }}
                autoCapitalize="characters"
                maxLength={12}
              />
              <TouchableOpacity 
                style={[styles.validateButton, validatingReferral && styles.validateButtonDisabled]}
                onPress={() => validateReferralCode(referralCode)}
                disabled={validatingReferral || !referralCode.trim()}
              >
                {validatingReferral ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.validateButtonText}>{t('bookAppointment.validate', 'Validar')}</Text>
                )}
              </TouchableOpacity>
            </View>
            {referralValid === true && (
              <Text style={styles.referralSuccess}>✅ Código válido - ¡Recibirás un descuento!</Text>
            )}
            {referralValid === false && (
              <Text style={styles.referralError}>❌ Código no válido</Text>
            )}
          </>
        )}

        {/* Calendar */}
        <Text style={styles.sectionTitle}>{t('bookAppointment.selectDate', 'Selecciona una Fecha')}</Text>
        <View style={styles.calendarContainer}>
          {/* Month Header */}
          <View style={styles.monthHeader}>
            <TouchableOpacity onPress={handlePreviousMonth} style={styles.monthButton}>
              <Ionicons name="chevron-back" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.monthText}>
              {format(currentMonth, 'MMMM yyyy', { locale: es })}
            </Text>
            <TouchableOpacity onPress={handleNextMonth} style={styles.monthButton}>
              <Ionicons name="chevron-forward" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          {/* Day Headers */}
          <View style={styles.weekDaysRow}>
            {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map((day) => (
              <Text key={day} style={styles.weekDayText}>
                {day}
              </Text>
            ))}
          </View>

          {/* Calendar Days */}
          <View style={styles.daysGrid}>
            {calendarDays.map((day, index) => {
              const isSelected = selectedDate && isSameDay(day, selectedDate);
              const isCurrentMonth = isSameMonth(day, currentMonth);
              const isPast = isPastDay(day);
              const isTodayDay = isToday(day);

              return (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.dayCell,
                    isSelected && styles.dayCellSelected,
                    isTodayDay && !isSelected && styles.dayCellToday,
                  ]}
                  onPress={() => !isPast && isCurrentMonth && handleDateSelect(day)}
                  disabled={isPast || !isCurrentMonth}
                >
                  <Text
                    style={[
                      styles.dayText,
                      !isCurrentMonth && styles.dayTextDisabled,
                      isPast && styles.dayTextPast,
                      isSelected && styles.dayTextSelected,
                      isTodayDay && !isSelected && styles.dayTextToday,
                    ]}
                  >
                    {format(day, 'd')}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Time Slots */}
        {selectedDate && (
          <>
            <Text style={styles.sectionTitle}>
              Horarios Disponibles - {format(selectedDate, 'EEEE, d\'de\'MMMM', { locale: es })}
            </Text>
            {loadingSlots ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            ) : (
              <View style={styles.timeSlotsContainer}>
                {timeSlots.length === 0 ? (
                  <Text style={styles.noSlotsText}>{t('bookAppointment.noSlotsAvailable')}</Text>
                ) : (
                  timeSlots.map((slot) => (
                    <TouchableOpacity
                      key={slot.time}
                      style={[
                        styles.timeSlot,
                        !slot.available && styles.timeSlotDisabled,
                        selectedTime === slot.time && styles.timeSlotSelected,
                      ]}
                      onPress={() => slot.available && setSelectedTime(slot.time)}
                      disabled={!slot.available}
                    >
                      <Ionicons
                        name="time-outline"
                        size={18}
                        color={
                          selectedTime === slot.time
                            ? colors.textWhite
                            : slot.available
                            ? colors.primary
                            : colors.textSecondary
                        }
                      />
                      <Text
                        style={[
                          styles.timeSlotText,
                          !slot.available && styles.timeSlotTextDisabled,
                          selectedTime === slot.time && styles.timeSlotTextSelected,
                        ]}
                      >
                        {slot.time}
                      </Text>
                      {!slot.available && (
                        <Ionicons name="close-circle" size={16} color={colors.textSecondary} />
                      )}
                    </TouchableOpacity>
                  ))
                )}
              </View>
            )}
          </>
        )}

        {/* Book Button */}
        {selectedDate && selectedTime && (
          <TouchableOpacity
            style={styles.bookButton}
            onPress={bookAppointment}
            disabled={booking}
          >
            {booking ? (
              <ActivityIndicator color={colors.textWhite} />
            ) : (
              <>
                <Ionicons
                  name={appointmentType === 'video_call' ? 'videocam' : 'calendar'}
                  size={20}
                  color={colors.textWhite}
                />
                <Text style={styles.bookButtonText}>{t('bookAppointment.title')}</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        <Text style={styles.note}>
          * Campos requeridos. Recibirás una notificación confirmando tu cita.
        </Text>
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      padding: 16,
      paddingBottom: 100,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
      marginTop: 24,
      marginBottom: 12,
    },
    typeContainer: {
      flexDirection: 'row',
      gap: 12,
    },
    typeCard: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 20,
      borderWidth: 2,
      borderColor: colors.border,
      alignItems: 'center',
    },
    typeCardActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primary + '10',
    },
    typeHeader: {
      position: 'relative',
      width: '100%',
      alignItems: 'center',
      marginBottom: 12,
    },
    checkBadge: {
      position: 'absolute',
      top: -8,
      right: -8,
    },
    typeLabel: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 4,
      textAlign: 'center',
    },
    typeLabelActive: {
      color: colors.primary,
    },
    typeDescription: {
      fontSize: 12,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    infoBox: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      backgroundColor: colors.primary,
      padding: 16,
      borderRadius: 12,
      marginTop: 12,
    },
    infoText: {
      flex: 1,
      fontSize: 13,
      color: '#FFFFFF',
      lineHeight: 18,
    },
    predefinedContainer: {
      gap: 10,
    },
    officeStatusBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      padding: 12,
      borderRadius: 10,
      marginBottom: 16,
    },
    officeStatusText: {
      color: '#FFF',
      fontSize: 14,
      fontWeight: '600',
      flex: 1,
    },
    predefinedButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: colors.card,
      padding: 16,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: colors.border,
    },
    predefinedButtonActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primary + '10',
    },
    predefinedButtonText: {
      flex: 1,
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
    },
    predefinedButtonTextActive: {
      color: colors.primary,
    },
    durationText: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    input: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 16,
      fontSize: 16,
      color: colors.text,
    },
    inputValid: {
      borderColor: '#10B981',
      borderWidth: 2,
    },
    inputInvalid: {
      borderColor: '#EF4444',
      borderWidth: 2,
    },
    referralContainer: {
      flexDirection: 'row',
      gap: 12,
      alignItems: 'center',
    },
    referralInput: {
      flex: 1,
    },
    validateButton: {
      backgroundColor: colors.primary,
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderRadius: 12,
      minWidth: 90,
      alignItems: 'center',
    },
    validateButtonDisabled: {
      opacity: 0.6,
    },
    validateButtonText: {
      color: '#fff',
      fontWeight: '600',
      fontSize: 14,
    },
    referralSuccess: {
      color: '#10B981',
      fontSize: 14,
      marginTop: 8,
      fontWeight: '500',
    },
    referralError: {
      color: '#EF4444',
      fontSize: 14,
      marginTop: 8,
      fontWeight: '500',
    },
    textArea: {
      minHeight: 80,
      textAlignVertical: 'top',
    },
    calendarContainer: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    monthHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    monthButton: {
      padding: 8,
    },
    monthText: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
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
      color: colors.textSecondary,
    },
    daysGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
    },
    dayCell: {
      width: '14.28%',
      aspectRatio: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 4,
    },
    dayCellSelected: {
      backgroundColor: colors.primary,
      borderRadius: 8,
    },
    dayCellToday: {
      borderWidth: 2,
      borderColor: colors.primary,
      borderRadius: 8,
    },
    dayText: {
      fontSize: 15,
      color: colors.text,
    },
    dayTextDisabled: {
      color: colors.textSecondary + '50',
    },
    dayTextPast: {
      color: colors.textSecondary,
      textDecorationLine: 'line-through',
    },
    dayTextSelected: {
      color: '#FFFFFF',
      fontWeight: '700',
    },
    dayTextToday: {
      color: colors.primary,
      fontWeight: '700',
    },
    timeSlotsContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    timeSlot: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: colors.primary,
      backgroundColor: colors.card,
      minWidth: 100,
    },
    timeSlotSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    timeSlotDisabled: {
      borderColor: colors.border,
      backgroundColor: colors.background,
      opacity: 0.5,
    },
    timeSlotText: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.primary,
    },
    timeSlotTextSelected: {
      color: colors.textWhite,
    },
    timeSlotTextDisabled: {
      color: colors.textSecondary,
    },
    loadingContainer: {
      padding: 40,
      alignItems: 'center',
    },
    noSlotsText: {
      textAlign: 'center',
      fontSize: 14,
      color: colors.textSecondary,
      padding: 20,
    },
    bookButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.primary,
      padding: 18,
      borderRadius: 12,
      marginTop: 32,
    },
    bookButtonText: {
      fontSize: 18,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    note: {
      fontSize: 12,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: 16,
      lineHeight: 18,
    },
    // Duration info styles (informativa)
    durationInfoContainer: {
      marginBottom: 20,
    },
    durationInfoHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 12,
    },
    durationInfoTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    durationInfoCard: {
      backgroundColor: colors.primary + '10',
      borderWidth: 2,
      borderColor: colors.primary + '30',
      borderRadius: 16,
      padding: 20,
      alignItems: 'center',
    },
    durationInfoValue: {
      fontSize: 32,
      fontWeight: '700',
      color: colors.primary,
      marginBottom: 8,
    },
    durationInfoSubtitle: {
      fontSize: 13,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 18,
    },
    // Quantity selector styles
    quantityContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 24,
      padding: 20,
      backgroundColor: colors.backgroundGray,
      borderRadius: 16,
      marginBottom: 12,
    },
    quantityButton: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.background,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: colors.border,
    },
    quantityDisplay: {
      alignItems: 'center',
      minWidth: 80,
    },
    quantityNumber: {
      fontSize: 40,
      fontWeight: '900',
      color: colors.primary,
    },
    quantityLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
      marginTop: 4,
    },
    infoBox: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      backgroundColor: colors.primaryLight || colors.backgroundGray,
      padding: 16,
      borderRadius: 12,
      marginBottom: 16,
      borderLeftWidth: 4,
      borderLeftColor: colors.primary,
    },
    infoText: {
      flex: 1,
      fontSize: 14,
      color: '#FFFFFF',
      lineHeight: 20,
      fontWeight: '500',
    },
    hint: {
      fontSize: 13,
      color: colors.textSecondary,
      marginBottom: 12,
      fontStyle: 'italic',
    },
  });
