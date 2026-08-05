import React, { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import AdminHeader from '../../components/admin/AdminHeader';
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
  Platform,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../../constants/colors';
import api from '../../services/api';

const DAYS_OF_WEEK = [
  { key: 'monday', label: 'Lunes' },
  { key: 'tuesday', label: 'Martes' },
  { key: 'wednesday', label: 'Miércoles' },
  { key: 'thursday', label: 'Jueves' },
  { key: 'friday', label: 'Viernes' },
  { key: 'saturday', label: 'Sábado' },
  { key: 'sunday', label: 'Domingo' },
];

export default function AvailabilitySettings() {
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [config, setConfig] = useState<any>(null);
  const [calendarStatus, setCalendarStatus] = useState<any>(null);
  const [calendars, setCalendars] = useState<any[]>([]);
  const [showCalendarSelector, setShowCalendarSelector] = useState(false);
  const [selectedCalendarId, setSelectedCalendarId] = useState<string>('');

  useEffect(() => {
    loadConfig();
    loadCalendarStatus();
  }, []);

  const loadConfig = async () => {
    try {
      const response = await api.get('/admin/availability/config');
      setConfig(response.data);
    } catch (error) {
      console.error('Error loading config:', error);
      Alert.alert('Error', 'No se pudo cargar la configuración');
    } finally {
      setLoading(false);
    }
  };

  const loadCalendarStatus = async () => {
    try {
      const response = await api.get('/admin/calendar/status');
      console.log('📊 Calendar status loaded:', response.data);
      setCalendarStatus(response.data);
      
      // Update config if needed
      if (config) {
        setConfig({
          ...config,
          google_calendar_connected: response.data.connected
        });
      }
      
      // Load calendars list if connected, otherwise clear it
      if (response.data.connected) {
        loadCalendarsList();
      } else {
        setCalendars([]);
        setSelectedCalendarId('');
      }
    } catch (error) {
      console.error('Error loading calendar status:', error);
    }
  };
  
  const loadCalendarsList = async () => {
    try {
      const response = await api.get('/admin/calendar/list');
      setCalendars(response.data.calendars || []);
      setSelectedCalendarId(response.data.current_calendar_id || 'primary');
    } catch (error) {
      console.error('Error loading calendars list:', error);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.post('/admin/availability/config', {
        slot_duration_minutes: config.slot_duration_minutes,
        buffer_time_minutes: config.buffer_time_minutes,
        max_advance_days: config.max_advance_days,
        weekly_schedule: config.weekly_schedule,
        blocked_dates: config.blocked_dates || [],
      });
      Alert.alert('Éxito', 'Configuración guardada correctamente');
    } catch (error) {
      console.error('Error saving config:', error);
      Alert.alert('Error', 'No se pudo guardar la configuración');
    } finally {
      setSaving(false);
    }
  };

  const toggleDayEnabled = (dayKey: string) => {
    const newSchedule = config.weekly_schedule.map((day: any) =>
      day.day === dayKey ? { ...day, enabled: !day.enabled } : day
    );
    setConfig({ ...config, weekly_schedule: newSchedule });
  };

  const updateDaySlot = (dayKey: string, slotIndex: number, field: string, value: string) => {
    const newSchedule = config.weekly_schedule.map((day: any) => {
      if (day.day === dayKey) {
        const newSlots = [...day.slots];
        newSlots[slotIndex] = { ...newSlots[slotIndex], [field]: value };
        return { ...day, slots: newSlots };
      }
      return day;
    });
    setConfig({ ...config, weekly_schedule: newSchedule });
  };

  const handleGoogleCalendarConnect = async () => {
    console.log('🔵 handleGoogleCalendarConnect called');
    console.log('📊 Current calendarStatus:', calendarStatus);
    console.log('🔌 Is connected?:', calendarStatus?.connected);
    
    if (calendarStatus?.connected) {
      console.log('➡️ Taking disconnect path');
      // Disconnect - Use confirm for better web compatibility
      const confirmDisconnect = Platform.OS === 'web' 
        ? window.confirm('¿Estás seguro de que quieres desconectar tu Google Calendar?')
        : await new Promise((resolve) => {
            Alert.alert(
              'Desconectar Google Calendar',
              '¿Estás seguro de que quieres desconectar tu Google Calendar?',
              [
                { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
                { text: 'Desconectar', style: 'destructive', onPress: () => resolve(true) }
              ]
            );
          });
      
      if (confirmDisconnect) {
        try {
          console.log('🔴 Disconnecting calendar...');
          const response = await api.delete('/admin/calendar/disconnect');
          console.log('✅ Disconnect response:', response.data);
          
          // Force state update
          setCalendarStatus({ connected: false, calendar_id: null });
          setCalendars([]);
          setSelectedCalendarId('');
          
          // Reload status from server
          await loadCalendarStatus();
          
          if (Platform.OS === 'web') {
            Alert.alert('Aviso', 'Google Calendar desconectado correctamente');
          } else {
            Alert.alert('Éxito', 'Google Calendar desconectado correctamente');
          }
        } catch (error) {
          console.error('❌ Error disconnecting:', error);
          if (Platform.OS === 'web') {
            Alert.alert('Aviso', 'Error: No se pudo desconectar Google Calendar');
          } else {
            Alert.alert('Error', 'No se pudo desconectar Google Calendar');
          }
        }
      }
    } else {
      console.log('➡️ Taking connect path');
      // Connect
      try {
        console.log('🔄 Iniciando conexión con Google Calendar...');
        
        // Get authorization URL
        const response = await api.get('/admin/calendar/connect');
        console.log('✅ Respuesta del servidor:', response.data);
        
        const { authorization_url } = response.data;
        
        if (!authorization_url) {
          console.error('❌ No se recibió authorization_url');
          if (Platform.OS === 'web') {
            Alert.alert('Aviso', 'Error: No se pudo obtener la URL de autorización');
          } else {
            Alert.alert('Error', 'No se pudo obtener la URL de autorización');
          }
          return;
        }
        
        console.log('🔗 URL de autorización:', authorization_url);
        
        // Open URL directly for web, show alert for mobile
        if (Platform.OS === 'web') {
          // Open in new tab for web
          window.open(authorization_url, '_blank');
          console.log('✅ URL abierta en nueva pestaña');
          
          // Show info message
          setTimeout(() => {
            const shouldRefresh = window.confirm(
              'Después de autorizar en la nueva pestaña, pulsa OK para actualizar el estado de conexión.'
            );
            if (shouldRefresh) {
              loadCalendarStatus();
            }
          }, 1000);
        } else {
          // Mobile flow with Alert
          Alert.alert(
            'Conectar Google Calendar',
            'Se abrirá una ventana del navegador para autorizar el acceso a tu Google Calendar.',
            [
              { text: 'Cancelar', style: 'cancel' },
              {
                text: 'Abrir Navegador',
                onPress: async () => {
                  try {
                    console.log('📱 Intentando abrir URL...');
                    await Linking.openURL(authorization_url);
                    console.log('✅ URL abierta exitosamente');
                    
                    setTimeout(() => {
                      Alert.alert(
                        'Autorización en Progreso',
                        'Después de autorizar, regresa aquí y pulsa "Verificar Conexión".',
                        [
                          {
                            text: 'Verificar Conexión',
                            onPress: () => loadCalendarStatus()
                          }
                        ]
                      );
                    }, 2000);
                  } catch (linkError) {
                    console.error('❌ Error al abrir URL:', linkError);
                    Alert.alert('Error', 'No se pudo abrir el navegador');
                  }
                }
              }
            ]
          );
        }
      } catch (error) {
        console.error('❌ Error starting connection:', error);
        if (Platform.OS === 'web') {
          Alert.alert('Aviso', 'Error: No se pudo iniciar la conexión con Google Calendar');
        } else {
          Alert.alert('Error', 'No se pudo iniciar la conexión con Google Calendar: ' + (error.message || 'Error desconocido'));
        }
      }
    }
  };

  const handleSyncAppointments = async () => {
    setSyncing(true);
    try {
      const response = await api.post('/admin/calendar/sync');
      const { synced, failed, total } = response.data;
      
      Alert.alert(
        'Sincronización Completa',
        `Se sincronizaron ${synced} de ${total} citas correctamente.${failed > 0 ? `\n${failed} citas fallaron.` : ''}`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Error syncing appointments:', error);
      Alert.alert('Error', 'No se pudieron sincronizar las citas');
    } finally {
      setSyncing(false);
    }
  };
  
  const handleSelectCalendar = async (calendarId: string) => {
    try {
      await api.post('/admin/calendar/select', null, {
        params: { calendar_id: calendarId }
      });
      
      setSelectedCalendarId(calendarId);
      setShowCalendarSelector(false);
      
      // Reload status to get updated calendar_id
      await loadCalendarStatus();
      
      Alert.alert('Éxito', 'Calendario seleccionado correctamente');
    } catch (error) {
      console.error('Error selecting calendar:', error);
      Alert.alert('Error', 'No se pudo seleccionar el calendario');
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!config) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>No se pudo cargar la configuración</Text>
        <TouchableOpacity 
          style={styles.retryButton}
          onPress={loadConfig}
        >
          <Text style={styles.retryButtonText}>Reintentar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <AdminHeader title="Configuración de Disponibilidad" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Ionicons name="calendar" size={32} color={colors.primary} />
          <Text style={styles.title}>Configuración de Disponibilidad</Text>
          <Text style={styles.subtitle}>
            Define tu horario de atención y disponibilidad para citas
          </Text>
        </View>

        {/* General Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Configuración General</Text>

          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Duración de slots (minutos)</Text>
            <TextInput
              style={styles.numberInput}
              value={config.slot_duration_minutes?.toString()}
              onChangeText={(text) =>
                setConfig({ ...config, slot_duration_minutes: parseInt(text) || 30 })
              }
              keyboardType="numeric"
              placeholder="30"
            />
          </View>

          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Tiempo de buffer (minutos)</Text>
            <TextInput
              style={styles.numberInput}
              value={config.buffer_time_minutes?.toString()}
              onChangeText={(text) =>
                setConfig({ ...config, buffer_time_minutes: parseInt(text) || 0 })
              }
              keyboardType="numeric"
              placeholder="0"
            />
          </View>

          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Máx. días adelantados</Text>
            <TextInput
              style={styles.numberInput}
              value={config.max_advance_days?.toString()}
              onChangeText={(text) =>
                setConfig({ ...config, max_advance_days: parseInt(text) || 60 })
              }
              keyboardType="numeric"
              placeholder="60"
            />
          </View>
        </View>

        {/* Weekly Schedule */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Horario Semanal</Text>

          {DAYS_OF_WEEK.map(({ key, label }) => {
            const dayConfig = config.weekly_schedule?.find((d: any) => d.day === key);
            if (!dayConfig) return null;

            return (
              <View key={key} style={styles.dayCard}>
                <View style={styles.dayHeader}>
                  <Text style={styles.dayLabel}>{label}</Text>
                  <Switch
                    value={dayConfig.enabled}
                    onValueChange={() => toggleDayEnabled(key)}
                    trackColor={{ false: colors.textGray, true: colors.primary }}
                    thumbColor={dayConfig.enabled ? colors.textWhite : colors.textLight}
                  />
                </View>

                {dayConfig.enabled && dayConfig.slots?.length > 0 && (
                  <View style={styles.slotsContainer}>
                    {dayConfig.slots.map((slot: any, index: number) => (
                      <View key={index} style={styles.slotRow}>
                        <TextInput
                          style={styles.timeInput}
                          value={slot.start_time}
                          onChangeText={(text) => updateDaySlot(key, index, 'start_time', text)}
                          placeholder="09:00"
                          placeholderTextColor={colors.textLight}
                        />
                        <Text style={styles.timeSeparator}>-</Text>
                        <TextInput
                          style={styles.timeInput}
                          value={slot.end_time}
                          onChangeText={(text) => updateDaySlot(key, index, 'end_time', text)}
                          placeholder="17:00"
                          placeholderTextColor={colors.textLight}
                        />
                      </View>
                    ))}
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* Google Calendar Integration */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Integración con Google Calendar</Text>
          <View style={styles.googleCard}>
            <View style={styles.googleHeader}>
              <Ionicons
                name="logo-google"
                size={24}
                color={calendarStatus?.connected ? colors.success : colors.textGray}
              />
              <View style={styles.googleInfo}>
                <Text style={styles.googleTitle}>Google Calendar</Text>
                <Text style={styles.googleStatus}>
                  {calendarStatus?.connected ? '✅ Conectado' : '⚪ No conectado'}
                </Text>
                {calendarStatus?.calendar_id && (
                  <Text style={styles.googleCalendarId}>
                    {calendarStatus.calendar_id}
                  </Text>
                )}
              </View>
            </View>

            <TouchableOpacity
              style={[
                styles.googleButton,
                calendarStatus?.connected && styles.googleButtonDisconnect,
              ]}
              onPress={handleGoogleCalendarConnect}
            >
              <Ionicons 
                name={calendarStatus?.connected ? "log-out-outline" : "logo-google"} 
                size={18} 
                color={colors.textWhite} 
              />
              <Text style={styles.googleButtonText}>
                {calendarStatus?.connected ? 'Desconectar' : 'Conectar con Google'}
              </Text>
            </TouchableOpacity>
          </View>

          {calendarStatus?.connected && (
            <>
              <View style={styles.infoBox}>
                <Ionicons name="information-circle" size={20} color={colors.accent} />
                <Text style={styles.infoText}>
                  Las nuevas citas se sincronizarán automáticamente con tu Google Calendar
                </Text>
              </View>

              {/* Calendar Selector */}
              {calendars.length > 0 && (
                <View style={styles.calendarSelectorSection}>
                  <Text style={styles.calendarSelectorTitle}>
                    Calendario Seleccionado
                  </Text>
                  
                  <TouchableOpacity
                    style={styles.selectedCalendarCard}
                    onPress={() => setShowCalendarSelector(true)}
                  >
                    <View style={styles.calendarIconContainer}>
                      <Ionicons name="calendar" size={20} color={colors.primary} />
                    </View>
                    <View style={styles.calendarInfo}>
                      <Text style={styles.selectedCalendarName}>
                        {calendars.find(c => c.id === selectedCalendarId)?.name || 'Primary Calendar'}
                      </Text>
                      <Text style={styles.selectedCalendarId}>
                        {calendars.find(c => c.id === selectedCalendarId)?.id || selectedCalendarId}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={colors.textGray} />
                  </TouchableOpacity>
                  
                  {/* Calendar Selection Modal */}
                  {showCalendarSelector && (
                    <View style={styles.modalOverlay}>
                      <View style={styles.calendarModal}>
                        <View style={styles.calendarModalHeader}>
                          <Text style={styles.calendarModalTitle}>
                            Seleccionar Calendario
                          </Text>
                          <TouchableOpacity
                            onPress={() => setShowCalendarSelector(false)}
                            style={styles.modalCloseButton}
                          >
                            <Ionicons name="close" size={24} color={colors.text} />
                          </TouchableOpacity>
                        </View>
                        
                        <ScrollView style={styles.calendarList}>
                          {calendars.map((calendar) => (
                            <TouchableOpacity
                              key={calendar.id}
                              style={[
                                styles.calendarItem,
                                calendar.id === selectedCalendarId && styles.calendarItemSelected
                              ]}
                              onPress={() => handleSelectCalendar(calendar.id)}
                            >
                              <View 
                                style={[
                                  styles.calendarColorDot,
                                  { backgroundColor: calendar.backgroundColor || colors.primary }
                                ]}
                              />
                              <View style={styles.calendarItemContent}>
                                <Text style={styles.calendarItemName}>
                                  {calendar.name}
                                  {calendar.primary && (
                                    <Text style={styles.calendarPrimaryBadge}> (Principal)</Text>
                                  )}
                                </Text>
                                {calendar.description && (
                                  <Text style={styles.calendarItemDescription}>
                                    {calendar.description}
                                  </Text>
                                )}
                              </View>
                              {calendar.id === selectedCalendarId && (
                                <Ionicons name="checkmark-circle" size={24} color={colors.success} />
                              )}
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      </View>
                    </View>
                  )}
                </View>
              )}

              <TouchableOpacity
                style={[styles.syncButton, syncing && styles.syncButtonDisabled]}
                onPress={handleSyncAppointments}
                disabled={syncing}
              >
                {syncing ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <>
                    <Ionicons name="sync" size={20} color={colors.primary} />
                    <Text style={styles.syncButtonText}>
                      Sincronizar Citas Existentes
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color={colors.textWhite} />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={20} color={colors.textWhite} />
              <Text style={styles.saveButtonText}>Guardar Configuración</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundGray,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: colors.error,
    marginBottom: 20,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: colors.textWhite,
    fontSize: 15,
    fontWeight: '600',
  },
  scrollContent: {
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginTop: 12,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textGray,
    textAlign: 'center',
    marginTop: 8,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 16,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  settingLabel: {
    fontSize: 15,
    color: colors.text,
    flex: 1,
  },
  numberInput: {
    width: 80,
    backgroundColor: colors.backgroundGray,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    fontSize: 15,
    color: colors.text,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  dayCard: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dayLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  slotsContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  slotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  timeInput: {
    flex: 1,
    backgroundColor: colors.backgroundGray,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 15,
    color: colors.text,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  timeSeparator: {
    fontSize: 16,
    color: colors.textGray,
    fontWeight: '600',
  },
  googleCard: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  googleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  googleInfo: {
    marginLeft: 12,
    flex: 1,
  },
  googleTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  googleStatus: {
    fontSize: 13,
    color: colors.textGray,
    marginTop: 2,
  },
  googleButton: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  googleButtonDisconnect: {
    backgroundColor: colors.error,
  },
  googleButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textWhite,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.accent + '15',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: colors.accent,
    lineHeight: 18,
  },
  googleCalendarId: {
    fontSize: 11,
    color: colors.textGray,
    marginTop: 2,
  },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    paddingVertical: 14,
    borderRadius: 10,
    gap: 8,
    marginTop: 12,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  syncButtonDisabled: {
    opacity: 0.5,
  },
  syncButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    marginTop: 8,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textWhite,
  },
  // Calendar Selector Styles
  calendarSelectorSection: {
    marginTop: 12,
    marginBottom: 12,
  },
  calendarSelectorTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  selectedCalendarCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  calendarIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  calendarInfo: {
    flex: 1,
  },
  selectedCalendarName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  selectedCalendarId: {
    fontSize: 12,
    color: colors.textGray,
    marginTop: 2,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  calendarModal: {
    backgroundColor: colors.background,
    borderRadius: 16,
    width: Platform.OS === 'web' ? 500 : '90%',
    maxHeight: '80%',
    overflow: 'hidden',
  },
  calendarModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  calendarModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  modalCloseButton: {
    padding: 4,
  },
  calendarList: {
    maxHeight: 400,
  },
  calendarItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 12,
  },
  calendarItemSelected: {
    backgroundColor: colors.primary + '10',
  },
  calendarColorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  calendarItemContent: {
    flex: 1,
  },
  calendarItemName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  calendarPrimaryBadge: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.accent,
  },
  calendarItemDescription: {
    fontSize: 13,
    color: colors.textGray,
    marginTop: 2,
  },
});