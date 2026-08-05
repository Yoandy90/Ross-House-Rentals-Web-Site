/**
 * Mi Reembolso - Appointment Scheduling Screen
 * Schedule a review call after completing the wizard
 * Now includes payment method selection step
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StatusBar,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../../services/api';
import { useTranslation } from 'react-i18next';

interface TimeSlot {
  datetime: string;
  date: string;
  time: string;
  day_name_es: string;
  formatted_es: string;
}

interface GroupedSlots {
  [date: string]: {
    dayName: string;
    slots: TimeSlot[];
  };
}

interface SavedCard {
  id: string;
  vault_id?: string;
  type: string;
  last4: string;
  last_4?: string;
  brand?: string;
  card_brand?: string;
  exp_month?: number;
  exp_year?: number;
  is_default?: boolean;
}

type BookingStep = 'datetime' | 'payment' | 'confirm';

export default function AppointmentScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  
  // Step state
  const [currentStep, setCurrentStep] = useState<BookingStep>('datetime');
  
  // Date/time state
  const [loading, setLoading] = useState(true);
  const [scheduling, setScheduling] = useState(false);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  
  // Payment state
  const [loadingCards, setLoadingCards] = useState(false);
  const [savedCards, setSavedCards] = useState<SavedCard[]>([]);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'saved_card' | 'pay_at_office' | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<string>('');
  
  // Success state
  const [success, setSuccess] = useState(false);
  const [appointmentDetails, setAppointmentDetails] = useState<any>(null);

  useEffect(() => {
    loadSlots();
  }, []);

  const loadSlots = async () => {
    try {
      const response = await api.get('/tax-wizard/appointments/available-slots', {
        params: { days_ahead: 14 }
      });
      
      if (response.data.success) {
        setSlots(response.data.slots || []);
        if (response.data.slots?.length > 0) {
          setSelectedDate(response.data.slots[0].date);
        }
      }
    } catch (error) {
      console.error('Error loading slots:', error);
      Alert.alert('Error', 'No se pudieron cargar los horarios disponibles');
    } finally {
      setLoading(false);
    }
  };

  const loadSavedCards = async () => {
    setLoadingCards(true);
    try {
      const response = await api.get('/payment-methods');
      const methods = response.data.payment_methods || response.data || [];
      const cards = methods
        .filter((m: any) => m.type === 'card' || (!m.type && m.last4))
        .map((m: any) => ({
          ...m,
          last4: m.last4 || m.last_4 || '****',
          brand: m.brand || m.card_brand || 'Card',
        }));
      setSavedCards(cards);
      
      // Auto-select default card if exists
      const defaultCard = cards.find((c: SavedCard) => c.is_default);
      if (defaultCard) {
        setSelectedPaymentMethod('saved_card');
        setSelectedCardId(defaultCard.vault_id || defaultCard.id);
      }
    } catch (error) {
      console.error('Error loading cards:', error);
      // Don't show error - just means no saved cards
    } finally {
      setLoadingCards(false);
    }
  };

  const goToPaymentStep = () => {
    if (!selectedSlot) return;
    setCurrentStep('payment');
    loadSavedCards();
  };

  const goBackToDateTime = () => {
    setCurrentStep('datetime');
    setSelectedPaymentMethod(null);
    setSelectedCardId('');
  };

  const handleSchedule = async () => {
    if (!selectedSlot || !sessionId) return;

    setScheduling(true);
    try {
      const payload: any = {
        appointment_datetime: selectedSlot.datetime,
        appointment_type: 'tax_review',
        notes: 'Revisión de declaración desde app móvil',
      };

      // Attach payment method if saved card selected
      if (selectedPaymentMethod === 'saved_card' && selectedCardId) {
        payload.payment_method_id = selectedCardId;
        payload.payment_preference = 'saved_card';
      } else {
        payload.payment_preference = 'pay_at_office';
      }

      const response = await api.post(`/tax-wizard/session/${sessionId}/appointment/schedule`, payload);

      if (response.data.success) {
        setSuccess(true);
        setAppointmentDetails({
          formatted: response.data.formatted,
          datetime: response.data.datetime,
          payment_method: selectedPaymentMethod,
        });
      } else {
        Alert.alert('Error', response.data.error || 'No se pudo agendar la cita');
      }
    } catch (error: any) {
      console.error('Error scheduling:', error);
      Alert.alert('Error', error.response?.data?.detail || 'No se pudo agendar la cita');
    } finally {
      setScheduling(false);
    }
  };

  const handleSkip = () => {
    router.replace('/(tabs)');
  };

  const handleContinue = () => {
    router.replace('/(tabs)');
  };

  const groupSlotsByDate = (slots: TimeSlot[]): GroupedSlots => {
    return slots.reduce((acc, slot) => {
      if (!acc[slot.date]) {
        acc[slot.date] = {
          dayName: slot.day_name_es,
          slots: []
        };
      }
      acc[slot.date].slots.push(slot);
      return acc;
    }, {} as GroupedSlots);
  };

  const getCardBrandIcon = (brand?: string): string => {
    const b = (brand || '').toLowerCase();
    if (b.includes('visa')) return '💳';
    if (b.includes('master')) return '💳';
    if (b.includes('amex')) return '💳';
    return '💳';
  };

  const getCardBrandColor = (brand?: string): string => {
    const b = (brand || '').toLowerCase();
    if (b.includes('visa')) return '#1A1F71';
    if (b.includes('master')) return '#EB001B';
    if (b.includes('amex')) return '#006FCF';
    return '#374151';
  };

  const groupedSlots = groupSlotsByDate(slots);
  const availableDates = Object.keys(groupedSlots);

  // ─── LOADING STATE ───────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#065F46" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#10B981" />
          <Text style={styles.loadingText}>Cargando horarios disponibles...</Text>
        </View>
      </View>
    );
  }

  // ─── SUCCESS STATE ───────────────────────────────────────────
  if (success) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#065F46" />
        <View style={styles.successContainer}>
          <View style={styles.successIcon}>
            <Ionicons name="calendar-outline" size={60} color="#10B981" />
          </View>
          <Text style={styles.successTitle}>¡Cita Agendada!</Text>
          <Text style={styles.successSubtitle}>Tu cita ha sido confirmada para:</Text>
          
          <View style={styles.appointmentCard}>
            <Text style={styles.appointmentDate}>
              {appointmentDetails?.formatted || selectedSlot?.formatted_es}
            </Text>
          </View>

          {/* Payment confirmation */}
          <View style={styles.paymentConfirmBadge}>
            {appointmentDetails?.payment_method === 'saved_card' ? (
              <>
                <Ionicons name="card-outline" size={18} color="#10B981" />
                <Text style={styles.paymentConfirmText}>
                  Se cobrará a tu tarjeta guardada al finalizar la cita
                </Text>
              </>
            ) : (
              <>
                <Ionicons name="cash-outline" size={18} color="#10B981" />
                <Text style={styles.paymentConfirmText}>
                  Pagarás en la oficina el día de tu cita
                </Text>
              </>
            )}
          </View>
          
          <Text style={styles.reminderText}>
            Recibirás un recordatorio por SMS y email antes de tu cita.
          </Text>
          
          <TouchableOpacity style={styles.continueButton} onPress={handleContinue}>
            <Text style={styles.continueButtonText}>Ir al Inicio</Text>
            <Ionicons name="arrow-forward" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ─── MAIN BOOKING FLOW ──────────────────────────────────────
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#065F46" />
      
      {/* Header */}
      <LinearGradient colors={['#065F46', '#10B981']} style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={currentStep === 'payment' ? goBackToDateTime : () => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>
              {currentStep === 'datetime' ? 'Agendar Cita' : 'Método de Pago'}
            </Text>
            <Text style={styles.headerSubtitle}>
              {currentStep === 'datetime' 
                ? 'Selecciona fecha y hora para tu revisión' 
                : 'Elige cómo deseas pagar tu servicio'}
            </Text>
          </View>
        </View>
        
        {/* Step indicator */}
        <View style={styles.stepIndicator}>
          <View style={[styles.stepDot, styles.stepDotActive]} />
          <View style={[styles.stepLine, currentStep !== 'datetime' && styles.stepLineActive]} />
          <View style={[styles.stepDot, currentStep !== 'datetime' && styles.stepDotActive]} />
        </View>
      </LinearGradient>

      {/* ─── STEP 1: DATE & TIME SELECTION ─── */}
      {currentStep === 'datetime' && (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Info Card */}
          <View style={styles.infoCard}>
            <Ionicons name="bulb-outline" size={24} color="#3B82F6" />
            <View style={styles.infoTextContainer}>
              <Text style={styles.infoTitle}>¿Por qué agendar una cita?</Text>
              <Text style={styles.infoText}>
                Un experto revisará tu declaración contigo, responderá tus preguntas 
                y te ayudará a maximizar tu reembolso.
              </Text>
            </View>
          </View>

          {/* Date Selection */}
          <Text style={styles.sectionTitle}>📅 Selecciona una Fecha</Text>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.dateScroll}
            contentContainerStyle={styles.dateScrollContent}
          >
            {availableDates.map((date) => {
              const isSelected = selectedDate === date;
              const dateObj = new Date(date + 'T12:00:00');
              const dayNum = dateObj.getDate();
              const monthShort = dateObj.toLocaleDateString('es', { month: 'short' });
              
              return (
                <TouchableOpacity
                  key={date}
                  onPress={() => {
                    setSelectedDate(date);
                    setSelectedSlot(null);
                  }}
                  style={[styles.dateCard, isSelected && styles.dateCardSelected]}
                >
                  <Text style={[styles.dateDayName, isSelected && styles.dateTextSelected]}>
                    {groupedSlots[date].dayName}
                  </Text>
                  <Text style={[styles.dateDayNum, isSelected && styles.dateTextSelected]}>
                    {dayNum}
                  </Text>
                  <Text style={[styles.dateMonth, isSelected && styles.dateTextSelected]}>
                    {monthShort}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Time Selection */}
          {selectedDate && (
            <>
              <Text style={styles.sectionTitle}>⏰ Selecciona un Horario</Text>
              <View style={styles.timeGrid}>
                {groupedSlots[selectedDate]?.slots.map((slot) => {
                  const isSelected = selectedSlot?.datetime === slot.datetime;
                  return (
                    <TouchableOpacity
                      key={slot.datetime}
                      onPress={() => setSelectedSlot(slot)}
                      style={[styles.timeSlot, isSelected && styles.timeSlotSelected]}
                    >
                      <Text style={[styles.timeText, isSelected && styles.timeTextSelected]}>
                        {slot.time}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}

          {/* Selected Summary */}
          {selectedSlot && (
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Cita seleccionada:</Text>
              <Text style={styles.summaryValue}>{selectedSlot.formatted_es}</Text>
            </View>
          )}

          {/* Next: Go to Payment Step */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.confirmButton, !selectedSlot && styles.buttonDisabled]}
              onPress={goToPaymentStep}
              disabled={!selectedSlot}
            >
              <Ionicons name="card-outline" size={20} color="#fff" />
              <Text style={styles.confirmButtonText}>Siguiente: Método de Pago</Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" style={{ marginLeft: 4 }} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
              <Text style={styles.skipButtonText}>Saltar por ahora</Text>
            </TouchableOpacity>
          </View>

          {/* Contact Info */}
          <View style={styles.contactInfo}>
            <Text style={styles.contactText}>
              📞 ¿Prefieres llamarnos?{' '}
              <Text style={styles.phoneNumber}>806-934-2018</Text>
            </Text>
            <Text style={styles.hoursText}>
              Todos los días 10am - 2pm
            </Text>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* ─── STEP 2: PAYMENT METHOD SELECTION ─── */}
      {currentStep === 'payment' && (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Summary of selected slot */}
          <View style={styles.paymentSummaryBanner}>
            <Ionicons name="calendar" size={20} color="#10B981" />
            <Text style={styles.paymentSummaryText}>
              {selectedSlot?.formatted_es}
            </Text>
          </View>

          <Text style={styles.sectionTitle}>💳 Método de Pago</Text>
          <Text style={styles.paymentDescription}>
            Al vincular un método de pago, podremos cobrar automáticamente al finalizar tu cita. 
            Esto agiliza el proceso y evita esperas.
          </Text>

          {loadingCards ? (
            <View style={styles.cardsLoading}>
              <ActivityIndicator size="small" color="#10B981" />
              <Text style={styles.cardsLoadingText}>Cargando métodos guardados...</Text>
            </View>
          ) : (
            <View style={styles.paymentOptions}>
              {/* Saved Cards */}
              {savedCards.length > 0 && (
                <>
                  <Text style={styles.paymentGroupTitle}>Tarjetas Guardadas</Text>
                  {savedCards.map((card) => {
                    const isSelected = selectedPaymentMethod === 'saved_card' && selectedCardId === (card.vault_id || card.id);
                    return (
                      <TouchableOpacity
                        key={card.id}
                        onPress={() => {
                          setSelectedPaymentMethod('saved_card');
                          setSelectedCardId(card.vault_id || card.id);
                        }}
                        style={[styles.paymentOption, isSelected && styles.paymentOptionSelected]}
                      >
                        <View style={[styles.cardBrandBadge, { backgroundColor: getCardBrandColor(card.brand) }]}>
                          <Text style={styles.cardBrandText}>
                            {(card.brand || 'CARD').toUpperCase().slice(0, 4)}
                          </Text>
                        </View>
                        <View style={styles.paymentOptionInfo}>
                          <Text style={[styles.paymentOptionTitle, isSelected && styles.paymentOptionTitleSelected]}>
                            •••• •••• •••• {card.last4}
                          </Text>
                          <Text style={styles.paymentOptionDesc}>
                            {card.brand || 'Tarjeta'} {card.exp_month && card.exp_year ? `• Exp ${card.exp_month}/${card.exp_year}` : ''}
                          </Text>
                        </View>
                        {isSelected && (
                          <View style={styles.checkCircle}>
                            <Ionicons name="checkmark" size={16} color="#fff" />
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </>
              )}

              {/* Pay at Office */}
              <Text style={[styles.paymentGroupTitle, savedCards.length > 0 && { marginTop: 20 }]}>
                Otros Métodos
              </Text>
              
              <TouchableOpacity
                onPress={() => {
                  setSelectedPaymentMethod('pay_at_office');
                  setSelectedCardId('');
                }}
                style={[
                  styles.paymentOption,
                  selectedPaymentMethod === 'pay_at_office' && styles.paymentOptionSelected
                ]}
              >
                <View style={[styles.cardBrandBadge, { backgroundColor: '#059669' }]}>
                  <Ionicons name="cash-outline" size={20} color="#fff" />
                </View>
                <View style={styles.paymentOptionInfo}>
                  <Text style={[
                    styles.paymentOptionTitle,
                    selectedPaymentMethod === 'pay_at_office' && styles.paymentOptionTitleSelected
                  ]}>
                    Pagar en la Oficina
                  </Text>
                  <Text style={styles.paymentOptionDesc}>
                    Efectivo, tarjeta o procesador Clover al llegar
                  </Text>
                </View>
                {selectedPaymentMethod === 'pay_at_office' && (
                  <View style={styles.checkCircle}>
                    <Ionicons name="checkmark" size={16} color="#fff" />
                  </View>
                )}
              </TouchableOpacity>

              {/* Add new card link */}
              <TouchableOpacity
                onPress={() => router.push('/(tabs)/payment-methods')}
                style={styles.addCardLink}
              >
                <Ionicons name="add-circle-outline" size={20} color="#10B981" />
                <Text style={styles.addCardText}>Agregar nueva tarjeta</Text>
              </TouchableOpacity>

              {/* Info about saved card */}
              {selectedPaymentMethod === 'saved_card' && (
                <View style={styles.paymentInfoCard}>
                  <Ionicons name="shield-checkmark-outline" size={20} color="#3B82F6" />
                  <Text style={styles.paymentInfoText}>
                    Tu tarjeta solo se cobrará cuando el preparador de impuestos confirme que tu servicio está completo. 
                    Tus datos están protegidos.
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Confirm Button */}
          <View style={[styles.actions, { marginTop: 24 }]}>
            <TouchableOpacity
              style={[styles.confirmButton, (!selectedPaymentMethod) && styles.buttonDisabled]}
              onPress={handleSchedule}
              disabled={!selectedPaymentMethod || scheduling}
            >
              {scheduling ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={20} color="#fff" />
                  <Text style={styles.confirmButtonText}>Confirmar Cita</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.skipButton} onPress={goBackToDateTime}>
              <Ionicons name="arrow-back" size={16} color="#6B7280" />
              <Text style={[styles.skipButtonText, { marginLeft: 4 }]}>Volver a seleccionar horario</Text>
            </TouchableOpacity>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 50 : 40,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    padding: 8,
    marginRight: 12,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#D1FAE5',
    marginTop: 4,
  },
  // Step indicator
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  stepDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  stepDotActive: {
    backgroundColor: '#fff',
  },
  stepLine: {
    width: 60,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginHorizontal: 8,
  },
  stepLineActive: {
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  infoTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E40AF',
    marginBottom: 4,
  },
  infoText: {
    fontSize: 14,
    color: '#3B82F6',
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
  },
  dateScroll: {
    marginBottom: 24,
  },
  dateScrollContent: {
    paddingRight: 20,
  },
  dateCard: {
    width: 70,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    marginRight: 12,
    alignItems: 'center',
  },
  dateCardSelected: {
    backgroundColor: '#ECFDF5',
    borderColor: '#10B981',
  },
  dateDayName: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
    marginBottom: 4,
  },
  dateDayNum: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  dateMonth: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  dateTextSelected: {
    color: '#065F46',
  },
  timeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 24,
  },
  timeSlot: {
    width: '30%',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    marginRight: '3.33%',
    marginBottom: 12,
    alignItems: 'center',
  },
  timeSlotSelected: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  timeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  timeTextSelected: {
    color: '#fff',
  },
  summaryCard: {
    backgroundColor: '#ECFDF5',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    marginBottom: 24,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#065F46',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#065F46',
  },
  actions: {
    marginBottom: 24,
  },
  confirmButton: {
    flexDirection: 'row',
    backgroundColor: '#10B981',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
  },
  skipButton: {
    paddingVertical: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  skipButtonText: {
    color: '#6B7280',
    fontSize: 16,
  },
  contactInfo: {
    alignItems: 'center',
  },
  contactText: {
    fontSize: 14,
    color: '#6B7280',
  },
  phoneNumber: {
    color: '#10B981',
    fontWeight: '600',
  },
  hoursText: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
  },
  // ─── PAYMENT STEP STYLES ─────────────────────────────────
  paymentSummaryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  paymentSummaryText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#065F46',
    marginLeft: 10,
  },
  paymentDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 20,
  },
  cardsLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
  },
  cardsLoadingText: {
    marginLeft: 10,
    color: '#6B7280',
    fontSize: 14,
  },
  paymentOptions: {},
  paymentGroupTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
  },
  paymentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  paymentOptionSelected: {
    borderColor: '#10B981',
    backgroundColor: '#F0FDF4',
  },
  cardBrandBadge: {
    width: 44,
    height: 30,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  cardBrandText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  paymentOptionInfo: {
    flex: 1,
  },
  paymentOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  paymentOptionTitleSelected: {
    color: '#065F46',
  },
  paymentOptionDesc: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 2,
  },
  checkCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addCardLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    marginTop: 6,
  },
  addCardText: {
    fontSize: 15,
    color: '#10B981',
    fontWeight: '600',
    marginLeft: 6,
  },
  paymentInfoCard: {
    flexDirection: 'row',
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 14,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  paymentInfoText: {
    flex: 1,
    fontSize: 13,
    color: '#3B82F6',
    lineHeight: 18,
    marginLeft: 10,
  },
  // Success payment badge
  paymentConfirmBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  paymentConfirmText: {
    fontSize: 14,
    color: '#065F46',
    marginLeft: 8,
    flex: 1,
  },
  // Success styles
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  successIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  successSubtitle: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 16,
  },
  appointmentCard: {
    backgroundColor: '#ECFDF5',
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: '#10B981',
    marginBottom: 16,
  },
  appointmentDate: {
    fontSize: 20,
    fontWeight: '600',
    color: '#065F46',
    textAlign: 'center',
  },
  reminderText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 32,
  },
  continueButton: {
    flexDirection: 'row',
    backgroundColor: '#10B981',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
  },
  continueButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginRight: 8,
  },
});
