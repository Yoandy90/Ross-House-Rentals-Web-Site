/**
 * Appointments Screen - Premium rebuild (crash-safe)
 * Calendar view + upcoming appointments + dark mode
 * NO expo-clipboard, NO expo-calendar (native crash triggers removed)
 */
import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Linking,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  format, isToday, isTomorrow, isPast,
  differenceInDays, differenceInHours, differenceInMinutes,
} from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import { useThemeColors } from '../../constants/colors';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

interface Appointment {
  id: string;
  title: string;
  description: string;
  scheduled_at: string;
  duration_minutes: number;
  status: string;
  appointment_type: string;
  meeting_link: string;
  created_at: string;
  staff_name?: string;
  location?: string;
}

const CACHE_KEY = 'appointments_cache';
const HEADER_GRADIENT = ['#6C1110', '#8B0000', '#A52A2A'] as const;

export default function AppointmentsScreen() {
  const { t, i18n } = useTranslation();
  const dateLocale = i18n.language === 'en' ? enUS : es;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const colors = useThemeColors();
  const s = useMemo(() => createStyles(colors), [colors]);

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [officeStatus, setOfficeStatus] = useState<any>(null);
  const [weeklySchedule, setWeeklySchedule] = useState<any>(null);
  const [showHistory, setShowHistory] = useState(false);

  const now = new Date();

  // Reload data every time the tab gains focus (keeps list fresh after booking)
  useFocusEffect(
    useCallback(() => {
      if (user) {
        loadAppointments();
        loadOfficeStatus();
      } else {
        setLoading(false);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user])
  );

  const loadAppointments = async () => {
    try {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) {
        const p = JSON.parse(cached);
        if (p.data && Date.now() - p.timestamp < 5 * 60 * 1000) {
          setAppointments(p.data);
          setLoading(false);
        }
      }
      const res = await api.get('/appointments/my');
      const sorted = (res.data || []).sort(
        (a: Appointment, b: Appointment) =>
          new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime()
      );
      setAppointments(sorted);
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ data: sorted, timestamp: Date.now() }));
    } catch (error) {
      console.error('Error loading appointments:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadOfficeStatus = async () => {
    try {
      const res = await api.get('/office-hours/status');
      setOfficeStatus(res.data);
    } catch (e) {
      console.error(e);
    }
    try {
      const cfg = await api.get('/local/office-hours');
      const isTaxSeason = cfg.data?.tax_season_config?.is_tax_season;
      const schedule = isTaxSeason
        ? cfg.data?.tax_season_config?.tax_season_schedule
        : cfg.data?.regular_schedule;
      if (schedule && Object.keys(schedule).length > 0) setWeeklySchedule(schedule);
    } catch (e) {
      console.error(e);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadAppointments();
    loadOfficeStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ===== Derived data =====
  const upcomingAppointments = useMemo(
    () =>
      appointments
        .filter(a => !isPast(new Date(a.scheduled_at)) && a.status !== 'cancelled')
        .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()),
    [appointments]
  );

  const pastAppointments = useMemo(
    () => appointments.filter(a => isPast(new Date(a.scheduled_at)) || a.status === 'cancelled'),
    [appointments]
  );

  const nextAppointment = upcomingAppointments[0] || null;

  // If user has no upcoming appointments, go straight to the booking screen
  useFocusEffect(
    useCallback(() => {
      if (!loading && user && upcomingAppointments.length === 0) {
        router.replace('/(tabs)/book-appointment');
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loading, user, upcomingAppointments.length])
  );

  // ===== Helpers =====
  const cleanTitle = (title: string) =>
    (title || '').replace('Appointment: ', '').replace('Cita: ', '');

  const formatTime12 = (t24: string) => {
    const [h, m] = (t24 || '0:0').split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
  };

  const scheduleLines = useMemo(() => {
    if (!weeklySchedule) return null;
    const order = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const labels =
      i18n.language === 'en'
        ? ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
        : ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    const closedLabel = t('appointments.closed', 'Cerrado');
    const dayText = (d: any) =>
      d?.is_open ? `${formatTime12(d.open_time)} - ${formatTime12(d.close_time)}` : closedLabel;
    const lines: string[] = [];
    let start = 0;
    for (let i = 1; i <= order.length; i++) {
      const prev = dayText(weeklySchedule[order[start]]);
      const cur = i < order.length ? dayText(weeklySchedule[order[i]]) : null;
      if (cur !== prev) {
        const label = start === i - 1 ? labels[start] : `${labels[start]} - ${labels[i - 1]}`;
        lines.push(`${label}: ${prev}`);
        start = i;
      }
    }
    return lines;
  }, [weeklySchedule, i18n.language, t]);

  const getCountdown = (d: string) => {
    const dt = new Date(d);
    if (isPast(dt)) return null;
    const days = differenceInDays(dt, now);
    const hrs = differenceInHours(dt, now) % 24;
    const mins = differenceInMinutes(dt, now) % 60;
    if (isToday(dt)) {
      return hrs === 0
        ? t('appointments.inMinutes', { mins, defaultValue: `En ${mins} min` })
        : t('appointments.todayIn', { hrs, mins, defaultValue: `Hoy en ${hrs}h ${mins}m` });
    }
    if (isTomorrow(dt)) return t('appointments.tomorrow', 'Mañana');
    if (days <= 7) return t('appointments.inDays', { days, defaultValue: `En ${days} días` });
    return null;
  };

  const canJoinNow = (d: string) => {
    const diff = (new Date(d).getTime() - now.getTime()) / 60000;
    return diff <= 15 && diff >= -60;
  };

  const joinVideoCall = async (apt: Appointment) => {
    if (!apt.meeting_link) {
      Alert.alert(t('common.error', 'Error'), t('appointments.noLinkAvailable', 'No hay enlace disponible'));
      return;
    }
    await Linking.openURL(apt.meeting_link);
  };

  const cancelAppointment = (id: string) => {
    Alert.alert(
      t('appointments.cancelAppointmentTitle', 'Cancelar Cita'),
      t('appointments.cancelAppointmentDesc', '¿Estás seguro de que deseas cancelar esta cita?'),
      [
        { text: t('appointments.no', 'No'), style: 'cancel' },
        {
          text: t('appointments.yesCancel', 'Sí, cancelar'),
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/appointments/${id}`);
              loadAppointments();
              Alert.alert('✅', t('appointments.cancelSuccess', 'Cita cancelada exitosamente'));
            } catch {
              Alert.alert(t('common.error', 'Error'), t('appointments.couldNotCancel', 'No se pudo cancelar la cita'));
            }
          },
        },
      ]
    );
  };

  const openMaps = () => {
    const addr = '305 Bruce Ave, Dumas, TX 79029';
    const url = Platform.select({
      ios: `maps://app?daddr=${encodeURIComponent(addr)}`,
      android: `google.navigation:q=${encodeURIComponent(addr)}`,
    });
    if (url) Linking.openURL(url);
  };

  const callOffice = () => Linking.openURL('tel:8069342018');

  const statusInfo = (status: string) => {
    switch (status) {
      case 'confirmed':
        return { color: colors.success, label: t('appointments.statusConfirmed', 'Confirmada') };
      case 'pending':
        return { color: colors.warning, label: t('appointments.statusPending', 'Pendiente') };
      case 'cancelled':
        return { color: colors.error, label: t('appointments.statusCancelled', 'Cancelada') };
      case 'completed':
        return { color: colors.info, label: t('appointments.statusCompleted', 'Completada') };
      default:
        return { color: colors.textGray, label: status };
    }
  };

  // ===== Render =====
  // Show spinner while loading or while redirecting to the booking screen
  if (loading || (user && upcomingAppointments.length === 0)) {
    return (
      <View style={s.container}>
        <LinearGradient colors={HEADER_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[s.header, { paddingTop: insets.top + 12 }]}>
          <Text style={s.headerTitle}>{t('appointments.title', 'Citas')}</Text>
          <Text style={s.headerSub}>Ross Tax Preparation</Text>
        </LinearGradient>
        <View style={s.loadingBox} testID="appointments-loading">
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={s.loadingText}>{t('common.loading', 'Cargando...')}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={s.container} testID="appointments-screen">
      {/* Header */}
      <LinearGradient colors={HEADER_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[s.header, { paddingTop: insets.top + 12 }]}>
        <Text style={s.headerTitle}>{t('appointments.title', 'Citas')}</Text>
        <Text style={s.headerSub}>Ross Tax Preparation</Text>
      </LinearGradient>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {/* Book CTA */}
        <TouchableOpacity
          testID="book-appointment-cta"
          style={s.bookCta}
          activeOpacity={0.85}
          onPress={() => router.push('/(tabs)/book-appointment')}
        >
          <LinearGradient colors={['#10B981', '#059669']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.bookCtaGradient}>
            <View style={s.bookCtaIcon}>
              <Ionicons name="calendar" size={26} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.bookCtaTitle}>{t('appointments.bookNew', 'Agendar Cita')}</Text>
              <Text style={s.bookCtaSub}>{t('appointments.bookDesc', 'Reserva una nueva cita')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color="rgba(255,255,255,0.9)" />
          </LinearGradient>
        </TouchableOpacity>

        {/* Office Status */}
        {officeStatus && (
          <View
            testID="office-status-bar"
            style={[
              s.officeBar,
              { backgroundColor: officeStatus.is_open ? colors.successLight : colors.errorLight },
            ]}
          >
            <View style={[s.officeBarDot, { backgroundColor: officeStatus.is_open ? colors.success : colors.error }]} />
            <Text style={[s.officeBarText, { color: officeStatus.is_open ? colors.success : colors.error }]}>
              {officeStatus.is_open
                ? t('appointments.officeOpen', 'Oficina abierta')
                : t('appointments.officeClosed', 'Oficina cerrada')}
              {officeStatus.hours ? ` • ${officeStatus.hours.open} - ${officeStatus.hours.close}` : ''}
            </Text>
          </View>
        )}

        {/* Next Appointment Hero */}
        {nextAppointment && (
          <View style={s.nextAptCard} testID="next-appointment-card">
            <LinearGradient colors={['#1e293b', '#334155']} style={s.nextAptGradient}>
              <View style={s.nextAptTop}>
                <View style={s.nextAptCountdown}>
                  <Text style={s.nextAptCountdownText}>
                    {getCountdown(nextAppointment.scheduled_at) || t('appointments.nextAppointment', 'Próxima cita')}
                  </Text>
                </View>
                <View style={s.nextAptType}>
                  <Ionicons
                    name={nextAppointment.appointment_type === 'video_call' ? 'videocam' : 'business'}
                    size={14}
                    color="#fff"
                  />
                  <Text style={s.nextAptTypeText}>
                    {nextAppointment.appointment_type === 'video_call'
                      ? t('appointments.videoCall', 'Virtual')
                      : t('appointments.inPerson', 'Presencial')}
                  </Text>
                </View>
              </View>
              <Text style={s.nextAptTitle} numberOfLines={1}>
                {cleanTitle(nextAppointment.title)}
              </Text>
              <View style={s.nextAptDetails}>
                <View style={s.nextAptDetail}>
                  <Ionicons name="calendar" size={14} color="rgba(255,255,255,0.8)" />
                  <Text style={s.nextAptDetailText}>
                    {format(new Date(nextAppointment.scheduled_at), 'EEE d MMM', { locale: dateLocale })}
                  </Text>
                </View>
                <View style={s.nextAptDetail}>
                  <Ionicons name="time" size={14} color="rgba(255,255,255,0.8)" />
                  <Text style={s.nextAptDetailText}>
                    {format(new Date(nextAppointment.scheduled_at), 'h:mm a')}
                  </Text>
                </View>
                <View style={s.nextAptDetail}>
                  <Ionicons name="hourglass" size={14} color="rgba(255,255,255,0.8)" />
                  <Text style={s.nextAptDetailText}>{nextAppointment.duration_minutes} min</Text>
                </View>
              </View>
              <View style={s.nextAptActions}>
                {nextAppointment.appointment_type === 'video_call' && canJoinNow(nextAppointment.scheduled_at) ? (
                  <TouchableOpacity testID="join-video-call-btn" style={s.nextAptBtn} onPress={() => joinVideoCall(nextAppointment)}>
                    <Ionicons name="videocam" size={16} color="#6C1110" />
                    <Text style={s.nextAptBtnText}>{t('appointments.join', 'Unirse')}</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity testID="open-maps-btn" style={s.nextAptBtn} onPress={openMaps}>
                    <Ionicons name="navigate" size={16} color="#6C1110" />
                    <Text style={s.nextAptBtnText}>{t('appointments.directions', 'Cómo llegar')}</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  testID="cancel-next-appointment-btn"
                  style={s.nextAptBtnSec}
                  onPress={() => cancelAppointment(nextAppointment.id)}
                >
                  <Ionicons name="close-circle-outline" size={18} color="#ff6b6b" />
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </View>
        )}

        {/* More upcoming */}
        {upcomingAppointments.length > 1 && (
          <View style={s.section}>
            <Text style={s.sectionLabel}>{t('appointments.otherUpcoming', 'Otras citas próximas')}</Text>
            {upcomingAppointments.slice(1).map(apt => (
              <TouchableOpacity
                key={apt.id}
                testID={`upcoming-apt-${apt.id}`}
                style={s.miniAptCard}
                onPress={() => cancelAppointment(apt.id)}
                activeOpacity={0.7}
              >
                <View style={[s.miniAptDot, { backgroundColor: colors.success }]} />
                <View style={{ flex: 1 }}>
                  <Text style={s.miniAptTitle} numberOfLines={1}>{cleanTitle(apt.title)}</Text>
                  <Text style={s.miniAptDate}>
                    {format(new Date(apt.scheduled_at), 'EEEE d MMMM, h:mm a', { locale: dateLocale })}
                  </Text>
                </View>
                <Ionicons
                  name={apt.appointment_type === 'video_call' ? 'videocam-outline' : 'business-outline'}
                  size={18}
                  color={colors.textGray}
                />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* History */}
        {pastAppointments.length > 0 && (
          <View style={s.section}>
            <TouchableOpacity
              testID="toggle-history-btn"
              style={s.historyToggle}
              onPress={() => setShowHistory(!showHistory)}
            >
              <Text style={s.sectionLabel}>
                {t('appointments.history', 'Historial')} ({pastAppointments.length})
              </Text>
              <Ionicons name={showHistory ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textGray} />
            </TouchableOpacity>
            {showHistory &&
              pastAppointments.slice(0, 15).map(apt => {
                const st = statusInfo(apt.status);
                return (
                  <View key={apt.id} style={[s.miniAptCard, { opacity: 0.75 }]}>
                    <View style={[s.miniAptDot, { backgroundColor: st.color }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={s.miniAptTitle} numberOfLines={1}>{cleanTitle(apt.title)}</Text>
                      <Text style={s.miniAptDate}>
                        {format(new Date(apt.scheduled_at), 'd MMM yyyy, h:mm a', { locale: dateLocale })} • {st.label}
                      </Text>
                    </View>
                  </View>
                );
              })}
          </View>
        )}

        {/* Office hours + contact */}
        <View style={s.infoCard}>
          <Ionicons name="information-circle" size={24} color={colors.primary} />
          <View style={s.infoContent}>
            <Text style={s.infoTitle}>{t('appointments.officeHours', 'Horario de Oficina')}</Text>
            {scheduleLines ? (
              scheduleLines.map(line => (
                <Text key={line} style={s.infoText}>{line}</Text>
              ))
            ) : (
              <Text style={s.infoText}>
                {t('appointments.callForHours', 'Llámanos para confirmar el horario')}
              </Text>
            )}
          </View>
        </View>

        <View style={s.contactCard}>
          <Text style={s.contactTitle}>{t('appointments.needHelp', '¿Necesitas ayuda?')}</Text>
          <TouchableOpacity testID="call-office-btn" style={s.contactRow} onPress={callOffice}>
            <Ionicons name="call" size={16} color={colors.success} />
            <Text style={s.contactText}>(806) 934-2018</Text>
          </TouchableOpacity>
          <TouchableOpacity testID="open-maps-contact-btn" style={s.contactRow} onPress={openMaps}>
            <Ionicons name="location" size={16} color={colors.error} />
            <Text style={s.contactText}>305 Bruce Ave, Dumas, TX 79029</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.backgroundGray,
    },
    header: {
      paddingBottom: 18,
      paddingHorizontal: 20,
    },
    headerTitle: {
      fontSize: 28,
      fontWeight: '700',
      color: '#fff',
    },
    headerSub: {
      fontSize: 14,
      color: 'rgba(255,255,255,0.85)',
      marginTop: 2,
    },
    loadingBox: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    loadingText: {
      marginTop: 12,
      fontSize: 14,
      color: colors.textGray,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      padding: 16,
      paddingBottom: 40,
    },
    bookCta: {
      borderRadius: 16,
      overflow: 'hidden',
      marginBottom: 14,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 6,
    },
    bookCtaGradient: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 18,
      gap: 14,
    },
    bookCtaIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: 'rgba(255,255,255,0.2)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    bookCtaTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: '#fff',
    },
    bookCtaSub: {
      fontSize: 13,
      color: 'rgba(255,255,255,0.9)',
      marginTop: 2,
    },
    officeBar: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 12,
      paddingVertical: 10,
      paddingHorizontal: 14,
      marginBottom: 14,
    },
    officeBarDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      marginRight: 8,
    },
    officeBarText: {
      fontSize: 13,
      fontWeight: '600',
      flex: 1,
    },
    nextAptCard: {
      borderRadius: 18,
      overflow: 'hidden',
      marginBottom: 18,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 10,
      elevation: 8,
    },
    nextAptGradient: {
      padding: 18,
    },
    nextAptTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    nextAptCountdown: {
      backgroundColor: 'rgba(16,185,129,0.25)',
      borderRadius: 20,
      paddingHorizontal: 12,
      paddingVertical: 5,
    },
    nextAptCountdownText: {
      color: '#6EE7B7',
      fontSize: 12,
      fontWeight: '700',
    },
    nextAptType: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: 'rgba(255,255,255,0.15)',
      borderRadius: 20,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    nextAptTypeText: {
      color: '#fff',
      fontSize: 12,
      fontWeight: '600',
    },
    nextAptTitle: {
      color: '#fff',
      fontSize: 19,
      fontWeight: '700',
      marginBottom: 10,
    },
    nextAptDetails: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 14,
      marginBottom: 16,
    },
    nextAptDetail: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    nextAptDetailText: {
      color: 'rgba(255,255,255,0.85)',
      fontSize: 13,
    },
    nextAptActions: {
      flexDirection: 'row',
      gap: 10,
    },
    nextAptBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: '#fff',
      borderRadius: 12,
      paddingVertical: 11,
    },
    nextAptBtnText: {
      color: '#6C1110',
      fontSize: 14,
      fontWeight: '700',
    },
    nextAptBtnSec: {
      width: 44,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,107,107,0.15)',
      borderRadius: 12,
    },
    section: {
      marginBottom: 18,
    },
    sectionLabel: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 10,
    },
    miniAptCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.backgroundCard,
      borderRadius: 14,
      padding: 14,
      marginBottom: 8,
      gap: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    miniAptDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    miniAptTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    miniAptDate: {
      fontSize: 12,
      color: colors.textGray,
      marginTop: 2,
      textTransform: 'capitalize',
    },
    historyToggle: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    infoCard: {
      backgroundColor: colors.backgroundCard,
      borderRadius: 16,
      padding: 18,
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
    infoContent: {
      marginLeft: 12,
      flex: 1,
    },
    infoTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 6,
    },
    infoText: {
      fontSize: 14,
      color: colors.textGray,
      marginBottom: 3,
    },
    contactCard: {
      backgroundColor: colors.warningLight,
      borderRadius: 16,
      padding: 18,
      marginBottom: 16,
    },
    contactTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.warning,
      marginBottom: 10,
    },
    contactRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 6,
    },
    contactText: {
      fontSize: 14,
      color: colors.text,
      fontWeight: '500',
    },
  });
