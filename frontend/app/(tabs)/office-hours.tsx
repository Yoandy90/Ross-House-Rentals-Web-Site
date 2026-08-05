import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useThemeColors } from '../../constants/colors';
import axios from 'axios';
import Constants from 'expo-constants';
import { useTranslation } from 'react-i18next';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8001';

interface DaySchedule {
  is_open: boolean;
  open_time: string | null;
  close_time: string | null;
}

interface WeekSchedule {
  [key: string]: DaySchedule;
}

export default function OfficeHoursClient() {
  const colors = useThemeColors();
  const { t } = useTranslation();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  
  const [schedule, setSchedule] = useState<WeekSchedule>({});
  const [currentStatus, setCurrentStatus] = useState<any>(null);
  const [nextOpening, setNextOpening] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const days = [
    { key: 'monday', label: 'Lunes', short: 'L' },
    { key: 'tuesday', label: 'Martes', short: 'M' },
    { key: 'wednesday', label: 'Miércoles', short: 'X' },
    { key: 'thursday', label: 'Jueves', short: 'J' },
    { key: 'friday', label: 'Viernes', short: 'V' },
    { key: 'saturday', label: t('officeHours.saturday'), short: 'S' },
    { key: 'sunday', label: t('officeHours.sunday'), short: 'D' },
  ];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      await Promise.all([
        loadSchedule(),
        loadCurrentStatus(),
        loadNextOpening(),
      ]);
      setLoading(false);
    } catch (error) {
      console.error('Error loading data:', error);
      setLoading(false);
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
    } catch (error) {
      console.error('Error loading schedule:', error);
    }
  };

  const loadCurrentStatus = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/office-hours/status`);
      setCurrentStatus(response.data);
    } catch (error) {
      console.error('Error loading status:', error);
    }
  };

  const loadNextOpening = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/office-hours/next-opening`);
      setNextOpening(response.data);
    } catch (error) {
      console.error('Error loading next opening:', error);
    }
  };

  const formatTime = (time: string | null) => {
    if (!time) return '--:--';
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Cargando horarios...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Enhanced Header */}
      <LinearGradient
        colors={['#6C1110', '#ED201D', '#FF6B6B']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.headerTop}>
          <View style={styles.headerIconContainer}>
            <Ionicons name="business" size={28} color="#FFF" />
          </View>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>Ross Tax Preparation</Text>
            <Text style={styles.headerSubtitle}>Horarios de Atención</Text>
          </View>
        </View>

        {/* Current Status Badge in Header */}
        {currentStatus && (
          <View style={[
            styles.headerStatusBadge,
            currentStatus.is_open ? styles.headerStatusOpen : styles.headerStatusClosed
          ]}>
            <View style={styles.statusIndicator}>
              <View style={[
                styles.statusDot,
                currentStatus.is_open ? styles.dotOpen : styles.dotClosed
              ]} />
              <Text style={styles.headerStatusText}>
                {currentStatus.is_open ? 'ABIERTO AHORA' : 'CERRADO'}
              </Text>
            </View>
            {currentStatus.current_time && (
              <Text style={styles.headerStatusTime}>
                {formatTime(currentStatus.current_time)}
              </Text>
            )}
          </View>
        )}
      </LinearGradient>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Today's Hours Card */}
        {currentStatus && currentStatus.hours && (
          <View style={styles.todayCard}>
            <View style={styles.todayCardHeader}>
              <Ionicons name="today" size={24} color={colors.primary} />
              <Text style={styles.todayCardTitle}>Horario de Hoy</Text>
            </View>
            <View style={styles.todayCardBody}>
              <View style={styles.todayTimeContainer}>
                <View style={styles.timeBlock}>
                  <Ionicons name="sunny" size={20} color="#FFA500" />
                  <Text style={styles.timeLabel}>Apertura</Text>
                  <Text style={styles.timeValue}>{formatTime(currentStatus.hours.open)}</Text>
                </View>
                <Ionicons name="arrow-forward" size={24} color={colors.textGray} />
                <View style={styles.timeBlock}>
                  <Ionicons name="moon" size={20} color="#6C1110" />
                  <Text style={styles.timeLabel}>Cierre</Text>
                  <Text style={styles.timeValue}>{formatTime(currentStatus.hours.close)}</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Next Opening Info */}
        {!currentStatus?.is_open && nextOpening && (
          <View style={styles.nextOpeningCard}>
            <View style={styles.nextOpeningHeader}>
              <Ionicons name="time" size={20} color="#FF9800" />
              <Text style={styles.nextOpeningTitle}>Próxima Apertura</Text>
            </View>
            <View style={styles.nextOpeningBody}>
              <Text style={styles.nextOpeningDay}>{nextOpening.next_opening_day}</Text>
              <Text style={styles.nextOpeningTime}>{formatTime(nextOpening.opens_at)}</Text>
              {nextOpening.days_until > 0 && (
                <View style={styles.daysUntilBadge}>
                  <Text style={styles.daysUntilText}>
                    En {nextOpening.days_until} {nextOpening.days_until === 1 ? 'día' : 'días'}
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Weekly Schedule */}
        <View style={styles.scheduleSection}>
          <View style={styles.sectionHeader}>
            <Ionicons name="calendar" size={24} color={colors.primary} />
            <Text style={styles.sectionTitle}>Horario Semanal</Text>
          </View>
          
          {/* Week Days Grid */}
          <View style={styles.weekGrid}>
            {days.map((day) => {
              const daySchedule = schedule[day.key];
              const isOpen = daySchedule?.is_open;
              
              return (
                <View
                  key={day.key}
                  style={[
                    styles.dayCard,
                    isOpen ? styles.dayOpenCard : styles.dayClosedCard
                  ]}
                >
                  <View style={styles.dayCardLeft}>
                    <View style={[
                      styles.dayInitialCircle,
                      isOpen ? styles.dayInitialCircleOpen : styles.dayInitialCircleClosed
                    ]}>
                      <Text style={[
                        styles.dayShort,
                        isOpen ? styles.dayShortOpen : styles.dayShortClosed
                      ]}>
                        {day.short}
                      </Text>
                    </View>
                    <Text style={[
                      styles.dayLabel,
                      isOpen ? styles.dayLabelOpen : styles.dayLabelClosed
                    ]}>
                      {day.label}
                    </Text>
                  </View>
                  
                  <View style={styles.dayCardRight}>
                    {isOpen ? (
                      <View style={styles.dayHoursContainer}>
                        <View style={styles.dayTimeRow}>
                          <View style={styles.timeIconContainer}>
                            <Ionicons name="time-outline" size={16} color={colors.primary} />
                          </View>
                          <View style={styles.dayHours}>
                            <Text style={styles.dayTimeOpen}>{formatTime(daySchedule.open_time)}</Text>
                            <Ionicons name="remove-outline" size={14} color={colors.textGray} />
                            <Text style={styles.dayTimeClose}>{formatTime(daySchedule.close_time)}</Text>
                          </View>
                        </View>
                      </View>
                    ) : (
                      <View style={styles.closedBadge}>
                        <Ionicons name="close-circle" size={16} color="#999" />
                        <Text style={styles.closedText}>{t('officeHours.closed')}</Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* Contact Info */}
        <View style={styles.contactSection}>
          <Text style={styles.sectionTitle}>Información de Contacto</Text>
          
          <View style={styles.contactItem}>
            <Ionicons name="call" size={24} color={colors.primary} />
            <View style={styles.contactInfo}>
              <Text style={styles.contactLabel}>Teléfono</Text>
              <Text style={styles.contactValue}>(806) 934-2018</Text>
            </View>
          </View>
          
          <View style={styles.contactItem}>
            <Ionicons name="logo-whatsapp" size={24} color={colors.primary} />
            <View style={styles.contactInfo}>
              <Text style={styles.contactLabel}>WhatsApp</Text>
              <Text style={styles.contactValue}>(806) 934-2018</Text>
            </View>
          </View>
          
          <View style={styles.contactItem}>
            <Ionicons name="mail" size={24} color={colors.primary} />
            <View style={styles.contactInfo}>
              <Text style={styles.contactLabel}>Email</Text>
              <Text style={styles.contactValue}>info@rosstaxpreparation.com</Text>
            </View>
          </View>
          
          <View style={styles.contactItem}>
            <Ionicons name="location" size={24} color={colors.primary} />
            <View style={styles.contactInfo}>
              <Text style={styles.contactLabel}>{t('officeHours.address')}</Text>
              <Text style={styles.contactValue}>305 Bruce Ave, Dumas, TX 79029</Text>
            </View>
          </View>
        </View>

        {/* Tips Card */}
        <View style={styles.tipsCard}>
          <Ionicons name="bulb" size={24} color="#FF9800" />
          <Text style={styles.tipsText}>
            💡 Consejo: Puedes agendar citas fuera del horario de oficina. Te contactaremos en el próximo día hábil.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: colors.textGray,
  },
  // Enhanced Header Styles
  header: {
    paddingTop: 60,
    paddingBottom: 24,
    paddingHorizontal: 20,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  headerIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFF',
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
  },
  headerStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginTop: 8,
  },
  headerStatusOpen: {
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(76, 175, 80, 0.4)',
  },
  headerStatusClosed: {
    backgroundColor: 'rgba(244, 67, 54, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(244, 67, 54, 0.4)',
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  dotOpen: {
    backgroundColor: '#4CAF50',
  },
  dotClosed: {
    backgroundColor: '#F44336',
  },
  headerStatusText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
    letterSpacing: 1,
  },
  headerStatusTime: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  // Today's Hours Card
  todayCard: {
    backgroundColor: colors.background,
    borderRadius: 20,
    padding: 24,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  todayCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(237, 32, 29, 0.15)',
  },
  todayCardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    flex: 1,
  },
  todayCardBody: {
    paddingVertical: 8,
  },
  todayTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  timeBlock: {
    flex: 1,
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(237, 32, 29, 0.05)',
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  timeLabel: {
    fontSize: 13,
    color: colors.textGray,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  timeValue: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.primary,
  },
  // Next Opening Card
  nextOpeningCard: {
    backgroundColor: '#FFF8E1',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#FFD54F',
    shadowColor: '#FF9800',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  nextOpeningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 152, 0, 0.2)',
  },
  nextOpeningTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F57C00',
    flex: 1,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  nextOpeningBody: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  nextOpeningDay: {
    fontSize: 22,
    fontWeight: '700',
    color: '#E65100',
    marginBottom: 8,
    textTransform: 'capitalize',
  },
  nextOpeningTime: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FF6F00',
    marginTop: 4,
    letterSpacing: 1,
  },
  daysUntilBadge: {
    backgroundColor: '#FF9800',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 16,
    marginTop: 16,
    shadowColor: '#FF9800',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  daysUntilText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFF',
    letterSpacing: 0.5,
  },
  statusSection: {
    marginBottom: 24,
  },
  statusBadge: {
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  openBadge: {
    backgroundColor: '#4CAF50',
  },
  closedBadge: {
    backgroundColor: '#F44336',
  },
  statusTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFF',
    marginTop: 12,
    letterSpacing: 1,
  },
  statusSubtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.95)',
    marginTop: 8,
    textAlign: 'center',
  },
  statusTime: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 12,
  },
  todayHours: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.3)',
  },
  todayHoursText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  nextOpeningCard: {
    flexDirection: 'row',
    backgroundColor: colors.backgroundGray,
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  nextOpeningInfo: {
    flex: 1,
  },
  nextOpeningLabel: {
    fontSize: 13,
    color: colors.textGray,
  },
  nextOpeningValue: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginTop: 4,
  },
  nextOpeningDays: {
    fontSize: 12,
    color: colors.primary,
    marginTop: 4,
  },
  scheduleSection: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  weekGrid: {
    gap: 12,
  },
  dayCard: {
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  dayOpenCard: {
    backgroundColor: colors.background,
    borderColor: colors.primary,
    borderWidth: 2,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  dayClosedCard: {
    backgroundColor: colors.backgroundGray,
    borderColor: '#E0E0E0',
    opacity: 0.7,
  },
  dayCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  dayCardRight: {
    flexShrink: 0,
  },
  dayInitialCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayInitialCircleOpen: {
    backgroundColor: colors.primary,
  },
  dayInitialCircleClosed: {
    backgroundColor: '#E0E0E0',
  },
  dayShort: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  dayShortOpen: {
    color: '#FFF',
  },
  dayShortClosed: {
    color: '#999',
  },
  dayLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  dayLabelOpen: {
    color: colors.text,
  },
  dayLabelClosed: {
    color: colors.textGray,
  },
  dayHoursContainer: {
    alignItems: 'flex-end',
  },
  dayTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timeIconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(237, 32, 29, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayHours: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dayTimeOpen: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  dayTimeClose: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textGray,
  },
  closedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  closedText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#999',
  },
  contactSection: {
    marginBottom: 24,
  },
  contactItem: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
    gap: 16,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  contactInfo: {
    flex: 1,
  },
  contactLabel: {
    fontSize: 12,
    color: colors.textGray,
    marginBottom: 6,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  contactValue: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  tipsCard: {
    flexDirection: 'row',
    backgroundColor: '#E8F5E9',
    borderRadius: 16,
    padding: 18,
    gap: 12,
    marginBottom: 24,
    borderWidth: 1.5,
    borderColor: '#81C784',
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  tipsText: {
    flex: 1,
    fontSize: 14,
    color: '#2E7D32',
    lineHeight: 22,
    fontWeight: '500',
  },
});
