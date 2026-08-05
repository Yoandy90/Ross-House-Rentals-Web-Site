import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  Modal,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://banking-filter-hub.preview.emergentagent.com';

interface CalendarSettings {
  accepting_appointments: boolean;
  pause_reason: string;
  paused_at: string | null;
  blocked_days: Array<{ id: string; date: string; reason: string }>;
  blocked_slots: Array<{ id: string; date: string; time: string; reason: string }>;
}

interface CalendarStats {
  today: { total: number; pending: number; completed: number };
  week: { total: number; dates: string };
  month: { total: number; month_name: string };
  attendance_rate: number;
  total_completed: number;
  total_no_show: number;
  next_available: { date: string; day_name: string; open_time: string } | null;
}

export default function CalendarioScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [settings, setSettings] = useState<CalendarSettings>({
    accepting_appointments: true,
    pause_reason: '',
    paused_at: null,
    blocked_days: [],
    blocked_slots: []
  });
  const [stats, setStats] = useState<CalendarStats | null>(null);
  
  // Modal states
  const [showPauseModal, setShowPauseModal] = useState(false);
  const [showBlockDayModal, setShowBlockDayModal] = useState(false);
  const [showBlockSlotModal, setShowBlockSlotModal] = useState(false);
  const [pauseReason, setPauseReason] = useState('');
  const [blockDayDate, setBlockDayDate] = useState('');
  const [blockDayReason, setBlockDayReason] = useState('');
  const [blockSlotDate, setBlockSlotDate] = useState('');
  const [blockSlotTime, setBlockSlotTime] = useState('');
  const [blockSlotReason, setBlockSlotReason] = useState('');
  
  // Loading states
  const [togglingCalendar, setTogglingCalendar] = useState(false);
  const [blockingDay, setBlockingDay] = useState(false);
  const [blockingSlot, setBlockingSlot] = useState(false);

  const getAuthToken = async () => {
    return await AsyncStorage.getItem('token');
  };

  const loadData = useCallback(async () => {
    try {
      const token = await getAuthToken();
      const headers = { Authorization: `Bearer ${token}` };

      const [settingsRes, statsRes] = await Promise.all([
        fetch(`${API_URL}/admin/calendar/settings`, { headers }),
        fetch(`${API_URL}/admin/calendar/statistics`, { headers })
      ]);

      if (settingsRes.ok) {
        const data = await settingsRes.json();
        setSettings(data);
      }

      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error loading calendar data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const toggleCalendar = async () => {
    if (settings.accepting_appointments) {
      setShowPauseModal(true);
    } else {
      // Turn ON
      setTogglingCalendar(true);
      try {
        const token = await getAuthToken();
        const res = await fetch(`${API_URL}/admin/calendar/toggle`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ accepting_appointments: true })
        });
        if (res.ok) {
          const data = await res.json();
          setSettings(prev => ({ ...prev, accepting_appointments: true, pause_reason: '' }));
          Alert.alert('✅ Calendario Activado', data.message);
        }
      } catch (error) {
        Alert.alert('Error', 'No se pudo activar el calendario');
      } finally {
        setTogglingCalendar(false);
      }
    }
  };

  const confirmPauseCalendar = async () => {
    setTogglingCalendar(true);
    try {
      const token = await getAuthToken();
      const res = await fetch(`${API_URL}/admin/calendar/toggle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          accepting_appointments: false,
          reason: pauseReason || 'Pausado temporalmente'
        })
      });
      if (res.ok) {
        const data = await res.json();
        setSettings(prev => ({
          ...prev,
          accepting_appointments: false,
          pause_reason: pauseReason || 'Pausado temporalmente'
        }));
        setShowPauseModal(false);
        setPauseReason('');
        Alert.alert('⏸️ Calendario Pausado', data.message);
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudo pausar el calendario');
    } finally {
      setTogglingCalendar(false);
    }
  };

  const blockDay = async () => {
    if (!blockDayDate) {
      Alert.alert('Error', 'Selecciona una fecha');
      return;
    }
    setBlockingDay(true);
    try {
      const token = await getAuthToken();
      const res = await fetch(`${API_URL}/admin/calendar/block-day`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          date: blockDayDate,
          reason: blockDayReason || 'Día cerrado'
        })
      });
      if (res.ok) {
        const data = await res.json();
        setSettings(prev => ({
          ...prev,
          blocked_days: [...prev.blocked_days, { id: data.id, date: data.date, reason: data.reason }]
        }));
        setShowBlockDayModal(false);
        setBlockDayDate('');
        setBlockDayReason('');
        Alert.alert('✅ Día Bloqueado', data.message);
      } else {
        const error = await res.json();
        Alert.alert('Error', error.detail || 'No se pudo bloquear el día');
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudo bloquear el día');
    } finally {
      setBlockingDay(false);
    }
  };

  const unblockDay = async (date: string) => {
    Alert.alert(
      'Desbloquear Día',
      `¿Deseas desbloquear el día ${date}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desbloquear',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await getAuthToken();
              const res = await fetch(`${API_URL}/admin/calendar/block-day/${date}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
              });
              if (res.ok) {
                setSettings(prev => ({
                  ...prev,
                  blocked_days: prev.blocked_days.filter(d => d.date !== date)
                }));
                Alert.alert('✅', 'Día desbloqueado');
              }
            } catch (error) {
              Alert.alert('Error', 'No se pudo desbloquear');
            }
          }
        }
      ]
    );
  };

  const blockSlot = async () => {
    if (!blockSlotDate || !blockSlotTime) {
      Alert.alert('Error', 'Selecciona fecha y hora');
      return;
    }
    setBlockingSlot(true);
    try {
      const token = await getAuthToken();
      const res = await fetch(`${API_URL}/admin/calendar/block-slot`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          date: blockSlotDate,
          time: blockSlotTime,
          reason: blockSlotReason || 'Horario bloqueado'
        })
      });
      if (res.ok) {
        const data = await res.json();
        setSettings(prev => ({
          ...prev,
          blocked_slots: [...prev.blocked_slots, { id: data.id, date: data.date, time: data.time, reason: data.reason }]
        }));
        setShowBlockSlotModal(false);
        setBlockSlotDate('');
        setBlockSlotTime('');
        setBlockSlotReason('');
        Alert.alert('✅ Horario Bloqueado', data.message);
      } else {
        const error = await res.json();
        Alert.alert('Error', error.detail || 'No se pudo bloquear el horario');
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudo bloquear el horario');
    } finally {
      setBlockingSlot(false);
    }
  };

  const unblockSlot = async (date: string, time: string) => {
    Alert.alert(
      'Desbloquear Horario',
      `¿Deseas desbloquear ${time} del ${date}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desbloquear',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await getAuthToken();
              const res = await fetch(`${API_URL}/admin/calendar/block-slot?date=${date}&time=${time}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
              });
              if (res.ok) {
                setSettings(prev => ({
                  ...prev,
                  blocked_slots: prev.blocked_slots.filter(s => !(s.date === date && s.time === time))
                }));
                Alert.alert('✅', 'Horario desbloqueado');
              }
            } catch (error) {
              Alert.alert('Error', 'No se pudo desbloquear');
            }
          }
        }
      ]
    );
  };

  // Get today's date in YYYY-MM-DD format
  const getTodayDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  // Time slots for picker
  const timeSlots = ['10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00', '13:30'];

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6C1110" />
          <Text style={styles.loadingText}>Cargando calendario...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <LinearGradient colors={['#1a1a2e', '#16213e']} style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>📅 Gestión de Calendario</Text>
          <Text style={styles.headerSubtitle}>Controla disponibilidad de citas</Text>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#6C1110']} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Calendar Status Toggle */}
        <View style={[
          styles.statusCard,
          { backgroundColor: settings.accepting_appointments ? '#dcfce7' : '#fee2e2' }
        ]}>
          <View style={styles.statusHeader}>
            <View>
              <Text style={styles.statusLabel}>Estado del Calendario</Text>
              <Text style={[
                styles.statusValue,
                { color: settings.accepting_appointments ? '#15803d' : '#b91c1c' }
              ]}>
                {settings.accepting_appointments ? '✓ Aceptando Citas' : '✕ Pausado'}
              </Text>
              {!settings.accepting_appointments && settings.pause_reason && (
                <Text style={styles.pauseReason}>{settings.pause_reason}</Text>
              )}
            </View>
            <TouchableOpacity
              onPress={toggleCalendar}
              disabled={togglingCalendar}
              style={[
                styles.toggleButton,
                { backgroundColor: settings.accepting_appointments ? '#16a34a' : '#dc2626' }
              ]}
            >
              {togglingCalendar ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Ionicons
                    name={settings.accepting_appointments ? 'pause' : 'play'}
                    size={20}
                    color="#fff"
                  />
                  <Text style={styles.toggleText}>
                    {settings.accepting_appointments ? 'Pausar' : 'Activar'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Statistics */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Hoy</Text>
            <Text style={styles.statValue}>{stats?.today.total || 0}</Text>
            <Text style={styles.statSubtext}>
              {stats?.today.pending || 0} pendientes
            </Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Esta Semana</Text>
            <Text style={[styles.statValue, { color: '#2563eb' }]}>{stats?.week.total || 0}</Text>
            <Text style={styles.statSubtext}>citas</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Asistencia</Text>
            <Text style={[styles.statValue, { color: '#7c3aed' }]}>{stats?.attendance_rate || 100}%</Text>
            <Text style={styles.statSubtext}>
              {stats?.total_no_show || 0} no show
            </Text>
          </View>
        </View>

        {/* Next Available */}
        {stats?.next_available && (
          <View style={styles.nextAvailableCard}>
            <Ionicons name="calendar-outline" size={24} color="#16a34a" />
            <View style={styles.nextAvailableContent}>
              <Text style={styles.nextAvailableLabel}>Próximo Disponible</Text>
              <Text style={styles.nextAvailableValue}>
                {stats.next_available.day_name} {stats.next_available.date} a las {stats.next_available.open_time}
              </Text>
            </View>
          </View>
        )}

        {/* Quick Actions */}
        <View style={styles.actionsSection}>
          <Text style={styles.sectionTitle}>Acciones Rápidas</Text>
          <View style={styles.actionsGrid}>
            <TouchableOpacity style={styles.actionButton} onPress={() => setShowBlockDayModal(true)}>
              <View style={[styles.actionIcon, { backgroundColor: '#fee2e2' }]}>
                <Ionicons name="close-circle" size={24} color="#dc2626" />
              </View>
              <Text style={styles.actionText}>Cerrar Día</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={() => setShowBlockSlotModal(true)}>
              <View style={[styles.actionIcon, { backgroundColor: '#ffedd5' }]}>
                <Ionicons name="time" size={24} color="#ea580c" />
              </View>
              <Text style={styles.actionText}>Bloquear Horario</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Blocked Days */}
        {settings.blocked_days.length > 0 && (
          <View style={styles.blockedSection}>
            <Text style={styles.sectionTitle}>📅 Días Bloqueados ({settings.blocked_days.length})</Text>
            {settings.blocked_days.map((day) => (
              <View key={day.id} style={styles.blockedItem}>
                <View>
                  <Text style={styles.blockedDate}>{day.date}</Text>
                  <Text style={styles.blockedReason}>{day.reason}</Text>
                </View>
                <TouchableOpacity onPress={() => unblockDay(day.date)} style={styles.unblockButton}>
                  <Ionicons name="trash-outline" size={18} color="#dc2626" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* Blocked Slots */}
        {settings.blocked_slots.length > 0 && (
          <View style={styles.blockedSection}>
            <Text style={styles.sectionTitle}>⏰ Horarios Bloqueados ({settings.blocked_slots.length})</Text>
            {settings.blocked_slots.map((slot) => (
              <View key={slot.id} style={styles.blockedItem}>
                <View>
                  <Text style={styles.blockedDate}>{slot.date} - {slot.time}</Text>
                  <Text style={styles.blockedReason}>{slot.reason}</Text>
                </View>
                <TouchableOpacity onPress={() => unblockSlot(slot.date, slot.time)} style={styles.unblockButton}>
                  <Ionicons name="trash-outline" size={18} color="#ea580c" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Pause Calendar Modal */}
      <Modal visible={showPauseModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>⏸️ Pausar Calendario</Text>
            <Text style={styles.modalSubtitle}>
              Los clientes no podrán agendar nuevas citas hasta que lo reactives
            </Text>
            
            <View style={styles.warningBox}>
              <Text style={styles.warningText}>
                ⚠️ Las citas ya agendadas no se cancelarán
              </Text>
            </View>

            <Text style={styles.inputLabel}>Razón (visible para clientes)</Text>
            <TextInput
              style={styles.input}
              value={pauseReason}
              onChangeText={setPauseReason}
              placeholder="Ej: Vacaciones, Mantenimiento"
              placeholderTextColor="#9ca3af"
            />

            <View style={styles.quickOptions}>
              {['Vacaciones', 'No disponible', 'Capacitación'].map((option) => (
                <TouchableOpacity
                  key={option}
                  style={styles.quickOption}
                  onPress={() => setPauseReason(option)}
                >
                  <Text style={styles.quickOptionText}>{option}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => { setShowPauseModal(false); setPauseReason(''); }}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmButton}
                onPress={confirmPauseCalendar}
                disabled={togglingCalendar}
              >
                {togglingCalendar ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.confirmButtonText}>Pausar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Block Day Modal */}
      <Modal visible={showBlockDayModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>🚫 Cerrar Día Completo</Text>
            <Text style={styles.modalSubtitle}>
              Bloquea un día completo para evitar citas
            </Text>

            <Text style={styles.inputLabel}>Fecha (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.input}
              value={blockDayDate}
              onChangeText={setBlockDayDate}
              placeholder={getTodayDate()}
              placeholderTextColor="#9ca3af"
            />

            <Text style={styles.inputLabel}>Razón (opcional)</Text>
            <TextInput
              style={styles.input}
              value={blockDayReason}
              onChangeText={setBlockDayReason}
              placeholder={t('admin.calHolidayPlaceholder', 'Ej: Día feriado, Vacaciones')}
              placeholderTextColor="#9ca3af"
            />

            <View style={styles.quickOptions}>
              {['Día feriado', 'Vacaciones', 'Capacitación'].map((option) => (
                <TouchableOpacity
                  key={option}
                  style={styles.quickOption}
                  onPress={() => setBlockDayReason(option)}
                >
                  <Text style={styles.quickOptionText}>{option}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => { setShowBlockDayModal(false); setBlockDayDate(''); setBlockDayReason(''); }}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmButton, { backgroundColor: '#dc2626' }]}
                onPress={blockDay}
                disabled={blockingDay}
              >
                {blockingDay ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.confirmButtonText}>Bloquear</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Block Slot Modal */}
      <Modal visible={showBlockSlotModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>⏰ Bloquear Horario</Text>
            <Text style={styles.modalSubtitle}>
              Bloquea un horario específico sin cerrar el día
            </Text>

            <Text style={styles.inputLabel}>Fecha (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.input}
              value={blockSlotDate}
              onChangeText={setBlockSlotDate}
              placeholder={getTodayDate()}
              placeholderTextColor="#9ca3af"
            />

            <Text style={styles.inputLabel}>Hora</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.timeSlots}>
              {timeSlots.map((time) => (
                <TouchableOpacity
                  key={time}
                  style={[
                    styles.timeSlot,
                    blockSlotTime === time && styles.timeSlotSelected
                  ]}
                  onPress={() => setBlockSlotTime(time)}
                >
                  <Text style={[
                    styles.timeSlotText,
                    blockSlotTime === time && styles.timeSlotTextSelected
                  ]}>{time}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.inputLabel}>Razón (opcional)</Text>
            <TextInput
              style={styles.input}
              value={blockSlotReason}
              onChangeText={setBlockSlotReason}
              placeholder={t('admin.calMeetingPlaceholder', 'Ej: Reunión, Almuerzo')}
              placeholderTextColor="#9ca3af"
            />

            <View style={styles.quickOptions}>
              {['Reunión', 'Almuerzo', 'Personal'].map((option) => (
                <TouchableOpacity
                  key={option}
                  style={styles.quickOption}
                  onPress={() => setBlockSlotReason(option)}
                >
                  <Text style={styles.quickOptionText}>{option}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => { setShowBlockSlotModal(false); setBlockSlotDate(''); setBlockSlotTime(''); setBlockSlotReason(''); }}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmButton, { backgroundColor: '#ea580c' }]}
                onPress={blockSlot}
                disabled={blockingSlot}
              >
                {blockingSlot ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.confirmButtonText}>Bloquear</Text>
                )}
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
    backgroundColor: '#1a1a2e',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    marginTop: 12,
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingTop: 8,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 2,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  statusCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusLabel: {
    fontSize: 13,
    color: '#4b5563',
    fontWeight: '500',
  },
  statusValue: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 4,
  },
  pauseReason: {
    fontSize: 12,
    color: '#b91c1c',
    marginTop: 4,
  },
  toggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
  },
  toggleText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#242447',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#6C1110',
  },
  statSubtext: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  nextAvailableCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dcfce7',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    gap: 12,
  },
  nextAvailableContent: {
    flex: 1,
  },
  nextAvailableLabel: {
    fontSize: 12,
    color: '#15803d',
    fontWeight: '500',
  },
  nextAvailableValue: {
    fontSize: 14,
    color: '#166534',
    fontWeight: '600',
    marginTop: 2,
  },
  actionsSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  actionsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#242447',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
  },
  blockedSection: {
    marginBottom: 16,
  },
  blockedItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#242447',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  blockedDate: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  blockedReason: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 2,
  },
  unblockButton: {
    padding: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 16,
  },
  warningBox: {
    backgroundColor: '#fef3c7',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  warningText: {
    color: '#92400e',
    fontSize: 13,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
    marginTop: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: '#1f2937',
  },
  quickOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
    marginBottom: 16,
  },
  quickOption: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  quickOptionText: {
    color: '#4b5563',
    fontSize: 13,
  },
  timeSlots: {
    marginBottom: 8,
  },
  timeSlot: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    marginRight: 8,
  },
  timeSlotSelected: {
    backgroundColor: '#ea580c',
  },
  timeSlotText: {
    color: '#4b5563',
    fontWeight: '500',
  },
  timeSlotTextSelected: {
    color: '#fff',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#e5e7eb',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#4b5563',
    fontWeight: '600',
  },
  confirmButton: {
    flex: 1,
    backgroundColor: '#dc2626',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});
